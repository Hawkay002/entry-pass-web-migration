@echo off
title Entry Pass - Emergency dashboard unlock
cd /d "%~dp0..\.."
echo.
echo ============================================
echo   EMERGENCY DASHBOARD UNLOCK
echo ============================================
echo Use this ONLY if you are locked out of the
echo database dashboard (the email codes stopped
echo arriving and you can't sign in).
echo.
echo What it does: resets the dashboard password
echo to a temporary one (password-only sign-in,
echo no email code) and restarts the database.
echo Your DATA is not touched.
echo.
echo The new password is shown at the end -
edge WRITE IT DOWN before closing.
echo.
pause
call node "scripts\dashboard-unlock.mjs"
echo.
pause
