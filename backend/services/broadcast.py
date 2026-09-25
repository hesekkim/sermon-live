from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

logger = logging.getLogger(__name__)

ClientKind = Literal["listen", "operator"]


class BroadcastHub:
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
        stale: list[WebSocket] = []
        for client in list(self._listen_clients):
            try:
                await client.send_bytes(pcm)
            except Exception:
                stale.append(client)
        for client in stale:
            self.unregister(client)
        if stale:
            await self.broadcast_operator(
                {"type": "listener_count", "listener_count": self.listener_count}
            )

    async def broadcast_text(self, text: str) -> None:
        await self._broadcast_listen_json({"text": text})

    async def broadcast_operator(self, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for client in list(self._operator_clients):
            ok = await self._safe_send_json(client, payload)
            if not ok:
                stale.append(client)
        for client in stale:
            self.unregister(client)

    async def broadcast_session(self, payload: dict[str, Any]) -> None:
        await self.broadcast_operator(payload)
        await self._broadcast_listen_json(payload)

    async def close_all(self) -> None:
        for client in list(self._listen_clients | self._operator_clients):
            try:
                if client.client_state == WebSocketState.CONNECTED:
                    await client.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
            self.unregister(client)

    async def _broadcast_listen_json(self, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for client in list(self._listen_clients):
            ok = await self._safe_send_json(client, payload)
            if not ok:
                stale.append(client)
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
