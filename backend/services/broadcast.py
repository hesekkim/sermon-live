from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

logger = logging.getLogger(__name__)


class BroadcastHub:
    _OPERATOR_SEND_TIMEOUT_SECONDS = 1.0
    _OPERATOR_CLOSE_TIMEOUT_SECONDS = 0.1

    def __init__(self) -> None:
        self._operator_clients: set[WebSocket] = set()

    async def register(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._operator_clients.add(websocket)
        logger.info(
            "Operator client connected (%s total)",
            len(self._operator_clients),
        )

    def unregister(self, websocket: WebSocket) -> None:
        if websocket in self._operator_clients:
            self._operator_clients.discard(websocket)
            logger.info(
                "Operator client disconnected (%s total)",
                len(self._operator_clients),
            )

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
        for client, ok in results:
            if not ok:
                self.unregister(client)

    async def broadcast_session(self, payload: dict[str, Any]) -> None:
        await self.broadcast_operator(payload)

    async def close_all(self) -> None:
        for client in list(self._operator_clients):
            try:
                if client.client_state == WebSocketState.CONNECTED:
                    await client.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
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
