from __future__ import annotations

import asyncio
import base64
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any
from urllib.parse import urlencode

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from core.config import Settings
from services.interpreters.protocol import InterpreterEvent, KeyValidationError

logger = logging.getLogger(__name__)

_CONNECTION_ERRORS = (ConnectionClosed, OSError)


class OpenAIRealtimeInterpreter:
    """OpenAI Realtime translation adapter using 24 kHz PCM16 mono audio."""

    required_sample_rate = 24000
    required_channels = 1
    required_sample_width = 2
    _BASE_URL = "wss://api.openai.com/v1/realtime/translations"
    _CLOSE_TIMEOUT_SECONDS = 10.0
    _RECONNECT_DELAYS_SECONDS: tuple[float, ...] = (0.5, 1.0, 2.0, 4.0)

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        websocket_factory: Callable[..., Awaitable[Any]] | None = None,
    ) -> None:
        self._settings = settings or Settings(interpreter="openai")
        self._websocket_factory = websocket_factory or connect
        self._websocket: Any | None = None
        self._event_queue: asyncio.Queue[InterpreterEvent | None] | None = None
        self._reader_task: asyncio.Task[None] | None = None
        self._session_closed = asyncio.Event()
        self._connected = asyncio.Event()
        self._closing = False
        self._failed = False

    def _url(self) -> str:
        query = urlencode({"model": self._settings.openai_model})
        return f"{self._BASE_URL}?{query}"

    async def _connect(self) -> Any:
        api_key = self._settings.openai_api_key
        if not api_key:
            raise KeyValidationError("OpenAI API key is not set")
        return await self._websocket_factory(
            self._url(),
            additional_headers={"Authorization": f"Bearer {api_key}"},
            open_timeout=10,
        )

    async def _receive_json(self, websocket: Any) -> dict[str, Any]:
        message = await websocket.recv()
        if isinstance(message, bytes):
            message = message.decode("utf-8")
        event = json.loads(message)
        if not isinstance(event, dict):
            raise RuntimeError("OpenAI Realtime returned an invalid event")
        return event

    def _error_message(self, event: dict[str, Any]) -> str:
        error = event.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message:
                api_key = self._settings.openai_api_key
                return message.replace(api_key, "[REDACTED]") if api_key else message
        return "OpenAI Realtime rejected the session"

    async def validate_key(self) -> None:
        try:
            websocket = await self._connect()
        except KeyValidationError:
            raise
        except Exception as exc:
            if _is_authentication_rejection(exc):
                raise KeyValidationError("OpenAI API key is invalid") from exc
            raise RuntimeError("OpenAI Realtime connection failed") from exc
        try:
            try:
                event = await self._receive_json(websocket)
            except Exception as exc:
                raise RuntimeError("OpenAI Realtime connection failed") from exc
            if event.get("type") == "error":
                error = event.get("error")
                code = error.get("code") if isinstance(error, dict) else None
                if code in {"invalid_api_key", "authentication_error"}:
                    raise KeyValidationError("OpenAI API key is invalid")
                raise RuntimeError("OpenAI Realtime rejected the validation session")
            if event.get("type") != "session.created":
                raise RuntimeError("OpenAI Realtime session handshake failed")
        finally:
            await websocket.close()

    async def _open_session(self) -> Any:
        websocket = await self._connect()
        try:
            created = await self._receive_json(websocket)
            if created.get("type") == "error":
                raise RuntimeError(self._error_message(created))
            if created.get("type") != "session.created":
                raise RuntimeError("OpenAI Realtime session handshake failed")

            audio_settings: dict[str, Any] = {
                "output": {"language": self._settings.translation_target_language}
            }
            await websocket.send(
                json.dumps(
                    {
                        "type": "session.update",
                        "session": {"audio": audio_settings},
                    }
                )
            )
            updated = await self._receive_json(websocket)
            if updated.get("type") == "error":
                raise RuntimeError(self._error_message(updated))
            if updated.get("type") != "session.updated":
                raise RuntimeError("OpenAI Realtime session configuration failed")
        except BaseException:
            await websocket.close()
            raise
        return websocket

    async def start(self) -> None:
        if self._websocket is not None:
            raise RuntimeError("OpenAI Realtime session is already started")
        self._closing = False
        self._failed = False
        self._websocket = await self._open_session()
        self._event_queue = asyncio.Queue()
        self._session_closed.clear()
        self._connected.set()
        self._reader_task = asyncio.create_task(
            self._run_reader(self._event_queue), name="openai-realtime-events"
        )

    async def send_pcm(self, chunk: bytes) -> None:
        if self._websocket is None or self._reader_task is None:
            raise RuntimeError("OpenAI Realtime session is not started")
        message = json.dumps(
            {
                "type": "session.input_audio_buffer.append",
                "audio": base64.b64encode(chunk).decode("ascii"),
            }
        )
        while True:
            await self._connected.wait()
            if self._failed:
                raise RuntimeError("OpenAI Realtime connection lost")
            websocket = self._websocket
            if websocket is None:
                raise RuntimeError("OpenAI Realtime session is not started")
            try:
                await websocket.send(message)
                return
            except _CONNECTION_ERRORS:
                if self._closing:
                    raise
                if self._websocket is websocket:
                    self._connected.clear()

    async def _run_reader(
        self, queue: asyncio.Queue[InterpreterEvent | None]
    ) -> None:
        try:
            while True:
                websocket = self._websocket
                failure: BaseException | None = None
                try:
                    session_closed = await self._read_events(websocket, queue)
                except asyncio.CancelledError:
                    raise
                except _CONNECTION_ERRORS as exc:
                    session_closed = False
                    failure = exc
                except Exception as exc:
                    await queue.put(InterpreterEvent(kind="error", text=str(exc)))
                    return
                if session_closed or self._closing:
                    return
                self._connected.clear()
                logger.warning(
                    "OpenAI Realtime connection lost (%s); reconnecting",
                    type(failure).__name__ if failure else "closed",
                )
                await queue.put(InterpreterEvent(kind="reconnecting"))
                if not await self._reconnect(websocket):
                    self._failed = True
                    self._connected.set()
                    await queue.put(
                        InterpreterEvent(
                            kind="error", text="OpenAI Realtime connection lost"
                        )
                    )
                    return
                await queue.put(InterpreterEvent(kind="reconnected"))
        finally:
            self._session_closed.set()
            await queue.put(None)

    async def _read_events(
        self, websocket: Any, queue: asyncio.Queue[InterpreterEvent | None]
    ) -> bool:
        async for message in websocket:
            if isinstance(message, bytes):
                message = message.decode("utf-8")
            event = json.loads(message)
            if not isinstance(event, dict):
                continue
            translated = self._to_interpreter_event(event)
            if translated is not None:
                await queue.put(translated)
            if event.get("type") == "session.closed":
                return True
        return False

    async def _reconnect(self, previous: Any) -> bool:
        try:
            await previous.close()
        except Exception:
            pass
        for attempt, delay in enumerate(self._RECONNECT_DELAYS_SECONDS, start=1):
            await asyncio.sleep(delay)
            if self._closing:
                return False
            try:
                websocket = await self._open_session()
            except KeyValidationError:
                return False
            except Exception as exc:
                logger.warning(
                    "OpenAI Realtime reconnect attempt %s failed: %s",
                    attempt,
                    type(exc).__name__,
                )
                continue
            if self._closing:
                await websocket.close()
                return False
            self._websocket = websocket
            self._connected.set()
            logger.info("OpenAI Realtime reconnected after %s attempt(s)", attempt)
            return True
        return False

    def _to_interpreter_event(
        self, event: dict[str, Any]
    ) -> InterpreterEvent | None:
        event_type = event.get("type")
        if event_type == "session.output_audio.delta":
            delta = event.get("delta")
            if isinstance(delta, str):
                try:
                    pcm = base64.b64decode(delta, validate=True)
                except ValueError as exc:
                    return InterpreterEvent(kind="error", text=str(exc))
                sample_rate = event.get("sample_rate", self.required_sample_rate)
                return InterpreterEvent(
                    kind="audio",
                    pcm=pcm,
                    sample_rate=(
                        sample_rate
                        if isinstance(sample_rate, int)
                        else self.required_sample_rate
                    ),
                )
        elif event_type == "session.output_transcript.delta":
            text = event.get("delta")
            if isinstance(text, str) and text:
                return InterpreterEvent(kind="output_text", text=text)
        elif event_type == "session.input_transcript.delta":
            text = event.get("delta")
            if isinstance(text, str) and text:
                return InterpreterEvent(kind="input_text", text=text)
        elif event_type == "error":
            return InterpreterEvent(kind="error", text=self._error_message(event))
        return None

    async def events(self) -> AsyncIterator[InterpreterEvent]:
        if self._event_queue is None:
            raise RuntimeError("OpenAI Realtime session is not started")
        queue = self._event_queue
        while True:
            event = await queue.get()
            if event is None:
                return
            yield event

    async def close(self) -> None:
        websocket = self._websocket
        if websocket is None:
            return
        self._closing = True
        try:
            if self._connected.is_set() and not self._failed:
                try:
                    await websocket.send(json.dumps({"type": "session.close"}))
                except _CONNECTION_ERRORS:
                    pass
                else:
                    await asyncio.wait_for(
                        self._session_closed.wait(),
                        timeout=self._CLOSE_TIMEOUT_SECONDS,
                    )
        finally:
            reader_task = self._reader_task
            self._reader_task = None
            current = self._websocket or websocket
            self._websocket = None
            self._event_queue = None
            self._connected.set()
            if reader_task is not None and not reader_task.done():
                reader_task.cancel()
                await asyncio.gather(reader_task, return_exceptions=True)
            await current.close()


def _is_authentication_rejection(error: Exception) -> bool:
    response = getattr(error, "response", None)
    status_code = getattr(response, "status_code", None)
    if status_code is None:
        status_code = getattr(error, "status_code", None)
    return status_code == 401
