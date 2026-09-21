// ========================================
// GEN-Z.AI
// ADMIN MODEL MANAGEMENT API
// File: api/admin-models.js
// ========================================
//
// Endpoint:
// GET    /api/admin-models
// POST   /api/admin-models
// PATCH  /api/admin-models
// DELETE /api/admin-models
//
// Fitur:
// - List model
// - Tambah model
// - Edit model
// - Hapus model
// - Provider validation
// - Duplicate model validation
// - Discount percent
// - Credit 480p
// - Credit 720p
// - Credit 1080p
// - Duration
// - Ratio
// - Resolution
// - Status
// - KIE.AI pricing
//
// PRICING MODEL:
// - credit_480p
// - credit_720p
// - credit_1080p
// - discount_percent
//
// CREDIT FINAL:
// - Tidak disimpan ke database.
// - Tidak dibaca dari database.
// - Dihitung runtime oleh Generate/API generate.
//
// LEGACY:
// - credit_cost tidak lagi digunakan.
// - credit_final tidak lagi digunakan.
//
// Keamanan:
// - Wajib login Supabase
// - Hanya ADMIN / OWNER
// - Service Role Key hanya server-side
//
// Environment:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// SUPABASE_ANON_KEY
// atau SUPABASE_KEY
// ========================================


// ========================================
// JSON RESPONSE
// ========================================

const json = (res, status, data) => {

    return res
        .status(status)
        .json(data);

};


// ========================================
// HEADER
// ========================================

const getHeader = (req, name) => {

    const headers =
        req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );

};


// ========================================
// BEARER TOKEN
// ========================================

const getBearerToken = (req) => {

    const authorization =
        getHeader(
            req,
            "authorization"
        );

    if (!authorization) {
        return null;
    }

    const match =
        String(
            authorization
        ).match(
            /^Bearer\s+(.+)$/i
        );

    return match
        ? match[1].trim()
        : null;

};


// ========================================
// SUPABASE CONFIG
// ========================================

const getSupabaseConfig = () => {

    const url =
        process.env.SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    const anonKey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        serviceRoleKey;

    return {

        url:
            url
                ? String(url).replace(/\/+$/, "")
                : "",

        serviceRoleKey:
            serviceRoleKey || "",

        anonKey:
            anonKey || ""

    };

};


// ========================================
// SUPABASE REQUEST
// ========================================

const supabaseRequest = async (
    url,
    path,
    options = {}
) => {

    if (!url) {

        throw new Error(
            "SUPABASE_URL belum dikonfigurasi."
        );

    }

    const response =
        await fetch(
            `${url}${path}`,
            options
        );

    const text =
        await response.text();

    let data = null;

    if (text) {

        try {

            data =
                JSON.parse(text);

        } catch {

            data = {
                raw: text
            };

        }

    }

    return {

        response,

        data

    };

};


// ========================================
// SUPABASE ERROR MESSAGE
// ========================================

const getSupabaseError =
    (data, fallback) => {

        if (!data) {
            return fallback;
        }

        return (
            data.message ||
            data.error_description ||
            data.error ||
            data.details ||
            data.hint ||
            data.msg ||
            fallback
        );

    };


// ========================================
// VERIFY ADMIN
// ========================================

