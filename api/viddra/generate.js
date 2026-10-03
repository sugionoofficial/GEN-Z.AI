/* =========================================================
   GEN-Z.AI
   VIDDRA GENERATE API
   ---------------------------------------------------------
   File:
   api/viddra/generate.js

   Fungsi:
   - Authenticate user melalui Supabase session
   - Menerima prompt dari VidDra Generate
   - Submit task ke VidDra
   - Menggunakan Hailuo 2.3
   - Duration 6
   - Resolution 1080P
   - Menyimpan task ke generation_history
   - TIDAK menggunakan GEN-Z.AI credit deduction
   - TIDAK menyentuh KIE.AI
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


const VIDDRA_API_KEY =
    String(
        process.env.VIDDRA_API_KEY || ""
    ).trim();


const VIDDRA_ENDPOINT =
    "https://api.viddra.com/v1/video/generations";


const VIDDRA_MODEL =
    "hailuo-2.3";


const VIDDRA_PROVIDER_ID =
    "viddra";


const VIDDRA_PROVIDER_NAME =
    "VidDra";


const VIDDRA_DURATION =
    6;


const VIDDRA_RESOLUTION =
    "1080P";


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
        "no-store"
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

        throw new Error(
            "SUPABASE_URL is not configured"
        );

    }


    if (
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is not configured"
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


    let data = null;


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

        const error =
            new Error(
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
                    : `Supabase request failed with status ${response.status}`
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
   AUTHENTICATE USER
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
                status: 401
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
                status: 401
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
                status: 401
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
                "Invalid or expired session"
            ),
            {
                status: 401
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


    let body = "";


    for await (
        const chunk of req
    ) {

        body += chunk;

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
                status: 400
            }
        );

    }

}


/* =========================================================
   PROMPT
========================================================= */

function normalizePrompt(
    value
) {

    return String(
        value ?? ""
    ).trim();

}


/* =========================================================
   VIDDRA REQUEST
========================================================= */

async function createVidDraGeneration(
    prompt
) {

    if (
        !VIDDRA_API_KEY
    ) {

        throw Object.assign(
            new Error(
                "VIDDRA_API_KEY is not configured"
            ),
            {
                status: 500,
                code:
                    "VIDDRA_API_KEY_MISSING"
            }
        );

    }


    const payload = {

        model:
            VIDDRA_MODEL,

        prompt,

        duration:
            VIDDRA_DURATION,

        resolution:
            VIDDRA_RESOLUTION

    };


    const response =
        await fetch(
            VIDDRA_ENDPOINT,
            {

                method:
                    "POST",

                headers: {

                    Authorization:
                        `Bearer ${VIDDRA_API_KEY}`,

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        payload
                    )

            }
        );


    const text =
        await response.text();


    let data = null;


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


    return {

        status:
            response.status,

        data

    };

}


/* =========================================================
   EXTRACT VIDDRA GENERATION ID
========================================================= */

function getVidDraGenerationId(
    data
) {

    const candidates = [

        data?.id,

        data?.generation_id,

        data?.generationId,

        data?.data?.id,

        data?.data?.generation_id,

        data?.data?.generationId

    ];


    for (
        const value
        of candidates
    ) {

        const id =
            String(
                value ?? ""
            ).trim();


        if (
            id
        ) {

            return id;

        }

    }


    return "";

}


/* =========================================================
   CREATE HISTORY
========================================================= */

async function createGenerationHistory({
    user,
    prompt,
    taskId
}) {

    if (
        !user?.id ||
        !taskId
    ) {

        return null;

    }


    const payload = {

        user_id:
            user.id,

        user_email:
            user.email ||
            null,

        provider_id:
            VIDDRA_PROVIDER_ID,

        provider_name:
            VIDDRA_PROVIDER_NAME,

        model_id:
            VIDDRA_MODEL,

        model_name:
            "Hailuo 2.3",

        prompt:
            prompt,

        image_reference_url:
            null,

        video_reference_url:
            null,

        ratio:
            null,

        duration:
            VIDDRA_DURATION,

        resolution:
            VIDDRA_RESOLUTION,

        status:
            "processing",

        task_id:
            taskId,

        result_url:
            null,

        error_message:
            null,

        /*
         * VidDra menggunakan saldo/provider sendiri.
         *
         * Karena GEN-Z.AI tidak melakukan deduction
         * untuk VidDra, credit_cost disimpan 0.
         */
        credit_cost:
            0

    };


    try {

        await supabaseRequest(
            "/rest/v1/generation_history",
            {

                method:
                    "POST",

                headers: {

                    Prefer:
                        "return=minimal"

                },

                body:
                    JSON.stringify([
                        payload
                    ])

            }
        );


        console.info(
            "[viddra] Generation history created:",
            {
                user_id:
                    user.id,

                task_id:
                    taskId,

                model_id:
                    VIDDRA_MODEL

            }
        );


        return payload;

    } catch (error) {

        /*
         * Task VidDra sudah berhasil dibuat.
         *
         * Karena task provider sudah ada,
         * kegagalan History tidak membatalkan task.
         */
        console.error(
            "[viddra] Failed to create generation history:",
            {
                message:
                    error?.message,

                status:
                    error?.status,

                data:
                    error?.data,

                task_id:
                    taskId
            }
        );


        return null;

    }

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

        const user =
            await authenticateUser(
                req
            );


        const body =
            await readBody(
                req
            );


        const prompt =
            normalizePrompt(
                body?.prompt
            );


        if (
            !prompt
        ) {

            return failure(
                res,
                400,
                "Prompt wajib diisi."
            );

        }


        /*
         * VidDra contract:
         *
         * model      = hailuo-2.3
         * duration   = 6
         * resolution = 1080P
         *
         * Nilai ini sengaja tidak diambil
         * dari browser agar request tidak dapat
         * mengubah kontrak server.
         */
        const providerResponse =
            await createVidDraGeneration(
                prompt
            );


        const generationId =
            getVidDraGenerationId(
                providerResponse.data
            );


        if (
            !generationId
        ) {

            console.error(
                "[viddra] Provider response does not contain generation id:",
                providerResponse.data
            );


            return failure(
                res,
                502,
                "VidDra tidak mengembalikan generation ID.",
                {
                    provider_response:
                        providerResponse.data
                }
            );

        }


        await createGenerationHistory({

            user,

            prompt,

            taskId:
                generationId

        });


        return success(
            res,
            {

                id:
                    generationId,

                task_id:
                    generationId,

                status:
                    providerResponse.data?.status ||
                    providerResponse.data?.data?.status ||
                    "queued",

                provider:
                    VIDDRA_PROVIDER_NAME,

                model:
                    VIDDRA_MODEL,

                duration:
                    VIDDRA_DURATION,

                resolution:
                    VIDDRA_RESOLUTION,

                hold_usd:
                    providerResponse.data?.hold_usd ??
                    providerResponse.data?.data?.hold_usd ??
                    null

            }
        );

    } catch (error) {

        console.error(
            "[viddra] Generate error:",
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


        return failure(
            res,
            Number(
                error?.status
            ) >= 400 &&
            Number(
                error?.status
            ) < 600
                ? Number(
                    error.status
                )
                : 500,
            error?.message ||
            "Gagal membuat generation VidDra."
        );

    }

}
