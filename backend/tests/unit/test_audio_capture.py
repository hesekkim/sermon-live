import asyncio
from types import SimpleNamespace

import pytest

from core.config import Settings
from services import audio_capture as audio_capture_module
from services.audio_capture import AudioCapture
from services.audio_devices import make_device_selector


def selector(name: str, host_api: str = "Windows WASAPI") -> str:
    return make_device_selector(host_api, name)


@pytest.fixture(autouse=True)
def patch_raw_device_names(monkeypatch):
    def get_device_info(index: int) -> SimpleNamespace:
        audio = audio_capture_module.pyaudio.PyAudio()
        name = audio.get_device_info_by_index(index)["name"]
        if isinstance(name, str):
            name = name.encode("utf-8")
        return SimpleNamespace(name=name)

    monkeypatch.setattr(
        audio_capture_module.pyaudio.pa,
        "get_device_info",
        get_device_info,
    )


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

    capture = AudioCapture(
        Settings(
            input_sample_rate=None,
            audio_device=selector("USB Microphone"),
        )
    )
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

    capture = AudioCapture(
        Settings(input_sample_rate=16000, audio_device=selector("USB Microphone"))
    )
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

    capture = AudioCapture(
        Settings(input_sample_rate=None, audio_device=selector("USB Microphone"))
    )
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

    capture = AudioCapture(
        Settings(input_sample_rate=16000, audio_device=selector("USB Mixer"))
    )
    await capture.start()

    assert audio.open_kwargs["channels"] == 2
    assert audio.open_kwargs["format"] == audio_capture_module.pyaudio.paInt24
    assert audio.open_kwargs["input_device_index"] == 0
    assert capture.input_format == (16000, 1, 3)

    await capture.stop()


