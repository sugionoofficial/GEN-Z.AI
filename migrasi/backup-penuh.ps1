<#
=====================================================================
backup-penuh.ps1 — versi PowerShell dari migrasi/backup-penuh.sh
=====================================================================
Untuk pengguna Windows. Hasilnya IDENTIK dengan versi .sh: 60 tabel,
4.449 baris, data auth 25 user, metadata storage 112 objek.

Pakai (di PowerShell, dari folder kerja):

    # 1) isi dulu dua variabel ini (salin dari Notepad, jangan diketik ulang)
    $SRC = 'postgresql://postgres.ycovbqmezhrvzobxqnyp:PASSWORD@aws-0-...:5432/postgres'
    $DST = 'postgresql://postgres.rvgioyenjgkprnssfpfr:PASSWORD@aws-0-...:5432/postgres'

    # 2) jalankan
    .\backup-penuh.ps1 dump
    .\backup-penuh.ps1 restore

Kalau muncul "running scripts is disabled on this system", jalankan sekali:

    powershell -ExecutionPolicy Bypass -File .\backup-penuh.ps1 dump

Tiga keputusan teknis yang penting (jangan diubah):

1. `pg_dump` dicari lewat `Get-Command`, lalu lewat lokasi default
   C:\Program Files\PostgreSQL\*\bin. Alasan: `$env:Path += ...` hanya
   berlaku di jendela PowerShell tempat ia diketik.
2. Password di dalam connection string di-URL-encode otomatis. Alasannya:
   karakter seperti @ : / # memutus parsing URL. Skrip .sh gagal di kasus ini,
   di sini tidak.
3. Restore dijalankan lewat SATU berkas gabungan dalam SATU pemanggilan psql
   dengan --single-transaction. Alasannya: `set session_replication_role =
   replica` hanya berlaku untuk sesi berjalan; kalau tiap berkas dijalankan
   sendiri-sendiri, setting itu hilang lebih dulu dan FK
   public.profiles -> auth.users menolak 2_auth.sql.
=====================================================================
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('dump', 'restore', 'verify', 'help')]
    [string]$Mode = 'help'
)

$ErrorActionPreference = 'Stop'

$Dir = if ($env:DIR) { $env:DIR } else { Join-Path (Get-Location) 'genz-backup' }
$FPub      = Join-Path $Dir '1_public.sql'
$FPubClean = Join-Path $Dir '1_public_clean.sql'
$FAuth     = Join-Path $Dir '2_auth.sql'
$FStorage  = Join-Path $Dir '3_storage_meta.sql'
$FPre      = Join-Path $Dir '0_pre.sql'
$FPost     = Join-Path $Dir '9_post.sql'
$FGabung   = Join-Path $Dir 'restore_all.sql'
$FErr      = Join-Path $Dir 'restore.err'

