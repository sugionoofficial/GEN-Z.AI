/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-response.js

   Fungsi:
   - Sanitasi debug response
   - Extract text dari berbagai response OpenKey
   - Membersihkan generated prompt
   - Parse JSON analysis
========================================================= */


/* =========================================================
   SANITIZE RESPONSE
========================================================= */

function sanitizeResponseForDebug(
    response
) {

    if (
        response === null ||
        response === undefined
    ) {

        return response;

    }


    try {

        const cloned =
            JSON.parse(
                JSON.stringify(
                    response
                )
            );


        const sensitiveKeys = [

            "api_key",

            "apiKey",

            "authorization",

            "Authorization",

            "token",

            "access_token",

            "refresh_token"

        ];


        function redact(
            value,
            depth = 0
        ) {

            if (
                depth > 8
            ) {

                return "[MAX_DEPTH]";

            }


            if (
                Array.isArray(
                    value
                )
            ) {

                return value.map(
                    item =>
                        redact(
                            item,
                            depth + 1
                        )
                );

            }


            if (
                value &&
                typeof value ===
                    "object"
            ) {

                const result = {};


                Object.entries(
                    value
                )
                    .forEach(
                        (
                            [
                                key,
                                item
                            ]
                        ) => {

                            if (
                                sensitiveKeys.includes(
                                    key
                                )
                            ) {

                                result[key] =
                                    "[REDACTED]";

                            }
                            else {

                                result[key] =
                                    redact(
                                        item,
                                        depth + 1
                                    );

                            }

                        }
                    );


                return result;

            }


            return value;

        }


        return redact(
            cloned
        );

    }
    catch {

        return {

            type:
                typeof response,

            value:
                String(
                    response
                )

        };

    }

}


/* =========================================================
   EXTRACT TEXT PART
========================================================= */

function extractTextPart(
    value,
    depth = 0
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    if (
        depth > 12
    ) {

        return "";

    }


    if (
        typeof value ===
        "string"
    ) {

        return value.trim();

    }


    if (
        Array.isArray(
            value
        )
    ) {

        const parts = [];


        for (
            const item of value
        ) {

            const part =
                extractTextPart(
                    item,
                    depth + 1
                );


            if (
                part
            ) {

                parts.push(
                    part
                );

            }

        }


        return parts
            .join("")
            .trim();

    }


    if (
        typeof value !==
        "object"
    ) {

        return "";

    }


    const directTextKeys = [

        "text",

        "output_text",

        "generated_text",

        "generatedText"

    ];


    for (
        const key of directTextKeys
    ) {

        if (
            typeof value[key] ===
            "string"
        ) {

            const text =
                value[key].trim();


            if (
                text
            ) {

                return text;

            }

        }

    }


    const nestedKeys = [

        "content",

        "message",

        "choices",

        "data",

        "result",

        "response",

        "output",

        "completion",

        "result_data",

        "resultData",

        "parts"

    ];


    for (
        const key of nestedKeys
    ) {

        if (
            value[key] ===
            undefined
        ) {

            continue;

        }


        const nested =
            extractTextPart(
                value[key],
                depth + 1
            );


        if (
            nested
        ) {

            return nested;

        }

    }


    return "";

}


/* =========================================================
   EXTRACT ASSISTANT TEXT
========================================================= */

function extractAssistantText(
    response
) {

    if (
        response === null ||
        response === undefined
    ) {

        return "";

    }


    if (
        typeof response ===
        "string"
    ) {

        return response.trim();

    }


    const candidates = [

        response?.content,

        response?.message,

        response?.choices,

        response?.output_text,

        response?.text,

        response?.data,

        response?.result,

        response?.response,

        response?.output

    ];


    for (
        const candidate of candidates
    ) {

        const text =
            extractTextPart(
                candidate
            );


        if (
            text
        ) {

            return text;

        }

    }


    return extractTextPart(
        response
    );

}


/* =========================================================
   CLEAN GENERATED PROMPT
========================================================= */

function cleanGeneratedPrompt(
    text
) {

    let result =
        String(
            text ||
            ""
        )
            .trim();


    if (
        !result
    ) {

        return "";

    }


    result =
        result
            .replace(
                /^```(?:text|markdown|md|prompt)?\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();


    result =
        result
            .replace(
                /^(?:final\s+)?prompt\s*:\s*/i,
                ""
            )
            .replace(
                /^generated\s+prompt\s*:\s*/i,
                ""
            )
            .trim();


    return result;

}


/* =========================================================
   PARSE JSON
========================================================= */

function parseJSON(
    text
) {

    if (
        typeof text !==
        "string"
    ) {

        if (
            text &&
            typeof text ===
                "object"
        ) {

            return text;

        }


        throw window.GENZVisionCore.createAPIError(

            "Response analysis bukan JSON yang valid.",

            {

                code:
                    "INVALID_ANALYSIS_JSON"

            }

        );

    }


    const normalized =
        text
            .trim()
            .replace(
                /^```json\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();


    try {

        return JSON.parse(
            normalized
        );

    }
    catch {

        const firstBrace =
            normalized.indexOf(
                "{"
            );


        const lastBrace =
            normalized.lastIndexOf(
                "}"
            );


        if (
            firstBrace !== -1 &&
            lastBrace > firstBrace
        ) {

            const candidate =
                normalized.slice(
                    firstBrace,
                    lastBrace + 1
                );


            try {

                return JSON.parse(
                    candidate
                );

            }
            catch {

                /* lanjut */

            }

        }


        throw window.GENZVisionCore.createAPIError(

            "Hasil visual analysis tidak dapat diparse sebagai JSON.",

            {

                code:
                    "INVALID_ANALYSIS_JSON",

                data:
                    text

            }

        );

    }

}


/* =========================================================
   GLOBAL MODULE
========================================================= */

window.GENZVisionResponse =
    Object.freeze({

        sanitizeResponseForDebug,

        extractTextPart,

        extractAssistantText,

        cleanGeneratedPrompt,

        parseJSON

    });
