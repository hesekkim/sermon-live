from core.config import Settings
from services.operator_store import OperatorSettingsStore


def test_save_and_public_view_masks_keys(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="secret-key")
    view = store.public_view(Settings(interpreter="echo", openai_api_key=""))

    assert view["interpreter"] == "openai"
    assert view["openai_key_set"] is True
    assert view["openai_key_masked"] == "secr...-key"
    raw = (tmp_path / "operator.json").read_text(encoding="utf-8")
    assert "secret-key" in raw
    assert "secret-key" not in str(view)


def test_empty_key_keeps_previous(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="keep-me")
    store.save(interpreter="openai", openai_api_key="")
    record = store.load()
    assert record.openai_api_key == "keep-me"


def test_overlay_uses_json_over_env(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="from-json")
    overlay = store.overlay_settings(
        Settings(interpreter="echo", openai_api_key="from-env")
    )
    assert overlay.interpreter == "openai"
    assert overlay.openai_api_key == "from-json"


def test_public_view_includes_openai_environment_key(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    view = store.public_view(
        Settings(interpreter="openai", openai_api_key="from-env")
    )

    assert view["openai_key_set"] is True
    assert view["openai_key_masked"] == "fr...nv"


def test_public_view_reports_key_status_for_saved_values(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="secret-key")
    view = store.public_view(Settings(interpreter="openai", openai_api_key=""))

    assert view["openai_key_status"] == "missing"
    assert view["openai_key_warning"] == "OpenAI API key is not set"


def test_set_key_status_persists_public_status_without_exposing_key(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="secret-key")
    store.set_key_status("openai", "invalid", "OpenAI API key is invalid")

    view = store.public_view(Settings(interpreter="openai", openai_api_key=""))

    assert view["openai_key_status"] == "invalid"
    assert view["openai_key_warning"] == "OpenAI API key is invalid"
    assert "secret-key" not in str(view)


def test_public_view_reports_missing_when_key_is_empty(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    view = store.public_view(Settings(interpreter="openai", openai_api_key=""))

    assert view["openai_key_status"] == "missing"
    assert view["openai_key_warning"] == "OpenAI API key is not set"
