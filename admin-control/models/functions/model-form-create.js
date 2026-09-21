/* =========================================================
   GEN-Z.AI
   MODEL FORM CREATE MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-create.js

   Tanggung jawab:
   - Mode Tambah Model
   - Collect data form
   - Validasi data
   - Normalisasi data
   - Menyerahkan INSERT kepada caller/API layer
   - Menjaga provider_id sebagai providers.id
   - Tidak menggunakan tabel kie_*

   Tidak bertanggung jawab:
   - Render tabel
   - Query Supabase langsung
   - Delete model
   - Edit model
   - CRUD provider
   ========================================================= */

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
    "credit_cost",
    "discount_percent",
    "credit_final",

    "credit_480p",
    "credit_720p",
    "credit_1080p",

    "min_duration",
    "max_duration",
    "supported_ratios",
    "supported_resolutions",
    "status"
];

    const VALID_STATUS = [
        "active",
        "inactive",
        "maintenance"
    ];

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
        active: false,
        root: null,
        providers: [],
        models: []
    };


    /* =====================================================
       HELPERS
       ===================================================== */

    function normalizeId(value) {

        return String(
            value === null ||
            value === undefined
                ? ""
                : value
        ).trim();

    }


    function normalizeText(value) {

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
            Number(value);

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
            Array.isArray(value)
        ) {

            return [
                ...new Set(
                    value
                        .map(item =>
                            normalizeText(
                                item
                            )
                        )
                        .filter(Boolean)
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
         * PostgreSQL array:
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

            if (!inner.trim()) {
                return [];
            }

            return [
                ...new Set(
                    inner
                        .split(",")
                        .map(item =>
                            item
                                .replace(/^"(.*)"$/, "$1")
                                .trim()
                        )
                        .filter(Boolean)
                )
            ];

        }


        /*
         * JSON array.
         */
        if (
            typeof value === "string"
        ) {

            try {

                const parsed =
                    JSON.parse(value);

                if (
                    Array.isArray(parsed)
                ) {

                    return normalizeArray(
                        parsed
                    );

                }

            } catch {
                /* Not JSON. */
            }


            /*
             * Comma separated fallback.
             */
            return [
                ...new Set(
                    value
                        .split(",")
                        .map(item =>
                            normalizeText(
                                item
                            )
                        )
                        .filter(Boolean)
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
            ).toLowerCase();

        return VALID_STATUS.includes(
            status
        )
            ? status
            : "active";

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

        if (!id) {
            return null;
        }


        return (
            providers || []
        ).find(
            provider =>
                normalizeId(
                    provider.id
                ) === id
        ) || null;

    }


    function getProviderCode(
        provider
    ) {

        if (!provider) {
            return "";
        }

        return normalizeText(
            provider.provider_id
        );

    }


    /* =====================================================
       MODEL ID DUPLICATE CHECK
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

        if (!normalizedModelId) {
            return null;
        }


        return (
            models || []
        ).find(
            model => {

                const id =
                    normalizeId(
                        model.id
                    );

                if (
                    excluded &&
                    id === excluded
                ) {
                    return false;
                }

                return (
                    normalizeText(
                        model.model_id
                    ).toLowerCase() ===
                    normalizedModelId
                );

            }
        ) || null;

    }


    /* =====================================================
       CREDIT CALCULATION
       -----------------------------------------------------
       credit_final dihitung dari:
       
       credit_cost - discount_percent
       
       Jika discount = 0:
       final = cost

       Contoh:
       cost 100
       discount 10%
       final 90
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
            ).toFixed(6)
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


        const suppliedFinal =
            data.credit_final ??
            data.creditFinal;


        /*
         * Jika credit_final tidak diberikan,
         * hitung dari cost + discount.
         *
         * Jika diberikan, tetap gunakan nilai
         * dari form agar kompatibel dengan UI lama.
         */
        const creditFinal =
            suppliedFinal ===
                undefined ||
            suppliedFinal === null ||
            suppliedFinal === ""
                ? calculateCreditFinal(
                    creditCost,
                    discountPercent
                )
                : toNumber(
                    suppliedFinal,
                    calculateCreditFinal(
                        creditCost,
                        discountPercent
                    )
                );


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

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal,

            min_duration:
                toNumber(
                    data.min_duration ??
                    data.minDuration,
                    0
                ),

            max_duration:
                toNumber(
                    data.max_duration ??
                    data.maxDuration,
                    0
                ),

            supported_ratios:
                normalizeArray(
                    data.supported_ratios ??
                    data.supportedRatios
                ),

            supported_resolutions:
                normalizeArray(
                    data.supported_resolutions ??
                    data.supportedResolutions
                ),

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


        if (!data) {

            return [
                "Data model tidak ditemukan."
            ];

        }


        /* Provider */

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

            if (!provider) {

                errors.push(
                    "Provider yang dipilih tidak ditemukan."
                );

            } else {

                /*
                 * Model hanya boleh dibuat untuk
                 * provider aktif.
                 */
                const providerStatus =
                    normalizeText(
                        provider.status
                    ).toLowerCase();

                if (
                    providerStatus &&
                    providerStatus !==
                        "active"
                ) {

                    errors.push(
                        "Provider yang dipilih tidak aktif."
                    );

                }

            }

        }


        /* Model ID */

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


        const duplicate =
            findDuplicateModel(
                models,
                data.model_id
            );

        if (duplicate) {

            errors.push(
                "Model ID sudah terdaftar."
            );

        }


        /* Model name */

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


        /* Credit */

        if (
            data.credit_cost <
            0
        ) {

            errors.push(
                "Credit cost tidak boleh negatif."
            );

        }


        if (
            data.discount_percent <
                0 ||
            data.discount_percent >
                100
        ) {

            errors.push(
                "Diskon harus berada antara 0 sampai 100 persen."
            );

        }


        /* Duration */

        if (
            data.min_duration <
            0
        ) {

            errors.push(
                "Durasi minimum tidak boleh negatif."
            );

        }


        if (
            data.max_duration <
            0
        ) {

            errors.push(
                "Durasi maksimum tidak boleh negatif."
            );

        }


        if (
            data.max_duration > 0 &&
            data.min_duration > 0 &&
            data.min_duration >
                data.max_duration
        ) {

            errors.push(
                "Durasi minimum tidak boleh lebih besar dari durasi maksimum."
            );

        }


        /* Ratio */

        if (
            !Array.isArray(
                data.supported_ratios
            )
        ) {

            errors.push(
                "Rasio harus berupa array."
            );

        } else {

            const invalidRatios =
                data.supported_ratios
                    .filter(
                        ratio =>
                            !VALID_RATIOS.includes(
                                ratio
                            )
                    );

            if (
                invalidRatios.length
            ) {

                errors.push(
                    "Terdapat rasio yang tidak didukung: " +
                    invalidRatios.join(", ")
                );

            }

        }


        /* Resolution */

        if (
            !Array.isArray(
                data.supported_resolutions
            )
        ) {

            errors.push(
                "Resolusi harus berupa array."
            );

        } else {

            const invalidResolutions =
                data.supported_resolutions
                    .filter(
                        resolution =>
                            !VALID_RESOLUTIONS.includes(
                                resolution
                            )
                    );

            if (
                invalidResolutions.length
            ) {

                errors.push(
                    "Terdapat resolusi yang tidak didukung: " +
                    invalidResolutions.join(", ")
                );

            }

        }


        /* Status */

        if (
            !VALID_STATUS.includes(
                data.status
            )
        ) {

            errors.push(
                "Status model tidak valid."
            );

        }


        return errors;

    }


    /* =====================================================
       COLLECT FORM
       ===================================================== */

    function collectFormData(
        root
    ) {

        const container =
            typeof root ===
                "string"
                ? document.querySelector(
                    root
                )
                : root;


        if (!container) {

            throw new Error(
                "MODEL_FORM_ROOT_MISSING"
            );

        }


        function get(
            selectors
        ) {

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

                const element =
                    container.querySelector(
                        selector
                    );

                if (element) {
                    return element;
                }

            }

            return null;

        }


        function value(
            selectors
        ) {

            const element =
                get(
                    selectors
                );

            return element
                ? element.value
                : "";

        }


        function checkedValues(
            selectors
        ) {

            const elements =
                container.querySelectorAll(
                    selectors
                );

            return Array.from(
                elements
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
                .filter(Boolean);

        }


        const providerElement =
            get([
                "[name='provider_id']",
                "#provider_id",
                "[data-field='provider_id']"
            ]);


        const ratioElements =
            container.querySelectorAll(
                [
                    "input[name='supported_ratios']",
                    "input[name='supported_ratios[]']",
                    "input[data-field='supported_ratios']",
                    "[data-ratio-option]"
                ].join(",")
            );


        const resolutionElements =
            container.querySelectorAll(
                [
                    "input[name='supported_resolutions']",
                    "input[name='supported_resolutions[]']",
                    "input[data-field='supported_resolutions']",
                    "[data-resolution-option]"
                ].join(",")
            );


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
                .filter(Boolean);


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
                .filter(Boolean);


        /*
         * Jika form menggunakan select multiple.
         */
        if (!ratios.length) {

            const ratioSelect =
                get([
                    "[name='supported_ratios']",
                    "#supported_ratios"
                ]);

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
                        .filter(Boolean);

            }

        }


        if (!resolutions.length) {

            const resolutionSelect =
                get([
                    "[name='supported_resolutions']",
                    "#supported_resolutions"
                ]);

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
                        .filter(Boolean);

            }

        }


        return {

            provider_id:
                providerElement
                    ? normalizeId(
                        providerElement.value
                    )
                    : normalizeId(
                        value([
                            "[name='provider_id']",
                            "#provider_id"
                        ])
                    ),

            model_id:
                normalizeText(
                    value([
                        "[name='model_id']",
                        "#model_id"
                    ])
                ),

            model_name:
                normalizeText(
                    value([
                        "[name='model_name']",
                        "#model_name"
                    ])
                ),

            description:
                normalizeText(
                    value([
                        "[name='description']",
                        "#description"
                    ])
                ),

            credit_cost:
                toNumber(
                    value([
                        "[name='credit_cost']",
                        "#credit_cost"
                    ]),
                    0
                ),

            discount_percent:
                toNumber(
                    value([
                        "[name='discount_percent']",
                        "#discount_percent"
                    ]),
                    0
                ),

            credit_final:
                value([
                    "[name='credit_final']",
                    "#credit_final"
                ]) !== ""
                    ? toNumber(
                        value([
                            "[name='credit_final']",
                            "#credit_final"
                        ]),
                        0
                    )
                    : undefined,

            min_duration:
                toNumber(
                    value([
                        "[name='min_duration']",
                        "#min_duration"
                    ]),
                    0
                ),

            max_duration:
                toNumber(
                    value([
                        "[name='max_duration']",
                        "#max_duration"
                    ]),
                    0
                ),

            supported_ratios:
                ratios,

            supported_resolutions:
                resolutions,

            status:
                normalizeStatus(
                    value([
                        "[name='status']",
                        "#status"
                    ])
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


        if (errors.length) {

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
         * Hanya kirim field yang memang ada
         * pada tabel models.
         *
         * Jangan kirim:
         * workflow_id
         * variant_id
         * provider code sebagai provider_id
         * kie_*
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
                ? options.insert
                : typeof options.onSubmit ===
                    "function"
                    ? options.onSubmit
                    : typeof options.submit ===
                        "function"
                        ? options.submit
                        : null;


        if (!handler) {

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
         * Panggil callback database tepat satu kali.
         *
         * Tidak ada fallback ke coordinator.
         * Tidak ada recursive submit.
         */
        const result =
            await handler(
                payload,
                {
                    mode:
                        "create"
                }
            );


        return result;

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
            typeof root ===
                "string"
                ? document.querySelector(
                    root
                )
                : root || null;

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
            active: false,
            root: null,
            providers: [],
            models: []
        };

    }


    /* =====================================================
       IS ACTIVE
       ===================================================== */

    function isActive() {

        return state.active === true;

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
                typeof options.root ===
                    "string"
                    ? document.querySelector(
                        options.root
                    )
                    : options.root;

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


        if (!root) {

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
                        ? options.providers
                        : state.providers,

                models:
                    Array.isArray(
                        options.models
                    )
                        ? options.models
                        : state.models
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
                        ? options.providers
                        : state.providers,

                models:
                    Array.isArray(
                        options.models
                    )
                        ? options.models
                        : state.models
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
                            ? options.providers
                            : state.providers
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
                                ? options.providers
                                : state.providers,

                        models:
                            Array.isArray(
                                options.models
                            )
                                ? options.models
                                : state.models
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
