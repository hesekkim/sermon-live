import pytest

from core.config import Settings
from services import audio_capture as audio_capture_module
from services.audio_capture import AudioCapture


@pytest.mark.asyncio
async def test_audio_capture_uses_selected_device_default_rate(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "USB Microphone",
            "maxInputChannels": 1,
            "defaultSampleRate": 48000,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(input_sample_rate=None, audio_device="USB"))
    await capture.start()

    assert audio.open_kwargs["rate"] == 48000
    assert capture.input_format == (48000, 1, 2)

    await capture.stop()


@pytest.mark.asyncio
async def test_audio_capture_prefers_configured_rate(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "USB Microphone",
            "maxInputChannels": 1,
            "defaultSampleRate": 48000,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(input_sample_rate=16000, audio_device="USB"))
    await capture.start()

    assert audio.open_kwargs["rate"] == 16000
    assert capture.input_format == (16000, 1, 2)

    await capture.stop()


@pytest.mark.asyncio
async def test_audio_capture_uses_system_default_for_default_alias(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "Built-in microphone",
            "maxInputChannels": 1,
            "defaultSampleRate": 44100,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(audio_device="default"))
    await capture.start()

    assert "input_device_index" not in audio.open_kwargs
    await capture.stop()


class FakeStream:
    def is_active(self) -> bool:
        return False

    def close(self) -> None:
        return None


class FakePyAudio:
    def __init__(self, device: dict[str, object]) -> None:
        self.device = device
        self.open_kwargs: dict[str, object] = {}

    def get_device_count(self) -> int:
        return 1

    def get_device_info_by_index(self, index: int) -> dict[str, object]:
        assert index == 0
        return self.device

    def get_default_input_device_info(self) -> dict[str, object]:
        return self.device

    def open(self, **kwargs: object) -> FakeStream:
        self.open_kwargs = kwargs
        return FakeStream()

    def get_sample_size(self, _format: int) -> int:
        return 2

    def terminate(self) -> None:
        return None