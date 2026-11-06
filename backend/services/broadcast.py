from __future__ import annotations

import asyncio
import logging
from collections import deque
from typing import Any, Literal

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

logger = logging.getLogger(__name__)

ClientKind = Literal["listen", "operator"]
_ListenItem = tuple[Literal["json", "audio"], Any]

_DEFAULT_SAMPLE_RATE = 24000
_PCM16_BYTES_PER_SAMPLE = 2


class _ListenClient:
    def __init__(self, websocket: WebSocket) -> None:
        self.websocket = websocket
        self.audio_enabled = False
        self.items: deque[_ListenItem] = deque()
        self.audio_bytes = 0
        self.wakeup = asyncio.Event()
        self.idle = asyncio.Event()
        self.idle.set()
        self.task: asyncio.Task[None] | None = None


class BroadcastHub:
    _OPERATOR_SEND_TIMEOUT_SECONDS = 1.0
    _OPERATOR_CLOSE_TIMEOUT_SECONDS = 0.1
    _LISTEN_SEND_TIMEOUT_SECONDS = 5.0
    _LISTEN_CLOSE_TIMEOUT_SECONDS = 0.1
    _LISTEN_MAX_QUEUED_AUDIO_SECONDS = 3.0
    _LISTEN_MAX_QUEUED_MESSAGES = 256
    _LISTEN_FLUSH_TIMEOUT_SECONDS = 0.5

    def __init__(self) -> None:
        self._listen_clients: dict[WebSocket, _ListenClient] = {}
        self._operator_clients: set[WebSocket] = set()
        self._sample_rate: int | None = None

    @property
    def listener_count(self) -> int:
        return len(self._listen_clients)

    async def register(
        self, websocket: WebSocket, kind: ClientKind = "listen"
    ) -> None:
        await websocket.accept()
        if kind == "operator":
            self._operator_clients.add(websocket)
            logger.info(
                "Operator client connected (%s total)",
                len(self._operator_clients),
            )
            return
        self._add_listener(websocket)
        logger.info("Listen client connected (%s total)", self.listener_count)
        await self.broadcast_operator(
            {"type": "listener_count", "listener_count": self.listener_count}
        )

    def _add_listener(self, websocket: WebSocket) -> _ListenClient:
        client = _ListenClient(websocket)
        self._listen_clients[websocket] = client
        client.task = asyncio.create_task(
            self._run_listen_sender(client), name="listen-sender"
        )
        if self._sample_rate is not None:
            self._enqueue_json(client, {"sampleRate": self._sample_rate})
        return client

    def unregister(self, websocket: WebSocket) -> bool:
        if websocket in self._operator_clients:
            self._operator_clients.discard(websocket)
            logger.info(
                "Operator client disconnected (%s total)",
                len(self._operator_clients),
            )
            return False
        client = self._listen_clients.pop(websocket, None)
        if client is None:
            return False
        task = client.task
        if task is not None and task is not asyncio.current_task():
            task.cancel()
        client.idle.set()
        logger.info("Listen client disconnected (%s total)", self.listener_count)
        return True

    def set_listener_audio(self, websocket: WebSocket, enabled: bool) -> bool:
        client = self._listen_clients.get(websocket)
        if client is None:
            return False
        client.audio_enabled = enabled
        if not enabled and client.audio_bytes:
            client.items = deque(item for item in client.items if item[0] != "audio")
            client.audio_bytes = 0
        return True

    async def broadcast_audio(self, pcm: bytes, sample_rate: int) -> None:
        if sample_rate != self._sample_rate:
            self._sample_rate = sample_rate
            await self._broadcast_listen_json({"sampleRate": sample_rate})
        for client in list(self._listen_clients.values()):
            self._enqueue_audio(client, pcm)

    async def broadcast_text(self, text: str) -> None:
        await self._broadcast_listen_json({"text": text})

    async def broadcast_scripture(self, payload: dict[str, Any]) -> None:
        await self._broadcast_listen_json(payload)

    async def broadcast_operator(self, payload: dict[str, Any]) -> None:
        async def send(client: WebSocket) -> tuple[WebSocket, bool]:
            try:
                ok = await asyncio.wait_for(
                    self._safe_send_json(client, payload),
                    timeout=self._OPERATOR_SEND_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                ok = False
                try:
                    await asyncio.wait_for(
                        client.close(
                            code=1013,
                            reason="Operator connection is too slow",
                        ),
                        timeout=self._OPERATOR_CLOSE_TIMEOUT_SECONDS,
                    )
                except Exception:
                    pass
            return client, ok

        results = await asyncio.gather(
            *(send(client) for client in list(self._operator_clients))
        )
        stale: list[WebSocket] = []
        for client, ok in results:
            if not ok:
                stale.append(client)
        for client in stale:
            self.unregister(client)

    async def broadcast_session(self, payload: dict[str, Any]) -> None:
        await self.broadcast_operator(payload)
        event_type = payload.get("type")
        if event_type == "translation_status":
            listen_payload = {
                key: payload[key]
                for key in (
                    "type",
                    "session_status",
                    "last_termination_reason",
                    "session_id",
                    "interpreter_reconnecting",
                )
                if key in payload
            }
        elif event_type == "session_ended":
            listen_payload = {
                key: payload[key]
                for key in ("type", "reason", "session_id")
                if key in payload
            }
        elif event_type == "error":
            listen_payload = {"type": "error"}
            if "session_status" in payload:
                listen_payload["session_status"] = payload["session_status"]
        else:
            return
        await self._broadcast_listen_json(listen_payload)

    async def send_listen_event(
        self, websocket: WebSocket, payload: dict[str, Any]
    ) -> bool:
        client = self._listen_clients.get(websocket)
        if client is None:
            return False
        if self._enqueue_json(client, payload):
            return True
        await self._drop_listeners([client])
        return False

    async def flush_listeners(self, timeout: float) -> None:
        waits = [client.idle.wait() for client in self._listen_clients.values()]
        if not waits:
            return
        try:
            await asyncio.wait_for(asyncio.gather(*waits), timeout=timeout)
        except asyncio.TimeoutError:
            pass

    async def close_all(self) -> None:
        await self.flush_listeners(self._LISTEN_FLUSH_TIMEOUT_SECONDS)
        tasks = [
            client.task
            for client in self._listen_clients.values()
            if client.task is not None
        ]
        for client in list(self._listen_clients) + list(self._operator_clients):
            try:
                if client.client_state == WebSocketState.CONNECTED:
                    await client.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
            self.unregister(client)
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def _enqueue_json(self, client: _ListenClient, payload: dict[str, Any]) -> bool:
        if len(client.items) >= self._LISTEN_MAX_QUEUED_MESSAGES:
            return False
        client.items.append(("json", payload))
        self._wake(client)
        return True

    def _enqueue_audio(self, client: _ListenClient, pcm: bytes) -> None:
        if not client.audio_enabled or not pcm:
            return
        client.items.append(("audio", pcm))
        client.audio_bytes += len(pcm)
        limit = int(
            self._LISTEN_MAX_QUEUED_AUDIO_SECONDS
            * (self._sample_rate or _DEFAULT_SAMPLE_RATE)
            * _PCM16_BYTES_PER_SAMPLE
        )
        while client.audio_bytes > limit:
            oldest = next(
                (
                    index
                    for index, item in enumerate(client.items)
                    if item[0] == "audio"
                ),
                None,
            )
            if oldest is None or oldest == len(client.items) - 1:
                break
            _, dropped = client.items[oldest]
            del client.items[oldest]
            client.audio_bytes -= len(dropped)
        self._wake(client)

    @staticmethod
    def _wake(client: _ListenClient) -> None:
        client.idle.clear()
        client.wakeup.set()

    async def _run_listen_sender(self, client: _ListenClient) -> None:
        websocket = client.websocket
        try:
            while True:
                if not client.items:
                    client.idle.set()
                    client.wakeup.clear()
                    await client.wakeup.wait()
                    continue
                kind, payload = client.items.popleft()
                if kind == "audio":
                    client.audio_bytes -= len(payload)
                    send = websocket.send_bytes(payload)
                else:
                    send = websocket.send_json(payload)
                try:
                    await asyncio.wait_for(
                        send, timeout=self._LISTEN_SEND_TIMEOUT_SECONDS
                    )
                except asyncio.TimeoutError:
                    await self._close_slow_listener(websocket)
                    break
                except asyncio.CancelledError:
                    raise
                except Exception:
                    break
        finally:
            client.idle.set()
        if self._listen_clients.get(websocket) is client:
            self.unregister(websocket)
            await self.broadcast_operator(
                {"type": "listener_count", "listener_count": self.listener_count}
            )

    async def _broadcast_listen_json(self, payload: dict[str, Any]) -> None:
        overflowed = [
            client
            for client in list(self._listen_clients.values())
            if not self._enqueue_json(client, payload)
        ]
        if overflowed:
            await self._drop_listeners(overflowed)

    async def _drop_listeners(self, clients: list[_ListenClient]) -> None:
        for client in clients:
            await self._close_slow_listener(client.websocket)
            self.unregister(client.websocket)
        await self.broadcast_operator(
            {"type": "listener_count", "listener_count": self.listener_count}
        )

    async def _close_slow_listener(self, client: WebSocket) -> None:
        try:
            await asyncio.wait_for(
                client.close(code=1013, reason="Listen connection is too slow"),
                timeout=self._LISTEN_CLOSE_TIMEOUT_SECONDS,
            )
        except Exception:
            pass

    async def _safe_send_json(
        self, websocket: WebSocket, payload: dict[str, Any]
    ) -> bool:
        try:
            await websocket.send_json(payload)
            return True
        except WebSocketDisconnect:
            return False
        except Exception:
            return False


hub = BroadcastHub()
