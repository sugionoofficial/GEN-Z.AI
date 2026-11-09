#!/usr/bin/env bash
# Deploy Tempmail-MCP ke host persisten (VPS) + HTTPS otomatis via Caddy.
# Jalankan di VPS, BUKAN di GitHub Codespaces.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

for cmd in docker git; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "❌ '$cmd' belum terpasang. Install dulu lalu jalankan ulang." >&2
        exit 1
    fi
done

if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Plugin 'docker compose' belum tersedia." >&2
    exit 1
fi

if [ ! -f .env ]; then
    echo "Buat konfigurasi deploy (tidak ada yang di-commit):"
    read -r -p "TEMPMAIL_DOMAIN (mis. tempmail.domain.tld): " TEMPMAIL_DOMAIN
    read -r -p "ACME_EMAIL (untuk Let's Encrypt): " ACME_EMAIL
    read -r -p "GMAIL_EMAIL: " GMAIL_EMAIL
    read -r -s -p "GMAIL_APP_PASSWORD (16 digit, tidak ditampilkan): " GMAIL_APP_PASSWORD
    echo

    cat > .env <<EOF
TEMPMAIL_DOMAIN="${TEMPMAIL_DOMAIN}"
ACME_EMAIL="${ACME_EMAIL}"
GMAIL_EMAIL="${GMAIL_EMAIL}"
GMAIL_APP_PASSWORD="${GMAIL_APP_PASSWORD}"
EOF
    chmod 600 .env
    echo "✅ .env dibuat (mode 600)."
else
    echo "ℹ️  Memakai .env yang sudah ada."
fi

# shellcheck disable=SC1091
set -a
. ./.env
set +a

: "${TEMPMAIL_DOMAIN:?TEMPMAIL_DOMAIN wajib diisi}"
: "${ACME_EMAIL:?ACME_EMAIL wajib diisi}"
: "${GMAIL_EMAIL:?GMAIL_EMAIL wajib diisi}"
: "${GMAIL_APP_PASSWORD:?GMAIL_APP_PASSWORD wajib diisi}"

if [ ! -d Tempmail-MCP/.git ]; then
    echo "📥 Clone Tempmail-MCP..."
    git clone https://github.com/sugionoofficial/Tempmail-MCP.git Tempmail-MCP
else
    echo "🔄 Update Tempmail-MCP..."
    git -C Tempmail-MCP pull --ff-only
fi

echo "🐳 Build & jalankan container..."
docker compose up -d --build

cat <<EOF

✅ Selesai. Pastikan DNS ${TEMPMAIL_DOMAIN} sudah menunjuk ke VPS ini
   dan port 80/443 terbuka agar Caddy bisa menerbitkan sertifikat.

Verifikasi dari luar:
  curl -i https://${TEMPMAIL_DOMAIN}/api/health
  curl -i https://${TEMPMAIL_DOMAIN}/api/providers
  curl -i https://${TEMPMAIL_DOMAIN}/openapi.json
  docker compose logs -f tempmail-api

Lalu set secret Cloudflare Worker GEN-Z.AI (dari mesin yang sudah login wrangler):
  npx wrangler@4 secret put TEMPMAIL_API_URL
  # isi tepat: https://${TEMPMAIL_DOMAIN}
  # jangan tambahkan /api di akhir, jangan pakai trailing slash

  npx wrangler@4 secret put TEMPMAIL_PROVIDER
  # isi: gmail   (opsional; ini sudah default)

  npx wrangler@4 secret delete TEMPMAIL_PROVIDER
  # hanya bila sebelumnya pernah diset mailtm

Terakhir buka /email.html → 🔍 Cek Konfigurasi.
Baris config harus menunjukkan host ${TEMPMAIL_DOMAIN}, bukan *.app.github.dev.
EOF
