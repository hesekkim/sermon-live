import asyncio
import json

import pytest
from pydantic import SecretStr

from core.config import Settings
from services import relay_publisher as relay_module
from services.relay_publisher import (
    OpusPacketEncoder,
    RelayPublisher,
    RelayPublisherError,
)


class FakeResponse:
    status_code = 200


class FakeHttpClient:
    requests = []

    def __init__(self, timeout):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, *, headers, json=None):
        self.requests.append((url, headers, json))
        return FakeResponse()


class FakeSocket:
    def __init__(self):
        self.sent = []
        self.closed = False

    async def send(self, payload):
        self.sent.append(payload)

    async def recv(self):
        return json.dumps(
            {
                "type": "publisher_ready",
                "protocol": "sermon-live/1",
                "session_id": "a" * 32,
            }
        )

    async def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_relay_publisher_provisions_and_sends_encoded_events(monkeypatch):
    FakeHttpClient.requests = []
    socket = FakeSocket()
    connect_args = []

    async def fake_connect(url, **kwargs):
        connect_args.append((url, kwargs))
        return socket

    monkeypatch.setattr(relay_module.httpx, "AsyncClient", FakeHttpClient)
    monkeypatch.setattr(relay_module, "connect", fake_connect)
    settings = Settings(
        _env_file=None,
        relay_url="https://relay.example.com/api/v1/relay",
        relay_publisher_credential=SecretStr("p" * 40),
        relay_listener_password=SecretStr("listener-password"),
    )
    publisher = RelayPublisher(settings)

    await publisher.start("a" * 32)
    await publisher.send_subtitle("Guten Morgen", "de")
    await publisher.send_audio(bytes(960), 24000)
    await publisher.stop("manual")

    assert FakeHttpClient.requests[0] == (
        "https://relay.example.com/api/v1/relay/sessions/" + "a" * 32,
        {"X-Publisher-Credential": "p" * 40},
        {"listener_password": "listener-password"},
    )
    assert FakeHttpClient.requests[-1][0].endswith("/sessions/" + "a" * 32 + "/end")
    assert connect_args[0][0] == (
        "wss://relay.example.com/api/v1/relay/ws/publisher/" + "a" * 32
    )
    assert connect_args[0][1]["additional_headers"] == {
        "X-Publisher-Credential": "p" * 40
    }
    assert json.loads(socket.sent[0])["type"] == "publisher_hello"
    assert json.loads(socket.sent[1])["status"] == "starting"
    assert json.loads(socket.sent[2])["text"] == "Guten Morgen"
    assert isinstance(socket.sent[3], bytes)
    assert socket.sent[3][:4] == b"SL1A"
    assert json.loads(socket.sent[4])["type"] == "publisher_close"
    assert socket.closed


@pytest.mark.asyncio
async def test_start_cancellation_ends_provisioned_remote_session(monkeypatch):
    FakeHttpClient.requests = []
    connecting = asyncio.Event()

    async def blocked_connect(_url, **_kwargs):
        connecting.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(relay_module.httpx, "AsyncClient", FakeHttpClient)
    monkeypatch.setattr(relay_module, "connect", blocked_connect)
    settings = Settings(
        _env_file=None,
        relay_url="https://relay.example.com/api/v1/relay",
        relay_publisher_credential=SecretStr("p" * 40),
        relay_listener_password=SecretStr("listener-password"),
    )
    publisher = RelayPublisher(settings)

    start_task = asyncio.create_task(publisher.start("a" * 32))
    await connecting.wait()
    start_task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await start_task

    assert FakeHttpClient.requests[0][0].endswith("/sessions/" + "a" * 32)
    assert FakeHttpClient.requests[-1][0].endswith(
        "/sessions/" + "a" * 32 + "/end"
    )


@pytest.mark.asyncio
async def test_provision_request_cancellation_attempts_remote_session_end(monkeypatch):
    FakeHttpClient.requests = []
    provisioning = asyncio.Event()

    class BlockingProvisionClient(FakeHttpClient):
        async def post(self, url, *, headers, json=None):
            self.requests.append((url, headers, json))
            if url.endswith("/end"):
                return FakeResponse()
            provisioning.set()
            await asyncio.Event().wait()

    monkeypatch.setattr(relay_module.httpx, "AsyncClient", BlockingProvisionClient)
    settings = Settings(
        _env_file=None,
        relay_url="https://relay.example.com/api/v1/relay",
        relay_publisher_credential=SecretStr("p" * 40),
        relay_listener_password=SecretStr("listener-password"),
    )
    publisher = RelayPublisher(settings)

    start_task = asyncio.create_task(publisher.start("a" * 32))
    await provisioning.wait()
    start_task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await start_task

    assert FakeHttpClient.requests[-1][0].endswith(
        "/sessions/" + "a" * 32 + "/end"
    )


def test_opus_encoder_emits_protocol_audio_frames():
    encoder = OpusPacketEncoder()

    frames = encoder.encode(bytes(960), 24000)

    assert len(frames) == 1
    frame = frames[0]
    assert frame[:4] == b"SL1A"
    assert frame[4:6] == bytes((1, 0))
    payload_length = int.from_bytes(frame[6:8], "little")
    assert payload_length == len(frame) - 20
    assert payload_length <= 1275
    assert int.from_bytes(frame[16:20], "big") == 0


def test_cloud_relay_rejects_non_https_url_outside_debug():
    publisher = RelayPublisher(
        Settings(
            _env_file=None,
            relay_url="http://relay.example.com",
            relay_publisher_credential=SecretStr("p" * 40),
            relay_listener_password=SecretStr("listener-password"),
        )
    )

    with pytest.raises(RelayPublisherError, match="HTTPS"):
        publisher._validate_base_url(publisher._settings.relay_url)
