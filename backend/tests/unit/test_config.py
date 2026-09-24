import pytest
from pydantic import ValidationError

from core.config import Settings


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
    assert settings.translation_target_sample_rate == 24000
    assert settings.translation_target_channels == 1
    assert settings.translation_target_sample_width == 2
