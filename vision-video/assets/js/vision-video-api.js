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

        endpoint: "/api/openkey-chat",

        timeout: 120000,

        defaultTemperature: 0.2,

        maxFrames: 32,

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

        const state = window.GENZVisionVideoState;

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

    function dispatch(name, detail = {}) {

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

        const session = await getSession();

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

    function createTimeoutController(timeout) {

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

    function normalizeError(error, fallback = "API request gagal.") {

        if (!error) {
            return new Error(fallback);
        }


        if (error.name === "AbortError") {

            return new Error(
                "Request Vision Video timeout."
            );
        }


        if (error instanceof Error) {

            return error;
        }


        if (typeof error === "string") {

            return new Error(error);
        }


        if (error.message) {

            return new Error(
                String(error.message)
            );
        }


        return new Error(fallback);
    }


    /* =====================================================
       RESPONSE ERROR
    ===================================================== */

    async function parseResponseBody(response) {

        const contentType =
            response.headers.get("content-type") || "";


        if (
            contentType.includes("application/json")
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

                return JSON.parse(text);

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

    async function request(body, options = {}) {

        const endpoint =
            options.endpoint ||
            CONFIG.endpoint;


        const timeout =
            Number(options.timeout) ||
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
            createTimeoutController(timeout);


        try {

            const response =
                await fetch(
                    endpoint,
                    {
                        method: "POST",

                        headers,

                        body: JSON.stringify(body),

                        signal:
                            timeoutState.controller.signal,

                        credentials:
                            "same-origin"
                    }
                );


            const data =
                await parseResponseBody(response);


            if (!response.ok) {

                const serverMessage =
                    extractErrorMessage(data);


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
       ERROR MESSAGE EXTRACTION
    ===================================================== */

    function extractErrorMessage(data) {

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


        for (const value of candidates) {

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

    function resolveModel(payload, options = {}) {

        if (
            options.model &&
            String(options.model).trim()
        ) {

            return String(
                options.model
            ).trim();
        }


        if (
            payload &&
            payload.settings &&
            payload.settings.model &&
            String(payload.settings.model).trim()
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
            String(stateModel).trim()
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

    function normalizeFrames(payload) {

        if (!payload) {
            return [];
        }


        const source =
            Array.isArray(payload.frames)
                ? payload.frames
                : [];


        return source
            .filter(Boolean)
            .map(function (frame, index) {

                return {

                    index:
                        Number.isFinite(
                            Number(frame.index)
                        )
                            ? Number(frame.index)
                            : index,

                    timestamp:
                        Number.isFinite(
                            Number(frame.timestamp)
                        )
                            ? Number(frame.timestamp)
                            : 0,

                    width:
                        Number(frame.width) || 0,

                    height:
                        Number(frame.height) || 0,

                    dataURL:
                        typeof frame.dataURL === "string"
                            ? frame.dataURL
                            : "",

                    url:
                        typeof frame.url === "string"
                            ? frame.url
                            : ""
                };

            })
            .filter(function (frame) {

                return Boolean(
                    frame.dataURL
                );
            })
            .slice(
                0,
                CONFIG.maxFrames
            );
    }


    /* =====================================================
       FRAME DESCRIPTION
    ===================================================== */

    function buildFrameText(frame) {

        const timestamp =
            Number(frame.timestamp) || 0;


        return [
            `Frame ${Number(frame.index) + 1}`,
            `timestamp=${timestamp.toFixed(2)}s`
        ].join(" | ");
    }


    /* =====================================================
       CONTEXT TEXT
    ===================================================== */

    function buildContextText(payload) {

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
                Number(video.duration) || 0,

            width:
                Number(video.width) || 0,

            height:
                Number(video.height) || 0,

            fps:
                Number(video.fps) || 0,

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
        ].join("\n");
    }


    /* =====================================================
       MESSAGE BUILDER
    ===================================================== */

    function buildMessages(payload, options = {}) {

        const frames =
            normalizeFrames(payload);


        if (!frames.length) {

            throw new Error(
                "Tidak ada frame video yang siap dikirim ke API."
            );
        }


        const content = [

            {
                type: "text",

                text:
                    buildContextText(
                        payload
                    )
            }

        ];


        frames.forEach(function (frame) {

            content.push({

                type: "text",

                text:
                    buildFrameText(
                        frame
                    )

            });


            content.push({

                type: "image_url",

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

        });


        return [

            {

                role: "system",

                content:
                    CONFIG.systemInstruction

            },

            {

                role: "user",

                content

            }

        ];
    }


    /* =====================================================
       IMAGE DETAIL
    ===================================================== */

    function resolveImageDetail(payload, options) {

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

    function buildRequestBody(payload, options = {}) {

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
            buildMessages(
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

    function extractContent(data) {

        if (!data) {
            return "";
        }


        /*
         * OpenAI-compatible response
         */

        if (
            Array.isArray(data.choices) &&
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


        for (const candidate of candidates) {

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

    function normalizeContent(content) {

        if (
            typeof content === "string"
        ) {

            return content.trim();
        }


        if (
            Array.isArray(content)
        ) {

            return content
                .map(function (part) {

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

                })
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

    function normalizeResponse(data, payload) {

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

    async function analyze(payload, options = {}) {

        if (!payload) {

            throw new Error(
                "Payload Vision Video tidak tersedia."
            );
        }


        const state =
            getState();


        const requestBody =
            buildRequestBody(
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

    async function analyzePrepared(options = {}) {

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
