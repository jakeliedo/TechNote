@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title TechNote Installer

echo.
echo  +==================================================+
echo  ^|         TechNote Server Installer                ^|
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
::    deploy\ nam trong <project_root>\deploy\
:: ============================================================
set "DEPLOY_DIR=%~dp0"
pushd "%DEPLOY_DIR%.."
set "APP_DIR=%CD%"
popd
echo [OK] Project: %APP_DIR%

:: Tao thu muc logs neu chua co
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"

:: ============================================================
:: 3. Kiem tra / Cai dat Python 3.12
:: ============================================================
echo.
echo [*] Kiem tra Python 3.12...
py -3.12 --version >nul 2>&1
if not errorlevel 1 goto :python_ok

echo [*] Chua co Python 3.12, dang cai dat qua winget...
winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo [FAIL] Khong the cai Python 3.12 tu winget.
    echo        Cai thu cong tai: https://www.python.org/downloads/release/python-3128/
    echo        Chon Python 3.12.x - Windows installer 64-bit
    pause
    exit /b 1
)
:: Nap lai PATH sau khi cai Python
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USERPATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSPATH=%%b"
set "PATH=%SYSPATH%;%USERPATH%"
py -3.12 --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python da cai nhung chua co trong PATH.
    echo     Dong cua so nay, mo lai voi quyen Admin, chay lai script.
    pause
    exit /b 1
)
:python_ok
for /f "tokens=*" %%i in ('py -3.12 --version') do echo [OK] %%i

:: ============================================================
:: 4. Kiem tra / Cai dat Docker Desktop
:: ============================================================
echo.
echo [*] Kiem tra Docker...
where docker >nul 2>&1
if errorlevel 1 (
    echo [*] Chua co Docker, dang cai dat Docker Desktop...
    winget install Docker.DockerDesktop --silent --accept-package-agreements --accept-source-agreements
    echo.
    echo [!] Docker Desktop da cai dat xong.
    echo     Can khoi dong lai may tinh, sau do:
    echo       1. Mo Docker Desktop, dong y license, cho no khoi dong
    echo       2. Chay lai script nay
    pause
    exit /b 0
)
docker info >nul 2>&1
if errorlevel 1 (
    echo [!] Docker Desktop chua chay.
    echo     Mo Docker Desktop, cho bieu tuong Docker xuat hien tren taskbar, roi chay lai script.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('docker --version') do echo [OK] %%i

:: ============================================================
:: 5. Kiem tra / Cai dat ngrok
:: ============================================================
echo.
echo [*] Kiem tra ngrok...
where ngrok >nul 2>&1
if errorlevel 1 (
    echo [*] Chua co ngrok, dang cai dat...
    winget install ngrok.ngrok --silent --accept-package-agreements --accept-source-agreements
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USERPATH=%%b"
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSPATH=%%b"
    set "PATH=%SYSPATH%;%USERPATH%"
)
for /f "tokens=*" %%i in ('where ngrok 2^>nul') do set "NGROK_EXE=%%i"
if "!NGROK_EXE!"=="" (
    echo [FAIL] Khong tim thay ngrok sau khi cai.
    echo        Dong cua so nay, mo lai Admin terminal, chay lai script.
    pause
    exit /b 1
)
echo [OK] ngrok: !NGROK_EXE!

:: ============================================================
:: 6. Tai NSSM (Non-Sucking Service Manager)
::    Dung de dang ky uvicorn va ngrok lam Windows Service
:: ============================================================
echo.
echo [*] Kiem tra NSSM...
if exist "%DEPLOY_DIR%nssm.exe" goto :nssm_ok
echo [*] Dang tai NSSM...
powershell -NoProfile -Command ^
    "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip' -UseBasicParsing; ^
     Expand-Archive -Path '%TEMP%\nssm.zip' -DestinationPath '%TEMP%\nssm_ext' -Force; ^
     Copy-Item '%TEMP%\nssm_ext\nssm-2.24\win64\nssm.exe' '%DEPLOY_DIR%nssm.exe'"
if not exist "%DEPLOY_DIR%nssm.exe" (
    echo [FAIL] Khong tai duoc NSSM. Kiem tra ket noi internet roi thu lai.
    pause
    exit /b 1
)
:nssm_ok
echo [OK] NSSM: %DEPLOY_DIR%nssm.exe

:: ============================================================
:: 7. Nhap thong tin cau hinh
:: ============================================================
echo.
echo  --- NHAP THONG TIN CAU HINH ---
echo  (Lay authtoken tai: https://dashboard.ngrok.com/get-started/your-authtoken)
echo.

set /p "NGROK_TOKEN=  ngrok authtoken: "
if "!NGROK_TOKEN!"=="" (
    echo [FAIL] Authtoken khong duoc de trong.
    pause
    exit /b 1
)

set "NGROK_DOMAIN=snugly-gory-goofiness.ngrok-free.dev"
set /p "NGROK_DOMAIN=  ngrok static domain [!NGROK_DOMAIN!]: "

set "FCM_PROJECT=technote-clubv"
set /p "FCM_PROJECT=  Firebase project ID [!FCM_PROJECT!]: "

set /p "VAPID_KEY=  VAPID public key: "
if "!VAPID_KEY!"=="" (
    echo [!] CANH BAO: VAPID key trong — push notification se khong hoat dong.
    echo     (Tim tai Firebase Console → Project Settings → Cloud Messaging → Web Push certificates)
)

:: Sinh JWT secret ngau nhien
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))"') do set "JWT_SECRET=%%i"

