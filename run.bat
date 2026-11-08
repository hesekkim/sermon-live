@echo off
setlocal
cd /d "%~dp0"

set "RUN_VERBOSE="
if /I "%~1"=="--verbose" (
    if not "%~2"=="" (
        echo Usage: run.bat [--verbose]
        exit /b 2
    )
    set "RUN_VERBOSE=1"
) else if not "%~1"=="" (
    echo Usage: run.bat [--verbose]
    exit /b 2
)

if not exist "frontend\dist\index.html" (
    echo Frontend build not found. Run build.bat first.
    exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo Backend Python environment not found. Follow the backend setup instructions in README.md first.
    exit /b 1
)

echo Starting Sermon Live.
echo Operator: http://localhost:8080/operator
echo Listener: http://localhost:8080/listen
if defined RUN_VERBOSE (
    echo Verbose logs: backend\logs\sermon-live.log
    echo Log rotation: 5 MB per file, 3 archived files retained.
)
echo Press Ctrl+C to stop.

pushd backend
if defined RUN_VERBOSE (
    ".venv\Scripts\python.exe" main.py --verbose
) else (
    ".venv\Scripts\python.exe" main.py
)
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
