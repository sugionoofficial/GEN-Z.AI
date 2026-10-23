//generate.js?v=1.1
/**
 * =========================================================
 * GEN-Z.AI
 * GENERATE API
 * ---------------------------------------------------------
 * File:
 *   api/generate.js
 *
 * Endpoint:
 *   POST /api/generate
 *
 * UPSCALE ACTIONS:
 *   - `upscale-photo` triggers the Real-ESRGAN photo workflow.
 *   - `upscale-video-upload` validates and processes uploaded videos.
 *   - `upscale` continues to upscale successful video history entries.
 * =========================================================
 */

import crypto from "node:crypto";

import {
    UPLOAD_BUCKET,
    resolveUploadedUpscaleVideoSource
} from "../lib/generate/upscale-source.js";


import grokImagineImageToVideo
    from "../models/grok-imagine-image-to-video/index.js";

import seedance25
    from "../models/seedance-2-5/index.js";

import digitalHumanLipSyncImage
    from "../models/digital-human-lipsync-image/index.js";

import seedance25StudioMotiongen
    from "../models/seedance-25-studio-s14/index.js";

import seedanceA2VStudioS14
    from "../models/seedance-a2v-studio-s14/index.js";

import wan30RefS6
    from "../models/wan-30-ref-s6/index.js";

import klingMotionControl30Pro
    from "../models/kling-motion-control-30-pro/index.js";

import qwenCloudVideoModels
    from "../models/qwencloud-video/index.js";

import {
    resolveBillableCredit,
    resolveQuotaUsageSeconds,
    roundCredit
} from "../lib/generate/qwencloud-credit.js";


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

const SUPABASE_ANON_KEY =
    String(
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        ""
    ).trim();


const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    String(
        process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || ""
    ).trim();


/* =========================================================
   MODEL REGISTRY
   ========================================================= */

const MODEL_REGISTRY = Object.freeze([
    grokImagineImageToVideo,
    seedance25,
    digitalHumanLipSyncImage,
    seedance25StudioMotiongen,
    seedanceA2VStudioS14,
    wan30RefS6,
    klingMotionControl30Pro,

    /* QwenCloud (Alibaba Cloud Model Studio / DashScope) */
    ...qwenCloudVideoModels
]);


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
   SANITIZE PROVIDER RESPONSE
   ========================================================= */

function sanitizeProviderResponse(
    value,
    depth = 0
) {

    if (
        depth > 8
    ) {

        return "[MAX_DEPTH]";

    }


    const secretKeys =
        new Set([

            "apiKey",
            "api_key",
            "apikey",

            "authorization",
            "Authorization",

            "access_token",
            "accessToken",

            "token",

            "secret",

            "password",

            "credential",
            "credentials",

            "api_key_ciphertext",
            "api_key_iv",
            "api_key_tag",

            "SUPABASE_SERVICE_ROLE_KEY",
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY"

        ]);


    if (
        Array.isArray(
            value
        )
    ) {

        return value.map(
            item =>
                sanitizeProviderResponse(
                    item,
                    depth + 1
                )
        );

    }


    if (
        value &&
        typeof value ===
            "object"
    ) {

        const output = {};


        for (
            const [key, item]
            of Object.entries(
                value
            )
        ) {

            if (
                secretKeys.has(
                    key
                )
            ) {

                output[key] =
                    "[REDACTED]";

                continue;

            }


            output[key] =
                sanitizeProviderResponse(
                    item,
                    depth + 1
                );

        }


        return output;

    }


    if (
        typeof value ===
            "string"
    ) {

        return value
            .replace(
                /Bearer\s+[^\s"']+/gi,
                "Bearer [REDACTED]"
            )
            .replace(
                /sk-[A-Za-z0-9._-]+/g,
                "[REDACTED]"
            );

    }


    return value;

}


/* =========================================================
   SUPABASE REQUEST
   ========================================================= */

async function supabaseRequest(
    path,
    options = {}
) {

    if (!SUPABASE_URL) {

        throw new Error(
            "SUPABASE_URL is not configured"
        );

    }


    if (!SUPABASE_SERVICE_ROLE_KEY) {

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


    let data =
        null;


    if (text) {

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


    if (!response.ok) {

        const requestMethod = String(options.method || "GET").toUpperCase();
        let message =
            `Supabase request ${requestMethod} ${path} failed with status ${response.status}`;


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
            new Error(
                message
            );


        error.status =
            response.status;

        error.path =
            path;

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


    if (!authorization) {

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


    if (!match) {

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
        match[1].trim();


    if (!accessToken) {

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
                        SUPABASE_ANON_KEY ||
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
        typeof req.body ===
            "object"
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
   GET MODEL ID
   ========================================================= */

function getModelId(
    body
) {

    return String(

        body?.model_id ||

        body?.modelId ||

        body?.model ||

        ""

    ).trim();

}

/* =========================================================
   MODEL REGISTRY LOOKUP
   ========================================================= */

function getModelAdapter(
    modelId
) {

    if (!modelId) {

        return null;

    }


    const normalizedId =
        String(
            modelId
        ).trim();


    return (

        MODEL_REGISTRY.find(
            adapter => {

                const adapterId =
                    String(
                        adapter?.config?.id ||
                        ""
                    ).trim();


                return (
                    adapterId ===
                    normalizedId
                );

            }
        ) ||

        null

    );

}


/* =========================================================
   LOAD OPTIONAL DATABASE MODEL
   ========================================================= */

async function loadDatabaseModel(
    modelId
) {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return null;

    }


    if (!modelId) {

        return null;

    }


    const params =
        new URLSearchParams();


    params.set(
        "select",
        "*"
    );


    params.set(
        "model_id",
        `eq.${modelId}`
    );


    params.set(
        "limit",
        "1"
    );


    try {

        const rows =
            await supabaseRequest(
                `/rest/v1/models?${params.toString()}`,
                {
                    method:
                        "GET"
                }
            );


        if (
            !Array.isArray(
                rows
            ) ||
            !rows.length
        ) {

            return null;

        }


        return rows[0];

    } catch (error) {

        console.warn(
            "[generate] Failed loading optional admin model config:",
            error
        );


        return null;

    }

}


/* =========================================================
   GENERATION RESOLUTION
   ========================================================= */

function normalizeGenerationResolution(
    value
) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            ""
        );

}


/* =========================================================
   NORMALIZE DISCOUNT
   ========================================================= */

function normalizeDiscountPercent(
    value
) {

    if (
        value ===
            null ||
        value ===
            undefined ||
        value ===
            ""
    ) {

        return 0;

    }


    const discount =
        Number(
            value
        );


    if (
        !Number.isFinite(
            discount
        )
    ) {

        throw Object.assign(
            new Error(
                "discount_percent is invalid"
            ),
            {
                code:
                    "MODEL_DISCOUNT_INVALID"
            }
        );

    }


    if (
        discount < 0 ||
        discount > 100
    ) {

        throw Object.assign(
            new Error(
                "discount_percent must be between 0 and 100"
            ),
            {
                code:
                    "MODEL_DISCOUNT_INVALID"
            }
        );

    }


    return discount;

}


/* =========================================================
   CALCULATE DISCOUNTED CREDIT
   ========================================================= */

function calculateDiscountedCredit(
    credit,
    discountPercent
) {

    const finalCredit =
        credit -
        (
            credit *
            discountPercent /
            100
        );


    return Math.max(
        0,
        finalCredit
    );

}


/* =========================================================
   RESOLVE GENERATION CREDIT
   ========================================================= */

function resolveGenerationCredit(
    databaseModel,
    parameters,
    modelId = "",
    modelConfig = null
) {

    if (!databaseModel) {

        throw Object.assign(
            new Error(
                "Model credit configuration was not found in Supabase"
            ),
            {
                code:
                    "MODEL_CONFIG_NOT_FOUND"
            }
        );

    }


    const requestedResolution =
        normalizeGenerationResolution(
            parameters?.resolution
        );


    const normalizedModelId =
        String(
            modelId || ""
        )
            .trim()
            .toLowerCase();


    let creditResolution =
        requestedResolution;


    if (
        normalizedModelId ===
        "digital-human-lipsync-image"
    ) {

        switch (
            requestedResolution
        ) {

            case "576p":
            case "576":

                creditResolution =
                    "480p";

                break;


            case "720phd":
            case "720p":

                creditResolution =
                    "720p";

                break;


            default:

                throw Object.assign(
                    new Error(
                        "Resolution Motiongen tidak valid. Gunakan 576P atau 720P HD."
                    ),
                    {
                        code:
                            "INVALID_RESOLUTION",

                        model_id:
                            normalizedModelId,

                        resolution:
                            requestedResolution,

                        credit_resolution:
                            creditResolution

                    }
                );

        }

    }


    if (
        normalizedModelId ===
        "seedance-25-studio-s14"
    ) {

        creditResolution =
            "";

    }


    const hasResolution =
        Boolean(
            String(
                creditResolution || ""
            ).trim()
        );


    let rawCredit;


    if (!hasResolution) {

        const candidates = normalizedModelId === "seedance-25-studio-s14"
            ? [
                databaseModel.credit_cost,
                databaseModel.credit_720p,
                databaseModel.credit_480p,
                databaseModel.credit_1080p
            ]
            : [
            databaseModel.credit_480p,
            databaseModel.credit_720p,
            databaseModel.credit_1080p,
            databaseModel.credit_cost
            ];


        for (
            const candidate
            of candidates
        ) {

            if (
                candidate === null ||
                candidate === undefined ||
                candidate === ""
            ) {
                continue;
            }


            const numeric =
                Number(candidate);


            if (
                Number.isFinite(numeric) &&
                numeric >= 0
            ) {

                rawCredit =
                    numeric;

                break;

            }

        }


        if (
            rawCredit === undefined ||
            rawCredit === null
        ) {

            throw Object.assign(
                new Error(
                    "Model credit configuration is missing for flat-credit model"
                ),
                {
                    code:
                        "MODEL_CREDIT_NOT_CONFIGURED",

                    model_id:
                        normalizedModelId
                }
            );

        }

    }


    else {

        switch (
            creditResolution
        ) {

            case "480p":

                rawCredit =
                    databaseModel.credit_480p;

                break;


            case "720p":

                rawCredit =
                    databaseModel.credit_720p;

                break;


            case "1080p":

                rawCredit =
                    databaseModel.credit_1080p;

                break;


            default:

                throw Object.assign(
                    new Error(
                        "Resolution must be 480p, 720p, or 1080p"
                    ),
                    {
                        code:
                            "INVALID_RESOLUTION",

                        resolution:
                            requestedResolution,

                        credit_resolution:
                            creditResolution

                    }
                );

        }

    }


    if (
        rawCredit ===
            null ||
        rawCredit ===
            undefined ||
        rawCredit ===
            ""
    ) {

        throw Object.assign(
            new Error(
                `Credit ${creditResolution || "flat"} is not configured for this model`
            ),
            {
                code:
                    "MODEL_CREDIT_NOT_CONFIGURED",

                resolution:
                    requestedResolution,

                credit_resolution:
                    creditResolution

            }
        );

    }


    const credit =
        Number(
            rawCredit
        );


    if (
        !Number.isFinite(
            credit
        ) ||
        credit < 0
    ) {

        throw Object.assign(
            new Error(
                `Credit ${creditResolution || "flat"} is invalid`
            ),
            {
                code:
                    "MODEL_CREDIT_INVALID",

                resolution:
                    requestedResolution,

                credit_resolution:
                    creditResolution

            }
        );

    }


    /* ---------- faktor durasi (QwenCloud) ---------- */

    const {
        durationSeconds,
        durationFactor,
        billableCredit: creditWithDuration
    } =
        resolveBillableCredit(
            credit,
            parameters,
            modelConfig,
            modelId
        );


    let discountPercent;


    try {

        discountPercent =
            normalizeDiscountPercent(
                databaseModel.discount_percent
            );

    } catch (error) {

        throw Object.assign(
            error,
            {
                resolution:
                    requestedResolution,

                credit_resolution:
                    creditResolution
            }
        );

    }


    const creditFinal =
        roundCredit(
            calculateDiscountedCredit(
                creditWithDuration,
                discountPercent
            )
        );


    return {

        resolution:
            requestedResolution,

        credit_resolution:
            creditResolution,

        credit_base:
            creditWithDuration,

        credit_unit:
            credit,

        duration_seconds:
            durationSeconds,

        duration_factor:
            durationFactor,

        discount_percent:
            discountPercent,

        credit:
            creditFinal,

        credit_final:
            creditFinal

    };

}


/* =========================================================
   DEDUCT GENERATION CREDITS
   ========================================================= */

async function deductGenerateCredits(
    userId,
    amount
) {

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
                            amount

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

        return newCredits;

    }


    if (
        data &&
        typeof data ===
            "object"
    ) {

        const candidates = [

            data.credits,

            data.new_credits,

            data.remaining_credits,

            data.deducted_credits

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

                return numeric;

            }

        }

    }


    return null;

}


/* =========================================================
   REFUND GENERATION CREDITS
   ========================================================= */

async function refundGenerateCredits(
    userId,
    amount
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
                            amount

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

        return newCredits;

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

                return numeric;

            }

        }

    }


    return null;

}


