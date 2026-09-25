from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.config import get_settings
from services.audio_capture import AudioCapture
from services.audio_devices import list_input_devices
from services.audio_processor import AudioProcessor
from services.runtime import session

router = APIRouter()


class AudioDeviceResponse(BaseModel):
    index: int
    name: str
    input_channels: int
    default_sample_rate: float


class AudioTestRequest(BaseModel):
    audio_device: str | None = None


class AudioTestResponse(BaseModel):
    status: Literal["disconnected", "silent", "signal"]
    detected_sample_rate: int | None = None
    detected_channels: int | None = None
    detected_sample_width: int | None = None
    input_level_dbfs: float | None = None
    processing_sample_rate: int = 24000
    processing_channels: int = 1
    processing_sample_width: int = 2
    processing_success: bool = False
    message: str = ""


@router.get("/api/v1/audio/devices", response_model=list[AudioDeviceResponse])
def get_audio_devices() -> list[dict[str, object]]:
    return list_input_devices()


@router.post("/api/v1/audio/test", response_model=AudioTestResponse)
async def test_audio_input(request: AudioTestRequest | None = None) -> AudioTestResponse:
    if session.running:
        raise HTTPException(
            status_code=409,
            detail="Audio test is unavailable while a session is running",
        )

    settings = get_settings()
    if request is not None and request.audio_device is not None:
        settings = settings.model_copy(update={"audio_device": request.audio_device})
    capture = AudioCapture(settings)
    started = False
    try:
        await capture.start()
        started = True

        native_format = capture.input_format
        if native_format is None:
            return AudioTestResponse(
                status="disconnected",
                detected_sample_rate=None,
                detected_channels=None,
                detected_sample_width=None,
                input_level_dbfs=None,
                processing_success=False,
                message="No audio input device is available",
            )

        raw = await capture.collect(1.5)
        rate, channels, width = native_format
        processor = AudioProcessor(rate, channels, width, 24000, 1, 2)
        processed = processor.process(raw)
        level = processor.input_level_dbfs

        if raw and level is not None and level > -60.0:
            status: Literal["disconnected", "silent", "signal"] = "signal"
        else:
            status = "silent"

        return AudioTestResponse(
            status=status,
            detected_sample_rate=rate,
            detected_channels=channels,
            detected_sample_width=width,
            input_level_dbfs=level,
            processing_sample_rate=24000,
            processing_channels=1,
            processing_sample_width=2,
            processing_success=bool(processed or raw == b""),
            message="Audio device is accessible and ready for processing" if status != "silent" else "Audio device is reachable but no meaningful signal was detected",
        )
    except Exception as exc:
        return AudioTestResponse(
            status="disconnected",
            detected_sample_rate=None,
            detected_channels=None,
            detected_sample_width=None,
            input_level_dbfs=None,
            processing_sample_rate=24000,
            processing_channels=1,
            processing_sample_width=2,
            processing_success=False,
            message=str(exc) or "Audio input is not available",
        )
    finally:
        if started:
            await capture.stop()