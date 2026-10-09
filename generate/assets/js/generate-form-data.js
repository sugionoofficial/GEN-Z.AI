"use strict";

/* =========================================================
   GEN-Z.AI
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-data.js

   Tanggung jawab:
   - Membaca parameter form
   - Membaca nilai field
   - Resolve image upload / URL
   - Resolve audio upload / URL
   - Resolve video upload / URL
   - Normalisasi parameter
   - Membentuk data form
   - Hard cleanup parameter internal / server-controlled
   - Tidak mengubah DOM
   - Tidak merender field

   PATCH (2026-10-09):
   - Tambah isVideoParameter() untuk parameter
     video_url / video_urls.
   - Tambah blok handling video di loop utama.
   - Tambah debug log video.
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
    resolveAudioParameterValue,
    resolveVideoParameterValue
} from "./generate-form-media-reader.js";


/* =========================================================
   HARD FORBIDDEN PARAMETERS
========================================================= */

const HARD_FORBIDDEN_PARAMETERS =
    Object.freeze([
        "task_id",
        "index",
        "nsfw_checker",
        "webhook_url",
        "webhook"
    ]);


/* =========================================================
   CHECK HARD FORBIDDEN
========================================================= */

function isHardForbiddenParameter(name) {

    const normalized =
        String(name || "")
            .trim()
            .toLowerCase();


    return HARD_FORBIDDEN_PARAMETERS.includes(normalized);
}


/* =========================================================
   SHOULD PRESERVE VALUE
========================================================= */

function shouldPreserveValue(value) {

    if (value === undefined || value === null) {
        return false;
    }


    if (Array.isArray(value)) {
        return value.length > 0;
    }


    if (typeof value === "string") {
        return value.trim() !== "";
    }


    return true;
}


/* =========================================================
   DEFAULT VALUE
========================================================= */

function resolveDefaultValue(definition) {

    const defaultValue = getDefaultValue(definition);


    if (
        defaultValue === undefined ||
        defaultValue === null ||
        defaultValue === ""
    ) {
        return undefined;
    }


    return normalizeParameterValue(defaultValue, definition);
}


/* =========================================================
   IMAGE PARAMETER
========================================================= */

function isImageParameter(name, definition) {

    const type =
        String(definition?.type || "")
            .trim()
            .toLowerCase();


    return (
        type === "image" ||
        type === "image_url" ||
        type === "image_urls" ||
        name === "image_url" ||
        name === "image_urls"
    );
}


/* =========================================================
   AUDIO PARAMETER
========================================================= */

function isAudioParameter(name, definition) {

    const type =
        String(definition?.type || "")
            .trim()
            .toLowerCase();


    return (
        type === "audio" ||
        type === "audio_url" ||
        name === "audio_url"
    );
}


/* =========================================================
   VIDEO PARAMETER (BARU)
========================================================= */

function isVideoParameter(name, definition) {

    const type =
        String(definition?.type || "")
            .trim()
            .toLowerCase();

    const normalizedName =
        String(name || "")
            .trim()
            .toLowerCase();


    return (
        type === "video" ||
        type === "video_url" ||
        type === "video_urls" ||
        normalizedName === "video_url" ||
        normalizedName === "video_urls"
    );
}


/* =========================================================
   GET FORM PARAMETERS
========================================================= */

