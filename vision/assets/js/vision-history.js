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
   - credit_cost = 1

   CATATAN:
   - INSERT history dilakukan SERVER-SIDE
   - Tidak melakukan INSERT langsung ke Supabase
   - Tidak menerima user_id dari browser sebagai identitas
   - Identitas user diverifikasi oleh /api/openkey-chat
   - Tidak melakukan credit deduction
   - Tidak melakukan refund
   - Tidak mengatur UI
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VISION_HISTORY_CONFIG =
    Object.freeze({

        ENDPOINT:
            "/api/openkey-chat",

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
            typeof client.auth.getSession ===
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
        VISION_HISTORY_CONFIG.TASK_PREFIX +
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
   ---------------------------------------------------------
   Hanya digunakan untuk memastikan session tersedia.
   Identitas final tetap ditentukan server.
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


    const model =
        safeString(
            options.model ||
            state.get(
                "model.id",
                "gemini-3.1-pro"
            ),
            "gemini-3.1-pro"
        );


    const modelName =
        safeString(
            options.modelName ||
            state.get(
                "model.name",
                "Gemini 3.1 Pro"
            ),
            "Gemini 3.1 Pro"
        );


    const taskId =
        safeString(
            options.taskId ||
            state.get(
                "process.taskId",
                ""
            )
        ) ||
        createTaskId();


    const file =
        options.file ||
        state.get(
            "file",
            {}
        ) ||
        {};


    const settings =
        options.settings ||
        state.get(
            "settings",
            {}
        ) ||
        {};


    const prompt =
        safeString(
            options.prompt ||
            state.get(
                "prompt.text",
                ""
            )
        );


    const status =
        safeString(
            options.status,
            "success"
        ) ||
        "success";


    const resultUrl =
        options.resultUrl ||
        null;


    const errorMessage =
        safeString(
            options.errorMessage
        ) ||
        null;


    /*
     * Jangan mengirim user_id atau user_email
     * dari browser.
     *
     * Backend akan mengambil identitas user
     * dari Supabase session yang sudah
     * diverifikasi.
     */

    return {

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
            prompt,

        image_reference_url:
            safeString(
                options.imageReferenceUrl ||
                file.dataUrl ||
                ""
            ) || null,

        video_reference_url:
            null,

        ratio:
            safeString(
                settings.ratio
            ) || null,

        duration:
            settings.duration ??
            null,

        resolution:
            safeString(
                settings.resolution
            ) || null,

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
   REQUEST SERVER
========================================================= */

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
            VISION_HISTORY_CONFIG
                .ENDPOINT,
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


        const error =
            new Error(
                message
            );


        error.status =
            response.status;


        error.code =
            data?.code ||
            "VISION_HISTORY_REQUEST_FAILED";


        error.data =
            data;


        throw error;

    }


    if (
        !data ||
        data.success !== true
    ) {

        const error =
            new Error(
                data?.error ||
                "Vision history request gagal."
            );


        error.code =
            data?.code ||
            "VISION_HISTORY_FAILED";


        error.data =
            data;


        throw error;

    }


    return data;

}


/* =========================================================
   INSERT HISTORY
========================================================= */

async function insertHistory(
    record
) {

    if (
        !record ||
        typeof record !==
            "object"
    ) {

        throw new Error(
            "History record tidak valid."
        );

    }


    return requestServer(
        "vision_history_save",
        {

            record

        }
    );

}


/* =========================================================
   SAVE SUCCESS
========================================================= */

async function saveSuccess(
    options = {}
) {

    const state =
        getState();


    /*
     * Pastikan session tersedia.
     * User identity tetap berasal dari backend.
     */

    await getUser();


    const record =
        buildHistoryRecord({

            ...options,

            status:
                "success"

        });


    const response =
        await insertHistory(
            record
        );


    const saved =
        response?.history ||
        response?.record ||
        null;


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

            status:
                "failed",

            errorMessage:
                message

        });


    const response =
        await insertHistory(
            record
        );


    const saved =
        response?.history ||
        response?.record ||
        null;


    if (
        saved?.id
    ) {

        state.set(
            "history.historyId",
            saved.id
        );

    }


    return saved;

}


/* =========================================================
   GET HISTORY
   ---------------------------------------------------------
   Read tetap menggunakan Supabase session user.
   RLS akan membatasi data berdasarkan user_id.
========================================================= */

async function getHistory(
    options = {}
) {

    const config =
        window.GENZ_CONFIG;


    if (
        !config?.SUPABASE_URL ||
        !config?.SUPABASE_KEY
    ) {

        throw new Error(
            "Konfigurasi Supabase belum tersedia."
        );

    }


    const session =
        await getSession();


    if (
        !session?.user?.id
    ) {

        throw new Error(
            "User belum terautentikasi."
        );

    }


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
        safeString(
            options.select,
            "*"
        ) ||
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
        `eq.${session.user.id}`
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


        const error =
            new Error(
                `Gagal mengambil Vision history: ${message}`
            );


        error.status =
            response.status;


        throw error;

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

    const historyId =
        safeString(
            id
        );


    if (
        !historyId
    ) {

        return null;

    }


    const items =
        await getHistory({

            select:
                "*",

            limit:
                100

        });


    return (
        items.find(
            item =>
                String(
                    item?.id ||
                    ""
                ) ===
                historyId
        ) ||
        null
    );

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
