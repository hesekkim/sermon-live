import sys
from pathlib import Path

from core.config import Settings
import main as main_module
from main import _operator_url, _resolve_dist_file


def test_resolve_dist_file_rejects_paths_outside_distribution(tmp_path: Path):
    dist = tmp_path / "dist"
    dist.mkdir()
    public_file = dist / "assets" / "app.js"
    public_file.parent.mkdir()
    public_file.write_text("public", encoding="utf-8")
    private_file = tmp_path / "private.env"
    private_file.write_text("private", encoding="utf-8")

    assert _resolve_dist_file(dist, "assets/app.js") == public_file.resolve()
    assert _resolve_dist_file(dist, "../private.env") is None
    assert _resolve_dist_file(dist, "") is None


def test_operator_url_uses_loopback_for_wildcard_bind_addresses():
    assert _operator_url("http", "0.0.0.0", 8080) == (
        "http://localhost:8080/operator"
    )
    assert _operator_url("https", "::", 8080) == (
        "https://localhost:8080/operator"
    )


def test_operator_url_brackets_explicit_ipv6_host():
    assert _operator_url("https", "::1", 8443) == (
        "https://[::1]:8443/operator"
    )


def test_main_passes_tls_paths_to_uvicorn(monkeypatch, tmp_path):
    certfile = tmp_path / "lan.pem"
    keyfile = tmp_path / "lan-key.pem"
    settings = Settings(
        _env_file=None,
        ssl_certfile=certfile,
        ssl_keyfile=keyfile,
    )
    run_calls = []
    monkeypatch.setattr(main_module, "settings", settings)
    monkeypatch.setattr(main_module, "is_packaged", lambda: True)
    monkeypatch.setattr(main_module, "detect_lan_ip", lambda: "192.168.1.20")
    monkeypatch.setattr(sys, "argv", ["main"])
    monkeypatch.setattr(
        main_module.uvicorn,
        "run",
        lambda *args, **kwargs: run_calls.append(kwargs),
    )

    main_module.main()

    assert len(run_calls) == 1
    assert run_calls[0]["ssl_certfile"] == str(certfile)
    assert run_calls[0]["ssl_keyfile"] == str(keyfile)


def test_main_keeps_http_when_tls_is_not_configured(monkeypatch):
    run_calls = []
    monkeypatch.setattr(
        main_module,
        "settings",
        Settings(_env_file=None),
    )
    monkeypatch.setattr(main_module, "is_packaged", lambda: True)
    monkeypatch.setattr(main_module, "detect_lan_ip", lambda: None)
    monkeypatch.setattr(sys, "argv", ["main"])
    monkeypatch.setattr(
        main_module.uvicorn,
        "run",
        lambda *args, **kwargs: run_calls.append(kwargs),
    )

    main_module.main()

    assert len(run_calls) == 1
    assert run_calls[0]["ssl_certfile"] is None
    assert run_calls[0]["ssl_keyfile"] is None
