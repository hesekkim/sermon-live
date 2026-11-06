import asyncio

import pytest
from starlette.websockets import WebSocketDisconnect

from api.v1.endpoints import listen as listen_endpoint
from services.broadcast import BroadcastHub


class FakeWebSocket:
    def __init__(self):
        self.messages = []
        self.active_sends = 0
        self.max_active_sends = 0
        self.fail_json_send = False

    async def accept(self):
        await asyncio.sleep(0)

    async def send_json(self, payload):
        if self.fail_json_send:
            raise RuntimeError("send failed")
        self.active_sends += 1
        self.max_active_sends = max(self.max_active_sends, self.active_sends)
        await asyncio.sleep(0)
        self.messages.append(payload)
        self.active_sends -= 1

    async def send_bytes(self, payload):
        self.active_sends += 1
        self.max_active_sends = max(self.max_active_sends, self.active_sends)
        await asyncio.sleep(0)
        self.messages.append(payload)
        self.active_sends -= 1

    async def receive_text(self):
        raise WebSocketDisconnect()

    async def close(self, **_kwargs):
        return None


class BlockingWebSocket(FakeWebSocket):
    def __init__(self):
        super().__init__()
        self.receiving = asyncio.Event()

    async def receive_text(self):
        self.receiving.set()
        await asyncio.Event().wait()


class DisconnectableWebSocket(FakeWebSocket):
    def __init__(self):
        super().__init__()
        self.receiving = asyncio.Event()
        self.disconnect_requested = asyncio.Event()

    async def receive_text(self):
        self.receiving.set()
        await self.disconnect_requested.wait()
        raise WebSocketDisconnect()


class FakeSession:
    def session_event(self):
        return {"type": "translation_status", "session_status": "off"}


@pytest.mark.asyncio
async def test_four_listener_endpoints_connect_and_disconnect_concurrently(
    monkeypatch,
):
    hub = BroadcastHub()
    operator = FakeWebSocket()
    hub._operator_clients.add(operator)
    listeners = [DisconnectableWebSocket() for _ in range(4)]
    monkeypatch.setattr(listen_endpoint, "hub", hub)
    monkeypatch.setattr(listen_endpoint, "session", FakeSession())
    tasks = [
        asyncio.create_task(listen_endpoint.listen_socket(listener))
        for listener in listeners
    ]

    await asyncio.wait_for(
        asyncio.gather(*(listener.receiving.wait() for listener in listeners)),
        timeout=1,
    )
    assert hub.listener_count == 4
    for listener in listeners:
        listener.disconnect_requested.set()
    await asyncio.gather(*tasks)

    listener_counts = sorted(
        payload["listener_count"]
        for payload in operator.messages
        if payload["type"] == "listener_count"
    )
    assert listener_counts == [0, 1, 1, 2, 2, 3, 3, 4]
    assert hub.listener_count == 0


class ScriptedWebSocket(FakeWebSocket):
    def __init__(self, incoming):
        super().__init__()
        self.incoming = list(incoming)
        self.closed_with = None
        self.done = asyncio.Event()

    async def receive_text(self):
        if self.incoming:
            await asyncio.sleep(0)
            return self.incoming.pop(0)
        self.done.set()
        await asyncio.Event().wait()

    async def close(self, **kwargs):
        self.closed_with = kwargs


@pytest.mark.asyncio
async def test_listener_sends_are_serialized_per_socket():
    hub = BroadcastHub()
    hub._sample_rate = 24000
    listener = FakeWebSocket()
    hub._add_listener(listener)
    hub.set_listener_audio(listener, True)

    await asyncio.gather(
        hub.broadcast_audio(b"pcm", 24000),
        hub.broadcast_text("translation"),
    )
    await hub.flush_listeners(1)

    assert listener.max_active_sends == 1
    assert listener.messages == [{"sampleRate": 24000}, b"pcm", {"text": "translation"}]


@pytest.mark.asyncio
async def test_audio_is_sent_only_to_listeners_that_subscribed():
    hub = BroadcastHub()
    hub._sample_rate = 24000
    reader = FakeWebSocket()
    listener = FakeWebSocket()
    hub._add_listener(reader)
    hub._add_listener(listener)
    hub.set_listener_audio(listener, True)

    await hub.broadcast_audio(b"pcm", 24000)
    await hub.broadcast_text("Hallo")
    await hub.flush_listeners(1)

    assert reader.messages == [{"sampleRate": 24000}, {"text": "Hallo"}]
    assert listener.messages == [{"sampleRate": 24000}, b"pcm", {"text": "Hallo"}]


