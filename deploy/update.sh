#!/bin/bash
# TechNote — Update app (rebuild + restart, giữ nguyên database)
set -e
GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[OK]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

info "Rebuild image mới..."
docker compose build --no-cache app

info "Restart app (database giữ nguyên)..."
docker compose up -d --no-deps app

info "Xong. Log:"
docker compose ps
