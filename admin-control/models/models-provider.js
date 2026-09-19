/* =========================================================
   GEN-Z.AI - MODELS PROVIDER MODULE
   File:
   admin-control/models/models-provider.js

   OWNER:
   - Provider lifecycle
   - Provider state
   - Provider lookup
   - Provider select synchronization

   BUKAN OWNER:
   - Supabase / database      -> GENZModelsData
   - Search Model             -> GENZModelsSearch
   - Form CRUD                -> GENZModelForm*
   - UI orchestration         -> GENZModelsUI

   COMPATIBILITY:
   - provider.id              -> UUID database
   - provider.provider_id     -> kode provider
   - provider.provider        -> legacy provider code
   - provider.provider_name   -> nama provider
   ========================================================= */

(function () {
    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let providers = [];
    let initialized = false;
    let loadingPromise = null;


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

        const databaseId =
            String(
                provider.id ?? ""
            ).trim();

        const providerCode =
            String(
                provider.provider_id ??
                provider.provider ??
                ""
            ).trim();

        const normalizedProviderId =
            providerCode ||
            databaseId;

        if (!normalizedProviderId) {
            return null;
        }

        const providerName =
            String(
                provider.provider_name ??
                provider.name ??
                normalizedProviderId
            ).trim();

        return {
            ...provider,

            id:
                databaseId ||
                provider.id ||
                null,

            provider_id:
                normalizedProviderId,

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

            const keys = [
                provider.id,
                provider.provider_id,
                provider.provider,
                provider.provider_name
            ]
                .map(function (value) {
                    return String(
                        value ?? ""
                    )
                        .trim()
                        .toLowerCase();
                })
                .filter(Boolean);

            const alreadyExists =
                keys.some(function (key) {
                    return seen.has(key);
                });

            if (alreadyExists) {
                return;
            }

            keys.forEach(function (key) {
                seen.add(key);
            });

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
       PROVIDER MATCH
    ===================================================== */

    function matchesProvider(
        provider,
        identifier
    ) {

        if (!provider) {
            return false;
        }

        const normalized =
            String(
                identifier ?? ""
            )
                .trim()
                .toLowerCase();

        if (!normalized) {
            return false;
        }

        const candidates = [
            provider.id,
            provider.provider_id,
            provider.provider,
            provider.provider_name
        ];

        return candidates.some(
            function (candidate) {

                return (
                    String(
                        candidate ?? ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalized
                );
            }
        );
    }


    /* =====================================================
       POPULATE PROVIDER SELECT

       #providerId

       Value dropdown:
           provider_id

       Metadata:
           data-provider-uuid
    ===================================================== */

    function populateSelect(
        list,
        options = {}
    ) {

        const select =
            getProviderSelect();

        if (!select) {
            return false;
        }

        const activeOnly =
            options.activeOnly !== false;

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

        placeholder.value =
            "";

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

                const providerValue =
                    String(
                        provider.provider_id ??
                        provider.provider ??
                        provider.id ??
                        ""
                    ).trim();

                if (!providerValue) {
                    return;
                }

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    providerValue;

                const name =
                    provider.provider_name ||
                    providerValue;

                option.textContent =
                    name === providerValue
                        ? providerValue
                        : name +
                          " (" +
                          providerValue +
                          ")";

                if (provider.id) {
                    option.dataset.providerUuid =
                        String(
                            provider.id
                        );
                }

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

            const directOption =
                Array.from(
                    select.options
                ).find(
                    function (option) {

                        return (
                            String(
                                option.value ?? ""
                            )
                                .trim()
                                .toLowerCase() ===
                            currentValue.toLowerCase()
                        );
                    }
                );

            if (directOption) {

                select.value =
                    directOption.value;

            } else {

                const matchedProvider =
                    source.find(
                        function (provider) {

                            return matchesProvider(
                                provider,
                                currentValue
                            );
                        }
                    );

                if (matchedProvider) {

                    select.value =
                        matchedProvider.provider_id;
                }
            }
        }

        return true;
    }


    /* =====================================================
       DISPATCH PROVIDER EVENTS

       Dipertahankan beberapa event compatibility
       karena halaman Models lama dan modul baru
       menggunakan nama event berbeda.
    ===================================================== */

    function dispatchProviderEvents() {

        const detail = {
            providers:
                getProviders(),
            activeProviders:
                providers.filter(isActive)
        };


        /* Event utama module */

        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-models-providers-loaded",
                    {
                        detail
                    }
                )
            );
        } catch (error) {
            console.warn(
                "[GEN-Z.AI] Provider event error:",
                error
            );
        }


        /* Compatibility event */

        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-providers-loaded",
                    {
                        detail
                    }
                )
            );
        } catch (error) {
            console.warn(
                "[GEN-Z.AI] Provider compatibility event error:",
                error
            );
        }


        /* Compatibility untuk listener lama */

        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-provider-loaded",
                    {
                        detail
                    }
                )
            );
        } catch (error) {
            console.warn(
                "[GEN-Z.AI] Provider legacy event error:",
                error
            );
        }
    }


    /* =====================================================
       LOAD PROVIDERS

       DATA OWNER:
           GENZModelsData

       Provider module hanya:
           - meminta data
           - normalize
           - menyimpan state
           - populate dropdown
           - dispatch event
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
           CEGAH REQUEST GANDA

           Jika beberapa module meminta Provider
           pada waktu hampir bersamaan, gunakan
           Promise yang sama.
        ------------------------------------------------- */

        if (
            loadingPromise &&
            !force
        ) {
            return loadingPromise;
        }


        loadingPromise =
            (async function () {

                const loaded =
                    await data.loadProviders({
                        force,
                        activeOnly
                    });


                /* -----------------------------------------
                   NORMALIZE
                ----------------------------------------- */

                providers =
                    normalizeProviders(
                        loaded
                    );


                /* -----------------------------------------
                   POPULATE SELECT

                   Jangan filter dua kali karena Data module
                   sudah mengikuti activeOnly.
                ----------------------------------------- */

                populateSelect(
                    providers,
                    {
                        activeOnly: false,
                        value:
                            options.value
                    }
                );


                /* -----------------------------------------
                   EVENTS
                ----------------------------------------- */

                dispatchProviderEvents();


                return getProviders();

            })();


        try {

            return await loadingPromise;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Gagal memuat Provider:",
                error
            );

            notify(
                "error",
                error?.message ||
                "Gagal memuat Provider."
            );

            throw error;

        } finally {

            loadingPromise =
                null;
        }
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize(
        options = {}
    ) {

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

            return getProviders();
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

        const result =
            await initialize({
                ...options,
                force: true
            });

        return result;
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
       GET ACTIVE PROVIDERS
    ===================================================== */

    function getActiveProviders() {

        return providers.filter(
            isActive
        );
    }


    /* =====================================================
       GET PROVIDER BY ID

       Mendukung:
           UUID
           provider_id
           provider
           provider_name
    ===================================================== */

    function getProviderById(
        providerId
    ) {

        const id =
            String(
                providerId ?? ""
            )
                .trim()
                .toLowerCase();

        if (!id) {
            return null;
        }

        return (
            providers.find(
                function (provider) {

                    return matchesProvider(
                        provider,
                        id
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       GET PROVIDER VALUE

       UUID / provider code / provider name
       ->
       provider_id
    ===================================================== */

    function getProviderValue(
        providerId
    ) {

        const provider =
            getProviderById(
                providerId
            );

        if (!provider) {
            return "";
        }

        return String(
            provider.provider_id ??
            provider.provider ??
            provider.id ??
            ""
        ).trim();
    }


    /* =====================================================
       SET SELECT VALUE

       Contoh:

       setValue("kie")

       atau:

       setValue(UUID)

       Keduanya akan memilih Provider
       yang sesuai.
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
                providerId ?? ""
            ).trim();

        if (!value) {

            select.value =
                "";

            return true;
        }


        /* -------------------------------------------------
           1. DIRECT MATCH
        ------------------------------------------------- */

        const directOption =
            Array.from(
                select.options
            ).find(
                function (option) {

                    return (
                        String(
                            option.value ?? ""
                        )
                            .trim()
                            .toLowerCase() ===
                        value.toLowerCase()
                    );
                }
            );

        if (directOption) {

            select.value =
                directOption.value;

            return true;
        }


        /* -------------------------------------------------
           2. PROVIDER LOOKUP
        ------------------------------------------------- */

        const provider =
            getProviderById(
                value
            );

        if (!provider) {
            return false;
        }


        /* -------------------------------------------------
           3. NORMALIZED VALUE
        ------------------------------------------------- */

        const providerValue =
            String(
                provider.provider_id ??
                provider.provider ??
                provider.id ??
                ""
            ).trim();

        if (!providerValue) {
            return false;
        }


        /* -------------------------------------------------
           4. FIND OPTION
        ------------------------------------------------- */

        const option =
            Array.from(
                select.options
            ).find(
                function (item) {

                    return (
                        String(
                            item.value ?? ""
                        )
                            .trim()
                            .toLowerCase() ===
                        providerValue.toLowerCase()
                    );
                }
            );

        if (!option) {
            return false;
        }

        select.value =
            option.value;

        return true;
    }


    /* =====================================================
       SYNC SELECT

       Berguna ketika Provider state sudah tersedia
       tetapi dropdown baru dibuat oleh HTML/modal.
    ===================================================== */

    function syncSelect(
        options = {}
    ) {

        return populateSelect(
            providers,
            {
                activeOnly:
                    options.activeOnly !== false,

                value:
                    options.value
            }
        );
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
       IS INITIALIZED
    ===================================================== */

    function isInitialized() {
        return initialized;
    }


    /* =====================================================
       DESTROY

       Tidak menghapus DOM event karena module ini
       memang tidak memasang global event listener.
    ===================================================== */

    function destroy() {

        providers =
            [];

        initialized =
            false;

        loadingPromise =
            null;
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

            syncSelect,

            getProviders,

            getActiveProviders,

            getProviderById,

            getProviderValue,

            setValue,

            clear,

            isInitialized,

            destroy
        });


    console.log(
        "[GEN-Z.AI] GENZModelsProvider loaded."
    );

})();
