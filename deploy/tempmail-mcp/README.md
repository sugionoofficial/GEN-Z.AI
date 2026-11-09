# Deploy Tempmail-MCP ke host persisten

Artefak ini menggantikan **GitHub Codespaces** dengan server yang selalu
hidup. Provider `@gmail.com` tetap dipakai lewat IMAP + App Password, jadi
kontrak `/api/tempmail` di GEN-Z.AI tidak berubah.

> **Ingin cara yang lebih sederhana?** Pakai **Mode C: Hubungkan Gmail**
> di `/email.html` lewat OAuth + Gmail REST API. Tidak perlu artefak ini,
> Docker Desktop, BIOS/virtualisasi, VPS, atau Codespace. Lihat
> [`TEMPMAIL-GMAIL-CONNECT.md`](../../TEMPMAIL-GMAIL-CONNECT.md). Folder ini
> tetap dipertahankan sebagai fallback Mode B.

## Yang disiapkan

| File | Fungsi |
|---|---|
| `docker-compose.yml` | `tempmail-api` (FastAPI), `flaresolverr`, dan `caddy` reverse proxy HTTPS |
| `Caddyfile` | `reverse_proxy tempmail-api:8000` + sertifikat Let's Encrypt otomatis |
| `.env.example` | Template domain, email ACME, dan kredensial Gmail |
| `setup.sh` | Versi Linux/VPS: clone repo upstream, tulis `.env` mode `600`, build, jalankan, cetak langkah set secret |
| `setup.ps1` | Versi Windows PowerShell + Docker Desktop (tanpa `chmod` / `./`) |

Port `8000` **tidak dipublish ke internet**; hanya Caddy yang membuka `80/443`.

## Prasyarat di VPS

- Docker + plugin `docker compose`, Git.

### Error "Virtualization is disabled in firmware"

Ini bukan error `setup.ps1`, tapi prasyarat Docker Desktop/WSL2.
Windows tidak bisa menjalankan hypervisor sampai **hardware virtualization**
diaktifkan di BIOS/UEFI.

#### Lenovo (umum)

1. Matikan lalu nyalakan, tekan **F1** / **F2** berulang, atau tombol **Novo**
   (lubang kecil di sisi bodi) → **BIOS Setup**.
2. Masuk menu **Security** → **Virtualization** (kadang di **CPU Setup** /
   **Advanced**).
3. Set:
   - **Intel (R) Virtualization Technology** / **Intel VT-x** = `Enabled`, atau
   - **AMD-V** / **SVM Mode** = `Enabled`.
4. Opsional: **Intel VT-d Feature** = `Enabled`.
5. **F10** → Save & Exit → reboot.

Setelah masuk Windows, cek:

```powershell
systeminfo | findstr /i "Virtualization Hypervisor"
```

Baris **"Virtualization Enabled In Firmware: Yes"** harus muncul. Lalu aktifkan
fitur Windows (PowerShell **Administrator**):

```powershell
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
wsl --install
wsl --update
wsl --status
bcdedit /set hypervisorlaunchtype auto
```

Reboot, buka Docker Desktop, tunggu **"Docker Desktop is running"**, baru
`docker info` dan `setup.ps1`.

#### Kalau BIOS dikunci / IT managed / CPU tidak support

Jangan paksakan Docker Desktop. Pilih salah satu:

- **Render / Railway / Fly.io** — deploy dari repo Tempmail-MCP tanpa Docker
  lokal (lihat section di bawah), atau
- **VPS Linux** — jalankan `setup.sh` lewat SSH, atau
- **Python native + Cloudflare Tunnel di Windows** — tidak butuh virtualisasi:
  ```powershell
  git clone https://github.com/sugionoofficial/Tempmail-MCP.git
  cd Tempmail-MCP
  python -m venv .venv
  .\.venv\Scripts\python.exe -m pip install -r src\requirements.txt
  $env:GMAIL_EMAIL="akun@gmail.com"
  $env:GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
  .\.venv\Scripts\python.exe -m uvicorn src.api:app --host 0.0.0.0 --port 8000
  ```
  Terminal kedua:
  ```powershell
  cloudflared tunnel create tempmail
  cloudflared tunnel route dns tempmail tempmail.domain.tld
  cloudflared tunnel run --url http://localhost:8000 tempmail
  ```
  Laptop tetap harus menyala; Tunnel memberi URL HTTPS tanpa membuka port.

