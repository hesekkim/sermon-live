import asyncio

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

    async def start(self) -> None:
        return None

    async def send_pcm(self, chunk: bytes) -> None:
        return None

    async def events(self):
        for event in self._events:
            yield event

    async def close(self) -> None:
        self.closed = True


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
            return None

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
async def test_start_marks_missing_for_openai_without_key(tmp_path):
    hub = FakeHub()
    store = session_service_module.OperatorSettingsStore(
        tmp_path / "operator.json"
    )
    store.save(interpreter="openai")
    service = SessionService(Settings(interpreter="echo"), hub, store)

    with pytest.raises(RuntimeError, match="Openai API key is not set"):
        await service.start()

    view = store.public_view(Settings(interpreter="echo"))
    assert view["openai_key_status"] == "missing"


@pytest.mark.asyncio
async def test_start_does_not_mark_connection_failure_as_invalid(monkeypatch, tmp_path):
    hub = FakeHub()
    store = session_service_module.OperatorSettingsStore(
        tmp_path / "operator.json"
    )
    store.save(interpreter="gemini", gemini_api_key="saved-key")

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
    assert view["gemini_key_status"] != "invalid"
