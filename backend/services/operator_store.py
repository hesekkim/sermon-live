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
        return {
            "interpreter": interpreter,
            "gemini_key_set": bool(gemini_key),
            "openai_key_set": bool(openai_key),
        }

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


store = OperatorSettingsStore()
