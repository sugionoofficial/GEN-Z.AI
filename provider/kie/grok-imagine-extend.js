/**
 * GEN-Z.AI
 * KIE.AI MODEL ADAPTER
 *
 * File:
 * provider/kie/grok-imagine-extend.js
 *
 * Model:
 * grok-imagine/extend
 *
 * Workflow, variant, parameter, constraint,
 * dependency dan pricing berasal dari Supabase.
 *
 * API key KIE.AI ditangani oleh client.js.
 */

import { createTask } from "./client.js";


const MODEL_ID = "grok-imagine/extend";

const PROVIDER_ID = "kie_ai";


function buildInput(options = {}) {

    if (
        options.input &&
        typeof options.input === "object" &&
        !Array.isArray(options.input)
    ) {
        return {
            ...options.input
        };
    }


    const input = {};


    if (options.prompt !== undefined) {
        input.prompt = options.prompt;
    }

    if (options.aspect_ratio !== undefined) {
        input.aspect_ratio = options.aspect_ratio;
    }

    if (options.ratio !== undefined) {
        input.ratio = options.ratio;
    }

    if (options.duration !== undefined) {
        input.duration = options.duration;
    }

    if (options.resolution !== undefined) {
        input.resolution = options.resolution;
    }

    if (options.video_url !== undefined) {
        input.video_url = options.video_url;
    }

    if (options.video_urls !== undefined) {
        input.video_urls = options.video_urls;
    }

    if (options.image_urls !== undefined) {
        input.image_urls = options.image_urls;
    }

    if (options.input_urls !== undefined) {
        input.input_urls = options.input_urls;
    }

    if (options.reference_image_urls !== undefined) {
        input.reference_image_urls =
            options.reference_image_urls;
    }

    if (options.reference_video_urls !== undefined) {
        input.reference_video_urls =
            options.reference_video_urls;
    }

    if (options.reference_audio_urls !== undefined) {
        input.reference_audio_urls =
            options.reference_audio_urls;
    }

    if (options.reference_file_urls !== undefined) {
        input.reference_file_urls =
            options.reference_file_urls;
    }

    if (options.reference_link_urls !== undefined) {
        input.reference_link_urls =
            options.reference_link_urls;
    }

    if (options.first_frame_url !== undefined) {
        input.first_frame_url =
            options.first_frame_url;
    }

    if (options.last_frame_url !== undefined) {
        input.last_frame_url =
            options.last_frame_url;
    }

    if (options.seed !== undefined) {
        input.seed = options.seed;
    }


    return input;
}


function buildPayload(options = {}) {

    const model =
        String(
            options.model || MODEL_ID
        ).trim();


    return {
        model,
        input: buildInput(options)
    };
}


function validate(options = {}) {

    if (
        options.input !== undefined &&
        (
            typeof options.input !== "object" ||
            Array.isArray(options.input)
        )
    ) {
        return {
            valid: false,
            error: "Input KIE harus berupa object."
        };
    }


    return {
        valid: true
    };
}


async function create(options = {}) {

    const validation =
        validate(options);


    if (!validation.valid) {

        throw new Error(
            validation.error
        );

    }


    const payload =
        buildPayload(options);


    return createTask(payload);
}


async function generate(options = {}) {

    return create(options);
}


const adapter = {

    MODEL_ID,

    PROVIDER_ID,

    buildInput,

    buildPayload,

    validate,

    create,

    generate

};


export {

    MODEL_ID,

    PROVIDER_ID,

    buildInput,

    buildPayload,

    validate,

    create,

    generate

};


export default adapter;
