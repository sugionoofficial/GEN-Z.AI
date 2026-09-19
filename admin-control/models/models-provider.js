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

   ACTIVE STATE:
   - is_active
   - active
   - enabled
   - status

   PRIORITY ACTIVE STATE:
   1. is_active
   2. active
   3. enabled
   4. status

   Tidak membuat data provider baru.
   Semua data berasal dari GENZModelsData.
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

        return document.getElementById(
            "providerId"
        );

    }


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notify(
        type,
        message
    ) {

        try {

            if (
                window.GENZModelsUI &&
                typeof window.GENZModelsUI.showAlert ===
                    "function"
            ) {

                window.GENZModelsUI.showAlert(
                    type,
                    message
                );

                return;

            }


            const alertBox =
                document.getElementById(
                    "alertBox"
                );


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
       NORMALIZE BOOLEAN
       -----------------------------------------------------
       Mendukung nilai dari Supabase:
       true / false
       "true" / "false"
       1 / 0
       "1" / "0"
       "yes" / "no"
       "on" / "off"
       ===================================================== */

    function normalizeBoolean(
        value
    ) {

        if (
            value === true ||
            value === 1
        ) {

            return true;

        }


        if (
            value === false ||
            value === 0
        ) {

            return false;

        }


        if (
            typeof value ===
            "string"
        ) {

            const normalized =
                value
                    .trim()
                    .toLowerCase();


            if (
                [
                    "true",
                    "1",
                    "yes",
                    "y",
                    "on",
                    "active",
                    "enabled",
                    "enable"
                ].includes(
                    normalized
                )
            ) {

                return true;

            }


            if (
                [
                    "false",
                    "0",
                    "no",
                    "n",
                    "off",
                    "inactive",
                    "disabled",
                    "disable"
                ].includes(
                    normalized
                )
            ) {

                return false;

            }

        }


        return null;

    }


    /* =====================================================
       NORMALIZE PROVIDER
    ===================================================== */

    function normalizeProvider(
        provider
    ) {

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


        if (
            !normalizedProviderId
        ) {

            return null;

        }


        const providerName =
            String(
                provider.provider_name ??
                provider.name ??
                normalizedProviderId
            ).trim();


        const normalized = {
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


        /*
         * Jangan mengarang active state.
         *
         * Hanya normalisasi field yang memang
         * sudah dikirim oleh sumber data.
         */

        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "is_active"
            )
        ) {

            const parsed =
                normalizeBoolean(
                    provider.is_active
                );


            if (
                parsed !== null
            ) {

                normalized.is_active =
                    parsed;

            }

        }


        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "active"
            )
        ) {

            const parsed =
                normalizeBoolean(
                    provider.active
                );


            if (
                parsed !== null
            ) {

                normalized.active =
                    parsed;

            }

        }


        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "enabled"
            )
        ) {

            const parsed =
                normalizeBoolean(
                    provider.enabled
                );


            if (
                parsed !== null
            ) {

                normalized.enabled =
                    parsed;

            }

        }


        return normalized;

    }


    /* =====================================================
       NORMALIZE PROVIDERS
       -----------------------------------------------------
       Deduplikasi hanya berdasarkan identifier.
       
       JANGAN menggunakan provider_name sebagai
       unique key karena dua record provider dapat
       mempunyai nama yang sama.
       ===================================================== */

    function normalizeProviders(
        list
    ) {

        if (
            !Array.isArray(list)
        ) {

            return [];

        }


        const result = [];

        const seenIds =
            new Set();

        const seenProviderCodes =
            new Set();


        list.forEach(
            function (item) {

                const provider =
                    normalizeProvider(
                        item
                    );


                if (!provider) {

                    return;

                }


                const databaseId =
                    String(
                        provider.id ?? ""
                    )
                        .trim()
                        .toLowerCase();


                const providerCode =
                    String(
                        provider.provider_id ??
                        provider.provider ??
                        ""
                    )
                        .trim()
                        .toLowerCase();


                /*
                 * Jika UUID sudah pernah ditemukan,
                 * jangan masukkan dua kali.
                 */

                if (
                    databaseId &&
                    seenIds.has(
                        databaseId
                    )
                ) {

                    return;

                }


                /*
                 * Jika provider code sudah pernah
                 * ditemukan, jangan masukkan duplikat.
                 */

                if (
                    providerCode &&
                    seenProviderCodes.has(
                        providerCode
                    )
                ) {

                    return;

                }


                if (
                    databaseId
                ) {

                    seenIds.add(
                        databaseId
                    );

                }


                if (
                    providerCode
                ) {

                    seenProviderCodes.add(
                        providerCode
                    );

                }


                result.push(
                    provider
                );

            }
        );


        return result;

    }


    /* =====================================================
       ACTIVE STATUS
       -----------------------------------------------------
       PRIORITAS:
       1. is_active
       2. active
       3. enabled
       4. status
       
       Jika field boolean tersedia, field tersebut
       menjadi sumber utama.

       Jika tidak tersedia, fallback ke status.
       ===================================================== */

    function isActive(
        provider
    ) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {

            return false;

        }


        /*
         * 1. is_active
         */

        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "is_active"
            )
        ) {

            const parsed =
                normalizeBoolean(
                    provider.is_active
                );


            if (
                parsed !== null
            ) {

                return parsed;

            }

        }


        /*
         * 2. active
         */

        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "active"
            )
        ) {

            const parsed =
                normalizeBoolean(
                    provider.active
                );


            if (
                parsed !== null
            ) {

                return parsed;

            }

        }


        /*
         * 3. enabled
         */

        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "enabled"
            )
        ) {

            const parsed =
                normalizeBoolean(
                    provider.enabled
                );


            if (
                parsed !== null
            ) {

                return parsed;

            }

        }


        /*
         * 4. status
         */

        const status =
            String(
                provider.status ??
                ""
            )
                .trim()
                .toLowerCase();


        /*
         * Jika status tidak tersedia,
         * pertahankan kompatibilitas lama:
         * provider dianggap aktif.
         */

        if (!status) {

            return true;

        }


        return [
            "active",
            "enabled",
            "enable",
            "published",
            "live",
            "ready",
            "on",
            "true",
            "1"
        ].includes(
            status
        );

    }


    /* =====================================================
       SORT PROVIDERS
    ===================================================== */

    function sortProviders(
        list
    ) {

        return [
            ...list
        ].sort(
            function (
                a,
                b
            ) {

                const aDefault =
                    a.is_default === true
                        ? 0
                        : 1;


                const bDefault =
                    b.is_default === true
                        ? 0
                        : 1;


                if (
                    aDefault !==
                    bDefault
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

        if (
            !provider
        ) {

            return false;

        }


        const normalized =
            String(
                identifier ?? ""
            )
                .trim()
                .toLowerCase();


        if (
            !normalized
        ) {

            return false;

        }


        const candidates = [

            provider.id,

            provider.provider_id,

            provider.provider,

            provider.provider_name

        ];


        return candidates.some(
            function (
                candidate
            ) {

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

       Value:
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


        if (
            !select
        ) {

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
            normalizeProviders(
                list
            );


        /*
         * Filter active hanya jika diminta.
         */

        if (
            activeOnly
        ) {

            source =
                source.filter(
                    isActive
                );

        }


        source =
            sortProviders(
                source
            );


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
            function (
                provider
            ) {

                const providerValue =
                    String(
                        provider.provider_id ??
                        provider.provider ??
                        provider.id ??
                        ""
                    ).trim();


                if (
                    !providerValue
                ) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    providerValue;


                const name =
                    String(
                        provider.provider_name ||
                        providerValue
                    ).trim();


                option.textContent =
                    name === providerValue
                        ? providerValue
                        : name +
                          " (" +
                          providerValue +
                          ")";


                if (
                    provider.id
                ) {

                    option.dataset.providerUuid =
                        String(
                            provider.id
                        );

                }


                /*
                 * Metadata active state.
                 * Tidak mengubah nilai sumber.
                 */

                if (
                    Object.prototype.hasOwnProperty.call(
                        provider,
                        "is_active"
                    )
                ) {

                    option.dataset.isActive =
                        String(
                            provider.is_active
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

        if (
            currentValue
        ) {

            const directOption =
                Array.from(
                    select.options
                ).find(
                    function (
                        option
                    ) {

                        return (
                            String(
                                option.value ??
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            currentValue.toLowerCase()
                        );

                    }
                );


            if (
                directOption
            ) {

                select.value =
                    directOption.value;

            } else {

                const matchedProvider =
                    source.find(
                        function (
                            provider
                        ) {

                            return matchesProvider(
                                provider,
                                currentValue
                            );

                        }
                    );


                if (
                    matchedProvider
                ) {

                    select.value =
                        matchedProvider.provider_id;

                }

            }

        }


        return true;

    }


    /* =====================================================
       DISPATCH PROVIDER EVENTS
    ===================================================== */

    function dispatchProviderEvents() {

        const detail = {

            providers:
                getProviders(),

            activeProviders:
                providers.filter(
                    isActive
                )

        };


        /* -------------------------------------------------
           EVENT UTAMA
        ------------------------------------------------- */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-models-providers-loaded",
                    {
                        detail
                    }
                )
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Provider event error:",
                error
            );

        }


        /* -------------------------------------------------
           COMPATIBILITY EVENT
        ------------------------------------------------- */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-providers-loaded",
                    {
                        detail
                    }
                )
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Provider compatibility event error:",
                error
            );

        }


        /* -------------------------------------------------
           LEGACY EVENT
        ------------------------------------------------- */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-provider-loaded",
                    {
                        detail
                    }
                )
            );

        } catch (
            error
        ) {

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

       Provider module:
           - request data
           - normalize
           - store state
           - populate dropdown
           - dispatch event

       Tidak melakukan query Supabase sendiri.
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


        /*
         * Cegah request ganda.
         */

        if (
            loadingPromise &&
            !force
        ) {

            return loadingPromise;

        }


        loadingPromise =
            (async function () {

                const loaded =
                    await data.loadProviders(
                        {
                            force,
                            activeOnly
                        }
                    );


                /*
                 * Normalisasi.
                 */

                providers =
                    normalizeProviders(
                        loaded
                    );


                /*
                 * Penting:
                 *
                 * Jika GENZModelsData mengembalikan
                 * provider yang sudah difilter activeOnly,
                 * jangan filter ulang dengan aturan lain.
                 *
                 * Data tetap difilter di sini hanya bila
                 * caller memang meminta activeOnly.
                 */

                populateSelect(
                    providers,
                    {
                        activeOnly:
                            activeOnly,
                        value:
                            options.value
                    }
                );


                /*
                 * Event.
                 */

                dispatchProviderEvents();


                return getProviders();

            })();


        try {

            return await loadingPromise;

        } catch (
            error
        ) {

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

        /*
         * Jika sudah initialized,
         * jangan melakukan request ulang.
         */

        if (
            initialized &&
            options.force !== true
        ) {

            /*
             * Jika caller memberikan value,
             * sinkronkan dropdown saja.
             */

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

        return await initialize(
            {
                ...options,

                force:
                    true
            }
        );

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


        if (
            !id
        ) {

            return null;

        }


        return (
            providers.find(
                function (
                    provider
                ) {

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


        if (
            !provider
        ) {

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
    ===================================================== */

    function setValue(
        providerId
    ) {

        const select =
            getProviderSelect();


        if (
            !select
        ) {

            return false;

        }


        const value =
            String(
                providerId ?? ""
            ).trim();


        if (
            !value
        ) {

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
                function (
                    option
                ) {

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


        if (
            directOption
        ) {

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


        if (
            !provider
        ) {

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


        if (
            !providerValue
        ) {

            return false;

        }


        /* -------------------------------------------------
           4. FIND OPTION
        ------------------------------------------------- */

        const option =
            Array.from(
                select.options
            ).find(
                function (
                    item
                ) {

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


        if (
            !option
        ) {

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


        if (
            select
        ) {

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
       -----------------------------------------------------
       API lama dipertahankan.
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


    console.info(
        "[GEN-Z.AI] GENZModelsProvider loaded."
    );

})();
