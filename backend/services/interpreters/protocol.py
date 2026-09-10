from dataclasses import dataclass
from typing import AsyncIterator, Literal, Protocol

EventKind = Literal["audio", "text", "error"]


@dataclass(slots=True)
class InterpreterEvent:
    kind: EventKind
    pcm: bytes | None = None
    sample_rate: int = 24000
    text: str | None = None


class LiveInterpreter(Protocol):
    async def start(self) -> None: ...

    async def send_pcm(self, chunk: bytes) -> None: ...

    def events(self) -> AsyncIterator[InterpreterEvent]: ...

    async def close(self) -> None: ...
