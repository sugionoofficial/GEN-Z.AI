/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL PRICE MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-price.js

   TANGGUNG JAWAB:
   - Membaca pricing dari GENZModelsData
   - Cache pricing model
   - Mencari pricing berdasarkan model
   - Kalkulasi credit
   - Format credit
   - Menyediakan compatibility API

   SUMBER DATA:
       models.credit_cost
       models.discount_percent
       models.credit_final

   RELASI:
       models
          ↓
       GENZModelsData
          ↓
       GENZModelsPrice

   TIDAK MENGGUNAKAN:
       kie_pricing
       kie_models
       kie_workflows
       kie_workflow_variants
       kie_parameters
       kie_constraints
       kie_dependencies

   TIDAK MENANGANI:
   - Provider CRUD
   - Model CRUD
   - Search
   - Save
   - Update
   - Delete
   - API KIE
   - Supabase query langsung
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let pricingCache = [];

    let initialized = false;

    let loadingPromise = null;


    /* =====================================================
       CONFIG
    ===================================================== */

    /*
     * Dipertahankan untuk compatibility API lama.
     *
     * Credit model TIDAK menggunakan kurs ini.
     */

    const DEFAULT_USD_IDR_RATE =
        17700;


    /* =====================================================
       MODEL DATA MODULE
       ===================================================== */

    function getModelsData() {

        return (
            window.GENZModelsData ||
            null
        );

    }


    /* =====================================================
       UTILITY
       ===================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    function toNumber(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;

        }


        const parsed =
            Number(
                String(
                    value
                )
                    .replace(
                        /,/g,
                        ""
                    )
                    .trim()
            );


        return Number.isFinite(
            parsed
        )
            ? parsed
            : null;

    }


    function normalizeString(
        value
    ) {

        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();

    }


    function normalizeArray(
        value
    ) {

        if (
            Array.isArray(
                value
            )
        ) {

            return [
                ...value
            ];

        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return [];

        }


        if (
            typeof value ===
            "string"
        ) {

            const text =
                value.trim();


            if (!text) {

                return [];

            }


            /*
             * JSON array.
             */

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

                    return parsed;

                }

            } catch (
                error
            ) {

                /* Bukan JSON. */

            }


            /*
             * PostgreSQL array:
             *
             * {16:9,9:16}
             */

            if (
                text.startsWith(
                    "{"
                ) &&
                text.endsWith(
                    "}"
                )
            ) {

                return text
                    .slice(
                        1,
                        -1
                    )
                    .split(",")
                    .map(
                        item =>
                            item
                                .trim()
                                .replace(
                                    /^"(.*)"$/,
                                    "$1"
                                )
                    )
                    .filter(
                        Boolean
                    );

            }


            /*
             * Comma separated.
             */

            return text
                .split(",")
                .map(
                    item =>
                        item.trim()
                )
                .filter(
                    Boolean
                );

        }


        return [];

    }


    /* =====================================================
       CREDIT CALCULATION
       ===================================================== */

    function calculateCreditFinal(
        creditCost,
        discountPercent
    ) {

        const cost =
            toNumber(
                creditCost
            );


        const discount =
            toNumber(
                discountPercent
            );


        if (
            cost === null
        ) {

            return null;

        }


        const safeCost =
            Math.max(
                0,
                cost
            );


        const safeDiscount =
            discount === null
                ? 0
                : Math.min(
                    100,
                    Math.max(
                        0,
                        discount
                    )
                );


        const result =
            safeCost *
            (
                1 -
                (
                    safeDiscount /
                    100
                )
            );


        return Number(
            result.toFixed(
                6
            )
        );

    }


    function calculateDiscountAmount(
        creditCost,
        discountPercent
    ) {

        const cost =
            toNumber(
                creditCost
            );


        const discount =
            toNumber(
                discountPercent
            );


        if (
            cost === null
        ) {

            return null;

        }


        const safeCost =
            Math.max(
                0,
                cost
            );


        const safeDiscount =
            discount === null
                ? 0
                : Math.min(
                    100,
                    Math.max(
                        0,
                        discount
                    )
                );


        return Number(
            (
                safeCost *
                (
                    safeDiscount /
                    100
                )
            ).toFixed(
                6
            )
        );

    }


    /* =====================================================
       NORMALIZE MODEL PRICING
       -----------------------------------------------------
       Satu record models = satu sumber pricing.
    ===================================================== */

    function normalizeModelPricing(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return null;

        }


        const creditCost =
            toNumber(
                model.credit_cost
            );


        const discountPercentRaw =
            toNumber(
                model.discount_percent
            );


        const discountPercent =
            discountPercentRaw === null
                ? 0
                : Math.min(
                    100,
                    Math.max(
                        0,
                        discountPercentRaw
                    )
                );


        const calculatedFinal =
            calculateCreditFinal(
                creditCost,
                discountPercent
            );


        /*
         * Jika database memiliki credit_final,
         * gunakan nilai database.
         *
         * Jika NULL/kosong, gunakan hasil kalkulasi.
         */

        const storedFinal =
            toNumber(
                model.credit_final
            );


        const creditFinal =
            storedFinal !== null
                ? storedFinal
                : calculatedFinal;


        return {

            id:
                model.id ??
                null,

            model_id:
                model.model_id ??
                "",

            model_name:
                model.model_name ??
                "",

            description:
                model.description ??
                "",

            provider_id:
                model.provider_id ??
                null,

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal,

            calculated_credit_final:
                calculatedFinal,

            discount_amount:
                calculateDiscountAmount(
                    creditCost,
                    discountPercent
                ),

            min_duration:
                toNumber(
                    model.min_duration
                ),

            max_duration:
                toNumber(
                    model.max_duration
                ),

            supported_ratios:
                normalizeArray(
                    model.supported_ratios
                ),

            supported_resolutions:
                normalizeArray(
                    model.supported_resolutions
                ),

            status:
                model.status ??
                null,

            created_at:
                model.created_at ??
                null,

            updated_at:
                model.updated_at ??
                null,

            raw:
                model

        };

    }


    /* =====================================================
       NORMALIZE MODEL LIST
       ===================================================== */

    function normalizeModelList(
        models
    ) {

        if (
            !Array.isArray(
                models
            )
        ) {

            return [];

        }


        return models
            .map(
                normalizeModelPricing
            )
            .filter(
                Boolean
            );

    }


    /* =====================================================
       LOAD PRICING
       -----------------------------------------------------
       TIDAK QUERY SUPABASE.

       Data diambil dari GENZModelsData.
    ===================================================== */

    async function loadPricing(
        options = {}
    ) {

        const {
            force = false,
            modelId = null,
            providerId = null,
            status = null
        } = options;


        /*
         * Cache.
         */

        if (
            !force &&
            pricingCache.length > 0
        ) {

            return filterPricing(
                pricingCache,
                {
                    modelId,
                    providerId,
                    status
                }
            );

        }


        /*
         * Request yang sedang berjalan.
         */

        if (
            loadingPromise &&
            !force
        ) {

            const result =
                await loadingPromise;


            return filterPricing(
                result,
                {
                    modelId,
                    providerId,
                    status
                }
            );

        }


        const modelsData =
            getModelsData();


        if (
            !modelsData
        ) {

            throw new Error(
                "GENZModelsData belum tersedia."
            );

        }


        loadingPromise =
            (async function () {

                let models = [];


                /*
                 * PRIORITAS:
                 * getCachedModels()
                 */

                if (
                    !force &&
                    typeof modelsData.getCachedModels ===
                    "function"
                ) {

                    models =
                        modelsData.getCachedModels();

                }


                /*
                 * Jika cache kosong atau force,
                 * gunakan loadModels().
                 */

                if (
                    force ||
                    !Array.isArray(
                        models
                    ) ||
                    models.length === 0
                ) {

                    if (
                        typeof modelsData.loadModels !==
                        "function"
                    ) {

                        throw new Error(
                            "GENZModelsData.loadModels() tidak tersedia."
                        );

                    }


                    models =
                        await modelsData.loadModels(
                            {
                                force:
                                    force
                            }
                        );

                }


                pricingCache =
                    normalizeModelList(
                        models
                    );


                return [
                    ...pricingCache
                ];

            })();


        try {

            const result =
                await loadingPromise;


            return filterPricing(
                result,
                {
                    modelId,
                    providerId,
                    status
                }
            );

        } finally {

            loadingPromise =
                null;

        }

    }


    /* =====================================================
       FILTER PRICING
       ===================================================== */

    function filterPricing(
        pricing,
        options = {}
    ) {

        const {
            modelId = null,
            providerId = null,
            status = null
        } = options;


        if (
            !Array.isArray(
                pricing
            )
        ) {

            return [];

        }


        const normalizedModelId =
            modelId !== null &&
            modelId !== undefined

                ?

                normalizeString(
                    modelId
                )

                :

                null;


        const normalizedProviderId =
            providerId !== null &&
            providerId !== undefined

                ?

                normalizeString(
                    providerId
                )

                :

                null;


        const normalizedStatus =
            status !== null &&
            status !== undefined

                ?

                normalizeString(
                    status
                )

                :

                null;


        return pricing.filter(
            function (item) {

                if (
                    normalizedModelId
                ) {

                    if (
                        normalizeString(
                            item.model_id
                        ) !==
                        normalizedModelId
                    ) {

                        return false;

                    }

                }


                if (
                    normalizedProviderId
                ) {

                    if (
                        normalizeString(
                            item.provider_id
                        ) !==
                        normalizedProviderId
                    ) {

                        return false;

                    }

                }


                if (
                    normalizedStatus
                ) {

                    if (
                        normalizeString(
                            item.status
                        ) !==
                        normalizedStatus
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );

    }


    /* =====================================================
       FIND PRICING FOR MODEL
       ===================================================== */

    function findPricingForModel(
        model,
        pricing = pricingCache
    ) {

        if (
            !model ||
            !Array.isArray(
                pricing
            )
        ) {

            return [];

        }


        const modelId =
            normalizeString(
                model.model_id
            );


        const modelDbId =
            normalizeString(
                model.id
            );


        if (
            !modelId &&
            !modelDbId
        ) {

            return [];

        }


        return pricing.filter(
            function (item) {

                const itemModelId =
                    normalizeString(
                        item.model_id
                    );


                const itemDbId =
                    normalizeString(
                        item.id
                    );


                return (

                    (
                        modelId &&
                        itemModelId ===
                        modelId
                    ) ||

                    (
                        modelDbId &&
                        itemDbId ===
                        modelDbId
                    )

                );

            }
        );

    }


    /* =====================================================
       GET MODEL PRICING BY MODEL ID
       ===================================================== */

    function getModelPricingById(
        modelId,
        pricing = pricingCache
    ) {

        const normalized =
            normalizeString(
                modelId
            );


        if (
            !normalized ||
            !Array.isArray(
                pricing
            )
        ) {

            return null;

        }


        return (

            pricing.find(
                function (item) {

                    return (
                        normalizeString(
                            item.model_id
                        ) ===
                        normalized
                    );

                }
            ) ||

            null

        );

    }


    /* =====================================================
       GET MODEL PRICING BY DATABASE ID
       ===================================================== */

    function getModelPricingByDbId(
        databaseId,
        pricing = pricingCache
    ) {

        const normalized =
            normalizeString(
                databaseId
            );


        if (
            !normalized ||
            !Array.isArray(
                pricing
            )
        ) {

            return null;

        }


        return (

            pricing.find(
                function (item) {

                    return (
                        normalizeString(
                            item.id
                        ) ===
                        normalized
                    );

                }
            ) ||

            null

        );

    }


    /* =====================================================
       LOWEST PRICE
       ===================================================== */

    function getLowestPrice(
        pricing
    ) {

        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {

            return null;

        }


        let lowest =
            null;


        pricing.forEach(
            function (item) {

                const value =
                    toNumber(
                        item.credit_final ??
                        item.credit_cost
                    );


                if (
                    value === null ||
                    value < 0
                ) {

                    return;

                }


                if (
                    lowest === null
                ) {

                    lowest =
                        item;

                    return;

                }


                const lowestValue =
                    toNumber(
                        lowest.credit_final ??
                        lowest.credit_cost
                    );


                if (
                    lowestValue === null ||
                    value < lowestValue
                ) {

                    lowest =
                        item;

                }

            }
        );


        return lowest;

    }


    /* =====================================================
       HIGHEST PRICE
       ===================================================== */

    function getHighestPrice(
        pricing
    ) {

        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {

            return null;

        }


        let highest =
            null;


        pricing.forEach(
            function (item) {

                const value =
                    toNumber(
                        item.credit_final ??
                        item.credit_cost
                    );


                if (
                    value === null ||
                    value < 0
                ) {

                    return;

                }


                if (
                    highest === null
                ) {

                    highest =
                        item;

                    return;

                }


                const highestValue =
                    toNumber(
                        highest.credit_final ??
                        highest.credit_cost
                    );


                if (
                    highestValue === null ||
                    value > highestValue
                ) {

                    highest =
                        item;

                }

            }
        );


        return highest;

    }


    /* =====================================================
       AVERAGE PRICE
       ===================================================== */

    function getAveragePrice(
        pricing
    ) {

        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {

            return null;

        }


        const values =
            pricing
                .map(
                    function (item) {

                        return toNumber(
                            item.credit_final ??
                            item.credit_cost
                        );

                    }
                )
                .filter(
                    function (value) {

                        return (
                            value !== null &&
                            value >= 0
                        );

                    }
                );


        if (
            values.length === 0
        ) {

            return null;

        }


        const total =
            values.reduce(
                function (
                    sum,
                    value
                ) {

                    return (
                        sum +
                        value
                    );

                },
                0
            );


        return (
            total /
            values.length
        );

    }


    /* =====================================================
       GET MODEL PRICE
       ===================================================== */

    function getModelPrice(
        model,
        pricing = pricingCache
    ) {

        if (!model) {

            return null;

        }


        /*
         * Model sudah membawa pricing.
         *
         * Gunakan langsung.
         */

        if (
            Object.prototype.hasOwnProperty.call(
                model,
                "credit_cost"
            ) ||
            Object.prototype.hasOwnProperty.call(
                model,
                "credit_final"
            )
        ) {

            const normalized =
                normalizeModelPricing(
                    model
                );


            if (
                normalized
            ) {

                return {

                    pricing:
                        [
                            normalized
                        ],

                    item:
                        normalized,

                    creditCost:
                        normalized.credit_cost,

                    discountPercent:
                        normalized.discount_percent,

                    creditFinal:
                        normalized.credit_final,

                    discountAmount:
                        normalized.discount_amount

                };

            }

        }


        /*
         * Fallback ke cache.
         */

        const matches =
            findPricingForModel(
                model,
                pricing
            );


        const item =
            getLowestPrice(
                matches
            );


        if (
            !item
        ) {

            return null;

        }


        return {

            pricing:
                matches,

            item,

            creditCost:
                toNumber(
                    item.credit_cost
                ),

            discountPercent:
                toNumber(
                    item.discount_percent
                ) ?? 0,

            creditFinal:
                toNumber(
                    item.credit_final
                ),

            discountAmount:
                toNumber(
                    item.discount_amount
                )

        };

    }


    /* =====================================================
       CREDIT SUMMARY
       ===================================================== */

    function getCreditSummary(
        model
    ) {

        if (
            !model
        ) {

            return {

                creditCost:
                    null,

                discountPercent:
                    0,

                discountAmount:
                    null,

                creditFinal:
                    null

            };

        }


        const normalized =
            normalizeModelPricing(
                model
            );


        if (
            !normalized
        ) {

            return {

                creditCost:
                    null,

                discountPercent:
                    0,

                discountAmount:
                    null,

                creditFinal:
                    null

            };

        }


        return {

            creditCost:
                normalized.credit_cost,

            discountPercent:
                normalized.discount_percent,

            discountAmount:
                normalized.discount_amount,

            creditFinal:
                normalized.credit_final,

            calculatedCreditFinal:
                normalized.calculated_credit_final

        };

    }


    /* =====================================================
       CALCULATE COST
       -----------------------------------------------------
       Compatibility utility.
       ===================================================== */

    function calculateCost(
        unitPrice,
        quantity = 1
    ) {

        const price =
            toNumber(
                unitPrice
            );


        const qty =
            Number(
                quantity
            );


        if (
            price === null ||
            !Number.isFinite(
                qty
            ) ||
            qty < 0
        ) {

            return null;

        }


        return (
            price *
            qty
        );

    }


    /* =====================================================
       USD / IDR
       -----------------------------------------------------
       Compatibility only.
       Tidak berhubungan dengan credit model.
       ===================================================== */

    function getUsdToIdrRate() {

        const candidates = [

            window.GENZ_USD_IDR_RATE,

            window.GENZ_CONFIG &&
            window.GENZ_CONFIG.USD_IDR_RATE,

            window.GENZ_CONFIG &&
            window.GENZ_CONFIG.usd_idr_rate,

            (() => {

                try {

                    return localStorage.getItem(
                        "GENZ_USD_IDR_RATE"
                    );

                } catch (
                    error
                ) {

                    return null;

                }

            })()

        ];


        for (
            const candidate
            of candidates
        ) {

            const rate =
                Number(
                    candidate
                );


            if (
                Number.isFinite(
                    rate
                ) &&
                rate > 0
            ) {

                return rate;

            }

        }


        return DEFAULT_USD_IDR_RATE;

    }


    function setUsdToIdrRate(
        rate
    ) {

        const numeric =
            Number(
                rate
            );


        if (
            !Number.isFinite(
                numeric
            ) ||
            numeric <= 0
        ) {

            return false;

        }


        window.GENZ_USD_IDR_RATE =
            numeric;


        try {

            localStorage.setItem(
                "GENZ_USD_IDR_RATE",
                String(
                    numeric
                )
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Tidak dapat menyimpan kurs:",
                error
            );

        }


        return true;

    }


    function priceToIdr(
        usdPrice,
        rate = null
    ) {

        const price =
            toNumber(
                usdPrice
            );


        if (
            price === null
        ) {

            return null;

        }


        const exchangeRate =
            rate === null

                ?

                getUsdToIdrRate()

                :

                toNumber(
                    rate
                );


        if (
            exchangeRate === null ||
            exchangeRate <= 0
        ) {

            return null;

        }


        return (
            price *
            exchangeRate
        );

    }


    function idrToUsd(
        idrPrice,
        rate = null
    ) {

        const price =
            toNumber(
                idrPrice
            );


        if (
            price === null
        ) {

            return null;

        }


        const exchangeRate =
            rate === null

                ?

                getUsdToIdrRate()

                :

                toNumber(
                    rate
                );


        if (
            exchangeRate === null ||
            exchangeRate <= 0
        ) {

            return null;

        }


        return (
            price /
            exchangeRate
        );

    }


    /* =====================================================
       FORMAT CREDIT
       ===================================================== */

    function formatCredit(
        value
    ) {

        const numeric =
            toNumber(
                value
            );


        if (
            numeric === null
        ) {

            return "-";

        }


        return new Intl.NumberFormat(
            "id-ID",
            {
                minimumFractionDigits:
                    0,

                maximumFractionDigits:
                    6
            }
        ).format(
            numeric
        );

    }


    /* =====================================================
       FORMAT USD
       ===================================================== */

    function formatUsd(
        value
    ) {

        const numeric =
            toNumber(
                value
            );


        if (
            numeric === null
        ) {

            return "-";

        }


        return new Intl.NumberFormat(
            "en-US",
            {
                style:
                    "currency",

                currency:
                    "USD",

                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    6

            }
        ).format(
            numeric
        );

    }


    /* =====================================================
       FORMAT IDR
       ===================================================== */

    function formatIdr(
        value
    ) {

        const numeric =
            toNumber(
                value
            );


        if (
            numeric === null
        ) {

            return "-";

        }


        return new Intl.NumberFormat(
            "id-ID",
            {
                style:
                    "currency",

                currency:
                    "IDR",

                minimumFractionDigits:
                    0,

                maximumFractionDigits:
                    0

            }
        ).format(
            Math.round(
                numeric
            )
        );

    }


    /* =====================================================
       PRICE SUMMARY
       ===================================================== */

    function getPriceSummary(
        pricing
    ) {

        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {

            return {

                count:
                    0,

                lowest:
                    null,

                highest:
                    null,

                average:
                    null

            };

        }


        return {

            count:
                pricing.length,

            lowest:
                getLowestPrice(
                    pricing
                ),

            highest:
                getHighestPrice(
                    pricing
                ),

            average:
                getAveragePrice(
                    pricing
                )

        };

    }


    /* =====================================================
       RENDER MODEL PRICE
       ===================================================== */

    function renderPrice(
        pricing
    ) {

        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {

            return `
                <div class="model-price">
                    <div class="model-price-empty">
                        Credit belum tersedia
                    </div>
                </div>
            `;

        }


        const item =
            getLowestPrice(
                pricing
            );


        if (
            !item
        ) {

            return `
                <div class="model-price">
                    <div class="model-price-empty">
                        Credit tidak valid
                    </div>
                </div>
            `;

        }


        const creditCost =
            toNumber(
                item.credit_cost
            );


        const discount =
            toNumber(
                item.discount_percent
            ) ?? 0;


        const creditFinal =
            toNumber(
                item.credit_final
            );


        return `
            <div class="model-price">

                <div class="model-credit-cost">

                    Credit:
                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                creditCost
                            )
                        )}
                    </strong>

                </div>

                ${
                    discount > 0
                        ? `
                            <div class="model-credit-discount">

                                Diskon:
                                <strong>
                                    ${escapeHtml(
                                        formatCredit(
                                            discount
                                        )
                                    )}%
                                </strong>

                            </div>
                        `
                        : ""
                }

                <div class="model-credit-final">

                    Credit Final:
                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                creditFinal
                            )
                        )}
                    </strong>

                </div>

            </div>
        `;

    }


    /* =====================================================
       RENDER PRICE PREVIEW
       ===================================================== */

    function renderPricePreview(
        pricing
    ) {

        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {

            return `
                <div class="model-price-preview">

                    <div class="model-price-empty">
                        Belum ada data credit model.
                    </div>

                </div>
            `;

        }


        const rows =
            pricing
                .slice(
                    0,
                    20
                )
                .map(
                    function (item) {

                        const cost =
                            toNumber(
                                item.credit_cost
                            );


                        const discount =
                            toNumber(
                                item.discount_percent
                            ) ?? 0;


                        const finalCredit =
                            toNumber(
                                item.credit_final
                            );


                        return `
                            <div class="model-price-preview-row">

                                <div>

                                    <strong>
                                        ${escapeHtml(
                                            item.model_name ||
                                            item.model_id ||
                                            "Model"
                                        )}
                                    </strong>

                                    <div>
                                        ${escapeHtml(
                                            item.model_id ||
                                            ""
                                        )}
                                    </div>

                                </div>

                                <div>

                                    <div>
                                        Credit:
                                        <strong>
                                            ${escapeHtml(
                                                formatCredit(
                                                    cost
                                                )
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        Diskon:
                                        <strong>
                                            ${escapeHtml(
                                                formatCredit(
                                                    discount
                                                )
                                            )}%
                                        </strong>
                                    </div>

                                    <div>
                                        Final:
                                        <strong>
                                            ${escapeHtml(
                                                formatCredit(
                                                    finalCredit
                                                )
                                            )}
                                        </strong>
                                    </div>

                                </div>

                            </div>
                        `;

                    }
                )
                .join("");


        return `
            <div class="model-price-preview">
                ${rows}
            </div>
        `;

    }


    /* =====================================================
       RENDER SUMMARY
       ===================================================== */

    function renderPriceSummary(
        pricing
    ) {

        const summary =
            getPriceSummary(
                pricing
            );


        if (
            summary.count === 0
        ) {

            return `
                <div class="model-price-summary">
                    Credit model belum tersedia.
                </div>
            `;

        }


        return `
            <div class="model-price-summary">

                <div class="model-price-summary-row">

                    <span>
                        Jumlah Model
                    </span>

                    <strong>
                        ${summary.count}
                    </strong>

                </div>

                <div class="model-price-summary-row">

                    <span>
                        Credit Terendah
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                summary.lowest?.credit_final ??
                                summary.lowest?.credit_cost
                            )
                        )}
                    </strong>

                </div>

                <div class="model-price-summary-row">

                    <span>
                        Credit Tertinggi
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                summary.highest?.credit_final ??
                                summary.highest?.credit_cost
                            )
                        )}
                    </strong>

                </div>

            </div>
        `;

    }


    /* =====================================================
       CACHE
       ===================================================== */

    function clearCache() {

        pricingCache =
            [];

        loadingPromise =
            null;

    }


    function getCachedPricing() {

        return [
            ...pricingCache
        ];

    }


    function hasCachedPricing() {

        return (
            pricingCache.length >
            0
        );

    }


    /* =====================================================
       SYNC FROM MODEL DATA
       -----------------------------------------------------
       Dipakai setelah ModelData berubah.
       ===================================================== */

    function syncFromModels(
        models
    ) {

        if (
            Array.isArray(
                models
            )
        ) {

            pricingCache =
                normalizeModelList(
                    models
                );

            return [
                ...pricingCache
            ];

        }


        const modelsData =
            getModelsData();


        if (
            modelsData &&
            typeof modelsData.getCachedModels ===
            "function"
        ) {

            pricingCache =
                normalizeModelList(
                    modelsData.getCachedModels()
                );

        } else {

            pricingCache =
                [];

        }


        return [
            ...pricingCache
        ];

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        if (
            initialized
        ) {

            /*
             * Sinkronisasi ringan dengan cache
             * ModelData jika tersedia.
             */

            const modelsData =
                getModelsData();


            if (
                modelsData &&
                typeof modelsData.getCachedModels ===
                "function"
            ) {

                const cachedModels =
                    modelsData.getCachedModels();


                if (
                    Array.isArray(
                        cachedModels
                    ) &&
                    cachedModels.length > 0
                ) {

                    pricingCache =
                        normalizeModelList(
                            cachedModels
                        );

                }

            }


            return [
                ...pricingCache
            ];

        }


        try {

            const result =
                await loadPricing(
                    {
                        force:
                            false
                    }
                );


            initialized =
                true;


            console.info(
                "[GEN-Z.AI] Model pricing initialized:",
                result.length
            );


            return result;

        } catch (
            error
        ) {

            /*
             * Pricing bukan alasan halaman Models
             * harus gagal total.
             */

            console.warn(
                "[GEN-Z.AI] Model pricing initialization dilewati:",
                error
            );


            initialized =
                true;


            pricingCache =
                [];


            return [];

        }

    }


    /* =====================================================
       RESET
       ===================================================== */

    function reset() {

        initialized =
            false;


        clearCache();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelsPrice =
        Object.freeze({

            initialize,

            reset,

            loadPricing,

            filterPricing,

            findPricingForModel,

            getModelPricingById,

            getModelPricingByDbId,

            getModelPrice,

            getCreditSummary,

            normalizeModelPricing,

            normalizeModelList,

            getLowestPrice,

            getHighestPrice,

            getAveragePrice,

            getPriceSummary,

            calculateCost,

            calculateDiscountAmount,

            calculateCreditFinal,

            priceToIdr,

            idrToUsd,

            formatCredit,

            formatUsd,

            formatIdr,

            getUsdToIdrRate,

            setUsdToIdrRate,

            renderPrice,

            renderPricePreview,

            renderPriceSummary,

            syncFromModels,

            clearCache,

            getCachedPricing,

            hasCachedPricing

        });


    console.info(
        "[GEN-Z.AI] GENZModelsPrice loaded."
    );

})();
