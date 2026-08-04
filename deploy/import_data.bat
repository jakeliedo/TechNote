@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TechNote - Nhap du lieu (May Moi)

echo.
echo  +==================================================+
echo  ^|  NHAP DU LIEU - CHAY TREN MAY MOI               ^|
echo  +==================================================+
echo.
echo  Script nay nhap du lieu tu file backup vao database moi.
echo  Chay sau khi da hoan thanh install.bat.
echo.
echo  CANH BAO: Thao tac nay se XOA toan bo data hien tai trong
echo            database va thay the bang data tu file backup!
echo.

:: ============================================================
:: Xac dinh thu muc project
:: ============================================================
set "DEPLOY_DIR=%~dp0"
pushd "%DEPLOY_DIR%.."
set "APP_DIR=%CD%"
popd

:: ============================================================
:: Tim file backup trong thu muc deploy\
:: ============================================================
set "BACKUP_FILE="
for /f "tokens=*" %%i in ('dir /b /o-d "%DEPLOY_DIR%technote_backup_*.dump" 2^>nul') do (
    if "!BACKUP_FILE!"=="" set "BACKUP_FILE=%DEPLOY_DIR%%%i"
)

if "!BACKUP_FILE!"=="" (
    echo [FAIL] Khong tim thay file backup trong thu muc deploy\
    echo.
    echo  Dat file backup (technote_backup_*.dump) vao thu muc:
    echo  %DEPLOY_DIR%
    echo.
    echo  Tao file backup tren may cu bang cach chay:
    echo    deploy\export_data.bat
    pause
    exit /b 1
)

echo [OK] Tim thay file backup: !BACKUP_FILE!
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-Item '!BACKUP_FILE!').Length / 1KB"') do set "FILE_SIZE=%%i"
echo      Kich thuoc: !FILE_SIZE! KB
echo.

:: ============================================================
:: Xac nhan truoc khi xoa data cu
:: ============================================================
set /p "CONFIRM=  Nhap YES de xac nhan ghi de data hien tai: "
if /i "!CONFIRM!" NEQ "YES" (
    echo [!] Da huy. Khong co gi thay doi.
    pause
    exit /b 0
)

:: ============================================================
:: Kiem tra Docker va PostgreSQL
:: ============================================================
docker info >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Docker Desktop chua chay. Mo Docker Desktop roi thu lai.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('docker-compose -f "%APP_DIR%\docker-compose.yml" ps -q db 2^>nul') do set "DB_CONTAINER=%%i"
if "!DB_CONTAINER!"=="" (
    echo [*] PostgreSQL chua chay, dang khoi dong...
    docker-compose -f "%APP_DIR%\docker-compose.yml" up -d db
    echo [*] Cho 30 giay...
    timeout /t 30 /nobreak >nul
    for /f "tokens=*" %%i in ('docker-compose -f "%APP_DIR%\docker-compose.yml" ps -q db 2^>nul') do set "DB_CONTAINER=%%i"
)

docker exec !DB_CONTAINER! pg_isready -U technote >nul 2>&1
if errorlevel 1 (
    echo [FAIL] PostgreSQL chua san sang. Doi them roi thu lai.
    pause
    exit /b 1
)
echo [OK] PostgreSQL san sang (container: !DB_CONTAINER!)

:: ============================================================
:: Dung TechNote service truoc khi import (tranh conflict)
:: ============================================================
sc query TechNote >nul 2>&1
if not errorlevel 1 (
    echo [*] Dung TechNote service trong khi import...
    net stop TechNote >nul 2>&1
)

:: ============================================================
:: Copy file backup vao container
:: ============================================================
echo [*] Copy file backup vao container...
docker cp "!BACKUP_FILE!" !DB_CONTAINER!:/tmp/technote_restore.dump
if errorlevel 1 (
    echo [FAIL] Khong copy duoc file vao container.
    pause
    exit /b 1
)

:: ============================================================
:: pg_restore — xoa data cu va restore tu backup
:: ============================================================
echo [*] Dang restore database (co the mat 30-60 giay)...
docker exec !DB_CONTAINER! pg_restore ^
    -U technote ^
    -d technote ^
    --clean ^
    --if-exists ^
    --no-owner ^
    --no-privileges ^
    /tmp/technote_restore.dump

if errorlevel 1 (
    echo [!] CANH BAO: Co mot so loi nho trong qua trinh restore.
    echo     Day thuong la binh thuong neu schema da ton tai.
    echo     Kiem tra du lieu de xac nhan.
) else (
    echo [OK] Restore hoan tat khong co loi.
)

:: Xoa file tam
docker exec !DB_CONTAINER! rm -f /tmp/technote_restore.dump >nul 2>&1

:: ============================================================
:: Kiem tra so luong records
:: ============================================================
echo.
echo [*] Kiem tra so luong records sau restore:
docker exec !DB_CONTAINER! psql -U technote -d technote -c "SELECT 'users' as table_name, COUNT(*) FROM users UNION ALL SELECT 'reports', COUNT(*) FROM reports UNION ALL SELECT 'report_reads', COUNT(*) FROM report_reads UNION ALL SELECT 'report_checks', COUNT(*) FROM report_checks;"

:: ============================================================
:: Khoi dong lai TechNote service
:: ============================================================
echo.
echo [*] Khoi dong lai TechNote service...
sc query TechNote >nul 2>&1
if not errorlevel 1 (
    net start TechNote
) else (
    echo [!] TechNote service chua duoc dang ky. Chay install.bat truoc.
)

echo.
echo  +==================================================+
echo  ^|  NHAP DU LIEU HOAN TAT!                         ^|
echo  +==================================================+
echo.
echo  Du lieu da duoc restore thanh cong vao may moi.
echo  Kiem tra app tai: http://localhost:8000
echo.
pause
endlocal
