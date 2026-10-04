/* =========================================================
   GEN-Z.AI
   VIDDRA ACCOUNT API
   ---------------------------------------------------------
   File:
   api/viddra/account.js

   Fungsi:
   - Authenticate user GEN-Z.AI melalui Supabase
   - Register account VidDra
   - Login account VidDra
   - Menyimpan VidDra JWT ke encrypted HttpOnly cookie
   - Cek balance VidDra
   - Create VidDra API Key
   - Tidak mengembalikan JWT VidDra ke browser
   - Tidak menyimpan API Key ke database
   - Tidak menyimpan API Key ke cookie
   - Tidak log API Key
   - Tidak menyentuh KIE.AI
   - Tidak menyentuh generation_history

   Endpoint:
   POST /api/viddra/account

   Create API Key:
   POST /api/viddra/account?action=create-key
========================================================= */

import {
    createVidDraSessionCookie,
    getVidDraSession,
    createVidDraApiKeyCookie,
    getVidDraApiKey
} from "../../lib/viddra/session.js";


const SUPABASE_URL =
    String(
        process.env.SUPABASE_URL || ""
    )
        .trim()
        .replace(
            /\/+$/,
            ""
        );


const SUPABASE_SERVICE_ROLE_KEY =
    String(
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    ).trim();


const VIDDRA_API_BASE =
    "https://api.viddra.com/v1";


/* =========================================================
   RESPONSE
========================================================= */

function json(
    res,
    statusCode,
    data
) {

    res.statusCode =
        statusCode;


    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );


    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );


    return res.end(
        JSON.stringify(
            data
        )
    );

}


function success(
    res,
    data = {}
) {

    return json(
        res,
        200,
        {
            success: true,
            ...data
        }
    );

}


function failure(
    res,
    statusCode,
    message,
    extra = {}
) {

    return json(
        res,
        statusCode,
        {
            success: false,
            error: message,
            ...extra
        }
    );

}


/* =========================================================
   SUPABASE REQUEST
========================================================= */

async function supabaseRequest(
    path,
    options = {}
) {

    if (
        !SUPABASE_URL
    ) {

        throw Object.assign(
            new Error(
                "SUPABASE_URL is not configured"
            ),
            {
                status:
                    500
            }
        );

    }


    if (
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw Object.assign(
            new Error(
                "SUPABASE_SERVICE_ROLE_KEY is not configured"
            ),
            {
                status:
                    500
            }
        );

    }


    const response =
        await fetch(
            `${SUPABASE_URL}${path}`,
            {

                ...options,

                headers: {

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY,

                    Authorization:
                        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})

                }

            }
        );


    const text =
        await response.text();


    let data =
        null;


    if (
        text
    ) {

        try {

            data =
                JSON.parse(
                    text
                );

        } catch {

            data =
                text;

        }

    }


    if (
        !response.ok
    ) {

        const message =
            (
                data &&
                typeof data === "object"
            )
                ? (
                    data.message ||
                    data.error_description ||
                    data.error ||
                    `Supabase request failed with status ${response.status}`
                )
                : `Supabase request failed with status ${response.status}`;


        const error =
            new Error(
                message
            );


        error.status =
            response.status;


        error.data =
            data;


        throw error;

    }


    return data;

}


/* =========================================================
   AUTHENTICATE GEN-Z.AI USER
========================================================= */

async function authenticateUser(
    req
) {

    const authorization =
        String(
            req.headers?.authorization ||
            req.headers?.Authorization ||
            ""
        ).trim();


    if (
        !authorization
    ) {

        throw Object.assign(
            new Error(
                "Authorization header is required"
            ),
            {
                status:
                    401
            }
        );

    }


    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );


    if (
        !match
    ) {

        throw Object.assign(
            new Error(
                "Invalid Authorization header"
            ),
            {
                status:
                    401
            }
        );

    }


    const accessToken =
        String(
            match[1] || ""
        ).trim();


    if (
        !accessToken
    ) {

        throw Object.assign(
            new Error(
                "Access token is missing"
            ),
            {
                status:
                    401
            }
        );

    }


    const user =
        await supabaseRequest(
            "/auth/v1/user",
            {

                method:
                    "GET",

                headers: {

                    Authorization:
                        `Bearer ${accessToken}`,

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY

                }

            }
        );


    if (
        !user ||
        !user.id
    ) {

        throw Object.assign(
            new Error(
                "Invalid or expired GEN-Z.AI session"
            ),
            {
                status:
                    401
            }
        );

    }


    return user;

}


