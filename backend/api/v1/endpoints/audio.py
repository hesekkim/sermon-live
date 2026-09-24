from fastapi import APIRouter
from pydantic import BaseModel

from services.audio_devices import list_input_devices

router = APIRouter()


class AudioDeviceResponse(BaseModel):
    index: int
    name: str
    input_channels: int
    default_sample_rate: float


@router.get("/api/v1/audio/devices", response_model=list[AudioDeviceResponse])
def get_audio_devices() -> list[dict[str, object]]:
    return list_input_devices()