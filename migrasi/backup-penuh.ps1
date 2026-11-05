<#
=====================================================================
backup-penuh.ps1 - versi PowerShell dari migrasi/backup-penuh.sh
=====================================================================
Untuk pengguna Windows. Hasilnya identik dengan versi .sh: 60 tabel,
4449 baris, data auth 25 user, metadata storage 112 objek.

Pakai (di PowerShell, dari folder kerja):

    $SRC = 'postgresql://postgres.ycovbqmezhrvzobxqnyp:PASSWORD@...:5432/postgres'
    $DST = 'postgresql://postgres.rvgioyenjgkprnssfpfr:PASSWORD@...:5432/postgres'
    powershell -ExecutionPolicy Bypass -File .\backup-penuh.ps1 dump
    powershell -ExecutionPolicy Bypass -File .\backup-penuh.ps1 restore

Tiga aturan yang menjaga skrip ini tetap jalan di Windows PowerShell 5.1
(dan sengaja dikunci oleh tests/backup-toolkit.test.mjs):

1. SELURUH berkas hanya berisi karakter ASCII. PowerShell 5.1 membaca .ps1
   sebagai ANSI, sehingga tanda seperti em-dash atau panah rusak menjadi
   karakter lain dan memutus string.
2. TIDAK memakai here-string (@' ... '@). Penutup here-string WAJIB berada di
   kolom 0; kalau ter-indentasi, seluruh berkas gagal di-parse.
3. Berkas SQL ditulis sebagai UTF-8 TANPA BOM. BOM di awal berkas membuat
   psql menolak baris pertama.

Keputusan teknis lain:

4. pg_dump/psql dicari lewat Get-Command, lalu lokasi default
   C:\Program Files\PostgreSQL\*\bin, karena $env:Path hanya berlaku di
   jendela tempat ia diketik.
5. Password di dalam connection string di-URL-encode otomatis, sehingga
   karakter @ : / # tidak memutus parsing URL.
6. Restore memakai SATU berkas gabungan dalam SATU pemanggilan psql dengan
   --single-transaction. set session_replication_role = replica hanya
   berlaku untuk sesi berjalan; kalau tiap berkas dipanggil terpisah, setting
   itu hilang lebih dulu dan FK public.profiles -> auth.users menolak
   2_auth.sql.
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

function Say  ($m) { Write-Host ""; Write-Host "== $m" -ForegroundColor Cyan }
function Ok   ($m) { Write-Host "  OK   $m" -ForegroundColor Green }
function Warn ($m) { Write-Host "  !    $m" -ForegroundColor Yellow }
function Die  ($m) { Write-Host ""; Write-Host "GAGAL: $m" -ForegroundColor Red; exit 1 }

# Tulis berkas sebagai UTF-8 tanpa BOM. Set-Content -Encoding utf8 pada
# PowerShell 5.1 menambahkan BOM, dan BOM di awal berkas .sql membuat psql
# menolak baris pertama dengan pesan syntax error.
function Write-Utf8NoBom([string]$path, [string]$isi) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $isi, $enc)
}

