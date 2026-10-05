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
========================================================= */

const VISION_API_CONFIG = Object.freeze({

    endpoint:
        "/api/openkey-chat",

    /*
     * =====================================================
     * REQUEST TIMEOUT
     * =====================================================
     *
     * Default timeout:
     * 300 detik = 5 menit
     *
     * AI Vision dan Prompt Engineering dapat membutuhkan
     * waktu lebih lama daripada request API biasa.
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
   TIMEOUT
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
        options.status
    ) {

        error.status =
            options.status;

    }


    if (
        options.data
    ) {

        error.data =
            options.data;

    }


    return error;

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
   API REQUEST
========================================================= */

async function request(
    body,
    options = {}
) {

    const token =
        await getAccessToken();


    /*
     * Prioritas:
     *
     * 1. options.timeout
     * 2. VISION_API_CONFIG.timeout
     *
     * Jangan gunakan || secara langsung untuk nilai timeout
     * supaya nilai 0 tidak dianggap sebagai konfigurasi
     * yang valid secara diam-diam.
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


        const data =
            await parseResponse(
                response
            );


        if (
            !response.ok
        ) {

            throw createAPIError(

                data?.error ||
                data?.message ||
                `Vision API request gagal (${response.status}).`,

                {

                    code:
                        data?.code ||
                        "VISION_API_REQUEST_FAILED",

                    status:
                        response.status,

                    data

                }

            );

        }


        if (
            data?.success === false
        ) {

            throw createAPIError(

                data.error ||
                data.message ||
                "Vision API mengembalikan error.",

                {

                    code:
                        data.code ||
                        "VISION_API_FAILED",

                    status:
                        response.status,

                    data

                }

            );

        }


        return data;

    }
    catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            throw createAPIError(

                "Vision API timeout. Proses membutuhkan waktu terlalu lama.",

                {

                    code:
                        "VISION_API_TIMEOUT"

                }

            );

        }


        throw error;

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
