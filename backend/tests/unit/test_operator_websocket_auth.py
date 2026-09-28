import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from starlette.websockets import WebSocketDisconnect

from core.config import get_settings
from main import app
from services.broadcast import hub
from services.operator_auth import _login_failures

TEST_PASSWORD = "test-only-password"
TEST_SESSION_SECRET = "test-only-session-secret-with-at-least-32-bytes"
SAME_ORIGIN = "http://testserver"


def configure_auth(monkeypatch):
    _login_failures.clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "operator_password", SecretStr(TEST_PASSWORD))
    monkeypatch.setattr(
        settings, "allowed_origins", [*settings.allowed_origins, SAME_ORIGIN]
    )
    monkeypatch.setattr(
        settings, "operator_session_secret", SecretStr(TEST_SESSION_SECRET)
    )


def authenticate(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"password": TEST_PASSWORD},
        headers={"Origin": SAME_ORIGIN},
    )
    assert response.status_code == 200


def test_operator_websocket_rejects_missing_cookie_before_hub_registration(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(
                "/ws/operator", headers={"Origin": SAME_ORIGIN}
            ):
                pass

    assert not hub._operator_clients


def test_operator_websocket_rejects_untrusted_origin(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        authenticate(client)
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(
                "/ws/operator", headers={"Origin": "https://attacker.invalid"}
            ):
                pass

    assert not hub._operator_clients


def test_authenticated_operator_websocket_registers_and_receives_status(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        authenticate(client)
        with client.websocket_connect(
            "/ws/operator", headers={"Origin": SAME_ORIGIN}
        ) as websocket:
            assert websocket.receive_json()["type"] == "translation_status"
            assert len(hub._operator_clients) == 1

    assert not hub._operator_clients