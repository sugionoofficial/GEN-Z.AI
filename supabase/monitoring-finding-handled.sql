-- Migrasi: temuan yang sudah ditandai ("diketahui"/"selesai") tidak boleh
-- langsung dibuka ulang oleh pemeriksaan berikutnya.
--
-- Latar belakang: buildFindings menghitung temuan dari riwayat 24 jam, jadi
-- selama kejadian lamanya masih ada di monitoring_events, setiap pemeriksaan
-- menghasilkan temuan yang sama. upsertFindings dulu menaikkan
-- occurrence_count dan (untuk status resolved) membuka kembali temuan itu,
-- sehingga tombol "Tandai diketahui" seolah tidak berefek.
--
-- Kolom `handled_at` menyimpan kapan status terakhir diubah oleh admin:
--   * acknowledged -> senyap 24 jam sejak handled_at
--   * resolved     -> senyap sampai ada kejadian baru setelah handled_at
--
-- Aman dijalankan ulang (idempotent).

alter table public.monitoring_findings
    add column if not exists handled_at timestamp with time zone;

comment on column public.monitoring_findings.handled_at is
    'Waktu admin menandai temuan (acknowledged/resolved). Dipakai agar temuan tidak dibuka ulang tanpa bukti baru.';

create index if not exists monitoring_findings_handled_idx
    on public.monitoring_findings (status, handled_at desc);
