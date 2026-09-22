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
    gemini_api_key: str = ""
    openai_api_key: str = ""


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
        if interpreter in ("echo", "gemini", "openai"):
            name = interpreter
        return OperatorRecord(
            interpreter=name,
            gemini_api_key=_as_str(raw.get("gemini_api_key")),
            openai_api_key=_as_str(raw.get("openai_api_key")),
        )

    def save(
        self,
        *,
        interpreter: InterpreterName,
        gemini_api_key: str | None = None,
        openai_api_key: str | None = None,
    ) -> OperatorRecord:
        current = self.load()
        gemini = current.gemini_api_key
        openai = current.openai_api_key
        if gemini_api_key is not None and gemini_api_key != "":
            gemini = gemini_api_key
        if openai_api_key is not None and openai_api_key != "":
            openai = openai_api_key
        record = OperatorRecord(
            interpreter=interpreter,
            gemini_api_key=gemini,
            openai_api_key=openai,
        )
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "interpreter": record.interpreter,
            "gemini_api_key": record.gemini_api_key,
            "openai_api_key": record.openai_api_key,
        }
        self._path.write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )
        return record

    def public_view(self, settings: Settings) -> dict[str, Any]:
        record = self.load()
        interpreter = record.interpreter or settings.interpreter
        gemini_key = record.gemini_api_key or settings.gemini_api_key
        openai_key = record.openai_api_key or settings.openai_api_key
        gemini_raw = self._read_status_overrides().get("gemini")
        openai_raw = self._read_status_overrides().get("openai")
        gemini_status = _normalize_key_status(gemini_raw[0] if gemini_raw else None, bool(gemini_key))
        openai_status = _normalize_key_status(openai_raw[0] if openai_raw else None, bool(openai_key))
        return {
            "interpreter": interpreter,
            "gemini_key_set": bool(gemini_key),
            "openai_key_set": bool(openai_key),
            "gemini_key_masked": _mask_key(gemini_key),
            "openai_key_masked": _mask_key(openai_key),
            "gemini_key_status": gemini_status,
            "openai_key_status": openai_status,
            "gemini_key_warning": gemini_raw[1] if gemini_raw else _warning_for_key("gemini", gemini_status),
            "openai_key_warning": openai_raw[1] if openai_raw else _warning_for_key("openai", openai_status),
        }

    def set_key_status(
        self,
        provider: str,
        status: str,
        warning: str | None = None,
    ) -> None:
        if provider not in {"gemini", "openai"}:
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
        for name in ("gemini", "openai"):
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
        if record.gemini_api_key:
            updates["gemini_api_key"] = record.gemini_api_key
        if record.openai_api_key:
            updates["openai_api_key"] = record.openai_api_key
        if not updates:
            return settings
        return settings.model_copy(update=updates)


def _as_str(value: object) -> str:
    if isinstance(value, str):
        return value
    return ""


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
    if status == "missing":
        return f"{provider.title()} API key is not set"
    if status == "invalid":
        return f"{provider.title()} API key is invalid"
    return None


store = OperatorSettingsStore()
