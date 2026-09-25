import asyncio

import numpy as np
import pytest

from core.config import Settings
from services.interpreters.protocol import InterpreterEvent
from services import session_service as session_service_module
from services.session_service import SessionService


class FakeHub:
    def __init__(self) -> None:
        self.listen_text: list[str] = []
        self.operator: list[dict[str, object]] = []
        self.listener_count = 0

    async def broadcast_audio(self, pcm: bytes, sample_rate: int) -> None:
        return None

    async def broadcast_text(self, text: str) -> None:
        self.listen_text.append(text)

    async def broadcast_operator(self, payload: dict[str, object]) -> None:
        self.operator.append(payload)


class FakeInterpreter:
    def __init__(self, events: list[InterpreterEvent]) -> None:
        self._events = events
        self.closed = False
        self.required_sample_rate = 24000
        self.required_channels = 1
        self.required_sample_width = 2
        self.received_pcm: list[bytes] = []

    async def start(self) -> None:
        return None

    async def send_pcm(self, chunk: bytes) -> None:
        self.received_pcm.append(chunk)

    async def events(self):
        for event in self._events:
            yield event

    async def close(self) -> None:
        self.closed = True


class FakeCapture:
    def __init__(self, chunks: list[bytes]) -> None:
        self.input_format = (48000, 2, 2)
        self._chunks = chunks

    async def chunks(self):
        for chunk in self._chunks:
            yield chunk


def pcm16(values: list[int]) -> bytes:
    return np.asarray(values, dtype="<i2").tobytes()


@pytest.mark.asyncio
async def test_capture_is_processed_before_interpreter_send():
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)
    interpreter = FakeInterpreter([])
    service._interpreter = interpreter
    service._capture = FakeCapture(
        [np.asarray([[0, 1000], [2000, 3000]], dtype="<i2").tobytes()]
    )
    service._processor = session_service_module.AudioProcessor(
        48000, 2, 2, 24000, 1, 2
    )
    service._running = True

    await service._pump_capture()

    assert b"" not in interpreter.received_pcm
    assert np.frombuffer(
        b"".join(interpreter.received_pcm), dtype="<i2"
    ).tolist() == [500]


@pytest.mark.asyncio
async def test_capture_broadcasts_throttled_input_audio_level(monkeypatch):
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)
    interpreter = FakeInterpreter([])
    service._interpreter = interpreter
    service._capture = FakeCapture(
        [pcm16([0, 0]), pcm16([32767, 32767]), pcm16([32767, 32767])]
    )
    service._processor = session_service_module.AudioProcessor(
        16000, 1, 2, 16000, 1, 2
    )
    service._running = True
    times = iter([0.0, 0.05, 0.1])
    monkeypatch.setattr(service, "_clock", lambda: next(times))

    await service._pump_capture()

    assert hub.operator == [
        {"type": "audio_level", "level": -60.0},
        {"type": "audio_level", "level": pytest.approx(0.0, abs=0.001)},
    ]


@pytest.mark.asyncio
async def test_input_text_is_operator_only():
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)  # type: ignore[arg-type]
    service._interpreter = FakeInterpreter(
        [
            InterpreterEvent(kind="input_text", text="안녕하세요"),
            InterpreterEvent(kind="output_text", text="Guten Tag"),
        ]
    )

    await service._pump_events()

    assert hub.listen_text == ["Guten Tag"]
    assert hub.operator == [
        {"type": "transcript", "role": "input", "text": "안녕하세요"},
        {"type": "transcript", "role": "output", "text": "Guten Tag"},
    ]


@pytest.mark.asyncio
async def test_output_text_reports_audio_chunk_to_caption_latency():
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)  # type: ignore[arg-type]
    service._interpreter = FakeInterpreter(
        [InterpreterEvent(kind="output_text", text="Guten Tag")]
    )
    service._first_audio_chunk_since_text_sent_at = 4.0
    service._clock = lambda: 4.275

    await service._pump_events()

    assert hub.operator[0] == {"type": "latency", "milliseconds": 275}
    assert hub.operator[1] == {
        "type": "transcript",
        "role": "output",
        "text": "Guten Tag",
    }


@pytest.mark.asyncio
async def test_output_text_latency_uses_first_audio_chunk_since_previous_text():
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)  # type: ignore[arg-type]
    service._interpreter = FakeInterpreter(
        [
            InterpreterEvent(kind="output_text", text="Guten Tag"),
            InterpreterEvent(kind="output_text", text="Wie geht es Ihnen?"),
        ]
    )
    timestamps = iter([4.0, 4.1, 4.4])
    service._first_audio_chunk_since_text_sent_at = next(timestamps)
    service._clock = lambda: next(timestamps)

    await service._pump_events()

    assert [event for event in hub.operator if event["type"] == "latency"] == [
        {"type": "latency", "milliseconds": 100},
    ]


