//admin-user.js?v=1.1
// ========================================
// GEN-Z.AI
// ADMIN USER MANAGEMENT API
// File: api/admin-users.js
// ========================================
//
// Endpoint aman untuk:
// - LIST users
// - CREATE user
// - UPDATE user
// - DELETE user
// - CONFIRM email
// - RESEND confirmation email
//
// WAJIB menggunakan environment variable:
//
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
//
// Optional:
// SUPABASE_ANON_KEY
// SUPABASE_KEY
//
// JANGAN pernah menaruh SUPABASE_SERVICE_ROLE_KEY
// di frontend.
// ========================================


const json = (res, status, data) => {

    return res
        .status(status)
        .json(data);

};


const getHeader = (req, name) => {

    const headers =
        req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );

};


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
        authorization.match(
            /^Bearer\s+(.+)$/i
        );

    return match
        ? match[1].trim()
        : null;

};


const getSupabaseConfig = () => {

    const url =
        process.env.SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    const anonKey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY;

    return {
        url,
        serviceRoleKey,
        anonKey
    };

};


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
// VERIFY CALLER
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


    // ------------------------------------
    // VERIFY ACCESS TOKEN
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
    // LOAD PROFILE
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
        )
            .trim()
            .toUpperCase();


    const status =
        String(
            profile.status || ""
        )
            .trim()
            .toLowerCase();


    if (
        !["ADMIN", "OWNER"].includes(
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
        profile: {
            ...profile,
            role
        }
    };

};


// ========================================
// LIST AUTH USERS
// ========================================

const listAuthUsers = async (
    config
) => {

    const allUsers = [];

    let page = 1;

    const perPage = 1000;


    while (true) {

        const result =
            await supabaseRequest(
                config.url,
                `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
                {
                    method: "GET",
                    headers: {
                        "apikey":
                            config.serviceRoleKey,

                        "Authorization":
                            `Bearer ${config.serviceRoleKey}`
                    }
                }
            );


        if (
            !result.response.ok
        ) {

            throw new Error(
                result.data?.msg ||
                result.data?.message ||
                "Gagal mengambil user Supabase Auth."
            );

        }


        const users =
            result.data?.users || [];


        allUsers.push(
            ...users
        );


        if (
            users.length < perPage
        ) {

            break;

        }


        page++;


        if (
            page > 100
        ) {

            break;

        }

    }


    return allUsers;

};


// ========================================
// LIST PROFILES
// ========================================

const listProfiles = async (
    config
) => {

    const result =
        await supabaseRequest(
            config.url,
            "/rest/v1/profiles?select=id,email,name,role,status,credits,created_at&order=created_at.desc",
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
            result.data?.hint ||
            "Gagal mengambil profiles."
        );

    }


    return Array.isArray(
        result.data
    )
        ? result.data
        : [];

};


// ========================================
// MERGE AUTH + PROFILE
// ========================================

const mergeUsers = (
    authUsers,
    profiles
) => {

    const profileMap =
        new Map();


    profiles.forEach(
        profile => {

            profileMap.set(
                profile.id,
                profile
            );

        }
    );


    return authUsers.map(
        authUser => {

            const profile =
                profileMap.get(
                    authUser.id
                ) || {};


            const emailConfirmed =
                Boolean(
                    authUser.email_confirmed_at
                );


            return {

                id:
                    authUser.id,

                email:
                    authUser.email ||
                    profile.email ||
                    "",

                name:
                    profile.name ||
                    authUser.user_metadata?.name ||
                    authUser.user_metadata?.full_name ||
                    "",

                role:
                    profile.role ||
                    "USER",

                status:
                    profile.status ||
                    "active",

                credits:
                    Number(
                        profile.credits || 0
                    ),

                created_at:
                    profile.created_at ||
                    authUser.created_at ||
                    null,

                email_confirmed:
                    emailConfirmed,

                email_confirmed_at:
                    authUser.email_confirmed_at ||
                    null,

                last_sign_in_at:
                    authUser.last_sign_in_at ||
                    null

            };

        }
    );

};


// ========================================
// CREATE PROFILE
// ========================================

const upsertProfile = async (
    config,
    user
) => {

    const payload = {

        id:
            user.id,

        email:
            user.email,

        name:
            user.name || "",

        role:
            user.role || "USER",

        status:
            user.status || "active",

        credits:
            Number(
                user.credits || 0
            )

    };


    const result =
        await supabaseRequest(
            config.url,
            "/rest/v1/profiles",
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
                        "resolution=merge-duplicates,return=minimal"

                },

                body:
                    JSON.stringify(
                        payload
                    )

            }
        );


    if (
        !result.response.ok
    ) {

        throw new Error(
            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal membuat profile user."
        );

    }

};


// ========================================
// UPDATE PROFILE
// ========================================

const updateProfile = async (
    config,
    userId,
    name,
    role,
    status,
    credits
) => {

    const payload = {

        name:
            String(
                name || ""
            ).trim(),

        role,

        status,

        credits:
            Number(
                credits
            )

    };


    const result =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
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
                        payload
                    )

            }
        );


    if (
        !result.response.ok
    ) {

        throw new Error(
            result.data?.message ||
            result.data?.details ||
            result.data?.hint ||
            "Gagal memperbarui profile user."
        );

    }


    const updated =
        Array.isArray(
            result.data
        )
            ? result.data[0]
            : null;


    return updated;

};


// ========================================
// UPDATE AUTH USER
// ========================================
//
// Digunakan untuk:
// - VERIFIED
// - UNVERIFIED
//
// Tidak mengubah email/password/user metadata.
// ========================================

const updateAuthVerification = async (
    config,
    userId,
    emailConfirmed
) => {

    const result =
        await supabaseRequest(
            config.url,
            `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
            {
                method: "PUT",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        email_confirm:
                            Boolean(
                                emailConfirmed
                            )

                    })

            }
        );


    if (
        !result.response.ok
    ) {

        throw new Error(
            result.data?.msg ||
            result.data?.message ||
            result.data?.error_description ||
            "Gagal memperbarui status verifikasi email."
        );

    }


    return result.data;

};


