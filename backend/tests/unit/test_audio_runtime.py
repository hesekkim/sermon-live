import asyncio

import pytest

from core.config import Settings
from services import audio_runtime as audio_runtime_module
from services.audio_runtime import AudioRuntime


class FakeHub:
    def __init__(self):
        self.session_events = []
        self.operator_events = []

    async def broadcast_session(self, payload):
        self.session_events.append(payload)

    async def broadcast_operator(self, payload):
        self.operator_events.append(payload)


class FakeCapture:
    def __init__(self, _settings):
        self.input_format = (16000, 1, 2)
        self.chunks_queue = asyncio.Queue()

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
async def test_failed_translation_can_discard_full_queue_without_blocking(monkeypatch):
    runtime, _capture, _hub = make_runtime(monkeypatch)
    await runtime.start()
    queue = runtime.attach_translation(FakeInterpreter())
    for _ in range(runtime._TRANSLATION_QUEUE_SIZE):
        queue.put_nowait(b"audio")

    finished_queue = await asyncio.wait_for(
        runtime.finish_translation(discard_pending=True), timeout=1
    )

    assert finished_queue is queue
    assert queue.qsize() == 1
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
