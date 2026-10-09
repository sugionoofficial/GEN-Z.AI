/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   KLING MOTION CONTROL 3.0 PRO (30s)
   ---------------------------------------------------------
   File:
     models/kling-motion-control-30-pro/index.js

   Entry point model.
========================================================= */

import config
    from "./config.js";

import parameters
    from "./parameters.js";

import {
    validate
} from "./parameters.js";

import createTask
    from "./create-task.js";

import queryTask
    from "./query-task.js";

import {
    getParameters,
    sanitizeParameters,
    buildPayload,
    getSource,
    validateParameters
} from "./parameter-adapter.js";


export default {

    config,

    parameters,

    validate,

    getParameters,

    sanitizeParameters,

    buildPayload,

    validateParameters,

    getSource,

    createTask,

    queryTask

};
