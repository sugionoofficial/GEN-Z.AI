import {
    getTask
} from "../../provider/kie/client.js";


/* =========================================================
   HELPERS
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


    try {

        return JSON.parse(
            value
        );

    } catch {

        return null;

    }

}


/* =========================================================
   FIND RESULT URLS
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


    let result =
        task.resultJson ??
        task.result_json ??
        null;


    result =
        parseResultJson(
            result
        );


    if (
        Array.isArray(
            result?.resultUrls
        )
    ) {

        urls.push(
            ...result.resultUrls
                .filter(
                    url =>
                        typeof url ===
                        "string"
                )
                .map(
                    url =>
                        url.trim()
                )
                .filter(Boolean)
        );

    }


    if (
        Array.isArray(
            result?.result_urls
        )
    ) {

        urls.push(
            ...result.result_urls
                .filter(
                    url =>
                        typeof url ===
                        "string"
                )
                .map(
                    url =>
                        url.trim()
                )
                .filter(Boolean)
        );

    }


    /* -----------------------------------------------------
       Direct result URL fallback
    ----------------------------------------------------- */

    const directUrls = [

        task.resultUrl,

        task.result_url,

        task.videoUrl,

        task.video_url

    ];


    for (
        const url of directUrls
    ) {

        if (
            typeof url === "string" &&
            url.trim()
        ) {

            urls.push(
                url.trim()
            );

        }

    }


    return [
        ...new Set(urls)
    ];

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


    if (
        response.data &&
        typeof response.data === "object"
    ) {

        if (
            response.data.state ||
            response.data.status ||
            response.data.resultJson ||
            response.data.result_json
        ) {

            return response.data;

        }

    }


    if (
        response.task &&
        typeof response.task === "object"
    ) {

        return response.task;

    }


    return response;

}


/* =========================================================
   TASK STATE
========================================================= */

function getTaskState(
    task
) {

    return String(

        task?.state ||

        task?.status ||

        task?.task_state ||

        ""

    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   TASK ID
========================================================= */

function getTaskId(
    task,
    fallback
) {

    const value =

        task?.taskId ||

        task?.task_id ||

        fallback ||

        "";


    return String(
        value
    ).trim();

}


/* =========================================================
   STATE HELPERS
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
        "finished"

    ].includes(
        String(
            state || ""
        )
            .trim()
            .toLowerCase()
    );

}


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
        "aborted",
        "terminated"

    ].includes(
        String(
            state || ""
        )
            .trim()
            .toLowerCase()
    );

}


function isWaitingState(
    state
) {

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
        String(
            state || ""
        )
            .trim()
            .toLowerCase()
    );

}


function isProcessingState(
    state
) {

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
        String(
            state || ""
        )
            .trim()
            .toLowerCase()
    );

}


/* =========================================================
   QUERY TASK
========================================================= */

async function query(
    taskId,
    apiKey = null
) {

    const normalizedTaskId =
        String(
            taskId || ""
        ).trim();


    if (
        !normalizedTaskId
    ) {

        const error =
            new Error(
                "taskId wajib diisi."
            );


        error.code =
            "TASK_ID_REQUIRED";


        throw error;

    }


    const response =
        await getTask(
            normalizedTaskId,
            apiKey
        );


    const safeResponse =

        response &&
        typeof response === "object"

            ? response

            : {};


    const task =
        findTaskObject(
            safeResponse
        );


    const state =
        getTaskState(
            task
        );


    const resultJson =
        parseResultJson(

            task?.resultJson ??
            task?.result_json ??
            null

        );


    const resultUrls =
        extractResultUrls(
            task
        );


    const success =
        !isFailedState(state) &&
        (
            isSuccessState(state) ||
            resultUrls.length > 0
        );


    const failed =
        !success &&
        isFailedState(state);


    const waiting =
        !success &&
        !failed &&
        isWaitingState(state);


    const processing =
        !success &&
        !failed;


    return {

        ...safeResponse,

        task,

        taskId:
            getTaskId(
                task,
                normalizedTaskId
            ),

        task_id:
            getTaskId(
                task,
                normalizedTaskId
            ),

        state,

        status:
            state,

        resultJson,

        resultUrls,

        result_urls:
            resultUrls,

        success,

        completed:
            success,

        failed,

        waiting,

        processing

    };

}


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
