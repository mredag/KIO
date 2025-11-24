@echo off
REM View Backend Logs

echo Viewing SPA Kiosk Backend Logs...
echo Press Ctrl+C to exit
echo.

REM Check if PM2 is installed
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed!
    pause
    exit /b 1
)

REM View logs with PM2
pm2 logs spa-kiosk-backend
