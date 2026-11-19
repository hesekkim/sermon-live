from __future__ import annotations

from typing import TYPE_CHECKING

from core.config import DEFAULT_TRANSLATION_TARGET_LANGUAGE, TranslationTargetLanguage
from services.interpreters.echo import EchoInterpreter
from services.interpreters.openai_realtime import OpenAIRealtimeInterpreter
from services.interpreters.protocol import LiveInterpreter

if TYPE_CHECKING:
    from core.config import Settings


def create_interpreter(
    settings: Settings,
    *,
    translation_target_language: TranslationTargetLanguage = (
        DEFAULT_TRANSLATION_TARGET_LANGUAGE
    ),
) -> LiveInterpreter:
    name = settings.interpreter
    if name == "echo":
        return EchoInterpreter(sample_rate=settings.input_sample_rate or 16000)
    if name == "openai":
        return OpenAIRealtimeInterpreter(
            settings,
            translation_target_language=translation_target_language,
        )
    raise ValueError(f"Unknown interpreter: {name}")
