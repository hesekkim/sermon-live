from core.config import Settings
from services.interpreters.echo import EchoInterpreter
from services.interpreters.factory import create_interpreter
from services.interpreters.openai_realtime import OpenAIRealtimeInterpreter


def test_factory_selects_echo():
    settings = Settings(interpreter="echo")
    adapter = create_interpreter(settings)
    assert isinstance(adapter, EchoInterpreter)


def test_factory_selects_openai_stub():
    settings = Settings(interpreter="openai", openai_api_key="test-key")
    adapter = create_interpreter(settings)
    assert isinstance(adapter, OpenAIRealtimeInterpreter)
