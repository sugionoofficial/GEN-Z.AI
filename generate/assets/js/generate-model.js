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
   - Model credit      : credit per resolution

   CREDIT:
   - credit_480p
   - credit_720p
   - credit_1080p
   - discount_percent
   - credit_final_480p
   - credit_final_720p
   - credit_final_1080p

   PENTING:
   - Tidak mengambil credit akun
   - Tidak mengubah profiles.credits
   - Tidak membuat parameter palsu
   - Tidak membuat model palsu
   - Tidak menggunakan credit_final global sebagai harga Generate
   - Tidak menggunakan credit_cost global sebagai harga Generate
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

                sources.push(
                    source
                );

            }

        };


    addSource(
        model.pricing
    );


    addSource(
        model
    );


    addSource(
        model.config?.pricing
    );


    addSource(
        model.config
    );


    addSource(
        model.repository?.pricing
    );


    addSource(
        model.repository
    );


    addSource(
        model.model?.pricing
    );


    addSource(
        model.model
    );


    return sources;

}


/* =========================================================
   GET RESOLUTION CREDIT VALUE
   ---------------------------------------------------------
   Mendukung beberapa bentuk response backend:

   credit_480p
   credit_720p
   credit_1080p

   pricing.credit_480p

   credit_final_480p
   pricing.credit_final_480p

   creditFinal480p
   pricing.creditFinal480p

   pricing.resolutions["480p"].credit
   pricing.resolutions["480p"].credit_final
========================================================= */

function getResolutionCreditValue(
    model,
    resolution,
    type = "base"
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


    const propertyCandidates =
        type === "final"

            ? [

                `credit_final_${suffix}`,

                `creditFinal_${suffix}`,

                `credit_final_${compactSuffix}`,

                `creditFinal_${compactSuffix}`,

                `final_credit_${suffix}`,

                `finalCredit_${suffix}`,

                `final_credit_${compactSuffix}`,

                `finalCredit_${compactSuffix}`

            ]

            : [

                `credit_${suffix}`,

                `credit${suffix}`,

                `credit_${compactSuffix}`,

                `credit${compactSuffix}`,

                `base_credit_${suffix}`,

                `baseCredit_${suffix}`,

                `base_credit_${compactSuffix}`,

                `baseCredit_${compactSuffix}`

            ];


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
         * Bentuk:
         *
         * resolutions: {
         *   "480p": {
         *      credit: 9
         *   }
         * }
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

                    type === "final"

                        ? (
                            resolutionConfig.credit_final ??
                            resolutionConfig.creditFinal ??
                            resolutionConfig.final_credit ??
                            resolutionConfig.finalCredit ??
                            resolutionConfig.credit
                        )

                        : (
                            resolutionConfig.credit ??
                            resolutionConfig.credit_cost ??
                            resolutionConfig.creditCost ??
                            resolutionConfig.base_credit ??
                            resolutionConfig.baseCredit
                        );


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

            return number;

        }

    }


    return 0;

}


/* =========================================================
   GET RESOLUTION CREDIT
   ---------------------------------------------------------
   FINAL SOURCE:

   1. credit_final_<resolution>
   2. credit_<resolution> + discount_percent

   Tidak pernah memakai credit_final global.
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
     * Backend dapat mengirim final
     * per resolution secara langsung.
     */

    const explicitFinal =
        getResolutionCreditValue(
            model,
            normalizedResolution,
            "final"
        );


    if (
        explicitFinal !== null
    ) {

        return explicitFinal;

    }


    /*
     * Kalau final tidak dikirim,
     * hitung dari base + discount.
     */

    const baseCredit =
        getResolutionCreditValue(
            model,
            normalizedResolution,
            "base"
        );


    if (
        baseCredit === null
    ) {

        return null;

    }


    const discountPercent =
        getDiscountPercent(
            model
        );


    return calculateDiscountedCredit(
        baseCredit,
        discountPercent
    );

}


