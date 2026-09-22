/* =========================================================
   GEN-Z.AI
   GROK IMAGINE IMAGE TO VIDEO
   ---------------------------------------------------------
   File:
   models/grok-imagine-image-to-video/query-task.js

   Tanggung jawab:
   - Query status task ke KIE
   - Normalisasi response KIE
   - Membaca state/status task
   - Membaca resultJson
   - Mengambil result URL video

   TIDAK bertanggung jawab:
   - Credit
   - Generation History
   - Polling browser
   - Render UI
   - API key management

   CATATAN:
   KIE dapat mengembalikan HTTP 200 dengan business code
   tertentu pada response recordInfo. Penentuan berhasil/
   gagal di sini didasarkan pada data task yang sebenarnya,
   terutama state/status dan result URL.
========================================================= */

import {
    getTask
} from "../../provider/kie/client.js";


/* =========================================================
   PARSE RESULT JSON
========================================================= */

function parseResultJson(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    if (
        typeof value === "object"
    ) {

        return value;

    }


    if (
        typeof value !== "string"
    ) {

        return null;

    }


    const text =
        value.trim();


    if (!text) {

        return null;

    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return null;

    }

}


/* =========================================================
   NORMALIZE URL
========================================================= */

function normalizeUrl(
    value
) {

    if (
        typeof value !== "string"
    ) {

        return null;

    }


    const url =
        value.trim();


    if (!url) {

        return null;

    }


    return url;

}


/* =========================================================
   ADD URL
========================================================= */

function addResultUrl(
    collection,
    value
) {

    const url =
        normalizeUrl(
            value
        );


    if (
        !url
    ) {

        return;

    }


    if (
        !collection.includes(
            url
        )
    ) {

        collection.push(
            url
        );

    }

}


/* =========================================================
   EXTRACT RESULT URLS
   ---------------------------------------------------------
   Mendukung beberapa bentuk response KIE:
 *
   resultJson.resultUrls
   resultJson.result_urls
   resultUrls
   result_urls
   resultJson.data.resultUrls
   resultJson.data.result_urls
   task.resultUrls
   task.result_urls
========================================================= */

function extractResultUrls(
    task
) {

    const urls = [];


    if (
        !task ||
        typeof task !== "object"
    ) {

        return urls;

    }


    const result =
        parseResultJson(
            task.resultJson
        );


    /*
     * Direct task fields.
     */

    if (
        Array.isArray(
            task.resultUrls
        )
    ) {

        for (
            const url of task.resultUrls
        ) {

            addResultUrl(
                urls,
                url
            );

        }

    }


    if (
        Array.isArray(
            task.result_urls
        )
    ) {

        for (
            const url of task.result_urls
        ) {

            addResultUrl(
                urls,
                url
            );

        }

    }


    /*
     * Parsed resultJson.
     */

    if (
        result &&
        typeof result === "object"
    ) {

        if (
            Array.isArray(
                result.resultUrls
            )
        ) {

            for (
                const url of result.resultUrls
            ) {

                addResultUrl(
                    urls,
                    url
                );

            }

        }


        if (
            Array.isArray(
                result.result_urls
            )
        ) {

            for (
                const url of result.result_urls
            ) {

                addResultUrl(
                    urls,
                    url
                );

            }

        }


        /*
         * Nested data.
         */

        if (
            result.data &&
            typeof result.data === "object"
        ) {

            if (
                Array.isArray(
                    result.data.resultUrls
                )
            ) {

                for (
                    const url of result.data.resultUrls
                ) {

                    addResultUrl(
                        urls,
                        url
                    );

                }

            }


            if (
                Array.isArray(
                    result.data.result_urls
                )
            ) {

                for (
                    const url of result.data.result_urls
                ) {

                    addResultUrl(
                        urls,
                        url
                    );

                }

            }

        }

    }


    return urls;

}


/* =========================================================
   GET TASK STATE
========================================================= */

function getTaskState(
    task
) {

    if (
        !task ||
        typeof task !== "object"
    ) {

        return "";

    }


    const candidates = [

        task.state,

        task.status,

        task.task_state,

        task.taskStatus,

        task.task_status

    ];


    for (
        const candidate of candidates
    ) {

        if (
            typeof candidate !== "string"
        ) {

            continue;

        }


        const normalized =
            candidate
                .trim()
                .toLowerCase();


        if (
            normalized
        ) {

            return normalized;

        }

    }


    return "";

}


