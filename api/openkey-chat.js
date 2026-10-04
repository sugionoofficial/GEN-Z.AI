/* =========================================================
   GEN-Z.AI
   OPENKEY CHAT API
   ---------------------------------------------------------
   File:
   api/openkey-chat.js

   Endpoint:
   POST /api/openkey-chat

   Fungsi:
   - Authenticate Supabase user
   - Load encrypted OpenKey credential
   - Decrypt OpenKey API key server-side
   - OpenKey chat completion
   - OpenKey streaming
   - Tool calling transport
   - SSE response

   TIDAK DIGUNAKAN UNTUK:
   - KIE
   - Seedance
   - Grok video
   - Generation task
   - Generation history
   - Generation credits
   - 480p / 720p / 1080p credit
========================================================= */

import crypto from "crypto";

import openKeyChat
    from "../provider/openkey/chat.js";

import openKeyStream
    from "../provider/openkey/stream.js";


/* =========================================================
   VERSION
========================================================= */

const OPENKEY_CHAT_API_VERSION =
    "2026-10-03-openkey-chat-api-v1";


/* =========================================================
   ENVIRONMENT
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


const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    String(
        process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || ""
    ).trim();


const OPENKEY_PROVIDER_ID =
    "openkey";


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


/* =========================================================
   ERROR
========================================================= */

function createError(
    message,
    status = 500,
    code = null
) {

    const error =
        new Error(
            message
        );


    error.status =
        status;


    if (
        code
    ) {

        error.code =
            code;

    }


    return error;

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

        throw createError(
            "SUPABASE_URL belum dikonfigurasi.",
            500,
            "SUPABASE_URL_MISSING"
        );

    }


    if (
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw createError(
            "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.",
            500,
            "SUPABASE_SERVICE_ROLE_KEY_MISSING"
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

        let message =
            `Supabase request failed with status ${response.status}`;


        if (
            data &&
            typeof data ===
                "object"
        ) {

            message =
                data.message ||
                data.error_description ||
                data.error ||
                message;

        }


        const error =
            createError(
                message,
                response.status,
                "SUPABASE_REQUEST_FAILED"
            );


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

        throw createError(
            "Authorization header is required",
            401,
            "AUTHORIZATION_REQUIRED"
        );

    }


    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );


    if (
        !match
    ) {

        throw createError(
            "Invalid Authorization header",
            401,
            "INVALID_AUTHORIZATION"
        );

    }


    const accessToken =
        match[1].trim();


    if (
        !accessToken
    ) {

        throw createError(
            "Access token is missing",
            401,
            "ACCESS_TOKEN_MISSING"
        );

    }


    /*
     * Penting:
     *
     * Token user dikirim hanya untuk verifikasi
     * session Supabase.
     *
     * API key OpenKey tetap server-side.
     */

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

        throw createError(
            "Invalid or expired session",
            401,
            "INVALID_SESSION"
        );

    }


    return user;

}


/* =========================================================
   READ REQUEST BODY
========================================================= */

async function readBody(
    req
) {

    /*
     * Vercel biasanya sudah melakukan parsing
     * JSON body.
     */

    if (
        req.body &&
        typeof req.body ===
            "object"
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

        throw createError(
            "Request body must be valid JSON",
            400,
            "INVALID_JSON"
        );

    }

}


/* =========================================================
   ENCRYPTION KEY
========================================================= */

function getEncryptionKey() {

    if (
        !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    ) {

        throw createError(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi.",
            500,
            "ENCRYPTION_KEY_MISSING"
        );

    }


    /*
     * Format utama:
     *
     * 64 hexadecimal characters
     * = 32 bytes
     */

    if (
        /^[0-9a-fA-F]{64}$/.test(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY
        )
    ) {

        return Buffer.from(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
            "hex"
        );

    }


    /*
     * Compatibility:
     *
     * 32-byte base64 key
     */

    try {

        const buffer =
            Buffer.from(
                PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
                "base64"
            );


        if (
            buffer.length ===
            32
        ) {

            return buffer;

        }

    } catch {

        /*
         * fallback below
         */

    }


    /*
     * Compatibility fallback:
     *
     * SHA-256
     */

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY
        )
        .digest();

}


