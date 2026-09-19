import config
    from "./config.js";


import parameters, {
    validate
} from "./parameters.js";


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

    buildInput,

    buildPayload,

    createTask,

    queryTask

};


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default model;
