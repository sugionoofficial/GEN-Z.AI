/* =========================================================
   GEN-Z.AI
   GENERATE FORM CORE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-core.js

   Tanggung jawab:
   - Constants
   - DOM container
   - Resolve model
   - Parameter definition
   - Parameter normalization
   - Parameter label / description
   - Internal / server-controlled filtering
   - Parameter ordering
   - Default value
   - Generic array normalization
   - Parameter value normalization
   - Field ID
========================================================= */

"use strict";

import {
    getGenerateElements,
    getCurrentModel
} from "./generate-state.js";


/* =========================================================
   CONSTANTS
========================================================= */

export const INTERNAL_PARAMETERS =
    new Set([
        "task_id",
        "index"
    ]);


export const SERVER_CONTROLLED_PARAMETERS =
    new Set([
        "nsfw_checker",
        "webhook_url",
        "webhook"
    ]);


export const PARAMETER_ORDER = [
    "image_urls",
    "image_url",
    "audio_url",
    "prompt",
    "mode",
    "aspect_ratio",
    "duration",
    "resolution"
];


export const FULL_WIDTH_PARAMETERS =
    new Set([
        "image_urls",
        "image_url",
        "audio_url",
        "prompt",
        "negative_prompt",
        "description"
    ]);


/* =========================================================
   DOM
========================================================= */

export function getContainer() {

    const domContainer =
        document.getElementById(
            "dynamicFields"
        );


    if (
        domContainer
    ) {

        return domContainer;

    }


    const elements =
        getGenerateElements();


    return (
        elements?.dynamicFields ||
        null
    );

}


/* =========================================================
   MODEL
========================================================= */

export function resolveModel(
    modelArgument = null
) {

    if (
        modelArgument &&
        typeof modelArgument ===
        "object"
    ) {

        return modelArgument;

    }


    const currentModel =
        getCurrentModel();


    if (
        currentModel &&
        typeof currentModel ===
        "object"
    ) {

        return currentModel;

    }


    return null;

}


/* =========================================================
   PARAMETER SOURCE
========================================================= */

export function getParameterDefinitions(
    modelArgument = null
) {

    const model =
        resolveModel(
            modelArgument
        );


    if (
        !model
    ) {

        console.warn(
            "[GEN-Z.AI][Generate Form] Model tidak tersedia."
        );


        return {};

    }


    const candidates = [

        model.parameters,

        model.parameter_schema,

        model.parameterSchema,

        model.input_schema,

        model.inputSchema,

        model.schema,

        model.config?.parameters,

        model.config?.parameter_schema,

        model.config?.parameterSchema,

        model.config?.input_schema,

        model.config?.inputSchema,

        model.config?.schema,

        model.repository?.parameters,

        model.repository?.parameter_schema,

        model.repository?.parameterSchema,

        model.repository?.input_schema,

        model.repository?.inputSchema,

        model.repository?.schema,

        model.model?.parameters,

        model.model?.parameter_schema,

        model.model?.parameterSchema,

        model.model?.input_schema,

        model.model?.inputSchema,

        model.model?.schema

    ];


    for (
        const candidate
        of candidates
    ) {

        const normalized =
            normalizeParameterDefinitions(
                candidate
            );


        if (
            Object.keys(
                normalized
            ).length > 0
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    model,
                    "supported_resolutions"
                )
            ) {

                const activeResolutions =
                    Array.isArray(
                        model.supported_resolutions
                    )
                        ? model.supported_resolutions
                            .map(
                                value =>
                                    String(
                                        value
                                    ).trim()
                            )
                            .filter(
                                Boolean
                            )
                        : [];


                if (
                    activeResolutions.length > 0 &&
                    normalized.resolution &&
                    typeof normalized.resolution ===
                        "object"
                ) {

                    normalized.resolution = {

                        ...normalized.resolution,

                        enum:
                            activeResolutions

                    };

                }


                console.debug(
                    "[GEN-Z.AI][Generate Form] Resolution source:",
                    {

                        model:
                            model.model_id ||
                            model.id ||
                            "-",

                        supported_resolutions:
                            activeResolutions,

                        parameter_resolution:
                            normalized.resolution?.enum ||
                            [],

                        resolution_source:
                            activeResolutions.length > 0
                                ? "model.supported_resolutions"
                                : "model.parameters"

                    }
                );

            }


            console.debug(
                "[GEN-Z.AI][Generate Form] Parameter source ditemukan:",
                {
                    model:
                        model.model_id ||
                        model.id ||
                        "-",

                    keys:
                        Object.keys(
                            normalized
                        ),

                    resolution:
                        normalized.resolution?.enum ||
                        []

                }
            );


            return normalized;

        }

    }


    const nestedCandidates = [

        model.data?.parameters,

        model.data?.parameter_schema,

        model.data?.parameterSchema,

        model.data?.input_schema,

        model.data?.inputSchema,

        model.data?.schema

    ];


    for (
        const candidate
        of nestedCandidates
    ) {

        const normalized =
            normalizeParameterDefinitions(
                candidate
            );


        if (
            Object.keys(
                normalized
            ).length > 0
        ) {

            return normalized;

        }

    }


    console.warn(
        "[GEN-Z.AI][Generate Form] Parameter model tidak ditemukan:",
        {
            modelId:
                model.model_id ||
                model.id ||
                "-",

            modelKeys:
                Object.keys(
                    model
                )
        }
    );


    return {};

}


