//vision-video/assets/js/vision-video-api.js?V=1.6
/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File: vision-video/assets/js/vision-video-api.js

   PATCH v1.6 (2026-10-10):
   - REORDER: character reference diletakkan SETELAH frame video
     supaya AI tidak mengabaikan character reference.
   - CLOSING REMINDER: penegas eksplisit di akhir user message.
   - CHARACTER REPLACEMENT INSTRUCTION: larangan tegas
     menggambarkan orang di video.
   - PROMPT DEPTH + CHARACTER FIDELITY tetap dipertahankan.
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
        maxRequestFrames: 4,
        maxImageDimension: 640,
        imageQuality: 0.45,

        characterMaxImageDimension: 768,
        characterImageQuality: 0.65,
        characterKeepOriginalBelowBytes: 180000,

        maxRequestPayloadBytes: 1500000,

        defaultLanguage: "id",

        /*
         * =================================================
         * SYSTEM INSTRUCTION BASE
         * =================================================
         */
        systemInstructionBase: [
            "You are GEN-Z.AI Vision Video Engine.",
            "Analyze the supplied video frames as a chronological sequence.",
            "Treat frame order and timestamps as important temporal evidence.",
            "Do not invent visual details that are not supported by the supplied images.",

            /* =============================================
               CHARACTER REPLACEMENT — HIGHEST PRIORITY
            ============================================= */

            "CHARACTER REPLACEMENT — HIGHEST PRIORITY:",

            "When a CHARACTER REFERENCE image is supplied, it OVERRIDES the identity",
            "of any person appearing in the source video frames.",

            "The person visible in the video frames MUST be treated ONLY as a pose,",
            "action, movement, and framing template.",
            "The IDENTITY of that person MUST be REPLACED entirely by the character reference.",

            "You MUST NOT describe the identity of the person in the video frames.",
            "You MUST NOT describe the face, hair, hairstyle, hair color, skin tone,",
            "eye color, body characteristics, or any identity-defining attribute of the",
            "person seen in the video frames.",
            "You MUST NOT copy, merge, blend, or substitute the video person's identity",
            "with the character reference.",

            "The replacement character reference is the ONLY authoritative source",
            "for facial identity, hair, skin, eyes, body characteristics, clothing,",
            "and any other identity-defining detail of the subject in the final prompt.",

            "If the character reference and the video person are different, the character",
            "reference MUST remain the authoritative identity in the reconstruction prompt.",

            "Do not invent character details that are not visible in the character reference.",

            /* =============================================
               VIDEO ROLE
            ============================================= */

            "Use the video frames primarily as evidence for pose, action, movement,",
            "camera behavior, camera movement, framing, composition, environment,",
            "lighting, timing, transitions, and visual continuity.",
            "Preserve the temporal behavior and scene structure supported by the video.",
            "Do NOT transfer identity from the video frames.",

            /* =============================================
               GENERAL ANALYSIS
            ============================================= */

            "Describe subjects, actions, camera behavior, composition,",
            "environment, lighting, motion, transitions, and visual continuity.",
            "Identify changes between frames when supported by the evidence.",
            "Produce a detailed analysis suitable for reconstructing the visual",
            "structure of the source video into an AI video generation prompt.",
            "Do not include unsupported claims.",

            /* =============================================
               PROMPT QUALITY — STRICT
            ============================================= */

            "The final video generation prompt must be directly usable",
            "for reconstructing the visual appearance and motion of the source video",

            "with the CHARACTER REFERENCE as the subject.",

            "The final prompt MUST be highly detailed and comprehensive.",
            "Do NOT write a short summary.",
            "Do NOT write only a few sentences.",
            "Do NOT omit visual details that are clearly visible in the frames or the character reference.",

            "The final prompt MUST be written as a single, continuous, richly descriptive",
            "prompt text, not as a bullet list, not as a table, not as markdown headings.",
            "The final prompt MUST cover, explicitly and in detail:",

            "1. Replacement character appearance (mandatory if character reference is supplied).",
            "2. Subject action and pose (from the video frames).",
            "3. Camera behavior, camera movement, and framing.",
            "4. Composition and shot type.",
            "5. Environment and setting.",
            "6. Lighting and color mood.",
            "7. Motion and temporal behavior.",
            "8. Transitions and continuity.",
            "9. Style, rendering, and technical visual quality.",

            "Preserve clothing, accessories, and physical appearance FROM THE CHARACTER REFERENCE.",
            "Preserve environment, composition, camera behavior, camera movement, framing, lighting,",
            "motion, transitions, timing, and visual continuity FROM THE VIDEO FRAMES.",
            "Never mix the character reference's identity with the video person's identity.",

            "Describe temporal changes only when supported by the supplied frames.",

            "Do not add creative details that are not supported by the video",
            "or the character reference.",

            /* =============================================
               CHARACTER FIDELITY INSTRUCTION
            ============================================= */

            "CHARACTER FIDELITY INSTRUCTION:",

            "If a CHARACTER REFERENCE image is supplied, you MUST describe",
            "the replacement character in explicit detail inside the final prompt,",

            "covering every visible attribute such as:",

            "- facial structure and face shape,",
            "- facial features (eyes, eyebrows, nose, lips, jawline, cheekbones),",
            "- hairstyle, hair length, hair texture, and hair color,",
            "- skin tone and skin characteristics,",
            "- visible body proportions and body characteristics,",
            "- clothing, outfit, and garment details,",
            "- accessories, jewelry, glasses, or visible items on the character,",
            "- general appearance that defines the character's identity.",

            "Do NOT describe the character in vague terms.",
            "Do NOT replace the character with the video person.",
            "Do NOT describe the video person's face, hair, or identity.",
            "Do NOT omit visible character details.",

            "The character description MUST be embedded inside the reconstruction prompt,",
            "not only in the analysis section.",

            /* =============================================
               PROMPT DEPTH REQUIREMENT
            ============================================= */

            "PROMPT DEPTH REQUIREMENT:",

            "The reconstruction prompt must be long, specific, technical, and complete.",
            "It should read as a professional AI video generation prompt,",
            "combining all relevant visual, cinematic, and character information",

            "into one coherent descriptive paragraph or a few consecutive paragraphs.",

            "Do not limit the prompt length.",
            "Do not shorten the prompt to save space.",
            "Do not reduce the prompt to a summary.",
            "Write the prompt as if it is the only thing the AI video model will see.",

            "Do not hallucinate subjects, objects, locations, actions,",
            "camera movements, lighting conditions, visual effects,",
            "or character attributes."
        ].join(" "),

        /*
         * =================================================
         * OUTPUT FORMAT REQUIREMENT
         * =================================================
         */
        systemInstructionOutputFormat: [
            "OUTPUT FORMAT REQUIREMENT:",
            "You MUST return your answer as plain text with EXACTLY two sections separated by a single separator line.",
            "Section 1 is the video analysis.",
            "Begin Section 1 with a heading line containing exactly the text: ANALISIS VIDEO",
            "Then write the complete video analysis on the following lines.",
            "The separator line must appear on its own line, containing exactly this text and nothing else:",
            "=== PROMPT REKONSTRUKSI ===",
            "Section 2 is the final video generation prompt.",
            "After the separator line, write the final video generation prompt.",
            "STRICT RULES FOR OUTPUT FORMAT:",
            "- Do not skip the separator line.",
            "- Do not change the separator line text.",
            "- Do not translate the separator line.",
            "- Do not add any other separator lines.",
            "- Do not repeat the analysis inside the prompt section.",
            "- Do not merge the analysis and the prompt into one paragraph.",
            "- The separator line must appear exactly once, on its own line, between the two sections.",
            "- Do not wrap the separator line in quotes, backticks, bold, or any markdown formatting.",
            "- The prompt section MUST NOT be a short summary.",
            "- The prompt section MUST be a long, detailed, technical description.",
            "- The prompt section MUST describe the CHARACTER REFERENCE, not the video person."
        ].join(" ")
    });


    /* =====================================================
       LANGUAGE DIRECTIVE
    ===================================================== */

    function buildLanguageDirective(language) {

        const lang =
            String(language || CONFIG.defaultLanguage)
                .trim()
                .toLowerCase();


        if (lang === "en") {

            return [
                "OUTPUT LANGUAGE:",
                "Write the complete video analysis AND the final video generation prompt in natural English.",
                "Use clear, precise, and vivid English.",
                "All narrative sentences in Section 1 (ANALISIS VIDEO) must be in English.",
                "All narrative sentences in Section 2 (PROMPT REKONSTRUKSI) must be in English.",
                "Do not write the analysis or the prompt in Indonesian or any other language.",
                "Do not translate model names, brand names, product names,",
                "proper nouns, URLs, technical identifiers, or file names.",
                "Keep well-known cinematography terms in English",
                "(camera shot, camera movement, dolly, pan, tilt, framing,",
                "close-up, wide shot, aspect ratio, depth of field, focus,",
                "transition, motion blur, composition, continuity, etc.)."
            ].join(" ");
        }


        return [
            "OUTPUT LANGUAGE:",
            "Write the complete video analysis AND the final video generation prompt in natural Bahasa Indonesia.",
            "Semua kalimat naratif di Section 1 (ANALISIS VIDEO) WAJIB menggunakan Bahasa Indonesia.",
            "Semua kalimat naratif di Section 2 (PROMPT REKONSTRUKSI) WAJIB menggunakan Bahasa Indonesia.",
            "JANGAN menggunakan Bahasa Inggris untuk kalimat, deskripsi, atau penjelasan.",
            "Gunakan Bahasa Indonesia yang jelas, natural, dan tepat.",
            "Pertahankan istilah teknis sinematografi dalam bentuk aslinya apabila lebih akurat, seperti:",
            "camera shot, camera movement, dolly, pan, tilt, framing,",
            "close-up, medium shot, wide shot, extreme close-up, low angle,",
            "high angle, eye level, over-the-shoulder, POV, tracking shot,",
            "handheld, crane shot, zoom, bokeh, aspect ratio, depth of field,",
            "focus, transition, motion blur, composition, continuity,",
            "color grading, film grain, VFX, CGI, time-lapse, slow motion, frame rate.",
            "Jangan menerjemahkan nama model, brand, produk, nama diri,",
            "URL, identifier teknis, atau nama file."
        ].join(" ");
    }


    function resolveLanguage(payload, options) {

        if (
            options &&
            options.language &&
            String(options.language).trim()
        ) {
            return String(options.language).trim();
        }


        if (
            payload &&
            payload.settings &&
            payload.settings.language &&
            String(payload.settings.language).trim()
        ) {
            return String(payload.settings.language).trim();
        }


        if (
            payload &&
            payload.context &&
            payload.context.settings &&
            payload.context.settings.language &&
            String(payload.context.settings.language).trim()
        ) {
            return String(payload.context.settings.language).trim();
        }


        return CONFIG.defaultLanguage;
    }


    function buildSystemInstruction(language) {

        return [
            CONFIG.systemInstructionBase,
            buildLanguageDirective(language),
            CONFIG.systemInstructionOutputFormat
        ].join(" ");
    }


    /* =====================================================
       CHARACTER REFERENCE INSTRUCTION
       (diletakkan SETELAH frames)
    ===================================================== */

        const PRE_FRAME_DISCLAIMER = [
        "MOTION REFERENCE ONLY:",
        "The following frames show MOTION, POSE, and CAMERA references.",
        "The person visible in these frames is a PLACEHOLDER and is NOT the subject.",
        "Do NOT describe this placeholder person's face, hair, skin, eyes,",
        "body, clothing, or any identity-defining detail.",
        "Do NOT mention that person's identity in the final prompt.",
        "These frames exist ONLY to convey motion, pose, camera behavior,",
        "framing, environment, and timing."
    ].join(" ");


    const CHARACTER_REFERENCE_INSTRUCTION = [
        "=== CHARACTER REFERENCE — THIS IS THE SUBJECT OF THE FINAL PROMPT ===",

        "The image below is the REPLACEMENT CHARACTER that MUST be used as the subject.",
        "This character replaces the placeholder person seen in the video frames.",

        "You MUST describe this character in explicit detail inside the final reconstruction prompt:",

        "- facial structure and face shape,",
        "- eyes, eyebrows, nose, lips, jawline, cheekbones,",
        "- hairstyle, hair length, hair texture, hair color,",
        "- skin tone and skin characteristics,",
        "- body proportions and visible body characteristics,",
        "- clothing, outfit, garment details,",
        "- accessories, jewelry, glasses, or visible items,",
        "- general appearance defining the character's identity.",

        "The final prompt MUST describe THIS character as the subject.",
        "The final prompt MUST NOT describe the placeholder person from the video frames.",
        "The final prompt MUST NOT merge the two identities.",
        "The final prompt MUST NOT fall back to a generic person."
    ].join(" ");


    const CHARACTER_REFERENCE_CLOSING_REMINDER = [
        "=== FINAL CRITICAL REMINDER ===",
        "The CHARACTER REFERENCE above is the ONLY subject you may describe.",
        "The person visible in the video frames is a PLACEHOLDER and must be invisible in your output.",
        "Any detail that appears only in the video frames and not in the character reference",
        "MUST NOT appear in the final prompt.",
        "The reconstruction prompt MUST open by describing the character reference in detail,",
        "then continue with the pose, action, camera, environment, and motion from the video frames."
    ].join(" ");


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
                    { detail }
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

    function createTimeoutController(timeout) {

        const controller = new AbortController();

        const timer = window.setTimeout(
            function () {
                controller.abort();
            },
            timeout
        );

        return { controller, timer };
    }


    /* =====================================================
       ERROR NORMALIZATION
    ===================================================== */

    function normalizeError(
        error,
        fallback = "API request gagal."
    ) {

        if (!error) {
            return new Error(fallback);
        }


        if (error.name === "AbortError") {
            return new Error("Request Vision Video timeout.");
        }


        if (error instanceof Error) {
            return error;
        }


        if (typeof error === "string") {
            return new Error(error);
        }


        if (error.message) {
            return new Error(String(error.message));
        }


        return new Error(fallback);
    }


    /* =====================================================
       RESPONSE BODY
    ===================================================== */

    async function parseResponseBody(response) {

        const contentType =
            response.headers.get("content-type") || "";


        if (contentType.includes("application/json")) {

            try {
                return await response.json();
            } catch (error) {
                return null;
            }
        }


        try {

            const text = await response.text();


            if (!text) {
                return null;
            }


            try {
                return JSON.parse(text);
            } catch (error) {
                return { raw: text };
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
            options.endpoint || CONFIG.endpoint;


        const timeout =
            Number(options.timeout) || CONFIG.timeout;


        const token =
            options.accessToken || await getAccessToken();


        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };


        if (token) {
            headers.Authorization = "Bearer " + token;
        }


        const timeoutState =
            createTimeoutController(timeout);


        try {

            let serializedBody;


            try {
                serializedBody = JSON.stringify(body);
            } catch (error) {

                throw new Error(
                    "Payload Vision Video gagal diserialisasi."
                );
            }


            const payloadBytes =
                new Blob([serializedBody]).size;


            if (payloadBytes > CONFIG.maxRequestPayloadBytes) {

                throw new Error(
                    "Payload Vision Video terlalu besar (" +
                    formatBytes(payloadBytes) +
                    "). Frame dan character reference telah dibatasi serta dikompresi."
                );
            }


            const response =
                await fetch(endpoint, {
                    method: "POST",
                    headers,
                    body: serializedBody,
                    signal: timeoutState.controller.signal,
                    credentials: "same-origin"
                });


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

            window.clearTimeout(timeoutState.timer);
        }
    }


    /* =====================================================
       FORMAT BYTES
    ===================================================== */

    function formatBytes(bytes) {

        const value = Number(bytes);


        if (!Number.isFinite(value) || value <= 0) {
            return "0 B";
        }


        if (value < 1024) {
            return Math.round(value) + " B";
        }


        if (value < 1024 * 1024) {
            return (value / 1024).toFixed(1) + " KB";
        }


        return (value / (1024 * 1024)).toFixed(2) + " MB";
    }


    /* =====================================================
       ERROR MESSAGE
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


        if (data.error && typeof data.error === "object") {
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
            return String(options.model).trim();
        }


        if (
            payload &&
            payload.settings &&
            payload.settings.model &&
            String(payload.settings.model).trim()
        ) {
            return String(payload.settings.model).trim();
        }


        if (
            payload &&
            payload.context &&
            payload.context.settings &&
            payload.context.settings.model &&
            String(payload.context.settings.model).trim()
        ) {
            return String(payload.context.settings.model).trim();
        }


        const state = getState();


        const stateModel =
            state.getValue("settings.model", "");


        if (stateModel && String(stateModel).trim()) {
            return String(stateModel).trim();
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
                        Number.isFinite(Number(frame.index))
                            ? Number(frame.index)
                            : index,

                    timestamp:
                        Number.isFinite(Number(frame.timestamp))
                            ? Number(frame.timestamp)
                            : 0,

                    width: Number(frame.width) || 0,
                    height: Number(frame.height) || 0,

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
                return Boolean(frame.dataURL);
            })
            .slice(0, CONFIG.maxFrames);
    }


    /* =====================================================
       FRAME SELECTION
    ===================================================== */

    function selectFramesForRequest(frames) {

        if (!Array.isArray(frames)) {
            return [];
        }


        if (frames.length <= CONFIG.maxRequestFrames) {
            return frames.slice();
        }


        const selected = [];
        const lastIndex = frames.length - 1;
        const slots = CONFIG.maxRequestFrames;


        for (let i = 0; i < slots; i++) {

            const position =
                slots === 1
                    ? 0
                    : Math.round((i * lastIndex) / (slots - 1));


            const frame = frames[position];


            if (frame && !selected.includes(frame)) {
                selected.push(frame);
            }
        }


        return selected;
    }


    /* =====================================================
       DATA URL SIZE
    ===================================================== */

    function estimateDataURLBytes(dataURL) {

        if (typeof dataURL !== "string" || !dataURL) {
            return 0;
        }


        const commaIndex = dataURL.indexOf(",");


        if (commaIndex === -1) {
            return dataURL.length;
        }


        const base64 = dataURL.slice(commaIndex + 1);


        const padding =
            base64.endsWith("==") ? 2 :
            base64.endsWith("=") ? 1 :
            0;


        return Math.max(
            0,
            Math.floor((base64.length * 3) / 4) - padding
        );
    }


    /* =====================================================
       LOAD IMAGE
    ===================================================== */

    function loadImage(dataURL) {

        return new Promise(function (resolve, reject) {

            const image = new Image();

            image.onload = function () {
                resolve(image);
            };

            image.onerror = function () {
                reject(new Error("Frame image gagal dimuat."));
            };

            image.src = dataURL;
        });
    }


    /* =====================================================
       CANVAS JPEG COMPRESSION
    ===================================================== */

    async function compressFrameDataURL(frame) {

        const original = frame.dataURL;


        if (typeof original !== "string" || !original) {
            throw new Error("Frame tidak memiliki dataURL.");
        }


        const originalBytes =
            estimateDataURLBytes(original);


        if (originalBytes > 0 && originalBytes <= 90000) {
            return original;
        }


        const image = await loadImage(original);


        const sourceWidth =
            Number(image.naturalWidth || image.width) || 0;

        const sourceHeight =
            Number(image.naturalHeight || image.height) || 0;


        if (!sourceWidth || !sourceHeight) {
            throw new Error("Ukuran frame tidak valid.");
        }


        const maxDimension = CONFIG.maxImageDimension;


        let targetWidth = sourceWidth;
        let targetHeight = sourceHeight;


        if (
            sourceWidth > maxDimension ||
            sourceHeight > maxDimension
        ) {

            const scale = Math.min(
                maxDimension / sourceWidth,
                maxDimension / sourceHeight
            );


            targetWidth = Math.max(1, Math.round(sourceWidth * scale));
            targetHeight = Math.max(1, Math.round(sourceHeight * scale));
        }


        const canvas = document.createElement("canvas");

        canvas.width = targetWidth;
        canvas.height = targetHeight;


        const context = canvas.getContext("2d", { alpha: false });


        if (!context) {
            throw new Error("Canvas 2D tidak tersedia.");
        }


        try {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
        } catch (error) {}


        context.drawImage(image, 0, 0, targetWidth, targetHeight);


        let compressed;


        try {
            compressed = canvas.toDataURL(
                "image/jpeg",
                CONFIG.imageQuality
            );
        } catch (error) {
            throw new Error("Frame gagal dikompresi menjadi JPEG.");
        }


        if (
            typeof compressed !== "string" ||
            !compressed ||
            compressed === "data:,"
        ) {
            throw new Error("Hasil kompresi frame tidak valid.");
        }


        canvas.width = 1;
        canvas.height = 1;


        return compressed;
    }


    /* =====================================================
       FILE -> DATA URL
    ===================================================== */

    function fileToDataURL(file) {

        return new Promise(function (resolve, reject) {

            if (!file || typeof file !== "object") {

                reject(new Error(
                    "File character reference tidak tersedia."
                ));

                return;
            }


            if (typeof FileReader === "undefined") {

                reject(new Error(
                    "Browser tidak mendukung FileReader."
                ));

                return;
            }


            const reader = new FileReader();


            reader.onload = function () {

                const result = reader.result;


                if (typeof result !== "string" || !result) {

                    reject(new Error(
                        "Character reference gagal dibaca."
                    ));

                    return;
                }


                resolve(result);
            };


            reader.onerror = function () {
                reject(new Error(
                    "Character reference gagal dibaca dari file."
                ));
            };


            reader.onabort = function () {
                reject(new Error(
                    "Pembacaan character reference dibatalkan."
                ));
            };


            try {
                reader.readAsDataURL(file);
            } catch (error) {
                reject(error);
            }
        });
    }


    /* =====================================================
       CHARACTER FILE ACCESS
    ===================================================== */

    function getCharacterFile() {

        try {

            const characterUpload =
                window.GENZVisionVideoCharacterUpload;


            if (
                characterUpload &&
                typeof characterUpload.getFile === "function"
            ) {

                const file = characterUpload.getFile();

                if (file) {
                    return file;
                }
            }

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Gagal membaca character melalui upload module:",
                error
            );
        }


        try {

            const state = getState();

            const file = state.getValue("character.file", null);

            if (file) {
                return file;
            }

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Gagal membaca character dari state:",
                error
            );
        }


        return null;
    }


    /* =====================================================
       CHARACTER REFERENCE COMPRESSION
    ===================================================== */

    async function compressCharacterDataURL(original) {

        if (typeof original !== "string" || !original) {
            throw new Error(
                "Character reference tidak memiliki dataURL."
            );
        }


        const originalBytes =
            estimateDataURLBytes(original);


        if (
            originalBytes > 0 &&
            originalBytes <= CONFIG.characterKeepOriginalBelowBytes
        ) {
            return original;
        }


        const image = await loadImage(original);


        const sourceWidth =
            Number(image.naturalWidth || image.width) || 0;

        const sourceHeight =
            Number(image.naturalHeight || image.height) || 0;


        if (!sourceWidth || !sourceHeight) {
            throw new Error(
                "Ukuran character reference tidak valid."
            );
        }


        const maxDimension =
            CONFIG.characterMaxImageDimension;


        let targetWidth = sourceWidth;
        let targetHeight = sourceHeight;


        if (
            sourceWidth > maxDimension ||
            sourceHeight > maxDimension
        ) {

            const scale = Math.min(
                maxDimension / sourceWidth,
                maxDimension / sourceHeight
            );


            targetWidth = Math.max(1, Math.round(sourceWidth * scale));
            targetHeight = Math.max(1, Math.round(sourceHeight * scale));
        }


        const canvas = document.createElement("canvas");

        canvas.width = targetWidth;
        canvas.height = targetHeight;


        const context = canvas.getContext("2d", { alpha: false });


        if (!context) {
            throw new Error(
                "Canvas 2D tidak tersedia untuk character reference."
            );
        }


        try {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
        } catch (error) {}


        context.drawImage(image, 0, 0, targetWidth, targetHeight);


        let compressed;


        try {
            compressed = canvas.toDataURL(
                "image/jpeg",
                CONFIG.characterImageQuality
            );
        } catch (error) {
            throw new Error(
                "Character reference gagal dikompresi menjadi JPEG."
            );
        }


        if (
            typeof compressed !== "string" ||
            !compressed ||
            compressed === "data:,"
        ) {
            throw new Error(
                "Hasil kompresi character reference tidak valid."
            );
        }


        canvas.width = 1;
        canvas.height = 1;


        return compressed;
    }


    /* =====================================================
       PREPARE CHARACTER REFERENCE
    ===================================================== */

    async function prepareCharacterReference() {

        const file = getCharacterFile();


        if (!file) {
            return null;
        }


        const fileType =
            typeof file.type === "string"
                ? file.type.toLowerCase()
                : "";


        if (fileType && !fileType.startsWith("image/")) {

            console.warn(
                "[GEN-Z.AI Vision Video] Character reference bukan file image:",
                fileType
            );

            return null;
        }


        let originalDataURL;


        try {
            originalDataURL = await fileToDataURL(file);
        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Gagal mengubah character reference menjadi dataURL:",
                error
            );

            return null;
        }


        let dataURL = originalDataURL;


        try {
            dataURL = await compressCharacterDataURL(originalDataURL);
        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Character compression gagal, menggunakan image asli:",
                error
            );
        }


        return {
            dataURL,
            originalBytes: estimateDataURLBytes(originalDataURL),
            requestBytes: estimateDataURLBytes(dataURL),
            name: typeof file.name === "string" ? file.name : "",
            type: fileType,
            size: Number(file.size) || 0
        };
    }


    /* =====================================================
       PREPARE FRAMES FOR API
    ===================================================== */

    async function prepareFramesForAPI(payload) {

        const normalizedFrames = normalizeFrames(payload);


        if (!normalizedFrames.length) {
            return [];
        }


        const selectedFrames =
            selectFramesForRequest(normalizedFrames);


        const preparedFrames = [];


        for (const frame of selectedFrames) {

            let dataURL = frame.dataURL;


            try {
                dataURL = await compressFrameDataURL(frame);
            } catch (error) {

                console.warn(
                    "[GEN-Z.AI Vision Video] Frame compression gagal, menggunakan frame asli:",
                    frame.index,
                    error
                );
            }


            preparedFrames.push({
                index: frame.index,
                timestamp: frame.timestamp,
                width: frame.width,
                height: frame.height,
                dataURL,
                url: frame.url
            });
        }


        return preparedFrames;
    }


    /* =====================================================
       FRAME PAYLOAD SIZE
    ===================================================== */

    function estimateFramesPayloadBytes(frames) {

        if (!Array.isArray(frames)) {
            return 0;
        }


        return frames.reduce(
            function (total, frame) {
                return total + estimateDataURLBytes(frame.dataURL);
            },
            0
        );
    }


    /* =====================================================
       FRAME DESCRIPTION
    ===================================================== */

    function buildFrameText(frame) {

        const timestamp = Number(frame.timestamp) || 0;


        return [
            `Motion Reference ${Number(frame.index) + 1}`,
            `timestamp=${timestamp.toFixed(2)}s`,
            `(pose/motion/camera only — identity NOT used from this frame)`
        ].join(" | ");
    }


    /* =====================================================
       CONTEXT TEXT
    ===================================================== */

    function buildContextText(payload, language) {

        const context =
            payload && payload.context ? payload.context : {};


        const video =
            context.video || payload.video || {};


        const settings =
            context.settings || payload.settings || {};


        const temporal =
            context.temporal || payload.temporal || {};


        const metadata = {
            duration: Number(video.duration) || 0,
            width: Number(video.width) || 0,
            height: Number(video.height) || 0,
            fps: Number(video.fps) || 0,
            frameMode: settings.frameMode || "auto",
            detail: settings.detail || "standard",
            purpose: settings.purpose || "general",
            outputLanguage: language || CONFIG.defaultLanguage,
            temporalSegments:
                Array.isArray(temporal.segments)
                    ? temporal.segments
                    : [],
            sceneCandidates:
                Array.isArray(temporal.sceneCandidates)
                    ? temporal.sceneCandidates
                    : []
        };


        const langLine =
            String(language || CONFIG.defaultLanguage).toLowerCase() === "en"
                ? "Return the complete analysis and reconstruction prompt in English."
                : "Return the complete analysis and reconstruction prompt in Bahasa Indonesia.";


        return [
            "VIDEO CONTEXT:",
            JSON.stringify(metadata, null, 2),
            "",
            "TASK:",
            "Analyze all supplied frames in chronological order.",
            "Infer temporal changes only when supported by visible evidence.",
            "Focus on pose, action, movement, camera behavior, framing, environment,",
            "lighting, timing, transitions, and visual continuity.",
            "If a CHARACTER REFERENCE image is supplied, treat it as the ONLY",
            "authoritative source for the subject's identity.",
            "The person visible in the video frames MUST be replaced by the character reference.",
            langLine,
            "",
            "PROMPT REQUIREMENT REMINDER:",
            "The reconstruction prompt must be long, detailed, technical, and complete.",
            "The reconstruction prompt MUST describe the CHARACTER REFERENCE —",
            "not the person in the video frames.",
            "Do not write a short summary.",
            "",
            "OUTPUT FORMAT REMINDER:",
            "Section 1 heading must be exactly: ANALISIS VIDEO",
            "Then the separator line must be exactly: === PROMPT REKONSTRUKSI ===",
            "Then Section 2 with the final video generation prompt.",
            "Do not skip or alter the separator line."
        ].join("\n");
    }


    /* =====================================================
       MESSAGE BUILDER
       -----------------------------------------------------
       URUTAN:
       1. Context text
       2. Frame video (pose/motion reference)
       3. Character reference (SETELAH frames — recency)
       4. Closing reminder
    ===================================================== */

        async function buildMessages(payload, options = {}) {

        const frames = await prepareFramesForAPI(payload);


        if (!frames.length) {

            throw new Error(
                "Tidak ada frame video yang siap dikirim ke API."
            );
        }


        const character = await prepareCharacterReference();


        const frameBytes =
            estimateFramesPayloadBytes(frames);


        const characterBytes =
            character ? Number(character.requestBytes) || 0 : 0;


        const estimatedImageBytes =
            frameBytes + characterBytes;


        const language = resolveLanguage(payload, options);


        console.log(
            "[GEN-Z.AI Vision Video] API frames:",
            frames.length,
            "| frame image bytes:",
            formatBytes(frameBytes),
            "| character reference:",
            character ? "enabled" : "not available",
            "| character image bytes:",
            formatBytes(characterBytes),
            "| estimated image bytes:",
            formatBytes(estimatedImageBytes),
            "| output language:",
            language
        );


        const content = [
            {
                type: "text",
                text: buildContextText(payload, language)
            }
        ];


        /* -------- PRE-FRAME DISCLAIMER -------- */

        if (character) {

            content.push({
                type: "text",
                text: PRE_FRAME_DISCLAIMER
            });
        }


        /* -------- FRAME VIDEO + INTERLEAVED REMINDER -------- */

        frames.forEach(function (frame, idx) {

            content.push({
                type: "text",
                text: buildFrameText(frame)
            });


            content.push({
                type: "image_url",
                image_url: {
                    url: frame.dataURL,
                    detail: resolveImageDetail(payload, options)
                }
            });


            /* Setiap frame diikuti mini-reminder */

            if (character) {

                content.push({
                    type: "text",
                    text:
                        "Reminder: the person in the image above is a " +
                        "PLACEHOLDER. Only pose, motion, camera, and " +
                        "environment are relevant. The subject of the " +
                        "final prompt is the CHARACTER REFERENCE that " +
                        "will be provided after these frames."
                });
            }
        });


        /* -------- CHARACTER REFERENCE -------- */

        if (character) {

            content.push({
                type: "text",
                text: CHARACTER_REFERENCE_INSTRUCTION
            });


            content.push({
                type: "image_url",
                image_url: {
                    url: character.dataURL,
                    detail: "high"
                }
            });


            content.push({
                type: "text",
                text: CHARACTER_REFERENCE_CLOSING_REMINDER
            });
        }


        return [
            {
                role: "system",
                content: buildSystemInstruction(language)
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
            (payload && payload.settings && payload.settings.detail) ||
            "standard";


        const normalized = String(detail).toLowerCase();


        if (normalized === "low") return "low";
        if (normalized === "high") return "high";


        return "low";
    }


    /* =====================================================
       REQUEST BODY
    ===================================================== */

    async function buildRequestBody(payload, options = {}) {

        const model = resolveModel(payload, options);


        if (!model) {
            throw new Error("Model Vision Video belum dipilih.");
        }


        const messages = await buildMessages(payload, options);


        return {
            model,
            messages,
            temperature:
                Number.isFinite(Number(options.temperature))
                    ? Number(options.temperature)
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


        if (Array.isArray(data.choices) && data.choices.length) {

            const choice = data.choices[0];


            if (choice && choice.message) {

                const normalized =
                    normalizeContent(choice.message.content);

                if (normalized) {
                    return normalized;
                }
            }


            if (choice && choice.content) {

                const normalized =
                    normalizeContent(choice.content);

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

            const normalized = normalizeContent(candidate);

            if (normalized) {
                return normalized;
            }
        }


        if (data.data) {

            const nested = extractContent(data.data);

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

        if (typeof content === "string") {
            return content.trim();
        }


        if (Array.isArray(content)) {

            return content
                .map(function (part) {
                    if (typeof part === "string") return part;
                    if (part && typeof part.text === "string") {
                        return part.text;
                    }
                    return "";
                })
                .filter(Boolean)
                .join("\n")
                .trim();
        }


        if (content && typeof content === "object") {

            if (typeof content.text === "string") {
                return content.text.trim();
            }

            if (typeof content.content === "string") {
                return content.content.trim();
            }
        }


        return "";
    }


    /* =====================================================
       RESPONSE NORMALIZATION
    ===================================================== */

    function normalizeResponse(data, payload, options = {}) {

        const content = extractContent(data);


        if (!content) {

            throw new Error(
                "API berhasil merespons tetapi tidak mengembalikan hasil analysis."
            );
        }


        return {
            content,
            raw: data,
            model: resolveModel(payload, options),
            language: resolveLanguage(payload, options),
            timestamp: Date.now()
        };
    }


    /* =====================================================
       ANALYZE
    ===================================================== */

    async function analyze(payload, options = {}) {

        if (!payload) {
            throw new Error("Payload Vision Video tidak tersedia.");
        }


        const state = getState();


        const requestBody =
            await buildRequestBody(payload, options);


        dispatch(
            "genz:vision-video:api-start",
            { model: requestBody.model }
        );


        try {

            const response =
                await request(requestBody, options);


            const result =
                normalizeResponse(response, payload, options);


            state.setAnalysis({
                status: "complete",
                result: result.content,
                raw: result.raw,
                model: result.model,
                language: result.language,
                completedAt: result.timestamp
            });


            state.completeAnalysis(result.content);


            dispatch(
                "genz:vision-video:api-analysis-complete",
                { result }
            );


            return result;

        } catch (error) {

            const normalized = normalizeError(
                error,
                "Vision Video analysis gagal."
            );


            state.failAnalysis(normalized.message);


            dispatch(
                "genz:vision-video:api-analysis-error",
                { error: normalized.message }
            );


            throw normalized;
        }
    }


    /* =====================================================
       ANALYZE PREPARED
    ===================================================== */

    async function analyzePrepared(options = {}) {

        const state = getState();

        const payload =
            state.getValue("analysis.payload", null);


        if (!payload) {
            throw new Error("Analysis payload belum tersedia.");
        }


        return analyze(payload, options);
    }


    /* =====================================================
       CONFIG EXPORT
    ===================================================== */

    function getConfig() {

        return {
            endpoint: CONFIG.endpoint,
            timeout: CONFIG.timeout,
            maxFrames: CONFIG.maxFrames,
            maxRequestFrames: CONFIG.maxRequestFrames,
            maxImageDimension: CONFIG.maxImageDimension,
            imageQuality: CONFIG.imageQuality,
            characterMaxImageDimension: CONFIG.characterMaxImageDimension,
            characterImageQuality: CONFIG.characterImageQuality,
            characterKeepOriginalBelowBytes: CONFIG.characterKeepOriginalBelowBytes,
            maxRequestPayloadBytes: CONFIG.maxRequestPayloadBytes,
            defaultTemperature: CONFIG.defaultTemperature,
            defaultLanguage: CONFIG.defaultLanguage
        };
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = {
        config: getConfig(),
        getSession,
        getAccessToken,
        request,
        normalizeError,
        buildMessages,
        buildRequestBody,
        buildSystemInstruction,
        buildLanguageDirective,
        resolveLanguage,
        normalizeResponse,
        extractContent,
        analyze,
        analyzePrepared
    };


    window.GENZVisionVideoAPI = API;

    window.GENZVisionVideoAPIReady = true;


    console.log(
        "[GEN-Z.AI Vision Video] API module ready."
    );

})();
