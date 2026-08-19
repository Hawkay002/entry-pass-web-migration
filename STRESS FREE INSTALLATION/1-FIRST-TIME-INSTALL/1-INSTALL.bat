@echo off
title Entry Pass - 1 of 4 - Install (first time only)
cd /d "%~dp0..\.."
echo.
echo ============================================
echo   STEP 1 of 4: INSTALL  (first time only)
echo ============================================
echo This installs the app's building blocks.
echo A window with scrolling text will open - wait
echo for it to say "Done" (a minute or two).
echo.
pause
start "Installing..." cmd /c "cd /d "%~dp0..\.." && pnpm install && echo. && echo ============ DONE ============ && pause"
echo.
echo When that window says DONE, close it and
echo double-click  2-SETUP.bat  next.
echo.
pause
