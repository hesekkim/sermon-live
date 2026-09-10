from __future__ import annotations

from typing import TYPE_CHECKING

from services.interpreters.echo import EchoInterpreter
from services.interpreters.gemini_live import GeminiLiveInterpreter
from services.interpreters.openai_realtime import OpenAIRealtimeInterpreter
from services.interpreters.protocol import LiveInterpreter

if TYPE_CHECKING:
    from core.config import Settings


def create_interpreter(settings: Settings) -> LiveInterpreter:
    name = settings.interpreter
    if name == "echo":
        return EchoInterpreter(sample_rate=settings.input_sample_rate)
    if name == "gemini":
        return GeminiLiveInterpreter(settings)
    if name == "openai":
        return OpenAIRealtimeInterpreter()
    raise ValueError(f"Unknown interpreter: {name}")
