import asyncio
import json
from types import SimpleNamespace

import pytest
from pydantic import SecretStr
from websockets.exceptions import InvalidStatus

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

    await publisher.start("a" * 32, SecretStr("operator-selected-password"))
    await publisher.send_subtitle("Guten Morgen", "de")
    await publisher.send_scripture(
        {
            "type": "scripture",
            "reference": "Psalm 23:1",
            "version": "Lutherbibel 1912",
            "verses": [{"verse": 1, "text": "Der HERR ist mein Hirte."}],
        }
    )
    await publisher.send_audio(bytes(960), 24000)
    await publisher.stop("manual")

    assert FakeHttpClient.requests[0] == (
        "https://relay.example.com/api/v1/relay/sessions/" + "a" * 32,
        {"X-Publisher-Credential": "p" * 40},
        {"listener_password": "operator-selected-password"},
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
    assert json.loads(socket.sent[3])["type"] == "scripture"
    assert isinstance(socket.sent[4], bytes)
    assert socket.sent[4][:4] == b"SL1A"
    assert json.loads(socket.sent[5])["type"] == "publisher_close"
    assert socket.closed


@pytest.mark.asyncio
async def test_oversized_scripture_is_logged_and_skipped_without_affecting_publisher(
    caplog,
):
    socket = FakeSocket()
    publisher = RelayPublisher(
        Settings(
            _env_file=None,
            relay_url="https://relay.example.com",
            relay_publisher_credential=SecretStr("p" * 40),
            relay_listener_password=SecretStr("listener-password"),
        )
    )
    publisher._session_id = "a" * 32
    publisher._socket = socket

    await publisher.send_scripture(
        {
            "reference": "Psalm 119:1-9",
            "version": "Lutherbibel 1912",
            "verses": [
                {"verse": number, "text": "x" * 1000}
                for number in range(1, 10)
            ],
        }
    )
    await publisher.send_status("live")

    assert len(socket.sent) == 1
    assert json.loads(socket.sent[0])["status"] == "live"
    assert "Skipping oversized Listener scripture event" in caplog.text


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


def test_opus_encoder_flushes_partial_frame_with_silence():
    encoder = OpusPacketEncoder()

    frames = encoder.encode(bytes(960), 24000)
    assert len(frames) == 1

    # 10 ms is 240 samples and must be padded to a 20 ms Opus frame on flush.
    encoder = OpusPacketEncoder()
    encoder.encode(bytes(480), 24000)
    frames = encoder.flush()
    assert len(frames) == 1

    encoder = OpusPacketEncoder()
    encoder.encode(bytes(240), 24000)
    frames = encoder.flush()
    assert len(frames) == 1
    assert frames[0][:4] == b"SL1A"
    assert int.from_bytes(frames[0][6:8], "little") == len(frames[0]) - 20


def test_relay_audio_queue_keeps_only_configured_duration():
    settings = Settings(
        _env_file=None,
        relay_url="https://relay.example.com",
        relay_publisher_credential=SecretStr("p" * 40),
        relay_listener_password=SecretStr("listener-password"),
        relay_queue_max_seconds=0.04,
    )
    publisher = RelayPublisher(settings)

    for _ in range(4):
        publisher._queue_audio_packet(b"S" * 100)

    assert publisher.queue_duration_seconds <= 0.04
    assert publisher.queue_bytes <= 400


@pytest.mark.asyncio
async def test_relay_send_failures_start_reconnect_without_raising(monkeypatch):
    settings = Settings(
        _env_file=None,
        relay_url="https://relay.example.com",
        relay_publisher_credential=SecretStr("p" * 40),
        relay_listener_password=SecretStr("listener-password"),
    )
    publisher = RelayPublisher(settings)

    class DroppingSocket:
        async def send(self, _payload):
            raise OSError("connection lost")

    async def blocked_reconnect():
        await asyncio.Event().wait()

    publisher._session_id = "a" * 32
    publisher._socket = DroppingSocket()
    monkeypatch.setattr(publisher, "_run_reconnect", blocked_reconnect)

    await publisher.send_audio(bytes(960), 24000)

    assert publisher.state == "reconnecting"
    assert publisher.queue_duration_seconds > 0
    reconnect_task = publisher._reconnect_task
    assert reconnect_task is not None
    reconnect_task.cancel()
    await asyncio.gather(reconnect_task, return_exceptions=True)

    publisher._socket = DroppingSocket()
    await publisher.send_subtitle("Guten Morgen", "de")
    assert publisher.state == "reconnecting"
    reconnect_task = publisher._reconnect_task
    assert reconnect_task is not None
    reconnect_task.cancel()
    await asyncio.gather(reconnect_task, return_exceptions=True)


@pytest.mark.asyncio
async def test_reconnect_drains_queued_audio_before_sending_new_audio(monkeypatch):
    settings = Settings(
        _env_file=None,
        relay_url="https://relay.example.com",
        relay_publisher_credential=SecretStr("p" * 40),
        relay_listener_password=SecretStr("listener-password"),
    )
    publisher = RelayPublisher(settings)
    queued_send_started = asyncio.Event()
    allow_queued_send = asyncio.Event()

    class PausingSocket(FakeSocket):
        async def send(self, payload):
            if isinstance(payload, bytes) and not queued_send_started.is_set():
                queued_send_started.set()
                await allow_queued_send.wait()
            self.sent.append(payload)

    socket = PausingSocket()

    async def fake_connect(_url, **_kwargs):
        return socket

    old_packet = (
        b"SL1A"
        + bytes((1, 0))
        + (1).to_bytes(2, "little")
        + bytes(8)
        + (7).to_bytes(4, "big")
        + b"x"
    )
    publisher._session_id = "a" * 32
    publisher._queue_audio_packet(old_packet)
    monkeypatch.setattr(relay_module, "connect", fake_connect)

    reconnect_task = asyncio.create_task(publisher._run_reconnect())
    await queued_send_started.wait()
    await publisher.send_audio(bytes(960), 24000)
    allow_queued_send.set()
    await reconnect_task

    audio_packets = [item for item in socket.sent if isinstance(item, bytes)]
    assert [int.from_bytes(item[16:20], "big") for item in audio_packets] == [
        7,
        1 << 28,
    ]

    publisher._stopping = True
    heartbeat_task = publisher._heartbeat_task
    if heartbeat_task is not None:
        heartbeat_task.cancel()
        await asyncio.gather(heartbeat_task, return_exceptions=True)
    await publisher._close_socket()


@pytest.mark.asyncio
async def test_reconnect_surfaces_http_authentication_rejection(monkeypatch):
    settings = Settings(
        _env_file=None,
        relay_url="https://relay.example.com",
        relay_publisher_credential=SecretStr("p" * 40),
        relay_listener_password=SecretStr("listener-password"),
    )
    publisher = RelayPublisher(settings)
    publisher._session_id = "a" * 32

    async def rejected_connect(_url, **_kwargs):
        raise InvalidStatus(SimpleNamespace(status_code=403))

    monkeypatch.setattr(relay_module, "connect", rejected_connect)

    await publisher._run_reconnect()

    assert publisher.state == "error"
    assert publisher.last_error == "Cloud relay Publisher authentication failed"
