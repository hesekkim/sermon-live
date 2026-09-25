from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.sermon_session import store

router = APIRouter()


class SermonSessionBody(BaseModel):
    title: str | None = Field(default=None)
    speaker: str | None = Field(default=None)
    bible_reference: str | None = Field(default=None)
    bible_text: str | None = Field(default=None)
    notes: str | None = Field(default=None)
    status: str | None = Field(default=None)


@router.get("/api/v1/sermon-session")
def get_sermon_session() -> dict[str, object]:
    record = store.load()
    return {
        "sermon_id": record.sermon_id,
        "title": record.title,
        "speaker": record.speaker,
        "bible_reference": record.bible_reference,
        "bible_text": record.bible_text,
        "notes": record.notes,
        "status": record.status,
    }


@router.put("/api/v1/sermon-session")
def put_sermon_session(body: SermonSessionBody) -> dict[str, object]:
    try:
        record = store.save(
            title=body.title,
            speaker=body.speaker,
            bible_reference=body.bible_reference,
            bible_text=body.bible_text,
            notes=body.notes,
            status=body.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (OSError, TypeError) as exc:
        raise HTTPException(status_code=500, detail="Failed to save sermon session") from exc
    return {
        "sermon_id": record.sermon_id,
        "title": record.title,
        "speaker": record.speaker,
        "bible_reference": record.bible_reference,
        "bible_text": record.bible_text,
        "notes": record.notes,
        "status": record.status,
    }
