from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
STORE_PATH = DATA_DIR / "sermon_session.json"
VALID_STATUSES = {"prepare", "ready", "ended"}


@dataclass(slots=True)
class SermonRecord:
    sermon_id: str = ""
    title: str = ""
    speaker: str = ""
    bible_reference: str = ""
    bible_text: str = ""
    notes: str = ""
    status: str = "prepare"


class SermonSessionStore:
    def __init__(self, path: Path = STORE_PATH) -> None:
        self._path = path

    def load(self) -> SermonRecord:
        if not self._path.is_file():
            return SermonRecord(status="prepare")
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return SermonRecord(status="prepare")
        if not isinstance(raw, dict):
            return SermonRecord(status="prepare")
        status = self._normalize_status(raw.get("status"))
        return SermonRecord(
            sermon_id=_as_str(raw.get("sermon_id")),
            title=_as_str(raw.get("title")),
            speaker=_as_str(raw.get("speaker")),
            bible_reference=_as_str(raw.get("bible_reference")),
            bible_text=_as_str(raw.get("bible_text")),
            notes=_as_str(raw.get("notes")),
            status=status,
        )

    def save(
        self,
        *,
        title: str | None = None,
        speaker: str | None = None,
        bible_reference: str | None = None,
        bible_text: str | None = None,
        notes: str | None = None,
        status: str | None = None,
    ) -> SermonRecord:
        current = self.load()
        next_status = current.status
        if status is not None:
            if status not in VALID_STATUSES:
                raise ValueError(
                    "Unsupported sermon status transition: "
                    f"{current.status} -> {status}"
                )
            next_status = status
        self._validate_transition(current.status, next_status)

        starts_new_sermon = current.status == "ended" and next_status == "prepare"
        base = SermonRecord(status="prepare") if starts_new_sermon else current
        sermon_id = str(uuid.uuid4()) if starts_new_sermon else current.sermon_id or str(uuid.uuid4())
        record = SermonRecord(
            sermon_id=sermon_id,
            title=_as_str(title) if title is not None else base.title,
            speaker=_as_str(speaker) if speaker is not None else base.speaker,
            bible_reference=_as_str(bible_reference) if bible_reference is not None else base.bible_reference,
            bible_text=_as_str(bible_text) if bible_text is not None else base.bible_text,
            notes=_as_str(notes) if notes is not None else base.notes,
            status=next_status,
        )
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "sermon_id": record.sermon_id,
            "title": record.title,
            "speaker": record.speaker,
            "bible_reference": record.bible_reference,
            "bible_text": record.bible_text,
            "notes": record.notes,
            "status": record.status,
        }
        self._path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        return record

    def _normalize_status(self, status: object) -> str:
        if status in VALID_STATUSES:
            return status
        return "prepare"

    def _validate_transition(self, previous_status: str, next_status: str) -> None:
        if previous_status not in VALID_STATUSES:
            previous_status = "prepare"
        allowed = {
            "prepare": {"prepare", "ready", "ended"},
            "ready": {"ready", "ended"},
            "ended": {"ended", "prepare"},
        }
        if next_status not in allowed.get(previous_status, set()):
            raise ValueError(
                "Unsupported sermon status transition: "
                f"{previous_status} -> {next_status}"
            )


def _as_str(value: object) -> str:
    if isinstance(value, str):
        return value
    return ""


store = SermonSessionStore()
