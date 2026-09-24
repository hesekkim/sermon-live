import asyncio
from collections.abc import AsyncIterator

from services.interpreters.protocol import InterpreterEvent


class EchoInterpreter:
    """Passes mic PCM through for local tests without a paid API."""

    def __init__(self, sample_rate: int = 16000) -> None:
        self._sample_rate = sample_rate
        self._queue: asyncio.Queue[InterpreterEvent | None] = asyncio.Queue()
        self._started = False

    @property
    def required_sample_rate(self) -> int:
        return self._sample_rate

    @property
    def required_channels(self) -> int:
        return 1

    @property
    def required_sample_width(self) -> int:
        return 2

    async def validate_key(self) -> None:
        return None

    async def start(self) -> None:
        self._started = True

    async def send_pcm(self, chunk: bytes) -> None:
        if not self._started or not chunk:
            return
        await self._queue.put(
            InterpreterEvent(kind="audio", pcm=chunk, sample_rate=self._sample_rate)
        )

    async def events(self) -> AsyncIterator[InterpreterEvent]:
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item

    async def close(self) -> None:
        self._started = False
        await self._queue.put(None)
