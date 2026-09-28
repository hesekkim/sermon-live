from __future__ import annotations

import asyncio
import logging
import time
from typing import Literal

from core.config import Settings
from services.audio_runtime import AudioRuntime
from services.broadcast import BroadcastHub
from services.interpreters.factory import create_interpreter
from services.interpreters.protocol import KeyValidationError, LiveInterpreter
from services.operator_store import OperatorSettingsStore, store as default_store

logger = logging.getLogger(__name__)

SessionState = Literal["off", "starting", "live", "stopping", "error"]
TerminationReason = Literal[
    "manual",
    "auto_stop",
    "hard_limit",
    "interpreter_error",
    "device_error",
    "server_shutdown",
]


class SessionTransitionError(RuntimeError):
    pass


class _TranslationSessionService:
    def __init__(
        self,
        settings: Settings,
        hub: BroadcastHub,
        audio: AudioRuntime,
        operator_store: OperatorSettingsStore | None = None,
    ) -> None:
        self._settings = settings
        self._hub = hub
        self._audio = audio
        self._store = operator_store or default_store
        self._state: SessionState = "off"
        self._error: str | None = None
        self._last_termination_reason: str | None = None
        self._interpreter: LiveInterpreter | None = None
        self._audio_task: asyncio.Task[None] | None = None
        self._audio_in_flight: bytes | None = None
        self._event_task: asyncio.Task[None] | None = None
        self._timer_task: asyncio.Task[None] | None = None
        self._timer_started_at: float | None = None
        self._timer_deadline_at: float | None = None
        self._timer_warning_sent = False
        self._timer_extension_count = 0
        self._active_settings: Settings | None = None
        self._clock = time.monotonic
        self._transition_lock = asyncio.Lock()
        self._audio.on_device_error = self._handle_device_error

    @property
    def running(self) -> bool:
        return self._state == "live"

    @property
    def state(self) -> SessionState:
        return self._state

    def status(self) -> dict[str, object]:
        start_block_reason = self._start_block_reason()
        payload = {
            "running": self.running,
            "session_status": self._state,
            "listener_count": self._hub.listener_count,
            "audio_ready": self._audio.ready,
            "audio_error": self._audio.error,
            "error": self._error,
            "last_termination_reason": self._last_termination_reason,
            "start_available": start_block_reason is None,
            "start_block_reason": start_block_reason,
            "audio_dropped_chunks": getattr(self._audio, "dropped_chunks", 0),
            "audio_dropped_duration_seconds": getattr(
                self._audio, "dropped_duration_seconds", 0.0
            ),
            "audio_queued_duration_seconds": getattr(
                self._audio, "queued_duration_seconds", 0.0
            ),
        }
        timer = self._timer_status()
        if timer is not None:
            payload["timer"] = timer
        return payload

    def session_event(self) -> dict[str, object]:
        payload = self.status()
        payload["type"] = "translation_status"
        return payload

    def _auto_stop_seconds(self) -> float:
        settings = self._active_settings or self._settings
        return float(settings.translation_session_auto_stop_minutes * 60)

    def _warning_before_stop_seconds(self) -> float:
        settings = self._active_settings or self._settings
        return float(settings.translation_session_warning_minutes * 60)

    def _extension_seconds(self) -> float:
        settings = self._active_settings or self._settings
        return float(settings.translation_session_extension_minutes * 60)

    def _hard_limit_seconds(self) -> float:
        settings = self._active_settings or self._settings
        return float(settings.translation_session_hard_limit_minutes * 60)

    def _timer_status(self) -> dict[str, object] | None:
        if self._state != "live" or self._timer_started_at is None:
            return None
        now = self._clock()
        deadline = self._timer_deadline_at or (
            self._timer_started_at + self._auto_stop_seconds()
        )
        elapsed = max(0.0, now - self._timer_started_at)
        remaining = max(0.0, deadline - now)
        hard_limit = self._timer_started_at + self._hard_limit_seconds()
        return {
            "elapsedSeconds": int(elapsed),
            "remainingSeconds": int(remaining),
            "warning": remaining <= self._warning_before_stop_seconds(),
            "extensionMinutes": int(self._extension_seconds() / 60),
            "extensionCount": self._timer_extension_count,
            "hardLimitReached": now >= hard_limit,
        }

    async def _publish_timer(self) -> None:
        timer = self._timer_status()
        if timer is None:
            return
        payload = {"type": "timer", "timer": timer}
        broadcaster = getattr(self._hub, "broadcast_session", None)
        if broadcaster is None:
            await self._hub.broadcast_operator(payload)
        else:
            await broadcaster(payload)

    async def _refresh_timer_state(self) -> None:
        if self._state != "live" or self._timer_started_at is None:
            return
        now = self._clock()
        deadline = self._timer_deadline_at or (
            self._timer_started_at + self._auto_stop_seconds()
        )
        hard_limit = self._timer_started_at + self._hard_limit_seconds()
        if now >= hard_limit:
            reason: TerminationReason | None = "hard_limit"
        elif now >= deadline:
            reason = "auto_stop"
        else:
            reason = None
        if reason is not None:
            async with self._transition_lock:
                if self._state != "live":
                    return
                self._state = "stopping"
                await self._publish_status()
            await self._finish(reason, current_task=asyncio.current_task())
            return
        timer = self._timer_status()
        if timer is None:
            return
        warning = bool(timer["warning"])
        if warning and not self._timer_warning_sent:
            self._timer_warning_sent = True
            await self._publish_timer()
        elif not warning:
            self._timer_warning_sent = False
        await self._publish_status()

    async def _run_timer_loop(self) -> None:
        while self._state == "live":
            await asyncio.sleep(1.0)
            await self._refresh_timer_state()

    async def start(self) -> None:
        async with self._transition_lock:
            if self._state not in ("off", "error"):
                raise SessionTransitionError(
                    f"Cannot start translation session while {self._state}"
                )
            if not self._audio.ready:
                message = self._audio.error or "Audio input device is not available"
                self._state = "error"
                self._error = message
                await self._publish_status()
                await self._publish_error(message)
                raise RuntimeError(message)
            self._state = "starting"
            self._error = None
            self._last_termination_reason = None
            self._timer_started_at = None
            self._timer_deadline_at = None
            self._timer_warning_sent = False
            self._timer_extension_count = 0
            await self._publish_status()

        interpreter: LiveInterpreter | None = None
        try:
            runtime = self._store.overlay_settings(self._settings)
            if runtime.interpreter == "openai" and not runtime.openai_api_key:
                self._store.set_key_status(
                    runtime.interpreter, "missing", "OpenAI API key is not set"
                )
                raise RuntimeError("OpenAI API key is not set")

            interpreter = create_interpreter(runtime)
            try:
                await interpreter.validate_key()
            except KeyValidationError as exc:
                self._store.set_key_status(runtime.interpreter, "invalid", str(exc))
                raise RuntimeError(str(exc)) from exc
            await interpreter.start()
            if runtime.interpreter == "openai":
                self._store.set_key_status(runtime.interpreter, "valid")

            audio_queue = self._audio.attach_translation(interpreter)
            async with self._transition_lock:
                self._interpreter = interpreter
                self._active_settings = runtime
                self._state = "live"
                self._timer_started_at = self._clock()
                self._timer_deadline_at = self._timer_started_at + self._auto_stop_seconds()
                self._timer_warning_sent = False
                self._timer_extension_count = 0
                self._audio_task = asyncio.create_task(
                    self._pump_audio(audio_queue), name="pump-translation-audio"
                )
                self._event_task = asyncio.create_task(
                    self._pump_events(interpreter), name="pump-interpreter-events"
                )
                self._timer_task = asyncio.create_task(
                    self._run_timer_loop(), name="translation-session-timer"
                )
                await self._publish_status()
        except asyncio.CancelledError:
            await self._abort_start(interpreter)
            raise
        except Exception as exc:
            if interpreter is not None:
                await self._close_interpreter(interpreter)
            queue = await self._audio.finish_translation()
            if queue is not None:
                await self._drain_audio_queue(queue, None)
            message = str(exc) or "Translation session failed to start"
            async with self._transition_lock:
                self._state = "error"
                self._error = message
                await self._publish_error(message)
                await self._publish_status()
            raise

    async def stop(self, reason: TerminationReason = "manual") -> None:
        async with self._transition_lock:
            if self._state != "live":
                raise SessionTransitionError(
                    f"Cannot stop translation session while {self._state}"
                )
            self._state = "stopping"
            await self._publish_status()
        await self._finish(reason)

    async def extend_session(self) -> dict[str, object]:
        async with self._transition_lock:
            if self._state != "live":
                if self._last_termination_reason == "hard_limit":
                    raise RuntimeError("Hard limit reached; the session cannot be extended")
                raise SessionTransitionError(
                    f"Cannot extend translation session while {self._state}"
                )
            if self._timer_started_at is None or self._timer_deadline_at is None:
                raise RuntimeError("Translation session timer is not active")
            now = self._clock()
            hard_limit = self._timer_started_at + self._hard_limit_seconds()
            if now >= hard_limit:
                raise RuntimeError("Hard limit reached; the session cannot be extended")
            if now >= self._timer_deadline_at:
                raise RuntimeError("Auto-stop deadline has passed; the session cannot be extended")
            remaining = self._timer_deadline_at - now
            if remaining > self._warning_before_stop_seconds():
                raise RuntimeError(
                    "Session extension is only available during the warning period"
                )
            if self._timer_deadline_at >= hard_limit:
                raise RuntimeError(
                    "Session is already scheduled to stop at the hard limit"
                )
            next_deadline = min(
                self._timer_deadline_at + self._extension_seconds(),
                hard_limit,
            )
            self._timer_deadline_at = next_deadline
            self._timer_warning_sent = False
            self._timer_extension_count += 1
            timer = self._timer_status()
            await self._publish_timer()
            await self._publish_status()
            return timer or {}

    async def shutdown(self) -> None:
        if self._state == "live":
            await self.stop("server_shutdown")

    async def _abort_start(self, interpreter: LiveInterpreter | None) -> None:
        async with self._transition_lock:
            self._state = "stopping"
            await self._publish_status()

        await self._audio.finish_translation(discard_pending=True)
        tasks = [task for task in (self._audio_task, self._event_task) if task]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        if interpreter is not None:
            await self._close_interpreter(interpreter)

        async with self._transition_lock:
            self._interpreter = None
            self._audio_task = None
            self._event_task = None
            self._active_settings = None
            self._state = "off"
            await self._publish_status()

    async def _finish(
        self,
        reason: TerminationReason,
        error: str | None = None,
        current_task: asyncio.Task[object] | None = None,
    ) -> None:
        discard_pending = current_task is self._audio_task or reason in (
            "interpreter_error",
            "device_error",
        )
        queue = await self._audio.finish_translation(
            discard_pending=discard_pending
        )
        audio_task = self._audio_task
        if queue is not None and audio_task is not None and audio_task is not current_task:
            if discard_pending:
                audio_task.cancel()
                await asyncio.gather(audio_task, return_exceptions=True)
            else:
                timeout = self._active_settings or self._settings
                try:
                    await asyncio.wait_for(
                        asyncio.shield(audio_task),
                        timeout=timeout.translation_drain_timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    in_flight = self._audio_in_flight
                    audio_task.cancel()
                    try:
                        await asyncio.wait_for(
                            asyncio.gather(audio_task, return_exceptions=True),
                            timeout=min(timeout.translation_drain_timeout_seconds, 0.25),
                        )
                    except asyncio.TimeoutError:
                        logger.warning("Translation audio task did not stop after cancellation")
                    discard = getattr(self._audio, "discard_translation_pending", None)
                    if discard is not None:
                        await discard(queue)
                    record_drop = getattr(self._audio, "record_translation_drop", None)
                    if in_flight is not None and record_drop is not None:
                        await record_drop(in_flight)

        interpreter = self._interpreter
        if interpreter is not None:
            await self._close_interpreter(interpreter)

        event_task = self._event_task
        if event_task is not None and event_task is not current_task:
            try:
                await asyncio.wait_for(asyncio.shield(event_task), timeout=2.0)
            except asyncio.TimeoutError:
                event_task.cancel()
                await asyncio.gather(event_task, return_exceptions=True)

        async with self._transition_lock:
            timer_task = self._timer_task
            self._timer_task = None
            if timer_task is not None and timer_task is not current_task:
                timer_task.cancel()
                await asyncio.gather(timer_task, return_exceptions=True)
            self._interpreter = None
            self._audio_task = None
            self._event_task = None
            self._timer_started_at = None
            self._timer_deadline_at = None
            self._timer_warning_sent = False
            self._timer_extension_count = 0
            self._active_settings = None
            self._error = error
            self._last_termination_reason = reason
            self._state = (
                "error"
                if reason in ("interpreter_error", "device_error")
                else "off"
            )
            if error:
                await self._publish_error(error)
            await self._publish_status()
            await self._publish_ended(reason)

    async def _pump_audio(self, queue: asyncio.Queue[bytes | None]) -> None:
        interpreter = self._interpreter
        if interpreter is None:
            return
        while True:
            chunk = await queue.get()
            if chunk is None:
                return
            self._audio_in_flight = chunk
            try:
                await interpreter.send_pcm(chunk)
            finally:
                self._audio_in_flight = None

    async def _pump_events(self, interpreter: LiveInterpreter) -> None:
        try:
            async for event in interpreter.events():
                if event.kind == "audio" and event.pcm:
                    await self._hub.broadcast_audio(event.pcm, event.sample_rate)
                elif event.kind in ("text", "output_text") and event.text:
                    await self._hub.broadcast_text(event.text)
                    await self._hub.broadcast_operator(
                        {"type": "transcript", "role": "output", "text": event.text}
                    )
                elif event.kind == "input_text" and event.text:
                    await self._hub.broadcast_operator(
                        {"type": "transcript", "role": "input", "text": event.text}
                    )
                elif event.kind == "error" and event.text:
                    logger.error("Interpreter error: %s", event.text)
                    await self._finish_from_task(
                        "interpreter_error", event.text
                    )
                    return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Interpreter event pump failed")
            await self._finish_from_task("interpreter_error", str(exc))
            return
        if self._state == "live":
            await self._finish_from_task(
                "interpreter_error", "Interpreter event stream ended unexpectedly"
            )

    async def _finish_from_task(
        self, reason: TerminationReason, error: str
    ) -> None:
        async with self._transition_lock:
            if self._state != "live":
                return
            self._state = "stopping"
            await self._publish_status()
        await self._finish(reason, error, asyncio.current_task())

    async def _handle_device_error(self, message: str) -> None:
        await self._finish_from_task("device_error", message)

    async def _drain_audio_queue(
        self,
        queue: asyncio.Queue[bytes | None],
        interpreter: LiveInterpreter | None,
    ) -> None:
        while True:
            chunk = await queue.get()
            if chunk is None:
                return
            if interpreter is not None:
                await interpreter.send_pcm(chunk)

    async def _close_interpreter(self, interpreter: LiveInterpreter) -> None:
        try:
            await interpreter.close()
        except Exception:
            logger.exception("Interpreter close failed")

    async def _publish_status(self) -> None:
        payload = self.session_event()
        broadcaster = getattr(self._hub, "broadcast_session", None)
        if broadcaster is None:
            await self._hub.broadcast_operator(payload)
        else:
            await broadcaster(payload)

    async def _publish_error(self, message: str) -> None:
        payload = {
            "type": "error",
            "text": message,
            "session_status": self._state,
        }
        broadcaster = getattr(self._hub, "broadcast_session", None)
        if broadcaster is None:
            await self._hub.broadcast_operator(payload)
        else:
            await broadcaster(payload)

    async def _publish_ended(self, reason: TerminationReason) -> None:
        payload = {
            "type": "session_ended",
            "reason": reason,
            "audio_dropped_chunks": getattr(self._audio, "dropped_chunks", 0),
            "audio_dropped_duration_seconds": getattr(
                self._audio, "dropped_duration_seconds", 0.0
            ),
        }
        broadcaster = getattr(self._hub, "broadcast_session", None)
        if broadcaster is None:
            await self._hub.broadcast_operator(payload)
        else:
            await broadcaster(payload)


class SessionService(_TranslationSessionService):
    def __init__(
        self,
        settings: Settings,
        hub: BroadcastHub,
        audio: AudioRuntime,
        operator_store: OperatorSettingsStore | None = None,
    ) -> None:
        super().__init__(settings, hub, audio, operator_store)
        self._first_audio_chunk_since_text_sent_at: float | None = None

    async def _pump_audio(self, queue: asyncio.Queue[bytes | None]) -> None:
        interpreter = self._interpreter
        if interpreter is None:
            return
        self._first_audio_chunk_since_text_sent_at = None
        loop = asyncio.get_running_loop()
        try:
            while True:
                chunk = await queue.get()
                if chunk is None:
                    return
                self._audio_in_flight = chunk
                try:
                    await interpreter.send_pcm(chunk)
                finally:
                    self._audio_in_flight = None
                if self._first_audio_chunk_since_text_sent_at is None:
                    self._first_audio_chunk_since_text_sent_at = loop.time()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Translation audio pump failed")
            await self._finish_from_task("interpreter_error", str(exc))

    async def _pump_events(self, interpreter: LiveInterpreter) -> None:
        loop = asyncio.get_running_loop()
        try:
            async for event in interpreter.events():
                if event.kind == "audio" and event.pcm:
                    await self._hub.broadcast_audio(event.pcm, event.sample_rate)
                elif event.kind in ("text", "output_text") and event.text:
                    if self._first_audio_chunk_since_text_sent_at is not None:
                        latency_ms = max(
                            0,
                            round(
                                (
                                    loop.time()
                                    - self._first_audio_chunk_since_text_sent_at
                                )
                                * 1000
                            ),
                        )
                        self._first_audio_chunk_since_text_sent_at = None
                        await self._hub.broadcast_operator(
                            {"type": "latency", "milliseconds": latency_ms}
                        )
                    await self._hub.broadcast_text(event.text)
                    await self._hub.broadcast_operator(
                        {"type": "transcript", "role": "output", "text": event.text}
                    )
                elif event.kind == "input_text" and event.text:
                    await self._hub.broadcast_operator(
                        {"type": "transcript", "role": "input", "text": event.text}
                    )
                elif event.kind == "error" and event.text:
                    await self._finish_from_task("interpreter_error", event.text)
                    return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Interpreter event pump failed")
            await self._finish_from_task("interpreter_error", str(exc))
            return
        if self._state == "live":
            await self._finish_from_task(
                "interpreter_error", "Interpreter event stream ended unexpectedly"
            )

    def _start_block_reason(self) -> str | None:
        if self._state not in ("off", "error"):
            return f"Translation session is {self._state}"
        if not self._audio.ready:
            return self._audio.error or "Audio input device is not available"
        runtime = self._store.overlay_settings(self._settings)
        if runtime.interpreter == "openai":
            settings_view = self._store.public_view(self._settings)
            if not settings_view["openai_key_set"]:
                return "OpenAI API key is not set"
            if settings_view["openai_key_status"] == "invalid":
                return str(settings_view["openai_key_warning"] or "OpenAI API key is invalid")
        return None

    def status(self) -> dict[str, object]:
        result = super().status()
        reason = self._start_block_reason()
        result["start_available"] = reason is None
        result["start_block_reason"] = reason
        return result

    def session_event(self) -> dict[str, object]:
        result = super().session_event()
        reason = self._start_block_reason()
        result["startAvailable"] = reason is None
        result["startBlockReason"] = reason
        return result
