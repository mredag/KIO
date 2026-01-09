@echo off
REM SPA Digital Kiosk - Windows Deployment Script
REM Automates the complete deployment process

echo ==========================================
echo SPA Digital Kiosk - Windows Deployment
echo ==========================================
echo.

REM Check Node.js
echo Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js not found. Please install Node.js 18+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo OK Node.js installed
echo.

REM Install dependencies
echo Installing dependencies...
call npm install --production
if %ERRORLEVEL% NEQ 0 (
    echo X Failed to install root dependencies
    pause
    exit /b 1
)

cd backend
call npm install --production
if %ERRORLEVEL% NEQ 0 (
    echo X Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)
cd ..

cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo X Failed to install frontend dependencies
    cd ..
    pause
    exit /b 1
)
cd ..
echo OK Dependencies installed
echo.

REM Build frontend
echo Building frontend...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo X Frontend build failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo OK Frontend built
echo.

REM Initialize database
echo Initializing database...
if not exist "data" mkdir data
if not exist "data\backups" mkdir data\backups

cd backend
if not exist "..\data\kiosk.db" (
    call npm run db:init
    call npm run db:seed
    echo OK Database initialized with sample data
) else (
    echo ! Database already exists, skipping initialization
)
cd ..
echo.

REM Start backend
echo Starting backend...
cd deployment
call start-backend.bat
cd ..
echo.

REM Wait for backend
echo Waiting for backend to start...
timeout /t 5 /nobreak >nul
echo.

REM Check backend health
curl -s http://localhost:3001/api/kiosk/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo OK Backend is running
) else (
    echo ! Backend may not be running properly
    echo   Check logs in: logs\backend.log
)
echo.

echo ==========================================
echo OK Deployment Complete!
echo ==========================================
echo.
echo Access the application:
echo   Kiosk: http://localhost:3000
echo   Admin: http://localhost:3000/admin
echo.
echo Default credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo ! Change the password after first login!
echo.
echo To start kiosk in fullscreen:
echo   cd deployment
echo   start-kiosk-chrome.bat
echo.
pause
