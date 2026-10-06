"""Operator CLI: start the sermon-live server and capture session."""

from main import app, settings
import logging

import uvicorn
from services.network import detect_lan_ip

logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("Operator CLI starting on %s:%s", settings.host, settings.port)
    address = detect_lan_ip()
    if address:
        logger.info(
            "Congregation URL: http://%s:%s/listen", address, settings.port
        )
    else:
        logger.warning("Could not detect a LAN address for the Listener")
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
