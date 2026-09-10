from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import urllib.parse
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

import websockets

from services.interpreters.protocol import InterpreterEvent
from services.text_filter import should_suppress_translation_text

if TYPE_CHECKING:
    from core.config import Settings

logger = logging.getLogger(__name__)

GEMINI_LIVE_ENDPOINT = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)

SYSTEM_INSTRUCTION = (
    "You are a professional real-time simultaneous interpreter for a church sermon. "
    "Translate Korean sermon speech into natural spoken German with the lowest possible latency. "
    "Begin translating as soon as a short phrase or meaningful fragment is clear; "
    "do not wait for the speaker to finish a full sentence or paragraph. "
    "Output ONLY the direct German translation. NEVER output explanations, analysis, "
    "self-reference, English commentary, translation notes, quotation marks, preambles, "
    "or extra chatter. Return the German translation itself, even for short or fragmented input. "
    "If the input is incomplete, translate only the meaningful German phrase directly."
)

_PROXY_VARS = (
    "http_proxy",
    "https_proxy",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "all_proxy",
)


def build_live_uri(api_key: str) -> str:
    if not api_key:
        raise RuntimeError("APP_GEMINI_API_KEY is not set")
    params = urllib.parse.urlencode({"key": api_key})
    uri = f"{GEMINI_LIVE_ENDPOINT}?{params}"
    parsed = urllib.parse.urlparse(uri)
    if parsed.scheme != "wss" or not parsed.hostname:
        raise ValueError(f"Invalid Gemini Live URI: {uri!r}")
    return uri


def _strip_proxy_env() -> None:
    for name in _PROXY_VARS:
        os.environ.pop(name, None)


class GeminiLiveInterpreter:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._ws: Any = None
        self._queue: asyncio.Queue[InterpreterEvent | None] = asyncio.Queue()
        self._recv_task: asyncio.Task[None] | None = None
        self._closed = False

    async def start(self) -> None:
        _strip_proxy_env()
        uri = build_live_uri(self._settings.gemini_api_key)
        connect_kwargs: dict[str, object] = {
            "ping_interval": None,
            "ping_timeout": None,
            "open_timeout": 15,
            "close_timeout": 5,
            "additional_headers": {"User-Agent": "sermon-live/1.0"},
        }
        self._ws = await websockets.connect(uri, **connect_kwargs)
        setup = {
            "setup": {
                "model": f"models/{self._settings.gemini_model}",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "temperature": 0.1,
                    "topP": 0.2,
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voice_name": self._settings.gemini_voice
                            }
                        }
                    },
                },
                "realtimeInputConfig": {
                    "automaticActivityDetection": {
                        "disabled": False,
                        "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
                        "endOfSpeechSensitivity": "END_SENSITIVITY_HIGH",
                        "prefixPaddingMs": 20,
                        "silenceDurationMs": self._settings.turn_silence_ms,
                    }
                },
                "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            }
        }
        await self._ws.send(json.dumps(setup))
        self._recv_task = asyncio.create_task(self._receive_loop())
        logger.info("Gemini Live WebSocket connected")

    async def send_pcm(self, chunk: bytes) -> None:
        if self._ws is None or not chunk:
            return
        payload = {
            "realtimeInput": {
                "mediaChunks": [
                    {
                        "mimeType": "audio/pcm;rate=16000",
                        "data": base64.b64encode(chunk).decode("ascii"),
                    }
                ]
            }
        }
        await self._ws.send(json.dumps(payload))

    async def events(self) -> AsyncIterator[InterpreterEvent]:
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item

    async def close(self) -> None:
        self._closed = True
        if self._recv_task:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except asyncio.CancelledError:
                pass
            self._recv_task = None
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        await self._queue.put(None)

    async def _receive_loop(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                if self._closed:
                    break
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    logger.warning("Received non-JSON Gemini payload")
                    continue
                await self._emit_from_message(message)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Gemini Live receive error: %s", exc)
            await self._queue.put(
                InterpreterEvent(kind="error", text=str(exc))
            )
        finally:
            if not self._closed:
                await self._queue.put(None)

    async def _emit_from_message(self, decoded: object) -> None:
        if not isinstance(decoded, dict):
            return
        server_content = decoded.get("serverContent")
        if not isinstance(server_content, dict):
            return
        model_turn = server_content.get("modelTurn") or {}
        parts = model_turn.get("parts") or []
        output_rate = self._settings.output_sample_rate
        for part in parts:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str):
                cleaned = text.strip()
                if cleaned and not should_suppress_translation_text(cleaned):
                    logger.info("[Gemini text] %s", cleaned)
                    await self._queue.put(
                        InterpreterEvent(kind="text", text=cleaned)
                    )
            inline = part.get("inlineData")
            if not isinstance(inline, dict):
                continue
            mime = str(inline.get("mimeType") or "")
            data = inline.get("data")
            if mime.startswith("audio/pcm") and isinstance(data, str):
                pcm = base64.b64decode(data)
                await self._queue.put(
                    InterpreterEvent(
                        kind="audio",
                        pcm=pcm,
                        sample_rate=output_rate,
                    )
                )
