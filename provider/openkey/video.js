/**
 * =========================================================
 * GEN-Z.AI
 * OPENKEY VIDEO CLIENT
 * ---------------------------------------------------------
 * File:
 * provider/openkey/video.js
 *
 * Tanggung jawab:
 * - HTTP request ke OpenKey Video API
 * - createVideo()
 * - getVideo()
 * - getVideoEvents()
 * - getVideoContent()
 * - cancelVideo()
 * - deleteVideo()
 * - waitForVideo()
 * - normalizeVideoStatus()
 *
 * Tidak bertanggung jawab:
 * - konfigurasi model
 * - parameter model
 * - pricing
 * - credit
 * - Supabase
 * - generation history
 * - frontend
 * - workflow model
 *
 * OpenKey Video API:
 *
 * POST   /v1/videos
 * GET    /v1/videos/{id}
 * GET    /v1/videos/{id}/events
 * GET    /v1/videos/{id}/content
 * POST   /v1/videos/{id}/cancel
 * DELETE /v1/videos/{id}
 *
 * OpenKey video merupakan asynchronous job.
 * =========================================================
 */


/**
 * =========================================================
 * DEFAULT CONFIGURATION
 * =========================================================
 */

const DEFAULT_BASE_URL =
    "https://api.openkey.ai";

const VIDEO_PATH =
    "/v1/videos";


/**
 * =========================================================
 * NORMALIZE BASE URL
 * =========================================================
 */

function normalizeBaseUrl(value) {

    const url =
        String(
            value ||
            DEFAULT_BASE_URL
        ).trim();

    return url.replace(
        /\/+$/,
        ""
    );

}


/**
 * =========================================================
 * API KEY
 * =========================================================
 *
 * Prioritas:
 *
 * 1. apiKey dari caller
 * 2. OPENKEY_API_KEY
 *
 * Client tidak mengetahui sumber credential.
 * =========================================================
 */

function getApiKey(
    apiKey = null
) {

    const key =
        apiKey ||

        process.env.OPENKEY_API_KEY;


    if (!key) {

        const error =
            new Error(
                "OPENKEY_API_KEY belum dikonfigurasi."
            );

        error.code =
            "OPENKEY_API_KEY_MISSING";

        throw error;

    }


    const normalized =
        String(
            key
        ).trim();


    if (!normalized) {

        const error =
            new Error(
                "OPENKEY_API_KEY kosong."
            );

        error.code =
            "OPENKEY_API_KEY_EMPTY";

        throw error;

    }


    return normalized;

}


/**
 * =========================================================
 * BASE URL
 * =========================================================
 *
 * OPENKEY_VIDEO_API_ENDPOINT:
 *   khusus endpoint video jika diperlukan.
 *
 * OPENKEY_API_ENDPOINT:
 *   endpoint OpenKey yang sudah digunakan project.
 *
 * OPENKEY_API_BASE_URL:
 *   fallback compatibility.
 *
 * Jika tidak ada konfigurasi:
 *   https://api.openkey.ai
 *
 * Catatan:
 * client.js yang sudah ada tidak disentuh.
 * =========================================================
 */

function getBaseUrl() {

    return normalizeBaseUrl(

        process.env.OPENKEY_VIDEO_API_ENDPOINT ||

        process.env.OPENKEY_API_ENDPOINT ||

        process.env.OPENKEY_API_BASE_URL ||

        DEFAULT_BASE_URL

    );

}


/**
 * =========================================================
 * BUILD URL
 * =========================================================
 */

function buildUrl(
    path
) {

    const normalizedPath =
        String(
            path || ""
        ).startsWith("/")

            ? String(path)

            : `/${String(path)}`;


    return (
        getBaseUrl() +
        normalizedPath
    );

}


/**
 * =========================================================
 * VIDEO URL
 * =========================================================
 */

