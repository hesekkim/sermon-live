from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator, Awaitable, Callable

from core.config import Settings
from services.audio_capture import AudioCapture
from services.audio_processor import AudioProcessor
from services.broadcast import BroadcastHub
from services.interpreters.protocol import LiveInterpreter
from services.operator_store import OperatorSettingsStore, store as default_store

logger = logging.getLogger(__name__)


class _DurationTrackedQueue(asyncio.Queue[bytes | None]):
    def __init__(self, sample_rate: int, frame_size: int) -> None:
        super().__init__()
        self._bytes_per_second = sample_rate * frame_size
        self._queued_bytes = 0

    @property
    def duration_seconds(self) -> float:
        return self._queued_bytes / self._bytes_per_second

    def put_nowait(self, item: bytes | None) -> None:
        super().put_nowait(item)
        if item is not None:
            self._queued_bytes += len(item)

    def get_nowait(self) -> bytes | None:
        item = super().get_nowait()
        if item is not None:
            self._queued_bytes -= len(item)
        return item


class AudioRuntime:
    _AUDIO_LEVEL_BROADCAST_INTERVAL = 0.1
    _TRANSLATION_CHUNK_MILLISECONDS = 100
    _OVERFLOW_WARNING_INTERVAL = 10.0

    def __init__(
        self,
        settings: Settings,
        hub: BroadcastHub,
        operator_store: OperatorSettingsStore | None = None,
    ) -> None:
        self._settings = settings
        self._hub = hub
        self._store = operator_store or default_store
        self._capture: AudioCapture | None = None
        self._processor: AudioProcessor | None = None
        self._capture_task: asyncio.Task[None] | None = None
        self._audio_level_queue: asyncio.Queue[float] | None = None
        self._audio_level_task: asyncio.Task[None] | None = None
        self._overflow_warning_queue: asyncio.Queue[tuple[int, float]] | None = None
        self._overflow_warning_task: asyncio.Task[None] | None = None
        self._translation_queue: _DurationTrackedQueue | None = None
        self._test_queues: set[asyncio.Queue[bytes | None]] = set()
        self._input_format: tuple[int, int, int] | None = None
        self._device_setting = ""
        self._error: str | None = None
        self._last_audio_level_broadcast: float | None = None
        self._clock = time.monotonic
        self._dropped_chunks = 0
        self._dropped_duration_seconds = 0.0
        self._capture_dropped_chunks_seen = 0
        self._capture_dropped_duration_seen = 0.0
        self._last_overflow_warning: float | None = None
        self._target_sample_rate: int | None = None
        self._target_frame_size: int | None = None
        self._queue_max_seconds = settings.translation_queue_max_seconds
        self.on_device_error: Callable[[str], Awaitable[None]] | None = None

    @property
    def ready(self) -> bool:
        return (
            self._capture is not None
            and self._input_format is not None
            and self._error is None
            and self.running
        )

    @property
    def error(self) -> str | None:
        return self._error

    @property
    def input_format(self) -> tuple[int, int, int] | None:
        return self._input_format

    @property
    def device_setting(self) -> str:
        return self._device_setting

    @property
    def dropped_chunks(self) -> int:
        return self._dropped_chunks

    @property
    def dropped_duration_seconds(self) -> float:
        return self._dropped_duration_seconds

    @property
    def queued_duration_seconds(self) -> float:
        queue = self._translation_queue
        return queue.duration_seconds if queue is not None else 0.0

    @property
    def running(self) -> bool:
        return self._capture_task is not None and not self._capture_task.done()

    async def start(self, audio_device: str | None = None) -> None:
        if self.ready:
            return
        runtime = self._store.overlay_settings(self._settings)
        if audio_device is not None:
            runtime = runtime.model_copy(update={"audio_device": audio_device})
        capture = AudioCapture(runtime)
        try:
            await capture.start()
            input_format = capture.input_format
            if input_format is None:
                raise RuntimeError("Audio capture format is unavailable")
            self._capture = capture
            self._input_format = input_format
            self._device_setting = runtime.audio_device
            self._processor = self._new_processor(input_format, input_format)
            self._error = None
            self._last_audio_level_broadcast = None
            self._audio_level_queue = asyncio.Queue(maxsize=1)
            self._audio_level_task = asyncio.create_task(
                self._pump_audio_levels(self._audio_level_queue),
                name="pump-audio-levels",
            )
            self._overflow_warning_queue = asyncio.Queue(maxsize=1)
            self._overflow_warning_task = asyncio.create_task(
                self._pump_overflow_warnings(self._overflow_warning_queue),
                name="pump-audio-overflow-warnings",
            )
            self._capture_task = asyncio.create_task(
                self._pump_capture(), name="pump-audio-runtime"
            )
            await self._broadcast_audio_status()
        except Exception as exc:
            await capture.stop()
            self._capture = None
            self._input_format = None
            self._processor = None
            self._error = str(exc) or "Audio input is not available"
            logger.exception("Audio capture could not start")
            await self._broadcast_audio_status()

    async def restart(self) -> None:
        await self.stop()
        await self.start()

    @asynccontextmanager
    async def using_device(self, audio_device: str | None) -> AsyncIterator[None]:
        previous_device = self._device_setting
        if audio_device is None or audio_device == previous_device:
            yield
            return
        await self.stop()
        await self.start(audio_device)
        if not self.ready:
            error = self._error or "Audio input device is not available"
            await self.stop()
            await self.start(previous_device)
            raise RuntimeError(error)
        try:
            yield
        finally:
            await self.stop()
            await self.start(previous_device)

    async def collect(self, duration_seconds: float) -> bytes:
        chunks = [chunk async for chunk in self.chunks_for(duration_seconds)]
        return b"".join(chunks)

    async def chunks_for(self, duration_seconds: float) -> AsyncIterator[bytes]:
        if not self.ready:
            raise RuntimeError(self._error or "Audio input device is not available")
        queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=256)
        self._test_queues.add(queue)
        loop = asyncio.get_running_loop()
        deadline = loop.time() + max(duration_seconds, 0.0)
        try:
            while True:
                remaining = deadline - loop.time()
                if remaining <= 0:
                    return
                try:
                    chunk = await asyncio.wait_for(queue.get(), timeout=remaining)
                except asyncio.TimeoutError:
                    return
                if chunk is None:
                    return
                yield chunk
        finally:
            self._test_queues.discard(queue)

    async def stop(self) -> None:
        task = self._capture_task
        self._capture_task = None
        if task is not None:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        await self._stop_audio_level_pump()
        await self._stop_overflow_warning_pump()
        capture = self._capture
        self._capture = None
        self._input_format = None
        self._processor = None
        if capture is not None:
            await capture.stop()
        for test_queue in tuple(self._test_queues):
            if test_queue.full():
                try:
                    test_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            test_queue.put_nowait(None)
        queue = self._translation_queue
        self._translation_queue = None
        if queue is not None:
            await queue.put(None)
        await self._broadcast_audio_status()

    def attach_translation(
        self, interpreter: LiveInterpreter
    ) -> asyncio.Queue[bytes | None]:
        if not self.ready or self._input_format is None:
            raise RuntimeError(self._error or "Audio input device is not available")
        if self._translation_queue is not None:
            raise RuntimeError("Translation audio is already attached")
        target_format = (
            interpreter.required_sample_rate,
            interpreter.required_channels,
            interpreter.required_sample_width,
        )
        self._processor = self._new_processor(self._input_format, target_format)
        self._target_sample_rate = target_format[0]
        self._target_frame_size = target_format[1] * target_format[2]
        self._dropped_chunks = 0
        self._dropped_duration_seconds = 0.0
        self._capture_dropped_chunks_seen = int(
            getattr(self._capture, "dropped_chunks", 0)
        )
        self._capture_dropped_duration_seen = float(
            getattr(self._capture, "dropped_duration_seconds", 0.0)
        )
        self._last_overflow_warning = None
        self._translation_queue = _DurationTrackedQueue(
            self._target_sample_rate, self._target_frame_size
        )
        return self._translation_queue

    async def finish_translation(
        self, *, discard_pending: bool = False
    ) -> asyncio.Queue[bytes | None] | None:
        queue = self._translation_queue
        if queue is None:
            return None
        await self._record_capture_drops()
        self._translation_queue = None
        processor = self._processor
        if discard_pending:
            while True:
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
        elif processor is not None:
            final_chunk = processor.flush()
            if final_chunk:
                await self._enqueue_translation_audio(queue, final_chunk)
        if self._input_format is not None:
            self._processor = self._new_processor(
                self._input_format, self._input_format
            )
        if discard_pending:
            queue.put_nowait(None)
        else:
            queue.put_nowait(None)
        return queue

    async def discard_translation_pending(
        self, queue: asyncio.Queue[bytes | None]
    ) -> None:
        dropped: list[bytes] = []
        while True:
            try:
                chunk = queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            if chunk is not None:
                dropped.append(chunk)
        if dropped:
            await self._record_dropped_chunks(dropped)

    async def record_translation_drop(self, chunk: bytes) -> None:
        await self._record_dropped_chunks([chunk])

    async def _pump_capture(self) -> None:
        assert self._capture is not None
        assert self._processor is not None
        try:
            async for chunk in self._capture.chunks():
                await self._record_capture_drops()
                self._broadcast_test_chunk(chunk)
                processed = self._processor.process(chunk)
                self._queue_audio_level()
                queue = self._translation_queue
                if processed and queue is not None:
                    await self._enqueue_translation_audio(queue, processed)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._error = str(exc) or "Audio input failed"
            logger.exception("Audio capture failed")
            callback = self.on_device_error
            if callback is not None:
                await callback(self._error)
            await self._broadcast_audio_status()
        finally:
            self._last_audio_level_broadcast = None
            await self._stop_audio_level_pump()
            await self._stop_overflow_warning_pump()

    def _queue_audio_level(self) -> None:
        processor = self._processor
        queue = self._audio_level_queue
        if processor is None or queue is None:
            return
        level = processor.input_level_dbfs
        now = self._clock()
        if (
            level is not None
            and (
                self._last_audio_level_broadcast is None
                or now - self._last_audio_level_broadcast
                >= self._AUDIO_LEVEL_BROADCAST_INTERVAL
            )
        ):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(level)
            self._last_audio_level_broadcast = now

    async def _pump_audio_levels(self, queue: asyncio.Queue[float]) -> None:
        while True:
            level = await queue.get()
            try:
                await self._hub.broadcast_operator(
                    {"type": "audio_level", "level": level}
                )
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Audio level broadcast failed")

    async def _pump_overflow_warnings(
        self, queue: asyncio.Queue[tuple[int, float]]
    ) -> None:
        while True:
            dropped_chunks, dropped_duration_seconds = await queue.get()
            try:
                await self._hub.broadcast_session(
                    {
                        "type": "audio_queue_overflow",
                        "audio_dropped_chunks": dropped_chunks,
                        "audio_dropped_duration_seconds": dropped_duration_seconds,
                    }
                )
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Audio queue overflow broadcast failed")

    async def _stop_audio_level_pump(self) -> None:
        task = self._audio_level_task
        self._audio_level_task = None
        self._audio_level_queue = None
        if task is None or task is asyncio.current_task():
            return
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    async def _stop_overflow_warning_pump(self) -> None:
        task = self._overflow_warning_task
        self._overflow_warning_task = None
        self._overflow_warning_queue = None
        if task is None or task is asyncio.current_task():
            return
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    async def _enqueue_translation_audio(
        self, queue: _DurationTrackedQueue, audio: bytes
    ) -> None:
        sample_rate = self._target_sample_rate
        frame_size = self._target_frame_size
        if sample_rate is None or frame_size is None:
            return
        frames_per_chunk = max(
            1,
            min(
                int(sample_rate * self._TRANSLATION_CHUNK_MILLISECONDS / 1000),
                int(sample_rate * self._queue_max_seconds),
            ),
        )
        chunk_size = frames_per_chunk * frame_size
        chunks = [audio[offset : offset + chunk_size] for offset in range(0, len(audio), chunk_size)]
        dropped: list[bytes] = []
        for chunk in chunks:
            if len(chunk) % frame_size:
                continue
            chunk_duration = len(chunk) / (sample_rate * frame_size)
            while (
                queue.duration_seconds + chunk_duration > self._queue_max_seconds
            ):
                try:
                    oldest = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                if oldest is not None:
                    dropped.append(oldest)
            queue.put_nowait(chunk)
        if dropped:
            await self._record_dropped_chunks(dropped)

    async def _record_dropped_chunks(self, chunks: list[bytes]) -> None:
        sample_rate = self._target_sample_rate
        frame_size = self._target_frame_size
        if sample_rate is None or frame_size is None:
            return
        duration_seconds = sum(
            len(chunk) / (sample_rate * frame_size) for chunk in chunks
        )
        await self._record_dropped_audio(len(chunks), duration_seconds)

    async def _record_capture_drops(self) -> None:
        capture = self._capture
        if capture is None or self._translation_queue is None:
            return
        dropped_chunks = int(getattr(capture, "dropped_chunks", 0))
        dropped_duration = float(getattr(capture, "dropped_duration_seconds", 0.0))
        chunk_delta = dropped_chunks - self._capture_dropped_chunks_seen
        duration_delta = dropped_duration - self._capture_dropped_duration_seen
        self._capture_dropped_chunks_seen = dropped_chunks
        self._capture_dropped_duration_seen = dropped_duration
        if chunk_delta > 0 or duration_delta > 0:
            await self._record_dropped_audio(chunk_delta, max(0.0, duration_delta))

    async def _record_dropped_audio(
        self, chunks: int, duration_seconds: float
    ) -> None:
        self._dropped_chunks += chunks
        self._dropped_duration_seconds += duration_seconds
        now = self._clock()
        if (
            self._last_overflow_warning is not None
            and now - self._last_overflow_warning < self._OVERFLOW_WARNING_INTERVAL
        ):
            return
        self._last_overflow_warning = now
        queue = self._overflow_warning_queue
        if queue is None:
            return
        if queue.full():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        queue.put_nowait((self._dropped_chunks, self._dropped_duration_seconds))

    def _broadcast_test_chunk(self, chunk: bytes) -> None:
        for queue in tuple(self._test_queues):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(chunk)

    async def _broadcast_audio_status(self) -> None:
        payload = {
            "type": "audio_status",
            "ready": self.ready,
            "error": self._error,
        }
        await self._hub.broadcast_session(payload)

    @staticmethod
    def _new_processor(
        source: tuple[int, int, int], target: tuple[int, int, int]
    ) -> AudioProcessor:
        return AudioProcessor(*source, *target)