/* =========================================================
   GENERATION HISTORY HELPERS
   ========================================================= */

function normalizeHistoryText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;

    }


    if (
        typeof value ===
        "string"
    ) {

        const text =
            value.trim();


        return text
            ? text
            : null;

    }


    try {

        return JSON.stringify(
            value
        );

    } catch {

        return null;

    }

}


function normalizeHistoryReference(
    value
) {

    const candidate =
        Array.isArray(value)
            ? value.find(
                item =>
                    typeof item === "string" &&
                    item.trim()
            )
            : value;

    return normalizeHistoryText(
        candidate
    );
}


function normalizeHistoryInteger(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    return Math.trunc(
        number
    );

}


/* =========================================================
   QWENCLOUD HISTORY DURATION
   ---------------------------------------------------------
   Kuota QwenCloud dipotong otomatis dari kolom duration
   generation_history. Model tanpa parameter durasi
   (Wan Animate, HappyHorse Video Edit) tetap harus punya
   angka supaya kuota terpotong saat generate.

   Yang disimpan adalah SATU BLOK BILLING (5 detik) —
   sama dengan faktor credit model tanpa durasi. Saat task
   selesai, api/generate-status.js menimpanya dengan durasi
   sebenarnya dari respons QwenCloud (usage.duration).
   ========================================================= */

function resolveHistoryDuration({

    parameters,
    body,
    providerCode,
    provider,
    databaseModel

}) {

    const rawDuration =
        parameters?.duration ??
        body?.duration ??
        null;


    const code =
        String(
            providerCode ||
            provider?.provider_id ||
            ""
        )
            .trim()
            .toLowerCase();


    if (code !== "qwencloud") {
        return normalizeHistoryInteger(
            rawDuration
        );
    }


    return resolveQuotaUsageSeconds(
        rawDuration,
        databaseModel?.min_duration,
        code
    );

}


async function createGenerationHistory({

    user,
    body,
    modelConfig,
    databaseModel,
    provider,
    providerCode,
    parameters,
    generationCredit,
    taskId

}) {

    if (
        !user?.id ||
        !taskId
    ) {

        console.warn(
            "[generate] Generation history skipped: user_id or task_id is missing"
        );


        return null;

    }


    const normalizedTaskId =
        String(
            taskId
        ).trim();


    if (
        !normalizedTaskId
    ) {

        console.warn(
            "[generate] Generation history skipped: task_id is empty"
        );


        return null;

    }


    const imageReference =
        normalizeHistoryReference(
            parameters?.image_urls ??
            parameters?.image_url ??
            parameters?.first_frame_url ??
            parameters?.reference_image_urls ??
            body?.image_urls ??
            body?.image_url ??
            null
        );


    const videoReference =
        normalizeHistoryReference(
            parameters?.video_urls ??
            parameters?.video_url ??
            parameters?.reference_video_urls ??
            body?.video_reference_url ??
            body?.video_url ??
            body?.video_reference ??
            null
        );


    const duration =
        resolveHistoryDuration({

            parameters,

            body,

            providerCode,

            provider,

            databaseModel

        });


    const resolution =
        normalizeHistoryText(
            generationCredit?.resolution ??
            parameters?.resolution ??
            body?.resolution ??
            null
        );


    const creditCost =
        Number(
            generationCredit?.credit
        );


    if (
        !Number.isFinite(
            creditCost
        ) ||
        creditCost < 0
    ) {

        console.error(
            "[generate] Generation history skipped: invalid credit cost",
            {

                task_id:
                    normalizedTaskId,

                credit:
                    generationCredit?.credit

            }
        );


        return null;

    }


    const payload = {

        user_id:
            user.id,

        user_email:
            user.email ||
            null,

        provider_id:
            providerCode ||
            provider?.provider_id ||
            null,

        provider_name:
            provider?.provider_name ||
            provider?.name ||
            providerCode ||
            null,

        model_id:
            modelConfig?.id ||
            databaseModel?.model_id ||
            null,

        model_name:
            modelConfig?.name ||
            databaseModel?.name ||
            databaseModel?.model_name ||
            modelConfig?.id ||
            databaseModel?.model_id ||
            null,

        prompt:
            normalizeHistoryText(
                parameters?.prompt ??
                body?.prompt ??
                null
            ),

        image_reference_url:
            imageReference,

        video_reference_url:
            videoReference,

        ratio:
            normalizeHistoryText(
                parameters?.aspect_ratio ??
                body?.aspect_ratio ??
                null
            ),

        duration,

        resolution,

        status:
            "processing",

        task_id:
            normalizedTaskId,

        result_url:
            null,

        error_message:
            null,

        credit_cost:
            creditCost

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
            "[generate] Generation history created:",
            {

                user_id:
                    user.id,

                task_id:
                    normalizedTaskId,

                model_id:
                    payload.model_id,

                provider_id:
                    payload.provider_id,

                resolution:
                    payload.resolution,

                credit_cost:
                    payload.credit_cost

            }
        );


        return payload;

    } catch (error) {

        console.error(
            "[generate] Failed to create generation history:",
            {

                message:
                    error?.message ||
                    "Unknown history error",

                status:
                    error?.status ||
                    null,

                data:
                    error?.data ||
                    null,

                user_id:
                    user.id,

                task_id:
                    normalizedTaskId

            }
        );


        return null;

    }

}


