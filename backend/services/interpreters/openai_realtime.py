from services.interpreters.protocol import InterpreterEvent


class OpenAIRealtimeInterpreter:
    """Stub. Implement OpenAI Realtime behind the same LiveInterpreter protocol."""

    async def start(self) -> None:
        raise NotImplementedError(
            "OpenAI Realtime adapter is not implemented. "
            "Set APP_INTERPRETER=echo or APP_INTERPRETER=gemini."
        )

    async def send_pcm(self, chunk: bytes) -> None:
        raise NotImplementedError("OpenAI Realtime adapter is not implemented.")

    async def events(self):
        if False:
            yield InterpreterEvent(kind="error", text="unreachable")
        raise NotImplementedError("OpenAI Realtime adapter is not implemented.")

    async def close(self) -> None:
        return None
