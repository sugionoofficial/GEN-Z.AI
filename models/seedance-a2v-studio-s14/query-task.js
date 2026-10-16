import { getJob } from "../../provider/motiongen-ai/client.js";
import config from "./config.js";

function normalizeStatus(status) {
    const value = String(status || "").trim().toUpperCase();
    if (["QUEUED", "PROCESSING", "COMPLETED", "FAILED"].includes(value)) return value;
    return "UNKNOWN";
}

function normalizeOutputUrls(response) {
    const values = response?.outputUrls || response?.output_urls || response?.data?.output_urls;
    return Array.isArray(values)
        ? values.filter(url => typeof url === "string" && url.trim()).map(url => url.trim())
        : [];
}

async function queryTask(taskId, apiKey) {
    const jobId = String(taskId || "").trim();
    if (!jobId) {
        const error = new Error("Motiongen-AI job ID is required.");
        error.code = "JOB_ID_MISSING";
        error.provider = config.providerId;
        error.model = config.id;
        throw error;
    }

    const response = await getJob(jobId, apiKey);
    const outputUrls = normalizeOutputUrls(response);

    return {
        success: response?.success !== false,
        provider: config.providerId,
        providerName: config.providerName,
        model: config.id,
        id: response?.id || jobId,
        jobId,
        job_id: jobId,
        taskId: jobId,
        task_id: jobId,
        status: normalizeStatus(response?.status),
        kind: response?.kind || null,
        creditCost: response?.creditCost ?? response?.credit_cost ?? null,
        credit_cost: response?.credit_cost ?? response?.creditCost ?? null,
        outputUrls,
        output_urls: outputUrls,
        outputUrl: outputUrls[0] || response?.preview_url || null,
        errorMessage: response?.errorMessage || response?.error_message || null,
        error_message: response?.error_message || response?.errorMessage || null,
        raw: response?.raw || response
    };
}

const isCompleted = result => normalizeStatus(result?.status) === "COMPLETED";
const isFailed = result => normalizeStatus(result?.status) === "FAILED";
const isProcessing = result => ["QUEUED", "PROCESSING"].includes(normalizeStatus(result?.status));

export {
    isCompleted,
    isFailed,
    isProcessing,
    normalizeOutputUrls,
    normalizeStatus,
    queryTask
};
export default queryTask;
