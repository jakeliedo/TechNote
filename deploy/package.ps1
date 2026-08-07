# TechNote — Tạo gói ZIP để deploy / update lên server Windows
# Chạy trên máy dev: .\deploy\package.ps1
# Output: thư mục CHA của project → technote-deploy.zip

$ErrorActionPreference = "Stop"
$root    = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path (Split-Path -Parent $root) "technote-deploy.zip"

Write-Host ""
Write-Host "[..] Building deploy package: $outFile"

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

Write-Host "[..] $($files.Count) files will be packaged..."

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
Write-Host "[OK] Package ready ($sizeMB MB): $outFile"
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "  -- FIRST-TIME INSTALL (new server) --"
Write-Host "  1. Copy technote-deploy.zip to the server"
Write-Host "  2. Extract into a folder (e.g. C:\TechNote)"
Write-Host "  3. Copy server\firebase-service-account.json into server\firebase-service-account.json"
Write-Host "  4. Run deploy\install.bat as Administrator"
Write-Host ""
Write-Host "  -- UPDATE RUNNING SERVER --"
Write-Host "  1. Copy technote-deploy.zip + deploy\update-server.bat to the server"
Write-Host "  2. Run update-server.bat as Administrator"
Write-Host ""
