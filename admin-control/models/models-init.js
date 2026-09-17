/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODULE INITIALIZER

   File:
   admin-control/models/models-init.js

   Fungsi:
   - Menunggu seluruh module tersedia
   - Menjalankan initialization satu kali
   - Menyerahkan seluruh proses UI kepada models-ui.js
   - Tidak melakukan auto-start sendiri
   - Tidak melakukan loading Supabase berulang
========================================================= */

(function () {
    "use strict";

    let initialized = false;
    let initializing = null;

    /* =====================================================
       WAIT FOR MODULES
    ===================================================== */

    function waitForModules(timeout = 10000) {
        return new Promise((resolve, reject) => {

            const startedAt =
                Date.now();

            function check() {

                const required = [
                    "GENZModelsData",
                    "GENZModelsSearch",
                    "GENZModelsForm",
                    "GENZModelsPrice",
                    "GENZModelsUI"
                ];

                const missing =
                    required.filter(
                        name =>
                            !window[name]
                    );

                if (
                    missing.length === 0
                ) {
                    resolve();
                    return;
                }

                if (
                    Date.now() -
                    startedAt >=
                    timeout
                ) {
                    reject(
                        new Error(
                            "Module belum tersedia: " +
                            missing.join(", ")
                        )
                    );

                    return;
                }

                window.setTimeout(
                    check,
                    50
                );
            }

            check();
        });
    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize() {

        if (initialized) {
            return true;
        }

        if (initializing) {
            return initializing;
        }

        initializing =
            (async () => {

                try {

                    /*
                     * Pastikan seluruh module sudah
                     * tersedia sebelum UI dijalankan.
                     */

                    await waitForModules();

                    /*
                     * models-ui.js adalah pusat
                     * initialization Model Management.
                     *
                     * Jangan menjalankan:
                     * - loadKieModels()
                     * - Price.initialize()
                     * - Search.initialize()
                     * - Form.initialize()
                     *
                     * secara terpisah di sini.
                     *
                     * models-ui.js sudah mengatur
                     * semuanya secara berurutan.
                     */

                    if (
                        !window.GENZModelsUI ||
                        typeof
                            window
                                .GENZModelsUI
                                .initialize !==
                            "function"
                    ) {
                        throw new Error(
                            "GENZModelsUI.initialize tidak tersedia."
                        );
                    }

                    await window
                        .GENZModelsUI
                        .initialize();

                    initialized =
                        true;

                    console.info(
                        "[GEN-Z.AI] Model Management initialization selesai."
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-models-ready"
                        )
                    );

                    return true;

                } catch (error) {

                    console.error(
                        "[GEN-Z.AI] Model Management initialization gagal:",
                        error
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-models-error",
                            {
                                detail:
                                    error
                            }
                        )
                    );

                    throw error;

                } finally {

                    initializing =
                        null;
                }

            })();

        return initializing;
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function isInitialized() {
        return initialized;
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsInit =
        Object.freeze({
            initialize,
            isInitialized,
            waitForModules
        });

    /*
     * PENTING:
     *
     * Tidak ada DOMContentLoaded di sini.
     *
     * models-loader.js adalah satu-satunya
     * file yang menjalankan initialization.
     */

})();
