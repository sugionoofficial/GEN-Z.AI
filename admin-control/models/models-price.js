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
   - Kalkulasi credit per resolution
   - Format credit
   - Menyediakan compatibility API

   SUMBER DATA:
       models.credit_480p
       models.credit_720p
       models.credit_1080p
       models.discount_percent

   RUNTIME:
       credit_final_480p
       credit_final_720p
       credit_final_1080p

   CATATAN:
       credit_final_* hanya nilai hasil kalkulasi runtime.
       Tidak disimpan sebagai kolom Supabase.

   RELASI:
       models
          ↓
       GENZModelsData
          ↓
       GENZModelsPrice

   TIDAK MENGGUNAKAN:
       credit_cost
       credit_final
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


    /*
     * Urutan resolusi resmi pricing.
     */

    const RESOLUTION_ORDER = [
        "480p",
        "720p",
        "1080p"
    ];


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
       DISCOUNT
       ===================================================== */

    function normalizeDiscount(
        discountPercent
    ) {

        const numeric =
            toNumber(
                discountPercent
            );


        if (
            numeric === null
        ) {

            return 0;

        }


        return Math.min(
            100,
            Math.max(
                0,
                numeric
            )
        );

    }


    /* =====================================================
       CREDIT CALCULATION
       -----------------------------------------------------
       credit = harga dasar
       discount = persentase diskon
       final = credit - (credit * discount / 100)

       Contoh:
       50 - 10% = 45
       75 - 10% = 67.5
       100 - 10% = 90
    ===================================================== */

    function calculateCreditFinal(
        credit,
        discountPercent
    ) {

        const baseCredit =
            toNumber(
                credit
            );


        if (
            baseCredit === null
        ) {

            return null;

        }


        const safeCredit =
            Math.max(
                0,
                baseCredit
            );


        const discount =
            normalizeDiscount(
                discountPercent
            );


        const result =
            safeCredit -
            (
                safeCredit *
                discount /
                100
            );


        return Number(
            result.toFixed(
                6
            )
        );

    }


    function calculateDiscountAmount(
        credit,
        discountPercent
    ) {

        const baseCredit =
            toNumber(
                credit
            );


        if (
            baseCredit === null
        ) {

            return null;

        }


        const safeCredit =
            Math.max(
                0,
                baseCredit
            );


        const discount =
            normalizeDiscount(
                discountPercent
            );


        return Number(
            (
                safeCredit *
                discount /
                100
            ).toFixed(
                6
            )
        );

    }


    /* =====================================================
       RESOLUTION CREDIT
       ===================================================== */

    function getResolutionCredit(
        model,
        resolution
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return null;

        }


        const normalizedResolution =
            String(
                resolution ?? ""
            )
                .trim()
                .toLowerCase()
                .replace(
                    /\s+/g,
                    ""
                );


        let field = null;


        if (
            normalizedResolution ===
            "480p"
        ) {

            field =
                "credit_480p";

        } else if (
            normalizedResolution ===
            "720p"
        ) {

            field =
                "credit_720p";

        } else if (
            normalizedResolution ===
            "1080p"
        ) {

            field =
                "credit_1080p";

        }


        if (
            !field
        ) {

            return null;

        }


        return toNumber(
            model[field]
        );

    }


    function getRuntimeResolutionPricing(
        model,
        resolution
    ) {

        const baseCredit =
            getResolutionCredit(
                model,
                resolution
            );


        if (
            baseCredit === null
        ) {

            return null;

        }


        const discountPercent =
            normalizeDiscount(
                model.discount_percent
            );


        const creditFinal =
            calculateCreditFinal(
                baseCredit,
                discountPercent
            );


        return {

            resolution:
                String(
                    resolution
                ),

            credit:
                baseCredit,

            credit_base:
                baseCredit,

            discount_percent:
                discountPercent,

            discount_amount:
                calculateDiscountAmount(
                    baseCredit,
                    discountPercent
                ),

            credit_final:
                creditFinal

        };

    }


    function getRuntimePricing(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return [];

        }


        return RESOLUTION_ORDER
            .map(
                resolution =>
                    getRuntimeResolutionPricing(
                        model,
                        resolution
                    )
            )
            .filter(
                Boolean
            );

    }


    function getRuntimeCreditValues(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return {

                credit_480p:
                    null,

                credit_720p:
                    null,

                credit_1080p:
                    null,

                credit_final_480p:
                    null,

                credit_final_720p:
                    null,

                credit_final_1080p:
                    null

            };

        }


        const discountPercent =
            normalizeDiscount(
                model.discount_percent
            );


        const credit480p =
            getResolutionCredit(
                model,
                "480p"
            );


        const credit720p =
            getResolutionCredit(
                model,
                "720p"
            );


        const credit1080p =
            getResolutionCredit(
                model,
                "1080p"
            );


        return {

            credit_480p:
                credit480p,

            credit_720p:
                credit720p,

            credit_1080p:
                credit1080p,

            credit_final_480p:
                calculateCreditFinal(
                    credit480p,
                    discountPercent
                ),

            credit_final_720p:
                calculateCreditFinal(
                    credit720p,
                    discountPercent
                ),

            credit_final_1080p:
                calculateCreditFinal(
                    credit1080p,
                    discountPercent
                )

        };

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


        const discountPercent =
            normalizeDiscount(
                model.discount_percent
            );


        const credit480p =
            toNumber(
                model.credit_480p
            );


        const credit720p =
            toNumber(
                model.credit_720p
            );


        const credit1080p =
            toNumber(
                model.credit_1080p
            );


        const creditFinal480p =
            calculateCreditFinal(
                credit480p,
                discountPercent
            );


        const creditFinal720p =
            calculateCreditFinal(
                credit720p,
                discountPercent
            );


        const creditFinal1080p =
            calculateCreditFinal(
                credit1080p,
                discountPercent
            );


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

            credit_480p:
                credit480p,

            credit_720p:
                credit720p,

            credit_1080p:
                credit1080p,

            discount_percent:
                discountPercent,

            /*
             * Runtime-only values.
             *
             * Tidak berasal dari kolom
             * credit_final database.
             */

            credit_final_480p:
                creditFinal480p,

            credit_final_720p:
                creditFinal720p,

            credit_final_1080p:
                creditFinal1080p,

            calculated_credit_final_480p:
                creditFinal480p,

            calculated_credit_final_720p:
                creditFinal720p,

            calculated_credit_final_1080p:
                creditFinal1080p,

            discount_amount_480p:
                calculateDiscountAmount(
                    credit480p,
                    discountPercent
                ),

            discount_amount_720p:
                calculateDiscountAmount(
                    credit720p,
                    discountPercent
                ),

            discount_amount_1080p:
                calculateDiscountAmount(
                    credit1080p,
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
       GET COMPARABLE PRICE
       -----------------------------------------------------
       Digunakan untuk statistik.

       Nilai yang dibandingkan adalah:
       - runtime discounted credit
       - seluruh resolution yang tersedia
    ===================================================== */

    function getComparablePrice(
        item
    ) {

        if (
            !item
        ) {

            return null;

        }


        const finals = [

            toNumber(
                item.credit_final_480p
            ),

            toNumber(
                item.credit_final_720p
            ),

            toNumber(
                item.credit_final_1080p
            )

        ].filter(
            value =>
                value !== null &&
                value >= 0
        );


        if (
            finals.length === 0
        ) {

            return null;

        }


        return Math.min(
            ...finals
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


        let lowestValue =
            null;


        pricing.forEach(
            function (item) {

                const value =
                    getComparablePrice(
                        item
                    );


                if (
                    value === null
                ) {

                    return;

                }


                if (
                    lowest === null ||
                    lowestValue === null ||
                    value < lowestValue
                ) {

                    lowest =
                        item;

                    lowestValue =
                        value;

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


        let highestValue =
            null;


        pricing.forEach(
            function (item) {

                const value =
                    getComparablePrice(
                        item
                    );


                if (
                    value === null
                ) {

                    return;

                }


                if (
                    highest === null ||
                    highestValue === null ||
                    value > highestValue
                ) {

                    highest =
                        item;

                    highestValue =
                        value;

                }

            }
        );


        return highest;

    }


    /* =====================================================
       AVERAGE PRICE
       -----------------------------------------------------
       Rata-rata dari harga minimum runtime setiap model.
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
                    getComparablePrice
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
         *
         * Tidak lagi mengecek:
         * credit_cost
         * credit_final
         */

        if (
            Object.prototype.hasOwnProperty.call(
                model,
                "credit_480p"
            ) ||
            Object.prototype.hasOwnProperty.call(
                model,
                "credit_720p"
            ) ||
            Object.prototype.hasOwnProperty.call(
                model,
                "credit_1080p"
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

                    credit480p:
                        normalized.credit_480p,

                    credit720p:
                        normalized.credit_720p,

                    credit1080p:
                        normalized.credit_1080p,

                    creditFinal480p:
                        normalized.credit_final_480p,

                    creditFinal720p:
                        normalized.credit_final_720p,

                    creditFinal1080p:
                        normalized.credit_final_1080p,

                    discountPercent:
                        normalized.discount_percent,

                    discountAmount480p:
                        normalized.discount_amount_480p,

                    discountAmount720p:
                        normalized.discount_amount_720p,

                    discountAmount1080p:
                        normalized.discount_amount_1080p

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
            matches.length > 0
                ? matches[0]
                : null;


        if (
            !item
        ) {

            return null;

        }


        return {

            pricing:
                matches,

            item,

            credit480p:
                toNumber(
                    item.credit_480p
                ),

            credit720p:
                toNumber(
                    item.credit_720p
                ),

            credit1080p:
                toNumber(
                    item.credit_1080p
                ),

            creditFinal480p:
                toNumber(
                    item.credit_final_480p
                ),

            creditFinal720p:
                toNumber(
                    item.credit_final_720p
                ),

            creditFinal1080p:
                toNumber(
                    item.credit_final_1080p
                ),

            discountPercent:
                toNumber(
                    item.discount_percent
                ) ?? 0,

            discountAmount480p:
                toNumber(
                    item.discount_amount_480p
                ),

            discountAmount720p:
                toNumber(
                    item.discount_amount_720p
                ),

            discountAmount1080p:
                toNumber(
                    item.discount_amount_1080p
                )

        };

    }


    /* =====================================================
       GET CREDIT SUMMARY
       ===================================================== */

    function getCreditSummary(
        model
    ) {

        if (
            !model
        ) {

            return {

                credit480p:
                    null,

                credit720p:
                    null,

                credit1080p:
                    null,

                discountPercent:
                    0,

                discountAmount480p:
                    null,

                discountAmount720p:
                    null,

                discountAmount1080p:
                    null,

                creditFinal480p:
                    null,

                creditFinal720p:
                    null,

                creditFinal1080p:
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

                credit480p:
                    null,

                credit720p:
                    null,

                credit1080p:
                    null,

                discountPercent:
                    0,

                discountAmount480p:
                    null,

                discountAmount720p:
                    null,

                discountAmount1080p:
                    null,

                creditFinal480p:
                    null,

                creditFinal720p:
                    null,

                creditFinal1080p:
                    null

            };

        }


        return {

            credit480p:
                normalized.credit_480p,

            credit720p:
                normalized.credit_720p,

            credit1080p:
                normalized.credit_1080p,

            discountPercent:
                normalized.discount_percent,

            discountAmount480p:
                normalized.discount_amount_480p,

            discountAmount720p:
                normalized.discount_amount_720p,

            discountAmount1080p:
                normalized.discount_amount_1080p,

            creditFinal480p:
                normalized.credit_final_480p,

            creditFinal720p:
                normalized.credit_final_720p,

            creditFinal1080p:
                normalized.credit_final_1080p

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
            pricing[0];


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


        const rows =
            RESOLUTION_ORDER
                .map(
                    function (resolution) {

                        const base =
                            getResolutionCredit(
                                item,
                                resolution
                            );


                        const finalCredit =
                            calculateCreditFinal(
                                base,
                                item.discount_percent
                            );


                        if (
                            base === null
                        ) {

                            return "";

                        }


                        return `
                            <div class="model-credit-row">

                                <span>
                                    ${escapeHtml(
                                        resolution
                                    )}
                                </span>

                                <span>
                                    Credit:
                                    <strong>
                                        ${escapeHtml(
                                            formatCredit(
                                                base
                                            )
                                        )}
                                    </strong>
                                </span>

                                <span>
                                    Diskon:
                                    <strong>
                                        ${escapeHtml(
                                            formatCredit(
                                                item.discount_percent
                                            )
                                        )}%
                                    </strong>
                                </span>

                                <span>
                                    Credit Final:
                                    <strong>
                                        ${escapeHtml(
                                            formatCredit(
                                                finalCredit
                                            )
                                        )}
                                    </strong>
                                </span>

                            </div>
                        `;

                    }
                )
                .join("");


        if (
            !rows
        ) {

            return `
                <div class="model-price">
                    <div class="model-price-empty">
                        Credit belum tersedia
                    </div>
                </div>
            `;

        }


        return `
            <div class="model-price">

                ${rows}

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

                        const resolutionRows =
                            RESOLUTION_ORDER
                                .map(
                                    function (
                                        resolution
                                    ) {

                                        const base =
                                            getResolutionCredit(
                                                item,
                                                resolution
                                            );


                                        if (
                                            base === null
                                        ) {

                                            return "";

                                        }


                                        const finalCredit =
                                            calculateCreditFinal(
                                                base,
                                                item.discount_percent
                                            );


                                        return `
                                            <div>
                                                ${escapeHtml(
                                                    resolution
                                                )}:
                                                Credit
                                                <strong>
                                                    ${escapeHtml(
                                                        formatCredit(
                                                            base
                                                        )
                                                    )}
                                                </strong>
                                                →
                                                Final
                                                <strong>
                                                    ${escapeHtml(
                                                        formatCredit(
                                                            finalCredit
                                                        )
                                                    )}
                                                </strong>
                                            </div>
                                        `;

                                    }
                                )
                                .join("");


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
                                        Diskon:
                                        <strong>
                                            ${escapeHtml(
                                                formatCredit(
                                                    item.discount_percent
                                                )
                                            )}%
                                        </strong>
                                    </div>

                                    ${resolutionRows}

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


        const lowestValue =
            summary.lowest
                ? getComparablePrice(
                    summary.lowest
                )
                : null;


        const highestValue =
            summary.highest
                ? getComparablePrice(
                    summary.highest
                )
                : null;


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
                                lowestValue
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
                                highestValue
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

            getResolutionCredit,

            getRuntimeResolutionPricing,

            getRuntimePricing,

            getRuntimeCreditValues,

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
