from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

logger = logging.getLogger(__name__)

ClientKind = Literal["listen", "operator"]


class BroadcastHub:
    _OPERATOR_SEND_TIMEOUT_SECONDS = 1.0
    _OPERATOR_CLOSE_TIMEOUT_SECONDS = 0.1
    _LISTEN_SEND_TIMEOUT_SECONDS = 1.0
    _LISTEN_CLOSE_TIMEOUT_SECONDS = 0.1

    def __init__(self) -> None:
        self._listen_clients: set[WebSocket] = set()
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
        self._listen_clients.add(websocket)
        logger.info("Listen client connected (%s total)", self.listener_count)
        if self._sample_rate is not None:
            await self._safe_send_json(
                websocket, {"sampleRate": self._sample_rate}
            )
        await self.broadcast_operator(
            {"type": "listener_count", "listener_count": self.listener_count}
        )

    def unregister(self, websocket: WebSocket) -> None:
        if websocket in self._operator_clients:
            self._operator_clients.discard(websocket)
            logger.info(
                "Operator client disconnected (%s total)",
                len(self._operator_clients),
            )
            return
        if websocket in self._listen_clients:
            self._listen_clients.discard(websocket)
            logger.info(
                "Listen client disconnected (%s total)", self.listener_count
            )

    async def broadcast_audio(self, pcm: bytes, sample_rate: int) -> None:
        if sample_rate != self._sample_rate:
            self._sample_rate = sample_rate
            await self._broadcast_listen_json({"sampleRate": sample_rate})
        clients = list(self._listen_clients)
        results = await asyncio.gather(
            *(self._send_listen_bytes(client, pcm) for client in clients)
        )
        await self._remove_stale_listeners(clients, results)

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
                for key in ("type", "session_status", "last_termination_reason")
                if key in payload
            }
        elif event_type == "session_ended":
            listen_payload = {
                key: payload[key]
                for key in ("type", "reason")
                if key in payload
            }
        elif event_type == "error":
            listen_payload = {"type": "error"}
            if "session_status" in payload:
                listen_payload["session_status"] = payload["session_status"]
        else:
            return
        await self._broadcast_listen_json(listen_payload)

    async def close_all(self) -> None:
        for client in list(self._listen_clients | self._operator_clients):
            try:
                if client.client_state == WebSocketState.CONNECTED:
                    await client.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
            self.unregister(client)

    async def _broadcast_listen_json(self, payload: dict[str, Any]) -> None:
        clients = list(self._listen_clients)
        results = await asyncio.gather(
            *(self._send_listen_json(client, payload) for client in clients)
        )
        await self._remove_stale_listeners(clients, results)

    async def _send_listen_json(
        self, client: WebSocket, payload: dict[str, Any]
    ) -> bool:
        try:
            return await asyncio.wait_for(
                self._safe_send_json(client, payload),
                timeout=self._LISTEN_SEND_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            await self._close_slow_listener(client)
            return False

    async def _send_listen_bytes(self, client: WebSocket, pcm: bytes) -> bool:
        try:
            await asyncio.wait_for(
                client.send_bytes(pcm),
                timeout=self._LISTEN_SEND_TIMEOUT_SECONDS,
            )
            return True
        except asyncio.TimeoutError:
            await self._close_slow_listener(client)
        except Exception:
            return False
        return False

    async def _close_slow_listener(self, client: WebSocket) -> None:
        try:
            await asyncio.wait_for(
                client.close(code=1013, reason="Listen connection is too slow"),
                timeout=self._LISTEN_CLOSE_TIMEOUT_SECONDS,
            )
        except Exception:
            pass

    async def _remove_stale_listeners(
        self, clients: list[WebSocket], results: list[bool]
    ) -> None:
        stale = [client for client, ok in zip(clients, results) if not ok]
        for client in stale:
            self.unregister(client)
        if stale:
            await self.broadcast_operator(
                {"type": "listener_count", "listener_count": self.listener_count}
            )

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
