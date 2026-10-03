/**
 * =========================================================
 * GEN-Z.AI
 * OPENKEY GENERIC CLIENT
 * ---------------------------------------------------------
 * File:
 * provider/openkey/client.js
 *
 * Tanggung jawab:
 * - HTTP request ke OpenKey
 * - GET /v1/models
 * - POST /v1/chat/completions
 * - streaming response OpenKey
 * - parsing SSE
 * - error handling
 *
 * Tidak bertanggung jawab:
 * - Supabase Auth
 * - provider_credentials
 * - decrypt API key
 * - pricing
 * - credit GEN-Z.AI
 * - model configuration
 * - tool execution
 * - workflow AI
 * - frontend
 * - KIE.AI
 *
 * OpenKey API:
 *
 * GET  /v1/models
 * POST /v1/chat/completions
 *
 * Base URL:
 * https://open.api-github.com/v1
 * =========================================================
 */


/**
 * =========================================================
 * DEFAULT CONFIGURATION
 * =========================================================
 */

const DEFAULT_BASE_URL =
    "https://open.api-github.com/v1";


const MODELS_PATH =
    "/models";


const CHAT_COMPLETIONS_PATH =
    "/chat/completions";


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
 * Client menerima API key dari caller.
 *
 * Client TIDAK mengatur:
 * - Supabase
 * - provider_credentials
 * - database
 * - decrypt
 *
 * Fallback environment variable hanya digunakan sebagai
 * fallback server-side.
 *
 * API key TIDAK PERNAH dikirim kembali ke caller.
 * =========================================================
 */

