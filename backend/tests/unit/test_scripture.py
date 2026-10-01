from pathlib import Path

from services.scripture import (
    GermanScriptureReferenceStream,
    ScriptureCorpus,
    ScriptureReference,
    get_luther_1912_corpus,
)


def test_loader_indexes_vpl_xml_and_keeps_verse_ranges_in_order(tmp_path: Path):
    source = tmp_path / "verses.xml"
    source.write_text(
        '<verseFile><v b="GEN" c="1" v="1"> First </v>'
        '<v b="GEN" c="1" v="2">Second</v></verseFile>',
        encoding="utf-8",
    )

    corpus = ScriptureCorpus.from_vpl_xml(source)

    verses = corpus.lookup(ScriptureReference("GEN", 1, 1, 2))
    assert verses is not None
    assert [(verse.verse, verse.text) for verse in verses] == [
        (1, "First"),
        (2, "Second"),
    ]
    assert corpus.lookup(ScriptureReference("GEN", 1, 2, 1)) is None


def test_loader_rejects_duplicate_verse_keys(tmp_path: Path):
    source = tmp_path / "duplicate.xml"
    source.write_text(
        '<verseFile><v b="GEN" c="1" v="1">First</v>'
        '<v b="GEN" c="1" v="1">Duplicate</v></verseFile>',
        encoding="utf-8",
    )

    try:
        ScriptureCorpus.from_vpl_xml(source)
    except ValueError as error:
        assert "Duplicate verse key" in str(error)
    else:
        raise AssertionError("Duplicate verse keys must be rejected")


def test_real_luther_corpus_contains_reported_references():
    corpus = get_luther_1912_corpus()

    assert corpus is not None
    assert corpus.verse_count == 31102
    for reference in (
        ScriptureReference("EPH", 1, 2, 2),
        ScriptureReference("EPH", 2, 8, 9),
        ScriptureReference("ROM", 3, 28, 28),
        ScriptureReference("JHN", 3, 16, 16),
        ScriptureReference("ROM", 5, 8, 8),
    ):
        assert corpus.lookup(reference)


def test_stream_detects_german_references_across_deltas():
    detector = GermanScriptureReferenceStream()

    assert detector.feed("Heute lesen wir Epheser2, die Verse acht") == ()
    detected = detector.feed(" und neun. Danach Römer3, Vers28.")

    assert [reference for _, reference in detected] == [
        ScriptureReference("EPH", 2, 8, 9),
        ScriptureReference("ROM", 3, 28, 28),
    ]


def test_stream_detects_numeric_reference_without_space():
    detector = GermanScriptureReferenceStream()

    detected = detector.feed("Johannes3,16.")

    assert [reference for _, reference in detected] == [
        ScriptureReference("JHN", 3, 16, 16)
    ]


def test_stream_does_not_guess_without_an_explicit_verse_reference():
    detector = GermanScriptureReferenceStream()

    assert detector.feed("Wir denken heute über Gottes Gnade nach.") == ()
    assert detector.feed("Epheser zwei.") == ()