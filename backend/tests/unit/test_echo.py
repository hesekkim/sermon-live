import asyncio

import pytest

from services.interpreters.echo import EchoInterpreter
from services.interpreters.protocol import InterpreterEvent


@pytest.mark.asyncio
async def test_echo_emits_audio_event_with_input_sample_rate():
    interpreter = EchoInterpreter(sample_rate=16000)
    await interpreter.start()
    chunk = b"\x01\x00\x02\x00"

    async def collect_one() -> InterpreterEvent:
        async for event in interpreter.events():
            return event
        raise AssertionError("no event")

    task = asyncio.create_task(collect_one())
    await interpreter.send_pcm(chunk)
    event = await asyncio.wait_for(task, timeout=1)
    await interpreter.close()

    assert event.kind == "audio"
    assert event.pcm == chunk
    assert event.sample_rate == 16000
