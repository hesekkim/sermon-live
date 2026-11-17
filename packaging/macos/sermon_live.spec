from pathlib import Path

project_root = Path(SPECPATH).resolve().parents[1]

analysis = Analysis(
    [str(project_root / "backend" / "main.py")],
    pathex=[str(project_root / "backend")],
    binaries=[],
    datas=[
        (str(project_root / "frontend" / "dist"), "frontend/dist"),
        (
            str(project_root / "backend" / "data" / "scripture"),
            "backend/data/scripture",
        ),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(analysis.pure)

executable = EXE(
    pyz,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="sermon-live",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
)

package = COLLECT(
    executable,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="sermon-live",
)

application = BUNDLE(
    package,
    name="Sermon Live.app",
    icon=None,
    bundle_identifier="com.hesekkim.sermon-live",
    info_plist={
        "CFBundleDisplayName": "Sermon Live",
        "NSMicrophoneUsageDescription": (
            "Sermon Live needs microphone access to capture audio for live "
            "interpretation."
        ),
    },
)