:: ============================================================
:: 8. Tao file .env
:: ============================================================
echo.
echo [*] Tao file .env...
(
    echo DATABASE_URL=postgresql+asyncpg://technote:technote@localhost:5432/technote
    echo JWT_SECRET=!JWT_SECRET!
    echo GOOGLE_APPLICATION_CREDENTIALS=server/firebase-service-account.json
    echo FCM_PROJECT_ID=!FCM_PROJECT!
    echo PUBLIC_URL=https://!NGROK_DOMAIN!
    echo VAPID_PUBLIC_KEY=!VAPID_KEY!
) > "%APP_DIR%\.env"
echo [OK] .env da tao

:: Kiem tra firebase-service-account.json
if not exist "%APP_DIR%\server\firebase-service-account.json" (
    echo.
    echo  [!] CANH BAO: Khong tim thay server\firebase-service-account.json
    echo      Sao chep file nay tu may cu sang may moi truoc khi khoi dong server.
    echo      FCM push notification se KHONG hoat dong neu thieu file nay.
    echo.
)

:: ============================================================
:: 9. Tao Python virtual environment va cai packages
:: ============================================================
echo.
echo [*] Tao Python virtual environment...
if not exist "%APP_DIR%\.venv\Scripts\python.exe" (
    py -3.12 -m venv "%APP_DIR%\.venv"
)
echo [*] Cai dat Python packages (co the mat vai phut)...
"%APP_DIR%\.venv\Scripts\pip" install --upgrade pip --quiet
"%APP_DIR%\.venv\Scripts\pip" install -r "%APP_DIR%\requirements.txt" --quiet
if errorlevel 1 (
    echo [FAIL] Loi khi cai Python packages.
    pause
    exit /b 1
)
echo [OK] Python packages da cai xong

:: ============================================================
:: 10. Khoi dong PostgreSQL (Docker)
:: ============================================================
echo.
echo [*] Khoi dong PostgreSQL qua Docker...
docker-compose -f "%APP_DIR%\docker-compose.yml" up -d db
if errorlevel 1 (
    echo [FAIL] Khong the khoi dong PostgreSQL. Kiem tra Docker Desktop dang chay.
    pause
    exit /b 1
)
echo [*] Cho PostgreSQL san sang (30 giay)...
timeout /t 30 /nobreak >nul
echo [OK] PostgreSQL

:: ============================================================
:: 11. Seed database (chi chay neu server moi, chua co data)
:: ============================================================
echo.
echo [*] Seed 10 users...
cd /d "%APP_DIR%"
"%APP_DIR%\.venv\Scripts\python" -m server.seed
echo [OK] Seed hoan tat (neu da co user, se bao "skip")

:: ============================================================
:: 12. Dang ky TechNote lam Windows Service qua NSSM
:: ============================================================
echo.
echo [*] Dang ky TechNote Windows Service...
sc query TechNote >nul 2>&1
if not errorlevel 1 (
    "%DEPLOY_DIR%nssm.exe" stop TechNote >nul 2>&1
    "%DEPLOY_DIR%nssm.exe" remove TechNote confirm >nul 2>&1
)

"%DEPLOY_DIR%nssm.exe" install TechNote "%APP_DIR%\.venv\Scripts\python.exe"
"%DEPLOY_DIR%nssm.exe" set TechNote AppParameters "-m uvicorn server.main:app --host 0.0.0.0 --port 8000"
"%DEPLOY_DIR%nssm.exe" set TechNote AppDirectory "%APP_DIR%"
"%DEPLOY_DIR%nssm.exe" set TechNote DisplayName "TechNote API Server"
"%DEPLOY_DIR%nssm.exe" set TechNote Description "TechNote real-time report logging - Club V e-Gaming"
"%DEPLOY_DIR%nssm.exe" set TechNote Start SERVICE_AUTO_START
"%DEPLOY_DIR%nssm.exe" set TechNote AppStdout "%APP_DIR%\logs\technote.log"
"%DEPLOY_DIR%nssm.exe" set TechNote AppStderr "%APP_DIR%\logs\technote_err.log"
"%DEPLOY_DIR%nssm.exe" set TechNote AppRotateFiles 1
"%DEPLOY_DIR%nssm.exe" set TechNote AppRotateOnline 1
"%DEPLOY_DIR%nssm.exe" set TechNote AppRotateBytesHigh 0
"%DEPLOY_DIR%nssm.exe" set TechNote AppRotateBytesLow 10485760
:: Tu dong khoi dong lai sau 10 giay neu bi crash
"%DEPLOY_DIR%nssm.exe" set TechNote AppRestartDelay 10000
echo [OK] TechNote service da dang ky

