import pytest

from services.interpreters.openai_realtime import OpenAIRealtimeInterpreter


@pytest.mark.asyncio
async def test_openai_stub_raises_on_start():
    adapter = OpenAIRealtimeInterpreter()
    with pytest.raises(NotImplementedError):
        await adapter.start()
