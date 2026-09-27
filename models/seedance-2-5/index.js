import config
    from "./config.js";


import parameters, {
    validate
} from "./parameters.js";


import parameterAdapter, {
    getParameters,
    sanitizeParameters
} from "./parameter-adapter.js";


import createTask, {
    buildInput,
    buildPayload
} from "./create-task.js";


import queryTask
    from "./query-task.js";


/* =========================================================
   MODEL ADAPTER
   ========================================================= */

const model = {

    config,

    parameters,

    validate,

    getParameters,

    sanitizeParameters,

    parameterAdapter,

    buildInput,

    buildPayload,

    createTask,

    queryTask

};


/* =========================================================
   NAMED EXPORTS
   ========================================================= */

export {

    config,

    parameters,

    validate,

    getParameters,

    sanitizeParameters,

    parameterAdapter,

    buildInput,

    buildPayload,

    createTask,

    queryTask

};


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default model;
