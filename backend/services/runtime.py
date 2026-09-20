from core.config import get_settings
from services.broadcast import hub
from services.session_service import SessionService

settings = get_settings()
session = SessionService(settings, hub)
