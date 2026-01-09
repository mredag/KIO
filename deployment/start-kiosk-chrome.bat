@echo off
REM Start Chrome in Kiosk Mode for SPA Digital Kiosk

REM Wait for backend to be ready
echo Waiting for backend server...
timeout /t 5 /nobreak >nul

REM Start Chrome in kiosk mode
echo Starting Chrome in kiosk mode...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --disable-features=TranslateUI ^
  --noerrdialogs ^
  --disable-infobars ^
  --no-first-run ^
  --disable-session-crashed-bubble ^
  --disable-restore-session-state ^
  http://localhost:3001/kiosk

echo Chrome kiosk mode started
echo Press Ctrl+C to exit this script (Chrome will continue running)
pause