function Say  ($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Ok   ($m) { Write-Host "  OK   $m" -ForegroundColor Green }
function Warn ($m) { Write-Host "  !    $m" -ForegroundColor Yellow }
function Die  ($m) { Write-Host "`nGAGAL: $m" -ForegroundColor Red; exit 1 }

function Find-PgTool([string]$nama) {
    $cmd = Get-Command $nama -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # Tidak ada di PATH: cari di lokasi instalasi default, versi TERBARU dulu.
    $kandidat = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\' -Filter "$nama.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending
    if ($kandidat) {
        Warn "$nama tidak ada di PATH; memakai $($kandidat[0].FullName)"
        Warn 'Untuk permanen, lihat migrasi/TUTORIAL-BACKUP.md bagian PATH.'
        return $kandidat[0].FullName
    }
    Die "$nama tidak ditemukan. Install PostgreSQL client (TUTORIAL-BACKUP.md Langkah 1)."
}

function Assert-Env {
    if (-not $SRC) { Die 'variabel $SRC belum diisi (connection string project LAMA)' }
    if (-not $DST) { Die 'variabel $DST belum diisi (connection string project BARU)' }
    if ($SRC -match ':6543') { Die '$SRC memakai port 6543 (transaction pooler). Pakai 5432 (session pooler).' }
    if ($DST -match ':6543') { Die '$DST memakai port 6543 (transaction pooler). Pakai 5432 (session pooler).' }
    if ($SRC -match '\[YOUR-PASSWORD\]' -or $DST -match '\[YOUR-PASSWORD\]') {
        Die 'masih ada teks [YOUR-PASSWORD]. Ganti dengan password asli (tanpa tanda kurung).'
    }
}

function Encode-Url([string]$url) {
    # Encode password saja, bukan seluruh URL.
    if ($url -notmatch '^(?<pre>postgresql://[^:/@]+:)(?<pw>[^@]*)(?<post>@.*)$') { return $url }
    $pw = [uri]::EscapeDataString($Matches.pw)
    return $Matches.pre + $pw + $Matches.post
}

function Invoke-Dump {
    $pgDump = Find-PgTool 'pg_dump'
    Assert-Env
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    $src = Encode-Url $SRC

    Say 'Versi client'
    & $pgDump --version
    Ok 'pg_dump ditemukan'

    Say '1/5 skema + data public (60 tabel)'
    & $pgDump $src --no-owner --no-privileges --schema=public -f $FPub
    if ($LASTEXITCODE -ne 0) { Die 'pg_dump public gagal. Salin 10 baris error di atas.' }

    # Buang dua baris yang PASTI error di target (skema public sudah ada).
    Get-Content $FPub | Where-Object {
        $_ -notmatch '^CREATE SCHEMA public;' -and $_ -notmatch '^ALTER SCHEMA public OWNER TO '
    } | Set-Content $FPubClean -Encoding utf8
    Ok "$((Get-Content $FPubClean).Count) baris -> $FPubClean"

    Say '2/5 DATA auth.users + auth.identities (WAJIB — tanpa ini akun hilang)'
    & $pgDump $src --data-only --no-owner --table=auth.users --table=auth.identities -f $FAuth
    if ($LASTEXITCODE -ne 0) { Die 'pg_dump auth gagal — JANGAN lanjut restore.' }
    $ukuranAuth = (Get-Item $FAuth).Length
    if ($ukuranAuth -lt 2000) {
        Die "berkas auth hanya $ukuranAuth byte. Kemungkinan 25 akun tidak ikut. Jangan lanjut."
    }
    Ok "$([math]::Round($ukuranAuth/1KB,1)) KB — berisi data auth"

    Say '3/5 metadata storage.buckets + storage.objects (file menyusul di Fase B)'
    & $pgDump $src --data-only --no-owner --table=storage.buckets --table=storage.objects -f $FStorage
    if ($LASTEXITCODE -ne 0) { Warn 'metadata storage gagal — tidak fatal untuk Fase A' }
    else { Ok "$([math]::Round((Get-Item $FStorage).Length/1KB,1)) KB" }

    # Tanpa begin/commit: --single-transaction sudah membungkus semuanya.
    Say 'Menyiapkan pembungkus restore'
    @'
-- dijalankan SEBELUM restore: matikan trigger & cek FK agar urutan INSERT bebas.
set session_replication_role = replica;
'@ | Set-Content $FPre -Encoding utf8

    @'
-- dijalankan SESUDAH restore: kembalikan trigger, sinkronkan sequence.
set session_replication_role = origin;
select setval(pg_get_serial_sequence('public.credit_change_audit', 'id'),
              coalesce((select max(id) from public.credit_change_audit), 1), true)
  where to_regclass('public.credit_change_audit') is not null;
'@ | Set-Content $FPost -Encoding utf8

    Say 'SELESAI'
    foreach ($f in @($FPre, $FPubClean, $FAuth, $FStorage, $FPost)) {
        if (Test-Path $f) { Ok ("{0,8:N1} KB  {1}" -f ((Get-Item $f).Length/1KB), $f) }
    }
    Warn "Folder $Dir berisi PII (hash password + API key). Jangan di-commit/di-upload."
    Warn 'Lanjut:  .\backup-penuh.ps1 restore'
}

function Invoke-Restore {
    $psql = Find-PgTool 'psql'
    Assert-Env
    foreach ($f in @($FPubClean, $FAuth)) {
        if (-not (Test-Path $f) -or (Get-Item $f).Length -eq 0) {
            Die "$f tidak ada/kosong. Jalankan '.\backup-penuh.ps1 dump' dulu."
        }
    }
    $dst = Encode-Url $DST

    # Gabungkan semua berkas menjadi satu, lalu SATU pemanggilan psql.
    # Dua perintah kontrol sesi (replica/origin) TIDAK boleh berada di berkas
    # terpisah — lihat catatan di kepala skrip ini.
    Say 'Menggabungkan berkas restore'
    $bagian = @($FPre, $FPubClean, $FAuth, $FStorage, $FPost) | Where-Object {
        (Test-Path $_) -and (Get-Item $_).Length -gt 0
    }
    $stream = New-Object System.IO.StreamWriter($FGabung, $false, (New-Object System.Text.UTF8Encoding($false)))
    try {
        foreach ($f in $bagian) {
            $stream.WriteLine("-- ===== $(Split-Path $f -Leaf) =====")
            $stream.Write((Get-Content $f -Raw))
            $stream.WriteLine()
            Ok (Split-Path $f -Leaf)
        }
    } finally { $stream.Close() }

    Say 'Restore ke TARGET (satu sesi, satu transaksi)'
    & $psql $dst -v ON_ERROR_STOP=1 --single-transaction -q -f $FGabung 2> $FErr
    $kode = $LASTEXITCODE
    if ($kode -ne 0) {
        Write-Host '  GAGAL' -ForegroundColor Red
        if (Test-Path $FErr) { Get-Content $FErr | Select-Object -First 25 | ForEach-Object { Write-Host "  $_" } }
        Die 'restore dibatalkan. Satu transaksi => TARGET kembali seperti sebelum restore. Perbaiki lalu ulangi.'
    }
    Ok 'restore selesai — semua berkas masuk'
    Invoke-Verify
}

function Invoke-Verify {
    $psql = Find-PgTool 'psql'
    Assert-Env
    $dst = Encode-Url $DST
    Say 'Verifikasi angka kunci (target)'
    $sql = @'
select 'auth.users' as cek, (select count(*)::text from auth.users) as hasil, '25' as harus
union all select 'auth.identities', (select count(*)::text from auth.identities), '25'
union all select 'profiles', coalesce((select count(*)::text from public.profiles),'(belum ada)'), '25'
union all select 'models', coalesce((select count(*)::text from public.models),'(belum ada)'), '45'
union all select 'generation_history', coalesce((select count(*)::text from public.generation_history),'(belum ada)'), '502'
union all select 'social_post_runs', coalesce((select count(*)::text from public.social_post_runs),'(belum ada)'), '941'
union all select 'storage.objects', (select count(*)::text from storage.objects), '112'
union all select 'owner_ada', (select count(*)::text from public.profiles where role='OWNER'), '>=1';
'@
    & $psql $dst -c $sql
    Write-Host @'

  Semua baris harus cocok di kolom hasil vs harus.
  Verifikasi struktur (60 tabel, RLS, policy, trigger):
    buka migrasi/verify-restore.sql di SQL Editor project BARU.
    Target: tabel_pass 60, tabel_gagal 0.
'@
}

switch ($Mode) {
    'dump'    { Invoke-Dump }
    'restore' { Invoke-Restore }
    'verify'  { Invoke-Verify }
    'help'    {
        Get-Content $PSCommandPath | Select-Object -First 40 |
            ForEach-Object { $_ -replace '^<#\s?', '' -replace '\s?#>\s?$', '' }
        exit 1
    }
}