/* =========================================================
   NORMALIZE PARAMETERS
========================================================= */

export function normalizeParameterDefinitions(
    value
) {

    if (
        !value
    ) {

        return {};

    }


    if (
        typeof value ===
        "string"
    ) {

        const text =
            value.trim();


        if (
            !text
        ) {

            return {};

        }


        try {

            const parsed =
                JSON.parse(
                    text
                );


            return normalizeParameterDefinitions(
                parsed
            );

        } catch {

            return {};

        }

    }


    if (
        Array.isArray(value)
    ) {

        const result =
            {};


        value.forEach(
            item => {

                if (
                    !item ||
                    typeof item !==
                    "object"
                ) {

                    return;

                }


                const name =
                    String(
                        item.name ??
                        item.key ??
                        item.id ??
                        item.parameter ??
                        ""
                    ).trim();


                if (
                    !name
                ) {

                    return;

                }


                const definition = {
                    ...item
                };


                delete definition.name;
                delete definition.key;
                delete definition.id;
                delete definition.parameter;


                result[name] =
                    definition;

            }
        );


        return result;

    }


    if (
        typeof value !==
        "object"
    ) {

        return {};

    }


    if (
        value.parameters
    ) {

        const nested =
            normalizeParameterDefinitions(
                value.parameters
            );


        if (
            Object.keys(
                nested
            ).length
        ) {

            return nested;

        }

    }


    if (
        value.properties &&
        typeof value.properties ===
        "object"
    ) {

        const properties =
            normalizeParameterDefinitions(
                value.properties
            );


        if (
            Object.keys(
                properties
            ).length
        ) {

            return properties;

        }

    }


    if (
        value.input_schema
    ) {

        const nested =
            normalizeParameterDefinitions(
                value.input_schema
            );


        if (
            Object.keys(
                nested
            ).length
        ) {

            return nested;

        }

    }


    if (
        value.schema
    ) {

        const nested =
            normalizeParameterDefinitions(
                value.schema
            );


        if (
            Object.keys(
                nested
            ).length
        ) {

            return nested;

        }

    }


    const result =
        {};


    Object.entries(
        value
    ).forEach(
        (
            [
                key,
                definition
            ]
        ) => {

            if (
                !key ||
                definition ===
                null ||
                definition ===
                undefined
            ) {

                return;

            }


            if (
                key ===
                    "required" ||
                key ===
                    "title" ||
                key ===
                    "description" ||
                key ===
                    "type" ||
                key ===
                    "additionalProperties"
            ) {

                return;

            }


            if (
                typeof definition ===
                "object"
            ) {

                result[key] =
                    definition;

                return;

            }


            if (
                typeof definition ===
                    "string" ||
                typeof definition ===
                    "number" ||
                typeof definition ===
                    "boolean"
            ) {

                result[key] = {

                    type:
                        typeof definition,

                    default:
                        definition

                };

            }

        }
    );


    return result;

}


/* =========================================================
   LABEL
========================================================= */

export function getParameterLabel(
    name,
    definition
) {

    if (
        typeof definition?.label ===
        "string" &&
        definition.label.trim()
    ) {

        return definition.label.trim();

    }


    if (
        typeof definition?.title ===
        "string" &&
        definition.title.trim()
    ) {

        return definition.title.trim();

    }


    const labels = {

        image_urls:
            "Gambar Referensi",

        image_url:
            "Gambar Referensi",

        audio_url:
            "Audio",

        prompt:
            "Prompt",

        mode:
            "Mode",

        aspect_ratio:
            "Aspect Ratio",

        duration:
            "Duration",

        resolution:
            "Resolution"

    };


    if (
        labels[name]
    ) {

        return labels[name];

    }


    return String(
        name
    )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

}


/* =========================================================
   DESCRIPTION
========================================================= */

