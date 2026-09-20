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

   Tidak bertanggung jawab:
   - Render UI
   - Render loading
   - Render result
   - Query provider
   - API key provider
   - Credit calculation
   - Model configuration
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

export class GenerateRequestError
    extends Error {

    constructor(
        message,
        options = {}
    ) {

        super(
            message
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
            options.details ||
            null;

        this.response =
            options.response ||
            null;
    }
}


/* =========================================================
   RESPONSE JSON
 ========================================================= */

async function parseResponseJson(
    response
) {

    const contentType =
        String(
            response.headers.get(
                "content-type"
            ) || ""
        ).toLowerCase();

    /*
     * JSON response normal.
     */
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
                    details:
                        error
                }
            );
        }
    }

    /*
     * Fallback jika backend tidak mengirim
     * Content-Type JSON tetapi body berisi JSON.
     */
    const text =
        await response.text();

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
    fallback
) {

    if (!data) {
        return fallback;
    }

    /*
     * Bentuk umum:
     * { error: "..." }
     */
    if (
        typeof data.error ===
            "string" &&
        data.error.trim()
    ) {

        return data.error.trim();
    }

    /*
     * Bentuk:
     * { message: "..." }
     */
    if (
        typeof data.message ===
            "string" &&
        data.message.trim()
    ) {

        return data.message.trim();
    }

    /*
     * Bentuk:
     * { errors: ["...", "..."] }
     */
    if (
        Array.isArray(
            data.errors
        ) &&
        data.errors.length
    ) {

        return data.errors
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
            )
            .join(" ");
    }

    /*
     * Bentuk nested:
     * { data: { error: "..." } }
     */
    if (
        data.data &&
        typeof data.data ===
            "object"
    ) {

        if (
            typeof data.data.error ===
                "string"
        ) {

            return data.data.error;
        }

        if (
            typeof data.data.message ===
                "string"
        ) {

            return data.data.message;
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

    return (
        data.code ||
        data.error_code ||
        data.errorCode ||
        data.data?.code ||
        null
    );
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
            "Model belum siap digunakan."
        );
    }

    const modelId =
        String(
            model.model_id ||
            ""
        ).trim();

    if (!modelId) {

        throw new GenerateRequestError(
            "Model ID tidak tersedia."
        );
    }

    /*
     * PENTING:
     *
     * Jangan mengubah struktur payload.
     *
     * Backend sebelumnya menerima:
     *
     * {
     *     model_id,
     *     parameters
     * }
     *
     * Struktur ini dipertahankan.
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

    return validateClientParameters(
        parameters
    );
}


/* =========================================================
   REQUEST
 ========================================================= */

export async function generateVideo(
    parameters = {}
) {

    /*
     * Pastikan model ada.
     */
    const model =
        getCurrentModel();

    if (!model) {

        throw new GenerateRequestError(
            "Model belum siap digunakan."
        );
    }

    /*
     * Validasi frontend.
     *
     * Backend tetap menjadi validator
     * dan sumber keputusan terakhir.
     */
    const validationErrors =
        validateGenerateRequest(
            parameters
        );

    if (
        validationErrors.length
    ) {

        throw new GenerateRequestError(
            validationErrors.join(
                "\n"
            ),
            {
                code:
                    "CLIENT_VALIDATION"
            }
        );
    }

    /*
     * Ambil access token Supabase.
     */
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

    /*
     * Build payload.
     */
    const payload =
        buildGeneratePayload(
            parameters
        );

    let response;

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
            "Tidak dapat terhubung ke server generate.",
            {
                code:
                    "NETWORK_ERROR",
                details:
                    error
            }
        );
    }

    /*
     * Parse response.
     */
    const data =
        await parseResponseJson(
            response
        );

    /*
     * HTTP error.
     */
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
                    ),

                details:
                    data,

                response
            }
        );
    }

    /*
     * Backend dapat mengembalikan
     * success=false walaupun HTTP 200.
     */
    if (
        data &&
        data.success === false
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
                    ),

                details:
                    data,

                response
            }
        );
    }

    /*
     * Perilaku lama:
     * response harus dianggap berhasil
     * jika data.success tersedia dan true.
     *
     * Tetapi jangan merusak endpoint yang
     * mungkin mengembalikan response sukses
     * tanpa field success.
     */
    if (
        Object.prototype
            .hasOwnProperty.call(
                data || {},
                "success"
            ) &&
        data.success !== true
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
                    ),

                details:
                    data,

                response
            }
        );
    }

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


export default generateRequest;
