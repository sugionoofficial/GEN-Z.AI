/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-history.js

   Fungsi:
   - Menyimpan hasil Vision Video ke generation_history
   - Menggunakan backend /api/openkey-chat
   - Operation: vision_history_save
   - Identitas user ditentukan server dari Supabase session
   - Tidak melakukan credit deduction
   - Tidak mengatur UI
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        endpoint:
            "/api/openkey-chat",

        providerId:
            "openkey",

        providerName:
            "OpenKey",

        creditCost:
            1,

        taskPrefix:
            "vision-video-"

    });


    /* =====================================================
       DEPENDENCY
    ===================================================== */

    function getState() {

        if (
            !window.GENZVisionVideoState
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video State belum tersedia."
            );

        }


        return window.GENZVisionVideoState;

    }


    /* =====================================================
       SAFE STRING
    ===================================================== */

    function safeString(
        value,
        fallback = ""
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return fallback;

        }


        if (
            typeof value === "string"
        ) {

            return value.trim();

        }


        if (
            typeof value === "number" ||
            typeof value === "boolean"
        ) {

            return String(
                value
            );

        }


        return fallback;

    }


    /* =====================================================
       UUID
    ===================================================== */

    function createUUID() {

        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {

            return crypto.randomUUID();

        }


        return (

            Date.now().toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)

        );

    }


    /* =====================================================
       TASK ID
    ===================================================== */

    function createTaskId() {

        return (
            CONFIG.taskPrefix +
            createUUID()
        );

    }


    /* =====================================================
       SUPABASE SESSION
    ===================================================== */

    async function getSession() {

        /*
         * Prioritas sama seperti module Vision lainnya.
         */

        if (
            window.GENZVisionVideoSupabase
        ) {

            const helper =
                window.GENZVisionVideoSupabase;


            if (
                typeof helper.getSession ===
                "function"
            ) {

                const session =
                    await helper.getSession();


                if (
                    session?.access_token
                ) {

                    return session;

                }

            }

        }


        if (
            window.supabaseClient
        ) {

            if (
                window.supabaseClient.auth &&
                typeof window.supabaseClient.auth.getSession ===
                    "function"
            ) {

                const result =
                    await window.supabaseClient
                        .auth
                        .getSession();


                if (
                    result?.data?.session
                        ?.access_token
                ) {

                    return result.data.session;

                }

            }

        }


        if (
            window.GENZ_SUPABASE
        ) {

            if (
                window.GENZ_SUPABASE.auth &&
                typeof window.GENZ_SUPABASE.auth.getSession ===
                    "function"
            ) {

                const result =
                    await window.GENZ_SUPABASE
                        .auth
                        .getSession();


                if (
                    result?.data?.session
                        ?.access_token
                ) {

                    return result.data.session;

                }

            }

        }


        throw new Error(
            "Session Supabase tidak tersedia."
        );

    }


    /* =====================================================
       BUILD HISTORY RECORD
    ===================================================== */

    function buildHistoryRecord(
        options = {}
    ) {

        const state =
            getState();


        const settings =
            state.getValue(
                "settings",
                {}
            ) || {};


        const video =
            state.getValue(
                "video",
                {}
            ) || {};


        const model =
            safeString(
                options.model ||
                settings.model ||
                ""
            );


        const modelName =
            safeString(
                options.modelName ||
                model
            );


        const prompt =
            safeString(
                options.prompt ||
                state.getValue(
                    "prompt.text",
                    ""
                )
            );


        const duration =
            Number(
                options.duration ??
                video.duration ??
                0
            );


        const width =
            Number(
                options.width ??
                video.width ??
                0
            );


        const height =
            Number(
                options.height ??
                video.height ??
                0
            );


        const resolution =
            safeString(
                options.resolution
            ) ||
            (
                width > 0 &&
                height > 0
                    ? `${width}x${height}`
                    : null
            );


        const taskId =
            safeString(
                options.taskId
            ) ||
            safeString(
                state.getValue(
                    "process.taskId",
                    ""
                )
            ) ||
            createTaskId();


        return {

            provider_id:
                CONFIG.providerId,

            provider_name:
                CONFIG.providerName,

            model_id:
                model,

            model_name:
                modelName,

            prompt:
                prompt,

            image_reference_url:
                null,

            video_reference_url:
                null,

            ratio:
                null,

            duration:
                Number.isFinite(duration) &&
                duration > 0
                    ? duration
                    : null,

            resolution:
                resolution,

            status:
                safeString(
                    options.status,
                    "success"
                ) ||
                "success",

            task_id:
                taskId,

            result_url:
                options.resultUrl ||
                null,

            error_message:
                safeString(
                    options.errorMessage
                ) ||
                null,

            credit_cost:
                CONFIG.creditCost

        };

    }


    /* =====================================================
       SERVER REQUEST
    ===================================================== */

    async function requestServer(
        operation,
        payload = {}
    ) {

        const session =
            await getSession();


        const accessToken =
            safeString(
                session?.access_token
            );


        if (
            !accessToken
        ) {

            throw new Error(
                "Access token Supabase tidak tersedia."
            );

        }


        const response =
            await fetch(
                CONFIG.endpoint,
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
                        JSON.stringify({

                            operation,

                            ...payload

                        })

                }
            );


        const responseText =
            await response.text();


        let data =
            null;


        if (
            responseText
        ) {

            try {

                data =
                    JSON.parse(
                        responseText
                    );

            } catch {

                data =
                    null;

            }

        }


        if (
            !response.ok
        ) {

            const message =
                data?.error ||
                data?.message ||
                responseText ||
                `Server error ${response.status}`;


            const requestError =
                new Error(
                    message
                );


            requestError.status =
                response.status;


            requestError.code =
                data?.code ||
                "VISION_VIDEO_HISTORY_REQUEST_FAILED";


            requestError.data =
                data;


            throw requestError;

        }


        if (
            !data ||
            data.success !== true
        ) {

            const requestError =
                new Error(
                    data?.error ||
                    data?.message ||
                    "Vision Video history request gagal."
                );


            requestError.code =
                data?.code ||
                "VISION_VIDEO_HISTORY_FAILED";


            requestError.data =
                data;


            throw requestError;

        }


        return data;

    }


    /* =====================================================
       SAVE SUCCESS
    ===================================================== */

    async function saveSuccess(
        options = {}
    ) {

        const state =
            getState();


        const record =
            buildHistoryRecord({

                ...options,

                status:
                    "success"

            });


        const response =
            await requestServer(
                "vision_history_save",
                {
                    record
                }
            );


        const saved =
            response?.history ||
            response?.record ||
            null;


        state.set(
            "credit.historyId",
            saved?.id || null
        );


        state.set(
            "history.saved",
            true
        );


        state.set(
            "history.historyId",
            saved?.id || null
        );


        return saved;

    }


    /* =====================================================
       SAVE FAILED
    ===================================================== */

    async function saveFailed(
        error,
        options = {}
    ) {

        const state =
            getState();


        const message =
            error instanceof Error
                ? error.message
                : safeString(
                    error,
                    "Vision Video process gagal."
                );


        const record =
            buildHistoryRecord({

                ...options,

                status:
                    "failed",

                errorMessage:
                    message

            });


        const response =
            await requestServer(
                "vision_history_save",
                {
                    record
                }
            );


        const saved =
            response?.history ||
            response?.record ||
            null;


        state.set(
            "history.saved",
            false
        );


        state.set(
            "history.historyId",
            saved?.id || null
        );


        return saved;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = Object.freeze({

        CONFIG,

        createTaskId,

        buildHistoryRecord,

        requestServer,

        saveSuccess,

        saveFailed

    });


    /* =====================================================
       GLOBAL EXPORT
    ===================================================== */

    window.GENZVisionVideoHistory =
        API;


    window.GENZVisionVideoHistoryReady =
        true;


    console.info(
        "[GEN-Z.AI Vision Video] History module ready."
    );

})();