:: ============================================================
:: 13. Cau hinh ngrok authtoken
:: ============================================================
echo.
echo [*] Cau hinh ngrok authtoken...
"!NGROK_EXE!" config add-authtoken !NGROK_TOKEN!
echo [OK] ngrok authtoken da luu

:: ============================================================
:: 14. Dang ky ngrok lam Windows Service
:: ============================================================
echo.
echo [*] Dang ky TechNote-ngrok Windows Service...
sc query TechNote-ngrok >nul 2>&1
if not errorlevel 1 (
    "%DEPLOY_DIR%nssm.exe" stop TechNote-ngrok >nul 2>&1
    "%DEPLOY_DIR%nssm.exe" remove TechNote-ngrok confirm >nul 2>&1
)

"%DEPLOY_DIR%nssm.exe" install TechNote-ngrok "!NGROK_EXE!"
"%DEPLOY_DIR%nssm.exe" set TechNote-ngrok AppParameters "http 8000 --domain=!NGROK_DOMAIN!"
"%DEPLOY_DIR%nssm.exe" set TechNote-ngrok DisplayName "TechNote ngrok Tunnel"
"%DEPLOY_DIR%nssm.exe" set TechNote-ngrok Description "ngrok public tunnel for TechNote"
"%DEPLOY_DIR%nssm.exe" set TechNote-ngrok Start SERVICE_AUTO_START
"%DEPLOY_DIR%nssm.exe" set TechNote-ngrok AppStdout "%APP_DIR%\logs\ngrok.log"
"%DEPLOY_DIR%nssm.exe" set TechNote-ngrok AppStderr "%APP_DIR%\logs\ngrok_err.log"
:: Doi 15 giay sau khi TechNote bat dau moi mo tunnel
"%DEPLOY_DIR%nssm.exe" set TechNote-ngrok AppRestartDelay 15000
echo [OK] TechNote-ngrok service da dang ky

:: ============================================================
:: 15. Task Scheduler: khoi dong Docker PostgreSQL sau khi boot
::     Docker Desktop can ~60 giay de khoi dong sau khi Windows boot
::     Task nay chay sau 90 giay, dam bao Docker san sang
:: ============================================================
echo.
echo [*] Tao Task Scheduler de tu dong khoi dong PostgreSQL sau reboot...
schtasks /delete /tn "TechNote-StartDB" /f >nul 2>&1
schtasks /create ^
    /tn "TechNote-StartDB" ^
    /tr "docker-compose -f \"%APP_DIR%\docker-compose.yml\" up -d db" ^
    /sc onstart ^
    /ru SYSTEM ^
    /delay 0001:30 ^
    /f >nul
if errorlevel 1 (
    echo [!] Khong tao duoc Task Scheduler. Co the can khoi dong lai PostgreSQL thu cong sau moi reboot.
) else (
    echo [OK] Task Scheduler: TechNote-StartDB (delay 1p30s sau boot)
)

:: ============================================================
:: 16. Khoi dong services
:: ============================================================
echo.
echo [*] Khoi dong TechNote service...
net start TechNote
echo [*] Khoi dong TechNote-ngrok service...
net start TechNote-ngrok

:: ============================================================
:: Hoan tat
:: ============================================================
echo.
echo  +========================================================+
echo  ^|  CAI DAT HOAN TAT!                                     ^|
echo  ^+========================================================+^|
echo  ^|                                                         ^|
echo  ^|  Local URL:   http://localhost:8000                     ^|
echo  ^|  Public URL:  https://!NGROK_DOMAIN!^|
echo  ^|                                                         ^|
echo  ^|  Windows Services (tu dong khoi dong theo may):        ^|
echo  ^|    - TechNote           FastAPI server (uvicorn)        ^|
echo  ^|    - TechNote-ngrok     ngrok public tunnel             ^|
echo  ^|                                                         ^|
echo  ^|  PostgreSQL: Docker (Task Scheduler khoi dong sau boot) ^|
echo  ^|                                                         ^|
echo  ^|  Quan ly services:                                      ^|
echo  ^|    deploy\start_services.bat   — khoi dong              ^|
echo  ^|    deploy\stop_services.bat    — dung                   ^|
echo  ^|                                                         ^|
echo  ^|  Logs: %APP_DIR%\logs\          ^|
echo  ^+=========================================================+
echo.
echo  LUU Y QUAN TRONG:
echo  - Sao chep server\firebase-service-account.json tu may cu sang (neu chua lam)
echo  - Tren may cu: dung ngrok truoc khi su dung may moi
echo  - Import data cu: chay deploy\import_data.bat (neu co file backup)
echo.
pause
endlocal
