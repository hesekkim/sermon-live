from pathlib import Path

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
