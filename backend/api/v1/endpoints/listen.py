from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.broadcast import hub
from services.runtime import session

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "app_name": "sermon-live"}


@router.websocket("/ws/listen")
async def listen_socket(websocket: WebSocket) -> None:
    await hub.register(websocket, kind="listen")
    await websocket.send_json(session.session_event())
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.unregister(websocket)
        await hub.broadcast_operator(
            {"type": "status", "listenerCount": hub.listener_count}
        )
    except Exception:
        hub.unregister(websocket)
        await hub.broadcast_operator(
            {"type": "status", "listenerCount": hub.listener_count}
        )
