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
    [string]$Mode = 'help',

    # Opsional: alamat bisa diberikan langsung, melewati variabel/env.
    [string]$Src,
    [string]$Dst
)

$ErrorActionPreference = 'Stop'

$Dir = if ($env:DIR) { $env:DIR } else { Join-Path (Get-Location) 'genz-backup' }

# PENTING soal variabel $SRC / $DST.
# Kalau skrip dijalankan lewat `powershell -File`, PowerShell membuat proses
# BARU dengan sesi bersih: variabel yang Anda isi di jendela sebelah TIDAK
# ikut. Karena itu skrip ini menerima alamat lewat environment variable juga
# (mis. `$env:SRC = '...'`), yang memang diwarisi proses anak. Urutan
# pemeriksaan: parameter -Src/-Dst, lalu $SRC/$DST di sesi ini, lalu $env:SRC.
$SrcUrl = if ($Src) { $Src } elseif ($SRC) { $SRC } else { $env:SRC }
$DstUrl = if ($Dst) { $Dst } elseif ($DST) { $DST } else { $env:DST }
$FPub      = Join-Path $Dir '1_public.sql'
$FPubClean = Join-Path $Dir '1_public_clean.sql'
$FPubData  = Join-Path $Dir '1b_public_data.sql'
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

# ---------------------------------------------------------------------
# Preamble idempoten: menetralkan objek milik Supabase yang SELALU sudah ada
# di project baru, sehingga dump project lama tidak bentrok.
#
# Kasus nyata: project Supabase memiliki fungsi public.rls_auto_enable() plus
# event trigger `ensure_rls`. Dump ikut membawa CREATE FUNCTION itu, lalu
# restore berhenti dengan:
#   ERROR: function "rls_auto_enable" already exists with same argument types
# Padahal fungsi itu milik platform, bukan aplikasi.
#
# Strategi: sebelum dump dijalankan, buang CREATE FUNCTION untuk fungsi yang
# di project tujuan dimiliki platform (daftar di $FungsiPlatform), plus seluruh
# CREATE EVENT TRIGGER. Fungsi platform tidak perlu disalin ulang; fungsi milik
# aplikasi tidak disentuh.
#
# JANGAN men-drop fungsi platform di target sebagai "solusi": baris
# ALTER FUNCTION dari dump akan gagal dengan 'function does not exist'.
# Cukup jangan disalin.
# ---------------------------------------------------------------------
$FungsiPlatform = @('rls_auto_enable')

# ---------------------------------------------------------------------
# Pisahkan dump public menjadi SKEMA dan DATA.
#
# Kenapa perlu: foreign key dari tabel public ke auth.users
# (mis. credit_transactions.created_by_fkey) diperiksa saat INSERT. Kalau
# seluruh dump public dimuat lebih dulu sementara auth.users masih kosong,
# baris pertama yang mereferensikan user akan ditolak:
#   ERROR: insert or update on table "credit_transactions" violates foreign
#          key constraint "credit_transactions_created_by_fkey"
#
# Urutan yang benar: SKEMA public -> DATA auth -> DATA public.
# Dengan pemisahan ini, tidak ada lagi ketergantungan pada trik mematikan
# trigger per sesi (session_replication_role), yang rapuh di pooler.
#
# Baris COPY pada dump pg_dump selalu diakhiri satu baris berisi "\.".
# ---------------------------------------------------------------------
function Split-SchemaData([string]$pathSumber, [string]$pathSkema, [string]$pathData) {
    $skema = New-Object System.Collections.Generic.List[string]
    $data  = New-Object System.Collections.Generic.List[string]
    $dalamCopy = $false
    $jumlahCopy = 0

    foreach ($b in (Get-Content $pathSumber -Encoding UTF8)) {
        if ($dalamCopy) {
            $data.Add($b)
            if ($b -eq '\.') { $dalamCopy = $false }
            continue
        }

        if ($b -match '^COPY .* FROM stdin;$') {
            $dalamCopy = $true
            $jumlahCopy++
            $data.Add($b)
            continue
        }

        # Baris non-COPY selalu bagian skema. Setelan SET/set_config tidak perlu
        # disalin ke bagian data karena preamble sudah mengirimkannya sendiri.
        $skema.Add($b)
    }

    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($pathSkema, $skema, $enc)
    [System.IO.File]::WriteAllLines($pathData, $data, $enc)
    return $jumlahCopy
}

