from secrets import compare_digest

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, SecretStr

from core.config import get_settings
from services.operator_auth import (
    SESSION_COOKIE,
    SESSION_MAX_AGE_SECONDS,
    auth_is_configured,
    check_login_allowed,
    clear_login_failures,
    create_session,
    read_session,
    record_login_failure,
    validate_origin,
    verify_password,
)

router = APIRouter()


class LoginBody(BaseModel):
    password: SecretStr


def _check_origin(request: Request) -> None:
    settings = get_settings()
    if not validate_origin(
        request.headers.get("origin"), settings.allowed_origins
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid request origin",
        )


def _set_session_cookie(response: Response, value: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=value,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=False,
        samesite="strict",
        path="/",
    )


@router.post("/api/v1/auth/login")
async def login(body: LoginBody, request: Request, response: Response) -> dict[str, object]:
    _check_origin(request)
    if not auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Operator authentication is not configured",
        )
    check_login_allowed(request)
    if not verify_password(body.password.get_secret_value()):
        record_login_failure(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    clear_login_failures(request)
    cookie, csrf_token = create_session()
    _set_session_cookie(response, cookie)
    return {"authenticated": True, "csrf_token": csrf_token}


@router.get("/api/v1/auth/session")
async def current_session(request: Request) -> dict[str, object]:
    if not auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Operator authentication is not configured",
        )
    payload = read_session(request.cookies.get(SESSION_COOKIE))
    if payload is None:
        return {"authenticated": False}
    return {"authenticated": True, "csrf_token": payload["csrf"]}


@router.post("/api/v1/auth/logout")
async def logout(request: Request, response: Response) -> dict[str, bool]:
    _check_origin(request)
    payload = read_session(request.cookies.get(SESSION_COOKIE))
    if payload is not None:
        if not compare_digest(
            request.headers.get("x-csrf-token", ""), payload["csrf"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid CSRF token",
            )
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=False,
        samesite="strict",
        path="/",
    )
    return {"authenticated": False}