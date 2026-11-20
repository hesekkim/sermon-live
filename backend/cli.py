"""Operator CLI: start the sermon-live server and capture session."""

from main import app, settings
import logging

import uvicorn

logger = logging.getLogger(__name__)


def main() -> None:
    scheme = "https" if settings.ssl_certfile else "http"
    logger.info("Operator CLI starting on %s://%s:%s", scheme, settings.host, settings.port)
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=False,
        ssl_certfile=str(settings.ssl_certfile) if settings.ssl_certfile else None,
        ssl_keyfile=str(settings.ssl_keyfile) if settings.ssl_keyfile else None,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
