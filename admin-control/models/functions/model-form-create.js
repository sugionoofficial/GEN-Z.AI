/**
 * =========================================================
 * GEN-Z.AI
 * MODEL FORM CREATE MODULE
 * ---------------------------------------------------------
 * File:
 * admin-control/models/functions/model-form-create.js
 *
 * TANGGUNG JAWAB:
 * - Mode Tambah Model
 * - Collect data form
 * - Validasi data
 * - Normalisasi data
 * - Menyerahkan INSERT kepada caller/API layer
 * - Menjaga provider_id sebagai providers.id
 * - Menjaga credit per resolution:
 *      credit_480p
 *      credit_720p
 *      credit_1080p
 * - Mempertahankan credit_final untuk kompatibilitas legacy
 * - Tidak menggunakan tabel kie_*
 *
 * TIDAK BERTANGGUNG JAWAB:
 * - Render tabel
 * - Query Supabase langsung
 * - Delete model
 * - Edit model
 * - CRUD provider
 *
 * =========================================================
 */

(function () {

    "use strict";


    /* =====================================================
       CONSTANTS
    ===================================================== */

    const MODEL_FIELDS = [

        "provider_id",

        "model_id",

        "model_name",

        "description",


        /*
         * LEGACY CREDIT
         */

        "credit_cost",

        "discount_percent",

        "credit_final",


        /*
         * CREDIT PER RESOLUTION
         */

        "credit_480p",

        "credit_720p",

        "credit_1080p",


        /*
         * DURATION
         */

        "min_duration",

        "max_duration",


        /*
         * CAPABILITIES
         */

        "supported_ratios",

        "supported_resolutions",


        /*
         * STATUS
         */

        "status"

    ];


    const VALID_STATUS = [

        "active",

        "inactive",

        "maintenance"

    ];


    /*
     * Compatibility constants.
     *
     * Nilai ini TIDAK digunakan untuk membuat
     * capability model secara otomatis.
     *
     * Capability sebenarnya berasal dari data
     * model yang sudah dipilih pada Admin Models.
     */

    const VALID_RATIOS = [

        "2:3",

        "3:2",

        "1:1",

        "16:9",

        "9:16"

    ];


    const VALID_RESOLUTIONS = [

        "480p",

        "720p",

        "1080p"

    ];


    /* =====================================================
       STATE
    ===================================================== */

    let state = {

        active:
            false,

        root:
            null,

        providers:
            [],

        models:
            []

    };


    /* =====================================================
       HELPERS
    ===================================================== */

    function normalizeId(
        value
    ) {

        return String(

            value === null ||
            value === undefined

                ? ""

                : value

        ).trim();

    }


    function normalizeText(
        value
    ) {

        return String(

            value === null ||
            value === undefined

                ? ""

                : value

        ).trim();

    }


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


        const number =
            Number(
                value
            );


        return Number.isFinite(
            number
        )

            ? number

            : fallback;

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

                ...new Set(

                    value

                        .map(
                            item =>
                                normalizeText(
                                    item
                                )
                        )

                        .filter(
                            Boolean
                        )

                )

            ];

        }


        if (

            value === null ||
            value === undefined ||
            value === ""

        ) {

            return [];

        }


        /*
         * PostgreSQL ARRAY
         *
         * {16:9,9:16}
         */

        if (

            typeof value === "string" &&

            value.startsWith("{") &&

            value.endsWith("}")

        ) {

            const inner =
                value.slice(
                    1,
                    -1
                );


            if (
                !inner.trim()
            ) {

                return [];

            }


            return [

                ...new Set(

                    inner

                        .split(",")

                        .map(
                            item =>
                                item
                                    .replace(
                                        /^"(.*)"$/,
                                        "$1"
                                    )
                                    .trim()
                        )

                        .filter(
                            Boolean
                        )

                )

            ];

        }


        /*
         * JSON ARRAY
         */

        if (
            typeof value === "string"
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

                    return normalizeArray(
                        parsed
                    );

                }

            } catch {

                /*
                 * Bukan JSON.
                 */

            }


            /*
             * CSV fallback.
             */

            return [

                ...new Set(

                    value

                        .split(",")

                        .map(
                            item =>
                                normalizeText(
                                    item
                                )
                        )

                        .filter(
                            Boolean
                        )

                )

            ];

        }


        return [];

    }


    function normalizeStatus(
        value
    ) {

        const status =
            normalizeText(
                value
            )
                .toLowerCase();


        return VALID_STATUS.includes(
            status
        )

            ? status

            : "active";

    }


    /* =====================================================
       DOM HELPERS
    ===================================================== */

    function resolveRoot(
        root
    ) {

        if (
            typeof root === "string"
        ) {

            if (
                typeof document ===
                "undefined"
            ) {

                return null;

            }


            return document.querySelector(
                root
            );

        }


        return root || null;

    }


    function getElement(
        root,
        selectors
    ) {

        const container =
            resolveRoot(
                root
            );


        if (
            !container ||
            typeof container.querySelector !==
                "function"
        ) {

            return null;

        }


        const list =
            Array.isArray(
                selectors
            )

                ? selectors

                : [selectors];


        for (
            const selector
            of list
        ) {

            if (
                !selector
            ) {

                continue;

            }


            const element =
                container.querySelector(
                    selector
                );


            if (
                element
            ) {

                return element;

            }

        }


        return null;

    }


    function getValue(
        root,
        selectors
    ) {

        const element =
            getElement(
                root,
                selectors
            );


        if (
            !element
        ) {

            return "";

        }


        return String(
            element.value ??
                ""
        ).trim();

    }


    /* =====================================================
       PROVIDER HELPERS
    ===================================================== */

    function findProvider(
        providers,
        providerId
    ) {

        const id =
            normalizeId(
                providerId
            );


        if (
            !id
        ) {

            return null;

        }


        const source =
            Array.isArray(
                providers
            )

                ? providers

                : [];


        /*
         * PRIMARY:
         *
         * providers.id
         */

        const byId =
            source.find(
                provider =>
                    normalizeId(
                        provider?.id
                    ) ===
                    id
            );


        if (
            byId
        ) {

            return byId;

        }


        /*
         * Compatibility:
         *
         * provider_id
         */

        return (

            source.find(
                provider =>
                    normalizeId(
                        provider?.provider_id
                    ) ===
                    id
            )

            ||

            null

        );

    }


    function getProviderCode(
        provider
    ) {

        if (
            !provider
        ) {

            return "";

        }


        return normalizeText(
            provider.provider_id
        );

    }


    function isProviderActive(
        provider
    ) {

        if (
            !provider
        ) {

            return false;

        }


        const status =
            normalizeText(
                provider.status
            )
                .toLowerCase();


        if (
            status ===
                "active" ||
            status ===
                "aktif" ||
            status ===
                "enabled"
        ) {

            return true;

        }


        /*
         * Compatibility fields.
         *
         * Tidak menjadi dependency utama.
         */

        return (

            provider.is_active ===
                true ||

            provider.active ===
                true ||

            provider.enabled ===
                true

        );

    }


    /* =====================================================
       MODEL LOOKUP
    ===================================================== */

    function findDuplicateModel(
        models,
        modelId,
        excludeId = ""
    ) {

        const normalizedModelId =
            normalizeText(
                modelId
            ).toLowerCase();


        const excluded =
            normalizeId(
                excludeId
            );


        if (
            !normalizedModelId
        ) {

            return null;

        }


        const source =
            Array.isArray(
                models
            )

                ? models

                : [];


        return (

            source.find(
                model => {

                    const id =
                        normalizeId(
                            model?.id
                        );


                    if (
                        excluded &&
                        id === excluded
                    ) {

                        return false;

                    }


                    return (

                        normalizeText(
                            model?.model_id
                        )
                            .toLowerCase() ===
                        normalizedModelId

                    );

                }
            )

            ||

            null

        );

    }


    function findModelById(
        models,
        modelId
    ) {

        const id =
            normalizeText(
                modelId
            ).toLowerCase();


        if (
            !id
        ) {

            return null;

        }


        const source =
            Array.isArray(
                models
            )

                ? models

                : [];


        return (

            source.find(
                model =>
                    normalizeText(
                        model?.model_id
                    )
                        .toLowerCase() ===
                    id
            )

            ||

            null

        );

    }


    /* =====================================================
       CREDIT CALCULATION
       -----------------------------------------------------
       credit_final:
           credit_cost
           +
           discount_percent

       Contoh:

           credit_cost = 100
           discount = 10%

           credit_final = 90

       IMPORTANT:

       credit_480p
       credit_720p
       credit_1080p

       adalah nilai credit aktual masing-masing
       resolution.

       Ketiganya TIDAK dihitung otomatis dari:

       - KIE price
       - duration
       - ratio
       - credit_final

       Nilainya berasal dari input Admin Models.
    ===================================================== */

    function calculateCreditFinal(
        creditCost,
        discountPercent
    ) {

        const cost =
            Math.max(
                0,
                toNumber(
                    creditCost,
                    0
                )
            );


        const discount =
            Math.min(
                100,
                Math.max(
                    0,
                    toNumber(
                        discountPercent,
                        0
                    )
                )
            );


        return Number(

            (
                cost -

                (
                    cost *
                    discount /
                    100
                )

            ).toFixed(
                6
            )

        );

    }


    /* =====================================================
       NORMALIZE MODEL DATA
    ===================================================== */

    function normalizeModelData(
        input,
        options = {}
    ) {

        const data =
            input || {};


        const providers =
            Array.isArray(
                options.providers
            )

                ? options.providers

                : state.providers;


        /*
         * -------------------------------------------------
         * PROVIDER
         * -------------------------------------------------
         */

        const providerId =
            normalizeId(

                data.provider_id ||

                data.providerId

            );


        const provider =
            findProvider(
                providers,
                providerId
            );


        /*
         * -------------------------------------------------
         * LEGACY CREDIT
         * -------------------------------------------------
         */

        const creditCost =
            toNumber(

                data.credit_cost ??

                data.creditCost,

                0

            );


        const discountPercent =
            toNumber(

                data.discount_percent ??

                data.discountPercent,

                0

            );


        /*
         * credit_final tetap kompatibel.
         */

        const suppliedFinal =

            data.credit_final ??

            data.creditFinal;


        const calculatedFinal =
            calculateCreditFinal(
                creditCost,
                discountPercent
            );


        const creditFinal =

            suppliedFinal ===
                undefined ||

            suppliedFinal ===
                null ||

            suppliedFinal ===
                ""

                ?

                calculatedFinal

                :

                toNumber(
                    suppliedFinal,
                    calculatedFinal
                );


        /*
         * -------------------------------------------------
         * CREDIT PER RESOLUTION
         * -------------------------------------------------
         *
         * Jangan menggunakan credit_final
         * untuk menggantikan nilai yang sengaja
         * diberikan admin sebagai 0.
         */

        const credit480p =
            toNumber(

                data.credit_480p ??

                data.credit480p,

                0

            );


        const credit720p =
            toNumber(

                data.credit_720p ??

                data.credit720p,

                0

            );


        const credit1080p =
            toNumber(

                data.credit_1080p ??

                data.credit1080p,

                0

            );


        /*
         * -------------------------------------------------
         * DURATION
         * -------------------------------------------------
         */

        const minDuration =
            toNumber(

                data.min_duration ??

                data.minDuration,

                0

            );


        const maxDuration =
            toNumber(

                data.max_duration ??

                data.maxDuration,

                0

            );


        /*
         * -------------------------------------------------
         * CAPABILITIES
         * -------------------------------------------------
         *
         * Capability yang dikirim adalah hasil
         * checkbox/data model.
         *
         * Tidak membuat capability baru.
         */

        const supportedRatios =
            normalizeArray(

                data.supported_ratios ??

                data.supportedRatios

            );


        const supportedResolutions =
            normalizeArray(

                data.supported_resolutions ??

                data.supportedResolutions

            );


        /*
         * -------------------------------------------------
         * NORMALIZED RESULT
         * -------------------------------------------------
         */

        return {

            provider_id:

                provider

                    ? normalizeId(
                        provider.id
                    )

                    : providerId,


            model_id:

                normalizeText(

                    data.model_id ||

                    data.modelId

                ),


            model_name:

                normalizeText(

                    data.model_name ||

                    data.modelName

                ),


            description:

                normalizeText(
                    data.description
                ),


            /*
             * Legacy pricing.
             */

            credit_cost:
                creditCost,


            discount_percent:
                discountPercent,


            credit_final:
                creditFinal,


            /*
             * Resolution pricing.
             */

            credit_480p:
                credit480p,


            credit_720p:
                credit720p,


            credit_1080p:
                credit1080p,


            /*
             * Duration.
             */

            min_duration:
                minDuration,


            max_duration:
                maxDuration,


            /*
             * Capabilities.
             */

            supported_ratios:
                supportedRatios,


            supported_resolutions:
                supportedResolutions,


            /*
             * Status.
             */

            status:
                normalizeStatus(
                    data.status
                )

        };

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validateModelData(
        data,
        options = {}
    ) {

        const errors = [];


        const providers =
            Array.isArray(
                options.providers
            )

                ? options.providers

                : state.providers;


        const models =
            Array.isArray(
                options.models
            )

                ? options.models

                : state.models;


        if (
            !data
        ) {

            return [

                "Data model tidak ditemukan."

            ];

        }


        /* -------------------------------------------------
           PROVIDER
           ------------------------------------------------- */

        if (
            !normalizeId(
                data.provider_id
            )
        ) {

            errors.push(
                "Provider wajib dipilih."
            );

        } else {

            const provider =
                findProvider(
                    providers,
                    data.provider_id
                );


            if (
                !provider
            ) {

                errors.push(
                    "Provider yang dipilih tidak ditemukan."
                );

            } else if (
                !isProviderActive(
                    provider
                )
            ) {

                errors.push(
                    "Provider yang dipilih tidak aktif."
                );

            }

        }


        /* -------------------------------------------------
           MODEL ID
           ------------------------------------------------- */

        if (
            !data.model_id
        ) {

            errors.push(
                "Model ID wajib diisi."
            );

        }


        if (
            data.model_id &&
            data.model_id.length >
                255
        ) {

            errors.push(
                "Model ID terlalu panjang."
            );

        }


        /*
         * Jangan membuat duplicate model.
         */

        const duplicate =
            findDuplicateModel(
                models,
                data.model_id
            );


        if (
            duplicate
        ) {

            errors.push(
                "Model ID sudah terdaftar."
            );

        }


        /* -------------------------------------------------
           MODEL NAME
           ------------------------------------------------- */

        if (
            !data.model_name
        ) {

            errors.push(
                "Nama model wajib diisi."
            );

        }


        if (
            data.model_name &&
            data.model_name.length >
                255
        ) {

            errors.push(
                "Nama model terlalu panjang."
            );

        }


        /* -------------------------------------------------
           CREDIT COST
           ------------------------------------------------- */

        if (
            !Number.isFinite(
                data.credit_cost
            ) ||
            data.credit_cost < 0
        ) {

            errors.push(
                "Credit cost tidak boleh negatif."
            );

        }


        /* -------------------------------------------------
           DISCOUNT
           ------------------------------------------------- */

        if (
            !Number.isFinite(
                data.discount_percent
            ) ||

            data.discount_percent < 0 ||

            data.discount_percent > 100
        ) {

            errors.push(
                "Diskon harus berada antara 0 sampai 100 persen."
            );

        }


        /* -------------------------------------------------
           CREDIT FINAL
           ------------------------------------------------- */

        if (
            !Number.isFinite(
                data.credit_final
            ) ||
            data.credit_final < 0
        ) {

            errors.push(
                "Credit final tidak valid."
            );

        }


        /* -------------------------------------------------
           CREDIT 480P
           ------------------------------------------------- */

        if (
            !Number.isFinite(
                data.credit_480p
            ) ||
            data.credit_480p < 0
        ) {

            errors.push(
                "Credit 480p tidak valid."
            );

        }


        /* -------------------------------------------------
           CREDIT 720P
           ------------------------------------------------- */

        if (
            !Number.isFinite(
                data.credit_720p
            ) ||
            data.credit_720p < 0
        ) {

            errors.push(
                "Credit 720p tidak valid."
            );

        }


        /* -------------------------------------------------
           CREDIT 1080P
           ------------------------------------------------- */

        if (
            !Number.isFinite(
                data.credit_1080p
            ) ||
            data.credit_1080p < 0
        ) {

            errors.push(
                "Credit 1080p tidak valid."
            );

        }


        /* -------------------------------------------------
           DURATION
           ------------------------------------------------- */

        if (
            !Number.isFinite(
                data.min_duration
            ) ||
            data.min_duration < 0
        ) {

            errors.push(
                "Minimum Duration tidak valid."
            );

        }


        if (
            !Number.isFinite(
                data.max_duration
            ) ||
            data.max_duration < 0
        ) {

            errors.push(
                "Maximum Duration tidak valid."
            );

        }


        if (
            data.min_duration >
            data.max_duration
        ) {

            errors.push(
                "Minimum Duration tidak boleh lebih besar dari Maximum Duration."
            );

        }


        /* -------------------------------------------------
           CAPABILITIES
           ------------------------------------------------- */

        if (
            !Array.isArray(
                data.supported_ratios
            )
        ) {

            errors.push(
                "Supported Ratios harus berupa array."
            );

        }


        if (
            !Array.isArray(
                data.supported_resolutions
            )
        ) {

            errors.push(
                "Supported Resolutions harus berupa array."
            );

        }


        return errors;

    }


    /* =====================================================
       COLLECT FORM DATA
    ===================================================== */

    function collectFormData(
        root
    ) {

        const container =
            resolveRoot(
                root
            );


        if (
            !container
        ) {

            throw new Error(
                "MODEL_FORM_ROOT_MISSING"
            );

        }


        /*
         * -------------------------------------------------
         * RATIO ELEMENTS
         * -------------------------------------------------
         */

        const ratioElements =
            container.querySelectorAll(

                [

                    "input[name='supported_ratios']",

                    "input[name='supported_ratios[]']",

                    "input[data-field='supported_ratios']",

                    "[data-ratio-option]"

                ].join(",")

            );


        /*
         * -------------------------------------------------
         * RESOLUTION ELEMENTS
         * -------------------------------------------------
         */

        const resolutionElements =
            container.querySelectorAll(

                [

                    "input[name='supported_resolutions']",

                    "input[name='supported_resolutions[]']",

                    "input[data-field='supported_resolutions']",

                    "[data-resolution-option]"

                ].join(",")

            );


        /*
         * -------------------------------------------------
         * COLLECT RATIOS
         * -------------------------------------------------
         */

        let ratios =

            Array.from(
                ratioElements
            )

                .filter(
                    element =>
                        element.checked
                )

                .map(
                    element =>
                        normalizeText(

                            element.value ||

                            element.dataset.value

                        )
                )

                .filter(
                    Boolean
                );


        /*
         * -------------------------------------------------
         * COLLECT RESOLUTIONS
         * -------------------------------------------------
         */

        let resolutions =

            Array.from(
                resolutionElements
            )

                .filter(
                    element =>
                        element.checked
                )

                .map(
                    element =>
                        normalizeText(

                            element.value ||

                            element.dataset.value

                        )
                )

                .filter(
                    Boolean
                );


        /*
         * -------------------------------------------------
         * SELECT MULTIPLE FALLBACK
         * -------------------------------------------------
         */

        if (
            !ratios.length
        ) {

            const ratioSelect =
                getElement(

                    container,

                    [

                        "[name='supported_ratios']",

                        "#supported_ratios"

                    ]

                );


            if (
                ratioSelect &&
                ratioSelect.multiple
            ) {

                ratios =

                    Array.from(

                        ratioSelect.selectedOptions

                    )

                        .map(
                            option =>
                                normalizeText(
                                    option.value
                                )
                        )

                        .filter(
                            Boolean
                        );

            }

        }


        if (
            !resolutions.length
        ) {

            const resolutionSelect =
                getElement(

                    container,

                    [

                        "[name='supported_resolutions']",

                        "#supported_resolutions"

                    ]

                );


            if (
                resolutionSelect &&
                resolutionSelect.multiple
            ) {

                resolutions =

                    Array.from(

                        resolutionSelect.selectedOptions

                    )

                        .map(
                            option =>
                                normalizeText(
                                    option.value
                                )
                        )

                        .filter(
                            Boolean
                        );

            }

        }


        /*
         * Remove duplicate capability values.
         */

        ratios =
            normalizeArray(
                ratios
            );


        resolutions =
            normalizeArray(
                resolutions
            );


        /*
         * -------------------------------------------------
         * RETURN RAW FORM DATA
         * -------------------------------------------------
         */

        return {

            provider_id:

                normalizeId(

                    getValue(

                        container,

                        [

                            "[name='provider_id']",

                            "#provider_id"

                        ]

                    )

                ),


            model_id:

                normalizeText(

                    getValue(

                        container,

                        [

                            "[name='model_id']",

                            "#model_id"

                        ]

                    )

                ),


            model_name:

                normalizeText(

                    getValue(

                        container,

                        [

                            "[name='model_name']",

                            "#model_name"

                        ]

                    )

                ),


            description:

                normalizeText(

                    getValue(

                        container,

                        [

                            "[name='description']",

                            "#description"

                        ]

                    )

                ),


            /*
             * Legacy credit.
             */

            credit_cost:

                toNumber(

                    getValue(

                        container,

                        [

                            "[name='credit_cost']",

                            "#credit_cost"

                        ]

                    ),

                    0

                ),


            discount_percent:

                toNumber(

                    getValue(

                        container,

                        [

                            "[name='discount_percent']",

                            "#discount_percent"

                        ]

                    ),

                    0

                ),


            credit_final:

                getValue(

                    container,

                    [

                        "[name='credit_final']",

                        "#credit_final"

                    ]

                ) !== ""

                    ?

                    toNumber(

                        getValue(

                            container,

                            [

                                "[name='credit_final']",

                                "#credit_final"

                            ]

                        ),

                        0

                    )

                    :

                    undefined,


            /*
             * Credit 480p.
             */

            credit_480p:

                toNumber(

                    getValue(

                        container,

                        [

                            "[name='credit_480p']",

                            "#credit_480p"

                        ]

                    ),

                    0

                ),


            /*
             * Credit 720p.
             */

            credit_720p:

                toNumber(

                    getValue(

                        container,

                        [

                            "[name='credit_720p']",

                            "#credit_720p"

                        ]

                    ),

                    0

                ),


            /*
             * Credit 1080p.
             */

            credit_1080p:

                toNumber(

                    getValue(

                        container,

                        [

                            "[name='credit_1080p']",

                            "#credit_1080p"

                        ]

                    ),

                    0

                ),


            /*
             * Duration.
             */

            min_duration:

                toNumber(

                    getValue(

                        container,

                        [

                            "[name='min_duration']",

                            "#min_duration"

                        ]

                    ),

                    0

                ),


            max_duration:

                toNumber(

                    getValue(

                        container,

                        [

                            "[name='max_duration']",

                            "#max_duration"

                        ]

                    ),

                    0

                ),


            /*
             * Capabilities.
             */

            supported_ratios:

                ratios,


            supported_resolutions:

                resolutions,


            /*
             * Status.
             */

            status:

                normalizeStatus(

                    getValue(

                        container,

                        [

                            "[name='status']",

                            "#status"

                        ]

                    )

                )

        };

    }


    /* =====================================================
       PREPARE SUBMISSION
    ===================================================== */

    function prepareCreateData(
        data,
        options = {}
    ) {

        const normalized =
            normalizeModelData(
                data,
                options
            );


        const errors =
            validateModelData(
                normalized,
                options
            );


        if (
            errors.length
        ) {

            const error =
                new Error(
                    "MODEL_CREATE_VALIDATION_FAILED"
                );


            error.code =
                "MODEL_CREATE_VALIDATION_FAILED";


            error.errors =
                errors;


            error.data =
                normalized;


            throw error;

        }


        /*
         * Hanya field yang memang merupakan
         * bagian dari tabel models.
         */

        const payload = {};


        for (
            const field
            of MODEL_FIELDS
        ) {

            if (
                normalized[field] !==
                undefined
            ) {

                payload[field] =
                    normalized[field];

            }

        }


        return payload;

    }


    /* =====================================================
       SUBMIT
       -----------------------------------------------------
       Database operation diserahkan kepada callback.
    ===================================================== */

    async function submit(
        data,
        options = {}
    ) {

        const payload =
            prepareCreateData(
                data,
                options
            );


        const handler =

            typeof options.insert ===
                "function"

                ?

                options.insert

                :

                typeof options.onSubmit ===
                    "function"

                    ?

                    options.onSubmit

                    :

                    typeof options.submit ===
                        "function"

                        ?

                        options.submit

                        :

                        null;


        if (
            !handler
        ) {

            const error =
                new Error(
                    "MODEL_CREATE_SUBMIT_HANDLER_MISSING"
                );


            error.code =
                "MODEL_CREATE_SUBMIT_HANDLER_MISSING";


            error.data =
                payload;


            throw error;

        }


        /*
         * Callback database dipanggil
         * tepat satu kali.
         *
         * Tidak ada recursive submit.
         */

        return await handler(

            payload,

            {

                mode:
                    "create"

            }

        );

    }


    /* =====================================================
       OPEN CREATE
    ===================================================== */

    function openCreate(
        root,
        options = {}
    ) {

        state.active =
            true;


        state.root =
            resolveRoot(
                root
            );


        state.providers =

            Array.isArray(
                options.providers
            )

                ? options.providers

                : [];


        state.models =

            Array.isArray(
                options.models
            )

                ? options.models

                : [];


        return {

            active:
                true,

            root:
                state.root,

            providers:
                state.providers,

            models:
                state.models

        };

    }


    /* =====================================================
       CLOSE CREATE
    ===================================================== */

    function closeCreate() {

        state = {

            active:
                false,

            root:
                null,

            providers:
                [],

            models:
                []

        };

    }


    /* =====================================================
       IS ACTIVE
    ===================================================== */

    function isActive() {

        return (
            state.active ===
            true
        );

    }


    /* =====================================================
       SET DATA
    ===================================================== */

    function setData(
        options = {}
    ) {

        if (
            Array.isArray(
                options.providers
            )
        ) {

            state.providers =
                options.providers;

        }


        if (
            Array.isArray(
                options.models
            )
        ) {

            state.models =
                options.models;

        }


        if (
            options.root
        ) {

            state.root =
                resolveRoot(
                    options.root
                );

        }


        return getState();

    }


    /* =====================================================
       GET STATE
    ===================================================== */

    function getState() {

        return {

            active:
                state.active,

            root:
                state.root,

            providers:
                state.providers,

            models:
                state.models

        };

    }


    /* =====================================================
       CREATE FROM FORM
    ===================================================== */

    async function createFromForm(
        event = null,
        options = {}
    ) {

        if (

            event &&

            typeof event.preventDefault ===
                "function"

        ) {

            event.preventDefault();

        }


        const root =
            options.root ||
            state.root;


        if (
            !root
        ) {

            throw new Error(
                "MODEL_FORM_ROOT_MISSING"
            );

        }


        const data =
            collectFormData(
                root
            );


        return submit(

            data,

            {

                ...options,


                providers:

                    Array.isArray(
                        options.providers
                    )

                        ?

                        options.providers

                        :

                        state.providers,


                models:

                    Array.isArray(
                        options.models
                    )

                        ?

                        options.models

                        :

                        state.models

            }

        );

    }


    /* =====================================================
       DIRECT CREATE
    ===================================================== */

    async function create(
        data,
        options = {}
    ) {

        return submit(

            data,

            {

                ...options,


                providers:

                    Array.isArray(
                        options.providers
                    )

                        ?

                        options.providers

                        :

                        state.providers,


                models:

                    Array.isArray(
                        options.models
                    )

                        ?

                        options.models

                        :

                        state.models

            }

        );

    }


    /* =====================================================
       FORM VALIDATION
    ===================================================== */

    function validateForm(
        root,
        options = {}
    ) {

        const data =
            collectFormData(
                root
            );


        const normalized =
            normalizeModelData(

                data,

                {

                    ...options,

                    providers:

                        Array.isArray(
                            options.providers
                        )

                            ?

                            options.providers

                            :

                            state.providers

                }

            );


        return {

            data:
                normalized,


            errors:

                validateModelData(

                    normalized,

                    {

                        ...options,


                        providers:

                            Array.isArray(
                                options.providers
                            )

                                ?

                                options.providers

                                :

                                state.providers,


                        models:

                            Array.isArray(
                                options.models
                            )

                                ?

                                options.models

                                :

                                state.models

                    }

                )

        };

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const ModelFormCreate = {

        MODEL_FIELDS,

        VALID_STATUS,

        VALID_RATIOS,

        VALID_RESOLUTIONS,


        normalizeModelData,

        validateModelData,

        collectFormData,

        prepareCreateData,


        calculateCreditFinal,


        findProvider,

        findDuplicateModel,

        findModelById,


        openCreate,

        closeCreate,

        isActive,

        setData,

        getState,


        validateForm,

        create,

        createFromForm,

        submit

    };


    /* =====================================================
       GLOBAL COMPATIBILITY
    ===================================================== */

    window.GENZModelFormCreate =
        ModelFormCreate;


    console.info(
        "[GEN-Z.AI] GENZModelFormCreate loaded."
    );


})();
