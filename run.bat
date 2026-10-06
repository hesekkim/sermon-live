@echo off
setlocal
cd /d "%~dp0"

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
echo Press Ctrl+C to stop.

pushd backend
".venv\Scripts\python.exe" main.py
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
