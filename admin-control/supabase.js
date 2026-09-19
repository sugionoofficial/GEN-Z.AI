(function () {
    "use strict";

    /*
     * =========================================================
     * GEN-Z.AI
     * SHARED SUPABASE CLIENT
     * ---------------------------------------------------------
     * File:
     * admin-control/supabase.js
     *
     * Tanggung jawab:
     * - Memastikan Supabase SDK tersedia
     * - Memastikan GENZ_CONFIG tersedia
     * - Membuat satu Supabase client
     * - Mengekspos client sebagai window.GENZ_SUPABASE
     * - Menjaga kompatibilitas dengan kode lama
     *
     * Tidak:
     * - Melakukan query database
     * - Menginisialisasi Models
     * - Menginisialisasi UI
     * =========================================================
     */

    function log(...args) {
        console.log(
            "[GEN-Z.AI Supabase]",
            ...args
        );
    }

    function warn(...args) {
        console.warn(
            "[GEN-Z.AI Supabase]",
            ...args
        );
    }

    function fail(message) {
        console.error(
            "[GEN-Z.AI Supabase]",
            message
        );

        throw new Error(message);
    }

    /*
     * ---------------------------------------------------------
     * 1. Pastikan Supabase SDK tersedia
     * ---------------------------------------------------------
     */

    if (
        typeof window === "undefined"
    ) {
        return;
    }

    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {
        fail(
            "Supabase SDK belum tersedia. " +
            "Pastikan @supabase/supabase-js dimuat " +
            "sebelum admin-control/supabase.js."
        );

        return;
    }

    /*
     * ---------------------------------------------------------
     * 2. Pastikan konfigurasi tersedia
     * ---------------------------------------------------------
     */

    if (
        !window.GENZ_CONFIG
    ) {
        fail(
            "GENZ_CONFIG belum tersedia. " +
            "Pastikan ../assets/js/config.js dimuat " +
            "sebelum admin-control/supabase.js."
        );

        return;
    }

    const url =
        window.GENZ_CONFIG.SUPABASE_URL;

    const key =
        window.GENZ_CONFIG.SUPABASE_KEY;

    if (
        typeof url !== "string" ||
        !url.trim()
    ) {
        fail(
            "GENZ_CONFIG.SUPABASE_URL tidak tersedia."
        );

        return;
    }

    if (
        typeof key !== "string" ||
        !key.trim()
    ) {
        fail(
            "GENZ_CONFIG.SUPABASE_KEY tidak tersedia."
        );

        return;
    }

    /*
     * ---------------------------------------------------------
     * 3. Jangan membuat client kedua
     * ---------------------------------------------------------
     */

    if (
        window.GENZ_SUPABASE &&
        typeof window.GENZ_SUPABASE.from === "function"
    ) {
        log(
            "Supabase client sudah tersedia."
        );

        /*
         * Compatibility globals.
         */
        if (
            !window.supabaseClient
        ) {
            window.supabaseClient =
                window.GENZ_SUPABASE;
        }

        return;
    }

    /*
     * ---------------------------------------------------------
     * 4. Buat shared client
     * ---------------------------------------------------------
     */

    let client;

    try {
        client =
            window.supabase.createClient(
                url.trim(),
                key.trim()
            );
    } catch (error) {
        console.error(
            "[GEN-Z.AI Supabase] Gagal membuat client:",
            error
        );

        throw error;
    }

    /*
     * ---------------------------------------------------------
     * 5. Validasi client
     * ---------------------------------------------------------
     */

    if (
        !client ||
        typeof client.from !== "function"
    ) {
        fail(
            "Supabase client berhasil dibuat tetapi " +
            "tidak memiliki method .from()."
        );

        return;
    }

    /*
     * ---------------------------------------------------------
     * 6. Expose shared client
     * ---------------------------------------------------------
     */

    window.GENZ_SUPABASE =
        client;

    /*
     * Compatibility dengan modul lama.
     */
    window.supabaseClient =
        client;

    /*
     * Jangan mengganti window.supabase.
     *
     * window.supabase adalah SDK namespace.
     * Client sebenarnya berada di:
     *
     * window.GENZ_SUPABASE
     */

    log(
        "✓ Supabase client berhasil dibuat."
    );

    log(
        "✓ window.GENZ_SUPABASE tersedia."
    );

})();
