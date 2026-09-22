/* =========================================================
   GEN-Z.AI
   GENERATE STATUS API
   ---------------------------------------------------------
   File:
   api/generate-status.js

   Tanggung jawab:
   - Auth user
   - Load model
   - Resolve provider
   - Load encrypted provider credential
   - Decrypt credential
   - Resolve model adapter
   - Query provider task
   - Normalize provider response
   - Update generation_history
   - Verify update
   - Return status + diagnostics

   CATATAN:
   Adapter Grok menggunakan DEFAULT EXPORT dari:
   ../models/grok-imagine-image-to-video/index.js

   Jangan mengubah generate.js / generate-polling.js dari file ini.
   ========================================================= */

import crypto from "crypto";

import grokImagineImageToVideo
    from "../models/grok-imagine-image-to-video/index.js";


/* =========================================================
   CONSTANTS
   ========================================================= */

const MODEL_REGISTRY = [
    grokImagineImageToVideo
];

const COMPLETED_STATES = new Set([
    "completed",
    "complete",
    "success",
    "succeeded",
    "finished",
    "done"
]);

const FAILED_STATES = new Set([
    "failed",
    "failure",
    "error",
    "cancelled",
    "canceled",
    "rejected",
    "timeout",
    "timed_out"
]);

const PROCESSING_STATES = new Set([
    "processing",
    "running",
    "queued",
    "queue",
    "waiting",
    "pending",
    "submitted",
    "created",
    "in_progress",
    "in-progress"
]);


/* =========================================================
   ENVIRONMENT
   ========================================================= */

const SUPABASE_URL = String(
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
).replace(/\/+$/, "");

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";

const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

const CREDENTIAL_ENCRYPTION_KEY =
    process.env.CREDENTIAL_ENCRYPTION_KEY ||
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    "";

const HISTORY_TABLE = "generation_history";
const MODEL_TABLE = "models";
const PROVIDER_TABLE = "providers";
const CREDENTIAL_TABLE = "provider_credentials";


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function json(res, status, body) {
    res.status(status).json(body);
}


function cleanString(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}


function lower(value) {
    return cleanString(value).toLowerCase();
}


function normalizeIdentifier(value) {
    return lower(value)
        .replace(/^["']|["']$/g, "")
        .replace(/\s+/g, "")
        .replace(/\\/g, "")
        .replace(/:+/g, ":")
        .replace(/\/+/g, "/");
}


function safeJson(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return "[unserializable]";
    }
}


function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}


function firstDefined(...values) {
    for (const value of values) {
        if (
            value !== undefined &&
            value !== null &&
            cleanString(value) !== ""
        ) {
            return value;
        }
    }

    return null;
}


/* =========================================================
   SUPABASE HELPERS
   ========================================================= */

function supabaseHeaders(extra = {}) {
    const key =
        SUPABASE_SERVICE_ROLE_KEY ||
        SUPABASE_ANON_KEY;

    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...extra
    };
}