@pytest.mark.asyncio
async def test_slow_listener_does_not_block_broadcast_for_others():
    class StalledWebSocket(FakeWebSocket):
        async def send_bytes(self, payload):
            await asyncio.Event().wait()

    hub = BroadcastHub()
    hub._sample_rate = 24000
    stalled = StalledWebSocket()
    healthy = FakeWebSocket()
    for websocket in (stalled, healthy):
        hub._add_listener(websocket)
        hub.set_listener_audio(websocket, True)

    for index in range(5):
        await asyncio.wait_for(
            hub.broadcast_audio(bytes([index, 0]), 24000), timeout=0.05
        )
    await asyncio.sleep(0.01)

    assert [m for m in healthy.messages if isinstance(m, bytes)] == [
        bytes([index, 0]) for index in range(5)
    ]
    hub.unregister(stalled)
    hub.unregister(healthy)


@pytest.mark.asyncio
async def test_listener_audio_backlog_drops_oldest_audio_but_keeps_text(monkeypatch):
    monkeypatch.setattr(BroadcastHub, "_LISTEN_MAX_QUEUED_AUDIO_SECONDS", 2 / 24000)
    gate = asyncio.Event()

    class GatedWebSocket(FakeWebSocket):
        async def send_json(self, payload):
            await gate.wait()
            await super().send_json(payload)

    hub = BroadcastHub()
    hub._sample_rate = 24000
    listener = GatedWebSocket()
    hub._add_listener(listener)
    hub.set_listener_audio(listener, True)
    await asyncio.sleep(0)

    await hub.broadcast_audio(b"\x01\x00", 24000)
    await hub.broadcast_text("Hallo")
    await hub.broadcast_audio(b"\x02\x00", 24000)
    await hub.broadcast_audio(b"\x03\x00", 24000)
    gate.set()
    await hub.flush_listeners(1)

    assert listener.messages == [
        {"sampleRate": 24000},
        {"text": "Hallo"},
        b"\x02\x00",
        b"\x03\x00",
    ]


@pytest.mark.asyncio
async def test_listener_ping_and_audio_subscription_messages(monkeypatch):
    hub = BroadcastHub()
    hub._sample_rate = 24000
    listener = ScriptedWebSocket(
        [
            '{"type": "ping"}',
            '{"type": "audio", "enabled": true}',
            "not json",
        ]
    )
    monkeypatch.setattr(listen_endpoint, "hub", hub)
    monkeypatch.setattr(listen_endpoint, "session", FakeSession())
    task = asyncio.create_task(listen_endpoint.listen_socket(listener))

    await asyncio.wait_for(listener.done.wait(), timeout=1)
    await hub.broadcast_audio(b"pcm", 24000)
    await hub.flush_listeners(1)

    assert listener.messages == [
        {"sampleRate": 24000},
        {"type": "translation_status", "session_status": "off"},
        {"type": "pong"},
        b"pcm",
    ]
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task


@pytest.mark.asyncio
async def test_listener_without_heartbeat_is_closed(monkeypatch):
    hub = BroadcastHub()
    listener = ScriptedWebSocket([])
    monkeypatch.setattr(listen_endpoint, "hub", hub)
    monkeypatch.setattr(listen_endpoint, "session", FakeSession())
    monkeypatch.setattr(listen_endpoint, "LISTEN_IDLE_TIMEOUT_SECONDS", 0.01)

    await asyncio.wait_for(listen_endpoint.listen_socket(listener), timeout=1)

    assert listener.closed_with == {
        "code": 1001,
        "reason": "Listener heartbeat timeout",
    }
    assert hub.listener_count == 0


@pytest.mark.asyncio
async def test_listener_handler_unregisters_after_initial_state_send_failure(
    monkeypatch,
):
    hub = BroadcastHub()
    listener = FakeWebSocket()
    listener.fail_json_send = True
    monkeypatch.setattr(listen_endpoint, "hub", hub)
    monkeypatch.setattr(listen_endpoint, "session", FakeSession())

    await listen_endpoint.listen_socket(listener)

    assert hub.listener_count == 0


@pytest.mark.asyncio
async def test_listener_handler_unregisters_if_registration_raises_after_accept(
    monkeypatch,
):
    hub = BroadcastHub()
    listener = FakeWebSocket()
    register = hub.register

    async def register_then_fail(websocket, kind="listen"):
        await register(websocket, kind)
        raise RuntimeError("registration failed")

    monkeypatch.setattr(listen_endpoint, "hub", hub)
    monkeypatch.setattr(hub, "register", register_then_fail)

    with pytest.raises(RuntimeError, match="registration failed"):
        await listen_endpoint.listen_socket(listener)

    assert hub.listener_count == 0


@pytest.mark.asyncio
async def test_listener_handler_unregisters_when_connection_task_is_cancelled(
    monkeypatch,
):
    hub = BroadcastHub()
    listener = BlockingWebSocket()
    monkeypatch.setattr(listen_endpoint, "hub", hub)
    monkeypatch.setattr(listen_endpoint, "session", FakeSession())
    task = asyncio.create_task(listen_endpoint.listen_socket(listener))

    await listener.receiving.wait()
    assert hub.listener_count == 1
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task

    assert hub.listener_count == 0
