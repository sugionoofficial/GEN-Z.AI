/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODULE INITIALIZER

   File:
   admin-control/models/models-init.js

   Fungsi:
   - Menunggu seluruh module tersedia
   - Menjalankan initialization satu kali
   - Tidak melakukan auto-start sendiri
   - Initialization dikendalikan oleh models-loader.js
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

            const startedAt = Date.now();

            function check() {

                const required = [
                    "GENZModelsData",
                    "GENZModelsSearch",
                    "GENZModelsForm",
                    "GENZModelsPrice",
                    "GENZModelsUI"
                ];

                const missing = required.filter(
                    name => !window[name]
                );

                if (missing.length === 0) {
                    resolve();
                    return;
                }

                if (
                    Date.now() - startedAt >=
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

        initializing = (async () => {

            try {

                /*
                 * Pastikan semua module sudah tersedia.
                 */
                await waitForModules();

                /* =========================================
                   1. LOAD MODEL DATA
                ========================================= */

                if (
                    window.GENZModelsData &&
                    typeof window
                        .GENZModelsData
                        .loadKieModels ===
                        "function"
                ) {

                    await window
                        .GENZModelsData
                        .loadKieModels({
                            force: false,
                            activeOnly: false
                        });
                }

                /* =========================================
                   2. INITIALIZE PRICING
                ========================================= */

                if (
                    window.GENZModelsPrice &&
                    typeof window
                        .GENZModelsPrice
                        .initialize ===
                        "function"
                ) {

                    await window
                        .GENZModelsPrice
                        .initialize();
                }

                /* =========================================
                   3. INITIALIZE SEARCH
                ========================================= */

                if (
                    window.GENZModelsSearch &&
                    typeof window
                        .GENZModelsSearch
                        .initialize ===
                        "function"
                ) {

                    await window
                        .GENZModelsSearch
                        .initialize();
                }

                /* =========================================
                   4. INITIALIZE FORM
                ========================================= */

                if (
                    window.GENZModelsForm &&
                    typeof window
                        .GENZModelsForm
                        .initialize ===
                        "function"
                ) {

                    await window
                        .GENZModelsForm
                        .initialize();
                }

                /* =========================================
                   5. INITIALIZE UI
                ========================================= */

                if (
                    window.GENZModelsUI &&
                    typeof window
                        .GENZModelsUI
                        .initialize ===
                        "function"
                ) {

                    await window
                        .GENZModelsUI
                        .initialize();
                }

                initialized = true;

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
                            detail: error
                        }
                    )
                );

                throw error;

            } finally {

                initializing = null;
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