/* =========================================================
   BUFFER DECODER
========================================================= */

function decodeBuffer(
    value
) {

    const text =
        String(
            value || ""
        ).trim();


    if (
        !text
    ) {

        return null;

    }


    /*
     * HEX
     */

    if (
        /^[0-9a-fA-F]+$/.test(
            text
        ) &&
        text.length % 2 ===
            0
    ) {

        try {

            const buffer =
                Buffer.from(
                    text,
                    "hex"
                );


            if (
                buffer.length > 0
            ) {

                return buffer;

            }

        } catch {

            /*
             * Continue to base64.
             */

        }

    }


    /*
     * BASE64
     */

    try {

        const buffer =
            Buffer.from(
                text,
                "base64"
            );


        if (
            buffer.length > 0
        ) {

            return buffer;

        }

    } catch {

        /*
         * invalid
         */

    }


    return null;

}


/* =========================================================
   AES-256-GCM DECRYPTION
========================================================= */

function decryptAesGcm(
    iv,
    authTag,
    ciphertext
) {

    const key =
        getEncryptionKey();


    if (
        key.length !==
        32
    ) {

        throw createError(
            "Encryption key must be 32 bytes",
            500,
            "INVALID_ENCRYPTION_KEY"
        );

    }


    const decipher =
        crypto.createDecipheriv(
            "aes-256-gcm",
            key,
            iv
        );


    decipher.setAuthTag(
        authTag
    );


    const decrypted =
        Buffer.concat([

            decipher.update(
                ciphertext
            ),

            decipher.final()

        ]);


    return decrypted.toString(
        "utf8"
    );

}


/* =========================================================
   LOAD PROVIDER API KEY
========================================================= */