/* =========================================================
   READ BODY
========================================================= */

async function readBody(
    req
) {

    if (
        req.body &&
        typeof req.body === "object"
    ) {

        return req.body;

    }


    let body =
        "";


    for await (
        const chunk
        of req
    ) {

        body +=
            chunk;

    }


    if (
        !body.trim()
    ) {

        return {};

    }


    try {

        return JSON.parse(
            body
        );

    } catch {

        throw Object.assign(
            new Error(
                "Request body must be valid JSON"
            ),
            {
                status:
                    400
            }
        );

    }

}


/* =========================================================
   NORMALIZE INPUT
========================================================= */

function normalizeEmail(
    value
) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase();

}


function normalizePassword(
    value
) {

    return String(
        value ?? ""
    );

}


/* =========================================================
   VIDDRA REQUEST
========================================================= */

async function viddraRequest(
    path,
    options = {}
) {

    const response =
        await fetch(
            `${VIDDRA_API_BASE}${path}`,
            {

                ...options,

                headers: {

                    Accept:
                        "application/json",

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})

                }

            }
        );


    const text =
        await response.text();


    let data =
        null;


    if (
        text
    ) {

        try {

            data =
                JSON.parse(
                    text
                );

        } catch {

            data =
                {
                    raw:
                        text
                };

        }

    }


    if (
        !response.ok
    ) {

        const providerMessage =
            (
                data &&
                typeof data === "object"
            )
                ? (
                    data.message ||
                    data.error ||
                    data.detail ||
                    data.raw ||
                    ""
                )
                : "";


        const error =
            new Error(
                providerMessage ||
                `VidDra request failed with status ${response.status}`
            );


        error.status =
            response.status;


        error.data =
            data;


        throw error;

    }


    return data;

}


/* =========================================================
   VIDDRA REGISTER
========================================================= */

async function registerVidDra(
    email,
    password
) {

    return await viddraRequest(
        "/auth/register",
        {

            method:
                "POST",

            body:
                JSON.stringify({

                    email,

                    password

                })

        }
    );

}


/* =========================================================
   VIDDRA LOGIN
========================================================= */

async function loginVidDra(
    email,
    password
) {

    return await viddraRequest(
        "/auth/login",
        {

            method:
                "POST",

            body:
                JSON.stringify({

                    email,

                    password

                })

        }
    );

}


/* =========================================================
   EXTRACT VIDDRA TOKEN
========================================================= */

function getVidDraToken(
    loginResponse
) {

    const token =
        String(
            loginResponse?.token ||
            loginResponse?.access_token ||
            loginResponse?.data?.token ||
            loginResponse?.data?.access_token ||
            ""
        ).trim();


    return token;

}


/* =========================================================
   VIDDRA BALANCE
========================================================= */

async function getVidDraBalance(
    token
) {

    if (
        !token
    ) {

        throw Object.assign(
            new Error(
                "VidDra login token is missing"
            ),
            {
                status:
                    502
            }
        );

    }


    return await viddraRequest(
        "/billing/balance",
        {

            method:
                "GET",

            headers: {

                Authorization:
                    `Bearer ${token}`

            }

        }
    );

}


/* =========================================================
   VIDDRA CREATE API KEY
   ---------------------------------------------------------
   Endpoint:
   POST https://api.viddra.com/v1/keys

   Authorization:
   Bearer <VidDra JWT>

   Body:
   {}

   PENTING:
   - API key hanya dikembalikan sekali
   - Tidak disimpan server
   - Tidak disimpan Supabase
   - Tidak disimpan cookie
   - Tidak di-log
========================================================= */

