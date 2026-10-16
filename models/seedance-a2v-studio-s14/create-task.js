import { createGeneration } from "../../provider/motiongen-ai/client.js";
import config from "./config.js";
import { buildPayload, validateParameters } from "./parameter-adapter.js";

async function createTask(body = {}, apiKey) {
    const validation = validateParameters(body);
    if (!validation.valid) {
        const error = new Error(validation.errors.join(" "));
        error.code = "INVALID_MODEL_INPUT";
        error.provider = config.providerId;
        error.model = config.id;
        error.validationErrors = validation.errors;
        throw error;
    }

    const payload = buildPayload(body);
    const response = await createGeneration(payload, apiKey);
    const jobId = response?.jobId || response?.job_id || response?.taskId || response?.task_id;

    if (!jobId) {
        const error = new Error("Motiongen-AI tidak mengembalikan job_id.");
        error.code = "MISSING_JOB_ID";
        error.provider = config.providerId;
        error.model = config.id;
        error.providerResponse = response;
        throw error;
    }

    return {
        ...response,
        success: response?.success !== false,
        provider: config.providerId,
        providerName: config.providerName,
        model: config.id,
        motiongen_model: config.motiongenModelId,
        taskId: jobId,
        task_id: jobId,
        jobId,
        job_id: jobId
    };
}

export { buildPayload, createTask };
export default createTask;
