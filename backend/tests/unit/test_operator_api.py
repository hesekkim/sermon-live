from unittest.mock import patch

from main import app
from services.operator_store import store


def test_session_is_idle_until_started(operator_client):
    response = operator_client.get("/api/v1/session")
    assert response.status_code == 200
    assert response.json()["running"] is False


def test_operator_settings_roundtrip(operator_client, tmp_path):
    store._path = tmp_path / "operator.json"
    empty = operator_client.get("/api/v1/operator/settings")
    assert empty.status_code == 200
    saved = operator_client.put(
        "/api/v1/operator/settings",
        json={
            "interpreter": "openai",
            "openai_api_key": "unit-test-key",
            "audio_device": "USB Audio",
            "translation_session_auto_stop_minutes": 60,
            "translation_session_warning_minutes": 4,
            "translation_session_extension_minutes": 15,
            "translation_session_hard_limit_minutes": 90,
        },
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["interpreter"] == "openai"
    assert body["audio_device"] == "USB Audio"
    assert body["translation_session_auto_stop_minutes"] == 60
    assert body["translation_session_warning_minutes"] == 4
    assert body["translation_session_extension_minutes"] == 15
    assert body["translation_session_hard_limit_minutes"] == 90
    assert body["openai_key_set"] is True
    assert body["openai_key_masked"] == "unit...-key"
    assert "unit-test-key" not in str(body)


def test_operator_settings_reject_invalid_timer_ranges(operator_client, tmp_path):
    store._path = tmp_path / "operator.json"
    response = operator_client.put(
        "/api/v1/operator/settings",
        json={
            "interpreter": "echo",
            "translation_session_auto_stop_minutes": 10,
            "translation_session_warning_minutes": 10,
        },
    )

    assert response.status_code == 422


def test_operator_settings_storage_error_returns_generic_http_500(operator_client):
    with patch.object(store, "save", side_effect=OSError("disk full")):
        response = operator_client.put(
            "/api/v1/operator/settings",
            json={"interpreter": "openai", "openai_api_key": "unit-test-key"},
        )
    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to save operator settings"}
