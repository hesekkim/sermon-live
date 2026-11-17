$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot "backend\.venv\Scripts\python.exe"
$packageDirectory = Join-Path $projectRoot "dist\sermon-live"
$archivePath = Join-Path $projectRoot "dist\sermon-live-windows-x64.zip"

Push-Location $projectRoot
try {
    & $env:ComSpec /c "build.bat"
    if ($LASTEXITCODE -ne 0) {
        throw "The project build failed."
    }

    & $python -m pip install -r backend\requirements-packaging.txt
    if ($LASTEXITCODE -ne 0) {
        throw "Installing packaging dependencies failed."
    }

    & $python -m PyInstaller --noconfirm --clean packaging\sermon_live.spec
    if ($LASTEXITCODE -ne 0) {
        throw "The Windows package build failed."
    }

    if (-not (Test-Path $packageDirectory)) {
        throw "PyInstaller did not create the expected package directory."
    }

    Copy-Item packaging\windows\README.txt (Join-Path $packageDirectory "README.txt") -Force
    Compress-Archive -Path (Join-Path $packageDirectory "*") -DestinationPath $archivePath -CompressionLevel Optimal -Force

    Write-Output "Created $archivePath"
}
finally {
    Pop-Location
}
