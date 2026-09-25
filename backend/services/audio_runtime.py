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


class AudioRuntime:
    _AUDIO_LEVEL_BROADCAST_INTERVAL = 0.1
    _TRANSLATION_QUEUE_SIZE = 32

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
        self._translation_queue: asyncio.Queue[bytes | None] | None = None
        self._test_queues: set[asyncio.Queue[bytes | None]] = set()
        self._input_format: tuple[int, int, int] | None = None
        self._device_setting = ""
        self._error: str | None = None
        self._last_audio_level_broadcast: float | None = None
        self._clock = time.monotonic
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
        self._translation_queue = asyncio.Queue(maxsize=self._TRANSLATION_QUEUE_SIZE)
        return self._translation_queue

    async def finish_translation(
        self, *, discard_pending: bool = False
    ) -> asyncio.Queue[bytes | None] | None:
        queue = self._translation_queue
        if queue is None:
            return None
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
                await queue.put(final_chunk)
        if self._input_format is not None:
            self._processor = self._new_processor(
                self._input_format, self._input_format
            )
        if discard_pending:
            queue.put_nowait(None)
        else:
            await queue.put(None)
        return queue

    async def _pump_capture(self) -> None:
        assert self._capture is not None
        assert self._processor is not None
        try:
            async for chunk in self._capture.chunks():
                self._broadcast_test_chunk(chunk)
                processed = self._processor.process(chunk)
                await self._broadcast_audio_level()
                queue = self._translation_queue
                if processed and queue is not None:
                    if queue.full():
                        try:
                            queue.get_nowait()
                        except asyncio.QueueEmpty:
                            pass
                    queue.put_nowait(processed)
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

    async def _broadcast_audio_level(self) -> None:
        processor = self._processor
        if processor is None:
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
            await self._hub.broadcast_operator(
                {"type": "audio_level", "level": level}
            )
            self._last_audio_level_broadcast = now

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