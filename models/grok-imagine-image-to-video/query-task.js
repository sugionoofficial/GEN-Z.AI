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
        !value
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
   EXTRACT RESULT URLS
   ========================================================= */

function extractResultUrls(
    task
) {

    const result =
        parseResultJson(
            task?.resultJson
        );


    if (
        Array.isArray(
            result?.resultUrls
        )
    ) {

        return result.resultUrls
            .filter(
                url =>
                    typeof url === "string" &&
                    url.trim()
            );

    }


    /*
     * Beberapa response bisa
     * mengembalikan nested result.
     */

    if (
        Array.isArray(
            result?.result_urls
        )
    ) {

        return result.result_urls
            .filter(
                url =>
                    typeof url === "string" &&
                    url.trim()
            );

    }


    return [];

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


    const response =
        await getTask(
            id,
            apiKey
        );


    const task =
        response?.task ||
        response?.data ||
        response ||
        {};


    const state =
        String(
            task.state ||
            ""
        )
        .trim()
        .toLowerCase();


    const resultJson =
        parseResultJson(
            task.resultJson
        );


    const resultUrls =
        extractResultUrls(
            task
        );


    return {

        ...response,

        task,

        taskId:
            task.taskId ||
            task.task_id ||
            id,

        state,

        resultJson,

        resultUrls,

        success:
            state === "success",

        failed:
            state === "fail",

        waiting:
            state === "waiting"

    };

}


export {
    query,
    parseResultJson,
    extractResultUrls
};


export default query;
