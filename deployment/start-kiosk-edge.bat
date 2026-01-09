@echo off
REM Start Microsoft Edge in Kiosk Mode for SPA Digital Kiosk

REM Wait for backend to be ready
echo Waiting for backend server...
timeout /t 5 /nobreak >nul

REM Start Edge in kiosk mode
echo Starting Microsoft Edge in kiosk mode...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ^
  --kiosk ^
  --edge-kiosk-type=fullscreen ^
  --no-first-run ^
  --disable-session-crashed-bubble ^
  http://localhost:3001/kiosk

echo Edge kiosk mode started
echo Press Ctrl+C to exit this script (Edge will continue running)
pause
