import json
from typing import AsyncIterator, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.config import get_settings
from services.audio_capture import AudioCapture
from services.audio_devices import list_input_devices
from services.audio_processor import AudioProcessor
from services.runtime import audio, session

router = APIRouter()
AUDIO_TEST_DURATION_SECONDS = 3.0


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


def _audio_test_settings(request: AudioTestRequest):
    settings = get_settings()
    if request.audio_device is not None:
        settings = settings.model_copy(update={"audio_device": request.audio_device})
    return settings


def _audio_test_result(
    processor: AudioProcessor,
    raw: bytes,
    native_format: tuple[int, int, int],
) -> AudioTestResponse:
    rate, channels, width = native_format
    level = processor.input_level_dbfs
    status: Literal["disconnected", "silent", "signal"] = (
        "signal" if raw and level is not None and level > -60.0 else "silent"
    )
    return AudioTestResponse(
        status=status,
        detected_sample_rate=rate,
        detected_channels=channels,
        detected_sample_width=width,
        input_level_dbfs=level,
        processing_sample_rate=24000,
        processing_channels=1,
        processing_sample_width=2,
        processing_success=True,
        message=(
            "Audio device is accessible and ready for processing"
            if status != "silent"
            else "Audio device is reachable but no meaningful signal was detected"
        ),
    )


@router.get("/api/v1/audio/devices", response_model=list[AudioDeviceResponse])
def get_audio_devices() -> list[dict[str, object]]:
    return list_input_devices()


@router.post("/api/v1/audio/test", response_model=AudioTestResponse)
async def test_audio_input(request: AudioTestRequest | None = None) -> AudioTestResponse:
    if session.state in ("starting", "live", "stopping"):
        raise HTTPException(
            status_code=409,
            detail="Audio test is unavailable while a session is running",
        )

    if audio.ready:
        try:
            async with audio.using_device(request.audio_device if request else None):
                native_format = audio.input_format
                if native_format is None:
                    raise RuntimeError("Audio input device is not available")
                raw = await audio.collect(AUDIO_TEST_DURATION_SECONDS)
                rate, channels, width = native_format
                processor = AudioProcessor(rate, channels, width, 24000, 1, 2)
                processor.process(raw)
                return _audio_test_result(processor, raw, native_format)
        except Exception as exc:
            return AudioTestResponse(
                status="disconnected",
                processing_success=False,
                message=str(exc) or "Audio input is not available",
            )

    settings = _audio_test_settings(request or AudioTestRequest())
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

        raw = await capture.collect(AUDIO_TEST_DURATION_SECONDS)
        rate, channels, width = native_format
        processor = AudioProcessor(rate, channels, width, 24000, 1, 2)
        processed = processor.process(raw)
        result = _audio_test_result(processor, raw, native_format)
        result.processing_success = bool(processed or raw == b"")
        return result
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


@router.post("/api/v1/audio/test/stream")
async def stream_audio_test(request: AudioTestRequest | None = None) -> StreamingResponse:
    if session.state in ("starting", "live", "stopping"):
        raise HTTPException(
            status_code=409,
            detail="Audio test is unavailable while a session is running",
        )

    async def events() -> AsyncIterator[str]:
        if audio.ready:
            try:
                async with audio.using_device(request.audio_device if request else None):
                    native_format = audio.input_format
                    if native_format is None:
                        raise RuntimeError("Audio input device is not available")
                    rate, channels, width = native_format
                    processor = AudioProcessor(rate, channels, width, 24000, 1, 2)
                    raw_chunks: list[bytes] = []
                    async for chunk in audio.chunks_for(AUDIO_TEST_DURATION_SECONDS):
                        raw_chunks.append(chunk)
                        processor.process(chunk)
                        if processor.input_level_dbfs is not None:
                            yield json.dumps(
                                {
                                    "type": "level",
                                    "input_level_dbfs": processor.input_level_dbfs,
                                }
                            ) + "\n"
                    raw = b"".join(raw_chunks)
                    final_processor = AudioProcessor(rate, channels, width, 24000, 1, 2)
                    processed = final_processor.process(raw)
                    result = _audio_test_result(final_processor, raw, native_format)
                    result.processing_success = bool(processed or not raw_chunks)
                    yield json.dumps({"type": "result", **result.model_dump()}) + "\n"
            except Exception as exc:
                yield json.dumps(
                    {
                        "type": "result",
                        **AudioTestResponse(
                            status="disconnected",
                            processing_success=False,
                            message=str(exc) or "Audio input is not available",
                        ).model_dump(),
                    }
                ) + "\n"
            return

        settings = _audio_test_settings(request or AudioTestRequest())
        capture = AudioCapture(settings)
        started = False
        try:
            await capture.start()
            started = True
            native_format = capture.input_format
            if native_format is None:
                yield json.dumps(
                    {
                        "type": "result",
                        **AudioTestResponse(
                            status="disconnected",
                            message="No audio input device is available",
                        ).model_dump(),
                    }
                ) + "\n"
                return

            rate, channels, width = native_format
            processor = AudioProcessor(rate, channels, width, 24000, 1, 2)
            raw_chunks: list[bytes] = []
            async for chunk in capture.chunks_for(AUDIO_TEST_DURATION_SECONDS):
                raw_chunks.append(chunk)
                processor.process(chunk)
                if processor.input_level_dbfs is not None:
                    yield json.dumps(
                        {
                            "type": "level",
                            "input_level_dbfs": processor.input_level_dbfs,
                        }
                    ) + "\n"

            raw = b"".join(raw_chunks)
            final_processor = AudioProcessor(rate, channels, width, 24000, 1, 2)
            processed = final_processor.process(raw)
            result = _audio_test_result(final_processor, raw, native_format)
            result.processing_success = bool(
                processed or not raw_chunks
            )
            yield json.dumps({"type": "result", **result.model_dump()}) + "\n"
        except Exception as exc:
            yield json.dumps(
                {
                    "type": "result",
                    **AudioTestResponse(
                        status="disconnected",
                        processing_success=False,
                        message=str(exc) or "Audio input is not available",
                    ).model_dump(),
                }
            ) + "\n"
        finally:
            if started:
                await capture.stop()

    return StreamingResponse(events(), media_type="application/x-ndjson")