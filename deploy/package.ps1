# TechNote — Tạo gói ZIP để deploy lên server khác
# Chạy trên máy Windows dev: .\deploy\package.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path (Split-Path -Parent $root) "technote-deploy.zip"

Write-Host "[..] Tạo gói deploy: $outFile"

# Các thư mục/file cần loại bỏ
$exclude = @(
    '.venv', '__pycache__', '.pytest_cache',
    '*.pyc', '*.pyo', '.env', '.git',
    'technote-deploy.zip'
)

# Lấy danh sách file cần đóng gói
$items = Get-ChildItem -Path $root -Recurse | Where-Object {
    $rel = $_.FullName.Substring($root.Length + 1)
    $skip = $false
    foreach ($ex in $exclude) {
        if ($rel -like "$ex*" -or $rel -like "*\$ex\*" -or $rel -like "*\$ex") {
            $skip = $true; break
        }
    }
    -not $skip
}

# Tạo ZIP
if (Test-Path $outFile) { Remove-Item $outFile }
Compress-Archive -Path "$root\*" -DestinationPath $outFile -Force

# Xóa .env khỏi zip nếu lỡ vào (an toàn)
# (PowerShell Compress-Archive không hỗ trợ exclude, dùng cách khác nếu cần)

Write-Host "[OK] Gói tạo xong: $outFile"
Write-Host ""
Write-Host "Các bước tiếp theo:"
Write-Host "  1. Copy technote-deploy.zip lên server"
Write-Host "  2. unzip technote-deploy.zip"
Write-Host "  3. cd technote"
Write-Host "  4. cp .env.example .env && nano .env  (điền JWT_SECRET + CLOUDFLARE_TUNNEL_TOKEN)"
Write-Host "  5. bash deploy/setup.sh"
