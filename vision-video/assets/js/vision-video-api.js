/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-api.js

   Fungsi:
   - API transport Vision Video
   - Authentication Supabase
   - Request ke /api/openkey-chat
   - Mengirim frame video sebagai image input
   - Menyusun multimodal analysis request
   - Normalisasi response API
   - Menyimpan hasil analysis ke state
   - Tidak menangani upload
   - Tidak menangani frame extraction
   - Tidak menangani rendering UI
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        endpoint:
            "/api/openkey-chat",

        timeout:
            120000,

        defaultTemperature:
            0.2,

        /*
         * Jumlah frame hasil extraction yang masih
         * boleh tersedia di payload.
         */
        maxFrames:
            32,

        /*
         * Jumlah frame maksimum yang benar-benar
         * dikirim ke OpenKey.
         *
         * Tujuannya mencegah request body terlalu besar.
         */
        maxRequestFrames:
            12,

        /*
         * Ukuran maksimum sisi frame yang dikirim
         * ke API.
         */
        maxImageDimension:
            960,

        /*
         * JPEG quality untuk request API.
         *
         * Frame asli tidak pernah diubah.
         */
        imageQuality:
            0.55,

        /*
         * Target maksimum payload JSON.
         *
         * Base64 memiliki overhead sekitar 33%.
         * Karena itu kita menjaga payload cukup jauh
         * dari batas server.
         */
        maxRequestPayloadBytes:
            2500000,

        systemInstruction: [
            "You are GEN-Z.AI Vision Video Engine.",
            "Analyze the supplied video frames as a chronological sequence.",
            "Treat frame order and timestamps as important temporal evidence.",
            "Do not invent visual details that are not supported by the frames.",
            "Describe subjects, actions, camera behavior, composition,",
            "environment, lighting, motion, transitions, and visual continuity.",
            "Identify changes between frames when supported by the evidence.",
            "Produce a detailed analysis suitable for reconstructing the visual",
            "structure of the source video into an AI video generation prompt.",
            "Do not include unsupported claims."
        ].join(" ")
    });


    /* =====================================================
       STATE ACCESS
    ===================================================== */

    function getState() {

        const state =
            window.GENZVisionVideoState;


        if (!state) {

            throw new Error(
                "GEN-Z.AI Vision Video State belum tersedia."
            );
        }


        return state;
    }


    /* =====================================================
       DOM EVENT DISPATCH
    ===================================================== */

    function dispatch(
        name,
        detail = {}
    ) {

        try {

            document.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Gagal dispatch event:",
                name,
                error
            );
        }
    }


    /* =====================================================
       SESSION
    ===================================================== */

    async function getSession() {

        /*
         * Prioritas:
         *
         * 1. window.supabaseClient
         * 2. window.GENZ_SUPABASE
         *
         * Tidak membuat client baru di modul ini.
         */

        const clients = [

            window.supabaseClient,

            window.GENZ_SUPABASE

        ].filter(Boolean);


        for (const client of clients) {

            try {

                if (
                    client.auth &&
                    typeof client.auth.getSession === "function"
                ) {

                    const result =
                        await client.auth.getSession();


                    if (
                        result &&
                        result.data &&
                        result.data.session
                    ) {

                        return result.data.session;
                    }
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI Vision Video] Gagal membaca session:",
                    error
                );
            }
        }


        /*
         * Beberapa project GEN-Z.AI mungkin menyediakan
         * session melalui konfigurasi global.
         */

        if (
            window.GENZVisionVideoSession &&
            window.GENZVisionVideoSession.access_token
        ) {

            return window.GENZVisionVideoSession;
        }


        return null;
    }


    /* =====================================================
       AUTH TOKEN
    ===================================================== */

    async function getAccessToken() {

        const session =
            await getSession();


        if (!session) {

            return null;
        }


        return (
            session.access_token ||
            session.accessToken ||
            null
        );
    }


    /* =====================================================
       TIMEOUT
    ===================================================== */

    function createTimeoutController(
        timeout
    ) {

        const controller =
            new AbortController();


        const timer =
            window.setTimeout(
                function () {

                    controller.abort();

                },
                timeout
            );


        return {

            controller,

            timer

        };
    }


    /* =====================================================
       ERROR NORMALIZATION
    ===================================================== */

    function normalizeError(
        error,
        fallback = "API request gagal."
    ) {

        if (!error) {

            return new Error(
                fallback
            );
        }


        if (
            error.name === "AbortError"
        ) {

            return new Error(
                "Request Vision Video timeout."
            );
        }


        if (
            error instanceof Error
        ) {

            return error;
        }


        if (
            typeof error === "string"
        ) {

            return new Error(
                error
            );
        }


        if (
            error.message
        ) {

            return new Error(
                String(
                    error.message
                )
            );
        }


        return new Error(
            fallback
        );
    }


    /* =====================================================
       RESPONSE ERROR
    ===================================================== */

    async function parseResponseBody(
        response
    ) {

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            try {

                return await response.json();

            } catch (error) {

                return null;
            }
        }


        try {

            const text =
                await response.text();


            if (!text) {

                return null;
            }


            try {

                return JSON.parse(
                    text
                );

            } catch (error) {

                return {
                    raw: text
                };
            }

        } catch (error) {

            return null;
        }
    }


    /* =====================================================
       API REQUEST
    ===================================================== */

    async function request(
        body,
        options = {}
    ) {

        const endpoint =
            options.endpoint ||
            CONFIG.endpoint;


        const timeout =
            Number(
                options.timeout
            ) ||
            CONFIG.timeout;


        const token =
            options.accessToken ||
            await getAccessToken();


        const headers = {

            "Content-Type":
                "application/json",

            "Accept":
                "application/json"

        };


        if (token) {

            headers.Authorization =
                "Bearer " + token;
        }


        const timeoutState =
            createTimeoutController(
                timeout
            );


        try {

            /*
             * =================================================
             * REQUEST PAYLOAD SIZE GUARD
             * =================================================
             *
             * Jangan menunggu server mengembalikan 413.
             * Periksa ukuran body sebelum fetch.
             */

            let serializedBody;


            try {

                serializedBody =
                    JSON.stringify(
                        body
                    );

            } catch (error) {

                throw new Error(
                    "Payload Vision Video gagal diserialisasi."
                );
            }


            const payloadBytes =
                new Blob(
                    [serializedBody]
                ).size;


            if (
                payloadBytes >
                CONFIG.maxRequestPayloadBytes
            ) {

                throw new Error(
                    "Payload Vision Video terlalu besar (" +
                    formatBytes(payloadBytes) +
                    "). Frame telah dibatasi dan dikompresi."
                );
            }


            const response =
                await fetch(
                    endpoint,
                    {
                        method:
                            "POST",

                        headers,

                        body:
                            serializedBody,

                        signal:
                            timeoutState.controller.signal,

                        credentials:
                            "same-origin"
                    }
                );


            const data =
                await parseResponseBody(
                    response
                );


            if (!response.ok) {

                const serverMessage =
                    extractErrorMessage(
                        data
                    );


                throw new Error(
                    serverMessage ||
                    `HTTP ${response.status}`
                );
            }


            return data;

        } catch (error) {

            throw normalizeError(
                error,
                "Vision Video API request gagal."
            );

        } finally {

            window.clearTimeout(
                timeoutState.timer
            );
        }
    }


    /* =====================================================
       FORMAT BYTES
    ===================================================== */

    function formatBytes(
        bytes
    ) {

        const value =
            Number(bytes);


        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            return "0 B";
        }


        if (
            value < 1024
        ) {

            return (
                Math.round(value) +
                " B"
            );
        }


        if (
            value < 1024 * 1024
        ) {

            return (
                (value / 1024)
                    .toFixed(1) +
                " KB"
            );
        }


        return (
            (value / (1024 * 1024))
                .toFixed(2) +
            " MB"
        );
    }


    /* =====================================================
       ERROR MESSAGE EXTRACTION
    ===================================================== */

    function extractErrorMessage(
        data
    ) {

        if (!data) {

            return "";
        }


        const candidates = [

            data.error,

            data.message,

            data.error_message,

            data.errorMessage,

            data.detail,

            data.raw

        ];


        for (
            const value of candidates
        ) {

            if (
                typeof value === "string" &&
                value.trim()
            ) {

                return value.trim();
            }
        }


        if (
            data.error &&
            typeof data.error === "object"
        ) {

            return (
                data.error.message ||
                data.error.detail ||
                ""
            );
        }


        return "";
    }


    /* =====================================================
       MODEL
    ===================================================== */

    function resolveModel(
        payload,
        options = {}
    ) {

        if (
            options.model &&
            String(
                options.model
            ).trim()
        ) {

            return String(
                options.model
            ).trim();
        }


        if (
            payload &&
            payload.settings &&
            payload.settings.model &&
            String(
                payload.settings.model
            ).trim()
        ) {

            return String(
                payload.settings.model
            ).trim();
        }


        if (
            payload &&
            payload.context &&
            payload.context.settings &&
            payload.context.settings.model &&
            String(
                payload.context.settings.model
            ).trim()
        ) {

            return String(
                payload.context.settings.model
            ).trim();
        }


        const state =
            getState();


        const stateModel =
            state.getValue(
                "settings.model",
                ""
            );


        if (
            stateModel &&
            String(
                stateModel
            ).trim()
        ) {

            return String(
                stateModel
            ).trim();
        }


        return "";
    }


    /* =====================================================
       FRAME NORMALIZATION
    ===================================================== */

    function normalizeFrames(
        payload
    ) {

        if (!payload) {

            return [];
        }


        const source =
            Array.isArray(
                payload.frames
            )
                ? payload.frames
                : [];


        return source
            .filter(Boolean)
            .map(
                function (
                    frame,
                    index
                ) {

                    return {

                        index:
                            Number.isFinite(
                                Number(
                                    frame.index
                                )
                            )
                                ? Number(
                                    frame.index
                                )
                                : index,

                        timestamp:
                            Number.isFinite(
                                Number(
                                    frame.timestamp
                                )
                            )
                                ? Number(
                                    frame.timestamp
                                )
                                : 0,

                        width:
                            Number(
                                frame.width
                            ) || 0,

                        height:
                            Number(
                                frame.height
                            ) || 0,

                        dataURL:
                            typeof frame.dataURL === "string"
                                ? frame.dataURL
                                : "",

                        url:
                            typeof frame.url === "string"
                                ? frame.url
                                : ""
                    };

                }
            )
            .filter(
                function (
                    frame
                ) {

                    return Boolean(
                        frame.dataURL
                    );
                }
            )
            .slice(
                0,
                CONFIG.maxFrames
            );
    }


    /* =====================================================
       FRAME SELECTION
       -----------------------------------------------------
       Memilih frame secara merata dari seluruh timeline.

       Contoh:
       32 frame -> 12 frame

       Tidak hanya mengambil 12 frame pertama.
       ===================================================== */

    function selectFramesForRequest(
        frames
    ) {

        if (
            !Array.isArray(frames)
        ) {

            return [];
        }


        if (
            frames.length <=
            CONFIG.maxRequestFrames
        ) {

            return frames.slice();
        }


        const selected = [];


        const lastIndex =
            frames.length - 1;


        const slots =
            CONFIG.maxRequestFrames;


        for (
            let i = 0;
            i < slots;
            i++
        ) {

            const position =
                slots === 1
                    ? 0
                    : Math.round(
                        (
                            i *
                            lastIndex
                        ) /
                        (
                            slots - 1
                        )
                    );


            const frame =
                frames[position];


            if (
                frame &&
                !selected.includes(
                    frame
                )
            ) {

                selected.push(
                    frame
                );
            }
        }


        return selected;
    }


    /* =====================================================
       DATA URL SIZE
    ===================================================== */

    function estimateDataURLBytes(
        dataURL
    ) {

        if (
            typeof dataURL !== "string" ||
            !dataURL
        ) {

            return 0;
        }


        const commaIndex =
            dataURL.indexOf(",");


        if (
            commaIndex === -1
        ) {

            return dataURL.length;
        }


        const base64 =
            dataURL.slice(
                commaIndex + 1
            );


        const padding =
            base64.endsWith("==")
                ? 2
                : base64.endsWith("=")
                    ? 1
                    : 0;


        return Math.max(
            0,
            Math.floor(
                (
                    base64.length *
                    3
                ) /
                4
            ) -
            padding
        );
    }


    /* =====================================================
       LOAD IMAGE
    ===================================================== */

    function loadImage(
        dataURL
    ) {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                const image =
                    new Image();


                image.onload =
                    function () {

                        resolve(
                            image
                        );
                    };


                image.onerror =
                    function () {

                        reject(
                            new Error(
                                "Frame image gagal dimuat."
                            )
                        );
                    };


                image.src =
                    dataURL;
            }
        );
    }


    /* =====================================================
       CANVAS JPEG COMPRESSION
       -----------------------------------------------------
       Tidak mengubah frame asli.
       Hanya membuat salinan JPEG khusus untuk API.
    ===================================================== */

    async function compressFrameDataURL(
        frame
    ) {

        const original =
            frame.dataURL;


        if (
            typeof original !== "string" ||
            !original
        ) {

            throw new Error(
                "Frame tidak memiliki dataURL."
            );
        }


        /*
         * Jika frame sudah kecil, tidak perlu
         * melakukan recompression agresif.
         */

        const originalBytes =
            estimateDataURLBytes(
                original
            );


        if (
            originalBytes > 0 &&
            originalBytes <= 90000
        ) {

            return original;
        }


        const image =
            await loadImage(
                original
            );


        const sourceWidth =
            Number(
                image.naturalWidth ||
                image.width
            ) || 0;


        const sourceHeight =
            Number(
                image.naturalHeight ||
                image.height
            ) || 0;


        if (
            !sourceWidth ||
            !sourceHeight
        ) {

            throw new Error(
                "Ukuran frame tidak valid."
            );
        }


        const maxDimension =
            CONFIG.maxImageDimension;


        let targetWidth =
            sourceWidth;


        let targetHeight =
            sourceHeight;


        if (
            sourceWidth >
                maxDimension ||
            sourceHeight >
                maxDimension
        ) {

            const scale =
                Math.min(
                    maxDimension /
                        sourceWidth,

                    maxDimension /
                        sourceHeight
                );


            targetWidth =
                Math.max(
                    1,
                    Math.round(
                        sourceWidth *
                        scale
                    )
                );


            targetHeight =
                Math.max(
                    1,
                    Math.round(
                        sourceHeight *
                        scale
                    )
                );
        }


        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            targetWidth;


        canvas.height =
            targetHeight;


        const context =
            canvas.getContext(
                "2d",
                {
                    alpha:
                        false
                }
            );


        if (!context) {

            throw new Error(
                "Canvas 2D tidak tersedia."
            );
        }


        /*
         * Kualitas rendering tetap dijaga.
         */

        try {

            context.imageSmoothingEnabled =
                true;

            context.imageSmoothingQuality =
                "high";

        } catch (error) {
            /*
             * Browser lama dapat mengabaikan
             * property ini.
             */
        }


        context.drawImage(
            image,
            0,
            0,
            targetWidth,
            targetHeight
        );


        let compressed;


        try {

            compressed =
                canvas.toDataURL(
                    "image/jpeg",
                    CONFIG.imageQuality
                );

        } catch (error) {

            throw new Error(
                "Frame gagal dikompresi menjadi JPEG."
            );
        }


        if (
            typeof compressed !== "string" ||
            !compressed ||
            compressed === "data:,"
        ) {

            throw new Error(
                "Hasil kompresi frame tidak valid."
            );
        }


        /*
         * Bersihkan resource canvas.
         */

        canvas.width = 1;
        canvas.height = 1;


        return compressed;
    }


    /* =====================================================
       PREPARE FRAMES FOR API
       -----------------------------------------------------
       Menghasilkan frame khusus request API.

       Frame asli dalam state/payload tidak disentuh.
    ===================================================== */

    async function prepareFramesForAPI(
        payload
    ) {

        const normalizedFrames =
            normalizeFrames(
                payload
            );


        if (
            !normalizedFrames.length
        ) {

            return [];
        }


        const selectedFrames =
            selectFramesForRequest(
                normalizedFrames
            );


        const preparedFrames = [];


        for (
            const frame of selectedFrames
        ) {

            let dataURL =
                frame.dataURL;


            try {

                dataURL =
                    await compressFrameDataURL(
                        frame
                    );

            } catch (error) {

                /*
                 * Jangan menggagalkan seluruh analysis
                 * hanya karena satu frame gagal dikompresi.
                 *
                 * Frame asli digunakan sebagai fallback.
                 */

                console.warn(
                    "[GEN-Z.AI Vision Video] Frame compression gagal, menggunakan frame asli:",
                    frame.index,
                    error
                );
            }


            preparedFrames.push({

                index:
                    frame.index,

                timestamp:
                    frame.timestamp,

                width:
                    frame.width,

                height:
                    frame.height,

                dataURL,

                url:
                    frame.url

            });
        }


        return preparedFrames;
    }


    /* =====================================================
       REQUEST FRAME PAYLOAD SIZE
    ===================================================== */

    function estimateFramesPayloadBytes(
        frames
    ) {

        if (
            !Array.isArray(frames)
        ) {

            return 0;
        }


        return frames.reduce(
            function (
                total,
                frame
            ) {

                return (
                    total +
                    estimateDataURLBytes(
                        frame.dataURL
                    )
                );

            },
            0
        );
    }


    /* =====================================================
       FRAME DESCRIPTION
    ===================================================== */

    function buildFrameText(
        frame
    ) {

        const timestamp =
            Number(
                frame.timestamp
            ) || 0;


        return [

            `Frame ${Number(frame.index) + 1}`,

            `timestamp=${timestamp.toFixed(2)}s`

        ].join(
            " | "
        );
    }


    /* =====================================================
       CONTEXT TEXT
    ===================================================== */

    function buildContextText(
        payload
    ) {

        const context =
            payload &&
            payload.context
                ? payload.context
                : {};


        const video =
            context.video ||
            payload.video ||
            {};


        const settings =
            context.settings ||
            payload.settings ||
            {};


        const temporal =
            context.temporal ||
            payload.temporal ||
            {};


        const metadata = {

            duration:
                Number(
                    video.duration
                ) || 0,

            width:
                Number(
                    video.width
                ) || 0,

            height:
                Number(
                    video.height
                ) || 0,

            fps:
                Number(
                    video.fps
                ) || 0,

            frameMode:
                settings.frameMode ||
                "auto",

            detail:
                settings.detail ||
                "standard",

            purpose:
                settings.purpose ||
                "general",

            temporalSegments:
                Array.isArray(
                    temporal.segments
                )
                    ? temporal.segments
                    : [],

            sceneCandidates:
                Array.isArray(
                    temporal.sceneCandidates
                )
                    ? temporal.sceneCandidates
                    : []
        };


        return [

            "VIDEO CONTEXT:",

            JSON.stringify(
                metadata,
                null,
                2
            ),

            "",

            "TASK:",

            "Analyze all supplied frames in chronological order.",

            "Infer temporal changes only when supported by visible evidence.",

            "Focus on visual information useful for recreating the video."

        ].join(
            "\n"
        );
    }


    /* =====================================================
       MESSAGE BUILDER
       ===================================================== */

    async function buildMessages(
        payload,
        options = {}
    ) {

        const frames =
            await prepareFramesForAPI(
                payload
            );


        if (
            !frames.length
        ) {

            throw new Error(
                "Tidak ada frame video yang siap dikirim ke API."
            );
        }


        /*
         * Safety guard tambahan.
         */

        const frameBytes =
            estimateFramesPayloadBytes(
                frames
            );


        console.log(
            "[GEN-Z.AI Vision Video] API frames:",
            frames.length,
            "| estimated image bytes:",
            formatBytes(
                frameBytes
            )
        );


        const content = [

            {

                type:
                    "text",

                text:
                    buildContextText(
                        payload
                    )

            }

        ];


        frames.forEach(
            function (
                frame
            ) {

                content.push({

                    type:
                        "text",

                    text:
                        buildFrameText(
                            frame
                        )

                });


                content.push({

                    type:
                        "image_url",

                    image_url: {

                        url:
                            frame.dataURL,

                        detail:
                            resolveImageDetail(
                                payload,
                                options
                            )

                    }

                });

            }
        );


        return [

            {

                role:
                    "system",

                content:
                    CONFIG.systemInstruction

            },

            {

                role:
                    "user",

                content

            }

        ];
    }


    /* =====================================================
       IMAGE DETAIL
    ===================================================== */

    function resolveImageDetail(
        payload,
        options
    ) {

        const detail =
            options.detail ||
            (
                payload &&
                payload.settings &&
                payload.settings.detail
            ) ||
            "standard";


        const normalized =
            String(
                detail
            ).toLowerCase();


        if (
            normalized === "low"
        ) {

            return "low";
        }


        if (
            normalized === "high"
        ) {

            return "high";
        }


        /*
         * OpenAI-compatible multimodal APIs
         * umumnya menerima low/high.
         *
         * "standard" dipetakan ke high agar
         * analisis frame tetap detail.
         */

        return "high";
    }


    /* =====================================================
       REQUEST BODY
    ===================================================== */

    async function buildRequestBody(
        payload,
        options = {}
    ) {

        const model =
            resolveModel(
                payload,
                options
            );


        if (!model) {

            throw new Error(
                "Model Vision Video belum dipilih."
            );
        }


        const messages =
            await buildMessages(
                payload,
                options
            );


        return {

            model,

            messages,

            temperature:
                Number.isFinite(
                    Number(
                        options.temperature
                    )
                )
                    ? Number(
                        options.temperature
                    )
                    : CONFIG.defaultTemperature

        };
    }


    /* =====================================================
       RESPONSE CONTENT EXTRACTION
    ===================================================== */

    function extractContent(
        data
    ) {

        if (!data) {

            return "";
        }


        /*
         * OpenAI-compatible response
         */

        if (
            Array.isArray(
                data.choices
            ) &&
            data.choices.length
        ) {

            const choice =
                data.choices[0];


            if (
                choice &&
                choice.message
            ) {

                const content =
                    choice.message.content;


                const normalized =
                    normalizeContent(
                        content
                    );


                if (normalized) {

                    return normalized;
                }
            }


            if (
                choice &&
                choice.content
            ) {

                const normalized =
                    normalizeContent(
                        choice.content
                    );


                if (normalized) {

                    return normalized;
                }
            }
        }


        const candidates = [

            data.output_text,

            data.content,

            data.text,

            data.result,

            data.response,

            data.answer

        ];


        for (
            const candidate of candidates
        ) {

            const normalized =
                normalizeContent(
                    candidate
                );


            if (normalized) {

                return normalized;
            }
        }


        if (
            data.data
        ) {

            const nested =
                extractContent(
                    data.data
                );


            if (nested) {

                return nested;
            }
        }


        return "";
    }


    /* =====================================================
       CONTENT NORMALIZATION
    ===================================================== */

    function normalizeContent(
        content
    ) {

        if (
            typeof content === "string"
        ) {

            return content.trim();
        }


        if (
            Array.isArray(
                content
            )
        ) {

            return content
                .map(
                    function (
                        part
                    ) {

                        if (
                            typeof part === "string"
                        ) {

                            return part;
                        }


                        if (
                            part &&
                            typeof part.text === "string"
                        ) {

                            return part.text;
                        }


                        return "";

                    }
                )
                .filter(Boolean)
                .join("\n")
                .trim();
        }


        if (
            content &&
            typeof content === "object"
        ) {

            if (
                typeof content.text === "string"
            ) {

                return content.text.trim();
            }


            if (
                typeof content.content === "string"
            ) {

                return content.content.trim();
            }
        }


        return "";
    }


    /* =====================================================
       RESPONSE NORMALIZATION
    ===================================================== */

    function normalizeResponse(
        data,
        payload
    ) {

        const content =
            extractContent(
                data
            );


        if (!content) {

            throw new Error(
                "API berhasil merespons tetapi tidak mengembalikan hasil analysis."
            );
        }


        return {

            content,

            raw:
                data,

            model:
                resolveModel(
                    payload,
                    {}
                ),

            timestamp:
                Date.now()

        };
    }


    /* =====================================================
       ANALYZE
    ===================================================== */

    async function analyze(
        payload,
        options = {}
    ) {

        if (!payload) {

            throw new Error(
                "Payload Vision Video tidak tersedia."
            );
        }


        const state =
            getState();


        /*
         * buildRequestBody sekarang async karena
         * frame perlu dikompresi terlebih dahulu.
         */

        const requestBody =
            await buildRequestBody(
                payload,
                options
            );


        dispatch(
            "genz:vision-video:api-start",
            {
                model:
                    requestBody.model
            }
        );


        try {

            const response =
                await request(
                    requestBody,
                    options
                );


            const result =
                normalizeResponse(
                    response,
                    payload
                );


            /*
             * Simpan hasil API ke state.
             */

            state.setAnalysis({

                status:
                    "complete",

                result:
                    result.content,

                raw:
                    result.raw,

                model:
                    result.model,

                completedAt:
                    result.timestamp

            });


            state.completeAnalysis(
                result.content
            );


            dispatch(
                "genz:vision-video:api-analysis-complete",
                {
                    result
                }
            );


            return result;

        } catch (error) {

            const normalized =
                normalizeError(
                    error,
                    "Vision Video analysis gagal."
                );


            state.failAnalysis(
                normalized.message
            );


            dispatch(
                "genz:vision-video:api-analysis-error",
                {
                    error:
                        normalized.message
                }
            );


            throw normalized;
        }
    }


    /* =====================================================
       ANALYZE PREPARED PAYLOAD
    ===================================================== */

    async function analyzePrepared(
        options = {}
    ) {

        const state =
            getState();


        const payload =
            state.getValue(
                "analysis.payload",
                null
            );


        if (!payload) {

            throw new Error(
                "Analysis payload belum tersedia."
            );
        }


        return analyze(
            payload,
            options
        );
    }


    /* =====================================================
       API HEALTH / CONFIG
    ===================================================== */

    function getConfig() {

        return {

            endpoint:
                CONFIG.endpoint,

            timeout:
                CONFIG.timeout,

            maxFrames:
                CONFIG.maxFrames,

            maxRequestFrames:
                CONFIG.maxRequestFrames,

            maxImageDimension:
                CONFIG.maxImageDimension,

            imageQuality:
                CONFIG.imageQuality,

            maxRequestPayloadBytes:
                CONFIG.maxRequestPayloadBytes,

            defaultTemperature:
                CONFIG.defaultTemperature

        };
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = {

        config:
            getConfig(),

        getSession,

        getAccessToken,

        request,

        normalizeError,

        buildMessages,

        buildRequestBody,

        normalizeResponse,

        extractContent,

        analyze,

        analyzePrepared

    };


    window.GENZVisionVideoAPI =
        API;


    window.GENZVisionVideoAPIReady =
        true;


    console.log(
        "[GEN-Z.AI Vision Video] API module ready."
    );

})();
