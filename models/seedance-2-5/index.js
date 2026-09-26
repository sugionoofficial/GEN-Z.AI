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


const model = {

    config,

    parameters,

    validate,

    buildInput,

    buildPayload,

    createTask,

    queryTask

};


export {

    config,

    parameters,

    validate,

    buildInput,

    buildPayload,

    createTask,

    queryTask

};


export default model;
