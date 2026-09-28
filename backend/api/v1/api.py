from fastapi import APIRouter

from api.v1.endpoints.auth import router as auth_router
from api.v1.endpoints.audio import router as audio_router
from api.v1.endpoints.listen import router as listen_router
from api.v1.endpoints.operator import router as operator_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(audio_router)
api_router.include_router(listen_router)
api_router.include_router(operator_router)
