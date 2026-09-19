/**
 * =========================================================
 * GEN-Z.AI
 * MODEL CONFIG API
 * ---------------------------------------------------------
 * Endpoint:
 *   GET /api/model-config
 *   GET /api/model-config?model_id=grok-imagine/image-to-video
 *
 * Tanggung jawab:
 * - Authenticate user
 * - Membaca model aktif dari tabel `models`
 * - Membaca provider dari tabel `providers`
 * - Memastikan provider aktif
 * - Memuat adapter model dari folder `models/`
 * - Menggabungkan konfigurasi database + adapter
 *
 * Tidak menggunakan:
 * - kie_models
 * - kie_workflows
 * - kie_workflow_variants
 * - kie_parameters
 * - kie_constraints
 * - kie_dependencies
 * - kie_pricing
 *
 * =========================================================
 */

import grokImagineImageToVideo from "../models/grok-imagine-image-to-video/index.js";

/* =========================================================
   ENVIRONMENT
========================================================= */

const SUPABASE_URL = String(process.env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

const SUPABASE_SERVICE_ROLE_KEY = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
).trim();

/* =========================================================
   MODEL REGISTRY
========================================================= */

/*
 * Registry ini sengaja statis untuk adapter yang tersedia
 * di source code.
 *
 * Data model tetap berasal dari Supabase.
 *
 * Artinya:
 * - Supabase menentukan model yang aktif
 * - Registry menentukan adapter API yang digunakan
 */
const MODEL_REGISTRY = {
    "grok-imagine/image-to-video": grokImagineImageToVideo
};

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function json(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    return res.end(JSON.stringify(data));
}

function success(res, data = {}) {
    return json(res, 200, {
        success: true,
        ...data
    });
}

function error(res, statusCode, message, extra = {}) {
    return json(res, statusCode, {
        success: false,
        error: message,
        ...extra
    });
}

/* =========================================================
   SUPABASE REQUEST
========================================================= */

async function supabaseRequest(path, options = {}) {
    if (!SUPABASE_URL) {
        throw new Error("SUPABASE_URL is not configured");
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    const response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();

    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const message =
            typeof data === "object" && data !== null
                ? data.message ||
                  data.error_description ||
                  data.error ||
                  `Supabase request failed with status ${response.status}`
                : `Supabase request failed with status ${response.status}`;

        const err = new Error(message);
        err.status = response.status;
        err.data = data;

        throw err;
    }

    return data;
}

/* =========================================================
   AUTHENTICATE USER
========================================================= */

async function authenticateUser(req) {
    const authorization = String(
        req.headers?.authorization ||
        req.headers?.Authorization ||
        ""
    ).trim();

    if (!authorization) {
        throw Object.assign(
            new Error("Authorization header is required"),
            { status: 401 }
        );
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        throw Object.assign(
            new Error("Invalid Authorization header"),
            { status: 401 }
        );
    }

    const accessToken = match[1].trim();

    if (!accessToken) {
        throw Object.assign(
            new Error("Access token is missing"),
            { status: 401 }
        );
    }

    const user = await supabaseRequest("/auth/v1/user", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY
        }
    });

    if (!user || !user.id) {
        throw Object.assign(
            new Error("Invalid or expired session"),
            { status: 401 }
        );
    }

    return user;
}

/* =========================================================
   QUERY PARAMETER
========================================================= */

function getQueryModelId(req) {
    const url = new URL(
        req.url || "/api/model-config",
        "http://localhost"
    );

    const modelId = url.searchParams.get("model_id");

    if (!modelId) {
        return null;
    }

    return modelId.trim();
}

/* =========================================================
   ARRAY NORMALIZER
========================================================= */

function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value === "string") {
        const trimmed = value.trim();

        if (!trimmed) {
            return [];
        }

        /*
         * PostgreSQL array:
         * {"2:3","9:16"}
         */
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            const content = trimmed.slice(1, -1).trim();

            if (!content) {
                return [];
            }

            return content
                .split(",")
                .map(item =>
                    item
                        .trim()
                        .replace(/^"(.*)"$/, "$1")
                )
                .filter(Boolean);
        }

        /*
         * JSON array
         */
        if (
            trimmed.startsWith("[") &&
            trimmed.endsWith("]")
        ) {
            try {
                const parsed = JSON.parse(trimmed);

                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {
                // lanjut ke comma separated
            }
        }

        /*
         * Comma separated
         */
        return trimmed
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    return [];
}

/* =========================================================
   NUMBER NORMALIZER
========================================================= */

function normalizeNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

/* =========================================================
   BOOLEAN NORMALIZER
========================================================= */

function normalizeBoolean(value, fallback = false) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (normalized === "true") {
            return true;
        }

        if (normalized === "false") {
            return false;
        }
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    return fallback;
}

