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
    return res.status(status).json(data);
};


// ========================================
// HEADER
// ========================================

const getHeader = (req, name) => {

    const headers = req.headers || {};

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
        String(authorization).match(
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

    return {

        url:
            process.env.SUPABASE_URL,

        serviceRoleKey:
            process.env.SUPABASE_SERVICE_ROLE_KEY,

        anonKey:
            process.env.SUPABASE_ANON_KEY ||
            process.env.SUPABASE_KEY

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
                "Session tidak ditemukan."
        };

    }


    // ====================================
    // VERIFY SUPABASE SESSION
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

        return {

            ok: false,

            status: 401,

            error:
                "Session Supabase tidak valid."

        };

    }


    const userId =
        authResult.data.id;


    // ====================================
    // LOAD PROFILE
    // ====================================

    const profileResult =
        await supabaseRequest(
            config.url,

            `/rest/v1/profiles?select=id,email,name,role,status,credits&id=eq.${encodeURIComponent(userId)}&limit=1`,

            {
                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json"

                }

            }

        );


    if (!profileResult.response.ok) {

        console.error(
            "PROFILE CHECK ERROR:",
            profileResult.data
        );

        return {

            ok: false,

            status: 500,

            error:
                "Gagal memeriksa profile admin."

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
        ).toUpperCase();


    const accountStatus =
        String(
            profile.status || ""
        ).toLowerCase();


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
                );

    }


    // ====================================
    // CREDIT COST
    // ====================================

    if (
        input.credit_cost !== undefined
    ) {

        const value =
            parseNumber(
                input.credit_cost,
                "credit_cost",
                true
            );


        if (value < 0) {

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
        input.discount_percent !== undefined
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


        if (value < 0) {

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


        if (value < 0) {

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

        if (
            Array.isArray(
                input.supported_ratios
            )
        ) {

            model.supported_ratios =
                input.supported_ratios;

        } else {

            model.supported_ratios =
                String(
                    input.supported_ratios
                )
                .split(",")
                .map(
                    item =>
                        item.trim()
                )
                .filter(Boolean);

        }

    }


    // ====================================
    // RESOLUTIONS
    // ====================================

    if (
        input.supported_resolutions !== undefined
    ) {

        if (
            Array.isArray(
                input.supported_resolutions
            )
        ) {

            model.supported_resolutions =
                input.supported_resolutions;

        } else {

            model.supported_resolutions =
                String(
                    input.supported_resolutions
                )
                .split(",")
                .map(
                    item =>
                        item.trim()
                )
                .filter(Boolean);

        }

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
// CHECK PROVIDER
// ========================================

const providerExists = async (
    config,
    providerId
) => {

    const result =
        await supabaseRequest(

            config.url,

            `/rest/v1/providers?select=id,provider_id,provider_name,status&id=eq.${encodeURIComponent(providerId)}&limit=1`,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json"

                }

            }

        );


    if (
        !result.response.ok
    ) {

        console.error(
            "PROVIDER CHECK ERROR:",
            result.data
        );

        throw new Error(
            result.data?.message ||
            result.data?.details ||
            "Gagal memeriksa provider."
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
// CHECK DUPLICATE MODEL
// ========================================

const duplicateModelExists = async (
    config,
    providerId,
    modelId,
    excludeId = null
) => {

    let path =

        `/rest/v1/models?select=id,provider_id,model_id&provider_id=eq.${encodeURIComponent(providerId)}&model_id=eq.${encodeURIComponent(modelId)}&limit=1`;


    if (excludeId) {

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
                        "application/json"

                }

            }

        );


    if (
        !result.response.ok
    ) {

        throw new Error(

            result.data?.message ||
            result.data?.details ||
            "Gagal memeriksa duplikasi model."

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
// LIST MODELS + PROVIDERS
// ========================================

const listModels = async (
    config
) => {

    const fields =
        MODEL_FIELDS.join(",");


    const modelsResult =
        await supabaseRequest(

            config.url,

            `/rest/v1/models?select=${encodeURIComponent(fields)}&order=created_at.desc`,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json"

                }

            }

        );


    if (
        !modelsResult.response.ok
    ) {

        throw new Error(

            modelsResult.data?.message ||
            modelsResult.data?.details ||
            modelsResult.data?.hint ||
            "Gagal mengambil data models."

        );

    }


    const providersResult =
        await supabaseRequest(

            config.url,

            `/rest/v1/providers?select=id,provider_id,provider_name,description,status,is_default&order=created_at.desc`,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json"

                }

            }

        );


    if (
        !providersResult.response.ok
    ) {

        throw new Error(

            providersResult.data?.message ||
            providersResult.data?.details ||
            providersResult.data?.hint ||
            "Gagal mengambil data providers."

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

            providerMap.set(

                String(
                    provider.id
                ),

                provider

            );

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
                        null

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
        cleanModel(body);


    const validation =
        validateModel(
            model,
            true
        );


    if (validation) {

        throw new Error(
            validation
        );

    }


    // ====================================
    // PROVIDER CHECK
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
    // DUPLICATE CHECK
    // ====================================

    const duplicate =
        await duplicateModelExists(

            config,

            model.provider_id,

            model.model_id

        );


    if (duplicate) {

        throw new Error(

            "Model ID sudah digunakan oleh provider tersebut."

        );

    }


    // ====================================
    // DEFAULT VALUES
    // ====================================

    if (
        model.credit_cost === undefined
    ) {

        model.credit_cost = 0;

    }


    if (
        model.discount_percent === undefined
    ) {

        model.discount_percent = 0;

    }


    if (
        model.status === undefined
    ) {

        model.status = "active";

    }


    // Jangan mengirim credit_final.
    // Database trigger menghitungnya.
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

            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal membuat model."

        );

    }


    return (

        Array.isArray(
            result.data
        )

            ? result.data[0]

            : result.data

    );

};


// ========================================
// UPDATE MODEL
// ========================================

const updateModel = async (
    config,
    id,
    body
) => {

    if (!id) {

        throw new Error(
            "ID model wajib diisi."
        );

    }


    const model =
        cleanModel(body);


    const validation =
        validateModel(
            model,
            false
        );


    if (validation) {

        throw new Error(
            validation
        );

    }


    if (
        Object.keys(model).length === 0
    ) {

        throw new Error(
            "Tidak ada data model yang diubah."
        );

    }


    // ====================================
    // PROVIDER CHECK
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

    }


    // ====================================
    // DUPLICATE CHECK
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


        if (duplicate) {

            throw new Error(

                "Model ID sudah digunakan oleh provider tersebut."

            );

        }

    }


    // ====================================
    // NEVER ACCEPT CREDIT_FINAL
    // ====================================

    delete model.credit_final;


    // ====================================
    // UPDATED AT
    // ====================================

    model.updated_at =
        new Date().toISOString();


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

            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal memperbarui model."

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

    if (!id) {

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

            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal menghapus model."

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
        typeof req.body === "object"
    ) {

        return req.body;

    }


    if (
        typeof req.body === "string"
    ) {

        try {

            return JSON.parse(
                req.body
            );

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
    // CONFIG
    // ====================================

    const config =
        getSupabaseConfig();


    if (
        !config.url ||
        !config.serviceRoleKey ||
        !config.anonKey
    ) {

        return json(

            res,

            500,

            {

                success: false,

                error:
                    "Konfigurasi Supabase server belum lengkap."

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

    } catch (error) {

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
                    "Gagal memverifikasi akses admin."

            }

        );

    }


    if (!admin.ok) {

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
                        data.providers

                }

            );

        } catch (error) {

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
        parseBody(req);


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

        } catch (error) {

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

        } catch (error) {

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

        } catch (error) {

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
    // METHOD NOT ALLOWED
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
