@echo off
title Entry Pass - 2 of 4 - Setup database and logins (first time only)
cd /d "%~dp0"
echo.
echo ============================================
echo   STEP 2 of 4: SETUP  (first time only)
echo ============================================
echo This asks a few questions and prepares the
echo database and your logins. WRITE DOWN both
echo email-and-password pairs it asks for!
echo.
echo Tip: to type in the window, click it first.
echo.
pause
call node scripts\setup.mjs
echo.
pause
