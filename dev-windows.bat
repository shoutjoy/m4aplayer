@echo off
setlocal
cd /d "%~dp0"
where cargo >nul 2>nul || (echo [ERROR] Rust/Cargo is required. & pause & exit /b 1)
cargo tauri --version >nul 2>nul
if errorlevel 1 cargo install tauri-cli --version "^2" --locked || exit /b 1
cargo tauri dev
