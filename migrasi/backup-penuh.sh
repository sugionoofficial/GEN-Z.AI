#!/usr/bin/env bash
# =====================================================================
# backup-penuh.sh — backup + restore GEN-Z.AI dari project SUMBER
# =====================================================================
# Sumber : ycovbqmezhrvzobxqnyp (ap-southeast-1) — kuota egress habis (402),
#          tetapi koneksi DB (port 5432) TIDAK terkena 402.
# Target : rvgioyenjgkprnssfpfr (ap-southeast-1)
#
# Yang dipindahkan skrip ini (LENGKAP, bukan hanya public):
#   1. skema + data public  : 60 tabel / 4449 baris, RLS, 53 policy,
#                             69 fungsi, 9 trigger, 5 sequence
#   2. DATA auth.users + auth.identities : 25 user (hash password ikut)
#   3. metadata storage.buckets + storage.objects : 8 bucket / 112 objek
#      (file fisiknya dipindah terpisah oleh migrate_bulk.mjs — Fase B)
#
# Kenapa tidak `--schema=public` saja: percobaan sebelumnya hanya men-dump
# public, sehingga SELURUH akun pengguna hilang setelah restore. Skrip ini
# menjadikan auth + storage sebagai bagian wajib.
#
# Pakai:
#   export SRC='postgresql://postgres.ycovbqmezhrvzobxqnyp:PASS@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
#   export DST='postgresql://postgres.rvgioyenjgkprnssfpfr:PASS@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
#   ./backup-penuh.sh dump      # hanya backup ke folder ./genz-backup
#   ./backup-penuh.sh restore   # restore ke target (1 sesi, 1 transaksi)
#   ./backup-penuh.sh verify    # bandingkan jumlah baris
#
# Port WAJIB 5432 (session pooler). Port 6543 (transaction pooler) akan
# membuat pg_dump gagal di tengah karena koneksi diputus.
# =====================================================================
set -Eeuo pipefail

DIR="${DIR:-./genz-backup}"
F_PRE="$DIR/0_pre.sql"
F_PUBLIC="$DIR/1_public.sql"
F_PUBLIC_CLEAN="$DIR/1_public_clean.sql"
F_AUTH="$DIR/2_auth.sql"
F_STORAGE="$DIR/3_storage_meta.sql"
F_AUTH_REF="$DIR/4_auth_skema_referensi.sql"
F_TRIGGER_REF="$DIR/5_trigger_auth.sql"
F_POST="$DIR/9_post.sql"
F_LOG="$DIR/backup.log"

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m    %s\n' "$*"; }
die()  { printf '\n\033[31mGAGAL:\033[0m %s\n' "$*" >&2; exit 1; }

need_bin() {
    command -v "$1" >/dev/null 2>&1 || die "$1 tidak ditemukan. Install PostgreSQL client (lihat BACKUP-PENUH.md bagian 0)."
}

need_env() {
    [ -n "${SRC:-}" ] || die "variabel SRC belum diisi (URL koneksi project sumber)"
    [ -n "${DST:-}" ] || die "variabel DST belum diisi (URL koneksi project target)"
    case "$SRC" in *:6543*) die "SRC memakai port 6543 (transaction pooler). Pakai 5432." ;; esac
    case "$DST" in *:6543*) die "DST memakai port 6543 (transaction pooler). Pakai 5432." ;; esac
}

# ---------------------------------------------------------------- dump
do_dump() {
    need_bin pg_dump; need_bin psql
    mkdir -p "$DIR"
    : > "$F_LOG"
    say "Versi client"; pg_dump --version | tee -a "$F_LOG"

    say "1/5 skema + data public (60 tabel)"
    pg_dump "$SRC" --no-owner --no-privileges --schema=public -f "$F_PUBLIC" 2>&1 | tee -a "$F_LOG"
    # `pg_dump` selalu menulis CREATE SCHEMA public; dan ALTER ... OWNER TO.
    # Di project target skema public SUDAH ada, sehingga dua baris itu pasti
    # error saat restore. Dibuang di sini, bukan diabaikan saat restore,
    # supaya restore tetap bisa memakai ON_ERROR_STOP=1.
    grep -v -E '^(CREATE SCHEMA public;|ALTER SCHEMA public OWNER TO )' "$F_PUBLIC" > "$F_PUBLIC_CLEAN"
    ok "$(wc -l < "$F_PUBLIC_CLEAN") baris"

    say "2/5 DATA auth.users + auth.identities (WAJIB — tanpa ini akun hilang)"
    pg_dump "$SRC" --data-only --no-owner --table=auth.users --table=auth.identities \
        -f "$F_AUTH" 2>&1 | tee -a "$F_LOG"
    ok "$(wc -l < "$F_AUTH") baris (harus memuat 26 baris COPY: 25 user + header)"

    say "3/5 metadata storage.buckets + storage.objects (file menyusul di Fase B)"
    pg_dump "$SRC" --data-only --no-owner --table=storage.buckets --table=storage.objects \
        -f "$F_STORAGE" 2>&1 | tee -a "$F_LOG"
    ok "$(wc -l < "$F_STORAGE") baris"

    say "4/5 referensi skema auth + trigger auth (tidak di-restore, untuk pembanding)"
    pg_dump "$SRC" --schema-only --no-owner --no-privileges --schema=auth \
        -f "$F_AUTH_REF" 2>&1 | tee -a "$F_LOG" || warn "skema auth tidak bisa di-dump (tidak fatal)"
    psql "$SRC" -Atc "select pg_get_triggerdef(t.oid) || ';'
                      from pg_trigger t join pg_class c on c.oid = t.tgrelid
                      join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'auth' and not t.tgisinternal" \
        -o "$F_TRIGGER_REF" 2>>"$F_LOG" || warn "trigger auth tidak terbaca (tidak fatal)"

    # TANPA begin/commit: `psql --single-transaction` sudah membungkus seluruh
    # restore. `begin;` di dalamnya hanya menghasilkan WARNING, tetapi
    # `commit;` akan MENUTUP transaksi lebih awal — sehingga kegagalan pada
    # berkas berikutnya tidak lagi membatalkan apa pun dan janji "gagal =
    # target kembali kosong" jadi bohong.
    cat > "$F_PRE" <<'SQL'
-- dijalankan SEBELUM restore: matikan trigger & cek FK agar urutan INSERT
-- bebas. Ini yang membuat data auth + tabel ber-FK bisa masuk tanpa gagal.
set session_replication_role = replica;
SQL

    cat > "$F_POST" <<'SQL'
-- dijalankan SESUDAH restore: kembalikan trigger, sinkronkan sequence.
set session_replication_role = origin;
select setval(pg_get_serial_sequence('public.credit_change_audit', 'id'),
              coalesce((select max(id) from public.credit_change_audit), 1), true)
  where to_regclass('public.credit_change_audit') is not null;
SQL

    say "5/5 ringkasan berkas"
    for f in "$F_PRE" "$F_PUBLIC_CLEAN" "$F_AUTH" "$F_STORAGE" "$F_POST"; do
        [ -s "$f" ] && ok "$(du -h "$f" | cut -f1)  $f" || warn "$f kosong — periksa $F_LOG"
    done
    say "SELESAI. Salin folder $DIR ke tempat aman (berisi hash password & kredensial)."
    warn "JANGAN commit folder $DIR — berisi PII."
}

