@echo off
title Step 0a - Check what this computer has
cd /d "%~dp0..\.."
echo.
echo ==========================================
echo   CHECK: what this computer already has
echo ==========================================
echo.
echo  [OK]      = installed, nothing to do
echo  [MISSING] = needs installing (step 0b)
echo.
set ALLOK=1

where node >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%v in ('node --version') do echo   [OK]      Node.js         %%v
) else (
  echo   [MISSING] Node.js
  set ALLOK=0
)

where pnpm >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%v in ('pnpm --version') do echo   [OK]      pnpm            %%v
) else (
  echo   [MISSING] pnpm
  set ALLOK=0
)

where cloudflared >nul 2>&1
if %errorlevel%==0 (
  echo   [OK]      cloudflared     ^(tunnel^)
) else (
  if exist tools\cloudflared.exe (
    echo   [OK]      cloudflared     ^(in tools folder^)
  ) else (
    echo   [MISSING] cloudflared     ^(tunnel^)
    set ALLOK=0
  )
)

where vercel >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%v in ('vercel --version 2^>nul ^| findstr /r "^[0-9]"') do echo   [OK]      Vercel CLI      %%v
) else (
  echo   [MISSING] Vercel CLI
  set ALLOK=0
)

echo.
if %ALLOK%==1 (
  echo  --------------------------------------
  echo  Everything is installed!
  echo  Skip 0b. Your next file is:
  echo    2-SETUP.bat    ^(first time only^)
  echo    3-GO-LIVE.bat  ^(every day after^)
  echo  --------------------------------------
) else (
  echo  --------------------------------------
  echo  Something is MISSING.
  echo  Double-click  0b-INSTALL-NEEDED.bat
  echo  in THIS folder, then run this check
  echo  again to confirm everything says [OK].
  echo  --------------------------------------
)
echo.
pause
