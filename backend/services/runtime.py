from core.config import get_settings
from services.audio_runtime import AudioRuntime
from services.broadcast import hub
from services.session_service import SessionService

settings = get_settings()
audio = AudioRuntime(settings, hub)
session = SessionService(settings, hub, audio)