/* =========================================================
   PARAMETER SERIALIZER
========================================================= */

/*
 * Adapter parameter metadata harus aman dikirim ke browser.
 *
 * Function validator / function callback tidak dikirim.
 */
function serializeParameters(parameters) {
    if (!parameters) {
        return [];
    }

    /*
     * Jika adapter mengembalikan array parameter.
     */
    if (Array.isArray(parameters)) {
        return parameters.map(parameter => {
            if (
                !parameter ||
                typeof parameter !== "object"
            ) {
                return parameter;
            }

            const output = {};

            for (const [key, value] of Object.entries(parameter)) {
                if (typeof value === "function") {
                    continue;
                }

                if (key === "validate") {
                    continue;
                }

                output[key] = value;
            }

            return output;
        });
    }

    /*
     * Jika adapter menggunakan object:
     *
     * {
     *   prompt: {...},
     *   duration: {...}
     * }
     */
    if (
        typeof parameters === "object" &&
        !Array.isArray(parameters)
    ) {
        const output = {};

        for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === "function") {
                continue;
            }

            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value)
            ) {
                const item = {};

                for (const [subKey, subValue] of Object.entries(value)) {
                    if (typeof subValue === "function") {
                        continue;
                    }

                    if (subKey === "validate") {
                        continue;
                    }

                    item[subKey] = subValue;
                }

                output[key] = item;
                continue;
            }

            output[key] = value;
        }

        return output;
    }

    return [];
}

/* =========================================================
   LOAD MODEL
========================================================= */

async function loadModel(modelId) {
    /*
     * Jangan gunakan:
     *
     * model_id=eq=${encodeURIComponent(modelId)}
     *
     * karena supabaseRequest menggunakan URL secara langsung.
     *
     * encodeURIComponent di sini bisa menyebabkan:
     *
     * %2F
     *
     * lalu encoding ulang menjadi:
     *
     * %252F
     *
     * Manusia menciptakan URL encoding lalu membuat URL
     * encoding lagi. Sebuah tradisi teknologi yang tak perlu.
     */

    const params = new URLSearchParams();

    params.set("select", "*");
    params.set("status", "eq.active");

    /*
     * URLSearchParams akan melakukan encoding sendiri.
     */
    params.set("model_id", `eq.${modelId}`);

    params.set("limit", "1");

    const models = await supabaseRequest(
        `/rest/v1/models?${params.toString()}`,
        {
            method: "GET"
        }
    );

    if (!Array.isArray(models) || models.length === 0) {
        return null;
    }

    return models[0];
}

/* =========================================================
   LOAD PROVIDER
========================================================= */

async function loadProvider(providerDatabaseId) {
    if (!providerDatabaseId) {
        return null;
    }

    const params = new URLSearchParams();

    params.set("select", "*");
    params.set("id", `eq.${providerDatabaseId}`);
    params.set("limit", "1");

    const providers = await supabaseRequest(
        `/rest/v1/providers?${params.toString()}`,
        {
            method: "GET"
        }
    );

    if (!Array.isArray(providers) || providers.length === 0) {
        return null;
    }

    return providers[0];
}

/* =========================================================
   BUILD MODEL RESPONSE
========================================================= */

function buildModelResponse(model, provider, adapter) {
    const adapterConfig = adapter?.config || {};
    const adapterParameters = adapter?.parameters || [];

    const supportedRatios = normalizeArray(
        model.supported_ratios
    );

    const supportedResolutions = normalizeArray(
        model.supported_resolutions
    );

    const minDuration = normalizeNumber(
        model.min_duration
    );

    const maxDuration = normalizeNumber(
        model.max_duration
    );

    const creditCost = normalizeNumber(
        model.credit_cost
    );

    const discountPercent = normalizeNumber(
        model.discount_percent
    );

    const creditFinal = normalizeNumber(
        model.credit_final
    );

    return {
        id: model.id,

        model_id: model.model_id,

        model_name:
            model.model_name ||
            adapterConfig.name ||
            model.model_id,

        description:
            model.description ||
            "",

        provider: {
            id: provider?.id || null,

            provider_id:
                provider?.provider_id ||
                null,

            provider_name:
                provider?.provider_name ||
                provider?.name ||
                adapterConfig.providerName ||
                "",

            description:
                provider?.description ||
                "",

            status:
                provider?.status ||
                ""
        },

        pricing: {
            credit_cost: creditCost,
            discount_percent: discountPercent,
            credit_final: creditFinal
        },

        duration: {
            min: minDuration,
            max: maxDuration
        },

        supported_ratios: supportedRatios,

        supported_resolutions: supportedResolutions,

        status: model.status || "inactive",

        type:
            adapterConfig.type ||
            "unknown",

        parameters: serializeParameters(
            adapterParameters
        ),

        api: {
            createTask:
                adapterConfig.api?.createTask ||
                null,

            queryTask:
                adapterConfig.api?.queryTask ||
                null
        }
    };
}

