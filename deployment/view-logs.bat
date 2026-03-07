@echo off
REM View Backend Logs

echo Viewing KIO Backend Logs...
echo Press Ctrl+C to exit
echo.

where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed.
    pause
    exit /b 1
)

pm2 logs kio-backend