from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.broadcast import hub

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "app_name": "sermon-live"}


@router.websocket("/ws/listen")
async def listen_socket(websocket: WebSocket) -> None:
    await hub.register(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.unregister(websocket)
    except Exception:
        hub.unregister(websocket)
