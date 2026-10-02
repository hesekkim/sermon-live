import asyncio
import json
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from core.config import Settings
from api.v1.endpoints.audio import _collect_audio_until_disconnected
from main import app
from services.audio_devices import enumerate_input_devices, list_input_devices
from services.runtime import session


@pytest.fixture(autouse=True)
def isolate_audio_test_settings(monkeypatch):
    settings = Settings(_env_file=None)
    monkeypatch.setattr("api.v1.endpoints.audio.get_settings", lambda: settings)
    monkeypatch.setattr(
        "api.v1.endpoints.audio.operator_store",
        SimpleNamespace(overlay_settings=lambda current: current),
    )


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

    with patch("services.audio_devices.pyaudio.PyAudio", return_value=audio), patch(
        "services.audio_devices.pyaudio.pa.get_device_info",
        side_effect=lambda index: SimpleNamespace(
            name=audio.devices[index]["name"].encode("utf-8")
        ),
    ):
        devices = list_input_devices()

    assert devices == [
        {
            "index": 1,
            "name": "USB Microphone",
            "host_api": "Windows WASAPI",
            "selector": '{"host_api":"Windows WASAPI","name":"USB Microphone","version":1}',
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

    with patch("services.audio_devices.pyaudio.PyAudio", return_value=audio), patch(
        "services.audio_devices.pyaudio.pa.get_device_info",
        side_effect=lambda index: SimpleNamespace(
            name=audio.devices[index]["name"].encode("utf-8")
        ),
    ):
        devices = list_input_devices()

    assert devices == [
        {
            "index": 0,
            "name": "PC Speaker (Realtek HD Audio output with HAP)",
            "host_api": "Windows WASAPI",
            "selector": '{"host_api":"Windows WASAPI","name":"PC Speaker (Realtek HD Audio output with HAP)","version":1}',
            "input_channels": 2,
            "default_sample_rate": 44100.0,
        },
        {
            "index": 1,
            "name": "USB Microphone",
            "host_api": "Windows WASAPI",
            "selector": '{"host_api":"Windows WASAPI","name":"USB Microphone","version":1}',
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

    with patch("services.audio_devices.pyaudio.PyAudio", return_value=audio), patch(
        "services.audio_devices.pyaudio.pa.get_device_info",
        side_effect=lambda index: SimpleNamespace(
            name=audio.devices[index]["name"].encode("utf-8")
        ),
    ):
        devices = list_input_devices()

    assert devices == [
        {
            "index": 0,
            "name": "USB Speakerphone",
            "host_api": "Windows WASAPI",
            "selector": '{"host_api":"Windows WASAPI","name":"USB Speakerphone","version":1}',
            "input_channels": 4,
            "default_sample_rate": 48000.0,
        }
    ]


def test_list_input_devices_keeps_input_capability_when_name_mentions_output():
    audio = FakePyAudio(
        [
            {
                "name": "PC-Lautsprecher (Realtek HD Audio output with HAP)",
                "maxInputChannels": 2,
                "maxOutputChannels": 0,
                "defaultSampleRate": 44100,
            },
            {
                "name": "USB Microphone",
                "maxInputChannels": 2,
                "maxOutputChannels": 0,
                "defaultSampleRate": 48000,
            },
        ]
    )

    with patch("services.audio_devices.pyaudio.PyAudio", return_value=audio), patch(
        "services.audio_devices.pyaudio.pa.get_device_info",
        side_effect=lambda index: SimpleNamespace(
            name=audio.devices[index]["name"].encode("utf-8")
        ),
    ):
        devices = list_input_devices()

    assert [device["name"] for device in devices] == [
        "PC-Lautsprecher (Realtek HD Audio output with HAP)",
        "USB Microphone",
    ]


@pytest.mark.parametrize(
    ("platform_name", "preferred_name"),
    [("win32", "Windows WASAPI"), ("darwin", "Core Audio")],
)
def test_standard_input_devices_use_platform_host_api(platform_name, preferred_name):
    audio = FakePyAudio(
        [
            {
                "name": "Built-in microphone",
                "hostApi": 0,
                "maxInputChannels": 1,
                "defaultSampleRate": 48000,
            },
            {
                "name": "Built-in microphone",
                "hostApi": 1,
                "maxInputChannels": 1,
                "defaultSampleRate": 48000,
            },
        ],
        host_apis=[{"name": "MME"}, {"name": preferred_name}],
    )

    devices = enumerate_input_devices(audio, mode="standard", platform_name=platform_name)

    assert len(devices) == 1
    assert devices[0]["index"] == 1
    assert devices[0]["host_api"] == preferred_name


def test_all_input_devices_preserves_duplicate_host_api_endpoints():
    audio = FakePyAudio(
        [
            {
                "name": "Built-in microphone",
                "hostApi": 0,
                "maxInputChannels": 1,
                "defaultSampleRate": 48000,
            },
            {
                "name": "Built-in microphone",
                "hostApi": 1,
                "maxInputChannels": 1,
                "defaultSampleRate": 48000,
            },
        ],
        host_apis=[{"name": "MME"}, {"name": "Windows WASAPI"}],
    )

    devices = enumerate_input_devices(audio, mode="all", platform_name="win32")

    assert [device["host_api"] for device in devices] == ["MME", "Windows WASAPI"]
    assert devices[0]["selector"] != devices[1]["selector"]


@pytest.mark.parametrize("device_name", ["Kopfhörer", "マイク"])
def test_list_input_devices_decodes_utf8_names_before_system_encoding(
    monkeypatch, device_name
):
    audio = FakePyAudio(
        [
            {
                "name": device_name,
                "maxInputChannels": 1,
                "defaultSampleRate": 48000,
            }
        ]
    )
    raw_name = device_name.encode("utf-8")
    monkeypatch.setattr("services.audio_devices.pyaudio.PyAudio", lambda: audio)
    monkeypatch.setattr(
        "services.audio_devices.pyaudio.pa.get_device_info",
        lambda _index: SimpleNamespace(name=raw_name),
    )
    monkeypatch.setattr(
        "services.audio_devices.locale.getpreferredencoding",
        lambda do_setlocale=False: "cp1252",
    )

    devices = list_input_devices()

    assert devices[0]["name"] == device_name


def test_list_input_devices_falls_back_to_system_encoding(monkeypatch):
    audio = FakePyAudio(
        [
            {
                "name": "Kopfhörer",
                "maxInputChannels": 1,
                "defaultSampleRate": 48000,
            }
        ]
    )
    monkeypatch.setattr("services.audio_devices.pyaudio.PyAudio", lambda: audio)
    monkeypatch.setattr(
        "services.audio_devices.pyaudio.pa.get_device_info",
        lambda _index: SimpleNamespace(name=b"Kopfh\xf6rer"),
    )
    monkeypatch.setattr(
        "services.audio_devices.locale.getpreferredencoding",
        lambda do_setlocale=False: "cp1252",
    )

    devices = list_input_devices()

    assert devices[0]["name"] == "Kopfhörer"


def test_audio_devices_endpoint_returns_empty_list_when_pyaudio_fails(operator_client):
    with patch("services.audio_devices.pyaudio.PyAudio", side_effect=RuntimeError):
        response = operator_client.get("/api/v1/audio/devices")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize("mode", ["standard", "all"])
def test_audio_devices_endpoint_passes_list_mode(monkeypatch, operator_client, mode):
    requested_modes: list[str] = []
    monkeypatch.setattr(
        "api.v1.endpoints.audio.list_input_devices",
        lambda requested_mode: requested_modes.append(requested_mode)
        or [
            {
                "index": 3,
                "name": "USB Mixer",
                "host_api": "Windows WASAPI",
                "selector": '{"host_api":"Windows WASAPI","name":"USB Mixer","version":1}',
                "input_channels": 2,
                "default_sample_rate": 48000.0,
            }
        ],
    )

    response = operator_client.get(
        "/api/v1/audio/devices" if mode == "standard" else f"/api/v1/audio/devices?mode={mode}"
    )

    assert response.status_code == 200
    assert requested_modes == [mode]
    assert response.json()[0]["host_api"] == "Windows WASAPI"
    assert response.json()[0]["selector"].startswith("{")


@pytest.mark.parametrize(
    ("raw_signal", "expected_status", "expected_capture_sample_rate"),
    [
        (None, "disconnected", None),
        (b"\x00\x00\x00\x00", "silent", 16000),
        (np.asarray([0, 32767], dtype="<i2").tobytes(), "signal", 16000),
    ],
)
def test_audio_test_endpoint_reports_input_status(
    monkeypatch, operator_client, raw_signal, expected_status, expected_capture_sample_rate
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
    monkeypatch.setattr("api.v1.endpoints.audio.audio", SimpleNamespace(ready=False))

    response = operator_client.post("/api/v1/audio/test")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == expected_status
    assert payload["capture_sample_rate"] == expected_capture_sample_rate
    if expected_capture_sample_rate is not None:
        assert payload["capture_channels"] == 1
        assert payload["capture_sample_width"] == 2
        assert payload["processing_sample_rate"] == 16000
        assert payload["processing_channels"] == 1
        assert payload["processing_sample_width"] == 2
        assert payload["processing_success"] is True
    else:
        assert payload["processing_success"] is False


def test_audio_test_endpoint_rejects_when_session_is_running(monkeypatch, operator_client):
    monkeypatch.setattr(
        "api.v1.endpoints.audio.session", SimpleNamespace(state="live")
    )
    monkeypatch.setattr("api.v1.endpoints.audio.audio", SimpleNamespace(ready=False))
    response = operator_client.post("/api/v1/audio/test")

    assert response.status_code == 409
    assert response.json()["detail"] == "Audio test is unavailable while a session is running"


@pytest.mark.asyncio
async def test_audio_collection_is_cancelled_when_client_disconnects():
    disconnected_checks = iter((False, True))

    class FakeRequest:
        async def is_disconnected(self) -> bool:
            return next(disconnected_checks)

    collection_cancelled = asyncio.Event()

    async def collect() -> bytes:
        try:
            await asyncio.Future()
        finally:
            collection_cancelled.set()

    with pytest.raises(asyncio.CancelledError):
        await _collect_audio_until_disconnected(FakeRequest(), collect())

    assert collection_cancelled.is_set()


def test_audio_test_endpoint_uses_requested_device(monkeypatch, operator_client):
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
    monkeypatch.setattr("api.v1.endpoints.audio.audio", SimpleNamespace(ready=False))

    response = operator_client.post("/api/v1/audio/test", json={"audio_device": "3"})

    assert response.status_code == 200
    assert captured_devices == ["3"]


@pytest.mark.parametrize("path", ["/api/v1/audio/test", "/api/v1/audio/test/stream"])
def test_audio_test_uses_operator_selected_interpreter_target(
    monkeypatch, operator_client, path
):
    class FakeCapture:
        input_format = (16000, 1, 2)

        def __init__(self, _settings: object) -> None:
            return None

        async def start(self) -> None:
            return None

        async def stop(self) -> None:
            return None

        async def collect(self, _duration_seconds: float) -> bytes:
            return np.asarray([0, 32767], dtype="<i2").tobytes()

        async def chunks_for(self, _duration_seconds: float):
            yield np.asarray([0, 32767], dtype="<i2").tobytes()

    monkeypatch.setattr("api.v1.endpoints.audio.AudioCapture", FakeCapture)
    monkeypatch.setattr(
        "api.v1.endpoints.audio.operator_store",
        SimpleNamespace(
            overlay_settings=lambda settings: settings.model_copy(
                update={"interpreter": "openai"}
            )
        ),
    )
    monkeypatch.setattr("api.v1.endpoints.audio.audio", SimpleNamespace(ready=False))

    response = operator_client.post(path)

    assert response.status_code == 200
    if path.endswith("/stream"):
        payload = json.loads(response.text.splitlines()[-1])
    else:
        payload = response.json()
    assert payload["processing_sample_rate"] == 24000
    assert payload["processing_channels"] == 1
    assert payload["processing_sample_width"] == 2
    assert payload["processing_success"] is True


def test_audio_test_reports_failure_when_flush_raises(monkeypatch, operator_client):
    class FakeCapture:
        input_format = (8000, 1, 2)

        def __init__(self, _settings: object) -> None:
            return None

        async def start(self) -> None:
            return None

        async def stop(self) -> None:
            return None

        async def collect(self, _duration_seconds: float) -> bytes:
            return b"\x01\x00"

    class FailingProcessor:
        input_level_dbfs = -20.0

        def __init__(self, *_formats: int) -> None:
            return None

        def process(self, _raw: bytes) -> bytes:
            return b"processed"

        def flush(self) -> bytes:
            raise RuntimeError("flush failed")

    settings = Settings(_env_file=None, input_sample_rate=8000)
    monkeypatch.setattr("api.v1.endpoints.audio.get_settings", lambda: settings)
    monkeypatch.setattr("api.v1.endpoints.audio.AudioCapture", FakeCapture)
    monkeypatch.setattr("api.v1.endpoints.audio.AudioProcessor", FailingProcessor)
    monkeypatch.setattr("api.v1.endpoints.audio.audio", SimpleNamespace(ready=False))

    response = operator_client.post("/api/v1/audio/test")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "disconnected"
    assert payload["processing_sample_rate"] == 8000
    assert payload["processing_success"] is False
    assert payload["message"] == "flush failed"


def test_stream_audio_test_reports_live_levels_and_final_result(monkeypatch, operator_client):
    class FakeCapture:
        input_format = (16000, 1, 2)

        def __init__(self, _settings: object) -> None:
            return None

        async def start(self) -> None:
            return None

        async def stop(self) -> None:
            return None

        async def chunks_for(self, _duration_seconds: float):
            yield np.asarray([0, 32767], dtype="<i2").tobytes()
            yield np.asarray([0, 0], dtype="<i2").tobytes()

    monkeypatch.setattr("api.v1.endpoints.audio.AudioCapture", FakeCapture)
    monkeypatch.setattr("api.v1.endpoints.audio.audio", SimpleNamespace(ready=False))

    response = operator_client.post("/api/v1/audio/test/stream")

    assert response.status_code == 200
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [event["type"] for event in events] == ["level", "level", "result"]
    assert events[-1]["status"] == "signal"
    assert events[-1]["processing_success"] is True


class FakePyAudio:
    def __init__(
        self,
        devices: list[dict[str, object]],
        host_apis: list[dict[str, object]] | None = None,
    ) -> None:
        self.devices = devices
        self.host_apis = host_apis or [{"name": "Windows WASAPI"}]
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

    def terminate(self) -> None:
        self.terminated = True