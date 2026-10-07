/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   DIGITAL HUMAN - LIPSYNC IMAGE
   ---------------------------------------------------------
   File:
     models/digital-human-lipsync-image/index.js

   Fungsi:
   - Entry point model
   - Menggabungkan seluruh modul model
   - Menyediakan interface standar adapter GEN-Z.AI

   PROVIDER:
     motiongen

   MODEL:
     digital-human-lipsync-image

   IMPORTANT:
   - Tidak menggunakan KIE.AI
   - Tidak ada KIE fallback
========================================================= */

import config
    from "./config.js";


import parameters
    from "./parameters.js";


import {
    validate
} from "./parameters.js";


import {
    getSource,
    getParameters,
    sanitizeParameters,
    buildPayload,
    validateParameters
} from "./parameter-adapter.js";


import {
    buildInput,
    buildMotiongenPayload,
    createTask
} from "./create-task.js";


import queryTask, {
    normalizeJobId,
    normalizeStatus,
    normalizeOutputUrls,
    isCompleted,
    isFailed,
    isProcessing
} from "./query-task.js";


/* =========================================================
   MODEL ADAPTER
========================================================= */

const model = {

    /*
     * -----------------------------------------------------
     * CONFIG
     * -----------------------------------------------------
     */

    config,


    /*
     * -----------------------------------------------------
     * PARAMETERS
     * -----------------------------------------------------
     */

    parameters,


    /*
     * -----------------------------------------------------
     * VALIDATION
     * -----------------------------------------------------
     */

    validate,


    validateParameters,


    /*
     * -----------------------------------------------------
     * PARAMETER ADAPTER
     * -----------------------------------------------------
     */

    getSource,

    getParameters,

    sanitizeParameters,

    buildPayload,


    /*
     * -----------------------------------------------------
     * CREATE TASK
     * -----------------------------------------------------
     */

    buildInput,

    buildMotiongenPayload,

    createTask,


    /*
     * -----------------------------------------------------
     * QUERY TASK
     * -----------------------------------------------------
     */

    queryTask,

    normalizeJobId,

    normalizeStatus,

    normalizeOutputUrls,

    isCompleted,

    isFailed,

    isProcessing

};


/* =========================================================
   EXPORTS
========================================================= */

export {

    config,

    parameters,

    validate,

    validateParameters,

    getSource,

    getParameters,

    sanitizeParameters,

    buildPayload,

    buildInput,

    buildMotiongenPayload,

    createTask,

    queryTask,

    normalizeJobId,

    normalizeStatus,

    normalizeOutputUrls,

    isCompleted,

    isFailed,

    isProcessing

};


export default model;
