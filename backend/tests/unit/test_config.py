from pathlib import Path

import pytest
from pydantic import ValidationError

from core.config import Settings


def test_env_example_lists_all_supported_settings():
    import re

    env_file = Path(__file__).resolve().parents[2] / ".env.example"
    env_text = env_file.read_text(encoding="utf-8")
    expected_names = {f"APP_{name.upper()}" for name in Settings.model_fields}
    found_names = {
        match.group("name")
        for match in re.finditer(r"^(?:#\s*)?(?P<name>APP_[A-Z0-9_]+)=.*$", env_text, flags=re.MULTILINE)
    }

    assert expected_names.issubset(found_names)


def test_allowed_origins_accepts_comma_separated_env(monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "APP_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    settings = Settings(_env_file=env_file)
    assert settings.allowed_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_interpreter_rejects_unsupported_literal():
    with pytest.raises(ValidationError):
        Settings(interpreter="unsupported")


def test_translation_defaults_match_openai_target_format():
    settings = Settings()

    assert settings.openai_model == "gpt-realtime-translate"
    assert settings.translation_target_language == "de"
    assert "input_transcript_enabled" not in settings.model_dump()


def test_translation_timer_defaults():
    settings = Settings()

    assert settings.translation_session_auto_stop_minutes == 90
    assert settings.translation_session_warning_minutes == 5
    assert settings.translation_session_extension_minutes == 10
    assert settings.translation_session_hard_limit_minutes == 120


def test_translation_audio_queue_defaults_and_rejects_non_positive_limits():
    settings = Settings()

    assert settings.translation_queue_max_seconds == 2.0
    assert settings.translation_drain_timeout_seconds == 2.0
    with pytest.raises(ValidationError):
        Settings(translation_queue_max_seconds=0)
    with pytest.raises(ValidationError):
        Settings(translation_drain_timeout_seconds=0)


def test_operator_auth_secrets_have_no_development_defaults():
    settings = Settings(_env_file=None)

    assert settings.operator_password is None
    assert settings.operator_session_secret is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"translation_session_auto_stop_minutes": 0},
        {"translation_session_warning_minutes": 0},
        {"translation_session_warning_minutes": 90},
        {"translation_session_extension_minutes": 0},
        {"translation_session_hard_limit_minutes": 89},
    ],
)
def test_translation_timer_rejects_invalid_ranges(overrides):
    with pytest.raises(ValidationError):
        Settings(**overrides)
