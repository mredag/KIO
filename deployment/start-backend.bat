@echo off
REM Start Backend Server with PM2

echo Starting SPA Kiosk Backend...

REM Check if PM2 is installed
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed!
    echo Please install PM2: npm install -g pm2
    pause
    exit /b 1
)

REM Start with PM2
pm2 start deployment\ecosystem.config.js

REM Save PM2 configuration
pm2 save

REM Show status
pm2 status

echo.
echo Backend started successfully!
echo.
echo View logs: pm2 logs spa-kiosk-backend
echo Stop server: pm2 stop spa-kiosk-backend
echo Restart server: pm2 restart spa-kiosk-backend
echo.
pause
