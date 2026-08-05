# TechNote — Tạo gói ZIP để deploy / update lên server Windows
# Chạy trên máy dev: .\deploy\package.ps1
# Output: thư mục CHA của project → technote-deploy.zip

$ErrorActionPreference = "Stop"
$root    = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path (Split-Path -Parent $root) "technote-deploy.zip"

Write-Host ""
Write-Host "[..] Tạo gói deploy: $outFile"

# Danh sách thư mục/file loại bỏ (không đưa vào ZIP)
$excludeDirs  = @('.venv', '__pycache__', '.pytest_cache', '.git', 'logs')
$excludeFiles = @('.env', 'firebase-service-account.json', 'technote-deploy.zip', '*.pyc', '*.pyo')

# Thu thập file hợp lệ
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($root.Length + 1)

    # Loại thư mục bị cấm (bất kỳ segment nào trong path)
    $blocked = $false
    foreach ($d in $excludeDirs) {
        if ($rel -match "(^|\\)$([regex]::Escape($d))(\\|$)") { $blocked = $true; break }
    }
    if ($blocked) { return $false }

    # Loại file bị cấm
    foreach ($f in $excludeFiles) {
        if ($_.Name -like $f) { return $false }
    }

    return $true
}

Write-Host "[..] $($files.Count) files sẽ được đóng gói..."

# Tạo ZIP bằng .NET ZipFile (hỗ trợ exclude chính xác)
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $outFile) { Remove-Item $outFile -Force }

$zip = [System.IO.Compression.ZipFile]::Open($outFile, 'Create')
foreach ($file in $files) {
    $rel = $file.FullName.Substring($root.Length + 1)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $rel) | Out-Null
}
$zip.Dispose()

$sizeMB = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "[OK] Gói tạo xong ($sizeMB MB): $outFile"
Write-Host ""
Write-Host "Các bước tiếp theo:"
Write-Host ""
Write-Host "  -- CÀI ĐẶT LẦN ĐẦU (server mới) --"
Write-Host "  1. Copy technote-deploy.zip lên server"
Write-Host "  2. Giải nén vào thư mục (vd: C:\TechNote)"
Write-Host "  3. Sao chép server\firebase-service-account.json vào server\firebase-service-account.json"
Write-Host "  4. Chạy deploy\install.bat với quyền Administrator"
Write-Host ""
Write-Host "  -- CẬP NHẬT SERVER ĐANG CHẠY --"
Write-Host "  1. Copy technote-deploy.zip vào thư mục CHA của project trên server"
Write-Host "     (cùng cấp với thư mục TechNote, vd: C:\technote-deploy.zip)"
Write-Host "  2. Chạy deploy\update.bat với quyền Administrator"
Write-Host ""
