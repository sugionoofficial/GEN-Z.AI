/* =========================================================
   GEN-Z.AI
   GENERATE VALIDATION MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-validation.js

   Tanggung jawab:
   - Validasi parameter sebelum generate
   - Validasi required field
   - Validasi pilihan parameter
   - Validasi numeric min / max / step
   - Validasi aspect ratio
   - Validasi resolution
   - Validasi duration
   - Validasi kombinasi image_urls + task_id

   Sumber aturan:
   - currentModel dari /api/model-config
   - parameter definitions dari backend

   Tidak bertanggung jawab:
   - Query Supabase
   - API request
   - Provider
   - Credit deduction
   - Render UI

   Catatan:
   - Tidak bergantung pada generate-utils.js
   - Semua helper yang diperlukan tersedia lokal
========================================================= */

import {
    getCurrentModel
} from "./generate-state.js";

import {
    parameterDefinition
} from "./generate-form.js";


/* =========================================================
   LOCAL HELPERS
========================================================= */

function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value
            .filter(
                item =>
                    item !== null &&
                    item !== undefined
            )
            .map(
                item =>
                    typeof item === "string"
                        ? item.trim()
                        : item
            )
            .filter(
                item =>
                    item !== ""
            );
    }

    if (
        value === null ||
        value === undefined
    ) {

        return [];
    }

    if (
        typeof value === "string"
    ) {

        const text =
            value.trim();

        if (!text) {
            return [];
        }

        /*
         * Support JSON array.
         */
        if (
            text.startsWith("[") &&
            text.endsWith("]")
        ) {

            try {

                const parsed =
                    JSON.parse(
                        text
                    );

                if (
                    Array.isArray(parsed)
                ) {

                    return normalizeArray(
                        parsed
                    );
                }

            } catch {
                /*
                 * Bukan JSON valid.
                 * Lanjut sebagai string.
                 */
            }
        }

        /*
         * Support comma-separated values.
         */
        return text
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(
                Boolean
            );
    }

    /*
     * Support object values.
     */
    if (
        typeof value === "object"
    ) {

        return Object.values(
            value
        ).filter(
            item =>
                item !== null &&
                item !== undefined
        );
    }

    return [
        value
    ];
}


function toFiniteNumber(
    value,
    fallback = null
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;
    }

    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : fallback;
}


function isEmpty(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return true;
    }

    if (
        typeof value === "string"
    ) {

        return value.trim() === "";
    }

    if (
        Array.isArray(value)
    ) {

        return value.length === 0;
    }

    return false;
}


/* =========================================================
   MODEL PARAMETERS
========================================================= */

function getModelParameters(
    model = getCurrentModel()
) {

    if (!model) {
        return [];
    }

    const parameters =
        model.parameters;

    if (
        Array.isArray(
            parameters
        )
    ) {

        return parameters;
    }

    if (
        parameters &&
        typeof parameters ===
            "object"
    ) {

        return Object.entries(
            parameters
        ).map(
            ([key, definition]) => {

                if (
                    definition &&
                    typeof definition ===
                        "object"
                ) {

                    return {
                        key,
                        name:
                            definition.name ||
                            key,
                        ...definition
                    };
                }

                return {
                    key,
                    name: key,
                    type:
                        typeof definition
                };
            }
        );
    }

    return [];
}


/* =========================================================
   PARAMETER NAME
========================================================= */

function getParameterName(
    definition
) {

    return String(
        definition?.name ||
        definition?.key ||
        definition?.parameter ||
        ""
    ).trim();
}


/* =========================================================
   PARAMETER TYPE
========================================================= */

function getParameterType(
    definition
) {

    const type =
        String(
            definition?.type ||
            definition?.input_type ||
            definition?.inputType ||
            "text"
        )
            .trim()
            .toLowerCase();

    if (
        type === "number" ||
        type === "integer" ||
        type === "float" ||
        type === "decimal"
    ) {

        return "number";
    }

    if (
        type === "boolean" ||
        type === "bool" ||
        type === "checkbox"
    ) {

        return "checkbox";
    }

    if (
        type === "select" ||
        type === "dropdown" ||
        type === "enum"
    ) {

        return "select";
    }

    if (
        type === "radio"
    ) {

        return "radio";
    }

    return "text";
}


/* =========================================================
   OPTIONS
========================================================= */

function getOptions(
    definition
) {

    const source =
        definition?.options ??
        definition?.values ??
        definition?.choices ??
        definition?.enum ??
        [];

    if (
        Array.isArray(
            source
        )
    ) {

        return source
            .map(
                option => {

                    if (
                        option &&
                        typeof option ===
                            "object"
                    ) {

                        return String(
                            option.value ??
                            option.id ??
                            option.key ??
                            ""
                        );
                    }

                    return String(
                        option
                    );
                }
            )
            .filter(
                Boolean
            );
    }

    return normalizeArray(
        source
    );
}


/* =========================================================
   REQUIRED
========================================================= */

function getRequired(
    definition
) {

    return (
        definition?.required === true ||
        definition?.is_required === true ||
        String(
            definition?.required ||
            ""
        ).toLowerCase() ===
            "true"
    );
}


