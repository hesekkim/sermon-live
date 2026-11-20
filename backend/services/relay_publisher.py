from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Callable
from collections import deque
from typing import Any
from urllib.parse import urlparse

import av
import httpx
import numpy as np
from av.audio.resampler import AudioResampler
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus

from core.config import Settings


PROTOCOL = "sermon-live/1"
SAMPLE_RATE = 24000
FRAME_SAMPLES = 480
MAX_OPUS_PACKET_BYTES = 1275
MAX_SCRIPTURE_EVENT_BYTES = 8 * 1024

logger = logging.getLogger(__name__)


class RelayPublisherError(RuntimeError):
    pass


class OpusPacketEncoder:
    def __init__(self, sequence_base: int = 0) -> None:
        self._codec = av.CodecContext.create("libopus", "w")
        self._codec.sample_rate = SAMPLE_RATE
        self._codec.layout = "mono"
        self._codec.format = "s16"
        self._codec.bit_rate = 48_000
        self._codec.options = {"application": "voip"}
        self._codec.open()
        self._resampler = AudioResampler(
            format="s16", layout="mono", rate=SAMPLE_RATE
        )
        self._pending = np.empty(0, dtype=np.int16)
        self._sequence = sequence_base

    @property
    def next_sequence(self) -> int:
        return self._sequence

    def encode(self, pcm: bytes, sample_rate: int) -> list[bytes]:
        if not pcm or sample_rate <= 0 or len(pcm) % 2:
            raise RelayPublisherError("Invalid PCM audio frame")
        samples = np.frombuffer(pcm, dtype="<i2")
        frame = av.AudioFrame.from_ndarray(
            np.ascontiguousarray(samples.reshape(1, -1)),
            format="s16",
            layout="mono",
        )
        frame.sample_rate = sample_rate
        packets: list[bytes] = []
        for resampled in self._resampler.resample(frame):
            output = resampled.to_ndarray().reshape(-1).astype(np.int16, copy=False)
            self._pending = np.concatenate((self._pending, output))
        while self._pending.size >= FRAME_SAMPLES:
            samples = self._pending[:FRAME_SAMPLES]
            self._pending = self._pending[FRAME_SAMPLES:]
            opus_frame = av.AudioFrame.from_ndarray(
                np.ascontiguousarray(samples.reshape(1, -1)),
                format="s16",
                layout="mono",
            )
            opus_frame.sample_rate = SAMPLE_RATE
            for packet in self._codec.encode(opus_frame):
                payload = bytes(packet)
                if not payload or len(payload) > MAX_OPUS_PACKET_BYTES:
                    raise RelayPublisherError("Invalid encoded Opus packet")
                packets.append(self._header(payload))
        return packets

    def _header(self, payload: bytes) -> bytes:
        if self._sequence >= 2**32:
            raise RelayPublisherError("Opus packet sequence exhausted")
        timestamp_us = time.monotonic_ns() // 1000
        header = (
            b"SL1A"
            + bytes((1, 0))
            + len(payload).to_bytes(2, "little")
            + timestamp_us.to_bytes(8, "big")
            + self._sequence.to_bytes(4, "big")
        )
        self._sequence += 1
        return header + payload

    def flush(self) -> list[bytes]:
        packets: list[bytes] = []
        if self._pending.size:
            padding = np.zeros(FRAME_SAMPLES - self._pending.size, dtype=np.int16)
            remaining = np.concatenate((self._pending, padding))
            self._pending = np.empty(0, dtype=np.int16)
            opus_frame = av.AudioFrame.from_ndarray(
                np.ascontiguousarray(remaining.reshape(1, -1)),
                format="s16",
                layout="mono",
            )
            opus_frame.sample_rate = SAMPLE_RATE
            packets.extend(
                self._header(bytes(packet))
                for packet in self._codec.encode(opus_frame)
                if packet
            )
        return packets


