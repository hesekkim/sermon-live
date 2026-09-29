import pytest

from core.config import Settings
from services.operator_store import OperatorSettingsStore


def test_save_and_public_view_masks_keys(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="secret-key")
    view = store.public_view(Settings(interpreter="echo", openai_api_key=""))

    assert view["interpreter"] == "openai"
    assert view["openai_key_set"] is True
    assert view["openai_key_masked"] == "secr...-key"
    raw = (tmp_path / "operator.json").read_text(encoding="utf-8")
    assert "secret-key" in raw
    assert "secret-key" not in str(view)


def test_empty_key_keeps_previous(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="keep-me")
    store.save(interpreter="openai", openai_api_key="")
    record = store.load()
    assert record.openai_api_key == "keep-me"


def test_overlay_uses_json_over_env(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="from-json", audio_device="USB-1")
    overlay = store.overlay_settings(
        Settings(interpreter="echo", openai_api_key="from-env", audio_device="Built-in")
    )
    assert overlay.interpreter == "openai"
    assert overlay.openai_api_key == "from-json"
    assert overlay.audio_device == "USB-1"


def test_input_transcript_defaults_off_and_persists_operator_override(tmp_path):
    settings = Settings(input_transcript_enabled=True)
    store = OperatorSettingsStore(tmp_path / "operator.json")

    assert store.public_view(Settings())["input_transcript_enabled"] is False

    store.save(interpreter="openai", input_transcript_enabled=True)
    assert store.public_view(Settings())["input_transcript_enabled"] is True
    assert store.overlay_settings(Settings()).input_transcript_enabled is True

    store.save(interpreter="openai", input_transcript_enabled=False)
    assert store.public_view(settings)["input_transcript_enabled"] is False
    assert store.overlay_settings(settings).input_transcript_enabled is False


def test_input_transcript_uses_environment_default_when_store_has_no_override(
    tmp_path,
):
    store = OperatorSettingsStore(tmp_path / "operator.json")

    assert store.public_view(Settings(input_transcript_enabled=True))[
        "input_transcript_enabled"
    ] is True
    assert store.overlay_settings(
        Settings(input_transcript_enabled=True)
    ).input_transcript_enabled is True


def test_public_view_includes_openai_environment_key(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    view = store.public_view(
        Settings(interpreter="openai", openai_api_key="from-env")
    )

    assert view["openai_key_set"] is True
    assert view["openai_key_masked"] == "fr...nv"


def test_public_view_reports_key_status_for_saved_values(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="secret-key")
    view = store.public_view(Settings(interpreter="openai", openai_api_key=""))

    assert view["openai_key_status"] == "missing"
    assert view["openai_key_warning"] == "OpenAI API key is not set"


def test_set_key_status_persists_public_status_without_exposing_key(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="secret-key")
    store.set_key_status("openai", "invalid", "OpenAI API key is invalid")

    view = store.public_view(Settings(interpreter="openai", openai_api_key=""))

    assert view["openai_key_status"] == "invalid"
    assert view["openai_key_warning"] == "OpenAI API key is invalid"
    assert "secret-key" not in str(view)


def test_public_view_reports_missing_when_key_is_empty(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    view = store.public_view(Settings(interpreter="openai", openai_api_key=""))

    assert view["openai_key_status"] == "missing"
    assert view["openai_key_warning"] == "OpenAI API key is not set"


def test_timer_settings_persist_and_overlay(tmp_path):
    settings = Settings(interpreter="echo")
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(
        interpreter="echo",
        settings=settings,
        translation_session_auto_stop_minutes=60,
        translation_session_warning_minutes=4,
        translation_session_extension_minutes=15,
        translation_session_hard_limit_minutes=90,
    )

    view = store.public_view(settings)
    overlay = store.overlay_settings(settings)

    assert view["translation_session_auto_stop_minutes"] == 60
    assert view["translation_session_warning_minutes"] == 4
    assert view["translation_session_extension_minutes"] == 15
    assert view["translation_session_hard_limit_minutes"] == 90
    assert overlay.translation_session_auto_stop_minutes == 60
    assert overlay.translation_session_warning_minutes == 4
    assert overlay.translation_session_extension_minutes == 15
    assert overlay.translation_session_hard_limit_minutes == 90


def test_timer_settings_reject_invalid_ranges(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")

    with pytest.raises(ValueError):
        store.save(
            interpreter="echo",
            translation_session_warning_minutes=90,
        )
