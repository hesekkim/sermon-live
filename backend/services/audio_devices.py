from __future__ import annotations

import logging
from typing import Protocol

import pyaudio

logger = logging.getLogger(__name__)

class AudioDeviceHost(Protocol):
    def get_device_count(self) -> int: ...

    def get_device_info_by_index(self, index: int) -> dict[str, object]: ...


def _is_output_only_device(info: dict[str, object]) -> bool:
    input_channels = int(info.get("maxInputChannels") or 0)
    output_channels = int(info.get("maxOutputChannels") or 0)
    return input_channels <= 0 and output_channels > 0


def enumerate_input_devices(audio: AudioDeviceHost) -> list[dict[str, object]]:
    devices: list[dict[str, object]] = []
    for index in range(audio.get_device_count()):
        info = audio.get_device_info_by_index(index)
        name = str(info.get("name", ""))
        input_channels = int(info.get("maxInputChannels") or 0)
        if input_channels <= 0:
            continue
        if _is_output_only_device(info):
            logger.info("Filtering out output-only device %r", name)
            continue
        devices.append(
            {
                "index": index,
                "name": name,
                "input_channels": input_channels,
                "default_sample_rate": float(info.get("defaultSampleRate") or 0),
            }
        )
    return devices


def list_input_devices() -> list[dict[str, object]]:
    audio: pyaudio.PyAudio | None = None
    try:
        audio = pyaudio.PyAudio()
        return enumerate_input_devices(audio)
    except Exception:
        logger.exception("Failed to enumerate audio input devices")
        return []
    finally:
        if audio is not None:
            try:
                audio.terminate()
            except Exception:
                logger.warning("Failed to terminate PyAudio after device enumeration")