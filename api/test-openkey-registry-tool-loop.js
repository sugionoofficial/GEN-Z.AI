/* =========================================================
   GEN-Z.AI
   OPENKEY REGISTRY TOOL LOOP TEST
   ---------------------------------------------------------
   File:
   api/test-openkey-registry-tool-loop.js

   FUNGSI:
   - Authenticate Supabase user
   - Load encrypted OpenKey credential
   - Register test tool melalui Tool Registry
   - Mengambil schema tool dari Registry
   - Menjalankan OpenKey runToolLoop()
   - Executor tool berasal dari Tool Registry

   TIDAK MENYENTUH:
   - api/openkey-chat.js
   - KIE
   - Seedance
   - Grok
   - generation credits
   - generation history
========================================================= */

import crypto from "crypto";

import openKeyChat
    from "../provider/openkey/chat.js";

import openKeyToolRegistry
    from "../provider/openkey/tools/registry.js";


/* =========================================================
   VERSION
========================================================= */

const TEST_VERSION =
    "2026-10-03-openkey-registry-tool-loop-test-v1";


/* =========================================================
   ENVIRONMENT
========================================================= */

const SUPABASE_URL =
    String(
        process.env.SUPABASE_URL ||
        ""
    )
        .trim()
        .replace(
            /\/+$/,
            ""
        );


const SUPABASE_SERVICE_ROLE_KEY =
    String(
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        ""
    ).trim();


const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    String(
        process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ||
        ""
    ).trim();


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


    const responseText =
        await response.text();


    let data =
        null;


    if (
        responseText
    ) {

        try {

            data =
                JSON.parse(
                    responseText
                );

        }
        catch {

            data =
                responseText;

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


        throw createError(
            message,
            response.status,
            "SUPABASE_REQUEST_FAILED"
        );

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
        /* fallback */
    }


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
            value ||
            ""
        ).trim();


    if (
        !text
    ) {

        return null;

    }


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
            /* continue */
        }

    }


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
        /* invalid */
    }


    return null;

}


/* =========================================================
   AES-256-GCM DECRYPT
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
        "eq.openkey"
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
    catch (
        error
    ) {

        console.error(
            "[test-openkey-registry-tool-loop] Decryption failed:",
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
   REGISTER TEST TOOL
========================================================= */

function registerTestTool() {

    /*
     * Test endpoint ini memakai singleton registry.
     * Karena ini endpoint test, registry dibersihkan
     * terlebih dahulu agar schema deterministic.
     */

    openKeyToolRegistry.clearTools();


    openKeyToolRegistry.registerTool({

        name:
            "get_test_weather",

        description:
            "Tool pengujian internal GEN-Z.AI. Mengembalikan data cuaca test.",

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

        },

        async execute(
            argumentsObject,
            context
        ) {

            const city =
                String(
                    argumentsObject?.city ||
                    "Jakarta"
                ).trim();


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
                    "GEN-Z.AI TOOL REGISTRY LOOP TEST",

                context_tool:
                    context?.toolName ||
                    null

            };

        }

    });


    return openKeyToolRegistry;

}


/* =========================================================
   MAIN REGISTRY TOOL LOOP
========================================================= */

async function executeRegistryToolLoop(
    apiKey
) {

    const registry =
        registerTestTool();


    const tools =
        registry.getToolDefinitions();


    if (
        !Array.isArray(
            tools
        ) ||
        !tools.length
    ) {

        throw createError(
            "Tool Registry tidak menghasilkan tool definition.",
            500,
            "REGISTRY_DEFINITIONS_EMPTY"
        );

    }


    const result =
        await openKeyChat.runToolLoop({

            apiKey,

            model:
                "auto",

            messages: [

                {

                    role:
                        "system",

                    content:
                        "Kamu sedang menjalani integration test GEN-Z.AI. Jika membutuhkan data cuaca, gunakan tool get_test_weather. Jangan mengarang hasil tool."

                },

                {

                    role:
                        "user",

                    content:
                        "Gunakan tool get_test_weather untuk mendapatkan cuaca Jakarta, lalu jelaskan hasilnya."

                }

            ],

            tools,

            tool_choice:
                "auto",

            temperature:
                0.2,

            maxToolRounds:
                5,

            executeTool:
                (
                    toolCall,
                    context
                ) =>
                    registry.executeTool(
                        toolCall,
                        context
                    )

        });


    return {

        registry: {

            version:
                registry.getVersion(),

            tools:
                registry.listTools(),

            definitions:
                tools

        },

        result

    };

}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
    req,
    res
) {

    /* =====================================================
       CORS
    ===================================================== */

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


    /* =====================================================
       OPTIONS
    ===================================================== */

    if (
        req.method ===
        "OPTIONS"
    ) {

        return res
            .status(204)
            .end();

    }


    /* =====================================================
       POST ONLY
    ===================================================== */

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


    /* =====================================================
       ENVIRONMENT
    ===================================================== */

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


    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    let user;


    try {

        user =
            await authenticateUser(
                req
            );

    }
    catch (
        error
    ) {

        console.error(
            "[test-openkey-registry-tool-loop] Authentication failed:",
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


    /* =====================================================
       OPENKEY CREDENTIAL
    ===================================================== */

    let apiKey;


    try {

        apiKey =
            await loadOpenKeyApiKey();

    }
    catch (
        error
    ) {

        console.error(
            "[test-openkey-registry-tool-loop] Credential load failed:",
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


    /* =====================================================
       RUN
    ===================================================== */

    try {

        const test =
            await executeRegistryToolLoop(
                apiKey
            );


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
                    test.result?.model ||
                    null,

                content:
                    test.result?.content ||
                    null,

                finish_reason:
                    test.result?.finish_reason ||
                    null,

                tool_calls:
                    test.result?.tool_calls ||
                    [],

                usage:
                    test.result?.usage ||
                    null,

                registry:
                    test.registry

            }
        );

    }
    catch (
        error
    ) {

        console.error(
            "[test-openkey-registry-tool-loop] Test failed:",
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

                user_id:
                    user.id,

                error:
                    error.message ||
                    "OpenKey Registry Tool Loop test failed",

                code:
                    error.code ||
                    "OPENKEY_REGISTRY_TOOL_LOOP_FAILED"

            }
        );

    }

}
