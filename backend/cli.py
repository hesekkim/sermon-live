"""Operator CLI: start the sermon-live server and capture session."""

from main import app, lan_ip, settings
import logging

import uvicorn

logger = logging.getLogger(__name__)


def main() -> None:
    ip = lan_ip()
    logger.info("Operator CLI starting on %s:%s", settings.host, settings.port)
    logger.info("Congregation URL: http://%s:%s/listen", ip, settings.port)
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
