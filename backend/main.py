import argparse
import logging
from logging.handlers import RotatingFileHandler
import sys
from contextlib import asynccontextmanager
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if (
    getattr(sys, "frozen", False)
    and len(sys.argv) > 1
    and sys.argv[1] == "--audio-device-enumerator"
):
    sys.argv = [sys.argv[0], *sys.argv[2:]]
    from services.audio_device_enumerator import main as enumerate_audio_devices

    enumerate_audio_devices()
    raise SystemExit(0)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.v1.api import api_router
from core.paths import (
    ensure_user_data_dir,
    is_packaged,
    log_directory as get_log_directory,
    migrate_legacy_project,
)
from services.broadcast import hub
from services.runtime import audio, session, settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def configure_verbose_logging(log_directory: Path | None = None) -> Path:
    directory = log_directory or get_log_directory()
    if is_packaged():
        ensure_user_data_dir()
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


def _resolve_dist_file(dist: Path, full_path: str) -> Path | None:
    if not full_path:
        return None

    dist_root = dist.resolve()
    candidate = (dist_root / full_path).resolve()
    try:
        candidate.relative_to(dist_root)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def _operator_url(scheme: str, host: str, port: int) -> str:
    if host in {"0.0.0.0", "::"}:
        host = "localhost"
    elif ":" in host and not host.startswith("["):
        host = f"[{host}]"
    return f"{scheme}://{host}:{port}/operator"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if is_packaged():
        ensure_user_data_dir()
    await audio.start()
    logger.info("Server ready. Translation sessions can be started from the operator page.")
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
            candidate = _resolve_dist_file(dist, full_path)
            if candidate is not None:
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return application


app = create_application()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Sermon Live server.")
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="enable debug logs for application services",
    )
    parser.add_argument(
        "--migrate-from",
        type=Path,
        help=(
            "import legacy backend/.env and backend/data/operator.json files, "
            "then exit"
        ),
    )
    args = parser.parse_args()
    if args.migrate_from is not None:
        if not is_packaged():
            parser.error("--migrate-from is available only in a packaged build")
        migrated = migrate_legacy_project(args.migrate_from)
        print(
            f"Imported {len(migrated)} settings file(s). "
            "Existing user data was preserved."
        )
        raise SystemExit(0)
    if args.verbose:
        log_path = configure_verbose_logging()
        logger.info("Verbose diagnostic logging enabled: %s", log_path)

    scheme = "https" if settings.ssl_certfile else "http"
    logger.info(
        "Operator URL: %s",
        _operator_url(scheme, settings.host, settings.port),
    )
    packaged = is_packaged()
    uvicorn.run(
        app if packaged or not settings.debug else "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug and not packaged,
        ssl_certfile=str(settings.ssl_certfile) if settings.ssl_certfile else None,
        ssl_keyfile=str(settings.ssl_keyfile) if settings.ssl_keyfile else None,
        log_level="debug" if args.verbose else "info",
        log_config=None if args.verbose else uvicorn.config.LOGGING_CONFIG,
    )


if __name__ == "__main__":
    main()
