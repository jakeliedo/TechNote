@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TechNote - Dung Services

echo [*] Dung TechNote services...

:: Kiem tra quyen Admin
net session >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Can quyen Administrator.
    pause
    exit /b 1
)

set "DEPLOY_DIR=%~dp0"
pushd "%DEPLOY_DIR%.."
set "APP_DIR=%CD%"
popd

:: Dung ngrok truoc (khong con nhan request moi)
echo [*] Dung ngrok tunnel...
net stop TechNote-ngrok >nul 2>&1

:: Dung TechNote API
echo [*] Dung TechNote API...
net stop TechNote >nul 2>&1

:: Hoi co dung ca PostgreSQL khong
echo.
set /p "STOP_DB=  Dung ca PostgreSQL (Docker)? [y/N]: "
if /i "!STOP_DB!"=="y" (
    echo [*] Dung PostgreSQL...
    docker-compose -f "%APP_DIR%\docker-compose.yml" stop db
    echo [OK] PostgreSQL da dung.
)

echo.
echo [OK] Services da dung.
echo      De khoi dong lai: deploy\start_services.bat
echo.
timeout /t 3 /nobreak >nul
endlocal
