from __future__ import annotations

import json
import locale
import logging
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

import pyaudio

logger = logging.getLogger(__name__)

class AudioDeviceHost(Protocol):
    def get_device_count(self) -> int: ...

    def get_device_info_by_index(self, index: int) -> dict[str, object]: ...

    def get_host_api_count(self) -> int: ...

    def get_host_api_info_by_index(self, index: int) -> dict[str, object]: ...


def _decode_device_name(name: bytes | str) -> str:
    if isinstance(name, str):
        return name
    try:
        return name.decode("utf-8")
    except UnicodeDecodeError:
        encoding = locale.getpreferredencoding(do_setlocale=False)
        return name.decode(encoding, errors="replace")


def make_device_selector(host_api: str, name: str) -> str:
    return json.dumps(
        {"version": 1, "host_api": host_api, "name": name},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def parse_device_selector(value: str) -> tuple[str, str] | None:
    try:
        selector = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(selector, dict) or selector.get("version") != 1:
        return None
    host_api = selector.get("host_api")
    name = selector.get("name")
    if not isinstance(host_api, str) or not isinstance(name, str):
        return None
    return host_api, name


def _preferred_host_api(platform_name: str) -> str | None:
    if platform_name == "win32":
        return "wasapi"
    if platform_name == "darwin":
        return "core audio"
    return None


def enumerate_input_devices(
    audio: AudioDeviceHost,
    get_raw_device_name: Callable[[int], bytes] | None = None,
    mode: str = "all",
    platform_name: str | None = None,
) -> list[dict[str, object]]:
    devices: list[dict[str, object]] = []
    host_apis: dict[int, str] = {}
    for index in range(audio.get_host_api_count()):
        info = audio.get_host_api_info_by_index(index)
        host_apis[index] = _decode_device_name(info.get("name", ""))

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
        try:
            host_api_index = int(info.get("hostApi", -1))
        except (TypeError, ValueError):
            host_api_index = -1
        host_api = host_apis.get(host_api_index, "Unknown Host API")
        devices.append(
            {
                "index": index,
                "name": name,
                "host_api": host_api,
                "selector": make_device_selector(host_api, name),
                "input_channels": input_channels,
                "default_sample_rate": float(info.get("defaultSampleRate") or 0),
            }
        )

    preferred = _preferred_host_api(platform_name or sys.platform)
    if mode == "standard" and preferred is not None:
        preferred_devices = [
            device
            for device in devices
            if preferred in str(device["host_api"]).casefold()
        ]
        if preferred_devices:
            return preferred_devices
    return devices


def _list_input_devices_in_current_process(
    mode: str = "standard",
) -> list[dict[str, object]]:
    audio: pyaudio.PyAudio | None = None
    try:
        audio = pyaudio.PyAudio()
        return enumerate_input_devices(
            audio,
            lambda index: pyaudio.pa.get_device_info(index).name,
            mode=mode,
        )
    except Exception as exc:
        logger.exception("Failed to enumerate audio input devices")
        raise RuntimeError("Failed to enumerate audio input devices") from exc
    finally:
        if audio is not None:
            try:
                audio.terminate()
            except Exception:
                logger.warning("Failed to terminate PyAudio after device enumeration")


def list_input_devices(mode: str = "standard") -> list[dict[str, object]]:
    if getattr(sys, "frozen", False):
        command = [sys.executable, "--audio-device-enumerator", mode]
        working_directory = None
    else:
        command = [
            sys.executable,
            "-m",
            "services.audio_device_enumerator",
            mode,
        ]
        working_directory = Path(__file__).resolve().parent.parent
    try:
        result = subprocess.run(
            command,
            cwd=working_directory,
            capture_output=True,
            check=True,
            text=True,
            timeout=30,
        )
        devices = json.loads(result.stdout)
        if not isinstance(devices, list) or any(
            not isinstance(device, dict) for device in devices
        ):
            raise ValueError("Audio device enumeration returned an invalid payload")
        return devices
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        logger.exception("Failed to enumerate audio input devices in isolated process")
        raise RuntimeError("Failed to enumerate audio input devices") from exc