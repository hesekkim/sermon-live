import asyncio
import base64
import json

import pytest

from core.config import Settings
from services.interpreters.openai_realtime import OpenAIRealtimeInterpreter
from services.interpreters.protocol import KeyValidationError


class FakeWebSocket:
    def __init__(self, incoming: list[dict[str, object]]) -> None:
        self.incoming = [json.dumps(event) for event in incoming]
        self.sent: list[dict[str, object]] = []
        self.closed = False

    async def send(self, message: str) -> None:
        self.sent.append(json.loads(message))

    async def recv(self) -> str:
        return self.incoming.pop(0)

    def __aiter__(self):
        return self

    async def __anext__(self) -> str:
        while not self.incoming:
            if any(event.get("type") == "session.close" for event in self.sent):
                raise StopAsyncIteration
            await asyncio.sleep(0)
        return self.incoming.pop(0)

    async def close(self) -> None:
        self.closed = True


def factory_for(websocket: FakeWebSocket):
    async def factory(*_args, **_kwargs):
        return websocket

    return factory


@pytest.mark.asyncio
async def test_start_sends_translation_configuration_and_pcm():
    websocket = FakeWebSocket(
        [
            {"type": "session.created"},
            {"type": "session.updated"},
        ]
    )
    adapter = OpenAIRealtimeInterpreter(
        Settings(interpreter="openai", openai_api_key="test-key"),
        websocket_factory=factory_for(websocket),
    )

    await adapter.start()
    await adapter.send_pcm(b"\x01\x02")

    assert websocket.sent[0] == {
        "type": "session.update",
        "session": {
            "audio": {
                "input": {"transcription": {"model": "gpt-realtime-whisper"}},
                "output": {"language": "de"},
            }
        },
    }
    assert websocket.sent[1] == {
        "type": "session.input_audio_buffer.append",
        "audio": base64.b64encode(b"\x01\x02").decode("ascii"),
    }


@pytest.mark.asyncio
async def test_start_uses_translation_settings():
    websocket = FakeWebSocket(
        [
            {"type": "session.created"},
            {"type": "session.updated"},
        ]
    )
    adapter = OpenAIRealtimeInterpreter(
        Settings(
            interpreter="openai",
            openai_api_key="test-key",
            translation_target_language="fr",
            translation_source_transcription_model="custom-whisper",
        ),
        websocket_factory=factory_for(websocket),
    )

    await adapter.start()

    assert websocket.sent[0]["session"]["audio"]["input"]["transcription"] == {
        "model": "custom-whisper"
    }
    assert websocket.sent[0]["session"]["audio"]["output"] == {"language": "fr"}


@pytest.mark.asyncio
async def test_start_uses_configured_target_audio_format():
    websocket = FakeWebSocket(
        [
            {"type": "session.created"},
            {"type": "session.updated"},
        ]
    )
    adapter = OpenAIRealtimeInterpreter(
        Settings(
            interpreter="openai",
            openai_api_key="test-key",
            translation_target_sample_rate=16000,
            translation_target_channels=2,
            translation_target_sample_width=4,
        ),
        websocket_factory=factory_for(websocket),
    )

    await adapter.start()

    assert adapter.required_sample_rate == 16000
    assert adapter.required_channels == 2
    assert adapter.required_sample_width == 4


@pytest.mark.asyncio
async def test_close_without_event_consumer_closes_socket():
    websocket = FakeWebSocket(
        [
            {"type": "session.created"},
            {"type": "session.updated"},
        ]
    )
    adapter = OpenAIRealtimeInterpreter(
        Settings(interpreter="openai", openai_api_key="test-key"),
        websocket_factory=factory_for(websocket),
    )

    await adapter.start()
    await adapter.close()

    assert websocket.sent[-1] == {"type": "session.close"}
    assert websocket.closed


@pytest.mark.asyncio
async def test_events_map_translation_audio_and_transcripts():
    audio = b"\x10\x11"
    websocket = FakeWebSocket(
        [
            {"type": "session.created"},
            {"type": "session.updated"},
            {
                "type": "session.output_audio.delta",
                "delta": base64.b64encode(audio).decode("ascii"),
                "sample_rate": 24000,
            },
            {"type": "session.output_transcript.delta", "delta": "Hallo"},
            {"type": "session.input_transcript.delta", "delta": "안녕"},
            {"type": "error", "error": {"message": "bad audio"}},
        ]
    )
    adapter = OpenAIRealtimeInterpreter(
        Settings(interpreter="openai", openai_api_key="test-key"),
        websocket_factory=factory_for(websocket),
    )
    await adapter.start()

    events = []
    async for event in adapter.events():
        events.append(event)
        if len(events) == 4:
            break

    assert [(event.kind, event.pcm, event.text) for event in events] == [
        ("audio", audio, None),
        ("output_text", None, "Hallo"),
        ("input_text", None, "안녕"),
        ("error", None, "bad audio"),
    ]


@pytest.mark.asyncio
async def test_close_flushes_before_socket_close():
    websocket = FakeWebSocket(
        [
            {"type": "session.created"},
            {"type": "session.updated"},
            {"type": "session.output_transcript.delta", "delta": "Letzte"},
            {"type": "session.closed"},
        ]
    )
    adapter = OpenAIRealtimeInterpreter(
        Settings(interpreter="openai", openai_api_key="test-key"),
        websocket_factory=factory_for(websocket),
    )
    await adapter.start()
    events_task = asyncio.create_task(collect_events(adapter))

    await adapter.close()
    events = await events_task

    assert websocket.sent[-1] == {"type": "session.close"}
    assert events[0].text == "Letzte"
    assert websocket.closed


@pytest.mark.asyncio
async def test_validate_key_rejects_handshake_error():
    websocket = FakeWebSocket(
        [{"type": "error", "error": {"message": "invalid api key"}}]
    )
    adapter = OpenAIRealtimeInterpreter(
        Settings(interpreter="openai", openai_api_key="test-key"),
        websocket_factory=factory_for(websocket),
    )

    with pytest.raises(KeyValidationError):
        await adapter.validate_key()
    assert websocket.closed


async def collect_events(adapter: OpenAIRealtimeInterpreter):
    return [event async for event in adapter.events()]