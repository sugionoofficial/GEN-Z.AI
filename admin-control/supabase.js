/* ============================================================
 * GEN-Z.AI
 * Admin Control - Supabase Client
 * ============================================================
 *
 * Digunakan oleh halaman:
 * - admin-control/user.html
 * - halaman Admin Control lainnya jika diperlukan
 *
 * Syarat:
 * - Supabase CDN harus dimuat terlebih dahulu
 * - assets/js/config.js harus dimuat terlebih dahulu
 * ============================================================ */

(function () {
    "use strict";

    if (!window.supabase) {
        console.error(
            "GEN-Z.AI: Supabase SDK belum dimuat."
        );
        return;
    }

    if (!window.GENZ_CONFIG) {
        console.error(
            "GEN-Z.AI: GENZ_CONFIG belum dimuat."
        );
        return;
    }

    const url = window.GENZ_CONFIG.SUPABASE_URL;
    const key = window.GENZ_CONFIG.SUPABASE_KEY;

    if (!url || !key) {
        console.error(
            "GEN-Z.AI: Konfigurasi Supabase tidak lengkap."
        );
        return;
    }

    if (window.GENZ_SUPABASE) {
        return;
    }

    window.GENZ_SUPABASE = window.supabase.createClient(
        url,
        key
    );

})();
