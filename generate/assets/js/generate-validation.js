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
   - Validasi array minItems / maxItems
   - Validasi parameter berdasarkan currentModel
   - Menjaga validasi tetap sinkron dengan parameters.js

   SOURCE OF TRUTH:
   - currentModel.parameters
   - model config dari /api/model-config

   INTERNAL:
   - task_id BUKAN parameter Generate
   - task_id tidak divalidasi sebagai input user
   - task_id hanya digunakan untuk query task backend

   Tidak bertanggung jawab:
   - Query Supabase
   - API request
   - Provider
   - Credit calculation
   - Render UI
========================================================= */

import {
    getCurrentModel
} from "./generate-state.js";


/* =========================================================
   INTERNAL PARAMETERS
========================================================= */

const INTERNAL_PARAMETERS =
    new Set([
        "task_id"
    ]);


/* =========================================================
   LOCAL HELPERS
========================================================= */

function normalizeArray(
    value
) {

    if (Array.isArray(value)) {

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
         * JSON array.
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
                    Array.isArray(
                        parsed
                    )
                ) {

                    return normalizeArray(
                        parsed
                    );
                }

            } catch {
                /* fallback */
            }
        }


        /*
         * PostgreSQL array.
         *
         * {"2:3","9:16"}
         */
        if (
            text.startsWith("{") &&
            text.endsWith("}")
        ) {

            const content =
                text
                    .slice(
                        1,
                        -1
                    )
                    .trim();


            if (!content) {

                return [];
            }


            return content
                .split(",")
                .map(
                    item =>
                        item
                            .trim()
                            .replace(
                                /^"(.*)"$/,
                                "$1"
                            )
                )
                .filter(
                    Boolean
                );
        }


        /*
         * CSV.
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
     * Object values.
     */
    if (
        typeof value === "object"
    ) {

        return Object.values(
            value
        )
            .filter(
                item =>
                    item !== null &&
                    item !== undefined
            );
    }


    return [
        value
    ];
}


/* =========================================================
   NUMBER
========================================================= */

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
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : fallback;
}


/* =========================================================
   EMPTY
========================================================= */

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
   PARAMETER NAME
========================================================= */

function getParameterName(
    definition
) {

    return String(
        definition?.name ||
        definition?.key ||
        definition?.parameter ||
        definition?.id ||
        ""
    ).trim();
}


/* =========================================================
   MODEL PARAMETERS
   ---------------------------------------------------------
   SOURCE OF TRUTH:
   currentModel.parameters

   Tidak mengambil parameter dari
   generate-form.js.
========================================================= */

function getModelParameters(
    model = getCurrentModel()
) {

    if (!model) {

        return [];
    }


    const parameters =
        model.parameters;


    /*
     * Array:
     *
     * [
     *   {
     *      name: "prompt",
     *      type: "text"
     *   }
     * ]
     */
    if (
        Array.isArray(
            parameters
        )
    ) {

        return parameters.filter(
            definition =>
                !INTERNAL_PARAMETERS.has(
                    getParameterName(
                        definition
                    )
                )
        );
    }


    /*
     * Object:
     *
     * {
     *    prompt: {
     *       type: "text"
     *    }
     * }
     */
    if (
        parameters &&
        typeof parameters ===
            "object"
    ) {

        /*
         * Wrapper:
         *
         * {
         *     parameters: {
         *         ...
         *     }
         * }
         */
        if (
            parameters.parameters &&
            typeof parameters.parameters ===
                "object"
        ) {

            return getModelParameters({
                ...model,

                parameters:
                    parameters.parameters
            });
        }


        return Object.entries(
            parameters
        )
            .map(
                ([key, definition]) => {

                    if (
                        definition &&
                        typeof definition ===
                            "object"
                    ) {

                        return {
                            ...definition,

                            key,

                            name:
                                definition.name ||
                                key
                        };
                    }


                    return {
                        key,

                        name:
                            key,

                        type:
                            typeof definition
                    };
                }
            )
            .filter(
                definition =>
                    !INTERNAL_PARAMETERS.has(
                        getParameterName(
                            definition
                        )
                    )
            );
    }


    return [];
}


/* =========================================================
   GET PARAMETER DEFINITION
   ---------------------------------------------------------
   Pengganti:
   parameterDefinition()

   Tidak lagi bergantung pada generate-form.js.
========================================================= */

function getParameterDefinition(
    name,
    model = getCurrentModel()
) {

    const normalizedName =
        String(
            name || ""
        ).trim();


    if (!normalizedName) {

        return null;
    }


    if (
        INTERNAL_PARAMETERS.has(
            normalizedName
        )
    ) {

        return null;
    }


    const definitions =
        getModelParameters(
            model
        );


    return (
        definitions.find(
            definition =>
                getParameterName(
                    definition
                ) ===
                normalizedName
        ) ||
        null
    );
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


    if (
        type === "array"
    ) {

        return "array";
    }


    return "text";
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
            definition?.required ??
            definition?.is_required ??
            ""
        )
            .trim()
            .toLowerCase() ===
            "true"
    );
}


