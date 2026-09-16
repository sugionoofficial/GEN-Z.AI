/**
 * GEN-Z.AI
 * KIE.AI MODEL ADAPTER
 *
 * File:
 * provider/kie/bytedance-seedance-1.5-pro.js
 *
 * Model:
 * bytedance/seedance-1.5-pro
 *
 * Semua workflow, variant, parameter,
 * constraint, dependency dan pricing
 * dikelola melalui Supabase.
 */

import { createTask } from "./client.js";


const MODEL_ID = "bytedance/seedance-1.5-pro";

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

    if (options.duration !== undefined) {
        input.duration = options.duration;
    }

    if (options.image_urls !== undefined) {
        input.image_urls = options.image_urls;
    }

    if (options.input_urls !== undefined) {
        input.input_urls = options.input_urls;
    }

    if (options.resolution !== undefined) {
        input.resolution = options.resolution;
    }

    if (options.sound !== undefined) {
        input.sound = options.sound;
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


export {
    MODEL_ID,
    PROVIDER_ID,
    buildInput,
    buildPayload,
    validate,
    create,
    generate
};


export default {
    MODEL_ID,
    PROVIDER_ID,
    buildInput,
    buildPayload,
    validate,
    create,
    generate
};
