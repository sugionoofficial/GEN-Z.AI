/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   PROVIDER MODULE

   File:
   admin-control/models/models-provider.js

   Tanggung jawab:
   - Mengambil provider melalui GENZModelsData
   - Mengisi <select id="providerId">
   - Menjaga provider_id sebagai value
   - Menampilkan provider_name + provider_id
   - Mendukung refresh
   - Tidak auto-initialize
   - Tidak menginisialisasi module lain

   Prinsip:
   Satu file = satu tanggung jawab.
========================================================= */

(function () {
    "use strict";

    let providers = [];
    let initialized = false;
    let initializing = null;

    /* =====================================================
       DOM
    ===================================================== */

    function getProviderSelect() {
        return document.getElementById("providerId");
    }

    /* =====================================================
       NOTIFY
    ===================================================== */

    function notify(message, type = "info") {

        /*
         * Gunakan GENZModelsUI jika tersedia.
         * Tidak wajib karena module Provider
         * harus tetap bisa berdiri sendiri.
         */

        if (
            window.GENZModelsUI &&
            typeof window.GENZModelsUI.notify ===
                "function"
        ) {
            window.GENZModelsUI.notify(
                message,
                type
            );

            return;
        }

        console[type === "error" ? "error" : "log"](
            "[GEN-Z Models Provider]",
            message
        );
    }

    /* =====================================================
       NORMALIZE
    ===================================================== */

    function normalizeProvider(provider) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {
            return null;
        }

        const providerId =
            String(
                provider.provider_id ||
                provider.provider ||
                ""
            ).trim();

        if (!providerId) {
            return null;
        }

        return {
            ...provider,
            provider_id: providerId
        };
    }

    function normalizeProviders(list) {

        if (!Array.isArray(list)) {
            return [];
        }

        return list
            .map(normalizeProvider)
            .filter(Boolean);
    }

    /* =====================================================
       ACTIVE CHECK
    ===================================================== */

    function isActive(provider) {

        return (
            String(
                provider?.status || ""
            )
                .trim()
                .toLowerCase() ===
            "active"
        );
    }

    /* =====================================================
       SORT
    ===================================================== */

    function sortProviders(list) {

        return [...list].sort(
            (a, b) => {

                const nameA =
                    String(
                        a.provider_name ||
                        a.provider_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const nameB =
                    String(
                        b.provider_name ||
                        b.provider_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return nameA.localeCompare(
                    nameB,
                    "id"
                );
            }
        );
    }

    /* =====================================================
       POPULATE SELECT
    ===================================================== */

    function populateSelect(
        list = providers,
        options = {}
    ) {

        const select =
            getProviderSelect();

        if (!select) {

            console.warn(
                "[GEN-Z Models Provider] #providerId tidak ditemukan."
            );

            return false;
        }

        const {
            activeOnly = true,
            preserveValue = true
        } = options;

        /*
         * Simpan value saat ini.
         *
         * Penting ketika:
         * - edit model
         * - refresh provider
         * - provider di-load ulang
         */

        const previousValue =
            preserveValue
                ? String(
                    select.value || ""
                )
                : "";

        let normalized =
            normalizeProviders(list);

        if (activeOnly) {
            normalized =
                normalized.filter(
                    isActive
                );
        }

        normalized =
            sortProviders(normalized);

        /*
         * Simpan data internal.
         */

        providers =
            normalized;

        /*
         * Kosongkan select.
         */

        select.innerHTML = "";

        /*
         * Placeholder.
         */

        const placeholder =
            document.createElement(
                "option"
            );

        placeholder.value = "";
        placeholder.textContent =
            "Pilih Provider";

        select.appendChild(
            placeholder
        );

        /*
         * Provider options.
         */

        normalized.forEach(
            provider => {

                const option =
                    document.createElement(
                        "option"
                    );

                const providerId =
                    String(
                        provider.provider_id ||
                        ""
                    ).trim();

                const providerName =
                    String(
                        provider.provider_name ||
                        providerId
                    ).trim();

                option.value =
                    providerId;

                /*
                 * Tampilan:
                 *
                 * ByteDance (bytedance)
                 *
                 * atau jika nama kosong:
                 *
                 * bytedance
                 */

                option.textContent =
                    providerName &&
                    providerName
                        .toLowerCase() !==
                    providerId
                        .toLowerCase()
                        ? `${providerName} (${providerId})`
                        : providerId;

                /*
                 * Simpan metadata.
                 */

                option.dataset.providerId =
                    providerId;

                option.dataset.providerName =
                    providerName;

                select.appendChild(
                    option
                );
            }
        );

        /*
         * Kembalikan value sebelumnya
         * jika provider masih tersedia.
         */

        if (
            previousValue &&
            normalized.some(
                provider =>
                    String(
                        provider.provider_id ||
                        ""
                    ).trim() ===
                    previousValue
            )
        ) {

            select.value =
                previousValue;

        } else if (
            !previousValue
        ) {

            select.value = "";

        } else {

            /*
             * Provider lama sudah tidak aktif /
             * tidak ditemukan.
             */

            select.value = "";
        }

        /*
         * Beri tahu module lain bahwa
         * provider sudah tersedia.
         */

        window.dispatchEvent(
            new CustomEvent(
                "genz-models-providers-loaded",
                {
                    detail: {
                        providers:
                            [...providers]
                    }
                }
            )
        );

        return true;
    }

    /* =====================================================
       LOAD PROVIDERS
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const {
            force = false,
            activeOnly = true,
            preserveValue = true
        } = options;

        /*
         * Pastikan data module tersedia.
         */

        if (
            !window.GENZModelsData ||
            typeof
                window.GENZModelsData
                    .loadProviders !==
                "function"
        ) {

            const error =
                new Error(
                    "GENZModelsData.loadProviders() tidak tersedia."
                );

            console.error(
                "[GEN-Z Models Provider]",
                error
            );

            notify(
                "Module data provider belum tersedia.",
                "error"
            );

            throw error;
        }

        try {

            const result =
                await window
                    .GENZModelsData
                    .loadProviders({
                        force,
                        activeOnly
                    });

            const normalized =
                normalizeProviders(
                    result
                );

            providers =
                normalized;

            populateSelect(
                normalized,
                {
                    activeOnly: false,
                    preserveValue
                }
            );

            /*
             * populateSelect dengan activeOnly=false
             * karena data dari GENZModelsData sudah
             * difilter berdasarkan parameter activeOnly.
             */

            console.info(
                "[GEN-Z Models Provider] Provider loaded:",
                providers.length
            );

            return [
                ...providers
            ];

        } catch (error) {

            console.error(
                "[GEN-Z Models Provider] Gagal memuat provider:",
                error
            );

            /*
             * Jangan menghancurkan dropdown secara
             * diam-diam ketika request gagal.
             *
             * Jika provider sebelumnya masih tersedia,
             * pertahankan.
             */

            if (
                providers.length === 0
            ) {

                populateSelect(
                    [],
                    {
                        activeOnly: false,
                        preserveValue
                    }
                );
            }

            notify(
                "Gagal memuat daftar provider.",
                "error"
            );

            throw error;
        }
    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize(
        options = {}
    ) {

        if (initialized) {
            return [
                ...providers
            ];
        }

        if (initializing) {
            return initializing;
        }

        initializing =
            (async () => {

                try {

                    /*
                     * Pastikan element HTML sudah ada.
                     */

                    const select =
                        getProviderSelect();

                    if (!select) {

                        throw new Error(
                            "Element #providerId tidak ditemukan."
                        );
                    }

                    await loadProviders(
                        options
                    );

                    initialized =
                        true;

                    console.info(
                        "[GEN-Z Models Provider] Initialized successfully."
                    );

                    return [
                        ...providers
                    ];

                } catch (error) {

                    console.error(
                        "[GEN-Z Models Provider] Initialization gagal:",
                        error
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
       REFRESH
    ===================================================== */

    async function refresh(
        options = {}
    ) {

        return loadProviders({
            force: true,
            activeOnly:
                options.activeOnly !== false,
            preserveValue:
                options.preserveValue !== false
        });
    }

    /* =====================================================
       GET PROVIDERS
    ===================================================== */

    function getProviders() {

        return [
            ...providers
        ];
    }

    /* =====================================================
       GET PROVIDER
    ===================================================== */

    function getProviderById(
        providerId
    ) {

        const id =
            String(
                providerId || ""
            )
                .trim()
                .toLowerCase();

        if (!id) {
            return null;
        }

        return (
            providers.find(
                provider =>
                    String(
                        provider.provider_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    id
            ) ||
            null
        );
    }

    /* =====================================================
       SET VALUE
    ===================================================== */

    function setValue(
        providerId
    ) {

        const select =
            getProviderSelect();

        if (!select) {
            return false;
        }

        const id =
            String(
                providerId || ""
            ).trim();

        if (!id) {
            select.value = "";
            return true;
        }

        const exists =
            providers.some(
                provider =>
                    String(
                        provider.provider_id ||
                        ""
                    ).trim() === id
            );

        if (!exists) {

            console.warn(
                "[GEN-Z Models Provider] Provider tidak ditemukan:",
                id
            );

            return false;
        }

        select.value = id;

        /*
         * Trigger change agar module Form/Search
         * yang memang mendengarkan provider dapat
         * melakukan sinkronisasi.
         */

        select.dispatchEvent(
            new Event(
                "change",
                {
                    bubbles: true
                }
            )
        );

        return true;
    }

    /* =====================================================
       CLEAR
    ===================================================== */

    function clear() {

        const select =
            getProviderSelect();

        if (select) {
            select.value = "";
        }
    }

    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        initialized =
            false;

        initializing =
            null;

        /*
         * Jangan hapus isi dropdown.
         *
         * Module Provider tidak memiliki
         * event listener permanen.
         */

        console.info(
            "[GEN-Z Models Provider] Destroyed."
        );
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsProvider =
        Object.freeze({

            initialize,
            loadProviders,
            refresh,

            populateSelect,

            getProviders,
            getProviderById,

            setValue,
            clear,

            destroy,

            isInitialized:
                () => initialized
        });

    /*
     * PENTING:
     *
     * Tidak ada:
     *
     * DOMContentLoaded
     * setTimeout
     * auto initialize
     *
     * models.html / models-init yang menentukan
     * kapan module ini dijalankan.
     */

})();
