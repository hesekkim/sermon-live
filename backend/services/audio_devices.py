from __future__ import annotations

import locale
import logging
from collections.abc import Callable
from typing import Protocol

import pyaudio

logger = logging.getLogger(__name__)

class AudioDeviceHost(Protocol):
    def get_device_count(self) -> int: ...

    def get_device_info_by_index(self, index: int) -> dict[str, object]: ...


def _decode_device_name(name: bytes | str) -> str:
    if isinstance(name, str):
        return name
    try:
        return name.decode("utf-8")
    except UnicodeDecodeError:
        encoding = locale.getpreferredencoding(do_setlocale=False)
        return name.decode(encoding, errors="replace")


def _is_output_endpoint(info: dict[str, object], name: str) -> bool:
    output_channels = int(info.get("maxOutputChannels") or 0)
    return output_channels <= 0 and "output" in name.casefold()


def enumerate_input_devices(
    audio: AudioDeviceHost,
    get_raw_device_name: Callable[[int], bytes] | None = None,
) -> list[dict[str, object]]:
    devices: list[dict[str, object]] = []
    for index in range(audio.get_device_count()):
        info = audio.get_device_info_by_index(index)
        raw_name = (
            get_raw_device_name(index)
            if get_raw_device_name is not None
            else info.get("name", "")
        )
        name = _decode_device_name(raw_name)
        input_channels = int(info.get("maxInputChannels") or 0)
        if input_channels <= 0:
            continue
        if _is_output_endpoint(info, name):
            logger.info("Filtering out output endpoint reported as input %r", name)
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
        return enumerate_input_devices(
            audio,
            lambda index: pyaudio.pa.get_device_info(index).name,
        )
    except Exception:
        logger.exception("Failed to enumerate audio input devices")
        return []
    finally:
        if audio is not None:
            try:
                audio.terminate()
            except Exception:
                logger.warning("Failed to terminate PyAudio after device enumeration")