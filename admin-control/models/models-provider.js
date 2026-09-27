/* =========================================================
   GEN-Z.AI
   MODELS PROVIDER MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-provider.js

   TANGGUNG JAWAB
   - Load Provider
   - Normalize Provider
   - Populate Provider Select
   - Provider lookup
   - Provider state
   - Provider change event

   DATABASE SOURCE OF TRUTH
   - providers.id
   - providers.provider_id
   - providers.provider_name
   - providers.status
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
       HELPERS
    ===================================================== */

    function cleanString(
        value
    ) {

        return String(
            value ?? ""
        ).trim();

    }


    function normalizeString(
        value
    ) {

        return cleanString(
            value
        ).toLowerCase();

    }


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


        const normalized =
            normalizeString(
                value
            );


        if (
            [
                "true",
                "1",
                "yes",
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


        return null;

    }


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getProviderSelect() {

        return (

            document.getElementById(
                "providerId"
            )

            ||

            document.getElementById(
                "provider_id"
            )

            ||

            document.querySelector(
                "[name='provider_id']"
            )

            ||

            document.querySelector(
                "[name='providerId']"
            )

            ||

            null

        );

    }


    /* =====================================================
       NOTIFY
    ===================================================== */

    function notify(
        type,
        message
    ) {

        const text =
            cleanString(
                message
            );


        if (
            !text
        ) {

            return;

        }


        try {

            if (
                typeof window.showToast ===
                "function"
            ) {

                window.showToast(
                    text,
                    type
                );

                return;

            }

        }
        catch (_) {

            /* compatibility */

        }


        try {

            window.dispatchEvent(
                new CustomEvent(
                    "genz-models-provider-notify",
                    {
                        detail: {

                            type,

                            message:
                                text

                        }
                    }
                )
            );

        }
        catch (_) {

            /* compatibility */

        }

    }


    /* =====================================================
       PROVIDER NORMALIZATION
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
            cleanString(
                provider.id
            );


        const providerCode =
            cleanString(
                provider.provider_id ??
                provider.provider ??
                provider.provider_code ??
                provider.providerCode ??
                provider.code
            );


        /*
         * Provider tanpa ID database tetap dapat
         * dipakai untuk compatibility.
         *
         * Tetapi ketika masuk SELECT form model,
         * ID database tetap diwajibkan karena
         * models.provider_id adalah FK.
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
            cleanString(
                provider.provider_name ??
                provider.providerName ??
                provider.name ??
                normalizedProviderId
            );


        const normalized = {

            ...provider,

            id:
                databaseId ||
                null,

            provider_id:
                normalizedProviderId,

            provider_name:
                providerName

        };


        /*
         * Jangan membuat is_active sendiri.
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
            !Array.isArray(
                list
            )
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
                    normalizeString(
                        provider.id
                    );


                const providerCode =
                    normalizeString(
                        provider.provider_id
                    );


                /*
                 * Hindari duplicate UUID.
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
                 * Hindari duplicate provider code.
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


        /*
         * is_active
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
         * active
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
         * enabled
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
         * status
         */

        const status =
            normalizeString(
                provider.status
            );


        /*
         * Tidak ada status =
         * jangan otomatis dianggap inactive.
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
       SORT
    ===================================================== */

    function sortProviders(
        left,
        right
    ) {

        const a =
            normalizeString(
                left?.provider_name ??
                left?.provider_id
            );


        const b =
            normalizeString(
                right?.provider_name ??
                right?.provider_id
            );


        return a.localeCompare(
            b
        );

    }


    /* =====================================================
       PROVIDER MATCH
    ===================================================== */

    function matchesProvider(
        provider,
        value
    ) {

        if (
            !provider
        ) {

            return false;

        }


        const target =
            normalizeString(
                value
            );


        if (
            !target
        ) {

            return false;

        }


        const candidates = [

            provider.id,

            provider.provider_id,

            provider.provider_name,

            provider.provider,

            provider.provider_code,

            provider.providerCode,

            provider.code

        ];


        return candidates.some(
            function (
                candidate
            ) {

                return (
                    normalizeString(
                        candidate
                    ) ===
                    target
                );

            }
        );

    }


    /* =====================================================
       POPULATE SELECT
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


        /*
         * =================================================
         * PENTING
         * =================================================
         *
         * Sebelumnya:
         *
         * activeOnly =
         *     options.activeOnly !== false
         *
         * Artinya ketika caller mengirim:
         *
         * includeInactive: true
         *
         * provider tetap difilter activeOnly.
         *
         * Sekarang includeInactive dihormati.
         */

        const activeOnly =
            options.activeOnly !== undefined

                ? options.activeOnly !== false

                : options.includeInactive === true
                    ? false
                    : true;


        const currentValue =
            cleanString(
                options.value ??
                select.value ??
                ""
            );


        let source =
            normalizeProviders(
                list
            );


        /*
         * Filter active hanya jika memang
         * diminta.
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
            source.sort(
                sortProviders
            );


        const fragment =
            document.createDocumentFragment();


        /* =================================================
           PLACEHOLDER
        ================================================= */

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


        /* =================================================
           PROVIDER OPTIONS
        ================================================= */

        source.forEach(
            function (
                provider
            ) {

                /*
                 * DATABASE VALUE
                 *
                 * Form menggunakan providers.id.
                 */

                const databaseId =
                    cleanString(
                        provider.id
                    );


                /*
                 * Provider tanpa database ID
                 * tidak boleh dijadikan FK palsu.
                 */

                if (
                    !databaseId
                ) {

                    return;

                }


                const providerCode =
                    cleanString(
                        provider.provider_id ??
                        provider.provider ??
                        provider.provider_code ??
                        provider.providerCode ??
                        provider.code
                    );


                const providerName =
                    cleanString(
                        provider.provider_name ??
                        provider.providerName ??
                        provider.name ??
                        providerCode ??
                        databaseId
                    );


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    databaseId;


                /*
                 * Metadata UUID.
                 */

                option.dataset.providerUuid =
                    databaseId;


                /*
                 * Metadata provider code.
                 */

                if (
                    providerCode
                ) {

                    option.dataset.providerId =
                        providerCode;

                    option.dataset.providerCode =
                        providerCode;

                }


                /*
                 * Metadata provider name.
                 */

                option.dataset.providerName =
                    providerName;


                /*
                 * Display:
                 *
                 * KIE.AI (kie_ai)
                 */

                option.textContent =
                    providerCode &&
                    normalizeString(
                        providerCode
                    ) !==
                    normalizeString(
                        providerName
                    )

                        ? (
                            providerName +
                            " (" +
                            providerCode +
                            ")"
                        )

                        : providerName;


                /*
                 * Status metadata.
                 */

                if (
                    provider.status !==
                    undefined
                ) {

                    option.dataset.status =
                        cleanString(
                            provider.status
                        );

                }


                /*
                 * is_active metadata
                 * jika memang ada.
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


        /* =================================================
           REPLACE OPTIONS
        ================================================= */

        select.replaceChildren(
            fragment
        );


        /* =================================================
           RESTORE VALUE
        ================================================= */

        if (
            currentValue
        ) {

            /*
             * 1. UUID langsung.
             */

            const directOption =
                Array.from(
                    select.options
                ).find(
                    function (
                        option
                    ) {

                        return (
                            normalizeString(
                                option.value
                            ) ===
                            normalizeString(
                                currentValue
                            )
                        );

                    }
                );


            if (
                directOption
            ) {

                select.value =
                    directOption.value;

            }

            else {

                /*
                 * 2. Provider code / name.
                 */

                const matchingOption =
                    Array.from(
                        select.options
                    ).find(
                        function (
                            option
                        ) {

                            const optionCode =
                                normalizeString(
                                    option.dataset.providerId
                                );


                            const optionName =
                                normalizeString(
                                    option.dataset.providerName
                                );


                            return (

                                optionCode ===
                                normalizeString(
                                    currentValue
                                )

                                ||

                                optionName ===
                                normalizeString(
                                    currentValue
                                )

                            );

                        }
                    );


                if (
                    matchingOption
                ) {

                    select.value =
                        matchingOption.value;

                }

            }

        }


        return true;

    }


    /* =====================================================
       DISPATCH PROVIDER EVENTS
    ===================================================== */

    function dispatchProviderEvents() {

        const select =
            getProviderSelect();


        if (
            !select
        ) {

            return false;

        }


        if (
            select.dataset
                .genzProviderBound ===
            "true"
        ) {

            return true;

        }


        select.dataset
            .genzProviderBound =
            "true";


        select.addEventListener(
            "change",
            function (
                event
            ) {

                try {

                    const selected =
                        getProviderById(
                            event.target.value
                        );


                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-provider-changed",
                            {
                                detail: {

                                    provider:
                                        selected,

                                    providerId:
                                        event.target.value

                                }
                            }
                        )
                    );


                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-model-provider-changed",
                            {
                                detail: {

                                    provider:
                                        selected,

                                    providerId:
                                        event.target.value

                                }
                            }
                        )
                    );

                }
                catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI] Provider change event error:",
                        error
                    );

                }

            }
        );


        return true;

    }


    /* =====================================================
       LOAD PROVIDERS
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


        /*
         * =================================================
         * ACTIVE FILTER
         * =================================================
         *
         * Prioritas:
         *
         * 1. activeOnly explicit
         * 2. includeInactive
         * 3. default active only
         *
         * Dengan ini:
         *
         * includeInactive: true
         *
         * akan benar-benar menampilkan seluruh provider.
         */

        let activeOnly;


        if (
            options.activeOnly !==
            undefined
        ) {

            activeOnly =
                options.activeOnly !== false;

        }

        else if (
            options.includeInactive ===
            true
        ) {

            activeOnly =
                false;

        }

        else {

            activeOnly =
                true;

        }


        const includeInactive =
            !activeOnly;


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

                        includeInactive,

                        value:
                            options.value

                    }
                );


                dispatchProviderEvents();


                return getProviders();

            })();


        try {

            return await loadingPromise;

        }
        catch (
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

        }
        finally {

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
                            undefined
                                ? options.activeOnly !== false
                                : options.includeInactive === true
                                    ? false
                                    : true,

                        includeInactive:
                            options.includeInactive === true,

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
    ===================================================== */

    function getProviderById(
        providerId
    ) {

        const id =
            normalizeString(
                providerId
            );


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
            )

            ||

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
            normalizeString(
                providerCode
            );


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
                        normalizeString(
                            provider.provider_id ??
                            provider.provider ??
                            provider.provider_code ??
                            provider.providerCode
                        ) ===
                        code
                    );

                }
            )

            ||

            null

        );

    }


    /* =====================================================
       GET PROVIDER VALUE
       -----------------------------------------------------
       Input:
         UUID / provider code / name

       Output:
         providers.id
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


        return cleanString(
            provider.id
        );

    }


    /* =====================================================
       GET PROVIDER CODE
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


        return cleanString(
            provider.provider_id ??
            provider.provider ??
            provider.provider_code ??
            provider.providerCode
        );

    }


    /* =====================================================
       SET VALUE
       -----------------------------------------------------
       Select value = providers.id
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
            cleanString(
                providerId
            );


        if (
            !value
        ) {

            select.value =
                "";

            return true;

        }


        /*
         * 1. UUID
         */

        const directOption =
            Array.from(
                select.options
            ).find(
                function (
                    option
                ) {

                    return (
                        normalizeString(
                            option.value
                        ) ===
                        normalizeString(
                            value
                        )
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


        /*
         * 2. Provider code / name
         */

        const matchingOption =
            Array.from(
                select.options
            ).find(
                function (
                    option
                ) {

                    return (

                        normalizeString(
                            option.dataset.providerId
                        ) ===
                        normalizeString(
                            value
                        )

                        ||

                        normalizeString(
                            option.dataset.providerCode
                        ) ===
                        normalizeString(
                            value
                        )

                        ||

                        normalizeString(
                            option.dataset.providerName
                        ) ===
                        normalizeString(
                            value
                        )

                    );

                }
            );


        if (
            matchingOption
        ) {

            select.value =
                matchingOption.value;

            return true;

        }


        /*
         * 3. Provider state.
         */

        const provider =
            getProviderById(
                value
            );


        if (
            provider &&
            provider.id
        ) {

            select.value =
                provider.id;

            return true;

        }


        return false;

    }


    /* =====================================================
       CLEAR
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


        return true;

    }


    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        providers =
            [];


        initialized =
            false;


        loadingPromise =
            null;


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsProvider =
        Object.freeze({

            initialize,

            loadProviders,

            refresh,

            getProviders,

            getActiveProviders,

            getProviderById,

            getProviderByCode,

            getProviderValue,

            getProviderCode,

            setValue,

            clear,

            reset,

            isActive,

            matchesProvider

        });


    console.info(
        "[GEN-Z.AI] GENZModelsProvider loaded."
    );

})();
