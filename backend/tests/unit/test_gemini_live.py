import pytest

from core.config import Settings
from services.interpreters.gemini_live import GeminiLiveInterpreter


def test_build_setup_enables_input_transcription():
    interpreter = GeminiLiveInterpreter(Settings(gemini_api_key="test-key"))

    setup = interpreter._build_setup()["setup"]

    assert setup["inputAudioTranscription"] == {}
    assert setup["outputAudioTranscription"] == {}
    activity_detection = setup["realtimeInputConfig"][
        "automaticActivityDetection"
    ]
    assert activity_detection["disabled"] is False
    assert activity_detection["startOfSpeechSensitivity"] == "START_SENSITIVITY_HIGH"
    assert activity_detection["endOfSpeechSensitivity"] == "END_SENSITIVITY_HIGH"


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

    input_event = await interpreter._queue.get()
    output_event = await interpreter._queue.get()

    assert "[Translation input] 안녕하세요" in caplog.text
    assert "[Translation output] Hallo zusammen" in caplog.text
    assert "[Translation output] Gott segne euch" in caplog.text
    assert input_event.kind == "input_text"
    assert input_event.text == "안녕하세요"
    assert output_event.kind == "output_text"
    assert output_event.text == "Hallo zusammen"