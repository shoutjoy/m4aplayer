@echo off
setlocal
cd /d "%~dp0"
where cargo >nul 2>nul || (echo [ERROR] Rust/Cargo is required. Install from https://rustup.rs/ & pause & exit /b 1)
cargo tauri --version >nul 2>nul
if errorlevel 1 (
  echo [INFO] Tauri CLI is not installed. Installing with Cargo...
  cargo install tauri-cli --version "^2" --locked || (echo [ERROR] tauri-cli installation failed. & pause & exit /b 1)
)
echo [INFO] Building Local Audio Player with Cargo + Tauri only...
cargo tauri build
if errorlevel 1 (echo [ERROR] Build failed. & pause & exit /b 1)
echo.
echo [OK] Build complete.
echo EXE: src-tauri\target\release\jjaimsae-player.exe
echo Bundle: src-tauri\target\release\bundle\
pause
