import asyncio

import pytest

from core.config import Settings
from services import audio_runtime as audio_runtime_module
from services.audio_runtime import AudioRuntime


class FakeHub:
    def __init__(self):
        self.session_events = []
        self.operator_events = []
        self.overflow_events = asyncio.Queue()

    async def broadcast_session(self, payload):
        self.session_events.append(payload)
        if payload.get("type") == "audio_queue_overflow":
            await self.overflow_events.put(payload)

    async def broadcast_operator(self, payload):
        self.operator_events.append(payload)


class FakeCapture:
    def __init__(self, _settings):
        self.input_format = (16000, 1, 2)
        self.chunks_queue = asyncio.Queue()
        self.dropped_chunks = 0
        self.dropped_duration_seconds = 0.0

    async def start(self):
        return None

    async def stop(self):
        await self.chunks_queue.put(None)

    async def chunks(self):
        while True:
            chunk = await self.chunks_queue.get()
            if chunk is None:
                return
            yield chunk


class FakeInterpreter:
    required_sample_rate = 16000
    required_channels = 1
    required_sample_width = 2


def make_runtime(monkeypatch):
    capture = FakeCapture(Settings())
    monkeypatch.setattr(audio_runtime_module, "AudioCapture", lambda _settings: capture)
    hub = FakeHub()
    runtime = AudioRuntime(Settings(), hub)
    return runtime, capture, hub


@pytest.mark.asyncio
async def test_capture_and_processor_remain_ready_when_translation_detaches(monkeypatch):
    runtime, capture, _hub = make_runtime(monkeypatch)
    await runtime.start()
    queue = runtime.attach_translation(FakeInterpreter())
    await capture.chunks_queue.put(b"\x01\x00\x02\x00")

    assert await asyncio.wait_for(queue.get(), timeout=1) == b"\x01\x00\x02\x00"
    finished_queue = await runtime.finish_translation()

    assert finished_queue is queue
    assert await queue.get() is None
    assert runtime.ready is True
    assert runtime.running is True
    await runtime.stop()
    assert runtime.ready is False


@pytest.mark.asyncio
async def test_restart_raises_when_audio_capture_fails(monkeypatch):
    runtime, _capture, _hub = make_runtime(monkeypatch)

    async def fail_start():
        runtime._error = "No input device"

    monkeypatch.setattr(runtime, "start", fail_start)

    with pytest.raises(RuntimeError, match="No input device"):
        await runtime.restart()


@pytest.mark.asyncio
async def test_slow_audio_level_broadcast_does_not_block_capture_or_translation(monkeypatch):
    class SlowLevelHub(FakeHub):
        def __init__(self):
            super().__init__()
            self.level_started = asyncio.Event()
            self.release_level = asyncio.Event()

        async def broadcast_operator(self, payload):
            if payload.get("type") == "audio_level":
                self.level_started.set()
                await self.release_level.wait()
            self.operator_events.append(payload)

    capture = FakeCapture(Settings())
    monkeypatch.setattr(audio_runtime_module, "AudioCapture", lambda _settings: capture)
    hub = SlowLevelHub()
    runtime = AudioRuntime(Settings(), hub)
    clock = {"value": 0.0}

    def advance_clock():
        clock["value"] += 0.2
        return clock["value"]

    runtime._clock = advance_clock
    await runtime.start()
    queue = runtime.attach_translation(FakeInterpreter())
    chunks = [bytes([value, 0]) * 1600 for value in (16, 32, 48)]

    try:
        await capture.chunks_queue.put(chunks[0])
        await asyncio.wait_for(hub.level_started.wait(), timeout=1)
        assert await asyncio.wait_for(queue.get(), timeout=0.2) == chunks[0]

        for chunk in chunks[1:]:
            await capture.chunks_queue.put(chunk)
            assert await asyncio.wait_for(queue.get(), timeout=0.2) == chunk

        level_queue = runtime._audio_level_queue
        assert level_queue is not None
        assert level_queue.maxsize == 1
        assert level_queue.qsize() == 1
        latest_level = runtime._processor.input_level_dbfs
    finally:
        hub.release_level.set()
        await runtime.stop()

    level_events = [
        event for event in hub.operator_events if event.get("type") == "audio_level"
    ]
    assert len(level_events) == 2
    assert level_events[-1]["level"] == latest_level