async function supabaseRequest(
    path,
    {
        method = "GET",
        body = undefined,
        headers = {}
    } = {}
) {
    if (!SUPABASE_URL) {
        throw new Error(
            "SUPABASE_URL belum dikonfigurasi."
        );
    }

    const response = await fetch(
        `${SUPABASE_URL}${path}`,
        {
            method,
            headers: supabaseHeaders(headers),
            body:
                body === undefined
                    ? undefined
                    : JSON.stringify(body)
        }
    );

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
        const error = new Error(
            `Supabase request gagal: ${response.status}`
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return {
        ok: true,
        status: response.status,
        data
    };
}


/* =========================================================
   URL ENCODING
   ========================================================= */

function eqFilter(value) {
    return encodeURIComponent(
        `eq.${value}`
    );
}


/* =========================================================
   AUTH
   ========================================================= */

async function authenticateUser(req) {
    const authorization =
        req.headers?.authorization ||
        req.headers?.Authorization ||
        "";

    if (!authorization) {
        throw new Error(
            "Authorization header tidak ditemukan."
        );
    }

    const match =
        authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        throw new Error(
            "Bearer token tidak valid."
        );
    }

    const accessToken =
        cleanString(match[1]);

    if (!accessToken) {
        throw new Error(
            "Access token kosong."
        );
    }

    if (!SUPABASE_URL) {
        throw new Error(
            "SUPABASE_URL belum dikonfigurasi."
        );
    }

    const response = await fetch(
        `${SUPABASE_URL}/auth/v1/user`,
        {
            method: "GET",
            headers: {
                apikey:
                    SUPABASE_ANON_KEY ||
                    SUPABASE_SERVICE_ROLE_KEY,
                Authorization:
                    `Bearer ${accessToken}`
            }
        }
    );

    const text =
        await response.text();

    let data = null;

    try {
        data = text
            ? JSON.parse(text)
            : null;
    } catch {
        data = null;
    }

    if (!response.ok || !data?.id) {
        const error = new Error(
            "User tidak terautentikasi."
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return {
        id: data.id,
        email:
            data.email ||
            null,
        accessToken
    };
}


/* =========================================================
   MODEL LOADER
   ========================================================= */

async function loadModel(modelId) {
    const cleanModelId =
        cleanString(modelId);

    if (!cleanModelId) {
        throw new Error(
            "model_id wajib diisi."
        );
    }

    const response =
        await supabaseRequest(
            `/rest/v1/${MODEL_TABLE}` +
            `?model_id=${eqFilter(cleanModelId)}` +
            `&select=*` +
            `&limit=1`
        );

    const rows =
        Array.isArray(response.data)
            ? response.data
            : [];

    if (!rows.length) {
        throw new Error(
            `Model "${cleanModelId}" tidak ditemukan di database.`
        );
    }

    return rows[0];
}


/* =========================================================
   PROVIDER RESOLUTION
   ========================================================= */

async function loadProvider(providerReference) {
    const reference =
        cleanString(providerReference);

    if (!reference) {
        throw new Error(
            "Provider model tidak ditemukan."
        );
    }

    const attempts = [];

    /*
     * 1. Cari berdasarkan id
     */
    attempts.push(
        `/rest/v1/${PROVIDER_TABLE}` +
        `?id=${eqFilter(reference)}` +
        `&select=*` +
        `&limit=1`
    );

    /*
     * 2. Cari berdasarkan provider_id
     */
    attempts.push(
        `/rest/v1/${PROVIDER_TABLE}` +
        `?provider_id=${eqFilter(reference)}` +
        `&select=*` +
        `&limit=1`
    );

    /*
     * 3. Cari berdasarkan provider name
     */
    attempts.push(
        `/rest/v1/${PROVIDER_TABLE}` +
        `?provider_name=${eqFilter(reference)}` +
        `&select=*` +
        `&limit=1`
    );

    for (const path of attempts) {
        try {
            const response =
                await supabaseRequest(path);

            const rows =
                Array.isArray(response.data)
                    ? response.data
                    : [];

            if (rows.length) {
                return rows[0];
            }
        } catch {
            /*
             * Beberapa schema tidak memiliki
             * salah satu kolom pencarian.
             * Lanjutkan ke metode berikutnya.
             */
        }
    }

    throw new Error(
        `Provider "${reference}" tidak ditemukan.`
    );
}


/* =========================================================
   PROVIDER REFERENCE
   ========================================================= */

function getProviderReference(model) {
    return firstDefined(
        model?.provider_id,
        model?.providerId,
        model?.provider,
        model?.provider_name,
        model?.providerName
    );
}


/* =========================================================
   CREDENTIAL FIELD RESOLUTION
   ========================================================= */

function getCredentialValue(row) {
    if (!row || !isObject(row)) {
        return "";
    }

    /*
     * Prioritaskan field yang umum digunakan.
     */
    const candidates = [
        row.api_key,
        row.apiKey,
        row.secret_key,
        row.secretKey,
        row.credential,
        row.credentials,
        row.encrypted_api_key,
        row.encryptedApiKey,
        row.encrypted_key,
        row.encryptedKey,
        row.encrypted_value,
        row.encryptedValue,
        row.value,
        row.data
    ];

    for (const value of candidates) {
        if (
            value !== undefined &&
            value !== null &&
            cleanString(value) !== ""
        ) {
            return value;
        }
    }

    /*
     * Fallback:
     * cari property yang namanya berkaitan
     * dengan credential / key / secret.
     */
    for (const [key, value] of Object.entries(row)) {
        const name =
            lower(key);

        if (
            name.includes("credential") ||
            name.includes("encrypted") ||
            name.includes("api_key") ||
            name.includes("apikey") ||
            name === "key" ||
            name.includes("secret")
        ) {
            if (
                value !== undefined &&
                value !== null &&
                cleanString(value) !== ""
            ) {
                return value;
            }
        }
    }

    return "";
}


/* =========================================================
   LOAD PROVIDER CREDENTIAL
   ========================================================= */

async function loadProviderCredential(provider) {
    const providerId =
        firstDefined(
            provider?.id,
            provider?.provider_id,
            provider?.providerId
        );

    const providerName =
        firstDefined(
            provider?.provider_name,
            provider?.providerName,
            provider?.name
        );

    const queries = [];

    if (providerId) {
        queries.push(
            `/rest/v1/${CREDENTIAL_TABLE}` +
            `?provider_id=${eqFilter(providerId)}` +
            `&select=*` +
            `&limit=20`
        );

        queries.push(
            `/rest/v1/${CREDENTIAL_TABLE}` +
            `?providerId=${eqFilter(providerId)}` +
            `&select=*` +
            `&limit=20`
        );
    }

    if (providerName) {
        queries.push(
            `/rest/v1/${CREDENTIAL_TABLE}` +
            `?provider_name=${eqFilter(providerName)}` +
            `&select=*` +
            `&limit=20`
        );
    }

    let allRows = [];

    for (const path of queries) {
        try {
            const response =
                await supabaseRequest(path);

            const rows =
                Array.isArray(response.data)
                    ? response.data
                    : [];

            if (rows.length) {
                allRows = [
                    ...allRows,
                    ...rows
                ];
            }
        } catch {
            /*
             * Schema fallback.
             */
        }
    }

    /*
     * Hilangkan duplicate berdasarkan id.
     */
    const uniqueRows =
        Array.from(
            new Map(
                allRows.map(
                    (row, index) => [
                        row?.id ||
                        `${index}:${safeJson(row)}`,
                        row
                    ]
                )
            ).values()
        );

    if (!uniqueRows.length) {
        throw new Error(
            `Credential provider "${providerName || providerId}" tidak ditemukan.`
        );
    }

    /*
     * Prioritaskan credential aktif bila field tersedia.
     */
    const activeRow =
        uniqueRows.find((row) => {
            const values = [
                row?.is_active,
                row?.active,
                row?.enabled,
                row?.status
            ];

            return values.some((value) => {
                if (
                    value === true ||
                    value === 1
                ) {
                    return true;
                }

                const text =
                    lower(value);

                return (
                    text === "active" ||
                    text === "enabled" ||
                    text === "true"
                );
            });
        }) ||
        uniqueRows[0];

    const credential =
        getCredentialValue(activeRow);

    if (!credential) {
        throw new Error(
            "Credential provider ditemukan tetapi nilai credential kosong."
        );
    }

    return {
        row: activeRow,
        encryptedCredential: credential
    };
}


/* =========================================================
   ENCRYPTION KEY
   ========================================================= */

function getEncryptionKey() {
    if (!CREDENTIAL_ENCRYPTION_KEY) {
        throw new Error(
            "CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi."
        );
    }

    /*
     * 32-byte hex
     */
    if (
        /^[0-9a-fA-F]{64}$/.test(
            CREDENTIAL_ENCRYPTION_KEY
        )
    ) {
        return Buffer.from(
            CREDENTIAL_ENCRYPTION_KEY,
            "hex"
        );
    }

    /*
     * 32-byte base64
     */
    try {
        const base64 =
            Buffer.from(
                CREDENTIAL_ENCRYPTION_KEY,
                "base64"
            );

        if (base64.length === 32) {
            return base64;
        }
    } catch {
        /* fallback */
    }

    /*
     * UTF-8 32 bytes
     */
    const utf8 =
        Buffer.from(
            CREDENTIAL_ENCRYPTION_KEY,
            "utf8"
        );

    if (utf8.length === 32) {
        return utf8;
    }

    /*
     * SHA-256 fallback untuk secret berbasis string.
     */
    return crypto
        .createHash("sha256")
        .update(
            CREDENTIAL_ENCRYPTION_KEY
        )
        .digest();
}


/* =========================================================
   DECRYPT CREDENTIAL
   ========================================================= */

function decryptCredential(value) {
    const encrypted =
        cleanString(value);

    if (!encrypted) {
        throw new Error(
            "Encrypted credential kosong."
        );
    }

    /*
     * Jika sudah berupa JSON object,
     * coba ambil value secara langsung.
     */
    if (
        encrypted.startsWith("{") &&
        encrypted.endsWith("}")
    ) {
        try {
            const parsed =
                JSON.parse(encrypted);

            const direct =
                firstDefined(
                    parsed?.api_key,
                    parsed?.apiKey,
                    parsed?.key,
                    parsed?.secret,
                    parsed?.value,
                    parsed?.credential
                );

            if (direct) {
                return cleanString(direct);
            }
        } catch {
            /* lanjut decrypt */
        }
    }

    /*
     * Format umum:
     * iv:authTag:ciphertext
     *
     * atau:
     * iv.authTag.ciphertext
     */
    const parts =
        encrypted.includes(":")
            ? encrypted.split(":")
            : encrypted.split(".");

    if (parts.length >= 3) {
        const key =
            getEncryptionKey();

        const iv =
            Buffer.from(
                parts[0],
                "hex"
            );

        const authTag =
            Buffer.from(
                parts[1],
                "hex"
            );

        const ciphertext =
            Buffer.from(
                parts
                    .slice(2)
                    .join(
                        encrypted.includes(":")
                            ? ":"
                            : "."
                    ),
                "hex"
            );

        if (
            iv.length &&
            authTag.length &&
            ciphertext.length
        ) {
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

            return decrypted
                .toString("utf8")
                .trim();
        }
    }

    /*
     * Format JSON encrypted object:
     * {
     *   iv,
     *   authTag,
     *   encrypted
     * }
     */
    try {
        const parsed =
            JSON.parse(encrypted);

        const ivValue =
            firstDefined(
                parsed?.iv,
                parsed?.initializationVector
            );

        const authTagValue =
            firstDefined(
                parsed?.authTag,
                parsed?.auth_tag,
                parsed?.tag
            );

        const cipherValue =
            firstDefined(
                parsed?.encrypted,
                parsed?.ciphertext,
                parsed?.cipher,
                parsed?.data
            );

        if (
            ivValue &&
            authTagValue &&
            cipherValue
        ) {
            const key =
                getEncryptionKey();

            const decode = (input) => {
                const text =
                    cleanString(input);

                if (
                    /^[0-9a-fA-F]+$/.test(text) &&
                    text.length % 2 === 0
                ) {
                    return Buffer.from(
                        text,
                        "hex"
                    );
                }

                return Buffer.from(
                    text,
                    "base64"
                );
            };

            const iv =
                decode(ivValue);

            const authTag =
                decode(authTagValue);

            const ciphertext =
                decode(cipherValue);

            const decipher =
                crypto.createDecipheriv(
                    "aes-256-gcm",
                    key,
                    iv
                );

            decipher.setAuthTag(
                authTag
            );

            return Buffer.concat([
                decipher.update(
                    ciphertext
                ),
                decipher.final()
            ])
                .toString("utf8")
                .trim();
        }
    } catch {
        /*
         * Bukan encrypted JSON format.
         */
    }

    /*
     * Jangan menganggap encrypted string
     * sebagai API key secara diam-diam.
     *
     * Namun bila credential memang tersimpan
     * sebagai plaintext API key, gunakan langsung.
     */
    if (
        encrypted.startsWith("sk-") ||
        encrypted.startsWith("kie_") ||
        encrypted.length >= 20
    ) {
        return encrypted;
    }

    throw new Error(
        "Credential tidak dapat didekripsi."
    );
}


/* =========================================================
   ADAPTER IDENTIFIERS
   ========================================================= */

function getAdapterCandidates(adapter) {
    if (!adapter) {
        return [];
    }

    const config =
        adapter.config || {};

    const candidates = [
        adapter.modelId,
        adapter.model_id,
        adapter.id,
        adapter.name,
        adapter.modelName,
        adapter.model_name,
        adapter.slug,
        adapter.modelSlug,
        adapter.model_slug,

        config.modelId,
        config.model_id,
        config.id,
        config.name,
        config.modelName,
        config.model_name,
        config.slug,
        config.modelSlug,
        config.model_slug,

        ...(Array.isArray(adapter.modelIds)
            ? adapter.modelIds
            : []),

        ...(Array.isArray(adapter.model_ids)
            ? adapter.model_ids
            : []),

        ...(Array.isArray(config.modelIds)
            ? config.modelIds
            : []),

        ...(Array.isArray(config.model_ids)
            ? config.model_ids
            : [])
    ];

    return candidates
        .filter(
            (value) =>
                value !== undefined &&
                value !== null &&
                cleanString(value) !== ""
        )
        .map(cleanString);
}


/* =========================================================
   ADAPTER LOOKUP
   ========================================================= */

function findAdapter(modelId) {
    const target =
        normalizeIdentifier(modelId);

    if (!target) {
        return null;
    }

    /*
     * -------------------------------------------------------
     * 1. Direct registry match
     * -------------------------------------------------------
     */
    for (const adapter of MODEL_REGISTRY) {
        if (
            !adapter ||
            typeof adapter.queryTask !== "function"
        ) {
            continue;
        }

        const candidates =
            getAdapterCandidates(adapter);

        if (
            candidates.some(
                (candidate) =>
                    normalizeIdentifier(
                        candidate
                    ) === target
            )
        ) {
            return adapter;
        }
    }

    /*
     * -------------------------------------------------------
     * 2. Explicit model mapping
     *
     * index.js Grok menggunakan DEFAULT EXPORT:
     *
     * export default model;
     *
     * Jadi adapter sudah tersedia langsung di
     * grokImagineImageToVideo.
     * -------------------------------------------------------
     */
    if (
        target ===
        normalizeIdentifier(
            "grok-imagine/image-to-video"
        )
    ) {
        if (
            grokImagineImageToVideo &&
            typeof grokImagineImageToVideo.queryTask ===
                "function"
        ) {
            return grokImagineImageToVideo;
        }
    }

    /*
     * -------------------------------------------------------
     * 3. Fallback identifier matching
     * -------------------------------------------------------
     */
    const compactTarget =
        target
            .replace(/[^a-z0-9]/g, "");

    for (const adapter of MODEL_REGISTRY) {
        if (
            !adapter ||
            typeof adapter.queryTask !== "function"
        ) {
            continue;
        }

        const candidates =
            getAdapterCandidates(adapter);

        for (const candidate of candidates) {
            const compactCandidate =
                normalizeIdentifier(
                    candidate
                ).replace(
                    /[^a-z0-9]/g,
                    ""
                );

            if (
                compactCandidate &&
                compactCandidate ===
                    compactTarget
            ) {
                return adapter;
            }
        }
    }

    return null;
}


/* =========================================================
   ADAPTER DIAGNOSTICS
   ========================================================= */

function getAdapterDiagnostics() {
    return MODEL_REGISTRY.map(
        (adapter) => ({
            modelId:
                adapter?.modelId ??
                null,

            model_id:
                adapter?.model_id ??
                null,

            id:
                adapter?.id ??
                null,

            name:
                adapter?.name ??
                null,

            modelName:
                adapter?.modelName ??
                null,

            has_queryTask:
                typeof adapter?.queryTask ===
                    "function"
        })
    );
}


/* =========================================================
   PROVIDER TASK QUERY
   ========================================================= */

async function queryProviderTask(
    adapter,
    taskId,
    providerApiKey
) {
    if (
        !adapter ||
        typeof adapter.queryTask !==
            "function"
    ) {
        throw new Error(
            "Adapter queryTask tidak tersedia."
        );
    }

    const result =
        await adapter.queryTask(
            taskId,
            providerApiKey
        );

    return result;
}


/* =========================================================
   DEEP VALUE FINDER
   ========================================================= */

function findDeepValue(
    value,
    keys,
    depth = 0
) {
    if (
        depth > 8 ||
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value !== "object"
    ) {
        return null;
    }

    const wanted =
        new Set(
            keys.map(lower)
        );

    for (const [
        key,
        child
    ] of Object.entries(value)) {
        if (
            wanted.has(
                lower(key)
            )
        ) {
            if (
                child !== undefined &&
                child !== null
            ) {
                return child;
            }
        }
    }

    for (const child of Object.values(value)) {
        const found =
            findDeepValue(
                child,
                keys,
                depth + 1
            );

        if (
            found !== null &&
            found !== undefined
        ) {
            return found;
        }
    }

    return null;
}


/* =========================================================
   RESULT URL EXTRACTION
   ========================================================= */

function collectUrls(
    value,
    output = [],
    depth = 0
) {
    if (
        depth > 10 ||
        value === null ||
        value === undefined
    ) {
        return output;
    }

    if (
        typeof value === "string"
    ) {
        const text =
            value.trim();

        if (
            /^https?:\/\//i.test(text)
        ) {
            output.push(text);
        }

        return output;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectUrls(
                item,
                output,
                depth + 1
            );
        }

        return output;
    }

    if (
        typeof value === "object"
    ) {
        for (const [
            key,
            child
        ] of Object.entries(value)) {
            const keyName =
                lower(key);

            if (
                keyName.includes("url") ||
                keyName.includes("result") ||
                keyName.includes("output") ||
                keyName.includes("video") ||
                keyName.includes("image")
            ) {
                collectUrls(
                    child,
                    output,
                    depth + 1
                );
            } else if (
                depth < 5
            ) {
                collectUrls(
                    child,
                    output,
                    depth + 1
                );
            }
        }
    }

    return output;
}


/* =========================================================
   UNIQUE URLS
   ========================================================= */

function uniqueUrls(urls) {
    return Array.from(
        new Set(
            urls
                .filter(Boolean)
                .map(cleanString)
                .filter(
                    (url) =>
                        /^https?:\/\//i.test(
                            url
                        )
                )
        )
    );
}


