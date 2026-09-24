import pytest

from core.config import Settings
from services.key_validation import validate_operator_key
from services.interpreters.protocol import KeyValidationError
from services.operator_store import OperatorSettingsStore


class StubInterpreter:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    async def validate_key(self) -> None:
        if self.error:
            raise self.error


@pytest.mark.asyncio
async def test_valid_key_is_updated_without_starting_session(monkeypatch, tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="valid-key")
    monkeypatch.setattr(
        "services.key_validation.create_interpreter",
        lambda _settings: StubInterpreter(),
    )

    await validate_operator_key(Settings(interpreter="openai"), store)

    assert store.public_view(Settings(interpreter="openai"))["openai_key_status"] == "valid"


@pytest.mark.asyncio
async def test_invalid_key_is_updated_without_starting_session(monkeypatch, tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="invalid-key")
    monkeypatch.setattr(
        "services.key_validation.create_interpreter",
        lambda _settings: StubInterpreter(KeyValidationError("invalid credentials")),
    )

    await validate_operator_key(Settings(interpreter="openai"), store)

    view = store.public_view(Settings(interpreter="openai"))
    assert view["openai_key_status"] == "invalid"
    assert view["openai_key_warning"] == "invalid credentials"


@pytest.mark.asyncio
async def test_connection_failure_does_not_mark_key_invalid(monkeypatch, tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="valid-key")
    monkeypatch.setattr(
        "services.key_validation.create_interpreter",
        lambda _settings: StubInterpreter(RuntimeError("connection failed")),
    )

    await validate_operator_key(Settings(interpreter="openai"), store)

    view = store.public_view(Settings(interpreter="openai"))
    assert view["openai_key_status"] != "invalid"