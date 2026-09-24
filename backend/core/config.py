from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import field_validator
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
    audio_device: str = ""
    audio_chunk_frames: int = 1024
    input_sample_rate: int = 16000
    output_sample_rate: int = 24000
    frontend_dist: str = ""

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        if isinstance(value, list):
            return value
        return ["http://localhost:5173"]

    @property
    def frontend_dist_path(self) -> Path:
        if self.frontend_dist:
            return Path(self.frontend_dist)
        return Path(__file__).resolve().parents[2] / "frontend" / "dist"


@lru_cache
def get_settings() -> Settings:
    return Settings()