/* =========================================================
   LABEL
========================================================= */

function getLabel(
    definition
) {

    return (
        definition?.label ||
        definition?.title ||
        definition?.display_name ||
        definition?.displayName ||
        getParameterName(
            definition
        )
    );
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
                            option.name ??
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
    )
        .map(
            value =>
                String(
                    value
                )
        )
        .filter(
            Boolean
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

        errors.push(
            `${getLabel(
                definition
            )} wajib diisi.`
        );
    }
}


/* =========================================================
   VALIDATE STRING LENGTH
========================================================= */

function validateStringLength(
    definition,
    value,
    errors
) {

    if (
        isEmpty(
            value
        )
    ) {

        return;
    }


    if (
        typeof value !==
            "string"
    ) {

        return;
    }


    const label =
        getLabel(
            definition
        );


    const minLength =
        toFiniteNumber(
            definition?.minLength ??
            definition?.min_length,
            null
        );


    const maxLength =
        toFiniteNumber(
            definition?.maxLength ??
            definition?.max_length,
            null
        );


    if (
        minLength !== null &&
        value.length < minLength
    ) {

        errors.push(
            `${label} minimal ${minLength} karakter.`
        );
    }


    if (
        maxLength !== null &&
        value.length > maxLength
    ) {

        errors.push(
            `${label} maksimal ${maxLength} karakter.`
        );
    }
}


/* =========================================================
   VALIDATE ARRAY
========================================================= */