### Kalau `docker` belum ada di Windows PowerShell

Error `Command 'docker' not found` berarti Docker Desktop belum terpasang
atau belum masuk `PATH`. Install lalu **restart PowerShell**:

```powershell
winget install --id Docker.DockerDesktop -e
# atau unduh dari https://www.docker.com/products/docker-desktop/

# setelah install + Docker Desktop status running:
docker --version
docker compose version
docker info
```

`setup.ps1` sekarang mengecek tiga hal itu dan memberi pesan spesifik:
Docker belum terpasang, plugin `compose` belum ada, atau daemon belum jalan.

- Domain/subdomain mis. `tempmail.domain.tld` dengan **A/AAAA record ke IP VPS**.
- Port `80` dan `443` terbuka.
- `GMAIL_EMAIL` + **App Password 16 digit** (bukan password akun).

> ⚠️ Repo upstream `sugionoofficial/Tempmail-MCP` pernah menyimpan `.env`
> berisi kredensial Gmail secara publik. **Rotasi `GMAIL_APP_PASSWORD`**
> sebelum dipakai produksi, dan jangan commit `.env` hasil `setup.sh`.

## Cara pakai

```bash
# Di VPS Linux:
git clone https://github.com/sugionoofficial/GEN-Z.AI.git
cd GEN-Z.AI/deploy/tempmail-mcp
chmod +x setup.sh
./setup.sh
```

Kalau clone `GEN-Z.AI` sudah ada dan folder `deploy/tempmail-mcp` belum
muncul, arti branch Anda masih `main`. Ambil branch kerja:

```bash
git fetch origin arena/23682d30-gen-z-ai
git checkout arena/23682d30-gen-z-ai
git pull origin arena/23682d30-gen-z-ai
cd deploy/tempmail-mcp
```

Script akan menanyakan 4 nilai, membuat `.env`, clone Tempmail-MCP ke
`./Tempmail-MCP`, lalu `docker compose up -d --build`.

### Windows PowerShell

`chmod` dan `./setup.sh` **tidak ada di PowerShell**. Pakai salah satu:

> `setup.ps1` sengaja **ASCII-only tanpa emoji**. Windows PowerShell 5.1
> membaca `.ps1` sebagai ANSI; emoji UTF-8 merusak tanda kutip string dan
> memicu `AmpersandNotAllowed` / `missing terminator`.

```powershell
# Opsi 1 — Dockerfile Desktop langsung
powershell -ExecutionPolicy Bypass -File .\setup.ps1

# Opsi 2 — WSL / Git Bash (tanpa chmod kalau dipanggil lewat bash)
bash ./setup.sh
```

Di PowerShell murni, gunakan `curl.exe`, bukan `curl` (alias
`Invoke-WebRequest`):

```powershell
curl.exe -i https://tempmail.domain.tld/api/health
```

⚠️ `setup.ps1` cocok untuk **Windows VPS / mesin yang selalu hidup** dengan
Docker Desktop + Linux containers, port 80/443 diteruskan, dan DNS publik.
Laptop yang dimatikan/tidur tidak bisa dipanggil Worker Cloudflare. Kalau
tidak punya VPS, pakai Cloudflare Tunnel di bawah atau layanan container
(Render/Railway/Fly.io).

Verifikasi:

```bash
curl -i https://tempmail.domain.tld/api/health      # harus 200/207 JSON
curl -i https://tempmail.domain.tld/api/providers   # harus 200 JSON
curl -i https://tempmail.domain.tld/openapi.json    # harus 200 JSON
```

Lalu set secret Worker GEN-Z.AI **dari mesin yang sudah login `wrangler`**:

```bash
npx wrangler@4 secret put TEMPMAIL_API_URL
# isi: https://tempmail.domain.tld   (tanpa /api, tanpa trailing slash)

npx wrangler@4 secret put TEMPMAIL_PROVIDER
# isi: gmail  (opsional; sudah default)

# Hapus bila sebelumnya pernah diset:
npx wrangler@4 secret delete TEMPMAIL_PROVIDER   # hanya jika nilainya mailtm
```

