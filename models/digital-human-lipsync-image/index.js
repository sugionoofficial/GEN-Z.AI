/**
 * =========================================================
 * GEN-Z.AI
 * DIGITAL HUMAN - LIPSYNC IMAGE
 * ---------------------------------------------------------
 * File:
 * models/digital-human-lipsync-image/index.js
 *
 * Provider:
 * Motiongen-AI
 *
 * Model:
 * digital-human-lipsync-image
 *
 * Fungsi:
 * - Model entry point
 * - Menggabungkan config
 * - Menggabungkan parameters
 * - Menggabungkan parameter adapter
 * - Menggabungkan create task
 * - Menggabungkan query task
 *
 * Tidak bertanggung jawab:
 * - Supabase
 * - provider credentials
 * - pricing
 * - credit user
 * - UI
 * - KIE.AI
 * =========================================================
 */

import config from "./config.js";

import parameters, {
    validate
} from "./parameters.js";

import {
    getSource,
    getParameters,
    sanitizeParameters,
    buildPayload
} from "./parameter-adapter.js";

import {
    buildInput,
    buildMotiongenPayload,
    validateInput,
    createTask
} from "./create-task.js";

import {
    STATUS,
    normalizeJobId,
    normalizeStatus,
    normalizeOutputUrls,
    queryTask,
    isCompleted,
    isFailed,
    isProcessing
} from "./query-task.js";


/**
 * =========================================================
 * MODEL DEFINITION
 * =========================================================
 */

const model = {

    /**
     * -----------------------------------------------------
     * CONFIG
     * -----------------------------------------------------
     */

    config,


    /**
     * -----------------------------------------------------
     * PARAMETERS
     * -----------------------------------------------------
     */

    parameters,


    /**
     * -----------------------------------------------------
     * VALIDATION
     * -----------------------------------------------------
     */

    validate,


    /**
     * -----------------------------------------------------
     * PARAMETER ADAPTER
     * -----------------------------------------------------
     */

    parameterAdapter: {

        getSource,

        getParameters,

        sanitizeParameters,

        buildPayload

    },


    /**
     * -----------------------------------------------------
     * CREATE TASK
     * -----------------------------------------------------
     */

    createTask,


    /**
     * -----------------------------------------------------
     * CREATE TASK HELPERS
     * -----------------------------------------------------
     */

    buildInput,

    buildMotiongenPayload,

    validateInput,


    /**
     * -----------------------------------------------------
     * QUERY TASK
     * -----------------------------------------------------
     */

    queryTask,


    /**
     * -----------------------------------------------------
     * QUERY HELPERS
     * -----------------------------------------------------
     */

    status: STATUS,

    normalizeJobId,

    normalizeStatus,

    normalizeOutputUrls,

    isCompleted,

    isFailed,

    isProcessing

};


/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default model;


/**
 * =========================================================
 * NAMED EXPORTS
 * =========================================================
 */

export {

    config,

    parameters,

    validate,

    getSource,

    getParameters,

    sanitizeParameters,

    buildPayload,

    buildInput,

    buildMotiongenPayload,

    validateInput,

    createTask,

    STATUS,

    normalizeJobId,

    normalizeStatus,

    normalizeOutputUrls,

    queryTask,

    isCompleted,

    isFailed,

    isProcessing

};
