import re

_META_TEXT = re.compile(
    r"\b(i|i'm|i've|i have|interpreting|clarifying|translation of|"
    r"this sermon context|best translated|determine|determined)\b",
    re.IGNORECASE,
)

_META_PREFIX = (
    "interpreting",
    "clarifying",
    "the translation",
    "translation of",
    "i'm interpreting",
    "i have determined",
    "the most natural",
)


def should_suppress_translation_text(text: str) -> bool:
    cleaned = text.strip()
    if not cleaned:
        return True
    lower = cleaned.lower()
    if _META_TEXT.search(lower):
        return True
    return lower.startswith(_META_PREFIX)