class RelayPublisher:
    _NO_LISTENER_POLL_INTERVAL_SECONDS = 2
    _LISTENER_POLL_INTERVAL_SECONDS = 5

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._socket: Any | None = None
        self._session_id: str | None = None
        self._sequence = 0
        self._send_lock = asyncio.Lock()
        self._encoder_lock = asyncio.Lock()
        self._encoder: OpusPacketEncoder | None = None
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._status_task: asyncio.Task[None] | None = None
        self._reconnect_task: asyncio.Task[None] | None = None
        self._background_error: RelayPublisherError | None = None
        self._state = "disabled" if not self.enabled else "idle"
        self._last_error: str | None = None
        self._audio_epoch = 0
        self._audio_queue: deque[bytes] = deque()
        self._audio_queue_duration_seconds = 0.0
        self._recovery_in_progress = False
        self._queue_max_seconds = getattr(
            settings, "relay_queue_max_seconds", 2.0
        )
        self._reconnect_initial_seconds = getattr(
            settings, "relay_reconnect_initial_seconds", 0.5
        )
        self._reconnect_max_seconds = getattr(
            settings, "relay_reconnect_max_seconds", 8.0
        )
        self._stopping = False
        self._listener_count = 0
        self._listener_status_known = False

    @property
    def enabled(self) -> bool:
        return bool(self._settings.relay_url.strip())

    @property
    def active(self) -> bool:
        return self._socket is not None

    @property
    def state(self) -> str:
        return self._state

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @property
    def queue_duration_seconds(self) -> float:
        return self._audio_queue_duration_seconds

    @property
    def queue_bytes(self) -> int:
        return sum(len(item) for item in self._audio_queue)

    @property
    def listener_count(self) -> int:
        return self._listener_count

    async def start(self, session_id: str) -> None:
        if not self.enabled:
            return
        self._stopping = False
        self._listener_status_known = False
        self._state = "starting"
        self._last_error = None
        credential: str | None = None
        base_url: str | None = None
        self._background_error = None
        try:
            credential = self._secret(self._settings.relay_publisher_credential)
            base_url = self._validate_base_url(self._settings.relay_url)
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"{base_url}/sessions/{session_id}",
                    headers={"X-Publisher-Credential": credential},
                )
                if response.status_code != 200:
                    if response.status_code in {401, 403}:
                        raise RelayPublisherError(
                            "Cloud relay Publisher authentication failed"
                        )
                    raise RelayPublisherError(
                        f"Cloud relay session setup failed (HTTP {response.status_code})"
                    )

            parsed = urlparse(base_url)
            websocket_scheme = "wss" if parsed.scheme == "https" else "ws"
            socket_url = (
                f"{websocket_scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
                f"/ws/publisher/{session_id}"
            )
            self._socket = await connect(
                socket_url,
                additional_headers={"X-Publisher-Credential": credential},
                open_timeout=10,
                max_size=2 * 1024 * 1024,
            )
            self._session_id = session_id
            self._encoder = OpusPacketEncoder(self._audio_epoch << 28)
            await self._socket.send(
                json.dumps(
                    {
                        "type": "publisher_hello",
                        "protocol": PROTOCOL,
                        "session_id": session_id,
                        "codec": "opus",
                        "container": "raw-opus",
                        "sample_rate": SAMPLE_RATE,
                        "channels": 1,
                        "packet_duration_ms": 20,
                        "target_bitrate": 48000,
                    }
                )
            )
            response_text = await asyncio.wait_for(self._socket.recv(), timeout=10)
            response_payload = json.loads(response_text)
            if (
                not isinstance(response_payload, dict)
                or response_payload.get("type") != "publisher_ready"
                or response_payload.get("session_id") != session_id
                or response_payload.get("protocol") != PROTOCOL
            ):
                raise RelayPublisherError("Cloud relay rejected the Publisher handshake")
            await self.send_status("starting")
            self._state = "live"
            self._heartbeat_task = asyncio.create_task(
                self._run_heartbeat(), name="cloud-relay-publisher-heartbeat"
            )
            self._status_task = asyncio.create_task(
                self._poll_listener_status(),
                name="cloud-relay-publisher-status",
            )
        except asyncio.CancelledError:
            await self._close_socket()
            self._state = "ended"
            if base_url is not None and credential is not None:
                try:
                    await self._end_remote_session(base_url, session_id, credential)
                except RelayPublisherError:
                    logger.exception(
                        "Cloud relay session shutdown failed after Publisher startup cancellation"
                    )
            raise
        except Exception as error:
            await self._close_socket()
            relay_error = (
                error
                if isinstance(error, RelayPublisherError)
                else RelayPublisherError("Could not connect to the cloud relay")
            )
            self._last_error = str(relay_error)
            self._state = "error"
            if base_url is not None and credential is not None:
                try:
                    await self._end_remote_session(base_url, session_id, credential)
                except RelayPublisherError as cleanup_error:
                    raise RelayPublisherError(
                        f"{relay_error}; remote session cleanup also failed: "
                        f"{cleanup_error}"
                    ) from error
            if isinstance(error, RelayPublisherError):
                raise
            raise relay_error from error

    async def send_status(self, session_status: str) -> None:
        if self._socket is None or self._session_id is None:
            return
        await self._send_json(
            {
                "type": "status",
                "session_id": self._session_id,
                "sequence": self._next_sequence(),
                "timestamp_ms": time.monotonic_ns() // 1_000_000,
                "status": session_status,
            }
        )

    async def send_subtitle(self, text: str, language: str) -> None:
        if self._socket is None or self._session_id is None:
            return
        await self._send_json(
            {
                "type": "subtitle",
                "session_id": self._session_id,
                "sequence": self._next_sequence(),
                "timestamp_ms": time.monotonic_ns() // 1_000_000,
                "language": language,
                "text": text,
            }
        )

    async def send_scripture(self, payload: dict[str, object]) -> None:
        if self._socket is None or self._session_id is None:
            return
        event = {
            **payload,
            "type": "scripture",
            "session_id": self._session_id,
            "sequence": self._sequence,
            "timestamp_ms": time.monotonic_ns() // 1_000_000,
        }
        event_size = len(json.dumps(event, ensure_ascii=False).encode("utf-8"))
        if event_size > MAX_SCRIPTURE_EVENT_BYTES:
            logger.warning(
                "Skipping oversized Listener scripture event "
                "(session_id=%s, size_bytes=%d, limit_bytes=%d)",
                self._session_id,
                event_size,
                MAX_SCRIPTURE_EVENT_BYTES,
            )
            return
        self._next_sequence()
        await self._send_json(event, ensure_ascii=False)

    async def send_audio(self, pcm: bytes, sample_rate: int) -> None:
        if (
            self._stopping
            or not self.enabled
            or (self._listener_status_known and self._listener_count == 0)
        ):
            return
        try:
            async with self._encoder_lock:
                if self._encoder is None:
                    self._encoder = OpusPacketEncoder(self._audio_epoch << 28)
                encoder = self._encoder
                packets = await self._run_encoder_work(
                    lambda: encoder.encode(pcm, sample_rate)
                )
                if self._socket is None or self._recovery_in_progress:
                    for packet in packets:
                        self._queue_audio_packet(packet)
                    return
        except RelayPublisherError:
            raise
        socket = self._socket
        for index, packet in enumerate(packets):
            if socket is None or self._recovery_in_progress or self._socket is not socket:
                for pending in packets[index:]:
                    self._queue_audio_packet(pending)
                return
            try:
                async with self._send_lock:
                    if self._recovery_in_progress or self._socket is not socket:
                        for pending in packets[index:]:
                            self._queue_audio_packet(pending)
                        return
                    await socket.send(packet)
            except (ConnectionClosed, OSError):
                for pending in packets[index:]:
                    self._queue_audio_packet(pending)
                self._set_connection_error(
                    RelayPublisherError("Cloud relay connection was lost")
                )
                return

    def _queue_audio_packet(self, packet: bytes) -> None:
        self._audio_queue.append(packet)
        self._audio_queue_duration_seconds += FRAME_SAMPLES / SAMPLE_RATE
        while (
            self._audio_queue_duration_seconds > self._queue_max_seconds
            and self._audio_queue
        ):
            self._audio_queue.popleft()
            self._audio_queue_duration_seconds = max(
                0.0,
                self._audio_queue_duration_seconds - FRAME_SAMPLES / SAMPLE_RATE,
            )

    async def stop(self, reason: str) -> None:
        self._stopping = True
        self._state = "ending"
        reconnect_task = self._reconnect_task
        self._reconnect_task = None
        if reconnect_task is not None:
            reconnect_task.cancel()
            await asyncio.gather(reconnect_task, return_exceptions=True)
        session_id = self._session_id
        if session_id is None:
            self._state = "ended"
            return
        send_error: Exception | None = None
        try:
            async with self._encoder_lock:
                encoder = self._encoder
                packets = (
                    await self._run_encoder_work(encoder.flush)
                    if encoder is not None and self._socket is not None
                    else []
                )
            if self._socket is not None:
                for packet in packets:
                    async with self._send_lock:
                        await self._socket.send(packet)
            if self._socket is not None:
                await self._send_json(
                    {
                        "type": "publisher_close",
                        "session_id": session_id,
                        "reason": (
                            "publisher_error"
                            if reason in {"interpreter_error", "device_error", "error"}
                            else "publisher_closed"
                        ),
                        "sequence": self._next_sequence(),
                    }
                )
        except Exception as error:
            send_error = error
        finally:
            await self._close_socket()
        credential = self._secret(self._settings.relay_publisher_credential)
        base_url = self._validate_base_url(self._settings.relay_url)
        await self._end_remote_session(base_url, session_id, credential)
        self._state = "ended"
        if send_error is not None:
            raise send_error

    async def _send_json(
        self, payload: dict[str, object], *, ensure_ascii: bool = True
    ) -> None:
        if self._socket is None or self._recovery_in_progress:
            return
        if self._background_error is not None:
            if self._stopping:
                self._raise_background_error()
            return
        socket = self._socket
        try:
            async with self._send_lock:
                if self._recovery_in_progress or self._socket is not socket:
                    return
                await socket.send(json.dumps(payload, ensure_ascii=ensure_ascii))
        except (ConnectionClosed, OSError) as error:
            relay_error = RelayPublisherError("Cloud relay connection was lost")
            if self._stopping:
                raise relay_error from error
            self._set_connection_error(relay_error)

    def _next_sequence(self) -> int:
        value = self._sequence
        self._sequence += 1
        return value

    @staticmethod
    async def _run_encoder_work(operation: Callable[[], list[bytes]]) -> list[bytes]:
        worker = asyncio.create_task(asyncio.to_thread(operation))
        try:
            return await asyncio.shield(worker)
        except asyncio.CancelledError:
            try:
                await worker
            except Exception:
                logger.exception("Opus encoder worker failed during cancellation")
            raise

    async def _close_socket(self) -> None:
        heartbeat_task = self._heartbeat_task
        self._heartbeat_task = None
        if heartbeat_task is not None and heartbeat_task is not asyncio.current_task():
            heartbeat_task.cancel()
            await asyncio.gather(heartbeat_task, return_exceptions=True)
        status_task = self._status_task
        self._status_task = None
        if status_task is not None and status_task is not asyncio.current_task():
            status_task.cancel()
            await asyncio.gather(status_task, return_exceptions=True)
        self._listener_count = 0
        self._listener_status_known = False
        socket = self._socket
        self._socket = None
        async with self._encoder_lock:
            self._encoder = None
        self._session_id = None
        if socket is not None:
            try:
                await socket.close()
            except (ConnectionClosed, OSError):
                pass

    def _set_connection_error(self, error: RelayPublisherError) -> None:
        if self._stopping:
            return
        self._background_error = error
        self._last_error = str(error)
        self._state = "reconnecting"
        if self._reconnect_task is None or self._reconnect_task.done():
            self._reconnect_task = asyncio.create_task(
                self._run_reconnect(), name="cloud-relay-publisher-reconnect"
            )

    async def _run_reconnect(self) -> None:
        session_id = self._session_id
        if session_id is None:
            return
        credential = self._secret(self._settings.relay_publisher_credential)
        base_url = self._validate_base_url(self._settings.relay_url)
        parsed = urlparse(base_url)
        websocket_scheme = "wss" if parsed.scheme == "https" else "ws"
        socket_url = (
            f"{websocket_scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
            f"/ws/publisher/{session_id}"
        )
        delay = self._reconnect_initial_seconds
        self._recovery_in_progress = True
        try:
            while not self._stopping:
                socket: Any | None = None
                try:
                    await self._close_socket_keep_encoder()
                    socket = await connect(
                        socket_url,
                        additional_headers={"X-Publisher-Credential": credential},
                        open_timeout=10,
                        max_size=2 * 1024 * 1024,
                    )
                    self._audio_epoch += 1
                    async with self._encoder_lock:
                        encoder = self._encoder
                        packets = (
                            await self._run_encoder_work(encoder.flush)
                            if encoder is not None
                            else []
                        )
                        self._encoder = OpusPacketEncoder(
                            self._audio_epoch << 28
                        )
                    for packet in packets:
                            self._queue_audio_packet(packet)
                    await socket.send(
                        json.dumps(
                            {
                                "type": "publisher_hello",
                                "protocol": PROTOCOL,
                                "session_id": session_id,
                                "codec": "opus",
                                "container": "raw-opus",
                                "sample_rate": SAMPLE_RATE,
                                "channels": 1,
                                "packet_duration_ms": 20,
                                "target_bitrate": 48000,
                            }
                        )
                    )
                    response_text = await asyncio.wait_for(socket.recv(), timeout=10)
                    response_payload = json.loads(response_text)
                    if (
                        not isinstance(response_payload, dict)
                        or response_payload.get("type") != "publisher_ready"
                        or response_payload.get("session_id") != session_id
                        or response_payload.get("protocol") != PROTOCOL
                    ):
                        raise RelayPublisherError(
                            "Cloud relay rejected the Publisher reconnect"
                        )
                    self._socket = socket
                    socket = None
                    self._background_error = None
                    self._last_error = None
                    self._state = "live_recovered"
                    async with self._send_lock:
                        await self._socket.send(
                            json.dumps(
                                {
                                    "type": "status",
                                    "session_id": session_id,
                                    "sequence": self._next_sequence(),
                                    "timestamp_ms": time.monotonic_ns() // 1_000_000,
                                    "status": "reconnecting",
                                }
                            )
                        )
                        await self._socket.send(
                            json.dumps(
                                {
                                    "type": "status",
                                    "session_id": session_id,
                                    "sequence": self._next_sequence(),
                                    "timestamp_ms": time.monotonic_ns() // 1_000_000,
                                    "status": "live_recovered",
                                }
                            )
                        )
                    while self._audio_queue:
                        packet = self._audio_queue[0]
                        async with self._send_lock:
                            await self._socket.send(packet)
                        self._audio_queue.popleft()
                        self._audio_queue_duration_seconds = max(
                            0.0,
                            self._audio_queue_duration_seconds
                            - FRAME_SAMPLES / SAMPLE_RATE,
                        )
                    self._recovery_in_progress = False
                    self._state = "live"
                    self._heartbeat_task = asyncio.create_task(
                        self._run_heartbeat(),
                        name="cloud-relay-publisher-heartbeat",
                    )
                    self._status_task = asyncio.create_task(
                        self._poll_listener_status(),
                        name="cloud-relay-publisher-status",
                    )
                    return
                except asyncio.CancelledError:
                    raise
                except InvalidStatus as error:
                    response = getattr(error, "response", None)
                    if getattr(response, "status_code", None) in {401, 403}:
                        auth_error = RelayPublisherError(
                            "Cloud relay Publisher authentication failed"
                        )
                        self._background_error = auth_error
                        self._last_error = str(auth_error)
                        self._state = "error"
                        return
                    self._last_error = "Cloud relay reconnect is retrying"
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, self._reconnect_max_seconds)
                except (
                    asyncio.TimeoutError,
                    ConnectionClosed,
                    OSError,
                    RelayPublisherError,
                ) as error:
                    if isinstance(error, RelayPublisherError) and (
                        "credentials" in str(error).lower()
                        or "rejected" in str(error).lower()
                        or "authentication" in str(error).lower()
                    ):
                        self._last_error = str(error)
                        self._state = "error"
                        return
                    self._last_error = "Cloud relay reconnect is retrying"
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, self._reconnect_max_seconds)
                finally:
                    if socket is not None:
                        try:
                            await socket.close()
                        except (ConnectionClosed, OSError):
                            pass
        finally:
            self._recovery_in_progress = False

    async def _close_socket_keep_encoder(self) -> None:
        heartbeat_task = self._heartbeat_task
        self._heartbeat_task = None
        if heartbeat_task is not None and heartbeat_task is not asyncio.current_task():
            heartbeat_task.cancel()
            await asyncio.gather(heartbeat_task, return_exceptions=True)
        status_task = self._status_task
        self._status_task = None
        if status_task is not None and status_task is not asyncio.current_task():
            status_task.cancel()
            await asyncio.gather(status_task, return_exceptions=True)
        self._listener_count = 0
        self._listener_status_known = False
        socket = self._socket
        self._socket = None
        if socket is not None:
            try:
                await socket.close()
            except (ConnectionClosed, OSError):
                pass

    async def _poll_listener_status(self) -> None:
        while self._socket is not None and self._session_id is not None:
            try:
                session_id = self._session_id
                credential = self._secret(self._settings.relay_publisher_credential)
                base_url = self._validate_base_url(self._settings.relay_url)
                async with httpx.AsyncClient(timeout=5) as client:
                    response = await client.get(
                        f"{base_url}/sessions/{session_id}/status",
                        headers={"X-Publisher-Credential": credential},
                    )
                if response.status_code == 200:
                    payload = response.json()
                    if not isinstance(payload, dict):
                        raise ValueError("Invalid cloud relay status response")
                    if payload.get("status") != "live":
                        self._listener_count = 0
                        self._listener_status_known = False
                        self._last_error = "Cloud relay session is no longer live"
                        self._state = "error"
                        return
                    count = payload.get("listener_count")
                    if (
                        isinstance(count, int)
                        and not isinstance(count, bool)
                        and count >= 0
                    ):
                        self._listener_count = count
                        self._listener_status_known = True
                    else:
                        self._listener_count = 0
                        self._listener_status_known = False
                    if self._last_error in {
                        "Cloud relay listener status could not be refreshed",
                        "Cloud relay listener status is unavailable",
                    }:
                        self._last_error = None
                else:
                    self._listener_count = 0
                    self._listener_status_known = False
                    self._last_error = (
                        "Cloud relay listener status could not be refreshed"
                    )
            except asyncio.CancelledError:
                raise
            except (
                asyncio.TimeoutError,
                httpx.HTTPError,
                RelayPublisherError,
                OSError,
                ValueError,
            ):
                self._listener_count = 0
                self._listener_status_known = False
                self._last_error = "Cloud relay listener status is unavailable"
            await asyncio.sleep(
                self._NO_LISTENER_POLL_INTERVAL_SECONDS
                if self._listener_status_known and self._listener_count == 0
                else self._LISTENER_POLL_INTERVAL_SECONDS
            )

    async def _run_heartbeat(self) -> None:
        try:
            while self._socket is not None and self._session_id is not None:
                await asyncio.sleep(15)
                await self._send_json(
                    {
                        "type": "publisher_ping",
                        "session_id": self._session_id,
                        "timestamp_ms": time.monotonic_ns() // 1_000_000,
                    }
                )
        except asyncio.CancelledError:
            raise
        except RelayPublisherError as error:
            self._background_error = error
            self._set_connection_error(error)

    def _raise_background_error(self) -> None:
        if self._background_error is not None:
            raise self._background_error

    async def _end_remote_session(
        self, base_url: str, session_id: str, credential: str
    ) -> None:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post(
                    f"{base_url}/sessions/{session_id}/end",
                    headers={"X-Publisher-Credential": credential},
                )
                if response.status_code != 200:
                    raise RelayPublisherError(
                        f"Cloud relay session shutdown failed (HTTP {response.status_code})"
                    )
        except httpx.HTTPError as error:
            raise RelayPublisherError("Could not shut down the cloud relay session") from error

    @staticmethod
    def _secret(value) -> str:
        secret = value.get_secret_value() if value is not None else ""
        if len(secret) < 8:
            raise RelayPublisherError("Cloud relay credentials are not configured")
        return secret

    def _validate_base_url(self, value: str) -> str:
        parsed = urlparse(value.strip().rstrip("/"))
        try:
            parsed.port
        except ValueError as error:
            raise RelayPublisherError("Cloud relay URL is invalid") from error
        if (
            parsed.scheme not in {"https", "http"}
            or not parsed.netloc
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or (
                parsed.scheme != "https"
                and not (
                    self._settings.debug
                    and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
                )
            )
        ):
            raise RelayPublisherError("Cloud relay URL must use HTTPS")
        credential = self._secret(self._settings.relay_publisher_credential)
        if len(credential) < 32:
            raise RelayPublisherError("Cloud relay Publisher credential is too weak")
        return value.strip().rstrip("/")
