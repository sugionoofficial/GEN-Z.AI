/* =========================================================
   GEN-Z.AI
   GENERATE REQUEST MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-request.js

   Tanggung jawab:
   - Request ke /api/generate
   - Mengambil access token Supabase
   - Menyiapkan payload generate
   - Parse response JSON
   - Menangani error HTTP/API
   - Memastikan model yang digunakan valid
   - Meneruskan diagnostic response dari backend secara aman

   Tidak bertanggung jawab:
   - Render UI
   - Render loading
   - Render result
   - Query provider
   - API key provider
   - Credit calculation
   - Model configuration
   - Pengumpulan parameter form

   Patch:
   - Timeout fetch via AbortController (60 detik)
   - Sanitize diagnostic lebih lengkap (string pattern + length limit)
   - Safe handling untuk non-plain object
   - Sanitasi access token
   - credentials: same-origin
   - Limit key count saat sanitize
 ========================================================= */

import {
    getCurrentModel
} from "./generate-state.js";

import {
    getAccessToken
} from "./generate-auth.js";

import {
    validateClientParameters
} from "./generate-validation.js";


/* =========================================================
   CONFIG
 ========================================================= */

const GENERATE_ENDPOINT =
    "/api/generate";


/* Timeout fetch dalam milidetik (60 detik). */

const REQUEST_TIMEOUT_MS =
    60 * 1000;


/* Batas panjang string yang boleh diteruskan ke UI. */

const MAX_DIAGNOSTIC_STRING_LENGTH =
    2000;


/* Batas jumlah key per object yang diproses sanitize. */

const MAX_DIAGNOSTIC_KEYS =
    100;


/* Batas kedalaman rekursi sanitize. */

const MAX_DIAGNOSTIC_DEPTH =
    6;


/* =========================================================
   ERROR CLASS
 ========================================================= */

export class GenerateRequestError extends Error {

    constructor(
        message,
        options = {}
    ) {

        super(
            String(
                message ||
                "Generate gagal diproses."
            )
        );

        this.name =
            "GenerateRequestError";

        this.status =
            Number(
                options.status
            ) || 0;

        this.code =
            options.code ||
            null;

        this.details =
            options.details ??
            null;

        this.response =
            options.response ??
            null;

        /*
         * Diagnostic tambahan.
         *
         * Tidak berisi API key.
         */
        this.provider =
            options.provider ??
            null;

        this.providerResponse =
            options.providerResponse ??
            null;

        this.taskId =
            options.taskId ??
            null;
    }
}


/* =========================================================
   AUTH HEADER SANITIZE
   ---------------------------------------------------------
   Supabase token selalu base64url, tetapi kita tetap
   membersihkan karakter kontrol untuk mencegah
   header injection yang tidak disengaja.
 ========================================================= */

function sanitizeAccessToken(
    token
) {

    if (
        token ===
            null ||
        token ===
            undefined
    ) {

        return "";

    }


    return String(
        token
    )
        .replace(
            /[\r\n\t]/g,
            ""
        )
        .trim();

}


/* =========================================================
   FETCH WITH TIMEOUT
   ---------------------------------------------------------
   Membungkus fetch() dengan AbortController supaya
   request tidak menggantung tanpa batas.

   Error yang di-throw tetap Error biasa sehingga
   ditangani oleh catch NETWORK_ERROR di pemanggil.
 ========================================================= */

async function fetchWithTimeout(
    url,
    options = {},
    timeoutMs =
        REQUEST_TIMEOUT_MS
) {

    const controller =
        new AbortController();


    const externalSignal =
        options.signal;


    const timer =
        setTimeout(
            () => {

                try {

                    controller.abort(
                        new Error(
                            `Request timeout setelah ${timeoutMs}ms.`
                        )
                    );

                } catch {
                    /* ignore */
                }

            },
            timeoutMs
        );


    /* =====================================================
       EXTERNAL SIGNAL FORWARDING
       -----------------------------------------------------
       Jika caller memberikan signal sendiri, forward
       abort-nya ke controller internal.
    ===================================================== */

    let onExternalAbort =
        null;


    if (
        externalSignal &&
        typeof externalSignal.addEventListener ===
            "function"
    ) {

        onExternalAbort =
            () => {

                try {

                    controller.abort(
                        externalSignal.reason
                    );

                } catch {
                    /* ignore */
                }

            };


        if (
            externalSignal.aborted
        ) {

            onExternalAbort();

        } else {

            externalSignal.addEventListener(
                "abort",
                onExternalAbort,
                {
                    once:
                        true
                }
            );

        }

    }


    try {

        return await fetch(
            url,
            {
                ...options,

                signal:
                    controller.signal
            }
        );

    } finally {

        clearTimeout(
            timer
        );


        if (
            externalSignal &&
            onExternalAbort &&
            typeof externalSignal.removeEventListener ===
                "function"
        ) {

            try {

                externalSignal.removeEventListener(
                    "abort",
                    onExternalAbort
                );

            } catch {
                /* ignore */
            }

        }

    }

}