async function createVidDraApiKey(
    token
) {

    if (
        !token
    ) {

        throw Object.assign(
            new Error(
                "VidDra session tidak ditemukan."
            ),
            {
                status:
                    401
            }
        );

    }


    const response =
        await viddraRequest(
            "/keys",
            {

                method:
                    "POST",

                headers: {

                    Authorization:
                        `Bearer ${token}`

                },

                body:
                    JSON.stringify({})

            }
        );


    return response;

}


/* =========================================================
   ACCOUNT DATA
========================================================= */

function extractAccount(
    registerResponse,
    loginResponse
) {

    const registerUser =
        registerResponse?.user ||
        registerResponse?.data?.user ||
        null;


    const loginUser =
        loginResponse?.user ||
        loginResponse?.data?.user ||
        null;


    return {

        id:
            loginUser?.id ||
            registerUser?.id ||
            null,

        email:
            loginUser?.email ||
            registerUser?.email ||
            null,

        status:
            registerUser?.status ||
            loginUser?.status ||
            null,

        created_at:
            registerUser?.created_at ||
            loginUser?.created_at ||
            null,

        bonus_granted_usd:
            registerUser?.bonus_granted_usd ??
            null

    };

}


/* =========================================================
   BALANCE DATA
========================================================= */

function extractBalance(
    balanceResponse
) {

    return {

        balance_usd:
            balanceResponse?.balance_usd ??
            balanceResponse?.data?.balance_usd ??
            "0.0000",

        month_spend_usd:
            balanceResponse?.month_spend_usd ??
            balanceResponse?.data?.month_spend_usd ??
            "0",

        updated_at:
            balanceResponse?.updated_at ??
            balanceResponse?.data?.updated_at ??
            null

    };

}


/* =========================================================
   EXTRACT API KEY
========================================================= */

function extractVidDraApiKey(
    response
) {

    const key =
        String(
            response?.key ||
            response?.api_key ||
            response?.data?.key ||
            response?.data?.api_key ||
            ""
        ).trim();


    return key;

}


/* =========================================================
   CREATE KEY ACTION
   ---------------------------------------------------------
   POST /api/viddra/account?action=create-key

   SECURITY:
   - API key TIDAK dikembalikan
   - API key TIDAK di-log
   - API key TIDAK disimpan database
   - API key disimpan encrypted HttpOnly cookie
========================================================= */

async function handleCreateApiKey(
    req,
    res,
    genzUser
) {

    /*
     * -------------------------------------------------------
     * Jika API key sudah tersedia di encrypted cookie,
     * jangan membuat key baru.
     * -------------------------------------------------------
     */

    const existingApiKey =
        getVidDraApiKey(
            req
        );


    if (
        existingApiKey
    ) {

        return success(
            res,
            {

                ready:
                    true,

                existing:
                    true

            }
        );

    }


    /*
     * -------------------------------------------------------
     * Ambil VidDra JWT dari encrypted HttpOnly cookie.
     * -------------------------------------------------------
     */

    const vidDraToken =
        getVidDraSession(
            req
        );


    if (
        !vidDraToken
    ) {

        return failure(
            res,
            401,
            "Session VidDra tidak ditemukan. Hubungkan account VidDra terlebih dahulu."
        );

    }


    try {

        const keyResponse =
            await createVidDraApiKey(
                vidDraToken
            );


        const apiKey =
            extractVidDraApiKey(
                keyResponse
            );


        if (
            !apiKey
        ) {

            console.error(
                "[viddra] API key response tidak berisi key."
            );


            return failure(
                res,
                502,
                "VidDra berhasil merespons tetapi API key tidak ditemukan."
            );

        }


        /*
         * ---------------------------------------------------
         * SIMPAN API KEY SECARA ENCRYPTED
         * ---------------------------------------------------
         */

        const apiKeyCookie =
            createVidDraApiKeyCookie(
                apiKey
            );


        /*
         * ---------------------------------------------------
         * Jangan overwrite cookie JWT.
         *
         * Karena create-key dipanggil setelah session JWT
         * sudah ada, cukup kirim cookie API key baru.
         * Browser akan mempertahankan cookie session lama.
         * ---------------------------------------------------
         */

        res.setHeader(
            "Set-Cookie",
            apiKeyCookie
        );


        /*
         * ---------------------------------------------------
         * SECURITY
         * ---------------------------------------------------
         *
         * JANGAN log:
         * - apiKey
         * - keyResponse
         * - Authorization
         * - JWT
         *
         * Hanya metadata aman.
         * ---------------------------------------------------
         */

        console.info(
            "[viddra] API key stored securely:",
            {

                genz_user_id:
                    genzUser.id,

                key_id:
                    keyResponse?.id ||
                    null,

                key_prefix:
                    keyResponse?.key_prefix ||
                    null,

                status:
                    keyResponse?.status ||
                    null,

                ready:
                    true

            }
        );


        /*
         * ---------------------------------------------------
         * API RESPONSE
         * ---------------------------------------------------
         *
         * TIDAK ADA:
         * key
         * api_key
         * masked key
         * prefix
         *
         * Frontend hanya perlu tahu:
         * ready = true
         * ---------------------------------------------------
         */

        return success(
            res,
            {

                ready:
                    true

            }
        );

    } catch (error) {

        console.error(
            "[viddra] API key creation failed:",
            {

                message:
                    error?.message,

                status:
                    error?.status,

                code:
                    error?.code

            }
        );


        const statusCode =
            Number(
                error?.status
            );


        return failure(
            res,
            statusCode >= 400 &&
            statusCode < 600
                ? statusCode
                : 502,
            error?.message ||
            "Gagal membuat VidDra API key."
        );

    }

}


