/* =========================================================
   GEN-Z.AI
   MODEL FORM LAYOUT
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-layout.js

   TANGGUNG JAWAB:
   - Provider aktif
   - Model ID aktif
   - Filter Model ID berdasarkan Provider
   - Sinkron Model ID -> Model Name
   - Harga USD
   - Konversi USD -> Rupiah
   - Menampilkan preview harga

   PERBAIKAN:
   - Memperbaiki syntax error provider resolution
   - Menjaga Model ID saat refresh async
   - Menjaga Model ID saat Edit Model
   - Menangani perbedaan identifier Provider
   - Menghindari Model ID hilang saat loadActiveModels()
   - Menghindari refresh menghapus pilihan edit
   - Mendukung model yang belum ada di cache
   - Sinkron hidden #modelCode
   - Tetap kompatibel dengan module lama

   TIDAK menangani:
   - CRUD
   - Save
   - Update
   - Delete
   - Provider lifecycle
   - Search global
   - Table
   - Perhitungan Credit

   PERHITUNGAN CREDIT SEPENUHNYA DIMILIKI:
   GENZModelPriceCalculation
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

    /*
     * Model yang sedang dipertahankan selama proses
     * asynchronous load / refresh.
     *
     * Ini penting untuk Edit Model.
     */
    let pendingModelId = "";

    /*
     * Provider yang sedang dipertahankan selama refresh.
     */
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
    ===================================================== */

    function getCurrentModelId() {

        const hidden =
            getElement(
                "modelCode"
            );

        if (
            hidden &&
            String(hidden.value ?? "").trim()
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
       SET PENDING MODEL
    ===================================================== */

    function setPendingModelId(modelId) {

        const value =
            String(
                modelId ?? ""
            ).trim();

        pendingModelId =
            value;

        return value;
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

        /*
         * Provider module adalah sumber utama.
         */
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

        /*
         * Fallback ke Provider Dropdown.
         */
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

                /*
                 * FIX:
                 * Sebelumnya terdapat syntax error:
                 *
                 * if (Array.isArray(providers)
                 *
                 * Sekarang benar.
                 */
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
         * jangan menyembunyikan model.
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
         * Match berdasarkan seluruh
         * identifier Provider.
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
       MODEL SELECT
    ===================================================== */

    function getModelSelect() {

        const existing =
            getElement(
                "modelCodeSearch"
            );

        if (
            existing &&
            existing.tagName === "SELECT"
        ) {
            return existing;
        }

        return null;
    }


    /* =====================================================
       ENSURE MODEL SELECT
    ===================================================== */

    function ensureModelSelect() {

        const current =
            getElement(
                "modelCodeSearch"
            );

        if (!current) {
            return null;
        }

        if (
            current.tagName === "SELECT"
        ) {
            return current;
        }


        const select =
            document.createElement(
                "select"
            );


        select.id =
            "modelCodeSearch";


        select.name =
            "modelCodeSearch";


        select.required =
            true;


        select.autocomplete =
            "off";


        select.className =
            current.className || "";


        select.setAttribute(
            "aria-label",
            "Pilih Model ID aktif"
        );


        if (
            current.getAttribute(
                "style"
            )
        ) {

            select.setAttribute(
                "style",
                current.getAttribute(
                    "style"
                )
            );
        }


        current.replaceWith(
            select
        );


        const resultBox =
            getElement(
                "modelSearchResults"
            );


        if (resultBox) {

            resultBox.innerHTML =
                "";

            resultBox.style.display =
                "none";
        }


        return select;
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
         * Model aktif adalah status active.
         *
         * Jika status kosong pada model yang sedang
         * diedit, jangan langsung menganggapnya aktif
         * di sini. Database normal tetap menyediakan status.
         */
        return (
            status ===
            "active"
        );
    }


    /* =====================================================
       LOAD ACTIVE MODELS
    ===================================================== */

    async function loadActiveModels(
        options = {}
    ) {

        const data =
            window.GENZModelsData;


        /*
         * Simpan pilihan model sebelum request async.
         *
         * Ini inti perbaikan Edit Model.
         */
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

            modelCache =
                [];

            populateModelSelect(
                requestedModelId
            );

            return [];
        }


        try {

            const models =
                await data.loadKieModels(
                    {
                        activeOnly:
                            true,

                        force:
                            options.force === true
                    }
                );


            modelCache =
                Array.isArray(
                    models
                )
                    ? models.filter(
                        isActiveModel
                    )
                    : [];


            /*
             * Jika model yang sedang diedit tidak masuk
             * ke hasil active list tetapi model object
             * masih tersedia di cache sebelumnya,
             * pertahankan model tersebut.
             */
            if (
                requestedModelId &&
                !findModel(
                    requestedModelId
                )
            ) {

                const previousModel =
                    modelCache.find(
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

                if (previousModel) {

                    modelCache.push(
                        previousModel
                    );
                }
            }


            populateModelSelect(
                requestedModelId
            );


            /*
             * Pastikan pilihan edit dipulihkan setelah
             * seluruh option selesai dibuat.
             */
            if (requestedModelId) {

                restoreModelSelection(
                    requestedModelId
                );
            }


            return [
                ...modelCache
            ];

        } catch (error) {

            console.error(
                "[model-form-layout] Gagal memuat Model ID aktif:",
                error
            );


            /*
             * Jangan langsung menghapus cache lama
             * apabila sedang Edit Model.
             */
            if (
                modelCache.length === 0
            ) {

                modelCache =
                    [];
            }


            populateModelSelect(
                requestedModelId
            );


            if (requestedModelId) {

                restoreModelSelection(
                    requestedModelId
                );
            }


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
       CREATE MODEL OPTION
    ===================================================== */

    function createModelOption(
        model
    ) {

        const option =
            document.createElement(
                "option"
            );


        const modelId =
            String(
                model?.model_id ||
                ""
            ).trim();


        const modelName =
            String(
                model?.model_name ||
                ""
            ).trim();


        option.value =
            modelId;


        option.textContent =
            modelName
                ? (
                    modelId +
                    " — " +
                    modelName
                )
                : modelId;


        option.dataset.modelId =
            modelId;


        option.dataset.modelName =
            modelName;


        option.dataset.provider =
            String(
                model?.provider ||
                ""
            ).trim();


        option.dataset.providerId =
            String(
                model?.provider_id ||
                ""
            ).trim();


        option.dataset.providerUuid =
            String(
                model?.provider_uuid ||
                ""
            ).trim();


        option.dataset.family =
            String(
                model?.model_family ||
                ""
            ).trim();


        return option;
    }


    /* =====================================================
       RESTORE MODEL SELECTION
    ===================================================== */

    function restoreModelSelection(
        modelId
    ) {

        const select =
            getModelSelect();

        const id =
            String(
                modelId ?? ""
            ).trim();

        if (
            !select ||
            !id
        ) {
            return false;
        }


        const option =
            Array.from(
                select.options || []
            ).find(
                function (item) {

                    return (
                        normalize(
                            item.value
                        ) ===
                        normalize(
                            id
                        )
                    );
                }
            );


        if (!option) {

            return false;
        }


        select.value =
            option.value;


        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                option.value;
        }


        const model =
            findModel(
                option.value
            );


        if (model) {

            updateSelectedModelInfo(
                model
            );
        }


        return true;
    }


    /* =====================================================
       POPULATE MODEL SELECT
    ===================================================== */

    function populateModelSelect(
        selectedModelId = ""
    ) {

        const select =
            getModelSelect();


        if (!select) {
            return false;
        }


        const providerValue =
            getCurrentProvider();


        /*
         * Prioritas selection:
         *
         * 1. selectedModelId argument
         * 2. pendingModelId
         * 3. current select value
         * 4. hidden modelCode
         */
        const previous =
            String(
                selectedModelId ||
                pendingModelId ||
                select.value ||
                getCurrentModelId() ||
                ""
            ).trim();


        if (previous) {

            pendingModelId =
                previous;
        }


        const filtered =
            modelCache
                .filter(
                    isActiveModel
                )
                .filter(
                    function (model) {

                        return modelMatchesProvider(
                            model,
                            providerValue
                        );
                    }
                );


        select.innerHTML =
            "";


        const placeholder =
            document.createElement(
                "option"
            );


        placeholder.value =
            "";


        if (!providerValue) {

            placeholder.textContent =
                "Pilih Provider terlebih dahulu";

        } else if (
            filtered.length === 0
        ) {

            placeholder.textContent =
                "Tidak ada Model ID aktif";

        } else {

            placeholder.textContent =
                "Pilih Model ID aktif";
        }


        select.appendChild(
            placeholder
        );


        filtered.forEach(
            function (model) {

                select.appendChild(
                    createModelOption(
                        model
                    )
                );
            }
        );


        /*
         * Restore selection.
         */
        if (
            previous &&
            filtered.some(
                function (model) {

                    return (
                        normalize(
                            model.model_id
                        ) ===
                        normalize(
                            previous
                        )
                    );
                }
            )
        ) {

            select.value =
                previous;

            pendingModelId =
                previous;

        } else {

            /*
             * Jangan kehilangan pending Model ID
             * hanya karena provider/model list sedang
             * melakukan refresh.
             *
             * Jika model belum tersedia, biarkan pending
             * tetap tersimpan.
             */
            select.value =
                "";
        }


        /*
         * Hidden field selalu mengikuti SELECT.
         */
        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                select.value ||
                (
                    filtered.some(
                        function (model) {

                            return (
                                normalize(
                                    model.model_id
                                ) ===
                                normalize(
                                    previous
                                )
                            );
                        }
                    )
                        ? previous
                        : ""
                );
        }


        const selectedModel =
            findModel(
                select.value ||
                (
                    hidden?.value ||
                    ""
                )
            );


        updateSelectedModelInfo(
            selectedModel
        );


        return true;
    }


    /* =====================================================
       MODEL SELECTION
    ===================================================== */

    function handleModelSelection() {

        const select =
            getModelSelect();


        if (!select) {
            return;
        }


        const selectedId =
            String(
                select.value || ""
            ).trim();


        if (selectedId) {

            pendingModelId =
                selectedId;

        } else {

            clearPendingModelId();
        }


        const model =
            findModel(
                selectedId
            );


        const hidden =
            getElement(
                "modelCode"
            );


        if (hidden) {

            hidden.value =
                selectedId;
        }


        if (!model) {

            updateSelectedModelInfo(
                null
            );

            return;
        }


        /*
         * Model Name otomatis.
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
         * Family optional.
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
    }


    /* =====================================================
       SELECTED MODEL INFO
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
            parts.length > 0
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


        if (
            usd !== null
        ) {

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
       PROVIDER EVENT
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


                /*
                 * Provider benar-benar berubah.
                 * Model lama harus dikosongkan.
                 */
                pendingProviderId =
                    providerId;


                clearPendingModelId();


                const select =
                    ensureModelSelect();


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


                updateSelectedModelInfo(
                    null
                );


                /*
                 * Gunakan cache apabila ada.
                 */
                if (
                    modelCache.length ===
                    0
                ) {

                    await loadActiveModels(
                        {
                            providerId
                        }
                    );

                } else {

                    populateModelSelect();
                }
            }
        );


        boundProviderEvent =
            true;


        return true;
    }


    /* =====================================================
       MODEL EVENT
    ===================================================== */

    function bindModelEvent() {

        const select =
            ensureModelSelect();


        if (!select) {
            return false;
        }


        if (
            boundModelEvent
        ) {
            return true;
        }


        select.addEventListener(
            "change",
            handleModelSelection
        );


        boundModelEvent =
            true;


        return true;
    }


    /* =====================================================
       OLD SEARCH COMPATIBILITY
    ===================================================== */

    function disableOldSearchBehavior() {

        const resultBox =
            getElement(
                "modelSearchResults"
            );


        if (resultBox) {

            resultBox.innerHTML =
                "";

            resultBox.style.display =
                "none";
        }
    }


    /* =====================================================
       CREDIT PREVIEW DELEGATION
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
            return true;
        }


        initialized =
            true;


        /*
         * Simpan model/provider yang mungkin sudah
         * diisi oleh Edit Form sebelum layout selesai.
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
         * Provider.
         */
        bindProviderEvent();


        /*
         * Model ID.
         */
        ensureModelSelect();

        bindModelEvent();


        /*
         * Search lama.
         */
        disableOldSearchBehavior();


        /*
         * USD pricing.
         */
        bindUsdPriceEvents();


        /*
         * Credit calculation.
         */
        syncCreditPreview();


        /*
         * Model aktif.
         *
         * Jangan kehilangan Model ID edit.
         */
        await loadActiveModels(
            {
                selectedModelId:
                    pendingModelId
            }
        );


        /*
         * Render berdasarkan Provider.
         */
        populateModelSelect(
            pendingModelId
        );


        /*
         * Restore sekali lagi setelah render.
         */
        if (
            pendingModelId
        ) {

            restoreModelSelection(
                pendingModelId
            );
        }


        /*
         * Preview.
         */
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
       REFRESH
    ===================================================== */

    async function refresh(
        options = {}
    ) {

        /*
         * PENTING:
         * refresh sebelumnya melakukan:
         *
         * await loadActiveModels();
         * populateModelSelect();
         *
         * sehingga pilihan Edit Model bisa hilang.
         *
         * Sekarang selection disimpan dulu.
         */
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


        await loadActiveModels(
            {
                selectedModelId:
                    selectedModelId,

                providerId:
                    providerId,

                force:
                    options.force === true
            }
        );


        populateModelSelect(
            selectedModelId
        );


        /*
         * Restore selection setelah populate.
         */
        if (
            selectedModelId
        ) {

            restoreModelSelection(
                selectedModelId
            );
        }


        updateUsdPreview();


        syncCreditPreview();


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


        /*
         * Hanya clear pending jika memang diminta.
         *
         * Default tetap clear karena fungsi ini
         * dipakai ketika Provider berubah atau form
         * sengaja di-reset.
         */
        if (
            options.keepPending !== true
        ) {

            clearPendingModelId();
        }


        updateSelectedModelInfo(
            null
        );


        return true;
    }


    /* =====================================================
       SET MODEL
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


        /*
         * Simpan terlebih dahulu.
         *
         * Jika loadActiveModels() berjalan setelah ini,
         * selection tidak akan hilang.
         */
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
         * Tambahkan model ke cache jika belum ada.
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
         * Pastikan SELECT tersedia.
         */
        const select =
            ensureModelSelect();


        if (!select) {
            return false;
        }


        /*
         * Render berdasarkan Provider.
         */
        populateModelSelect(
            modelId
        );


        /*
         * Pilih option.
         */
        const restored =
            restoreModelSelection(
                modelId
            );


        /*
         * Jika model tidak lolos filter Provider,
         * jangan memaksa value yang tidak tersedia.
         *
         * Namun hidden modelCode tetap disimpan untuk
         * menjaga state Edit Model sampai provider selesai
         * disinkronkan.
         */
        if (!restored) {

            select.value =
                "";


            const hidden =
                getElement(
                    "modelCode"
                );


            if (hidden) {

                hidden.value =
                    modelId;
            }
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


        return true;
    }


    /* =====================================================
       GET PENDING MODEL ID
    ===================================================== */

    function getPendingModelId() {

        return pendingModelId;
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
       PUBLIC API
    ===================================================== */

    window.GENZModelFormLayout =
        Object.freeze({

            initialize,

            refresh,

            loadActiveModels,

            getCachedModels,

            findModel,

            getCurrentModel,

            getPendingModelId,

            populateModelSelect,

            clearModelSelection,

            setModel,

            updateUsdPreview,

            syncCreditPreview,

            getUsdToIdrRate,

            formatUsd,

            formatIdr

        });


    console.info(
        "[GEN-Z.AI] GENZModelFormLayout module loaded."
    );

})();