/* =========================================================
   NORMALIZE PROVIDER RESULT
   ========================================================= */

function normalizeProviderResult(
    raw,
    taskId
) {
    const providerState =
        firstDefined(
            findDeepValue(
                raw,
                [
                    "provider_state",
                    "providerState",
                    "state",
                    "status"
                ]
            ),
            ""
        );

    const state =
        lower(providerState);

    const explicitCompleted =
        findDeepValue(
            raw,
            [
                "completed",
                "is_completed",
                "isCompleted",
                "success",
                "succeeded"
            ]
        );

    const explicitFailed =
        findDeepValue(
            raw,
            [
                "failed",
                "is_failed",
                "isFailed",
                "error"
            ]
        );

    const explicitProcessing =
        findDeepValue(
            raw,
            [
                "processing",
                "is_processing",
                "isProcessing",
                "pending",
                "waiting"
            ]
        );

    const resultUrls =
        uniqueUrls(
            collectUrls(
                raw,
                []
            )
        );

    let completed =
        COMPLETED_STATES.has(state);

    let failed =
        FAILED_STATES.has(state);

    let processing =
        PROCESSING_STATES.has(state);

    if (
        explicitCompleted === true
    ) {
        completed = true;
        failed = false;
        processing = false;
    }

    if (
        explicitFailed === true
    ) {
        failed = true;
        completed = false;
        processing = false;
    }

    if (
        explicitProcessing === true &&
        !completed &&
        !failed
    ) {
        processing = true;
    }

    /*
     * Provider KIE kadang mengembalikan success
     * dengan result URL tanpa state yang konsisten.
     */
    if (
        resultUrls.length &&
        !failed
    ) {
        completed = true;
        processing = false;
    }

    if (
        !completed &&
        !failed &&
        !processing
    ) {
        /*
         * Jika state kosong, anggap processing
         * agar polling tidak berhenti terlalu cepat.
         */
        processing = true;
    }

    let normalizedState =
        "processing";

    if (completed) {
        normalizedState =
            "completed";
    } else if (failed) {
        normalizedState =
            "failed";
    }

    const resolvedTaskId =
        firstDefined(
            findDeepValue(
                raw,
                [
                    "task_id",
                    "taskId",
                    "id"
                ]
            ),
            taskId
        );

    const resultJson =
        firstDefined(
            findDeepValue(
                raw,
                [
                    "resultJson",
                    "result_json"
                ]
            ),
            findDeepValue(
                raw,
                [
                    "result"
                ]
            )
        );

    return {
        raw,
        state: normalizedState,
        provider_state:
            providerState || null,
        task_id:
            cleanString(
                resolvedTaskId
            ),
        resultJson:
            resultJson || null,
        result_urls:
            resultUrls,
        processing,
        completed,
        failed
    };
}


