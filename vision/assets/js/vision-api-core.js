/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-core.js

   Fungsi:
   - Configuration
   - State access
   - Supabase session
   - Timeout
   - API error
   - HTTP request ke /api/openkey-chat
   - Detailed request diagnostics
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const VISION_API_CONFIG = Object.freeze({

    endpoint:
        "/api/openkey-chat",

    /*
     * =====================================================
     * REQUEST TIMEOUT
     * =====================================================
     *
     * Default:
     * 300 detik = 5 menit
     *
     * Vision Analysis dan Prompt Engineering dapat
     * membutuhkan waktu lebih lama daripada request biasa.
     */

    timeout:
        300000,

    analysisTimeout:
        300000,

    promptTimeout:
        300000,

    analysisTemperature:
        0.2,

    promptTemperature:
        0.2,

    maxAnalysisTokens:
        5000,

    maxPromptTokens:
        5000,

    minAnalysisCharacters:
        500

});


/* =========================================================
   GET STATE
========================================================= */

function getState() {

    if (
        !window.GENZVisionState
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }

    return window.GENZVisionState;

}


/* =========================================================
   SESSION
========================================================= */

async function getAccessToken() {

    if (
        !window.supabaseClient
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const result =
        await window.supabaseClient.auth.getSession();


    if (
        result?.error
    ) {

        throw result.error;

    }


    const session =
        result?.data?.session ||
        null;


    if (
        !session?.access_token
    ) {

        const error =
            new Error(
                "Session pengguna tidak tersedia."
            );


        error.code =
            "AUTH_REQUIRED";


        throw error;

    }


    return session.access_token;

}


/* =========================================================
   TIMEOUT CONTROLLER
========================================================= */

function createTimeoutController(
    timeout
) {

    const controller =
        new AbortController();


    const safeTimeout =
        Number(timeout) > 0
            ? Number(timeout)
            : VISION_API_CONFIG.timeout;


    const timer =
        setTimeout(
            () => {

                controller.abort();

            },
            safeTimeout
        );


    return {

        controller,

        clear:
            () => clearTimeout(
                timer
            )

    };

}


/* =========================================================
   API ERROR
========================================================= */

function createAPIError(
    message,
    options = {}
) {

    const error =
        new Error(
            message
        );


    error.name =
        "VisionAPIError";


    if (
        options.code
    ) {

        error.code =
            options.code;

    }


    if (
        options.status !== undefined &&
        options.status !== null
    ) {

        error.status =
            options.status;

    }


    if (
        options.data !== undefined &&
        options.data !== null
    ) {

        error.data =
            options.data;

    }


    /*
     * Optional diagnostics.
     *
     * Tidak mengubah error message utama.
     * Hanya menyimpan informasi tambahan agar layer
     * atas dapat melakukan debugging dengan benar.
     */

    if (
        options.url
    ) {

        error.url =
            options.url;

    }


    if (
        options.duration !== undefined
    ) {

        error.duration =
            options.duration;

    }


    if (
        options.cause
    ) {

        error.cause =
            options.cause;

    }


    return error;

}


/* =========================================================
   SAFE ERROR MESSAGE
========================================================= */

function getErrorMessage(
    error
) {

    if (
        !error
    ) {

        return "Unknown error.";

    }


    if (
        typeof error === "string"
    ) {

        return error;

    }


    return (
        error.message ||
        error.error ||
        error.statusText ||
        String(error)
    );

}


/* =========================================================
   SAFE RESPONSE DIAGNOSTICS
========================================================= */

function buildResponseDiagnostics(
    response,
    data,
    duration
) {

    let contentType =
        null;


    try {

        contentType =
            response
                ?.headers
                ?.get(
                    "content-type"
                ) ||
            null;

    }
    catch {

        contentType =
            null;

    }


    return {

        ok:
            Boolean(
                response?.ok
            ),

        status:
            response?.status ??
            null,

        statusText:
            response?.statusText ||
            "",

        contentType,

        duration:
            Number.isFinite(
                duration
            )
                ? Math.round(duration)
                : null,

        dataType:
            Array.isArray(data)
                ? "array"
                : (
                    data &&
                    typeof data === "object"
                        ? "object"
                        : typeof data
                ),

        dataKeys:
            data &&
            typeof data === "object" &&
            !Array.isArray(data)
                ? Object.keys(data)
                : [],

        error:
            data?.error ??
            null,

        message:
            data?.message ??
            null,

        code:
            data?.code ??
            null,

        success:
            data?.success ??
            null

    };

}


/* =========================================================
   PARSE RESPONSE
========================================================= */

async function parseResponse(
    response
) {

    const text =
        await response.text();


    if (
        !text
    ) {

        return {};

    }


    try {

        return JSON.parse(
            text
        );

    }
    catch {

        return {

            raw:
                text

        };

    }

}


/* =========================================================
   REQUEST ERROR BUILDER
========================================================= */

function createResponseAPIError(
    response,
    data,
    duration
) {

    const diagnostics =
        buildResponseDiagnostics(
            response,
            data,
            duration
        );


    const message =
        data?.error ||
        data?.message ||
        `Vision API request gagal (${response.status}).`;


    const code =
        data?.code ||
        "VISION_API_REQUEST_FAILED";


    console.error(
        "[GEN-Z.AI Vision] API request failed:",
        diagnostics
    );


    /*
     * Jika backend mengembalikan error "terminated",
     * pertahankan pesan asli tetapi tambahkan code khusus
     * hanya bila backend tidak memberikan code.
     *
     * Ini membuat diagnosis jauh lebih jelas tanpa
     * mengubah kontrak response backend.
     */

    const resolvedCode =
        data?.code ||
        (
            String(message)
                .trim()
                .toLowerCase() ===
            "terminated"

                ? "VISION_API_TERMINATED"

                : code
        );


    return createAPIError(

        message,

        {

            code:
                resolvedCode,

            status:
                response.status,

            data,

            url:
                VISION_API_CONFIG.endpoint,

            duration

        }

    );

}


/* =========================================================
   NETWORK ERROR DIAGNOSTICS
========================================================= */

function createNetworkAPIError(
    error,
    duration,
    signal
) {

    const message =
        getErrorMessage(
            error
        );


    const isAbort =
        error?.name ===
        "AbortError";


    console.error(
        "[GEN-Z.AI Vision] Network/fetch error:",
        {

            name:
                error?.name ||
                null,

            message,

            code:
                error?.code ||
                null,

            duration:
                Number.isFinite(
                    duration
                )
                    ? Math.round(duration)
                    : null,

            signalAborted:
                Boolean(
                    signal?.aborted
                )

        }
    );


    if (
        isAbort
    ) {

        return createAPIError(

            "Vision API timeout. Proses membutuhkan waktu terlalu lama.",

            {

                code:
                    "VISION_API_TIMEOUT",

                url:
                    VISION_API_CONFIG.endpoint,

                duration,

                cause:
                    error

            }

        );

    }


    return createAPIError(

        message ||
        "Vision API gagal terhubung.",

        {

            code:
                "VISION_API_NETWORK_ERROR",

            url:
                VISION_API_CONFIG.endpoint,

            duration,

            cause:
                error

        }

    );

}


/* =========================================================
   API REQUEST
========================================================= */

async function request(
    body,
    options = {}
) {

    const token =
        await getAccessToken();


    /*
     * =====================================================
     * TIMEOUT
     * =====================================================
     *
     * Prioritas:
     *
     * 1. options.timeout
     * 2. VISION_API_CONFIG.timeout
     *
     * Nilai 0 tidak dianggap sebagai timeout valid.
     */

    const requestedTimeout =
        Number(
            options.timeout
        );


    const timeout =
        Number.isFinite(
            requestedTimeout
        ) &&
        requestedTimeout > 0

            ? requestedTimeout

            : VISION_API_CONFIG.timeout;


    const {
        controller,
        clear
    } =
        createTimeoutController(
            timeout
        );


    const startedAt =
        performance.now();


    console.info(
        "[GEN-Z.AI Vision] API request started:",
        {

            endpoint:
                VISION_API_CONFIG.endpoint,

            timeout,

            bodyKeys:
                body &&
                typeof body === "object"
                    ? Object.keys(body)
                    : [],

            model:
                body?.model ||
                body?.model_id ||
                body?.modelId ||
                null,

            hasImage:
                Boolean(
                    body?.image ||
                    body?.image_url ||
                    body?.imageUrl ||
                    body?.messages
                )

        }
    );


    try {

        const response =
            await fetch(
                VISION_API_CONFIG.endpoint,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify(
                            body
                        ),

                    signal:
                        controller.signal

                }
            );


        const duration =
            performance.now() -
            startedAt;


        const data =
            await parseResponse(
                response
            );


        /*
         * =================================================
         * RESPONSE RECEIVED
         * =================================================
         */

        const diagnostics =
            buildResponseDiagnostics(
                response,
                data,
                duration
            );


        console.info(
            "[GEN-Z.AI Vision] API response received:",
            diagnostics
        );


        /*
         * =================================================
         * HTTP ERROR
         * =================================================
         */

        if (
            !response.ok
        ) {

            throw createResponseAPIError(

                response,

                data,

                duration

            );

        }


        /*
         * =================================================
         * APPLICATION ERROR
         * =================================================
         *
         * HTTP 200 belum tentu berarti request berhasil.
         */

        if (
            data?.success === false
        ) {

            const message =
                data.error ||
                data.message ||
                "Vision API mengembalikan error.";


            const code =
                data.code ||
                (
                    String(message)
                        .trim()
                        .toLowerCase() ===
                    "terminated"

                        ? "VISION_API_TERMINATED"

                        : "VISION_API_FAILED"
                );


            console.error(
                "[GEN-Z.AI Vision] API application error:",
                {

                    ...diagnostics,

                    resolvedCode:
                        code

                }
            );


            throw createAPIError(

                message,

                {

                    code,

                    status:
                        response.status,

                    data,

                    url:
                        VISION_API_CONFIG.endpoint,

                    duration

                }

            );

        }


        /*
         * =================================================
         * SUCCESS
         * =================================================
         */

        console.info(
            "[GEN-Z.AI Vision] API request completed:",
            {

                status:
                    response.status,

                duration:
                    Math.round(
                        duration
                    ),

                success:
                    data?.success ??
                    true

            }
        );


        return data;

    }
    catch (error) {

        const duration =
            performance.now() -
            startedAt;


        /*
         * Jangan bungkus ulang VisionAPIError.
         *
         * Error dari backend sudah mempunyai:
         * - code
         * - status
         * - data
         * - duration
         */

        if (
            error?.name ===
            "VisionAPIError"
        ) {

            console.error(
                "[GEN-Z.AI Vision] Vision API error:",
                {

                    message:
                        error.message,

                    code:
                        error.code ||
                        null,

                    status:
                        error.status ??
                        null,

                    duration:
                        error.duration ??
                        Math.round(
                            duration
                        ),

                    data:
                        error.data ??
                        null

                }
            );


            throw error;

        }


        /*
         * =================================================
         * ABORT / TIMEOUT / NETWORK
         * =================================================
         */

        throw createNetworkAPIError(

            error,

            duration,

            controller.signal

        );

    }
    finally {

        clear();

    }

}


/* =========================================================
   INTERNAL CORE EXPORT
========================================================= */

window.GENZVisionCore =
    Object.freeze({

        CONFIG:
            VISION_API_CONFIG,

        getState,

        getAccessToken,

        createTimeoutController,

        createAPIError,

        parseResponse,

        request

    });
