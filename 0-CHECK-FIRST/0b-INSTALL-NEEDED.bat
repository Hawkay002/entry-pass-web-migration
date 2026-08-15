@echo off
title Step 0b - Install what is missing
cd /d "%~dp0.."
echo.
echo ==========================================
echo   INSTALL: everything this app needs
echo ==========================================
echo  This only installs what is MISSING -
echo  already-installed things are skipped.
echo.

REM ---------------- Node.js ----------------
where node >nul 2>&1
if %errorlevel%==0 (
  echo  [skip] Node.js already installed
  goto AFTER_NODE
)

echo  Node.js is missing. Installing it needs
echo  administrator permission ONE time.
net session >nul 2>&1
if not %errorlevel%==0 (
  echo.
  echo  A window will pop up asking
  echo  "Do you want to allow this app..." -
  echo  CLICK YES. This window will reopen by
  echo  itself and continue.
  echo.
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo  Downloading + installing the latest Node.js
echo  (about 30 MB; a progress window may appear)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-node.ps1"
if not %errorlevel%==0 (
  echo.
  echo  Node.js could not be installed automatically.
  echo  Install it manually from  https://nodejs.org
  echo  ^(download LTS, click Next through the installer^),
  echo  then run this file again to continue.
  echo.
  pause
  exit /b
)

REM make node/npm usable in THIS window without restarting
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"

:AFTER_NODE
where node >nul 2>&1
if not %errorlevel%==0 (
  echo.
  echo  Node.js was just installed but this window
  echo  can't see it yet. CLOSE ALL windows and
  echo  double-click this file ONE more time.
  echo.
  pause
  exit /b
)
for /f "delims=" %%v in ('node --version') do echo  [OK]  Node.js %%v

REM ---------------- pnpm ----------------
where pnpm >nul 2>&1
if %errorlevel%==0 (
  echo  [skip] pnpm already installed
) else (
  echo  Installing pnpm...
  call npm install -g pnpm
)

REM ---------------- Vercel CLI ----------------
where vercel >nul 2>&1
if %errorlevel%==0 (
  echo  [skip] Vercel CLI already installed
) else (
  echo  Installing the Vercel CLI...
  call npm install -g vercel
)

REM ---------------- cloudflared (tunnel) ----------------
where cloudflared >nul 2>&1
if %errorlevel%==0 (
  echo  [skip] cloudflared already installed
  goto AFTER_TUNNEL
)
if exist tools\cloudflared.exe (
  echo  [skip] cloudflared already in tools folder
  goto AFTER_TUNNEL
)
echo  Downloading the tunnel program (about 60 MB)...
if not exist tools mkdir tools
curl -sL -o tools\cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
if not exist tools\cloudflared.exe (
  echo  Download failed - check your internet and run this file again.
  pause
  exit /b
)
echo  [OK]  cloudflared saved into the tools folder

:AFTER_TUNNEL
echo.
echo  --------------------------------------
echo  Re-checking everything...
echo  --------------------------------------
set ALLOK=1
where node       >nul 2>&1 || (echo   [MISSING] Node.js        & set ALLOK=0)
where pnpm       >nul 2>&1 || (echo   [MISSING] pnpm           & set ALLOK=0)
where vercel     >nul 2>&1 || (echo   [MISSING] Vercel CLI     & set ALLOK=0)
where cloudflared >nul 2>&1
if not %errorlevel%==0 if not exist tools\cloudflared.exe (echo   [MISSING] cloudflared & set ALLOK=0)

if %ALLOK%==1 (
  echo.
  echo  ==========================================
  echo   ALL INSTALLED SUCCESSFULLY
  echo  ==========================================
  echo  Your next file is  2-SETUP.bat  in the
  echo  main folder ^(first time only^), then
  echo  3-GO-LIVE.bat every day after that.
) else (
  echo.
  echo  Something still shows MISSING.
  echo  Close ALL windows and run this file once
  echo  more - new programs sometimes need that.
  echo  If it still fails, see SETUP.md - Part 6.
)
echo.
pause
