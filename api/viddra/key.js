/* =========================================================
   GEN-Z.AI
   VIDDRA API KEY CREATOR
   ---------------------------------------------------------
   File:
   api/viddra/key.js

   Fungsi:
   - Authenticate user GEN-Z.AI melalui Supabase
   - Membaca VidDra JWT dari HttpOnly session
   - Membuat API Key VidDra
   - Tidak menyimpan plaintext API Key ke database
   - Tidak menggunakan VIDDRA_API_KEY untuk membuat key
   - Tidak menyentuh KIE.AI
   - Tidak menyentuh generation_history
========================================================= */

import {
    getVidDraSession
} from "./session.js";


/* =========================================================
   CONFIG
========================================================= */

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
            success:
                true,

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
            success:
                false,

            error:
                message,

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
   CREATE VIDDRA API KEY
========================================================= */

async function createVidDraApiKey(
    token
) {

    if (
        !token
    ) {

        throw Object.assign(
            new Error(
                "VidDra session is missing"
            ),
            {
                status:
                    401
            }
        );

    }


    const response =
        await fetch(
            `${VIDDRA_API_BASE}/keys`,
            {

                method:
                    "POST",

                headers: {

                    Authorization:
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json",

                    Accept:
                        "application/json"

                },

                body:
                    JSON.stringify(
                        {}
                    )

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
                    data.error ||
                    data.error_description ||
                    `VidDra API key creation failed with status ${response.status}`
                )
                : `VidDra API key creation failed with status ${response.status}`;


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
   NORMALIZE API KEY RESPONSE
========================================================= */

function normalizeKeyResponse(
    data
) {

    const key =
        String(
            data?.key ||
            data?.data?.key ||
            ""
        ).trim();


    const id =
        data?.id ||
        data?.data?.id ||
        null;


    const keyPrefix =
        data?.key_prefix ||
        data?.data?.key_prefix ||
        (
            key
                ? key.slice(
                    0,
                    12
                )
                : null
        );


    const name =
        data?.name ||
        data?.data?.name ||
        "default";


    const status =
        data?.status ||
        data?.data?.status ||
        null;


    const monthlyLimitUsd =
        data?.monthly_limit_usd ??
        data?.data?.monthly_limit_usd ??
        null;


    const createdAt =
        data?.created_at ||
        data?.data?.created_at ||
        null;


    return {

        key,

        id,

        key_prefix:
            keyPrefix,

        name,

        status,

        monthly_limit_usd:
            monthlyLimitUsd,

        created_at:
            createdAt

    };

}


/* =========================================================
   METHOD
========================================================= */

export default async function handler(
    req,
    res
) {

    if (
        req.method !==
        "POST"
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

        /* -------------------------------------------------
           1. GEN-Z.AI AUTH
        ------------------------------------------------- */

        const genzUser =
            await authenticateUser(
                req
            );


        /* -------------------------------------------------
           2. VIDDRA SESSION
        ------------------------------------------------- */

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
                "Session VidDra tidak ditemukan. Login account VidDra terlebih dahulu."
            );

        }


        /* -------------------------------------------------
           3. CREATE KEY
        ------------------------------------------------- */

        const response =
            await createVidDraApiKey(
                vidDraToken
            );


        const keyData =
            normalizeKeyResponse(
                response
            );


        if (
            !keyData.key
        ) {

            console.error(
                "[viddra] API key creation returned no key:",
                {
                    genz_user_id:
                        genzUser.id,

                    response:
                        response
                }
            );


            return failure(
                res,
                502,
                "VidDra berhasil merespons tetapi API Key tidak ditemukan pada response."
            );

        }


        /* -------------------------------------------------
           IMPORTANT SECURITY RULE
           -------------------------------------------------

           Jangan log plaintext API key.

           Yang boleh masuk log hanya metadata.
        ------------------------------------------------- */

        console.info(
            "[viddra] API key created:",
            {

                genz_user_id:
                    genzUser.id,

                key_id:
                    keyData.id,

                key_prefix:
                    keyData.key_prefix,

                name:
                    keyData.name,

                status:
                    keyData.status,

                created_at:
                    keyData.created_at

            }
        );


        /* -------------------------------------------------
           4. RETURN ONCE
           -------------------------------------------------

           Plaintext key hanya dikembalikan sebagai hasil
           creation request.

           Tidak disimpan ke Supabase.
           Tidak disimpan ke cookie.
           Tidak disimpan ke localStorage oleh backend.
        ------------------------------------------------- */

        return success(
            res,
            {

                key:
                    keyData.key,

                id:
                    keyData.id,

                key_prefix:
                    keyData.key_prefix,

                name:
                    keyData.name,

                status:
                    keyData.status,

                monthly_limit_usd:
                    keyData.monthly_limit_usd,

                created_at:
                    keyData.created_at,

                one_time:
                    true

            }
        );

    } catch (error) {

        console.error(
            "[viddra] API key error:",
            {

                message:
                    error?.message,

                status:
                    error?.status,

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
            "Gagal membuat API Key VidDra."
        );

    }

}
