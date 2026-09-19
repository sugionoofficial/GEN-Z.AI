/* =========================================================
   GEN-Z.AI
   MODEL FORM LAYOUT
   ---------------------------------------------------------
   VERSI:
   MODEL SELECT / DROPDOWN

   TANGGUNG JAWAB:
   - Provider -> Model Select
   - Load Model dari GENZModelsData
   - Filter Model berdasarkan Provider
   - Filter Model aktif
   - Populate Model ID <select>
   - Pilih Model
   - Sinkron hidden #modelCode
   - Isi Model Name
   - Isi Model Family
   - Harga USD
   - Konversi USD -> IDR
   - Credit Preview

   CATATAN:
   ---------------------------------------------------------
   SISTEM PENCARIAN MODEL SUDAH TIDAK DIGUNAKAN.

   #modelCodeSearch:
       sekarang menjadi SELECT.

   #modelCode:
       tetap hidden untuk kompatibilitas CRUD.

   Tidak menggunakan:
       GENZModelsSearch
       GENZModelSearchEvents
       GENZModelSearchDropdown
       GENZModelSearchRender
       GENZModelSearchSelect

   Provider tetap dikelola oleh:
       GENZModelsProvider
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

    let pendingModelId = "";

    let pendingProviderId = "";

    let loadingPromise = null;

    const DEFAULT_USD_TO_IDR = 17700;


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getElement(id) {

        return document.getElementById(id);

    }


    /* =====================================================
       NORMALIZE
    ===================================================== */

    function normalize(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase();

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
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0
            }
        ).format(number);

    }


    /* =====================================================
       USD -> IDR RATE
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
                    "[model-form-layout] Gagal membaca kurs:",
                    error
                );

            }

        }


        return DEFAULT_USD_TO_IDR;

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

                    const normalized =
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
                                    provider?.provider_name
                                ].some(
                                    function (candidate) {

                                        return (
                                            normalize(
                                                candidate
                                            ) ===
                                            normalized
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


        /*
         * Direct match.
         */
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


        /*
         * Match terhadap seluruh identifier Provider.
         */
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


        /*
         * Jika status kosong, jangan membuang data.
         */
        if (!status) {

            return true;

        }


        return (
            status === "active" ||
            status === "enabled" ||
            status === "published"
        );

    }


    /* =====================================================
       MODEL SELECT
       -----------------------------------------------------
       SATU-SATUNYA PEMILIK SELECT MODEL.
    ===================================================== */

    function getModelSelect() {

        let element =
            getElement(
                "modelCodeSearch"
            );


        if (!element) {

            /*
             * Fallback jika HTML menggunakan modelCode.
             */
            element =
                getElement(
                    "modelCode"
                );

        }


        if (!element) {

            return null;

        }


        /*
         * Jika masih INPUT, ubah menjadi SELECT.
         *
         * Ini dilakukan sekali dan permanen untuk
         * lifecycle halaman.
         */
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


            /*
             * Salin atribut penting.
             */
            Array.from(
                element.attributes
            ).forEach(
                function (attribute) {

                    /*
                     * Jangan mempertahankan:
                     * type=search
                     */
                    if (
                        attribute.name ===
                        "type"
                    ) {

                        return;

                    }


                    /*
                     * Placeholder input tidak relevan
                     * pada SELECT.
                     */
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

                    } catch (error) {

                        /* ignore */

                    }

                }
            );


            select.id =
                "modelCodeSearch";


            select.removeAttribute(
                "type"
            );


            /*
             * SELECT wajib mempunyai nama yang sama
             * hanya jika sebelumnya ada.
             */
            if (
                element.name
            ) {

                select.name =
                    element.name;

            }


            /*
             * Pertahankan class.
             */
            if (
                element.className
            ) {

                select.className =
                    element.className;

            }


            /*
             * Ganti input lama.
             */
            element.replaceWith(
                select
            );


            element =
                select;

        }


        /*
         * Pastikan ID benar.
         */
        element.id =
            "modelCodeSearch";


        /*
         * SELECT wajib aktif.
         */
        element.disabled =
            false;


        return element;

    }


    /* =====================================================
       MODEL ID CURRENT VALUE
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


        if (
            select
        ) {

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


        /*
         * Hindari request bersamaan yang sama.
         */
        if (
            loadingPromise &&
            options.force !== true
        ) {

            try {

                return await loadingPromise;

            } catch (error) {

                /* request berikutnya boleh jalan */

            }

        }


        loadingPromise =
            (async function () {

                /*
                 * Ambil seluruh catalog.
                 *
                 * Filter ACTIVE dilakukan di sini
                 * agar perbedaan casing ACTIVE/active
                 * tidak menjadi masalah.
                 */
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


                /*
                 * Hanya model aktif.
                 */
                const activeModels =
                    incoming.filter(
                        isActiveModel
                    );


                /*
                 * Jangan filter cache permanen berdasarkan
                 * Provider. Cache harus menyimpan catalog.
                 */
                modelCache =
                    activeModels;


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
       FILTER MODEL FOR CURRENT PROVIDER
    ===================================================== */

    function getModelsForProvider(
        providerValue
    ) {

        const value =
            String(
                providerValue ?? ""
            ).trim();


        /*
         * Jika Provider belum dipilih,
         * jangan tampilkan semua model secara membabi buta.
         * Tampilkan kosong.
         */
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

            console.warn(
                "[GEN-Z.AI] #modelCodeSearch tidak ditemukan."
            );


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


        /*
         * Ambil model berdasarkan Provider.
         */
        const models =
            getModelsForProvider(
                providerId
            );


        /*
         * Reset options.
         */
        select.innerHTML =
            "";


        /*
         * Placeholder.
         */
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


        placeholder.disabled =
            false;


        placeholder.selected =
            true;


        select.appendChild(
            placeholder
        );


        /*
         * Sort berdasarkan Model ID.
         */
        models.sort(
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


        /*
         * Buat option.
         */
        models.forEach(
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


                /*
                 * Model ID adalah label utama.
                 */
                option.textContent =
                    modelId;


                /*
                 * Simpan metadata.
                 */
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
                    model?.provider
                ) {

                    option.dataset.provider =
                        String(
                            model.provider
                        );

                }


                select.appendChild(
                    option
                );

            }
        );


        /*
         * Pulihkan Model yang sebelumnya dipilih.
         */
        if (
            selectedModelId &&
            models.some(
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


        /*
         * Hidden field harus mengikuti SELECT.
         */
        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                select.value || "";

        }


        console.info(
            "[GEN-Z.AI] Model Select populated:",
            {
                provider:
                    providerId,
                total:
                    models.length
            }
        );


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
       MODEL USD PRICE
    ===================================================== */

    function getModelUsdPrice(
        model
    ) {

        if (!model) {

            return null;

        }


        const priceModule =
            window.GENZModelsPrice;


        if (
            priceModule &&
            typeof priceModule.getModelPrice ===
                "function"
        ) {

            try {

                const result =
                    priceModule.getModelPrice(
                        model
                    );


                if (result) {

                    const usd =
                        toNumber(
                            result.usd,
                            NaN
                        );


                    if (
                        Number.isFinite(
                            usd
                        )
                    ) {

                        return usd;

                    }

                }

            } catch (error) {

                console.warn(
                    "[model-form-layout] Gagal membaca harga model:",
                    error
                );

            }

        }


        const metadata =
            model?.metadata;


        const fallback =
            metadata?.price_usd ??
            metadata?.usd_price ??
            metadata?.unit_price ??
            model?.price_usd ??
            model?.unit_price ??
            null;


        const usd =
            toNumber(
                fallback,
                NaN
            );


        return Number.isFinite(
            usd
        )
            ? usd
            : null;

    }


    /* =====================================================
       LOAD MODEL USD PRICE
    ===================================================== */

    function loadModelUsdPrice(
        model
    ) {

        const field =
            getElement(
                "kieUnitPrice"
            );


        if (!field) {

            return;

        }


        const usd =
            getModelUsdPrice(
                model
            );


        if (
            usd !== null
        ) {

            field.value =
                usd;


            updateUsdPreview();


            return;

        }


        updateUsdPreview();

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
                "$1 = " +
                formatIdr(
                    rate
                );

        }


        if (idrElement) {

            idrElement.textContent =
                Number.isFinite(
                    usd
                )
                    ? formatIdr(
                        usd * rate
                    )
                    : "-";

        }

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


        boundUsdPriceEvents =
            true;


        updateUsdPreview();


        return true;

    }


    /* =====================================================
       SELECT MODEL
       ===================================================== */

    function setModel(
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


        /*
         * Simpan ke cache.
         */
        const existing =
            findModel(
                modelId
            );


        if (!existing) {

            modelCache.push(
                model
            );

        }


        /*
         * SELECT.
         */
        const select =
            getModelSelect();


        if (select) {

            /*
             * Pastikan option tersedia.
             */
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


        /*
         * Hidden Model ID.
         */
        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                modelId;

        }


        /*
         * Model Name.
         */
        const name =
            getElement(
                "modelName"
            );


        if (name) {

            name.value =
                model.model_name ||
                "";

        }


        /*
         * Model Family.
         */
        const family =
            getElement(
                "modelFamily"
            );


        if (family) {

            family.value =
                model.model_family ||
                "";

        }


        /*
         * Harga.
         */
        loadModelUsdPrice(
            model
        );


        /*
         * Credit.
         */
        syncCreditPreview();


        /*
         * Event internal.
         */
        document.dispatchEvent(
            new CustomEvent(
                "genz-model-form-model-selected",
                {
                    detail: {
                        model
                    }
                }
            )
        );


        return true;

    }


    /* =====================================================
       HANDLE MODEL CHANGE
       ===================================================== */

    function handleModelChange() {

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


        return setModel(
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


        /*
         * Clear Model field.
         */
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


        /*
         * Load catalog.
         */
        await loadActiveModels(
            {
                providerId
            }
        );


        /*
         * Populate sesuai Provider.
         */
        populateModelSelect(
            {
                providerId
            }
        );


        updateUsdPreview();

        syncCreditPreview();


        /*
         * Inform module lain.
         */
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

        }


        const family =
            getElement(
                "modelFamily"
            );


        if (family) {

            family.value =
                "";

        }


        if (
            options.keepPending !== true
        ) {

            clearPendingModelId();

        }


        const price =
            getElement(
                "kieUnitPrice"
            );


        if (price) {

            price.value =
                "";

        }


        updateUsdPreview();

        syncCreditPreview();


        return true;

    }


    /* =====================================================
       SYNC MODEL SEARCH VALUE
       -----------------------------------------------------
       Nama fungsi dipertahankan untuk kompatibilitas.
       Sekarang sebenarnya menyinkronkan SELECT.
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

    function updateSelectedModelInfo(
        model
    ) {

        if (!model) {

            return clearModelSelection();

        }


        return setModel(
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


        /*
         * Jika Edit memiliki Model ID,
         * isi seluruh field.
         */
        if (selectedModelId) {

            const model =
                findModel(
                    selectedModelId
                );


            if (model) {

                setModel(
                    model
                );

            }

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

        /*
         * Pastikan SELECT dibuat sebelum event dipasang.
         */
        getModelSelect();


        bindProviderEvent();

        bindModelEvent();

        bindUsdPriceEvents();


        /*
         * Simpan state.
         */
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


        /*
         * Jika sudah initialized, tetap refresh ketika
         * ada Provider / Model yang diberikan.
         */
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


        /*
         * Awal halaman:
         * jika Provider sudah terpilih, langsung
         * isi daftar Model.
         */
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
                    providerId: ""
                }
            );

        }


        /*
         * Restore Edit Model.
         */
        if (existingModelId) {

            const model =
                findModel(
                    existingModelId
                );


            if (model) {

                setModel(
                    model
                );

            }

        }


        updateUsdPreview();

        syncCreditPreview();


        document.dispatchEvent(
            new CustomEvent(
                "genz-model-form-layout-ready"
            )
        );


        console.info(
            "[GEN-Z.AI] Model Form Layout initialized as SELECT."
        );


        return true;

    }


    /* =====================================================
       LOAD MODEL CACHE
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
       PUBLIC API
    ===================================================== */

    window.GENZModelFormLayout =
        Object.freeze({

            initialize,

            refresh,

            loadActiveModels,

            getCachedModels,

            getModelsForProvider,

            populateModelSelect,

            findModel,

            findModelById,

            getCurrentModel,

            getCurrentModelId,

            getCurrentProviderId,

            getPendingModelId,

            getPendingProviderId,

            clearPendingModelId,

            clearPendingProviderId,

            clearModelSelection,

            setModel,

            updateSelectedModelInfo,

            syncModelSearchValue,

            updateUsdPreview,

            syncCreditPreview,

            loadModelUsdPrice,

            getUsdToIdrRate,

            formatUsd,

            formatIdr,

            modelMatchesProvider,

            handleModelChange,

            handleProviderChange

        });


    console.info(
        "[GEN-Z.AI] GENZModelFormLayout loaded: MODEL SELECT MODE."
    );

})();
