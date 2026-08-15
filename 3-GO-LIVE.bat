@echo off
title Entry Pass - 3 of 4 - GO LIVE (every day - keep this window open)
cd /d "%~dp0"
echo.
echo ============================================
echo   STEP 3 of 4: GO LIVE  (every day)
echo ============================================
echo First time only: your browser will open a
echo Vercel page - click Approve there. That is
echo the only click Vercel ever needs from you.
echo Everything else is automatic.
echo.
echo KEEP THIS WINDOW OPEN while the app is in
echo use - it keeps the connection alive.
echo.
pause
call node scripts\go-live.mjs
echo.
echo If you see an error above, read it - it
echo explains what to do. Otherwise you are LIVE.
echo.
pause