/* =========================================================
   API KEY STATUS
   ---------------------------------------------------------
   POST /api/viddra/account?action=key-status

   Hanya mengembalikan boolean.
   Tidak pernah mengembalikan API key.
========================================================= */

async function handleApiKeyStatus(
    req,
    res
) {

    const apiKey =
        getVidDraApiKey(
            req
        );


    return success(
        res,
        {

            ready:
                Boolean(
                    apiKey
                )

        }
    );

}


/* =========================================================
   METHOD
========================================================= */

export default async function handler(
    req,
    res
) {

    if (
        req.method !== "POST"
    ) {

        res.setHeader(
            "Allow",
            "POST"
        );


        return failure(
            res,
            405,
            "Method not allowed"
        );

    }


    try {

        /*
         * ---------------------------------------------------
         * 1. GEN-Z.AI AUTH
         * ---------------------------------------------------
         */

        const genzUser =
            await authenticateUser(
                req
            );


        /*
         * ---------------------------------------------------
         * 2. DETECT ACTION
         * ---------------------------------------------------
         *
         * Endpoint normal:
         *
         * POST /api/viddra/account
         *
         * Endpoint create key:
         *
         * POST /api/viddra/account?action=create-key
         *
         * Tidak membuat Serverless Function baru.
         * ---------------------------------------------------
         */

        const requestUrl =
            new URL(
                req.url ||
                    "/api/viddra/account",
                "http://localhost"
            );


        const action =
            String(
                requestUrl.searchParams.get(
                    "action"
                ) ||
                ""
            )
                .trim()
                .toLowerCase();


        /*
         * ---------------------------------------------------
         * 3. CREATE API KEY
         * ---------------------------------------------------
         */

        if (
            action ===
            "create-key"
        ) {

            return await handleCreateApiKey(
                req,
                res,
                genzUser
            );

        }

       /* ---------------------------------------------------
   API KEY STATUS
--------------------------------------------------- */

if (
    action ===
    "key-status"
) {

    return await handleApiKeyStatus(
        req,
        res
    );

}


        /*
         * ---------------------------------------------------
         * 4. READ REQUEST
         * ---------------------------------------------------
         *
         * Alur account lama dimulai di sini.
         * ---------------------------------------------------
         */

        const body =
            await readBody(
                req
            );


        const email =
            normalizeEmail(
                body?.email
            );


        const password =
            normalizePassword(
                body?.password
            );


        if (
            !email
        ) {

            return failure(
                res,
                400,
                "Email VidDra wajib diisi."
            );

        }


        if (
            !password
        ) {

            return failure(
                res,
                400,
                "Password VidDra wajib diisi."
            );

        }


        if (
            password.length < 8
        ) {

            return failure(
                res,
                400,
                "Password VidDra minimal 8 karakter."
            );

        }


        /*
         * ---------------------------------------------------
         * 5. REGISTER VIDDRA
         * ---------------------------------------------------
         */

        let registerResponse =
            null;


        try {

            registerResponse =
                await registerVidDra(
                    email,
                    password
                );

        } catch (error) {

            const statusCode =
                Number(
                    error?.status
                );


            const message =
                String(
                    error?.message ||
                    ""
                ).toLowerCase();


            const alreadyExists =
                statusCode === 409 ||
                message.includes(
                    "already"
                ) ||
                message.includes(
                    "exist"
                ) ||
                message.includes(
                    "registered"
                );


            if (
                alreadyExists
            ) {

                return failure(
                    res,
                    409,
                    "Email VidDra tersebut sudah terdaftar. Gunakan account VidDra yang sudah ada atau email lain yang memang Anda kontrol.",
                    {
                        account_exists:
                            true
                    }
                );

            }


            throw error;

        }


        /*
         * ---------------------------------------------------
         * 6. LOGIN VIDDRA
         * ---------------------------------------------------
         */

        const loginResponse =
            await loginVidDra(
                email,
                password
            );


        const vidDraToken =
            getVidDraToken(
                loginResponse
            );


        if (
            !vidDraToken
        ) {

            throw Object.assign(
                new Error(
                    "VidDra login berhasil tetapi token tidak ditemukan."
                ),
                {
                    status:
                        502
                }
            );

        }


        /*
         * ---------------------------------------------------
         * 7. BALANCE
         * ---------------------------------------------------
         */

        const balanceResponse =
            await getVidDraBalance(
                vidDraToken
            );


        const account =
            extractAccount(
                registerResponse,
                loginResponse
            );


        const balance =
            extractBalance(
                balanceResponse
            );


        /*
         * ---------------------------------------------------
         * 8. SAVE VIDDRA JWT
         * ---------------------------------------------------
         *
         * JWT TIDAK dikirim ke frontend.
         *
         * JWT dienkripsi terlebih dahulu oleh
         * createVidDraSessionCookie().
         *
         * Cookie:
         * - HttpOnly
         * - Secure
         * - SameSite=Lax
         * - Max-Age 24 jam
         *
         * Browser JavaScript tidak dapat membaca token ini.
         * ---------------------------------------------------
         */

        const sessionCookie =
            createVidDraSessionCookie(
                vidDraToken
            );


        res.setHeader(
            "Set-Cookie",
            sessionCookie
        );


        /*
         * ---------------------------------------------------
         * 9. SECURITY LOG
         * ---------------------------------------------------
         *
         * Jangan pernah log:
         * - VidDra JWT
         * - API Key
         * - password
         * ---------------------------------------------------
         */

        console.info(
            "[viddra] Account verified:",
            {

                genz_user_id:
                    genzUser.id,

                viddra_user_id:
                    account.id,

                email:
                    account.email,

                balance_usd:
                    balance.balance_usd,

                session:
                    "created"

            }
        );


        /*
         * ---------------------------------------------------
         * 10. RESPONSE
         * ---------------------------------------------------
         *
         * JWT sengaja TIDAK dimasukkan ke response.
         * ---------------------------------------------------
         */

        return success(
            res,
            {

                account,

                balance,

                authenticated:
                    true

            }
        );

    } catch (error) {

        console.error(
            "[viddra] Account error:",
            {

                message:
                    error?.message,

                status:
                    error?.status,

                code:
                    error?.code,

                data:
                    error?.data

            }
        );


        const statusCode =
            Number(
                error?.status
            );


        return failure(
            res,
            statusCode >= 400 &&
            statusCode < 600
                ? statusCode
                : 500,
            error?.message ||
            "Gagal menghubungkan account VidDra."
        );

    }

}
