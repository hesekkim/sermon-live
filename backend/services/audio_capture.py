from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator

import pyaudio

from core.config import Settings
from services.audio_devices import enumerate_input_devices

logger = logging.getLogger(__name__)


class AudioCapture:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pyaudio: pyaudio.PyAudio | None = None
        self._stream: pyaudio.Stream | None = None
        self._queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._loop: asyncio.AbstractEventLoop | None = None

    def _resolve_device_index(self, audio: pyaudio.PyAudio) -> int | None:
        raw = self._settings.audio_device.strip()
        if not raw:
            return None
        if raw.isdigit():
            return int(raw)
        lowered = raw.lower()
        for device in enumerate_input_devices(audio):
            name = str(device["name"])
            if lowered in name.lower():
                logger.info("Using input device %s (%s)", device["index"], name)
                return int(device["index"])
        logger.warning("Audio device %r not found, using default", raw)
        return None

    def _on_chunk(
        self,
        in_data: bytes | None,
        _frame_count: int,
        _time_info: object,
        _status: int,
    ) -> tuple[None, int]:
        if in_data and self._loop is not None:
            self._loop.call_soon_threadsafe(self._queue.put_nowait, in_data)
        return (None, pyaudio.paContinue)

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        audio = pyaudio.PyAudio()
        self._pyaudio = audio
        kwargs: dict[str, object] = {
            "format": pyaudio.paInt16,
            "channels": 1,
            "rate": self._settings.input_sample_rate,
            "input": True,
            "frames_per_buffer": self._settings.audio_chunk_frames,
            "stream_callback": self._on_chunk,
        }
        device_index = self._resolve_device_index(audio)
        if device_index is not None:
            kwargs["input_device_index"] = device_index
        self._stream = audio.open(**kwargs)
        logger.info("Microphone capture started")

    async def chunks(self) -> AsyncIterator[bytes]:
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item

    async def stop(self) -> None:
        if self._stream is not None:
            try:
                if self._stream.is_active():
                    self._stream.stop_stream()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
        if self._pyaudio is not None:
            try:
                self._pyaudio.terminate()
            except Exception:
                pass
            self._pyaudio = None
        await self._queue.put(None)
        self._loop = None
