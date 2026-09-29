from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from core.config import InterpreterName, get_settings
from services.broadcast import hub
from services.key_validation import validate_operator_key
from services import network
from services.operator_store import store
from services.runtime import audio, session
from services.session_service import SessionTransitionError
from services.operator_auth import require_http_operator, require_websocket_operator

router = APIRouter()


class OperatorSettingsBody(BaseModel):
    interpreter: InterpreterName
    openai_api_key: str | None = Field(default=None)
    audio_device: str | None = Field(default=None)
    input_transcript_enabled: bool | None = Field(default=None)
    translation_session_auto_stop_minutes: int | None = Field(default=None, gt=0)
    translation_session_warning_minutes: int | None = Field(default=None, gt=0)
    translation_session_extension_minutes: int | None = Field(default=None, gt=0)
    translation_session_hard_limit_minutes: int | None = Field(default=None, gt=0)


class OperatorNetworkResponse(BaseModel):
    lan_ip: str | None


@router.get(
    "/api/v1/operator/network",
    response_model=OperatorNetworkResponse,
    dependencies=[Depends(require_http_operator)],
)
def get_operator_network() -> OperatorNetworkResponse:
    return OperatorNetworkResponse(lan_ip=network.detect_lan_ip())


@router.get(
    "/api/v1/operator/settings", dependencies=[Depends(require_http_operator)]
)
async def get_operator_settings() -> dict[str, object]:
    await validate_operator_key(get_settings(), store)
    return store.public_view(get_settings())


@router.put(
    "/api/v1/operator/settings", dependencies=[Depends(require_http_operator)]
)
async def put_operator_settings(body: OperatorSettingsBody) -> dict[str, object]:
    current_settings = get_settings()
    current_view = store.public_view(current_settings)
    previous_device = current_view["audio_device"]
    device_changed = body.audio_device is not None and body.audio_device != previous_device
    session_busy = session.state in ("starting", "live", "stopping")
    if device_changed and session_busy:
        raise HTTPException(
            status_code=409,
            detail="Stop the translation session before changing the input device",
        )
    timer_fields = (
        "translation_session_auto_stop_minutes",
        "translation_session_warning_minutes",
        "translation_session_extension_minutes",
        "translation_session_hard_limit_minutes",
    )
    protected_settings_changed = body.interpreter != current_view["interpreter"]
    if (
        body.input_transcript_enabled is not None
        and body.input_transcript_enabled
        != current_view["input_transcript_enabled"]
    ):
        protected_settings_changed = True
    for field in timer_fields:
        requested = getattr(body, field)
        if requested is not None and requested != current_view[field]:
            protected_settings_changed = True
            break
    stored_key = store.load().openai_api_key or current_settings.openai_api_key
    protected_settings_changed = protected_settings_changed or (
        body.openai_api_key not in (None, "")
        and body.openai_api_key != stored_key
    )
    if protected_settings_changed and session_busy:
        raise HTTPException(
            status_code=409,
            detail="Stop the translation session before changing protected settings",
        )
    try:
        store.save(
            interpreter=body.interpreter,
            openai_api_key=body.openai_api_key,
            audio_device=body.audio_device,
            input_transcript_enabled=body.input_transcript_enabled,
            settings=current_settings,
            translation_session_auto_stop_minutes=(
                body.translation_session_auto_stop_minutes
            ),
            translation_session_warning_minutes=(
                body.translation_session_warning_minutes
            ),
            translation_session_extension_minutes=(
                body.translation_session_extension_minutes
            ),
            translation_session_hard_limit_minutes=(
                body.translation_session_hard_limit_minutes
            ),
        )
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save operator settings",
        ) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if device_changed:
        await audio.restart()
    await validate_operator_key(get_settings(), store)
    return store.public_view(get_settings())


@router.get("/api/v1/session", dependencies=[Depends(require_http_operator)])
def get_session() -> dict[str, object]:
    return session.status()


@router.post(
    "/api/v1/session/start", dependencies=[Depends(require_http_operator)]
)
async def start_session() -> dict[str, object]:
    try:
        await session.start()
    except SessionTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=400, detail=session.safe_error_message(str(exc))
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=400, detail=session.safe_error_message(str(exc))
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=session.safe_error_message(str(exc))
        ) from exc
    return session.status()


@router.post(
    "/api/v1/session/stop", dependencies=[Depends(require_http_operator)]
)
async def stop_session() -> dict[str, object]:
    try:
        await session.stop()
    except SessionTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return session.status()


@router.post(
    "/api/v1/session/extend", dependencies=[Depends(require_http_operator)]
)
async def extend_session() -> dict[str, object]:
    try:
        await session.extend_session()
    except SessionTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return session.status()


@router.websocket("/ws/operator")
async def operator_socket(websocket: WebSocket) -> None:
    if not await require_websocket_operator(websocket):
        return
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
