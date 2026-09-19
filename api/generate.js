// =========================================================
// GEN-Z.AI
// GENERATION ENGINE
// ---------------------------------------------------------
// File:
// api/generate.js
//
// Arsitektur:
// POST /api/generate
//      ↓
// Authentication
//      ↓
// models
//      ↓
// providers
//      ↓
// provider_credentials
//      ↓
// model adapter
//      ↓
// provider client
//      ↓
// taskId
//
// Model:
// grok-imagine/image-to-video
//
// Catatan:
// - Tidak menggunakan tabel kie_*.
// - models.provider_id = providers.id.
// - provider_credentials.provider_id = providers.provider_id.
// - API key tetap terenkripsi.
// - Model adapter berdiri sendiri.
// =========================================================

import crypto from "node:crypto";

import grokImagineImageToVideo from "../models/grok-imagine-image-to-video/index.js";


// =========================================================
// ENVIRONMENT
// =========================================================

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY;


// =========================================================
// MODEL REGISTRY
// =========================================================
//
// Jangan melakukan dynamic import berdasarkan input user.
//
// Model ID seperti:
// grok-imagine/image-to-video
//
// mengandung slash.
//
// Registry membuat pemetaan tetap eksplisit
// dan mencegah path traversal.
//

const MODEL_REGISTRY = {

    "grok-imagine/image-to-video":
        grokImagineImageToVideo

};


// =========================================================
// JSON RESPONSE
// =========================================================

function json(
    res,
    status,
    data
) {

    return res
        .status(status)
        .json(data);

}


// =========================================================
// BEARER TOKEN
// =========================================================

function getBearerToken(
    req
) {

    const authorization =
        req.headers?.authorization ||
        "";

    if (
        typeof authorization !==
        "string"
    ) {

        return null;

    }

    if (
        !authorization
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        return null;

    }

    const token =
        authorization
            .slice(7)
            .trim();

    return token || null;

}


// =========================================================
// PARSE BODY
// =========================================================

function parseBody(
    req
) {

    if (
        req.body &&
        typeof req.body === "object" &&
        !Buffer.isBuffer(req.body)
    ) {

        return req.body;

    }

    if (
        typeof req.body === "string"
    ) {

        try {

            const parsed =
                JSON.parse(
                    req.body
                );

            if (
                parsed &&
                typeof parsed === "object"
            ) {

                return parsed;

            }

        } catch {

            return {};

        }

    }

    return {};

}


// =========================================================
// SUPABASE REQUEST
// =========================================================

