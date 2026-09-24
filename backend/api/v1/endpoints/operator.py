from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from core.config import InterpreterName, get_settings
from services.broadcast import hub
from services.key_validation import validate_operator_key
from services.operator_store import store
from services.runtime import session

router = APIRouter()


class OperatorSettingsBody(BaseModel):
    interpreter: InterpreterName
    openai_api_key: str | None = Field(default=None)


@router.get("/api/v1/operator/settings")
async def get_operator_settings() -> dict[str, object]:
    await validate_operator_key(get_settings(), store)
    return store.public_view(get_settings())


@router.put("/api/v1/operator/settings")
async def put_operator_settings(body: OperatorSettingsBody) -> dict[str, object]:
    try:
        store.save(
            interpreter=body.interpreter,
            openai_api_key=body.openai_api_key,
        )
    except (OSError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save operator settings",
        ) from exc
    await validate_operator_key(get_settings(), store)
    return store.public_view(get_settings())


@router.get("/api/v1/session")
def get_session() -> dict[str, object]:
    return session.status()


@router.post("/api/v1/session/start")
async def start_session() -> dict[str, object]:
    try:
        await session.start()
    except NotImplementedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return session.status()


@router.post("/api/v1/session/stop")
async def stop_session() -> dict[str, object]:
    await session.stop()
    return session.status()


@router.websocket("/ws/operator")
async def operator_socket(websocket: WebSocket) -> None:
    await hub.register(websocket, kind="operator")
    await websocket.send_json(
        {
            "type": "status",
            "running": session.running,
            "listenerCount": hub.listener_count,
        }
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.unregister(websocket)
        return
    except Exception:
        hub.unregister(websocket)
        return