/* =========================================================
   RESPONSE JSON
 ========================================================= */

async function parseResponseJson(
    response
) {

    if (!response) {

        throw new GenerateRequestError(
            "Response server tidak tersedia.",
            {
                code:
                    "EMPTY_RESPONSE"
            }
        );
    }

    const contentType =
        String(
            response.headers?.get(
                "content-type"
            ) || ""
        ).toLowerCase();


    /* -----------------------------------------------------
       JSON response normal
    ----------------------------------------------------- */

    if (
        contentType.includes(
            "application/json"
        )
    ) {

        try {

            return await response.json();

        } catch (
            error
        ) {

            throw new GenerateRequestError(
                "Response server tidak dapat dibaca sebagai JSON.",
                {
                    status:
                        response.status,

                    code:
                        "INVALID_JSON_RESPONSE",

                    details:
                        {
                            message:
                                error?.message ||
                                String(
                                    error
                                )
                        }
                }
            );
        }
    }


    /* -----------------------------------------------------
       Fallback jika Content-Type bukan JSON.
       Backend mungkin tetap mengirim JSON.
    ----------------------------------------------------- */

    let text = "";

    try {

        text =
            await response.text();

    } catch (
        error
    ) {

        throw new GenerateRequestError(
            "Response server tidak dapat dibaca.",
            {
                status:
                    response.status,

                code:
                    "RESPONSE_READ_FAILED",

                details:
                    {
                        message:
                            error?.message ||
                            String(
                                error
                            )
                    }
            }
        );
    }


    if (!text) {

        return {};
    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return {
            success:
                response.ok,

            message:
                text
        };
    }
}


/* =========================================================
   EXTRACT ERROR MESSAGE
 ========================================================= */

function extractErrorMessage(
    data,
    fallback =
        "Generate gagal diproses."
) {

    if (!data) {

        return fallback;
    }


    /* -----------------------------------------------------
       { error: "..." }
    ----------------------------------------------------- */

    if (
        typeof data.error ===
            "string" &&
        data.error.trim()
    ) {

        return data.error.trim();
    }


    /* -----------------------------------------------------
       { message: "..." }
    ----------------------------------------------------- */

    if (
        typeof data.message ===
            "string" &&
        data.message.trim()
    ) {

        return data.message.trim();
    }


    /* -----------------------------------------------------
       { error: { message: "..." } }
    ----------------------------------------------------- */

    if (
        data.error &&
        typeof data.error ===
            "object"
    ) {

        if (
            typeof data.error.message ===
                "string" &&
            data.error.message.trim()
        ) {

            return data.error.message.trim();
        }

        if (
            typeof data.error.error ===
                "string" &&
            data.error.error.trim()
        ) {

            return data.error.error.trim();
        }
    }


    /* -----------------------------------------------------
       { errors: [...] }
    ----------------------------------------------------- */

    if (
        Array.isArray(
            data.errors
        ) &&
        data.errors.length
    ) {

        const messages =
            data.errors
                .map(
                    item => {

                        if (
                            typeof item ===
                                "string"
                        ) {

                            return item;
                        }

                        if (
                            item &&
                            typeof item ===
                                "object"
                        ) {

                            return (
                                item.message ||
                                item.error ||
                                item.detail ||
                                JSON.stringify(
                                    item
                                )
                            );
                        }

                        return String(
                            item
                        );
                    }
                )
                .filter(
                    Boolean
                );

        if (
            messages.length
        ) {

            return messages.join(
                " "
            );
        }
    }


    /* -----------------------------------------------------
       Nested data
    ----------------------------------------------------- */

    if (
        data.data &&
        typeof data.data ===
            "object"
    ) {

        if (
            typeof data.data.error ===
                "string" &&
            data.data.error.trim()
        ) {

            return data.data.error.trim();
        }

        if (
            typeof data.data.message ===
                "string" &&
            data.data.message.trim()
        ) {

            return data.data.message.trim();
        }


        if (
            data.data.error &&
            typeof data.data.error ===
                "object"
        ) {

            if (
                typeof data.data.error.message ===
                    "string"
            ) {

                return data.data.error.message;
            }
        }
    }


    return fallback;
}