async function loadOpenKeyApiKey() {

    const params =
        new URLSearchParams();


    params.set(
        "select",
        [
            "id",
            "provider_id",
            "api_key_ciphertext",
            "api_key_iv",
            "api_key_tag"
        ].join(",")
    );


    params.set(
        "provider_id",
        `eq.${OPENKEY_PROVIDER_ID}`
    );


    params.set(
        "limit",
        "1"
    );


    const credentials =
        await supabaseRequest(
            `/rest/v1/provider_credentials?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );


    if (
        !Array.isArray(
            credentials
        ) ||
        !credentials.length
    ) {

        throw createError(
            "Credential OpenKey belum tersimpan.",
            500,
            "OPENKEY_CREDENTIAL_NOT_FOUND"
        );

    }


    const credential =
        credentials[0];


    if (
        !credential ||
        typeof credential !==
            "object"
    ) {

        throw createError(
            "Credential OpenKey tidak valid.",
            500,
            "OPENKEY_CREDENTIAL_INVALID"
        );

    }


    const ciphertext =
        String(
            credential.api_key_ciphertext ||
            ""
        ).trim();


    const iv =
        String(
            credential.api_key_iv ||
            ""
        ).trim();


    const authTag =
        String(
            credential.api_key_tag ||
            ""
        ).trim();


    if (
        !ciphertext
    ) {

        throw createError(
            "OpenKey credential ciphertext kosong.",
            500,
            "OPENKEY_CREDENTIAL_CIPHERTEXT_EMPTY"
        );

    }


    if (
        !iv
    ) {

        throw createError(
            "OpenKey credential IV kosong.",
            500,
            "OPENKEY_CREDENTIAL_IV_EMPTY"
        );

    }


    if (
        !authTag
    ) {

        throw createError(
            "OpenKey credential authentication tag kosong.",
            500,
            "OPENKEY_CREDENTIAL_TAG_EMPTY"
        );

    }


    const ivBuffer =
        decodeBuffer(
            iv
        );


    const authTagBuffer =
        decodeBuffer(
            authTag
        );


    const ciphertextBuffer =
        decodeBuffer(
            ciphertext
        );


    if (
        !ivBuffer ||
        !authTagBuffer ||
        !ciphertextBuffer
    ) {

        throw createError(
            "Format encrypted OpenKey credential tidak valid.",
            500,
            "OPENKEY_CREDENTIAL_FORMAT_INVALID"
        );

    }


    try {

        const apiKey =
            decryptAesGcm(
                ivBuffer,
                authTagBuffer,
                ciphertextBuffer
            );


        if (
            !apiKey.trim()
        ) {

            throw new Error(
                "Decrypted OpenKey API key kosong."
            );

        }


        return apiKey.trim();

    } catch (error) {

        console.error(
            "[openkey-chat] Credential decryption failed:",
            error
        );


        throw createError(
            "Gagal membuka credential OpenKey.",
            500,
            "OPENKEY_CREDENTIAL_DECRYPT_FAILED"
        );

    }

}


/* =========================================================
   VALIDATE MESSAGES
========================================================= */

function validateMessages(
    messages
) {

    if (
        !Array.isArray(messages)
    ) {

        throw createError(
            "messages harus berupa array.",
            400,
            "INVALID_MESSAGES"
        );

    }


    if (
        messages.length ===
        0
    ) {

        throw createError(
            "messages tidak boleh kosong.",
            400,
            "EMPTY_MESSAGES"
        );

    }


    if (
        messages.length >
        200
    ) {

        throw createError(
            "Jumlah messages terlalu banyak.",
            400,
            "TOO_MANY_MESSAGES"
        );

    }


    for (
        const message
        of messages
    ) {

        if (
            !message ||
            typeof message !==
                "object"
        ) {

            throw createError(
                "Format message tidak valid.",
                400,
                "INVALID_MESSAGE"
            );

        }


        const role =
            String(
                message.role ||
                ""
            ).trim();


        if (
            !role
        ) {

            throw createError(
                "Message role wajib diisi.",
                400,
                "MESSAGE_ROLE_MISSING"
            );

        }


        if (
            ![
                "system",
                "user",
                "assistant",
                "tool"
            ].includes(
                role
            )
        ) {

            throw createError(
                `Message role tidak didukung: ${role}`,
                400,
                "MESSAGE_ROLE_INVALID"
            );

        }

    }

}


/* =========================================================
   VALIDATE MODEL
========================================================= */

function normalizeModel(
    value
) {

    const model =
        String(
            value ||
            "auto"
        ).trim();


    if (
        !model
    ) {

        return "auto";

    }


    if (
        model.length >
        200
    ) {

        throw createError(
            "Model ID terlalu panjang.",
            400,
            "MODEL_ID_TOO_LONG"
        );

    }


    return model;

}


/* =========================================================
   VALIDATE TOOLS
========================================================= */

function validateTools(
    tools
) {

    if (
        tools === undefined
    ) {

        return undefined;

    }


    if (
        !Array.isArray(tools)
    ) {

        throw createError(
            "tools harus berupa array.",
            400,
            "INVALID_TOOLS"
        );

    }


    if (
        tools.length >
        128
    ) {

        throw createError(
            "Jumlah tools terlalu banyak.",
            400,
            "TOO_MANY_TOOLS"
        );

    }


    return tools;

}


/* =========================================================
   BUILD CHAT OPTIONS
========================================================= */

function buildChatOptions(
    body,
    apiKey
) {

    const {

        model,

        messages,

        temperature,

        max_tokens,

        max_completion_tokens,

        top_p,

        tools,

        tool_choice,

        response_format,

        stop,

        presence_penalty,

        frequency_penalty,

        seed,

        user,

        stream = false,

        ...extra

    } = body;


    validateMessages(
        messages
    );


    const normalizedTools =
        validateTools(
            tools
        );


    return {

        apiKey,

        model:
            normalizeModel(
                model
            ),

        messages,

        temperature,

        max_tokens,

        max_completion_tokens,

        top_p,

        tools:
            normalizedTools,

        tool_choice,

        response_format,

        stop,

        presence_penalty,

        frequency_penalty,

        seed,

        user,

        stream:
            Boolean(
                stream
            ),

        ...extra

    };

}


/* =========================================================
   SSE HEADERS
========================================================= */

function setSSEHeaders(
    res
) {

    res.statusCode =
        200;


    res.setHeader(
        "Content-Type",
        "text/event-stream; charset=utf-8"
    );


    res.setHeader(
        "Cache-Control",
        "no-cache, no-transform"
    );


    res.setHeader(
        "Connection",
        "keep-alive"
    );


    res.setHeader(
        "X-Accel-Buffering",
        "no"
    );


    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

}


/* =========================================================
   SSE SEND
========================================================= */

function sendSSE(
    res,
    event,
    data
) {

    const payload =
        JSON.stringify(
            data
        );


    res.write(
        `event: ${event}\n`
    );


    const lines =
        payload.split(
            "\n"
        );


    for (
        const line
        of lines
    ) {

        res.write(
            `data: ${line}\n`
        );

    }


    res.write(
        "\n"
    );

}


/* =========================================================
   STREAM RESPONSE
========================================================= */

async function handleStream(
    req,
    res,
    body,
    apiKey
) {

    setSSEHeaders(
        res
    );


    /*
     * Connection can be closed by browser.
     */

    let clientClosed =
        false;


    const markClosed =
        () => {

            clientClosed =
                true;

        };


    req.on?.(
        "close",
        markClosed
    );


    try {

        sendSSE(
            res,
            "open",
            {

                success:
                    true,

                version:
                    OPENKEY_CHAT_API_VERSION

            }
        );


        const options =
            buildChatOptions(
                {
                    ...body,
                    stream:
                        true
                },
                apiKey
            );


        for await (
            const chunk
            of openKeyStream.streamChat(
                options
            )
        ) {

            if (
                clientClosed
            ) {

                break;

            }


            /*
             * IMPORTANT:
             *
             * content =
             * user-visible answer
             *
             * reasoning_content =
             * separate diagnostic/protocol data
             *
             * Jangan gabungkan keduanya.
             */

            sendSSE(
                res,
                "chunk",
                {

                    content:
                        chunk.content ||
                        "",

                    reasoning_content:
                        chunk.reasoning_content ||
                        "",

                    tool_calls:
                        chunk.tool_calls ||
                        [],

                    finish_reason:
                        chunk.finish_reason ||
                        null,

                    model:
                        chunk.model ||
                        null,

                    usage:
                        chunk.usage ||
                        null

                }
            );

        }


        if (
            !clientClosed
        ) {

            sendSSE(
                res,
                "done",
                {

                    success:
                        true,

                    done:
                        true

                }
            );

        }

    } catch (error) {

        console.error(
            "[openkey-chat] Stream error:",
            error
        );


        if (
            !clientClosed
        ) {

            sendSSE(
                res,
                "error",
                {

                    success:
                        false,

                    error:
                        error.message ||
                        "OpenKey stream failed",

                    code:
                        error.code ||
                        "OPENKEY_STREAM_FAILED"

                }
            );

        }

    } finally {

        if (
            !res.writableEnded
        ) {

            res.end();

        }

    }

}


/* =========================================================
   NON STREAM RESPONSE
========================================================= */

async function handleNonStream(
    res,
    body,
    apiKey
) {

    const options =
        buildChatOptions(
            {
                ...body,
                stream:
                    false
            },
            apiKey
        );


    const result =
        await openKeyChat.chat(
            options
        );


    return json(
        res,
        200,
        {

            success:
                true,

            version:
                OPENKEY_CHAT_API_VERSION,

            ...result

        }
    );

}


/* =========================================================
   METHOD / CORS
========================================================= */

function setHeaders(
    res
) {

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
        "POST, OPTIONS"
    );


    res.setHeader(
        "Cache-Control",
        "no-store"
    );

}

/* =========================================================
   VISION CREDIT CONFIG
   ---------------------------------------------------------
   Vision:
   - 1 process = 1 credit
   - deduction dilakukan server-side
   - refund hanya jika proses Vision gagal
========================================================= */

const VISION_CREDIT_COST = 1;


/* =========================================================
   GET VISION CREDITS
========================================================= */

async function getVisionCredits(
    userId
) {

    if (!userId) {

        throw createError(
            "User ID tidak tersedia.",
            401,
            "VISION_USER_ID_MISSING"
        );

    }


    const params =
        new URLSearchParams();


    params.set(
        "select",
        "credits"
    );


    params.set(
        "id",
        `eq.${userId}`
    );


    params.set(
        "limit",
        "1"
    );


    const rows =
        await supabaseRequest(
            `/rest/v1/profiles?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );


    if (
        !Array.isArray(rows) ||
        !rows.length
    ) {

        throw createError(
            "Profile pengguna tidak ditemukan.",
            404,
            "VISION_PROFILE_NOT_FOUND"
        );

    }


    const credits =
        Number(
            rows[0]?.credits
        );


    if (
        !Number.isFinite(credits)
    ) {

        throw createError(
            "Saldo credit pengguna tidak valid.",
            500,
            "VISION_CREDIT_INVALID"
        );

    }


    return credits;

}


