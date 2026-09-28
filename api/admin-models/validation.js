// ========================================
// GEN-Z.AI
// ADMIN MODEL API
// File: api/admin-models/validation.js
// ========================================


// ========================================
// MODEL FIELDS
// ========================================

export const MODEL_FIELDS = [

    "id",

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

    "status",

    "created_at",

    "updated_at"

];


// ========================================
// PROVIDER FIELDS
// ========================================

export const PROVIDER_FIELDS = [

    "id",

    "provider_id",

    "provider_name",

    "description",

    "status",

    "is_default",

    "created_at",

    "updated_at"

];


// ========================================
// KIE MODEL FIELDS
// ========================================

export const KIE_MODEL_FIELDS = [

    "id",

    "provider",

    "model_family",

    "model_id",

    "model_name",

    "status"

];


// ========================================
// KIE WORKFLOW FIELDS
// ========================================

export const KIE_WORKFLOW_FIELDS = [

    "id",

    "model_id",

    "workflow_key",

    "operation",

    "status"

];


// ========================================
// KIE PRICING FIELDS
// ========================================

export const KIE_PRICING_FIELDS = [

    "id",

    "workflow_id",

    "variant_id",

    "operation",

    "sku_key",

    "billing_unit",

    "unit_price",

    "currency",

    "conditions",

    "pricing_context",

    "source_type",

    "source_url",

    "source_reference",

    "pricing_status",

    "effective_at",

    "expires_at",

    "status",

    "created_at",

    "updated_at"

];


// ========================================
// NUMBER VALIDATION
// ========================================

export const parseNumber = (
    value,
    field,
    integer = false
) => {

    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {

        throw new Error(
            `${field} harus diisi.`
        );

    }


    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        throw new Error(
            `${field} harus berupa angka.`
        );

    }


    if (
        integer &&
        !Number.isInteger(number)
    ) {

        throw new Error(
            `${field} harus berupa bilangan bulat.`
        );

    }


    return number;

};


// ========================================
// CLEAN ARRAY
// ========================================

export const cleanArray = (
    value
) => {

    if (
        Array.isArray(value)
    ) {

        return value

            .map(
                item =>
                    String(item).trim()
            )

            .filter(Boolean);

    }


    if (
        value === null ||
        value === undefined
    ) {

        return [];

    }


    return String(value)

        .split(",")

        .map(
            item =>
                item.trim()
        )

        .filter(Boolean);

};


// ========================================
// CLEAN MODEL
// ========================================

