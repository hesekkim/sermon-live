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


@pytest.mark.asyncio
async def test_audio_capture_fails_when_selected_device_name_is_missing(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "Built-in microphone",
            "maxInputChannels": 1,
            "defaultSampleRate": 44100,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(audio_device="Missing USB microphone"))

    with pytest.raises(RuntimeError, match="Missing USB microphone"):
        await capture.start()

    assert audio.open_kwargs == {}
    assert audio.terminated is True


@pytest.mark.asyncio
async def test_audio_capture_falls_back_to_supported_rate_and_channels(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "USB Microphone",
            "maxInputChannels": 2,
            "defaultSampleRate": 48000,
        }
    )

    def open_with_fallback(**kwargs: object):
        audio.open_kwargs = kwargs
        if kwargs["rate"] == 48000 and kwargs["channels"] == 1:
            raise RuntimeError("unsupported rate")
        if kwargs["rate"] == 44100 and kwargs["channels"] == 1:
            return FakeStream()
        raise RuntimeError("unsupported format")

    audio.open = open_with_fallback
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(input_sample_rate=None, audio_device="USB"))
    await capture.start()

    assert audio.open_kwargs["rate"] == 44100
    assert audio.open_kwargs["channels"] == 1
    assert capture.input_format == (44100, 1, 2)

    await capture.stop()


@pytest.mark.asyncio
async def test_audio_capture_selects_supported_stereo_pcm24_format(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "USB Mixer",
            "maxInputChannels": 2,
            "defaultSampleRate": 48000,
        }
    )

    def open_stereo_pcm24(**kwargs: object):
        audio.open_kwargs = kwargs
        if (
            kwargs["rate"] == 16000
            and kwargs["channels"] == 2
            and kwargs["format"] == audio_capture_module.pyaudio.paInt24
        ):
            return FakeStream()
        raise RuntimeError("unsupported format")

    audio.open = open_stereo_pcm24
    audio.get_sample_size = lambda sample_format: (
        3 if sample_format == audio_capture_module.pyaudio.paInt24 else 2
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(input_sample_rate=16000, audio_device="USB Mixer"))
    await capture.start()

    assert audio.open_kwargs["channels"] == 2
    assert audio.open_kwargs["format"] == audio_capture_module.pyaudio.paInt24
    assert audio.open_kwargs["input_device_index"] == 0
    assert capture.input_format == (16000, 2, 3)

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
        self.open_side_effect: list[Exception | FakeStream] | None = None
        self._next_open_index = 0
        self.terminated = False

    def get_device_count(self) -> int:
        return 1

    def get_device_info_by_index(self, index: int) -> dict[str, object]:
        assert index == 0
        return self.device

    def get_default_input_device_info(self) -> dict[str, object]:
        return self.device

    def open(self, **kwargs: object) -> FakeStream:
        self.open_kwargs = kwargs
        if self.open_side_effect:
            effect = self.open_side_effect[self._next_open_index]
            self._next_open_index += 1
            if isinstance(effect, Exception):
                raise effect
            return effect
        return FakeStream()

    def get_sample_size(self, _format: int) -> int:
        return 2

    def terminate(self) -> None:
        self.terminated = True