from dataclasses import dataclass
from typing import AsyncIterator, Literal, Protocol

EventKind = Literal["audio", "text", "input_text", "output_text", "error"]


class KeyValidationError(Exception):
    pass


@dataclass(slots=True)
class InterpreterEvent:
    kind: EventKind
    pcm: bytes | None = None
    sample_rate: int = 24000
    text: str | None = None


class LiveInterpreter(Protocol):
    required_sample_rate: int
    required_channels: int
    required_sample_width: int

    async def validate_key(self) -> None: ...

    async def start(self) -> None: ...

    async def send_pcm(self, chunk: bytes) -> None: ...

    def events(self) -> AsyncIterator[InterpreterEvent]: ...

    async def close(self) -> None: ...
