from __future__ import annotations

import asyncio
import logging

from core.config import Settings
from services.audio_capture import AudioCapture
from services.broadcast import BroadcastHub
from services.interpreters.factory import create_interpreter
from services.interpreters.protocol import LiveInterpreter
from services.operator_store import OperatorSettingsStore, store as default_store

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(
        self,
        settings: Settings,
        hub: BroadcastHub,
        operator_store: OperatorSettingsStore | None = None,
    ) -> None:
        self._settings = settings
        self._hub = hub
        self._store = operator_store or default_store
        self._interpreter: LiveInterpreter | None = None
        self._capture: AudioCapture | None = None
        self._tasks: list[asyncio.Task[None]] = []
        self._running = False
        self._lifecycle_lock = asyncio.Lock()

    @property
    def running(self) -> bool:
        return self._running

    def status(self) -> dict[str, object]:
        return {
            "running": self._running,
            "listener_count": self._hub.listener_count,
        }

    async def start(self) -> None:
        async with self._lifecycle_lock:
            if self._running:
                return
            runtime = self._store.overlay_settings(self._settings)
            if runtime.interpreter == "gemini" and not runtime.gemini_api_key:
                raise RuntimeError("Gemini API key is not set")
            interpreter = create_interpreter(runtime)
            capture = AudioCapture(self._settings)
            await interpreter.start()
            try:
                await capture.start()
            except Exception:
                await interpreter.close()
                raise
            self._interpreter = interpreter
            self._capture = capture
            self._running = True
            self._tasks = [
                asyncio.create_task(self._pump_capture(), name="pump-capture"),
                asyncio.create_task(self._pump_events(), name="pump-events"),
            ]
            logger.info("Session started with interpreter=%s", runtime.interpreter)
            await self._hub.broadcast_operator(
                {
                    "type": "status",
                    "running": True,
                    "listenerCount": self._hub.listener_count,
                }
            )

    async def stop(self) -> None:
        async with self._lifecycle_lock:
            await self._stop_locked()

    async def _stop_locked(self) -> None:
        self._running = False
        current_task = asyncio.current_task()
        for task in self._tasks:
            if task is not current_task:
                task.cancel()
        other_tasks = [
            task for task in self._tasks if task is not current_task
        ]
        if other_tasks:
            await asyncio.gather(*other_tasks, return_exceptions=True)
        self._tasks = []
        if self._capture is not None:
            await self._capture.stop()
            self._capture = None
        if self._interpreter is not None:
            await self._interpreter.close()
            self._interpreter = None
        logger.info("Session stopped")
        await self._hub.broadcast_operator(
            {
                "type": "status",
                "running": False,
                "listenerCount": self._hub.listener_count,
            }
        )

    async def _pump_capture(self) -> None:
        assert self._capture is not None
        assert self._interpreter is not None
        try:
            async for chunk in self._capture.chunks():
                if not self._running:
                    break
                await self._interpreter.send_pcm(chunk)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Capture pump error: %s", exc)

    async def _pump_events(self) -> None:
        assert self._interpreter is not None
        try:
            async for event in self._interpreter.events():
                if event.kind == "audio" and event.pcm:
                    await self._hub.broadcast_audio(event.pcm, event.sample_rate)
                elif event.kind in ("text", "output_text") and event.text:
                    await self._hub.broadcast_text(event.text)
                    await self._hub.broadcast_operator(
                        {
                            "type": "transcript",
                            "role": "output",
                            "text": event.text,
                        }
                    )
                elif event.kind == "input_text" and event.text:
                    await self._hub.broadcast_operator(
                        {
                            "type": "transcript",
                            "role": "input",
                            "text": event.text,
                        }
                    )
                elif event.kind == "error" and event.text:
                    logger.error("Interpreter error: %s", event.text)
                    await self._hub.broadcast_operator(
                        {"type": "error", "text": event.text}
                    )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Interpreter event pump error: %s", exc)
        finally:
            if self._running and asyncio.current_task() in self._tasks:
                async with self._lifecycle_lock:
                    if self._running:
                        await self._stop_locked()
