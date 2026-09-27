/* =========================================================
   SEEDANCE 2.5
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

        "prompt",

        "first_frame_url",

        "last_frame_url",

        "reference_image_urls",

        "reference_video_urls",

        "reference_audio_urls",

        "generate_audio",

        "return_last_frame",

        "resolution",

        "aspect_ratio",

        "duration",

        "output_format",

        "web_search"

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

        "prompt",

        "first_frame_url",

        "last_frame_url",

        "reference_image_urls",

        "reference_video_urls",

        "reference_audio_urls",

        "generate_audio",

        "return_last_frame",

        "resolution",

        "aspect_ratio",

        "duration",

        "output_format",

        "web_search"

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
     * Nilai dari client tidak dipercaya.
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
