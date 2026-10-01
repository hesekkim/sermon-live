import asyncio

import pytest

from core.config import Settings
from services import session_service as session_service_module
from services.interpreters.protocol import InterpreterEvent, KeyValidationError
from services.operator_store import OperatorSettingsStore
from services.runtime import session as runtime_session
from services.session_service import SessionService

class FakeHub:
    def __init__(self) -> None:
        self.listen_text: list[str] = []
        self.operator: list[dict[str, object]] = []
        self.audio: list[tuple[bytes, int]] = []
        self.scripture: list[dict[str, object]] = []
        self.listener_count = 0

    async def broadcast_audio(self, pcm: bytes, sample_rate: int) -> None:
        self.audio.append((pcm, sample_rate))

    async def broadcast_text(self, text: str) -> None:
        self.listen_text.append(text)

    async def broadcast_scripture(self, payload: dict[str, object]) -> None:
        self.scripture.append(payload)

    async def broadcast_operator(self, payload: dict[str, object]) -> None:
        self.operator.append(payload)


class FakeInterpreter:
    def __init__(self, events: list[InterpreterEvent]) -> None:
        self._events = events

    async def events(self):
        for event in self._events:
            yield event


class FakeAudioRuntime:
    ready = True
    running = True
    error = None
    dropped_chunks = 0
    dropped_duration_seconds = 0.0
    queued_duration_seconds = 0.0
    on_device_error = None

    def __init__(self) -> None:
        self.queue: asyncio.Queue[bytes | None] | None = None

    def attach_translation(self, _interpreter):
        self.queue = asyncio.Queue()
        return self.queue

    async def finish_translation(self, *, discard_pending=False):
        queue = self.queue
        self.queue = None
        if queue is not None:
            if discard_pending:
                while not queue.empty():
                    queue.get_nowait()
            queue.put_nowait(None)
        return queue


class FakeOpenAIInterpreter:
    required_sample_rate = 24000
    required_channels = 1
    required_sample_width = 2

    def __init__(self) -> None:
        self._events: asyncio.Queue[InterpreterEvent | None] = asyncio.Queue()
        self.sent_audio: list[bytes] = []
        self.two_chunks_sent = asyncio.Event()
        self.closed = False

    async def validate_key(self):
        return None

    async def start(self):
        return None

    async def send_pcm(self, chunk: bytes):
        self.sent_audio.append(chunk)
        if len(self.sent_audio) == 2:
            self.two_chunks_sent.set()

    async def events(self):
        while True:
            event = await self._events.get()
            if event is None:
                return
            yield event

    async def close(self):
        self.closed = True
        self._events.put_nowait(
            InterpreterEvent(kind="audio", pcm=b"final-audio", sample_rate=24000)
        )
        self._events.put_nowait(
            InterpreterEvent(kind="output_text", text="Letzter Satz.")
        )
        self._events.put_nowait(None)


@pytest.mark.asyncio
async def test_active_session_routes_interpreter_events(tmp_path):
    hub = FakeHub()

    class FakeAudioRuntime:
        ready = True
        error = None
        dropped_chunks = 0
        dropped_duration_seconds = 0.0
        queued_duration_seconds = 0.0
        on_device_error = None

    store = OperatorSettingsStore(tmp_path / "active.json")
    service = SessionService(Settings(interpreter="echo"), hub, FakeAudioRuntime(), store)
    assert type(service) is type(runtime_session)
    loop = asyncio.get_running_loop()
    service._first_audio_chunk_since_text_sent_at = loop.time() - 0.275
    interpreter = FakeInterpreter(
        [
            InterpreterEvent(kind="audio", pcm=b"translated", sample_rate=24000),
            InterpreterEvent(kind="input_text", text="안녕하세요"),
            InterpreterEvent(kind="output_text", text="Guten Tag"),
        ]
    )

    await service._pump_events(interpreter)

    assert hub.audio == [(b"translated", 24000)]
    assert hub.listen_text == ["Guten Tag"]
    assert hub.operator[0] == {"type": "transcript", "role": "input", "text": "안녕하세요"}
    assert hub.operator[1]["milliseconds"] >= 275
    assert hub.operator[2] == {"type": "transcript", "role": "output", "text": "Guten Tag"}