async function supabaseRequest(
    path,
    options = {}
) {

    if (
        !SUPABASE_URL
    ) {

        throw new Error(
            "SUPABASE_URL belum dikonfigurasi."
        );

    }

    const response =
        await fetch(
            `${SUPABASE_URL}${path}`,
            options
        );

    const text =
        await response.text();

    let data = null;

    if (text) {

        try {

            data =
                JSON.parse(
                    text
                );

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

}


// =========================================================
// AUTHENTICATE USER
// =========================================================

async function getAuthenticatedUser(
    req
) {

    const token =
        getBearerToken(
            req
        );

    if (
        !token
    ) {

        return null;

    }

    if (
        !SUPABASE_URL ||
        !SUPABASE_ANON_KEY
    ) {

        throw new Error(
            "Konfigurasi Supabase authentication belum lengkap."
        );

    }

    const result =
        await supabaseRequest(
            "/auth/v1/user",
            {
                method: "GET",

                headers: {

                    apikey:
                        SUPABASE_ANON_KEY,

                    Authorization:
                        `Bearer ${token}`,

                    Accept:
                        "application/json"

                }
            }
        );

    if (
        !result.response.ok ||
        !result.data?.id
    ) {

        return null;

    }

    return result.data;

}


// =========================================================
// SUPABASE DATABASE QUERY
// =========================================================

async function supabaseQuery(
    table,
    params = {}
) {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw new Error(
            "Konfigurasi Supabase server belum lengkap."
        );

    }

    const url =
        new URL(
            `${SUPABASE_URL}/rest/v1/${table}`
        );

    for (
        const [
            key,
            value
        ]
        of Object.entries(params)
    ) {

        if (
            value === undefined ||
            value === null
        ) {

            continue;

        }

        url.searchParams.set(
            key,
            String(value)
        );

    }

    const response =
        await fetch(
            url,
            {
                method: "GET",

                headers: {

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY,

                    Authorization:
                        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                    Accept:
                        "application/json"

                }
            }
        );

    const text =
        await response.text();

    let data = null;

    if (text) {

        try {

            data =
                JSON.parse(
                    text
                );

        } catch {

            data = null;

        }

    }

    if (
        !response.ok
    ) {

        const message =
            data?.message ||
            data?.details ||
            data?.hint ||
            data?.error ||
            `Supabase query gagal (${response.status}).`;

        throw new Error(
            message
        );

    }

    return Array.isArray(data)
        ? data
        : [];

}


// =========================================================
// DECRYPT PROVIDER API KEY
// =========================================================

function decryptProviderApiKey(
    credential
) {

    if (
        !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    ) {

        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi."
        );

    }

    const key =
        Buffer.from(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
            "hex"
        );

    if (
        key.length !== 32
    ) {

        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY harus 32 byte."
        );

    }

    if (
        !credential ||
        !credential.api_key_ciphertext ||
        !credential.api_key_iv ||
        !credential.api_key_tag
    ) {

        throw new Error(
            "Credential provider tidak lengkap."
        );

    }

    const iv =
        Buffer.from(
            credential.api_key_iv,
            "base64"
        );

    const tag =
        Buffer.from(
            credential.api_key_tag,
            "base64"
        );

    if (
        iv.length !== 12
    ) {

        throw new Error(
            "IV credential provider tidak valid."
        );

    }

    if (
        tag.length !== 16
    ) {

        throw new Error(
            "Authentication tag credential provider tidak valid."
        );

    }

    const encrypted =
        Buffer.from(
            credential.api_key_ciphertext,
            "base64"
        );

    const decipher =
        crypto.createDecipheriv(
            "aes-256-gcm",
            key,
            iv
        );

    decipher.setAuthTag(
        tag
    );

    const decrypted =
        Buffer.concat([

            decipher.update(
                encrypted
            ),

            decipher.final()

        ]);

    const apiKey =
        decrypted
            .toString("utf8")
            .trim();

    if (
        !apiKey
    ) {

        throw new Error(
            "API key provider hasil decrypt kosong."
        );

    }

    return apiKey;

}


// =========================================================
// LOAD MODEL
// =========================================================

async function loadModel(
    modelId
) {

    const rows =
        await supabaseQuery(
            "models",
            {

                select:
                    [
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
                        "status"
                    ].join(","),

                model_id:
                    `eq.${encodeURIComponent(modelId)}`,

                limit:
                    "1"

            }
        );

    if (
        rows.length === 0
    ) {

        return null;

    }

    return rows[0];

}


// =========================================================
// MODEL STATUS
// =========================================================

function isModelActive(
    model
) {

    const status =
        String(
            model?.status || ""
        )
        .trim()
        .toLowerCase();

    return (
        status === "active"
    );

}


// =========================================================
// LOAD PROVIDER
// =========================================================
//
// models.provider_id = providers.id
//

async function loadProvider(
    databaseProviderId
) {

    if (
        !databaseProviderId
    ) {

        return null;

    }

    const rows =
        await supabaseQuery(
            "providers",
            {

                select:
                    [
                        "id",
                        "provider_id",
                        "provider_name",
                        "description",
                        "status",
                        "is_default"
                    ].join(","),

                id:
                    `eq.${encodeURIComponent(databaseProviderId)}`,

                limit:
                    "1"

            }
        );

    if (
        rows.length === 0
    ) {

        return null;

    }

    return rows[0];

}


// =========================================================
// PROVIDER STATUS
// =========================================================

function isProviderActive(
    provider
) {

    const status =
        String(
            provider?.status || ""
        )
        .trim()
        .toLowerCase();

    return (
        status === "active"
    );

}


