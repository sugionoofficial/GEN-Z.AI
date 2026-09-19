/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL PRICE MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-price.js

   Tanggung jawab:
   - Membaca pricing dari tabel `models`
   - Cache pricing model
   - Mencari pricing berdasarkan model
   - Kalkulasi credit
   - Format harga / credit
   - Menyediakan compatibility API untuk Models UI

   Sumber data:
       models.credit_cost
       models.discount_percent
       models.credit_final

   TIDAK menggunakan:
       kie_pricing
       kie_models
       kie_workflows
       kie_workflow_variants
       kie_parameters
       kie_constraints
       kie_dependencies

   Tidak menangani:
   - Provider CRUD
   - Model CRUD
   - Model Search
   - Save model
   - Update model
   - Delete model
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

    const MODEL_TABLE =
        "models";


    /*
     * Dipertahankan hanya untuk compatibility
     * dengan fungsi konversi harga lama.
     *
     * Credit model TIDAK menggunakan kurs ini.
     */

    const DEFAULT_USD_IDR_RATE =
        17700;


    /* =====================================================
       SUPABASE
    ===================================================== */

    function getSupabase() {

        return (
            window.GENZ_SUPABASE ||
            window.supabaseClient ||
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


        const number =
            Number(
                value
            );


        return Number.isFinite(
            number
        )
            ? number
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

            try {

                const parsed =
                    JSON.parse(
                        value
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

                /* Bukan JSON, lanjutkan. */

            }


            return value
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
            cost *
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
                cost *
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
       Model menjadi satu-satunya sumber data.
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


        const discountPercent =
            toNumber(
                model.discount_percent
            );


        const calculatedFinal =
            calculateCreditFinal(
                creditCost,
                discountPercent
            );


        const storedFinal =
            toNumber(
                model.credit_final
            );


        /*
         * Jika credit_final tersedia di database,
         * gunakan nilai database.
         *
         * Jika kosong, hitung dari cost + discount.
         */

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

            provider_id:
                model.provider_id ??
                null,

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent === null
                    ? 0
                    : discountPercent,

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
       LOAD PRICING
       -----------------------------------------------------
       Sumber langsung tabel models.
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


        const supabase =
            getSupabase();


        if (
            !supabase
        ) {

            throw new Error(
                "Supabase client belum tersedia."
            );

        }


        loadingPromise =
            (async function () {

                const {
                    data,
                    error
                } =
                    await supabase
                        .from(
                            MODEL_TABLE
                        )
                        .select(`
                            id,
                            provider_id,
                            model_id,
                            model_name,
                            credit_cost,
                            discount_percent,
                            credit_final,
                            min_duration,
                            max_duration,
                            supported_ratios,
                            supported_resolutions,
                            status,
                            created_at,
                            updated_at
                        `)
                        .order(
                            "created_at",
                            {
                                ascending:
                                    false
                            }
                        );


                if (
                    error
                ) {

                    console.error(
                        "[models-price] Gagal memuat pricing model:",
                        error
                    );


                    throw error;

                }


                pricingCache =
                    (
                        Array.isArray(
                            data
                        )
                            ? data
                            : []
                    )
                        .map(
                            normalizeModelPricing
                        )
                        .filter(
                            Boolean
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
            modelId !== null
                ? normalizeString(
                    modelId
                )
                : null;


        const normalizedProviderId =
            providerId !== null
                ? normalizeString(
                    providerId
                )
                : null;


        const normalizedStatus =
            status !== null
                ? normalizeString(
                    status
                )
                : null;


        return pricing.filter(
            item => {

                if (
                    normalizedModelId
                ) {

                    const itemModelId =
                        normalizeString(
                            item.model_id
                        );


                    if (
                        itemModelId !==
                        normalizedModelId
                    ) {

                        return false;

                    }

                }


                if (
                    normalizedProviderId
                ) {

                    const itemProviderId =
                        normalizeString(
                            item.provider_id
                        );


                    if (
                        itemProviderId !==
                        normalizedProviderId
                    ) {

                        return false;

                    }

                }


                if (
                    normalizedStatus
                ) {

                    const itemStatus =
                        normalizeString(
                            item.status
                        );


                    if (
                        itemStatus !==
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
            !model
        ) {

            return [];

        }


        if (
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
            item => {

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
       FIND BY MODEL ID
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
                item =>
                    normalizeString(
                        item.model_id
                    ) ===
                    normalized
            ) ||
            null
        );

    }


    /* =====================================================
       LOWEST PRICE
       -----------------------------------------------------
       Compatibility API.
       Untuk model baru hanya ada satu record pricing
       per model, tetapi fungsi tetap dipertahankan.
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
            item => {

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
                    lowest === null ||
                    value <
                    Number(
                        lowest.credit_final ??
                        lowest.credit_cost
                    )
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
            item => {

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
                    highest === null ||
                    value >
                    Number(
                        highest.credit_final ??
                        highest.credit_cost
                    )
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
                    item =>
                        toNumber(
                            item.credit_final ??
                            item.credit_cost
                        )
                )
                .filter(
                    value =>
                        value !== null &&
                        value >= 0
                );


        if (
            values.length === 0
        ) {

            return null;

        }


        const total =
            values.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
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

        /*
         * Jika model belum ada di cache,
         * gunakan langsung record model.
         *
         * Ini penting supaya form tidak tergantung
         * pada request pricing tambahan.
         */

        if (
            model &&
            (
                Object.prototype.hasOwnProperty.call(
                    model,
                    "credit_cost"
                ) ||
                Object.prototype.hasOwnProperty.call(
                    model,
                    "credit_final"
                )
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
       USD / IDR COMPATIBILITY
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

        const number =
            Number(
                rate
            );


        if (
            !Number.isFinite(
                number
            ) ||
            number <= 0
        ) {

            return false;

        }


        window.GENZ_USD_IDR_RATE =
            number;


        try {

            localStorage.setItem(
                "GENZ_USD_IDR_RATE",
                String(
                    number
                )
            );

        } catch (
            error
        ) {

            console.warn(
                "[models-price] Tidak dapat menyimpan kurs:",
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
                ? getUsdToIdrRate()
                : toNumber(
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
                ? getUsdToIdrRate()
                : toNumber(
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

        const number =
            toNumber(
                value
            );


        if (
            number === null
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
            number
        );

    }


    /* =====================================================
       FORMAT USD
       -----------------------------------------------------
       Compatibility API.
    ===================================================== */

    function formatUsd(
        value
    ) {

        const number =
            toNumber(
                value
            );


        if (
            number === null
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
            number
        );

    }


    /* =====================================================
       FORMAT IDR
    ===================================================== */

    function formatIdr(
        value
    ) {

        const number =
            toNumber(
                value
            );


        if (
            number === null
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
                number
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


        const lowest =
            getLowestPrice(
                pricing
            );


        const highest =
            getHighestPrice(
                pricing
            );


        const average =
            getAveragePrice(
                pricing
            );


        return {

            count:
                pricing.length,

            lowest,

            highest,

            average

        };

    }


    /* =====================================================
       RENDER MODEL CREDIT
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
                    item => {

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


        const lowest =
            summary.lowest;


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
                                lowest?.credit_final ??
                                lowest?.credit_cost
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
       INITIALIZE
    ===================================================== */

    async function initialize() {

        if (
            initialized
        ) {

            return [
                ...pricingCache
            ];

        }


        /*
         * Pricing model berasal dari tabel models.
         *
         * Jika gagal dimuat, jangan membuat seluruh
         * halaman Models gagal.
         */

        try {

            const result =
                await loadPricing({
                    force:
                        false
                });


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

            getModelPrice,

            getCreditSummary,

            normalizeModelPricing,

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

            clearCache,

            getCachedPricing,

            hasCachedPricing

        });


    console.log(
        "[GEN-Z.AI] GENZModelsPrice loaded."
    );


})();
