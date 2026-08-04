@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TechNote - Xuat du lieu (May Cu)

echo.
echo  +==================================================+
echo  ^|  XUAT DU LIEU - CHAY TREN MAY CU                ^|
echo  ^+==================================================+
echo.
echo  Script nay xuat toan bo database hien tai (users, reports,
echo  devices, reads, checks) thanh file backup.
echo  Chep file backup sang may moi roi chay import_data.bat.
echo.

:: ============================================================
:: Xac dinh thu muc project
:: ============================================================
set "DEPLOY_DIR=%~dp0"
pushd "%DEPLOY_DIR%.."
set "APP_DIR=%CD%"
popd

:: ============================================================
:: Kiem tra Docker dang chay
:: ============================================================
docker info >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Docker Desktop chua chay. Mo Docker Desktop roi thu lai.
    pause
    exit /b 1
)

:: ============================================================
:: Lay container ID cua PostgreSQL
:: ============================================================
echo [*] Tim container PostgreSQL...
for /f "tokens=*" %%i in ('docker-compose -f "%APP_DIR%\docker-compose.yml" ps -q db 2^>nul') do set "DB_CONTAINER=%%i"

if "!DB_CONTAINER!"=="" (
    echo [FAIL] Khong tim thay container db.
    echo        Chay: docker-compose up -d db
    echo        Roi thu lai script nay.
    pause
    exit /b 1
)
echo [OK] Container: !DB_CONTAINER!

:: ============================================================
:: Kiem tra PostgreSQL san sang
:: ============================================================
echo [*] Kiem tra PostgreSQL...
docker exec !DB_CONTAINER! pg_isready -U technote >nul 2>&1
if errorlevel 1 (
    echo [FAIL] PostgreSQL chua san sang. Doi them roi thu lai.
    pause
    exit /b 1
)
echo [OK] PostgreSQL san sang

:: ============================================================
:: Tao ten file backup theo ngay gio
:: ============================================================
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmm'"') do set "TIMESTAMP=%%i"
set "BACKUP_FILE=%DEPLOY_DIR%technote_backup_%TIMESTAMP%.dump"

:: ============================================================
:: Chay pg_dump ben trong container (custom format, nen tot)
:: ============================================================
echo [*] Dang xuat database...
docker exec !DB_CONTAINER! pg_dump -U technote -d technote -F c -f /tmp/technote_backup.dump
if errorlevel 1 (
    echo [FAIL] pg_dump that bai.
    pause
    exit /b 1
)

:: ============================================================
:: Copy file ra ngoai container vao thu muc deploy\
:: ============================================================
docker cp !DB_CONTAINER!:/tmp/technote_backup.dump "!BACKUP_FILE!"
if errorlevel 1 (
    echo [FAIL] Khong copy duoc file backup ra ngoai.
    pause
    exit /b 1
)

:: Xoa file tam trong container
docker exec !DB_CONTAINER! rm -f /tmp/technote_backup.dump >nul 2>&1

:: Lay kich thuoc file
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-Item '!BACKUP_FILE!').Length / 1KB"') do set "FILE_SIZE=%%i"

echo.
echo  +==================================================+
echo  ^|  XUAT HOAN TAT!                                  ^|
echo  +==================================================+
echo.
echo  File backup: !BACKUP_FILE!
echo  Kich thuoc:  !FILE_SIZE! KB
echo.
echo  BUOC TIEP THEO:
echo  1. Chep file backup nay sang may moi (USB, Zalo, Google Drive...)
echo  2. Dat file vao thu muc deploy\ cua project tren may moi
echo  3. Tren may moi, chay deploy\import_data.bat
echo.
echo  LUU Y: Tren may cu, DUNG ngrok truoc khi may moi bat dau nhan traffic.
echo         Chay: net stop TechNote-ngrok  (neu da dung NSSM)
echo         Hoac dong cua so ngrok dang chay.
echo.
pause
endlocal
