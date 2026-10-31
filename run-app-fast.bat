@echo off
setlocal
cd /d "%~dp0"

set "APP_EXE=src-tauri\target\release\jjaimsae-player.exe"

if not exist "%APP_EXE%" (
  echo [ERROR] Compiled app was not found.
  echo A standalone Release executable has not been built yet.
  echo Run build-windows.bat once, then use this launcher for instant startup.
  pause
  exit /b 1
)

start "" "%APP_EXE%" %*
exit /b 0