/* =========================================================
   DEDUCT VISION CREDIT
========================================================= */

async function deductVisionCredit(
    userId
) {

    const credits =
        await getVisionCredits(
            userId
        );


    if (
        credits <
        VISION_CREDIT_COST
    ) {

        throw createError(
            "Credit tidak mencukupi untuk Vision.",
            402,
            "VISION_INSUFFICIENT_CREDIT"
        );

    }


    const data =
        await supabaseRequest(
            "/rest/v1/rpc/deduct_generate_credits",
            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        p_user_id:
                            userId,

                        p_amount:
                            VISION_CREDIT_COST

                    })

            }
        );


    const newCredits =
        Number(
            data
        );


    if (
        Number.isFinite(
            newCredits
        )
    ) {

        return {

            deducted:
                true,

            cost:
                VISION_CREDIT_COST,

            credits:
                newCredits

        };

    }


    if (
        data &&
        typeof data ===
            "object"
    ) {

        const candidates = [

            data.credits,

            data.new_credits,

            data.remaining_credits

        ];


        for (
            const candidate
            of candidates
        ) {

            const numeric =
                Number(
                    candidate
                );


            if (
                Number.isFinite(
                    numeric
                )
            ) {

                return {

                    deducted:
                        true,

                    cost:
                        VISION_CREDIT_COST,

                    credits:
                        numeric

                };

            }

        }

    }


    return {

        deducted:
            true,

        cost:
            VISION_CREDIT_COST,

        credits:
            null

    };

}


