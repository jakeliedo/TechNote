@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TechNote Updater

echo.
echo  +==================================================+
echo  ^|         TechNote Server Updater                  ^|
echo  ^|         Club V e-Gaming - Doi Ky Thuat           ^|
echo  +==================================================+
echo.

:: ============================================================
:: 1. Kiem tra quyen Administrator
:: ============================================================
net session >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Script nay phai chay voi quyen Administrator.
    echo        Click phai vao file .bat nay, chon "Run as administrator".
    pause
    exit /b 1
)
echo [OK] Quyen Administrator

:: ============================================================
:: 2. Xac dinh thu muc project
:: ============================================================
set "DEPLOY_DIR=%~dp0"
pushd "%DEPLOY_DIR%.."
set "APP_DIR=%CD%"
set "PARENT_DIR=%CD%\.."
popd
echo [OK] Project: %APP_DIR%

:: ============================================================
:: 3. Tim file ZIP update
::    Mac dinh: thu muc CHA cua project (package.ps1 dat vao do)
::    Vi du: neu project o C:\TechNote → tim C:\technote-deploy.zip
:: ============================================================
set "ZIP_FILE="

:: Uu tien argument truyen vao (deploy\update.bat "C:\path\to.zip")
if not "%~1"=="" (
    if exist "%~1" (
        set "ZIP_FILE=%~1"
        goto :zip_found
    ) else (
        echo [!] Khong tim thay file: %~1
    )
)

:: Tim trong thu muc cha cua project
for %%f in ("%PARENT_DIR%\technote-deploy.zip") do (
    if exist "%%f" ( set "ZIP_FILE=%%f" & goto :zip_found )
)

:: Tim trong thu muc deploy\
for %%f in ("%DEPLOY_DIR%technote-deploy.zip") do (
    if exist "%%f" ( set "ZIP_FILE=%%f" & goto :zip_found )
)

:zip_found
if "!ZIP_FILE!"=="" (
    echo.
    echo [!] Khong tim thay technote-deploy.zip
    echo     Dat file vao: %PARENT_DIR%\technote-deploy.zip
    echo     Hoac truyen duong dan truc tiep: deploy\update.bat "C:\path\technote-deploy.zip"
    echo.
    echo     --- CHI RESTART SERVICES (khong cap nhat file) ---
    set /p "RESTART_ONLY=  Chi restart services? [y/N]: "
    if /i not "!RESTART_ONLY!"=="y" (
        echo [*] Huy bo.
        pause
        exit /b 0
    )
    goto :pip_install
)

echo [OK] ZIP update: !ZIP_FILE!
echo.
echo  [!] QUA TRINH NAY SE:
echo      - Dung TechNote service
echo      - Ghi de cac file da thay doi (frontend, server)
echo      - GIU NGUYEN: .env, firebase-service-account.json, .venv, logs, database
echo      - Khoi dong lai TechNote service
echo.
set /p "CONFIRM=  Tiep tuc cap nhat? [y/N]: "
if /i not "!CONFIRM!"=="y" (
    echo [*] Huy bo.
    pause
    exit /b 0
)

:: ============================================================
:: 4. Dung TechNote service (giu ngrok va DB chay)
:: ============================================================
echo.
echo [*] Dung TechNote API service...
net stop TechNote >nul 2>&1
echo [OK] TechNote da dung

:: ============================================================
:: 5. Giai nen ZIP vao APP_DIR (ghi de file moi, giu .env va JSON)
:: ============================================================
echo.
echo [*] Ap dung update tu ZIP...
powershell -NoProfile -Command ^
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; ^
     $zip = [System.IO.Compression.ZipFile]::OpenRead('!ZIP_FILE!'); ^
     $keep = @('.env', 'firebase-service-account.json'); ^
     foreach ($entry in $zip.Entries) { ^
         if ($entry.FullName -match '[\\/]$') { continue } ^
         $skip = $false; ^
         foreach ($k in $keep) { if ($entry.Name -eq $k) { $skip = $true; break } } ^
         if ($skip) { Write-Host \"[SKIP] $($entry.FullName)\" ; continue } ^
         $dest = Join-Path '%APP_DIR%' $entry.FullName; ^
         $dir = Split-Path $dest -Parent; ^
         if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null } ^
         [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true) ^
     } ^
     $zip.Dispose(); ^
     Write-Host '[OK] Giai nen hoan tat'"
if errorlevel 1 (
    echo [FAIL] Loi khi giai nen ZIP. Khoi dong lai service voi code cu...
    net start TechNote >nul 2>&1
    pause
    exit /b 1
)

:: ============================================================
:: 6. Cap nhat Python packages (neu requirements.txt thay doi)
:: ============================================================
:pip_install
echo.
echo [*] Cap nhat Python packages...
"%APP_DIR%\.venv\Scripts\pip" install -r "%APP_DIR%\requirements.txt" --quiet
if errorlevel 1 (
    echo [!] Canh bao: loi khi cap nhat packages. Tiep tuc khoi dong lai...
)
echo [OK] Python packages da kiem tra

:: ============================================================
:: 7. Khoi dong lai TechNote
:: ============================================================
echo.
echo [*] Khoi dong lai TechNote...
net start TechNote
if errorlevel 1 (
    echo [FAIL] Khong the khoi dong TechNote.
    echo        Kiem tra log tai: %APP_DIR%\logs\technote_err.log
    pause
    exit /b 1
)
echo [OK] TechNote da khoi dong

:: ============================================================
:: Hoan tat
:: ============================================================
echo.
echo  +==================================================+
echo  ^|  CAP NHAT HOAN TAT!                              ^|
echo  +==================================================+
echo.
echo  Nhung gi da thay doi:
echo    - frontend\app.js  — Auto-seen khi xem feed
echo    - frontend\sw.js   — Cache v9 (trinh duyet tu lam moi)
echo.
echo  Nguoi dung se nhan update tu dong khi mo lai app.
echo  (Service Worker tu dong cap nhat cache moi)
echo.
echo  Kiem tra log: %APP_DIR%\logs\technote.log
echo.
timeout /t 5 /nobreak >nul
endlocal
