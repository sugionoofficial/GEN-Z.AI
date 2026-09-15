// ========================================
// GEN-Z.AI
// ADMIN CREDIT MANAGEMENT API
// File: api/admin-credit.js
// ========================================
//
// Endpoint aman untuk:
// - GET daftar user + credit
// - POST tambah credit
// - POST kurangi credit
//
// Menggunakan SUPABASE_SERVICE_ROLE_KEY
// hanya di server Vercel.
//
// JANGAN pernah memasukkan service role key
// ke frontend.
// ========================================


const json = (
    res,
    status,
    data
) => {

    return res
        .status(status)
        .json(data);

};


// ========================================
// HEADER
// ========================================

const getHeader = (
    req,
    name
) => {

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

const getBearerToken = (
    req
) => {

    const authorization =
        getHeader(
            req,
            "authorization"
        );

    if (!authorization) {
        return null;
    }

    const match =
        authorization.match(
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
        getBearerToken(
            req
        );

    if (!token) {

        return {

            ok: false,

            status: 401,

            error:
                "Session tidak ditemukan."

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

                method:
                    "GET",

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
    // LOAD PROFILE ADMIN
    // ------------------------------------

    const profileResult =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?select=id,email,name,role,status,credits&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {

                method:
                    "GET",

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


    const status =
        String(
            profile.status || ""
        ).toLowerCase();


    if (
        ![
            "ADMIN",
            "OWNER"
        ].includes(
            role
        )
    ) {

        return {

            ok: false,

            status: 403,

            error:
                "Anda tidak memiliki akses admin."

        };

    }


    if (
        status !== "active"
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

        profile

    };

};


// ========================================
// LIST USERS
// ========================================

const listUsers = async (
    config
) => {

    const result =
        await supabaseRequest(
            config.url,
            "/rest/v1/profiles?select=id,email,name,role,status,credits,created_at&order=created_at.desc",
            {

                method:
                    "GET",

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
            result.data?.hint ||
            "Gagal mengambil data users."
        );

    }


    return Array.isArray(
        result.data
    )
        ? result.data
        : [];

};


// ========================================
// GET USER
// ========================================

const getUser = async (
    config,
    userId
) => {

    const result =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?select=id,email,name,role,status,credits&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {

                method:
                    "GET",

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
            result.data?.hint ||
            "Gagal mengambil data user."
        );

    }


    const users =
        Array.isArray(
            result.data
        )
            ? result.data
            : [];


    return users[0] || null;

};


// ========================================
// UPDATE CREDIT
// ========================================

const updateCredit = async (
    config,
    userId,
    newCredits
) => {

    const result =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
            {

                method:
                    "PATCH",

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
                    JSON.stringify({

                        credits:
                            newCredits

                    })

            }
        );


    if (
        !result.response.ok
    ) {

        throw new Error(
            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal memperbarui credit."
        );

    }


    const users =
        Array.isArray(
            result.data
        )
            ? result.data
            : [];


    return users[0] || null;

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
// VALIDATE USER ID
// ========================================

const validateUserId = (
    value
) => {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {

        return false;

    }

    return true;

};


// ========================================
// VALIDATE AMOUNT
// ========================================

const validateAmount = (
    value
) => {

    const amount =
        Number(value);

    if (
        !Number.isFinite(amount) ||
        !Number.isInteger(amount) ||
        amount <= 0
    ) {

        return null;

    }

    return amount;

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
        "GET, POST, OPTIONS"
    );


    if (
        req.method === "OPTIONS"
    ) {

        return res
            .status(204)
            .end();

    }


    // ====================================
    // METHOD
    // ====================================

    if (
        ![
            "GET",
            "POST"
        ].includes(
            req.method
        )
    ) {

        return json(
            res,
            405,
            {

                success: false,

                error:
                    "Method tidak diizinkan."

            }
        );

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

            const users =
                await listUsers(
                    config
                );


            return json(
                res,
                200,
                {

                    success: true,

                    users

                }
            );

        } catch (error) {

            console.error(
                "ADMIN CREDIT GET ERROR:",
                error
            );

            return json(
                res,
                500,
                {

                    success: false,

                    error:
                        error.message ||
                        "Gagal mengambil data credit."

                }
            );

        }

    }


    // ====================================
    // POST
    // ====================================

    const body =
        parseBody(
            req
        );


    const action =
        String(
            body.action || ""
        )
            .trim()
            .toLowerCase();


    const userId =
        body.user_id ||
        body.userId;


    const amount =
        validateAmount(
            body.amount
        );


    // ------------------------------------
    // VALIDATE ACTION
    // ------------------------------------

    if (
        ![
            "add",
            "remove"
        ].includes(
            action
        )
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "Action harus berupa add atau remove."

            }
        );

    }


    // ------------------------------------
    // VALIDATE USER
    // ------------------------------------

    if (
        !validateUserId(
            userId
        )
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "User ID tidak valid."

            }
        );

    }


    // ------------------------------------
    // VALIDATE AMOUNT
    // ------------------------------------

    if (
        amount === null
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "Amount harus berupa angka bulat lebih dari 0."

            }
        );

    }


    try {

        // --------------------------------
        // LOAD CURRENT USER
        // --------------------------------

        const user =
            await getUser(
                config,
                userId
            );


        if (!user) {

            return json(
                res,
                404,
                {

                    success: false,

                    error:
                        "User tidak ditemukan."

                }
            );

        }


        const currentCredits =
            Math.max(
                0,
                Number(
                    user.credits || 0
                )
            );


        let newCredits;


        // --------------------------------
        // ADD
        // --------------------------------

        if (
            action === "add"
        ) {

            newCredits =
                currentCredits +
                amount;

        }


        // --------------------------------
        // REMOVE
        // --------------------------------

        else {

            if (
                amount >
                currentCredits
            ) {

                return json(
                    res,
                    400,
                    {

                        success: false,

                        error:
                            "Credit tidak mencukupi."

                    }
                );

            }


            newCredits =
                currentCredits -
                amount;

        }


        // --------------------------------
        // UPDATE
        // --------------------------------

        const updatedUser =
            await updateCredit(
                config,
                userId,
                newCredits
            );


        return json(
            res,
            200,
            {

                success: true,

                action,

                amount,

                previous_credits:
                    currentCredits,

                credits:
                    newCredits,

                user:
                    updatedUser

            }
        );

    } catch (error) {

        console.error(
            "ADMIN CREDIT UPDATE ERROR:",
            error
        );

        return json(
            res,
            500,
            {

                success: false,

                error:
                    error.message ||
                    "Gagal memperbarui credit."

            }
        );

    }

}
