/* =========================================================
   GEN-Z.AI
   MODEL FORM CREATE MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-create.js

   Tanggung jawab:
   - Create Model
   - Collect data dari form
   - Normalisasi data create
   - Validasi data create
   - Duplicate Model ID check
   - Provider validation
   - Credit 480p / 720p / 1080p
   - Discount Percent
   - Duration / Ratio / Resolution
   - Submit callback satu kali

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Render form
   - Edit Model
   - Delete Model
   - Provider lifecycle
   - Model registry
   - Menghitung / menyimpan Credit Final
   ========================================================= */

(function () {
    "use strict";

    const MODEL_FIELDS = [
        "provider_id",
        "model_id",
        "model_name",
        "description",

        "discount_percent",

        "credit_480p",
        "credit_720p",
        "credit_1080p",

        "min_duration",
        "max_duration",

        "supported_ratios",
        "supported_resolutions",

        "status"
    ];

    const VALID_STATUS = new Set([
        "active",
        "inactive",
        "maintenance"
    ]);

    /*
     * Compatibility constants only.
     *
     * Jangan gunakan daftar ini untuk menciptakan capability
     * baru atau mengubah data model.
     *
     * Capability tetap berasal dari data Model / Supabase.
     */
    const VALID_RATIOS = new Set([
        "1:1",
        "4:3",
        "3:4",
        "16:9",
        "9:16",
        "3:2",
        "2:3",
        "21:9"
    ]);

    const VALID_RESOLUTIONS = new Set([
        "480p",
        "720p",
        "1080p"
    ]);

    let state = {
        active: false,
        root: null,
        providers: [],
        models: []
    };

    /* =========================================================
       BASIC HELPERS
       ========================================================= */

    function normalizeId(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function toNumber(value, fallback = 0) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return fallback;
        }

        const normalized = String(value)
            .replace(/,/g, "")
            .trim();

        if (!normalized) {
            return fallback;
        }

        const number = Number(normalized);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function hasValue(value) {
        return !(
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        );
    }

    function hasOwn(object, key) {
        return Boolean(
            object &&
            Object.prototype.hasOwnProperty.call(object, key)
        );
    }

    function normalizeArray(value) {
        if (Array.isArray(value)) {
            return value
                .map(item => normalizeText(item))
                .filter(Boolean);
        }

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return [];
        }

        if (typeof value === "string") {
            const text = value.trim();

            if (!text) {
                return [];
            }

            /*
             * Support JSON array string.
             */
            if (
                text.startsWith("[") &&
                text.endsWith("]")
            ) {
                try {
                    const parsed = JSON.parse(text);

                    if (Array.isArray(parsed)) {
                        return parsed
                            .map(item => normalizeText(item))
                            .filter(Boolean);
                    }
                } catch (_) {
                    /* fallback ke comma separated */
                }
            }

            return text
                .split(",")
                .map(item => item.trim())
                .filter(Boolean);
        }

        return [normalizeText(value)].filter(Boolean);
    }

    function normalizeStatus(value) {
        const status = normalizeText(value).toLowerCase();

        if (VALID_STATUS.has(status)) {
            return status;
        }

        return "inactive";
    }

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    function getRoot(root) {
        if (
            typeof Element !== "undefined" &&
            root instanceof Element
        ) {
            return root;
        }

        if (
            root &&
            root.jquery &&
            root[0] instanceof Element
        ) {
            return root[0];
        }

        return (
            document.getElementById("modelForm") ||
            document.getElementById("modelsForm") ||
            document.querySelector("form[data-model-form]") ||
            document
        );
    }

    function queryFirst(root, selectors) {
        const container = getRoot(root);

        for (const selector of selectors) {
            try {
                const element =
                    container.querySelector(selector);

                if (element) {
                    return element;
                }
            } catch (_) {
                /* ignore invalid selector */
            }
        }

        return null;
    }

    function getFieldValue(
        root,
        selectors,
        fallback = ""
    ) {
        const element =
            queryFirst(
                root,
                selectors
            );

        if (!element) {
            return fallback;
        }

        if (
            element.type === "checkbox" &&
            !element.multiple
        ) {
            return element.checked
                ? (
                    element.value === "on"
                        ? true
                        : element.value
                )
                : fallback;
        }

        return element.value !== undefined
            ? element.value
            : fallback;
    }

    function setFieldValue(
        root,
        selectors,
        value
    ) {
        const element =
            queryFirst(
                root,
                selectors
            );

        if (!element) {
            return false;
        }

        if (
            element.type === "checkbox"
        ) {
            element.checked =
                Boolean(value);

            return true;
        }

        element.value =
            value === null ||
            value === undefined
                ? ""
                : String(value);

        return true;
    }

    /* =========================================================
       PROVIDER HELPERS
       ========================================================= */

    function findProvider(
        providers,
        providerId
    ) {
        const list =
            Array.isArray(providers)
                ? providers
                : [];

        const target =
            normalizeId(providerId);

        if (!target) {
            return null;
        }

        /*
         * Primary relation:
         * models.provider_id -> providers.id
         */
        const byId =
            list.find(provider => {
                return (
                    normalizeId(provider?.id) ===
                    target
                );
            });

        if (byId) {
            return byId;
        }

        /*
         * Compatibility:
         * provider_id / code / provider_code
         */
        const byProviderId =
            list.find(provider => {
                return (
                    normalizeId(
                        provider?.provider_id
                    ) === target
                );
            });

        if (byProviderId) {
            return byProviderId;
        }

        const byCode =
            list.find(provider => {
                return (
                    normalizeId(
                        provider?.code
                    ) === target
                );
            });

        if (byCode) {
            return byCode;
        }

        const byProviderCode =
            list.find(provider => {
                return (
                    normalizeId(
                        provider?.provider_code
                    ) === target
                );
            });

        return byProviderCode || null;
    }

    function getProviderCode(provider) {
        if (!provider) {
            return "";
        }

        return (
            normalizeText(provider.code) ||
            normalizeText(provider.provider_code) ||
            normalizeText(provider.provider_id) ||
            ""
        );
    }

    function isProviderActive(provider) {
        if (!provider) {
            return false;
        }

        const status =
            normalizeText(
                provider.status
            ).toLowerCase();

        /*
         * Status adalah sumber utama.
         */
        if (status) {
            return status === "active";
        }

        /*
         * Compatibility dengan schema lama.
         * Tidak mengharuskan kolom tertentu ada.
         */
        if (
            provider.is_active !== undefined
        ) {
            return Boolean(
                provider.is_active
            );
        }

        if (
            provider.active !== undefined
        ) {
            return Boolean(
                provider.active
            );
        }

        if (
            provider.enabled !== undefined
        ) {
            return Boolean(
                provider.enabled
            );
        }

        /*
         * Jika tidak ada status sama sekali,
         * jangan mengarang provider aktif.
         */
        return false;
    }

    /* =========================================================
       MODEL HELPERS
       ========================================================= */

    function findDuplicateModel(
        models,
        modelId,
        excludeId = null
    ) {
        const list =
            Array.isArray(models)
                ? models
                : [];

        const targetModelId =
            normalizeId(modelId)
                .toLowerCase();

        const targetExcludeId =
            normalizeId(excludeId);

        if (!targetModelId) {
            return null;
        }

        return (
            list.find(model => {
                const currentId =
                    normalizeId(model?.id);

                const currentModelId =
                    normalizeId(
                        model?.model_id ??
                        model?.modelId
                    ).toLowerCase();

                if (
                    targetExcludeId &&
                    currentId === targetExcludeId
                ) {
                    return false;
                }

                return (
                    currentModelId &&
                    currentModelId ===
                    targetModelId
                );
            }) || null
        );
    }

    function findModelById(
        models,
        id
    ) {
        const list =
            Array.isArray(models)
                ? models
                : [];

        const target =
            normalizeId(id);

        if (!target) {
            return null;
        }

        return (
            list.find(model => {
                return (
                    normalizeId(
                        model?.id
                    ) === target ||
                    normalizeId(
                        model?.model_id ??
                        model?.modelId
                    ) === target
                );
            }) || null
        );
    }

    /* =========================================================
       CREDIT
       ========================================================= */

    /*
     * Credit Final TIDAK lagi menjadi bagian dari Create.
     *
     * Pricing model:
     *
     * credit_480p
     * credit_720p
     * credit_1080p
     * discount_percent
     *
     * Credit Final dihitung runtime oleh pricing / Generate:
     *
     * final =
     * credit -
     * (credit * discount_percent / 100)
     *
     * Fungsi Create hanya membaca dan menyimpan
     * credit dasar per resolusi + discount.
     */

    function readResolutionCredit(
        data,
        snakeCaseKey,
        camelCaseKey
    ) {
        if (
            hasOwn(
                data,
                snakeCaseKey
            ) &&
            hasValue(
                data[snakeCaseKey]
            )
        ) {
            return toNumber(
                data[snakeCaseKey],
                0
            );
        }

        if (
            hasOwn(
                data,
                camelCaseKey
            ) &&
            hasValue(
                data[camelCaseKey]
            )
        ) {
            return toNumber(
                data[camelCaseKey],
                0
            );
        }

        return 0;
    }

    /* =========================================================
       NORMALIZE CREATE DATA
       ========================================================= */

    function normalizeModelData(
        data,
        providers = state.providers
    ) {
        const source =
            data &&
            typeof data === "object"
                ? data
                : {};

        const providerInput =
            normalizeId(
                source.provider_id ??
                source.providerId
            );

        const provider =
            findProvider(
                providers,
                providerInput
            );

        const providerId =
            provider
                ? normalizeId(
                    provider.id
                )
                : providerInput;

        const modelId =
            normalizeText(
                source.model_id ??
                source.modelId
            );

        const modelName =
            normalizeText(
                source.model_name ??
                source.modelName
            );

        const description =
            normalizeText(
                source.description
            );

        const discountPercent =
            toNumber(
                source.discount_percent ??
                source.discountPercent,
                0
            );

        /*
         * Resolution credit adalah nilai independen.
         *
         * Jangan hitung dari KIE price.
         * Jangan hitung dari discount.
         * Jangan hitung dari duration.
         * Jangan hitung dari resolution.
         *
         * Discount hanya digunakan oleh runtime pricing
         * ketika Generate melakukan perhitungan Credit Final.
         */
        const credit480p =
            readResolutionCredit(
                source,
                "credit_480p",
                "credit480p"
            );

        const credit720p =
            readResolutionCredit(
                source,
                "credit_720p",
                "credit720p"
            );

        const credit1080p =
            readResolutionCredit(
                source,
                "credit_1080p",
                "credit1080p"
            );

        const minDuration =
            toNumber(
                source.min_duration ??
                source.minDuration,
                0
            );

        const maxDuration =
            toNumber(
                source.max_duration ??
                source.maxDuration,
                minDuration
            );

        const supportedRatios =
            normalizeArray(
                source.supported_ratios ??
                source.supportedRatios
            );

        const supportedResolutions =
            normalizeArray(
                source.supported_resolutions ??
                source.supportedResolutions
            );

        const status =
            normalizeStatus(
                source.status
            );

        return {
            provider_id: providerId,

            model_id: modelId,
            model_name: modelName,
            description: description,

            discount_percent:
                discountPercent,

            credit_480p:
                credit480p,

            credit_720p:
                credit720p,

            credit_1080p:
                credit1080p,

            min_duration:
                minDuration,

            max_duration:
                maxDuration,

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions,

            status:
                status
        };
    }

    /* =========================================================
       VALIDATION
       ========================================================= */

    function validateModelData(
        data,
        options = {}
    ) {
        const model =
            data &&
            typeof data === "object"
                ? data
                : {};

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

        const errors = [];

        const providerId =
            normalizeId(
                model.provider_id
            );

        const modelId =
            normalizeText(
                model.model_id
            );

        const modelName =
            normalizeText(
                model.model_name
            );

        /* -----------------------------------------------------
           Provider
           ----------------------------------------------------- */

        if (!providerId) {
            errors.push(
                "Provider wajib dipilih."
            );
        } else {
            const provider =
                findProvider(
                    providers,
                    providerId
                );

            if (!provider) {
                errors.push(
                    "Provider tidak ditemukan."
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

        /* -----------------------------------------------------
           Model identity
           ----------------------------------------------------- */

        if (!modelId) {
            errors.push(
                "Model ID wajib diisi."
            );
        }

        if (!modelName) {
            errors.push(
                "Model Name wajib diisi."
            );
        }

        /* -----------------------------------------------------
           Duplicate Model ID
           ----------------------------------------------------- */

        if (modelId) {
            const duplicate =
                findDuplicateModel(
                    models,
                    modelId,
                    options.excludeId
                );

            if (duplicate) {
                errors.push(
                    `Model ID "${modelId}" sudah digunakan.`
                );
            }
        }

        /* -----------------------------------------------------
           Credits
           ----------------------------------------------------- */

        const discountPercent =
            toNumber(
                model.discount_percent,
                0
            );

        const credit480p =
            toNumber(
                model.credit_480p,
                0
            );

        const credit720p =
            toNumber(
                model.credit_720p,
                0
            );

        const credit1080p =
            toNumber(
                model.credit_1080p,
                0
            );

        if (
            !Number.isFinite(
                discountPercent
            ) ||
            discountPercent < 0 ||
            discountPercent > 100
        ) {
            errors.push(
                "Discount harus berada di antara 0 dan 100."
            );
        }

        if (
            !Number.isFinite(
                credit480p
            ) ||
            credit480p < 0
        ) {
            errors.push(
                "Credit 480p tidak valid."
            );
        }

        if (
            !Number.isFinite(
                credit720p
            ) ||
            credit720p < 0
        ) {
            errors.push(
                "Credit 720p tidak valid."
            );
        }

        if (
            !Number.isFinite(
                credit1080p
            ) ||
            credit1080p < 0
        ) {
            errors.push(
                "Credit 1080p tidak valid."
            );
        }

        /* -----------------------------------------------------
           Duration
           ----------------------------------------------------- */

        const minDuration =
            toNumber(
                model.min_duration,
                0
            );

        const maxDuration =
            toNumber(
                model.max_duration,
                0
            );

        if (
            !Number.isFinite(
                minDuration
            ) ||
            minDuration < 0
        ) {
            errors.push(
                "Minimum duration tidak valid."
            );
        }

        if (
            !Number.isFinite(
                maxDuration
            ) ||
            maxDuration < 0
        ) {
            errors.push(
                "Maximum duration tidak valid."
            );
        }

        if (
            maxDuration <
            minDuration
        ) {
            errors.push(
                "Maximum duration tidak boleh lebih kecil dari minimum duration."
            );
        }

        /* -----------------------------------------------------
           Capabilities
           ----------------------------------------------------- */

        if (
            !Array.isArray(
                model.supported_ratios
            )
        ) {
            errors.push(
                "Supported ratios harus berupa array."
            );
        }

        if (
            !Array.isArray(
                model.supported_resolutions
            )
        ) {
            errors.push(
                "Supported resolutions harus berupa array."
            );
        }

        /* -----------------------------------------------------
           Status
           ----------------------------------------------------- */

        if (
            !VALID_STATUS.has(
                normalizeStatus(
                    model.status
                )
            )
        ) {
            errors.push(
                "Status model tidak valid."
            );
        }

        return {
            valid:
                errors.length === 0,

            errors
        };
    }

    /* =========================================================
       COLLECT FORM DATA
       ========================================================= */

    function collectFormData(
        root = state.root
    ) {
        const form =
            getRoot(root);

        /*
         * Provider
         *
         * Layout modern:
         * #providerId
         *
         * Compatibility:
         * #provider_id
         * name=provider_id
         * name=providerId
         */
        const providerId =
            getFieldValue(
                form,
                [
                    "#providerId",
                    "#provider_id",
                    "[name='provider_id']",
                    "[name='providerId']"
                ]
            );

        /*
         * Model ID
         *
         * Search layout:
         * #modelCodeSearch
         *
         * Compatibility:
         * #modelId
         * #model_id
         * name=model_id
         * name=modelId
         */
        const modelId =
            getFieldValue(
                form,
                [
                    "#modelCodeSearch",
                    "#modelId",
                    "#model_id",
                    "[name='model_id']",
                    "[name='modelId']"
                ]
            );

        /*
         * Model Name
         */
        const modelName =
            getFieldValue(
                form,
                [
                    "#modelName",
                    "#model_name",
                    "[name='model_name']",
                    "[name='modelName']"
                ]
            );

        /*
         * Description
         */
        const description =
            getFieldValue(
                form,
                [
                    "#description",
                    "#modelDescription",
                    "#model_description",
                    "[name='description']",
                    "[name='model_description']"
                ]
            );

        /*
         * Discount
         *
         * credit_final TIDAK dibaca dari form.
         *
         * Credit Final bukan data database.
         * Nilainya dihitung runtime berdasarkan:
         *
         * credit_xxx
         * +
         * discount_percent
         */
        const discountPercent =
            getFieldValue(
                form,
                [
                    "#discountPercent",
                    "#discount_percent",
                    "[name='discount_percent']",
                    "[name='discountPercent']"
                ]
            );

        /*
         * Resolution Credits
         */
        const credit480p =
            getFieldValue(
                form,
                [
                    "#credit480p",
                    "#credit_480p",
                    "[name='credit_480p']",
                    "[name='credit480p']"
                ]
            );

        const credit720p =
            getFieldValue(
                form,
                [
                    "#credit720p",
                    "#credit_720p",
                    "[name='credit_720p']",
                    "[name='credit720p']"
                ]
            );

        const credit1080p =
            getFieldValue(
                form,
                [
                    "#credit1080p",
                    "#credit_1080p",
                    "[name='credit_1080p']",
                    "[name='credit1080p']"
                ]
            );

        /*
         * Duration
         */
        const minDuration =
            getFieldValue(
                form,
                [
                    "#minDuration",
                    "#min_duration",
                    "[name='min_duration']",
                    "[name='minDuration']"
                ]
            );

        const maxDuration =
            getFieldValue(
                form,
                [
                    "#maxDuration",
                    "#max_duration",
                    "[name='max_duration']",
                    "[name='maxDuration']"
                ]
            );

        /*
         * Status
         */
        const status =
            getFieldValue(
                form,
                [
                    "#status",
                    "#modelStatus",
                    "[name='status']",
                    "[name='modelStatus']"
                ],
                "inactive"
            );

        /* -----------------------------------------------------
           Ratios
           ----------------------------------------------------- */

        let supportedRatios = [];

        const ratioInputs =
            form.querySelectorAll(
                [
                    "input[name='supported_ratios']:checked",
                    "input[name='supportedRatios']:checked",
                    "input[data-ratio]:checked",
                    "input[data-model-ratio]:checked"
                ].join(",")
            );

        ratioInputs.forEach(input => {
            const value =
                normalizeText(
                    input.value ||
                    input.dataset.ratio ||
                    input.dataset.modelRatio
                );

            if (value) {
                supportedRatios.push(
                    value
                );
            }
        });

        /*
         * Fallback ke select / hidden field
         * jika tidak ada checkbox.
         */
        if (!supportedRatios.length) {
            const ratioField =
                queryFirst(
                    form,
                    [
                        "#supportedRatios",
                        "#supported_ratios",
                        "[name='supported_ratios']",
                        "[name='supportedRatios']"
                    ]
                );

            if (ratioField) {
                if (
                    typeof HTMLSelectElement !==
                        "undefined" &&
                    ratioField instanceof
                        HTMLSelectElement &&
                    ratioField.multiple
                ) {
                    supportedRatios =
                        Array.from(
                            ratioField.selectedOptions
                        )
                        .map(option =>
                            normalizeText(
                                option.value
                            )
                        )
                        .filter(Boolean);
                } else {
                    supportedRatios =
                        normalizeArray(
                            ratioField.value
                        );
                }
            }
        }

        supportedRatios =
            Array.from(
                new Set(
                    supportedRatios
                )
            );

        /* -----------------------------------------------------
           Resolutions
           ----------------------------------------------------- */

        let supportedResolutions = [];

        const resolutionInputs =
            form.querySelectorAll(
                [
                    "input[name='supported_resolutions']:checked",
                    "input[name='supportedResolutions']:checked",
                    "input[data-resolution]:checked",
                    "input[data-model-resolution]:checked"
                ].join(",")
            );

        resolutionInputs.forEach(input => {
            const value =
                normalizeText(
                    input.value ||
                    input.dataset.resolution ||
                    input.dataset.modelResolution
                );

            if (value) {
                supportedResolutions.push(
                    value
                );
            }
        });

        if (
            !supportedResolutions.length
        ) {
            const resolutionField =
                queryFirst(
                    form,
                    [
                        "#supportedResolutions",
                        "#supported_resolutions",
                        "[name='supported_resolutions']",
                        "[name='supportedResolutions']"
                    ]
                );

            if (resolutionField) {
                if (
                    typeof HTMLSelectElement !==
                        "undefined" &&
                    resolutionField instanceof
                        HTMLSelectElement &&
                    resolutionField.multiple
                ) {
                    supportedResolutions =
                        Array.from(
                            resolutionField.selectedOptions
                        )
                        .map(option =>
                            normalizeText(
                                option.value
                            )
                        )
                        .filter(Boolean);
                } else {
                    supportedResolutions =
                        normalizeArray(
                            resolutionField.value
                        );
                }
            }
        }

        supportedResolutions =
            Array.from(
                new Set(
                    supportedResolutions
                )
            );

        /*
         * Payload CREATE sengaja hanya berisi:
         *
         * provider_id
         * model_id
         * model_name
         * description
         * discount_percent
         * credit_480p
         * credit_720p
         * credit_1080p
         * min_duration
         * max_duration
         * supported_ratios
         * supported_resolutions
         * status
         *
         * Tidak ada:
         * credit_cost
         * credit_final
         */
        return {
            provider_id:
                normalizeId(
                    providerId
                ),

            model_id:
                normalizeText(
                    modelId
                ),

            model_name:
                normalizeText(
                    modelName
                ),

            description:
                normalizeText(
                    description
                ),

            discount_percent:
                discountPercent,

            credit_480p:
                credit480p,

            credit_720p:
                credit720p,

            credit_1080p:
                credit1080p,

            min_duration:
                minDuration,

            max_duration:
                maxDuration,

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions,

            status:
                normalizeStatus(
                    status
                )
        };
    }

    /* =========================================================
       PREPARE CREATE DATA
       ========================================================= */

    function prepareCreateData(
        data,
        options = {}
    ) {
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

        const normalized =
            normalizeModelData(
                data,
                providers
            );

        const validation =
            validateModelData(
                normalized,
                {
                    providers,
                    models,
                    excludeId:
                        options.excludeId
                }
            );

        return {
            data: normalized,

            valid:
                validation.valid,

            errors:
                validation.errors
        };
    }

    /* =========================================================
       SUBMIT
       ========================================================= */

    async function submit(
        data,
        options = {}
    ) {
        const prepared =
            prepareCreateData(
                data,
                options
            );

        if (!prepared.valid) {
            const error =
                new Error(
                    prepared.errors.join(" ")
                );

            error.code =
                "MODEL_FORM_VALIDATION";

            error.errors =
                prepared.errors;

            throw error;
        }

        /*
         * Hanya satu callback yang boleh dijalankan.
         *
         * Jangan memanggil create + onSubmit sekaligus.
         */
        let callback = null;

        if (
            typeof options.insert ===
            "function"
        ) {
            callback =
                options.insert;
        } else if (
            typeof options.onSubmit ===
            "function"
        ) {
            callback =
                options.onSubmit;
        } else if (
            typeof options.submit ===
            "function"
        ) {
            callback =
                options.submit;
        }

        if (!callback) {
            throw new Error(
                "Create Model callback tidak tersedia."
            );
        }

        return await callback(
            prepared.data
        );
    }

    /* =========================================================
       CREATE STATE
       ========================================================= */

    function openCreate(
        options = {}
    ) {
        state.active = true;

        if (
            options.root !== undefined
        ) {
            state.root =
                getRoot(
                    options.root
                );
        }

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

        return getState();
    }

    function closeCreate() {
        state.active = false;

        return getState();
    }

    function isActive() {
        return state.active;
    }

    function setData(
        data = {}
    ) {
        if (
            Array.isArray(
                data.providers
            )
        ) {
            state.providers =
                data.providers;
        }

        if (
            Array.isArray(
                data.models
            )
        ) {
            state.models =
                data.models;
        }

        if (
            data.root !== undefined
        ) {
            state.root =
                getRoot(
                    data.root
                );
        }

        return getState();
    }

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

    /* =========================================================
       CREATE FROM FORM
       ========================================================= */

    async function createFromForm(
        event,
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
            state.root ||
            getRoot();

        const data =
            collectFormData(
                root
            );

        return await submit(
            data,
            {
                ...options,

                root,

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

    /* =========================================================
       DIRECT CREATE
       ========================================================= */

    async function create(
        data,
        options = {}
    ) {
        return await submit(
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

    /* =========================================================
       VALIDATE FORM
       ========================================================= */

    function validateForm(
        root = state.root,
        options = {}
    ) {
        const data =
            collectFormData(
                root
            );

        const prepared =
            prepareCreateData(
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

        return {
            ...prepared,
            formData:
                data
        };
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const API = {
        MODEL_FIELDS,

        VALID_STATUS,
        VALID_RATIOS,
        VALID_RESOLUTIONS,

        openCreate,
        closeCreate,
        isActive,

        setData,
        getState,

        collectFormData,

        normalizeModelData,
        prepareCreateData,

        validateModelData,
        validateForm,

        findProvider,
        findDuplicateModel,
        findModelById,

        createFromForm,
        create,
        submit
    };

    window.GENZModelFormCreate =
        API;

})();
