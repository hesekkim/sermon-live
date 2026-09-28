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
        raise RuntimeError(f"Audio input device {raw!r} was not found")

    @staticmethod
    def _sample_width_format(sample_width: int) -> int:
        if sample_width == 1:
            return pyaudio.paUInt8
        if sample_width == 2:
            return pyaudio.paInt16
        if sample_width == 3:
            return pyaudio.paInt24
        if sample_width == 4:
            return pyaudio.paInt32
        raise ValueError(f"Unsupported sample width: {sample_width}")

    @staticmethod
    def _candidate_sample_rates(device_info: dict[str, object], configured_rate: int | None) -> list[int]:
        candidates: list[int] = []
        for value in (
            configured_rate,
            int(float(device_info.get("defaultSampleRate") or 0)),
            44100,
            48000,
            22050,
            32000,
            16000,
            8000,
        ):
            if value and value not in candidates:
                candidates.append(value)
        return candidates

    @staticmethod
    def _candidate_channels(device_info: dict[str, object]) -> list[int]:
        maximum = int(device_info.get("maxInputChannels") or 0)
        candidates: list[int] = []
        for value in (1, 2, 4, 6, 8):
            if value > 0 and value <= maximum:
                candidates.append(value)
        return candidates or [1]

    @staticmethod
    def _candidate_sample_widths() -> list[int]:
        return [2, 3, 4, 1]

    def _open_compatible_stream(
        self,
        audio: pyaudio.PyAudio,
        device_index: int | None,
        device_info: dict[str, object],
    ) -> tuple[int, int, int]:
        device_name = str(device_info.get("name") or "default input device")
        configured_rate = self._settings.input_sample_rate
        last_error: Exception | None = None
        for channels in self._candidate_channels(device_info):
            for rate in self._candidate_sample_rates(device_info, configured_rate):
                for sample_width in self._candidate_sample_widths():
                    kwargs: dict[str, object] = {
                        "format": self._sample_width_format(sample_width),
                        "channels": channels,
                        "rate": rate,
                        "input": True,
                        "frames_per_buffer": self._settings.audio_chunk_frames,
                        "stream_callback": self._on_chunk,
                    }
                    if device_index is not None:
                        kwargs["input_device_index"] = device_index
                    try:
                        self._stream = audio.open(**kwargs)
                        sample_size = audio.get_sample_size(kwargs["format"])
                        logger.info(
                            "Opened input stream on %s using %s Hz / %s channels / %s-bit PCM",
                            device_name,
                            rate,
                            channels,
                            sample_width * 8,
                        )
                        return (rate, channels, sample_size)
                    except Exception as exc:  # pragma: no cover - exercised via fake stream failures
                        last_error = exc
                        continue
        if last_error is not None:
            raise RuntimeError(
                f"Unable to open audio input on device {device_name!r}: {last_error}"
            )
        raise RuntimeError(f"Unable to open audio input on device {device_name!r}")

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
        try:
            device_index = self._resolve_device_index(audio)
            try:
                device_info = (
                    audio.get_device_info_by_index(device_index)
                    if device_index is not None
                    else audio.get_default_input_device_info()
                )
            except Exception as exc:
                requested_device = self._settings.audio_device.strip() or "system default"
                raise RuntimeError(
                    f"Unable to access audio input device {requested_device!r}: {exc}"
                ) from exc
            self._input_format = self._open_compatible_stream(audio, device_index, device_info)
        except Exception:
            logger.exception(
                "Failed to start audio input for device %s",
                self._settings.audio_device.strip() or "system default",
            )
            await self.stop()
            raise
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
