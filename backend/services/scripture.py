from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

SCRIPTURE_PATH = Path(__file__).resolve().parents[1] / "data" / "scripture" / "deu1912_vpl.xml"
MAX_REFERENCE_BUFFER = 512

_BOOKS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("GEN", "1. Mose", ("1. Mose", "1 Mose", "Genesis")),
    ("EXO", "2. Mose", ("2. Mose", "2 Mose", "Exodus")),
    ("LEV", "3. Mose", ("3. Mose", "3 Mose", "Levitikus", "Leviticus")),
    ("NUM", "4. Mose", ("4. Mose", "4 Mose", "Numeri")),
    ("DEU", "5. Mose", ("5. Mose", "5 Mose", "Deuteronomium")),
    ("JOS", "Josua", ("Josua",)),
    ("JDG", "Richter", ("Richter",)),
    ("RUT", "Ruth", ("Ruth", "Rut")),
    ("1SA", "1. Samuel", ("1. Samuel", "1 Samuel")),
    ("2SA", "2. Samuel", ("2. Samuel", "2 Samuel")),
    ("1KI", "1. Könige", ("1. Könige", "1 Könige", "1 Koenige")),
    ("2KI", "2. Könige", ("2. Könige", "2 Könige", "2 Koenige")),
    ("1CH", "1. Chronik", ("1. Chronik", "1 Chronik")),
    ("2CH", "2. Chronik", ("2. Chronik", "2 Chronik")),
    ("EZR", "Esra", ("Esra",)),
    ("NEH", "Nehemia", ("Nehemia",)),
    ("EST", "Ester", ("Ester", "Esther")),
    ("JOB", "Hiob", ("Hiob",)),
    ("PSA", "Psalm", ("Psalm", "Psalmen")),
    ("PRO", "Sprüche", ("Sprüche", "Sprueche")),
    ("ECC", "Prediger", ("Prediger", "Kohelet")),
    ("SNG", "Hohelied", ("Hohelied", "Hoheslied")),
    ("ISA", "Jesaja", ("Jesaja",)),
    ("JER", "Jeremia", ("Jeremia",)),
    ("LAM", "Klagelieder", ("Klagelieder",)),
    ("EZK", "Hesekiel", ("Hesekiel", "Ezechiel")),
    ("DAN", "Daniel", ("Daniel",)),
    ("HOS", "Hosea", ("Hosea",)),
    ("JOL", "Joel", ("Joel",)),
    ("AMO", "Amos", ("Amos",)),
    ("OBA", "Obadja", ("Obadja",)),
    ("JON", "Jona", ("Jona",)),
    ("MIC", "Micha", ("Micha",)),
    ("NAM", "Nahum", ("Nahum",)),
    ("HAB", "Habakuk", ("Habakuk",)),
    ("ZEP", "Zephanja", ("Zephanja", "Zefanja")),
    ("HAG", "Haggai", ("Haggai",)),
    ("ZEC", "Sacharja", ("Sacharja",)),
    ("MAL", "Maleachi", ("Maleachi",)),
    ("MAT", "Matthäus", ("Matthäus", "Matthaus")),
    ("MRK", "Markus", ("Markus",)),
    ("LUK", "Lukas", ("Lukas",)),
    ("JHN", "Johannes", ("Johannes", "Johannesevangelium")),
    ("ACT", "Apostelgeschichte", ("Apostelgeschichte",)),
    ("ROM", "Römer", ("Römer", "Roemer")),
    ("1CO", "1. Korinther", ("1. Korinther", "1 Korinther")),
    ("2CO", "2. Korinther", ("2. Korinther", "2 Korinther")),
    ("GAL", "Galater", ("Galater",)),
    ("EPH", "Epheser", ("Epheser",)),
    ("PHP", "Philipper", ("Philipper",)),
    ("COL", "Kolosser", ("Kolosser",)),
    ("1TH", "1. Thessalonicher", ("1. Thessalonicher", "1 Thessalonicher")),
    ("2TH", "2. Thessalonicher", ("2. Thessalonicher", "2 Thessalonicher")),
    ("1TI", "1. Timotheus", ("1. Timotheus", "1 Timotheus")),
    ("2TI", "2. Timotheus", ("2. Timotheus", "2 Timotheus")),
    ("TIT", "Titus", ("Titus",)),
    ("PHM", "Philemon", ("Philemon",)),
    ("HEB", "Hebräer", ("Hebräer", "Hebraeer")),
    ("JAS", "Jakobus", ("Jakobus",)),
    ("1PE", "1. Petrus", ("1. Petrus", "1 Petrus")),
    ("2PE", "2. Petrus", ("2. Petrus", "2 Petrus")),
    ("1JN", "1. Johannes", ("1. Johannes", "1 Johannes")),
    ("2JN", "2. Johannes", ("2. Johannes", "2 Johannes")),
    ("3JN", "3. Johannes", ("3. Johannes", "3 Johannes")),
    ("JUD", "Judas", ("Judas",)),
    ("REV", "Offenbarung", ("Offenbarung", "Offenbarung des Johannes")),
)