/* =========================================================
   GET TASK ID
========================================================= */

function getTaskId(
    task,
    fallbackTaskId
) {

    const candidates = [

        task?.taskId,

        task?.task_id,

        task?.id,

        fallbackTaskId

    ];


    for (
        const candidate of candidates
    ) {

        const value =
            String(
                candidate || ""
            ).trim();


        if (
            value
        ) {

            return value;

        }

    }


    return "";

}


/* =========================================================
   SUCCESS STATE
========================================================= */

function isSuccessState(
    state
) {

    return [

        "success",

        "succeeded",

        "successful",

        "completed",

        "complete",

        "done",

        "finished",

        "finish"

    ].includes(
        state
    );

}


/* =========================================================
   FAILED STATE
========================================================= */

function isFailedState(
    state
) {

    return [

        "fail",

        "failed",

        "failure",

        "error",

        "cancelled",

        "canceled",

        "rejected",

        "aborted"

    ].includes(
        state
    );

}


/* =========================================================
   WAITING STATE
========================================================= */

function isWaitingState(
    state
) {

    return [

        "waiting",

        "queued",

        "queue",

        "pending",

        "created",

        "submitted"

    ].includes(
        state
    );

}


/* =========================================================
   QUERY
========================================================= */

async function query(
    taskId,
    apiKey = null
) {

    const id =
        String(
            taskId || ""
        ).trim();


    if (
        !id
    ) {

        const error =
            new Error(
                "taskId wajib diisi."
            );


        error.code =
            "TASK_ID_REQUIRED";


        throw error;

    }


    /*
     * =====================================================
     * QUERY KIE
     * =====================================================
     */

    const response =
        await getTask(
            id,
            apiKey
        );


    /*
     * =====================================================
     * NORMALIZE TASK CONTAINER
     * =====================================================
     *
     * getTask() dapat mengembalikan:
     *
     * response.task
     * response.data
     * response
     */

    const task =
        response?.task &&
        typeof response.task === "object"

            ? response.task

            : response?.data &&
              typeof response.data === "object"

                ? response.data

                : response &&
                  typeof response === "object"

                    ? response

                    : {};


    /*
     * =====================================================
     * TASK ID
     * =====================================================
     */

    const normalizedTaskId =
        getTaskId(
            task,
            id
        );


    /*
     * =====================================================
     * STATE
     * =====================================================
     */

    const state =
        getTaskState(
            task
        );


    /*
     * =====================================================
     * RESULT JSON
     * =====================================================
     */

    const resultJson =
        parseResultJson(
            task.resultJson ??
            task.result_json ??
            response?.resultJson ??
            response?.result_json ??
            null
        );


    /*
     * =====================================================
     * RESULT URLS
     * =====================================================
     */

    const normalizedTask = {

        ...task,

        resultJson

    };


    const resultUrls =
        extractResultUrls(
            normalizedTask
        );


    /*
     * =====================================================
     * STATUS FLAGS
     * =====================================================
     *
     * Jika result URL sudah tersedia, task dianggap
     * berhasil walaupun provider mengirim state yang
     * tidak persis "success".
     */

    const hasResult =
        resultUrls.length >
        0;


    const success =
        hasResult ||
        isSuccessState(
            state
        );


    const failed =
        !success &&
        isFailedState(
            state
        );


    const waiting =
        !success &&
        !failed &&
        isWaitingState(
            state
        );


    const processing =
        !success &&
        !failed;


    /*
     * =====================================================
     * RETURN NORMALIZED RESPONSE
     * =====================================================
     *
     * generate-status.js akan melakukan normalisasi
     * lanjutan dan meng-update generation_history.
     */

    return {

        ...response,

        task,

        taskId:
            normalizedTaskId,

        state,

        resultJson,

        resultUrls,

        success,

        failed,

        waiting,

        processing

    };

}


/* =========================================================
   EXPORT
========================================================= */

export {

    query,

    parseResultJson,

    extractResultUrls,

    getTaskState,

    getTaskId,

    isSuccessState,

    isFailedState,

    isWaitingState

};


export default query;
