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
 ========================================================= */

function sanitizeDiagnostic(
    value,
    depth = 0
) {

    if (
        depth >
        6
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


    if (
        typeof value ===
            "string"
    ) {

        const lower =
            value.toLowerCase();

        /*
         * Jangan pernah meneruskan credential
         * yang secara tidak sengaja dikirim backend.
         */
        if (
            lower.includes(
                "bearer "
            ) &&
            value.length >
                80
        ) {

            return "[redacted]";
        }

        return value;
    }


    if (
        typeof value !==
            "object"
    ) {

        return value;
    }


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


    const result = {};

    const sensitiveKeys = new Set([
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
        "api_key_tag"
    ]);


    for (
        const [
            key,
            item
        ]
        of Object.entries(
            value
        )
    ) {

        if (
            sensitiveKeys.has(
                key
            )
        ) {

            result[key] =
                "[redacted]";

            continue;
        }


        result[key] =
            sanitizeDiagnostic(
                item,
                depth + 1
            );
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

    const accessToken =
        await getAccessToken();


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
       5. POST ke backend GEN-Z.AI
    ----------------------------------------------------- */

    try {

        response =
            await fetch(
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
                        )
                }
            );

    } catch (
        error
    ) {

        throw new GenerateRequestError(
            error?.message ||
            "Tidak dapat terhubung ke server generate.",
            {
                code:
                    "NETWORK_ERROR",

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
