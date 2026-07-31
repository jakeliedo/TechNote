#!/bin/bash
# TechNote — First-time server setup script
# Tested on Ubuntu 22.04 / Debian 12
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!!]${NC} $1"; }
err_exit(){ echo -e "${RED}[ERR]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo "  TechNote — Deploy Setup"
echo "  App dir: $APP_DIR"
echo "================================================"
echo

# ── 1. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  warn "Docker chưa cài. Đang cài..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  usermod -aG docker "$USER"
  info "Docker đã cài. Bạn cần logout/login lại để dùng Docker không cần sudo."
  info "Sau đó chạy lại: bash deploy/setup.sh"
  exit 0
else
  info "Docker đã có: $(docker --version)"
fi

# ── 2. .env ──────────────────────────────────────────────────────────────────
cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env chưa tồn tại — đã copy từ .env.example"
  warn "Hãy chỉnh sửa .env trước khi tiếp tục:"
  warn "  nano .env"
  echo
  echo "Các giá trị cần điền:"
  echo "  JWT_SECRET         — chuỗi ngẫu nhiên dài (tạo bằng: openssl rand -hex 32)"
  echo "  CLOUDFLARE_TUNNEL_TOKEN — token từ Cloudflare Dashboard"
  echo "  FCM_PROJECT_ID     — (tùy chọn) Firebase project ID"
  echo
  echo "Sau khi điền xong, chạy lại: bash deploy/setup.sh"
  exit 0
fi

# Kiểm tra các biến bắt buộc
source <(grep -E '^(JWT_SECRET|CLOUDFLARE_TUNNEL_TOKEN)=' .env)
if [[ "$JWT_SECRET" == *"change"* ]] || [[ -z "$JWT_SECRET" ]]; then
  err_exit "JWT_SECRET chưa được đặt trong .env. Chạy: openssl rand -hex 32"
fi
if [[ "$CLOUDFLARE_TUNNEL_TOKEN" == "your_"* ]] || [[ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]]; then
  err_exit "CLOUDFLARE_TUNNEL_TOKEN chưa được đặt trong .env"
fi

# ── 3. Build & Start ──────────────────────────────────────────────────────────
info "Build Docker image..."
docker compose build --no-cache

info "Khởi động các services..."
docker compose up -d

info "Chờ database sẵn sàng..."
sleep 5

# ── 4. Seed database ──────────────────────────────────────────────────────────
echo
read -p "Seed 10 users mặc định vào database? (y/n): " do_seed
if [[ "$do_seed" =~ ^[Yy]$ ]]; then
  docker compose exec app python -m server.seed
  info "Seed hoàn tất"
fi

# ── 5. Status ─────────────────────────────────────────────────────────────────
echo
echo "================================================"
info "Deploy hoàn tất!"
echo "================================================"
echo
docker compose ps
echo
echo "Kiểm tra log tunnel:"
echo "  docker compose logs -f tunnel"
echo
echo "Kiểm tra log app:"
echo "  docker compose logs -f app"
