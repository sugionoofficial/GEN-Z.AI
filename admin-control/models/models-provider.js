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

   DATABASE RELATION:
   models.provider_id
        ↓
   providers.id

   PROVIDER CODE:
   providers.provider_id

   Artinya:
   - Dropdown Provider VALUE = providers.id
   - API/provider code        = providers.provider_id

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


            if (
                !alertBox
            ) {

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


        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI] Provider notify error:",
                error
            );

        }

    }


    /* =====================================================
       NORMALIZE BOOLEAN
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
            typeof provider !==
                "object"
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


        /*
         * Provider tanpa UUID masih dapat dipakai
         * untuk compatibility, tetapi record database
         * normal seharusnya mempunyai providers.id.
         */
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
            function (
                item
            ) {

                const provider =
                    normalizeProvider(
                        item
                    );


                if (
                    !provider
                ) {

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


                if (
                    databaseId &&
                    seenIds.has(
                        databaseId
                    )
                ) {

                    return;

                }


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
    ===================================================== */

    function isActive(
        provider
    ) {

        if (
            !provider ||
            typeof provider !==
                "object"
        ) {

            return false;

        }


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


        const status =
            String(
                provider.status ??
                ""
            )
                .trim()
                .toLowerCase();


        /*
         * Jika status tidak tersedia,
         * jangan menganggap provider inactive
         * hanya karena field tidak ada.
         */
        if (
            !status
        ) {

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
       
       IMPORTANT:
       option.value = providers.id

       Karena:
       models.provider_id -> providers.id
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

                /*
                 * DATABASE VALUE:
                 * providers.id
                 */
                const databaseId =
                    String(
                        provider.id ??
                        ""
                    ).trim();


                /*
                 * Provider code hanya untuk
                 * display / metadata.
                 */
                const providerCode =
                    String(
                        provider.provider_id ??
                        provider.provider ??
                        ""
                    ).trim();


                /*
                 * Provider harus mempunyai ID database
                 * agar dapat digunakan sebagai FK models.
                 */
                if (
                    !databaseId
                ) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    databaseId;


                const name =
                    String(
                        provider.provider_name ||
                        providerCode ||
                        databaseId
                    ).trim();


                /*
                 * Contoh:
                 *
                 * KIE.AI (kie_ai)
                 */
                option.textContent =
                    providerCode &&
                    providerCode !== name
                        ? name +
                          " (" +
                          providerCode +
                          ")"
                        : name;


                /*
                 * Metadata provider code.
                 */
                if (
                    providerCode
                ) {

                    option.dataset.providerId =
                        providerCode;

                }


                /*
                 * Metadata UUID.
                 */
                option.dataset.providerUuid =
                    databaseId;


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

            /*
             * 1. Exact UUID match.
             */
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

                /*
                 * 2. Compatibility:
                 * caller mungkin masih memberikan
                 * provider_id / provider code.
                 */
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
                    matchedProvider &&
                    matchedProvider.id
                ) {

                    select.value =
                        String(
                            matchedProvider.id
                        ).trim();

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

       Data layer:
           loadProviders({
               force,
               includeInactive
           })

       Provider module:
           - normalize
           - filter
           - store
           - populate
           - event
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
         * GENZModelsData menggunakan:
         *
         * includeInactive
         *
         * Bukan activeOnly.
         */
        const includeInactive =
            activeOnly === false;


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

                            includeInactive
                        }
                    );


                providers =
                    normalizeProviders(
                        loaded
                    );


                populateSelect(
                    providers,
                    {
                        activeOnly,

                        value:
                            options.value
                    }
                );


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
       GET PROVIDER BY CODE
    ===================================================== */

    function getProviderByCode(
        providerCode
    ) {

        const code =
            String(
                providerCode ?? ""
            )
                .trim()
                .toLowerCase();


        if (
            !code
        ) {

            return null;

        }


        return (
            providers.find(
                function (
                    provider
                ) {

                    return (
                        String(
                            provider.provider_id ??
                            provider.provider ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        code
                    );

                }
            ) ||
            null
        );

    }


    /* =====================================================
       GET PROVIDER VALUE
       
       Input:
           UUID / provider code / provider name

       Output:
           providers.id

       Ini yang dipakai oleh:
           models.provider_id
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
            provider.id ??
            ""
        ).trim();

    }


    /* =====================================================
       GET PROVIDER CODE
       
       Input:
           UUID / provider code / provider name

       Output:
           providers.provider_id
       ===================================================== */

    function getProviderCode(
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
            ""
        ).trim();

    }


    /* =====================================================
       SET SELECT VALUE
       
       VALUE SELECT = providers.id
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
           1. DIRECT DATABASE UUID
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
           2. LOOKUP PROVIDER
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
           3. DATABASE UUID
        ------------------------------------------------- */

        const databaseId =
            String(
                provider.id ??
                ""
            ).trim();


        if (
            !databaseId
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
                        databaseId.toLowerCase()
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

            getProviderByCode,

            getProviderValue,

            getProviderCode,

            setValue,

            clear,

            isInitialized,

            destroy

        });


    console.info(
        "[GEN-Z.AI] GENZModelsProvider loaded."
    );

})();
