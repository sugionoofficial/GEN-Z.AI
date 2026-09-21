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
   - Kalkulasi credit per resolusi
   - Kalkulasi discount per resolusi
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
       credit_final_* HANYA nilai hasil kalkulasi runtime.
       Bukan kolom database.

   RELASI:
       models
          ↓
       GENZModelsData
          ↓
       GENZModelsPrice

   TIDAK MENGGUNAKAN:
       credit_cost
       credit_final sebagai kolom database
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
     * Resolusi pricing yang digunakan sistem.
     *
     * Jangan menambahkan credit resolution lain di sini
     * tanpa menyesuaikan schema models dan Generate.
     */

    const RESOLUTIONS = Object.freeze([
        "480p",
        "720p",
        "1080p"
    ]);


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

                /*
                 * Bukan JSON.
                 */

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
       DISCOUNT NORMALIZATION
       ===================================================== */

    function normalizeDiscountPercent(
        value
    ) {

        const numeric =
            toNumber(
                value
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
            normalizeString(
                resolution
            );


        if (
            RESOLUTIONS.indexOf(
                normalizedResolution
            ) === -1
        ) {

            return null;

        }


        const field =
            `credit_${normalizedResolution}`;


        /*
         * Hanya membaca field credit_<resolution>.
         *
         * Tidak ada fallback ke:
         * credit_cost
         * credit_final
         */

        return toNumber(
            model[field]
        );

    }


    /* =====================================================
       CREDIT CALCULATION
       ===================================================== */

    /*
     * Generic runtime calculation:
     *
     * final =
     * credit -
     * (credit * discount / 100)
     *
     * Fungsi ini tetap menggunakan nama lama
     * calculateCreditFinal() agar module lain
     * yang sudah memanggil API ini tidak rusak.
     *
     * Parameter pertama sekarang berarti BASE CREDIT,
     * bukan credit_cost.
     */

    function calculateCreditFinal(
        credit,
        discountPercent
    ) {

        const baseCredit =
            toNumber(
                credit
            );


        const discount =
            normalizeDiscountPercent(
                discountPercent
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


        const result =
            safeCredit *
            (
                1 -
                (
                    discount /
                    100
                )
            );


        return Number(
            result.toFixed(
                6
            )
        );

    }


    /*
     * Generic runtime discount amount.
     *
     * Tidak membaca credit_cost.
     */

    function calculateDiscountAmount(
        credit,
        discountPercent
    ) {

        const baseCredit =
            toNumber(
                credit
            );


        const discount =
            normalizeDiscountPercent(
                discountPercent
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


        return Number(
            (
                safeCredit *
                (
                    discount /
                    100
                )
            ).toFixed(
                6
            )
        );

    }


    /* =====================================================
       GET RESOLUTION PRICING
       ===================================================== */

    function getResolutionPricing(
        model,
        resolution
    ) {

        const normalizedResolution =
            normalizeString(
                resolution
            );


        if (
            RESOLUTIONS.indexOf(
                normalizedResolution
            ) === -1
        ) {

            return null;

        }


        const credit =
            getResolutionCredit(
                model,
                normalizedResolution
            );


        const discountPercent =
            normalizeDiscountPercent(
                model?.discount_percent
            );


        const creditFinal =
            calculateCreditFinal(
                credit,
                discountPercent
            );


        const discountAmount =
            calculateDiscountAmount(
                credit,
                discountPercent
            );


        return {

            resolution:
                normalizedResolution,

            credit,

            discount_percent:
                discountPercent,

            discount_amount:
                discountAmount,

            credit_final:
                creditFinal

        };

    }


    /* =====================================================
       GET ALL RESOLUTION PRICING
       ===================================================== */

    function getAllResolutionPricing(
        model
    ) {

        const result = {};


        RESOLUTIONS.forEach(
            function (
                resolution
            ) {

                result[
                    resolution
                ] =
                    getResolutionPricing(
                        model,
                        resolution
                    );

            }
        );


        return result;

    }


    /* =====================================================
       NORMALIZE MODEL PRICING
       -----------------------------------------------------
       Satu record models = satu sumber pricing.

       Tidak ada lagi:
       - credit_cost
       - credit_final sebagai sumber DB
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
            normalizeDiscountPercent(
                model.discount_percent
            );


        const pricing480 =
            getResolutionPricing(
                model,
                "480p"
            );


        const pricing720 =
            getResolutionPricing(
                model,
                "720p"
            );


        const pricing1080 =
            getResolutionPricing(
                model,
                "1080p"
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


            /*
             * SOURCE OF TRUTH
             */

            credit_480p:
                pricing480?.credit ??
                null,

            credit_720p:
                pricing720?.credit ??
                null,

            credit_1080p:
                pricing1080?.credit ??
                null,

            discount_percent:
                discountPercent,


            /*
             * RUNTIME ONLY
             *
             * Bukan kolom database.
             */

            credit_final_480p:
                pricing480?.credit_final ??
                null,

            credit_final_720p:
                pricing720?.credit_final ??
                null,

            credit_final_1080p:
                pricing1080?.credit_final ??
                null,


            discount_amount_480p:
                pricing480?.discount_amount ??
                null,

            discount_amount_720p:
                pricing720?.discount_amount ??
                null,

            discount_amount_1080p:
                pricing1080?.discount_amount ??
                null,


            /*
             * Structured pricing runtime.
             */

            resolutions: {

                "480p":
                    pricing480,

                "720p":
                    pricing720,

                "1080p":
                    pricing1080

            },


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
       GET NUMERIC FINAL VALUES
       -----------------------------------------------------
       Mengambil seluruh runtime final credit
       yang valid dari satu pricing item.
    ===================================================== */

    function getFinalCreditValues(
        item
    ) {

        if (
            !item
        ) {

            return [];

        }


        return RESOLUTIONS
            .map(
                function (
                    resolution
                ) {

                    return toNumber(
                        item[
                            `credit_final_${resolution}`
                        ]
                    );

                }
            )
            .filter(
                function (
                    value
                ) {

                    return (
                        value !== null &&
                        value >= 0
                    );

                }
            );

    }


    /* =====================================================
       LOWEST PRICE
       -----------------------------------------------------
       Membandingkan runtime final credit
       dari seluruh resolusi.
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


        let lowest = null;

        let lowestValue = null;


        pricing.forEach(
            function (item) {

                const values =
                    getFinalCreditValues(
                        item
                    );


                if (
                    values.length === 0
                ) {

                    return;

                }


                const itemLowest =
                    Math.min(
                        ...values
                    );


                if (
                    lowestValue === null ||
                    itemLowest <
                        lowestValue
                ) {

                    lowest =
                        item;

                    lowestValue =
                        itemLowest;

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


        let highest = null;

        let highestValue = null;


        pricing.forEach(
            function (item) {

                const values =
                    getFinalCreditValues(
                        item
                    );


                if (
                    values.length === 0
                ) {

                    return;

                }


                const itemHighest =
                    Math.max(
                        ...values
                    );


                if (
                    highestValue === null ||
                    itemHighest >
                        highestValue
                ) {

                    highest =
                        item;

                    highestValue =
                        itemHighest;

                }

            }
        );


        return highest;

    }


    /* =====================================================
       AVERAGE PRICE
       -----------------------------------------------------
       Average seluruh runtime final credit
       yang tersedia.
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


        const values = [];


        pricing.forEach(
            function (item) {

                const itemValues =
                    getFinalCreditValues(
                        item
                    );


                itemValues.forEach(
                    function (
                        value
                    ) {

                        values.push(
                            value
                        );

                    }
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
       -----------------------------------------------------
       Compatibility API.

       Tidak lagi mendeteksi:
       credit_cost
       credit_final

       Jika model sudah membawa pricing,
       normalize langsung.

       Jika belum, gunakan cache.
    ===================================================== */

    function getModelPrice(
        model,
        pricing = pricingCache
    ) {

        if (
            !model
        ) {

            return null;

        }


        /*
         * Model membawa pricing baru.
         */

        const hasResolutionPricing =

            RESOLUTIONS.some(
                function (
                    resolution
                ) {

                    return Object.prototype
                        .hasOwnProperty.call(
                            model,
                            `credit_${resolution}`
                        );

                }
            );


        if (
            hasResolutionPricing
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

                    credits: {

                        "480p":
                            normalized.credit_480p,

                        "720p":
                            normalized.credit_720p,

                        "1080p":
                            normalized.credit_1080p

                    },

                    creditFinal: {

                        "480p":
                            normalized.credit_final_480p,

                        "720p":
                            normalized.credit_final_720p,

                        "1080p":
                            normalized.credit_final_1080p

                    },

                    discountPercent:
                        normalized.discount_percent,

                    discountAmount: {

                        "480p":
                            normalized.discount_amount_480p,

                        "720p":
                            normalized.discount_amount_720p,

                        "1080p":
                            normalized.discount_amount_1080p

                    }

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


        if (
            matches.length === 0
        ) {

            return null;

        }


        const item =
            matches[0];


        return {

            pricing:
                matches,

            item,

            credits: {

                "480p":
                    toNumber(
                        item.credit_480p
                    ),

                "720p":
                    toNumber(
                        item.credit_720p
                    ),

                "1080p":
                    toNumber(
                        item.credit_1080p
                    )

            },

            creditFinal: {

                "480p":
                    toNumber(
                        item.credit_final_480p
                    ),

                "720p":
                    toNumber(
                        item.credit_final_720p
                    ),

                "1080p":
                    toNumber(
                        item.credit_final_1080p
                    )

            },

            discountPercent:
                toNumber(
                    item.discount_percent
                ) ?? 0,

            discountAmount: {

                "480p":
                    toNumber(
                        item.discount_amount_480p
                    ),

                "720p":
                    toNumber(
                        item.discount_amount_720p
                    ),

                "1080p":
                    toNumber(
                        item.discount_amount_1080p
                    )

            }

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

                discountPercent:
                    0,

                credits: {

                    "480p":
                        null,

                    "720p":
                        null,

                    "1080p":
                        null

                },

                discountAmount: {

                    "480p":
                        null,

                    "720p":
                        null,

                    "1080p":
                        null

                },

                creditFinal: {

                    "480p":
                        null,

                    "720p":
                        null,

                    "1080p":
                        null

                }

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

                discountPercent:
                    0,

                credits: {

                    "480p":
                        null,

                    "720p":
                        null,

                    "1080p":
                        null

                },

                discountAmount: {

                    "480p":
                        null,

                    "720p":
                        null,

                    "1080p":
                        null

                },

                creditFinal: {

                    "480p":
                        null,

                    "720p":
                        null,

                    "1080p":
                        null

                }

            };

        }


        return {

            discountPercent:
                normalized.discount_percent,

            credits: {

                "480p":
                    normalized.credit_480p,

                "720p":
                    normalized.credit_720p,

                "1080p":
                    normalized.credit_1080p

            },

            discountAmount: {

                "480p":
                    normalized.discount_amount_480p,

                "720p":
                    normalized.discount_amount_720p,

                "1080p":
                    normalized.discount_amount_1080p

            },

            creditFinal: {

                "480p":
                    normalized.credit_final_480p,

                "720p":
                    normalized.credit_final_720p,

                "1080p":
                    normalized.credit_final_1080p

            }

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
       RENDER RESOLUTION ROW
       ===================================================== */

    function renderResolutionPriceRow(
        item,
        resolution
    ) {

        const pricing =
            getResolutionPricing(
                item,
                resolution
            );


        if (
            !pricing
        ) {

            return "";

        }


        const hasCredit =
            pricing.credit !== null;


        const hasFinal =
            pricing.credit_final !== null;


        if (
            !hasCredit &&
            !hasFinal
        ) {

            return "";

        }


        return `
            <div class="model-price-resolution">

                <div class="model-price-resolution-title">
                    ${escapeHtml(
                        resolution
                    )}
                </div>

                <div class="model-price-resolution-row">

                    <span>
                        Credit
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                pricing.credit
                            )
                        )}
                    </strong>

                </div>

                <div class="model-price-resolution-row">

                    <span>
                        Diskon
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                pricing.discount_percent
                            )
                        )}%
                    </strong>

                </div>

                <div class="model-price-resolution-row">

                    <span>
                        Credit Final
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                pricing.credit_final
                            )
                        )}
                    </strong>

                </div>

            </div>
        `;

    }


    /* =====================================================
       RENDER MODEL PRICE
       -----------------------------------------------------
       Menampilkan pricing per resolusi.
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
            RESOLUTIONS
                .map(
                    function (
                        resolution
                    ) {

                        return renderResolutionPriceRow(
                            item,
                            resolution
                        );

                    }
                )
                .filter(
                    Boolean
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
       ----------------------------------------------------- */

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
                    function (
                        item
                    ) {

                        const resolutionRows =
                            RESOLUTIONS
                                .map(
                                    function (
                                        resolution
                                    ) {

                                        const data =
                                            getResolutionPricing(
                                                item,
                                                resolution
                                            );


                                        if (
                                            !data ||
                                            (
                                                data.credit === null &&
                                                data.credit_final === null
                                            )
                                        ) {

                                            return "";

                                        }


                                        return `
                                            <div class="model-price-preview-resolution">

                                                <div>
                                                    <strong>
                                                        ${escapeHtml(
                                                            resolution
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    Credit:
                                                    <strong>
                                                        ${escapeHtml(
                                                            formatCredit(
                                                                data.credit
                                                            )
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    Diskon:
                                                    <strong>
                                                        ${escapeHtml(
                                                            formatCredit(
                                                                data.discount_percent
                                                            )
                                                        )}%
                                                    </strong>
                                                </div>

                                                <div>
                                                    Final:
                                                    <strong>
                                                        ${escapeHtml(
                                                            formatCredit(
                                                                data.credit_final
                                                            )
                                                        )}
                                                    </strong>
                                                </div>

                                            </div>
                                        `;

                                    }
                                )
                                .filter(
                                    Boolean
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

                                <div class="model-price-preview-pricing">

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


        const lowestValues =
            summary.lowest
                ? getFinalCreditValues(
                    summary.lowest
                )
                : [];


        const highestValues =
            summary.highest
                ? getFinalCreditValues(
                    summary.highest
                )
                : [];


        const lowest =
            lowestValues.length > 0
                ? Math.min(
                    ...lowestValues
                )
                : null;


        const highest =
            highestValues.length > 0
                ? Math.max(
                    ...highestValues
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
                                lowest
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
                                highest
                            )
                        )}
                    </strong>

                </div>

                <div class="model-price-summary-row">

                    <span>
                        Rata-rata Credit
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatCredit(
                                summary.average
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

            /*
             * Lifecycle
             */

            initialize,

            reset,


            /*
             * Data / cache
             */

            loadPricing,

            filterPricing,

            findPricingForModel,

            getModelPricingById,

            getModelPricingByDbId,

            syncFromModels,

            clearCache,

            getCachedPricing,

            hasCachedPricing,


            /*
             * Normalization
             */

            normalizeModelPricing,

            normalizeModelList,


            /*
             * Resolution pricing
             */

            getResolutionCredit,

            getResolutionPricing,

            getAllResolutionPricing,


            /*
             * Model pricing lookup
             */

            getModelPrice,

            getCreditSummary,


            /*
             * Price aggregation
             */

            getLowestPrice,

            getHighestPrice,

            getAveragePrice,

            getPriceSummary,


            /*
             * Credit calculation
             */

            calculateCost,

            calculateDiscountAmount,

            calculateCreditFinal,


            /*
             * Currency compatibility
             */

            priceToIdr,

            idrToUsd,

            getUsdToIdrRate,

            setUsdToIdrRate,


            /*
             * Formatting
             */

            formatCredit,

            formatUsd,

            formatIdr,


            /*
             * Rendering
             */

            renderPrice,

            renderPricePreview,

            renderPriceSummary

        });


    console.info(
        "[GEN-Z.AI] GENZModelsPrice loaded."
    );

})();
