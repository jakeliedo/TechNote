# TechNote — Hướng dẫn cài đặt thủ công

Dùng khi `install.bat` gặp lỗi hoặc cần cài từng bước.

---

## Yêu cầu

- Windows 10/11 (64-bit)
- Tài khoản **Administrator** để đăng ký Task Scheduler
- File `technote-deploy.zip` (lấy từ máy cũ hoặc git)
- File `server/firebase-service-account.json` (lấy từ máy cũ, KHÔNG có trong git)

---

## Bước 1 — Giải nén project

Giải nén `technote-deploy.zip` vào `C:\TechNote\`

Cấu trúc sau khi giải nén:
```
C:\TechNote\
├── server\
├── frontend\
├── deploy\
├── requirements.txt
├── docker-compose.yml
└── .env.example
```

Copy file từ máy cũ:
```
server\firebase-service-account.json  →  C:\TechNote\server\firebase-service-account.json
media\                                →  C:\TechNote\media\   (nếu có ảnh cũ)
```

---

## Bước 2 — Cài Python 3.12

Mở PowerShell, chạy:
```powershell
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
```

Đóng PowerShell, mở lại, kiểm tra:
```powershell
py -3.12 --version
```

---

## Bước 3 — Cài Docker Desktop + WSL 2

```powershell
# Cài WSL 2 trước
wsl --install

