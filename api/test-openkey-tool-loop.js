/* =========================================================
   GEN-Z.AI
   OPENKEY TOOL LOOP TEST API
   ---------------------------------------------------------
   File:
   api/test-openkey-tool-loop.js

   FUNGSI:
   - Authenticate Supabase user
   - Load encrypted OpenKey credential
   - Decrypt OpenKey API key server-side
   - Test OpenKey runToolLoop()
   - Menjalankan tool test server-side
   - Mengembalikan response final

   KHUSUS TESTING
   ---------------------------------------------------------
   TIDAK DIGUNAKAN UNTUK:
   - KIE
   - Seedance
   - Grok video
   - Generation task
   - Generation history
   - Generation credits
========================================================= */

import crypto from "crypto";

import openKeyChat
    from "../provider/openkey/chat.js";


/* =========================================================
   VERSION
========================================================= */

const TEST_VERSION =
    "2026-10-03-openkey-tool-loop-test-v1";


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
   JSON RESPONSE
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

        }
        catch {

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
            "Authorization header is required.",
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
            "Invalid Authorization header.",
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
            "Access token is missing.",
            401,
            "ACCESS_TOKEN_MISSING"
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

        throw createError(
            "Invalid or expired session.",
            401,
            "INVALID_SESSION"
        );

    }


    return user;

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
     * 64 HEX = 32 bytes
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
     * Base64 32 bytes
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

    }
    catch {

        /*
         * Fallback SHA-256.
         */

    }


    /*
     * Compatibility fallback
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

        }
        catch {

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

    }
    catch {

        /*
         * Invalid.
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
            "Encryption key must be 32 bytes.",
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
   LOAD OPENKEY API KEY
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


    const ciphertext =
        String(
            credential?.api_key_ciphertext ||
            ""
        ).trim();


    const iv =
        String(
            credential?.api_key_iv ||
            ""
        ).trim();


    const authTag =
        String(
            credential?.api_key_tag ||
            ""
        ).trim();


    if (
        !ciphertext ||
        !iv ||
        !authTag
    ) {

        throw createError(
            "Data encrypted OpenKey credential tidak lengkap.",
            500,
            "OPENKEY_CREDENTIAL_INVALID"
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

    }
    catch (error) {

        console.error(
            "[test-openkey-tool-loop] Credential decryption failed:",
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
   TOOL TEST
   ---------------------------------------------------------
   Tool ini sengaja sederhana.
   Tidak menggunakan API eksternal.
========================================================= */

async function executeTestTool(
    toolCall,
    context
) {

    const functionName =
        String(
            toolCall?.function?.name ||
            ""
        ).trim();


    if (
        functionName !==
        "get_test_weather"
    ) {

        throw createError(
            `Tool tidak dikenal: ${functionName}`,
            400,
            "TEST_TOOL_UNKNOWN"
        );

    }


    const args =
        toolCall?.function?.parsed_arguments &&
        typeof toolCall.function.parsed_arguments ===
            "object"

            ? toolCall.function.parsed_arguments

            : {};


    const city =
        String(
            args.city ||
            "Jakarta"
        ).trim();


    /*
     * Data statis hanya untuk pengujian
     * tool loop.
     *
     * Ini BUKAN weather API production.
     */

    return {

        success:
            true,

        tool:
            "get_test_weather",

        city,

        temperature_c:
            30,

        condition:
            "Berawan",

        source:
            "GEN-Z.AI TOOL LOOP TEST",

        round:
            context?.round ??
            null,

        index:
            context?.index ??
            null

    };

}


/* =========================================================
   BUILD TEST TOOLS
========================================================= */

function buildTestTools() {

    return [

        {

            type:
                "function",

            function: {

                name:
                    "get_test_weather",

                description:
                    "Tool pengujian internal GEN-Z.AI. Mengembalikan data cuaca test untuk kota yang diminta.",

                parameters: {

                    type:
                        "object",

                    properties: {

                        city: {

                            type:
                                "string",

                            description:
                                "Nama kota."

                        }

                    },

                    required: [

                        "city"

                    ],

                    additionalProperties:
                        false

                }

            }

        }

    ];

}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
    req,
    res
) {

    /*
     * CORS
     */

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
     * POST ONLY
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
     * AUTHENTICATION
     */

    let user;


    try {

        user =
            await authenticateUser(
                req
            );

    }
    catch (error) {

        console.error(
            "[test-openkey-tool-loop] Authentication failed:",
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
     * LOAD OPENKEY CREDENTIAL
     */

    let apiKey;


    try {

        apiKey =
            await loadOpenKeyApiKey();

    }
    catch (error) {

        console.error(
            "[test-openkey-tool-loop] Credential load failed:",
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
     * TEST CONFIGURATION
     */

    const tools =
        buildTestTools();


    const messages = [

        {

            role:
                "system",

            content:
                "Anda sedang menjalankan pengujian tool calling GEN-Z.AI. Gunakan tool get_test_weather jika diperlukan untuk menjawab pertanyaan pengguna."

        },

        {

            role:
                "user",

            content:
                "Gunakan tool get_test_weather untuk mengetahui cuaca Jakarta, lalu berikan hasilnya kepada saya."

        }

    ];


    /*
     * RUN TOOL LOOP
     */

    try {

        const result =
            await openKeyChat.runToolLoop({

                apiKey,

                model:
                    "auto",

                messages,

                tools,

                tool_choice:
                    "auto",

                temperature:
                    0.2,

                maxToolRounds:
                    5,

                executeTool:
                    executeTestTool

            });


        /*
         * Jangan pernah mengembalikan API key.
         */

        return json(
            res,
            200,
            {

                success:
                    true,

                version:
                    TEST_VERSION,

                authenticated:
                    true,

                user_id:
                    user.id,

                model:
                    result?.model ??
                    null,

                content:
                    result?.content ??
                    "",

                finish_reason:
                    result?.finish_reason ??
                    null,

                tool_calls:
                    result?.tool_calls ??
                    [],

                usage:
                    result?.usage ??
                    null

            }
        );

    }
    catch (error) {

        console.error(
            "[test-openkey-tool-loop] Tool loop failed:",
            error
        );


        return json(
            res,
            error.status ||
                500,
            {

                success:
                    false,

                version:
                    TEST_VERSION,

                authenticated:
                    true,

                error:
                    error.message ||
                    "OpenKey tool loop failed",

                code:
                    error.code ||
                    "OPENKEY_TOOL_LOOP_FAILED",

                maxToolRounds:
                    error.maxToolRounds ??
                    null

            }
        );

    }

}
