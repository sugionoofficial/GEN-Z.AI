/* =========================================================
   GEN-Z.AI
   MODEL FORM LAYOUT
   ---------------------------------------------------------
   FILE:
   admin-control/models/functions/model-form-layout.js

   ARSITEKTUR:
   ---------------------------------------------------------
   FORM MODEL MENGIKUTI SUPABASE / KIE.AI SEBAGAI
   SINGLE SOURCE OF TRUTH.

   MODEL:
       kie_models
           |
           +-- model_id
           +-- model_name
           +-- model_family

   CAPABILITY:
       kie_parameters
           |
           +-- ratio
           +-- duration
           +-- resolution

   PRICING:
       kie_pricing
           |
           +-- unit_price
           +-- currency

   API:
       /api/kie-config?model_id=<MODEL_ID>

   KURS:
       GENZModelsPrice.getUsdToIdrRate()

   ---------------------------------------------------------
   TIDAK BOLEH:
   - hardcode Model ID
   - hardcode Model Name
   - hardcode Model Family
   - hardcode ratio
   - hardcode duration
   - hardcode resolution
   - hardcode harga KIE
   - hardcode kurs USD -> IDR

   ---------------------------------------------------------
   KOMPATIBILITAS API LAMA:
   - initialize
   - refresh
   - loadActiveModels
   - getCachedModels
   - getModelsForProvider
   - populateModelSelect
   - findModel
   - findModelById
   - getCurrentModel
   - getCurrentModelId
   - getCurrentProviderId
   - getPendingModelId
   - getPendingProviderId
   - clearPendingModelId
   - clearPendingProviderId
   - clearModelSelection
   - setModel
   - updateSelectedModelInfo
   - syncModelSearchValue
   - updateUsdPreview
   - syncCreditPreview
   - loadModelUsdPrice
   - getUsdToIdrRate
   - formatUsd
   - formatIdr
   - modelMatchesProvider
   - handleModelChange
   - handleProviderChange

   API TAMBAHAN:
   - loadKieConfig
   - getCurrentKieConfig
   - getCurrentParameters
   - getCurrentPricing
   - renderCapabilities
   - syncDurationFields
   - syncLegacyCapabilityFields
   - clearCapabilities

   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    let modelCache = [];

    let boundProviderEvent = false;

    let boundModelEvent = false;

    let boundUsdPriceEvents = false;

    let boundCapabilityEvents = [];

    let pendingModelId = "";

    let pendingProviderId = "";

    let loadingPromise = null;

    let kieConfigLoadingPromise = null;

    let currentKieConfig = null;

    let currentParameters = [];

    let currentPricing = [];

    let currentCapabilities = {

        ratios: [],

        durations: [],

        resolutions: []

    };


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getElement(id) {

        return document.getElementById(id);

    }


    function firstElement(ids) {

        for (const id of ids) {

            const element =
                getElement(id);

            if (element) {

                return element;

            }

        }

        return null;

    }


    /* =====================================================
       NORMALIZE
    ===================================================== */

    function normalize(value) {

        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();

    }


    function normalizeKey(value) {

        return normalize(value)
            .replace(/[\s_-]+/g, "");

    }


    /* =====================================================
       NUMBER
    ===================================================== */

    function toNumber(
        value,
        fallback = 0
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return fallback;

        }


        const normalized =
            String(value)
                .trim()
                .replace(/\s/g, "")
                .replace(/,/g, "");


        const number =
            Number(normalized);


        return Number.isFinite(number)
            ? number
            : fallback;

    }


    /* =====================================================
       FORMAT USD
    ===================================================== */

    function formatUsd(value) {

        const number =
            toNumber(
                value,
                NaN
            );


        if (!Number.isFinite(number)) {

            return "-";

        }


        return (
            "$" +
            number
                .toFixed(6)
                .replace(/0+$/, "")
                .replace(/\.$/, "")
        );

    }


    /* =====================================================
       FORMAT IDR
    ===================================================== */

    function formatIdr(value) {

        const number =
            toNumber(
                value,
                NaN
            );


        if (!Number.isFinite(number)) {

            return "-";

        }


        return new Intl.NumberFormat(
            "id-ID",
            {
                style:
                    "currency",

                currency:
                    "IDR",

                maximumFractionDigits:
                    0
            }
        ).format(number);

    }


    /* =====================================================
       USD -> IDR RATE
       -----------------------------------------------------
       TIDAK ADA KURS HARD-CODE DI FILE INI.
       Kurs wajib berasal dari module kurs yang sudah ada.
    ===================================================== */

    function getUsdToIdrRate() {

        const priceModule =
            window.GENZModelsPrice;


        if (
            priceModule &&
            typeof priceModule.getUsdToIdrRate ===
                "function"
        ) {

            try {

                const rate =
                    Number(
                        priceModule.getUsdToIdrRate()
                    );


                if (
                    Number.isFinite(rate) &&
                    rate > 0
                ) {

                    return rate;

                }

            } catch (error) {

                console.warn(
                    "[model-form-layout] Gagal membaca kurs USD/IDR:",
                    error
                );

            }

        }


        return null;

    }


    /* =====================================================
       PROVIDER
    ===================================================== */

    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );

    }


    function getProviderDropdown() {

        return (
            window.GENZModelProviderDropdown ||
            null
        );

    }


    function getCurrentProvider() {

        const select =
            getElement(
                "providerId"
            );


        if (!select) {

            return "";

        }


        return String(
            select.value ?? ""
        ).trim();

    }


    function resolveProvider(
        providerValue
    ) {

        const value =
            String(
                providerValue ?? ""
            ).trim();


        if (!value) {

            return null;

        }


        const providerModule =
            getProviderModule();


        if (
            providerModule &&
            typeof providerModule.getProviderById ===
                "function"
        ) {

            try {

                const provider =
                    providerModule.getProviderById(
                        value
                    );


                if (provider) {

                    return provider;

                }

            } catch (error) {

                console.warn(
                    "[model-form-layout] Provider resolution error:",
                    error
                );

            }

        }


        const dropdown =
            getProviderDropdown();


        if (
            dropdown &&
            typeof dropdown.getProviders ===
                "function"
        ) {

            try {

                const providers =
                    dropdown.getProviders();


                if (
                    Array.isArray(
                        providers
                    )
                ) {

                    const target =
                        normalize(
                            value
                        );


                    return (
                        providers.find(
                            function (provider) {

                                return [
                                    provider?.id,
                                    provider?.provider_id,
                                    provider?.provider,
                                    provider?.provider_name,
                                    provider?.name
                                ].some(
                                    function (candidate) {

                                        return (
                                            normalize(
                                                candidate
                                            ) ===
                                            target
                                        );

                                    }
                                );

                            }
                        ) ||
                        null
                    );

                }

            } catch (error) {

                console.warn(
                    "[model-form-layout] Provider dropdown resolution error:",
                    error
                );

            }

        }


        return null;

    }


    /* =====================================================
       MODEL -> PROVIDER MATCH
    ===================================================== */

    function modelMatchesProvider(
        model,
        providerValue
    ) {

        const value =
            normalize(
                providerValue
            );


        if (!value) {

            return true;

        }


        const selected =
            resolveProvider(
                providerValue
            );


        const candidates = [

            model?.provider,

            model?.provider_id,

            model?.provider_uuid,

            model?.provider_code,

            model?.provider_name

        ];


        if (
            candidates.some(
                function (candidate) {

                    return (
                        normalize(
                            candidate
                        ) ===
                        value
                    );

                }
            )
        ) {

            return true;

        }


        if (selected) {

            const providerCandidates = [

                selected.id,

                selected.provider_id,

                selected.provider,

                selected.provider_name,

                selected.name

            ];


            return candidates.some(
                function (candidate) {

                    return providerCandidates.some(
                        function (providerCandidate) {

                            return (
                                normalize(
                                    candidate
                                ) ===
                                normalize(
                                    providerCandidate
                                )
                            );

                        }
                    );

                }
            );

        }


        return false;

    }


    /* =====================================================
       MODEL STATUS
    ===================================================== */

    function isActiveModel(
        model
    ) {

        const status =
            normalize(
                model?.status
            );


        if (!status) {

            return true;

        }


        return (

            status === "active" ||
            status === "enabled" ||
            status === "published" ||
            status === "live" ||
            status === "ready"

        );

    }


    /* =====================================================
       MODEL SELECT
    ===================================================== */

    function getModelSelect() {

        let element =
            getElement(
                "modelCodeSearch"
            );


        if (!element) {

            element =
                getElement(
                    "modelCode"
                );

        }


        if (!element) {

            return null;

        }


        if (
            String(
                element.tagName
            ).toLowerCase() !==
            "select"
        ) {

            const select =
                document.createElement(
                    "select"
                );


            Array.from(
                element.attributes
            ).forEach(
                function (attribute) {

                    if (
                        attribute.name ===
                        "type"
                    ) {

                        return;

                    }


                    if (
                        attribute.name ===
                        "placeholder"
                    ) {

                        return;

                    }


                    try {

                        select.setAttribute(
                            attribute.name,
                            attribute.value
                        );

                    } catch {

                        /* ignore */

                    }

                }
            );


            select.id =
                "modelCodeSearch";


            select.removeAttribute(
                "type"
            );


            if (
                element.name
            ) {

                select.name =
                    element.name;

            }


            if (
                element.className
            ) {

                select.className =
                    element.className;

            }


            element.replaceWith(
                select
            );


            element =
                select;

        }


        element.id =
            "modelCodeSearch";


        element.disabled =
            false;


        return element;

    }


    /* =====================================================
       CURRENT MODEL ID
    ===================================================== */

    function getCurrentModelId() {

        const hidden =
            getElement(
                "modelCode"
            );


        if (
            hidden &&
            String(
                hidden.value ?? ""
            ).trim()
        ) {

            return String(
                hidden.value
            ).trim();

        }


        const select =
            getModelSelect();


        if (select) {

            return String(
                select.value ?? ""
            ).trim();

        }


        return "";

    }


    /* =====================================================
       PENDING MODEL
    ===================================================== */

    function setPendingModelId(
        modelId
    ) {

        pendingModelId =
            String(
                modelId ?? ""
            ).trim();


        return pendingModelId;

    }


    function clearPendingModelId() {

        pendingModelId =
            "";


        return true;

    }


    function getPendingModelId() {

        return pendingModelId;

    }


    function getPendingProviderId() {

        return pendingProviderId;

    }


    /* =====================================================
       CACHE
    ===================================================== */

    function getCachedModels() {

        return [
            ...modelCache
        ];

    }


    /* =====================================================
       LOAD MODELS
    ===================================================== */

    async function loadActiveModels(
        options = {}
    ) {

        const data =
            window.GENZModelsData;


        const selectedModelId =
            String(
                options.selectedModelId ??
                pendingModelId ??
                getCurrentModelId() ??
                ""
            ).trim();


        const providerId =
            String(
                options.providerId ??
                pendingProviderId ??
                getCurrentProvider() ??
                ""
            ).trim();


        if (selectedModelId) {

            pendingModelId =
                selectedModelId;

        }


        if (providerId) {

            pendingProviderId =
                providerId;

        }


        if (
            !data ||
            typeof data.loadKieModels !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] GENZModelsData.loadKieModels() tidak tersedia."
            );


            return [
                ...modelCache
            ];

        }


        if (
            loadingPromise &&
            options.force !== true
        ) {

            try {

                return await loadingPromise;

            } catch {

                /* request berikutnya boleh berjalan */

            }

        }


        loadingPromise =
            (async function () {

                const result =
                    await data.loadKieModels(
                        {
                            activeOnly:
                                false,

                            force:
                                options.force === true
                        }
                    );


                const incoming =
                    Array.isArray(
                        result
                    )
                        ? result
                        : [];


                modelCache =
                    incoming.filter(
                        isActiveModel
                    );


                return [
                    ...modelCache
                ];

            })();


        try {

            return await loadingPromise;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Gagal memuat Model:",
                error
            );


            return [
                ...modelCache
            ];

        } finally {

            loadingPromise =
                null;

        }

    }


    /* =====================================================
       FILTER MODEL
    ===================================================== */

    function getModelsForProvider(
        providerValue
    ) {

        const value =
            String(
                providerValue ?? ""
            ).trim();


        if (!value) {

            return [];

        }


        return modelCache.filter(
            function (model) {

                return (
                    isActiveModel(
                        model
                    ) &&
                    modelMatchesProvider(
                        model,
                        value
                    )
                );

            }
        );

    }


    /* =====================================================
       POPULATE MODEL SELECT
    ===================================================== */

    function populateModelSelect(
        options = {}
    ) {

        const select =
            getModelSelect();


        if (!select) {

            return false;

        }


        const providerId =
            String(
                options.providerId ??
                getCurrentProvider() ??
                pendingProviderId ??
                ""
            ).trim();


        const selectedModelId =
            String(
                options.selectedModelId ??
                pendingModelId ??
                getCurrentModelId() ??
                ""
            ).trim();


        const models =
            getModelsForProvider(
                providerId
            );


        select.innerHTML =
            "";


        const placeholder =
            document.createElement(
                "option"
            );


        placeholder.value =
            "";


        placeholder.textContent =
            providerId
                ? "Pilih Model ID"
                : "Pilih Provider terlebih dahulu";


        placeholder.selected =
            true;


        select.appendChild(
            placeholder
        );


        const sorted =
            [
                ...models
            ].sort(
                function (a, b) {

                    const aId =
                        String(
                            a?.model_id ?? ""
                        );

                    const bId =
                        String(
                            b?.model_id ?? ""
                        );

                    return aId.localeCompare(
                        bId,
                        undefined,
                        {
                            sensitivity:
                                "base"
                        }
                    );

                }
            );


        sorted.forEach(
            function (model) {

                const modelId =
                    String(
                        model?.model_id ?? ""
                    ).trim();


                if (!modelId) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    modelId;


                option.textContent =
                    modelId;


                option.dataset.modelId =
                    modelId;


                if (
                    model?.model_name
                ) {

                    option.dataset.modelName =
                        String(
                            model.model_name
                        );

                }


                if (
                    model?.model_family
                ) {

                    option.dataset.modelFamily =
                        String(
                            model.model_family
                        );

                }


                if (
                    model?.provider_id
                ) {

                    option.dataset.provider =
                        String(
                            model.provider_id
                        );

                }


                select.appendChild(
                    option
                );

            }
        );


        if (
            selectedModelId &&
            sorted.some(
                function (model) {

                    return (
                        normalize(
                            model?.model_id
                        ) ===
                        normalize(
                            selectedModelId
                        )
                    );

                }
            )
        ) {

            select.value =
                selectedModelId;

        } else {

            select.value =
                "";

        }


        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                select.value || "";

        }


        return true;

    }


    /* =====================================================
       FIND MODEL
    ===================================================== */

    function findModel(
        modelId
    ) {

        const id =
            normalize(
                modelId
            );


        if (!id) {

            return null;

        }


        return (
            modelCache.find(
                function (model) {

                    return (
                        normalize(
                            model?.model_id
                        ) ===
                        id
                    );

                }
            ) ||
            null
        );

    }


    function findModelById(
        modelId
    ) {

        return findModel(
            modelId
        );

    }


    /* =====================================================
       KIE CONFIG
    ===================================================== */

    async function loadKieConfig(
        modelId,
        options = {}
    ) {

        const id =
            String(
                modelId ?? ""
            ).trim();


        if (!id) {

            clearKieConfigState();

            return null;

        }


        if (
            kieConfigLoadingPromise &&
            options.force !== true
        ) {

            try {

                return await kieConfigLoadingPromise;

            } catch {

                /* request berikutnya boleh berjalan */

            }

        }


        const data =
            window.GENZModelsData;


        let token =
            "";


        try {

            const supabase =
                window.GENZ_SUPABASE ||
                window.supabaseClient ||
                null;


            if (
                supabase?.auth &&
                typeof supabase.auth.getSession ===
                    "function"
            ) {

                const sessionResult =
                    await supabase.auth.getSession();


                token =
                    sessionResult?.data?.session?.access_token ||
                    "";

            }

        } catch (error) {

            console.warn(
                "[model-form-layout] Gagal membaca session Supabase:",
                error
            );

        }


        if (!token) {

            console.error(
                "[model-form-layout] Session Supabase tidak tersedia. Konfigurasi KIE tidak dimuat."
            );


            clearKieConfigState();


            return null;

        }


        const url =
            "/api/kie-config?model_id=" +
            encodeURIComponent(
                id
            );


        kieConfigLoadingPromise =
            (async function () {

                const response =
                    await fetch(
                        url,
                        {

                            method:
                                "GET",

                            headers: {

                                "Accept":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${token}`

                            },

                            credentials:
                                "same-origin"

                        }
                    );


                const text =
                    await response.text();


                let dataResponse =
                    null;


                if (text) {

                    try {

                        dataResponse =
                            JSON.parse(
                                text
                            );

                    } catch {

                        dataResponse =
                            null;

                    }

                }


                if (
                    !response.ok ||
                    !dataResponse?.success
                ) {

                    throw new Error(
                        dataResponse?.error ||
                        `KIE config gagal (${response.status})`
                    );

                }


                if (
                    !Array.isArray(
                        dataResponse.models
                    )
                ) {

                    throw new Error(
                        "Response KIE tidak memiliki models[]."
                    );

                }


                const returnedModel =
                    dataResponse.models.find(
                        function (model) {

                            return (
                                normalize(
                                    model?.model_id
                                ) ===
                                normalize(
                                    id
                                )
                            );

                        }
                    );


                if (!returnedModel) {

                    throw new Error(
                        "Model ID tidak ditemukan dalam konfigurasi KIE."
                    );

                }


                currentKieConfig =
                    dataResponse;


                currentParameters =
                    Array.isArray(
                        dataResponse.parameters
                    )
                        ? dataResponse.parameters
                        : [];


                currentPricing =
                    Array.isArray(
                        dataResponse.pricing
                    )
                        ? dataResponse.pricing
                        : [];


                currentCapabilities =
                    extractCapabilities(
                        currentParameters
                    );


                return dataResponse;

            })();


        try {

            const result =
                await kieConfigLoadingPromise;


            return result;

        } catch (error) {

            console.error(
                "[model-form-layout] Gagal memuat konfigurasi KIE:",
                error
            );


            clearKieConfigState();


            return null;

        } finally {

            kieConfigLoadingPromise =
                null;

        }

    }


    /* =====================================================
       CLEAR KIE CONFIG STATE
    ===================================================== */

    function clearKieConfigState() {

        currentKieConfig =
            null;

        currentParameters =
            [];

        currentPricing =
            [];

        currentCapabilities = {

            ratios: [],

            durations: [],

            resolutions: []

        };


        clearCapabilityCheckboxes();

        clearLegacyCapabilityFields();

        clearKiePrice();

    }


    /* =====================================================
       GET CURRENT KIE CONFIG
    ===================================================== */

    function getCurrentKieConfig() {

        return currentKieConfig;

    }


    function getCurrentParameters() {

        return [
            ...currentParameters
        ];

    }


    function getCurrentPricing() {

        return [
            ...currentPricing
        ];

    }


    /* =====================================================
       PARAMETER CLASSIFICATION
    ===================================================== */

    function classifyParameter(
        parameter
    ) {

        const values = [

            parameter?.parameter_name,

            parameter?.label,

            parameter?.api_mapping,

            parameter?.metadata?.parameter_name,

            parameter?.metadata?.name

        ]
            .filter(
                value =>
                    value !== null &&
                    value !== undefined
            )
            .map(
                normalizeKey
            );


        if (
            values.some(
                value =>
                    value.includes(
                        "ratio"
                    ) ||
                    value.includes(
                        "aspect"
                    )
            )
        ) {

            return "ratio";

        }


        if (
            values.some(
                value =>
                    value.includes(
                        "duration"
                    ) ||
                    value.includes(
                        "seconds"
                    ) ||
                    value === "length"
            )
        ) {

            return "duration";

        }


        if (
            values.some(
                value =>
                    value.includes(
                        "resolution"
                    ) ||
                    value.includes(
                        "quality"
                    )
            )
        ) {

            return "resolution";

        }


        return null;

    }


    /* =====================================================
       ENUM VALUE NORMALIZATION
    ===================================================== */

    function parseEnumValues(
        parameter
    ) {

        const candidates = [

            parameter?.enum_values,

            parameter?.metadata?.enum_values,

            parameter?.metadata?.values,

            parameter?.default_value

        ];


        for (
            const candidate
            of candidates
        ) {

            if (
                Array.isArray(
                    candidate
                )
            ) {

                const values =
                    candidate
                        .map(
                            value => {

                                if (
                                    value &&
                                    typeof value ===
                                        "object"
                                ) {

                                    return (
                                        value.value ??
                                        value.id ??
                                        value.name ??
                                        value.label ??
                                        ""
                                    );

                                }

                                return value;

                            }
                        )
                        .map(
                            value =>
                                String(
                                    value ?? ""
                                ).trim()
                        )
                        .filter(Boolean);


                if (
                    values.length
                ) {

                    return uniqueValues(
                        values
                    );

                }

            }


            if (
                typeof candidate ===
                    "string"
            ) {

                const text =
                    candidate.trim();


                if (!text) {

                    continue;

                }


                try {

                    const parsed =
                        JSON.parse(
                            text
                        );


                    if (
                        Array.isArray(
                            parsed
                        )
                    ) {

                        const values =
                            parsed
                                .map(
                                    value => {

                                        if (
                                            value &&
                                            typeof value ===
                                                "object"
                                        ) {

                                            return (
                                                value.value ??
                                                value.id ??
                                                value.name ??
                                                value.label ??
                                                ""
                                            );

                                        }

                                        return value;

                                    }
                                )
                                .map(
                                    value =>
                                        String(
                                            value ?? ""
                                        ).trim()
                                )
                                .filter(Boolean);


                        if (
                            values.length
                        ) {

                            return uniqueValues(
                                values
                            );

                        }

                    }

                } catch {

                    const values =
                        text
                            .split(",")
                            .map(
                                value =>
                                    value.trim()
                            )
                            .filter(Boolean);


                    if (
                        values.length > 1
                    ) {

                        return uniqueValues(
                            values
                        );

                    }

                }

            }

        }


        return [];

    }


    /* =====================================================
       UNIQUE VALUES
    ===================================================== */

    function uniqueValues(
        values
    ) {

        const seen =
            new Set();

        const result =
            [];


        values.forEach(
            function (value) {

                const text =
                    String(
                        value ?? ""
                    ).trim();


                if (!text) {

                    return;

                }


                const key =
                    normalize(
                        text
                    );


                if (
                    seen.has(
                        key
                    )
                ) {

                    return;

                }


                seen.add(
                    key
                );


                result.push(
                    text
                );

            }
        );


        return result;

    }


    /* =====================================================
       EXTRACT CAPABILITIES
    ===================================================== */

    function extractCapabilities(
        parameters
    ) {

        const result = {

            ratios: [],

            durations: [],

            resolutions: []

        };


        if (
            !Array.isArray(
                parameters
            )
        ) {

            return result;

        }


        parameters.forEach(
            function (parameter) {

                const type =
                    classifyParameter(
                        parameter
                    );


                if (!type) {

                    return;

                }


                const values =
                    parseEnumValues(
                        parameter
                    );


                if (!values.length) {

                    return;

                }


                if (
                    type ===
                    "ratio"
                ) {

                    result.ratios =
                        uniqueValues(
                            result.ratios.concat(
                                values
                            )
                        );

                }


                if (
                    type ===
                    "duration"
                ) {

                    result.durations =
                        uniqueValues(
                            result.durations.concat(
                                values
                            )
                        );

                }


                if (
                    type ===
                    "resolution"
                ) {

                    result.resolutions =
                        uniqueValues(
                            result.resolutions.concat(
                                values
                            )
                        );

                }

            }
        );


        return result;

    }


    /* =====================================================
       CAPABILITY CONTAINER
    ===================================================== */

    function getCapabilityContainer(
        fieldId,
        groupName
    ) {

        const field =
            getElement(
                fieldId
            );


        if (!field) {

            return null;

        }


        const parent =
            field.parentElement;


        if (!parent) {

            return null;

        }


        let container =
            parent.querySelector(
                `[data-genz-capability-group="${groupName}"]`
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.dataset.genzCapabilityGroup =
                groupName;


            container.className =
                "genz-kie-capability-group";


            container.style.display =
                "flex";


            container.style.flexWrap =
                "wrap";


            container.style.gap =
                "8px";


            container.style.marginTop =
                "8px";


            parent.appendChild(
                container
            );

        }


        return container;

    }


    /* =====================================================
       CHECKBOX
    ===================================================== */

    function createCapabilityCheckbox(
        group,
        value,
        options = {}
    ) {

        const {

            readonly = false,

            checked = false,

            labelPrefix = ""

        } = options;


        const wrapper =
            document.createElement(
                "label"
            );


        wrapper.className =
            "genz-kie-capability-option";


        wrapper.style.display =
            "inline-flex";


        wrapper.style.alignItems =
            "center";


        wrapper.style.gap =
            "6px";


        wrapper.style.padding =
            "6px 9px";


        wrapper.style.border =
            "1px solid rgba(148,163,184,.25)";


        wrapper.style.borderRadius =
            "8px";


        wrapper.style.background =
            "rgba(15,23,42,.45)";


        const checkbox =
            document.createElement(
                "input"
            );


        checkbox.type =
            "checkbox";


        checkbox.dataset.kieCapability =
            group;


        checkbox.dataset.kieValue =
            String(
                value
            );


        checkbox.value =
            String(
                value
            );


        checkbox.checked =
            Boolean(
                checked
            );


        /*
         * IMPORTANT:
         *
         * Ratio dan Resolution TIDAK lagi disabled.
         *
         * Nilainya tetap readonly dari sisi SOURCE
         * karena option hanya dibuat dari KIE/Supabase.
         *
         * Checkbox boleh dipilih user saat edit.
         */

        if (
            readonly
        ) {

            checkbox.disabled =
                true;

            checkbox.setAttribute(
                "aria-readonly",
                "true"
            );

        }


        const text =
            document.createElement(
                "span"
            );


        text.textContent =
            labelPrefix +
            String(
                value
            );


        wrapper.appendChild(
            checkbox
        );


        wrapper.appendChild(
            text
        );


        return {

            wrapper,

            checkbox

        };

    }


    /* =====================================================
       REMOVE OLD CAPABILITY CHECKBOXES
    ===================================================== */

    function clearCapabilityCheckboxes() {

        document
            .querySelectorAll(
                ".genz-kie-capability-group"
            )
            .forEach(
                function (element) {

                    element.innerHTML =
                        "";

                }
            );


        unbindCapabilityEvents();

    }


    /* =====================================================
       CAPABILITY EVENTS
    ===================================================== */

    function unbindCapabilityEvents() {

        while (
            boundCapabilityEvents.length
        ) {

            const item =
                boundCapabilityEvents.pop();


            try {

                item.element.removeEventListener(
                    item.event,
                    item.handler
                );

            } catch {

                /* ignore */

            }

        }

    }


    function bindCapabilityEvent(
        element,
        event,
        handler
    ) {

        if (!element) {

            return;

        }


        element.addEventListener(
            event,
            handler
        );


        boundCapabilityEvents.push({

            element,

            event,

            handler

        });

    }


    /* =====================================================
       CHECKED VALUES
    ===================================================== */

    function getCheckedCapabilityValues(
        group
    ) {

        const result =
            [];


        document
            .querySelectorAll(
                `input[data-kie-capability="${group}"]:checked`
            )
            .forEach(
                function (checkbox) {

                    const value =
                        String(
                            checkbox.dataset.kieValue ??
                            checkbox.value ??
                            ""
                        ).trim();


                    if (value) {

                        result.push(
                            value
                        );

                    }

                }
            );


        return uniqueValues(
            result
        );

    }


    /* =====================================================
       DURATION SORT
    ===================================================== */

    function sortDurationValues(
        values
    ) {

        return [
            ...values
        ].sort(
            function (a, b) {

                const na =
                    Number(
                        a
                    );

                const nb =
                    Number(
                        b
                    );


                if (
                    Number.isFinite(na) &&
                    Number.isFinite(nb)
                ) {

                    return na - nb;

                }


                return String(
                    a
                ).localeCompare(
                    String(
                        b
                    ),
                    undefined,
                    {
                        numeric:
                            true
                    }
                );

            }
        );

    }


    /* =====================================================
       SYNC DURATION FIELDS
       -----------------------------------------------------
       Checkbox Duration:
           [5] [8] [10]

       Jika:
           [5] [10]

       maka:
           minDuration = 5
           maxDuration = 10
    ===================================================== */

    function syncDurationFields() {

        const values =
            getCheckedCapabilityValues(
                "duration"
            );


        const sorted =
            sortDurationValues(
                values
            );


        const minField =
            getElement(
                "minDuration"
            );


        const maxField =
            getElement(
                "maxDuration"
            );


        if (minField) {

            minField.value =
                sorted.length
                    ? sorted[0]
                    : "";

            minField.readOnly =
                true;

            minField.dataset.kieManaged =
                "true";

        }


        if (maxField) {

            maxField.value =
                sorted.length
                    ? sorted[
                        sorted.length - 1
                    ]
                    : "";

            maxField.readOnly =
                true;

            maxField.dataset.kieManaged =
                "true";

        }


        return {

            min:
                sorted.length
                    ? sorted[0]
                    : "",

            max:
                sorted.length
                    ? sorted[
                        sorted.length - 1
                    ]
                    : "",

            values:
                sorted

        };

    }


    /* =====================================================
       SYNC LEGACY CAPABILITY FIELDS
    ===================================================== */

    function syncLegacyCapabilityFields() {

        const ratioValues =
            getCheckedCapabilityValues(
                "ratio"
            );


        const resolutionValues =
            getCheckedCapabilityValues(
                "resolution"
            );


        const ratioField =
            getElement(
                "supportedRatios"
            );


        const resolutionField =
            getElement(
                "supportedResolutions"
            );


        if (ratioField) {

            ratioField.value =
                ratioValues.join(
                    ", "
                );


            ratioField.readOnly =
                true;


            ratioField.dataset.kieManaged =
                "true";

        }


        if (resolutionField) {

            resolutionField.value =
                resolutionValues.join(
                    ", "
                );


            resolutionField.readOnly =
                true;


            resolutionField.dataset.kieManaged =
                "true";

        }


        return {

            ratios:
                ratioValues,

            resolutions:
                resolutionValues

        };

    }


    /* =====================================================
       CLEAR LEGACY CAPABILITY FIELDS
    ===================================================== */

    function clearLegacyCapabilityFields() {

        const ratioField =
            getElement(
                "supportedRatios"
            );


        const resolutionField =
            getElement(
                "supportedResolutions"
            );


        if (ratioField) {

            ratioField.value =
                "";

            ratioField.readOnly =
                true;

        }


        if (resolutionField) {

            resolutionField.value =
                "";

            resolutionField.readOnly =
                true;

        }


        const minField =
            getElement(
                "minDuration"
            );


        const maxField =
            getElement(
                "maxDuration"
            );


        if (minField) {

            minField.value =
                "";

            minField.readOnly =
                true;

        }


        if (maxField) {

            maxField.value =
                "";

            maxField.readOnly =
                true;

        }

    }


    /* =====================================================
       RENDER CAPABILITIES
       -----------------------------------------------------
       SEMUA OPTION WAJIB BERASAL DARI:
           /api/kie-config
               |
               +-- kie_parameters
               |
               +-- enum_values
    ===================================================== */

    function renderCapabilities(
        options = {}
    ) {

        clearCapabilityCheckboxes();


        const capabilities =
            currentCapabilities || {

                ratios: [],

                durations: [],

                resolutions: []

            };


        /* =================================================
           RATIO
           ================================================= */

        const ratioContainer =
            getCapabilityContainer(
                "supportedRatios",
                "ratio"
            );


        if (ratioContainer) {

            capabilities.ratios.forEach(
                function (value) {

                    /*
                     * IMPORTANT:
                     * ratio tidak disabled.
                     *
                     * Semua option yang tampil tetap
                     * berasal dari Supabase/KIE.
                     */

                    const item =
                        createCapabilityCheckbox(
                            "ratio",
                            value,
                            {
                                readonly:
                                    false,

                                checked:
                                    false
                            }
                        );


                    bindCapabilityEvent(
                        item.checkbox,
                        "change",
                        function () {

                            syncLegacyCapabilityFields();

                            syncCreditPreview();

                        }
                    );


                    ratioContainer.appendChild(
                        item.wrapper
                    );

                }
            );

        }


        /* =================================================
           DURATION
           ================================================= */

        const durationContainer =
            getCapabilityContainer(
                "minDuration",
                "duration"
            );


        const existingMin =
            String(
                getElement(
                    "minDuration"
                )?.value ??
                ""
            ).trim();


        const existingMax =
            String(
                getElement(
                    "maxDuration"
                )?.value ??
                ""
            ).trim();


        const durationValues =
            sortDurationValues(
                capabilities.durations
            );


        if (durationContainer) {

            durationValues.forEach(
                function (value) {

                    const numeric =
                        Number(
                            value
                        );


                    const minNumeric =
                        Number(
                            existingMin
                        );


                    const maxNumeric =
                        Number(
                            existingMax
                        );


                    let checked =
                        false;


                    /*
                     * Jika field duration sudah memiliki
                     * nilai dari record Supabase, gunakan
                     * range tersebut untuk menentukan
                     * checkbox awal.
                     *
                     * Jika kosong, JANGAN mencentang
                     * semua option secara otomatis.
                     */

                    if (
                        existingMin &&
                        existingMax &&
                        Number.isFinite(
                            numeric
                        ) &&
                        Number.isFinite(
                            minNumeric
                        ) &&
                        Number.isFinite(
                            maxNumeric
                        )
                    ) {

                        checked =
                            numeric >=
                                minNumeric &&
                            numeric <=
                                maxNumeric;

                    }


                    const item =
                        createCapabilityCheckbox(
                            "duration",
                            value,
                            {
                                readonly:
                                    false,

                                checked
                            }
                        );


                    bindCapabilityEvent(
                        item.checkbox,
                        "change",
                        function () {

                            syncDurationFields();

                            syncCreditPreview();

                        }
                    );


                    durationContainer.appendChild(
                        item.wrapper
                    );

                }
            );

        }


        /* =================================================
           RESOLUTION
           ================================================= */

        const resolutionContainer =
            getCapabilityContainer(
                "supportedResolutions",
                "resolution"
            );


        if (resolutionContainer) {

            capabilities.resolutions.forEach(
                function (value) {

                    /*
                     * Resolution sekarang editable
                     * melalui checkbox.
                     *
                     * Option tetap 100% berasal dari
                     * konfigurasi Supabase/KIE.
                     */

                    const item =
                        createCapabilityCheckbox(
                            "resolution",
                            value,
                            {
                                readonly:
                                    false,

                                checked:
                                    false
                            }
                        );


                    bindCapabilityEvent(
                        item.checkbox,
                        "change",
                        function () {

                            syncLegacyCapabilityFields();

                            syncCreditPreview();

                        }
                    );


                    resolutionContainer.appendChild(
                        item.wrapper
                    );

                }
            );

        }


        /*
         * Sinkronisasi field lama.
         *
         * Pada mode create, tidak ada selection
         * buatan sehingga field tetap kosong.
         */

        syncLegacyCapabilityFields();


        /*
         * HANYA sinkron duration jika checkbox
         * memang sudah memiliki selection.
         *
         * Ini mencegah render kosong menghapus
         * min/max yang baru saja diisi dari Supabase.
         */

        const durationChecked =
            getCheckedCapabilityValues(
                "duration"
            );


        if (
            durationChecked.length
        ) {

            syncDurationFields();

        }


        /* =================================================
           EMPTY STATE
           ================================================= */

        if (
            !capabilities.ratios.length &&
            ratioContainer
        ) {

            ratioContainer.innerHTML =
                "<span style=\"opacity:.65\">Tidak tersedia dari konfigurasi KIE.</span>";

        }


        if (
            !capabilities.durations.length &&
            durationContainer
        ) {

            durationContainer.innerHTML =
                "<span style=\"opacity:.65\">Tidak tersedia dari konfigurasi KIE.</span>";

        }


        if (
            !capabilities.resolutions.length &&
            resolutionContainer
        ) {

            resolutionContainer.innerHTML =
                "<span style=\"opacity:.65\">Tidak tersedia dari konfigurasi KIE.</span>";

        }


        return true;

    }


    /* =====================================================
       PRICE
    ===================================================== */

    function getPricingUnitPrice(
        pricing
    ) {

        if (
            !Array.isArray(
                pricing
            )
        ) {

            return null;

        }


        const valid =
            pricing.filter(
                function (item) {

                    const value =
                        toNumber(
                            item?.unit_price,
                            NaN
                        );


                    if (
                        !Number.isFinite(
                            value
                        )
                    ) {

                        return false;

                    }


                    const currency =
                        normalize(
                            item?.currency
                        );


                    return (
                        !currency ||
                        currency === "usd" ||
                        currency === "$"
                    );

                }
            );


        if (!valid.length) {

            return null;

        }


        const prices =
            uniqueValues(
                valid.map(
                    item =>
                        String(
                            item.unit_price
                        )
                )
            );


        if (
            prices.length !== 1
        ) {

            return null;

        }


        return toNumber(
            valid[0].unit_price,
            null
        );

    }


    function setKiePricingStatus(
        message
    ) {

        const element =
            getElement(
                "kiePricingStatusHint"
            );


        if (element) {

            element.textContent =
                message || "";

        }

    }


    function clearKiePrice() {

        const field =
            getElement(
                "kieUnitPrice"
            );


        if (field) {

            field.value =
                "";

            field.readOnly =
                true;

            field.disabled =
                false;

            field.dataset.kieManaged =
                "true";

        }


        setKiePricingStatus(
            "Harga KIE belum tersedia dari konfigurasi Supabase."
        );


        updateUsdPreview();

    }


    function loadModelUsdPrice(
        model
    ) {

        const field =
            getElement(
                "kieUnitPrice"
            );


        if (!field) {

            return null;

        }


        field.readOnly =
            true;

        field.dataset.kieManaged =
            "true";


        if (!currentKieConfig) {

            clearKiePrice();

            return null;

        }


        const usd =
            getPricingUnitPrice(
                currentPricing
            );


        if (
            usd === null
        ) {

            field.value =
                "";


            const validPricingCount =
                Array.isArray(
                    currentPricing
                )
                    ? currentPricing.length
                    : 0;


            if (
                validPricingCount > 1
            ) {

                setKiePricingStatus(
                    "Terdapat beberapa harga KIE untuk konfigurasi ini. Harga tidak dipilih otomatis."
                );

            } else {

                setKiePricingStatus(
                    "Harga KIE tidak tersedia dalam kie_pricing."
                );

            }


            updateUsdPreview();


            return null;

        }


        field.value =
            usd;


        setKiePricingStatus(
            "Harga KIE berasal dari kie_pricing dan bersifat readonly."
        );


        updateUsdPreview();


        return usd;

    }


    /* =====================================================
       USD PREVIEW
    ===================================================== */

    function updateUsdPreview() {

        const field =
            getElement(
                "kieUnitPrice"
            );


        const usd =
            toNumber(
                field?.value,
                NaN
            );


        const rate =
            getUsdToIdrRate();


        const usdElement =
            getElement(
                "previewKieUsd"
            );


        const rateElement =
            getElement(
                "previewKieRate"
            );


        const idrElement =
            getElement(
                "previewKieIdr"
            );


        if (usdElement) {

            usdElement.textContent =
                Number.isFinite(
                    usd
                )
                    ? formatUsd(
                        usd
                    )
                    : "-";

        }


        if (rateElement) {

            rateElement.textContent =
                rate !== null
                    ? "$1 = " +
                        formatIdr(
                            rate
                        )
                    : "Kurs belum tersedia";

        }


        if (idrElement) {

            idrElement.textContent =
                (
                    Number.isFinite(
                        usd
                    ) &&
                    rate !== null
                )
                    ? formatIdr(
                        usd * rate
                    )
                    : "-";

        }


        return {

            usd:
                Number.isFinite(
                    usd
                )
                    ? usd
                    : null,

            rate,

            idr:
                (
                    Number.isFinite(
                        usd
                    ) &&
                    rate !== null
                )
                    ? usd * rate
                    : null

        };

    }


    /* =====================================================
       USD EVENTS
    ===================================================== */

    function bindUsdPriceEvents() {

        if (
            boundUsdPriceEvents
        ) {

            return true;

        }


        const field =
            getElement(
                "kieUnitPrice"
            );


        if (!field) {

            return false;

        }


        function handler() {

            updateUsdPreview();

        }


        field.addEventListener(
            "input",
            handler
        );


        field.addEventListener(
            "change",
            handler
        );


        field.__genzUsdPriceHandler =
            handler;


        field.readOnly =
            true;


        boundUsdPriceEvents =
            true;


        updateUsdPreview();


        return true;

    }


    /* =====================================================
       SET MODEL
    ===================================================== */

    async function setModel(
        model
    ) {

        if (!model) {

            clearModelSelection();

            return false;

        }


        const modelId =
            String(
                model.model_id ||
                model.modelId ||
                ""
            ).trim();


        if (!modelId) {

            return false;

        }


        pendingModelId =
            modelId;


        const modelProvider =
            String(
                model.provider_id ||
                model.provider ||
                model.provider_code ||
                ""
            ).trim();


        if (modelProvider) {

            pendingProviderId =
                modelProvider;

        }


        const existing =
            findModel(
                modelId
            );


        if (!existing) {

            modelCache.push(
                model
            );

        }


        /* =================================================
           SELECT
           ================================================= */

        const select =
            getModelSelect();


        if (select) {

            const exists =
                Array.from(
                    select.options
                ).some(
                    function (option) {

                        return (
                            normalize(
                                option.value
                            ) ===
                            normalize(
                                modelId
                            )
                        );

                    }
                );


            if (!exists) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    modelId;


                option.textContent =
                    modelId;


                select.appendChild(
                    option
                );

            }


            select.value =
                modelId;

        }


        /* =================================================
           HIDDEN MODEL ID
           ================================================= */

        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                modelId;

        }


        /* =================================================
           MODEL NAME
           ================================================= */

        const name =
            getElement(
                "modelName"
            );


        if (name) {

            name.value =
                model.model_name ||
                "";

            name.readOnly =
                true;

            name.dataset.kieManaged =
                "true";

        }


        /* =================================================
           MODEL FAMILY
           ================================================= */

        const family =
            getElement(
                "modelFamily"
            );


        if (family) {

            family.value =
                model.model_family ||
                "";

            family.readOnly =
                true;

            family.dataset.kieManaged =
                "true";

        }


        /* =================================================
           KIE CONFIG
           ================================================= */

        const config =
            await loadKieConfig(
                modelId
            );


        if (
            config
        ) {

            renderCapabilities();

            loadModelUsdPrice(
                model
            );

        } else {

            clearKieConfigState();

        }


        syncCreditPreview();


        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-form-model-selected",
                    {
                        detail: {

                            model,

                            kieConfig:
                                currentKieConfig

                        }
                    }
                )
            );

        } catch {

            /* ignore */

        }


        return true;

    }


    /* =====================================================
       HANDLE MODEL CHANGE
    ===================================================== */

    async function handleModelChange() {

        const select =
            getModelSelect();


        if (!select) {

            return false;

        }


        const modelId =
            String(
                select.value ?? ""
            ).trim();


        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                modelId;

        }


        if (!modelId) {

            clearModelSelection(
                {
                    keepPending:
                        false
                }
            );


            return true;

        }


        const model =
            findModel(
                modelId
            );


        if (!model) {

            console.warn(
                "[GEN-Z.AI] Model ID tidak ditemukan:",
                modelId
            );


            return false;

        }


        return await setModel(
            model
        );

    }


    /* =====================================================
       BIND MODEL EVENT
    ===================================================== */

    function bindModelEvent() {

        if (
            boundModelEvent
        ) {

            return true;

        }


        const select =
            getModelSelect();


        if (!select) {

            return false;

        }


        select.addEventListener(
            "change",
            handleModelChange
        );


        select.__genzModelSelectHandler =
            handleModelChange;


        boundModelEvent =
            true;


        return true;

    }


    /* =====================================================
       PROVIDER CHANGE
    ===================================================== */

    async function handleProviderChange() {

        const provider =
            getElement(
                "providerId"
            );


        const providerId =
            String(
                provider?.value ?? ""
            ).trim();


        pendingProviderId =
            providerId;


        clearPendingModelId();

        clearKieConfigState();


        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                "";

        }


        const select =
            getModelSelect();


        if (select) {

            select.innerHTML =
                "";


            const placeholder =
                document.createElement(
                    "option"
                );


            placeholder.value =
                "";


            placeholder.textContent =
                providerId
                    ? "Memuat Model..."
                    : "Pilih Provider terlebih dahulu";


            placeholder.selected =
                true;


            select.appendChild(
                placeholder
            );


            select.disabled =
                !providerId;

        }


        await loadActiveModels(
            {
                providerId
            }
        );


        populateModelSelect(
            {
                providerId
            }
        );


        updateUsdPreview();

        syncCreditPreview();


        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-provider-models-loaded",
                    {
                        detail: {

                            providerId,

                            models:
                                getModelsForProvider(
                                    providerId
                                )

                        }
                    }
                )
            );

        } catch {

            /* ignore */

        }


        return true;

    }


    /* =====================================================
       BIND PROVIDER EVENT
    ===================================================== */

    function bindProviderEvent() {

        if (
            boundProviderEvent
        ) {

            return true;

        }


        const provider =
            getElement(
                "providerId"
            );


        if (!provider) {

            return false;

        }


        provider.addEventListener(
            "change",
            handleProviderChange
        );


        provider.__genzModelProviderHandler =
            handleProviderChange;


        boundProviderEvent =
            true;


        return true;

    }


    /* =====================================================
       CLEAR MODEL
    ===================================================== */

    function clearModelSelection(
        options = {}
    ) {

        const select =
            getModelSelect();


        if (select) {

            select.value =
                "";

        }


        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                "";

        }


        const name =
            getElement(
                "modelName"
            );


        if (name) {

            name.value =
                "";

            name.readOnly =
                true;

        }


        const family =
            getElement(
                "modelFamily"
            );


        if (family) {

            family.value =
                "";

            family.readOnly =
                true;

        }


        if (
            options.keepPending !== true
        ) {

            clearPendingModelId();

        }


        clearKieConfigState();

        syncCreditPreview();


        return true;

    }


    /* =====================================================
       SYNC MODEL SEARCH VALUE
    ===================================================== */

    function syncModelSearchValue(
        modelId
    ) {

        const value =
            String(
                modelId ?? ""
            ).trim();


        const select =
            getModelSelect();


        if (select) {

            select.value =
                value;

        }


        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                value;

        }


        return true;

    }


    /* =====================================================
       CURRENT MODEL
    ===================================================== */

    function getCurrentModel() {

        const id =
            getCurrentModelId();


        if (!id) {

            return null;

        }


        return findModel(
            id
        );

    }


    /* =====================================================
       UPDATE SELECTED MODEL INFO
    ===================================================== */

    async function updateSelectedModelInfo(
        model
    ) {

        if (!model) {

            return clearModelSelection();

        }


        return await setModel(
            model
        );

    }


    /* =====================================================
       CREDIT PREVIEW
    ===================================================== */

    function syncCreditPreview() {

        const calculation =
            window.GENZModelPriceCalculation;


        if (
            calculation &&
            typeof calculation.syncForm ===
                "function"
        ) {

            try {

                return calculation.syncForm();

            } catch (error) {

                console.warn(
                    "[model-form-layout] Credit calculation error:",
                    error
                );

            }

        }


        return null;

    }


    /* =====================================================
       REFRESH
       -----------------------------------------------------
       Satu jalur loading:
           models
             ->
           select
             ->
           model
             ->
           KIE config
             ->
           capability
             ->
           pricing
    ===================================================== */

    async function refresh(
        options = {}
    ) {

        const providerId =
            String(
                options.providerId ??
                getCurrentProvider() ??
                pendingProviderId ??
                ""
            ).trim();


        const selectedModelId =
            String(
                options.selectedModelId ??
                pendingModelId ??
                getCurrentModelId() ??
                ""
            ).trim();


        if (providerId) {

            pendingProviderId =
                providerId;

        }


        if (selectedModelId) {

            pendingModelId =
                selectedModelId;

        }


        await loadActiveModels(
            {
                providerId,

                selectedModelId,

                force:
                    options.force === true
            }
        );


        populateModelSelect(
            {
                providerId,

                selectedModelId
            }
        );


        if (selectedModelId) {

            const model =
                findModel(
                    selectedModelId
                );


            if (model) {

                await setModel(
                    model
                );

            } else {

                clearKieConfigState();

            }

        } else {

            clearKieConfigState();

        }


        updateUsdPreview();

        syncCreditPreview();


        return true;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize(
        options = {}
    ) {

        getModelSelect();


        bindProviderEvent();

        bindModelEvent();

        bindUsdPriceEvents();


        const providerId =
            String(
                options.providerId ??
                getCurrentProvider() ??
                ""
            ).trim();


        if (providerId) {

            pendingProviderId =
                providerId;

        }


        const existingModelId =
            String(
                options.selectedModelId ??
                getCurrentModelId() ??
                ""
            ).trim();


        if (existingModelId) {

            pendingModelId =
                existingModelId;

        }


        if (
            initialized
        ) {

            if (
                providerId ||
                existingModelId
            ) {

                await refresh(
                    {
                        providerId,

                        selectedModelId:
                            existingModelId
                    }
                );

            }


            return true;

        }


        initialized =
            true;


        const modelName =
            getElement(
                "modelName"
            );


        if (modelName) {

            modelName.readOnly =
                true;

        }


        const modelFamily =
            getElement(
                "modelFamily"
            );


        if (modelFamily) {

            modelFamily.readOnly =
                true;

        }


        const kieUnitPrice =
            getElement(
                "kieUnitPrice"
            );


        if (kieUnitPrice) {

            kieUnitPrice.readOnly =
                true;

        }


        if (providerId) {

            await loadActiveModels(
                {
                    providerId,

                    selectedModelId:
                        existingModelId
                }
            );


            populateModelSelect(
                {
                    providerId,

                    selectedModelId:
                        existingModelId
                }
            );

        } else {

            populateModelSelect(
                {
                    providerId:
                        ""
                }
            );

        }


        if (existingModelId) {

            const model =
                findModel(
                    existingModelId
                );


            if (model) {

                await setModel(
                    model
                );

            } else {

                clearKieConfigState();

            }

        } else {

            clearKieConfigState();

        }


        updateUsdPreview();

        syncCreditPreview();


        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-form-layout-ready"
                )
            );

        } catch {

            /* ignore */

        }


        console.info(
            "[GEN-Z.AI] Model Form Layout initialized from Supabase/KIE."
        );


        return true;

    }


    /* =====================================================
       PROVIDER ID
    ===================================================== */

    function getCurrentProviderId() {

        return getCurrentProvider();

    }


    function clearPendingProviderId() {

        pendingProviderId =
            "";


        return true;

    }


    /* =====================================================
       RESET / UNBIND
    ===================================================== */

    function unbind() {

        const provider =
            getElement(
                "providerId"
            );


        if (
            provider &&
            provider.__genzModelProviderHandler
        ) {

            try {

                provider.removeEventListener(
                    "change",
                    provider.__genzModelProviderHandler
                );

            } catch {

                /* ignore */

            }


            delete provider.__genzModelProviderHandler;

        }


        const select =
            getElement(
                "modelCodeSearch"
            );


        if (
            select &&
            select.__genzModelSelectHandler
        ) {

            try {

                select.removeEventListener(
                    "change",
                    select.__genzModelSelectHandler
                );

            } catch {

                /* ignore */

            }


            delete select.__genzModelSelectHandler;

        }


        const price =
            getElement(
                "kieUnitPrice"
            );


        if (
            price &&
            price.__genzUsdPriceHandler
        ) {

            try {

                price.removeEventListener(
                    "input",
                    price.__genzUsdPriceHandler
                );

                price.removeEventListener(
                    "change",
                    price.__genzUsdPriceHandler
                );

            } catch {

                /* ignore */

            }


            delete price.__genzUsdPriceHandler;

        }


        unbindCapabilityEvents();


        boundProviderEvent =
            false;

        boundModelEvent =
            false;

        boundUsdPriceEvents =
            false;

        initialized =
            false;


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormLayout =
        Object.freeze({

            /*
             * Lifecycle
             */

            initialize,

            refresh,

            unbind,


            /*
             * Model catalog
             */

            loadActiveModels,

            getCachedModels,

            getModelsForProvider,

            populateModelSelect,

            findModel,

            findModelById,

            getCurrentModel,

            getCurrentModelId,

            getCurrentProviderId,


            /*
             * Pending state
             */

            getPendingModelId,

            getPendingProviderId,

            clearPendingModelId,

            clearPendingProviderId,


            /*
             * Model selection
             */

            clearModelSelection,

            setModel,

            updateSelectedModelInfo,

            syncModelSearchValue,


            /*
             * KIE configuration
             */

            loadKieConfig,

            getCurrentKieConfig,

            getCurrentParameters,

            getCurrentPricing,

            renderCapabilities,

            syncDurationFields,

            syncLegacyCapabilityFields,

            clearCapabilities:
                clearKieConfigState,


            /*
             * Price
             */

            updateUsdPreview,

            syncCreditPreview,

            loadModelUsdPrice,

            getUsdToIdrRate,

            formatUsd,

            formatIdr,


            /*
             * Provider / Model compatibility
             */

            modelMatchesProvider,

            handleModelChange,

            handleProviderChange

        });


    console.info(
        "[GEN-Z.AI] GENZModelFormLayout loaded: SUPABASE/KIE SOURCE OF TRUTH."
    );

})();
