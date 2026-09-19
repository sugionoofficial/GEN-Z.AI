```javascript
// =========================================================
// GEN-Z.AI
// GROK IMAGINE IMAGE TO VIDEO
// MODEL PARAMETERS
// =========================================================

const parameters = {

    // -----------------------------------------------------
    // IMAGE INPUT
    // -----------------------------------------------------

    image_urls: {
        type: "array",
        required: false,
        maxItems: 1
    },

    // -----------------------------------------------------
    // GROK GENERATED IMAGE INPUT
    // -----------------------------------------------------

    task_id: {
        type: "string",
        required: false
    },

    index: {
        type: "number",
        required: false,
        min: 0,
        max: 5,
        default: 0
    },

    // -----------------------------------------------------
    // PROMPT
    // -----------------------------------------------------

    prompt: {
        type: "string",
        required: true,
        maxLength: 5000
    },

    // -----------------------------------------------------
    // MODE
    // -----------------------------------------------------

    mode: {
        type: "string",
        required: false,
        enum: [
            "fun",
            "normal",
            "spicy"
        ],
        default: "normal"
    },

    // -----------------------------------------------------
    // ASPECT RATIO
    // -----------------------------------------------------

    aspect_ratio: {
        type: "string",
        required: false,
        enum: [
            "2:3",
            "3:2",
            "1:1",
            "16:9",
            "9:16"
        ],
        default: "2:3"
    },

    // -----------------------------------------------------
    // DURATION
    // -----------------------------------------------------

    duration: {
        type: "number",
        required: false,
        min: 6,
        max: 30,
        default: 6
    },

    // -----------------------------------------------------
    // RESOLUTION
    // -----------------------------------------------------

    resolution: {
        type: "string",
        required: false,
        enum: [
            "480p",
            "720p",
            "1080p"
        ],
        default: "480p"
    },

    // -----------------------------------------------------
    // NSFW CHECKER
    // -----------------------------------------------------

    nsfw_checker: {
        type: "boolean",
        required: false,
        default: true
    }

};


// =========================================================
// VALIDATION
// =========================================================

function validate(input = {}) {

    const errors = [];

    const imageUrls =
        input.image_urls;

    const taskId =
        input.task_id;


    // -----------------------------------------------------
    // IMAGE URLS
    // -----------------------------------------------------

    if (
        imageUrls !== undefined
    ) {

        if (
            !Array.isArray(imageUrls)
        ) {

            errors.push(
                "image_urls harus berupa array."
            );

        } else {

            if (
                imageUrls.length > 1
            ) {

                errors.push(
                    "image_urls maksimal 1 URL."
                );

            }

            for (
                const url
                of imageUrls
            ) {

                if (
                    typeof url !== "string" ||
                    !url.trim()
                ) {

                    errors.push(
                        "image_urls berisi URL yang tidak valid."
                    );

                }

            }

        }

    }


    // -----------------------------------------------------
    // TASK ID
    // -----------------------------------------------------

    if (
        taskId !== undefined &&
        typeof taskId !== "string"
    ) {

        errors.push(
            "task_id harus berupa string."
        );

    }


    // -----------------------------------------------------
    // IMAGE URL DAN TASK ID TIDAK BOLEH BERSAMAAN
    // -----------------------------------------------------

    if (
        Array.isArray(imageUrls) &&
        imageUrls.length > 0 &&
        taskId
    ) {

        errors.push(
            "Gunakan image_urls atau task_id, bukan keduanya."
        );

    }


    // -----------------------------------------------------
    // INDEX
    // -----------------------------------------------------

    if (
        input.index !== undefined
    ) {

        const value =
            Number(input.index);

        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value > 5
        ) {

            errors.push(
                "index harus berupa angka 0 sampai 5."
            );

        }

    }


    // -----------------------------------------------------
    // PROMPT
    // -----------------------------------------------------

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
            input.prompt.length > 5000
        ) {

            errors.push(
                "prompt maksimal 5000 karakter."
            );

        }

    }


    // -----------------------------------------------------
    // MODE
    // -----------------------------------------------------

    if (
        input.mode !== undefined &&
        !parameters.mode.enum.includes(
            input.mode
        )
    ) {

        errors.push(
            "mode tidak didukung."
        );

    }


    // -----------------------------------------------------
    // ASPECT RATIO
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // DURATION
    // -----------------------------------------------------

    if (
        input.duration !== undefined
    ) {

        const value =
            Number(input.duration);

        if (
            !Number.isFinite(value) ||
            value < 6 ||
            value > 30
        ) {

            errors.push(
                "duration harus antara 6 dan 30 detik."
            );

        }

    }


    // -----------------------------------------------------
    // RESOLUTION
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // NSFW CHECKER
    // -----------------------------------------------------

    if (
        input.nsfw_checker !== undefined &&
        typeof input.nsfw_checker !== "boolean"
    ) {

        errors.push(
            "nsfw_checker harus boolean."
        );

    }


    // -----------------------------------------------------
    // RESULT
    // -----------------------------------------------------

    return {

        valid:
            errors.length === 0,

        errors

    };

}


// =========================================================
// EXPORT
// =========================================================

export {

    parameters,

    validate

};

export default parameters;
```
