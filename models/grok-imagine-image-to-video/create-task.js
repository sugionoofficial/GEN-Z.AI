import {
    createTask as createKieTask
} from "../../provider/kie/client.js";


import config
    from "./config.js";


import {
    validate
} from "./parameters.js";


/* =========================================================
   BUILD INPUT
   ========================================================= */

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
        const key of allowed
    ) {

        if (
            input[key] !== undefined
        ) {

            result[key] =
                input[key];

        }

    }


    /*
     * KIE.AI:
     *
     * external image tidak mendukung
     * spicy.
     *
     * Jika image_urls digunakan,
     * normalisasi mode ke normal.
     */

    if (
        Array.isArray(
            result.image_urls
        ) &&
        result.image_urls.length > 0 &&
        result.mode === "spicy"
    ) {

        result.mode =
            "normal";

    }


    return result;

}


/* =========================================================
   BUILD PAYLOAD
   ========================================================= */

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


/* =========================================================
   CREATE
   ========================================================= */

async function create(
    input = {},
    apiKey = null
) {

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


    const payload =
        buildPayload(
            input
        );


    const response =
        await createKieTask(
            payload,
            apiKey
        );


    const taskId =
        response?.data?.taskId ||
        response?.data?.task_id ||
        response?.taskId ||
        response?.task_id ||
        null;


    if (
        !taskId
    ) {

        const error =
            new Error(
                "KIE.AI tidak mengembalikan taskId."
            );

        error.code =
            "KIE_TASK_ID_MISSING";

        error.response =
            response;

        throw error;

    }


    return {

        ...response,

        taskId,

        task_id:
            taskId

    };

}


export {
    buildInput,
    buildPayload,
    create
};


export default create;
