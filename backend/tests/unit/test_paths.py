import os
from pathlib import Path

import pytest

import core.paths as paths


def test_windows_user_data_directory_uses_local_app_data(tmp_path):
    local_app_data = tmp_path / "local-app-data"

    actual = paths.user_data_dir(
        "win32",
        environ={"LOCALAPPDATA": str(local_app_data)},
        home=tmp_path,
    )

    assert actual == local_app_data / "Sermon Live"


def test_macos_user_data_directory_uses_application_support(tmp_path):
    assert paths.user_data_dir("darwin", environ={}, home=tmp_path) == (
        tmp_path / "Library" / "Application Support" / "Sermon Live"
    )


def test_linux_user_data_directory_respects_xdg_data_home(tmp_path):
    xdg_data_home = tmp_path / "xdg-data"

    assert paths.user_data_dir(
        "linux",
        environ={"XDG_DATA_HOME": str(xdg_data_home)},
        home=tmp_path,
    ) == xdg_data_home / "sermon-live"


def test_linux_user_data_directory_defaults_under_home(tmp_path):
    assert paths.user_data_dir("linux", environ={}, home=tmp_path) == (
        tmp_path / ".local" / "share" / "sermon-live"
    )


def test_windows_user_data_directory_falls_back_to_profile(tmp_path):
    actual = paths.user_data_dir(
        "win32",
        environ={"USERPROFILE": str(tmp_path / "profile")},
        home=tmp_path,
    )

    assert actual == tmp_path / "profile" / "AppData" / "Local" / "Sermon Live"


def test_packaged_resource_paths_are_separate_from_user_data(
    monkeypatch, tmp_path
):
    bundle = tmp_path / "bundle"
    local_app_data = tmp_path / "local-app-data"
    monkeypatch.setattr(paths, "is_packaged", lambda: True)
    monkeypatch.setattr(paths.sys, "_MEIPASS", str(bundle), raising=False)
    monkeypatch.setattr(paths.sys, "platform", "win32")
    monkeypatch.setenv("LOCALAPPDATA", str(local_app_data))

    assert paths.frontend_dist_path() == bundle / "frontend" / "dist"
    assert paths.scripture_path() == (
        bundle / "backend" / "data" / "scripture" / "deu1912_vpl.xml"
    )
    assert paths.env_file_path() == local_app_data / "Sermon Live" / ".env"
    assert paths.operator_store_path() == (
        local_app_data / "Sermon Live" / "operator.json"
    )
    assert paths.log_directory() == local_app_data / "Sermon Live" / "logs"


def test_source_paths_preserve_repository_layout(monkeypatch, tmp_path):
    monkeypatch.setattr(paths, "is_packaged", lambda: False)
    monkeypatch.setattr(paths, "project_root", lambda: tmp_path)

    assert paths.env_file_path() == tmp_path / "backend" / ".env"
    assert paths.operator_store_path() == (
        tmp_path / "backend" / "data" / "operator.json"
    )
    assert paths.frontend_dist_path() == tmp_path / "frontend" / "dist"
    assert paths.log_directory() == tmp_path / "backend" / "logs"


def test_migrate_legacy_settings_once_without_overwriting_existing_data(tmp_path):
    legacy_root = tmp_path / "legacy"
    legacy_backend = legacy_root / "backend"
    legacy_data = legacy_backend / "data"
    legacy_data.mkdir(parents=True)
    (legacy_backend / ".env").write_text(
        "APP_OPERATOR_PASSWORD=legacy\n",
        encoding="utf-8",
    )
    (legacy_data / "operator.json").write_text(
        '{"interpreter":"openai"}\n',
        encoding="utf-8",
    )

    destination = tmp_path / "user-data"
    destination.mkdir()
    (destination / "operator.json").write_text(
        '{"interpreter":"echo"}\n',
        encoding="utf-8",
    )

    migrated = paths.migrate_legacy_project(legacy_root, destination)

    assert migrated == (destination / ".env",)
    assert (destination / ".env").read_text(encoding="utf-8") == (
        "APP_OPERATOR_PASSWORD=legacy\n"
    )
    assert (destination / "operator.json").read_text(encoding="utf-8") == (
        '{"interpreter":"echo"}\n'
    )
    assert paths.migrate_legacy_project(legacy_root, destination) == ()


def test_migrate_legacy_settings_does_not_create_directory_without_sources(tmp_path):
    destination = tmp_path / "user-data"

    with pytest.raises(FileNotFoundError, match="Legacy project directory not found"):
        paths.migrate_legacy_project(tmp_path / "missing", destination)
    assert not destination.exists()

    legacy_root = tmp_path / "legacy"
    legacy_root.mkdir()
    with pytest.raises(FileNotFoundError, match="No legacy"):
        paths.migrate_legacy_project(legacy_root, destination)
    assert not destination.exists()


@pytest.mark.skipif(os.name == "nt", reason="POSIX directory permissions only")
def test_user_data_directory_is_private_on_posix(tmp_path):
    directory = paths.ensure_user_data_dir(tmp_path / "user-data")

    assert directory.stat().st_mode & 0o777 == 0o700
