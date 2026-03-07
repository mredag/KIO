@echo off
REM Restart Backend Server

echo Restarting KIO Backend...

where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed.
    pause
    exit /b 1
)

pm2 restart kio-backend
pm2 status

echo.
echo Backend restarted successfully.
echo View logs: pm2 logs kio-backend
echo.
pause