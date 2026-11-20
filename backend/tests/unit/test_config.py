from pathlib import Path

import pytest
from pydantic import ValidationError

from core.config import Settings


def test_env_example_documents_server_settings_not_operator_preferences():
    env_file = Path(__file__).resolve().parents[2] / ".env.example"
    env_names = {
        line.partition("=")[0]
        for line in env_file.read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#") and "=" in line
    }

    assert {
        "APP_HOST",
        "APP_PORT",
        "APP_DEBUG",
        "APP_SSL_CERTFILE",
        "APP_SSL_KEYFILE",
        "APP_ALLOWED_ORIGINS",
        "APP_OPERATOR_PASSWORD",
        "APP_OPERATOR_SESSION_SECRET",
        "APP_RELAY_PUBLISHER_CREDENTIAL",
        "APP_RELAY_URL",
    }.issubset(env_names)
    assert not {
        "APP_INTERPRETER",
        "APP_OPENAI_API_KEY",
        "APP_AUDIO_DEVICE",
        "APP_AUDIO_CHANNEL",
        "APP_TRANSLATION_SESSION_AUTO_STOP_MINUTES",
        "APP_TRANSLATION_SESSION_WARNING_MINUTES",
        "APP_TRANSLATION_SESSION_EXTENSION_MINUTES",
        "APP_TRANSLATION_SESSION_HARD_LIMIT_MINUTES",
    }.intersection(env_names)


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


def test_default_allowed_origins_include_integrated_operator_ui():
    settings = Settings(_env_file=None)

    assert "http://localhost:8080" in settings.allowed_origins
    assert "http://127.0.0.1:8080" in settings.allowed_origins


def test_process_environment_overrides_env_file(monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("APP_PORT=8081\n", encoding="utf-8")
    monkeypatch.setenv("APP_PORT", "8082")

    settings = Settings(_env_file=env_file)

    assert settings.port == 8082


def test_interpreter_rejects_unsupported_literal():
    with pytest.raises(ValidationError):
        Settings(interpreter="unsupported")


def test_translation_defaults_match_openai_target_format():
    settings = Settings()

    assert settings.openai_model == "gpt-realtime-translate"
    assert "translation_target_language" not in settings.model_dump()
    assert "input_transcript_enabled" not in settings.model_dump()


def test_legacy_translation_target_language_env_is_ignored(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "APP_TRANSLATION_TARGET_LANGUAGE=en\n",
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert "translation_target_language" not in settings.model_dump()


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


def test_relay_publisher_credential_is_optional_and_secret(tmp_path):
    settings = Settings(_env_file=None)
    assert settings.relay_publisher_credential is None
    assert settings.relay_url == ""

    env_file = tmp_path / ".env"
    env_file.write_text(
        "APP_RELAY_PUBLISHER_CREDENTIAL=generated-publisher-secret-at-least-32-chars\n"
        "APP_RELAY_URL=https://relay.example.com/api/v1/relay\n",
        encoding="utf-8",
    )
    settings = Settings(_env_file=env_file)

    assert settings.relay_publisher_credential is not None
    assert (
        settings.relay_publisher_credential.get_secret_value()
        == "generated-publisher-secret-at-least-32-chars"
    )
    assert settings.relay_url == "https://relay.example.com/api/v1/relay"
    assert "generated-publisher-secret" not in repr(
        settings.relay_publisher_credential
    )


def test_ssl_certificate_and_key_must_be_configured_together(tmp_path):
    with pytest.raises(ValidationError):
        Settings(ssl_certfile=tmp_path / "cert.pem")

    settings = Settings(
        _env_file=None,
        ssl_certfile=tmp_path / "cert.pem",
        ssl_keyfile=tmp_path / "key.pem",
    )
    assert settings.ssl_certfile == tmp_path / "cert.pem"
    assert settings.ssl_keyfile == tmp_path / "key.pem"

    env_file = tmp_path / "empty-tls.env"
    env_file.write_text(
        "APP_SSL_CERTFILE=\nAPP_SSL_KEYFILE=\n",
        encoding="utf-8",
    )
    settings = Settings(_env_file=env_file)
    assert settings.ssl_certfile is None
    assert settings.ssl_keyfile is None


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
