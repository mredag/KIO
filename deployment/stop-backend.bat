@echo off
REM Stop Backend Server

echo Stopping SPA Kiosk Backend...

REM Check if PM2 is installed
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed!
    pause
    exit /b 1
)

REM Stop with PM2
pm2 stop spa-kiosk-backend

REM Show status
pm2 status

echo.
echo Backend stopped successfully!
echo.
pause
