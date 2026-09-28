import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture
def operator_client(monkeypatch):
    from core.config import get_settings
    from main import app
    from services.operator_auth import _login_failures

    settings = get_settings()
    monkeypatch.setattr(settings, "operator_password", SecretStr("test-only-password"))
    monkeypatch.setattr(
        settings,
        "allowed_origins",
        [*settings.allowed_origins, "http://testserver"],
    )
    monkeypatch.setattr(
        settings,
        "operator_session_secret",
        SecretStr("test-only-session-secret-with-at-least-32-bytes"),
    )
    _login_failures.clear()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"password": "test-only-password"},
            headers={"Origin": "http://testserver"},
        )
        assert response.status_code == 200
        client.headers.update(
            {
                "Origin": "http://testserver",
                "X-CSRF-Token": response.json()["csrf_token"],
            }
        )
        yield client