// =========================================================
// LOAD PROVIDER CREDENTIAL
// =========================================================
//
// provider_credentials.provider_id
// menggunakan providers.provider_id.
//
// BUKAN providers.id.
//

async function loadProviderApiKey(
    providerCode
) {

    if (
        !providerCode
    ) {

        throw new Error(
            "Provider ID tidak tersedia."
        );

    }

    const rows =
        await supabaseQuery(
            "provider_credentials",
            {

                select:
                    [
                        "api_key_ciphertext",
                        "api_key_iv",
                        "api_key_tag"
                    ].join(","),

                provider_id:
                    `eq.${encodeURIComponent(providerCode)}`,

                limit:
                    "1"

            }
        );

    if (
        rows.length === 0
    ) {

        throw new Error(
            `API key provider "${providerCode}" belum tersimpan.`
        );

    }

    return decryptProviderApiKey(
        rows[0]
    );

}


// =========================================================
// NORMALIZE INPUT
// =========================================================
//
// Frontend boleh mengirim:
//
// {
//     model_id: "...",
//     parameters: {
//         ...
//     }
// }
//
// atau:
//
// {
//     model: "...",
//     ...
// }
//
// Keduanya diterima.
//

function getModelId(
    body
) {

    const value =
        body?.model_id ??
        body?.model ??
        "";

    return String(
        value
    ).trim();

}


function getModelInput(
    body
) {

    if (
        body?.parameters &&
        typeof body.parameters === "object" &&
        !Array.isArray(body.parameters)
    ) {

        return {
            ...body.parameters
        };

    }

    const input = {
        ...body
    };

    delete input.model;
    delete input.model_id;
    delete input.parameters;
    delete input.provider;
    delete input.provider_id;

    return input;

}


// =========================================================
// ARRAY NORMALIZATION
// =========================================================

function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value;

    }

    if (
        typeof value === "string"
    ) {

        const text =
            value.trim();

        if (
            !text
        ) {

            return [];

        }

        try {

            const parsed =
                JSON.parse(
                    text
                );

            if (
                Array.isArray(parsed)
            ) {

                return parsed;

            }

        } catch {

            return text
                .split(",")
                .map(
                    item =>
                        item.trim()
                )
                .filter(Boolean);

        }

    }

    return [];

}


// =========================================================
// DATABASE MODEL RESTRICTIONS
// =========================================================
//
// parameters.js menjaga aturan API model.
//
// models table menjaga konfigurasi model
// yang benar-benar tersedia di GEN-Z.AI.
//
// Jadi request tidak boleh keluar dari
// konfigurasi model di database.
//

function validateDatabaseRestrictions(
    model,
    input
) {

    const errors = [];

    // -----------------------------------------
    // DURATION
    // -----------------------------------------

    if (
        input.duration !== undefined &&
        input.duration !== null &&
        input.duration !== ""
    ) {

        const duration =
            Number(
                input.duration
            );

        if (
            !Number.isFinite(
                duration
            )
        ) {

            errors.push(
                "duration harus berupa angka."
            );

        } else {

            if (
                model.min_duration !== null &&
                model.min_duration !== undefined &&
                duration <
                    Number(
                        model.min_duration
                    )
            ) {

                errors.push(
                    `duration minimal ${model.min_duration} detik.`
                );

            }

            if (
                model.max_duration !== null &&
                model.max_duration !== undefined &&
                duration >
                    Number(
                        model.max_duration
                    )
            ) {

                errors.push(
                    `duration maksimal ${model.max_duration} detik.`
                );

            }

        }

    }


    // -----------------------------------------
    // ASPECT RATIO
    // -----------------------------------------

    const supportedRatios =
        normalizeArray(
            model.supported_ratios
        );

    if (
        supportedRatios.length > 0 &&
        input.aspect_ratio !== undefined &&
        input.aspect_ratio !== null &&
        input.aspect_ratio !== ""
    ) {

        const requestedRatio =
            String(
                input.aspect_ratio
            ).trim();

        if (
            !supportedRatios.includes(
                requestedRatio
            )
        ) {

            errors.push(
                `aspect_ratio "${requestedRatio}" tidak tersedia untuk model ini.`
            );

        }

    }


    // -----------------------------------------
    // RESOLUTION
    // -----------------------------------------

    const supportedResolutions =
        normalizeArray(
            model.supported_resolutions
        );

    if (
        supportedResolutions.length > 0 &&
        input.resolution !== undefined &&
        input.resolution !== null &&
        input.resolution !== ""
    ) {

        const requestedResolution =
            String(
                input.resolution
            ).trim();

        if (
            !supportedResolutions.includes(
                requestedResolution
            )
        ) {

            errors.push(
                `resolution "${requestedResolution}" tidak tersedia untuk model ini.`
            );

        }

    }


    return errors;

}


