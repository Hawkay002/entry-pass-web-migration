@echo off
title Entry Pass - Optional - Local test (no internet sharing)
cd /d "%~dp0"
echo.
echo ============================================
echo   OPTIONAL: LOCAL TEST MODE
echo ============================================
echo Runs everything on THIS computer only
echo (nothing shared over the internet).
echo Useful to try things safely before an event.
echo.
pause
call node scripts\start.mjs
echo.
pause
