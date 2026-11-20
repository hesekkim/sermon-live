import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from starlette.websockets import WebSocketDisconnect

from core.config import Settings, get_settings
from main import app
from services.operator_auth import _login_failures

TEST_PASSWORD = "test-only-password"
TEST_SESSION_SECRET = "test-only-session-secret-with-at-least-32-bytes"
SAME_ORIGIN = "http://testserver"
HTTPS_ORIGIN = "https://testserver"


def configure_auth(monkeypatch):
    _login_failures.clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "operator_password", SecretStr(TEST_PASSWORD))
    monkeypatch.setattr(
        settings,
        "allowed_origins",
        [*settings.allowed_origins, SAME_ORIGIN, HTTPS_ORIGIN],
    )
    monkeypatch.setattr(
        settings, "operator_session_secret", SecretStr(TEST_SESSION_SECRET)
    )


def login(client: TestClient, origin: str = SAME_ORIGIN):
    return client.post(
        "/api/v1/auth/login",
        json={"password": TEST_PASSWORD},
        headers={"Origin": origin},
    )


def test_login_sets_signed_http_only_session_and_session_endpoint_returns_csrf(
    monkeypatch,
):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        response = login(client)

        assert response.status_code == 200
        cookie = response.headers["set-cookie"]
        assert "operator_session=" in cookie
        assert "httponly" in cookie.lower()
        assert "samesite=strict" in cookie.lower()
        assert "secure" not in cookie.lower()
        assert TEST_PASSWORD not in cookie
        assert TEST_PASSWORD not in response.text

        session = client.get("/api/v1/auth/session")
        assert session.json()["authenticated"] is True
        assert session.json()["csrf_token"] == response.json()["csrf_token"]


def test_login_accepts_integrated_operator_ui_origin(monkeypatch):
    configure_auth(monkeypatch)
    monkeypatch.setattr(
        get_settings(),
        "allowed_origins",
        Settings(_env_file=None).allowed_origins,
    )
    with TestClient(app) as client:
        response = login(client, "http://localhost:8080")

    assert response.status_code == 200


def test_https_login_and_logout_set_secure_session_cookie(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app, base_url=HTTPS_ORIGIN) as client:
        response = login(client, HTTPS_ORIGIN)
        assert response.status_code == 200
        assert "secure" in response.headers["set-cookie"].lower()

        client.headers.update(
            {
                "Origin": HTTPS_ORIGIN,
                "X-CSRF-Token": response.json()["csrf_token"],
            }
        )
        logout = client.post("/api/v1/auth/logout")

    assert logout.status_code == 200
    assert "secure" in logout.headers["set-cookie"].lower()


def test_invalid_password_and_untrusted_login_origin_are_rejected(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        invalid_password = client.post(
            "/api/v1/auth/login",
            json={"password": "wrong"},
            headers={"Origin": SAME_ORIGIN},
        )
        invalid_origin = client.post(
            "/api/v1/auth/login",
            json={"password": TEST_PASSWORD},
            headers={"Origin": "https://attacker.invalid"},
        )

    assert invalid_password.status_code == 401
    assert invalid_origin.status_code == 403


def test_request_host_does_not_implicitly_allow_its_origin(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app, base_url="http://attacker.invalid") as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"password": TEST_PASSWORD},
            headers={"Origin": "http://attacker.invalid"},
        )

    assert response.status_code == 403


def test_login_limits_repeated_password_failures(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"password": "wrong"},
                headers={"Origin": SAME_ORIGIN},
            )
            assert response.status_code == 401
        limited = client.post(
            "/api/v1/auth/login",
            json={"password": "wrong"},
            headers={"Origin": SAME_ORIGIN},
        )

    assert limited.status_code == 429
    assert "Retry-After" in limited.headers


def test_protected_endpoints_require_session_and_csrf(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        unauthenticated = client.get("/api/v1/operator/settings")
        login_response = login(client)
        client.headers.update({"Origin": SAME_ORIGIN})
        missing_csrf = client.post("/api/v1/session/start")
        csrf_token = login_response.json()["csrf_token"]
        invalid_origin = client.post(
            "/api/v1/session/start",
            headers={"Origin": "https://attacker.invalid", "X-CSRF-Token": csrf_token},
        )
        valid_session = client.get("/api/v1/operator/settings")

    assert unauthenticated.status_code == 401
    assert missing_csrf.status_code == 403
    assert invalid_origin.status_code == 403
    assert valid_session.status_code == 200


def test_every_operator_and_audio_endpoint_requires_authentication(monkeypatch):
    configure_auth(monkeypatch)
    protected_requests = [
        ("GET", "/api/v1/operator/settings", None),
        ("PUT", "/api/v1/operator/settings", {"interpreter": "echo"}),
        ("GET", "/api/v1/session", None),
        ("POST", "/api/v1/session/start", None),
        ("POST", "/api/v1/session/stop", None),
        ("POST", "/api/v1/session/extend", None),
        ("GET", "/api/v1/audio/devices", None),
        ("POST", "/api/v1/audio/test", None),
        ("POST", "/api/v1/audio/test/stream", None),
    ]
    with TestClient(app) as client:
        responses = [
            client.request(method, path, json=body)
            for method, path, body in protected_requests
        ]

    assert [response.status_code for response in responses] == [401] * len(
        protected_requests
    )


def test_logout_clears_cookie_and_invalidates_session(monkeypatch):
    configure_auth(monkeypatch)
    with TestClient(app) as client:
        login_response = login(client)
        client.headers.update(
            {
                "Origin": SAME_ORIGIN,
                "X-CSRF-Token": login_response.json()["csrf_token"],
            }
        )
        logout_response = client.post("/api/v1/auth/logout")
        session_response = client.get("/api/v1/auth/session")

    assert logout_response.status_code == 200
    assert 'operator_session=""' in logout_response.headers["set-cookie"]
    assert session_response.json() == {"authenticated": False}


def test_missing_secrets_fail_closed_but_health_is_public(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "operator_password", None)
    monkeypatch.setattr(settings, "operator_session_secret", None)
    monkeypatch.setattr(
        settings, "allowed_origins", [*settings.allowed_origins, SAME_ORIGIN]
    )
    with TestClient(app) as client:
        protected = client.get("/api/v1/operator/settings")
        login_response = login(client)
        health = client.get("/health")

    assert protected.status_code == 503
    assert login_response.status_code == 503
    assert health.status_code == 200


def test_local_listener_websocket_is_not_registered():
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/listen"):
                pass