function buildVideoUrl(
    videoId
) {

    const normalizedId =
        String(
            videoId || ""
        ).trim();


    if (!normalizedId) {

        const error =
            new Error(
                "videoId OpenKey wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_ID_REQUIRED";

        throw error;

    }


    return buildUrl(

        `${VIDEO_PATH}/${encodeURIComponent(
            normalizedId
        )}`

    );

}


/**
 * =========================================================
 * EXTRACT ERROR MESSAGE
 * =========================================================
 */

function extractMessage(
    data,
    fallback
) {

    if (!data) {

        return fallback;

    }


    if (
        typeof data === "string"
    ) {

        return data || fallback;

    }


    return (

        data.message ||

        data.error?.message ||

        data.error?.description ||

        data.msg ||

        data.code ||

        fallback

    );

}


/**
 * =========================================================
 * PARSE JSON RESPONSE
 * =========================================================
 */

async function parseJsonResponse(
    response
) {

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    if (
        contentType
            .toLowerCase()
            .includes(
                "application/json"
            )
    ) {

        try {

            return await response.json();

        } catch {

            return null;

        }

    }


    const text =
        await response.text();


    if (!text) {

        return null;

    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return {
            raw: text
        };

    }

}


/**
 * =========================================================
 * GENERIC JSON REQUEST
 * =========================================================
 *
 * Dipakai untuk:
 *
 * - create
 * - poll
 * - cancel
 * - delete
 *
 * Tidak dipakai untuk content karena content adalah
 * binary video/mp4.
 * =========================================================
 */

async function request(
    path,
    options = {}
) {

    const method =
        String(
            options.method ||
            "GET"
        ).toUpperCase();


    const apiKey =
        getApiKey(
            options.apiKey
        );


    const headers = {

        Accept:
            "application/json",

        Authorization:
            `Bearer ${apiKey}`,

        ...(options.headers || {})

    };


    if (
        options.body !== undefined &&
        !headers["Content-Type"] &&
        !headers["content-type"]
    ) {

        headers["Content-Type"] =
            "application/json";

    }


    const requestOptions = {

        method,

        headers

    };


    if (
        options.body !== undefined
    ) {

        requestOptions.body =

            typeof options.body === "string"

                ? options.body

                : JSON.stringify(
                    options.body
                );

    }


    let response;


    try {

        response =
            await fetch(
                buildUrl(path),
                requestOptions
            );

    } catch (error) {

        const networkError =
            new Error(
                `Gagal terhubung ke OpenKey: ${error.message}`
            );

        networkError.code =
            "OPENKEY_NETWORK_ERROR";

        networkError.cause =
            error;

        throw networkError;

    }


    const data =
        await parseJsonResponse(
            response
        );


    if (
        !response.ok
    ) {

        const message =
            extractMessage(

                data,

                `OpenKey request gagal (${response.status}).`

            );


        const error =
            new Error(
                message
            );


        error.status =
            response.status;


        error.code =
            data?.error?.code ||

            data?.code ||

            `HTTP_${response.status}`;


        error.response =
            data;


        error.headers =
            Object.fromEntries(
                response.headers.entries()
            );


        throw error;

    }


    return {

        data,

        headers:
            Object.fromEntries(
                response.headers.entries()
            ),

        status:
            response.status

    };

}


/**
 * =========================================================
 * VALIDATE CREATE PAYLOAD
 * =========================================================
 */

function validateCreatePayload(
    payload
) {

    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {

        const error =
            new Error(
                "Payload OpenKey Video harus berupa object."
            );

        error.code =
            "INVALID_OPENKEY_VIDEO_PAYLOAD";

        throw error;

    }


    if (
        !payload.model ||
        typeof payload.model !== "string"
    ) {

        const error =
            new Error(
                "Model OpenKey Video wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_MODEL_REQUIRED";

        throw error;

    }


    if (
        !payload.prompt ||
        typeof payload.prompt !== "string"
    ) {

        const error =
            new Error(
                "Prompt OpenKey Video wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_PROMPT_REQUIRED";

        throw error;

    }

}


/**
 * =========================================================
 * CREATE VIDEO
 * =========================================================
 *
 * OpenKey:
 *
 * POST /v1/videos
 *
 * Response:
 *
 * HTTP 202
 *
 * Headers:
 * - Location
 * - X-OpenKey-Job-Id
 * - X-OpenKey-Job-Kind
 * - X-OpenKey-Job-Status
 * - Retry-After
 *
 * Idempotency:
 *
 * X-OpenKey-Idempotency-Key
 *
 * hanya digunakan pada POST /v1/videos.
 * =========================================================
 */

async function createVideo(
    payload,
    apiKey = null,
    options = {}
) {

    validateCreatePayload(
        payload
    );


    const headers = {};


    const idempotencyKey =
        options.idempotencyKey;


    if (
        idempotencyKey
    ) {

        headers[
            "X-OpenKey-Idempotency-Key"
        ] =
            String(
                idempotencyKey
            ).trim();

    }


    const result =
        await request(

            VIDEO_PATH,

            {

                method:
                    "POST",

                body:
                    payload,

                apiKey,

                headers

            }

        );


    const response =
        result.data;


    const videoId =

        response?.id ||

        response?.video_id ||

        response?.video?.id ||

        result.headers[
            "x-openkey-job-id"
        ] ||

        extractIdFromLocation(
            result.headers.location
        );


    if (!videoId) {

        const error =
            new Error(
                "OpenKey tidak mengembalikan video job ID."
            );

        error.code =
            "OPENKEY_VIDEO_ID_MISSING";

        error.response =
            response;

        error.headers =
            result.headers;

        throw error;

    }


    return {

        ...response,

        videoId,

        jobId:
            videoId,

        location:
            result.headers.location ||
            null,

        retryAfter:
            parseRetryAfter(
                result.headers[
                    "retry-after"
                ]
            ),

        jobStatus:
            result.headers[
                "x-openkey-job-status"
            ] || null,

        jobKind:
            result.headers[
                "x-openkey-job-kind"
            ] || "video",

        idempotentReplay:
            result.headers[
                "x-openkey-idempotent-replay"
            ] === "true",

        headers:
            result.headers

    };

}


/**
 * =========================================================
 * EXTRACT ID FROM LOCATION
 * =========================================================
 */

function extractIdFromLocation(
    location
) {

    if (!location) {

        return null;

    }


    try {

        const url =
            new URL(
                location,
                getBaseUrl()
            );


        const parts =
            url.pathname
                .split("/")
                .filter(Boolean);


        const index =
            parts.lastIndexOf(
                "videos"
            );


        if (
            index !== -1 &&
            parts[index + 1]
        ) {

            return decodeURIComponent(
                parts[index + 1]
            );

        }


        return null;

    } catch {

        return null;

    }

}


/**
 * =========================================================
 * PARSE RETRY-AFTER
 * =========================================================
 */

function parseRetryAfter(
    value
) {

    if (!value) {

        return null;

    }


    const numeric =
        Number(
            value
        );


    if (
        Number.isFinite(
            numeric
        ) &&
        numeric >= 0
    ) {

        return numeric;

    }


    const date =
        Date.parse(
            value
        );


    if (
        Number.isFinite(
            date
        )
    ) {

        return Math.max(

            0,

            Math.ceil(
                (
                    date -
                    Date.now()
                ) / 1000
            )

        );

    }


    return null;

}


/**
 * =========================================================
 * GET VIDEO
 * =========================================================
 *
 * GET /v1/videos/{id}
 *
 * Bisa menggunakan:
 *
 * ?wait=60
 *
 * jika OpenKey mengiklankan kemampuan long-poll melalui
 * X-OpenKey-Job-Wait.
 * =========================================================
 */

async function getVideo(
    videoId,
    apiKey = null,
    options = {}
) {

    const normalizedId =
        String(
            videoId || ""
        ).trim();


    if (!normalizedId) {

        const error =
            new Error(
                "videoId OpenKey wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_ID_REQUIRED";

        throw error;

    }


    const query =
        new URLSearchParams();


    const wait =
        Number(
            options.wait || 0
        );


    if (
        Number.isFinite(wait) &&
        wait > 0
    ) {

        query.set(

            "wait",

            String(
                Math.min(
                    Math.floor(wait),
                    60
                )
            )

        );

    }


    const path =

        `${VIDEO_PATH}/${encodeURIComponent(
            normalizedId
        )}` +

        (
            query.toString()
                ? `?${query.toString()}`
                : ""
        );


    const result =
        await request(

            path,

            {

                method:
                    "GET",

                apiKey

            }

        );


    const body =
        result.data;


    return {

        ...body,

        videoId:
            body?.id ||
            normalizedId,

        jobId:
            body?.id ||
            normalizedId,

        status:
            normalizeVideoStatus(

                body,

                result.headers

            ),

        rawStatus:
            body?.status ||
            null,

        retryAfter:
            parseRetryAfter(
                result.headers[
                    "retry-after"
                ]
            ),

        jobStatus:
            result.headers[
                "x-openkey-job-status"
            ] || null,

        jobKind:
            result.headers[
                "x-openkey-job-kind"
            ] || "video",

        waitSupported:
            result.headers[
                "x-openkey-job-wait"
            ] || null,

        eventsPath:
            result.headers[
                "x-openkey-job-events"
            ] || null,

        headers:
            result.headers

    };

}


/**
 * =========================================================
 * NORMALIZE VIDEO STATUS
 * =========================================================
 *
 * OpenKey canonical status:
 *
 * queued
 * running
 * succeeded
 * failed
 * cancelled
 * expired
 *
 * Body video status tetap Sora-shaped:
 *
 * queued
 * in_progress
 * completed
 * failed
 *
 * Karena itu HEADER harus diprioritaskan.
 * =========================================================
 */

function normalizeVideoStatus(
    video,
    headers = {}
) {

    const headerStatus =

        headers[
            "x-openkey-job-status"
        ];


    if (
        headerStatus
    ) {

        return String(
            headerStatus
        )
            .trim()
            .toLowerCase();

    }


    const bodyStatus =

        video?.status ||

        video?.state ||

        "";


    const normalized =
        String(
            bodyStatus
        )
            .trim()
            .toLowerCase();


    switch (
        normalized
    ) {

        case "queued":

            return "queued";


        case "running":

            return "running";


        case "in_progress":

            return "running";


        case "processing":

            return "running";


        case "succeeded":

            return "succeeded";


        case "completed":

            return "succeeded";


        case "success":

            return "succeeded";


        case "failed":

            if (
                video?.error?.code ===
                "cancelled"
            ) {

                return "cancelled";

            }

            return "failed";


        case "cancelled":

            return "cancelled";


        case "canceled":

            return "cancelled";


        case "expired":

            return "expired";


        default:

            return normalized ||
                "unknown";

    }

}


/**
 * =========================================================
 * TERMINAL STATUS
 * =========================================================
 */

function isTerminalVideoStatus(
    status
) {

    return new Set([

        "succeeded",
        "failed",
        "cancelled",
        "expired"

    ]).has(

        String(
            status || ""
        )
            .trim()
            .toLowerCase()

    );

}


/**
 * =========================================================
 * GET VIDEO EVENTS
 * =========================================================
 *
 * Mengembalikan Response asli karena endpoint ini
 * merupakan SSE.
 *
 * Tidak dipakai polling utama.
 * Disiapkan untuk tahap berikutnya.
 * =========================================================
 */

async function getVideoEvents(
    videoId,
    apiKey = null
) {

    const normalizedId =
        String(
            videoId || ""
        ).trim();


    if (!normalizedId) {

        const error =
            new Error(
                "videoId OpenKey wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_ID_REQUIRED";

        throw error;

    }


    const key =
        getApiKey(
            apiKey
        );


    let response;


    try {

        response =
            await fetch(

                buildUrl(

                    `${VIDEO_PATH}/${encodeURIComponent(
                        normalizedId
                    )}/events`

                ),

                {

                    method:
                        "GET",

                    headers: {

                        Accept:
                            "text/event-stream",

                        Authorization:
                            `Bearer ${key}`

                    }

                }

            );

    } catch (error) {

        const networkError =
            new Error(
                `Gagal terhubung ke OpenKey Events: ${error.message}`
            );

        networkError.code =
            "OPENKEY_EVENTS_NETWORK_ERROR";

        networkError.cause =
            error;

        throw networkError;

    }


    if (!response.ok) {

        const data =
            await parseJsonResponse(
                response
            );


        const error =
            new Error(

                extractMessage(

                    data,

                    `OpenKey Events gagal (${response.status}).`

                )

            );


        error.status =
            response.status;

        error.code =
            data?.error?.code ||
            data?.code ||
            `HTTP_${response.status}`;

        error.response =
            data;

        throw error;

    }


    return response;

}


/**
 * =========================================================
 * GET VIDEO CONTENT
 * =========================================================
 *
 * GET /v1/videos/{id}/content
 *
 * Response:
 *
 * video/mp4
 *
 * Endpoint ini sengaja mengembalikan Response asli.
 * Jangan mengubah menjadi JSON.
 *
 * 409:
 * job_not_ready
 * =========================================================
 */

async function getVideoContent(
    videoId,
    apiKey = null
) {

    const normalizedId =
        String(
            videoId || ""
        ).trim();


    if (!normalizedId) {

        const error =
            new Error(
                "videoId OpenKey wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_ID_REQUIRED";

        throw error;

    }


    const key =
        getApiKey(
            apiKey
        );


    let response;


    try {

        response =
            await fetch(

                buildVideoUrl(
                    normalizedId
                ) +
                "/content",

                {

                    method:
                        "GET",

                    headers: {

                        Accept:
                            "video/mp4",

                        Authorization:
                            `Bearer ${key}`

                    }

                }

            );

    } catch (error) {

        const networkError =
            new Error(
                `Gagal mengambil video dari OpenKey: ${error.message}`
            );

        networkError.code =
            "OPENKEY_VIDEO_CONTENT_NETWORK_ERROR";

        networkError.cause =
            error;

        throw networkError;

    }


    if (!response.ok) {

        const data =
            await parseJsonResponse(
                response
            );


        const error =
            new Error(

                extractMessage(

                    data,

                    response.status === 409

                        ? "Video OpenKey belum siap."

                        : `Gagal mengambil content video OpenKey (${response.status}).`

                )

            );


        error.status =
            response.status;


        error.code =
            data?.error?.code ||

            data?.code ||

            (
                response.status === 409
                    ? "OPENKEY_VIDEO_NOT_READY"
                    : `HTTP_${response.status}`
            );


        error.response =
            data;


        throw error;

    }


    return response;

}


/**
 * =========================================================
 * GET VIDEO CONTENT AS BUFFER
 * =========================================================
 *
 * Helper server-side.
 *
 * Dipakai jika layer generate perlu mendapatkan binary
 * video untuk kemudian diproses / disimpan / diteruskan.
 * =========================================================
 */

async function getVideoContentBuffer(
    videoId,
    apiKey = null
) {

    const response =
        await getVideoContent(
            videoId,
            apiKey
        );


    const arrayBuffer =
        await response.arrayBuffer();


    return {

        buffer:
            Buffer.from(
                arrayBuffer
            ),

        contentType:
            response.headers.get(
                "content-type"
            ) ||
            "video/mp4",

        contentLength:
            response.headers.get(
                "content-length"
            ) || null

    };

}


/**
 * =========================================================
 * CANCEL VIDEO
 * =========================================================
 *
 * POST /v1/videos/{id}/cancel
 *
 * OpenKey mencatat job sebagai cancelled dan menghentikan
 * polling OpenKey.
 *
 * Ini tidak berarti provider upstream benar-benar
 * menghentikan rendering.
 * =========================================================
 */

async function cancelVideo(
    videoId,
    apiKey = null
) {

    const path =

        `${VIDEO_PATH}/${encodeURIComponent(
            String(videoId || "").trim()
        )}/cancel`;


    return request(

        path,

        {

            method:
                "POST",

            apiKey

        }

    );

}


/**
 * =========================================================
 * DELETE VIDEO
 * =========================================================
 *
 * DELETE /v1/videos/{id}
 *
 * OpenKey juga menyediakan DELETE sebagai cancellation
 * spelling.
 * =========================================================
 */

async function deleteVideo(
    videoId,
    apiKey = null
) {

    const normalizedId =
        String(
            videoId || ""
        ).trim();


    if (!normalizedId) {

        const error =
            new Error(
                "videoId OpenKey wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_ID_REQUIRED";

        throw error;

    }


    return request(

        `${VIDEO_PATH}/${encodeURIComponent(
            normalizedId
        )}`,

        {

            method:
                "DELETE",

            apiKey

        }

    );

}


/**
 * =========================================================
 * WAIT FOR VIDEO
 * =========================================================
 *
 * Default:
 *
 * polling:
 *   mengikuti Retry-After jika tersedia
 *
 * fallback:
 *   3 detik
 *
 * timeout:
 *   15 menit
 *
 * OpenKey mendukung ?wait= sampai 60 detik.
 * Namun default adapter menggunakan polling biasa agar
 * perilakunya tetap dekat dengan KIE client yang sudah
 * ada.
 * =========================================================
 */

async function waitForVideo(
    videoId,
    options = {}
) {

    const apiKey =
        options.apiKey ||
        null;


    const intervalMs =
        Number(
            options.intervalMs ||
            3000
        );


    const timeoutMs =
        Number(
            options.timeoutMs ||
            15 * 60 * 1000
        );


    const useLongPoll =
        options.useLongPoll === true;


    const longPollSeconds =
        Math.min(

            Math.max(

                Number(
                    options.longPollSeconds ||
                    60
                ),

                1

            ),

            60

        );


    const startedAt =
        Date.now();


    while (true) {

        const result =
            await getVideo(

                videoId,

                apiKey,

                {

                    wait:
                        useLongPoll
                            ? longPollSeconds
                            : 0

                }

            );


        const status =
            result.status;


        if (
            isTerminalVideoStatus(
                status
            )
        ) {

            return {

                ...result,

                status

            };

        }


        if (
            Date.now() -
            startedAt >=
            timeoutMs
        ) {

            const error =
                new Error(
                    "Timeout menunggu video OpenKey."
                );

            error.code =
                "OPENKEY_VIDEO_TIMEOUT";

            error.videoId =
                videoId;

            error.response =
                result;

            throw error;

        }


        const retryAfterMs =

            result.retryAfter !== null &&

            Number.isFinite(
                result.retryAfter
            )

                ? result.retryAfter * 1000

                : intervalMs;


        const delayMs =
            Math.max(

                250,

                retryAfterMs

            );


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    delayMs
                )
        );

    }

}


/**
 * =========================================================
 * EXTRACT VIDEO ID
 * =========================================================
 */

function extractVideoId(
    response
) {

    if (
        !response ||
        typeof response !== "object"
    ) {

        return null;

    }


    return (

        response.videoId ||

        response.jobId ||

        response.id ||

        response.data?.id ||

        response.video?.id ||

        extractIdFromLocation(
            response.location
        )

    );

}


/**
 * =========================================================
 * EXTRACT VIDEO CONTENT PATH
 * =========================================================
 *
 * OpenKey content endpoint memerlukan Authorization,
 * sehingga jangan menganggap URL ini sebagai public URL.
 * =========================================================
 */

function buildVideoContentPath(
    videoId
) {

    const normalizedId =
        String(
            videoId || ""
        ).trim();


    if (!normalizedId) {

        const error =
            new Error(
                "videoId OpenKey wajib diisi."
            );

        error.code =
            "OPENKEY_VIDEO_ID_REQUIRED";

        throw error;

    }


    return (

        `${VIDEO_PATH}/${encodeURIComponent(
            normalizedId
        )}/content`

    );

}


/**
 * =========================================================
 * EXTRACT VIDEO URL
 * =========================================================
 *
 * OpenKey tidak mengharuskan URL public pada job response.
 * Output resmi diambil melalui /content.
 *
 * Jika suatu deployment/provider response memang membawa
 * URL eksplisit, helper ini tetap bisa mengambilnya.
 * =========================================================
 */

function extractVideoUrl(
    video
) {

    if (
        !video ||
        typeof video !== "object"
    ) {

        return null;

    }


    return (

        video.video_url ||

        video.videoUrl ||

        video.url ||

        video.output_url ||

        video.outputUrl ||

        video.result?.url ||

        video.output?.url ||

        null

    );

}


/**
 * =========================================================
 * CLIENT EXPORT
 * =========================================================
 */

const client = {

    request,

    createVideo,

    getVideo,

    getVideoEvents,

    getVideoContent,

    getVideoContentBuffer,

    cancelVideo,

    deleteVideo,

    waitForVideo,

    extractVideoId,

    extractVideoUrl,

    buildVideoContentPath,

    normalizeVideoStatus,

    isTerminalVideoStatus,

    getApiKey,

    getBaseUrl,

    buildUrl,

    buildVideoUrl

};


export {

    DEFAULT_BASE_URL,

    VIDEO_PATH,

    normalizeBaseUrl,

    getApiKey,

    getBaseUrl,

    buildUrl,

    buildVideoUrl,

    request,

    createVideo,

    getVideo,

    getVideoEvents,

    getVideoContent,

    getVideoContentBuffer,

    cancelVideo,

    deleteVideo,

    waitForVideo,

    extractVideoId,

    extractVideoUrl,

    buildVideoContentPath,

    normalizeVideoStatus,

    isTerminalVideoStatus

};


export default client;
