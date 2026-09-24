from __future__ import annotations

import asyncio
import base64
import json
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import websockets

from core.config import Settings
from services.interpreters.protocol import (
    InterpreterEvent,
    KeyValidationError,
)

WebSocket = Any
WebSocketFactory = Callable[..., Awaitable[WebSocket]]
TRANSLATION_URL = "wss://api.openai.com/v1/realtime/translations"


class OpenAIRealtimeInterpreter:
    """OpenAI Realtime Translation adapter behind the LiveInterpreter protocol."""

    required_sample_rate = 24000
    required_channels = 1
    required_sample_width = 2

    def __init__(
        self,
        settings: Settings | None = None,
        websocket_factory: WebSocketFactory | None = None,
    ) -> None:
        self._settings = settings
        self._websocket_factory = websocket_factory or websockets.connect
        self._websocket: WebSocket | None = None
        self._started = False
        self._closing = False
        self._events_active = False
        self._closed = asyncio.Event()
        if settings is not None:
            self.required_sample_rate = settings.translation_target_sample_rate
            self.required_channels = settings.translation_target_channels
            self.required_sample_width = settings.translation_target_sample_width

    @property
    def _api_key(self) -> str:
        return self._settings.openai_api_key if self._settings else ""

    @property
    def _model(self) -> str:
        return self._settings.openai_model if self._settings else "gpt-realtime-translate"

    def _connection_kwargs(self) -> dict[str, Any]:
        return {
            "additional_headers": {"Authorization": f"Bearer {self._api_key}"},
        }

    async def _connect(self) -> WebSocket:
        if not self._api_key:
            raise KeyValidationError("OpenAI API key is not set")
        return await self._websocket_factory(
            f"{TRANSLATION_URL}?model={self._model}",
            **self._connection_kwargs(),
        )

    @staticmethod
    def _decode_event(raw_event: str | bytes) -> dict[str, Any]:
        value = raw_event.decode() if isinstance(raw_event, bytes) else raw_event
        event = json.loads(value)
        if not isinstance(event, dict):
            raise ValueError("OpenAI event must be an object")
        return event

    async def _expect_session_created(self, websocket: WebSocket) -> None:
        event = self._decode_event(await websocket.recv())
        if event.get("type") == "error":
            raise KeyValidationError(_error_message(event))
        if event.get("type") != "session.created":
            raise RuntimeError("OpenAI translation session was not created")

    async def _configure(self, websocket: WebSocket) -> None:
        await websocket.send(
            json.dumps(
                {
                    "type": "session.update",
                    "session": {
                        "audio": {
                            "input": {
                                "transcription": {
                                    "model": self._settings.translation_source_transcription_model,
                                }
                            },
                            "output": {"language": self._settings.translation_target_language},
                        }
                    },
                }
            )
        )
        event = self._decode_event(await websocket.recv())
        if event.get("type") == "error":
            raise RuntimeError(_error_message(event))
        if event.get("type") != "session.updated":
            raise RuntimeError("OpenAI translation session configuration failed")

    async def validate_key(self) -> None:
        websocket = None
        try:
            websocket = await self._connect()
            await self._expect_session_created(websocket)
        except KeyValidationError:
            raise
        except Exception as exc:
            raise KeyValidationError("OpenAI API key validation failed") from exc
        finally:
            if websocket is not None:
                await websocket.close()

    async def start(self) -> None:
        if self._started:
            return
        websocket = await self._connect()
        try:
            await self._expect_session_created(websocket)
            await self._configure(websocket)
        except Exception:
            await websocket.close()
            raise
        self._websocket = websocket
        self._started = True
        self._closing = False
        self._closed.clear()

    async def send_pcm(self, chunk: bytes) -> None:
        if not chunk or not self._started or self._closing or self._websocket is None:
            return
        await self._websocket.send(
            json.dumps(
                {
                    "type": "session.input_audio_buffer.append",
                    "audio": base64.b64encode(chunk).decode("ascii"),
                }
            )
        )

    async def events(self) -> AsyncIterator[InterpreterEvent]:
        if self._websocket is None:
            return
        self._events_active = True
        try:
            async for raw_event in self._websocket:
                event = self._decode_event(raw_event)
                event_type = event.get("type")
                if event_type == "session.output_audio.delta" and event.get("delta"):
                    yield InterpreterEvent(
                        kind="audio",
                        pcm=base64.b64decode(event["delta"]),
                        sample_rate=event.get("sample_rate") or self.required_sample_rate,
                    )
                elif event_type == "session.output_transcript.delta" and event.get("delta"):
                    yield InterpreterEvent(kind="output_text", text=event["delta"])
                elif event_type == "session.input_transcript.delta" and event.get("delta"):
                    yield InterpreterEvent(kind="input_text", text=event["delta"])
                elif event_type == "error":
                    yield InterpreterEvent(kind="error", text=_error_message(event))
                elif event_type == "session.closed":
                    self._closed.set()
                    break
        finally:
            self._events_active = False
            self._closed.set()

    async def close(self) -> None:
        websocket = self._websocket
        if websocket is None:
            return
        if self._closing:
            await self._closed.wait()
        else:
            self._closing = True
            try:
                try:
                    await websocket.send(json.dumps({"type": "session.close"}))
                except Exception:
                    pass
                await asyncio.sleep(0)
                if self._events_active:
                    try:
                        await asyncio.wait_for(self._closed.wait(), timeout=10)
                    except asyncio.TimeoutError:
                        pass
            finally:
                try:
                    await websocket.close()
                finally:
                    self._closed.set()
        self._websocket = None
        self._started = False


def _error_message(event: dict[str, Any]) -> str:
    error = event.get("error")
    if isinstance(error, dict) and error.get("message"):
        return str(error["message"])
    return "OpenAI translation session returned an error"
