from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from core.config import InterpreterName, Settings

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
STORE_PATH = DATA_DIR / "operator.json"


@dataclass(slots=True)
class OperatorRecord:
    interpreter: InterpreterName | None = None
    openai_api_key: str = ""
    audio_device: str = ""
    audio_channel: int | None = None
    input_transcript_enabled: bool | None = None
    translation_session_auto_stop_minutes: int | None = None
    translation_session_warning_minutes: int | None = None
    translation_session_extension_minutes: int | None = None
    translation_session_hard_limit_minutes: int | None = None


class OperatorSettingsStore:
    def __init__(self, path: Path = STORE_PATH) -> None:
        self._path = path

    def load(self) -> OperatorRecord:
        if not self._path.is_file():
            return OperatorRecord()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return OperatorRecord()
        if not isinstance(raw, dict):
            return OperatorRecord()
        interpreter = raw.get("interpreter")
        name: InterpreterName | None = None
        if interpreter in ("echo", "openai"):
            name = interpreter
        return OperatorRecord(
            interpreter=name,
            openai_api_key=_as_str(raw.get("openai_api_key")),
            audio_device=_as_str(raw.get("audio_device")),
            audio_channel=_as_optional_int(raw.get("audio_channel")),
            input_transcript_enabled=_as_optional_bool(
                raw.get("input_transcript_enabled")
            ),
            translation_session_auto_stop_minutes=_as_optional_int(
                raw.get("translation_session_auto_stop_minutes")
            ),
            translation_session_warning_minutes=_as_optional_int(
                raw.get("translation_session_warning_minutes")
            ),
            translation_session_extension_minutes=_as_optional_int(
                raw.get("translation_session_extension_minutes")
            ),
            translation_session_hard_limit_minutes=_as_optional_int(
                raw.get("translation_session_hard_limit_minutes")
            ),
        )

    def save(
        self,
        *,
        interpreter: InterpreterName,
        openai_api_key: str | None = None,
        audio_device: str | None = None,
        audio_channel: int | None = None,
        input_transcript_enabled: bool | None = None,
        settings: Settings | None = None,
        translation_session_auto_stop_minutes: int | None = None,
        translation_session_warning_minutes: int | None = None,
        translation_session_extension_minutes: int | None = None,
        translation_session_hard_limit_minutes: int | None = None,
    ) -> OperatorRecord:
        current = self.load()
        openai = current.openai_api_key
        if openai_api_key is not None and openai_api_key != "":
            openai = openai_api_key
        device = current.audio_device
        if audio_device is not None and audio_device != "":
            device = audio_device
        timer_updates = {
            "translation_session_auto_stop_minutes": (
                translation_session_auto_stop_minutes
                if translation_session_auto_stop_minutes is not None
                else current.translation_session_auto_stop_minutes
            ),
            "translation_session_warning_minutes": (
                translation_session_warning_minutes
                if translation_session_warning_minutes is not None
                else current.translation_session_warning_minutes
            ),
            "translation_session_extension_minutes": (
                translation_session_extension_minutes
                if translation_session_extension_minutes is not None
                else current.translation_session_extension_minutes
            ),
            "translation_session_hard_limit_minutes": (
                translation_session_hard_limit_minutes
                if translation_session_hard_limit_minutes is not None
                else current.translation_session_hard_limit_minutes
            ),
        }
        base_settings = settings or Settings()
        effective_timer_settings = {
            field: value for field, value in timer_updates.items() if value is not None
        }
        Settings.model_validate(
            {
                **base_settings.model_dump(),
                **effective_timer_settings,
                **(
                    {"audio_channel": audio_channel}
                    if audio_channel is not None
                    else {}
                ),
            }
        )
        record = OperatorRecord(
            interpreter=interpreter,
            openai_api_key=openai,
            audio_device=device,
            audio_channel=(
                audio_channel if audio_channel is not None else current.audio_channel
            ),
            input_transcript_enabled=(
                input_transcript_enabled
                if input_transcript_enabled is not None
                else current.input_transcript_enabled
            ),
            **timer_updates,
        )
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "interpreter": record.interpreter,
            "openai_api_key": record.openai_api_key,
            "audio_device": record.audio_device,
            "audio_channel": record.audio_channel,
            "input_transcript_enabled": record.input_transcript_enabled,
            "translation_session_auto_stop_minutes": (
                record.translation_session_auto_stop_minutes
            ),
            "translation_session_warning_minutes": (
                record.translation_session_warning_minutes
            ),
            "translation_session_extension_minutes": (
                record.translation_session_extension_minutes
            ),
            "translation_session_hard_limit_minutes": (
                record.translation_session_hard_limit_minutes
            ),
        }
        self._path.write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )
        return record

    def public_view(self, settings: Settings) -> dict[str, Any]:
        record = self.load()
        interpreter = record.interpreter or settings.interpreter
        audio_device = record.audio_device or settings.audio_device
        audio_channel = record.audio_channel or settings.audio_channel
        openai_key = record.openai_api_key or settings.openai_api_key
        openai_raw = self._read_status_overrides().get("openai")
        openai_status = _normalize_key_status(openai_raw[0] if openai_raw else None, bool(openai_key))
        return {
            "interpreter": interpreter,
            "audio_device": audio_device,
            "audio_channel": audio_channel,
            "input_transcript_enabled": (
                record.input_transcript_enabled
                if record.input_transcript_enabled is not None
                else settings.input_transcript_enabled
            ),
            "translation_session_auto_stop_minutes": (
                record.translation_session_auto_stop_minutes
                or settings.translation_session_auto_stop_minutes
            ),
            "translation_session_warning_minutes": (
                record.translation_session_warning_minutes
                or settings.translation_session_warning_minutes
            ),
            "translation_session_extension_minutes": (
                record.translation_session_extension_minutes
                or settings.translation_session_extension_minutes
            ),
            "translation_session_hard_limit_minutes": (
                record.translation_session_hard_limit_minutes
                or settings.translation_session_hard_limit_minutes
            ),
            "openai_key_set": bool(openai_key),
            "openai_key_masked": _mask_key(openai_key),
            "openai_key_status": openai_status,
            "openai_key_warning": openai_raw[1] if openai_raw else _warning_for_key("openai", openai_status),
        }

    def set_key_status(
        self,
        provider: str,
        status: str,
        warning: str | None = None,
    ) -> None:
        if provider not in {"openai"}:
            return
        if status not in {"valid", "missing", "invalid"}:
            raise ValueError(f"Unsupported key status: {status}")
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = {}
        if not isinstance(raw, dict):
            raw = {}
        raw[f"{provider}_key_status"] = status
        raw[f"{provider}_key_warning"] = warning
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(raw, indent=2) + "\n", encoding="utf-8")

    def _read_status_overrides(self) -> dict[str, tuple[str | None, str | None]]:
        if not self._path.is_file():
            return {}
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        if not isinstance(raw, dict):
            return {}
        result: dict[str, tuple[str | None, str | None]] = {}
        for name in ("openai",):
            status = raw.get(f"{name}_key_status")
            warning = raw.get(f"{name}_key_warning")
            if isinstance(status, str) and status in {"valid", "missing", "invalid"}:
                result[name] = (status, warning if isinstance(warning, str) else None)
        return result

    def overlay_settings(self, settings: Settings) -> Settings:
        record = self.load()
        updates: dict[str, Any] = {}
        if record.interpreter:
            updates["interpreter"] = record.interpreter
        if record.openai_api_key:
            updates["openai_api_key"] = record.openai_api_key
        if record.audio_device:
            updates["audio_device"] = record.audio_device
        if record.audio_channel is not None:
            updates["audio_channel"] = record.audio_channel
        if record.input_transcript_enabled is not None:
            updates["input_transcript_enabled"] = record.input_transcript_enabled
        for field in (
            "translation_session_auto_stop_minutes",
            "translation_session_warning_minutes",
            "translation_session_extension_minutes",
            "translation_session_hard_limit_minutes",
        ):
            value = getattr(record, field)
            if value is not None:
                updates[field] = value
        if not updates:
            return settings
        return Settings.model_validate({**settings.model_dump(), **updates})


def _as_str(value: object) -> str:
    if isinstance(value, str):
        return value
    return ""


def _as_optional_int(value: object) -> int | None:
    if isinstance(value, int) and not isinstance(value, bool) and value > 0:
        return value
    return None


def _as_optional_bool(value: object) -> bool | None:
    return value if isinstance(value, bool) else None


def _mask_key(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return f"{value[:2]}...{value[-2:]}"
    return f"{value[:4]}...{value[-4:]}"


def _normalize_key_status(status: str | None, has_value: bool) -> str:
    if status in {"valid", "missing", "invalid"}:
        return status
    return "missing"


def _warning_for_key(provider: str, status: str) -> str | None:
    label = "OpenAI" if provider == "openai" else provider.title()
    if status == "missing":
        return f"{label} API key is not set"
    if status == "invalid":
        return f"{label} API key is invalid"
    return None


store = OperatorSettingsStore()
