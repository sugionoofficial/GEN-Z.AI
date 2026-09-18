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
   - Credit Normal
   - Diskon
   - Credit Final
   - Preview harga

   TIDAK menangani:
   - CRUD
   - Save
   - Update
   - Delete
   - Provider lifecycle
   - Search global
   - Table

   Prinsip:
   Satu fungsi hanya mempunyai satu pemilik.
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

    let boundPriceEvents = false;

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
            toNumber(value, NaN);

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
            toNumber(value, NaN);

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
            getElement("providerId");

        if (!select) {
            return "";
        }

        return String(
            select.value ?? ""
        ).trim();
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

                if (
                    Array.isArray(
                        providers
                    )
                ) {
                    const normalized =
                        normalize(value);

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
                        ) === value
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

        /*
         * Pertahankan style inline
         * jika field lama memilikinya.
         */
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

        /*
         * Search result lama tidak digunakan
         * untuk dropdown Model ID aktif.
         */
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
        return (
            normalize(
                model?.status
            ) === "active"
        );
    }


    /* =====================================================
       LOAD ACTIVE MODELS
    ===================================================== */

    async function loadActiveModels() {
        const data =
            window.GENZModelsData;

        if (
            !data ||
            typeof data.loadKieModels !==
                "function"
        ) {
            console.warn(
                "[model-form-layout] GENZModelsData belum tersedia."
            );

            modelCache = [];

            populateModelSelect();

            return [];
        }

        try {
            const models =
                await data.loadKieModels(
                    {
                        activeOnly: true,
                        force: false
                    }
                );

            modelCache =
                Array.isArray(models)
                    ? models.filter(
                        isActiveModel
                    )
                    : [];

            populateModelSelect();

            return [
                ...modelCache
            ];
        } catch (error) {
            console.error(
                "[model-form-layout] Gagal memuat Model ID aktif:",
                error
            );

            modelCache = [];

            populateModelSelect();

            return [];
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
                        ) === id
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       CREATE OPTION
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

        const previous =
            String(
                selectedModelId ||
                select.value ||
                ""
            ).trim();

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
         * Pertahankan pilihan ketika
         * masih tersedia.
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
        } else {
            select.value =
                "";
        }

        /*
         * Hidden field untuk kompatibilitas
         * dengan CRUD lama.
         */
        const hidden =
            getElement(
                "modelCode"
            );

        if (hidden) {
            hidden.value =
                select.value || "";
        }

        updateSelectedModelInfo(
            findModel(
                select.value
            )
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

        const model =
            findModel(
                select.value
            );

        const hidden =
            getElement(
                "modelCode"
            );

        if (hidden) {
            hidden.value =
                select.value || "";
        }

        if (!model) {
            updateSelectedModelInfo(
                null
            );

            return;
        }

        /*
         * Model Name otomatis dari
         * catalog Model ID.
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
         * Family hanya diisi jika field
         * tersebut memang tersedia.
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
                ? parts.join(" · ")
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
         * Fallback apabila pricing catalog
         * belum mempunyai data.
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
       CREDIT CALCULATION
    ===================================================== */

    function calculateCredit() {
        const normalField =
            getElement(
                "creditCost"
            );

        const discountField =
            getElement(
                "discountPercent"
            );

        const normal =
            Math.max(
                0,
                toNumber(
                    normalField?.value,
                    0
                )
            );

        const discount =
            Math.min(
                100,
                Math.max(
                    0,
                    toNumber(
                        discountField?.value,
                        0
                    )
                )
            );

        const discountAmount =
            normal *
            discount /
            100;

        const finalCredit =
            normal -
            discountAmount;

        return {
            normal,
            discount,
            discountAmount,
            finalCredit
        };
    }


    /* =====================================================
       UPDATE CREDIT PREVIEW
    ===================================================== */

    function updateCreditPreview() {
        const result =
            calculateCredit();

        const normal =
            getElement(
                "previewNormal"
            );

        const discount =
            getElement(
                "previewDiscount"
            );

        const final =
            getElement(
                "previewFinal"
            );

        if (normal) {
            normal.textContent =
                String(
                    result.normal
                );
        }

        if (discount) {
            discount.textContent =
                Number(
                    result.discount.toFixed(
                        2
                    )
                ) +
                "%";
        }

        if (final) {
            final.textContent =
                String(
                    Number(
                        result.finalCredit.toFixed(
                            2
                        )
                    )
                );
        }

        /*
         * Field credit_final yang digunakan
         * oleh CRUD.
         */
        const finalField =
            getElement(
                "creditFinal"
            );

        if (finalField) {
            finalField.value =
                String(
                    Number(
                        result.finalCredit.toFixed(
                            2
                        )
                    )
                );
        }

        /*
         * Sinkronkan calculation module
         * jika tersedia.
         *
         * Tidak wajib, sehingga kegagalan
         * module ini tidak merusak form.
         */
        const calculation =
            window.GENZModelPriceCalculation;

        if (
            calculation &&
            typeof calculation.syncForm ===
                "function"
        ) {
            try {
                calculation.syncForm();
            } catch (error) {
                console.warn(
                    "[model-form-layout] Price calculation sync gagal:",
                    error
                );
            }
        }
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
       PRICE EVENTS
    ===================================================== */

    function bindPriceEvents() {
        if (
            boundPriceEvents
        ) {
            return true;
        }

        const fields = [
            "creditCost",
            "discountPercent",
            "kieUnitPrice"
        ];

        let found =
            false;

        fields.forEach(
            function (id) {
                const field =
                    getElement(id);

                if (!field) {
                    return;
                }

                found = true;

                field.addEventListener(
                    "input",
                    function () {
                        if (
                            id ===
                            "kieUnitPrice"
                        ) {
                            updateUsdPreview();
                        } else {
                            updateCreditPreview();
                        }
                    }
                );

                field.addEventListener(
                    "change",
                    function () {
                        if (
                            id ===
                            "kieUnitPrice"
                        ) {
                            updateUsdPreview();
                        } else {
                            updateCreditPreview();
                        }
                    }
                );
            }
        );

        boundPriceEvents =
            found;

        updateCreditPreview();

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
                /*
                 * Provider berubah.
                 *
                 * Model ID harus mengikuti
                 * Provider yang baru dipilih.
                 */
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
                 * Gunakan cache jika tersedia.
                 * Jika kosong, load terlebih dahulu.
                 */
                if (
                    modelCache.length === 0
                ) {
                    await loadActiveModels();
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
       INITIALIZE
    ===================================================== */

    async function initialize() {
        if (
            initialized
        ) {
            return true;
        }

        /*
         * Tandai initialized setelah struktur
         * function berhasil dipasang.
         */
        initialized =
            true;

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
         * Search lama hanya dinonaktifkan
         * pada visual result, bukan module
         * Search global.
         */
        disableOldSearchBehavior();

        /*
         * Pricing.
         */
        bindPriceEvents();

        /*
         * Model aktif.
         */
        await loadActiveModels();

        /*
         * Render ulang berdasarkan Provider
         * yang sedang aktif.
         */
        populateModelSelect();

        /*
         * Preview.
         */
        updateCreditPreview();

        updateUsdPreview();

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

    async function refresh() {
        await loadActiveModels();

        populateModelSelect();

        updateCreditPreview();

        updateUsdPreview();

        return true;
    }


    /* =====================================================
       CLEAR MODEL
    ===================================================== */

    function clearModelSelection() {
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

        const select =
            getModelSelect();

        if (!select) {
            return false;
        }

        const modelId =
            String(
                model.model_id ||
                ""
            ).trim();

        if (!modelId) {
            return false;
        }

        /*
         * Jika model belum ada di cache,
         * tambahkan sementara agar dapat
         * dipilih saat edit.
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
         * Render berdasarkan Provider.
         */
        populateModelSelect(
            modelId
        );

        /*
         * Jika option tersedia, pilih.
         */
        select.value =
            modelId;

        const hidden =
            getElement(
                "modelCode"
            );

        if (hidden) {
            hidden.value =
                modelId;
        }

        const name =
            getElement(
                "modelName"
            );

        if (name) {
            name.value =
                model.model_name ||
                "";
        }

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
       PUBLIC API
    ===================================================== */

    window.GENZModelFormLayout =
        Object.freeze({
            initialize,

            refresh,

            loadActiveModels,

            getCachedModels,

            findModel,

            populateModelSelect,

            clearModelSelection,

            setModel,

            updateCreditPreview,

            updateUsdPreview,

            calculateCredit,

            getUsdToIdrRate,

            formatUsd,

            formatIdr
        });


    console.info(
        "[GEN-Z.AI] GENZModelFormLayout module loaded."
    );

})();
