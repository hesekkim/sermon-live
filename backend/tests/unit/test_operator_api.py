from unittest.mock import patch

import pytest
from fastapi.routing import APIRoute

from api.v1.endpoints import operator as operator_endpoint
from main import app
from services.operator_store import store


def test_session_is_idle_until_started(operator_client):
    response = operator_client.get("/api/v1/session")
    assert response.status_code == 200
    assert response.json()["running"] is False
    assert "sermon_session_id" not in response.json()


def test_operator_network_returns_detected_lan_address(operator_client, monkeypatch):
    from services import network

    monkeypatch.setattr(network, "detect_lan_ip", lambda: "192.168.1.12")

    response = operator_client.get("/api/v1/operator/network")

    assert response.status_code == 200
    assert response.json() == {"lan_ip": "192.168.1.12"}


def test_operator_network_reports_unavailable_address(operator_client, monkeypatch):
    from services import network

    monkeypatch.setattr(network, "detect_lan_ip", lambda: None)

    response = operator_client.get("/api/v1/operator/network")

    assert response.status_code == 200
    assert response.json() == {"lan_ip": None}


def test_sermon_session_routes_are_not_registered(operator_client):
    registered_routes = {
        (route.path, method)
        for route in app.routes
        if isinstance(route, APIRoute)
        for method in route.methods or ()
    }
    assert ("/api/v1/sermon-session", "GET") not in registered_routes
    assert ("/api/v1/sermon-session", "PUT") not in registered_routes


