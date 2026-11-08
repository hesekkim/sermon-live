import argparse
import logging
from logging.handlers import RotatingFileHandler
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
from services.network import detect_lan_ip
from services.runtime import audio, session, settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def configure_verbose_logging(log_directory: Path | None = None) -> Path:
    directory = log_directory or backend_dir / "logs"
    directory.mkdir(parents=True, exist_ok=True)
    log_path = directory / "sermon-live.log"
    handler = RotatingFileHandler(
        log_path,
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
    )
    logging.getLogger().addHandler(handler)
    for logger_name in ("services", "api", "core", "__main__", "main"):
        logging.getLogger(logger_name).setLevel(logging.DEBUG)
    return log_path


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await audio.start()
    logger.info("HTTP ready. Translation sessions can be started from the operator page.")
    try:
        yield
    finally:
        await session.shutdown()
        await audio.stop()
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
    parser = argparse.ArgumentParser(description="Run the Sermon Live server.")
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="enable debug logs for application services",
    )
    args = parser.parse_args()
    if args.verbose:
        log_path = configure_verbose_logging()
        logger.info("Verbose diagnostic logging enabled: %s", log_path)

    logger.info("HTTP http://%s:%s", settings.host, settings.port)
    address = detect_lan_ip()
    if address:
        logger.info("Congregation URL: http://%s:%s/listen", address, settings.port)
    else:
        logger.warning("Could not detect a LAN address for the Listener")
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if args.verbose else "info",
        log_config=None if args.verbose else "default",
    )