/* =========================================================
   FIND HISTORY ROW
   ========================================================= */

async function findGenerationHistory(
    userId,
    taskId
) {
    const response =
        await supabaseRequest(
            `/rest/v1/${HISTORY_TABLE}` +
            `?user_id=${eqFilter(userId)}` +
            `&task_id=${eqFilter(taskId)}` +
            `&select=*` +
            `&order=created_at.desc` +
            `&limit=1`
        );

    const rows =
        Array.isArray(response.data)
            ? response.data
            : [];

    return rows[0] || null;
}


/* =========================================================
   HISTORY UPDATE
   ========================================================= */

async function updateGenerationHistory(
    historyId,
    normalized
) {
    if (!historyId) {
        throw new Error(
            "generation_history.id tidak ditemukan."
        );
    }

    const payload = {};

    if (normalized.completed) {
        payload.status =
            "completed";

        if (
            normalized.result_urls?.length
        ) {
            payload.result_url =
                normalized.result_urls[0];
        }

        payload.error_message = null;

        payload.completed_at =
            new Date().toISOString();
    } else if (normalized.failed) {
        payload.status =
            "failed";

        const errorMessage =
            firstDefined(
                findDeepValue(
                    normalized.raw,
                    [
                        "error_message",
                        "errorMessage",
                        "message",
                        "error"
                    ]
                ),
                "Provider gagal memproses task."
            );

        payload.error_message =
            cleanString(
                errorMessage
            );

        payload.completed_at =
            new Date().toISOString();
    } else {
        payload.status =
            "processing";
    }

    const response =
        await supabaseRequest(
            `/rest/v1/${HISTORY_TABLE}` +
            `?id=${eqFilter(historyId)}`,
            {
                method: "PATCH",
                headers: {
                    Prefer:
                        "return=representation"
                },
                body: payload
            }
        );

    const rows =
        Array.isArray(response.data)
            ? response.data
            : [];

    return {
        payload,
        rows
    };
}