function Find-PgTool([string]$nama) {
    $cmd = Get-Command $nama -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $kandidat = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\' -Filter "$nama.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending
    if ($kandidat) {
        Warn "$nama tidak ada di PATH; memakai $($kandidat[0].FullName)"
        Warn 'Untuk permanen: lihat migrasi/TUTORIAL-BACKUP.md bagian PATH.'
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
    # -Encoding UTF8 wajib: PowerShell 5.1 default ANSI akan merusak teks
    # non-ASCII (mis. emoji) di dalam data.
    $bersih = Get-Content $FPub -Encoding UTF8 | Where-Object {
        $_ -notmatch '^CREATE SCHEMA public;' -and $_ -notmatch '^ALTER SCHEMA public OWNER TO '
    }
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($FPubClean, $bersih, $enc)
    Ok ("{0} baris -> {1}" -f $bersih.Count, $FPubClean)

    Say '2/5 DATA auth.users + auth.identities (WAJIB, tanpa ini akun hilang)'
    & $pgDump $src --data-only --no-owner --table=auth.users --table=auth.identities -f $FAuth
    if ($LASTEXITCODE -ne 0) { Die 'pg_dump auth gagal. JANGAN lanjut restore.' }
    $ukuranAuth = (Get-Item $FAuth).Length
    if ($ukuranAuth -lt 2000) {
        Die "berkas auth hanya $ukuranAuth byte. Kemungkinan 25 akun tidak ikut. Jangan lanjut."
    }
    Ok ("{0} KB, berisi data auth" -f [int]($ukuranAuth / 1KB))

    Say '3/5 metadata storage.buckets + storage.objects (file menyusul di Fase B)'
    & $pgDump $src --data-only --no-owner --table=storage.buckets --table=storage.objects -f $FStorage
    if ($LASTEXITCODE -ne 0) { Warn 'metadata storage gagal, tidak fatal untuk Fase A' }
    else { Ok ("{0} KB" -f [int]((Get-Item $FStorage).Length / 1KB)) }

    Say 'Menyiapkan pembungkus restore'
    # TANPA begin/commit: --single-transaction sudah membungkus seluruh
    # restore. commit; akan MENUTUP transaksi lebih awal sehingga kegagalan
    # berikutnya tidak membatalkan apa pun.
    $preSql = (@(
        '-- dijalankan SEBELUM restore: matikan trigger dan cek FK agar urutan INSERT bebas.',
        'set session_replication_role = replica;'
    ) -join [Environment]::NewLine)
    Write-Utf8NoBom $FPre $preSql

    $postSql = (@(
        '-- dijalankan SESUDAH restore: kembalikan trigger, sinkronkan sequence.',
        'set session_replication_role = origin;',
        "select setval(pg_get_serial_sequence('public.credit_change_audit', 'id'),",
        '              coalesce((select max(id) from public.credit_change_audit), 1), true)',
        "  where to_regclass('public.credit_change_audit') is not null;"
    ) -join [Environment]::NewLine)
    Write-Utf8NoBom $FPost $postSql

    Say 'SELESAI'
    foreach ($f in @($FPre, $FPubClean, $FAuth, $FStorage, $FPost)) {
        if (Test-Path $f) { Ok ("{0,8} KB  {1}" -f [int]((Get-Item $f).Length / 1KB), $f) }
    }
    Warn "Folder $Dir berisi PII (hash password + API key). Jangan di-commit atau di-upload."
    Warn 'Lanjut: powershell -ExecutionPolicy Bypass -File .\backup-penuh.ps1 restore'
}

function Invoke-Restore {
    $psql = Find-PgTool 'psql'
    Assert-Env
    foreach ($f in @($FPubClean, $FAuth)) {
        if (-not (Test-Path $f) -or (Get-Item $f).Length -eq 0) {
            Die "$f tidak ada atau kosong. Jalankan 'dump' dulu."
        }
    }
    $dst = Encode-Url $DST

    Say 'Menggabungkan berkas restore'
    $bagian = @($FPre, $FPubClean, $FAuth, $FStorage, $FPost) | Where-Object {
        (Test-Path $_) -and (Get-Item $_).Length -gt 0
    }
    $enc = New-Object System.Text.UTF8Encoding($false)
    $stream = New-Object System.IO.StreamWriter($FGabung, $false, $enc)
    try {
        foreach ($f in $bagian) {
            $stream.WriteLine("-- ===== $(Split-Path $f -Leaf) =====")
            $stream.Write((Get-Content $f -Raw -Encoding UTF8))
            $stream.WriteLine()
            Ok (Split-Path $f -Leaf)
        }
    } finally { $stream.Close() }

    Say 'Restore ke TARGET (satu sesi, satu transaksi)'
    & $psql $dst -v ON_ERROR_STOP=1 --single-transaction -q -f $FGabung 2> $FErr
    $kode = $LASTEXITCODE
    if ($kode -ne 0) {
        Write-Host '  GAGAL' -ForegroundColor Red
        if (Test-Path $FErr) {
            Get-Content $FErr -Encoding UTF8 | Select-Object -First 25 | ForEach-Object { Write-Host "  $_" }
        }
        Die 'restore dibatalkan. Satu transaksi berarti TARGET kembali seperti sebelum restore. Perbaiki lalu ulangi.'
    }
    Ok 'restore selesai, semua berkas masuk'
    Invoke-Verify
}

function Invoke-Verify {
    $psql = Find-PgTool 'psql'
    Assert-Env
    $dst = Encode-Url $DST

    $sql = (@(
        "select 'auth.users' as cek, (select count(*)::text from auth.users) as hasil, '25' as harus",
        "union all select 'auth.identities', (select count(*)::text from auth.identities), '25'",
        "union all select 'profiles', coalesce((select count(*)::text from public.profiles), '(belum ada)'), '25'",
        "union all select 'models', coalesce((select count(*)::text from public.models), '(belum ada)'), '45'",
        "union all select 'generation_history', coalesce((select count(*)::text from public.generation_history), '(belum ada)'), '502'",
        "union all select 'social_post_runs', coalesce((select count(*)::text from public.social_post_runs), '(belum ada)'), '941'",
        "union all select 'storage.objects', (select count(*)::text from storage.objects), '112'",
        "union all select 'owner_ada', (select count(*)::text from public.profiles where role = 'OWNER'), '>=1';"
    ) -join [Environment]::NewLine)

    Say 'Verifikasi angka kunci (target)'
    & $psql $dst -c $sql
    Write-Host ''
    Write-Host '  Semua baris: kolom hasil harus sama dengan kolom harus.'
    Write-Host '  Verifikasi struktur (60 tabel, RLS, policy, trigger):'
    Write-Host '    buka migrasi/verify-restore.sql di SQL Editor project BARU.'
    Write-Host '    Target: tabel_pass 60, tabel_gagal 0.'
}

switch ($Mode) {
    'dump'    { Invoke-Dump }
    'restore' { Invoke-Restore }
    'verify'  { Invoke-Verify }
    'help'    {
        Get-Content $PSCommandPath | Select-Object -First 46 |
            ForEach-Object { $_ -replace '^<#\s?', '' -replace '\s?#>', '' }
        exit 1
    }
}
