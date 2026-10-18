import config from "./config.js";
import parameters, { getParameters, sanitizeParameters, validate } from "./parameters.js";
import { buildPayload, validateParameters } from "./parameter-adapter.js";
import createTask from "./create-task.js";
import queryTask, {
    isCompleted,
    isFailed,
    isProcessing,
    normalizeOutputUrls,
    normalizeStatus
} from "./query-task.js";

const model = {
    config,
    parameters,
    validate,
    getParameters,
    sanitizeParameters,
    validateParameters,
    buildPayload,
    createTask,
    queryTask,
    isCompleted,
    isFailed,
    isProcessing,
    normalizeOutputUrls,
    normalizeStatus
};

export {
    config,
    parameters,
    validate,
    getParameters,
    sanitizeParameters,
    validateParameters,
    buildPayload,
    createTask,
    queryTask,
    isCompleted,
    isFailed,
    isProcessing,
    normalizeOutputUrls,
    normalizeStatus
};
export default model;
