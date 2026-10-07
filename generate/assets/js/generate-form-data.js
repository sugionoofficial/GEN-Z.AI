"use strict";

/* =========================================================
   GEN-Z.AI
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-data.js

   Fungsi:
   - Membaca parameter form
   - Membaca nilai field
   - Resolve image upload / URL
   - Resolve audio upload / URL
   - Normalisasi parameter
   - Membentuk data form
   - Tidak mengubah DOM
   - Tidak merender field
========================================================= */

import {
    getParameterDefinitions,
    getOrderedParameterNames,
    isClientForbiddenParameter,
    getDefaultValue,
    normalizeParameterValue
} from "./generate-form-core.js";

import {
    findField,
    readFieldValue
} from "./generate-form-reader.js";

import {
    resolveImageParameterValue,
    resolveAudioParameterValue
} from "./generate-form-media-reader.js";


/* =========================================================
   GET FORM PARAMETERS
========================================================= */

export function getFormParameters(
    modelArgument = null
) {

    const definitions =
        getParameterDefinitions(
            modelArgument
        );

    if (
        !definitions ||
        typeof definitions !== "object"
    ) {
        return {};
    }


    const parameterNames =
        getOrderedParameterNames(
            definitions
        );

    const parameters = {};


    for (
        const name of parameterNames
    ) {

        if (!name) {
            continue;
        }


        if (
            isClientForbiddenParameter(
                name
            )
        ) {
            continue;
        }


        const definition =
            definitions[name];


        if (!definition) {
            continue;
        }


        const field =
            findField(name);


        /*
         * -------------------------------------------------
         * IMAGE PARAMETER
         * -------------------------------------------------
         */

        const type =
            String(
                definition.type || ""
            )
                .trim()
                .toLowerCase();


        if (
            type === "image" ||
            type === "image_url" ||
            type === "image_urls" ||
            name === "image_url" ||
            name === "image_urls"
        ) {

            if (!field) {

                const defaultValue =
                    getDefaultValue(
                        definition
                    );

                if (
                    defaultValue !== undefined &&
                    defaultValue !== null &&
                    defaultValue !== ""
                ) {

                    parameters[name] =
                        normalizeParameterValue(
                            defaultValue,
                            definition
                        );
                }

                continue;
            }


            const imageInput =
                field.querySelector(
                    ".generate-image-input"
                );


            if (imageInput) {

                const value =
                    await resolveImageParameterValue(
                        imageInput,
                        definition
                    );


                parameters[name] =
                    normalizeParameterValue(
                        value,
                        definition
                    );

                continue;
            }
        }


        /*
         * -------------------------------------------------
         * AUDIO PARAMETER
         * -------------------------------------------------
         */

        if (
            type === "audio" ||
            type === "audio_url" ||
            name === "audio_url"
        ) {

            if (!field) {

                const defaultValue =
                    getDefaultValue(
                        definition
                    );

                if (
                    defaultValue !== undefined &&
                    defaultValue !== null &&
                    defaultValue !== ""
                ) {

                    parameters[name] =
                        normalizeParameterValue(
                            defaultValue,
                            definition
                        );
                }

                continue;
            }


            const audioInput =
                field.querySelector(
                    ".generate-audio-input"
                );


            if (audioInput) {

                const value =
                    await resolveAudioParameterValue(
                        audioInput
                    );


                parameters[name] =
                    normalizeParameterValue(
                        value,
                        definition
                    );

                continue;
            }
        }


        /*
         * -------------------------------------------------
         * STANDARD FIELD
         * -------------------------------------------------
         */

        if (!field) {

            const defaultValue =
                getDefaultValue(
                    definition
                );


            if (
                defaultValue !== undefined &&
                defaultValue !== null &&
                defaultValue !== ""
            ) {

                parameters[name] =
                    normalizeParameterValue(
                        defaultValue,
                        definition
                    );
            }

            continue;
        }


        let value =
            readFieldValue(
                field
            );


        /*
         * -------------------------------------------------
         * EMPTY VALUE
         * -------------------------------------------------
         */

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {

            const defaultValue =
                getDefaultValue(
                    definition
                );


            if (
                defaultValue !== undefined &&
                defaultValue !== null &&
                defaultValue !== ""
            ) {
                value = defaultValue;
            }
        }


        /*
         * -------------------------------------------------
         * NORMALIZE
         * -------------------------------------------------
         */

        value =
            normalizeParameterValue(
                value,
                definition
            );


        /*
         * -------------------------------------------------
         * PRESERVE VALID VALUES
         * -------------------------------------------------
         */

        if (
            value !== undefined &&
            value !== null
        ) {

            if (
                Array.isArray(value)
            ) {

                if (
                    value.length > 0
                ) {
                    parameters[name] =
                        value;
                }

            } else if (
                typeof value === "string"
            ) {

                if (
                    value.trim() !== ""
                ) {
                    parameters[name] =
                        value;
                }

            } else {

                parameters[name] =
                    value;
            }
        }
    }


    return parameters;
}


/* =========================================================
   GET FORM DATA
========================================================= */

export async function getFormData(
    modelArgument = null
) {

    const parameters =
        await getFormParameters(
            modelArgument
        );


    return {
        parameters
    };
}


/* =========================================================
   DEFAULT
========================================================= */

export default {
    getFormParameters,
    getFormData
};