/* =========================================================
   REFUND VISION CREDIT
========================================================= */

async function refundVisionCredit(
    userId
) {

    const data =
        await supabaseRequest(
            "/rest/v1/rpc/refund_generate_credits",
            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        p_user_id:
                            userId,

                        p_amount:
                            VISION_CREDIT_COST

                    })

            }
        );


    const newCredits =
        Number(
            data
        );


    if (
        Number.isFinite(
            newCredits
        )
    ) {

        return {

            refunded:
                true,

            amount:
                VISION_CREDIT_COST,

            credits:
                newCredits

        };

    }


    if (
        data &&
        typeof data ===
            "object"
    ) {

        const candidates = [

            data.credits,

            data.new_credits,

            data.remaining_credits

        ];


        for (
            const candidate
            of candidates
        ) {

            const numeric =
                Number(
                    candidate
                );


            if (
                Number.isFinite(
                    numeric
                )
            ) {

                return {

                    refunded:
                        true,

                    amount:
                        VISION_CREDIT_COST,

                    credits:
                        numeric

                };

            }

        }

    }


    return {

        refunded:
            true,

        amount:
            VISION_CREDIT_COST,

        credits:
            null

    };

}


/* =========================================================
   VISION CREDIT OPERATION
========================================================= */

async function handleVisionCreditOperation(
    res,
    user,
    operation
) {

    if (
        operation ===
        "vision_credit_check"
    ) {

        const credits =
            await getVisionCredits(
                user.id
            );


        return json(
            res,
            200,
            {

                success:
                    true,

                operation,

                cost:
                    VISION_CREDIT_COST,

                sufficient:
                    credits >=
                    VISION_CREDIT_COST,

                credits

            }
        );

    }


    if (
        operation ===
        "vision_credit_deduct"
    ) {

        const result =
            await deductVisionCredit(
                user.id
            );


        return json(
            res,
            200,
            {

                success:
                    true,

                operation,

                ...result

            }
        );

    }


    if (
        operation ===
        "vision_credit_refund"
    ) {

        const result =
            await refundVisionCredit(
                user.id
            );


        return json(
            res,
            200,
            {

                success:
                    true,

                operation,

                ...result

            }
        );

    }


    return null;

}

