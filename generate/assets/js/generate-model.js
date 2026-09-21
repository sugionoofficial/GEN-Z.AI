/* =========================================================
   GEN-Z.AI
   GENERATE MODEL MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-model.js

   Tanggung jawab:
   - Load model dari /api/model-config
   - Menampilkan model aktif
   - Resolve model terpilih
   - Menyimpan model terpilih
   - Menyediakan konfigurasi lengkap untuk Generate Form
   - Menyediakan parameter model
   - Menyediakan credit pemakaian model

   SOURCE OF TRUTH:
   - Model             : /api/model-config
   - Model identity    : repository model registry
   - Parameters        : repository model parameters
   - Provider          : provider configuration
   - Model credit      : credit per resolution dari models-edit

   CREDIT:
   - credit_480p
   - credit_720p
   - credit_1080p
   - discount_percent

   FINAL CREDIT:
   - SELALU dihitung dari base credit + discount
   - Tidak menggunakan credit_final_* sebagai sumber
   - Tidak menggunakan credit_final global
   - Tidak menggunakan credit_cost global

   RUMUS:
   final = base - (base * discount / 100)

   PENTING:
   - Tidak mengambil credit akun
   - Tidak mengubah profiles.credits
   - Tidak membuat parameter palsu
   - Tidak membuat model palsu
   - Parameter harus diteruskan utuh ke currentModel
========================================================= */

"use strict";


/* =========================================================
   IMPORT STATE
========================================================= */

import {
    getGenerateElements,
    setCurrentModel,
    getCurrentModel,
    setAvailableModels,
    getAvailableModels,
    findAvailableModel,
    setModelLoaded,
    isModelLoaded
} from "./generate-state.js";


/* =========================================================
   IMPORT AUTH
========================================================= */

import {
    getAccessToken
} from "./generate-auth.js";


/* =========================================================
   CONSTANT
========================================================= */

const MODEL_CONFIG_ENDPOINT =
    "/api/model-config";


const SELECTED_MODEL_STORAGE_KEY =
    "genz_generate_selected_model";


/* =========================================================
   CREDIT RESOLUTIONS
========================================================= */

const CREDIT_RESOLUTIONS = [
    "480p",
    "720p",
    "1080p"
];


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(
    value,
    fallback = ""
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;

    }


    const result =
        String(value).trim();


    return result || fallback;

}


/* =========================================================
   SAFE BOOLEAN
========================================================= */

function safeBoolean(
    value,
    fallback = false
) {

    if (
        typeof value ===
        "boolean"
    ) {

        return value;

    }


    if (
        typeof value ===
        "string"
    ) {

        const normalized =
            value
                .trim()
                .toLowerCase();


        if (
            normalized ===
            "true"
        ) {

            return true;

        }


        if (
            normalized ===
            "false"
        ) {

            return false;

        }

    }


    return fallback;

}


/* =========================================================
   SAFE NUMBER
========================================================= */

function safeNumber(
    value,
    fallback = null
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;

    }


    /*
     * Jangan menerima object,
     * array atau string kosong
     * sebagai angka.
     */

    if (
        typeof value === "object"
    ) {

        return fallback;

    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : fallback;

}


/* =========================================================
   NORMALIZE RESOLUTION
========================================================= */

function normalizeResolution(
    value
) {

    const normalized =
        safeString(
            value
        ).toLowerCase();


    if (
        normalized === "480" ||
        normalized === "480p"
    ) {

        return "480p";

    }


    if (
        normalized === "720" ||
        normalized === "720p"
    ) {

        return "720p";

    }


    if (
        normalized === "1080" ||
        normalized === "1080p"
    ) {

        return "1080p";

    }


    return "";

}


/* =========================================================
   DISCOUNT CALCULATION
   ---------------------------------------------------------
   INI HARUS SAMA DENGAN models-edit.html
========================================================= */

function calculateDiscountedCredit(
    baseCredit,
    discountPercent
) {

    const base =
        safeNumber(
            baseCredit
        );


    if (
        base === null
    ) {

        return null;

    }


    const discount =
        safeNumber(
            discountPercent,
            0
        );


    const normalizedDiscount =
        Math.max(
            0,
            Math.min(
                100,
                discount
            )
        );


    const finalCredit =
        base -
        (
            base *
            normalizedDiscount /
            100
        );


    return Number.isFinite(
        finalCredit
    )
        ? finalCredit
        : null;

}


/* =========================================================
   GET CREDIT SOURCE OBJECTS
========================================================= */

function getCreditSourceObjects(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return [];

    }


    const sources = [];


    const addSource =
        source => {

            if (
                source &&
                typeof source ===
                "object" &&
                !Array.isArray(source)
            ) {

                /*
                 * Hindari object yang sama
                 * dimasukkan berkali-kali.
                 */

                if (
                    !sources.includes(
                        source
                    )
                ) {

                    sources.push(
                        source
                    );

                }

            }

        };


    /*
     * ROOT MODEL HARUS MENJADI
     * SUMBER UTAMA.
     *
     * Ini penting karena /api/model-config
     * dapat mengembalikan credit langsung
     * pada object model.
     */

    addSource(
        model
    );


    addSource(
        model.pricing
    );


    addSource(
        model.config
    );


    addSource(
        model.config?.pricing
    );


    addSource(
        model.repository
    );


    addSource(
        model.repository?.pricing
    );


    addSource(
        model.model
    );


    addSource(
        model.model?.pricing
    );


    return sources;

}


/* =========================================================
   GET BASE RESOLUTION CREDIT
   ---------------------------------------------------------
   PENTING:
   Fungsi ini HANYA mencari BASE CREDIT.

   Tidak pernah mengambil credit_final_*.
========================================================= */

