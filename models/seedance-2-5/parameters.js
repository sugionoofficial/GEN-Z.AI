const parameters = {

    prompt: {
        type: "string",
        required: false,
        maxLength: 30000
    },

    first_frame_url: {
        type: "string",
        required: false
    },

    last_frame_url: {
        type: "string",
        required: false
    },

    reference_image_urls: {
        type: "array",
        required: false
    },

    reference_video_urls: {
        type: "array",
        required: false
    },

    reference_audio_urls: {
        type: "array",
        required: false
    },

    generate_audio: {
        type: "boolean",
        required: false,
        default: true
    },

    return_last_frame: {
        type: "boolean",
        required: false,
        default: false
    },

    resolution: {
        type: "string",
        required: false,
        enum: [
            "480p",
            "720p",
            "1080p"
        ],
        default: "720p"
    },

    aspect_ratio: {
        type: "string",
        required: false,
        enum: [
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
            "21:9",
            "adaptive"
        ],
        default: "adaptive"
    },

    duration: {
        type: "number",
        required: false,
        min: -1,
        max: 30,
        step: 1,
        default: 5
    },

    output_format: {
        type: "string",
        required: false,
        enum: [
            "mp4",
            "mov"
        ],
        default: "mp4"
    },

    web_search: {
        type: "boolean",
        required: false,
        default: false
    },

    nsfw_checker: {
        type: "boolean",
        required: false,
        default: true
    }
};


/* =========================================================
   HELPERS
========================================================= */

function isString(value) {

    return (
        typeof value === "string" &&
        value.trim().length > 0
    );

}


function validateUrlArray(
    value,
    fieldName
) {

    const errors = [];

    if (!Array.isArray(value)) {

        errors.push(
            `${fieldName} harus berupa array.`
        );

        return errors;

    }


    for (const url of value) {

        if (!isString(url)) {

            errors.push(
                `${fieldName} berisi URL yang tidak valid.`
            );

        }

    }


    return errors;

}


/* =========================================================
   VALIDATION
========================================================= */

function validate(
    input = {}
) {

    const errors = [];


    /* -----------------------------------------------------
       PROMPT
    ----------------------------------------------------- */

    if (
        input.prompt !== undefined
    ) {

        if (
            typeof input.prompt !== "string"
        ) {

            errors.push(
                "prompt harus berupa string."
            );

        } else if (
            input.prompt.length > 30000
        ) {

            errors.push(
                "prompt maksimal 30000 karakter."
            );

        }

    }


    /* -----------------------------------------------------
       FRAME URL
    ----------------------------------------------------- */

    if (
        input.first_frame_url !== undefined &&
        !isString(input.first_frame_url)
    ) {

        errors.push(
            "first_frame_url harus berupa URL."
        );

    }


    if (
        input.last_frame_url !== undefined &&
        !isString(input.last_frame_url)
    ) {

        errors.push(
            "last_frame_url harus berupa URL."
        );

    }


    /* -----------------------------------------------------
       REFERENCE IMAGES
    ----------------------------------------------------- */

    if (
        input.reference_image_urls !== undefined
    ) {

        errors.push(
            ...validateUrlArray(
                input.reference_image_urls,
                "reference_image_urls"
            )
        );

    }


    /* -----------------------------------------------------
       REFERENCE VIDEOS
    ----------------------------------------------------- */

    if (
        input.reference_video_urls !== undefined
    ) {

        errors.push(
            ...validateUrlArray(
                input.reference_video_urls,
                "reference_video_urls"
            )
        );

    }


    /* -----------------------------------------------------
       REFERENCE AUDIO
    ----------------------------------------------------- */

    if (
        input.reference_audio_urls !== undefined
    ) {

        errors.push(
            ...validateUrlArray(
                input.reference_audio_urls,
                "reference_audio_urls"
            )
        );

    }


    /* -----------------------------------------------------
       BOOLEAN
    ----------------------------------------------------- */

    const booleanFields = [
        "generate_audio",
        "return_last_frame",
        "web_search",
        "nsfw_checker"
    ];


    for (
        const field of booleanFields
    ) {

        if (
            input[field] !== undefined &&
            typeof input[field] !== "boolean"
        ) {

            errors.push(
                `${field} harus boolean.`
            );

        }

    }


    /* -----------------------------------------------------
       RESOLUTION
    ----------------------------------------------------- */

    if (
        input.resolution !== undefined &&
        !parameters.resolution.enum.includes(
            input.resolution
        )
    ) {

        errors.push(
            "resolution tidak didukung."
        );

    }


    /* -----------------------------------------------------
       ASPECT RATIO
    ----------------------------------------------------- */

    if (
        input.aspect_ratio !== undefined &&
        !parameters.aspect_ratio.enum.includes(
            input.aspect_ratio
        )
    ) {

        errors.push(
            "aspect_ratio tidak didukung."
        );

    }


    /* -----------------------------------------------------
       DURATION
    ----------------------------------------------------- */

    if (
        input.duration !== undefined
    ) {

        const value =
            Number(input.duration);


        if (
            !Number.isInteger(value) ||
            value < -1 ||
            value > 30
        ) {

            errors.push(
                "duration harus berupa bilangan bulat antara -1 dan 30."
            );

        }

    }


    /* -----------------------------------------------------
       OUTPUT FORMAT
    ----------------------------------------------------- */

    if (
        input.output_format !== undefined &&
        !parameters.output_format.enum.includes(
            input.output_format
        )
    ) {

        errors.push(
            "output_format tidak didukung."
        );

    }


    return {

        valid:
            errors.length === 0,

        errors

    };

}


export {
    parameters,
    validate
};


export default parameters;
