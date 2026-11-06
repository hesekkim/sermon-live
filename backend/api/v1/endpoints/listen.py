import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.broadcast import hub
from services.runtime import session

logger = logging.getLogger(__name__)

router = APIRouter()

LISTEN_IDLE_TIMEOUT_SECONDS = 30.0


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "app_name": "sermon-live"}


async def _handle_listen_message(websocket: WebSocket, message: str) -> None:
    try:
        payload = json.loads(message)
    except ValueError:
        return
    if not isinstance(payload, dict):
        return
    message_type = payload.get("type")
    if message_type == "ping":
        await hub.send_listen_event(websocket, {"type": "pong"})
    elif message_type == "audio":
        hub.set_listener_audio(websocket, payload.get("enabled") is True)


@router.websocket("/ws/listen")
async def listen_socket(websocket: WebSocket) -> None:
    try:
        await hub.register(websocket, kind="listen")
        if not await hub.send_listen_event(websocket, session.session_event()):
            return
        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(), timeout=LISTEN_IDLE_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                await websocket.close(code=1001, reason="Listener heartbeat timeout")
                return
            await _handle_listen_message(websocket, message)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Listener WebSocket handler failed")
        raise
    finally:
        if hub.unregister(websocket):
            await hub.broadcast_operator(
                {"type": "listener_count", "listener_count": hub.listener_count}
            )