export async function getFormParameters(modelArgument = null) {

    const definitions = getParameterDefinitions(modelArgument);


    if (!definitions || typeof definitions !== "object") {
        return {};
    }


    const parameterNames = getOrderedParameterNames(definitions);

    const parameters = {};


    for (const name of parameterNames) {

        if (!name) {
            continue;
        }


        /* HARD SECURITY FILTER */

        if (isHardForbiddenParameter(name)) {
            continue;
        }


        /* CORE CLIENT FILTER */

        if (isClientForbiddenParameter(name)) {
            continue;
        }


        const definition = definitions[name];


        if (!definition) {
            continue;
        }


        const field = findField(name);


        /* =================================================
           IMAGE
        ================================================= */

        if (isImageParameter(name, definition)) {

            if (!field) {

                const defaultValue = resolveDefaultValue(definition);

                if (shouldPreserveValue(defaultValue)) {
                    parameters[name] = defaultValue;
                }

                continue;
            }


            const imageInput = field.querySelector(".generate-image-input");

            const imageSource =
                imageInput ||
                (field.classList?.contains("generate-image-input") ? field : null);


            if (imageSource) {

                const value = await resolveImageParameterValue(
                    imageSource,
                    definition
                );

                const normalized = normalizeParameterValue(value, definition);


                if (shouldPreserveValue(normalized)) {
                    parameters[name] = normalized;
                }

                continue;
            }


            const defaultValue = resolveDefaultValue(definition);

            if (shouldPreserveValue(defaultValue)) {
                parameters[name] = defaultValue;
            }

            continue;
        }


        /* =================================================
           AUDIO
        ================================================= */

        if (isAudioParameter(name, definition)) {

            if (!field) {

                const defaultValue = resolveDefaultValue(definition);

                if (shouldPreserveValue(defaultValue)) {
                    parameters[name] = defaultValue;
                }

                continue;
            }


            const audioInput = field.querySelector(".generate-audio-input");

            const audioSource =
                audioInput ||
                (field.classList?.contains("generate-audio-input") ? field : null);


            if (audioSource) {

                const value = await resolveAudioParameterValue(audioSource);

                const normalized = normalizeParameterValue(value, definition);


                if (shouldPreserveValue(normalized)) {
                    parameters[name] = normalized;
                }

                continue;
            }


            const defaultValue = resolveDefaultValue(definition);

            if (shouldPreserveValue(defaultValue)) {
                parameters[name] = defaultValue;
            }

            continue;
        }


        /* =================================================
           VIDEO (BARU)
        ================================================= */

        if (isVideoParameter(name, definition)) {

            if (!field) {

                const defaultValue = resolveDefaultValue(definition);

                if (shouldPreserveValue(defaultValue)) {
                    parameters[name] = defaultValue;
                }

                continue;
            }


            const videoInput = field.querySelector(".generate-video-input");

            const videoSource =
                videoInput ||
                (field.classList?.contains("generate-video-input") ? field : null);


            if (videoSource) {

                const value = await resolveVideoParameterValue(
                    videoSource,
                    definition
                );

                const normalized = normalizeParameterValue(value, definition);


                if (shouldPreserveValue(normalized)) {
                    parameters[name] = normalized;
                }

                continue;
            }


            const defaultValue = resolveDefaultValue(definition);

            if (shouldPreserveValue(defaultValue)) {
                parameters[name] = defaultValue;
            }

            continue;
        }


        /* =================================================
           STANDARD FIELD
        ================================================= */

        if (!field) {

            const defaultValue = resolveDefaultValue(definition);

            if (shouldPreserveValue(defaultValue)) {
                parameters[name] = defaultValue;
            }

            continue;
        }


        let value = readFieldValue(field);


        /* EMPTY VALUE -> DEFAULT */

        if (value === undefined || value === null || value === "") {

            const defaultValue = getDefaultValue(definition);

            if (
                defaultValue !== undefined &&
                defaultValue !== null &&
                defaultValue !== ""
            ) {
                value = defaultValue;
            }
        }


        /* NORMALIZE */

        value = normalizeParameterValue(value, definition);


        /* PRESERVE VALID VALUE */

        if (shouldPreserveValue(value)) {
            parameters[name] = value;
        }
    }


    /* HARD CLIENT CLEANUP */

    delete parameters.task_id;
    delete parameters.index;
    delete parameters.nsfw_checker;
    delete parameters.webhook_url;
    delete parameters.webhook;


    /* =====================================================
       DEBUG
    ===================================================== */

    console.debug(
        "[GEN-Z.AI][Generate Form] FORM PARAMETERS:",
        parameters
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] REFERENCE IMAGE:",
        {
            image_urls:
                Array.isArray(parameters.image_urls)
                    ? parameters.image_urls.length
                    : 0,

            image_url:
                parameters.image_url ? "present" : "missing",

            hasReferenceImage:
                (
                    (
                        Array.isArray(parameters.image_urls) &&
                        parameters.image_urls.length > 0
                    ) ||
                    Boolean(parameters.image_url)
                )
        }
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] AUDIO:",
        {
            audio_url:
                parameters.audio_url ? "present" : "missing"
        }
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] VIDEO:",
        {
            video_urls:
                Array.isArray(parameters.video_urls)
                    ? parameters.video_urls.length
                    : 0,

            video_url:
                parameters.video_url ? "present" : "missing",

            hasVideo:
                (
                    (
                        Array.isArray(parameters.video_urls) &&
                        parameters.video_urls.length > 0
                    ) ||
                    Boolean(parameters.video_url)
                )
        }
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] CLIENT FORBIDDEN:",
        {
            webhook_url: "removed",
            webhook: "removed",
            nsfw_checker: "removed",
            task_id: "removed",
            index: "removed"
        }
    );


    return parameters;
}


/* =========================================================
   GET FORM DATA
========================================================= */

export async function getFormData(modelArgument = null) {

    const parameters = await getFormParameters(modelArgument);

    return {
        parameters
    };
}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
    getFormParameters,
    getFormData
};
