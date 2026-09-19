/* =========================================================
   GEN-Z.AI
   MODEL FORM LAYOUT
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-layout.js

   TANGGUNG JAWAB:
   - Sinkron Provider -> Model Search
   - Sinkron Model terpilih -> Model Name
   - Sinkron Model terpilih -> Model Family
   - Harga USD
   - Konversi USD -> Rupiah
   - Preview harga
   - Delegasi Credit Calculation

   PENTING:
   ---------------------------------------------------------
   MODEL ID SEARCH SEPENUHNYA DIMILIKI OLEH:

   - GENZModelsSearch
   - GENZModelSearchEvents
   - GENZModelSearchDropdown
   - GENZModelSearchRender
   - GENZModelSearchSelect

   FILE INI TIDAK BOLEH:
   - Mengubah #modelCodeSearch menjadi SELECT
   - Menghapus #modelSearchResults
   - Membuat option Model ID
   - Mengambil alih event input Model ID
   - Membuat event change Model ID

   #modelCodeSearch HARUS TETAP <input>.
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    let modelCache = [];

    let boundProviderEvent = false;

    let boundUsdPriceEvents = false;

    let pendingModelId = "";

    let pendingProviderId = "";

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
       PROVIDER MODULE
    ===================================================== */

    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );

    }


    /* =====================================================
       PROVIDER DROPDOWN MODULE
    ===================================================== */

    function getProviderDropdown() {

        return (
            window.GENZModelProviderDropdown ||
            null
        );

    }


    /* =====================================================
       CURRENT PROVIDER
    ===================================================== */

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


    /* =====================================================
       CURRENT MODEL ID
       -----------------------------------------------------
       Prioritas:
       1. hidden #modelCode
       2. input #modelCodeSearch
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


        const input =
            getElement(
                "modelCodeSearch"
            );


        if (input) {

            return String(
                input.value ?? ""
            ).trim();

        }


        return "";

    }


    /* =====================================================
       SET PENDING MODEL
    ===================================================== */

    function setPendingModelId(modelId) {

        pendingModelId =
            String(
                modelId ?? ""
            ).trim();


        return pendingModelId;

    }


    /* =====================================================
       CLEAR PENDING MODEL
    ===================================================== */

    function clearPendingModelId() {

        pendingModelId =
            "";


        return true;

    }


    /* =====================================================
       RESOLVE PROVIDER
    ===================================================== */

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
       MODEL PROVIDER MATCH
    ===================================================== */

    function modelMatchesProvider(
        model,
        providerValue
    ) {

        const value =
            normalize(
                providerValue
            );


        /*
         * Jika Provider belum dipilih,
         * jangan menghilangkan model dari cache.
         */
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
         * Match berdasarkan identifier Provider.
         */
        if (selected) {

            const providerCandidates = [

                selected.id,

                selected.provider_id,

                selected.provider,

                selected.provider_name

            ];


            return candidates.some(
                function (candidate) {

                    return providerCandidates.some(
                        function (
                            providerCandidate
                        ) {

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
       IMPORTANT MODEL SEARCH INPUT
       -----------------------------------------------------
       Fungsi ini HANYA memastikan input masih ada.

       TIDAK:
       - membuat SELECT
       - mengganti element
       - menghapus dropdown
    ===================================================== */

    function getModelSearchInput() {

        const input =
            getElement(
                "modelCodeSearch"
            );


        if (!input) {

            return null;

        }


        /*
         * Jika ada kode lama/HTML lain yang mengubah
         * menjadi SELECT, jangan kita ubah lagi di sini.
         *
         * Search module adalah pemilik element tersebut.
         */
        return input;

    }


    /* =====================================================
       MODEL SEARCH SYNC
       -----------------------------------------------------
       Sinkron hidden field dengan input Search.
    ===================================================== */

    function syncModelSearchValue(
        modelId
    ) {

        const value =
            String(
                modelId ?? ""
            ).trim();


        const input =
            getModelSearchInput();


        if (input) {

            /*
             * Hanya isi jika memang ada nilai.
             * Jangan menghapus input user ketika search
             * sedang berjalan.
             */
            if (value) {

                input.value =
                    value;

            }

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
       CACHE
    ===================================================== */

    function getCachedModels() {

        return [
            ...modelCache
        ];

    }


    /* =====================================================
       ACTIVE MODEL
    ===================================================== */

    function isActiveModel(
        model
    ) {

        const status =
            normalize(
                model?.status
            );


        /*
         * Beberapa data lama mungkin tidak memiliki status.
         *
         * Jangan membuang model hanya karena status kosong
         * apabila data tersebut berasal dari catalog KIE.
         */
        if (!status) {

            return true;

        }


        return (
            status === "active" ||
            status === "enabled"
        );

    }


    /* =====================================================
       LOAD ACTIVE MODELS
       -----------------------------------------------------
       Data dipakai untuk:
       - lookup model
       - auto-fill name
       - harga
       - edit state

       Data ini TIDAK lagi dipakai untuk membuat SELECT.
    ===================================================== */

    async function loadActiveModels(
        options = {}
    ) {

        const data =
            window.GENZModelsData;


        const requestedModelId =
            String(
                options.selectedModelId ??
                pendingModelId ??
                getCurrentModelId() ??
                ""
            ).trim();


        if (requestedModelId) {

            setPendingModelId(
                requestedModelId
            );

        }


        const requestedProviderId =
            String(
                options.providerId ??
                pendingProviderId ??
                getCurrentProvider() ??
                ""
            ).trim();


        if (requestedProviderId) {

            pendingProviderId =
                requestedProviderId;

        }


        if (
            !data ||
            typeof data.loadKieModels !==
                "function"
        ) {

            console.warn(
                "[model-form-layout] GENZModelsData belum tersedia."
            );


            return [
                ...modelCache
            ];

        }


        try {

            const models =
                await data.loadKieModels(
                    {
                        /*
                         * Ambil katalog aktif.
                         */
                        activeOnly:
                            true,

                        force:
                            options.force === true
                    }
                );


            const incoming =
                Array.isArray(
                    models
                )
                    ? models
                    : [];


            modelCache =
                incoming.filter(
                    isActiveModel
                );


            /*
             * Jika model edit belum masuk ke hasil aktif,
             * cari dari katalog tanpa activeOnly.
             */
            if (
                requestedModelId &&
                !findModel(
                    requestedModelId
                )
            ) {

                try {

                    const allModels =
                        await data.loadKieModels(
                            {
                                activeOnly:
                                    false,

                                force:
                                    false
                            }
                        );


                    if (
                        Array.isArray(
                            allModels
                        )
                    ) {

                        const editModel =
                            allModels.find(
                                function (model) {

                                    return (
                                        normalize(
                                            model?.model_id
                                        ) ===
                                        normalize(
                                            requestedModelId
                                        )
                                    );

                                }
                            );


                        if (editModel) {

                            modelCache.push(
                                editModel
                            );

                        }

                    }

                } catch (error) {

                    console.warn(
                        "[model-form-layout] Gagal mengambil fallback model:",
                        error
                    );

                }

            }


            return [
                ...modelCache
            ];

        } catch (error) {

            console.error(
                "[model-form-layout] Gagal memuat Model ID:",
                error
            );


            /*
             * Jangan menghancurkan cache lama jika request
             * gagal.
             */
            return [
                ...modelCache
            ];

        }

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


    /* =====================================================
       FIND MODEL BY ANY ID
    ===================================================== */

    function findModelById(
        modelId
    ) {

        return findModel(
            modelId
        );

    }


    /* =====================================================
       UPDATE SELECTED MODEL INFO
    ===================================================== */

    function updateSelectedModelInfo(
        model
    ) {

        const info =
            getElement(
                "selectedModelInfo"
            );


        if (!info) {

            return;

        }


        if (!model) {

            const provider =
                getCurrentProvider();


            info.textContent =
                provider
                    ? "Belum ada Model ID yang dipilih."
                    : "Pilih Provider terlebih dahulu.";


            return;

        }


        const modelName =
            String(
                model.model_name ||
                ""
            ).trim();


        const modelId =
            String(
                model.model_id ||
                ""
            ).trim();


        const family =
            String(
                model.model_family ||
                ""
            ).trim();


        const parts = [

            modelName,

            modelId,

            family

        ].filter(
            Boolean
        );


        info.textContent =
            parts.length
                ? parts.join(
                    " · "
                )
                : "Model dipilih.";

    }


    /* =====================================================
       PRICE MODULE
    ===================================================== */

    function getPriceModule() {

        return (
            window.GENZModelsPrice ||
            null
        );

    }


    /* =====================================================
       GET MODEL USD PRICE
    ===================================================== */

    function getModelUsdPrice(
        model
    ) {

        const priceModule =
            getPriceModule();


        if (
            !priceModule ||
            typeof priceModule.getModelPrice !==
                "function"
        ) {

            return null;

        }


        try {

            const result =
                priceModule.getModelPrice(
                    model
                );


            if (!result) {

                return null;

            }


            const usd =
                toNumber(
                    result.usd,
                    NaN
                );


            if (
                !Number.isFinite(
                    usd
                )
            ) {

                return null;

            }


            return usd;

        } catch (error) {

            console.warn(
                "[model-form-layout] Gagal mengambil harga model:",
                error
            );


            return null;

        }

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


        if (usd !== null) {

            field.value =
                usd;


            updateUsdPreview();


            return;

        }


        /*
         * Fallback metadata.
         */
        const metadata =
            model?.metadata;


        const fallback =
            metadata?.price_usd ??
            metadata?.usd_price ??
            metadata?.unit_price ??
            metadata?.price ??
            model?.price_usd ??
            model?.unit_price ??
            null;


        if (
            fallback !== null &&
            fallback !== undefined &&
            fallback !== ""
        ) {

            field.value =
                fallback;

        }


        updateUsdPreview();

    }


    /* =====================================================
       UPDATE USD PREVIEW
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
       USD PRICE EVENTS
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
       PROVIDER CHANGE
       -----------------------------------------------------
       Provider berubah:
       - simpan Provider
       - kosongkan Model ID
       - minta Search melakukan refresh
       
       TIDAK:
       - membuat SELECT
       - mengisi OPTION
       - menghapus search dropdown
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
            async function () {

                const providerId =
                    String(
                        provider.value ||
                        ""
                    ).trim();


                pendingProviderId =
                    providerId;


                clearPendingModelId();


                /*
                 * Bersihkan Model ID melalui Search module
                 * jika tersedia.
                 */
                const search =
                    window.GENZModelsSearch;


                if (
                    search &&
                    typeof search.clearSelectedModelInfo ===
                        "function"
                ) {

                    try {

                        search.clearSelectedModelInfo();

                    } catch (error) {

                        console.warn(
                            "[model-form-layout] Search clear gagal:",
                            error
                        );

                    }

                }


                /*
                 * Hidden field.
                 */
                const hidden =
                    getElement(
                        "modelCode"
                    );


                if (hidden) {

                    hidden.value =
                        "";

                }


                /*
                 * Input Model ID.
                 *
                 * Hanya dikosongkan.
                 * Element TIDAK diganti.
                 */
                const input =
                    getModelSearchInput();


                if (input) {

                    input.value =
                        "";

                }


                updateSelectedModelInfo(
                    null
                );


                /*
                 * Minta Search melakukan refresh katalog
                 * berdasarkan Provider baru.
                 */
                if (
                    search &&
                    typeof search.refreshCatalog ===
                        "function"
                ) {

                    try {

                        await search.refreshCatalog(
                            {
                                providerId
                            }
                        );

                        return;

                    } catch (error) {

                        console.warn(
                            "[model-form-layout] Search catalog refresh gagal:",
                            error
                        );

                    }

                }


                /*
                 * Fallback hanya memuat cache.
                 */
                await loadActiveModels(
                    {
                        providerId
                    }
                );

            }
        );


        boundProviderEvent =
            true;


        return true;

    }


    /* =====================================================
       SET MODEL
       -----------------------------------------------------
       Dipanggil oleh Edit/Search ketika Model sudah
       ditemukan.

       Tidak membuat SELECT.
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


        setPendingModelId(
            modelId
        );


        const providerId =
            String(
                getCurrentProvider() ||
                model.provider_id ||
                model.provider ||
                ""
            ).trim();


        if (providerId) {

            pendingProviderId =
                providerId;

        }


        /*
         * Simpan ke cache jika belum ada.
         */
        if (
            !findModel(
                modelId
            )
        ) {

            modelCache.push(
                model
            );

        }


        /*
         * Sinkron Input + Hidden.
         */
        syncModelSearchValue(
            modelId
        );


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
         * Family.
         */
        const family =
            getElement(
                "modelFamily"
            );


        if (
            family &&
            model.model_family
        ) {

            family.value =
                model.model_family;

        }


        updateSelectedModelInfo(
            model
        );


        loadModelUsdPrice(
            model
        );


        /*
         * Beri tahu module lain.
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
       GET CURRENT MODEL
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
       CLEAR MODEL SELECTION
    ===================================================== */

    function clearModelSelection(
        options = {}
    ) {

        const input =
            getModelSearchInput();


        if (input) {

            input.value =
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


        if (
            options.keepPending !== true
        ) {

            clearPendingModelId();

        }


        updateSelectedModelInfo(
            null
        );


        /*
         * Jangan memanggil Search.clear() secara agresif
         * karena event delegation Search sendiri mengatur
         * dropdown.
         */
        const search =
            window.GENZModelsSearch;


        if (
            search &&
            typeof search.clearSelectedModelInfo ===
                "function"
        ) {

            try {

                search.clearSelectedModelInfo();

            } catch (error) {

                console.warn(
                    "[model-form-layout] Search clear info gagal:",
                    error
                );

            }

        }


        return true;

    }


    /* =====================================================
       REFRESH
       -----------------------------------------------------
       Refresh hanya memperbarui data catalog dan memberi
       tahu Search.

       TIDAK menyentuh DOM dropdown Model ID.
    ===================================================== */

    async function refresh(
        options = {}
    ) {

        const selectedModelId =
            String(
                options.selectedModelId ??
                pendingModelId ??
                getCurrentModelId() ??
                ""
            ).trim();


        if (selectedModelId) {

            pendingModelId =
                selectedModelId;

        }


        const providerId =
            String(
                options.providerId ??
                getCurrentProvider() ??
                pendingProviderId ??
                ""
            ).trim();


        if (providerId) {

            pendingProviderId =
                providerId;

        }


        /*
         * Muat catalog untuk kebutuhan lookup/harga.
         */
        await loadActiveModels(
            {
                selectedModelId,

                providerId,

                force:
                    options.force === true
            }
        );


        /*
         * Jangan populate SELECT.
         *
         * Search module adalah satu-satunya pemilik
         * hasil Model ID.
         */
        const search =
            window.GENZModelsSearch;


        if (
            search &&
            typeof search.setModels ===
                "function"
        ) {

            try {

                search.setModels(
                    modelCache
                );

            } catch (error) {

                console.warn(
                    "[model-form-layout] Search setModels gagal:",
                    error
                );

            }

        }


        /*
         * Jika sedang mempertahankan model Edit,
         * sinkronkan hidden field tanpa mengganti input.
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
                    "[model-form-layout] Credit calculation delegation gagal:",
                    error
                );

            }

        }


        return null;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize(
        options = {}
    ) {

        if (
            initialized
        ) {

            /*
             * Tetap lakukan refresh jika ada Provider
             * atau Model yang secara eksplisit diberikan.
             */
            if (
                options.providerId ||
                options.selectedModelId
            ) {

                await refresh(
                    options
                );

            }

            return true;

        }


        initialized =
            true;


        /*
         * Simpan state Edit.
         */
        if (
            options.selectedModelId
        ) {

            setPendingModelId(
                options.selectedModelId
            );

        } else {

            const existingModelId =
                getCurrentModelId();


            if (existingModelId) {

                setPendingModelId(
                    existingModelId
                );

            }

        }


        if (
            options.providerId
        ) {

            pendingProviderId =
                String(
                    options.providerId
                ).trim();

        }


        /*
         * Provider event.
         */
        bindProviderEvent();


        /*
         * PENTING:
         * Tidak ada ensureModelSelect().
         * Tidak ada penggantian INPUT menjadi SELECT.
         */
        getModelSearchInput();


        /*
         * Harga.
         */
        bindUsdPriceEvents();


        /*
         * Credit.
         */
        syncCreditPreview();


        /*
         * Load catalog.
         */
        await loadActiveModels(
            {
                selectedModelId:
                    pendingModelId,

                providerId:
                    pendingProviderId
            }
        );


        /*
         * Berikan catalog kepada Search.
         */
        const search =
            window.GENZModelsSearch;


        if (
            search &&
            typeof search.setModels ===
                "function"
        ) {

            try {

                search.setModels(
                    modelCache
                );

            } catch (error) {

                console.warn(
                    "[model-form-layout] Gagal sinkron Search:",
                    error
                );

            }

        }


        /*
         * Jika Edit Model sudah mempunyai model,
         * sinkronkan tanpa mengubah element input.
         */
        if (
            pendingModelId
        ) {

            const model =
                findModel(
                    pendingModelId
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
            "[GEN-Z.AI] Model Form Layout initialized."
        );


        return true;

    }


    /* =====================================================
       GET PENDING MODEL ID
    ===================================================== */

    function getPendingModelId() {

        return pendingModelId;

    }


    /* =====================================================
       GET PENDING PROVIDER ID
    ===================================================== */

    function getPendingProviderId() {

        return pendingProviderId;

    }


    /* =====================================================
       GET PROVIDER
    ===================================================== */

    function getCurrentProviderId() {

        return getCurrentProvider();

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

            findModel,

            findModelById,

            getCurrentModel,

            getCurrentModelId,

            getCurrentProviderId,

            getPendingModelId,

            getPendingProviderId,

            clearPendingModelId,

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

            modelMatchesProvider

        });


    console.info(
        "[GEN-Z.AI] GENZModelFormLayout module loaded."
    );

})();
