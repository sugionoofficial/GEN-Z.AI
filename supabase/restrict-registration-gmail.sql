-- =========================================================
-- ATURAN REGISTRASI: HANYA EMAIL @GMAIL.COM
-- ---------------------------------------------------------
-- Tujuan: mencegah pembuatan akun memakai email temporer
-- (tempmail) atau domain sekali pakai.
--
-- Dua lapisan:
--   1. UI   — register.html menolak sebelum memanggil signUp.
--   2. DB   — trigger ini menolak INSERT baru ke auth.users
--             yang emailnya bukan @gmail.com, apa pun klien
--             yang memanggilnya (pintasan UI pasti lolos di
--             sini).
--
-- Catatan:
-- - Trigger hanya berlaku saat INSERT (pendaftaran baru).
--   Akun lama dengan domain lain tetap bisa login normal.
-- - Mau menerima domain lain kelak? Tambahkan ke daftar di
--   fungsi block_non_gmail_signup di bawah.
-- Jalankan berulang kali aman (idempotent).
-- =========================================================

create or replace function public.block_non_gmail_signup()
returns trigger
language plpgsql
as $$
begin
    /* Daftar domain yang diizinkan (huruf kecil semua).
       Contoh menambah domain: not in ('gmail.com', 'yahoo.com') */
    if lower(split_part(coalesce(new.email, ''), '@', 2)) not in ('gmail.com') then
        /* Penanda "email_domain_not_allowed" dipakai register.html
           untuk menerjemahkan penolakan ini jadi pesan Indonesia. */
        raise exception 'Pendaftaran hanya boleh menggunakan email Gmail (email_domain_not_allowed)';
    end if;

    return new;
end;
$$;

drop trigger if exists block_non_gmail_signup_trg on auth.users;

create trigger block_non_gmail_signup_trg
    before insert on auth.users
    for each row
    execute function public.block_non_gmail_signup();