/* =========================================================
   GET MODEL CREDIT
   ---------------------------------------------------------
   API PUBLIC / COMPATIBILITY.

   Penting:
   creditFinal di sini TIDAK lagi berasal dari
   credit_final global.

   Nilai creditFinal hanya akan tersedia jika
   semua resolution memiliki nilai yang sama,
   atau jika caller secara eksplisit meminta
   resolution tertentu melalui getModelCreditForResolution().
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
        getResolutionCreditValue(
            model,
            "480p",
            "base"
        );


    const credit720p =
        getResolutionCreditValue(
            model,
            "720p",
            "base"
        );


    const credit1080p =
        getResolutionCreditValue(
            model,
            "1080p",
            "base"
        );


    const creditFinal480p =
        getResolutionCredit(
            model,
            "480p"
        );


    const creditFinal720p =
        getResolutionCredit(
            model,
            "720p"
        );


    const creditFinal1080p =
        getResolutionCredit(
            model,
            "1080p"
        );


    /*
     * Jangan lagi membaca:
     *
     * model.credit_final
     * pricing.credit_final
     *
     * sebagai harga Generate.
     *
     * Angka global seperti 50 justru
     * merupakan sumber bug yang sedang kita
     * hilangkan.
     */

    return {

        /*
         * Legacy compatibility.
         *
         * Tetap disediakan agar module lain
         * tidak error, tetapi nilainya hanya
         * berasal dari resolution pricing.
         */

        creditCost:
            null,

        discountPercent,

        creditFinal:
            null,

        credit480p,

        credit720p,

        credit1080p,

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


    if (
        !normalizedResolution
    ) {

        return {

            resolution:
                "",

            baseCredit:
                null,

            discountPercent:
                getDiscountPercent(
                    model
                ),

            creditFinal:
                null

        };

    }


    const baseCredit =
        getResolutionCreditValue(
            model,
            normalizedResolution,
            "base"
        );


    const explicitFinal =
        getResolutionCreditValue(
            model,
            normalizedResolution,
            "final"
        );


    const discountPercent =
        getDiscountPercent(
            model
        );


    const creditFinal =

        explicitFinal !== null

            ? explicitFinal

            : calculateDiscountedCredit(
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
         * Base credit.
         */

        credit_480p:
            credit.credit480p,

        credit_720p:
            credit.credit720p,

        credit_1080p:
            credit.credit1080p,


        /*
         * Final credit.
         */

        credit_final_480p:
            credit.creditFinal480p,

        credit_final_720p:
            credit.creditFinal720p,

        credit_final_1080p:
            credit.creditFinal1080p,


        /*
         * Camel-case compatibility.
         */

        creditFinal480p:
            credit.creditFinal480p,

        creditFinal720p:
            credit.creditFinal720p,

        creditFinal1080p:
            credit.creditFinal1080p,


        /*
         * Discount.
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


    /* -----------------------------------------------------
       ARRAY
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       OBJECT
    ----------------------------------------------------- */

    if (
        typeof value !==
        "object"
    ) {

        return {};

    }


    /* -----------------------------------------------------
       NESTED PARAMETERS
    ----------------------------------------------------- */

    if (
        value.parameters &&
        typeof value.parameters ===
        "object"
    ) {

        return normalizeParameterCollection(
            value.parameters
        );

    }


    /* -----------------------------------------------------
       NESTED SCHEMA
    ----------------------------------------------------- */

    if (
        value.properties &&
        typeof value.properties ===
        "object"
    ) {

        return normalizeParameterCollection(
            value.properties
        );

    }


    /* -----------------------------------------------------
       COPY OBJECT
    ----------------------------------------------------- */

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


    /*
     * PENTING:
     * Selalu tulis parameters hasil ekstraksi
     * ke root model.
     */

    normalized.parameters =
        parameters;


    /*
     * Compatibility schema.
     */

    normalized.parameter_schema =
        parameters;


    normalized.parameterSchema =
        parameters;


    /*
     * Provider status.
     */

    if (
        !normalized.provider_status
    ) {

        normalized.provider_status =
            getProviderStatus(model);

    }


    /*
     * =====================================================
     * CREDIT PER RESOLUTION
     * =====================================================
     */

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
     * Jangan mempertahankan credit_final
     * global lama seperti 50 sebagai sumber
     * harga Generate.
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


    /*
     * Root per-resolution credit.
     */

    normalized.credit_480p =
        credit.credit480p;

    normalized.credit_720p =
        credit.credit720p;

    normalized.credit_1080p =
        credit.credit1080p;


    normalized.credit_final_480p =
        credit.creditFinal480p;

    normalized.credit_final_720p =
        credit.creditFinal720p;

    normalized.credit_final_1080p =
        credit.creditFinal1080p;


    /*
     * Camel-case compatibility.
     */

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


    /*
     * Hapus harga global legacy dari root
     * agar module Generate berikutnya tidak
     * tanpa sengaja memakai angka 50.
     */

    delete normalized.credit_final;
    delete normalized.creditFinal;
    delete normalized.credit_cost;
    delete normalized.creditCost;


    /*
     * Compatibility identity.
     */

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

            adapter_available:
                normalized.adapter_available,

            credit_480p:
                normalized.credit_480p,

            credit_720p:
                normalized.credit_720p,

            credit_1080p:
                normalized.credit_1080p,

            credit_final_480p:
                normalized.credit_final_480p,

            credit_final_720p:
                normalized.credit_final_720p,

            credit_final_1080p:
                normalized.credit_final_1080p,

            discount_percent:
                normalized.discount_percent,

            parameter_count:
                Object.keys(
                    normalized.parameters || {}
                ).length,

            parameter_keys:
                Object.keys(
                    normalized.parameters || {}
                ),

            parameters:
                normalized.parameters

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


    /*
     * PARAMETER DETAIL.
     */

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


    /*
     * Parameter schema.
     */

    merged.parameter_schema =
        finalParameters;


    merged.parameterSchema =
        finalParameters;


    /*
     * Nested config compatibility.
     */

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


    /*
     * Repository compatibility.
     */

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


    /*
     * =====================================================
     * CREDIT
     * =====================================================
     *
     * Jangan lagi melakukan:
     *
     * merged.credit_final =
     *     detailCredit.creditFinal;
     *
     * karena creditFinal global dapat berisi 50.
     *
     * Harga Generate harus per resolution.
     */

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


    merged.credit_final_480p =
        chooseValue(
            detailCredit.creditFinal480p,
            listCredit.creditFinal480p
        );


    merged.credit_final_720p =
        chooseValue(
            detailCredit.creditFinal720p,
            listCredit.creditFinal720p
        );


    merged.credit_final_1080p =
        chooseValue(
            detailCredit.creditFinal1080p,
            listCredit.creditFinal1080p
        );


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


    /*
     * Jangan bawa legacy global credit
     * ke normalized model.
     */

    delete merged.credit_final;
    delete merged.creditFinal;
    delete merged.credit_cost;
    delete merged.creditCost;


    /*
     * Pricing per resolution.
     */

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

        credit_final_480p:
            merged.credit_final_480p,

        credit_final_720p:
            merged.credit_final_720p,

        credit_final_1080p:
            merged.credit_final_1080p,

        discount_percent:
            merged.discount_percent

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

                parameterKeys:
                    Object.keys(
                        model.parameters || {}
                    ),

                executable:
                    isExecutableModel(
                        model
                    ),

                credit:
                    getModelCredit(
                        model
                    ),

                creditByResolution: {

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


            /*
             * =================================================
             * CREDIT PER RESOLUTION
             * =================================================
             */

            const credit =
                getModelCredit(
                    model
                );


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
             * Legacy dataset tetap dikosongkan.
             *
             * Jangan sampai module lama mengambil
             * angka global 50.
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


    console.log(
        "[GEN-Z.AI][Generate Model] SELECTOR:",
        {

            total:
                normalizedModels.length,

            selected:
                selectedModelId,

            models:
                normalizedModels.map(
                    model => ({

                        id:
                            getModelId(
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

                        credit_480p:
                            model.credit_480p,

                        credit_720p:
                            model.credit_720p,

                        credit_1080p:
                            model.credit_1080p,

                        credit_final_480p:
                            model.credit_final_480p,

                        credit_final_720p:
                            model.credit_final_720p,

                        credit_final_1080p:
                            model.credit_final_1080p

                    })
                )

        }
    );


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


    /*
     * =====================================================
     * REQUEST DETAIL MODEL
     * =====================================================
     */

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


    /*
     * =====================================================
     * VALIDATE DETAIL
     * =====================================================
     */

    if (
        !detailModel ||
        !getModelId(detailModel)
    ) {

        /*
         * Fallback hanya jika server tidak
         * mengembalikan detail tetapi list
         * memiliki model tersebut.
         */

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


    /*
     * =====================================================
     * MODEL ID HARUS SESUAI
     * =====================================================
     */

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


    /*
     * =====================================================
     * MERGE
     * =====================================================
     */

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


    /*
     * =====================================================
     * PAKSA PARAMETERS
     * =====================================================
     */

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


    /*
     * =====================================================
     * FINAL CREDIT VERIFICATION
     * =====================================================
     */

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

            parameterCount:
                Object.keys(
                    model.parameters || {}
                ).length,

            parameterKeys:
                Object.keys(
                    model.parameters || {}
                ),

            parameters:
                model.parameters,

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


    /*
     * =====================================================
     * STATE
     * =====================================================
     */

    setCurrentModel(
        model
    );


    setModelLoaded(
        true
    );


    saveSelectedModelId(
        serverModelId
    );


    /*
     * =====================================================
     * VERIFIKASI STATE
     * =====================================================
     */

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


    const verifiedParameters =
        extractModelParameters(
            verified
        );


    if (
        Object.keys(
            verifiedParameters
        ).length === 0
    ) {

        console.warn(
            "[GEN-Z.AI][Generate Model] MODEL TIDAK MEMILIKI PARAMETER:",
            verified
        );

    } else {

        console.log(
            "[GEN-Z.AI][Generate Model] PARAMETERS VERIFIED:",
            Object.keys(
                verifiedParameters
            )
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


    /*
     * Selalu lewat loadModelConfig()
     * supaya parameter detail diambil.
     */

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


    /*
     * =====================================================
     * STORED MODEL
     * =====================================================
     */

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


    /*
     * =====================================================
     * FIRST EXECUTABLE
     * =====================================================
     */

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


    /*
     * =====================================================
     * RENDER SELECTOR
     * =====================================================
     */

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


    /*
     * =====================================================
     * LOAD DETAIL
     * =====================================================
     */

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
========================================================= */

export function getModelCreditForSelectedResolution(
    resolution,
    model = null
) {

    const targetModel =
        model ||
        getCurrentModel();


    return getModelCreditForResolution(
        targetModel,
        resolution
    );

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
