from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from services.audio_devices import list_input_devices


def test_list_input_devices_filters_output_only_devices():
    audio = FakePyAudio(
        [
            {
                "name": "Output",
                "maxInputChannels": 0,
                "defaultSampleRate": 48000,
            },
            {
                "name": "USB Microphone",
                "maxInputChannels": 2,
                "defaultSampleRate": 16000,
            },
        ]
    )

    with patch("services.audio_devices.pyaudio.PyAudio", return_value=audio):
        devices = list_input_devices()

    assert devices == [
        {
            "index": 1,
            "name": "USB Microphone",
            "input_channels": 2,
            "default_sample_rate": 16000.0,
        }
    ]
    assert audio.terminated is True


def test_audio_devices_endpoint_returns_empty_list_when_pyaudio_fails():
    with patch("services.audio_devices.pyaudio.PyAudio", side_effect=RuntimeError):
        with TestClient(app) as client:
            response = client.get("/api/v1/audio/devices")

    assert response.status_code == 200
    assert response.json() == []


class FakePyAudio:
    def __init__(self, devices: list[dict[str, object]]) -> None:
        self.devices = devices
        self.terminated = False

    def get_device_count(self) -> int:
        return len(self.devices)

    def get_device_info_by_index(self, index: int) -> dict[str, object]:
        return self.devices[index]

    def terminate(self) -> None:
        self.terminated = True