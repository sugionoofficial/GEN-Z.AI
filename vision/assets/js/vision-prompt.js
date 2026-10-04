/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-prompt.js

   Fungsi:
   - Mengelola hasil final prompt
   - Membersihkan output prompt
   - Menghapus markdown/code fence yang tidak diperlukan
   - Validasi prompt
   - Menyimpan prompt ke state
   - Mengambil prompt dari state
   - Menyalin prompt ke clipboard
   - Tidak melakukan API request
   - Tidak melakukan credit
   - Tidak melakukan history
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VISION_PROMPT_CONFIG =
    Object.freeze({

        MIN_LENGTH:
            20,

        MAX_LENGTH:
            50000,

        COPY_FEEDBACK_MS:
            1800

    });


/* =========================================================
   STATE
========================================================= */

function getState() {

    if (
        !window.GENZVisionState
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    return window.GENZVisionState;

}


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(
    value
) {

    if (
        value ===
        null ||
        value ===
        undefined
    ) {

        return "";

    }


    if (
        typeof value ===
        "string"
    ) {

        return value;

    }


    if (
        typeof value ===
        "number" ||
        typeof value ===
        "boolean"
    ) {

        return String(
            value
        );

    }


    if (
        typeof value ===
        "object"
    ) {

        try {

            return JSON.stringify(
                value,
                null,
                2
            );

        } catch {

            return "";

        }

    }


    return "";

}


/* =========================================================
   NORMALIZE LINE ENDINGS
========================================================= */

function normalizeLineEndings(
    text
) {

    return safeString(
        text
    )
        .replace(
            /\r\n/g,
            "\n"
        )
        .replace(
            /\r/g,
            "\n"
        );

}


/* =========================================================
   REMOVE CODE FENCE
========================================================= */

function removeCodeFence(
    text
) {

    return normalizeLineEndings(
        text
    )
        .replace(
            /^\s*```(?:text|markdown|md|prompt)?\s*/i,
            ""
        )
        .replace(
            /\s*```\s*$/i,
            ""
        )
        .trim();

}


/* =========================================================
   REMOVE PROMPT LABEL
========================================================= */

function removePromptLabel(
    text
) {

    return safeString(
        text
    )
        .replace(
            /^\s*(?:final\s+)?prompt\s*:\s*/i,
            ""
        )
        .replace(
            /^\s*generated\s+prompt\s*:\s*/i,
            ""
        )
        .trim();

}


/* =========================================================
   REMOVE EXPLANATION WRAPPER
========================================================= */

function removeExplanationWrapper(
    text
) {

    const source =
        safeString(
            text
        ).trim();


    if (
        !source
    ) {

        return "";

    }


    /*
     * Jika model menambahkan:
     *
     * "Here is the prompt:"
     *
     * buang bagian pembukanya.
     */

    const patterns = [

        /^here(?:'s| is)\s+(?:the\s+)?(?:final\s+)?prompt\s*:\s*/i,

        /^here(?:'s| is)\s+(?:your\s+)?prompt\s*:\s*/i,

        /^final\s+prompt\s*:\s*/i,

        /^hasil\s+prompt\s*:\s*/i,

        /^prompt\s+akhir\s*:\s*/i,

        /^berikut\s+(?:adalah\s+)?(?:hasil\s+)?prompt\s*:\s*/i

    ];


    let result =
        source;


    for (
        const pattern
        of patterns
    ) {

        result =
            result.replace(
                pattern,
                ""
            );

    }


    return result.trim();

}


/* =========================================================
   REMOVE TRAILING EXPLANATION
========================================================= */

function removeTrailingExplanation(
    text
) {

    const source =
        safeString(
            text
        ).trim();


    if (
        !source
    ) {

        return "";

    }


    /*
     * Jangan terlalu agresif.
     * Prompt bisa mengandung heading atau
     * kalimat yang kebetulan memakai kata
     * "Note".
     *
     * Hanya membersihkan pola penutup yang
     * sangat jelas berasal dari model.
     */

    const patterns = [

        /\n\s*Explanation\s*:\s*[\s\S]*$/i,

        /\n\s*Notes?\s*:\s*[\s\S]*$/i,

        /\n\s*Catatan\s*:\s*[\s\S]*$/i

    ];


    let result =
        source;


    for (
        const pattern
        of patterns
    ) {

        result =
            result.replace(
                pattern,
                ""
            );

    }


    return result.trim();

}


/* =========================================================
   CLEAN PROMPT
========================================================= */

function cleanPrompt(
    text
) {

    let result =
        safeString(
            text
        );


    if (
        !result.trim()
    ) {

        return "";

    }


    result =
        normalizeLineEndings(
            result
        );


    result =
        removeCodeFence(
            result
        );


    result =
        removePromptLabel(
            result
        );


    result =
        removeExplanationWrapper(
            result
        );


    result =
        removeTrailingExplanation(
            result
        );


    /*
     * Rapikan whitespace berlebih,
     * tetapi pertahankan paragraph/line break.
     */

    result =
        result
            .replace(
                /[ \t]+/g,
                " "
            )
            .replace(
                /\n{4,}/g,
                "\n\n"
            )
            .trim();


    return result;

}


/* =========================================================
   VALIDATE PROMPT
========================================================= */

function validatePrompt(
    prompt
) {

    const text =
        cleanPrompt(
            prompt
        );


    const length =
        text.length;


    if (
        !text
    ) {

        return {

            valid:
                false,

            reason:
                "Prompt kosong.",

            length

        };

    }


    if (
        length <
        VISION_PROMPT_CONFIG.MIN_LENGTH
    ) {

        return {

            valid:
                false,

            reason:
                "Prompt terlalu pendek.",

            length

        };

    }


    if (
        length >
        VISION_PROMPT_CONFIG.MAX_LENGTH
    ) {

        return {

            valid:
                false,

            reason:
                "Prompt melebihi batas panjang.",

            length

        };

    }


    return {

        valid:
            true,

        reason:
            "",

        length

    };

}


/* =========================================================
   EXTRACT PROMPT FROM RESPONSE
========================================================= */

function extractPrompt(
    response
) {

    if (
        response ===
        null ||
        response ===
        undefined
    ) {

        return "";

    }


    /*
     * String langsung.
     */

    if (
        typeof response ===
        "string"
    ) {

        return cleanPrompt(
            response
        );

    }


    /*
     * Object dengan property umum.
     */

    if (
        typeof response ===
        "object"
    ) {

        const candidates = [

            response.prompt,

            response.final_prompt,

            response.finalPrompt,

            response.generated_prompt,

            response.generatedPrompt,

            response.text,

            response.content,

            response.output

        ];


        for (
            const candidate
            of candidates
        ) {

            if (
                typeof candidate ===
                    "string" &&
                candidate.trim()
                    .length > 0
            ) {

                return cleanPrompt(
                    candidate
                );

            }

        }


        /*
         * OpenAI-compatible response.
         */

        const choice =
            response
                ?.choices
                ?.find(
                    item =>
                        item &&
                        item.message
                );


        if (
            choice
        ) {

            const content =
                choice
                    ?.message
                    ?.content;


            if (
                typeof content ===
                "string"
            ) {

                return cleanPrompt(
                    content
                );

            }


            if (
                Array.isArray(
                    content
                )
            ) {

                const textParts =
                    content
                        .filter(
                            item =>
                                item &&
                                item.type ===
                                    "text"
                        )
                        .map(
                            item =>
                                item.text ||
                                ""
                        )
                        .filter(
                            Boolean
                        );


                return cleanPrompt(
                    textParts.join(
                        "\n"
                    )
                );

            }

        }

    }


    return "";

}


/* =========================================================
   STORE PROMPT
========================================================= */

function storePrompt(
    prompt
) {

    const state =
        getState();


    const cleaned =
        cleanPrompt(
            prompt
        );


    const validation =
        validatePrompt(
            cleaned
        );


    if (
        !validation.valid
    ) {

        throw new Error(
            validation.reason
        );

    }


    state.setPrompt(
        cleaned
    );


    return {

        prompt:
            cleaned,

        length:
            validation.length,

        valid:
            true

    };

}


/* =========================================================
   GET PROMPT
========================================================= */

function getPrompt() {

    const state =
        getState();


    return safeString(
        state.get(
            "prompt.text",
            ""
        )
    );

}


/* =========================================================
   GET PROMPT STATUS
========================================================= */

function getPromptStatus() {

    const state =
        getState();


    const prompt =
        getPrompt();


    return {

        prompt,

        completed:
            Boolean(
                state.get(
                    "prompt.completed",
                    false
                )
            ),

        copied:
            Boolean(
                state.get(
                    "prompt.copied",
                    false
                )
            ),

        length:
            prompt.length,

        valid:
            validatePrompt(
                prompt
            ).valid

    };

}


/* =========================================================
   MARK COPIED
========================================================= */

function markCopied(
    value = true
) {

    const state =
        getState();


    state.set(
        "prompt.copied",
        Boolean(
            value
        )
    );


    return Boolean(
        value
    );

}


/* =========================================================
   COPY PROMPT
========================================================= */

async function copyPrompt(
    prompt = null
) {

    const source =
        prompt ===
            null
            ? getPrompt()
            : cleanPrompt(
                prompt
            );


    const validation =
        validatePrompt(
            source
        );


    if (
        !validation.valid
    ) {

        throw new Error(
            validation.reason
        );

    }


    if (
        !navigator.clipboard ||
        typeof navigator
            .clipboard.writeText !==
            "function"
    ) {

        throw new Error(
            "Clipboard API tidak tersedia pada browser ini."
        );

    }


    await navigator
        .clipboard
        .writeText(
            source
        );


    markCopied(
        true
    );


    return {

        success:
            true,

        prompt:
            source,

        length:
            source.length

    };

}


/* =========================================================
   RESET PROMPT
========================================================= */

function clearPrompt() {

    const state =
        getState();


    state.clearPrompt();


    return true;

}


/* =========================================================
   BUILD PROMPT CONTEXT
========================================================= */

function buildPromptContext(
    analysis,
    settings = {}
) {

    const normalized =
        window.GENZVisionAnalysis
            ?.normalizeAnalysis
            ? window.GENZVisionAnalysis
                .normalizeAnalysis(
                    analysis
                )
            : analysis;


    return {

        analysis:
            normalized,

        settings: {

            detail:
                settings.detail ||
                "ultra",

            purpose:
                settings.purpose ||
                "image-generation",

            instruction:
                safeString(
                    settings.instruction
                )

        }

    };

}


/* =========================================================
   PROMPT QUALITY CHECK
========================================================= */

function inspectPromptQuality(
    prompt
) {

    const text =
        cleanPrompt(
            prompt
        );


    const checks = {

        hasContent:
            text.length > 0,

        sufficientLength:
            text.length >=
                VISION_PROMPT_CONFIG.MIN_LENGTH,

        notTooLong:
            text.length <=
                VISION_PROMPT_CONFIG.MAX_LENGTH,

        hasSubject:
            /\b(subject|person|woman|man|girl|boy|product|model|object|scene)\b/i
                .test(
                    text
                ),

        hasVisualDescription:
            /\b(camera|lighting|composition|background|foreground|detail|style|visual|photorealistic|cinematic)\b/i
                .test(
                    text
                )

    };


    const passed =
        Object.values(
            checks
        )
            .filter(
                Boolean
            )
            .length;


    const total =
        Object.keys(
            checks
        ).length;


    return {

        valid:
            checks.hasContent &&
            checks.sufficientLength &&
            checks.notTooLong,

        score:
            Math.round(
                (
                    passed /
                    total
                ) * 100
            ),

        checks

    };

}


/* =========================================================
   GET PROMPT PREVIEW
========================================================= */

function getPromptPreview(
    prompt,
    maxLength = 240
) {

    const text =
        cleanPrompt(
            prompt
        );


    if (
        text.length <=
        maxLength
    ) {

        return text;

    }


    return (
        text.slice(
            0,
            maxLength
        ).trim() +
        "..."
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionPrompt =
    Object.freeze({

        CONFIG:
            VISION_PROMPT_CONFIG,

        cleanPrompt,

        validatePrompt,

        extractPrompt,

        storePrompt,

        getPrompt,

        getPromptStatus,

        markCopied,

        copyPrompt,

        clearPrompt,

        buildPromptContext,

        inspectPromptQuality,

        getPromptPreview

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionPrompt =
    GENZVisionPrompt;