/* =========================================================
   PROVIDER LOOKUP BY DATABASE ID
   ========================================================= */

async function loadProviderByDatabaseId(
    providerDatabaseId
) {

    if (
        !providerDatabaseId
    ) {

        return null;

    }


    const params =
        new URLSearchParams();


    params.set(
        "select",
        "*"
    );


    params.set(
        "id",
        `eq.${providerDatabaseId}`
    );


    params.set(
        "limit",
        "1"
    );


    const providers =
        await supabaseRequest(
            `/rest/v1/providers?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );


    if (
        !Array.isArray(
            providers
        ) ||
        !providers.length
    ) {

        return null;

    }


    return providers[0];

}


/* =========================================================
   PROVIDER LOOKUP BY PROVIDER CODE
   ========================================================= */

async function loadProviderByCode(
    providerCode
) {

    if (!providerCode) {

        return null;

    }


    const normalizedCode =
        String(
            providerCode
        ).trim();


    if (!normalizedCode) {

        return null;

    }


    const params =
        new URLSearchParams();


    params.set(
        "select",
        "*"
    );


    params.set(
        "provider_id",
        `eq.${normalizedCode}`
    );


    params.set(
        "limit",
        "1"
    );


    const providers =
        await supabaseRequest(
            `/rest/v1/providers?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );


    if (
        Array.isArray(
            providers
        ) &&
        providers.length
    ) {

        return providers[0];

    }


    const nameParams =
        new URLSearchParams();


    nameParams.set(
        "select",
        "*"
    );


    nameParams.set(
        "provider_name",
        `eq.${normalizedCode}`
    );


    nameParams.set(
        "limit",
        "1"
    );


    const namedProviders =
        await supabaseRequest(
            `/rest/v1/providers?${nameParams.toString()}`,
            {
                method:
                    "GET"
            }
        );


    if (
        Array.isArray(
            namedProviders
        ) &&
        namedProviders.length
    ) {

        return namedProviders[0];

    }


    return null;

}


/* =========================================================
   RESOLVE PROVIDER
   ========================================================= */

async function resolveProvider(
    adapter,
    databaseModel
) {

    const databaseProviderId =
        databaseModel?.provider_id ||
        null;


    if (
        databaseProviderId
    ) {

        const provider =
            await loadProviderByDatabaseId(
                databaseProviderId
            );


        if (provider) {

            return {

                provider,

                error:
                    null

            };

        }

    }


    const registryProviderId =
        String(
            adapter?.config?.providerId ||
            ""
        ).trim();


    if (
        registryProviderId
    ) {

        const provider =
            await loadProviderByCode(
                registryProviderId
            );


        if (provider) {

            return {

                provider,

                error:
                    null

            };

        }


        return {

            provider:
                null,

            error:
                "Provider not found",

            details: {

                provider_id:
                    registryProviderId

            }

        };

    }


    return {

        provider:
            null,

        error:
            "Model provider is not configured"

    };

}


/* =========================================================
   ENCRYPTION KEY
   ========================================================= */

