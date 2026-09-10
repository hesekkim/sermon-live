from __future__ import annotations

import asyncio
import logging

from core.config import Settings
from services.audio_capture import AudioCapture
from services.broadcast import BroadcastHub
from services.interpreters.factory import create_interpreter
from services.interpreters.protocol import LiveInterpreter

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(self, settings: Settings, hub: BroadcastHub) -> None:
        self._settings = settings
        self._hub = hub
        self._interpreter: LiveInterpreter | None = None
        self._capture: AudioCapture | None = None
        self._tasks: list[asyncio.Task[None]] = []
        self._running = False

    @property
    def running(self) -> bool:
        return self._running

    async def start(self) -> None:
        if self._running:
            return
        interpreter = create_interpreter(self._settings)
        capture = AudioCapture(self._settings)
        await interpreter.start()
        try:
            await capture.start()
        except Exception:
            await interpreter.close()
            raise
        self._interpreter = interpreter
        self._capture = capture
        self._running = True
        self._tasks = [
            asyncio.create_task(self._pump_capture(), name="pump-capture"),
            asyncio.create_task(self._pump_events(), name="pump-events"),
        ]
        logger.info(
            "Session started with interpreter=%s", self._settings.interpreter
        )

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []
        if self._capture is not None:
            await self._capture.stop()
            self._capture = None
        if self._interpreter is not None:
            await self._interpreter.close()
            self._interpreter = None
        logger.info("Session stopped")

    async def _pump_capture(self) -> None:
        assert self._capture is not None
        assert self._interpreter is not None
        try:
            async for chunk in self._capture.chunks():
                if not self._running:
                    break
                await self._interpreter.send_pcm(chunk)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Capture pump error: %s", exc)

    async def _pump_events(self) -> None:
        assert self._interpreter is not None
        try:
            async for event in self._interpreter.events():
                if event.kind == "audio" and event.pcm:
                    await self._hub.broadcast_audio(event.pcm, event.sample_rate)
                elif event.kind == "text" and event.text:
                    await self._hub.broadcast_text(event.text)
                elif event.kind == "error" and event.text:
                    logger.error("Interpreter error: %s", event.text)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Interpreter event pump error: %s", exc)