/* =========================================================
   EXTRACT ERROR CODE
 ========================================================= */

function extractErrorCode(
    data
) {

    if (!data) {

        return null;
    }


    if (
        typeof data.code ===
            "string"
    ) {

        return data.code;
    }


    if (
        typeof data.error_code ===
            "string"
    ) {

        return data.error_code;
    }


    if (
        typeof data.errorCode ===
            "string"
    ) {

        return data.errorCode;
    }


    if (
        data.error &&
        typeof data.error ===
            "object"
    ) {

        if (
            typeof data.error.code ===
                "string"
        ) {

            return data.error.code;
        }
    }


    if (
        data.data &&
        typeof data.data ===
            "object"
    ) {

        if (
            typeof data.data.code ===
                "string"
        ) {

            return data.data.code;
        }

        if (
            typeof data.data.error_code ===
                "string"
        ) {

            return data.data.error_code;
        }
    }


    return null;
}


/* =========================================================
   EXTRACT TASK ID
 ========================================================= */

function extractTaskId(
    data
) {

    if (!data) {

        return null;
    }


    const candidates = [

        data.taskId,

        data.task_id,

        data.jobId,

        data.job_id,

        data.data?.taskId,

        data.data?.task_id,

        data.data?.jobId,

        data.data?.job_id

    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            candidate !==
                undefined &&
            candidate !==
                null &&
            String(
                candidate
            ).trim()
        ) {

            return String(
                candidate
            ).trim();
        }
    }


    return null;
}


/* =========================================================
   SAFE DIAGNOSTIC
   ---------------------------------------------------------
   Backend seharusnya sudah melakukan sanitasi.
   Fungsi ini tetap mencegah credential masuk ke UI.

   Patch:
   - Daftar sensitive keys diperluas
   - Deteksi string pattern (mg_live_, sk_live_, dll.)
   - Batas panjang string
   - Batas jumlah key per object
   - Handling untuk non-plain object
 ========================================================= */

/* ---------------------------------------------------------
   SENSITIVE KEY NAMES
--------------------------------------------------------- */

const SENSITIVE_KEYS =
    new Set([

        /* Existing */

        "api_key",
        "apikey",
        "apiKey",
        "token",
        "access_token",
        "accessToken",
        "authorization",
        "secret",
        "password",
        "ciphertext",
        "api_key_ciphertext",
        "api_key_iv",
        "api_key_tag",

        /* Additional common sensitive keys */

        "refresh_token",
        "refreshToken",
        "id_token",
        "idToken",
        "session",
        "session_token",
        "sessionToken",
        "jwt",
        "bearer",
        "auth",
        "auth_token",
        "authToken",
        "private_key",
        "privateKey",
        "secret_key",
        "secretKey",
        "client_secret",
        "clientSecret",
        "signing_key",
        "signingKey",
        "encryption_key",
        "encryptionKey"

    ]);


/* ---------------------------------------------------------
   SENSITIVE STRING PATTERNS
--------------------------------------------------------- */

const SENSITIVE_STRING_PATTERNS = [

    /* Bearer token */

    /^bearer\s+[a-z0-9\-_\.=]+/i,

    /* KIE-style live API keys */

    /\bmg_live_[a-z0-9]{8,}\b/i,

    /* Stripe-style */

    /\b(sk|pk|rk)_live_[a-z0-9]{8,}\b/i,

    /\b(sk|pk|rk)_test_[a-z0-9]{8,}\b/i,

    /* SendGrid */

    /\bsg\.[a-z0-9\-_]{16,}\.[a-z0-9\-_]{16,}\b/i,

    /* Slack */

    /\bxox[abposr]-[a-z0-9\-]{10,}\b/i,

    /* AWS */

    /\bAKIA[0-9A-Z]{16}\b/,

    /* GitHub */

    /\bgh[pousr]_[a-zA-Z0-9]{36,}\b/,

    /* JWT */

    /\beyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\b/

];


/* ---------------------------------------------------------
   IS SENSITIVE STRING
--------------------------------------------------------- */