function Remove-DdlPlatform([string]$pathSumber, [string]$pathTujuan) {
    # Buang blok CREATE [OR REPLACE] FUNCTION public.<nama platform> ...
    # sampai penutup $$; pertama setelahnya. Juga buang ALTER/COMMENT yang
    # menempel padanya agar tidak ada perintah yatim.
    $baris = Get-Content $pathSumber -Encoding UTF8
    $keluar = New-Object System.Collections.Generic.List[string]
    $lewati = $false
    $dilewati = 0
    $jumlahBuang = 0
    foreach ($b in $baris) {
        if (-not $lewati) {
            $cocok = $false
            foreach ($nama in $FungsiPlatform) {
                if ($b -match ("^CREATE (OR REPLACE )?FUNCTION public\." + [regex]::Escape($nama) + "\s*\(")) { $cocok = $true }
            }
            if ($cocok) { $lewati = $true; $jumlahBuang++; continue }
            # Event trigger di project Supabase (ensure_rls, pgrst_*, issue_*)
            # semuanya milik platform dan sudah ada di target.
            if ($b -match '^CREATE EVENT TRIGGER ') { $jumlahBuang++; continue }
            $keluar.Add($b)
        } else {
            $dilewati = $dilewati + 1
            # Pengaman: kalau penutup $$; tidak ditemukan dalam 400 baris,
            # berarti pola tidak cocok dan kita berisiko memotong sisa berkas.
            # Lebih baik berhenti terang-terangan daripada menghasilkan dump
            # cacat yang tetap "berhasil" di-restore.
            if ($dilewati -gt 400) {
                Die 'gagal membuang DDL fungsi platform (penutup tidak ditemukan). Lapor ke agen; jangan restore dump ini.'
            }
            # Blok fungsi berakhir pada baris yang mengandung $$; di akhir.
            if ($b -match '\$\$;\s*$') { $lewati = $false; $dilewati = 0 }
        }
    }
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($pathTujuan, $keluar, $enc)
    return $jumlahBuang
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
    if (-not $SrcUrl) { Die 'alamat project LAMA belum diisi. Isi $env:SRC (lihat TUTORIAL-BACKUP.md).' }
    if (-not $DstUrl) { Die 'alamat project BARU belum diisi. Isi $env:DST (lihat TUTORIAL-BACKUP.md).' }
    if ($SrcUrl -match ':6543') { Die 'alamat LAMA memakai port 6543 (transaction pooler). Pakai 5432 (session pooler).' }
    if ($DstUrl -match ':6543') { Die 'alamat BARU memakai port 6543 (transaction pooler). Pakai 5432 (session pooler).' }
    if ($SrcUrl -match '\[YOUR-PASSWORD\]' -or $DstUrl -match '\[YOUR-PASSWORD\]') {
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
    $src = Encode-Url $SrcUrl

    Say 'Versi client'
    & $pgDump --version
    Ok 'pg_dump ditemukan'

    Say '1/5 skema + data public (60 tabel)'
    & $pgDump $src --no-owner --no-privileges --schema=public -f $FPub
    if ($LASTEXITCODE -ne 0) { Die 'pg_dump public gagal. Salin 10 baris error di atas.' }

    # Buang dua baris yang PASTI error di target (skema public sudah ada).
    # -Encoding UTF8 wajib: PowerShell 5.1 default ANSI akan merusak teks
    # non-ASCII (mis. emoji) di dalam data.
    # Langkah 1: buang dua baris yang pasti error di target, dan buang DDL
    # fungsi milik platform Supabase dan seluruh event trigger platform
    # (lihat catatan di Remove-DdlPlatform).
    $sementara = Join-Path $Dir '1_public_tmp.sql'
    $bersih = Get-Content $FPub -Encoding UTF8 | Where-Object {
        $_ -notmatch '^CREATE SCHEMA public;' -and $_ -notmatch '^ALTER SCHEMA public OWNER TO '
    }
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($sementara, $bersih, $enc)

    $dibuang = Remove-DdlPlatform $sementara $FPubClean
    Remove-Item $sementara -ErrorAction SilentlyContinue
    Ok ("{0} baris -> {1}" -f (Get-Content $FPubClean).Count, $FPubClean)

    # Pisahkan: skema dimuat lebih dulu, data public dimuat SETELAH auth
    # (lihat catatan di Split-SchemaData).
    $skemaSaja = Join-Path $Dir '1_public_schema.sql'
    $jumlahCopy = Split-SchemaData $FPubClean $skemaSaja $FPubData
    Move-Item -Force $skemaSaja $FPubClean
    Ok ("{0} blok COPY data dipisah -> {1}" -f $jumlahCopy, (Split-Path $FPubData -Leaf))
    if ($dibuang -gt 0) {
        Ok ("{0} blok DDL fungsi platform dibuang (sudah ada di project baru): {1}" -f $dibuang, ($FungsiPlatform -join ', '))
    }

    Say '2/5 DATA auth.users + auth.identities (WAJIB, tanpa ini akun hilang)'
    & $pgDump $src --data-only --no-owner --table=auth.users --table=auth.identities -f $FAuth
    if ($LASTEXITCODE -ne 0) { Die 'pg_dump auth gagal. JANGAN lanjut restore.' }
    $ukuranAuth = (Get-Item $FAuth).Length
    if ($ukuranAuth -lt 2000) {
        Die "berkas auth hanya $ukuranAuth byte. Kemungkinan 25 akun tidak ikut. Jangan lanjut."
    }
    $barisCopy = (Get-Content $FAuth -Encoding UTF8 | Select-String -Pattern '^COPY ' | Measure-Object).Count
    Ok ("{0:N1} KB, {1} blok COPY (harus 2: auth.users + auth.identities)" -f ($ukuranAuth / 1KB), $barisCopy)
    if ($barisCopy -lt 1) { Die 'berkas auth tidak memuat satu pun blok COPY. Jangan lanjut restore.' }

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
    # [int] membulatkan ke bawah, sehingga berkas 700 byte tampil "0 KB" dan
    # terlihat seperti gagal. Pakai satu desimal + tandai berkas kosong.
    foreach ($f in @($FPre, $FPubClean, $FAuth, $FPubData, $FStorage, $FPost)) {
        if (-not (Test-Path $f)) { continue }
        $kb = (Get-Item $f).Length / 1KB
        if ((Get-Item $f).Length -eq 0) {
            Warn ("{0,9}  {1} (kosong, normal untuk pembungkus)" -f '0 KB', (Split-Path $f -Leaf))
        } else {
            Ok ("{0,9}  {1}" -f ("{0:N1} KB" -f $kb), (Split-Path $f -Leaf))
        }
    }
    Ok "Isi folder: $Dir"
    Warn "Folder $Dir berisi PII (hash password + API key). Jangan di-commit atau di-upload."
    Warn 'Lanjut: powershell -ExecutionPolicy Bypass -File .\backup-penuh.ps1 restore'
}

function Invoke-Restore {
    $psql = Find-PgTool 'psql'
    Assert-Env
    foreach ($f in @($FPubClean, $FAuth, $FPubData)) {
        if (-not (Test-Path $f) -or (Get-Item $f).Length -eq 0) {
            Die ("$f tidak ada atau kosong. Jalankan 'dump' dulu." +
                 " Kalau folder ini hasil dump versi lama, dump perlu diulang" +
                 " agar bagian data public terbentuk.")
        }
    }
    $dst = Encode-Url $DstUrl

    Say 'Menggabungkan berkas restore'
    # URUTAN INI YANG PENTING: skema public -> DATA auth -> DATA public.
    # Data public harus setelah auth.users, karena FK credit_transactions ->
    # auth.users diperiksa saat INSERT.
    $bagian = @($FPre, $FPubClean, $FAuth, $FPubData, $FStorage, $FPost) | Where-Object {
        $_ -and (Test-Path $_) -and (Get-Item $_).Length -gt 0
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
    $dst = Encode-Url $DstUrl

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
