from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app
from services.audio_devices import list_input_devices
from services.runtime import session


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


@pytest.mark.parametrize(
    ("raw_signal", "expected_status", "expected_detected_sample_rate"),
    [
        (None, "disconnected", None),
        (b"\x00\x00\x00\x00", "silent", 16000),
        (np.asarray([0, 32767], dtype="<i2").tobytes(), "signal", 16000),
    ],
)
def test_audio_test_endpoint_reports_input_status(
    monkeypatch, raw_signal, expected_status, expected_detected_sample_rate
):
    class FakeCapture:
        def __init__(self, _settings: object) -> None:
            self.input_format = (16000, 1, 2) if raw_signal is not None else None

        async def start(self) -> None:
            if self.input_format is None:
                raise RuntimeError("No input device available")

        async def stop(self) -> None:
            return None

        async def collect(self, _duration_seconds: float) -> bytes:
            return b"" if raw_signal is None else raw_signal

    monkeypatch.setattr("api.v1.endpoints.audio.AudioCapture", FakeCapture)

    with TestClient(app) as client:
        response = client.post("/api/v1/audio/test")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == expected_status
    assert payload["detected_sample_rate"] == expected_detected_sample_rate
    if expected_detected_sample_rate is not None:
        assert payload["detected_channels"] == 1
        assert payload["detected_sample_width"] == 2
        assert payload["processing_sample_rate"] == 24000
        assert payload["processing_channels"] == 1
        assert payload["processing_sample_width"] == 2
        assert payload["processing_success"] is True
    else:
        assert payload["processing_success"] is False


def test_audio_test_endpoint_rejects_when_session_is_running():
    original = session.running
    session._running = True
    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/audio/test")
    finally:
        session._running = original

    assert response.status_code == 409
    assert response.json()["detail"] == "Audio test is unavailable while a session is running"


def test_audio_test_endpoint_uses_requested_device(monkeypatch):
    captured_devices: list[str] = []

    class FakeCapture:
        input_format = (16000, 1, 2)

        def __init__(self, settings: object) -> None:
            captured_devices.append(str(settings.audio_device))

        async def start(self) -> None:
            return None

        async def stop(self) -> None:
            return None

        async def collect(self, _duration_seconds: float) -> bytes:
            return b"\x00\x00"

    monkeypatch.setattr("api.v1.endpoints.audio.AudioCapture", FakeCapture)

    with TestClient(app) as client:
        response = client.post("/api/v1/audio/test", json={"audio_device": "3"})

    assert response.status_code == 200
    assert captured_devices == ["3"]


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