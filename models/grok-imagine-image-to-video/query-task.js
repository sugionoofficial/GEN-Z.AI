```javascript
// =========================================================
// GEN-Z.AI
// GROK IMAGINE IMAGE TO VIDEO
// QUERY TASK
// =========================================================

import {
    getTask
} from "../../provider/kie/client.js";


// =========================================================
// QUERY
// =========================================================

async function query(
    taskId,
    apiKey = null
) {

    // -----------------------------------------------------
    // VALIDATE TASK ID
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // QUERY KIE
    // -----------------------------------------------------

    const response =
        await getTask(
            id,
            apiKey
        );


    // -----------------------------------------------------
    // NORMALIZE TASK OBJECT
    // -----------------------------------------------------

    const task =
        response?.task ||
        response?.data ||
        response ||
        {};


    // -----------------------------------------------------
    // PARSE RESULT JSON
    // -----------------------------------------------------

    let result =
        task.resultJson;


    if (
        typeof result === "string"
    ) {

        try {

            result =
                JSON.parse(
                    result
                );

        } catch {

            result =
                null;

        }

    }


    // -----------------------------------------------------
    // RESULT URLS
    // -----------------------------------------------------

    const resultUrls =
        Array.isArray(
            result?.resultUrls
        )
            ? result.resultUrls
            : [];


    // -----------------------------------------------------
    // STATE
    // -----------------------------------------------------

    const state =
        String(
            task.state || ""
        )
        .trim()
        .toLowerCase();


    // -----------------------------------------------------
    // RESULT
    // -----------------------------------------------------

    return {

        ...response,

        task,

        state,

        resultUrls

    };

}


// =========================================================
// EXPORT
// =========================================================

export {

    query

};

export default query;
```
