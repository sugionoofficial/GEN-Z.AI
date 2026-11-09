# Deploy Tempmail-MCP memakai Docker Desktop di Windows PowerShell.
# Jalankan: powershell -ExecutionPolicy Bypass -File .\setup.ps1
# Catatan: host ini harus selalu hidup dan punya domain HTTPS publik.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' belum terpasang. Install dulu lalu jalankan ulang."
    }
}

Assert-Command "docker"
Assert-Command "git"
docker compose version | Out-Null

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Buat konfigurasi deploy (tidak ada yang di-commit):"
    $domain = Read-Host "TEMPMAIL_DOMAIN (mis. tempmail.domain.tld)"
    $acme = Read-Host "ACME_EMAIL (untuk Let's Encrypt)"
    $gmail = Read-Host "GMAIL_EMAIL"
    $securePassword = Read-Host "GMAIL_APP_PASSWORD (16 digit, tidak ditampilkan)" -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    )

    @"
TEMPMAIL_DOMAIN="$domain"
ACME_EMAIL="$acme"
GMAIL_EMAIL="$gmail"
GMAIL_APP_PASSWORD="$password"
"@ | Set-Content -Path $envFile -Encoding UTF8
    Write-Host "✓ .env dibuat. Jangan commit file ini."
} else {
    Write-Host "ℹ Memakai .env yang sudah ada."
}

# Baca nilai untuk pesan penutup; docker compose juga membaca .env otomatis.
$values = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $values[$matches[1]] = $matches[2].Trim().Trim('"')
    }
}
foreach ($required in @("TEMPMAIL_DOMAIN", "ACME_EMAIL", "GMAIL_EMAIL", "GMAIL_APP_PASSWORD")) {
    if (-not $values[$required]) { throw "$required wajib diisi di .env" }
}

$cloneDir = Join-Path $PSScriptRoot "Tempmail-MCP"
if (-not (Test-Path (Join-Path $cloneDir ".git"))) {
    Write-Host "📥 Clone Tempmail-MCP..."
    git clone https://github.com/sugionoofficial/Tempmail-MCP.git $cloneDir
} else {
    Write-Host "🔄 Update Tempmail-MCP..."
    git -C $cloneDir pull --ff-only
}

Write-Host "🐳 Build & jalankan container..."
docker compose up -d --build

$domainValue = $values["TEMPMAIL_DOMAIN"]
Write-Host ""
Write-Host "✅ Selesai. Pastikan DNS $domainValue menunjuk ke host ini"
Write-Host "   dan port 80/443 terbuka / diteruskan ke Docker Desktop."
Write-Host ""
Write-Host "Verifikasi dari luar:"
Write-Host "  curl.exe -i https://$domainValue/api/health"
Write-Host "  curl.exe -i https://$domainValue/api/providers"
Write-Host "  curl.exe -i https://$domainValue/openapi.json"
Write-Host "  docker compose logs -f tempmail-api"
Write-Host ""
Write-Host "Lalu set secret Cloudflare Worker GEN-Z.AI:"
Write-Host "  npx wrangler@4 secret put TEMPMAIL_API_URL"
Write-Host "  # isi tepat: https://$domainValue"
Write-Host "  # jangan tambahkan /api di akhir, jangan trailing slash"
Write-Host "  npx wrangler@4 secret put TEMPMAIL_PROVIDER   # gmail (opsional)"
Write-Host "  npx wrangler@4 secret delete TEMPMAIL_PROVIDER # hanya bila sebelumnya mailtm"
Write-Host ""
Write-Host "Terakhir buka /email.html → 🔍 Cek Konfigurasi."
