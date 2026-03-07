@echo off
REM Start Backend Server with PM2

cd /d %~dp0\..

echo Starting KIO Backend...

where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed.
    echo Please install PM2: npm install -g pm2
    pause
    exit /b 1
)

pm2 delete kio-backend 2>nul
pm2 start npm --name kio-backend -- run start --workspace=backend
pm2 save
pm2 status

echo.
echo Backend started successfully.
echo View logs: pm2 logs kio-backend
echo Stop server: pm2 stop kio-backend
echo Restart server: pm2 restart kio-backend
echo.
pause