function getResolutionBaseCredit(
    model,
    resolution
) {

    const normalizedResolution =
        normalizeResolution(
            resolution
        );


    if (
        !normalizedResolution
    ) {

        return null;

    }


    const sources =
        getCreditSourceObjects(
            model
        );


    const suffix =
        normalizedResolution;


    const compactSuffix =
        normalizedResolution.replace(
            "p",
            ""
        );


    const propertyCandidates = [

        `credit_${suffix}`,

        `credit${suffix}`,

        `credit_${compactSuffix}`,

        `credit${compactSuffix}`,

        `base_credit_${suffix}`,

        `baseCredit_${suffix}`,

        `base_credit_${compactSuffix}`,

        `baseCredit_${compactSuffix}`

    ];


    /*
     * =====================================================
     * DIRECT PROPERTIES
     * =====================================================
     */

    for (
        const source
        of sources
    ) {

        for (
            const property
            of propertyCandidates
        ) {

            const value =
                safeNumber(
                    source[property]
                );


            if (
                value !== null
            ) {

                return value;

            }

        }


        /*
         * =================================================
         * resolutions
         *
         * {
         *   "480p": {
         *      credit: 9
         *   }
         * }
         *
         * credit di sini dianggap BASE,
         * bukan final.
         * =================================================
         */

        const resolutions =
            source.resolutions;


        if (
            resolutions &&
            typeof resolutions ===
            "object"
        ) {

            const resolutionConfig =
                resolutions[
                    normalizedResolution
                ] ||
                resolutions[
                    compactSuffix
                ];


            if (
                resolutionConfig &&
                typeof resolutionConfig ===
                "object"
            ) {

                const value =

                    resolutionConfig.credit ??

                    resolutionConfig.credit_cost ??

                    resolutionConfig.creditCost ??

                    resolutionConfig.base_credit ??

                    resolutionConfig.baseCredit ??

                    null;


                const number =
                    safeNumber(
                        value
                    );


                if (
                    number !== null
                ) {

                    return number;

                }

            }

        }

    }


    return null;

}


/* =========================================================
   GET DISCOUNT PERCENT
========================================================= */

function getDiscountPercent(
    model
) {

    const sources =
        getCreditSourceObjects(
            model
        );


    for (
        const source
        of sources
    ) {

        const value =

            source.discount_percent ??

            source.discountPercent;


        const number =
            safeNumber(
                value
            );


        if (
            number !== null
        ) {

            /*
             * Sama seperti models-edit:
             * discount dibatasi 0-100.
             */

            return Math.max(
                0,
                Math.min(
                    100,
                    number
                )
            );

        }

    }


    return 0;

}


/* =========================================================
   GET RESOLUTION CREDIT
   ---------------------------------------------------------
   SUMBER FINAL:
   BASE CREDIT + DISCOUNT

   JANGAN mengambil credit_final_* dari backend.
========================================================= */

function getResolutionCredit(
    model,
    resolution
) {

    const normalizedResolution =
        normalizeResolution(
            resolution
        );


    if (
        !normalizedResolution
    ) {

        return null;

    }


    /*
     * 1. Ambil BASE CREDIT.
     *
     * Contoh:
     * credit_480p = 9
     */

    const baseCredit =
        getResolutionBaseCredit(
            model,
            normalizedResolution
        );


    if (
        baseCredit === null
    ) {

        return null;

    }


    /*
     * 2. Ambil DISCOUNT.
     *
     * Contoh:
     * discount_percent = 10
     */

    const discountPercent =
        getDiscountPercent(
            model
        );


    /*
     * 3. Hitung FINAL CREDIT.
     *
     * 9 - (9 * 10 / 100)
     * = 8.1
     */

    const finalCredit =
        calculateDiscountedCredit(
            baseCredit,
            discountPercent
        );


    console.debug(
        "[GEN-Z.AI][Generate Model] CREDIT CALCULATION:",
        {

            resolution:
                normalizedResolution,

            baseCredit,

            discountPercent,

            finalCredit

        }
    );


    return finalCredit;

}


/* =========================================================
   GET MODEL CREDIT
========================================================= */

function getModelCredit(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return {

            creditCost:
                null,

            discountPercent:
                0,

            creditFinal:
                null,

            credit480p:
                null,

            credit720p:
                null,

            credit1080p:
                null,

            creditFinal480p:
                null,

            creditFinal720p:
                null,

            creditFinal1080p:
                null

        };

    }


    const discountPercent =
        getDiscountPercent(
            model
        );


    const credit480p =
        getResolutionBaseCredit(
            model,
            "480p"
        );


    const credit720p =
        getResolutionBaseCredit(
            model,
            "720p"
        );


    const credit1080p =
        getResolutionBaseCredit(
            model,
            "1080p"
        );


    /*
     * FINAL CREDIT SELALU
     * DIHITUNG ULANG DARI BASE
     * + DISCOUNT.
     */

    const creditFinal480p =
        calculateDiscountedCredit(
            credit480p,
            discountPercent
        );


    const creditFinal720p =
        calculateDiscountedCredit(
            credit720p,
            discountPercent
        );


    const creditFinal1080p =
        calculateDiscountedCredit(
            credit1080p,
            discountPercent
        );


    return {

        /*
         * Legacy compatibility.
         *
         * Sengaja null.
         * Harga Generate tidak boleh
         * mengambil credit global.
         */

        creditCost:
            null,

        discountPercent,

        creditFinal:
            null,

        credit480p,

        credit720p,

        credit1080p,

        /*
         * Field ini adalah HASIL HITUNG,
         * bukan sumber database.
         */

        creditFinal480p,

        creditFinal720p,

        creditFinal1080p

    };

}


/* =========================================================
   GET MODEL CREDIT FOR RESOLUTION
========================================================= */

