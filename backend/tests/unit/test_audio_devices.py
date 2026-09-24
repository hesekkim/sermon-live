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


def test_list_input_devices_keeps_mixed_input_output_devices_even_when_name_mentions_output():
    audio = FakePyAudio(
        [
            {
                "name": "PC Speaker (Realtek HD Audio output with HAP)",
                "maxInputChannels": 2,
                "maxOutputChannels": 2,
                "defaultSampleRate": 44100,
            },
            {
                "name": "USB Microphone",
                "maxInputChannels": 2,
                "maxOutputChannels": 0,
                "defaultSampleRate": 16000,
            },
        ]
    )

    with patch("services.audio_devices.pyaudio.PyAudio", return_value=audio):
        devices = list_input_devices()

    assert devices == [
        {
            "index": 0,
            "name": "PC Speaker (Realtek HD Audio output with HAP)",
            "input_channels": 2,
            "default_sample_rate": 44100.0,
        },
        {
            "index": 1,
            "name": "USB Microphone",
            "input_channels": 2,
            "default_sample_rate": 16000.0,
        },
    ]


def test_list_input_devices_keeps_input_devices_even_when_name_mentions_output():
    audio = FakePyAudio(
        [
            {
                "name": "USB Speakerphone",
                "maxInputChannels": 4,
                "maxOutputChannels": 2,
                "defaultSampleRate": 48000,
            },
            {
                "name": "Output only",
                "maxInputChannels": 0,
                "maxOutputChannels": 2,
                "defaultSampleRate": 48000,
            },
        ]
    )

    with patch("services.audio_devices.pyaudio.PyAudio", return_value=audio):
        devices = list_input_devices()

    assert devices == [
        {
            "index": 0,
            "name": "USB Speakerphone",
            "input_channels": 4,
            "default_sample_rate": 48000.0,
        }
    ]


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