function getEncryptionKey() {

    if (
        !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    ) {

        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY is not configured"
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

    } catch {

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
            value || ""
        ).trim();


    if (!text) {

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

            return Buffer.from(
                text,
                "hex"
            );

        } catch {

            /* fallback */

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

    } catch {

        /* fallback */

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

        throw new Error(
            "Encryption key must be 32 bytes"
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

async function loadProviderApiKey(
    providerCode
) {

    const normalizedProviderCode =
        String(
            providerCode || ""
        ).trim();


    if (
        !normalizedProviderCode
    ) {

        throw new Error(
            "Provider ID is missing"
        );

    }


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
        `eq.${normalizedProviderCode}`
    );


    params.set(
        "limit",
        "1"
    );


    let credentials;


    try {

        credentials =
            await supabaseRequest(
                `/rest/v1/provider_credentials?${params.toString()}`,
                {
                    method:
                        "GET"
                }
            );

    } catch (error) {

        console.error(
            "[generate] Failed reading provider_credentials:",
            error
        );


        throw new Error(
            `Failed to read provider credential for ${normalizedProviderCode}`
        );

    }


    if (
        !Array.isArray(
            credentials
        ) ||
        !credentials.length
    ) {

        throw new Error(
            `No provider credential found for ${normalizedProviderCode}`
        );

    }


    const credential =
        credentials[0];


    if (
        !credential ||
        typeof credential !==
            "object"
    ) {

        throw new Error(
            `Invalid provider credential for ${normalizedProviderCode}`
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


    if (!ciphertext) {

        throw new Error(
            `Provider credential ciphertext is empty for ${normalizedProviderCode}`
        );

    }


    if (!iv) {

        throw new Error(
            `Provider credential IV is empty for ${normalizedProviderCode}`
        );

    }


    if (!authTag) {

        throw new Error(
            `Provider credential authentication tag is empty for ${normalizedProviderCode}`
        );

    }


    let ivBuffer;
    let authTagBuffer;
    let ciphertextBuffer;


    try {

        ivBuffer = decodeBuffer(iv);
        authTagBuffer = decodeBuffer(authTag);
        ciphertextBuffer = decodeBuffer(ciphertext);

    } catch (error) {

        console.error(
            "[generate] Failed decoding provider credential:",
            error
        );


        throw new Error(
            `Invalid encrypted provider credential format for ${normalizedProviderCode}`
        );

    }


    if (!ivBuffer) {
        throw new Error(
            `Provider credential IV could not be decoded for ${normalizedProviderCode}`
        );
    }


    if (!authTagBuffer) {
        throw new Error(
            `Provider credential authentication tag could not be decoded for ${normalizedProviderCode}`
        );
    }


    if (!ciphertextBuffer) {
        throw new Error(
            `Provider credential ciphertext could not be decoded for ${normalizedProviderCode}`
        );
    }


    let apiKey;


    try {

        apiKey =
            decryptAesGcm(
                ivBuffer,
                authTagBuffer,
                ciphertextBuffer
            );

    } catch (error) {

        console.error(
            "[generate] Provider credential decryption failed:",
            error
        );


        throw new Error(
            `Unable to decrypt provider API credential for ${normalizedProviderCode}`
        );

    }


    const normalizedApiKey =
        String(
            apiKey || ""
        ).trim();


    if (
        !normalizedApiKey
    ) {

        throw new Error(
            `Decrypted provider API key is empty for ${normalizedProviderCode}`
        );

    }


    console.debug(
        "[generate] Provider API credential resolved successfully:",
        {

            provider_id:
                normalizedProviderCode,

            credential_id:
                credential.id,

            has_api_key:
                true

        }
    );


    return normalizedApiKey;

}


/* =========================================================
   ARRAY NORMALIZER
   ========================================================= */

function normalizeArray(
    value
) {

    if (
        Array.isArray(
            value
        )
    ) {

        return [

            ...new Set(

                value
                    .map(
                        item =>
                            String(
                                item ?? ""
                            ).trim()
                    )
                    .filter(Boolean)

            )

        ];

    }


    if (
        value === null ||
        value === undefined
    ) {

        return [];

    }


    if (
        typeof value ===
        "string"
    ) {

        const trimmed =
            value.trim();


        if (!trimmed) {

            return [];

        }


        if (
            trimmed.startsWith("{") &&
            trimmed.endsWith("}")
        ) {

            const content =
                trimmed
                    .slice(
                        1,
                        -1
                    )
                    .trim();


            if (!content) {

                return [];

            }


            return [

                ...new Set(

                    content
                        .split(",")
                        .map(
                            item =>
                                item
                                    .trim()
                                    .replace(
                                        /^"(.*)"$/,
                                        "$1"
                                    )
                        )
                        .filter(Boolean)

                )

            ];

        }


        if (
            trimmed.startsWith("[") &&
            trimmed.endsWith("]")
        ) {

            try {

                const parsed =
                    JSON.parse(
                        trimmed
                    );


                if (
                    Array.isArray(
                        parsed
                    )
                ) {

                    return normalizeArray(
                        parsed
                    );

                }

            } catch {

                /* fallback */

            }

        }


        return [

            ...new Set(

                trimmed
                    .split(",")
                    .map(
                        item =>
                            item.trim()
                    )
                    .filter(Boolean)

            )

        ];

    }


    return [];

}


/* =========================================================
   DATABASE PARAMETER RESTRICTION
   ========================================================= */

function validateDatabaseRestrictions(
    model,
    parameters
) {

    const errors = [];


    if (!model) {

        return errors;

    }


    if (
        parameters.duration !==
            undefined &&
        parameters.duration !==
            null &&
        parameters.duration !==
            ""
    ) {

        const duration =
            Number(
                parameters.duration
            );


        if (
            !Number.isFinite(
                duration
            )
        ) {

            errors.push(
                "duration must be a valid number"
            );

        } else {

            const rawMin =
                Number(
                    model.min_duration
                );


            const rawMax =
                Number(
                    model.max_duration
                );


            const min =
                Number.isFinite(
                    rawMin
                ) &&
                rawMin > 0
                    ? rawMin
                    : null;


            const max =
                Number.isFinite(
                    rawMax
                ) &&
                rawMax > 0
                    ? rawMax
                    : null;


            if (
                min !== null &&
                duration < min
            ) {

                errors.push(
                    `duration must be at least ${min} seconds`
                );

            }


            if (
                max !== null &&
                duration > max
            ) {

                errors.push(
                    `duration must be at most ${max} seconds`
                );

            }

        }

    }


    if (
        parameters.aspect_ratio !==
            undefined &&
        parameters.aspect_ratio !==
            null &&
        parameters.aspect_ratio !==
            ""
    ) {

        const ratios =
            normalizeArray(
                model.supported_ratios
            );


        if (
            ratios.length > 0 &&
            !ratios.includes(
                String(
                    parameters.aspect_ratio
                )
            )
        ) {

            errors.push(
                `aspect_ratio is not supported. Allowed: ${ratios.join(", ")}`
            );

        }

    }


    if (
        parameters.resolution !==
            undefined &&
        parameters.resolution !==
            null &&
        parameters.resolution !==
            ""
    ) {

        const resolutions =
            normalizeArray(
                model.supported_resolutions
            );


        if (
            resolutions.length > 0 &&
            !resolutions.includes(
                String(
                    parameters.resolution
                )
            )
        ) {

            errors.push(
                `resolution is not supported. Allowed: ${resolutions.join(", ")}`
            );

        }

    }


    return errors;

}


/* =========================================================
   ADAPTER VALIDATION
   ========================================================= */

function validateAdapterInput(
    adapter,
    parameters
) {

    if (
        !adapter ||
        typeof adapter.validate !==
            "function"
    ) {

        return [];

    }


    const result =
        adapter.validate(
            parameters
        );


    if (
        result === true ||
        result === undefined ||
        result === null
    ) {

        return [];

    }


    if (
        Array.isArray(
            result
        )
    ) {

        return result.map(
            item =>
                String(
                    item
                )
        );

    }


    if (
        typeof result ===
        "string"
    ) {

        return [
            result
        ];

    }


    if (
        result &&
        typeof result ===
            "object"
    ) {

        if (
            Array.isArray(
                result.errors
            )
        ) {

            return result.errors.map(
                item =>
                    String(
                        item
                    )
            );

        }


        if (
            result.error
        ) {

            return [
                String(
                    result.error
                )
            ];

        }


        if (
            result.valid ===
            false
        ) {

            return [
                "Invalid model parameters"
            ];

        }

    }


    return [];

}


/* =========================================================
   UPSCALE VIDEO — CONSTANTS
   ========================================================= */

function getUpscaleGithubConfig(req) {
    const binding = req?.env || {};
    const getValue = (key, fallback = "") => {
        const configured = binding[key] || process.env[key] || fallback;
        return String(configured).trim();
    };

    return {
        token: getValue("GITHUB_PAT"),
        owner: getValue("GITHUB_OWNER", "sugionoofficial"),
        repo: getValue("GITHUB_REPO", "GEN-Z.AI"),
        workflowFile: getValue("GITHUB_WORKFLOW_FILE", "upscale.yml"),
        ref: getValue("GITHUB_REF", "main")
    };
}

const UPSCALE_VIDEO_TARGETS = Object.freeze([
    "1080p",
    "1k",
    "2k"
]);

const UPSCALE_VIDEO_TARGET_LABELS = Object.freeze({
    "1080p": "1080p",
    "1k": "1K (1024px)",
    "2k": "2K (2560px)"
});

function getUpscaleVideoTargetLabel(targetResolution) {
    return UPSCALE_VIDEO_TARGET_LABELS[targetResolution];
}


/* =========================================================
   UPSCALE PHOTO — CONSTANTS
   ========================================================= */

const UPSCALE_PHOTO_WORKFLOW_FILE = "upscale-photo.yml";
const UPSCALE_PHOTO_TARGETS = ["2k", "4k"];
const UPSCALE_PHOTO_PROVIDER_ID = "genzai-internal";
const UPSCALE_PHOTO_PROVIDER_NAME = "GEN-Z.AI";
const UPSCALE_PHOTO_MODEL_ID = "upscale-photo";
const UPSCALE_PHOTO_MODEL_NAME = "Upscale Photo";

async function getFeatureCreditCost(featureId) {
    const rows = await supabaseRequest(
        `/rest/v1/feature_credit_settings?select=credit_cost&feature_id=eq.${encodeURIComponent(featureId)}&limit=1`,
        { method: "GET" }
    );
    const cost = Number(rows?.[0]?.credit_cost);

    if (!Number.isInteger(cost) || cost < 0) {
        throw new Error(`Tarif ${featureId} belum dikonfigurasi.`);
    }

    return cost;
}


/* =========================================================
   UPSCALE VIDEO — FETCH HISTORY ROW
   ========================================================= */

async function fetchUpscaleParentHistory(historyId) {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("id", `eq.${historyId}`);
    params.set("limit", "1");

    const rows = await supabaseRequest(
        `/rest/v1/generation_history?${params.toString()}`,
        { method: "GET" }
    );

    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0];
}


/* =========================================================
   UPSCALE VIDEO — CHECK ALREADY UPSCALED
   ========================================================= */

async function hasActiveOrSuccessfulUpscale(historyId) {
    const params = new URLSearchParams();
    params.set("select", "id,status");
    params.set("upscale_of_history_id", `eq.${historyId}`);
    params.set("status", "in.(pending,processing,success)");
    params.set("limit", "1");

    const rows = await supabaseRequest(
        `/rest/v1/generation_history?${params.toString()}`,
        { method: "GET" }
    );

    return Array.isArray(rows) && rows.length > 0;
}


/* =========================================================
   UPSCALE VIDEO — GENERATE TASK ID
   ========================================================= */

function generateUpscaleTaskId() {
    const rand = Math.random().toString(36).slice(2, 10);
    return `upscale_${Date.now()}_${rand}`;
}


/* =========================================================
   UPSCALE VIDEO — CREATE HISTORY ROW
   ========================================================= */

async function createUpscaleHistoryRow({
    user,
    parent,
    sourceUrl,
    taskId,
    creditCost,
    targetResolution = "2k"
}) {
    const targetLabel =
        getUpscaleVideoTargetLabel(targetResolution);

    const payload = {
        user_id: user.id,
        user_email: user.email || null,
        provider_id: parent.provider_id || null,
        provider_name: parent.provider_name || null,
        model_id: parent.model_id || null,
        model_name: parent.model_name || null,
        prompt: parent.prompt || null,
        image_reference_url: parent.image_reference_url || null,
        video_reference_url: parent.video_reference_url || null,
        ratio: parent.ratio || null,
        duration: parent.duration || null,
        resolution: targetLabel,
        status: "processing",
        task_id: taskId,
        result_url: null,
        error_message: null,
        credit_cost: creditCost,
        upscale_of_history_id: parent.id,
        upscale_source_url: sourceUrl,
        upscale_target: targetLabel
    };

    const rows = await supabaseRequest(
        "/rest/v1/generation_history?select=*",
        {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify([payload])
        }
    );

    if (!Array.isArray(rows) || !rows.length) {
        throw new Error("Failed to create upscale history row");
    }

    return rows[0];
}


/* =========================================================
   UPSCALE VIDEO — MARK FAILED + REFUND
   ========================================================= */

async function markUpscaleFailedAndRefund({
    historyId,
    userId,
    errorMessage,
    creditCost
}) {
    let updatedRows = [];

    try {
        updatedRows = await supabaseRequest(
            `/rest/v1/generation_history?id=eq.${encodeURIComponent(historyId)}&status=in.(processing,pending)`,
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    status: "failed",
                    error_message: errorMessage,
                    completed_at: new Date().toISOString()
                })
            }
        );
    } catch (e) {
        console.error("[upscale] Failed to mark history row:", e);
        return;
    }

    if (!Array.isArray(updatedRows) || !updatedRows.length) {
        return;
    }

    try {
        await refundGenerateCredits(userId, creditCost);
    } catch (e) {
        console.error("[upscale] Refund failed:", e);
    }
}


/* =========================================================
   UPSCALE VIDEO — TRIGGER GITHUB WORKFLOW
   ========================================================= */

async function triggerUpscaleWorkflow({
    github,
    historyId,
    sourceUrl,
    userId,
    creditCost,
    targetResolution = "2k",
    sourceObjectPath = ""
}) {
    const url = `https://api.github.com/repos/${github.owner}/${github.repo}/actions/workflows/${github.workflowFile}/dispatches`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${github.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "GENZ-AI-Upscale"
        },
        body: JSON.stringify({
            ref: github.ref,
            inputs: {
                history_id: String(historyId),
                source_url: String(sourceUrl),
                user_id: String(userId),
                credit_cost: String(creditCost),
                target_resolution: String(targetResolution),
                source_object_path: String(sourceObjectPath)
            }
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `GitHub Actions dispatch failed (${response.status}): ${text}`
        );
    }

    return true;
}