/* =========================================================
   HANDLER
========================================================= */

export default async function handler(req, res) {
    /*
     * -------------------------------------------------------
     * METHOD
     * -------------------------------------------------------
     */

    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");

        return error(
            res,
            405,
            "Method not allowed"
        );
    }

    /*
     * -------------------------------------------------------
     * AUTH
     * -------------------------------------------------------
     */

    try {
        await authenticateUser(req);
    } catch (err) {
        return error(
            res,
            err.status || 401,
            err.message || "Unauthorized"
        );
    }

    /*
     * -------------------------------------------------------
     * MODEL ID
     * -------------------------------------------------------
     */

    const requestedModelId =
        getQueryModelId(req);

    /*
     * -------------------------------------------------------
     * SINGLE MODEL
     * -------------------------------------------------------
     */

    if (requestedModelId) {
        let model;

        try {
            model = await loadModel(
                requestedModelId
            );
        } catch (err) {
            console.error(
                "[model-config] Failed to load model:",
                err
            );

            return error(
                res,
                500,
                "Failed to load model configuration"
            );
        }

        if (!model) {
            return error(
                res,
                404,
                "Active model not found",
                {
                    model_id: requestedModelId
                }
            );
        }

        /*
         * Adapter harus tersedia di source code.
         */
        const adapter =
            MODEL_REGISTRY[model.model_id];

        if (!adapter) {
            return error(
                res,
                500,
                "Model adapter is not registered",
                {
                    model_id: model.model_id
                }
            );
        }

        /*
         * Provider berdasarkan:
         *
         * models.provider_id
         *       ↓
         * providers.id
         */
        let provider;

        try {
            provider = await loadProvider(
                model.provider_id
            );
        } catch (err) {
            console.error(
                "[model-config] Failed to load provider:",
                err
            );

            return error(
                res,
                500,
                "Failed to load provider configuration"
            );
        }

        if (!provider) {
            return error(
                res,
                404,
                "Provider not found",
                {
                    model_id: model.model_id
                }
            );
        }

        /*
         * Model aktif tetapi provider tidak aktif
         * tidak boleh digunakan.
         */
        if (
            String(provider.status || "")
                .toLowerCase() !== "active"
        ) {
            return error(
                res,
                409,
                "Model provider is not active",
                {
                    model_id: model.model_id,
                    provider_id:
                        provider.provider_id ||
                        null
                }
            );
        }

        /*
         * Pastikan adapter menggunakan provider
         * yang sama dengan database.
         */
        if (
            adapter.config?.providerId &&
            provider.provider_id &&
            adapter.config.providerId !==
                provider.provider_id
        ) {
            return error(
                res,
                409,
                "Model provider configuration mismatch",
                {
                    model_id: model.model_id,
                    database_provider_id:
                        provider.provider_id,
                    adapter_provider_id:
                        adapter.config.providerId
                }
            );
        }

        return success(
            res,
            {
                model: buildModelResponse(
                    model,
                    provider,
                    adapter
                )
            }
        );
    }

    /*
     * -------------------------------------------------------
     * ALL ACTIVE MODELS
     * -------------------------------------------------------
     *
     * Dipakai oleh halaman yang membutuhkan daftar model.
     */

    try {
        const params = new URLSearchParams();

        params.set("select", "*");
        params.set("status", "eq.active");
        params.set("order", "model_name.asc");

        const models = await supabaseRequest(
            `/rest/v1/models?${params.toString()}`,
            {
                method: "GET"
            }
        );

        if (!Array.isArray(models)) {
            return success(res, {
                models: []
            });
        }

        const result = [];

        for (const model of models) {
            const adapter =
                MODEL_REGISTRY[model.model_id];

            /*
             * Model database tanpa adapter tidak
             * ditampilkan sebagai model siap generate.
             */
            if (!adapter) {
                continue;
            }

            let provider = null;

            try {
                provider = await loadProvider(
                    model.provider_id
                );
            } catch (err) {
                console.error(
                    `[model-config] Failed loading provider for ${model.model_id}:`,
                    err
                );

                continue;
            }

            if (!provider) {
                continue;
            }

            if (
                String(provider.status || "")
                    .toLowerCase() !== "active"
            ) {
                continue;
            }

            if (
                adapter.config?.providerId &&
                provider.provider_id &&
                adapter.config.providerId !==
                    provider.provider_id
            ) {
                continue;
            }

            result.push(
                buildModelResponse(
                    model,
                    provider,
                    adapter
                )
            );
        }

        return success(res, {
            models: result
        });
    } catch (err) {
        console.error(
            "[model-config] Failed to load models:",
            err
        );

        return error(
            res,
            500,
            "Failed to load model configurations"
        );
    }
}