function isSensitiveString(
    value
) {

    if (
        typeof value !==
            "string"
    ) {

        return false;

    }


    if (
        !value
    ) {

        return false;

    }


    for (
        const pattern
        of SENSITIVE_STRING_PATTERNS
    ) {

        if (
            pattern.test(
                value
            )
        ) {

            return true;

        }

    }


    return false;

}


/* ---------------------------------------------------------
   IS PLAIN OBJECT
--------------------------------------------------------- */

function isPlainObject(
    value
) {

    if (
        value ===
            null ||
        typeof value !==
            "object"
    ) {

        return false;

    }


    if (
        Array.isArray(
            value
        )
    ) {

        return false;

    }


    return Object.prototype.toString.call(
        value
    ) ===
        "[object Object]";

}


/* ---------------------------------------------------------
   SANITIZE DIAGNOSTIC
--------------------------------------------------------- */

function sanitizeDiagnostic(
    value,
    depth = 0
) {

    if (
        depth >
        MAX_DIAGNOSTIC_DEPTH
    ) {

        return "[truncated]";

    }


    if (
        value ===
            null ||
        value ===
            undefined
    ) {

        return value;

    }


    /* -----------------------------------------------------
       STRING
    ----------------------------------------------------- */

    if (
        typeof value ===
            "string"
    ) {

        /* Sensitive string pattern */

        if (
            isSensitiveString(
                value
            )
        ) {

            return "[redacted]";

        }


        /* Length limit */

        if (
            value.length >
            MAX_DIAGNOSTIC_STRING_LENGTH
        ) {

            return (
                value.slice(
                    0,
                    MAX_DIAGNOSTIC_STRING_LENGTH
                ) +
                "…[truncated]"
            );

        }


        return value;

    }


    /* -----------------------------------------------------
       PRIMITIVE (number, boolean, bigint, symbol)
    ----------------------------------------------------- */

    if (
        typeof value !==
            "object"
    ) {

        return value;

    }


    /* -----------------------------------------------------
       ARRAY
    ----------------------------------------------------- */

    if (
        Array.isArray(
            value
        )
    ) {

        return value

            .slice(
                0,
                50
            )

            .map(
                item =>
                    sanitizeDiagnostic(
                        item,
                        depth + 1
                    )
            );

    }


    /* -----------------------------------------------------
       NON-PLAIN OBJECT
       -----------------------------------------------------
       Date, Map, Set, Error, Blob, File, dll. — jangan
       iterasi keys-nya, ubah menjadi representasi aman.
    ----------------------------------------------------- */

    if (
        !isPlainObject(
            value
        )
    ) {

        try {

            if (
                value instanceof
                Date
            ) {

                return value.toISOString();

            }


            if (
                value instanceof
                Error
            ) {

                return {
                    name:
                        value.name,

                    message:
                        sanitizeDiagnostic(
                            value.message,
                            depth + 1
                        )
                };

            }


            const tag =
                Object.prototype.toString.call(
                    value
                );


            return tag;

        } catch {

            return "[non-plain-object]";

        }

    }


    /* -----------------------------------------------------
       PLAIN OBJECT
    ----------------------------------------------------- */

    const result =
        {};


    const entries =
        Object.entries(
            value
        );


    const limit =
        Math.min(
            entries.length,
            MAX_DIAGNOSTIC_KEYS
        );


    for (
        let index = 0;
        index < limit;
        index += 1
    ) {

        const [
            key,
            item
        ] =
            entries[index];


        /* -------------------------------------------------
           SENSITIVE KEY
        ------------------------------------------------- */

        if (
            SENSITIVE_KEYS.has(
                key
            )
        ) {

            result[key] =
                "[redacted]";

            continue;

        }


        /* -------------------------------------------------
           RECURSE
        ------------------------------------------------- */

        result[key] =
            sanitizeDiagnostic(
                item,
                depth + 1
            );

    }


    if (
        entries.length >
        MAX_DIAGNOSTIC_KEYS
    ) {

        result.__truncatedKeys__ =
            entries.length -
            MAX_DIAGNOSTIC_KEYS;

    }


    return result;

}


/* =========================================================
   BUILD PAYLOAD
 ========================================================= */

