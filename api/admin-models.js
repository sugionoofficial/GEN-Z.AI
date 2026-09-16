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
// - Credit cost
// - Discount percent
// - Credit final
// - Duration
// - Ratio
// - Resolution
// - Status
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

const MODEL_FIELDS = [

    "id",

    "provider_id",

    "model_id",

    "model_name",

    "description",

    "credit_cost",

    "discount_percent",

    "credit_final",

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
// NUMBER VALIDATION
// ========================================

const parseNumber = (
    value,
    field,
    integer = false
) => {

    const number =
        Number(value);


    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {

        throw new Error(
            `${field} harus diisi.`
        );

    }


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
    // CREDIT COST
    // ====================================

    if (
        input.credit_cost !== undefined &&
        input.credit_cost !== ""
    ) {

        const value =
            parseNumber(
                input.credit_cost,
                "credit_cost",
                true
            );


        if (
            value < 0
        ) {

            throw new Error(
                "credit_cost tidak boleh negatif."
            );

        }


        model.credit_cost =
            value;

    }


    // ====================================
    // DISCOUNT
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
    // RATIOS
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
    // RESOLUTIONS
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
    // PROVIDER
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
    // MODEL ID
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
    // MODEL NAME
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
    // CREDIT
    // ====================================

    if (
        model.credit_cost !== undefined &&
        model.credit_cost < 0
    ) {

        return (
            "Credit cost tidak boleh negatif."
        );

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
//
// Bisa menerima:
// - UUID providers.id
// - providers.provider_id
//
// Ini penting karena GEN-Z.AI
// menggunakan provider_id sebagai
// kode provider/API provider.
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


    // ====================================
    // Resolve provider ke UUID database
    // ====================================

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
    // MERGE PROVIDER
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
                        false

                };

            }
        );


    return {

        models:
            mergedModels,

        providers

    };

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


    // ====================================
    // GANTI provider_id
    // menjadi UUID database
    // ====================================

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
    // DEFAULT
    // ====================================

    if (
        model.credit_cost === undefined
    ) {

        model.credit_cost =
            0;

    }


    if (
        model.discount_percent === undefined
    ) {

        model.discount_percent =
            0;

    }


    if (
        model.status === undefined
    ) {

        model.status =
            "active";

    }


    // ====================================
    // JANGAN TERIMA credit_final
    // ====================================

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


    if (
        Object.keys(
            model
        ).length === 0
    ) {

        throw new Error(
            "Tidak ada data model yang diubah."
        );

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
    // NEVER ACCEPT CREDIT FINAL
    // ====================================

    delete model.credit_final;


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


    return result.data[0];

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

                    counts: {

                        models:
                            data.models.length,

                        providers:
                            data.providers.length

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
                        "Model berhasil diperbarui.",

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
