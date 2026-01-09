@echo off
REM Backup Database and Media Files

echo ========================================
echo SPA Kiosk - Manual Backup
echo ========================================
echo.

REM Create backup directory if it doesn't exist
if not exist "data\backups" mkdir data\backups

REM Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%-%datetime:~8,6%

echo Creating backup with timestamp: %TIMESTAMP%
echo.

REM Backup database
if exist "data\kiosk.db" (
    echo Backing up database...
    copy "data\kiosk.db" "data\backups\kiosk-backup-%TIMESTAMP%.db"
    echo Database backed up to: data\backups\kiosk-backup-%TIMESTAMP%.db
) else (
    echo [WARNING] Database file not found: data\kiosk.db
)
echo.

REM Backup media files
if exist "public\uploads" (
    echo Backing up media files...
    if not exist "data\backups\uploads-%TIMESTAMP%" mkdir "data\backups\uploads-%TIMESTAMP%"
    xcopy /E /I /Y "public\uploads" "data\backups\uploads-%TIMESTAMP%"
    echo Media files backed up to: data\backups\uploads-%TIMESTAMP%
) else (
    echo [INFO] No media files to backup
)
echo.

echo ========================================
echo Backup Complete!
echo ========================================
echo.
echo Backup location: data\backups\
echo.
pause