export function buildGeneratePayload(
    parameters = {}
) {

    const model =
        getCurrentModel();


    if (!model) {

        throw new GenerateRequestError(
            "Model belum siap digunakan.",
            {
                code:
                    "MODEL_NOT_AVAILABLE"
            }
        );
    }


    const modelId =
        String(
            model.model_id ||
            ""
        ).trim();


    if (!modelId) {

        throw new GenerateRequestError(
            "Model ID tidak tersedia.",
            {
                code:
                    "MODEL_ID_NOT_AVAILABLE"
            }
        );
    }


    /*
     * Struktur backend tetap:
     *
     * {
     *     model_id,
     *     parameters
     * }
     */
    return {

        model_id:
            modelId,

        parameters:
            parameters &&
            typeof parameters ===
                "object"
                ? parameters
                : {}

    };

}


/* =========================================================
   VALIDATE REQUEST
 ========================================================= */

export function validateGenerateRequest(
    parameters = {}
) {

    const model =
        getCurrentModel();


    if (!model) {

        return [
            "Model belum siap digunakan."
        ];
    }


    /*
     * Validation tetap dimiliki
     * generate-validation.js.
     *
     * generate-request.js tidak membaca
     * parameterDefinition dari generate-form.js.
     */
    const result =
        validateClientParameters(
            parameters
        );


    if (
        Array.isArray(
            result
        )
    ) {

        return result;
    }


    /*
     * Jaga kompatibilitas jika validator
     * mengembalikan object.
     */
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

            return result.errors;
        }

        if (
            typeof result.message ===
                "string"
        ) {

            return [
                result.message
            ];
        }
    }


    return [];
}


/* =========================================================
   REQUEST
 ========================================================= */

