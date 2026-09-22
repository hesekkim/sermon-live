from __future__ import annotations

from core.config import Settings
from services.interpreters.factory import create_interpreter
from services.interpreters.protocol import KeyValidationError
from services.operator_store import OperatorSettingsStore


async def validate_operator_key(
    settings: Settings,
    store: OperatorSettingsStore,
) -> None:
    runtime = store.overlay_settings(settings)
    provider = runtime.interpreter
    if provider == "echo":
        return

    key = (
        runtime.gemini_api_key
        if provider == "gemini"
        else runtime.openai_api_key
    )
    if not key:
        store.set_key_status(provider, "missing", f"{provider.title()} API key is not set")
        return

    interpreter = create_interpreter(runtime)
    try:
        await interpreter.validate_key()
    except KeyValidationError as exc:
        store.set_key_status(provider, "invalid", str(exc))
    except Exception:
        return
    else:
        store.set_key_status(provider, "valid")