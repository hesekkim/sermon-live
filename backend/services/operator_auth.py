import secrets
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import HTTPException, Request, WebSocket, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from core.config import get_settings

SESSION_COOKIE = "operator_session"
SESSION_MAX_AGE_SECONDS = 12 * 60 * 60
LOGIN_FAILURE_LIMIT = 5
LOGIN_FAILURE_WINDOW_SECONDS = 5 * 60
_login_failures: dict[str, deque[float]] = defaultdict(deque)


def _secret_values() -> tuple[str, str] | None:
    settings = get_settings()
    password = settings.operator_password
    secret = settings.operator_session_secret
    if password is None or secret is None:
        return None

    password_value = password.get_secret_value()
    secret_value = secret.get_secret_value()
    if not password_value or len(secret_value) < 32:
        return None
    return password_value, secret_value


def auth_is_configured() -> bool:
    return _secret_values() is not None


def _serializer(secret: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret, salt="sermon-live-operator-session")


def create_session() -> tuple[str, str]:
    values = _secret_values()
    if values is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Operator authentication is not configured",
        )
    csrf_token = secrets.token_urlsafe(32)
    session_cookie = _serializer(values[1]).dumps(
        {"authenticated": True, "csrf": csrf_token}
    )
    return session_cookie, csrf_token


def read_session(session_cookie: str | None) -> dict[str, Any] | None:
    values = _secret_values()
    if values is None or not session_cookie:
        return None
    try:
        payload = _serializer(values[1]).loads(
            session_cookie,
            max_age=SESSION_MAX_AGE_SECONDS,
        )
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None
    if (
        not isinstance(payload, dict)
        or payload.get("authenticated") is not True
        or not isinstance(payload.get("csrf"), str)
    ):
        return None
    return payload


def verify_password(candidate: str) -> bool:
    values = _secret_values()
    return values is not None and secrets.compare_digest(candidate, values[0])


def validate_origin(origin: str | None, allowed_origins: list[str]) -> bool:
    if not origin or origin == "null":
        return False
    allowed = {value.rstrip("/") for value in allowed_origins}
    return origin.rstrip("/") in allowed


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def check_login_allowed(request: Request) -> None:
    key = _client_key(request)
    now = time.monotonic()
    failures = _login_failures[key]
    while failures and now - failures[0] >= LOGIN_FAILURE_WINDOW_SECONDS:
        failures.popleft()
    if len(failures) >= LOGIN_FAILURE_LIMIT:
        retry_after = max(1, int(LOGIN_FAILURE_WINDOW_SECONDS - (now - failures[0])))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts",
            headers={"Retry-After": str(retry_after)},
        )


def record_login_failure(request: Request) -> None:
    _login_failures[_client_key(request)].append(time.monotonic())


def clear_login_failures(request: Request) -> None:
    _login_failures.pop(_client_key(request), None)


def require_http_operator(request: Request) -> None:
    if not auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Operator authentication is not configured",
        )
    payload = read_session(request.cookies.get(SESSION_COOKIE))
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Operator authentication required",
        )

    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        settings = get_settings()
        if not validate_origin(
            request.headers.get("origin"), settings.allowed_origins
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid request origin",
            )
        csrf_token = request.headers.get("x-csrf-token", "")
        if not secrets.compare_digest(csrf_token, payload["csrf"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid CSRF token",
            )


async def require_websocket_operator(websocket: WebSocket) -> bool:
    if not auth_is_configured():
        await websocket.close(code=1008, reason="Operator authentication unavailable")
        return False
    if read_session(websocket.cookies.get(SESSION_COOKIE)) is None:
        await websocket.close(code=1008, reason="Operator authentication required")
        return False

    settings = get_settings()
    if not validate_origin(
        websocket.headers.get("origin"), settings.allowed_origins
    ):
        await websocket.close(code=1008, reason="Invalid WebSocket origin")
        return False
    return True