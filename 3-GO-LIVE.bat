@echo off
title Entry Pass - 3 of 4 - GO LIVE (every day - keep this window open)
cd /d "%~dp0"
echo.
echo ============================================
echo   STEP 3 of 4: GO LIVE  (every day)
echo ============================================
echo One-time first: run  vercel login  and
echo  vercel link  in a terminal, and put your
echo VERCEL_TOKEN in the .env.local file
echo (see SETUP.md Part 2 if you haven't).
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
