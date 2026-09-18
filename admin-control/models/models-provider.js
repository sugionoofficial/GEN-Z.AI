/* =========================================================
   GEN-Z.AI - MODELS PROVIDER MODULE
   File:
   admin-control/models/models-provider.js

   Tugas:
   - Memuat daftar provider untuk halaman Models
   - Mengisi dropdown #providerId
   - Menyediakan provider ke module lain
   - Tidak mengambil alih fungsi Models UI
   - Tidak melakukan auto-initialize
   - Tidak memasang event listener global
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       STATE
    ===================================================== */

    let providers = [];
    let initialized = false;


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getProviderSelect() {
        return document.getElementById("providerId");
    }


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notify(type, message) {
        try {
            if (
                window.GENZModelsUI &&
                typeof window.GENZModelsUI.showAlert === "function"
            ) {
                window.GENZModelsUI.showAlert(
                    type,
                    message
                );

                return;
            }

            const alertBox =
                document.getElementById("alertBox");

            if (!alertBox) {
                return;
            }

            alertBox.textContent =
                message || "";

            alertBox.className =
                "alert " +
                (
                    type === "error"
                        ? "alert-error"
                        : "alert-success"
                ) +
                " show";

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Provider notify error:",
                error
            );
        }
    }


    /* =====================================================
       NORMALIZE PROVIDER
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
                provider.provider_id ??
                provider.provider ??
                provider.id ??
                ""
            ).trim();

        if (!providerId) {
            return null;
        }

        const providerName =
            String(
                provider.provider_name ??
                provider.name ??
                providerId
            ).trim();

        return {
            ...provider,

            provider_id:
                providerId,

            provider_name:
                providerName
        };
    }


    /* =====================================================
       NORMALIZE PROVIDERS
    ===================================================== */

    function normalizeProviders(list) {

        if (!Array.isArray(list)) {
            return [];
        }

        const result = [];
        const seen = new Set();

        list.forEach(function (item) {

            const provider =
                normalizeProvider(item);

            if (!provider) {
                return;
            }

            const key =
                provider.provider_id
                    .trim()
                    .toLowerCase();

            if (seen.has(key)) {
                return;
            }

            seen.add(key);

            result.push(provider);
        });

        return result;
    }


    /* =====================================================
       ACTIVE STATUS
    ===================================================== */

    function isActive(provider) {

        const status =
            String(
                provider?.status ??
                "active"
            )
                .trim()
                .toLowerCase();

        return status === "active";
    }


    /* =====================================================
       SORT PROVIDERS
    ===================================================== */

    function sortProviders(list) {

        return [...list].sort(
            function (a, b) {

                /*
                 * Default provider selalu di atas.
                 */

                const aDefault =
                    a.is_default === true
                        ? 0
                        : 1;

                const bDefault =
                    b.is_default === true
                        ? 0
                        : 1;

                if (
                    aDefault !== bDefault
                ) {
                    return (
                        aDefault -
                        bDefault
                    );
                }

                const aName =
                    String(
                        a.provider_name ||
                        a.provider_id ||
                        ""
                    );

                const bName =
                    String(
                        b.provider_name ||
                        b.provider_id ||
                        ""
                    );

                return aName.localeCompare(
                    bName,
                    "id",
                    {
                        sensitivity:
                            "base"
                    }
                );
            }
        );
    }


    /* =====================================================
       POPULATE PROVIDER SELECT
       #providerId
    ===================================================== */

    function populateSelect(
        list,
        options = {}
    ) {

        const select =
            getProviderSelect();

        if (!select) {
            console.warn(
                "[GEN-Z.AI] #providerId tidak ditemukan."
            );

            return false;
        }

        const activeOnly =
            options.activeOnly !== false;

        /*
         * Simpan value yang sedang dipilih.
         * Ini penting supaya refresh tidak mereset
         * provider yang sedang dipakai.
         */

        const currentValue =
            String(
                options.value ??
                select.value ??
                ""
            ).trim();

        let source =
            normalizeProviders(list);

        if (activeOnly) {

            source =
                source.filter(
                    isActive
                );
        }

        source =
            sortProviders(source);

        const fragment =
            document.createDocumentFragment();


        /* -------------------------------------------------
           PLACEHOLDER
        ------------------------------------------------- */

        const placeholder =
            document.createElement(
                "option"
            );

        placeholder.value = "";

        placeholder.textContent =
            "Pilih Provider";

        fragment.appendChild(
            placeholder
        );


        /* -------------------------------------------------
           PROVIDER OPTIONS
        ------------------------------------------------- */

        source.forEach(
            function (provider) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    provider.provider_id;

                const name =
                    provider.provider_name ||
                    provider.provider_id;

                /*
                 * Tampilan:
                 *
                 * ByteDance (bytedance)
                 * KIE AI (kie)
                 *
                 * Tetapi value tetap:
                 *
                 * bytedance
                 * kie
                 */

                option.textContent =
                    name ===
                    provider.provider_id
                        ? provider.provider_id
                        : name +
                          " (" +
                          provider.provider_id +
                          ")";

                fragment.appendChild(
                    option
                );
            }
        );


        /* -------------------------------------------------
           REPLACE OPTIONS
        ------------------------------------------------- */

        select.replaceChildren(
            fragment
        );


        /* -------------------------------------------------
           RESTORE VALUE
        ------------------------------------------------- */

        if (currentValue) {

            const exists =
                Array.from(
                    select.options
                ).some(
                    function (option) {

                        return (
                            option.value ===
                            currentValue
                        );
                    }
                );

            if (exists) {

                select.value =
                    currentValue;
            }
        }

        return true;
    }


    /* =====================================================
       LOAD PROVIDERS
       Menggunakan GENZModelsData
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const data =
            window.GENZModelsData;

        if (
            !data ||
            typeof data.loadProviders !==
                "function"
        ) {

            throw new Error(
                "GENZModelsData belum tersedia."
            );
        }

        const force =
            options.force === true;

        const activeOnly =
            options.activeOnly !== false;


        /* -------------------------------------------------
           LOAD FROM DATA MODULE
        ------------------------------------------------- */

        const loaded =
            await data.loadProviders({
                force,
                activeOnly
            });


        /* -------------------------------------------------
           NORMALIZE
        ------------------------------------------------- */

        providers =
            normalizeProviders(
                loaded
            );


        /* -------------------------------------------------
           POPULATE SELECT
        ------------------------------------------------- */

        populateSelect(
            providers,
            {
                /*
                 * Data module sudah melakukan
                 * filtering activeOnly.
                 *
                 * Karena itu jangan filter kedua kali
                 * di sini.
                 */

                activeOnly: false,

                value:
                    options.value
            }
        );


        /* -------------------------------------------------
           EVENT
        ------------------------------------------------- */

        document.dispatchEvent(
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

        return [
            ...providers
        ];
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize(
        options = {}
    ) {

        /*
         * Jangan load ulang jika sudah initialized,
         * kecuali force=true.
         */

        if (
            initialized &&
            options.force !== true
        ) {

            if (
                options.value !==
                undefined
            ) {

                populateSelect(
                    providers,
                    {
                        activeOnly:
                            options.activeOnly !==
                            false,

                        value:
                            options.value
                    }
                );
            }

            return [
                ...providers
            ];
        }


        const loaded =
            await loadProviders(
                options
            );

        initialized =
            true;

        return loaded;
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    async function refresh(
        options = {}
    ) {

        return initialize({
            ...options,

            force: true
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
       GET PROVIDER BY ID
    ===================================================== */

    function getProviderById(
        providerId
    ) {

        const id =
            String(
                providerId ??
                ""
            )
                .trim()
                .toLowerCase();

        if (!id) {
            return null;
        }

        return (
            providers.find(
                function (provider) {

                    return (
                        String(
                            provider.provider_id
                        )
                            .trim()
                            .toLowerCase() ===
                        id
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       SET SELECT VALUE
    ===================================================== */

    function setValue(
        providerId
    ) {

        const select =
            getProviderSelect();

        if (!select) {
            return false;
        }

        const value =
            String(
                providerId ??
                ""
            ).trim();

        if (!value) {

            select.value =
                "";

            return true;
        }

        const exists =
            Array.from(
                select.options
            ).some(
                function (option) {

                    return (
                        option.value ===
                        value
                    );
                }
            );

        if (!exists) {
            return false;
        }

        select.value =
            value;

        return true;
    }


    /* =====================================================
       CLEAR SELECT
    ===================================================== */

    function clear() {

        const select =
            getProviderSelect();

        if (select) {

            select.value =
                "";
        }
    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        providers =
            [];

        initialized =
            false;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsProvider =
        Object.freeze({

            initialize,

            refresh,

            loadProviders,

            populateSelect,

            getProviders,

            getProviderById,

            setValue,

            clear,

            destroy
        });


    console.log(
        "[GEN-Z.AI] GENZModelsProvider loaded."
    );

})();
