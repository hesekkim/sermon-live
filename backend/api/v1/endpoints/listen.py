import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.broadcast import hub
from services.runtime import session

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "app_name": "sermon-live"}


@router.websocket("/ws/listen")
async def listen_socket(websocket: WebSocket) -> None:
    try:
        await hub.register(websocket, kind="listen")
        if not await hub.send_listen_event(websocket, session.session_event()):
            return
        while True:
            await websocket.receive_text()
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
