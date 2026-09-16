/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODULE LOADER

   File:
   admin-control/models/models-loader.js

   Fungsi:
   - Memuat seluruh module Model Management
   - Menjaga urutan dependency
   - Tidak mengubah UI utama
   - Tidak mengakses API key
========================================================= */

(function () {
    "use strict";

    const BASE_PATH =
        "./models/";

    const MODULES = [
        "models-data.js",
        "models-search.js",
        "models-form.js",
        "models-price.js",
        "models-ui.js",
        "models-init.js"
    ];

    const loaded = new Set();

    function loadScript(
        filename
    ) {
        return new Promise(
            (resolve, reject) => {
                if (
                    loaded.has(
                        filename
                    )
                ) {
                    resolve();
                    return;
                }

                const existing =
                    document.querySelector(
                        `script[data-genz-model-module="${filename}"]`
                    );

                if (existing) {
                    loaded.add(
                        filename
                    );
                    resolve();
                    return;
                }

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    BASE_PATH +
                    filename;

                script.async =
                    false;

                script.defer =
                    false;

                script.dataset
                    .genzModelModule =
                    filename;

                script.onload =
                    () => {
                        loaded.add(
                            filename
                        );

                        resolve();
                    };

                script.onerror =
                    () => {
                        reject(
                            new Error(
                                "Gagal memuat module: " +
                                    filename
                            )
                        );
                    };

                document.head.appendChild(
                    script
                );
            }
        );
    }

    async function loadModules() {
        for (
            const module
            of MODULES
        ) {
            await loadScript(
                module
            );
        }

        return true;
    }

    function start() {
        loadModules()
            .then(() => {
                console.info(
                    "[GEN-Z.AI] Semua Model Management modules berhasil dimuat."
                );
            })
            .catch(error => {
                console.error(
                    "[GEN-Z.AI] Model Management module loader error:",
                    error
                );
            });
    }

    window.GENZModelsLoader =
        Object.freeze({
            loadModules
        });

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