@pytest.mark.asyncio
async def test_event_stream_end_stops_session_and_closes_interpreter():
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)
    interpreter = FakeInterpreter([])
    service._interpreter = interpreter
    service._running = True
    service._tasks = [asyncio.current_task()]  # type: ignore[list-item]

    await service._pump_events()

    assert service.running is False
    assert interpreter.closed is True
    assert hub.operator[-1]["running"] is False


@pytest.mark.asyncio
async def test_concurrent_start_creates_one_session(monkeypatch):
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)
    started = asyncio.Event()
    release = asyncio.Event()
    created = 0

    class BlockingInterpreter(FakeInterpreter):
        async def start(self) -> None:
            nonlocal created
            created += 1
            started.set()
            await release.wait()

    def create_interpreter(_settings: Settings) -> BlockingInterpreter:
        return BlockingInterpreter([])

    class FakeCapture:
        def __init__(self, _settings: Settings) -> None:
            self.input_format = (16000, 1, 2)

        async def start(self) -> None:
            return None

        async def stop(self) -> None:
            return None

        async def chunks(self):
            await asyncio.Future()
            yield b""

    monkeypatch.setattr(
        session_service_module, "create_interpreter", create_interpreter
    )
    monkeypatch.setattr(session_service_module, "AudioCapture", FakeCapture)

    async def idle_pump():
        await asyncio.Future()

    monkeypatch.setattr(service, "_pump_capture", idle_pump)
    monkeypatch.setattr(service, "_pump_events", idle_pump)

    first = asyncio.create_task(service.start())
    await started.wait()
    second = asyncio.create_task(service.start())
    release.set()
    await asyncio.gather(first, second)

    assert created == 1
    assert service.running is True
    await service.stop()


@pytest.mark.asyncio
async def test_start_cleans_up_when_processor_creation_fails(monkeypatch):
    hub = FakeHub()
    service = SessionService(Settings(interpreter="echo"), hub)
    interpreter = FakeInterpreter([])
    capture = None

    class FakeCapture:
        def __init__(self, _settings: Settings) -> None:
            nonlocal capture
            capture = self
            self.input_format = (16000, 1, 2)
            self.stopped = False

        async def start(self) -> None:
            return None

        async def stop(self) -> None:
            self.stopped = True

    monkeypatch.setattr(session_service_module, "AudioCapture", FakeCapture)
    monkeypatch.setattr(
        session_service_module,
        "create_interpreter",
        lambda _settings: interpreter,
    )

    def fail_processor(*_args: object) -> None:
        raise ValueError("invalid audio format")

    monkeypatch.setattr(session_service_module, "AudioProcessor", fail_processor)

    with pytest.raises(ValueError, match="invalid audio format"):
        await service.start()

    assert capture is not None
    assert capture.stopped is True
    assert interpreter.closed is True


@pytest.mark.asyncio
async def test_start_marks_missing_for_openai_without_key(tmp_path):
    hub = FakeHub()
    store = session_service_module.OperatorSettingsStore(
        tmp_path / "operator.json"
    )
    store.save(interpreter="openai")
    service = SessionService(Settings(interpreter="echo"), hub, store)

    with pytest.raises(RuntimeError, match="OpenAI API key is not set"):
        await service.start()

    view = store.public_view(Settings(interpreter="echo"))
    assert view["openai_key_status"] == "missing"


@pytest.mark.asyncio
async def test_start_does_not_mark_connection_failure_as_invalid(monkeypatch, tmp_path):
    hub = FakeHub()
    store = session_service_module.OperatorSettingsStore(
        tmp_path / "operator.json"
    )
    store.save(interpreter="openai", openai_api_key="saved-key")

    class FailingInterpreter(FakeInterpreter):
        async def start(self) -> None:
            raise RuntimeError("connection failed")

    monkeypatch.setattr(
        session_service_module,
        "create_interpreter",
        lambda _settings: FailingInterpreter([]),
    )
    service = SessionService(Settings(interpreter="echo"), hub, store)

    with pytest.raises(RuntimeError, match="connection failed"):
        await service.start()

    view = store.public_view(Settings(interpreter="echo"))
    assert view["openai_key_status"] != "invalid"
