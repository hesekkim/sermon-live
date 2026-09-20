import logging
import socket
import sys
from contextlib import asynccontextmanager
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.v1.api import api_router
from services.broadcast import hub
from services.runtime import session, settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

def lan_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return "127.0.0.1"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("HTTP ready. Start capture from the operator page.")
    yield
    await session.stop()
    await hub.close_all()
    logger.info("Application shutdown")


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router)

    dist = settings.frontend_dist_path
    if dist.is_dir():
        assets = dist / "assets"
        if assets.is_dir():
            application.mount(
                "/assets",
                StaticFiles(directory=str(assets)),
                name="assets",
            )

        @application.get("/{full_path:path}")
        async def spa(full_path: str):
            candidate = dist / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return application


app = create_application()


if __name__ == "__main__":
    ip = lan_ip()
    logger.info("HTTP http://%s:%s", settings.host, settings.port)
    logger.info("Listen page http://%s:%s/listen", ip, settings.port)
    logger.info("Operator page http://%s:%s/operator", ip, settings.port)
    logger.info("WebSocket ws://%s:%s/ws/listen", ip, settings.port)
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