_BOOK_LABELS = {code: label for code, label, _ in _BOOKS}
_BOOK_CODES_BY_ALIAS = {
    alias.casefold(): code
    for code, _, aliases in _BOOKS
    for alias in aliases
}
_BOOK_PATTERN = "|".join(
    re.escape(alias)
    for alias in sorted(_BOOK_CODES_BY_ALIAS, key=len, reverse=True)
)

_NUMBER_TOKEN = r"(?:\d{1,3}|[A-Za-zÄÖÜäöüß]+(?:und[A-Za-zÄÖÜäöüß]+)?)"
_REFERENCE_PATTERN = re.compile(
    rf"(?<![\w])(?P<book>{_BOOK_PATTERN})\s*,?\s*(?:kapitel\s+)?"
    rf"(?P<chapter>{_NUMBER_TOKEN})\s*[,.:]\s*"
    rf"(?:(?:die\s+)?verse?\s+(?P<plural_start>{_NUMBER_TOKEN})"
    rf"(?:\s+(?:und|bis)\s+(?P<plural_end>{_NUMBER_TOKEN}))?"
    rf"|vers?\s*(?P<single_start>{_NUMBER_TOKEN})"
    rf"(?:\s+(?:und|bis)\s+(?P<single_end>{_NUMBER_TOKEN}))?"
    rf"|(?P<bare_start>\d{{1,3}})"
    rf"(?:\s*(?:[-–]|\b(?:und|bis)\b)\s*(?P<bare_end>\d{{1,3}}))?)"
    rf"(?!\w)",
    re.IGNORECASE,
)

_ONES = {
    "null": 0,
    "eins": 1,
    "ein": 1,
    "eine": 1,
    "einen": 1,
    "einer": 1,
    "einem": 1,
    "zwei": 2,
    "drei": 3,
    "vier": 4,
    "fünf": 5,
    "funf": 5,
    "sechs": 6,
    "sieben": 7,
    "acht": 8,
    "neun": 9,
}
_TEENS = {
    "zehn": 10,
    "elf": 11,
    "zwölf": 12,
    "zwoelf": 12,
    "dreizehn": 13,
    "vierzehn": 14,
    "fünfzehn": 15,
    "fuenfzehn": 15,
    "sechzehn": 16,
    "siebzehn": 17,
    "achtzehn": 18,
    "neunzehn": 19,
}
_TENS = {
    "zwanzig": 20,
    "dreißig": 30,
    "dreissig": 30,
    "vierzig": 40,
    "fünfzig": 50,
    "fuenfzig": 50,
    "sechzig": 60,
    "siebzig": 70,
    "achtzig": 80,
    "neunzig": 90,
}


@dataclass(frozen=True, slots=True)
class ScriptureReference:
    book_code: str
    chapter: int
    start_verse: int
    end_verse: int

    @property
    def label(self) -> str:
        book = _BOOK_LABELS[self.book_code]
        if self.start_verse == self.end_verse:
            return f"{book} {self.chapter},{self.start_verse}"
        return f"{book} {self.chapter},{self.start_verse}-{self.end_verse}"


@dataclass(frozen=True, slots=True)
class ScriptureVerse:
    verse: int
    text: str


class ScriptureCorpus:
    def __init__(self, verses: dict[tuple[str, int, int], str]) -> None:
        self._verses = verses

    @classmethod
    def from_vpl_xml(cls, path: Path) -> ScriptureCorpus:
        verses: dict[tuple[str, int, int], str] = {}
        for _, element in ET.iterparse(path, events=("end",)):
            if element.tag != "v":
                continue
            try:
                key = (
                    element.attrib["b"],
                    int(element.attrib["c"]),
                    int(element.attrib["v"]),
                )
            except (KeyError, ValueError) as exc:
                raise ValueError("Invalid verse entry in Luther 1912 XML") from exc
            if key in verses:
                raise ValueError("Duplicate verse key in Luther 1912 XML")
            text = "".join(element.itertext()).strip()
            if not text:
                raise ValueError("Empty verse text in Luther 1912 XML")
            verses[key] = text
            element.clear()
        if not verses:
            raise ValueError("Luther 1912 XML contains no verses")
        return cls(verses)

    @property
    def verse_count(self) -> int:
        return len(self._verses)

    def lookup(self, reference: ScriptureReference) -> tuple[ScriptureVerse, ...] | None:
        if reference.start_verse > reference.end_verse:
            return None
        result: list[ScriptureVerse] = []
        for verse_number in range(reference.start_verse, reference.end_verse + 1):
            text = self._verses.get(
                (reference.book_code, reference.chapter, verse_number)
            )
            if text is None:
                return None
            result.append(ScriptureVerse(verse=verse_number, text=text))
        return tuple(result)


