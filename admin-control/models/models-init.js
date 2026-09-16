/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODULE INITIALIZER

   File:
   admin-control/models/models-init.js

   Fungsi:
   - Memastikan module tersedia
   - Mengatur urutan initialization
   - Menghubungkan Models Data
   - Models Search
   - Models Form
   - Models Price
   - Models UI

   Catatan:
   File ini tidak melakukan query API key.
========================================================= */

(function () {
    "use strict";

    let started = false;

    function waitForModules(
        timeout = 10000
    ) {
        return new Promise(
            (resolve, reject) => {
                const start =
                    Date.now();

                function check() {
                    const required =
                        [
                            "GENZModelsData",
                            "GENZModelsSearch",
                            "GENZModelsForm",
                            "GENZModelsPrice",
                            "GENZModelsUI"
                        ];

                    const missing =
                        required.filter(
                            name =>
                                !window[
                                    name
                                ]
                        );

                    if (
                        missing.length === 0
                    ) {
                        resolve();
                        return;
                    }

                    if (
                        Date.now() -
                            start >=
                        timeout
                    ) {
                        reject(
                            new Error(
                                "Module belum tersedia: " +
                                    missing.join(
                                        ", "
                                    )
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
            }
        );
    }

    async function initialize() {
        if (started) {
            return;
        }

        started = true;

        try {
            await waitForModules();

            /*
             * Data model harus tersedia
             * sebelum search dan UI bekerja.
             */
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

            /*
             * Pricing dimuat setelah
             * data model tersedia.
             */
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

            /*
             * Search module.
             */
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

            /*
             * Form module.
             */
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

            /*
             * UI terakhir.
             * UI akan menghubungkan
             * tombol, modal, statistik,
             * refresh, dan module lainnya.
             */
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

            console.info(
                "[GEN-Z.AI] Model Management modules initialized."
            );

            window.dispatchEvent(
                new CustomEvent(
                    "genz-models-ready"
                )
            );
        } catch (error) {
            console.error(
                "[GEN-Z.AI] Model Management initialization failed:",
                error
            );

            started = false;

            window.dispatchEvent(
                new CustomEvent(
                    "genz-models-error",
                    {
                        detail: error
                    }
                )
            );
        }
    }

    window.GENZModelsInit =
        Object.freeze({
            initialize
        });

    function start() {
        initialize();
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once: true
            }
        );
    } else {
        start();
    }
})();
