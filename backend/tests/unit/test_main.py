from pathlib import Path

from main import _resolve_dist_file


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
