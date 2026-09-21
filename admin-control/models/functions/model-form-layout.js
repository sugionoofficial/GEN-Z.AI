/* =========================================================
   GEN-Z.AI
   MODEL FORM LAYOUT MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-layout.js

   Tanggung jawab:
   - Render Model Form
   - Populate Provider
   - Populate Model ID
   - Populate Model Name
   - Populate Description
   - Populate Credit
   - Populate Duration
   - Populate Ratio
   - Populate Resolution
   - Handle selected model
   - Collect / normalize form state

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Model Search database
   - Create database operation
   - Edit database operation
   - Delete database operation
   - Provider lifecycle

   Pricing source:
   - credit_480p
   - credit_720p
   - credit_1080p
   - discount_percent

   Credit Final:
   - runtime only
   - tidak disimpan ke database
   - tidak menggunakan credit_cost
   - tidak menggunakan credit_final
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       CONSTANTS
       ========================================================= */

    const VALID_STATUS = new Set([
        "active",
        "inactive",
        "maintenance"
    ]);

    /*
     * Compatibility only.
     *
     * Capability tidak dibuat dari daftar ini.
     * Data model tetap menjadi source of truth.
     */
    const RESOLUTION_ORDER = [
        "480p",
        "720p",
        "1080p"
    ];

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

    function normalizeNumber(
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
                .replace(/,/g, "")
                .trim();

        if (!normalized) {
            return fallback;
        }

        const number =
            Number(normalized);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function hasOwn(
        object,
        key
    ) {
        return Boolean(
            object &&
            Object.prototype.hasOwnProperty.call(
                object,
                key
            )
        );
    }

    function hasValue(value) {
        return !(
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        );
    }

    function normalizeArray(value) {
        if (Array.isArray(value)) {
            return value
                .map(item =>
                    normalizeText(item)
                )
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
            const text =
                value.trim();

            if (!text) {
                return [];
            }

            if (
                text.startsWith("[") &&
                text.endsWith("]")
            ) {
                try {
                    const parsed =
                        JSON.parse(text);

                    if (
                        Array.isArray(parsed)
                    ) {
                        return parsed
                            .map(item =>
                                normalizeText(item)
                            )
                            .filter(Boolean);
                    }
                } catch (_) {
                    /* fallback */
                }
            }

            return text
                .split(",")
                .map(item =>
                    item.trim()
                )
                .filter(Boolean);
        }

        return [
            normalizeText(value)
        ].filter(Boolean);
    }

    function uniqueArray(value) {
        return Array.from(
            new Set(
                normalizeArray(value)
            )
        );
    }

    function normalizeStatus(
        value
    ) {
        const status =
            normalizeText(
                value
            ).toLowerCase();

        return VALID_STATUS.has(status)
            ? status
            : "inactive";
    }

    /* =========================================================
       DOM
       ========================================================= */

    function getRoot(root) {
        if (
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
            document.getElementById(
                "modelForm"
            ) ||
            document.getElementById(
                "modelsForm"
            ) ||
            document.querySelector(
                "form[data-model-form]"
            ) ||
            document
        );
    }

    function queryFirst(
        root,
        selectors
    ) {
        const container =
            getRoot(root);

        for (
            const selector of selectors
        ) {
            try {
                const element =
                    container.querySelector(
                        selector
                    );

                if (element) {
                    return element;
                }
            } catch (_) {
                /* Ignore invalid selector */
            }
        }

        return null;
    }

    function queryAll(
        root,
        selectors
    ) {
        const container =
            getRoot(root);

        try {
            return Array.from(
                container.querySelectorAll(
                    selectors
                )
            );
        } catch (_) {
            return [];
        }
    }

    function setValue(
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

        element.value =
            value === null ||
            value === undefined
                ? ""
                : String(value);

        return true;
    }

    function getValue(
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

        return element.value !==
            undefined
            ? element.value
            : fallback;
    }

    /* =========================================================
       FIELD SELECTORS
       ========================================================= */

    const FIELD = {
        provider: [
            "#providerId",
            "#provider_id",
            "[name='provider_id']",
            "[name='providerId']"
        ],

        modelId: [
            "#modelCodeSearch",
            "#modelId",
            "#model_id",
            "[name='model_id']",
            "[name='modelId']"
        ],

        modelName: [
            "#modelName",
            "#model_name",
            "[name='model_name']",
            "[name='modelName']"
        ],

        description: [
            "#description",
            "#modelDescription",
            "#model_description",
            "[name='description']",
            "[name='model_description']"
        ],

        /*
         * Legacy pricing selectors sengaja dipertahankan
         * hanya sebagai compatibility terhadap DOM lama.
         *
         * Tidak dibaca / ditulis sebagai sumber pricing.
         */
        creditCost: [
            "#creditCost",
            "#credit_cost",
            "[name='credit_cost']",
            "[name='creditCost']"
        ],

        discountPercent: [
            "#discountPercent",
            "#discount_percent",
            "[name='discount_percent']",
            "[name='discountPercent']"
        ],

        creditFinal: [
            "#creditFinal",
            "#credit_final",
            "[name='credit_final']",
            "[name='creditFinal']"
        ],

        credit480p: [
            "#credit480p",
            "#credit_480p",
            "[name='credit_480p']",
            "[name='credit480p']"
        ],

        credit720p: [
            "#credit720p",
            "#credit_720p",
            "[name='credit_720p']",
            "[name='credit720p']"
        ],

        credit1080p: [
            "#credit1080p",
            "#credit_1080p",
            "[name='credit_1080p']",
            "[name='credit1080p']"
        ],

        minDuration: [
            "#minDuration",
            "#min_duration",
            "[name='min_duration']",
            "[name='minDuration']"
        ],

        maxDuration: [
            "#maxDuration",
            "#max_duration",
            "[name='max_duration']",
            "[name='maxDuration']"
        ],

        status: [
            "#status",
            "#modelStatus",
            "[name='status']",
            "[name='modelStatus']"
        ],

        ratios: [
            "#supportedRatios",
            "#supported_ratios",
            "[name='supported_ratios']",
            "[name='supportedRatios']"
        ],

        resolutions: [
            "#supportedResolutions",
            "#supported_resolutions",
            "[name='supported_resolutions']",
            "[name='supportedResolutions']"
        ]
    };

    /* =========================================================
       CREDIT
       ========================================================= */

    /*
     * Runtime-only discounted credit.
     *
     * Tidak menggunakan credit_cost.
     * Tidak membaca credit_final dari database.
     */
    function calculateCreditFinal(
        credit,
        discountPercent
    ) {
        const baseCredit =
            normalizeNumber(
                credit,
                0
            );

        const discount =
            Math.min(
                100,
                Math.max(
                    0,
                    normalizeNumber(
                        discountPercent,
                        0
                    )
                )
            );

        const result =
            baseCredit -
            (
                baseCredit *
                discount /
                100
            );

        return Math.max(
            0,
            Number(
                result.toFixed(6)
            )
        );
    }

    function readCreditField(
        model,
        snakeKey,
        camelKey,
        fallback = 0
    ) {
        if (
            hasOwn(model, snakeKey) &&
            hasValue(model[snakeKey])
        ) {
            return normalizeNumber(
                model[snakeKey],
                fallback
            );
        }

        if (
            hasOwn(model, camelKey) &&
            hasValue(model[camelKey])
        ) {
            return normalizeNumber(
                model[camelKey],
                fallback
            );
        }

        return fallback;
    }

    function getRuntimeCreditValues(
        model
    ) {
        const source =
            model &&
            typeof model === "object"
                ? model
                : {};

        const discountPercent =
            normalizeNumber(
                source.discount_percent ??
                source.discountPercent,
                0
            );

        const credit480p =
            readCreditField(
                source,
                "credit_480p",
                "credit480p",
                0
            );

        const credit720p =
            readCreditField(
                source,
                "credit_720p",
                "credit720p",
                0
            );

        const credit1080p =
            readCreditField(
                source,
                "credit_1080p",
                "credit1080p",
                0
            );

        return {
            credit_480p:
                credit480p,

            credit_720p:
                credit720p,

            credit_1080p:
                credit1080p,

            discount_percent:
                discountPercent,

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

    /* =========================================================
       MODEL NORMALIZATION
       ---------------------------------------------------------
       Tidak menggunakan normalizeModel() dari
       models-data.js karena function tersebut bukan
       public export pada architecture saat ini.
       ========================================================= */

    function normalizeFormModel(
        model
    ) {
        if (
            !model ||
            typeof model !== "object"
        ) {
            return null;
        }

        const discountPercent =
            normalizeNumber(
                model.discount_percent ??
                model.discountPercent,
                0
            );

        /*
         * Pricing hanya menggunakan:
         * - credit_480p
         * - credit_720p
         * - credit_1080p
         * - discount_percent
         *
         * Tidak ada fallback ke credit_cost
         * atau credit_final.
         */
        const credit480p =
            readCreditField(
                model,
                "credit_480p",
                "credit480p",
                0
            );

        const credit720p =
            readCreditField(
                model,
                "credit_720p",
                "credit720p",
                0
            );

        const credit1080p =
            readCreditField(
                model,
                "credit_1080p",
                "credit1080p",
                0
            );

        const supportedRatios =
            uniqueArray(
                model.supported_ratios ??
                model.supportedRatios
            );

        const supportedResolutions =
            uniqueArray(
                model.supported_resolutions ??
                model.supportedResolutions
            );

        const minDuration =
            normalizeNumber(
                model.min_duration ??
                model.minDuration,
                0
            );

        const maxDuration =
            normalizeNumber(
                model.max_duration ??
                model.maxDuration,
                minDuration
            );

        return {
            id:
                normalizeId(
                    model.id
                ),

            provider_id:
                normalizeId(
                    model.provider_id ??
                    model.providerId
                ),

            provider_name:
                normalizeText(
                    model.provider_name ??
                    model.providerName
                ),

            provider_code:
                normalizeText(
                    model.provider_code ??
                    model.providerCode
                ),

            model_id:
                normalizeText(
                    model.model_id ??
                    model.modelId
                ),

            model_name:
                normalizeText(
                    model.model_name ??
                    model.modelName
                ),

            model_family:
                normalizeText(
                    model.model_family ??
                    model.modelFamily
                ),

            description:
                normalizeText(
                    model.description
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
                    model.status
                ),

            kie_unit_price:
                normalizeNumber(
                    model.kie_unit_price ??
                    model.kieUnitPrice,
                    0
                ),

            kie_price:
                normalizeNumber(
                    model.kie_price ??
                    model.kiePrice,
                    0
                )
        };
    }

    /* =========================================================
       PROVIDER LOOKUP
       ---------------------------------------------------------
       Synchronous lookup terhadap array provider
       yang sudah diberikan oleh Models lifecycle.
       ========================================================= */

    function resolveProvider(
        providers,
        providerId
    ) {
        const list =
            Array.isArray(providers)
                ? providers
                : [];

        const target =
            normalizeId(
                providerId
            );

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
                    normalizeId(
                        provider?.id
                    ) === target
                );
            });

        if (byId) {
            return byId;
        }

        /*
         * Compatibility provider_id
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

        /*
         * Compatibility code
         */
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

        return (
            byProviderCode ||
            null
        );
    }

    /* =========================================================
       MODEL LOOKUP
       ========================================================= */

    function findModel(
        models,
        modelId
    ) {
        const list =
            Array.isArray(models)
                ? models
                : [];

        const target =
            normalizeId(
                modelId
            ).toLowerCase();

        if (!target) {
            return null;
        }

        return (
            list.find(model => {
                const id =
                    normalizeId(
                        model?.model_id ??
                        model?.modelId
                    ).toLowerCase();

                return (
                    id === target
                );
            }) ||
            null
        );
    }

    /* =========================================================
       PROVIDER OPTIONS
       ========================================================= */

    function updateProviderOptions(
        root,
        providers,
        selectedProviderId = ""
    ) {
        const select =
            queryFirst(
                root,
                FIELD.provider
            );

        if (
            !select ||
            select.tagName !==
                "SELECT"
        ) {
            return false;
        }

        const selected =
            normalizeId(
                selectedProviderId
            );

        /*
         * Jangan membuat provider palsu.
         */
        const fragment =
            document.createDocumentFragment();

        const placeholder =
            document.createElement(
                "option"
            );

        placeholder.value = "";
        placeholder.textContent =
            "Pilih provider...";

        fragment.appendChild(
            placeholder
        );

        const list =
            Array.isArray(providers)
                ? providers
                : [];

        list.forEach(provider => {
            const id =
                normalizeId(
                    provider?.id
                );

            if (!id) {
                return;
            }

            const option =
                document.createElement(
                    "option"
                );

            option.value = id;

            option.textContent =
                normalizeText(
                    provider?.name ??
                    provider?.provider_name ??
                    provider?.code ??
                    provider?.provider_code ??
                    id
                );

            if (
                id === selected
            ) {
                option.selected = true;
            }

            fragment.appendChild(
                option
            );
        });

        select.replaceChildren(
            fragment
        );

        return true;
    }

    function updateProviderStatus(
        root,
        providers
    ) {
        const form =
            getRoot(root);

        const providerField =
            queryFirst(
                form,
                FIELD.provider
            );

        if (!providerField) {
            return false;
        }

        const provider =
            resolveProvider(
                providers,
                providerField.value
            );

        /*
         * Hanya update UI state.
         * Tidak menulis field database lain.
         */
        const statusElement =
            queryFirst(
                form,
                [
                    "#providerStatus",
                    "[data-provider-status]"
                ]
            );

        if (statusElement) {
            const status =
                normalizeText(
                    provider?.status
                ).toLowerCase();

            statusElement.textContent =
                status ||
                "unknown";

            statusElement.dataset.status =
                status ||
                "unknown";
        }

        return Boolean(
            provider
        );
    }

    /* =========================================================
       MODEL ID OPTIONS
       ========================================================= */

    function updateModelIdOptions(
        root,
        models,
        providerId = null
    ) {
        const field =
            queryFirst(
                root,
                FIELD.modelId
            );

        if (!field) {
            return false;
        }

        /*
         * Jika field bukan input yang memiliki datalist,
         * jangan memaksakan perubahan markup.
         */
        let datalist = null;

        if (
            field.getAttribute(
                "list"
            )
        ) {
            datalist =
                document.getElementById(
                    field.getAttribute(
                        "list"
                    )
                );
        }

        if (!datalist) {
            datalist =
                queryFirst(
                    getRoot(root),
                    [
                        "#modelIdList",
                        "#model-id-list",
                        "datalist[data-model-id-list]"
                    ]
                );
        }

        if (!datalist) {
            return false;
        }

        const providerTarget =
            providerId === null
                ? normalizeId(
                    queryFirst(
                        root,
                        FIELD.provider
                    )?.value
                )
                : normalizeId(
                    providerId
                );

        const list =
            Array.isArray(models)
                ? models
                : [];

        const filtered =
            providerTarget
                ? list.filter(model => {
                    return (
                        normalizeId(
                            model?.provider_id ??
                            model?.providerId
                        ) ===
                        providerTarget
                    );
                })
                : list;

        datalist.replaceChildren();

        filtered.forEach(model => {
            const modelId =
                normalizeText(
                    model?.model_id ??
                    model?.modelId
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
                normalizeText(
                    model?.model_name ??
                    model?.modelName
                );

            if (modelName) {
                option.label =
                    modelName;
            }

            datalist.appendChild(
                option
            );
        });

        return true;
    }

    /* =========================================================
       CHECKBOX HELPERS
       ========================================================= */

    function getRatioCheckboxes(
        root
    ) {
        return queryAll(
            root,
            [
                "input[type='checkbox'][data-ratio]",
                "input[type='checkbox'][data-model-ratio]",
                "input[type='checkbox'][name='supported_ratios']",
                "input[type='checkbox'][name='supportedRatios']"
            ].join(",")
        );
    }

    function getResolutionCheckboxes(
        root
    ) {
        return queryAll(
            root,
            [
                "input[type='checkbox'][data-resolution]",
                "input[type='checkbox'][data-model-resolution]",
                "input[type='checkbox'][name='supported_resolutions']",
                "input[type='checkbox'][name='supportedResolutions']"
            ].join(",")
        );
    }

    function getCheckboxValue(
        element,
        type
    ) {
        if (!element) {
            return "";
        }

        if (type === "ratio") {
            return normalizeText(
                element.value ||
                element.dataset.ratio ||
                element.dataset.modelRatio
            );
        }

        return normalizeText(
            element.value ||
            element.dataset.resolution ||
            element.dataset.modelResolution
        );
    }

    function setCapabilityCheckboxes(
        root,
        ratios,
        resolutions
    ) {
        const normalizedRatios =
            new Set(
                normalizeArray(
                    ratios
                )
            );

        const normalizedResolutions =
            new Set(
                normalizeArray(
                    resolutions
                )
            );

        getRatioCheckboxes(
            root
        ).forEach(input => {
            const value =
                getCheckboxValue(
                    input,
                    "ratio"
                );

            input.checked =
                normalizedRatios.has(
                    value
                );
        });

        getResolutionCheckboxes(
            root
        ).forEach(input => {
            const value =
                getCheckboxValue(
                    input,
                    "resolution"
                );

            input.checked =
                normalizedResolutions.has(
                    value
                );
        });
    }

    function readCapabilityCheckboxes(
        root
    ) {
        const ratios = [];

        getRatioCheckboxes(
            root
        ).forEach(input => {
            if (!input.checked) {
                return;
            }

            const value =
                getCheckboxValue(
                    input,
                    "ratio"
                );

            if (value) {
                ratios.push(value);
            }
        });

        const resolutions = [];

        getResolutionCheckboxes(
            root
        ).forEach(input => {
            if (!input.checked) {
                return;
            }

            const value =
                getCheckboxValue(
                    input,
                    "resolution"
                );

            if (value) {
                resolutions.push(value);
            }
        });

        return {
            supported_ratios:
                uniqueArray(
                    ratios
                ),

            supported_resolutions:
                uniqueArray(
                    resolutions
                )
        };
    }

    /* =========================================================
       SELECT / MULTISELECT CAPABILITY
       ========================================================= */

    function setCapabilitySelects(
        root,
        ratios,
        resolutions
    ) {
        const ratioField =
            queryFirst(
                root,
                FIELD.ratios
            );

        const resolutionField =
            queryFirst(
                root,
                FIELD.resolutions
            );

        if (
            ratioField &&
            ratioField.tagName ===
                "SELECT"
        ) {
            const values =
                new Set(
                    normalizeArray(
                        ratios
                    )
                );

            Array.from(
                ratioField.options
            ).forEach(option => {
                option.selected =
                    values.has(
                        normalizeText(
                            option.value
                        )
                    );
            });
        }

        if (
            resolutionField &&
            resolutionField.tagName ===
                "SELECT"
        ) {
            const values =
                new Set(
                    normalizeArray(
                        resolutions
                    )
                );

            Array.from(
                resolutionField.options
            ).forEach(option => {
                option.selected =
                    values.has(
                        normalizeText(
                            option.value
                        )
                    );
            });
        }
    }

    function readCapabilitySelects(
        root
    ) {
        const ratios = [];
        const resolutions = [];

        const ratioField =
            queryFirst(
                root,
                FIELD.ratios
            );

        const resolutionField =
            queryFirst(
                root,
                FIELD.resolutions
            );

        if (
            ratioField &&
            ratioField.tagName ===
                "SELECT"
        ) {
            Array.from(
                ratioField.selectedOptions
            ).forEach(option => {
                const value =
                    normalizeText(
                        option.value
                    );

                if (value) {
                    ratios.push(
                        value
                    );
                }
            });
        }

        if (
            resolutionField &&
            resolutionField.tagName ===
                "SELECT"
        ) {
            Array.from(
                resolutionField.selectedOptions
            ).forEach(option => {
                const value =
                    normalizeText(
                        option.value
                    );

                if (value) {
                    resolutions.push(
                        value
                    );
                }
            });
        }

        return {
            supported_ratios:
                uniqueArray(
                    ratios
                ),

            supported_resolutions:
                uniqueArray(
                    resolutions
                )
        };
    }

    /* =========================================================
       RENDER MODEL FORM
       ========================================================= */

    function renderModelForm(
        root,
        model = null,
        providers = [],
        options = {}
    ) {
        /*
         * Compatibility signature:
         *
         * renderModelForm(
         *   root,
         *   model,
         *   providers,
         *   options
         * )
         */
        const form =
            getRoot(root);

        if (!form) {
            return null;
        }

        const data =
            normalizeFormModel(
                model
            );

        const providerId =
            normalizeId(
                data?.provider_id
            );

        /*
         * Provider select.
         */
        updateProviderOptions(
            form,
            providers,
            providerId
        );

        /*
         * Provider status.
         */
        updateProviderStatus(
            form,
            providers
        );

        /*
         * Model identity.
         */
        setValue(
            form,
            FIELD.modelId,
            data?.model_id || ""
        );

        setValue(
            form,
            FIELD.modelName,
            data?.model_name || ""
        );

        setValue(
            form,
            FIELD.description,
            data?.description || ""
        );

        /*
         * Credits.
         *
         * Hanya credit per resolution dan discount.
         *
         * credit_cost dan credit_final tidak lagi
         * menjadi bagian dari state pricing.
         */
        setValue(
            form,
            FIELD.discountPercent,
            data
                ? data.discount_percent
                : ""
        );

        setValue(
            form,
            FIELD.credit480p,
            data
                ? data.credit_480p
                : ""
        );

        setValue(
            form,
            FIELD.credit720p,
            data
                ? data.credit_720p
                : ""
        );

        setValue(
            form,
            FIELD.credit1080p,
            data
                ? data.credit_1080p
                : ""
        );

        /*
         * Legacy DOM fields tidak digunakan.
         *
         * Jika masih ada di HTML lama, kosongkan agar
         * tidak ikut membawa nilai pricing lama.
         */
        setValue(
            form,
            FIELD.creditCost,
            ""
        );

        setValue(
            form,
            FIELD.creditFinal,
            ""
        );

        /*
         * Duration.
         */
        setValue(
            form,
            FIELD.minDuration,
            data
                ? data.min_duration
                : ""
        );

        setValue(
            form,
            FIELD.maxDuration,
            data
                ? data.max_duration
                : ""
        );

        /*
         * Status.
         */
        setValue(
            form,
            FIELD.status,
            data
                ? data.status
                : "inactive"
        );

        /*
         * Capability.
         *
         * Tidak membuat capability baru.
         */
        setCapabilityCheckboxes(
            form,
            data
                ? data.supported_ratios
                : [],
            data
                ? data.supported_resolutions
                : []
        );

        setCapabilitySelects(
            form,
            data
                ? data.supported_ratios
                : [],
            data
                ? data.supported_resolutions
                : []
        );

        /*
         * Datalist.
         */
        updateModelIdOptions(
            form,
            options.models || [],
            providerId
        );

        /*
         * Respect edit mode locking.
         */
        if (
            options.mode === "edit" ||
            options.edit === true
        ) {
            lockIdentityFields(
                form,
                true
            );
        } else {
            lockIdentityFields(
                form,
                false
            );
        }

        updateCreditFinalPreview(
            form
        );

        return data;
    }

    /* =========================================================
       LOCK IDENTITY
       ========================================================= */

    function lockIdentityFields(
        root,
        locked
    ) {
        const modelField =
            queryFirst(
                root,
                FIELD.modelId
            );

        const providerField =
            queryFirst(
                root,
                FIELD.provider
            );

        if (modelField) {
            modelField.disabled =
                Boolean(locked);

            modelField.readOnly =
                Boolean(locked);
        }

        if (providerField) {
            providerField.disabled =
                Boolean(locked);
        }
    }

    /* =========================================================
       SELECTED MODEL
       ========================================================= */

    function updateSelectedModelFields(
        root,
        models,
        options = {}
    ) {
        const form =
            getRoot(root);

        const modelId =
            normalizeId(
                getValue(
                    form,
                    FIELD.modelId,
                    ""
                )
            );

        if (!modelId) {
            return null;
        }

        const selected =
            findModel(
                models,
                modelId
            );

        if (!selected) {
            /*
             * Search module mungkin sedang memiliki
             * hasil yang belum masuk currentModels.
             *
             * Jangan mengosongkan form secara agresif.
             */
            return null;
        }

        const data =
            normalizeFormModel(
                selected
            );

        /*
         * Hanya sinkronisasi field yang memang
         * dimiliki Layout.
         */
        setValue(
            form,
            FIELD.modelName,
            data.model_name
        );

        setValue(
            form,
            FIELD.description,
            data.description
        );

        setValue(
            form,
            FIELD.discountPercent,
            data.discount_percent
        );

        setValue(
            form,
            FIELD.credit480p,
            data.credit_480p
        );

        setValue(
            form,
            FIELD.credit720p,
            data.credit_720p
        );

        setValue(
            form,
            FIELD.credit1080p,
            data.credit_1080p
        );

        /*
         * Bersihkan field legacy bila masih ada.
         */
        setValue(
            form,
            FIELD.creditCost,
            ""
        );

        setValue(
            form,
            FIELD.creditFinal,
            ""
        );

        setValue(
            form,
            FIELD.minDuration,
            data.min_duration
        );

        setValue(
            form,
            FIELD.maxDuration,
            data.max_duration
        );

        setValue(
            form,
            FIELD.status,
            data.status
        );

        setCapabilityCheckboxes(
            form,
            data.supported_ratios,
            data.supported_resolutions
        );

        setCapabilitySelects(
            form,
            data.supported_ratios,
            data.supported_resolutions
        );

        updateCreditFinalPreview(
            form
        );

        return data;
    }

    /* =========================================================
       PROVIDER CHANGE
       ========================================================= */

    function handleProviderChange(
        root,
        models = [],
        providers = []
    ) {
        const form =
            getRoot(root);

        const providerId =
            normalizeId(
                getValue(
                    form,
                    FIELD.provider,
                    ""
                )
            );

        /*
         * Update model datalist berdasarkan provider.
         */
        updateModelIdOptions(
            form,
            models,
            providerId
        );

        /*
         * Jangan query provider di sini.
         */
        updateProviderStatus(
            form,
            providers
        );

        const currentModelId =
            normalizeId(
                getValue(
                    form,
                    FIELD.modelId,
                    ""
                )
            );

        if (!currentModelId) {
            return null;
        }

        const currentModel =
            findModel(
                models,
                currentModelId
            );

        if (!currentModel) {
            return null;
        }

        const currentProviderId =
            normalizeId(
                currentModel.provider_id ??
                currentModel.providerId
            );

        /*
         * Model lama berasal dari provider lain.
         * Bersihkan field dependent.
         */
        if (
            currentProviderId &&
            currentProviderId !==
                providerId
        ) {
            clearDependentModelFields(
                form
            );
        }

        return providerId;
    }

    function clearDependentModelFields(
        root
    ) {
        setValue(
            root,
            FIELD.modelId,
            ""
        );

        setValue(
            root,
            FIELD.modelName,
            ""
        );

        setValue(
            root,
            FIELD.description,
            ""
        );

        /*
         * Legacy pricing field tidak lagi digunakan.
         */
        setValue(
            root,
            FIELD.creditCost,
            ""
        );

        setValue(
            root,
            FIELD.discountPercent,
            ""
        );

        setValue(
            root,
            FIELD.creditFinal,
            ""
        );

        setValue(
            root,
            FIELD.credit480p,
            ""
        );

        setValue(
            root,
            FIELD.credit720p,
            ""
        );

        setValue(
            root,
            FIELD.credit1080p,
            ""
        );

        setValue(
            root,
            FIELD.minDuration,
            ""
        );

        setValue(
            root,
            FIELD.maxDuration,
            ""
        );

        setCapabilityCheckboxes(
            root,
            [],
            []
        );

        setCapabilitySelects(
            root,
            [],
            []
        );
    }

    /* =========================================================
       CREDIT PREVIEW
       ========================================================= */

    function updateCreditFinalPreview(
        root
    ) {
        const form =
            getRoot(root);

        const discount =
            normalizeNumber(
                getValue(
                    form,
                    FIELD.discountPercent,
                    0
                ),
                0
            );

        const credit480p =
            normalizeNumber(
                getValue(
                    form,
                    FIELD.credit480p,
                    0
                ),
                0
            );

        const credit720p =
            normalizeNumber(
                getValue(
                    form,
                    FIELD.credit720p,
                    0
                ),
                0
            );

        const credit1080p =
            normalizeNumber(
                getValue(
                    form,
                    FIELD.credit1080p,
                    0
                ),
                0
            );

        const final480p =
            calculateCreditFinal(
                credit480p,
                discount
            );

        const final720p =
            calculateCreditFinal(
                credit720p,
                discount
            );

        const final1080p =
            calculateCreditFinal(
                credit1080p,
                discount
            );

        /*
         * Jika UI mempunyai preview khusus per resolution,
         * sinkronkan runtime value.
         *
         * Field-field ini bukan database fields.
         */
        const previewSelectors = {
            "480p": [
                "#creditFinal480p",
                "#credit_final_480p",
                "[data-credit-final='480p']",
                "[data-credit-final-480p]"
            ],

            "720p": [
                "#creditFinal720p",
                "#credit_final_720p",
                "[data-credit-final='720p']",
                "[data-credit-final-720p]"
            ],

            "1080p": [
                "#creditFinal1080p",
                "#credit_final_1080p",
                "[data-credit-final='1080p']",
                "[data-credit-final-1080p]"
            ]
        };

        setValue(
            form,
            previewSelectors["480p"],
            final480p
        );

        setValue(
            form,
            previewSelectors["720p"],
            final720p
        );

        setValue(
            form,
            previewSelectors["1080p"],
            final1080p
        );

        /*
         * Legacy single Credit Final tidak lagi
         * menjadi bagian dari pricing state.
         *
         * Kosongkan bila elemen lama masih ada.
         */
        setValue(
            form,
            FIELD.creditFinal,
            ""
        );

        return {
            "480p":
                final480p,

            "720p":
                final720p,

            "1080p":
                final1080p
        };
    }

    /* =========================================================
       COLLECT FORM DATA
       ========================================================= */

    function collectModelFormData(
        root
    ) {
        const form =
            getRoot(root);

        const checkboxData =
            readCapabilityCheckboxes(
                form
            );

        const selectData =
            readCapabilitySelects(
                form
            );

        /*
         * Checkbox menjadi prioritas.
         * Select hanya fallback.
         */
        const supportedRatios =
            checkboxData
                .supported_ratios.length
                ? checkboxData
                    .supported_ratios
                : selectData
                    .supported_ratios;

        const supportedResolutions =
            checkboxData
                .supported_resolutions.length
                ? checkboxData
                    .supported_resolutions
                : selectData
                    .supported_resolutions;

        /*
         * Hanya kirim field pricing yang memang
         * menjadi source of truth.
         *
         * Credit Final TIDAK dikirim.
         */
        return {
            provider_id:
                normalizeId(
                    getValue(
                        form,
                        FIELD.provider,
                        ""
                    )
                ),

            model_id:
                normalizeText(
                    getValue(
                        form,
                        FIELD.modelId,
                        ""
                    )
                ),

            model_name:
                normalizeText(
                    getValue(
                        form,
                        FIELD.modelName,
                        ""
                    )
                ),

            description:
                normalizeText(
                    getValue(
                        form,
                        FIELD.description,
                        ""
                    )
                ),

            discount_percent:
                normalizeNumber(
                    getValue(
                        form,
                        FIELD.discountPercent,
                        0
                    ),
                    0
                ),

            credit_480p:
                normalizeNumber(
                    getValue(
                        form,
                        FIELD.credit480p,
                        0
                    ),
                    0
                ),

            credit_720p:
                normalizeNumber(
                    getValue(
                        form,
                        FIELD.credit720p,
                        0
                    ),
                    0
                ),

            credit_1080p:
                normalizeNumber(
                    getValue(
                        form,
                        FIELD.credit1080p,
                        0
                    ),
                    0
                ),

            min_duration:
                normalizeNumber(
                    getValue(
                        form,
                        FIELD.minDuration,
                        0
                    ),
                    0
                ),

            max_duration:
                normalizeNumber(
                    getValue(
                        form,
                        FIELD.maxDuration,
                        0
                    ),
                    0
                ),

            supported_ratios:
                uniqueArray(
                    supportedRatios
                ),

            supported_resolutions:
                uniqueArray(
                    supportedResolutions
                ),

            status:
                normalizeStatus(
                    getValue(
                        form,
                        FIELD.status,
                        "inactive"
                    )
                )
        };
    }

    /* =========================================================
       NORMALIZE SUBMISSION
       ========================================================= */

    function normalizeModelSubmission(
        data
    ) {
        const source =
            data &&
            typeof data === "object"
                ? data
                : {};

        const discountPercent =
            normalizeNumber(
                source.discount_percent ??
                source.discountPercent,
                0
            );

        /*
         * Resolution credits:
         * preserve explicit values including 0.
         *
         * Tidak ada fallback ke credit_cost
         * atau credit_final.
         */
        const credit480p =
            readCreditField(
                source,
                "credit_480p",
                "credit480p",
                0
            );

        const credit720p =
            readCreditField(
                source,
                "credit_720p",
                "credit720p",
                0
            );

        const credit1080p =
            readCreditField(
                source,
                "credit_1080p",
                "credit1080p",
                0
            );

        return {
            provider_id:
                normalizeId(
                    source.provider_id ??
                    source.providerId
                ),

            model_id:
                normalizeText(
                    source.model_id ??
                    source.modelId
                ),

            model_name:
                normalizeText(
                    source.model_name ??
                    source.modelName
                ),

            description:
                normalizeText(
                    source.description
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
                normalizeNumber(
                    source.min_duration ??
                    source.minDuration,
                    0
                ),

            max_duration:
                normalizeNumber(
                    source.max_duration ??
                    source.maxDuration,
                    0
                ),

            supported_ratios:
                uniqueArray(
                    source.supported_ratios ??
                    source.supportedRatios
                ),

            supported_resolutions:
                uniqueArray(
                    source.supported_resolutions ??
                    source.supportedResolutions
                ),

            status:
                normalizeStatus(
                    source.status
                )
        };
    }

    /* =========================================================
       VALIDATION
       ========================================================= */

    function validateModelFormData(
        data
    ) {
        const model =
            data &&
            typeof data === "object"
                ? data
                : {};

        const errors = [];

        if (
            !normalizeId(
                model.provider_id
            )
        ) {
            errors.push(
                "Provider wajib dipilih."
            );
        }

        if (
            !normalizeText(
                model.model_id
            )
        ) {
            errors.push(
                "Model ID wajib diisi."
            );
        }

        if (
            !normalizeText(
                model.model_name
            )
        ) {
            errors.push(
                "Model Name wajib diisi."
            );
        }

        const discountPercent =
            normalizeNumber(
                model.discount_percent,
                0
            );

        const credit480p =
            normalizeNumber(
                model.credit_480p,
                0
            );

        const credit720p =
            normalizeNumber(
                model.credit_720p,
                0
            );

        const credit1080p =
            normalizeNumber(
                model.credit_1080p,
                0
            );

        if (
            discountPercent < 0 ||
            discountPercent > 100
        ) {
            errors.push(
                "Discount harus berada di antara 0 dan 100."
            );
        }

        if (
            credit480p < 0
        ) {
            errors.push(
                "Credit 480p tidak boleh negatif."
            );
        }

        if (
            credit720p < 0
        ) {
            errors.push(
                "Credit 720p tidak boleh negatif."
            );
        }

        if (
            credit1080p < 0
        ) {
            errors.push(
                "Credit 1080p tidak boleh negatif."
            );
        }

        const minDuration =
            normalizeNumber(
                model.min_duration,
                0
            );

        const maxDuration =
            normalizeNumber(
                model.max_duration,
                0
            );

        if (
            minDuration < 0 ||
            maxDuration < 0
        ) {
            errors.push(
                "Duration tidak boleh negatif."
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

        if (
            !Array.isArray(
                model.supported_ratios
            )
        ) {
            errors.push(
                "Supported ratios tidak valid."
            );
        }

        if (
            !Array.isArray(
                model.supported_resolutions
            )
        ) {
            errors.push(
                "Supported resolutions tidak valid."
            );
        }

        return {
            valid:
                errors.length === 0,

            errors
        };
    }

    /* =========================================================
       PROVIDER RESOLUTION
       ========================================================= */

    function getModelsForProvider(
        models,
        providerId
    ) {
        const list =
            Array.isArray(models)
                ? models
                : [];

        const target =
            normalizeId(
                providerId
            );

        if (!target) {
            return list
                .map(
                    normalizeFormModel
                )
                .filter(Boolean);
        }

        return list
            .filter(model => {
                return (
                    normalizeId(
                        model?.provider_id ??
                        model?.providerId
                    ) ===
                    target
                );
            })
            .map(
                normalizeFormModel
            )
            .filter(Boolean);
    }

    /* =========================================================
       LOAD FORM DATA
       ---------------------------------------------------------
       Tidak melakukan query langsung.
       models/providers diberikan dari Models lifecycle.
       ========================================================= */

    function loadModelFormData(
        providers = [],
        models = []
    ) {
        const normalizedModels =
            Array.isArray(models)
                ? models
                    .map(
                        normalizeFormModel
                    )
                    .filter(Boolean)
                : [];

        return {
            providers:
                Array.isArray(
                    providers
                )
                    ? providers
                    : [],

            models:
                normalizedModels
        };
    }

    /* =========================================================
       PREPARE FORM
       ========================================================= */

    function prepareModelForm(
        model,
        providers = [],
        options = {}
    ) {
        const normalized =
            normalizeFormModel(
                model
            );

        if (!normalized) {
            return {
                model: null,
                data: null,
                provider: null,
                valid: false,
                errors: [
                    "Model tidak tersedia."
                ]
            };
        }

        const provider =
            resolveProvider(
                providers,
                normalized.provider_id
            );

        const data =
            normalizeModelSubmission(
                normalized
            );

        const validation =
            validateModelFormData(
                data
            );

        return {
            model:
                normalized,

            data,

            provider,

            valid:
                validation.valid,

            errors:
                validation.errors
        };
    }

    /* =========================================================
       EVENT ATTACHMENT
       ========================================================= */

    function attachModelFormEvents(
        root,
        models = [],
        providers = [],
        options = {}
    ) {
        const form =
            getRoot(root);

        if (!form) {
            return false;
        }

        /*
         * Jangan attach duplicate listeners.
         */
        if (
            form.dataset
                .modelFormLayoutEventsAttached ===
            "true"
        ) {
            return true;
        }

        const providerField =
            queryFirst(
                form,
                FIELD.provider
            );

        const modelField =
            queryFirst(
                form,
                FIELD.modelId
            );

        const discountField =
            queryFirst(
                form,
                FIELD.discountPercent
            );

        const credit480pField =
            queryFirst(
                form,
                FIELD.credit480p
            );

        const credit720pField =
            queryFirst(
                form,
                FIELD.credit720p
            );

        const credit1080pField =
            queryFirst(
                form,
                FIELD.credit1080p
            );

        if (providerField) {
            providerField.addEventListener(
                "change",
                () => {
                    handleProviderChange(
                        form,
                        models,
                        providers
                    );
                }
            );
        }

        if (modelField) {
            modelField.addEventListener(
                "change",
                () => {
                    updateSelectedModelFields(
                        form,
                        models,
                        options
                    );
                }
            );
        }

        /*
         * Credit final adalah runtime preview.
         * Setiap perubahan base credit atau discount
         * langsung menghitung ulang ketiga resolusi.
         */
        [
            discountField,
            credit480pField,
            credit720pField,
            credit1080pField
        ]
            .filter(Boolean)
            .forEach(field => {
                field.addEventListener(
                    "input",
                    () => {
                        updateCreditFinalPreview(
                            form
                        );
                    }
                );

                field.addEventListener(
                    "change",
                    () => {
                        updateCreditFinalPreview(
                            form
                        );
                    }
                );
            });

        form.dataset
            .modelFormLayoutEventsAttached =
            "true";

        return true;
    }

    /* =========================================================
       API
       ========================================================= */

    const API = {
        FIELD,

        RESOLUTION_ORDER,

        normalizeId,
        normalizeText,
        normalizeNumber,
        normalizeArray,
        normalizeStatus,

        normalizeFormModel,

        calculateCreditFinal,
        getRuntimeCreditValues,

        resolveProvider,
        findModel,

        getModelsForProvider,
        loadModelFormData,
        prepareModelForm,

        updateProviderOptions,
        updateProviderStatus,

        updateModelIdOptions,

        updateSelectedModelFields,
        handleProviderChange,

        updateCreditFinalPreview,

        renderModelForm,

        collectModelFormData,
        normalizeModelSubmission,
        validateModelFormData,

        attachModelFormEvents,

        lockIdentityFields,
        clearDependentModelFields
    };

    window.GENZModelFormLayout =
        API;

})();
