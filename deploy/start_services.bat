@echo off
chcp 65001 >nul
setlocal
title TechNote - Khoi dong Services

echo [*] Khoi dong TechNote services...

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

:: Khoi dong PostgreSQL (Docker)
echo [*] Khoi dong PostgreSQL...
docker-compose -f "%APP_DIR%\docker-compose.yml" up -d db
timeout /t 15 /nobreak >nul

:: Khoi dong TechNote API
echo [*] Khoi dong TechNote API...
net start TechNote
if errorlevel 1 (
    echo [!] TechNote service chua dang ky, thu chay truc tiep...
    start "TechNote" /min "%APP_DIR%\.venv\Scripts\python.exe" -m uvicorn server.main:app --host 0.0.0.0 --port 8000
)

:: Khoi dong ngrok
echo [*] Khoi dong ngrok tunnel...
net start TechNote-ngrok
if errorlevel 1 (
    echo [!] TechNote-ngrok service chua dang ky. Chay install.bat truoc.
)

echo.
echo [OK] Tat ca services da khoi dong.
echo      Local:  http://localhost:8000
echo      Public: kiem tra logs\ngrok.log
echo.
timeout /t 3 /nobreak >nul
endlocal
