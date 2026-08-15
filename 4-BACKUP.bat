@echo off
title Entry Pass - 4 of 4 - Backup your data
cd /d "%~dp0"
echo.
echo ============================================
echo   STEP 4 of 4: BACKUP your data
echo ============================================
echo Saves ALL tickets, staff and settings into
echo a dated zip file inside the  backups  folder.
echo Copy that zip to a USB drive or cloud folder.
echo.
pause
call node scripts\backup.mjs
echo.
pause
