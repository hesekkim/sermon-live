@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo npm is required to build the frontend.
    exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
    where py >nul 2>nul
    if errorlevel 1 (
        python -m venv backend\.venv
    ) else (
        py -3 -m venv backend\.venv
    )
    if errorlevel 1 exit /b 1
    set "BACKEND_ENV_CREATED=1"
)

if defined BACKEND_ENV_CREATED (
    "backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
    if errorlevel 1 exit /b 1
)

if not exist "frontend\node_modules" (
    pushd frontend
    call npm ci
    if errorlevel 1 exit /b 1
    popd
)

pushd frontend
call npm run build
if errorlevel 1 exit /b 1
popd

"backend\.venv\Scripts\python.exe" -m compileall -q backend
if errorlevel 1 exit /b 1

echo Build complete. Run run.bat to start Sermon Live.
