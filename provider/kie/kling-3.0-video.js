/**
 * GEN-Z.AI
 * KIE.AI MODEL ADAPTER
 *
 * File:
 * provider/kie/kling-3.0-video.js
 *
 * Model:
 * kling-3.0/video
 *
 * Semua workflow, variant, parameter,
 * constraint, dependency dan pricing
 * dikelola melalui Supabase.
 *
 * File ini TIDAK menyimpan API key.
 */

import { createTask } from "./client.js";


const MODEL_ID = "kling-3.0/video";

const PROVIDER_ID = "kie_ai";


function normalizeString(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


/**
 * Membangun input KIE.
 *
 * options.input adalah input yang sudah
 * dibentuk berdasarkan konfigurasi Supabase.
 *
 * Tidak ada parameter Kling yang di-hardcode
 * di adapter ini.
 */
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

    if (options.kling_elements !== undefined) {
        input.kling_elements = options.kling_elements;
    }

    if (options.mode !== undefined) {
        input.mode = options.mode;
    }

    if (options.multi_prompt !== undefined) {
        input.multi_prompt = options.multi_prompt;
    }

    if (options.multi_shots !== undefined) {
        input.multi_shots = options.multi_shots;
    }

    if (options.sound !== undefined) {
        input.sound = options.sound;
    }


    return input;
}


/**
 * Membentuk payload standar untuk KIE.AI.
 */
function buildPayload(options = {}) {

    const model =
        normalizeString(
            options.model || MODEL_ID
        );


    const input =
        buildInput(options);


    return {
        model,
        input
    };
}


/**
 * Validasi dasar adapter.
 *
 * Validasi parameter lengkap dilakukan
 * oleh /api/generate berdasarkan Supabase.
 */
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


/**
 * Membuat task KIE.AI.
 *
 * Backend /api/generate tetap menjadi
 * pintu utama aplikasi dan bertanggung jawab
 * terhadap authentication, Supabase config,
 * validation dan credit.
 */
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


/**
 * Alias generate untuk kompatibilitas
 * dengan adapter lama.
 */
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
