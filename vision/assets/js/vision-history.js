/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-history.js

   Fungsi:
   - Menyimpan hasil Vision ke generation_history
   - Mengambil riwayat Vision milik user
   - Menyimpan status success / failed
   - Menyimpan metadata model/provider
   - Menyimpan credit_cost = 1
   - Tidak melakukan proses Vision
   - Tidak melakukan credit deduction
   - Tidak mengatur UI
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VISION_HISTORY_CONFIG =
    Object.freeze({

        TABLE:
            "generation_history",

        PROVIDER_ID:
            "openkey",

        PROVIDER_NAME:
            "OpenKey",

        CREDIT_COST:
            1,

        TASK_PREFIX:
            "vision-"

    });


/* =========================================================
   STATE
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
   CONFIG
========================================================= */

function getConfig() {

    const config =
        window.GENZ_CONFIG;


    if (
        !config
    ) {

        throw new Error(
            "GENZ_CONFIG belum tersedia."
        );

    }


    if (
        !config.SUPABASE_URL
    ) {

        throw new Error(
            "SUPABASE_URL belum tersedia."
        );

    }


    if (
        !config.SUPABASE_KEY
    ) {

        throw new Error(
            "SUPABASE_KEY belum tersedia."
        );

    }


    return config;

}


/* =========================================================
   SUPABASE SESSION
========================================================= */