/* =========================================================
   VALIDATE REQUIRED
========================================================= */

function validateRequired(
    definition,
    value,
    errors
) {

    if (
        !getRequired(
            definition
        )
    ) {

        return;
    }

    if (
        isEmpty(
            value
        )
    ) {

        const name =
            getParameterName(
                definition
            );

        const label =
            definition?.label ||
            definition?.title ||
            name;

        errors.push(
            `${label} wajib diisi.`
        );
    }
}


/* =========================================================
   VALIDATE OPTIONS
========================================================= */

function validateOptions(
    definition,
    value,
    errors
) {

    const type =
        getParameterType(
            definition
        );

    if (
        type !== "select" &&
        type !== "radio"
    ) {

        return;
    }

    if (
        isEmpty(
            value
        )
    ) {

        return;
    }

    const options =
        getOptions(
            definition
        );

    if (
        options.length === 0
    ) {

        return;
    }

    const valid =
        options.some(
            option =>
                String(option) ===
                String(value)
        );

    if (!valid) {

        const label =
            definition?.label ||
            definition?.title ||
            getParameterName(
                definition
            );

        errors.push(
            `${label} memiliki pilihan yang tidak tersedia.`
        );
    }
}


/* =========================================================
   VALIDATE NUMBER
========================================================= */

function validateNumber(
    definition,
    value,
    errors
) {

    if (
        getParameterType(
            definition
        ) !== "number"
    ) {

        return;
    }

    if (
        isEmpty(
            value
        )
    ) {

        return;
    }

    const number =
        Number(value);

    const label =
        definition?.label ||
        definition?.title ||
        getParameterName(
            definition
        );

    if (
        !Number.isFinite(
            number
        )
    ) {

        errors.push(
            `${label} harus berupa angka.`
        );

        return;
    }

    const min =
        toFiniteNumber(
            definition?.min,
            null
        );

    const max =
        toFiniteNumber(
            definition?.max,
            null
        );

    const step =
        toFiniteNumber(
            definition?.step,
            null
        );

    if (
        min !== null &&
        number < min
    ) {

        errors.push(
            `${label} minimum adalah ${min}.`
        );
    }

    if (
        max !== null &&
        number > max
    ) {

        errors.push(
            `${label} maksimum adalah ${max}.`
        );
    }

    /*
     * Validasi step hanya jika backend
     * memang memberikan step.
     */
    if (
        step !== null &&
        step > 0
    ) {

        const base =
            min !== null
                ? min
                : 0;

        const difference =
            (number - base) /
            step;

        const nearest =
            Math.round(
                difference
            );

        const tolerance =
            0.000001;

        if (
            Math.abs(
                difference -
                nearest
            ) > tolerance
        ) {

            errors.push(
                `${label} harus menggunakan kelipatan ${step}.`
            );
        }
    }
}


/* =========================================================
   VALIDATE MODEL RATIOS
========================================================= */

function validateAspectRatio(
    parameters,
    errors
) {

    const model =
        getCurrentModel();

    if (!model) {
        return;
    }

    const value =
        parameters.aspect_ratio;

    if (
        isEmpty(
            value
        )
    ) {

        return;
    }

    const supported =
        normalizeArray(
            model.supported_ratios
        );

    if (
        supported.length === 0
    ) {

        return;
    }

    const valid =
        supported.some(
            ratio =>
                String(ratio) ===
                String(value)
        );

    if (!valid) {

        errors.push(
            `Aspect ratio ${value} tidak tersedia untuk model ini.`
        );
    }
}


/* =========================================================
   VALIDATE RESOLUTION
========================================================= */

function validateResolution(
    parameters,
    errors
) {

    const model =
        getCurrentModel();

    if (!model) {
        return;
    }

    const value =
        parameters.resolution;

    if (
        isEmpty(
            value
        )
    ) {

        return;
    }

    const supported =
        normalizeArray(
            model.supported_resolutions
        );

    if (
        supported.length === 0
    ) {

        return;
    }

    const valid =
        supported.some(
            resolution =>
                String(resolution) ===
                String(value)
        );

    if (!valid) {

        errors.push(
            `Resolution ${value} tidak tersedia untuk model ini.`
        );
    }
}


/* =========================================================
   VALIDATE DURATION
========================================================= */

function validateDuration(
    parameters,
    errors
) {

    const model =
        getCurrentModel();

    if (!model) {
        return;
    }

    if (
        isEmpty(
            parameters.duration
        )
    ) {

        return;
    }

    const duration =
        Number(
            parameters.duration
        );

    if (
        !Number.isFinite(
            duration
        )
    ) {

        errors.push(
            "Durasi harus berupa angka."
        );

        return;
    }

    const modelDuration =
        model.duration;

    if (
        !modelDuration ||
        typeof modelDuration !==
            "object"
    ) {

        return;
    }

    const min =
        toFiniteNumber(
            modelDuration.min,
            null
        );

    const max =
        toFiniteNumber(
            modelDuration.max,
            null
        );

    if (
        min !== null &&
        duration < min
    ) {

        errors.push(
            `Durasi minimum adalah ${min} detik.`
        );
    }

    if (
        max !== null &&
        duration > max
    ) {

        errors.push(
            `Durasi maksimum adalah ${max} detik.`
        );
    }
}


