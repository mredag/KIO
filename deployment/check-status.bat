@echo off
REM Check System Status

echo ========================================
echo SPA Kiosk - System Status
echo ========================================
echo.

echo [1] Node.js Version:
node --version
echo.

echo [2] PM2 Status:
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo PM2 is not installed
) else (
    pm2 status
)
echo.

echo [3] Database Status:
if exist "data\kiosk.db" (
    echo Database exists: data\kiosk.db
    for %%A in ("data\kiosk.db") do echo Size: %%~zA bytes
) else (
    echo [WARNING] Database not found!
)
echo.

echo [4] Backend Build Status:
if exist "backend\dist\index.js" (
    echo Backend is built
) else (
    echo [WARNING] Backend not built! Run: npm run build:backend
)
echo.

echo [5] Frontend Build Status:
if exist "frontend\dist\index.html" (
    echo Frontend is built
) else (
    echo [WARNING] Frontend not built! Run: npm run build:frontend
)
echo.

echo [6] Environment Files:
if exist "backend\.env" (
    echo backend\.env exists
) else (
    echo [WARNING] backend\.env not found!
)
if exist "frontend\.env.production" (
    echo frontend\.env.production exists
) else (
    echo [INFO] frontend\.env.production not found (optional)
)
echo.

echo [7] Network Information:
ipconfig | findstr /C:"IPv4"
echo.

echo [8] Port 3001 Status:
netstat -ano | findstr :3001
if %ERRORLEVEL% NEQ 0 (
    echo Port 3001 is available
) else (
    echo Port 3001 is in use
)
echo.

echo ========================================
echo Status Check Complete
echo ========================================
echo.
pause