/* =========================================================
   VISION HISTORY
   ---------------------------------------------------------
   Vision menggunakan generation_history yang sama
   dengan Generate.

   Identitas user SELALU berasal dari session Supabase.
   Browser tidak dipercaya untuk user_id / user_email.

   Credit:
   - success = 1
   - failed = 1
========================================================= */

function normalizeVisionHistoryStatus(
    value
) {

    const status =
        String(
            value || ""
        )
            .trim()
            .toLowerCase();


    if (
        status === "success"
    ) {

        return "success";

    }


    if (
        status === "failed"
    ) {

        return "failed";

    }


    throw createError(
        "Status Vision history tidak valid.",
        400,
        "VISION_HISTORY_STATUS_INVALID"
    );

}


function normalizeVisionHistoryString(
    value,
    fallback = ""
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;

    }


    if (
        typeof value === "string"
    ) {

        return value.trim();

    }


    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return String(
            value
        );

    }


    return fallback;

}


function validateVisionTaskId(
    value
) {

    const taskId =
        normalizeVisionHistoryString(
            value
        );


    if (
        !taskId
    ) {

        throw createError(
            "Vision task_id wajib diisi.",
            400,
            "VISION_HISTORY_TASK_ID_MISSING"
        );

    }


    if (
        !taskId.startsWith(
            "vision-"
        )
    ) {

        throw createError(
            "Vision task_id tidak valid.",
            400,
            "VISION_HISTORY_TASK_ID_INVALID"
        );

    }


    if (
        taskId.length >
        200
    ) {

        throw createError(
            "Vision task_id terlalu panjang.",
            400,
            "VISION_HISTORY_TASK_ID_TOO_LONG"
        );

    }


    return taskId;

}