def test_operator_settings_roundtrip(operator_client, monkeypatch, tmp_path):
    async def skip_key_validation(*_args):
        return None

    async def skip_audio_restart():
        return None

    monkeypatch.setattr(
        operator_endpoint, "validate_operator_key", skip_key_validation
    )
    monkeypatch.setattr(
        operator_endpoint.AudioCapture, "validate_input_channel", lambda _settings: None
    )
    monkeypatch.setattr(store, "_path", tmp_path / "operator.json")
    monkeypatch.setattr(operator_endpoint.audio, "restart", skip_audio_restart)
    store.save(interpreter="echo", audio_device="USB Audio", audio_channel=1)
    empty = operator_client.get("/api/v1/operator/settings")
    assert empty.status_code == 200
    assert empty.json()["input_transcript_enabled"] is False
    saved = operator_client.put(
        "/api/v1/operator/settings",
        json={
            "interpreter": "openai",
            "openai_api_key": "unit-test-key",
            "audio_device": "USB Audio",
            "audio_channel": 2,
            "input_transcript_enabled": False,
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
    assert body["audio_channel"] == 2
    assert body["input_transcript_enabled"] is False
    assert body["translation_session_auto_stop_minutes"] == 60
    assert body["translation_session_warning_minutes"] == 4
    assert body["translation_session_extension_minutes"] == 15
    assert body["translation_session_hard_limit_minutes"] == 90
    assert body["openai_key_set"] is True
    assert body["openai_key_masked"] == "unit...-key"
    assert "unit-test-key" not in str(body)


def test_changing_audio_device_without_channel_resets_channel_to_one(
    operator_client, monkeypatch, tmp_path
):
    async def skip_key_validation(*_args):
        return None

    async def skip_audio_restart():
        return None

    monkeypatch.setattr(
        operator_endpoint, "validate_operator_key", skip_key_validation
    )
    monkeypatch.setattr(
        operator_endpoint.AudioCapture, "validate_input_channel", lambda _settings: None
    )
    monkeypatch.setattr(store, "_path", tmp_path / "operator.json")
    monkeypatch.setattr(operator_endpoint.audio, "restart", skip_audio_restart)
    store.save(interpreter="echo", audio_device="Old USB Mixer", audio_channel=3)

    response = operator_client.put(
        "/api/v1/operator/settings",
        json={"interpreter": "echo", "audio_device": "Microphone (X-USB)"},
    )

    assert response.status_code == 200
    assert response.json()["audio_device"] == "Microphone (X-USB)"
    assert response.json()["audio_channel"] == 1
    assert store.load().audio_channel == 1


def test_operator_settings_rejects_enabling_input_transcript(operator_client):
    response = operator_client.put(
        "/api/v1/operator/settings",
        json={"interpreter": "openai", "input_transcript_enabled": True},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Korean source transcripts are disabled"
    }


def test_unavailable_audio_channel_is_rejected_before_saving(
    operator_client, monkeypatch, tmp_path
):
    monkeypatch.setattr(store, "_path", tmp_path / "operator.json")
    store.save(interpreter="echo", audio_device="USB Mixer", audio_channel=1)

    def reject_channel(_settings):
        raise RuntimeError("Selected audio channel 3 is unavailable on this device")

    async def unexpected_restart():
        pytest.fail("Audio runtime must not restart for an invalid channel")

    monkeypatch.setattr(
        operator_endpoint.AudioCapture, "validate_input_channel", reject_channel
    )
    monkeypatch.setattr(operator_endpoint.audio, "restart", unexpected_restart)

    response = operator_client.put(
        "/api/v1/operator/settings",
        json={
            "interpreter": "echo",
            "audio_device": "USB Mixer",
            "audio_channel": 3,
        },
    )

    assert response.status_code == 422
    assert "Selected audio channel 3 is unavailable" in response.json()["detail"]
    assert store.load().audio_channel == 1


def test_audio_restart_failure_is_returned_as_service_unavailable(
    operator_client, monkeypatch, tmp_path
):
    monkeypatch.setattr(store, "_path", tmp_path / "operator.json")
    store.save(interpreter="echo", audio_device="USB Mixer", audio_channel=1)
    monkeypatch.setattr(
        operator_endpoint.AudioCapture, "validate_input_channel", lambda _settings: None
    )

    async def fail_restart():
        raise RuntimeError("audio stream could not be opened")

    monkeypatch.setattr(operator_endpoint.audio, "restart", fail_restart)

    response = operator_client.put(
        "/api/v1/operator/settings",
        json={
            "interpreter": "echo",
            "audio_device": "USB Mixer",
            "audio_channel": 2,
        },
    )

    assert response.status_code == 503
    assert "input could not be started" in response.json()["detail"]


def test_session_start_error_response_redacts_api_key(operator_client, monkeypatch):
    from services.runtime import session

    api_key = "test-secret-value"

    async def fail_start():
        raise RuntimeError(f"Upstream error for {api_key}")

    monkeypatch.setattr(session, "start", fail_start)
    monkeypatch.setattr(
        session,
        "safe_error_message",
        lambda message: message.replace(api_key, "[REDACTED]"),
    )

    response = operator_client.post("/api/v1/session/start")

    assert response.status_code == 400
    assert api_key not in response.text
    assert "[REDACTED]" in response.text


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


def test_operator_settings_cannot_change_safety_or_interpreter_during_session(
    operator_client, monkeypatch, tmp_path
):
    from core.config import get_settings
    from services.runtime import session

    monkeypatch.setattr(store, "_path", tmp_path / "operator.json")
    initial = operator_client.put(
        "/api/v1/operator/settings",
        json={
            "interpreter": "echo",
            "translation_session_auto_stop_minutes": 90,
            "translation_session_warning_minutes": 5,
            "translation_session_extension_minutes": 10,
            "translation_session_hard_limit_minutes": 120,
        },
    )
    assert initial.status_code == 200
    monkeypatch.setattr(session, "_state", "live")

    timer_response = operator_client.put(
        "/api/v1/operator/settings",
        json={
            "interpreter": "echo",
            "translation_session_auto_stop_minutes": 45,
        },
    )
    interpreter_response = operator_client.put(
        "/api/v1/operator/settings",
        json={"interpreter": "openai"},
    )
    key_response = operator_client.put(
        "/api/v1/operator/settings",
        json={"interpreter": "echo", "openai_api_key": "replacement-key"},
    )
    transcript_response = operator_client.put(
        "/api/v1/operator/settings",
        json={"interpreter": "echo", "input_transcript_enabled": True},
    )
    channel_response = operator_client.put(
        "/api/v1/operator/settings",
        json={"interpreter": "echo", "audio_channel": 2},
    )

    assert timer_response.status_code == 409
    assert interpreter_response.status_code == 409
    assert key_response.status_code == 409
    assert transcript_response.status_code == 422
    assert channel_response.status_code == 409
    current = store.public_view(get_settings())
    assert current["translation_session_auto_stop_minutes"] == 90
    assert current["input_transcript_enabled"] is False
    assert current["interpreter"] == "echo"
    assert current["audio_channel"] == 1


def test_operator_settings_storage_error_returns_generic_http_500(operator_client):
    with patch.object(store, "save", side_effect=OSError("disk full")):
        response = operator_client.put(
            "/api/v1/operator/settings",
            json={"interpreter": "openai", "openai_api_key": "unit-test-key"},
        )
    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to save operator settings"}
