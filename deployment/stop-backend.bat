@echo off
REM Stop Backend Server

echo Stopping KIO Backend...

where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed.
    pause
    exit /b 1
)

pm2 stop kio-backend
pm2 status

echo.
echo Backend stopped successfully.
echo.
pause