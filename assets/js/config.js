/*
 * ============================================================
 * GEN-Z.AI
 * Supabase Configuration
 * ============================================================
 *
 * File ini menjadi sumber konfigurasi utama untuk:
 * - login
 * - register
 * - dashboard
 * - generator
 * - authentication
 *
 * Jangan mengubah nama variabel GENZ_CONFIG karena file
 * authentication membacanya.
 * ============================================================
 */

const GENZ_CONFIG = Object.freeze({

    SUPABASE_URL:
        "https://boeamhglmvkatnycluaa.supabase.co",

    SUPABASE_KEY:
        "sb_publishable_blGIFRNPbB2qAa1vXQBXcw_txqDQldb"

});


/*
 * ============================================================
 * COMPATIBILITY
 * ============================================================
 *
 * Membuat konfigurasi juga tersedia melalui window.
 * Ini mencegah masalah ketika auth.js dijalankan sebagai
 * script biasa di browser.
 * ============================================================
 */

window.GENZ_CONFIG = GENZ_CONFIG;


/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

if (
    !GENZ_CONFIG.SUPABASE_URL ||
    !GENZ_CONFIG.SUPABASE_KEY
) {

    console.error(
        "GEN-Z.AI: Konfigurasi Supabase tidak lengkap."
    );

} else {

    console.log(
        "GEN-Z.AI: Konfigurasi berhasil dimuat."
    );

}