async function saveVisionHistory(
    user,
    record = {}
) {

    if (
        !user ||
        !user.id
    ) {

        throw createError(
            "Authenticated user tidak tersedia.",
            401,
            "VISION_HISTORY_USER_MISSING"
        );

    }


    if (
        !record ||
        typeof record !== "object" ||
        Array.isArray(record)
    ) {

        throw createError(
            "Vision history record tidak valid.",
            400,
            "VISION_HISTORY_RECORD_INVALID"
        );

    }


    const status =
        normalizeVisionHistoryStatus(
            record.status
        );


    const taskId =
        validateVisionTaskId(
            record.task_id
        );


    const modelId =
        normalizeVisionHistoryString(
            record.model_id
        );


    const modelName =
        normalizeVisionHistoryString(
            record.model_name
        );


    const prompt =
        normalizeVisionHistoryString(
            record.prompt
        );


    if (
        !modelId
    ) {

        throw createError(
            "Vision model_id wajib diisi.",
            400,
            "VISION_HISTORY_MODEL_ID_MISSING"
        );

    }


    if (
        !modelName
    ) {

        throw createError(
            "Vision model_name wajib diisi.",
            400,
            "VISION_HISTORY_MODEL_NAME_MISSING"
        );

    }


    /*
     * Provider dan credit TIDAK dipercayakan
     * kepada browser.
     */

    const historyRecord = {

        user_id:
            user.id,

        user_email:
            normalizeVisionHistoryString(
                user.email
            ) || null,

        provider_id:
            OPENKEY_PROVIDER_ID,

        provider_name:
            "OpenKey",

        model_id:
            modelId,

        model_name:
            modelName,

        prompt:
            prompt || null,

        image_reference_url:
            normalizeVisionHistoryString(
                record.image_reference_url
            ) || null,

        video_reference_url:
            null,

        ratio:
            normalizeVisionHistoryString(
                record.ratio
            ) || null,

        duration:
            record.duration ??
            null,

        resolution:
            normalizeVisionHistoryString(
                record.resolution
            ) || null,

        status:
            status,

        task_id:
            taskId,

        result_url:
            normalizeVisionHistoryString(
                record.result_url
            ) || null,

        error_message:
            normalizeVisionHistoryString(
                record.error_message
            ) || null,

        credit_cost:
            VISION_CREDIT_COST

    };


    const inserted =
        await supabaseRequest(
            "/rest/v1/generation_history",
            {

                method:
                    "POST",

                headers: {

                    Prefer:
                        "return=representation"

                },

                body:
                    JSON.stringify(
                        historyRecord
                    )

            }
        );


    const history =
        Array.isArray(
            inserted
        )
            ? inserted[0] ||
              null
            : inserted;


    if (
        !history
    ) {

        throw createError(
            "Vision history gagal disimpan.",
            500,
            "VISION_HISTORY_SAVE_FAILED"
        );

    }


    return history;

}


async function handleVisionHistoryOperation(
    res,
    user,
    operation,
    body
) {

    if (
        operation !==
        "vision_history_save"
    ) {

        return null;

    }


    const history =
        await saveVisionHistory(
            user,
            body.record
        );


    return json(
        res,
        200,
        {

            success:
                true,

            operation:

                "vision_history_save",

            history

        }
    );

}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
    req,
    res
) {

    setHeaders(
        res
    );


    /*
     * OPTIONS
     */

    if (
        req.method ===
        "OPTIONS"
    ) {

        return res
            .status(204)
            .end();

    }


    /*
     * METHOD
     */

    if (
        req.method !==
        "POST"
    ) {

        return json(
            res,
            405,
            {

                success:
                    false,

                error:
                    "Method tidak diizinkan.",

                code:
                    "METHOD_NOT_ALLOWED"

            }
        );

    }


    /*
     * ENVIRONMENT
     */

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return json(
            res,
            500,
            {

                success:
                    false,

                error:
                    "Supabase server configuration belum lengkap.",

                code:
                    "SUPABASE_CONFIG_MISSING"

            }
        );

    }

    /*
     * AUTHENTICATION
     */

    let authenticatedUser;