export const cleanModel = (
    input = {}
) => {

    const model = {};


    // ====================================
    // PROVIDER
    // ====================================

    if (
        input.provider_id !== undefined
    ) {

        model.provider_id =
            String(
                input.provider_id
            ).trim();

    }


    // ====================================
    // MODEL ID
    // ====================================

    if (
        input.model_id !== undefined
    ) {

        model.model_id =
            String(
                input.model_id
            ).trim();

    }


    // ====================================
    // MODEL NAME
    // ====================================

    if (
        input.model_name !== undefined
    ) {

        model.model_name =
            String(
                input.model_name
            ).trim();

    }


    // ====================================
    // DESCRIPTION
    // ====================================

    if (
        input.description !== undefined
    ) {

        model.description =
            input.description === null

                ? null

                : String(
                    input.description
                ).trim();

    }


    // ====================================
    // DISCOUNT PERCENT
    // ====================================

    if (
        input.discount_percent !== undefined &&
        input.discount_percent !== ""
    ) {

        const value =
            parseNumber(
                input.discount_percent,
                "discount_percent",
                false
            );


        if (
            value < 0 ||
            value > 100
        ) {

            throw new Error(
                "Diskon harus antara 0 sampai 100%."
            );

        }


        model.discount_percent =
            value;

    }


    // ====================================
    // CREDIT 480P
    // ====================================

    if (
        input.credit_480p !== undefined &&
        input.credit_480p !== ""
    ) {

        const value =
            parseNumber(
                input.credit_480p,
                "credit_480p",
                false
            );


        if (
            value < 0
        ) {

            throw new Error(
                "credit_480p tidak boleh negatif."
            );

        }


        model.credit_480p =
            value;

    }


    // ====================================
    // CREDIT 720P
    // ====================================

    if (
        input.credit_720p !== undefined &&
        input.credit_720p !== ""
    ) {

        const value =
            parseNumber(
                input.credit_720p,
                "credit_720p",
                false
            );


        if (
            value < 0
        ) {

            throw new Error(
                "credit_720p tidak boleh negatif."
            );

        }


        model.credit_720p =
            value;

    }


    // ====================================
    // CREDIT 1080P
    // ====================================

    if (
        input.credit_1080p !== undefined &&
        input.credit_1080p !== ""
    ) {

        const value =
            parseNumber(
                input.credit_1080p,
                "credit_1080p",
                false
            );


        if (
            value < 0
        ) {

            throw new Error(
                "credit_1080p tidak boleh negatif."
            );

        }


        model.credit_1080p =
            value;

    }


    // ====================================
    // MIN DURATION
    // ====================================

    if (
        input.min_duration !== undefined &&
        input.min_duration !== ""
    ) {

        const value =
            parseNumber(
                input.min_duration,
                "min_duration",
                true
            );


        if (
            value < 0
        ) {

            throw new Error(
                "min_duration tidak boleh negatif."
            );

        }


        model.min_duration =
            value;

    }


    // ====================================
    // MAX DURATION
    // ====================================

    if (
        input.max_duration !== undefined &&
        input.max_duration !== ""
    ) {

        const value =
            parseNumber(
                input.max_duration,
                "max_duration",
                true
            );


        if (
            value < 0
        ) {

            throw new Error(
                "max_duration tidak boleh negatif."
            );

        }


        model.max_duration =
            value;

    }


    // ====================================
    // SUPPORTED RATIOS
    // ====================================

    if (
        input.supported_ratios !== undefined
    ) {

        model.supported_ratios =
            cleanArray(
                input.supported_ratios
            );

    }


    // ====================================
    // SUPPORTED RESOLUTIONS
    // ====================================

    if (
        input.supported_resolutions !== undefined
    ) {

        model.supported_resolutions =
            cleanArray(
                input.supported_resolutions
            );

    }


    // ====================================
    // STATUS
    // ====================================

    if (
        input.status !== undefined
    ) {

        model.status =
            String(
                input.status
            )
            .trim()
            .toLowerCase();

    }


    // ====================================
    // LEGACY PROTECTION
    // ====================================

    delete model.credit_cost;
    delete model.credit_final;


    return model;

};


// ========================================
// VALIDATE MODEL
// ========================================

export const validateModel = (
    model,
    requireAll = false
) => {

    if (
        requireAll &&
        !model.provider_id
    ) {

        return (
            "Provider wajib dipilih."
        );

    }


    if (
        requireAll &&
        !model.model_id
    ) {

        return (
            "Model ID wajib diisi."
        );

    }


    if (
        requireAll &&
        !model.model_name
    ) {

        return (
            "Model Name wajib diisi."
        );

    }


    // ====================================
    // STATUS
    // ====================================

    if (
        model.status !== undefined
    ) {

        const allowed = [

            "active",

            "inactive",

            "maintenance"

        ];


        if (
            !allowed.includes(
                model.status
            )
        ) {

            return (
                "Status harus active, inactive, atau maintenance."
            );

        }

    }


    // ====================================
    // DISCOUNT
    // ====================================

    if (
        model.discount_percent !== undefined &&
        (
            model.discount_percent < 0 ||
            model.discount_percent > 100
        )
    ) {

        return (
            "Diskon harus antara 0 sampai 100%."
        );

    }


    // ====================================
    // CREDIT 480P
    // ====================================

    if (
        model.credit_480p !== undefined &&
        model.credit_480p < 0
    ) {

        return (
            "Credit 480p tidak boleh negatif."
        );

    }


    // ====================================
    // CREDIT 720P
    // ====================================

    if (
        model.credit_720p !== undefined &&
        model.credit_720p < 0
    ) {

        return (
            "Credit 720p tidak boleh negatif."
        );

    }


    // ====================================
    // CREDIT 1080P
    // ====================================

    if (
        model.credit_1080p !== undefined &&
        model.credit_1080p < 0
    ) {

        return (
            "Credit 1080p tidak boleh negatif."
        );

    }


    // ====================================
    // DURATION
    // ====================================

    if (
        model.min_duration !== undefined &&
        model.max_duration !== undefined
    ) {

        if (
            model.max_duration <
            model.min_duration
        ) {

            return (
                "Max duration tidak boleh lebih kecil dari min duration."
            );

        }

    }


    return null;

};