@pytest.mark.asyncio
async def test_slow_overflow_broadcast_does_not_block_capture_or_translation(monkeypatch):
    class SlowOverflowHub(FakeHub):
        def __init__(self):
            super().__init__()
            self.warning_started = asyncio.Event()
            self.release_warning = asyncio.Event()

        async def broadcast_session(self, payload):
            if payload.get("type") == "audio_queue_overflow":
                self.warning_started.set()
                await self.release_warning.wait()
            self.session_events.append(payload)

    settings = Settings(translation_queue_max_seconds=0.2)
    capture = FakeCapture(settings)
    monkeypatch.setattr(audio_runtime_module, "AudioCapture", lambda _settings: capture)
    hub = SlowOverflowHub()
    runtime = AudioRuntime(settings, hub)
    await runtime.start()
    queue = runtime.attach_translation(FakeInterpreter())
    chunks = [bytes([value, 0]) * 1600 for value in (16, 32, 48, 64)]

    try:
        await capture.chunks_queue.put(b"".join(chunks[:3]))
        await asyncio.wait_for(hub.warning_started.wait(), timeout=1)
        await capture.chunks_queue.put(chunks[3])

        for _ in range(20):
            if runtime.dropped_chunks == 2:
                break
            await asyncio.sleep(0)

        assert runtime.dropped_chunks == 2
        assert runtime.queued_duration_seconds == pytest.approx(0.2)
        assert queue.qsize() == 2
        overflow_queue = runtime._overflow_warning_queue
        assert overflow_queue is not None
        assert overflow_queue.maxsize == 1
    finally:
        hub.release_warning.set()
        await runtime.stop()


@pytest.mark.asyncio
async def test_translation_processor_uses_interpreter_required_sample_rate(monkeypatch):
    runtime, capture, _hub = make_runtime(monkeypatch)

    class HigherRateInterpreter(FakeInterpreter):
        required_sample_rate = 24000

    await runtime.start()
    queue = runtime.attach_translation(HigherRateInterpreter())
    await capture.chunks_queue.put(b"\x00\x00\xe8\x03\xd0\x07\xb8\x0b")

    first_chunk = await asyncio.wait_for(queue.get(), timeout=1)
    final_queue = await runtime.finish_translation()
    final_chunk = await queue.get()

    assert final_queue is queue
    assert len(first_chunk + final_chunk) == 12
    assert await queue.get() is None
    await runtime.stop()


@pytest.mark.asyncio
async def test_failed_translation_can_discard_full_queue_without_blocking(monkeypatch):
    runtime, _capture, _hub = make_runtime(monkeypatch)
    await runtime.start()
    queue = runtime.attach_translation(FakeInterpreter())
    queue.put_nowait(b"audio")

    finished_queue = await asyncio.wait_for(
        runtime.finish_translation(discard_pending=True), timeout=1
    )

    assert finished_queue is queue
    assert queue.qsize() == 1
    assert queue.get_nowait() is None
    assert runtime.dropped_chunks == 0
    assert runtime.dropped_duration_seconds == 0
    await runtime.stop()