const verifyAdmin = async (
    req,
    config
) => {

    const token =
        getBearerToken(req);

    if (!token) {

        return {

            ok: false,

            status: 401,

            error:
                "Session tidak ditemukan. Silakan login kembali."

        };

    }


    if (
        !config.url ||
        !config.anonKey ||
        !config.serviceRoleKey
    ) {

        return {

            ok: false,

            status: 500,

            error:
                "Konfigurasi Supabase server belum lengkap."

        };

    }


    // ====================================
    // VERIFY SUPABASE USER
    // ====================================

    const authResult =
        await supabaseRequest(

            config.url,

            "/auth/v1/user",

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.anonKey,

                    "Authorization":
                        `Bearer ${token}`

                }

            }

        );


    if (
        !authResult.response.ok ||
        !authResult.data?.id
    ) {

        console.error(
            "SUPABASE AUTH ERROR:",
            authResult.data
        );

        return {

            ok: false,

            status: 401,

            error:
                "Session Supabase tidak valid atau sudah kedaluwarsa."

        };

    }


    const userId =
        authResult.data.id;


    // ====================================
    // LOAD PROFILE
    // ====================================

    const profilePath =
        `/rest/v1/profiles?select=id,email,name,role,status,credits&id=eq.${encodeURIComponent(userId)}&limit=1`;


    const profileResult =
        await supabaseRequest(

            config.url,

            profilePath,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        );


    if (
        !profileResult.response.ok
    ) {

        console.error(
            "PROFILE CHECK ERROR:",
            profileResult.data
        );

        return {

            ok: false,

            status: 500,

            error:
                getSupabaseError(
                    profileResult.data,
                    "Gagal memeriksa profile admin."
                )

        };

    }


    const profile =
        Array.isArray(
            profileResult.data
        )
            ? profileResult.data[0]
            : null;


    if (!profile) {

        return {

            ok: false,

            status: 403,

            error:
                "Profile admin tidak ditemukan."

        };

    }


    const role =
        String(
            profile.role || ""
        )
        .trim()
        .toUpperCase();


    const accountStatus =
        String(
            profile.status || ""
        )
        .trim()
        .toLowerCase();


    if (
        ![
            "ADMIN",
            "OWNER"
        ].includes(role)
    ) {

        return {

            ok: false,

            status: 403,

            error:
                "Anda tidak memiliki akses admin."

        };

    }


    if (
        accountStatus !== "active"
    ) {

        return {

            ok: false,

            status: 403,

            error:
                "Akun admin tidak aktif."

        };

    }


    return {

        ok: true,

        userId,

        profile: {

            ...profile,

            role

        }

    };

};


// ========================================
// MODEL FIELDS
// ========================================
//
// PRICING DATABASE:
// - credit_480p
// - credit_720p
// - credit_1080p
// - discount_percent
//
// LEGACY:
// - credit_cost  -> TIDAK digunakan
// - credit_final -> TIDAK digunakan
//
// Credit final dihitung runtime oleh
// Generate/API generate.
// ========================================

