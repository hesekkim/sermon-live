from __future__ import annotations

import pytest

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



