from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

logger = logging.getLogger(__name__)


class BroadcastHub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._sample_rate: int | None = None

    async def register(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)
        logger.info("Listen client connected (%s total)", len(self._clients))
        if self._sample_rate is not None:
            await self._safe_send_json(
                websocket, {"sampleRate": self._sample_rate}
            )

    def unregister(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)
        logger.info("Listen client disconnected (%s total)", len(self._clients))

    async def broadcast_audio(self, pcm: bytes, sample_rate: int) -> None:
        if sample_rate != self._sample_rate:
            self._sample_rate = sample_rate
            await self._broadcast_json({"sampleRate": sample_rate})
        stale: list[WebSocket] = []
        for client in list(self._clients):
            try:
                await client.send_bytes(pcm)
            except Exception:
                stale.append(client)
        for client in stale:
            self.unregister(client)

    async def broadcast_text(self, text: str) -> None:
        await self._broadcast_json({"text": text})

    async def close_all(self) -> None:
        for client in list(self._clients):
            try:
                if client.client_state == WebSocketState.CONNECTED:
                    await client.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
            self.unregister(client)

    async def _broadcast_json(self, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for client in list(self._clients):
            ok = await self._safe_send_json(client, payload)
            if not ok:
                stale.append(client)
        for client in stale:
            self.unregister(client)

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