@pytest.mark.asyncio
async def test_translation_queue_caps_audio_duration_and_keeps_latest_chunks(monkeypatch):
    settings = Settings(translation_queue_max_seconds=0.2)
    capture = FakeCapture(settings)
    monkeypatch.setattr(audio_runtime_module, "AudioCapture", lambda _settings: capture)
    hub = FakeHub()
    runtime = AudioRuntime(settings, hub)
    clock = {"value": 0.0}
    runtime._clock = lambda: clock["value"]
    await runtime.start()
    queue = runtime.attach_translation(FakeInterpreter())
    first = b"\x01\x00" * 1600
    second = b"\x02\x00" * 1600
    third = b"\x03\x00" * 1600

    await capture.chunks_queue.put(first + second + third)
    for _ in range(20):
        if runtime.queued_duration_seconds >= 0.19:
            break
        await asyncio.sleep(0)

    retained = [queue.get_nowait(), queue.get_nowait()]
    assert runtime.queued_duration_seconds == 0
    assert retained == [second, third]
    assert runtime.dropped_chunks == 1
    assert runtime.dropped_duration_seconds == pytest.approx(0.1)
    await asyncio.wait_for(hub.overflow_events.get(), timeout=1)
    assert [event["type"] for event in hub.session_events].count("audio_queue_overflow") == 1

    await capture.chunks_queue.put(first + second + third)
    for _ in range(20):
        if runtime.dropped_chunks >= 2:
            break
        await asyncio.sleep(0)
    assert [event["type"] for event in hub.session_events].count("audio_queue_overflow") == 1

    while not queue.empty():
        queue.get_nowait()
    clock["value"] = runtime._OVERFLOW_WARNING_INTERVAL
    await capture.chunks_queue.put(first + second + third)
    await asyncio.wait_for(hub.overflow_events.get(), timeout=1)
    for _ in range(20):
        if runtime.dropped_chunks >= 3:
            break
        await asyncio.sleep(0)
    assert [event["type"] for event in hub.session_events].count("audio_queue_overflow") == 2
    await runtime.stop()


@pytest.mark.asyncio
async def test_capture_queue_drops_are_included_in_session_overflow(monkeypatch):
    runtime, capture, hub = make_runtime(monkeypatch)
    await runtime.start()
    queue = runtime.attach_translation(FakeInterpreter())
    capture.dropped_chunks = 2
    capture.dropped_duration_seconds = 0.128
    await capture.chunks_queue.put(b"\x01\x00")

    await asyncio.wait_for(hub.overflow_events.get(), timeout=1)

    assert runtime.dropped_chunks == 2
    assert runtime.dropped_duration_seconds == pytest.approx(0.128)
    assert queue.get_nowait() == b"\x01\x00"
    capture.dropped_chunks += 1
    capture.dropped_duration_seconds += 0.064

    finished_queue = await runtime.finish_translation()

    assert finished_queue is queue
    assert runtime.dropped_chunks == 3
    assert runtime.dropped_duration_seconds == pytest.approx(0.192)
    assert queue.get_nowait() is None
    await runtime.stop()


@pytest.mark.asyncio
async def test_audio_test_collects_from_server_owned_capture(monkeypatch):
    runtime, capture, _hub = make_runtime(monkeypatch)
    await runtime.start()
    collecting = asyncio.create_task(runtime.collect(0.5))
    await asyncio.sleep(0)
    await capture.chunks_queue.put(b"\x10\x00\x20\x00")

    assert await collecting == b"\x10\x00\x20\x00"
    await runtime.stop()


@pytest.mark.asyncio
async def test_capture_failure_marks_audio_unavailable_and_notifies_session(monkeypatch):
    runtime, _capture, hub = make_runtime(monkeypatch)
    failed = asyncio.Event()
    runtime.on_device_error = lambda _message: _set_event(failed)
    await runtime.start()

    async def raise_device_error():
        raise RuntimeError("device disconnected")
        yield b""

    runtime._capture.chunks = raise_device_error
    runtime._capture_task.cancel()
    await asyncio.gather(runtime._capture_task, return_exceptions=True)
    runtime._capture_task = asyncio.create_task(runtime._pump_capture())
    await asyncio.wait_for(failed.wait(), timeout=1)

    assert runtime.ready is False
    assert runtime.error == "device disconnected"
    assert hub.session_events[-1]["ready"] is False
    await runtime.stop()


async def _set_event(event):
    event.set()
