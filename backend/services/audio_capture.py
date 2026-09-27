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
        self._input_format: tuple[int, int, int] | None = None

    @property
    def native_format(self) -> tuple[int, int, int] | None:
        return self._input_format

    @property
    def native_sample_rate(self) -> int | None:
        return self._input_format[0] if self._input_format is not None else None

    @property
    def native_channels(self) -> int | None:
        return self._input_format[1] if self._input_format is not None else None

    @property
    def native_sample_width(self) -> int | None:
        return self._input_format[2] if self._input_format is not None else None

    @property
    def input_format(self) -> tuple[int, int, int] | None:
        return self.native_format

    def _resolve_device_index(self, audio: pyaudio.PyAudio) -> int | None:
        raw = self._settings.audio_device.strip()
        if not raw or raw.lower() == "default":
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
        device_index = self._resolve_device_index(audio)
        device_info = (
            audio.get_device_info_by_index(device_index)
            if device_index is not None
            else audio.get_default_input_device_info()
        )
        sample_rate = self._settings.input_sample_rate
        if sample_rate is None:
            sample_rate = int(float(device_info["defaultSampleRate"]))
        kwargs: dict[str, object] = {
            "format": pyaudio.paInt16,
            "channels": 1,
            "rate": sample_rate,
            "input": True,
            "frames_per_buffer": self._settings.audio_chunk_frames,
            "stream_callback": self._on_chunk,
        }
        if device_index is not None:
            kwargs["input_device_index"] = device_index
        try:
            self._stream = audio.open(**kwargs)
        except Exception:
            logger.exception("Failed to open audio input at %s Hz", sample_rate)
            raise
        self._input_format = (sample_rate, 1, audio.get_sample_size(pyaudio.paInt16))
        logger.info("Microphone capture started")

    async def collect(self, duration_seconds: float) -> bytes:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + max(duration_seconds, 0.0)
        chunks: list[bytes] = []
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                break
            try:
                item = await asyncio.wait_for(self._queue.get(), timeout=remaining)
            except asyncio.TimeoutError:
                break
            if item is None:
                break
            chunks.append(item)
        return b"".join(chunks)

    async def chunks(self) -> AsyncIterator[bytes]:
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item

    async def chunks_for(self, duration_seconds: float) -> AsyncIterator[bytes]:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + max(duration_seconds, 0.0)
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                break
            try:
                item = await asyncio.wait_for(self._queue.get(), timeout=remaining)
            except asyncio.TimeoutError:
                break
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
        self._input_format = None
        if self._pyaudio is not None:
            try:
                self._pyaudio.terminate()
            except Exception:
                pass
            self._pyaudio = None
        await self._queue.put(None)
        self._loop = None