@pytest.mark.asyncio
async def test_scripture_reference_is_broadcast_separately_from_translation(tmp_path):
    hub = FakeHub()
    store = OperatorSettingsStore(tmp_path / "scripture.json")
    service = SessionService(Settings(interpreter="echo"), hub, FakeAudioRuntime(), store)
    interpreter = FakeInterpreter(
        [
            InterpreterEvent(kind="output_text", text="Wir lesen Römer3, Vers"),
            InterpreterEvent(kind="output_text", text="28."),
            InterpreterEvent(kind="input_text", text="참조는 입력 transcript에서 찾지 않음"),
        ]
    )

    await service._pump_events(interpreter)

    assert hub.listen_text == ["Wir lesen Römer3, Vers", "28."]
    assert len(hub.scripture) == 1
    assert hub.scripture[0]["type"] == "scripture"
    assert hub.scripture[0]["reference"] == "Römer 3,28"
    assert hub.scripture[0]["version"] == "Lutherbibel 1912"
    assert [verse["verse"] for verse in hub.scripture[0]["verses"]] == [28]


@pytest.mark.asyncio
async def test_openai_session_streams_audio_and_flushes_final_events_before_stop(
    tmp_path, monkeypatch
):
    store = OperatorSettingsStore(tmp_path / "openai.json")
    store.save(interpreter="openai", openai_api_key="test-key")
    audio = FakeAudioRuntime()
    hub = FakeHub()
    interpreter = FakeOpenAIInterpreter()
    monkeypatch.setattr(
        session_service_module, "create_interpreter", lambda _settings: interpreter
    )
    service = SessionService(Settings(interpreter="echo"), hub, audio, store)

    await service.start()
    assert service.state == "live"
    assert audio.ready is True
    assert audio.running is True
    assert service.status()["session_status"] == "live"

    audio.queue.put_nowait(b"input-1")
    audio.queue.put_nowait(b"input-2")
    await asyncio.wait_for(interpreter.two_chunks_sent.wait(), timeout=1)
    await interpreter._events.put(
        InterpreterEvent(kind="audio", pcm=b"stream-audio", sample_rate=24000)
    )
    await interpreter._events.put(
        InterpreterEvent(kind="input_text", text="안녕하세요")
    )
    await interpreter._events.put(
        InterpreterEvent(kind="output_text", text="Guten Tag.")
    )

    await service.stop()

    assert interpreter.sent_audio == [b"input-1", b"input-2"]
    assert interpreter.closed is True
    assert hub.audio == [
        (b"stream-audio", 24000),
        (b"final-audio", 24000),
    ]
    assert hub.listen_text == ["Guten Tag.", "Letzter Satz."]
    assert [
        (event["role"], event["text"])
        for event in hub.operator
        if event.get("type") == "transcript"
    ] == [
        ("input", "안녕하세요"),
        ("output", "Guten Tag."),
        ("output", "Letzter Satz."),
    ]
    assert hub.operator[-1]["type"] == "session_ended"
    assert service.state == "off"
    assert audio.ready is True
    assert audio.running is True


@pytest.mark.asyncio
async def test_openai_invalid_key_prevents_session_start(tmp_path, monkeypatch):
    class InvalidKeyInterpreter(FakeOpenAIInterpreter):
        async def validate_key(self):
            raise KeyValidationError("OpenAI rejected the configured key")

    store = OperatorSettingsStore(tmp_path / "invalid-openai.json")
    store.save(interpreter="openai", openai_api_key="test-key")
    hub = FakeHub()
    interpreter = InvalidKeyInterpreter()
    monkeypatch.setattr(
        session_service_module, "create_interpreter", lambda _settings: interpreter
    )
    service = SessionService(Settings(interpreter="echo"), hub, FakeAudioRuntime(), store)

    with pytest.raises(RuntimeError, match="OpenAI rejected the configured key"):
        await service.start()

    assert service.state == "error"
    assert store.public_view(Settings(interpreter="echo"))["openai_key_status"] == "invalid"
    assert interpreter.closed is True
    assert not any(event.get("type") == "session_ended" for event in hub.operator)