// ========================================
// LOAD TARGET PROFILE
// ========================================

const loadTargetProfile = async (
    config,
    userId
) => {

    const result =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?select=id,email,name,role,status,credits&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {
                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`

                }

            }
        );


    if (
        !result.response.ok
    ) {

        throw new Error(
            result.data?.message ||
            result.data?.hint ||
            "Gagal mengambil profile target."
        );

    }


    return Array.isArray(
        result.data
    )
        ? result.data[0]
        : null;

};


// ========================================
// SECURITY CHECK TARGET
// ========================================

const validateTargetManagement = (
    admin,
    targetProfile
) => {

    if (!targetProfile) {

        return {
            ok: false,
            status: 404,
            error:
                "User tidak ditemukan."
        };

    }


    const targetRole =
        String(
            targetProfile.role || "USER"
        )
            .trim()
            .toUpperCase();


    // ------------------------------------
    // ADMIN / OWNER TIDAK BOLEH EDIT DIRI
    // ------------------------------------

    if (
        targetProfile.id ===
        admin.userId
    ) {

        return {
            ok: false,
            status: 400,
            error:
                "Akun sendiri tidak dapat diedit melalui menu ini."
        };

    }


    // ------------------------------------
    // OWNER TIDAK BOLEH DIUBAH
    // ------------------------------------

    if (
        targetRole === "OWNER"
    ) {

        return {
            ok: false,
            status: 403,
            error:
                "Akun OWNER tidak dapat diedit melalui halaman ini."
        };

    }


    // ------------------------------------
    // ADMIN HANYA USER
    // ------------------------------------

    if (
        admin.profile.role === "ADMIN" &&
        targetRole !== "USER"
    ) {

        return {
            ok: false,
            status: 403,
            error:
                "ADMIN hanya dapat mengelola user biasa."
        };

    }


    return {
        ok: true,
        targetRole
    };

};


// ========================================
// SEND CONFIRMATION EMAIL
// ========================================

const resendConfirmationEmail = async (
    config,
    email
) => {

    if (!config.anonKey) {

        throw new Error(
            "SUPABASE_ANON_KEY atau SUPABASE_KEY belum dikonfigurasi."
        );

    }


    const result =
        await supabaseRequest(
            config.url,
            "/auth/v1/resend",
            {
                method: "POST",

                headers: {

                    "apikey":
                        config.anonKey,

                    "Authorization":
                        `Bearer ${config.anonKey}`,

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        type:
                            "signup",

                        email:
                            email

                    })

            }
        );


    if (
        !result.response.ok
    ) {

        throw new Error(
            result.data?.msg ||
            result.data?.message ||
            result.data?.error_description ||
            "Gagal mengirim ulang email konfirmasi."
        );

    }


    return result.data;

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
        "GET, POST, DELETE, PATCH, OPTIONS"
    );


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
                authUsers,
                profiles
            ] = await Promise.all([

                listAuthUsers(
                    config
                ),

                listProfiles(
                    config
                )

            ]);


            const users =
                mergeUsers(
                    authUsers,
                    profiles
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
                "ADMIN USERS LIST ERROR:",
                error
            );

            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        error.message ||
                        "Gagal mengambil data users."
                }
            );

        }

    }


    // ====================================
    // PARSE BODY
    // ====================================

    let body = {};

    if (
        req.body &&
        typeof req.body === "object"
    ) {

        body =
            req.body;

    } else {

        try {

            body =
                typeof req.body === "string"
                    ? JSON.parse(req.body)
                    : {};

        } catch {

            body = {};

        }

    }


    // ====================================
    // POST
    // ====================================
    //
    // action:
    // create
    // resend
    // ====================================

    if (
        req.method === "POST"
    ) {

        const action =
            String(
                body.action || "create"
            )
                .trim()
                .toLowerCase();


        // --------------------------------
        // RESEND EMAIL
        // --------------------------------

        if (
            action === "resend"
        ) {

            const email =
                String(
                    body.email || ""
                )
                    .trim()
                    .toLowerCase();


            if (!email) {

                return json(
                    res,
                    400,
                    {
                        success: false,
                        error:
                            "Email user wajib diisi."
                    }
                );

            }


            try {

                await resendConfirmationEmail(
                    config,
                    email
                );


                return json(
                    res,
                    200,
                    {
                        success: true,
                        message:
                            "Email konfirmasi berhasil dikirim ulang."
                    }
                );

            } catch (error) {

                console.error(
                    "RESEND EMAIL ERROR:",
                    error
                );

                return json(
                    res,
                    400,
                    {
                        success: false,
                        error:
                            error.message ||
                            "Gagal mengirim ulang email."
                    }
                );

            }

        }


        // --------------------------------
        // CREATE USER
        // --------------------------------

        if (
            action !== "create"
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Action POST tidak dikenal."
                }
            );

        }


        const email =
            String(
                body.email || ""
            )
                .trim()
                .toLowerCase();


        const password =
            String(
                body.password || ""
            );


        const name =
            String(
                body.name || ""
            )
                .trim();


        const requestedRole =
            String(
                body.role || "USER"
            )
                .trim()
                .toUpperCase();


        const requestedStatus =
            String(
                body.status || "active"
            )
                .trim()
                .toLowerCase();


        const credits =
            Number(
                body.credits || 0
            );


        if (!email) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Email wajib diisi."
                }
            );

        }


        if (
            !password ||
            password.length < 6
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Password minimal 6 karakter."
                }
            );

        }


        if (
            ![
                "USER",
                "ADMIN",
                "OWNER"
            ].includes(
                requestedRole
            )
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Role tidak valid."
                }
            );

        }


        if (
            ![
                "active",
                "inactive",
                "suspended"
            ].includes(
                requestedStatus
            )
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Status tidak valid."
                }
            );

        }


        if (
            !Number.isFinite(
                credits
            ) ||
            credits < 0
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Credit tidak valid."
                }
            );

        }


        // --------------------------------
        // SECURITY ROLE
        // --------------------------------

        if (
            admin.profile.role === "ADMIN" &&
            requestedRole !== "USER"
        ) {

            return json(
                res,
                403,
                {
                    success: false,
                    error:
                        "ADMIN hanya dapat membuat user dengan role USER."
                }
            );

        }


        if (
            requestedRole === "OWNER"
        ) {

            return json(
                res,
                403,
                {
                    success: false,
                    error:
                        "Pembuatan OWNER dinonaktifkan melalui endpoint ini."
                }
            );

        }


        let createdUser = null;


        try {

            // --------------------------------
            // CREATE SUPABASE AUTH USER
            // --------------------------------

            const createResult =
                await supabaseRequest(
                    config.url,
                    "/auth/v1/admin/users",
                    {
                        method: "POST",

                        headers: {

                            "apikey":
                                config.serviceRoleKey,

                            "Authorization":
                                `Bearer ${config.serviceRoleKey}`,

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                email:
                                    email,

                                password:
                                    password,

                                email_confirm:
                                    false,

                                user_metadata: {

                                    name:
                                        name

                                }

                            })

                    }
                );


            if (
                !createResult.response.ok
            ) {

                return json(
                    res,
                    createResult.response.status,
                    {
                        success: false,
                        error:
                            createResult.data?.msg ||
                            createResult.data?.message ||
                            createResult.data?.error_description ||
                            "Gagal membuat user Supabase Auth."
                    }
                );

            }


            createdUser =
                createResult.data?.user ||
                createResult.data;


            if (
                !createdUser?.id
            ) {

                throw new Error(
                    "Supabase berhasil merespons tetapi ID user tidak ditemukan."
                );

            }


            // --------------------------------
            // UPSERT PROFILE
            // --------------------------------

            await upsertProfile(
                config,
                {
                    id:
                        createdUser.id,

                    email:
                        email,

                    name:
                        name,

                    role:
                        requestedRole,

                    status:
                        requestedStatus,

                    credits:
                        credits

                }
            );


            // --------------------------------
            // SEND CONFIRMATION EMAIL
            // --------------------------------

            let emailSent = true;

            let emailError = null;


            try {

                await resendConfirmationEmail(
                    config,
                    email
                );

            } catch (error) {

                emailSent = false;

                emailError =
                    error.message ||
                    "Email konfirmasi gagal dikirim.";

            }


            return json(
                res,
                201,
                {
                    success: true,

                    user: {

                        id:
                            createdUser.id,

                        email:
                            email,

                        name:
                            name,

                        role:
                            requestedRole,

                        status:
                            requestedStatus,

                        credits:
                            credits,

                        email_confirmed:
                            Boolean(
                                createdUser.email_confirmed_at
                            )

                    },

                    emailSent,

                    emailError,

                    message:
                        emailSent
                            ? "User berhasil dibuat dan email konfirmasi dikirim."
                            : "User berhasil dibuat, tetapi email konfirmasi gagal dikirim. Gunakan tombol Kirim Ulang atau Konfirmasi Email."

                }
            );

        } catch (error) {

            console.error(
                "CREATE USER ERROR:",
                error
            );


            // --------------------------------
            // ROLLBACK AUTH USER
            // --------------------------------

            if (
                createdUser?.id
            ) {

                try {

                    await supabaseRequest(
                        config.url,
                        `/auth/v1/admin/users/${encodeURIComponent(createdUser.id)}`,
                        {
                            method: "DELETE",

                            headers: {

                                "apikey":
                                    config.serviceRoleKey,

                                "Authorization":
                                    `Bearer ${config.serviceRoleKey}`

                            }
                        }
                    );

                } catch (
                    rollbackError
                ) {

                    console.error(
                        "ROLLBACK USER ERROR:",
                        rollbackError
                    );

                }

            }


            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        error.message ||
                        "Gagal membuat user."
                }
            );

        }

    }


    // ====================================
    // PATCH
    // ====================================
    //
    // action:
    // confirm
    // update
    //
    // ====================================

    if (
        req.method === "PATCH"
    ) {

        const action =
            String(
                body.action || ""
            )
                .trim()
                .toLowerCase();


        // ==================================
// UPDATE USER
// ==================================

if (
    action === "update"
) {

    const userId =
        String(
            body.userId || ""
        )
            .trim();


    const requestedName =
        String(
            body.name || ""
        )
            .trim();


    const requestedRole =
        String(
            body.role || ""
        )
            .trim()
            .toUpperCase();


    const requestedStatus =
        String(
            body.status || ""
        )
            .trim()
            .toLowerCase();


    const requestedCredits =
        Number(
            body.credits
        );


    const requestedVerified =
        body.emailConfirmed;


    // --------------------------------
    // BASIC VALIDATION
    // --------------------------------

    if (!userId) {

        return json(
            res,
            400,
            {
                success: false,
                error:
                    "ID user wajib diisi."
            }
        );

    }


    if (
        ![
            "USER",
            "ADMIN"
        ].includes(
            requestedRole
        )
    ) {

        return json(
            res,
            400,
            {
                success: false,
                error:
                    "Role edit tidak valid. Role yang dapat dipilih adalah USER atau ADMIN."
            }
        );

    }


    if (
        ![
            "active",
            "inactive",
            "suspended"
        ].includes(
            requestedStatus
        )
    ) {

        return json(
            res,
            400,
            {
                success: false,
                error:
                    "Status edit tidak valid."
            }
        );

    }


    if (
        !Number.isFinite(
            requestedCredits
        ) ||
        requestedCredits < 0
    ) {

        return json(
            res,
            400,
            {
                success: false,
                error:
                    "Credit tidak valid."
            }
        );

    }


    if (
        typeof requestedVerified !==
        "boolean"
    ) {

        return json(
            res,
            400,
            {
                success: false,
                error:
                    "Status verifikasi tidak valid."
            }
        );

    }


    // --------------------------------
    // LOAD TARGET
    // --------------------------------

    try {

        const targetProfile =
            await loadTargetProfile(
                config,
                userId
            );


        const security =
            validateTargetManagement(
                admin,
                targetProfile
            );


        if (
            !security.ok
        ) {

            return json(
                res,
                security.status,
                {
                    success: false,
                    error:
                        security.error
                }
            );

        }


        // --------------------------------
        // ADMIN CANNOT PROMOTE USER
        // --------------------------------

        if (
            admin.profile.role === "ADMIN" &&
            requestedRole !== "USER"
        ) {

            return json(
                res,
                403,
                {
                    success: false,
                    error:
                        "ADMIN tidak dapat mengubah role user menjadi ADMIN."
                }
            );

        }


        // --------------------------------
        // UPDATE AUTH VERIFICATION
        // --------------------------------
        //
        // Email/password tidak disentuh.
        // Hanya email_confirm.
        // --------------------------------

        await updateAuthVerification(
            config,
            userId,
            requestedVerified
        );


        // --------------------------------
        // UPDATE PROFILE
        // --------------------------------

        const updatedProfile =
            await updateProfile(
                config,
                userId,
                requestedName,
                requestedRole,
                requestedStatus,
                requestedCredits
            );


        return json(
            res,
            200,
            {
                success: true,

                user: {

                    id:
                        userId,

                    email:
                        targetProfile.email ||
                        "",

                    name:
                        updatedProfile?.name ??
                        requestedName,

                    role:
                        updatedProfile?.role ||
                        requestedRole,

                    status:
                        updatedProfile?.status ||
                        requestedStatus,

                    credits:
                        Number(
                            updatedProfile?.credits ??
                            requestedCredits
                        ),

                    email_confirmed:
                        requestedVerified

                },

                message:
                    "Data user berhasil diperbarui."

            }
        );

    } catch (error) {

        console.error(
            "UPDATE USER ERROR:",
            error
        );


        return json(
            res,
            500,
            {
                success: false,
                error:
                    error.message ||
                    "Gagal memperbarui user."
            }
        );

    }

}


        // ==================================
        // CONFIRM EMAIL
        // ==================================

        if (
            action !== "confirm"
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Action PATCH tidak dikenal."
                }
            );

        }


        const userId =
            String(
                body.userId || ""
            )
                .trim();


        if (!userId) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "ID user wajib diisi."
                }
            );

        }


        if (
            userId ===
            admin.userId
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Akun admin sendiri tidak perlu dikonfirmasi melalui menu ini."
                }
            );

        }


        try {

            // --------------------------------
            // LOAD TARGET PROFILE
            // --------------------------------

            const targetProfile =
                await loadTargetProfile(
                    config,
                    userId
                );


            const security =
                validateTargetManagement(
                    admin,
                    targetProfile
                );


            if (
                !security.ok
            ) {

                return json(
                    res,
                    security.status,
                    {
                        success: false,
                        error:
                            security.error
                    }
                );

            }


            // --------------------------------
            // CONFIRM EMAIL
            // --------------------------------

            await updateAuthVerification(
                config,
                userId,
                true
            );


            return json(
                res,
                200,
                {
                    success: true,

                    message:
                        "Email user berhasil dikonfirmasi.",

                    userId:
                        userId

                }
            );

        } catch (error) {

            console.error(
                "CONFIRM EMAIL ERROR:",
                error
            );

            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        error.message ||
                        "Gagal mengonfirmasi email."
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

        const userId =
            String(
                body.userId ||
                req.query?.userId ||
                ""
            )
                .trim();


        if (!userId) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "ID user wajib diisi."
                }
            );

        }


        if (
            userId ===
            admin.userId
        ) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "Anda tidak dapat menghapus akun sendiri."
                }
            );

        }


        try {

            // --------------------------------
            // LOAD TARGET PROFILE
            // --------------------------------

            const targetProfile =
                await loadTargetProfile(
                    config,
                    userId
                );


            const security =
                validateTargetManagement(
                    admin,
                    targetProfile
                );


            if (
                !security.ok
            ) {

                return json(
                    res,
                    security.status,
                    {
                        success: false,
                        error:
                            security.error
                    }
                );

            }


            // --------------------------------
            // DELETE AUTH USER
            // --------------------------------

            const deleteResult =
                await supabaseRequest(
                    config.url,
                    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
                    {
                        method: "DELETE",

                        headers: {

                            "apikey":
                                config.serviceRoleKey,

                            "Authorization":
                                `Bearer ${config.serviceRoleKey}`

                        }

                    }
                );


            if (
                !deleteResult.response.ok
            ) {

                throw new Error(
                    deleteResult.data?.msg ||
                    deleteResult.data?.message ||
                    "Gagal menghapus user dari Supabase Auth."
                );

            }


            // --------------------------------
            // DELETE PROFILE
            // --------------------------------

            try {

                const profileDeleteResult =
                    await supabaseRequest(
                        config.url,
                        `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
                        {
                            method: "DELETE",

                            headers: {

                                "apikey":
                                    config.serviceRoleKey,

                                "Authorization":
                                    `Bearer ${config.serviceRoleKey}`,

                                "Prefer":
                                    "return=minimal"

                            }

                        }
                    );


                if (
                    !profileDeleteResult.response.ok
                ) {

                    console.error(
                        "PROFILE DELETE RESPONSE:",
                        profileDeleteResult.data
                    );

                }

            } catch (
                profileDeleteError
            ) {

                console.error(
                    "PROFILE DELETE ERROR:",
                    profileDeleteError
                );

            }


            return json(
                res,
                200,
                {
                    success: true,

                    userId:
                        userId,

                    message:
                        "User berhasil dihapus dari Supabase Auth."
                }
            );

        } catch (error) {

            console.error(
                "DELETE USER ERROR:",
                error
            );

            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        error.message ||
                        "Gagal menghapus user."
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
                "Method tidak diizinkan."
        }
    );

}