function getModelCreditForResolution(
    model,
    resolution
) {

    const normalizedResolution =
        normalizeResolution(
            resolution
        );


    const discountPercent =
        getDiscountPercent(
            model
        );


    if (
        !normalizedResolution
    ) {

        return {

            resolution:
                "",

            baseCredit:
                null,

            discountPercent,

            creditFinal:
                null

        };

    }


    /*
     * Ambil BASE CREDIT saja.
     */

    const baseCredit =
        getResolutionBaseCredit(
            model,
            normalizedResolution
        );


    /*
     * FINAL selalu dihitung ulang.
     *
     * Tidak peduli backend mengirim:
     *
     * credit_final_480p
     * creditFinal480p
     * resolutions.480p.credit_final
     *
     * Field-field tersebut tidak menjadi
     * sumber harga Generate.
     */

    const creditFinal =
        calculateDiscountedCredit(
            baseCredit,
            discountPercent
        );


    return {

        resolution:
            normalizedResolution,

        baseCredit,

        discountPercent,

        creditFinal

    };

}


/* =========================================================
   BUILD NORMALIZED CREDIT
========================================================= */

function buildNormalizedCredit(
    model
) {

    const credit =
        getModelCredit(
            model
        );


    return {

        /*
         * BASE CREDIT
         */

        credit_480p:
            credit.credit480p,

        credit_720p:
            credit.credit720p,

        credit_1080p:
            credit.credit1080p,


        /*
         * FINAL CREDIT
         *
         * Derived value.
         * BUKAN source of truth.
         */

        credit_final_480p:
            credit.creditFinal480p,

        credit_final_720p:
            credit.creditFinal720p,

        credit_final_1080p:
            credit.creditFinal1080p,


        /*
         * CamelCase compatibility.
         */

        creditFinal480p:
            credit.creditFinal480p,

        creditFinal720p:
            credit.creditFinal720p,

        creditFinal1080p:
            credit.creditFinal1080p,


        /*
         * DISCOUNT
         */

        discount_percent:
            credit.discountPercent,

        discountPercent:
            credit.discountPercent

    };

}


/* =========================================================
   STORAGE
========================================================= */

function getStoredModelId() {

    try {

        return String(
            localStorage.getItem(
                SELECTED_MODEL_STORAGE_KEY
            ) || ""
        ).trim();

    } catch {

        return "";

    }

}


/* =========================================================
   SAVE SELECTED MODEL
========================================================= */

function saveSelectedModelId(
    modelId
) {

    const normalized =
        safeString(
            modelId
        );


    if (!normalized) {

        return;

    }


    try {

        localStorage.setItem(
            SELECTED_MODEL_STORAGE_KEY,
            normalized
        );

    } catch {

        /* localStorage optional */

    }

}


/* =========================================================
   ELEMENTS
========================================================= */

function getElements() {

    try {

        return getGenerateElements();

    } catch {

        return {

            modelSelector:
                document.getElementById(
                    "modelSelector"
                ),

            modelSelect:
                document.getElementById(
                    "modelSelect"
                )

        };

    }

}


/* =========================================================
   MODEL ID
========================================================= */

function getModelId(
    model
) {

    if (!model) {

        return "";

    }


    return safeString(

        model.model_id ||

        model.config?.id ||

        model.id ||

        model.model?.model_id ||

        model.model?.id

    );

}


/* =========================================================
   MODEL NAME
========================================================= */

function getModelName(
    model
) {

    if (!model) {

        return "Model";

    }


    return safeString(

        model.model_name ||

        model.name ||

        model.config?.name ||

        model.repository?.model_name ||

        model.model?.model_name ||

        model.model?.name ||

        model.model_id ||

        model.id,

        "Model"

    );

}


/* =========================================================
   PROVIDER OBJECT
========================================================= */

function getProviderObject(
    model
) {

    if (
        model?.provider &&
        typeof model.provider ===
        "object"
    ) {

        return model.provider;

    }


    return null;

}


/* =========================================================
   PROVIDER ID
========================================================= */

function getProviderId(
    model
) {

    const provider =
        getProviderObject(model);


    return safeString(

        model?.provider_code ||

        model?.provider_id ||

        provider?.provider_id ||

        provider?.id ||

        model?.repository?.provider_id

    );

}


/* =========================================================
   PROVIDER NAME
========================================================= */

function getProviderName(
    model
) {

    const provider =
        getProviderObject(model);


    return safeString(

        model?.provider_name ||

        provider?.provider_name ||

        provider?.name ||

        model?.repository?.provider_name ||

        model?.provider_code ||

        model?.provider_id,

        "-"

    );

}


/* =========================================================
   PROVIDER STATUS
========================================================= */

function getProviderStatus(
    model
) {

    const provider =
        getProviderObject(model);


    return safeString(

        model?.provider_status ||

        provider?.status,

        ""

    ).toLowerCase();

}


/* =========================================================
   MODEL STATUS
========================================================= */

function getModelStatus(
    model
) {

    return safeString(
        model?.status,
        "active"
    ).toLowerCase();

}


/* =========================================================
   ADAPTER
========================================================= */

function hasAdapter(
    model
) {

    if (
        model &&
        Object.prototype.hasOwnProperty.call(
            model,
            "adapter_available"
        )
    ) {

        return safeBoolean(
            model.adapter_available,
            false
        );

    }


    if (
        model?.adapter &&
        typeof model.adapter ===
        "object"
    ) {

        return true;

    }


    return false;

}


/* =========================================================
   NORMALIZE PARAMETER COLLECTION
========================================================= */

function normalizeParameterCollection(
    value
) {

    if (
        !value
    ) {

        return {};

    }


    if (
        Array.isArray(value)
    ) {

        const result = {};


        value.forEach(
            parameter => {

                if (
                    !parameter ||
                    typeof parameter !==
                    "object"
                ) {

                    return;

                }


                const name =
                    safeString(

                        parameter.name ||

                        parameter.key ||

                        parameter.id

                    );


                if (!name) {

                    return;

                }


                const definition = {
                    ...parameter
                };


                delete definition.name;
                delete definition.key;
                delete definition.id;


                result[name] =
                    definition;

            }
        );


        return result;

    }


    if (
        typeof value !==
        "object"
    ) {

        return {};

    }


    if (
        value.parameters &&
        typeof value.parameters ===
        "object"
    ) {

        return normalizeParameterCollection(
            value.parameters
        );

    }


    if (
        value.properties &&
        typeof value.properties ===
        "object"
    ) {

        return normalizeParameterCollection(
            value.properties
        );

    }


    const result = {};


    Object.entries(value)
        .forEach(
            (
                [
                    key,
                    definition
                ]
            ) => {

                if (
                    !key ||
                    definition ===
                    undefined
                ) {

                    return;

                }


                result[key] =
                    definition;

            }
        );


    return result;

}