const MODEL_FIELDS = [

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

const PROVIDER_FIELDS = [

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

const KIE_MODEL_FIELDS = [

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

const KIE_WORKFLOW_FIELDS = [

    "id",

    "model_id",

    "workflow_key",

    "operation",

    "status"

];


// ========================================
// KIE PRICING FIELDS
// ========================================

const KIE_PRICING_FIELDS = [

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

const parseNumber = (
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

const cleanArray = (
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
//
// Hanya field yang memang diizinkan yang
// diteruskan ke database.
//
// credit_cost dan credit_final sengaja
// tidak pernah dimasukkan ke model.
//
// Jika frontend lama masih mengirim:
// - credit_cost
// - credit_final
//
// keduanya otomatis diabaikan.
// ========================================

const cleanModel = (
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
    // EXPLICIT LEGACY PROTECTION
    // ====================================
    //
    // Jangan pernah meneruskan field lama
    // meskipun suatu saat cleanModel()
    // dikembangkan kembali.
    //
    // Saat ini keduanya memang tidak pernah
    // dimasukkan ke model, tetapi delete ini
    // menjadi lapisan pengaman tambahan.
    // ====================================

    delete model.credit_cost;
    delete model.credit_final;


    return model;

};


// ========================================
// VALIDATE MODEL
// ========================================

const validateModel = (
    model,
    requireAll = false
) => {

    // ====================================
    // REQUIRED PROVIDER
    // ====================================

    if (
        requireAll &&
        !model.provider_id
    ) {

        return (
            "Provider wajib dipilih."
        );

    }


    // ====================================
    // REQUIRED MODEL ID
    // ====================================

    if (
        requireAll &&
        !model.model_id
    ) {

        return (
            "Model ID wajib diisi."
        );

    }


    // ====================================
    // REQUIRED MODEL NAME
    // ====================================

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


// ========================================
// GET PROVIDER
// ========================================

const getProvider =
    async (
        config,
        providerValue
    ) => {

        if (
            !providerValue
        ) {

            return null;

        }


        const value =
            String(
                providerValue
            ).trim();


        if (!value) {

            return null;

        }


        const encoded =
            encodeURIComponent(
                value
            );


        const path =
            `/rest/v1/providers?select=${encodeURIComponent(PROVIDER_FIELDS.join(","))}&or=(id.eq.${encoded},provider_id.eq.${encoded})&limit=1`;


        const result =
            await supabaseRequest(

                config.url,

                path,

                {

                    method: "GET",

                    headers: {

                        "apikey":
                            config.serviceRoleKey,

                        "Authorization":
                            `Bearer ${config.serviceRoleKey}`,

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    }

                }

            );


        if (
            !result.response.ok
        ) {

            console.error(
                "GET PROVIDER ERROR:",
                result.data
            );

            throw new Error(

                getSupabaseError(

                    result.data,

                    "Gagal memeriksa provider."

                )

            );

        }


        if (
            !Array.isArray(
                result.data
            ) ||
            result.data.length === 0
        ) {

            return null;

        }


        return result.data[0];

    };


// ========================================
// CHECK PROVIDER
// ========================================

const providerExists = async (
    config,
    providerId
) => {

    return await getProvider(
        config,
        providerId
    );

};


// ========================================
// CHECK DUPLICATE MODEL
// ========================================

const duplicateModelExists = async (
    config,
    providerId,
    modelId,
    excludeId = null
) => {

    if (
        !providerId ||
        !modelId
    ) {

        return false;

    }


    const provider =
        await getProvider(
            config,
            providerId
        );


    if (!provider) {

        throw new Error(
            "Provider tidak ditemukan."
        );

    }


    const providerUuid =
        provider.id;


    let path =

        `/rest/v1/models?select=id,provider_id,model_id&provider_id=eq.${encodeURIComponent(providerUuid)}&model_id=eq.${encodeURIComponent(modelId)}&limit=1`;


    if (
        excludeId
    ) {

        path +=
            `&id=neq.${encodeURIComponent(excludeId)}`;

    }


    const result =
        await supabaseRequest(

            config.url,

            path,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        );


    if (
        !result.response.ok
    ) {

        throw new Error(

            getSupabaseError(

                result.data,

                "Gagal memeriksa duplikasi model."

            )

        );

    }


    return (

        Array.isArray(
            result.data
        ) &&

        result.data.length > 0

    );

};


// ========================================
// NORMALIZE MODEL KEY
// ========================================

const normalizeModelKey = (
    value
) => {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase()
        .replace(/\\/g, "/");

};


// ========================================
// KIE MODEL PRICING MATCH
// ========================================

const pricingMatchesModel = (
    pricing,
    kieModel,
    workflowsById
) => {

    const modelId =
        normalizeModelKey(
            kieModel?.model_id
        );

    if (!modelId) {
        return false;
    }


    const conditions =
        pricing?.conditions &&
        typeof pricing.conditions === "object"

            ? pricing.conditions

            : {};


    const conditionModelId =
        normalizeModelKey(
            conditions.model_id
        );


    // ------------------------------------
    // 1. Exact model_id
    // ------------------------------------

    if (
        conditionModelId &&
        conditionModelId === modelId
    ) {

        return true;

    }


    // ------------------------------------
    // 2. Pricing workflow
    // ------------------------------------

    if (
        pricing.workflow_id
    ) {

        const workflow =
            workflowsById.get(
                String(
                    pricing.workflow_id
                )
            );


        if (
            workflow &&
            String(
                workflow.model_id
            ) === String(
                kieModel.id
            )
        ) {

            return true;

        }

    }


    // ------------------------------------
    // 3. SKU matching
    // ------------------------------------

    const sku =
        normalizeModelKey(
            pricing.sku_key
        );


    if (!sku) {
        return false;
    }


    const modelParts =
        modelId
            .split("/")
            .filter(Boolean);


    const modelSlug =
        modelParts.length
            ? modelParts[
                modelParts.length - 1
            ]
            : modelId;


    if (
        sku.includes(
            modelSlug
        )
    ) {

        return true;

    }


    // ------------------------------------
    // Known KIE naming normalization
    // ------------------------------------

    const normalizedModel =
        modelId
            .replace(
                /^bytedance\//,
                ""
            )
            .replace(
                /^kling-3\.0\//,
                "kling-3.0-"
            )
            .replace(
                /^veo\//,
                "veo-"
            );


    if (
        normalizedModel &&
        sku.includes(
            normalizedModel
        )
    ) {

        return true;

    }


    return false;

};


// ========================================
// LOAD KIE PRICING
// ========================================

const loadKiePricing = async (
    config
) => {

    const [
        modelsResult,
        workflowsResult,
        pricingResult
    ] = await Promise.all([

        supabaseRequest(

            config.url,

            `/rest/v1/kie_models?select=${encodeURIComponent(KIE_MODEL_FIELDS.join(","))}&order=model_id.asc`,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        ),

        supabaseRequest(

            config.url,

            `/rest/v1/kie_workflows?select=${encodeURIComponent(KIE_WORKFLOW_FIELDS.join(","))}`,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        ),

        supabaseRequest(

            config.url,

            `/rest/v1/kie_pricing?select=${encodeURIComponent(KIE_PRICING_FIELDS.join(","))}&status=eq.ACTIVE&pricing_status=eq.VERIFIED&order=unit_price.asc`,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        )

    ]);


    if (
        !modelsResult.response.ok
    ) {

        throw new Error(

            getSupabaseError(
                modelsResult.data,
                "Gagal mengambil KIE models."
            )

        );

    }


    if (
        !workflowsResult.response.ok
    ) {

        throw new Error(

            getSupabaseError(
                workflowsResult.data,
                "Gagal mengambil KIE workflows."
            )

        );

    }


    if (
        !pricingResult.response.ok
    ) {

        throw new Error(

            getSupabaseError(
                pricingResult.data,
                "Gagal mengambil KIE pricing."
            )

        );

    }


    const kieModels =
        Array.isArray(
            modelsResult.data
        )
            ? modelsResult.data
            : [];


    const workflows =
        Array.isArray(
            workflowsResult.data
        )
            ? workflowsResult.data
            : [];


    const pricing =
        Array.isArray(
            pricingResult.data
        )
            ? pricingResult.data
            : [];


    const workflowsById =
        new Map();


    workflows.forEach(
        workflow => {

            workflowsById.set(
                String(
                    workflow.id
                ),
                workflow
            );

        }
    );


    const pricingByModelId =
        new Map();


    kieModels.forEach(
        kieModel => {

            const matched =
                pricing
                    .filter(
                        item =>
                            pricingMatchesModel(
                                item,
                                kieModel,
                                workflowsById
                            )
                    )
                    .map(
                        item => {

                            const workflow =
                                item.workflow_id

                                    ? workflowsById.get(
                                        String(
                                            item.workflow_id
                                        )
                                    )

                                    : null;

                            return {

                                ...item,

                                workflow_key:
                                    workflow?.workflow_key ||
                                    null,

                                kie_model_id:
                                    kieModel.id,

                                kie_model_code:
                                    kieModel.model_id,

                                kie_model_name:
                                    kieModel.model_name

                            };

                        }
                    );


            pricingByModelId.set(

                normalizeModelKey(
                    kieModel.model_id
                ),

                matched

            );

        }
    );


    return {

        kieModels,

        workflows,

        pricing,

        pricingByModelId

    };

};


// ========================================
// GET MODEL KIE PRICING
// ========================================

const getModelKiePricing = (
    model,
    kiePricingData
) => {

    const modelId =
        normalizeModelKey(
            model?.model_id
        );


    if (!modelId) {

        return [];

    }


    const exact =
        kiePricingData
            .pricingByModelId
            .get(
                modelId
            );


    if (
        Array.isArray(exact)
    ) {

        return exact;

    }


    return [];

};


// ========================================
// LIST MODELS
// ========================================

const listModels = async (
    config
) => {

    const fields =
        MODEL_FIELDS.join(",");


    // ====================================
    // LOAD MODELS
    // ====================================

    const modelsPath =
        `/rest/v1/models?select=${encodeURIComponent(fields)}&order=created_at.desc`;


    const modelsResult =
        await supabaseRequest(

            config.url,

            modelsPath,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        );


    if (
        !modelsResult.response.ok
    ) {

        console.error(
            "MODELS QUERY ERROR:",
            modelsResult.data
        );

        throw new Error(

            getSupabaseError(

                modelsResult.data,

                "Gagal mengambil data models."

            )

        );

    }


    // ====================================
    // LOAD PROVIDERS
    // ====================================

    const providersPath =
        `/rest/v1/providers?select=${encodeURIComponent(PROVIDER_FIELDS.join(","))}&order=created_at.desc`;


    const providersResult =
        await supabaseRequest(

            config.url,

            providersPath,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        );


    if (
        !providersResult.response.ok
    ) {

        console.error(
            "PROVIDERS QUERY ERROR:",
            providersResult.data
        );

        throw new Error(

            getSupabaseError(

                providersResult.data,

                "Gagal mengambil data providers."

            )

        );

    }


    const models =
        Array.isArray(
            modelsResult.data
        )
            ? modelsResult.data
            : [];


    const providers =
        Array.isArray(
            providersResult.data
        )
            ? providersResult.data
            : [];


    // ====================================
    // LOAD KIE PRICING
    // ====================================

    const kiePricingData =
        await loadKiePricing(
            config
        );


    // ====================================
    // PROVIDER MAP
    // ====================================

    const providerMap =
        new Map();


    providers.forEach(
        provider => {

            if (
                provider.id
            ) {

                providerMap.set(

                    String(
                        provider.id
                    ),

                    provider

                );

            }


            if (
                provider.provider_id
            ) {

                providerMap.set(

                    String(
                        provider.provider_id
                    ),

                    provider

                );

            }

        }
    );


    // ====================================
    // MERGE PROVIDER + KIE PRICING
    // ====================================

    const mergedModels =
        models.map(
            model => {

                const provider =
                    providerMap.get(

                        String(
                            model.provider_id
                        )

                    );


                const kiePricing =
                    getModelKiePricing(
                        model,
                        kiePricingData
                    );


                return {

                    ...model,

                    provider_name:
                        provider?.provider_name ||
                        null,

                    provider_code:
                        provider?.provider_id ||
                        null,

                    provider_status:
                        provider?.status ||
                        null,

                    provider_is_default:
                        provider?.is_default ??
                        false,

                    // ----------------------------
                    // KIE.AI PRICE
                    // ----------------------------

                    kie_pricing:
                        kiePricing,

                    kie_pricing_count:
                        kiePricing.length,

                    kie_price:
                        kiePricing.length > 0
                            ? kiePricing[0].unit_price
                            : null,

                    kie_currency:
                        kiePricing.length > 0
                            ? kiePricing[0].currency
                            : null,

                    kie_billing_unit:
                        kiePricing.length > 0
                            ? kiePricing[0].billing_unit
                            : null,

                    kie_pricing_id:
                        kiePricing.length > 0
                            ? kiePricing[0].id
                            : null

                };

            }
        );


    return {

        models:
            mergedModels,

        providers,

        kiePricing:
            kiePricingData.pricing

    };

};


// ========================================
// UPDATE KIE PRICE
// ========================================

const updateKiePrice = async (
    config,
    pricingId,
    unitPrice
) => {

    if (!pricingId) {

        throw new Error(
            "KIE pricing ID wajib diisi."
        );

    }


    const price =
        parseNumber(
            unitPrice,
            "unit_price",
            false
        );


    if (
        price < 0
    ) {

        throw new Error(
            "Harga KIE tidak boleh negatif."
        );

    }


    const result =
        await supabaseRequest(

            config.url,

            `/rest/v1/kie_pricing?id=eq.${encodeURIComponent(pricingId)}`,

            {

                method: "PATCH",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Prefer":
                        "return=representation"

                },

                body:
                    JSON.stringify({

                        unit_price:
                            price,

                        updated_at:
                            new Date()
                                .toISOString()

                    })

            }

        );


    if (
        !result.response.ok
    ) {

        console.error(
            "UPDATE KIE PRICE ERROR:",
            result.data
        );

        throw new Error(

            getSupabaseError(

                result.data,

                "Gagal memperbarui harga KIE."

            )

        );

    }


    if (
        !Array.isArray(
            result.data
        ) ||
        result.data.length === 0
    ) {

        throw new Error(
            "Data pricing KIE tidak ditemukan."
        );

    }


    return result.data[0];

};


// ========================================
// CREATE MODEL
// ========================================

const createModel = async (
    config,
    body
) => {

    const model =
        cleanModel(
            body
        );


    const validation =
        validateModel(
            model,
            true
        );


    if (
        validation
    ) {

        throw new Error(
            validation
        );

    }


    // ====================================
    // PROVIDER
    // ====================================

    const provider =
        await providerExists(

            config,

            model.provider_id

        );


    if (!provider) {

        throw new Error(
            "Provider tidak ditemukan."
        );

    }


    model.provider_id =
        provider.id;


    // ====================================
    // DUPLICATE
    // ====================================

    const duplicate =
        await duplicateModelExists(

            config,

            provider.id,

            model.model_id

        );


    if (
        duplicate
    ) {

        throw new Error(

            "Model ID sudah digunakan oleh provider tersebut."

        );

    }


    // ====================================
    // DEFAULT DISCOUNT
    // ====================================

    if (
        model.discount_percent === undefined
    ) {

        model.discount_percent =
            0;

    }


    // ====================================
    // DEFAULT STATUS
    // ====================================

    if (
        model.status === undefined
    ) {

        model.status =
            "active";

    }


    // ====================================
    // LEGACY PRICING PROTECTION
    // ====================================
    //
    // Jangan pernah menyimpan:
    // - credit_cost
    // - credit_final
    //
    // Pricing database hanya menggunakan
    // credit_480p / 720p / 1080p + discount.
    // ====================================

    delete model.credit_cost;
    delete model.credit_final;


    // ====================================
    // INSERT
    // ====================================

    const result =
        await supabaseRequest(

            config.url,

            "/rest/v1/models",

            {

                method: "POST",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Prefer":
                        "return=representation"

                },

                body:
                    JSON.stringify(
                        model
                    )

            }

        );


    if (
        !result.response.ok
    ) {

        console.error(
            "CREATE MODEL ERROR:",
            result.data
        );


        throw new Error(

            getSupabaseError(

                result.data,

                "Gagal membuat model."

            )

        );

    }


    const created =
        Array.isArray(
            result.data
        )

            ? result.data[0]

            : result.data;


    return created;

};


// ========================================
// UPDATE MODEL
// ========================================

const updateModel = async (
    config,
    id,
    body
) => {

    if (
        !id
    ) {

        throw new Error(
            "ID model wajib diisi."
        );

    }


    const model =
        cleanModel(
            body
        );


    const validation =
        validateModel(
            model,
            false
        );


    if (
        validation
    ) {

        throw new Error(
            validation
        );

    }


    // ====================================
    // LEGACY PRICING PROTECTION
    // ====================================
    //
    // Field lama tidak pernah diteruskan
    // ke Supabase walaupun request frontend
    // masih membawanya.
    // ====================================

    delete model.credit_cost;
    delete model.credit_final;


    // ====================================
    // KIE PRICE
    // ====================================

    let updatedKiePricing =
        null;


    if (
        body.kie_pricing_id !== undefined
    ) {

        updatedKiePricing =
            await updateKiePrice(

                config,

                body.kie_pricing_id,

                body.kie_unit_price

            );

    }


    // ====================================
    // EMPTY MODEL UPDATE
    // ====================================

    if (
        Object.keys(
            model
        ).length === 0
    ) {

        if (
            !updatedKiePricing
        ) {

            throw new Error(
                "Tidak ada data model yang diubah."
            );

        }


        return {

            kie_pricing_updated:
                updatedKiePricing

        };

    }


    // ====================================
    // PROVIDER
    // ====================================

    if (
        model.provider_id
    ) {

        const provider =
            await providerExists(

                config,

                model.provider_id

            );


        if (!provider) {

            throw new Error(
                "Provider tidak ditemukan."
            );

        }


        model.provider_id =
            provider.id;

    }


    // ====================================
    // DUPLICATE
    // ====================================

    if (
        model.provider_id &&
        model.model_id
    ) {

        const duplicate =
            await duplicateModelExists(

                config,

                model.provider_id,

                model.model_id,

                id

            );


        if (
            duplicate
        ) {

            throw new Error(

                "Model ID sudah digunakan oleh provider tersebut."

            );

        }

    }


    // ====================================
    // UPDATED AT
    // ====================================

    model.updated_at =
        new Date()
            .toISOString();


    // ====================================
    // UPDATE
    // ====================================

    const result =
        await supabaseRequest(

            config.url,

            `/rest/v1/models?id=eq.${encodeURIComponent(id)}`,

            {

                method: "PATCH",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Prefer":
                        "return=representation"

                },

                body:
                    JSON.stringify(
                        model
                    )

            }

        );


    if (
        !result.response.ok
    ) {

        console.error(
            "UPDATE MODEL ERROR:",
            result.data
        );


        throw new Error(

            getSupabaseError(

                result.data,

                "Gagal memperbarui model."

            )

        );

    }


    if (
        !Array.isArray(
            result.data
        ) ||
        result.data.length === 0
    ) {

        throw new Error(
            "Model tidak ditemukan."
        );

    }


    return {

        ...result.data[0],

        kie_pricing_updated:
            updatedKiePricing

    };

};


// ========================================
// DELETE MODEL
// ========================================

const deleteModel = async (
    config,
    id
) => {

    if (
        !id
    ) {

        throw new Error(
            "ID model wajib diisi."
        );

    }


    const result =
        await supabaseRequest(

            config.url,

            `/rest/v1/models?id=eq.${encodeURIComponent(id)}`,

            {

                method: "DELETE",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Prefer":
                        "return=representation"

                }

            }

        );


    if (
        !result.response.ok
    ) {

        console.error(
            "DELETE MODEL ERROR:",
            result.data
        );


        throw new Error(

            getSupabaseError(

                result.data,

                "Gagal menghapus model."

            )

        );

    }


    if (
        !Array.isArray(
            result.data
        ) ||
        result.data.length === 0
    ) {

        throw new Error(
            "Model tidak ditemukan."
        );

    }


    return result.data[0];

};


// ========================================
// PARSE BODY
// ========================================

const parseBody = (
    req
) => {

    if (
        req.body &&
        typeof req.body === "object" &&
        !Buffer.isBuffer(req.body)
    ) {

        return req.body;

    }


    if (
        typeof req.body === "string"
    ) {

        try {

            const parsed =
                JSON.parse(
                    req.body
                );


            return (
                parsed &&
                typeof parsed === "object"
            )
                ? parsed
                : {};

        } catch {

            return {};

        }

    }


    return {};

};


// ========================================
// MAIN HANDLER
// ========================================

export default async function handler(
    req,
    res
) {

    // ====================================
    // CORS
    // ====================================

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, DELETE, OPTIONS"
    );

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );


    // ====================================
    // OPTIONS
    // ====================================

    if (
        req.method === "OPTIONS"
    ) {

        return res
            .status(204)
            .end();

    }


    // ====================================
    // METHOD CHECK
    // ====================================

    const allowedMethods = [

        "GET",
        "POST",
        "PATCH",
        "DELETE"

    ];


    if (
        !allowedMethods.includes(
            req.method
        )
    ) {

        return json(

            res,

            405,

            {

                success: false,

                error:
                    "Method tidak didukung."

            }

        );

    }


    // ====================================
    // CONFIG
    // ====================================

    const config =
        getSupabaseConfig();


    if (
        !config.url
    ) {

        return json(

            res,

            500,

            {

                success: false,

                error:
                    "SUPABASE_URL belum dikonfigurasi."

            }

        );

    }


    if (
        !config.serviceRoleKey
    ) {

        return json(

            res,

            500,

            {

                success: false,

                error:
                    "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi."

            }

        );

    }


    if (
        !config.anonKey
    ) {

        return json(

            res,

            500,

            {

                success: false,

                error:
                    "SUPABASE_ANON_KEY atau SUPABASE_KEY belum dikonfigurasi."

            }

        );

    }


    // ====================================
    // VERIFY ADMIN
    // ====================================

    let admin;


    try {

        admin =
            await verifyAdmin(

                req,

                config

            );

    } catch (
        error
    ) {

        console.error(
            "ADMIN VERIFY ERROR:",
            error
        );


        return json(

            res,

            500,

            {

                success: false,

                error:
                    error.message ||
                    "Gagal memverifikasi akses admin."

            }

        );

    }


    if (
        !admin.ok
    ) {

        return json(

            res,

            admin.status,

            {

                success: false,

                error:
                    admin.error

            }

        );

    }


    // ====================================
    // GET
    // ====================================

    if (
        req.method === "GET"
    ) {

        try {

            const data =
                await listModels(

                    config

                );


            return json(

                res,

                200,

                {

                    success: true,

                    models:
                        data.models,

                    providers:
                        data.providers,

                    kiePricing:
                        data.kiePricing,

                    counts: {

                        models:
                            data.models.length,

                        providers:
                            data.providers.length,

                        kiePricing:
                            data.kiePricing.length

                    }

                }

            );

        } catch (
            error
        ) {

            console.error(
                "ADMIN MODELS GET ERROR:",
                error
            );


            return json(

                res,

                500,

                {

                    success: false,

                    error:
                        error.message ||
                        "Gagal mengambil data models."

                }

            );

        }

    }


    // ====================================
    // BODY
    // ====================================

    const body =
        parseBody(
            req
        );


    // ====================================
    // POST
    // ====================================

    if (
        req.method === "POST"
    ) {

        try {

            const model =
                await createModel(

                    config,

                    body

                );


            return json(

                res,

                201,

                {

                    success: true,

                    message:
                        "Model berhasil ditambahkan.",

                    model

                }

            );

        } catch (
            error
        ) {

            console.error(
                "ADMIN MODEL CREATE ERROR:",
                error
            );


            return json(

                res,

                400,

                {

                    success: false,

                    error:
                        error.message ||
                        "Gagal membuat model."

                }

            );

        }

    }


    // ====================================
    // PATCH
    // ====================================

    if (
        req.method === "PATCH"
    ) {

        const id =
            body.id ||
            req.query?.id;


        try {

            const model =
                await updateModel(

                    config,

                    id,

                    body

                );


            return json(

                res,

                200,

                {

                    success: true,

                    message:
                        body.kie_pricing_id

                            ? "Model dan harga KIE berhasil diperbarui."

                            : "Model berhasil diperbarui.",

                    model

                }

            );

        } catch (
            error
        ) {

            console.error(
                "ADMIN MODEL UPDATE ERROR:",
                error
            );


            return json(

                res,

                400,

                {

                    success: false,

                    error:
                        error.message ||
                        "Gagal memperbarui model."

                }

            );

        }

    }


    // ====================================
    // DELETE
    // ====================================

    if (
        req.method === "DELETE"
    ) {

        const id =
            req.query?.id ||
            body.id;


        try {

            const model =
                await deleteModel(

                    config,

                    id

                );


            return json(

                res,

                200,

                {

                    success: true,

                    message:
                        "Model berhasil dihapus.",

                    model

                }

            );

        } catch (
            error
        ) {

            console.error(
                "ADMIN MODEL DELETE ERROR:",
                error
            );


            return json(

                res,

                400,

                {

                    success: false,

                    error:
                        error.message ||
                        "Gagal menghapus model."

                }

            );

        }

    }


    // ====================================
    // FALLBACK
    // ====================================

    return json(

        res,

        405,

        {

            success: false,

            error:
                "Method tidak didukung."

        }

    );

}
