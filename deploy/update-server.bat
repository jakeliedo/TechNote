@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TechNote Updater

:: ── Tự xin quyền Admin ────────────────────────────────────────────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo Dang yeu cau quyen Administrator...
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  +==================================================+
echo  ^|         TechNote Server Updater                  ^|
echo  ^|         (Task Scheduler Edition)                 ^|
echo  +==================================================+
echo.
echo [OK] Quyen Administrator

:: ── Duong dan project ────────────────────────────────────────────────────────
set "APP_DIR=C:\TechNote"

:: Cho phep ghi de bang argument: update-server.bat "C:\custom\path"
if not "%~1"=="" (
    if exist "%~1\requirements.txt" (
        set "APP_DIR=%~1"
    ) else (
        echo [!] Thu muc khong hop le: %~1
        echo     Phai chua requirements.txt
        pause & exit /b 1
    )
)
echo [OK] Project: !APP_DIR!

:: ── Tim file ZIP ─────────────────────────────────────────────────────────────
set "ZIP_FILE="
set "SCRIPT_DIR=%~dp0"

:: Tim ZIP cung thu muc voi bat file nay
for %%f in ("!SCRIPT_DIR!technote-deploy.zip") do (
    if exist "%%f" set "ZIP_FILE=%%f"
)
:: Tim ZIP trong thu muc cha cua project
if "!ZIP_FILE!"=="" (
    for %%f in ("!APP_DIR!\..\technote-deploy.zip") do (
        if exist "%%f" set "ZIP_FILE=%%f"
    )
)

if "!ZIP_FILE!"=="" (
    echo [FAIL] Khong tim thay technote-deploy.zip
    echo        Dat file vao cung thu muc voi update-server.bat, roi chay lai.
    pause & exit /b 1
)
echo [OK] ZIP: !ZIP_FILE!

:: ── Xac nhan ─────────────────────────────────────────────────────────────────
echo.
echo  [!] Se thuc hien:
echo      - Dung TechNote (uvicorn)
echo      - Cap nhat file tu ZIP (giu .env + firebase-service-account.json)
echo      - Cap nhat Python packages
echo      - Khoi dong lai TechNote
echo.
set /p "CONFIRM=  Tiep tuc? [y/N]: "
if /i not "!CONFIRM!"=="y" (
    echo [*] Huy bo.
    pause & exit /b 0
)

:: ── Dung uvicorn ─────────────────────────────────────────────────────────────
echo.
echo [*] Dung TechNote...
powershell -NoProfile -Command "Stop-ScheduledTask -TaskName 'TechNote' -ErrorAction SilentlyContinue"
powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*uvicorn*' } | Stop-Process -Force -ErrorAction SilentlyContinue"
:: Doi process ket thuc
timeout /t 3 /nobreak >nul
echo [OK] TechNote da dung

:: ── Giai nen ZIP ─────────────────────────────────────────────────────────────
echo.
echo [*] Ap dung update...
powershell -NoProfile -Command ^
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; ^
     $zip = [System.IO.Compression.ZipFile]::OpenRead('!ZIP_FILE!'); ^
     $keep = @('.env', 'firebase-service-account.json'); ^
     $count = 0; ^
     foreach ($entry in $zip.Entries) { ^
         if ($entry.FullName -match '[\\/]$') { continue } ^
         if ($keep -contains $entry.Name) { Write-Host \"  [SKIP] $($entry.Name)\"; continue } ^
         $dest = Join-Path '!APP_DIR!' $entry.FullName; ^
         $dir = Split-Path $dest -Parent; ^
         if (-not (Test-Path $dir)) { New-Item -ItemType Directory $dir -Force | Out-Null } ^
         [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true); ^
         $count++ ^
     } ^
     $zip.Dispose(); ^
     Write-Host \"[OK] Da cap nhat $count files\""
if errorlevel 1 (
    echo [FAIL] Loi khi giai nen. Khoi dong lai voi code cu...
    Start-ScheduledTask -TaskName "TechNote" >nul 2>&1
    pause & exit /b 1
)

:: ── Cap nhat Python packages ─────────────────────────────────────────────────
echo.
echo [*] Cap nhat Python packages...
"!APP_DIR!\.venv\Scripts\pip" install -r "!APP_DIR!\requirements.txt" --quiet
if errorlevel 1 (
    echo [!] Canh bao: loi cap nhat packages. Van tiep tuc...
) else (
    echo [OK] Python packages
)

:: ── Khoi dong lai ────────────────────────────────────────────────────────────
echo.
echo [*] Khoi dong lai TechNote...
powershell -NoProfile -Command "Start-ScheduledTask -TaskName 'TechNote'"
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command ^
    "$s = (Get-ScheduledTask -TaskName 'TechNote').State; Write-Host $s"

:: ── Hoan tat ─────────────────────────────────────────────────────────────────
echo.
echo  +==================================================+
echo  ^|  CAP NHAT HOAN TAT!                              ^|
echo  +==================================================+
echo.
echo  Nguoi dung se nhan update tu dong khi mo lai app.
echo  (Service Worker tu cap nhat cache moi)
echo.
timeout /t 5 /nobreak >nul
endlocal