/* =========================================================
   VERIFY HISTORY
   ========================================================= */

async function verifyGenerationHistory(
    historyId
) {
    const response =
        await supabaseRequest(
            `/rest/v1/${HISTORY_TABLE}` +
            `?id=${eqFilter(historyId)}` +
            `&select=*` +
            `&limit=1`
        );

    const rows =
        Array.isArray(response.data)
            ? response.data
            : [];

    return rows[0] || null;
}


/* =========================================================
   HISTORY SYNC
   ========================================================= */

async function syncGenerationHistory(
    userId,
    taskId,
    normalized
) {
    const history =
        await findGenerationHistory(
            userId,
            taskId
        );

    if (!history) {
        return {
            history_updated: false,
            history_matched: false,
            history_status: null,
            history_reason:
                "history_not_found",
            history_row_id: null
        };
    }

    /*
     * Jika task masih processing,
     * jangan menulis completed/failed.
     */
    if (
        normalized.processing &&
        !normalized.completed &&
        !normalized.failed
    ) {
        return {
            history_updated: false,
            history_matched: true,
            history_status:
                history.status || null,
            history_reason:
                "task_still_processing",
            history_row_id:
                history.id
        };
    }

    let updateResult;

    try {
        updateResult =
            await updateGenerationHistory(
                history.id,
                normalized
            );
    } catch (error) {
        return {
            history_updated: false,
            history_matched: true,
            history_status:
                history.status || null,
            history_reason:
                "history_update_exception",
            history_row_id:
                history.id,
            history_error:
                error?.message ||
                String(error),
            history_error_status:
                error?.status ||
                null,
            history_error_data:
                error?.data ||
                null
        };
    }

    /*
     * Verify database setelah PATCH.
     */
    let verified = null;

    try {
        verified =
            await verifyGenerationHistory(
                history.id
            );
    } catch (error) {
        return {
            history_updated: false,
            history_matched: true,
            history_status:
                history.status || null,
            history_reason:
                "history_verify_exception",
            history_row_id:
                history.id,
            history_error:
                error?.message ||
                String(error)
        };
    }

    const expectedStatus =
        normalized.completed
            ? "completed"
            : normalized.failed
                ? "failed"
                : "processing";

    const actualStatus =
        lower(
            verified?.status
        );

    const historyUpdated =
        actualStatus ===
        lower(expectedStatus);

    return {
        history_updated:
            historyUpdated,

        history_matched:
            true,

        history_status:
            actualStatus ||
            verified?.status ||
            null,

        history_reason:
            historyUpdated
                ? null
                : "history_status_not_changed_after_patch",

        history_row_id:
            history.id,

        history_database_status:
            verified?.status ||
            null,

        history_result_url:
            verified?.result_url ||
            null,

        history_completed_at:
            verified?.completed_at ||
            null,

        history_update_payload:
            updateResult?.payload ||
            null
    };
}