export async function generateVideo(
    parameters = {}
) {

    /* -----------------------------------------------------
       1. Pastikan model tersedia
    ----------------------------------------------------- */

    const model =
        getCurrentModel();


    if (!model) {

        throw new GenerateRequestError(
            "Model belum siap digunakan.",
            {
                code:
                    "MODEL_NOT_AVAILABLE"
            }
        );
    }


    const modelId =
        String(
            model.model_id ||
            ""
        ).trim();


    if (!modelId) {

        throw new GenerateRequestError(
            "Model ID tidak tersedia.",
            {
                code:
                    "MODEL_ID_NOT_AVAILABLE"
            }
        );
    }


    /* -----------------------------------------------------
       2. Validasi parameter
    ----------------------------------------------------- */

    const validationErrors =
        validateGenerateRequest(
            parameters
        );


    if (
        Array.isArray(
            validationErrors
        ) &&
        validationErrors.length
    ) {

        throw new GenerateRequestError(
            validationErrors.join(
                "\n"
            ),
            {
                code:
                    "CLIENT_VALIDATION",

                details:
                    {
                        errors:
                            validationErrors
                    }
            }
        );
    }


    /* -----------------------------------------------------
       3. Ambil Supabase access token
    ----------------------------------------------------- */

    const rawAccessToken =
        await getAccessToken();


    const accessToken =
        sanitizeAccessToken(
            rawAccessToken
        );


    if (!accessToken) {

        throw new GenerateRequestError(
            "Sesi login tidak ditemukan. Silakan login kembali.",
            {
                status:
                    401,

                code:
                    "AUTH_REQUIRED"
            }
        );
    }


    /* -----------------------------------------------------
       4. Build payload
    ----------------------------------------------------- */

    const payload =
        buildGeneratePayload(
            parameters
        );


    let response;


    /* -----------------------------------------------------
       5. POST ke backend GEN-Z.AI (dengan timeout)
    ----------------------------------------------------- */

    try {

        response =
            await fetchWithTimeout(
                GENERATE_ENDPOINT,
                {
                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${accessToken}`

                    },

                    body:
                        JSON.stringify(
                            payload
                        ),

                    credentials:
                        "same-origin"

                },
                REQUEST_TIMEOUT_MS
            );

    } catch (
        error
    ) {

        const isAbort =
            error?.name ===
                "AbortError" ||
            /abort/i.test(
                String(
                    error?.message ||
                    ""
                )
            );


        const code =
            isAbort
                ? "REQUEST_TIMEOUT"
                : "NETWORK_ERROR";


        const message =
            isAbort
                ? `Request ke server generate timeout setelah ${REQUEST_TIMEOUT_MS}ms.`
                : (
                    error?.message ||
                    "Tidak dapat terhubung ke server generate."
                );


        throw new GenerateRequestError(
            message,
            {
                code,

                details:
                    {
                        name:
                            error?.name ||
                            null,

                        message:
                            error?.message ||
                            String(
                                error
                            )
                    }
            }
        );

    }


    /* -----------------------------------------------------
       6. Parse response
    ----------------------------------------------------- */

    let data;

    try {

        data =
            await parseResponseJson(
                response
            );

    } catch (
        error
    ) {

        if (
            error instanceof
            GenerateRequestError
        ) {

            throw error;
        }

        throw new GenerateRequestError(
            "Response server tidak dapat dibaca.",
            {
                status:
                    response.status,

                code:
                    "RESPONSE_PARSE_FAILED",

                details:
                    {
                        message:
                            error?.message ||
                            String(
                                error
                            )
                    }
            }
        );
    }


    const safeData =
        sanitizeDiagnostic(
            data
        );


    /* -----------------------------------------------------
       7. HTTP ERROR
    ----------------------------------------------------- */

    if (
        !response.ok
    ) {

        const message =
            extractErrorMessage(
                data,
                `Request gagal dengan status ${response.status}.`
            );


        throw new GenerateRequestError(
            message,
            {
                status:
                    response.status,

                code:
                    extractErrorCode(
                        data
                    ) ||
                    `HTTP_${response.status}`,

                details:
                    safeData,

                response:
                    safeData,

                provider:
                    sanitizeDiagnostic(
                        data?.provider ??
                        data?.provider_name ??
                        data?.data?.provider ??
                        null
                    ),

                providerResponse:
                    sanitizeDiagnostic(
                        data?.providerResponse ??
                        data?.provider_response ??
                        data?.kie ??
                        data?.data?.providerResponse ??
                        data?.data?.provider_response ??
                        null
                    ),

                taskId:
                    extractTaskId(
                        data
                    )
            }
        );
    }


    /* -----------------------------------------------------
       8. Backend success=false
    ----------------------------------------------------- */

    if (
        data &&
        data.success ===
            false
    ) {

        const message =
            extractErrorMessage(
                data,
                "Generate gagal diproses."
            );


        throw new GenerateRequestError(
            message,
            {
                status:
                    response.status,

                code:
                    extractErrorCode(
                        data
                    ) ||
                    "GENERATE_FAILED",

                details:
                    safeData,

                response:
                    safeData,

                provider:
                    sanitizeDiagnostic(
                        data?.provider ??
                        data?.provider_name ??
                        data?.data?.provider ??
                        null
                    ),

                providerResponse:
                    sanitizeDiagnostic(
                        data?.providerResponse ??
                        data?.provider_response ??
                        data?.kie ??
                        data?.data?.providerResponse ??
                        data?.data?.provider_response ??
                        null
                    ),

                taskId:
                    extractTaskId(
                        data
                    )
            }
        );
    }


    /* -----------------------------------------------------
       9. Jika success tersedia,
          harus true
    ----------------------------------------------------- */

    if (
        data &&
        Object.prototype
            .hasOwnProperty.call(
                data,
                "success"
            ) &&
        data.success !==
            true
    ) {

        throw new GenerateRequestError(
            extractErrorMessage(
                data,
                "Generate gagal diproses."
            ),
            {
                status:
                    response.status,

                code:
                    extractErrorCode(
                        data
                    ) ||
                    "GENERATE_FAILED",

                details:
                    safeData,

                response:
                    safeData,

                provider:
                    sanitizeDiagnostic(
                        data?.provider ??
                        data?.provider_name ??
                        data?.data?.provider ??
                        null
                    ),

                providerResponse:
                    sanitizeDiagnostic(
                        data?.providerResponse ??
                        data?.provider_response ??
                        data?.kie ??
                        data?.data?.providerResponse ??
                        data?.data?.provider_response ??
                        null
                    ),

                taskId:
                    extractTaskId(
                        data
                    )
            }
        );
    }


    /* -----------------------------------------------------
       10. Pastikan response berhasil
    ----------------------------------------------------- */

    return data;
}


/* =========================================================
   SIMPLE REQUEST ALIAS
 ========================================================= */

export async function requestGenerate(
    parameters = {}
) {

    return generateVideo(
        parameters
    );

}


/* =========================================================
   ENDPOINT
 ========================================================= */

export function getGenerateEndpoint() {

    return GENERATE_ENDPOINT;
}


/* =========================================================
   PUBLIC API
 ========================================================= */

export const generateRequest =
    Object.freeze({

        generateVideo,

        requestGenerate,

        buildGeneratePayload,

        validateGenerateRequest,

        getGenerateEndpoint,

        GenerateRequestError

    });


/* =========================================================
   DEFAULT EXPORT
 ========================================================= */

export default generateRequest;
