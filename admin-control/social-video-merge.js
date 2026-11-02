/* =========================================================
   GEN-Z.AI — STUDIO MEDSOS: PENGGABUNGAN RIWAYAT
   ---------------------------------------------------------
   Helper murni (tanpa DOM) untuk menyatukan riwayat
   Facebook (social_run) dan status posting YouTube/TikTok
   (social_video_posts) menjadi SATU daftar yang berurutan
   berdasarkan waktu — ikut bergulir bersama, tidak di-pin.

   Dipakai admin-control/social-publisher.js (renderRuns).
========================================================= */

export function runTimeMs(run = {}) {
    const raw = run.scheduled_for || run.created_at || "";
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function socialPostTimeMs(post = {}) {
    /* Yang sudah tayang pakai jam tayang asli; yang belum pakai
       jadwalnya; fallback terakhir jam dibuat. */
    const raw = post.published_at || post.scheduled_for || post.created_at || "";
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

/*
 * Pilih posting YouTube/TikTok yang tepat tampil pada halaman
 * riwayat `page` (dari `totalPages`), lalu gabungkan dengan run
 * Facebook halaman itu dan urutkan menurun berdasarkan waktu.
 *
 * Aturan jendela halaman (waktu menurun):
 *   - halaman 1     : semua post yang lebih baru dari run terlama
 *                     halaman ini (termasuk lebih baru dari run
 *                     terbaru) ikut di sini.
 *   - halaman tengah: hanya post yang waktunya jatuh di antara
 *                     run terbaru & terlama halaman ini.
 *   - halaman akhir : semua post yang lebih lama dari run terbaru
 *                     halaman ini (jadi tidak ada yang hilang).
 *   - tanpa run FB  : semua post tampil di halaman 1.
 */
export function mergeRunsAndPosts(runs = [], posts = [], page = 1, totalPages = 1) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeTotalPages = Math.max(safePage, Math.floor(Number(totalPages) || 1));

    const rows = runs.map(run => ({ type: "run", run, time: runTimeMs(run) }));

    const runTimes = rows.map(row => row.time).filter(time => time > 0);
    const newest = runTimes.length ? Math.max(...runTimes) : 0;
    const oldest = runTimes.length ? Math.min(...runTimes) : 0;
    const hasRuns = runTimes.length > 0;

    const postRows = (Array.isArray(posts) ? posts : [])
        .map(post => ({ type: "social", post, time: socialPostTimeMs(post) }))
        .filter(row => {
            if (!hasRuns) return safePage === 1;
            if (safePage === 1 && safeTotalPages === 1) return true;
            if (safePage === 1) return row.time >= oldest;
            if (safePage === safeTotalPages) return row.time <= newest;
            return row.time >= oldest && row.time <= newest;
        });

    return [...rows, ...postRows].sort((a, b) => b.time - a.time);
}
