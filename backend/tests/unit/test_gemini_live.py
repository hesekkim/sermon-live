import pytest

from core.config import Settings
from services.interpreters.gemini_live import GeminiLiveInterpreter


def test_build_setup_enables_input_transcription():
    interpreter = GeminiLiveInterpreter(Settings(gemini_api_key="test-key"))

    setup = interpreter._build_setup()["setup"]

    assert setup["inputAudioTranscription"] == {}
    assert setup["outputAudioTranscription"] == {}
    assert setup["realtimeInputConfig"]["automaticActivityDetection"]["disabled"] is True


@pytest.mark.asyncio
async def test_emit_logs_input_and_output(caplog):
    interpreter = GeminiLiveInterpreter(Settings(gemini_api_key="test-key"))

    with caplog.at_level("INFO"):
        await interpreter._emit_from_message(
            {
                "serverContent": {
                    "inputTranscription": {"text": "안녕하세요"},
                    "outputTranscription": {"text": "Hallo zusammen"},
                    "modelTurn": {"parts": [{"text": "Gott segne euch"}]},
                }
            }
        )

    event = await interpreter._queue.get()

    assert "[Translation input] 안녕하세요" in caplog.text
    assert "[Translation output] Hallo zusammen" in caplog.text
    assert "[Translation output] Gott segne euch" in caplog.text
    assert event.kind == "text"
    assert event.text == "Gott segne euch"