export function getParameterDescription(
    definition
) {

    return String(
        definition?.description ||
        ""
    ).trim();

}


/* =========================================================
   INTERNAL / SERVER CONTROLLED
========================================================= */

export function isInternalParameter(
    name
) {

    return INTERNAL_PARAMETERS.has(
        String(
            name ||
            ""
        ).trim()
    );

}


export function isServerControlledParameter(
    name
) {

    return SERVER_CONTROLLED_PARAMETERS.has(
        String(
            name ||
            ""
        ).trim()
            .toLowerCase()
    );

}


export function isClientForbiddenParameter(
    name
) {

    return (
        isInternalParameter(
            name
        ) ||
        isServerControlledParameter(
            name
        )
    );

}


/* =========================================================
   RENDERABLE
========================================================= */

export function isRenderableParameter(
    name,
    definition
) {

    if (
        !name
    ) {

        return false;

    }


    if (
        isClientForbiddenParameter(
            name
        )
    ) {

        return false;

    }


    if (
        !definition ||
        typeof definition !==
        "object"
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   ORDER
========================================================= */

export function getOrderedParameterNames(
    definitions
) {

    const names =
        Object.keys(
            definitions ||
            {}
        )
        .filter(
            name =>
                isRenderableParameter(
                    name,
                    definitions[name]
                )
        );


    const ordered =
        [];


    PARAMETER_ORDER.forEach(
        preferredName => {

            if (
                names.includes(
                    preferredName
                )
            ) {

                ordered.push(
                    preferredName
                );

            }

        }
    );


    names.forEach(
        name => {

            if (
                !ordered.includes(
                    name
                )
            ) {

                ordered.push(
                    name
                );

            }

        }
    );


    return ordered;

}


/* =========================================================
   DEFAULT
========================================================= */

export function getDefaultValue(
    definition
) {

    if (
        !definition ||
        typeof definition !==
        "object"
    ) {

        return undefined;

    }


    return (
        definition.default ??
        definition.default_value ??
        definition.value
    );

}


/* =========================================================
   ARRAY
========================================================= */

export function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value
            .map(
                item =>
                    String(
                        item ??
                        ""
                    ).trim()
            )
            .filter(Boolean);

    }


    if (
        value ===
            null ||
        value ===
            undefined
    ) {

        return [];

    }


    if (
        typeof value !==
        "string"
    ) {

        return [];

    }


    const text =
        value.trim();


    if (
        !text
    ) {

        return [];

    }


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


    if (
        text.startsWith("{") &&
        text.endsWith("}")
    ) {

        return text
            .slice(
                1,
                -1
            )
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
            .filter(Boolean);

    }


    return text
        .split(",")
        .map(
            item =>
                item.trim()
        )
        .filter(Boolean);

}


/* =========================================================
   PARAMETER VALUE NORMALIZATION
========================================================= */

export function normalizeParameterValue(
    value,
    definition = {}
) {

    if (
        value ===
            undefined ||
        value ===
            null
    ) {

        return value;

    }


    const type =
        String(
            definition?.type ||
            ""
        )
            .trim()
            .toLowerCase();


    /* -----------------------------------------------------
       BOOLEAN
    ----------------------------------------------------- */

    if (
        type ===
        "boolean"
    ) {

        if (
            typeof value ===
            "boolean"
        ) {

            return value;

        }


        if (
            value ===
                "true" ||
            value ===
                "1"
        ) {

            return true;

        }


        if (
            value ===
                "false" ||
            value ===
                "0"
        ) {

            return false;

        }

    }


    /* -----------------------------------------------------
       NUMBER / INTEGER
    ----------------------------------------------------- */

    if (
        type ===
            "number" ||
        type ===
            "integer"
    ) {

        if (
            value ===
            ""
        ) {

            return value;

        }


        const number =
            Number(
                value
            );


        if (
            Number.isFinite(
                number
            )
        ) {

            return number;

        }

    }


    /* -----------------------------------------------------
       ARRAY
    ----------------------------------------------------- */

    if (
        Array.isArray(
            value
        )
    ) {

        return value
            .filter(
                item =>
                    item !==
                        undefined &&
                    item !==
                        null &&
                    String(
                        item
                    ).trim() !==
                        ""
            );

    }


    /* -----------------------------------------------------
       STRING
    ----------------------------------------------------- */

    if (
        typeof value ===
        "string"
    ) {

        return value.trim();

    }


    return value;

}


/* =========================================================
   FIELD ID
========================================================= */

export function createFieldId(
    name
) {

    return (
        "generate-field-" +
        String(
            name
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
            )
    );

}
