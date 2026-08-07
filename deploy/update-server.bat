@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TechNote Updater

:: ── Request Admin ─────────────────────────────────────────────────────────────
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  +==================================================+
echo  ^|         TechNote Server Updater                  ^|
echo  +==================================================+
echo.

:: ── Project path ──────────────────────────────────────────────────────────────
set "APP_DIR=C:\TechNote"
if not "%~1"=="" set "APP_DIR=%~1"
echo [OK] Project: !APP_DIR!

:: ── Find ZIP ──────────────────────────────────────────────────────────────────
set "ZIP_FILE="
set "BAT_DIR=%~dp0"
if exist "!BAT_DIR!technote-deploy.zip" set "ZIP_FILE=!BAT_DIR!technote-deploy.zip"
if "!ZIP_FILE!"=="" (
    echo [FAIL] technote-deploy.zip not found next to update-server.bat
    pause
exit /b 1
)
echo [OK] ZIP: !ZIP_FILE!

:: ── Confirm ───────────────────────────────────────────────────────────────────
echo.
echo  Will: stop uvicorn, extract ZIP, update packages, restart TechNote
echo.
set /p "CONFIRM=  Continue? [y/N]: "
if /i not "!CONFIRM!"=="y" ( echo Cancelled. & pause
exit /b 0 )

:: ── Stop uvicorn ──────────────────────────────────────────────────────────────
echo.
echo [*] Stopping TechNote...
powershell -NoProfile -Command "Stop-ScheduledTask -TaskName TechNote -ErrorAction SilentlyContinue"
powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
timeout /t 3 /nobreak >nul
echo [OK] Stopped

:: ── Backup protected files ────────────────────────────────────────────────────
echo [*] Backing up .env and firebase key...
powershell -NoProfile -Command "Copy-Item '!APP_DIR!\.env' '$env:TEMP\tn_env_bak' -Force -ErrorAction SilentlyContinue"
powershell -NoProfile -Command "Copy-Item '!APP_DIR!\server\firebase-service-account.json' '$env:TEMP\tn_firebase_bak' -Force -ErrorAction SilentlyContinue"

:: ── Extract ZIP ───────────────────────────────────────────────────────────────
echo [*] Extracting update...
powershell -NoProfile -Command "Expand-Archive -Path '!ZIP_FILE!' -DestinationPath '!APP_DIR!' -Force"
if errorlevel 1 (
    echo [FAIL] Extract failed.
    pause
exit /b 1
)
echo [OK] Files updated

:: ── Restore protected files ───────────────────────────────────────────────────
echo [*] Restoring .env and firebase key...
powershell -NoProfile -Command "if (Test-Path '$env:TEMP\tn_env_bak') { Copy-Item '$env:TEMP\tn_env_bak' '!APP_DIR!\.env' -Force }"
powershell -NoProfile -Command "if (Test-Path '$env:TEMP\tn_firebase_bak') { Copy-Item '$env:TEMP\tn_firebase_bak' '!APP_DIR!\server\firebase-service-account.json' -Force }"
echo [OK] Protected files restored

:: ── Update packages ───────────────────────────────────────────────────────────
echo [*] Updating Python packages...
"!APP_DIR!\.venv\Scripts\pip" install -r "!APP_DIR!\requirements.txt" --quiet
echo [OK] Packages updated

:: ── Restart ───────────────────────────────────────────────────────────────────
echo [*] Starting TechNote...
powershell -NoProfile -Command "Start-ScheduledTask -TaskName TechNote"
timeout /t 3 /nobreak >nul
echo [OK] Done

echo.
echo  Update complete! Users will get the new version automatically.
echo.
pause
endlocal