// =========================================================
// MODEL ADAPTER
// =========================================================

function getModelAdapter(
    modelId
) {

    const adapter =
        MODEL_REGISTRY[
            modelId
        ];

    if (
        !adapter
    ) {

        const error =
            new Error(
                `Adapter untuk model "${modelId}" belum tersedia.`
            );

        error.code =
            "MODEL_ADAPTER_NOT_FOUND";

        throw error;

    }

    return adapter;

}


// =========================================================
// EXTRACT TASK ID
// =========================================================

function extractTaskId(
    response
) {

    return (
        response?.taskId ||
        response?.task_id ||
        response?.data?.taskId ||
        response?.data?.task_id ||
        null
    );

}


// =========================================================
// MAIN HANDLER
// =========================================================

export default async function handler(
    req,
    res
) {

    // =====================================================
    // CORS
    // =====================================================

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
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );


    // =====================================================
    // OPTIONS
    // =====================================================

    if (
        req.method === "OPTIONS"
    ) {

        return res
            .status(204)
            .end();

    }


    // =====================================================
    // METHOD
    // =====================================================

    if (
        req.method !== "POST"
    ) {

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


    // =====================================================
    // ENV CHECK
    // =====================================================

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
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


    if (
        !SUPABASE_ANON_KEY
    ) {

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "SUPABASE_ANON_KEY atau SUPABASE_KEY belum dikonfigurasi."
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
                success: false,
                error:
                    "PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi."
            }
        );

    }


    // =====================================================
    // AUTH
    // =====================================================

    let user;

    try {

        user =
            await getAuthenticatedUser(
                req
            );

    } catch (error) {

        console.error(
            "[generate] authentication error:",
            error.message
        );

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "Gagal memverifikasi session."
            }
        );

    }


    if (
        !user?.id
    ) {

        return json(
            res,
            401,
            {
                success: false,
                error:
                    "Session tidak ditemukan atau sudah kedaluwarsa."
            }
        );

    }


    // =====================================================
    // BODY
    // =====================================================

    const body =
        parseBody(
            req
        );


    // =====================================================
    // MODEL ID
    // =====================================================

    const modelId =
        getModelId(
            body
        );

    if (
        !modelId
    ) {

        return json(
            res,
            400,
            {
                success: false,
                error:
                    "Model ID wajib diisi."
            }
        );

    }


    // =====================================================
    // LOAD MODEL FROM DATABASE
    // =====================================================

    let model;

    try {

        model =
            await loadModel(
                modelId
            );

    } catch (error) {

        console.error(
            "[generate] model query error:",
            error.message
        );

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "Gagal mengambil konfigurasi model."
            }
        );

    }


    if (
        !model
    ) {

        return json(
            res,
            404,
            {
                success: false,
                error:
                    `Model "${modelId}" tidak ditemukan.`
            }
        );

    }


    // =====================================================
    // MODEL STATUS
    // =====================================================

    if (
        !isModelActive(
            model
        )
    ) {

        return json(
            res,
            403,
            {
                success: false,
                error:
                    `Model "${model.model_name || model.model_id}" sedang tidak aktif.`
            }
        );

    }


    // =====================================================
    // VERIFY ADAPTER
    // =====================================================

    let adapter;

    try {

        adapter =
            getModelAdapter(
                model.model_id
            );

    } catch (error) {

        console.error(
            "[generate] adapter error:",
            error.message
        );

        return json(
            res,
            500,
            {
                success: false,
                error:
                    error.message
            }
        );

    }


    // =====================================================
    // MODEL INPUT
    // =====================================================

    const input =
        getModelInput(
            body
        );


    // =====================================================
    // DATABASE RESTRICTIONS
    // =====================================================

    const databaseErrors =
        validateDatabaseRestrictions(
            model,
            input
        );

    if (
        databaseErrors.length > 0
    ) {

        return json(
            res,
            400,
            {
                success: false,
                error:
                    databaseErrors.join(" "),
                details:
                    databaseErrors
            }
        );

    }


    // =====================================================
    // PROVIDER
    // =====================================================
    //
    // models.provider_id = providers.id
    //

    let provider;

    try {

        provider =
            await loadProvider(
                model.provider_id
            );

    } catch (error) {

        console.error(
            "[generate] provider query error:",
            error.message
        );

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "Gagal mengambil konfigurasi provider."
            }
        );

    }


    if (
        !provider
    ) {

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "Provider untuk model ini tidak ditemukan."
            }
        );

    }


    // =====================================================
    // PROVIDER STATUS
    // =====================================================

    if (
        !isProviderActive(
            provider
        )
    ) {

        return json(
            res,
            503,
            {
                success: false,
                error:
                    `Provider "${provider.provider_name || provider.provider_id}" sedang tidak aktif.`
            }
        );

    }


    // =====================================================
    // PROVIDER ADAPTER CHECK
    // =====================================================

    const configuredProviderId =
        String(
            adapter?.config?.providerId ||
            ""
        )
        .trim();

    const databaseProviderCode =
        String(
            provider.provider_id ||
            ""
        )
        .trim();


    if (
        configuredProviderId &&
        databaseProviderCode &&
        configuredProviderId !==
            databaseProviderCode
    ) {

        console.error(
            "[generate] provider mismatch:",
            {
                model:
                    model.model_id,

                databaseProvider:
                    databaseProviderCode,

                adapterProvider:
                    configuredProviderId
            }
        );

        return json(
            res,
            409,
            {
                success: false,
                error:
                    "Provider model tidak sesuai dengan provider database."
            }
        );

    }


    // =====================================================
    // LOAD API KEY
    // =====================================================

    let providerApiKey;

    try {

        providerApiKey =
            await loadProviderApiKey(
                databaseProviderCode
            );

    } catch (error) {

        console.error(
            "[generate] provider credential error:",
            error.message
        );

        return json(
            res,
            502,
            {
                success: false,
                error:
                    error.message
            }
        );

    }


    // =====================================================
    // CREATE TASK
    // =====================================================

    let taskResponse;

    try {

        taskResponse =
            await adapter.createTask(
                input,
                providerApiKey
            );

    } catch (error) {

        console.error(
            "[generate] create task error:",
            error.message
        );

        const status =
            error?.status ||
            error?.response?.status ||
            502;

        return json(
            res,
            status >= 400 &&
            status <= 599
                ? status
                : 502,
            {
                success: false,
                error:
                    error.message ||
                    "Gagal membuat task."
            }
        );

    }


    // =====================================================
    // TASK ID
    // =====================================================

    const taskId =
        extractTaskId(
            taskResponse
        );


    if (
        !taskId
    ) {

        console.error(
            "[generate] KIE response tidak memiliki taskId."
        );

        return json(
            res,
            502,
            {
                success: false,
                error:
                    "Provider tidak mengembalikan taskId."
            }
        );

    }


    // =====================================================
    // RESPONSE
    // =====================================================

    return json(
        res,
        200,
        {

            success:
                true,

            model:
                model.model_id,

            model_id:
                model.model_id,

            model_name:
                model.model_name,

            provider:
                provider.provider_id,

            provider_id:
                provider.id,

            taskId:
                taskId,

            task_id:
                taskId,

            jobId:
                taskId

        }
    );

}
