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
// Keamanan:
// - Wajib login Supabase
// - Hanya ADMIN / OWNER
// - Service Role Key hanya server-side
//
// Environment:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// SUPABASE_ANON_KEY
// atau
// SUPABASE_KEY
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

    const authorization = getHeader(
        req,
        "authorization"
    );

    if (!authorization) {
        return null;
    }

    const match = authorization.match(
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

    const response = await fetch(
        `${url}${path}`,
        options
    );

    const text = await response.text();

    let data = null;

    if (text) {

        try {

            data = JSON.parse(text);

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

    const token = getBearerToken(req);

    if (!token) {

        return {
            ok: false,
            status: 401,
            error: "Session tidak ditemukan."
        };

    }


    // ------------------------------------
    // VERIFY SUPABASE ACCESS TOKEN
    // ------------------------------------

    const authResult =
        await supabaseRequest(
            config.url,
            "/auth/v1/user",
            {
                method: "GET",

                headers: {

                    "apikey":
                        config.anonKey ||
                        config.serviceRoleKey,

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


    // ------------------------------------
    // LOAD ADMIN PROFILE
    // ------------------------------------

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
        Array.isArray(profileResult.data)
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


    const status =
        String(
            profile.status || ""
        ).toLowerCase();


    if (
        !["ADMIN", "OWNER"].includes(role)
    ) {

        return {
            ok: false,
            status: 403,
            error:
                "Anda tidak memiliki akses admin."
        };

    }


    if (status !== "active") {

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
    "min_duration",
    "max_duration",
    "supported_ratios",
    "supported_resolutions",
    "status",
    "created_at",
    "updated_at"
];


// ========================================
// CLEAN MODEL
// ========================================

const cleanModel = (input = {}) => {

    const model = {};


    if (
        input.provider_id !== undefined
    ) {
        model.provider_id =
            input.provider_id;
    }


    if (
        input.model_id !== undefined
    ) {
        model.model_id =
            String(input.model_id).trim();
    }


    if (
        input.model_name !== undefined
    ) {
        model.model_name =
            String(input.model_name).trim();
    }


    if (
        input.description !== undefined
    ) {
        model.description =
            input.description === null
                ? null
                : String(input.description);
    }


    if (
        input.credit_cost !== undefined
    ) {

        const value =
            Number(input.credit_cost);

        if (!Number.isFinite(value)) {

            throw new Error(
                "credit_cost harus berupa angka."
            );

        }

        model.credit_cost = value;

    }


    if (
        input.min_duration !== undefined
    ) {

        const value =
            Number(input.min_duration);

        if (!Number.isFinite(value)) {

            throw new Error(
                "min_duration harus berupa angka."
            );

        }

        model.min_duration = value;

    }


    if (
        input.max_duration !== undefined
    ) {

        const value =
            Number(input.max_duration);

        if (!Number.isFinite(value)) {

            throw new Error(
                "max_duration harus berupa angka."
            );

        }

        model.max_duration = value;

    }


    if (
        input.supported_ratios !== undefined
    ) {

        model.supported_ratios =
            input.supported_ratios;

    }


    if (
        input.supported_resolutions !== undefined
    ) {

        model.supported_resolutions =
            input.supported_resolutions;

    }


    if (
        input.status !== undefined
    ) {

        model.status =
            String(input.status)
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

    if (
        requireAll ||
        model.provider_id !== undefined
    ) {

        if (
            model.provider_id === undefined ||
            model.provider_id === null ||
            String(model.provider_id).trim() === ""
        ) {

            return "provider_id wajib diisi.";

        }

    }


    if (
        requireAll ||
        model.model_id !== undefined
    ) {

        if (
            !model.model_id
        ) {

            return "model_id wajib diisi.";

        }

    }


    if (
        requireAll ||
        model.model_name !== undefined
    ) {

        if (
            !model.model_name
        ) {

            return "model_name wajib diisi.";

        }

    }


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
                String(model.status).toLowerCase()
            )
        ) {

            return (
                "status harus active, inactive, " +
                "atau maintenance."
            );

        }

    }


    return null;

};


// ========================================
// LIST MODELS
// ========================================

const listModels = async (
    config
) => {

    const fields =
        MODEL_FIELDS.join(",");


    const result =
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


    if (!result.response.ok) {

        throw new Error(
            result.data?.message ||
            result.data?.hint ||
            result.data?.details ||
            "Gagal mengambil data models."
        );

    }


    return Array.isArray(result.data)
        ? result.data
        : [];

};


// ========================================
// LIST PROVIDERS
// ========================================

const listProviders = async (
    config
) => {

    const result =
        await supabaseRequest(
            config.url,
            "/rest/v1/providers?select=id,provider_id,provider_name,description,status,is_default&order=created_at.desc",
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


    if (!result.response.ok) {

        throw new Error(
            result.data?.message ||
            result.data?.hint ||
            result.data?.details ||
            "Gagal mengambil data providers."
        );

    }


    return Array.isArray(result.data)
        ? result.data
        : [];

};


// ========================================
// MERGE PROVIDER NAME
// ========================================

const mergeProviderName = (
    models,
    providers
) => {

    const providerMap = new Map();


    providers.forEach(provider => {

        providerMap.set(
            String(provider.id),
            provider
        );

    });


    return models.map(model => {

        const provider =
            providerMap.get(
                String(model.provider_id)
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

    });

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
                    JSON.stringify(model)

            }
        );


    if (!result.response.ok) {

        throw new Error(
            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal membuat model."
        );

    }


    return Array.isArray(result.data)
        ? result.data[0]
        : result.data;

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


    model.updated_at =
        new Date().toISOString();


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
                    JSON.stringify(model)

            }
        );


    if (!result.response.ok) {

        throw new Error(
            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal memperbarui model."
        );

    }


    if (
        Array.isArray(result.data) &&
        result.data.length === 0
    ) {

        throw new Error(
            "Model tidak ditemukan."
        );

    }


    return Array.isArray(result.data)
        ? result.data[0]
        : result.data;

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


    if (!result.response.ok) {

        throw new Error(
            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal menghapus model."
        );

    }


    if (
        Array.isArray(result.data) &&
        result.data.length === 0
    ) {

        throw new Error(
            "Model tidak ditemukan."
        );

    }


    return Array.isArray(result.data)
        ? result.data[0]
        : result.data;

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


    if (
        req.method === "OPTIONS"
    ) {

        return res.status(204).end();

    }


    // ====================================
    // CONFIG
    // ====================================

    const config =
        getSupabaseConfig();


    if (
        !config.url ||
        !config.serviceRoleKey
    ) {

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server."
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
                    "SUPABASE_ANON_KEY atau SUPABASE_KEY belum dikonfigurasi di server."
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

            const [
                models,
                providers
            ] = await Promise.all([

                listModels(
                    config
                ),

                listProviders(
                    config
                )

            ]);


            const merged =
                mergeProviderName(
                    models,
                    providers
                );


            return json(
                res,
                200,
                {
                    success: true,
                    models: merged,
                    providers
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
    // PARSE BODY
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