async function getSession() {

    if (
        window.supabaseClient
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


    if (
        window.GENZ_SUPABASE
    ) {

        const client =
            window.GENZ_SUPABASE;


        if (
            client.auth &&
            typeof client.auth
                .getSession ===
                "function"
        ) {

            const result =
                await client.auth
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


/* =========================================================
   UUID
========================================================= */

function createUUID() {

    if (
        typeof crypto !==
            "undefined" &&
        typeof crypto.randomUUID ===
            "function"
    ) {

        return crypto.randomUUID();

    }


    return (

        Date.now()
            .toString(
                36
            ) +

        "-" +

        Math.random()
            .toString(
                36
            )
            .slice(
                2,
                10
            )

    );

}


/* =========================================================
   TASK ID
========================================================= */

function createTaskId() {

    return (
        VISION_HISTORY_CONFIG
            .TASK_PREFIX +
        createUUID()
    );

}


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(
    value,
    fallback = ""
) {

    if (
        value ===
        null ||
        value ===
        undefined
    ) {

        return fallback;

    }


    if (
        typeof value ===
        "string"
    ) {

        return value.trim();

    }


    if (
        typeof value ===
        "number" ||
        typeof value ===
        "boolean"
    ) {

        return String(
            value
        );

    }


    return fallback;

}


/* =========================================================
   GET USER
========================================================= */

async function getUser() {

    const session =
        await getSession();


    if (
        !session?.user
    ) {

        throw new Error(
            "User belum terautentikasi."
        );

    }


    return {

        session,

        user:
            session.user,

        userId:
            session.user.id,

        email:
            session.user.email ||
            ""

    };

}


/* =========================================================
   BUILD HISTORY RECORD
========================================================= */

function buildHistoryRecord(
    options = {}
) {

    const state =
        getState();


    const userId =
        options.userId ||
        state.get(
            "auth.userId",
            ""
        );


    const email =
        options.email ||
        state.get(
            "auth.email",
            ""
        );


    const model =
        options.model ||
        state.get(
            "model.id",
            "gemini-3.1-pro"
        );


    const modelName =
        options.modelName ||
        state.get(
            "model.name",
            "Gemini 3.1 Pro"
        );


    const taskId =
        options.taskId ||
        state.get(
            "process.taskId",
            ""
        ) ||
        createTaskId();


    const file =
        options.file ||
        state.get(
            "file",
            {}
        );


    const settings =
        options.settings ||
        state.get(
            "settings",
            {}
        );


    const prompt =
        options.prompt ||
        state.get(
            "prompt.text",
            ""
        );


    const status =
        options.status ||
        "success";


    const resultUrl =
        options.resultUrl ||
        null;


    const errorMessage =
        options.errorMessage ||
        null;


    return {

        user_id:
            userId,

        user_email:
            email,

        provider_id:
            VISION_HISTORY_CONFIG
                .PROVIDER_ID,

        provider_name:
            VISION_HISTORY_CONFIG
                .PROVIDER_NAME,

        model_id:
            model,

        model_name:
            modelName,

        prompt:
            safeString(
                prompt
            ),

        image_reference_url:
            options.imageReferenceUrl ||
            null,

        video_reference_url:
            null,

        ratio:
            settings.ratio ||
            null,

        duration:
            settings.duration ||
            null,

        resolution:
            settings.resolution ||
            null,

        status:
            status,

        task_id:
            taskId,

        result_url:
            resultUrl,

        error_message:
            errorMessage,

        credit_cost:
            VISION_HISTORY_CONFIG
                .CREDIT_COST

    };

}


/* =========================================================
   INSERT HISTORY
========================================================= */

async function insertHistory(
    record
) {

    const config =
        getConfig();


    const session =
        await getSession();


    const response =
        await fetch(

            `${config.SUPABASE_URL}/rest/v1/${VISION_HISTORY_CONFIG.TABLE}`,

            {

                method:
                    "POST",

                headers: {

                    "apikey":
                        config.SUPABASE_KEY,

                    "Authorization":
                        `Bearer ${session.access_token}`,

                    "Content-Type":
                        "application/json",

                    "Prefer":
                        "return=representation"

                },

                body:
                    JSON.stringify(
                        record
                    )

            }

        );


    const responseText =
        await response.text();


    if (
        !response.ok
    ) {

        let message =
            responseText;


        try {

            const error =
                JSON.parse(
                    responseText
                );


            message =
                error.message ||
                error.error ||
                error.details ||
                responseText;

        } catch {

            /* response non-JSON */

        }


        throw new Error(
            `Gagal menyimpan Vision history: ${message}`
        );

    }


    if (
        !responseText
    ) {

        return null;

    }


    try {

        const data =
            JSON.parse(
                responseText
            );


        return Array.isArray(
            data
        )
            ? data[0] || null
            : data;

    } catch {

        return null;

    }

}


/* =========================================================
   SAVE SUCCESS
========================================================= */

async function saveSuccess(
    options = {}
) {

    const state =
        getState();


    const user =
        await getUser();


    const record =
        buildHistoryRecord({

            ...options,

            userId:
                user.userId,

            email:
                user.email,

            status:
                "success"

        });


    const saved =
        await insertHistory(
            record
        );


    if (
        saved?.id
    ) {

        state.set(
            "history.saved",
            true
        );

        state.set(
            "history.historyId",
            saved.id
        );

    } else {

        state.set(
            "history.saved",
            true
        );

    }


    return saved;

}


/* =========================================================
   SAVE FAILED
========================================================= */

async function saveFailed(
    error,
    options = {}
) {

    const state =
        getState();


    const user =
        await getUser();


    const message =
        error instanceof Error
            ? error.message
            : safeString(
                error,
                "Vision process gagal."
            );


    const record =
        buildHistoryRecord({

            ...options,

            userId:
                user.userId,

            email:
                user.email,

            status:
                "failed",

            errorMessage:
                message

        });


    return insertHistory(
        record
    );

}


/* =========================================================
   GET HISTORY
========================================================= */

async function getHistory(
    options = {}
) {

    const config =
        getConfig();


    const session =
        await getSession();


    const user =
        session.user;


    const limit =
        Math.min(

            Math.max(

                Number(
                    options.limit ||
                    20
                ),

                1

            ),

            100

        );


    const select =
        options.select ||
        "*";


    const url =
        new URL(

            `${config.SUPABASE_URL}/rest/v1/${VISION_HISTORY_CONFIG.TABLE}`

        );


    url.searchParams.set(
        "select",
        select
    );


    url.searchParams.set(
        "user_id",
        `eq.${user.id}`
    );


    url.searchParams.set(
        "provider_id",
        `eq.${VISION_HISTORY_CONFIG.PROVIDER_ID}`
    );


    url.searchParams.set(
        "order",
        "created_at.desc"
    );


    url.searchParams.set(
        "limit",
        String(
            limit
        )
    );


    const response =
        await fetch(
            url.toString(),
            {

                method:
                    "GET",

                headers: {

                    "apikey":
                        config.SUPABASE_KEY,

                    "Authorization":
                        `Bearer ${session.access_token}`,

                    "Content-Type":
                        "application/json"

                }

            }
        );


    const responseText =
        await response.text();


    if (
        !response.ok
    ) {

        let message =
            responseText;


        try {

            const error =
                JSON.parse(
                    responseText
                );


            message =
                error.message ||
                error.error ||
                error.details ||
                responseText;

        } catch {

            /* response non-JSON */

        }


        throw new Error(
            `Gagal mengambil Vision history: ${message}`
        );

    }


    if (
        !responseText
    ) {

        return [];

    }


    try {

        const data =
            JSON.parse(
                responseText
            );


        return Array.isArray(
            data
        )
            ? data
            : [];

    } catch {

        return [];

    }

}


/* =========================================================
   GET HISTORY BY ID
========================================================= */

async function getHistoryById(
    id
) {

    if (
        !id
    ) {

        return null;

    }


    const config =
        getConfig();


    const session =
        await getSession();


    const url =
        new URL(

            `${config.SUPABASE_URL}/rest/v1/${VISION_HISTORY_CONFIG.TABLE}`

        );


    url.searchParams.set(
        "select",
        "*"
    );


    url.searchParams.set(
        "id",
        `eq.${id}`
    );


    url.searchParams.set(
        "provider_id",
        `eq.${VISION_HISTORY_CONFIG.PROVIDER_ID}`
    );


    url.searchParams.set(
        "limit",
        "1"
    );


    const response =
        await fetch(
            url.toString(),
            {

                method:
                    "GET",

                headers: {

                    "apikey":
                        config.SUPABASE_KEY,

                    "Authorization":
                        `Bearer ${session.access_token}`

                }

            }
        );


    if (
        !response.ok
    ) {

        return null;

    }


    const data =
        await response.json();


    return Array.isArray(
        data
    )
        ? data[0] || null
        : null;

}


/* =========================================================
   NORMALIZE HISTORY ITEM
========================================================= */

function normalizeHistoryItem(
    item
) {

    if (
        !item ||
        typeof item !==
            "object"
    ) {

        return null;

    }


    return {

        id:
            item.id ||
            null,

        userId:
            item.user_id ||
            null,

        email:
            item.user_email ||
            "",

        providerId:
            item.provider_id ||
            VISION_HISTORY_CONFIG
                .PROVIDER_ID,

        providerName:
            item.provider_name ||
            VISION_HISTORY_CONFIG
                .PROVIDER_NAME,

        modelId:
            item.model_id ||
            "",

        modelName:
            item.model_name ||
            item.model_id ||
            "",

        prompt:
            item.prompt ||
            "",

        status:
            item.status ||
            "unknown",

        taskId:
            item.task_id ||
            "",

        resultUrl:
            item.result_url ||
            null,

        errorMessage:
            item.error_message ||
            null,

        creditCost:
            Number(
                item.credit_cost ??
                VISION_HISTORY_CONFIG
                    .CREDIT_COST
            ),

        createdAt:
            item.created_at ||
            null

    };

}


/* =========================================================
   RESET HISTORY STATE
========================================================= */

function resetState() {

    const state =
        getState();


    state.set(
        "history.saved",
        false
    );


    state.set(
        "history.historyId",
        null
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionHistory =
    Object.freeze({

        CONFIG:
            VISION_HISTORY_CONFIG,

        createTaskId,

        buildHistoryRecord,

        insertHistory,

        saveSuccess,

        saveFailed,

        getHistory,

        getHistoryById,

        normalizeHistoryItem,

        resetState

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionHistory =
    GENZVisionHistory;