Jangan lagi memakai:

- `https://github.com/sugionoofficial/Tempmail-MCP` (repo sumber, bukan API),
- `*.app.github.dev` (port-forward Codespaces, ephemeral/privat),
- `genzai.genzai-f37.workers.dev` (domain aplikasi sendiri),
- `http://localhost:8000` (tidak bisa dijangkau Worker Cloudflare).

Setelah deploy, buka `/email.html` → **🔍 Cek Konfigurasi**. Baris
`TEMPMAIL_API_URL=true (tempmail.domain.tld)` dan check
`✅ tempmail_provider` harus muncul.

## Alternatif: Cloudflare Tunnel (tanpa buka port)

Kalau VPS berada di belakang NAT / tidak boleh membuka `80/443`, pakai
tunnel daripada Caddy:

```bash
cloudflared tunnel create tempmail
cloudflared tunnel route dns tempmail tempmail.domain.tld
docker compose up -d tempmail-api flaresolverr
cloudflared tunnel run --url http://localhost:8000 tempmail
```

Catatan: compose upstream mempublish `8000:8000`, jadi `localhost:8000`
bisa dipakai tunnel. `TEMPMAIL_API_URL` tetap `https://tempmail.domain.tld`.

## Alternatif tanpa Docker lokal: Render / Railway / Fly.io

Kalau ini cuma laptop Windows dan Anda tidak punya VPS, jangan memaksakan
`setup.ps1` (laptop yang tidur tidak bisa dipanggil Worker Cloudflare).
Deploy langsung dari repo upstream **Tanpa Docker di komputer Anda**:

### Render

1. Dashboard Render → **New** → **Web Service**.
2. Connect repo `https://github.com/sugionoofficial/Tempmail-MCP`.
3. Runtime **Docker**; Render memakai `Dockerfile` yang sudah ada
   (`uvicorn src.api:app --host 0.0.0.0 --port 8000`).
4. Environment:
   - `GMAIL_EMAIL`
   - `GMAIL_APP_PASSWORD`
   - `FLARESOLVERR_URL` (isi URL FlareSolverr terpisah, atau biarkan default
     bila tidak memakai provider yang butuh Cloudflare bypass)
   - `PORT=8000`
5. Deploy → catat URL `https://<service>.onrender.com`.
6. Set `TEMPMAIL_API_URL=https://<service>.onrender.com` di Worker GEN-Z.AI.

Catatan: free tier Render bisa **sleep**; pakai plan berbayar / always-on
atau VPS supaya tidak kembali ke masalah "harus dinyalakan dulu".

### Railway / Fly.io

Sama: buat service dari repo Tempmail-MCP, pakai Dockerfile, set env
`GMAIL_EMAIL` + `GMAIL_APP_PASSWORD`, expose port `8000`, lalu pakai URL
HTTPS yang diberikan platform sebagai `TEMPMAIL_API_URL`.

Verifikasi tetap sama:

```bash
curl -i https://<host>/api/health
curl -i https://<host>/api/providers
curl -i https://<host>/openapi.json
```

## Catatan Cloudflare DNS

Bila domain di-proxy Orange Cloud di Cloudflare, set SSL/TLS mode ke
**Full (strict)** agar Caddy ↔ Cloudflare tidak loop redirect. Bila memakai
Caddy dengan sertifikat sendiri, mode **DNS only** juga boleh.

## Troubleshooting cepat

| Gejala | Tindakan |
|---|---|
| `/api/health` masih HTML 404 | Cek `docker compose ps`, `docker compose logs -f caddy`, DNS domain, dan pastikan secret Worker sudah diganti ke domain baru |
| `502` dari Caddy | `docker compose logs -f tempmail-api`; pastikan container `tempmail-api` sehat |
| Provider `gmail` nonaktif | Cek `GMAIL_APP_PASSWORD`, lalu `POST /api/providers/gmail/enable` di host Tempmail-MCP |
| Diagnostik GEN-Z.AI masih menunjukkan `*.app.github.dev` | Secret lama belum ditimpa; jalankan ulang `wrangler secret put TEMPMAIL_API_URL` lalu redeploy Worker |
