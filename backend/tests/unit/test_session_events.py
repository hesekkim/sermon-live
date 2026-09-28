import asyncio

import pytest

from core.config import Settings
from services.interpreters.protocol import InterpreterEvent
from services.operator_store import OperatorSettingsStore
from services.runtime import session as runtime_session
from services.session_service import SessionService

class FakeHub:
    def __init__(self) -> None:
        self.listen_text: list[str] = []
        self.operator: list[dict[str, object]] = []
        self.audio: list[tuple[bytes, int]] = []
        self.listener_count = 0

    async def broadcast_audio(self, pcm: bytes, sample_rate: int) -> None:
        self.audio.append((pcm, sample_rate))

    async def broadcast_text(self, text: str) -> None:
        self.listen_text.append(text)

    async def broadcast_operator(self, payload: dict[str, object]) -> None:
        self.operator.append(payload)


class FakeInterpreter:
    def __init__(self, events: list[InterpreterEvent]) -> None:
        self._events = events

    async def events(self):
        for event in self._events:
            yield event


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
