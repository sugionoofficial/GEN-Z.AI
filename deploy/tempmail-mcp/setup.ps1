# ASCII-only on purpose. Windows PowerShell 5.1 reads .ps1 as ANSI;
# UTF-8 emoji break string parsing. Do not add emoji or non-ASCII here.
# Run: powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        if ($Name -eq "docker") {
            throw "Docker Desktop belum terpasang atau belum ada di PATH. Install dengan: winget install --id Docker.DockerDesktop -e ; lalu restart PowerShell, buka Docker Desktop, dan tunggu sampai statusnya running."
        }
        throw "Command '$Name' not found. Install it first, then run again."
    }
}

Assert-Command "docker"
Assert-Command "git"

docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Plugin 'docker compose' tidak tersedia. Update Docker Desktop ke versi terbaru, lalu ulangi."
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop terpasang tetapi daemon belum jalan. Buka Docker Desktop, tunggu sampai 'Docker Desktop is running', lalu ulangi."
}

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Create deploy config (nothing is committed):"
    $domain = Read-Host "TEMPMAIL_DOMAIN (ex. tempmail.domain.tld)"
    $acme = Read-Host "ACME_EMAIL (for Let's Encrypt)"
    $gmail = Read-Host "GMAIL_EMAIL"
    $securePassword = Read-Host "GMAIL_APP_PASSWORD (16 digits, hidden)" -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    )

    $lines = @(
        ('TEMPMAIL_DOMAIN="{0}"' -f $domain),
        ('ACME_EMAIL="{0}"' -f $acme),
        ('GMAIL_EMAIL="{0}"' -f $gmail),
        ('GMAIL_APP_PASSWORD="{0}"' -f $password)
    )
    ($lines -join [Environment]::NewLine) | Set-Content -Path $envFile -Encoding ASCII
    Write-Host "[OK] .env created. Do not commit this file."
} else {
    Write-Host "[INFO] Using existing .env."
}

# Read values for the final message; docker compose also reads .env itself.
$values = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $values[$matches[1]] = $matches[2].Trim().Trim('"')
    }
}
foreach ($required in @("TEMPMAIL_DOMAIN", "ACME_EMAIL", "GMAIL_EMAIL", "GMAIL_APP_PASSWORD")) {
    if (-not $values[$required]) { throw "$required must be set in .env" }
}

$cloneDir = Join-Path $PSScriptRoot "Tempmail-MCP"
if (-not (Test-Path (Join-Path $cloneDir ".git"))) {
    Write-Host "[CLONE] Tempmail-MCP..."
    git clone https://github.com/sugionoofficial/Tempmail-MCP.git $cloneDir
} else {
    Write-Host "[UPDATE] Tempmail-MCP..."
    git -C $cloneDir pull --ff-only
}

Write-Host "[BUILD] docker compose up..."
docker compose up -d --build

$domainValue = $values["TEMPMAIL_DOMAIN"]
Write-Host ""
Write-Host "[OK] Done. Point DNS $domainValue to this host"
Write-Host "     and open or forward ports 80/443 to Docker Desktop."
Write-Host ""
Write-Host "Verify from outside:"
Write-Host "  curl.exe -i https://$domainValue/api/health"
Write-Host "  curl.exe -i https://$domainValue/api/providers"
Write-Host "  curl.exe -i https://$domainValue/openapi.json"
Write-Host "  docker compose logs -f tempmail-api"
Write-Host ""
Write-Host "Then set the GEN-Z.AI Cloudflare Worker secrets (from repo root):"
Write-Host "  npx wrangler@4 secret put TEMPMAIL_API_URL"
Write-Host "  value: https://$domainValue"
Write-Host "  no /api suffix, no trailing slash"
Write-Host "  npx wrangler@4 secret put TEMPMAIL_PROVIDER   (optional: gmail)"
Write-Host "  npx wrangler@4 secret delete TEMPMAIL_PROVIDER (only if it was mailtm)"
Write-Host ""
Write-Host "Finally open /email.html -> Cek Konfigurasi."