def _parse_german_number(value: str) -> int | None:
    cleaned = value.casefold().replace("ß", "ss").replace("-", "")
    if cleaned.isdecimal():
        return int(cleaned)
    if "hundert" in cleaned:
        left, right = cleaned.split("hundert", 1)
        multiplier = _parse_german_number(left) if left else 1
        remainder = _parse_german_number(right) if right else 0
        if multiplier is None or remainder is None:
            return None
        return multiplier * 100 + remainder
    if cleaned in _ONES:
        return _ONES[cleaned]
    if cleaned in _TEENS:
        return _TEENS[cleaned]
    if cleaned in _TENS:
        return _TENS[cleaned]
    if "und" in cleaned:
        ones, tens = cleaned.split("und", 1)
        ones_value = _parse_german_number(ones)
        tens_value = _parse_german_number(tens)
        if ones_value is None or tens_value is None or not 1 <= ones_value <= 9:
            return None
        if not 20 <= tens_value <= 90 or tens_value % 10:
            return None
        return tens_value + ones_value
    return None


def _match_is_complete(text: str, match: re.Match[str], final: bool) -> bool:
    if final:
        return True
    suffix = text[match.end() :]
    if not suffix or not suffix.strip():
        return False
    first_word = suffix.lstrip().casefold()
    if first_word.startswith(("und", "bis")):
        return False
    return True


class GermanScriptureReferenceStream:
    def __init__(self) -> None:
        self._buffer = ""
        self._buffer_offset = 0
        self._emitted_offsets: set[int] = set()

    def reset(self) -> None:
        self._buffer = ""
        self._buffer_offset = 0
        self._emitted_offsets.clear()

    def feed(self, text: str) -> tuple[tuple[int, ScriptureReference], ...]:
        self._buffer += text
        return self._extract(final=False)

    def flush(self) -> tuple[tuple[int, ScriptureReference], ...]:
        return self._extract(final=True)

    def _extract(
        self, *, final: bool
    ) -> tuple[tuple[int, ScriptureReference], ...]:
        references: list[tuple[int, ScriptureReference]] = []
        for match in _REFERENCE_PATTERN.finditer(self._buffer):
            absolute_offset = self._buffer_offset + match.start()
            if absolute_offset in self._emitted_offsets:
                continue
            if not _match_is_complete(self._buffer, match, final):
                continue
            reference = _reference_from_match(match)
            if reference is None:
                continue
            self._emitted_offsets.add(absolute_offset)
            references.append((absolute_offset, reference))

        if len(self._buffer) > MAX_REFERENCE_BUFFER:
            remove_length = len(self._buffer) - MAX_REFERENCE_BUFFER
            self._buffer = self._buffer[remove_length:]
            self._buffer_offset += remove_length
            self._emitted_offsets = {
                offset
                for offset in self._emitted_offsets
                if offset >= self._buffer_offset
            }
        return tuple(references)


def _reference_from_match(match: re.Match[str]) -> ScriptureReference | None:
    book_code = _BOOK_CODES_BY_ALIAS.get(match.group("book").casefold())
    chapter = _parse_german_number(match.group("chapter"))
    start_token = (
        match.group("plural_start")
        or match.group("single_start")
        or match.group("bare_start")
    )
    end_token = (
        match.group("plural_end")
        or match.group("single_end")
        or match.group("bare_end")
    )
    start_verse = _parse_german_number(start_token) if start_token else None
    end_verse = _parse_german_number(end_token) if end_token else start_verse
    if (
        book_code is None
        or chapter is None
        or start_verse is None
        or end_verse is None
        or chapter < 1
        or start_verse < 1
        or end_verse < start_verse
    ):
        return None
    return ScriptureReference(
        book_code=book_code,
        chapter=chapter,
        start_verse=start_verse,
        end_verse=end_verse,
    )


@lru_cache(maxsize=1)
def get_luther_1912_corpus() -> ScriptureCorpus | None:
    try:
        return ScriptureCorpus.from_vpl_xml(SCRIPTURE_PATH)
    except (OSError, ET.ParseError, ValueError) as exc:
        logger.warning("Luther 1912 scripture corpus unavailable: %s", exc)
        return None