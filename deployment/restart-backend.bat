@echo off
REM Restart Backend Server

echo Restarting SPA Kiosk Backend...

REM Check if PM2 is installed
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed!
    pause
    exit /b 1
)

REM Restart with PM2
pm2 restart spa-kiosk-backend

REM Show status
pm2 status

echo.
echo Backend restarted successfully!
echo.
echo View logs: pm2 logs spa-kiosk-backend
echo.
pause