/* =========================================================
   VALIDATE PROMPT
========================================================= */

function validatePrompt(
    parameters,
    errors
) {

    /*
     * Prompt tetap wajib seperti perilaku
     * generator sebelumnya.
     */
    if (
        isEmpty(
            parameters.prompt
        )
    ) {

        errors.push(
            "Prompt wajib diisi."
        );
    }
}


/* =========================================================
   VALIDATE IMAGE URL / TASK ID
========================================================= */

function validateImageAndTask(
    parameters,
    errors
) {

    const imageUrls =
        parameters.image_urls;

    const taskId =
        parameters.task_id;

    const hasImages =
        Array.isArray(
            imageUrls
        )
            ? imageUrls.length > 0
            : !isEmpty(
                imageUrls
            );

    const hasTaskId =
        !isEmpty(
            taskId
        );

    if (
        hasImages &&
        hasTaskId
    ) {

        errors.push(
            "Image URL dan Task ID tidak boleh digunakan bersamaan."
        );
    }
}


/* =========================================================
   VALIDATE PARAMETERS AGAINST DEFINITIONS
========================================================= */

function validateDefinitions(
    parameters,
    errors
) {

    const definitions =
        getModelParameters();

    definitions.forEach(
        definition => {

            const name =
                getParameterName(
                    definition
                );

            if (!name) {
                return;
            }

            /*
             * Hanya validasi parameter yang memang
             * diberikan oleh form/config.
             */
            if (
                !Object.prototype
                    .hasOwnProperty.call(
                        parameters,
                        name
                    )
            ) {

                validateRequired(
                    definition,
                    undefined,
                    errors
                );

                return;
            }

            const value =
                parameters[name];

            validateRequired(
                definition,
                value,
                errors
            );

            validateOptions(
                definition,
                value,
                errors
            );

            validateNumber(
                definition,
                value,
                errors
            );
        }
    );
}


/* =========================================================
   VALIDATE UNKNOWN PARAMETERS
========================================================= */

function validateKnownSpecialFields(
    parameters,
    errors
) {

    /*
     * Parameter umum yang memang sudah menjadi
     * bagian dari generator tidak dianggap unknown.
     */
    const known =
        new Set([
            "prompt",
            "image_urls",
            "image_url",
            "video_url",
            "audio_url",
            "task_id",
            "aspect_ratio",
            "resolution",
            "duration",
            "mode",
            "nsfw_checker"
        ]);

    /*
     * Jangan menolak parameter tambahan hanya karena
     * frontend belum mengenal namanya.
     *
     * Backend/model adapter tetap menjadi validator
     * terakhir.
     */
    void known;
    void parameters;
    void errors;
}


/* =========================================================
   MAIN VALIDATION
========================================================= */

export function validateClientParameters(
    parameters = {}
) {

    const errors =
        [];

    const model =
        getCurrentModel();

    if (!model) {

        errors.push(
            "Model belum siap digunakan."
        );

        return errors;
    }

    if (
        !parameters ||
        typeof parameters !==
            "object"
    ) {

        errors.push(
            "Parameter generate tidak valid."
        );

        return errors;
    }

    validatePrompt(
        parameters,
        errors
    );

    validateImageAndTask(
        parameters,
        errors
    );

    validateAspectRatio(
        parameters,
        errors
    );

    validateResolution(
        parameters,
        errors
    );

    validateDuration(
        parameters,
        errors
    );

    validateDefinitions(
        parameters,
        errors
    );

    validateKnownSpecialFields(
        parameters,
        errors
    );

    return [
        ...new Set(
            errors.filter(
                Boolean
            )
        )
    ];
}


/* =========================================================
   BOOLEAN VALIDATION
========================================================= */

export function isValidParameters(
    parameters = {}
) {

    return (
        validateClientParameters(
            parameters
        ).length === 0
    );
}


/* =========================================================
   FIRST ERROR
========================================================= */

export function getFirstValidationError(
    parameters = {}
) {

    const errors =
        validateClientParameters(
            parameters
        );

    return (
        errors[0] ||
        null
    );
}


/* =========================================================
   VALIDATE SINGLE PARAMETER
========================================================= */

export function validateParameter(
    name,
    value
) {

    const errors =
        [];

    const definition =
        parameterDefinition(
            name
        );

    if (!definition) {

        return errors;
    }

    validateRequired(
        definition,
        value,
        errors
    );

    validateOptions(
        definition,
        value,
        errors
    );

    validateNumber(
        definition,
        value,
        errors
    );

    return [
        ...new Set(
            errors
        )
    ];
}


/* =========================================================
   EXPORT VALIDATION API
========================================================= */

export const generateValidation =
    Object.freeze({

        validateClientParameters,

        isValidParameters,

        getFirstValidationError,

        validateParameter

    });


export default generateValidation;