async function findUpscaleWorkflowRun(github, historyRow) {
    if (!github.token) {
        throw new Error("GitHub token untuk memeriksa status upscale belum dikonfigurasi.");
    }

    const url = new URL(
        `https://api.github.com/repos/${github.owner}/${github.repo}/actions/workflows/${encodeURIComponent(github.workflowFile)}/runs`
    );
    url.searchParams.set("event", "workflow_dispatch");
    url.searchParams.set("per_page", "100");

    const response = await fetch(url, {
        headers: {
            Authorization: "Bearer " + github.token,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "GENZ-AI-Upscale"
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Gagal membaca status GitHub Actions (${response.status}): ${text}`
        );
    }

    const payload = await response.json();
    const runs = Array.isArray(payload?.workflow_runs)
        ? payload.workflow_runs
        : [];
    const expectedName = `Upscale Video - ${historyRow.id}`;
    const namedRuns = runs.filter(run =>
        [run?.name, run?.display_title].some(name =>
            String(name || "").trim() === expectedName
        )
    );

    if (namedRuns.length) {
        return namedRuns.sort((left, right) =>
            Date.parse(right.created_at) - Date.parse(left.created_at)
        )[0];
    }

    const createdAt = Date.parse(historyRow.created_at);
    if (!Number.isFinite(createdAt)) return null;

    const nearbyRuns = runs.filter(run => {
        const runCreatedAt = Date.parse(run?.created_at);
        return Number.isFinite(runCreatedAt) &&
            Math.abs(runCreatedAt - createdAt) <= 5 * 60 * 1000;
    });

    return nearbyRuns.length === 1 ? nearbyRuns[0] : null;
}


async function finalizeUpscaleHistory({
    historyRow,
    status,
    errorMessage
}) {
    const updatedRows = await supabaseRequest(
        `/rest/v1/generation_history?id=eq.${encodeURIComponent(historyRow.id)}&status=in.(processing,pending)`,
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                status,
                error_message: errorMessage,
                completed_at: new Date().toISOString()
            })
        }
    );

    if (Array.isArray(updatedRows) && updatedRows.length) {
        const creditCost = Number(historyRow.credit_cost);
        if (!Number.isFinite(creditCost) || creditCost < 0) {
            throw new Error("Biaya kredit upscale tidak valid; status sudah diperbarui tetapi refund gagal.");
        }

        await refundGenerateCredits(historyRow.user_id, creditCost);
        return { status, finalized: true };
    }

    const latest = await fetchUpscaleParentHistory(historyRow.id);
    return {
        status: String(latest?.status || status),
        finalized: false
    };
}


async function handleUpscaleVideoStatusAction(req, res, body, user) {
    const historyId = String(body?.history_id || "").trim();
    if (!historyId) {
        return failure(res, 400, "ID history upscale tidak tersedia.");
    }

    const historyRow = await fetchUpscaleParentHistory(historyId);
    if (!historyRow) {
        return failure(res, 404, "History upscale tidak ditemukan.");
    }
    if (String(historyRow.user_id || "") !== String(user.id)) {
        return failure(res, 403, "Anda tidak memiliki akses ke history upscale ini.");
    }
    if (String(historyRow.model_id || "").toLowerCase() !== "upscale-video") {
        return failure(res, 400, "History ini bukan upscale video.");
    }

    const currentStatus = String(historyRow.status || "").toLowerCase();
    if (!["processing", "pending"].includes(currentStatus)) {
        return success(res, { status: currentStatus, terminal: true });
    }

    const github = getUpscaleGithubConfig(req);
    const run = await findUpscaleWorkflowRun(github, historyRow);
    const cancelRequested = body?.cancel === true;
    const createdAt = Date.parse(historyRow.created_at);
    const isOlderThanWorkflowLimit =
        Number.isFinite(createdAt) &&
        Date.now() - createdAt > 55 * 60 * 1000;

    if (!run) {
        if (!isOlderThanWorkflowLimit) {
            return success(res, {
                status: currentStatus,
                run_found: false,
                terminal: false
            });
        }

        const result = await finalizeUpscaleHistory({
            historyRow,
            status: cancelRequested ? "cancelled" : "failed",
            errorMessage: cancelRequested
                ? "Upscale dibatalkan; GitHub Actions tidak lagi memiliki run aktif."
                : "Upscale berhenti tanpa menyimpan hasil; GitHub Actions tidak lagi memiliki run aktif."
        });
        return success(res, { ...result, run_found: false, terminal: true });
    }

    if (run.status !== "completed" && cancelRequested) {
        const cancelUrl =
            `https://api.github.com/repos/${github.owner}/${github.repo}/actions/runs/${encodeURIComponent(run.id)}/cancel`;
        const cancelResponse = await fetch(cancelUrl, {
            method: "POST",
            headers: {
                Authorization: "Bearer " + github.token,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "GENZ-AI-Upscale"
            }
        });

        if (cancelResponse.status === 409) {
            const runResponse = await fetch(
                `https://api.github.com/repos/${github.owner}/${github.repo}/actions/runs/${encodeURIComponent(run.id)}`,
                {
                    headers: {
                        Authorization: "Bearer " + github.token,
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                        "User-Agent": "GENZ-AI-Upscale"
                    }
                }
            );
            if (!runResponse.ok) {
                throw new Error("GitHub menolak pembatalan dan status terbaru run tidak dapat dibaca.");
            }
            Object.assign(run, await runResponse.json());
        } else if (!cancelResponse.ok) {
            const text = await cancelResponse.text();
            throw new Error(
                `GitHub Actions gagal membatalkan job (${cancelResponse.status}): ${text}`
            );
        } else {
            const result = await finalizeUpscaleHistory({
                historyRow,
                status: "cancelled",
                errorMessage: "Upscale dibatalkan dari halaman History."
            });
            return success(res, { ...result, terminal: true });
        }
    }

    if (run.status === "completed") {
        const conclusion = String(run.conclusion || "").toLowerCase();
        if (conclusion === "cancelled") {
            const result = await finalizeUpscaleHistory({
                historyRow,
                status: "cancelled",
                errorMessage: "Upscale dibatalkan di GitHub Actions."
            });
            return success(res, { ...result, terminal: true });
        }
        if (conclusion && conclusion !== "success") {
            const result = await finalizeUpscaleHistory({
                historyRow,
                status: "failed",
                errorMessage: `Upscale ${conclusion.replace(/_/g, " ")} di GitHub Actions.`
            });
            return success(res, { ...result, terminal: true });
        }
        if (conclusion === "success") {
            const result = await finalizeUpscaleHistory({
                historyRow,
                status: "failed",
                errorMessage: "GitHub Actions selesai tanpa menyimpan hasil ke History."
            });
            return success(res, { ...result, terminal: true });
        }
    }

    return success(res, {
        status: currentStatus,
        run_status: run.status,
        run_conclusion: run.conclusion || null,
        terminal: false
    });
}


/* =========================================================
   UPSCALE VIDEO — MAIN HANDLER
   ========================================================= */

async function handleUpscaleAction(req, res, body, user) {

    const historyId = String(body?.history_id || "").trim();
    const targetResolution =
        String(body?.target_resolution || "2k")
            .trim()
            .toLowerCase();
    const github = getUpscaleGithubConfig(req);

    if (!historyId) {
        return failure(res, 400, "history_id is required");
    }

    if (!UPSCALE_VIDEO_TARGETS.includes(targetResolution)) {
        return failure(res, 400, "target_resolution must be 1080p, 1k, or 2k");
    }

    if (!github.token) {
        return failure(res, 500, "GitHub Actions secret GITHUB_PAT is not configured");
    }

    let parent;
    try {
        parent = await fetchUpscaleParentHistory(historyId);
    } catch (err) {
        console.error("[upscale] Failed to fetch history:", err);
        return failure(res, 500, "Failed to fetch history");
    }

    if (!parent) {
        return failure(res, 404, "History tidak ditemukan");
    }

    if (String(parent.user_id) !== String(user.id)) {
        return failure(res, 403, "Tidak boleh mengakses history user lain");
    }

    if (String(parent.status).toLowerCase() !== "success") {
        return failure(res, 409, "Hanya video dengan status success yang bisa diupscale");
    }

    const sourceUrl = String(parent.result_url || "").trim();
    if (!sourceUrl) {
        return failure(res, 409, "Video sumber tidak punya result_url");
    }

    try {
        const already = await hasActiveOrSuccessfulUpscale(historyId);
        if (already) {
            return failure(res, 409, "Video ini sudah pernah diupscale atau sedang diproses");
        }
    } catch (err) {
        console.error("[upscale] Failed to check upscale status:", err);
        return failure(res, 500, "Failed to check upscale status");
    }

    let remainingCredits = null;
    let creditCost;

    try {
        creditCost = await getFeatureCreditCost("upscale");
        remainingCredits = await deductGenerateCredits(
            user.id,
            creditCost
        );
    } catch (err) {
        console.error("[upscale] Credit deduction failed:", err);

        const combined = String(err?.message || "").toUpperCase();
        const insufficient = combined.includes("INSUFFICIENT_CREDITS");

        return failure(
            res,
            insufficient ? 402 : 500,
            insufficient ? "Kredit tidak cukup" : "Gagal potong kredit",
            {
                code: insufficient
                    ? "INSUFFICIENT_CREDITS"
                    : "CREDIT_DEDUCTION_FAILED"
            }
        );
    }

    const taskId = generateUpscaleTaskId();
    let upscaleRow;

    try {
        upscaleRow = await createUpscaleHistoryRow({
            user,
            parent,
            sourceUrl,
            taskId,
            creditCost,
            targetResolution
        });
    } catch (err) {
        console.error("[upscale] Failed to create history row:", err);

        try {
            await refundGenerateCredits(user.id, creditCost);
        } catch (e) {
            console.error("[upscale] Refund failed:", e);
        }

        return failure(res, 500, "Gagal membuat catatan history");
    }

    try {
        await triggerUpscaleWorkflow({
            github,
            historyId: upscaleRow.id,
            sourceUrl,
            userId: user.id,
            creditCost,
            targetResolution
        });
    } catch (err) {
        console.error("[upscale] GitHub dispatch failed:", err);

        await markUpscaleFailedAndRefund({
            historyId: upscaleRow.id,
            userId: user.id,
            errorMessage: "Gagal memulai upscale di GitHub Actions",
            creditCost
        });

        return failure(res, 502, "Gagal memulai upscale di GitHub Actions");
    }

    return success(res, {
        upscale_history_id: upscaleRow.id,
        task_id: taskId,
        status: "processing",
        credit_used: creditCost,
        remaining_credits: remainingCredits,
        target: getUpscaleVideoTargetLabel(targetResolution)
    });
}

function getUploadedUpscaleVideoSource(sourceUrl, userId) {
    /*
     * Upload user sekarang di bucket privat `user-uploads`
     * (signed URL). Path publik lama tetap diterima.
     */
    return resolveUploadedUpscaleVideoSource({
        sourceUrl,
        userId,
        supabaseUrl: SUPABASE_URL
    });
}

async function deleteUploadedUpscaleVideoSource(objectPath, bucket = UPLOAD_BUCKET) {
    try {
        const encodedPath = objectPath
            .split("/")
            .map(encodeURIComponent)
            .join("/");

        await supabaseRequest(
            `/storage/v1/object/${bucket}/${encodedPath}`,
            { method: "DELETE" }
        );
    } catch (err) {
        console.error("[upscale-video-upload] Temporary source cleanup failed:", err);
    }
}

async function handleUpscaleVideoUploadAction(req, res, body, user) {
    const sourceUrl = String(body?.source_url || "").trim();
    const targetResolution =
        String(body?.target_resolution || "2k")
            .trim()
            .toLowerCase();
    const github = getUpscaleGithubConfig(req);

    if (!sourceUrl) {
        return failure(res, 400, "source_url is required");
    }

    if (!UPSCALE_VIDEO_TARGETS.includes(targetResolution)) {
        return failure(res, 400, "target_resolution must be 1080p, 1k, or 2k");
    }

    let sourceObject;
    try {
        sourceObject =
            getUploadedUpscaleVideoSource(sourceUrl, user.id);
    } catch (err) {
        return failure(res, 400, err.message);
    }

    if (!github.token) {
        await deleteUploadedUpscaleVideoSource(sourceObject.objectPath, sourceObject.bucket);
        return failure(res, 500, "GitHub Actions secret GITHUB_PAT is not configured");
    }

    let creditCost;
    try {
        creditCost = await getFeatureCreditCost("upscale_video");
    } catch (err) {
        console.error("[upscale-video-upload] Failed to load credit cost:", err);
        await deleteUploadedUpscaleVideoSource(sourceObject.objectPath, sourceObject.bucket);
        return failure(res, 500, "Tarif Upscale Video belum tersedia");
    }

    try {
        await deductGenerateCredits(user.id, creditCost);
    } catch (err) {
        console.error("[upscale-video-upload] Credit deduction failed:", err);

        const insufficient =
            String(err?.message || "").toUpperCase()
                .includes("INSUFFICIENT_CREDITS");

        await deleteUploadedUpscaleVideoSource(sourceObject.objectPath, sourceObject.bucket);
        return failure(
            res,
            insufficient ? 402 : 500,
            insufficient ? "Kredit tidak cukup" : "Gagal potong kredit",
            {
                code: insufficient
                    ? "INSUFFICIENT_CREDITS"
                    : "CREDIT_DEDUCTION_FAILED"
            }
        );
    }

    const taskId = generateUpscaleTaskId();
    let historyRow;

    try {
        const rows = await supabaseRequest(
            "/rest/v1/generation_history?select=*",
            {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify([{
                    user_id: user.id,
                    user_email: user.email || null,
                    provider_id: UPSCALE_PHOTO_PROVIDER_ID,
                    provider_name: UPSCALE_PHOTO_PROVIDER_NAME,
                    model_id: "upscale-video",
                    model_name: "Upscale Video",
                    prompt: null,
                    image_reference_url: null,
                    video_reference_url: null,
                    ratio: null,
                    duration: null,
                    resolution: getUpscaleVideoTargetLabel(targetResolution),
                    status: "processing",
                    task_id: taskId,
                    result_url: null,
                    error_message: null,
                    credit_cost: creditCost,
                    upscale_target: getUpscaleVideoTargetLabel(targetResolution)
                }])
            }
        );

        if (!Array.isArray(rows) || !rows.length) {
            throw new Error("Empty response from history insert");
        }

        historyRow = rows[0];
    } catch (err) {
        console.error("[upscale-video-upload] Failed to create history row:", err);

        try {
            await refundGenerateCredits(user.id, creditCost);
        } catch (refundError) {
            console.error("[upscale-video-upload] Credit refund failed:", refundError);
        }

        await deleteUploadedUpscaleVideoSource(sourceObject.objectPath, sourceObject.bucket);
        return failure(res, 500, "Gagal membuat catatan history");
    }

    try {
        await triggerUpscaleWorkflow({
            github,
            historyId: historyRow.id,
            sourceUrl,
            userId: user.id,
            creditCost,
            targetResolution,
            sourceObjectPath: sourceObject.objectPath
        });
    } catch (err) {
        console.error("[upscale-video-upload] GitHub dispatch failed:", err);

        await markUpscaleFailedAndRefund({
            historyId: historyRow.id,
            userId: user.id,
            errorMessage: "Gagal memulai upscale video di GitHub Actions",
            creditCost
        });

        await deleteUploadedUpscaleVideoSource(sourceObject.objectPath, sourceObject.bucket);
        return failure(res, 502, "Gagal memulai upscale video di GitHub Actions");
    }

    return success(res, {
        upscale_history_id: historyRow.id,
        task_id: taskId,
        status: "processing",
        target: getUpscaleVideoTargetLabel(targetResolution),
        credit_used: creditCost
    });
}


/* =========================================================
   UPSCALE PHOTO — MAIN HANDLER
   ========================================================= */

async function handleUpscalePhotoAction(req, res, body, user) {

    const sourceUrl = String(body?.source_url || "").trim();
    const targetResolution = String(body?.target_resolution || "2k").trim().toLowerCase();
    const github = getUpscaleGithubConfig(req);

    if (!sourceUrl) {
        return failure(res, 400, "source_url is required");
    }

    if (!UPSCALE_PHOTO_TARGETS.includes(targetResolution)) {
        return failure(res, 400, "target_resolution must be '2k' or '4k'");
    }

    if (!github.token) {
        return failure(res, 500, "GitHub Actions secret GITHUB_PAT is not configured");
    }

    /* ===== DEDUCT CREDIT ===== */

    let remainingCredits = null;
    let creditCost;

    try {
        creditCost = await getFeatureCreditCost("upscale");
        remainingCredits = await deductGenerateCredits(
            user.id,
            creditCost
        );
    } catch (err) {
        console.error("[upscale-photo] Credit deduction failed:", err);

        const combined = String(err?.message || "").toUpperCase();
        const insufficient = combined.includes("INSUFFICIENT_CREDITS");

        return failure(
            res,
            insufficient ? 402 : 500,
            insufficient ? "Kredit tidak cukup" : "Gagal potong kredit",
            {
                code: insufficient
                    ? "INSUFFICIENT_CREDITS"
                    : "CREDIT_DEDUCTION_FAILED"
            }
        );
    }

    /* ===== CREATE HISTORY ROW ===== */

    const taskId = `upscale-photo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const historyPayload = {
        user_id: user.id,
        user_email: user.email || null,
        provider_id: UPSCALE_PHOTO_PROVIDER_ID,
        provider_name: UPSCALE_PHOTO_PROVIDER_NAME,
        model_id: UPSCALE_PHOTO_MODEL_ID,
        model_name: UPSCALE_PHOTO_MODEL_NAME,
        prompt: null,
        image_reference_url: sourceUrl,
        video_reference_url: null,
        ratio: null,
        duration: null,
        resolution: targetResolution === "4k" ? "2160p" : "1440p",
        status: "processing",
        task_id: taskId,
        result_url: null,
        error_message: null,
        credit_cost: creditCost
    };

    let historyRow;

    try {
        const inserted = await supabaseRequest(
            "/rest/v1/generation_history?select=*",
            {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify([historyPayload])
            }
        );

        if (!Array.isArray(inserted) || !inserted.length) {
            throw new Error("Empty response from history insert");
        }

        historyRow = inserted[0];

    } catch (err) {
        console.error("[upscale-photo] Failed to create history row:", err);

        try {
            await refundGenerateCredits(user.id, creditCost);
        } catch (e) {
            console.error("[upscale-photo] Refund failed:", e);
        }

        return failure(res, 500, "Gagal membuat catatan history");
    }

    /* ===== TRIGGER GITHUB WORKFLOW ===== */

    const ghUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/actions/workflows/${UPSCALE_PHOTO_WORKFLOW_FILE}/dispatches`;

    try {
        const response = await fetch(ghUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${github.token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
                "User-Agent": "GENZ-AI-Upscale-Photo"
            },
            body: JSON.stringify({
                ref: github.ref,
                inputs: {
                    history_id: String(historyRow.id),
                    source_url: sourceUrl,
                    user_id: String(user.id),
                    credit_cost: String(creditCost),
                    target_resolution: targetResolution
                }
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`GitHub dispatch failed (${response.status}): ${text}`);
        }

    } catch (err) {
        console.error("[upscale-photo] GitHub dispatch failed:", err);

        try {
            await supabaseRequest(
                `/rest/v1/generation_history?id=eq.${historyRow.id}`,
                {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify({
                        status: "failed",
                        error_message: "Gagal memulai upscale di GitHub Actions"
                    })
                }
            );
        } catch (e) {
            console.error("[upscale-photo] Failed to mark history:", e);
        }

        try {
            await refundGenerateCredits(user.id, creditCost);
        } catch (e) {
            console.error("[upscale-photo] Refund failed:", e);
        }

        return failure(res, 502, "Gagal memulai upscale di GitHub Actions");
    }

    /* ===== SUCCESS ===== */

    return success(res, {
        upscale_history_id: historyRow.id,
        task_id: taskId,
        status: "processing",
        target: targetResolution,
        credit_used: creditCost,
        remaining_credits: remainingCredits
    });
}


/* =========================================================
   HANDLER
   ========================================================= */

export const config = {
    runtime: "nodejs"
};

export default async function handler(
    req,
    res
) {

    /*
     * =====================================================
     * METHOD
     * =====================================================
     */

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


    /*
     * =====================================================
     * SERVER CONFIG
     * =====================================================
     */

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return failure(
            res,
            500,
            "Server configuration is incomplete"
        );

    }


    /*
     * =====================================================
     * AUTH
     * =====================================================
     */

    let user;


    try {

        user =
            await authenticateUser(
                req
            );

    } catch (error) {

        const message =
            error.status === 403 && error.path === "/auth/v1/user"
                ? "Supabase menolak validasi sesi (403). Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY (atau SUPABASE_KEY) pada server cocok dengan project aplikasi. SUPABASE_SERVICE_ROLE_KEY juga harus berasal dari project yang sama untuk operasi database."
                : error.message || "Unauthorized";

        return failure(
            res,
            error.status ||
                401,

            message
        );

    }


    /*
     * =====================================================
     * BODY
     * =====================================================
     */

    let body;


    try {

        body =
            await readBody(
                req
            );

    } catch (error) {

        return failure(
            res,
            error.status ||
                400,

            error.message ||
                "Invalid request body"
        );

    }


    /*
     * =====================================================
     * ACTION ROUTER
     * =====================================================
     */

    const action =
        String(body?.action || "")
            .trim()
            .toLowerCase();

    if (action === "upscale") {

        return await handleUpscaleAction(
            req,
            res,
            body,
            user
        );

    }

    if (action === "upscale-photo") {

        return await handleUpscalePhotoAction(
            req,
            res,
            body,
            user
        );

    }

    if (action === "upscale-video-upload") {

        return await handleUpscaleVideoUploadAction(
            req,
            res,
            body,
            user
        );

    }

    if (action === "upscale-video-status") {

        try {
            return await handleUpscaleVideoStatusAction(
                req,
                res,
                body,
                user
            );
        } catch (error) {
            console.error("[upscale-video-status] Failed:", error);
            return failure(
                res,
                error.status || 500,
                error.message || "Gagal memeriksa status upscale video."
            );
        }

    }


    /*
     * =====================================================
     * MODEL ID
     * =====================================================
     */

    const modelId =
        getModelId(
            body
        );


    if (!modelId) {

        return failure(
            res,
            400,
            "model_id is required"
        );

    }


    /*
     * =====================================================
     * MODEL REGISTRY
     * =====================================================
     */

    const adapter =
        getModelAdapter(
            modelId
        );


    if (!adapter) {

        return failure(
            res,
            404,
            "Model not found",
            {

                model_id:
                    modelId,

                source:
                    "repository"

            }
        );

    }


    /*
     * =====================================================
     * MODEL CONFIG
     * =====================================================
     */

    const modelConfig =
        adapter.config ||
        {};


    const adapterModelId =
        String(
            modelConfig.id ||
            ""
        ).trim();


    if (
        !adapterModelId
    ) {

        return failure(
            res,
            500,
            "Model configuration is invalid",
            {

                model_id:
                    modelId

            }
        );

    }


    if (
        adapterModelId !==
        modelId
    ) {

        return failure(
            res,
            500,
            "Model adapter ID mismatch",
            {

                requested_model:
                    modelId,

                adapter_model:
                    adapterModelId

            }
        );

    }


    /*
     * =====================================================
     * OPTIONAL ADMIN CONFIG
     * =====================================================
     */

    let databaseModel =
        null;


    try {

        databaseModel =
            await loadDatabaseModel(
                modelId
            );

    } catch (error) {

        console.warn(
            "[generate] Optional admin model config unavailable:",
            error
        );

    }


    /*
     * =====================================================
     * MODEL STATUS
     * =====================================================
     */

    if (
        databaseModel
    ) {

        const status =
            String(
                databaseModel.status ||
                ""
            )
                .trim()
                .toLowerCase();


        if (
            status &&
            status !==
                "active"
        ) {

            return failure(
                res,
                409,
                "Model is not active",
                {

                    model_id:
                        modelId,

                    status:
                        databaseModel.status

                }
            );

        }

    }


    /*
     * =====================================================
     * PARAMETERS
     * =====================================================
     */

    const rawParameters =
        adapter.getParameters(
            body
        );

    const parameters =
        adapter.sanitizeParameters(
            rawParameters
        );


    /*
     * =====================================================
     * FIX: SALIN RESOLUTION DARI BODY
     * =====================================================
     */

    if (!parameters.resolution) {

        const bodyResolution =
            body?.resolution ??
            body?.parameters?.resolution;

        if (bodyResolution !== undefined && bodyResolution !== null) {

            parameters.resolution = bodyResolution;

        }

    }


    /*
     * =====================================================
     * DATABASE RESTRICTIONS
     * =====================================================
     */

    const databaseErrors =
        validateDatabaseRestrictions(
            databaseModel,
            parameters
        );


    if (
        databaseErrors.length > 0
    ) {

        return failure(
            res,
            422,
            "Invalid model parameters",
            {

                errors:
                    databaseErrors

            }
        );

    }


    /*
     * =====================================================
     * ADAPTER VALIDATION
     * =====================================================
     */

    let adapterErrors;


    try {

        adapterErrors =
            validateAdapterInput(
                adapter,
                parameters
            );

    } catch (error) {

        console.error(
            "[generate] Model validation failed:",
            error
        );


        return failure(
            res,
            422,
            "Invalid model parameters",
            {

                errors: [

                    error.message ||
                        "Invalid model parameters"

                ]

            }
        );

    }


    if (
        adapterErrors.length > 0
    ) {

        return failure(
            res,
            422,
            "Invalid model parameters",
            {

                errors:
                    adapterErrors

            }
        );

    }


    /*
     * =====================================================
     * RESOLVE GENERATION CREDIT
     * =====================================================
     */

    let generationCredit;


    try {

        generationCredit =
            resolveGenerationCredit(
                databaseModel,
                parameters,
                modelId,
                modelConfig
            );

    } catch (error) {

        console.error(
            "[generate] Credit resolution failed:",
            error
        );


        let statusCode =
            409;


        if (
            error?.code ===
            "INVALID_RESOLUTION"
        ) {

            statusCode =
                422;

        }


        if (
            error?.code ===
            "MODEL_DISCOUNT_INVALID"
        ) {

            statusCode =
                409;

        }


        return failure(
            res,
            statusCode,
            error.message ||
                "Model credit configuration is invalid",
            {

                code:
                    error.code ||
                    "MODEL_CREDIT_ERROR",

                model_id:
                    modelId,

                resolution:
                    parameters?.resolution ||
                    null

            }
        );

    }


    /*
     * =====================================================
     * PROVIDER
     * =====================================================
     */

    let providerResult;


    try {

        providerResult =
            await resolveProvider(
                adapter,
                databaseModel
            );

    } catch (error) {

        console.error(
            "[generate] Provider lookup failed:",
            error
        );


        return failure(
            res,
            500,
            "Failed to load provider configuration",
            {

                code:
                    "PROVIDER_LOOKUP_FAILED",

                details:
                    sanitizeProviderResponse(
                        error?.data ||
                        error?.message ||
                        null
                    )

            }
        );

    }


    if (
        providerResult.error
    ) {

        const providerError =
            providerResult.error;


        const statusCode =
            providerError ===
                "Provider is not active"

                ? 409

                : 404;


        return failure(
            res,
            statusCode,
            providerError,
            providerResult.details ||
                {}
        );

    }


    const provider =
        providerResult.provider;


    if (!provider) {

        return failure(
            res,
            404,
            "Provider not found"
        );

    }


    /*
     * =====================================================
     * PROVIDER CODE
     * =====================================================
     */

    const providerCode =
        String(
            provider.provider_id ||
            modelConfig.providerId ||
            ""
        ).trim();


    if (!providerCode) {

        return failure(
            res,
            500,
            "Provider ID is missing",
            {

                code:
                    "PROVIDER_ID_MISSING"

            }
        );

    }


    /*
     * =====================================================
     * PROVIDER API KEY
     * =====================================================
     */

    let providerApiKey;


    try {

        providerApiKey =
            await loadProviderApiKey(
                providerCode
            );

    } catch (error) {

        console.error(
            "[generate] Provider credential error:",
            error.message
        );


        return failure(
            res,
            500,
            "Provider API credential is unavailable",
            {

                provider_id:
                    providerCode,

                code:
                    "PROVIDER_CREDENTIAL_UNAVAILABLE",

                details: {

                    message:
                        error.message

                }

            }

        );

    }


    /*
     * =====================================================
     * DEDUCT CREDIT
     * =====================================================
     */

    let creditDeducted =
        false;


    let remainingCredits =
        null;


    try {

        remainingCredits =
            await deductGenerateCredits(
                user.id,
                generationCredit.credit
            );


        creditDeducted =
            true;


        console.info(
            "[generate] Credit deducted:",
            {

                user_id:
                    user.id,

                model_id:
                    modelId,

                resolution:
                    generationCredit.resolution,

                credit_base:
                    generationCredit.credit_base,

                discount_percent:
                    generationCredit.discount_percent,

                credit_used:
                    generationCredit.credit,

                remaining_credits:
                    remainingCredits

            }
        );

    } catch (error) {

        console.error(
            "[generate] Credit deduction failed:",
            error
        );


        const rawMessage =
            String(
                error?.message ||
                ""
            );


        const rawData =
            String(
                error?.data?.message ||
                error?.data?.details ||
                error?.data?.hint ||
                error?.data?.error ||
                ""
            );


        const combinedMessage =
            `${rawMessage} ${rawData}`
                .toUpperCase();


        const insufficient =
            combinedMessage.includes(
                "INSUFFICIENT_CREDITS"
            );


        return failure(
            res,
            insufficient
                ? 402
                : 500,

            insufficient
                ? "Insufficient credits"
                : (
                    error?.message ||
                    "Failed to deduct credits"
                ),

            {

                code:
                    insufficient
                        ? "INSUFFICIENT_CREDITS"
                        : (
                            error?.code ||
                            "CREDIT_DEDUCTION_FAILED"
                        ),

                model_id:
                    modelId,

                resolution:
                    generationCredit.resolution,

                credit_base:
                    generationCredit.credit_base,

                discount_percent:
                    generationCredit.discount_percent,

                credit:
                    generationCredit.credit

            }
        );

    }


    /*
     * =====================================================
     * CREATE TASK
     * =====================================================
     */

    let task;


    try {

        task =
            await adapter.createTask(
                parameters,
                providerApiKey
            );

    } catch (error) {

        console.error(
            "[generate] Adapter createTask failed:",
            error
        );


        if (
            creditDeducted
        ) {

            try {

                const refundedCredits =
                    await refundGenerateCredits(
                        user.id,
                        generationCredit.credit
                    );


                remainingCredits =
                    refundedCredits;


                creditDeducted =
                    false;


                console.info(
                    "[generate] Credit refunded after provider failure:",
                    {

                        user_id:
                            user.id,

                        model_id:
                            modelId,

                        resolution:
                            generationCredit.resolution,

                        credit_base:
                            generationCredit.credit_base,

                        discount_percent:
                            generationCredit.discount_percent,

                        credit:
                            generationCredit.credit,

                        remaining_credits:
                            refundedCredits

                    }
                );

            } catch (refundError) {

                console.error(
                    "[generate] CRITICAL: credit refund failed:",
                    refundError
                );

            }

        }


        const providerStatus =
            Number(
                error?.status ||
                error?.statusCode ||
                error?.response?.status ||
                error?.response?.statusCode
            );


        let statusCode =
            502;


        if (
            providerStatus >= 400 &&
            providerStatus <= 599
        ) {

            statusCode =
                providerStatus;

        }


        const providerResponse =
            error?.data ||
            error?.response?.data ||
            error?.response?.body ||
            error?.body ||
            error?.response ||
            null;


        return failure(
            res,
            statusCode,
            error?.message ||
                "Failed to create generation task",
            {

                code:
                    error?.code ||
                    "KIE_CREATE_TASK_FAILED",

                provider:
                    providerCode,

                provider_status:
                    providerStatus ||
                    null,

                provider_response:
                    sanitizeProviderResponse(
                        providerResponse
                    ),

                resolution:
                    generationCredit.resolution,

                credit_base:
                    generationCredit.credit_base,

                discount_percent:
                    generationCredit.discount_percent,

                credit_used:
                    generationCredit.credit,

                credit_refunded:
                    !creditDeducted

            }
        );

    }


    /*
     * =====================================================
     * NORMALIZE TASK RESPONSE
     * =====================================================
     */

    const safeTask =
        sanitizeProviderResponse(
            task
        );


    /*
     * =====================================================
     * TASK ID
     * =====================================================
     */

    const taskId =

        task?.taskId ||

        task?.task_id ||

        task?.data?.taskId ||

        task?.data?.task_id ||

        task?.data?.task?.taskId ||

        task?.data?.task?.task_id ||

        task?.jobId ||

        task?.job_id ||

        null;


    /*
     * =====================================================
     * TASK ID MISSING
     * =====================================================
     */

    if (!taskId) {

        console.error(
            "[generate] Provider response has no taskId:",
            safeTask
        );


        let refundSuccessful =
            false;


        if (
            creditDeducted
        ) {

            try {

                const refundedCredits =
                    await refundGenerateCredits(
                        user.id,
                        generationCredit.credit
                    );


                remainingCredits =
                    refundedCredits;


                creditDeducted =
                    false;


                refundSuccessful =
                    true;


                console.info(
                    "[generate] Credit refunded because taskId is missing:",
                    {

                        user_id:
                            user.id,

                        model_id:
                            modelId,

                        resolution:
                            generationCredit.resolution,

                        credit_base:
                            generationCredit.credit_base,

                        discount_percent:
                            generationCredit.discount_percent,

                        credit:
                            generationCredit.credit,

                        remaining_credits:
                            refundedCredits

                    }
                );

            } catch (refundError) {

                console.error(
                    "[generate] CRITICAL: taskId-missing credit refund failed:",
                    refundError
                );

            }

        }


        return failure(
            res,
            502,
            "Provider did not return a task ID",
            {

                code:
                    "TASK_ID_MISSING",

                provider:
                    providerCode,

                provider_response:
                    safeTask,

                resolution:
                    generationCredit.resolution,

                credit_base:
                    generationCredit.credit_base,

                discount_percent:
                    generationCredit.discount_percent,

                credit_used:
                    generationCredit.credit,

                credit_refunded:
                    refundSuccessful

            }
        );

    }


    /*
     * =====================================================
     * GENERATION HISTORY
     * =====================================================
     */

    await createGenerationHistory({

        user,

        body,

        modelConfig,

        databaseModel,

        provider,

        providerCode,

        parameters,

        generationCredit,

        taskId

    });


    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return success(
        res,
        {

            user_id:
                user.id,

            model:
                modelConfig.id,

            model_id:
                modelConfig.id,

            model_name:
                modelConfig.name ||
                modelConfig.id,

            provider:
                provider.provider_name ||
                provider.name ||
                providerCode,

            provider_id:
                providerCode,

            resolution:
                generationCredit.resolution,

            credit_base:
                generationCredit.credit_base,

            discount_percent:
                generationCredit.discount_percent,

            credit_used:
                generationCredit.credit,

            remaining_credits:
                remainingCredits,

            taskId,

            task_id:
                taskId,

            jobId:
                taskId,

            provider_response:
                safeTask,

            model_database_id:
                databaseModel?.id ||
                null

        }
    );

}
