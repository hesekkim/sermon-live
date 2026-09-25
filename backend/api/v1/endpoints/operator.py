from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from core.config import InterpreterName, get_settings
from services.broadcast import hub
from services.key_validation import validate_operator_key
from services.operator_store import store
from services.runtime import audio, session
from services.session_service import SessionTransitionError

router = APIRouter()


class OperatorSettingsBody(BaseModel):
    interpreter: InterpreterName
    openai_api_key: str | None = Field(default=None)
    audio_device: str | None = Field(default=None)


class StartSessionBody(BaseModel):
    sermon_session_id: str | None = Field(default=None)


@router.get("/api/v1/operator/settings")
async def get_operator_settings() -> dict[str, object]:
    await validate_operator_key(get_settings(), store)
    return store.public_view(get_settings())


@router.put("/api/v1/operator/settings")
async def put_operator_settings(body: OperatorSettingsBody) -> dict[str, object]:
    current_settings = get_settings()
    previous_device = store.public_view(current_settings)["audio_device"]
    device_changed = body.audio_device is not None and body.audio_device != previous_device
    if device_changed and session.state in ("starting", "live", "stopping"):
        raise HTTPException(
            status_code=409,
            detail="Stop the translation session before changing the input device",
        )
    try:
        store.save(
            interpreter=body.interpreter,
            openai_api_key=body.openai_api_key,
            audio_device=body.audio_device,
        )
    except (OSError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save operator settings",
        ) from exc
    if device_changed:
        await audio.restart()
    await validate_operator_key(get_settings(), store)
    return store.public_view(get_settings())


@router.get("/api/v1/session")
def get_session() -> dict[str, object]:
    return session.status()


@router.post("/api/v1/session/start")
async def start_session(body: StartSessionBody | None = None) -> dict[str, object]:
    try:
        await session.start(body.sermon_session_id if body else None)
    except SessionTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except NotImplementedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return session.status()


@router.post("/api/v1/session/stop")
async def stop_session() -> dict[str, object]:
    try:
        await session.stop()
    except SessionTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return session.status()


@router.websocket("/ws/operator")
async def operator_socket(websocket: WebSocket) -> None:
    await hub.register(websocket, kind="operator")
    await websocket.send_json(session.session_event())
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.unregister(websocket)
        return
    except Exception:
        hub.unregister(websocket)
        return
