import asyncio

import pytest

from core.config import Settings
from services import session_service as session_service_module
from services.broadcast import BroadcastHub
from services.interpreters.protocol import InterpreterEvent
from services.operator_store import OperatorSettingsStore
from services.sermon_session import SermonSessionStore
from services.session_service import SessionService, SessionTransitionError


class FakeAudioRuntime:
    def __init__(self, ready=True, error=None):
        self.ready = ready
        self.error = error
        self.on_device_error = None
        self.queue = None

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
            await queue.put(None)
        return queue


class FakeHub:
    def __init__(self):
        self.listener_count = 1
        self.operator_events = []
        self.listener_events = []
        self.audio_events = []
        self.audio_received = asyncio.Event()
        self.listen_text = []
        self.ended = asyncio.Event()

    async def broadcast_session(self, payload):
        self.operator_events.append(payload)
        self.listener_events.append(payload)
        if payload.get("type") == "session_ended":
            self.ended.set()

    async def broadcast_operator(self, payload):
        self.operator_events.append(payload)

    async def broadcast_audio(self, pcm, sample_rate):
        self.audio_events.append((pcm, sample_rate))
        self.audio_received.set()

    async def broadcast_text(self, text):
        self.listen_text.append(text)


class ErrorInterpreter:
    required_sample_rate = 24000
    required_channels = 1
    required_sample_width = 2

    async def validate_key(self):
        return None

    async def start(self):
        return None

    async def send_pcm(self, _chunk):
        return None

    async def events(self):
        yield InterpreterEvent(kind="error", text="Interpreter disconnected")

    async def close(self):
        return None


def make_service(tmp_path, *, audio=None, settings=None, operator_store=None):
    hub = FakeHub()
    service = SessionService(
        settings or Settings(interpreter="echo"),
        hub,
        audio or FakeAudioRuntime(),
        operator_store=operator_store or OperatorSettingsStore(tmp_path / "operator.json"),
        sermon_store=SermonSessionStore(tmp_path / "sermon.json"),
    )
    return service, hub


@pytest.mark.asyncio
async def test_start_stop_keeps_server_audio_ready_and_rejects_duplicate_transitions(tmp_path):
    audio = FakeAudioRuntime()
    service, hub = make_service(tmp_path, audio=audio)

    await service.start("sermon-current")
    assert service.state == "live"
    assert service.status()["sermon_session_id"] == "sermon-current"
    await audio.queue.put(b"\x01\x00\x02\x00")
    await asyncio.wait_for(hub.audio_received.wait(), timeout=1)
    with pytest.raises(SessionTransitionError):
        await service.start()

    await service.stop()

    assert service.state == "off"
    assert hub.audio_events == [(b"\x01\x00\x02\x00", 16000)]
    assert audio.ready is True
    assert service.status()["last_termination_reason"] == "manual"
    with pytest.raises(SessionTransitionError):
        await service.stop()
    assert hub.operator_events[-1] == {"type": "session_ended", "reason": "manual"}
    assert hub.listener_events[-1] == hub.operator_events[-1]


@pytest.mark.asyncio
async def test_translation_status_uses_standardized_contract(tmp_path):
    service, hub = make_service(tmp_path)

    await service.start()

    status = next(
        event
        for event in hub.operator_events
        if event.get("type") == "translation_status"
        and event.get("session_status") == "live"
    )
    assert status["type"] == "translation_status"
    assert status["session_status"] == "live"
    assert status["listener_count"] == 1
    assert status["running"] is True

    await service.stop()


@pytest.mark.asyncio
@pytest.mark.parametrize("reason", ["auto_stop", "hard_limit"])
async def test_automatic_end_reasons_are_broadcast(tmp_path, reason):
    service, hub = make_service(tmp_path)
    await service.start()

    await service.stop(reason)

    assert service.status()["last_termination_reason"] == reason
    assert hub.operator_events[-1]["reason"] == reason
    assert hub.listener_events[-1] == hub.operator_events[-1]


@pytest.mark.asyncio
async def test_translation_timer_warns_and_auto_stops_using_monotonic_time(tmp_path):
    service, hub = make_service(tmp_path)
    clock = {"value": 0.0}
    service._clock = lambda: clock["value"]

    await service.start()
    clock["value"] = service._timer_started_at + (90 * 60 - 300) + 1
    await service._refresh_timer_state()
    assert service.status()["timer"]["warning"] is True
    assert service.status()["timer"]["remainingSeconds"] == 299

    clock["value"] = service._timer_started_at + (90 * 60) + 1
    await service._refresh_timer_state()

    assert service.state == "off"
    assert service.status()["last_termination_reason"] == "auto_stop"
    assert hub.operator_events[-1]["reason"] == "auto_stop"
    assert hub.listener_events[-1] == hub.operator_events[-1]


