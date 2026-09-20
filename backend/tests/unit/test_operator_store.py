from core.config import Settings
from services.operator_store import OperatorSettingsStore


def test_save_and_public_view_masks_keys(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="gemini", gemini_api_key="secret-key")
    view = store.public_view(Settings(interpreter="echo", gemini_api_key=""))

    assert view["interpreter"] == "gemini"
    assert view["gemini_key_set"] is True
    assert view["openai_key_set"] is False
    assert view["gemini_key_masked"] == "secr...-key"
    raw = (tmp_path / "operator.json").read_text(encoding="utf-8")
    assert "secret-key" in raw
    assert "secret-key" not in str(view)


def test_empty_key_keeps_previous(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="gemini", gemini_api_key="keep-me")
    store.save(interpreter="gemini", gemini_api_key="")
    record = store.load()
    assert record.gemini_api_key == "keep-me"


def test_overlay_uses_json_over_env(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="gemini", gemini_api_key="from-json")
    overlay = store.overlay_settings(
        Settings(interpreter="echo", gemini_api_key="from-env")
    )
    assert overlay.interpreter == "gemini"
    assert overlay.gemini_api_key == "from-json"


def test_overlay_includes_openai_key(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    store.save(interpreter="openai", openai_api_key="from-json")
    overlay = store.overlay_settings(Settings(interpreter="echo"))
    assert overlay.interpreter == "openai"
    assert overlay.openai_api_key == "from-json"


def test_public_view_includes_openai_environment_key(tmp_path):
    store = OperatorSettingsStore(tmp_path / "operator.json")
    view = store.public_view(
        Settings(interpreter="openai", openai_api_key="from-env")
    )

    assert view["openai_key_set"] is True
    assert view["openai_key_masked"] == "fr...nv"