function validateArray(
    definition,
    value,
    errors
) {

    const type =
        getParameterType(
            definition
        );


    if (
        type !== "array"
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


    const items =
        normalizeArray(
            value
        );


    const label =
        getLabel(
            definition
        );


    const minItems =
        toFiniteNumber(
            definition?.minItems ??
            definition?.min_items,
            null
        );


    const maxItems =
        toFiniteNumber(
            definition?.maxItems ??
            definition?.max_items,
            null
        );


    if (
        minItems !== null &&
        items.length < minItems
    ) {

        errors.push(
            `${label} minimal ${minItems} item.`
        );
    }


    if (
        maxItems !== null &&
        items.length > maxItems
    ) {

        errors.push(
            `${label} maksimal ${maxItems} item.`
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


    /*
     * Jangan membuat pilihan sendiri.
     *
     * Kalau model tidak menyediakan
     * options, validasi pilihan dilewati.
     */
    if (
        options.length === 0
    ) {

        return;
    }


    const valid =
        options.some(
            option =>
                String(
                    option
                ) ===
                String(
                    value
                )
        );


    if (!valid) {

        errors.push(
            `${getLabel(
                definition
            )} memiliki pilihan yang tidak tersedia.`
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
        Number(
            value
        );


    const label =
        getLabel(
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
            definition?.min ??
            definition?.minimum,
            null
        );


    const max =
        toFiniteNumber(
            definition?.max ??
            definition?.maximum,
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
     * Validasi step hanya jika model
     * memang mendefinisikannya.
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
            (
                number -
                base
            ) / step;


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
   MODEL CAPABILITIES
========================================================= */

function getSupportedRatios(
    model
) {

    if (!model) {

        return [];
    }


    return normalizeArray(
        model.supported_ratios ??
        model.supportedRatios ??
        model.config?.supported_ratios ??
        model.config?.supportedRatios
    );
}


function getSupportedResolutions(
    model
) {

    if (!model) {

        return [];
    }


    return normalizeArray(
        model.supported_resolutions ??
        model.supportedResolutions ??
        model.config?.supported_resolutions ??
        model.config?.supportedResolutions
    );
}


/* =========================================================
   DURATION LIMITS
========================================================= */

function getDurationLimits(
    model
) {

    if (!model) {

        return {
            min: null,
            max: null
        };
    }


    let min =
        toFiniteNumber(
            model.min_duration,
            null
        );


    let max =
        toFiniteNumber(
            model.max_duration,
            null
        );


    /*
     * CamelCase.
     */
    if (
        min === null
    ) {

        min =
            toFiniteNumber(
                model.minDuration,
                null
            );
    }


    if (
        max === null
    ) {

        max =
            toFiniteNumber(
                model.maxDuration,
                null
            );
    }


    /*
     * Object duration.
     */
    if (
        model.duration &&
        typeof model.duration ===
            "object"
    ) {

        if (
            min === null
        ) {

            min =
                toFiniteNumber(
                    model.duration.min,
                    null
                );
        }


        if (
            max === null
        ) {

            max =
                toFiniteNumber(
                    model.duration.max,
                    null
                );
        }
    }


    /*
     * Config wrapper.
     */
    if (
        model.config &&
        typeof model.config ===
            "object"
    ) {

        if (
            min === null
        ) {

            min =
                toFiniteNumber(
                    model.config.min_duration,
                    null
                );
        }


        if (
            max === null
        ) {

            max =
                toFiniteNumber(
                    model.config.max_duration,
                    null
                );
        }


        if (
            min === null
        ) {

            min =
                toFiniteNumber(
                    model.config.minDuration,
                    null
                );
        }


        if (
            max === null
        ) {

            max =
                toFiniteNumber(
                    model.config.maxDuration,
                    null
                );
        }
    }


    return {
        min,
        max
    };
}


/* =========================================================
   VALIDATE MODEL CAPABILITIES
========================================================= */

function validateModelCapabilities(
    parameters,
    errors
) {

    const model =
        getCurrentModel();


    if (!model) {

        return;
    }


    /*
     * Aspect ratio.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            parameters,
            "aspect_ratio"
        ) &&
        !isEmpty(
            parameters.aspect_ratio
        )
    ) {

        const supported =
            getSupportedRatios(
                model
            );


        if (
            supported.length > 0 &&
            !supported.some(
                ratio =>
                    String(
                        ratio
                    ) ===
                    String(
                        parameters.aspect_ratio
                    )
            )
        ) {

            errors.push(
                `Aspect ratio ${parameters.aspect_ratio} tidak tersedia untuk model ini.`
            );
        }
    }


    /*
     * Resolution.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            parameters,
            "resolution"
        ) &&
        !isEmpty(
            parameters.resolution
        )
    ) {

        const supported =
            getSupportedResolutions(
                model
            );


        if (
            supported.length > 0 &&
            !supported.some(
                resolution =>
                    String(
                        resolution
                    ) ===
                    String(
                        parameters.resolution
                    )
            )
        ) {

            errors.push(
                `Resolution ${parameters.resolution} tidak tersedia untuk model ini.`
            );
        }
    }


    /*
     * Duration.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            parameters,
            "duration"
        ) &&
        !isEmpty(
            parameters.duration
        )
    ) {

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


        const limits =
            getDurationLimits(
                model
            );


        if (
            limits.min !== null &&
            duration < limits.min
        ) {

            errors.push(
                `Durasi minimum adalah ${limits.min} detik.`
            );
        }


        if (
            limits.max !== null &&
            duration > limits.max
        ) {

            errors.push(
                `Durasi maksimum adalah ${limits.max} detik.`
            );
        }
    }
}


/* =========================================================
   VALIDATE DEFINITIONS
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
             * task_id bukan input Generate.
             */
            if (
                INTERNAL_PARAMETERS.has(
                    name
                )
            ) {

                return;
            }


            const exists =
                Object.prototype.hasOwnProperty.call(
                    parameters,
                    name
                );


            if (!exists) {

                validateRequired(
                    definition,
                    undefined,
                    errors
                );

                return;
            }


            const value =
                parameters[
                    name
                ];


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


            validateStringLength(
                definition,
                value,
                errors
            );


            validateArray(
                definition,
                value,
                errors
            );
        }
    );
}


/* =========================================================
   REMOVE INTERNAL PARAMETERS
========================================================= */

function sanitizeParameters(
    parameters
) {

    if (
        !parameters ||
        typeof parameters !==
            "object" ||
        Array.isArray(
            parameters
        )
    ) {

        return {};
    }


    const sanitized =
        {};


    Object.entries(
        parameters
    ).forEach(
        ([key, value]) => {

            if (
                INTERNAL_PARAMETERS.has(
                    key
                )
            ) {

                return;
            }


            sanitized[
                key
            ] =
                value;
        }
    );


    return sanitized;
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
            "object" ||
        Array.isArray(
            parameters
        )
    ) {

        errors.push(
            "Parameter generate tidak valid."
        );

        return errors;
    }


    const sanitized =
        sanitizeParameters(
            parameters
        );


    /*
     * Validasi berdasarkan
     * model.parameters.
     */
    validateDefinitions(
        sanitized,
        errors
    );


    /*
     * Validasi capability model.
     */
    validateModelCapabilities(
        sanitized,
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

    const normalizedName =
        String(
            name || ""
        ).trim();


    if (!normalizedName) {

        return [];
    }


    /*
     * Internal parameter tidak divalidasi
     * sebagai input user.
     */
    if (
        INTERNAL_PARAMETERS.has(
            normalizedName
        )
    ) {

        return [];
    }


    const errors =
        [];


    /*
     * PENTING:
     *
     * Tidak ada lagi:
     *
     * import {
     *     parameterDefinition
     * } from "./generate-form.js";
     *
     * Definisi parameter dicari langsung
     * dari currentModel.parameters.
     */
    const definition =
        getParameterDefinition(
            normalizedName
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


    validateStringLength(
        definition,
        value,
        errors
    );


    validateArray(
        definition,
        value,
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
   PUBLIC VALIDATION API
========================================================= */

export const generateValidation =
    Object.freeze({

        validateClientParameters,

        isValidParameters,

        getFirstValidationError,

        validateParameter

    });


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default generateValidation;