@pytest.mark.asyncio
async def test_timer_task_can_finish_session_without_awaiting_itself(tmp_path):
    service, hub = make_service(tmp_path)
    clock = {"value": 0.0}
    service._clock = lambda: clock["value"]

    await service.start()
    timer_task = service._timer_task
    timer_task.cancel()
    await asyncio.gather(timer_task, return_exceptions=True)
    clock["value"] = service._timer_deadline_at + 1

    async def expire_from_timer_task():
        await service._refresh_timer_state()

    expiring_task = asyncio.create_task(expire_from_timer_task())
    service._timer_task = expiring_task
    await expiring_task

    assert service.state == "off"
    assert service.status()["last_termination_reason"] == "auto_stop"
    assert hub.operator_events[-1] == {"type": "session_ended", "reason": "auto_stop"}


@pytest.mark.asyncio
async def test_translation_timer_extension_clamps_to_hard_limit(tmp_path):
    service, _hub = make_service(tmp_path)
    clock = {"value": 0.0}
    service._clock = lambda: clock["value"]

    await service.start()
    clock["value"] = service._timer_started_at + (90 * 60) - 1
    await service._refresh_timer_state()

    await service.extend_session()
    assert service.status()["timer"]["extensionCount"] == 1
    with pytest.raises(RuntimeError, match="warning period"):
        await service.extend_session()

    clock["value"] = service._timer_deadline_at - 300
    await service.extend_session()
    clock["value"] = service._timer_deadline_at - 300
    await service.extend_session()
    assert service.status()["timer"]["extensionCount"] == 3
    assert service._timer_deadline_at == service._timer_started_at + (120 * 60)

    clock["value"] = service._timer_started_at + (120 * 60) + 1
    await service._refresh_timer_state()
    assert service.state == "off"
    assert service.status()["last_termination_reason"] == "hard_limit"
    assert "timer" not in service.status()

    with pytest.raises(RuntimeError, match="Hard limit"):
        await service.extend_session()


@pytest.mark.asyncio
async def test_extension_is_rejected_after_auto_stop_deadline(tmp_path):
    service, _hub = make_service(tmp_path)
    clock = {"value": 0.0}
    service._clock = lambda: clock["value"]

    await service.start()
    clock["value"] = service._timer_deadline_at + 1

    with pytest.raises(RuntimeError, match="Auto-stop deadline has passed"):
        await service.extend_session()

    await service._refresh_timer_state()
    assert service.state == "off"
    assert service.status()["last_termination_reason"] == "auto_stop"


@pytest.mark.asyncio
async def test_operator_timer_settings_are_used_for_session_deadline(tmp_path):
    settings = Settings(interpreter="echo")
    operator_store = OperatorSettingsStore(tmp_path / "operator.json")
    operator_store.save(
        interpreter="echo",
        settings=settings,
        translation_session_auto_stop_minutes=2,
        translation_session_warning_minutes=1,
        translation_session_extension_minutes=3,
        translation_session_hard_limit_minutes=5,
    )
    service, _hub = make_service(
        tmp_path,
        settings=settings,
        operator_store=operator_store,
    )
    clock = {"value": 10.0}
    service._clock = lambda: clock["value"]

    await service.start()

    assert service.status()["timer"]["remainingSeconds"] == 120
    assert service._hard_limit_seconds() == 300
    await service.stop()


@pytest.mark.asyncio
async def test_duplicate_start_and_stop_are_rejected_while_starting(tmp_path, monkeypatch):
    started = asyncio.Event()
    release = asyncio.Event()

    class BlockingInterpreter:
        required_sample_rate = 24000
        required_channels = 1
        required_sample_width = 2

        def __init__(self):
            self.closed = asyncio.Event()

        async def validate_key(self):
            return None

        async def start(self):
            started.set()
            await release.wait()

        async def send_pcm(self, _chunk):
            return None

        async def events(self):
            await self.closed.wait()
            if False:
                yield InterpreterEvent(kind="error")

        async def close(self):
            self.closed.set()

    monkeypatch.setattr(
        session_service_module,
        "create_interpreter",
        lambda _settings: BlockingInterpreter(),
    )
    service, hub = make_service(tmp_path)
    start_task = asyncio.create_task(service.start())
    await started.wait()

    assert service.state == "starting"
    assert any(
        event.get("type") == "translation_status"
        and event.get("session_status") == "starting"
        for event in hub.operator_events
    )
    with pytest.raises(SessionTransitionError):
        await service.start()
    with pytest.raises(SessionTransitionError):
        await service.stop()

    release.set()
    await start_task
    await service.stop()