# ------------------------------------------------------------- restore
do_restore() {
    need_bin psql
    [ -s "$F_PUBLIC_CLEAN" ] || die "$F_PUBLIC_CLEAN tidak ada. Jalankan './backup-penuh.sh dump' dulu."
    [ -s "$F_AUTH" ]         || die "$F_AUTH tidak ada. Jalankan 'dump' dulu (bagian auth wajib)."

    # SEMUA berkas dijalankan dalam SATU sesi psql dan SATU transaksi.
    # Alasannya bukan kerapian: `set session_replication_role = replica` hanya
    # berlaku untuk sesi berjalan. Kalau setiap berkas dijalankan sebagai sesi
    # terpisah, setting itu hilang sebelum data dimuat, trigger dan cek foreign
    # key menyala lagi, lalu `2_auth.sql` ditolak oleh FK
    # `public.profiles -> auth.users` — restore berhenti dengan pesan yang
    # menyesatkan (terlihat seolah datanya rusak).
    # Satu transaksi juga membuat restore bersifat semua-atau-tidak-sama-sekali:
    # gagal di tengah = target kembali kosong, aman untuk diulang.
    local args=(-v ON_ERROR_STOP=1 --single-transaction -q)
    for f in "$F_PRE" "$F_PUBLIC_CLEAN" "$F_AUTH" "$F_STORAGE" "$F_POST"; do
        [ -s "$f" ] || { warn "lewati $f (kosong)"; continue; }
        args+=(-f "$f")
    done

    say "Restore ke TARGET (satu sesi, satu transaksi, berhenti di error pertama)"
    for f in "$F_PRE" "$F_PUBLIC_CLEAN" "$F_AUTH" "$F_STORAGE" "$F_POST"; do
        [ -s "$f" ] && printf '     %s\n' "$f"
    done

    if psql "$DST" "${args[@]}" >/dev/null 2>"$DIR/restore.err"; then
        ok "restore selesai — semua berkas masuk"
    else
        printf '  GAGAL\n' >&2
        sed -n '1,25p' "$DIR/restore.err" >&2
        die "restore dibatalkan. Karena memakai satu transaksi, TARGET kembali seperti sebelum restore (tidak ada data separuh). Perbaiki penyebabnya lalu jalankan ulang 'restore'."
    fi
    do_verify
}

# -------------------------------------------------------------- verify
do_verify() {
    need_bin psql
    say "Verifikasi angka kunci (target vs sumber)"
    psql "$DST" -Atc "
      select 'auth.users            = ' || (select count(*) from auth.users)
      union all select 'auth.identities       = ' || (select count(*) from auth.identities)
      union all select 'public.profiles       = ' || coalesce((select count(*)::text from public.profiles), '(tabel belum ada)')
      union all select 'public.models         = ' || coalesce((select count(*)::text from public.models), '(tabel belum ada)')
      union all select 'public.generation_history = ' || coalesce((select count(*)::text from public.generation_history), '(tabel belum ada)')
      union all select 'public.social_post_runs   = ' || coalesce((select count(*)::text from public.social_post_runs), '(tabel belum ada)')
      union all select 'storage.objects       = ' || (select count(*) from storage.objects)" \
      || die "tidak bisa membaca target"
    cat <<'EXP'

  Harus sama dengan sumber:
    auth.users 25 | auth.identities 25 | profiles 25 | models 45
    generation_history 502 | social_post_runs 941 | storage.objects 112

  Verifikasi lengkap 60 tabel + struktur (otomatis PASS/GAGAL):
    buka migrasi/verify-restore.sql di SQL Editor project TARGET\n    (60 tabel + struktur, otomatis PASS/GAGAL).
EXP
}

case "${1:-}" in
    dump)    need_env; do_dump ;;
    restore) need_env; do_restore ;;
    verify)  need_env; do_verify ;;
    *)       awk 'NR>1 && /^#/ {sub(/^# ?/,""); print; next} NR>1 {exit}' "$0"; exit 1 ;;
esac
