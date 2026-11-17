from __future__ import annotations

import os
import sys
from collections.abc import Mapping
from pathlib import Path

APP_DATA_NAME = "Sermon Live"


def is_packaged() -> bool:
    return bool(getattr(sys, "frozen", False))


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resource_root() -> Path:
    if is_packaged():
        bundle_root = getattr(sys, "_MEIPASS", None)
        if bundle_root is not None:
            return Path(bundle_root)
        return Path(sys.executable).resolve().parent
    return project_root()


def user_data_dir(
    platform_name: str | None = None,
    environ: Mapping[str, str] | None = None,
    home: Path | None = None,
) -> Path:
    platform_name = platform_name or sys.platform
    environ = os.environ if environ is None else environ
    home = home or Path.home()

    if platform_name == "win32":
        local_app_data = environ.get("LOCALAPPDATA")
        if local_app_data:
            return Path(local_app_data) / APP_DATA_NAME
        user_profile = environ.get("USERPROFILE")
        profile = Path(user_profile) if user_profile else home
        return profile / "AppData" / "Local" / APP_DATA_NAME

    if platform_name == "darwin":
        return home / "Library" / "Application Support" / APP_DATA_NAME

    xdg_data_home = environ.get("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home) / "sermon-live"
    return home / ".local" / "share" / "sermon-live"


def ensure_user_data_dir(directory: Path | None = None) -> Path:
    path = directory or user_data_dir()
    path.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        path.chmod(0o700)
    return path


def app_data_dir() -> Path:
    if is_packaged():
        return user_data_dir()
    return project_root() / "backend" / "data"


def env_file_path() -> Path:
    if is_packaged():
        return user_data_dir() / ".env"
    return project_root() / "backend" / ".env"


def frontend_dist_path() -> Path:
    return resource_root() / "frontend" / "dist"


def scripture_path() -> Path:
    return resource_root() / "backend" / "data" / "scripture" / "deu1912_vpl.xml"


def operator_store_path() -> Path:
    return app_data_dir() / "operator.json"


def sermon_session_store_path() -> Path:
    return app_data_dir() / "sermon_session.json"


def log_directory() -> Path:
    if is_packaged():
        return user_data_dir() / "logs"
    return project_root() / "backend" / "logs"


def migrate_legacy_project(
    legacy_project_root: Path,
    destination_data_dir: Path | None = None,
) -> tuple[Path, ...]:
    legacy_project_root = Path(legacy_project_root)
    if not legacy_project_root.is_dir():
        raise FileNotFoundError(
            f"Legacy project directory not found: {legacy_project_root}"
        )
    destination_data_dir = destination_data_dir or user_data_dir()
    legacy_files = (
        (legacy_project_root / "backend" / ".env", destination_data_dir / ".env"),
        (
            legacy_project_root / "backend" / "data" / "operator.json",
            destination_data_dir / "operator.json",
        ),
    )
    existing_sources = [
        (source, destination)
        for source, destination in legacy_files
        if source.is_file()
    ]
    if not existing_sources:
        raise FileNotFoundError(
            "No legacy backend/.env or backend/data/operator.json was found"
        )

    ensure_user_data_dir(destination_data_dir)
    migrated: list[Path] = []
    for source, destination in existing_sources:
        if destination.exists():
            continue
        contents = source.read_bytes()
        try:
            destination_file = destination.open("xb")
        except FileExistsError:
            continue
        try:
            with destination_file:
                destination_file.write(contents)
        except OSError:
            try:
                destination.unlink()
            except FileNotFoundError:
                pass
            raise
        migrated.append(destination)
    return tuple(migrated)
