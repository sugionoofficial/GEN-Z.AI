(function () {
    "use strict";

    const BASE_PATH =
        "providers/";

    const MODULES = [
        "providers-data.js",
        "providers-form.js",
        "providers-ui.js",
        "providers-init.js"
    ];

    let loadingPromise = null;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing =
                document.querySelector(
                    `script[data-genz-provider-module="${src}"]`
                );

            if (existing) {
                if (
                    existing.dataset.loaded ===
                    "true"
                ) {
                    resolve();
                    return;
                }

                existing.addEventListener(
                    "load",
                    resolve,
                    {
                        once: true
                    }
                );

                existing.addEventListener(
                    "error",
                    () => {
                        reject(
                            new Error(
                                `Gagal memuat module: ${src}`
                            )
                        );
                    },
                    {
                        once: true
                    }
                );

                return;
            }

            const script =
                document.createElement(
                    "script"
                );

            script.src =
                BASE_PATH + src;

            script.async = false;

            script.dataset.genzProviderModule =
                src;

            script.addEventListener(
                "load",
                () => {
                    script.dataset.loaded =
                        "true";

                    resolve();
                },
                {
                    once: true
                }
            );

            script.addEventListener(
                "error",
                () => {
                    reject(
                        new Error(
                            `Gagal memuat module: ${src}`
                        )
                    );
                },
                {
                    once: true
                }
            );

            document.head.appendChild(
                script
            );
        });
    }

    async function loadModules() {
        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise =
            (async () => {
                for (
                    const moduleName
                    of MODULES
                ) {
                    await loadScript(
                        moduleName
                    );
                }

                return true;
            })();

        try {
            return await loadingPromise;
        } catch (error) {
            loadingPromise = null;

            console.error(
                "Provider modules gagal dimuat:",
                error
            );

            throw error;
        }
    }

    async function initialize() {
        await loadModules();

        const init =
            window.GENZProvidersInit;

        if (
            !init ||
            typeof init.initialize !==
                "function"
        ) {
            throw new Error(
                "GENZProvidersInit tidak tersedia."
            );
        }

        return init.initialize();
    }

    window.GENZProvidersLoader =
        Object.freeze({
            loadModules,
            initialize
        });

    /*
     * Jalankan otomatis ketika loader
     * dipanggil dari providers.html.
     */
    initialize().catch(error => {
        console.error(
            "Gagal menginisialisasi Provider Control:",
            error
        );
    });

})();