/* =========================================================
   EXTRACT MODEL PARAMETERS
========================================================= */

function extractModelParameters(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return {};

    }


    const candidates = [

        model.parameters,

        model.config?.parameters,

        model.repository?.parameters,

        model.model?.parameters,

        model.parameter_schema,

        model.parameterSchema,

        model.config?.parameter_schema,

        model.config?.parameterSchema,

        model.repository?.parameter_schema,

        model.repository?.parameterSchema,

        model.model?.parameter_schema,

        model.model?.parameterSchema

    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            !candidate
        ) {

            continue;

        }


        const normalized =
            normalizeParameterCollection(
                candidate
            );


        if (
            Object.keys(
                normalized
            ).length > 0
        ) {

            return normalized;

        }

    }


    return {};

}


/* =========================================================
   HAS PARAMETERS
========================================================= */

function hasParameters(
    model
) {

    const parameters =
        extractModelParameters(
            model
        );


    return (
        Object.keys(
            parameters
        ).length > 0
    );

}


/* =========================================================
   MODEL VISIBILITY
========================================================= */

function isVisibleModel(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return false;

    }


    const modelId =
        getModelId(model);


    if (!modelId) {

        return false;

    }


    const status =
        getModelStatus(model);


    const hiddenStatuses = [

        "inactive",
        "disabled",
        "deleted",
        "archived"

    ];


    if (
        hiddenStatuses.includes(
            status
        )
    ) {

        return false;

    }


    const providerStatus =
        getProviderStatus(model);


    const hiddenProviderStatuses = [

        "inactive",
        "disabled",
        "deleted",
        "archived",
        "suspended"

    ];


    if (
        hiddenProviderStatuses.includes(
            providerStatus
        )
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   MODEL EXECUTABLE
========================================================= */

function isExecutableModel(
    model
) {

    if (
        !isVisibleModel(model)
    ) {

        return false;

    }


    const modelId =
        getModelId(model);


    if (!modelId) {

        return false;

    }


    if (
        Object.prototype.hasOwnProperty.call(
            model,
            "adapter_available"
        )
    ) {

        if (
            safeBoolean(
                model.adapter_available,
                false
            ) === false
        ) {

            return false;

        }

    }


    const providerStatus =
        getProviderStatus(model);


    if (
        providerStatus &&
        providerStatus !==
        "active"
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   NORMALIZE MODEL
========================================================= */

function normalizeModel(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return null;

    }


    const normalized = {
        ...model
    };


    const modelId =
        getModelId(model);


    const modelName =
        getModelName(model);


    const providerId =
        getProviderId(model);


    const providerName =
        getProviderName(model);


    const parameters =
        extractModelParameters(
            model
        );


    if (
        !normalized.model_id &&
        modelId
    ) {

        normalized.model_id =
            modelId;

    }


    if (
        !normalized.model_name &&
        modelName
    ) {

        normalized.model_name =
            modelName;

    }


    if (
        !normalized.provider_id &&
        providerId
    ) {

        normalized.provider_id =
            providerId;

    }


    if (
        !normalized.provider_name &&
        providerName
    ) {

        normalized.provider_name =
            providerName;

    }


    normalized.parameters =
        parameters;


    normalized.parameter_schema =
        parameters;


    normalized.parameterSchema =
        parameters;


    if (
        !normalized.provider_status
    ) {

        normalized.provider_status =
            getProviderStatus(model);

    }


    /* =====================================================
       CREDIT PER RESOLUTION
    ===================================================== */

    const credit =
        getModelCredit(
            model
        );


    const normalizedCredit =
        buildNormalizedCredit(
            model
        );


    const existingPricing =
        normalized.pricing &&
        typeof normalized.pricing ===
        "object"

            ? normalized.pricing

            : {};


    /*
     * Buang SEMUA credit global lama.
     */

    const {

        credit_final:
            ignoredGlobalCreditFinal,

        creditFinal:
            ignoredGlobalCreditFinalCamel,

        credit_cost:
            ignoredGlobalCreditCost,

        creditCost:
            ignoredGlobalCreditCostCamel,

        ...pricingWithoutGlobalLegacy

    } = existingPricing;


    normalized.pricing = {

        ...pricingWithoutGlobalLegacy,

        ...normalizedCredit

    };


    normalized.credit_480p =
        credit.credit480p;

    normalized.credit_720p =
        credit.credit720p;

    normalized.credit_1080p =
        credit.credit1080p;


    /*
     * Field final di bawah ini adalah
     * DERIVED VALUE dari base + discount.
     */

    normalized.credit_final_480p =
        credit.creditFinal480p;

    normalized.credit_final_720p =
        credit.creditFinal720p;

    normalized.credit_final_1080p =
        credit.creditFinal1080p;


    normalized.creditFinal480p =
        credit.creditFinal480p;

    normalized.creditFinal720p =
        credit.creditFinal720p;

    normalized.creditFinal1080p =
        credit.creditFinal1080p;


    normalized.discount_percent =
        credit.discountPercent;


    normalized.discountPercent =
        credit.discountPercent;


    delete normalized.credit_final;
    delete normalized.creditFinal;
    delete normalized.credit_cost;
    delete normalized.creditCost;


    normalized.model_id =
        safeString(
            normalized.model_id
        );


    normalized.model_name =
        safeString(
            normalized.model_name,
            "Model"
        );


    normalized.provider_name =
        safeString(
            normalized.provider_name,
            "-"
        );


    console.debug(
        "[GEN-Z.AI][Generate Model] NORMALIZED MODEL:",
        {

            model_id:
                normalized.model_id,

            model_name:
                normalized.model_name,

            provider:
                normalized.provider_name,

            credit: {

                base_480p:
                    normalized.credit_480p,

                base_720p:
                    normalized.credit_720p,

                base_1080p:
                    normalized.credit_1080p,

                final_480p:
                    normalized.credit_final_480p,

                final_720p:
                    normalized.credit_final_720p,

                final_1080p:
                    normalized.credit_final_1080p,

                discount:
                    normalized.discount_percent

            },

            parameter_count:
                Object.keys(
                    normalized.parameters || {}
                ).length,

            parameter_keys:
                Object.keys(
                    normalized.parameters || {}
                )

        }
    );


    return normalized;

}


/* =========================================================
   MERGE MODEL CONFIGURATION
========================================================= */

function mergeModelConfiguration(
    detailModel,
    listModel
) {

    if (
        !detailModel &&
        !listModel
    ) {

        return null;

    }


    if (
        !detailModel
    ) {

        return normalizeModel(
            listModel
        );

    }


    if (
        !listModel
    ) {

        return normalizeModel(
            detailModel
        );

    }


    const merged = {

        ...listModel,

        ...detailModel

    };


    const detailParameters =
        extractModelParameters(
            detailModel
        );


    const listParameters =
        extractModelParameters(
            listModel
        );


    const finalParameters =
        Object.keys(
            detailParameters
        ).length > 0

            ? detailParameters

            : listParameters;


    merged.parameters =
        finalParameters;


    merged.parameter_schema =
        finalParameters;


    merged.parameterSchema =
        finalParameters;


    if (
        !merged.config &&
        listModel.config
    ) {

        merged.config =
            listModel.config;

    }


    if (
        merged.config &&
        typeof merged.config ===
        "object"
    ) {

        merged.config = {

            ...merged.config,

            parameters:
                finalParameters

        };

    }


    if (
        merged.repository &&
        typeof merged.repository ===
        "object"
    ) {

        merged.repository = {

            ...merged.repository,

            parameters:
                finalParameters

        };

    }


    /* =====================================================
       CREDIT
       -----------------------------------------------------
       BASE CREDIT DAN DISCOUNT SAJA YANG
       DIANGGAP SOURCE OF TRUTH.
    ===================================================== */

    const detailCredit =
        getModelCredit(
            detailModel
        );


    const listCredit =
        getModelCredit(
            listModel
        );


    const chooseValue =
        (
            detailValue,
            listValue
        ) => (

            detailValue !== null &&
            detailValue !== undefined

                ? detailValue

                : listValue

        );


    merged.credit_480p =
        chooseValue(
            detailCredit.credit480p,
            listCredit.credit480p
        );


    merged.credit_720p =
        chooseValue(
            detailCredit.credit720p,
            listCredit.credit720p
        );


    merged.credit_1080p =
        chooseValue(
            detailCredit.credit1080p,
            listCredit.credit1080p
        );


    /*
     * DISCOUNT juga dipilih dari
     * detail terlebih dahulu.
     */

    merged.discount_percent =
        chooseValue(
            detailCredit.discountPercent,
            listCredit.discountPercent
        );


    if (
        merged.discount_percent ===
        null ||
        merged.discount_percent ===
        undefined
    ) {

        merged.discount_percent =
            0;

    }


    merged.discountPercent =
        merged.discount_percent;


    /*
     * JANGAN menggunakan final credit
     * dari detail/list model.
     *
     * Hitung ulang setelah merge.
     */

    const mergedCredit480p =
        calculateDiscountedCredit(
            merged.credit_480p,
            merged.discount_percent
        );


    const mergedCredit720p =
        calculateDiscountedCredit(
            merged.credit_720p,
            merged.discount_percent
        );


    const mergedCredit1080p =
        calculateDiscountedCredit(
            merged.credit_1080p,
            merged.discount_percent
        );


    merged.credit_final_480p =
        mergedCredit480p;


    merged.credit_final_720p =
        mergedCredit720p;


    merged.credit_final_1080p =
        mergedCredit1080p;


    merged.creditFinal480p =
        mergedCredit480p;


    merged.creditFinal720p =
        mergedCredit720p;


    merged.creditFinal1080p =
        mergedCredit1080p;


    /*
     * Jangan bawa legacy global credit.
     */

    delete merged.credit_final;
    delete merged.creditFinal;
    delete merged.credit_cost;
    delete merged.creditCost;


    /* =====================================================
       PRICING
    ===================================================== */

    const listPricing =
        listModel.pricing &&
        typeof listModel.pricing ===
        "object"

            ? listModel.pricing

            : {};


    const detailPricing =
        detailModel.pricing &&
        typeof detailModel.pricing ===
        "object"

            ? detailModel.pricing

            : {};


    const {

        credit_final:
            ignoredListGlobalCreditFinal,

        creditFinal:
            ignoredListGlobalCreditFinalCamel,

        credit_cost:
            ignoredListGlobalCreditCost,

        creditCost:
            ignoredListGlobalCreditCostCamel,

        ...safeListPricing

    } = listPricing;


    const {

        credit_final:
            ignoredDetailGlobalCreditFinal,

        creditFinal:
            ignoredDetailGlobalCreditFinalCamel,

        credit_cost:
            ignoredDetailGlobalCreditCost,

        creditCost:
            ignoredDetailGlobalCreditCostCamel,

        ...safeDetailPricing

    } = detailPricing;


    merged.pricing = {

        ...safeListPricing,

        ...safeDetailPricing,

        credit_480p:
            merged.credit_480p,

        credit_720p:
            merged.credit_720p,

        credit_1080p:
            merged.credit_1080p,

        /*
         * Derived final values.
         */

        credit_final_480p:
            merged.credit_final_480p,

        credit_final_720p:
            merged.credit_final_720p,

        credit_final_1080p:
            merged.credit_final_1080p,

        creditFinal480p:
            merged.creditFinal480p,

        creditFinal720p:
            merged.creditFinal720p,

        creditFinal1080p:
            merged.creditFinal1080p,

        discount_percent:
            merged.discount_percent,

        discountPercent:
            merged.discountPercent

    };


    return normalizeModel(
        merged
    );

}


/* =========================================================
   REQUEST MODEL CONFIG
========================================================= */

async function requestModelConfig(
    url
) {

    const accessToken =
        await getAccessToken();


    if (!accessToken) {

        throw new Error(
            "Session tidak ditemukan. Silakan login kembali."
        );

    }


    const response =
        await fetch(
            url,
            {

                method:
                    "GET",

                headers: {

                    Accept:
                        "application/json",

                    Authorization:
                        `Bearer ${accessToken}`

                },

                credentials:
                    "same-origin"

            }
        );


    let data =
        null;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Server mengembalikan response tidak valid (${response.status}).`
        );

    }


    if (
        !response.ok
    ) {

        const message =

            data?.error ||

            data?.message ||

            (
                Array.isArray(
                    data?.errors
                )
                    ? data.errors.join(
                        ", "
                    )
                    : ""
            ) ||

            `Gagal memuat model (${response.status}).`;


        throw new Error(
            message
        );

    }


    if (
        data &&
        data.success === false
    ) {

        throw new Error(

            data.error ||

            data.message ||

            "Konfigurasi model gagal dimuat."

        );

    }


    return data;

}


/* =========================================================
   EXTRACT MODELS
========================================================= */

function extractModels(
    data
) {

    if (
        Array.isArray(data)
    ) {

        return data;

    }


    if (
        Array.isArray(
            data?.models
        )
    ) {

        return data.models;

    }


    if (
        Array.isArray(
            data?.data
        )
    ) {

        return data.data;

    }


    if (
        Array.isArray(
            data?.data?.models
        )
    ) {

        return data.data.models;

    }


    return [];

}


/* =========================================================
   EXTRACT SINGLE MODEL
========================================================= */

function extractSingleModel(
    data
) {

    if (
        data?.model &&
        typeof data.model ===
        "object"
    ) {

        return data.model;

    }


    if (
        data?.data?.model &&
        typeof data.data.model ===
        "object"
    ) {

        return data.data.model;

    }


    if (
        data?.data &&
        typeof data.data ===
        "object" &&
        !Array.isArray(
            data.data
        ) &&
        (
            data.data.model_id ||
            data.data.id
        )
    ) {

        return data.data;

    }


    if (
        data &&
        typeof data ===
        "object" &&
        !Array.isArray(data) &&
        (
            data.model_id ||
            data.id
        )
    ) {

        return data;

    }


    return null;

}


/* =========================================================
   LOAD AVAILABLE MODELS
========================================================= */

export async function loadAvailableModels() {

    const data =
        await requestModelConfig(
            MODEL_CONFIG_ENDPOINT
        );


    const models =
        extractModels(
            data
        );


    const normalizedModels =
        models
            .map(
                normalizeModel
            )
            .filter(Boolean);


    const visibleModels =
        normalizedModels.filter(
            isVisibleModel
        );


    if (
        visibleModels.length ===
        0
    ) {

        throw new Error(
            "Tidak ada model aktif yang tersedia."
        );

    }


    setAvailableModels(
        visibleModels
    );


    console.log(
        "[GEN-Z.AI][Generate Model] AVAILABLE MODELS:",
        visibleModels.map(
            model => ({

                id:
                    getModelId(
                        model
                    ),

                name:
                    getModelName(
                        model
                    ),

                provider:
                    getProviderName(
                        model
                    ),

                parameterCount:
                    Object.keys(
                        model.parameters || {}
                    ).length,

                executable:
                    isExecutableModel(
                        model
                    ),

                credit: {

                    "480p":
                        getModelCreditForResolution(
                            model,
                            "480p"
                        ),

                    "720p":
                        getModelCreditForResolution(
                            model,
                            "720p"
                        ),

                    "1080p":
                        getModelCreditForResolution(
                            model,
                            "1080p"
                        )

                }

            })
        )
    );


    return visibleModels;

}


/* =========================================================
   RENDER MODEL SELECTOR
========================================================= */

export function renderModelSelector(
    models,
    preferredModelId = null
) {

    const elements =
        getElements();


    if (
        !elements
    ) {

        return null;

    }


    const modelSelect =
        elements.modelSelect;


    const modelSelector =
        elements.modelSelector;


    if (
        !modelSelect
    ) {

        throw new Error(
            "Element #modelSelect tidak ditemukan."
        );

    }


    modelSelect.innerHTML =
        "";


    const placeholder =
        document.createElement(
            "option"
        );


    placeholder.value =
        "";


    placeholder.textContent =
        "Pilih model...";


    placeholder.disabled =
        true;


    placeholder.selected =
        true;


    modelSelect.appendChild(
        placeholder
    );


    const normalizedModels =
        Array.isArray(models)

            ? models
                .map(
                    normalizeModel
                )
                .filter(Boolean)
                .filter(
                    isVisibleModel
                )

            : [];


    normalizedModels.forEach(
        model => {

            const modelId =
                getModelId(
                    model
                );


            if (!modelId) {

                return;

            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                modelId;


            const modelName =
                getModelName(
                    model
                );


            const providerName =
                getProviderName(
                    model
                );


            option.textContent =

                providerName &&
                providerName !== "-"

                    ? `${modelName} • ${providerName}`

                    : modelName;


            option.dataset.modelId =
                modelId;


            option.dataset.providerId =
                getProviderId(
                    model
                );


            option.dataset.providerName =
                providerName;


            option.dataset.parametersAvailable =

                hasParameters(model)

                    ? "true"

                    : "false";


            option.dataset.parameterCount =
                String(
                    Object.keys(
                        extractModelParameters(
                            model
                        )
                    ).length
                );


            const credit =
                getModelCredit(
                    model
                );


            /*
             * BASE CREDIT DATASET
             */

            option.dataset.credit480p =

                credit.credit480p !== null

                    ? String(
                        credit.credit480p
                    )

                    : "";


            option.dataset.credit720p =

                credit.credit720p !== null

                    ? String(
                        credit.credit720p
                    )

                    : "";


            option.dataset.credit1080p =

                credit.credit1080p !== null

                    ? String(
                        credit.credit1080p
                    )

                    : "";


            /*
             * FINAL CREDIT DATASET
             *
             * Derived dari base + discount.
             */

            option.dataset.creditFinal480p =

                credit.creditFinal480p !== null

                    ? String(
                        credit.creditFinal480p
                    )

                    : "";


            option.dataset.creditFinal720p =

                credit.creditFinal720p !== null

                    ? String(
                        credit.creditFinal720p
                    )

                    : "";


            option.dataset.creditFinal1080p =

                credit.creditFinal1080p !== null

                    ? String(
                        credit.creditFinal1080p
                    )

                    : "";


            option.dataset.discountPercent =

                String(
                    credit.discountPercent
                );


            /*
             * Legacy dikosongkan.
             */

            option.dataset.creditCost =
                "";


            option.dataset.creditFinal =
                "";


            option.dataset.executable =

                isExecutableModel(model)

                    ? "true"

                    : "false";


            modelSelect.appendChild(
                option
            );

        }
    );


    let selectedModelId =
        safeString(

            preferredModelId ||

            getStoredModelId()

        );


    const preferredExists =
        normalizedModels.some(
            model =>
                getModelId(model) ===
                selectedModelId
        );


    if (
        !preferredExists
    ) {

        const executableModel =
            normalizedModels.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (
            executableModel
        ) {

            selectedModelId =
                getModelId(
                    executableModel
                );

        } else if (
            normalizedModels.length
        ) {

            selectedModelId =
                getModelId(
                    normalizedModels[0]
                );

        } else {

            selectedModelId =
                "";

        }

    }


    if (
        selectedModelId
    ) {

        modelSelect.value =
            selectedModelId;


        saveSelectedModelId(
            selectedModelId
        );


        placeholder.selected =
            false;

    }


    modelSelect.disabled =
        normalizedModels.length ===
        0;


    if (
        modelSelector
    ) {

        modelSelector.classList.add(
            "show"
        );


        modelSelector.hidden =
            false;

    }


    return (
        selectedModelId ||
        null
    );

}


/* =========================================================
   FIND MODEL
========================================================= */

export function findModel(
    modelId
) {

    const normalizedId =
        safeString(
            modelId
        );


    if (!normalizedId) {

        return null;

    }


    const model =
        findAvailableModel(
            normalizedId
        );


    return normalizeModel(
        model
    );

}


/* =========================================================
   LOAD MODEL CONFIG
========================================================= */

export async function loadModelConfig(
    modelId
) {

    const normalizedId =
        safeString(
            modelId
        );


    if (!normalizedId) {

        throw new Error(
            "Model ID tidak ditemukan."
        );

    }


    const availableModels =
        getAvailableModels();


    const availableModel =
        availableModels.find(
            model =>
                getModelId(model) ===
                normalizedId
        ) || null;


    const params =
        new URLSearchParams();


    params.set(
        "model_id",
        normalizedId
    );


    const data =
        await requestModelConfig(

            `${MODEL_CONFIG_ENDPOINT}?${params.toString()}`

        );


    const rawDetailModel =
        extractSingleModel(
            data
        );


    const detailModel =
        normalizeModel(
            rawDetailModel
        );


    if (
        !detailModel ||
        !getModelId(detailModel)
    ) {

        if (
            availableModel
        ) {

            const fallback =
                normalizeModel(
                    availableModel
                );


            if (
                !fallback
            ) {

                throw new Error(
                    `Konfigurasi model "${normalizedId}" tidak ditemukan.`
                );

            }


            setCurrentModel(
                fallback
            );


            setModelLoaded(
                true
            );


            saveSelectedModelId(
                normalizedId
            );


            return fallback;

        }


        throw new Error(
            `Konfigurasi model "${normalizedId}" tidak ditemukan.`
        );

    }


    const serverModelId =
        getModelId(
            detailModel
        );


    if (
        serverModelId !==
        normalizedId
    ) {

        throw new Error(
            "Model ID dari server tidak sesuai dengan model yang diminta."
        );

    }


    const model =
        mergeModelConfiguration(

            detailModel,

            availableModel

        );


    if (
        !model
    ) {

        throw new Error(
            "Konfigurasi model gagal dibentuk."
        );

    }


    const parameters =
        extractModelParameters(
            model
        );


    model.parameters =
        parameters;


    model.parameter_schema =
        parameters;


    model.parameterSchema =
        parameters;


    const finalCredit =
        getModelCredit(
            model
        );


    console.log(
        "[GEN-Z.AI][Generate Model] DETAIL MODEL READY:",
        {

            model_id:
                getModelId(model),

            model_name:
                getModelName(model),

            provider:
                getProviderName(model),

            credit: {

                "480p":
                    getModelCreditForResolution(
                        model,
                        "480p"
                    ),

                "720p":
                    getModelCreditForResolution(
                        model,
                        "720p"
                    ),

                "1080p":
                    getModelCreditForResolution(
                        model,
                        "1080p"
                    )

            },

            normalizedCredit:
                finalCredit

        }
    );


    setCurrentModel(
        model
    );


    setModelLoaded(
        true
    );


    saveSelectedModelId(
        serverModelId
    );


    const verified =
        getCurrentModel();


    if (
        !verified ||
        getModelId(
            verified
        ) !==
        serverModelId
    ) {

        throw new Error(
            "Current model gagal disimpan."
        );

    }


    return verified;

}


/* =========================================================
   SELECT MODEL
========================================================= */

export async function selectModel(
    modelId
) {

    const normalizedId =
        safeString(
            modelId
        );


    if (!normalizedId) {

        setCurrentModel(
            null
        );


        setModelLoaded(
            false
        );


        return null;

    }


    const available =
        getAvailableModels();


    const selectedModel =
        available.find(
            model =>
                getModelId(model) ===
                normalizedId
        );


    if (
        !selectedModel
    ) {

        throw new Error(
            "Model yang dipilih tidak tersedia."
        );

    }


    return loadModelConfig(
        normalizedId
    );

}


/* =========================================================
   RESOLVE INITIAL MODEL
========================================================= */

export async function resolveInitialModel() {

    const storedModelId =
        getStoredModelId();


    const models =
        await loadAvailableModels();


    let selectedModelId =
        null;


    const storedModel =
        models.find(
            model =>
                getModelId(model) ===
                storedModelId &&
                isExecutableModel(
                    model
                )
        );


    if (
        storedModel
    ) {

        selectedModelId =
            getModelId(
                storedModel
            );

    }


    if (
        !selectedModelId
    ) {

        const executableModel =
            models.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (
            executableModel
        ) {

            selectedModelId =
                getModelId(
                    executableModel
                );

        }

    }


    const renderedModelId =
        renderModelSelector(

            models,

            selectedModelId

        );


    if (
        !selectedModelId
    ) {

        setCurrentModel(
            null
        );


        setModelLoaded(
            false
        );


        return {

            model:
                null,

            models,

            executable:
                false,

            selectedModelId:
                renderedModelId

        };

    }


    const model =
        await loadModelConfig(
            selectedModelId
        );


    const elements =
        getElements();


    if (
        elements?.modelSelect
    ) {

        elements.modelSelect.value =
            getModelId(
                model
            );

    }


    return {

        model,

        models,

        executable:
            true,

        selectedModelId

    };

}


/* =========================================================
   REFRESH MODELS
========================================================= */

export async function refreshModels(
    preferredModelId = null
) {

    const models =
        await loadAvailableModels();


    let selectedModelId =
        null;


    const preferredId =
        safeString(
            preferredModelId
        );


    if (
        preferredId
    ) {

        const preferredModel =
            models.find(
                model =>
                    getModelId(model) ===
                    preferredId &&
                    isExecutableModel(
                        model
                    )
            );


        if (
            preferredModel
        ) {

            selectedModelId =
                getModelId(
                    preferredModel
                );

        }

    }


    if (
        !selectedModelId
    ) {

        const executableModel =
            models.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (
            executableModel
        ) {

            selectedModelId =
                getModelId(
                    executableModel
                );

        }

    }


    const renderedModelId =
        renderModelSelector(

            models,

            selectedModelId

        );


    if (
        !selectedModelId
    ) {

        setCurrentModel(
            null
        );


        setModelLoaded(
            false
        );


        return {

            models,

            model:
                null,

            executable:
                false,

            selectedModelId:
                renderedModelId

        };

    }


    const model =
        await loadModelConfig(
            selectedModelId
        );


    return {

        models,

        model,

        executable:
            true,

        selectedModelId

    };

}


/* =========================================================
   GET MODEL
========================================================= */

export function getModel() {

    return getCurrentModel();

}


/* =========================================================
   MODEL CREDIT PUBLIC
========================================================= */

export function getModelCreditInfo(
    model = null
) {

    const targetModel =
        model ||
        getCurrentModel();


    return getModelCredit(
        targetModel
    );

}


/* =========================================================
   MODEL CREDIT BY RESOLUTION PUBLIC
   ---------------------------------------------------------
   KOMPATIBEL DENGAN:

   1. getModelCreditForSelectedResolution(
          "480p",
          model
      )

   2. getModelCreditForSelectedResolution(
          model,
          "480p"
      )
========================================================= */

export function getModelCreditForSelectedResolution(
    firstArgument = null,
    secondArgument = null
) {

    let model =
        null;

    let resolution =
        "";


    /*
     * Bentuk:
     *
     * (resolution, model)
     */

    if (
        typeof firstArgument ===
        "string"
    ) {

        resolution =
            firstArgument;


        if (
            secondArgument &&
            typeof secondArgument ===
            "object"
        ) {

            model =
                secondArgument;

        }

    }


    /*
     * Bentuk:
     *
     * (model, resolution)
     */

    else if (
        firstArgument &&
        typeof firstArgument ===
        "object"
    ) {

        model =
            firstArgument;


        if (
            typeof secondArgument ===
            "string"
        ) {

            resolution =
                secondArgument;

        }

    }


    /*
     * Jika model tidak dikirim,
     * gunakan current model.
     */

    if (
        !model
    ) {

        model =
            getCurrentModel();

    }


    const normalizedResolution =
        normalizeResolution(
            resolution
        );


    /*
     * Jika resolution masih kosong,
     * coba baca dari object model.
     *
     * Ini hanya compatibility fallback.
     */

    if (
        !normalizedResolution &&
        model
    ) {

        const possibleResolution =

            model.resolution ||

            model.selected_resolution ||

            model.selectedResolution;


        resolution =
            normalizeResolution(
                possibleResolution
            );

    }


    const result =
        getModelCreditForResolution(
            model,
            resolution
        );


    console.debug(
        "[GEN-Z.AI][Generate Model] CREDIT RESOLUTION:",
        {

            resolution:
                result.resolution,

            baseCredit:
                result.baseCredit,

            discountPercent:
                result.discountPercent,

            creditFinal:
                result.creditFinal,

            modelId:
                getModelId(
                    model
                )

        }
    );


    return result;

}


/* =========================================================
   MODEL READY
========================================================= */

export function isModelReady() {

    const model =
        getCurrentModel();


    return Boolean(

        isModelLoaded() &&

        model &&

        getModelId(model) &&

        isExecutableModel(model)

    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export const generateModel =
    Object.freeze({

        loadAvailableModels,

        renderModelSelector,

        findModel,

        loadModelConfig,

        selectModel,

        resolveInitialModel,

        refreshModels,

        getModel,

        getModelCreditInfo,

        getModelCreditForSelectedResolution,

        isModelReady

    });


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default generateModel;