try {

    authenticatedUser =
        await authenticateUser(
            req
        );

} catch (error) {

        console.error(
            "[openkey-chat] Authentication failed:",
            error.message
        );


        return json(
            res,
            error.status ||
                401,
            {

                success:
                    false,

                error:
                    error.message ||
                    "Authentication failed",

                code:
                    error.code ||
                    "AUTH_FAILED"

            }
        );

    }


    /*
     * BODY
     */

    let body;


    try {

        body =
            await readBody(
                req
            );

    } catch (error) {

        return json(
            res,
            error.status ||
                400,
            {

                success:
                    false,

                error:
                    error.message ||
                    "Invalid request body",

                code:
                    error.code ||
                    "INVALID_REQUEST"

            }
        );

    }


    if (
        !body ||
        typeof body !==
            "object" ||
        Array.isArray(body)
    ) {

        return json(
            res,
            400,
            {

                success:
                    false,

                error:
                    "Request body harus berupa object.",

                code:
                    "INVALID_BODY"

            }
        );

    }

   /* =========================================================
   VISION CREDIT OPERATIONS
   ---------------------------------------------------------
   Vision menggunakan endpoint OpenKey yang sama.
   Operasi credit tidak membutuhkan credential OpenKey.
========================================================= */

const operation =
    String(
        body?.operation ||
        ""
    ).trim();


if (
    operation ===
        "vision_credit_check" ||
    operation ===
        "vision_credit_deduct" ||
    operation ===
        "vision_credit_refund"
) {

    try {

        return await handleVisionCreditOperation(
            res,
            authenticatedUser,
            operation
        );

    } catch (error) {

        console.error(
            "[openkey-chat] Vision credit operation failed:",
            error
        );


        return json(
            res,
            error.status ||
                500,
            {

                success:
                    false,

                operation,

                error:
                    error.message ||
                    "Vision credit operation failed",

                code:
                    error.code ||
                    "VISION_CREDIT_OPERATION_FAILED"

            }
        );

    }

}

   /* =========================================================
   VISION HISTORY OPERATION
========================================================= */

if (
    operation ===
        "vision_history_save"
) {

    try {

        return await handleVisionHistoryOperation(
            res,
            authenticatedUser,
            operation,
            body
        );

    } catch (error) {

        console.error(
            "[openkey-chat] Vision history operation failed:",
            error
        );


        return json(
            res,
            error.status ||
                500,
            {

                success:
                    false,

                operation,

                error:
                    error.message ||
                    "Vision history operation failed",

                code:
                    error.code ||
                    "VISION_HISTORY_OPERATION_FAILED"

            }
        );

    }

}


    /* =========================================================
   OPENKEY CREDENTIAL CONFIG
   ---------------------------------------------------------
   Hanya diperlukan untuk chat OpenKey.
   Vision credit/history tidak membutuhkan ini.
========================================================= */

if (
    !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
) {

    return json(
        res,
        500,
        {

            success:
                false,

            error:
                "Provider credential encryption belum dikonfigurasi.",

            code:
                "ENCRYPTION_CONFIG_MISSING"

        }
    );

}


/*
 * LOAD OPENKEY CREDENTIAL
 */

let apiKey;


    try {

        apiKey =
            await loadOpenKeyApiKey();

    } catch (error) {

        console.error(
            "[openkey-chat] Credential load failed:",
            error
        );


        return json(
            res,
            error.status ||
                500,
            {

                success:
                    false,

                error:
                    error.message ||
                    "OpenKey credential unavailable",

                code:
                    error.code ||
                    "OPENKEY_CREDENTIAL_FAILED"

            }
        );

    }


    /*
     * STREAM
     */

    const wantsStream =
        body.stream === true ||
        body.stream === "true";


    if (
        wantsStream
    ) {

        return handleStream(
            req,
            res,
            body,
            apiKey
        );

    }


    /*
     * NON STREAM
     */

    try {

        return await handleNonStream(
            res,
            body,
            apiKey
        );

    } catch (error) {

        console.error(
            "[openkey-chat] OpenKey request failed:",
            error
        );


        return json(
            res,
            error.status ||
                error.statusCode ||
                502,
            {

                success:
                    false,

                error:
                    error.message ||
                    "OpenKey request failed",

                code:
                    error.code ||
                    "OPENKEY_REQUEST_FAILED",

                provider_status:
                    error.status ||
                    error.statusCode ||
                    null

            }
        );

    }

}
