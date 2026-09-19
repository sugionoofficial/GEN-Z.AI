```javascript
// =========================================================
// GEN-Z.AI
// GROK IMAGINE IMAGE TO VIDEO
// CREATE TASK
// =========================================================

import {
    createTask as createKieTask
} from "../../provider/kie/client.js";

import config
    from "./config.js";

import {
    validate
} from "./parameters.js";


// =========================================================
// BUILD INPUT
// =========================================================

function buildInput(
    input = {}
) {

    const result = {};

    const allowed = [

        "image_urls",

        "task_id",

        "index",

        "prompt",

        "mode",

        "aspect_ratio",

        "duration",

        "resolution",

        "nsfw_checker"

    ];


    for (
        const key
        of allowed
    ) {

        if (
            input[key] !== undefined
        ) {

            result[key] =
                input[key];

        }

    }


    return result;

}


// =========================================================
// BUILD KIE PAYLOAD
// =========================================================

function buildPayload(
    input = {}
) {

    return {

        model:
            config.id,

        input:
            buildInput(input)

    };

}


// =========================================================
// CREATE
// =========================================================

async function create(
    input = {},
    apiKey = null
) {

    // -----------------------------------------------------
    // VALIDATE
    // -----------------------------------------------------

    const validation =
        validate(input);


    if (
        !validation.valid
    ) {

        const error =
            new Error(
                validation.errors.join(" ")
            );

        error.code =
            "INVALID_MODEL_PARAMETERS";

        error.details =
            validation.errors;

        throw error;

    }


    // -----------------------------------------------------
    // BUILD PAYLOAD
    // -----------------------------------------------------

    const payload =
        buildPayload(input);


    // -----------------------------------------------------
    // SEND TO KIE
    // -----------------------------------------------------

    const response =
        await createKieTask(
            payload,
            apiKey
        );


    // -----------------------------------------------------
    // NORMALIZE TASK ID
    // -----------------------------------------------------

    const taskId =

        response?.data?.taskId ||

        response?.data?.task_id ||

        response?.taskId ||

        response?.task_id ||

        null;


    return {

        ...response,

        taskId

    };

}


// =========================================================
// EXPORT
// =========================================================

export {

    buildInput,

    buildPayload,

    create

};

export default create;
```
