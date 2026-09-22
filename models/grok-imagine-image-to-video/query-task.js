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
   Response KIE dapat memiliki beberapa lapisan object
   seperti:

   response
   response.data
   response.data.data
   response.data.task
   response.task
   response.recordInfo

   File ini melakukan normalisasi struktur tersebut agar
   generate-status.js menerima bentuk data yang konsisten.
========================================================= */

import {
    getTask
} from "../../provider/kie/client.js";


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_SCAN_DEPTH = 8;


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
   ADD RESULT URL
========================================================= */

function addResultUrl(
    collection,
    value
) {

    /*
     * Direct string URL.
     */

    if (
        typeof value === "string"
    ) {

        const url =
            normalizeUrl(
                value
            );


        if (
            url &&
            !collection.includes(
                url
            )
        ) {

            collection.push(
                url
            );

        }

        return;

    }


    /*
     * Some KIE responses can represent result
     * items as objects.
     */

    if (
        value &&
        typeof value === "object"
    ) {

        const candidates = [

            value.url,

            value.videoUrl,

            value.video_url,

            value.resultUrl,

            value.result_url,

            value.fileUrl,

            value.file_url,

            value.downloadUrl,

            value.download_url

        ];


        for (
            const candidate of candidates
        ) {

            const url =
                normalizeUrl(
                    candidate
                );


            if (
                url &&
                !collection.includes(
                    url
                )
            ) {

                collection.push(
                    url
                );

            }

        }

    }

}


/* =========================================================
   ADD URL ARRAY
========================================================= */

function addResultUrlArray(
    collection,
    value
) {

    if (
        !Array.isArray(
            value
        )
    ) {

        return;

    }


    for (
        const item of value
    ) {

        addResultUrl(
            collection,
            item
        );

    }

}


/* =========================================================
   GET OBJECT CANDIDATES
   ---------------------------------------------------------
   Mengambil semua object yang relevan dari response
   KIE secara recursive.

   Contoh yang didukung:

   response
   ├─ data
   │  ├─ task
   │  └─ data
   │     └─ resultJson
   │
   ├─ task
   └─ recordInfo
========================================================= */

function collectObjects(
    root
) {

    const objects = [];

    const visited =
        new Set();


    function walk(
        value,
        depth
    ) {

        if (
            depth >
            MAX_SCAN_DEPTH
        ) {

            return;

        }


        if (
            !value ||
            typeof value !== "object"
        ) {

            return;

        }


        if (
            visited.has(
                value
            )
        ) {

            return;

        }


        visited.add(
            value
        );


        objects.push(
            value
        );


        /*
         * Only inspect object/array children.
         * This intentionally avoids blindly traversing
         * arbitrary primitive values.
         */

        if (
            Array.isArray(
                value
            )
        ) {

            for (
                const item of value
            ) {

                walk(
                    item,
                    depth + 1
                );

            }

            return;

        }


        for (
            const key of Object.keys(
                value
            )
        ) {

            const child =
                value[key];


            if (
                child &&
                typeof child === "object"
            ) {

                walk(
                    child,
                    depth + 1
                );

            }

        }

    }


    walk(
        root,
        0
    );


    return objects;

}


/* =========================================================
   FIND TASK OBJECT
========================================================= */

function findTaskObject(
    response
) {

    if (
        !response ||
        typeof response !== "object"
    ) {

        return {};

    }


    const objects =
        collectObjects(
            response
        );


    /*
     * Prefer objects that actually look like task
     * containers.
     */

    const preferredKeys = [

        "taskId",

        "task_id",

        "state",

        "status",

        "task_state",

        "taskStatus",

        "task_status",

        "resultJson",

        "result_json",

        "resultUrls",

        "result_urls"

    ];


    for (
        const object of objects
    ) {

        if (
            preferredKeys.some(
                key =>
                    Object.prototype.hasOwnProperty.call(
                        object,
                        key
                    )
            )
        ) {

            return object;

        }

    }


    /*
     * Fallback to the first object.
     */

    return (
        objects[0] ||
        {}
    );

}


/* =========================================================
   FIND VALUE
   ---------------------------------------------------------
   Cari property tertentu dari seluruh object tree.
========================================================= */