@pytest.mark.asyncio
async def test_audio_capture_selects_requested_mixer_channel(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "USB Mixer",
            "maxInputChannels": 4,
            "defaultSampleRate": 48000,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(
        Settings(audio_channel=3, audio_device=selector("USB Mixer"))
    )
    await capture.start()

    samples = [
        (11, 22, 33, 44),
        (55, 66, 77, 88),
    ]
    interleaved = b"".join(
        sample.to_bytes(2, "little", signed=True)
        for frame in samples
        for sample in frame
    )
    capture._on_chunk(interleaved, len(samples), None, 0)
    await asyncio.sleep(0)

    assert audio.open_kwargs["channels"] == 4
    assert capture.input_format == (16000, 1, 2)
    assert capture._queue.get_nowait() == b"".join(
        frame[2].to_bytes(2, "little", signed=True) for frame in samples
    )
    await capture.stop()


@pytest.mark.asyncio
async def test_audio_capture_prefers_multichannel_stream_for_channel_one(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "USB Mixer",
            "maxInputChannels": 4,
            "defaultSampleRate": 48000,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(
        Settings(audio_channel=1, audio_device=selector("USB Mixer"))
    )
    await capture.start()

    samples = [(11, 22, 33, 44), (55, 66, 77, 88)]
    interleaved = b"".join(
        sample.to_bytes(2, "little", signed=True)
        for frame in samples
        for sample in frame
    )
    capture._on_chunk(interleaved, len(samples), None, 0)
    await asyncio.sleep(0)

    assert audio.open_kwargs["channels"] == 4
    assert capture.input_format == (16000, 1, 2)
    assert capture._queue.get_nowait() == b"".join(
        frame[0].to_bytes(2, "little", signed=True) for frame in samples
    )
    await capture.stop()


@pytest.mark.asyncio
async def test_audio_capture_rejects_unavailable_channel(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "USB Mixer",
            "maxInputChannels": 2,
            "defaultSampleRate": 48000,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(
        Settings(audio_channel=3, audio_device=selector("USB Mixer"))
    )

    with pytest.raises(RuntimeError, match="Selected audio channel 3 is unavailable"):
        await capture.start()

    assert audio.open_kwargs == {}
    assert audio.terminated is True


@pytest.mark.asyncio
async def test_audio_capture_resolves_selector_to_current_device_index(monkeypatch):
    audio = FakePyAudio(
        [
            {
                "name": "Built-in microphone",
                "maxInputChannels": 1,
                "defaultSampleRate": 44100,
            },
            {
                "name": "USB Mixer",
                "maxInputChannels": 2,
                "defaultSampleRate": 48000,
            },
        ]
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(audio_device=selector("USB Mixer")))
    await capture.start()

    assert audio.open_kwargs["input_device_index"] == 1
    await capture.stop()


@pytest.mark.asyncio
async def test_audio_capture_rejects_legacy_numeric_device_index(monkeypatch):
    audio = FakePyAudio(
        {
            "name": "Built-in microphone",
            "maxInputChannels": 1,
            "defaultSampleRate": 44100,
        }
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(audio_device="31"))

    with pytest.raises(RuntimeError, match="select an input device again"):
        await capture.start()

    assert audio.open_kwargs == {}
    assert audio.terminated is True


@pytest.mark.asyncio
async def test_audio_capture_rejects_ambiguous_legacy_device_name(monkeypatch):
    audio = FakePyAudio(
        [
            {
                "name": "Built-in microphone",
                "hostApi": 0,
                "maxInputChannels": 1,
                "defaultSampleRate": 44100,
            },
            {
                "name": "Built-in microphone",
                "hostApi": 1,
                "maxInputChannels": 1,
                "defaultSampleRate": 44100,
            },
        ],
        host_apis=[{"name": "MME"}, {"name": "Windows WASAPI"}],
    )
    monkeypatch.setattr(audio_capture_module.pyaudio, "PyAudio", lambda: audio)

    capture = AudioCapture(Settings(audio_device="Built-in microphone"))

    with pytest.raises(RuntimeError, match="is ambiguous"):
        await capture.start()

    assert audio.open_kwargs == {}


@pytest.mark.asyncio
async def test_audio_capture_bounds_queue_and_keeps_latest_chunks():
    settings = Settings(input_sample_rate=16000, audio_chunk_frames=1024)
    capture = AudioCapture(settings)
    capture._input_format = (16000, 1, 2)
    capture._loop = asyncio.get_running_loop()
    capture._accept_chunks = True
    chunk_count = capture._queue.maxsize + 3
    chunks = [value.to_bytes(2, "little") * settings.audio_chunk_frames for value in range(chunk_count)]

    for chunk in chunks:
        capture._on_chunk(chunk, settings.audio_chunk_frames, None, 0)
        await asyncio.sleep(0)

    retained = [capture._queue.get_nowait() for _ in range(capture._queue.qsize())]
    assert capture._queue.maxsize == 7
    assert retained == chunks[-capture._queue.maxsize :]
    assert capture.dropped_chunks == 3
    assert capture.dropped_duration_seconds == pytest.approx(3 * 1024 / 16000)

    await capture.stop()
    assert capture._queue.get_nowait() is None


@pytest.mark.asyncio
async def test_audio_capture_coalesces_callbacks_while_event_loop_is_busy():
    settings = Settings(input_sample_rate=16000, audio_chunk_frames=1024)
    capture = AudioCapture(settings)
    capture._input_format = (16000, 1, 2)
    capture._loop = asyncio.get_running_loop()
    capture._accept_chunks = True
    chunks = [value.to_bytes(2, "little") * settings.audio_chunk_frames for value in range(8)]

    for chunk in chunks:
        capture._on_chunk(chunk, settings.audio_chunk_frames, None, 0)
    await asyncio.sleep(0)

    assert capture._queue.qsize() == 1
    assert capture._queue.get_nowait() == chunks[-1]
    assert capture.dropped_chunks == len(chunks) - 1
    assert capture.dropped_duration_seconds == pytest.approx(
        (len(chunks) - 1) * settings.audio_chunk_frames / 16000
    )
    await capture.stop()


class FakeStream:
    def is_active(self) -> bool:
        return False

    def close(self) -> None:
        return None


class FakePyAudio:
    def __init__(
        self,
        device: dict[str, object] | list[dict[str, object]],
        host_apis: list[dict[str, object]] | None = None,
    ) -> None:
        self.devices = device if isinstance(device, list) else [device]
        self.device = self.devices[0]
        self.host_apis = host_apis or [{"name": "Windows WASAPI"}]
        self.open_kwargs: dict[str, object] = {}
        self.open_side_effect: list[Exception | FakeStream] | None = None
        self._next_open_index = 0
        self.terminated = False

    def get_device_count(self) -> int:
        return len(self.devices)

    def get_device_info_by_index(self, index: int) -> dict[str, object]:
        info = dict(self.devices[index])
        info.setdefault("hostApi", 0)
        return info

    def get_host_api_count(self) -> int:
        return len(self.host_apis)

    def get_host_api_info_by_index(self, index: int) -> dict[str, object]:
        return self.host_apis[index]

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