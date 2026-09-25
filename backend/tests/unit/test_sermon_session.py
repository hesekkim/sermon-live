from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app
from services.sermon_session import SermonSessionStore


def test_sermon_session_store_round_trip_persists_metadata(tmp_path):
    store = SermonSessionStore(tmp_path / "sermon_session.json")

    saved = store.save(
        title="Sunday Sermon",
        speaker="Pastor Kim",
        bible_reference="John 1:1-5",
        bible_text="In the beginning was the Word.",
        notes="Prepare a short introduction.",
        status="ready",
    )

    assert saved.sermon_id
    assert saved.title == "Sunday Sermon"
    assert saved.status == "ready"

    reloaded = store.load()
    assert reloaded.sermon_id == saved.sermon_id
    assert reloaded.title == "Sunday Sermon"
    assert reloaded.bible_reference == "John 1:1-5"
    assert reloaded.notes == "Prepare a short introduction."


def test_sermon_session_rejects_invalid_status_transitions(tmp_path):
    store = SermonSessionStore(tmp_path / "sermon_session.json")
    store.save(status="prepare")

    with pytest.raises(ValueError, match="Unsupported sermon status transition"):
        store.save(status="live")


def test_sermon_session_allows_new_sermon_after_ending(tmp_path):
    store = SermonSessionStore(tmp_path / "sermon_session.json")
    first = store.save(
        title="First sermon",
        speaker="Pastor Kim",
        bible_reference="John 1:1",
        notes="Old notes",
        status="ready",
    )
    store.save(status="ended")

    second = store.save(title="Next sermon", status="prepare")

    assert second.sermon_id != first.sermon_id
    assert second.title == "Next sermon"
    assert second.speaker == ""
    assert second.bible_reference == ""
    assert second.notes == ""
    assert second.status == "prepare"


def test_sermon_session_api_round_trip(tmp_path, monkeypatch):
    from services.sermon_session import store

    monkeypatch.setattr(store, "_path", tmp_path / "sermon_session.json")

    with TestClient(app) as client:
        get_response = client.get("/api/v1/sermon-session")
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "prepare"

        put_response = client.put(
            "/api/v1/sermon-session",
            json={
                "title": "Sunday Sermon",
                "speaker": "Pastor Kim",
                "bible_reference": "John 1:1-5",
                "bible_text": "In the beginning was the Word.",
                "notes": "Prepare a short introduction.",
                "status": "ready",
            },
        )

        assert put_response.status_code == 200
        payload = put_response.json()
        assert payload["title"] == "Sunday Sermon"
        assert payload["speaker"] == "Pastor Kim"
        assert payload["status"] == "ready"
        assert payload["sermon_id"]
