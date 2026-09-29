from __future__ import annotations

import asyncio
import base64
import json
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any
from urllib.parse import urlencode

from websockets.asyncio.client import connect

from core.config import Settings
from services.interpreters.protocol import InterpreterEvent, KeyValidationError


class OpenAIRealtimeInterpreter:
    """OpenAI Realtime translation adapter using 24 kHz PCM16 mono audio."""

    required_sample_rate = 24000
    required_channels = 1
    required_sample_width = 2
    _BASE_URL = "wss://api.openai.com/v1/realtime/translations"
    _CLOSE_TIMEOUT_SECONDS = 10.0

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
        websocket = await self._connect()
        try:
            event = await self._receive_json(websocket)
            if event.get("type") == "error":
                raise KeyValidationError(self._error_message(event))
            if event.get("type") != "session.created":
                raise KeyValidationError("OpenAI Realtime session handshake failed")
        except KeyValidationError:
            raise
        except Exception as exc:
            raise KeyValidationError("OpenAI Realtime connection failed") from exc
        finally:
            await websocket.close()

    async def start(self) -> None:
        if self._websocket is not None:
            raise RuntimeError("OpenAI Realtime session is already started")
        websocket = await self._connect()
        self._websocket = websocket
        try:
            created = await self._receive_json(websocket)
            if created.get("type") == "error":
                raise RuntimeError(self._error_message(created))
            if created.get("type") != "session.created":
                raise RuntimeError("OpenAI Realtime session handshake failed")

            await self._send_json(
                {
                    "type": "session.update",
                    "session": {
                        "audio": {
                            "input": {
                                "transcription": {
                                    "model": self._settings.translation_source_transcription_model
                                }
                            },
                            "output": {
                                "language": self._settings.translation_target_language
                            },
                        }
                    },
                }
            )
            updated = await self._receive_json(websocket)
            if updated.get("type") == "error":
                raise RuntimeError(self._error_message(updated))
            if updated.get("type") != "session.updated":
                raise RuntimeError("OpenAI Realtime session configuration failed")

            self._event_queue = asyncio.Queue()
            self._session_closed.clear()
            self._reader_task = asyncio.create_task(
                self._read_events(websocket), name="openai-realtime-events"
            )
        except Exception:
            self._websocket = None
            await websocket.close()
            raise

    async def send_pcm(self, chunk: bytes) -> None:
        if self._websocket is None or self._reader_task is None:
            raise RuntimeError("OpenAI Realtime session is not started")
        await self._send_json(
            {
                "type": "session.input_audio_buffer.append",
                "audio": base64.b64encode(chunk).decode("ascii"),
            }
        )

    async def _send_json(self, event: dict[str, Any]) -> None:
        if self._websocket is None:
            raise RuntimeError("OpenAI Realtime session is not started")
        await self._websocket.send(json.dumps(event))

    async def _read_events(self, websocket: Any) -> None:
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    message = message.decode("utf-8")
                event = json.loads(message)
                if not isinstance(event, dict):
                    continue
                translated = self._to_interpreter_event(event)
                if translated is not None and self._event_queue is not None:
                    await self._event_queue.put(translated)
                if event.get("type") == "session.closed":
                    break
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if self._event_queue is not None:
                await self._event_queue.put(
                    InterpreterEvent(kind="error", text=str(exc))
                )
        finally:
            self._session_closed.set()
            if self._event_queue is not None:
                await self._event_queue.put(None)

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

    async def events(self):
        if self._event_queue is None:
            raise RuntimeError("OpenAI Realtime session is not started")
        while True:
            event = await self._event_queue.get()
            if event is None:
                return
            yield event

    async def close(self) -> None:
        websocket = self._websocket
        if websocket is None:
            return
        try:
            await websocket.send(json.dumps({"type": "session.close"}))
            await asyncio.wait_for(
                self._session_closed.wait(), timeout=self._CLOSE_TIMEOUT_SECONDS
            )
        finally:
            reader_task = self._reader_task
            self._reader_task = None
            self._websocket = None
            self._event_queue = None
            if reader_task is not None and not reader_task.done():
                reader_task.cancel()
                await asyncio.gather(reader_task, return_exceptions=True)
            await websocket.close()
