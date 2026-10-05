from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import field_validator, model_validator
from pydantic import SecretStr
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

InterpreterName = Literal["echo", "openai"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        env_prefix="APP_",
        extra="ignore",
    )

    app_name: str = "sermon-live"
    debug: bool = False
    port: int = 8080
    host: str = "0.0.0.0"
    allowed_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    interpreter: InterpreterName = "echo"
    openai_api_key: str = ""
    operator_password: SecretStr | None = None
    operator_session_secret: SecretStr | None = None
    # Verify the model name against the official API when the OpenAI adapter is implemented.
    openai_model: str = "gpt-realtime-translate"
    translation_target_language: str = "de"
    translation_source_transcription_model: str = "gpt-realtime-whisper"
    input_transcript_enabled: bool = False
    translation_session_auto_stop_minutes: int = 90
    translation_session_warning_minutes: int = 5
    translation_session_extension_minutes: int = 10
    translation_session_hard_limit_minutes: int = 120
    translation_queue_max_seconds: float = 2.0
    translation_drain_timeout_seconds: float = 2.0
    audio_device: str = ""
    audio_channel: int = 1
    audio_chunk_frames: int = 1024
    input_sample_rate: int | None = 16000
    frontend_dist: str = ""

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        if isinstance(value, list):
            return value
        return ["http://localhost:5173"]

    @field_validator("input_sample_rate", mode="before")
    @classmethod
    def parse_input_sample_rate(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("audio_channel")
    @classmethod
    def validate_audio_channel(cls, value: int) -> int:
        if value < 1:
            raise ValueError("audio_channel must be greater than 0")
        return value

    @model_validator(mode="after")
    def validate_translation_timer_settings(self) -> "Settings":
        if self.translation_session_auto_stop_minutes <= 0:
            raise ValueError("translation_session_auto_stop_minutes must be greater than 0")
        if self.translation_session_warning_minutes <= 0:
            raise ValueError("translation_session_warning_minutes must be greater than 0")
        if self.translation_session_warning_minutes >= self.translation_session_auto_stop_minutes:
            raise ValueError(
                "translation_session_warning_minutes must be less than translation_session_auto_stop_minutes"
            )
        if self.translation_session_extension_minutes <= 0:
            raise ValueError("translation_session_extension_minutes must be greater than 0")
        if self.translation_session_hard_limit_minutes < self.translation_session_auto_stop_minutes:
            raise ValueError(
                "translation_session_hard_limit_minutes must be greater than or equal to translation_session_auto_stop_minutes"
            )
        if self.translation_queue_max_seconds <= 0:
            raise ValueError("translation_queue_max_seconds must be greater than 0")
        if self.translation_drain_timeout_seconds <= 0:
            raise ValueError("translation_drain_timeout_seconds must be greater than 0")
        return self

    @property
    def frontend_dist_path(self) -> Path:
        if self.frontend_dist:
            return Path(self.frontend_dist)
        return Path(__file__).resolve().parents[2] / "frontend" / "dist"


@lru_cache
def get_settings() -> Settings:
    return Settings()
