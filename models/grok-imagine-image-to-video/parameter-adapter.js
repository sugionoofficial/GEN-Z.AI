/* =========================================================
   GROK IMAGINE IMAGE-TO-VIDEO
   PARAMETER ADAPTER
========================================================= */


/* =========================================================
   SOURCE EXTRACTION
========================================================= */

function getSource(
    body = {}
) {

    if (
        body &&
        typeof body.parameters === "object" &&
        body.parameters !== null &&
        !Array.isArray(body.parameters)
    ) {

        return body.parameters;

    }


    return body || {};

}


/* =========================================================
   GET PARAMETERS
========================================================= */

function getParameters(
    body = {}
) {

    const source =
        getSource(body);


    const allowedKeys = [

        "image_urls",

        "task_id",

        "index",

        "prompt",

        "mode",

        "aspect_ratio",

        "duration",

        "resolution"

    ];


    const result = {};


    for (
        const key of allowedKeys
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                source,
                key
            )
        ) {

            result[key] =
                source[key];

        }

    }


    return result;

}


/* =========================================================
   SANITIZE PARAMETERS
========================================================= */

function sanitizeParameters(
    parameters = {}
) {

    const allowedKeys = [

        "image_urls",

        "task_id",

        "index",

        "prompt",

        "mode",

        "aspect_ratio",

        "duration",

        "resolution"

    ];


    const result = {};


    for (
        const key of allowedKeys
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                parameters,
                key
            )
        ) {

            result[key] =
                parameters[key];

        }

    }


    /*
     * NSFW checker dikendalikan SERVER.
     *
     * Browser tidak boleh menentukan
     * apakah checker aktif atau tidak.
     */

    result.nsfw_checker =
        true;


    return result;

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    getParameters,

    sanitizeParameters

};


export default {

    getParameters,

    sanitizeParameters

};