/* =========================================================
   HISTORY RETRY
   ========================================================= */

async function syncGenerationHistoryWithRetry(
    userId,
    taskId,
    normalized
) {
    let result =
        await syncGenerationHistory(
            userId,
            taskId,
            normalized
        );

    /*
     * Retry hanya untuk terminal task yang
     * belum berhasil masuk ke History.
     */
    if (
        (normalized.completed ||
            normalized.failed) &&
        !result.history_updated
    ) {
        await new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    150
                )
        );

        const retryResult =
            await syncGenerationHistory(
                userId,
                taskId,
                normalized
            );

        result = {
            ...retryResult,
            history_retry: true
        };
    } else {
        result = {
            ...result,
            history_retry: false
        };
    }

    return result;
}


/* =========================================================
   REQUEST VALIDATION
   ========================================================= */

function getRequestBody(req) {
    if (
        req.body &&
        typeof req.body === "object"
    ) {
        return req.body;
    }

    return {};
}


/* =========================================================
   MAIN HANDLER
   ========================================================= */

export default async function handler(
    req,
    res
) {
    /*
     * -------------------------------------------------------
     * Method
     * -------------------------------------------------------
     */
    if (req.method !== "POST") {
        res.setHeader(
            "Allow",
            "POST"
        );

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

    /*
     * -------------------------------------------------------
     * Environment check
     * -------------------------------------------------------
     */
    if (
        !SUPABASE_URL ||
        !(
            SUPABASE_SERVICE_ROLE_KEY ||
            SUPABASE_ANON_KEY
        )
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

    try {
        /*
         * ---------------------------------------------------
         * Auth
         * ---------------------------------------------------
         */
        const user =
            await authenticateUser(req);

        /*
         * ---------------------------------------------------
         * Body
         * ---------------------------------------------------
         */
        const body =
            getRequestBody(req);

        const taskId =
            cleanString(
                firstDefined(
                    body.task_id,
                    body.taskId
                )
            );

        const modelId =
            cleanString(
                firstDefined(
                    body.model_id,
                    body.modelId
                )
            );

        if (!taskId) {
            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "task_id wajib diisi."
                }
            );
        }

        if (!modelId) {
            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "model_id wajib diisi."
                }
            );
        }

        /*
         * ---------------------------------------------------
         * Load model
         * ---------------------------------------------------
         */
        const model =
            await loadModel(
                modelId
            );

        /*
         * ---------------------------------------------------
         * Resolve provider
         * ---------------------------------------------------
         */
        const providerReference =
            getProviderReference(
                model
            );

        if (!providerReference) {
            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        `Provider untuk model "${modelId}" tidak ditemukan.`,
                    model_id:
                        modelId
                }
            );
        }

        const provider =
            await loadProvider(
                providerReference
            );

        /*
         * ---------------------------------------------------
         * Load credential
         * ---------------------------------------------------
         */
        const credential =
            await loadProviderCredential(
                provider
            );

        /*
         * ---------------------------------------------------
         * Decrypt provider credential
         * ---------------------------------------------------
         */
        const providerApiKey =
            decryptCredential(
                credential.encryptedCredential
            );

        if (!providerApiKey) {
            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        "Provider API key kosong setelah decrypt.",
                    model_id:
                        modelId,
                    provider:
                        provider?.provider_name ||
                        provider?.name ||
                        null
                }
            );
        }

        /*
         * ---------------------------------------------------
         * IMPORTANT:
         *
         * index.js:
         *
         * export default model;
         *
         * Jadi adapter di-import sebagai:
         *
         * import grokImagineImageToVideo
         *   from ".../index.js";
         *
         * ---------------------------------------------------
         */
        const adapter =
            findAdapter(
                modelId
            );

        if (!adapter) {
            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        `Adapter untuk model "${modelId}" tidak ditemukan.`,
                    model_id:
                        modelId,
                    registered_adapters:
                        getAdapterDiagnostics()
                }
            );
        }

        /*
         * ---------------------------------------------------
         * Query provider task
         * ---------------------------------------------------
         */
        let providerRaw;

        try {
            providerRaw =
                await queryProviderTask(
                    adapter,
                    taskId,
                    providerApiKey
                );
        } catch (error) {
            return json(
                res,
                502,
                {
                    success: false,
                    error:
                        error?.message ||
                        "Gagal query status task ke provider.",
                    model_id:
                        modelId,
                    task_id:
                        taskId,
                    provider_id:
                        provider?.id ||
                        provider?.provider_id ||
                        null,
                    provider:
                        provider?.provider_name ||
                        provider?.name ||
                        null,
                    adapter_found:
                        true,
                    adapter_has_queryTask:
                        typeof adapter?.queryTask ===
                            "function"
                }
            );
        }

        /*
         * ---------------------------------------------------
         * Normalize provider result
         * ---------------------------------------------------
         */
        const normalized =
            normalizeProviderResult(
                providerRaw,
                taskId
            );

        /*
         * ---------------------------------------------------
         * Sync generation_history
         * ---------------------------------------------------
         */
        const history =
            await syncGenerationHistoryWithRetry(
                user.id,
                taskId,
                normalized
            );

        /*
         * ---------------------------------------------------
         * Final response
         * ---------------------------------------------------
         */
        return json(
            res,
            200,
            {
                success: true,

                user_id:
                    user.id,

                model_id:
                    modelId,

                model_name:
                    firstDefined(
                        model?.model_name,
                        model?.modelName,
                        model?.name
                    ),

                provider_id:
                    firstDefined(
                        provider?.id,
                        provider?.provider_id,
                        provider?.providerId
                    ),

                provider:
                    firstDefined(
                        provider?.provider_name,
                        provider?.providerName,
                        provider?.name
                    ),

                task_id:
                    normalized.task_id ||
                    taskId,

                taskId:
                    normalized.task_id ||
                    taskId,

                state:
                    normalized.state,

                provider_state:
                    normalized.provider_state,

                processing:
                    normalized.processing,

                completed:
                    normalized.completed,

                failed:
                    normalized.failed,

                has_result:
                    normalized.result_urls.length >
                    0,

                hasResult:
                    normalized.result_urls.length >
                    0,

                result_urls:
                    normalized.result_urls,

                resultUrls:
                    normalized.result_urls,

                result:
                    normalized.resultJson ||
                    (
                        normalized.result_urls.length
                            ? {
                                resultUrls:
                                    normalized.result_urls
                            }
                            : null
                    ),

                history_updated:
                    history.history_updated,

                history_matched:
                    history.history_matched,

                history_status:
                    history.history_status,

                history_reason:
                    history.history_reason,

                history_row_id:
                    history.history_row_id,

                history_database_status:
                    history.history_database_status ||
                    null,

                history_result_url:
                    history.history_result_url ||
                    null,

                history_completed_at:
                    history.history_completed_at ||
                    null,

                history_retry:
                    history.history_retry ||
                    false,

                /*
                 * Diagnostics adapter.
                 * Berguna untuk memastikan deployment
                 * benar-benar memakai default export.
                 */
                adapter_found:
                    true,

                adapter_has_queryTask:
                    typeof adapter?.queryTask ===
                        "function",

                modelId:
                    modelId
            }
        );
    } catch (error) {
        console.error(
            "[generate-status]",
            error
        );

        return json(
            res,
            error?.status >= 400 &&
            error?.status < 600
                ? error.status
                : 500,
            {
                success: false,
                error:
                    error?.message ||
                    "Gagal memproses status generation.",
                details:
                    error?.data ||
                    null
            }
        );
    }
}
