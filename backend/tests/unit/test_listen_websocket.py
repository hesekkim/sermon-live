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


@pytest.mark.asyncio
async def test_listener_sends_are_serialized_per_socket():
    hub = BroadcastHub()
    listener = FakeWebSocket()
    hub._listen_clients.add(listener)
    hub._sample_rate = 24000

    await asyncio.gather(
        hub.broadcast_audio(b"pcm", 24000),
        hub.broadcast_text("translation"),
    )

    assert listener.max_active_sends == 1
    assert sorted(
        (
            "audio"
            if isinstance(message, bytes)
            else message.get("text", "")
        )
        for message in listener.messages
    ) == ["audio", "translation"]


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
