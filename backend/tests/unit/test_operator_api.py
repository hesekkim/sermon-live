from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from services.operator_store import store


def test_session_is_idle_until_started():
    with TestClient(app) as client:
        response = client.get("/api/v1/session")
    assert response.status_code == 200
    assert response.json()["running"] is False


def test_operator_settings_roundtrip(tmp_path):
    store._path = tmp_path / "operator.json"
    with TestClient(app) as client:
        empty = client.get("/api/v1/operator/settings")
        assert empty.status_code == 200
        saved = client.put(
            "/api/v1/operator/settings",
            json={
                "interpreter": "openai",
                "openai_api_key": "unit-test-key",
                "audio_device": "USB Audio",
            },
        )
        assert saved.status_code == 200
        body = saved.json()
        assert body["interpreter"] == "openai"
        assert body["audio_device"] == "USB Audio"
        assert body["openai_key_set"] is True
        assert body["openai_key_masked"] == "unit...-key"
        assert "unit-test-key" not in str(body)


def test_operator_settings_storage_error_returns_generic_http_500():
    with TestClient(app) as client:
        with patch.object(store, "save", side_effect=OSError("disk full")):
            response = client.put(
                "/api/v1/operator/settings",
                json={"interpreter": "openai", "openai_api_key": "unit-test-key"},
            )
    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to save operator settings"}