function findFirstValue(
    response,
    keys
) {

    const objects =
        collectObjects(
            response
        );


    for (
        const object of objects
    ) {

        for (
            const key of keys
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    key
                )
            ) {

                const value =
                    object[key];


                if (
                    value !== null &&
                    value !== undefined &&
                    value !== ""
                ) {

                    return value;

                }

            }

        }

    }


    return null;

}


/* =========================================================
   EXTRACT RESULT URLS
   ---------------------------------------------------------
   Mendukung:

   resultUrls
   result_urls
   resultUrl
   result_url
   videoUrl
   video_url
   resultJson.resultUrls
   resultJson.result_urls
   resultJson.data.resultUrls
   resultJson.data.result_urls
   nested response.data.*
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


    const objects =
        collectObjects(
            task
        );


    for (
        const object of objects
    ) {

        /*
         * Direct arrays.
         */

        addResultUrlArray(
            urls,
            object.resultUrls
        );


        addResultUrlArray(
            urls,
            object.result_urls
        );


        addResultUrlArray(
            urls,
            object.results
        );


        addResultUrlArray(
            urls,
            object.result
        );


        /*
         * Direct URL fields.
         */

        addResultUrl(
            urls,
            object.resultUrl
        );


        addResultUrl(
            urls,
            object.result_url
        );


        addResultUrl(
            urls,
            object.videoUrl
        );


        addResultUrl(
            urls,
            object.video_url
        );


        addResultUrl(
            urls,
            object.fileUrl
        );


        addResultUrl(
            urls,
            object.file_url
        );


        addResultUrl(
            urls,
            object.downloadUrl
        );


        addResultUrl(
            urls,
            object.download_url
        );


        /*
         * resultJson can be either an object or a JSON
         * encoded string.
         */

        const resultJson =
            parseResultJson(
                object.resultJson ??
                object.result_json ??
                null
            );


        if (
            resultJson &&
            typeof resultJson === "object"
        ) {

            const resultObjects =
                collectObjects(
                    resultJson
                );


            for (
                const resultObject of resultObjects
            ) {

                addResultUrlArray(
                    urls,
                    resultObject.resultUrls
                );


                addResultUrlArray(
                    urls,
                    resultObject.result_urls
                );


                addResultUrlArray(
                    urls,
                    resultObject.results
                );


                addResultUrl(
                    urls,
                    resultObject.resultUrl
                );


                addResultUrl(
                    urls,
                    resultObject.result_url
                );


                addResultUrl(
                    urls,
                    resultObject.videoUrl
                );


                addResultUrl(
                    urls,
                    resultObject.video_url
                );


                addResultUrl(
                    urls,
                    resultObject.fileUrl
                );


                addResultUrl(
                    urls,
                    resultObject.file_url
                );


                addResultUrl(
                    urls,
                    resultObject.downloadUrl
                );


                addResultUrl(
                    urls,
                    resultObject.download_url
                );

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


    const objects =
        collectObjects(
            task
        );


    const stateKeys = [

        "state",

        "status",

        "task_state",

        "taskStatus",

        "task_status"

    ];


    /*
     * Prefer explicit task-like objects first.
     */

    for (
        const object of objects
    ) {

        for (
            const key of stateKeys
        ) {

            const candidate =
                object[key];


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

    if (
        task &&
        typeof task === "object"
    ) {

        const objects =
            collectObjects(
                task
            );


        const idKeys = [

            "taskId",

            "task_id",

            "taskID",

            "id"

        ];


        for (
            const object of objects
        ) {

            for (
                const key of idKeys
            ) {

                const candidate =
                    object[key];


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

        }

    }


    const fallback =
        String(
            fallbackTaskId || ""
        ).trim();


    return fallback;

}


/* =========================================================
   GET RESULT JSON
========================================================= */

function getResultJson(
    response,
    task
) {

    /*
     * Search task/response tree first.
     */

    const direct =
        findFirstValue(
            task,
            [
                "resultJson",
                "result_json"
            ]
        );


    if (
        direct !== null &&
        direct !== undefined
    ) {

        return parseResultJson(
            direct
        );

    }


    const responseResult =
        findFirstValue(
            response,
            [
                "resultJson",
                "result_json"
            ]
        );


    if (
        responseResult !== null &&
        responseResult !== undefined
    ) {

        return parseResultJson(
            responseResult
        );

    }


    return null;

}


/* =========================================================
   SUCCESS STATE
========================================================= */

function isSuccessState(
    state
) {

    const normalized =
        String(
            state || ""
        )
            .trim()
            .toLowerCase();


    return [

        "success",

        "succeeded",

        "successful",

        "completed",

        "complete",

        "done",

        "finished",

        "finish",

        "successfully_completed",

        "successful_completed"

    ].includes(
        normalized
    );

}


/* =========================================================
   FAILED STATE
========================================================= */

function isFailedState(
    state
) {

    const normalized =
        String(
            state || ""
        )
            .trim()
            .toLowerCase();


    return [

        "fail",

        "failed",

        "failure",

        "error",

        "cancelled",

        "canceled",

        "rejected",

        "aborted",

        "terminated",

        "terminate"

    ].includes(
        normalized
    );

}


/* =========================================================
   WAITING STATE
========================================================= */

function isWaitingState(
    state
) {

    const normalized =
        String(
            state || ""
        )
            .trim()
            .toLowerCase();


    return [

        "waiting",

        "queued",

        "queue",

        "pending",

        "created",

        "submitted",

        "accepted",

        "received"

    ].includes(
        normalized
    );

}


/* =========================================================
   PROCESSING STATE
========================================================= */

function isProcessingState(
    state
) {

    const normalized =
        String(
            state || ""
        )
            .trim()
            .toLowerCase();


    return [

        "processing",

        "process",

        "running",

        "generating",

        "in_progress",

        "in-progress",

        "inprogress",

        "working",

        "executing",

        "started",

        "active"

    ].includes(
        normalized
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


    /* =====================================================
       QUERY KIE
    ===================================================== */

    const response =
        await getTask(
            id,
            apiKey
        );


    /*
     * Pastikan response tetap object.
     */

    const safeResponse =
        response &&
        typeof response === "object"

            ? response

            : {};


    /* =====================================================
       FIND TASK
    ===================================================== */

    const task =
        findTaskObject(
            safeResponse
        );


    /* =====================================================
       TASK ID
    ===================================================== */

    const normalizedTaskId =
        getTaskId(
            task,
            id
        );


    /* =====================================================
       STATE
    ===================================================== */

    const state =
        getTaskState(
            safeResponse
        );


    /* =====================================================
       RESULT JSON
    ===================================================== */

    const resultJson =
        getResultJson(
            safeResponse,
            task
        );


    /* =====================================================
       RESULT URLS
    ===================================================== */

    const resultUrls =
        extractResultUrls(
            safeResponse
        );


    /*
     * Also scan the normalized resultJson explicitly.
     * This protects against resultJson being outside the
     * normal task object.
     */

    if (
        resultJson &&
        typeof resultJson === "object"
    ) {

        const resultJsonUrls =
            extractResultUrls(
                resultJson
            );


        for (
            const url of resultJsonUrls
        ) {

            addResultUrl(
                resultUrls,
                url
            );

        }

    }


    /* =====================================================
       STATUS FLAGS
    ===================================================== */

    const hasResult =
        resultUrls.length >
        0;


    const stateSuccess =
        isSuccessState(
            state
        );


    const stateFailed =
        isFailedState(
            state
        );


    /*
     * Terminal success:
     *
     * 1. Provider explicitly reports success, OR
     * 2. Provider has supplied an actual result URL.
     *
     * A result URL is treated as terminal because there is
     * now a concrete generated asset that can be consumed
     * by the application.
     */

    const success =
        !stateFailed &&
        (
            stateSuccess ||
            hasResult
        );


    const failed =
        !success &&
        stateFailed;


    const waiting =
        !success &&
        !failed &&
        isWaitingState(
            state
        );


    /*
     * Unknown/non-terminal states remain processing.
     */

    const processing =
        !success &&
        !failed;


    /* =====================================================
       NORMALIZED RESPONSE
    ===================================================== */

    return {

        ...safeResponse,

        task,

        taskId:
            normalizedTaskId,

        state,

        status:
            state,

        resultJson,

        resultUrls,

        success,

        completed:
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

    isWaitingState,

    isProcessingState

};


export default query;