# Reboot máy, rồi cài Docker Desktop
winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
```

Sau khi cài Docker Desktop:
- Reboot máy
- Mở Docker Desktop → đồng ý license → đợi icon cá voi ở taskbar
- Vào Settings → General → bật **"Start Docker Desktop when you sign in"**

---

## Bước 4 — Cài ngrok

```powershell
winget install ngrok.ngrok --accept-package-agreements --accept-source-agreements
```

Đóng PowerShell, mở lại, cấu hình authtoken:
```powershell
ngrok config add-authtoken <AUTHTOKEN>
```

Authtoken lấy từ: `C:\Users\ADMIN\AppData\Local\ngrok\ngrok.yml` trên máy cũ.

---

## Bước 5 — Tạo file .env

Mở PowerShell, chạy (giữ nguyên một lệnh):
```powershell
$jwt = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
$content = "DATABASE_URL=postgresql+asyncpg://technote:technote@localhost:5432/technote`nJWT_SECRET=$jwt`nGOOGLE_APPLICATION_CREDENTIALS=server/firebase-service-account.json`nFCM_PROJECT_ID=technote-clubv`nPUBLIC_URL=https://snugly-gory-goofiness.ngrok-free.dev`nVAPID_PUBLIC_KEY=BCk3cOcmho0XKti6ziGtw0RXt23OTEOTy8tIBRleIYXBFFlgZUtalK8mAymWsPtfN9djJjaCSxxk3LRNZ2d_H4k"
[System.IO.File]::WriteAllText("C:\TechNote\.env", $content, [System.Text.UTF8Encoding]::new($false))
```

Kiểm tra:
```powershell
Get-Content C:\TechNote\.env
```
Dòng đầu phải là `DATABASE_URL=...` (không có dòng trống trước).

---

## Bước 6 — Tạo virtual environment và cài packages

```powershell
cd C:\TechNote
py -3.12 -m venv .venv
.venv\Scripts\pip install --upgrade pip
.venv\Scripts\pip install -r requirements.txt
```

---

## Bước 7 — Khởi động PostgreSQL

```powershell
cd C:\TechNote
docker-compose up -d db
```

Đợi 20 giây. Kiểm tra:
```powershell
docker ps
```
Phải thấy `technote-db-1` với status `healthy`.

---

## Bước 8 — Import data cũ (nếu có)

Nếu có file backup từ máy cũ (`technote_backup.sql`):
```powershell
docker cp C:\Users\tech\Downloads\technote_backup.sql technote-db-1:/tmp/technote_backup.sql
docker exec technote-db-1 psql -U technote -d technote -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker exec technote-db-1 psql -U technote -d technote -f /tmp/technote_backup.sql
```

Nếu không có backup → seed 10 user mặc định:
```powershell
cd C:\TechNote
.venv\Scripts\python -m server.seed
```

---

## Bước 9 — Kiểm tra server chạy được

```powershell
cd C:\TechNote
.venv\Scripts\uvicorn server.main:app --host 0.0.0.0 --port 8000
```

Thấy `Application startup complete` → Ctrl+C để dừng, tiếp tục bước tiếp.

---

## Bước 10 — Tạo VBS wrappers (chạy ẩn)

```powershell
# uvicorn hidden
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\TechNote"
WshShell.Run """C:\TechNote\.venv\Scripts\python.exe"" -m uvicorn server.main:app --host 0.0.0.0 --port 8000", 0, False
"@ | Out-File -FilePath "C:\TechNote\deploy\uvicorn-hidden.vbs" -Encoding ascii

# ngrok hidden
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "C:\Windows\System32\ngrok.exe http 8000 --domain=snugly-gory-goofiness.ngrok-free.dev", 0, False
"@ | Out-File -FilePath "C:\TechNote\deploy\ngrok-hidden.vbs" -Encoding ascii
```

> Nếu ngrok không ở `C:\Windows\System32\ngrok.exe`, tìm đường dẫn thực: `where.exe ngrok`

---

## Bước 11 — Đăng ký Task Scheduler (cần Admin)

Mở PowerShell với quyền Administrator:

```powershell
# TechNote — uvicorn (delay 3 phút, đợi Docker + DB)
$t2 = New-ScheduledTaskTrigger -AtLogOn -User "tech"
$t2.Delay = "PT3M"
Register-ScheduledTask -Force -TaskName "TechNote" `
    -Action (New-ScheduledTaskAction -Execute "wscript.exe" `
        -Argument "C:\TechNote\deploy\uvicorn-hidden.vbs") `
    -Trigger $t2 `
    -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable) `
    -Principal (New-ScheduledTaskPrincipal -UserId "tech" -LogonType Interactive -RunLevel Highest)

# TechNote-ngrok (delay 1.5 phút)
$t3 = New-ScheduledTaskTrigger -AtLogOn -User "tech"
$t3.Delay = "PT1M30S"
Register-ScheduledTask -Force -TaskName "TechNote-ngrok" `
    -Action (New-ScheduledTaskAction -Execute "wscript.exe" `
        -Argument "C:\TechNote\deploy\ngrok-hidden.vbs") `
    -Trigger $t3 `
    -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable) `
    -Principal (New-ScheduledTaskPrincipal -UserId "tech" -LogonType Interactive -RunLevel Highest)
```

---

## Bước 12 — Restart và kiểm tra

Restart máy, đăng nhập `tech`, đợi **4 phút** rồi chạy:

```powershell
docker ps
netstat -ano | findstr :8000
Get-Process ngrok -ErrorAction SilentlyContinue
```

Cả 3 có kết quả → mở app trên điện thoại: `https://snugly-gory-goofiness.ngrok-free.dev`

---

## Khởi động thủ công (khi cần)

```powershell
# Start tất cả
docker-compose -f C:\TechNote\docker-compose.yml up -d db
Start-Sleep -Seconds 20
Start-ScheduledTask -TaskName "TechNote"
Start-Sleep -Seconds 10
Start-ScheduledTask -TaskName "TechNote-ngrok"

# Kiểm tra
Get-ScheduledTask -TaskName "TechNote*" | Select-Object TaskName, State
```

---

## Export data từ máy cũ

Trên máy cũ (Admin PowerShell):
```powershell
docker exec technote-db-1 pg_dump -U technote -d technote --no-owner --no-acl -f /tmp/technote_backup.sql
docker cp technote-db-1:/tmp/technote_backup.sql D:\technote_backup.sql
```

Copy file `D:\technote_backup.sql` sang máy mới qua USB/Zalo/Drive.
