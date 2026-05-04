@echo off
echo.
echo ============================================
echo   Strava Auto Activity Generator
echo ============================================
echo.

set "NODE_PATH=%~dp0.node\node-v22.15.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

:: Check if node_modules exists
if not exist "%~dp0node_modules" (
    echo Installing dependencies...
    call "%NODE_PATH%\npm.cmd" install
    echo.
)

echo Starting server...
echo.
"%NODE_PATH%\node.exe" "%~dp0server.js"
pause
