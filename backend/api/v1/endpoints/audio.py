import json
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.config import Settings, get_settings
from services.audio_capture import AudioCapture
from services.audio_devices import list_input_devices
from services.audio_processor import AudioProcessor
from services.interpreters.factory import create_interpreter
from services.operator_store import store as operator_store
from services.runtime import audio, session
from services.operator_auth import require_http_operator

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
    capture_sample_rate: int | None = None
    capture_channels: int | None = None
    capture_sample_width: int | None = None
    input_level_dbfs: float | None = None
    processing_sample_rate: int = 0
    processing_channels: int = 0
    processing_sample_width: int = 0
    processing_success: bool = False
    message: str = ""


def _processing_target(settings: Settings) -> tuple[int, int, int]:
    interpreter = create_interpreter(settings)
    return (
        interpreter.required_sample_rate,
        interpreter.required_channels,
        interpreter.required_sample_width,
    )


def _audio_test_settings(request: AudioTestRequest) -> Settings:
    settings = operator_store.overlay_settings(get_settings())
    if request.audio_device is not None:
        settings = settings.model_copy(update={"audio_device": request.audio_device})
    return settings


def _audio_test_result(
    processor: AudioProcessor,
    raw: bytes,
    native_format: tuple[int, int, int],
    target_format: tuple[int, int, int],
    processing_success: bool,
) -> AudioTestResponse:
    rate, channels, width = native_format
    level = processor.input_level_dbfs
    status: Literal["disconnected", "silent", "signal"] = (
        "signal" if raw and level is not None and level > -60.0 else "silent"
    )
    return AudioTestResponse(
        status=status,
        capture_sample_rate=rate,
        capture_channels=channels,
        capture_sample_width=width,
        input_level_dbfs=level,
        processing_sample_rate=target_format[0],
        processing_channels=target_format[1],
        processing_sample_width=target_format[2],
        processing_success=processing_success,
        message=(
            "Audio device is accessible and ready for processing"
            if status != "silent"
            else "Audio device is reachable but no meaningful signal was detected"
        ),
    )


@router.get(
    "/api/v1/audio/devices",
    response_model=list[AudioDeviceResponse],
    dependencies=[Depends(require_http_operator)],
)
def get_audio_devices() -> list[dict[str, object]]:
    return list_input_devices()


@router.post(
    "/api/v1/audio/test",
    response_model=AudioTestResponse,
    dependencies=[Depends(require_http_operator)],
)
async def test_audio_input(request: AudioTestRequest | None = None) -> AudioTestResponse:
    if session.state in ("starting", "live", "stopping"):
        raise HTTPException(
            status_code=409,
            detail="Audio test is unavailable while a session is running",
        )

    settings = _audio_test_settings(request or AudioTestRequest())
    target_format = _processing_target(settings)
    if audio.ready:
        try:
            async with audio.using_device(request.audio_device if request else None):
                native_format = audio.input_format
                if native_format is None:
                    raise RuntimeError("Audio input device is not available")
                raw = await audio.collect(AUDIO_TEST_DURATION_SECONDS)
                rate, channels, width = native_format
                processor = AudioProcessor(rate, channels, width, *target_format)
                processor.process(raw)
                processor.flush()
                return _audio_test_result(
                    processor, raw, native_format, target_format, True
                )
        except Exception as exc:
            return AudioTestResponse(
                status="disconnected",
                processing_sample_rate=target_format[0],
                processing_channels=target_format[1],
                processing_sample_width=target_format[2],
                processing_success=False,
                message=str(exc) or "Audio input is not available",
            )

    capture = AudioCapture(settings)
    started = False
    try:
        await capture.start()
        started = True

        native_format = capture.input_format
        if native_format is None:
            return AudioTestResponse(
                status="disconnected",
                capture_sample_rate=None,
                capture_channels=None,
                capture_sample_width=None,
                input_level_dbfs=None,
                processing_sample_rate=target_format[0],
                processing_channels=target_format[1],
                processing_sample_width=target_format[2],
                processing_success=False,
                message="No audio input device is available",
            )

        raw = await capture.collect(AUDIO_TEST_DURATION_SECONDS)
        rate, channels, width = native_format
        processor = AudioProcessor(rate, channels, width, *target_format)
        processor.process(raw)
        processor.flush()
        return _audio_test_result(processor, raw, native_format, target_format, True)
    except Exception as exc:
        return AudioTestResponse(
            status="disconnected",
            capture_sample_rate=None,
            capture_channels=None,
            capture_sample_width=None,
            input_level_dbfs=None,
            processing_sample_rate=target_format[0],
            processing_channels=target_format[1],
            processing_sample_width=target_format[2],
            processing_success=False,
            message=str(exc) or "Audio input is not available",
        )
    finally:
        if started:
            await capture.stop()


@router.post(
    "/api/v1/audio/test/stream", dependencies=[Depends(require_http_operator)]
)
async def stream_audio_test(request: AudioTestRequest | None = None) -> StreamingResponse:
    if session.state in ("starting", "live", "stopping"):
        raise HTTPException(
            status_code=409,
            detail="Audio test is unavailable while a session is running",
        )

    settings = _audio_test_settings(request or AudioTestRequest())
    target_format = _processing_target(settings)

    async def events() -> AsyncIterator[str]:
        if audio.ready:
            try:
                async with audio.using_device(request.audio_device if request else None):
                    native_format = audio.input_format
                    if native_format is None:
                        raise RuntimeError("Audio input device is not available")
                    rate, channels, width = native_format
                    processor = AudioProcessor(rate, channels, width, *target_format)
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
                    processor.flush()
                    final_processor = AudioProcessor(
                        rate, channels, width, *target_format
                    )
                    final_processor.process(raw)
                    final_processor.flush()
                    result = _audio_test_result(
                        final_processor, raw, native_format, target_format, True
                    )
                    yield json.dumps({"type": "result", **result.model_dump()}) + "\n"
            except Exception as exc:
                yield json.dumps(
                    {
                        "type": "result",
                        **AudioTestResponse(
                            status="disconnected",
                            processing_sample_rate=target_format[0],
                            processing_channels=target_format[1],
                            processing_sample_width=target_format[2],
                            processing_success=False,
                            message=str(exc) or "Audio input is not available",
                        ).model_dump(),
                    }
                ) + "\n"
            return

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
                            processing_sample_rate=target_format[0],
                            processing_channels=target_format[1],
                            processing_sample_width=target_format[2],
                            message="No audio input device is available",
                        ).model_dump(),
                    }
                ) + "\n"
                return

            rate, channels, width = native_format
            target_format = _processing_target(settings)
            processor = AudioProcessor(rate, channels, width, *target_format)
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
            processor.flush()
            final_processor = AudioProcessor(rate, channels, width, *target_format)
            final_processor.process(raw)
            final_processor.flush()
            result = _audio_test_result(
                final_processor, raw, native_format, target_format, True
            )
            yield json.dumps({"type": "result", **result.model_dump()}) + "\n"
        except Exception as exc:
            yield json.dumps(
                {
                    "type": "result",
                    **AudioTestResponse(
                        status="disconnected",
                        processing_sample_rate=target_format[0],
                        processing_channels=target_format[1],
                        processing_sample_width=target_format[2],
                        processing_success=False,
                        message=str(exc) or "Audio input is not available",
                    ).model_dump(),
                }
            ) + "\n"
        finally:
            if started:
                await capture.stop()

    return StreamingResponse(events(), media_type="application/x-ndjson")