@pytest.mark.asyncio
async def test_cancelled_start_closes_interpreter_and_returns_to_off(tmp_path, monkeypatch):
    started = asyncio.Event()

    class BlockingInterpreter:
        required_sample_rate = 24000
        required_channels = 1
        required_sample_width = 2

        def __init__(self):
            self.closed = False

        async def validate_key(self):
            return None

        async def start(self):
            started.set()
            await asyncio.Future()

        async def send_pcm(self, _chunk):
            return None

        async def events(self):
            if False:
                yield InterpreterEvent(kind="error")

        async def close(self):
            self.closed = True

    interpreter = BlockingInterpreter()
    monkeypatch.setattr(
        session_service_module, "create_interpreter", lambda _settings: interpreter
    )
    service, _hub = make_service(tmp_path)
    start_task = asyncio.create_task(service.start())
    await started.wait()

    start_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await start_task

    assert service.state == "off"
    assert interpreter.closed is True


@pytest.mark.asyncio
async def test_unavailable_audio_blocks_start_with_error_status(tmp_path):
    service, hub = make_service(
        tmp_path, audio=FakeAudioRuntime(ready=False, error="No input device")
    )

    with pytest.raises(RuntimeError, match="No input device"):
        await service.start()

    assert service.state == "error"
    assert service.status()["start_available"] is False
    assert any(
        event.get("type") == "error" and event.get("text") == "No input device"
        for event in hub.operator_events
    )


@pytest.mark.asyncio
async def test_failed_openai_start_records_missing_key_without_ending_event(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai")
    service, hub = make_service(
        tmp_path, operator_store=store, settings=Settings(interpreter="echo")
    )

    with pytest.raises(RuntimeError, match="OpenAI API key is not set"):
        await service.start()

    assert service.state == "error"
    assert store.public_view(Settings(interpreter="echo"))["openai_key_status"] == "missing"
    assert not any(event.get("type") == "session_ended" for event in hub.operator_events)


@pytest.mark.asyncio
async def test_interpreter_error_ends_session_for_operator_and_listener(tmp_path, monkeypatch):
    monkeypatch.setattr(
        session_service_module,
        "create_interpreter",
        lambda _settings: ErrorInterpreter(),
    )
    service, hub = make_service(tmp_path)

    await service.start()
    await asyncio.wait_for(hub.ended.wait(), timeout=1)

    assert service.state == "error"
    assert service.status()["last_termination_reason"] == "interpreter_error"
    error_event = next(event for event in hub.operator_events if event.get("type") == "error")
    assert error_event["text"] == "Interpreter disconnected"
    assert hub.listener_events == hub.operator_events


@pytest.mark.asyncio
async def test_device_error_ends_live_session_with_reason(tmp_path):
    service, hub = make_service(tmp_path)
    await service.start()

    await service._handle_device_error("Input device disconnected")

    assert service.state == "error"
    assert service.status()["last_termination_reason"] == "device_error"
    assert hub.operator_events[-1]["reason"] == "device_error"
    assert hub.listener_events[-1] == hub.operator_events[-1]


@pytest.mark.asyncio
async def test_current_sermon_session_is_linked_by_default(tmp_path):
    sermon_store = SermonSessionStore(tmp_path / "sermon.json")
    record = sermon_store.save(title="Sunday", status="ready")
    hub = FakeHub()
    service = SessionService(
        Settings(interpreter="echo"),
        hub,
        FakeAudioRuntime(),
        operator_store=OperatorSettingsStore(tmp_path / "operator.json"),
        sermon_store=sermon_store,
    )

    await service.start()

    assert service.status()["sermon_session_id"] == record.sermon_id
    await service.stop()


def test_broadcast_hub_sends_identical_lifecycle_event_to_both_client_groups():
    class FakeWebSocket:
        def __init__(self):
            self.messages = []

        async def send_json(self, payload):
            self.messages.append(payload)

    hub = BroadcastHub()
    operator = FakeWebSocket()
    listener = FakeWebSocket()
    hub._operator_clients.add(operator)
    hub._listen_clients.add(listener)
    payload = {"type": "session_ended", "reason": "manual"}

    import asyncio

    asyncio.run(hub.broadcast_session(payload))

    assert operator.messages == [payload]
    assert listener.messages == [payload]