function getApiKey(
    apiKey = null
) {

    const suppliedKey =
        apiKey
            ? String(
                apiKey
            ).trim()
            : "";


    if (
        suppliedKey
    ) {

        return suppliedKey;

    }


    const environmentKey =
        process.env.OPENKEY_API_KEY;


    if (!environmentKey) {

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
            environmentKey
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
 * Prioritas:
 *
 * 1. OPENKEY_API_ENDPOINT
 * 2. OPENKEY_API_BASE_URL
 * 3. DEFAULT_BASE_URL
 *
 * Tidak ada dependency terhadap KIE.
 * =========================================================
 */

function getBaseUrl() {

    return normalizeBaseUrl(

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

function buildUrl(path) {

    const normalizedPath =
        String(
            path || ""
        ).startsWith("/")
            ? String(
                path
            )
            : `/${String(path)}`;


    return (
        getBaseUrl() +
        normalizedPath
    );

}


/**
 * =========================================================
 * RESPONSE PARSER
 * =========================================================
 *
 * Digunakan untuk response JSON/non-stream.
 *
 * Tidak digunakan untuk streaming body karena stream
 * harus diproses secara incremental.
 * =========================================================
 */

async function parseResponse(
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

        return response.json();

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
 * ERROR MESSAGE
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

        return data;

    }


    return (

        data.message ||

        data.error?.message ||

        data.error ||

        data.msg ||

        data.error_message ||

        data.error_description ||

        data?.data?.message ||

        data?.data?.error ||

        data?.data?.msg ||

        fallback

    );

}


/**
 * =========================================================
 * ERROR CODE
 * =========================================================
 */

function extractErrorCode(
    data,
    status
) {

    if (
        data &&
        typeof data === "object"
    ) {

        return (

            data.error?.code ||

            data.code ||

            data.error_code ||

            data?.data?.code ||

            `HTTP_${status}`

        );

    }


    return `HTTP_${status}`;

}


/**
 * =========================================================
 * CREATE OPENKEY ERROR
 * =========================================================
 */

function createOpenKeyError(
    message,
    options = {}
) {

    const error =
        new Error(
            message
        );


    if (
        options.status !== undefined
    ) {

        error.status =
            options.status;

    }


    if (
        options.code
    ) {

        error.code =
            options.code;

    }


    if (
        options.response !== undefined
    ) {

        error.response =
            options.response;

    }


    if (
        options.cause
    ) {

        error.cause =
            options.cause;

    }


    return error;

}


/**
 * =========================================================
 * GENERIC REQUEST
 * =========================================================
 *
 * Digunakan untuk endpoint JSON OpenKey.
 *
 * Caller dapat memberikan:
 *
 * {
 *     method,
 *     body,
 *     apiKey,
 *     headers
 * }
 *
 * API key tidak pernah dimasukkan ke response.
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

        throw createOpenKeyError(

            `Gagal terhubung ke OpenKey: ${error.message}`,

            {

                code:
                    "OPENKEY_NETWORK_ERROR",

                cause:
                    error

            }

        );

    }


    const data =
        await parseResponse(
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


        throw createOpenKeyError(

            message,

            {

                status:
                    response.status,

                code:
                    extractErrorCode(
                        data,
                        response.status
                    ),

                response:
                    data

            }

        );

    }


    return data;

}


/**
 * =========================================================
 * LIST MODELS
 * =========================================================
 *
 * GET:
 *
 * /v1/models
 *
 * Return:
 *
 * {
 *     data: [...]
 * }
 *
 * Tidak melakukan filtering model.
 * Model catalog dikembalikan apa adanya dari OpenKey.
 * =========================================================
 */

async function listModels(
    apiKey = null
) {

    return request(

        MODELS_PATH,

        {

            method:
                "GET",

            apiKey

        }

    );

}


/**
 * =========================================================
 * CHAT COMPLETION
 * =========================================================
 *
 * POST:
 *
 * /v1/chat/completions
 *
 * Contoh payload:
 *
 * {
 *     model: "gpt-5.6-luna",
 *     messages: [
 *         {
 *             role: "user",
 *             content: "Hello"
 *         }
 *     ]
 * }
 *
 * Streaming TIDAK digunakan di function ini.
 *
 * Untuk streaming gunakan:
 *
 * streamChatCompletion()
 * =========================================================
 */

async function chatCompletion(
    payload,
    apiKey = null
) {

    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {

        throw createOpenKeyError(

            "Payload OpenKey harus berupa object.",

            {

                code:
                    "INVALID_OPENKEY_PAYLOAD"

            }

        );

    }


    if (
        !payload.model
    ) {

        throw createOpenKeyError(

            "Model OpenKey wajib diisi.",

            {

                code:
                    "OPENKEY_MODEL_REQUIRED"

            }

        );

    }


    if (
        !Array.isArray(
            payload.messages
        )
    ) {

        throw createOpenKeyError(

            "messages OpenKey harus berupa array.",

            {

                code:
                    "OPENKEY_MESSAGES_REQUIRED"

            }

        );

    }


    return request(

        CHAT_COMPLETIONS_PATH,

        {

            method:
                "POST",

            body:
                payload,

            apiKey

        }

    );

}


/**
 * =========================================================
 * STREAM CHAT COMPLETION
 * =========================================================
 *
 * POST:
 *
 * /v1/chat/completions
 *
 * Dengan:
 *
 * stream: true
 *
 * Function ini mengembalikan:
 *
 * Response
 *
 * BUKAN JSON.
 *
 * Caller bertanggung jawab membaca:
 *
 * response.body
 *
 * secara incremental.
 *
 * Hal ini sengaja dilakukan supaya:
 *
 * - delta.content
 * - delta.tool_calls
 * - reasoning
 * - usage
 *
 * tetap tersedia bagi layer di atasnya.
 *
 * Client provider TIDAK memutuskan bagian mana yang
 * boleh ditampilkan ke user.
 * =========================================================
 */

async function streamChatCompletion(
    payload,
    apiKey = null
) {

    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {

        throw createOpenKeyError(

            "Payload OpenKey harus berupa object.",

            {

                code:
                    "INVALID_OPENKEY_PAYLOAD"

            }

        );

    }


    if (
        !payload.model
    ) {

        throw createOpenKeyError(

            "Model OpenKey wajib diisi.",

            {

                code:
                    "OPENKEY_MODEL_REQUIRED"

            }

        );

    }


    if (
        !Array.isArray(
            payload.messages
        )
    ) {

        throw createOpenKeyError(

            "messages OpenKey harus berupa array.",

            {

                code:
                    "OPENKEY_MESSAGES_REQUIRED"

            }

        );

    }


    const normalizedPayload = {

        ...payload,

        stream:
            true

    };


    const normalizedApiKey =
        getApiKey(
            apiKey
        );


    let response;


    try {

        response =
            await fetch(

                buildUrl(
                    CHAT_COMPLETIONS_PATH
                ),

                {

                    method:
                        "POST",

                    headers: {

                        Accept:
                            "text/event-stream",

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${normalizedApiKey}`

                    },

                    body:
                        JSON.stringify(
                            normalizedPayload
                        )

                }

            );

    } catch (error) {

        throw createOpenKeyError(

            `Gagal terhubung ke OpenKey: ${error.message}`,

            {

                code:
                    "OPENKEY_NETWORK_ERROR",

                cause:
                    error

            }

        );

    }


    if (
        !response.ok
    ) {

        const data =
            await parseResponse(
                response
            );


        const message =
            extractMessage(

                data,

                `OpenKey streaming request gagal (${response.status}).`

            );


        throw createOpenKeyError(

            message,

            {

                status:
                    response.status,

                code:
                    extractErrorCode(
                        data,
                        response.status
                    ),

                response:
                    data

            }

        );

    }


    if (
        !response.body
    ) {

        throw createOpenKeyError(

            "OpenKey tidak mengembalikan response stream.",

            {

                code:
                    "OPENKEY_STREAM_BODY_MISSING"

            }

        );

    }


    return response;

}


/**
 * =========================================================
 * PARSE SSE DATA
 * =========================================================
 *
 * OpenKey mengirim:
 *
 * data: {...}
 *
 * dan pada akhir:
 *
 * data: [DONE]
 *
 * Function ini hanya memproses satu payload SSE.
 *
 * Tidak membuang:
 * - reasoning
 * - tool_calls
 * - usage
 *
 * karena layer di atas yang menentukan penggunaannya.
 * =========================================================
 */

function parseSSEData(
    value
) {

    const data =
        String(
            value ?? ""
        ).trim();


    if (!data) {

        return null;

    }


    if (
        data === "[DONE]"
    ) {

        return {

            done:
                true,

            data:
                null

        };

    }


    try {

        return {

            done:
                false,

            data:
                JSON.parse(
                    data
                )

        };

    } catch (error) {

        const parseError =
            createOpenKeyError(

                "Payload SSE OpenKey bukan JSON yang valid.",

                {

                    code:
                        "OPENKEY_SSE_JSON_ERROR",

                    cause:
                        error

                }

            );


        parseError.raw =
            data;


        throw parseError;

    }

}


/**
 * =========================================================
 * SSE DATA LINE
 * =========================================================
 *
 * Input:
 *
 * "data: {...}"
 *
 * Output:
 *
 * "{...}"
 *
 * Line selain data: dikembalikan null.
 * =========================================================
 */

function extractSSEDataLine(
    line
) {

    const normalized =
        String(
            line ?? ""
        );


    if (
        !normalized.startsWith(
            "data:"
        )
    ) {

        return null;

    }


    return normalized
        .slice(5)
        .trimStart();

}


/**
 * =========================================================
 * SSE STREAM CONSUMER
 * =========================================================
 *
 * Mengubah response.body menjadi async generator.
 *
 * Setiap yield berbentuk:
 *
 * {
 *     done: false,
 *     data: {...}
 * }
 *
 * atau:
 *
 * {
 *     done: true,
 *     data: null
 * }
 *
 * Mendukung:
 *
 * - chunk TCP terfragmentasi
 * - event SSE terpecah
 * - beberapa event dalam satu chunk
 * - [DONE]
 *
 * Tidak mengubah isi JSON OpenKey.
 * =========================================================
 */

async function* consumeSSE(
    response
) {

    if (
        !response ||
        !response.body
    ) {

        throw createOpenKeyError(

            "Response stream OpenKey tidak memiliki body.",

            {

                code:
                    "OPENKEY_STREAM_BODY_MISSING"

            }

        );

    }


    const reader =
        response.body.getReader();


    const decoder =
        new TextDecoder(
            "utf-8"
        );


    let buffer =
        "";


    try {

        while (true) {

            const {
                done,
                value
            } =
                await reader.read();


            if (
                done
            ) {

                break;

            }


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream:
                            true
                    }
                );


            /*
             * SSE event dipisahkan oleh blank line.
             *
             * Mendukung:
             *
             * \n\n
             * \r\n\r\n
             */

            const events =
                buffer.split(
                    /\r?\n\r?\n/
                );


            buffer =
                events.pop() || "";


            for (
                const event
                of events
            ) {

                const lines =
                    event.split(
                        /\r?\n/
                    );


                for (
                    const line
                    of lines
                ) {

                    const dataLine =
                        extractSSEDataLine(
                            line
                        );


                    if (
                        dataLine === null
                    ) {

                        continue;

                    }


                    const parsed =
                        parseSSEData(
                            dataLine
                        );


                    if (
                        !parsed
                    ) {

                        continue;

                    }


                    yield parsed;


                    if (
                        parsed.done
                    ) {

                        return;

                    }

                }

            }

        }


        /*
         * Flush decoder.
         */

        buffer +=
            decoder.decode();


        /*
         * Beberapa server dapat menutup stream tanpa
         * blank line terakhir.
         *
         * Proses event terakhir bila ada.
         */

        if (
            buffer.trim()
        ) {

            const lines =
                buffer.split(
                    /\r?\n/
                );


            for (
                const line
                of lines
            ) {

                const dataLine =
                    extractSSEDataLine(
                        line
                    );


                if (
                    dataLine === null
                ) {

                    continue;

                }


                const parsed =
                    parseSSEData(
                        dataLine
                    );


                if (
                    !parsed
                ) {

                    continue;

                }


                yield parsed;


                if (
                    parsed.done
                ) {

                    return;

                }

            }

        }

    } finally {

        try {

            reader.releaseLock();

        } catch {

            /*
             * Tidak ada tindakan.
             */

        }

    }

}


/**
 * =========================================================
 * EXTRACT VISIBLE CONTENT
 * =========================================================
 *
 * Helper kecil untuk mengambil:
 *
 * choices[].delta.content
 *
 * Tidak mengambil reasoning.
 * Tidak mengambil reasoning_details.
 *
 * Tool calls TIDAK dianggap sebagai visible content.
 *
 * Function ini hanya helper.
 * =========================================================
 */

function extractDeltaContent(
    chunk
) {

    if (
        !chunk ||
        typeof chunk !== "object"
    ) {

        return "";

    }


    const choices =
        Array.isArray(
            chunk.choices
        )
            ? chunk.choices
            : [];


    let content =
        "";


    for (
        const choice
        of choices
    ) {

        const delta =
            choice?.delta;


        if (
            typeof delta?.content ===
            "string"
        ) {

            content +=
                delta.content;

        }

    }


    return content;

}


/**
 * =========================================================
 * EXTRACT TOOL CALL DELTAS
 * =========================================================
 *
 * OpenKey dapat mengirim tool arguments secara
 * terfragmentasi.
 *
 * Function ini TIDAK menggabungkan arguments.
 *
 * Ia hanya mengambil delta mentah agar layer tool
 * calling dapat mengakumulasikannya berdasarkan index/id.
 * =========================================================
 */

function extractToolCallDeltas(
    chunk
) {

    if (
        !chunk ||
        typeof chunk !== "object"
    ) {

        return [];

    }


    const choices =
        Array.isArray(
            chunk.choices
        )
            ? chunk.choices
            : [];


    const result =
        [];


    for (
        const choice
        of choices
    ) {

        const toolCalls =
            Array.isArray(
                choice?.delta?.tool_calls
            )
                ? choice.delta.tool_calls
                : [];


        for (
            const toolCall
            of toolCalls
        ) {

            result.push(
                toolCall
            );

        }

    }


    return result;

}


/**
 * =========================================================
 * EXTRACT FINISH REASON
 * =========================================================
 */

function extractFinishReason(
    chunk
) {

    if (
        !chunk ||
        typeof chunk !== "object"
    ) {

        return null;

    }


    const choices =
        Array.isArray(
            chunk.choices
        )
            ? chunk.choices
            : [];


    for (
        const choice
        of choices
    ) {

        if (
            choice?.finish_reason
        ) {

            return choice.finish_reason;

        }

    }


    return null;

}


/**
 * =========================================================
 * EXTRACT USAGE
 * =========================================================
 *
 * Usage dikembalikan apa adanya.
 *
 * PENTING:
 *
 * usage.cost BUKAN otomatis credit GEN-Z.AI.
 *
 * Tidak ada kalkulasi credit di client ini.
 * =========================================================
 */

function extractUsage(
    response
) {

    if (
        !response ||
        typeof response !== "object"
    ) {

        return null;

    }


    return response.usage || null;

}


/**
 * =========================================================
 * CLIENT EXPORT
 * =========================================================
 */

const client = {

    request,

    listModels,

    chatCompletion,

    streamChatCompletion,

    parseSSEData,

    extractSSEDataLine,

    consumeSSE,

    extractDeltaContent,

    extractToolCallDeltas,

    extractFinishReason,

    extractUsage,

    getApiKey,

    getBaseUrl,

    buildUrl

};


export {

    DEFAULT_BASE_URL,

    MODELS_PATH,

    CHAT_COMPLETIONS_PATH,

    normalizeBaseUrl,

    getApiKey,

    getBaseUrl,

    buildUrl,

    parseResponse,

    extractMessage,

    extractErrorCode,

    createOpenKeyError,

    request,

    listModels,

    chatCompletion,

    streamChatCompletion,

    parseSSEData,

    extractSSEDataLine,

    consumeSSE,

    extractDeltaContent,

    extractToolCallDeltas,

    extractFinishReason,

    extractUsage

};


export default client;
