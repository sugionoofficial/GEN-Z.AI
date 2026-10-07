/**
 * =========================================================
 * GEN-Z.AI
 * DIGITAL HUMAN - LIPSYNC IMAGE
 * ---------------------------------------------------------
 * File:
 * models/digital-human-lipsync-image/query-task.js
 *
 * Fungsi:
 * - Query status job Motiongen-AI
 * - Normalisasi status
 * - Mengambil output video
 * - Menyediakan kompatibilitas taskId / task_id / jobId / job_id
 *
 * Provider:
 * Motiongen-AI
 *
 * IMPORTANT:
 * - Tidak menggunakan KIE
 * - Tidak ada KIE fallback
 * - Tidak melakukan polling internal
 * - Polling tetap dikendalikan oleh Generate engine
 * =========================================================
 */

import {
    getJob
} from "../../provider/motiongen-ai/client.js";

import config from "./config.js";


/**
 * =========================================================
 * STATUS CONSTANTS
 * =========================================================
 */

const STATUS = Object.freeze({

    QUEUED:
        "QUEUED",

    PROCESSING:
        "PROCESSING",

    COMPLETED:
        "COMPLETED",

    FAILED:
        "FAILED",

    UNKNOWN:
        "UNKNOWN"

});


/**
 * =========================================================
 * NORMALIZE JOB ID
 * =========================================================
 *
 * Generate engine dapat menggunakan:
 *
 * - taskId
 * - task_id
 * - jobId
 * - job_id
 *
 * Motiongen secara resmi menggunakan:
 *
 * job_id
 * =========================================================
 */

function normalizeJobId(
    input
) {

    if (
        typeof input === "string" &&
        input.trim()
    ) {

        return input.trim();

    }


    if (
        input &&
        typeof input === "object"
    ) {

        const value =

            input.jobId ||

            input.job_id ||

            input.taskId ||

            input.task_id ||

            input.id ||

            null;


        if (
            value !== null &&
            value !== undefined &&
            String(value).trim()
        ) {

            return String(
                value
            ).trim();

        }

    }


    return "";

}


/**
 * =========================================================
 * NORMALIZE STATUS
 * =========================================================
 */

function normalizeStatus(
    value
) {

    const status =
        String(
            value || ""
        )
        .trim()
        .toUpperCase();


    switch (
        status
    ) {

        case "QUEUED":

            return STATUS.QUEUED;


        case "PROCESSING":

            return STATUS.PROCESSING;


        case "COMPLETED":

            return STATUS.COMPLETED;


        case "FAILED":

            return STATUS.FAILED;


        default:

            return STATUS.UNKNOWN;

    }

}


/**
 * =========================================================
 * EXTRACT OUTPUT URLS
 * =========================================================
 */

function normalizeOutputUrls(
    response
) {

    if (
        Array.isArray(
            response?.output_urls
        )
    ) {

        return response.output_urls
            .filter(
                value =>
                    typeof value === "string" &&
                    value.trim()
            )
            .map(
                value =>
                    value.trim()
            );

    }


    if (
        Array.isArray(
            response?.outputUrls
        )
    ) {

        return response.outputUrls
            .filter(
                value =>
                    typeof value === "string" &&
                    value.trim()
            )
            .map(
                value =>
                    value.trim()
            );

    }


    if (
        typeof response?.output_url ===
        "string" &&
        response.output_url.trim()
    ) {

        return [
            response.output_url.trim()
        ];

    }


    return [];

}


/**
 * =========================================================
 * QUERY TASK
 * =========================================================
 *
 * API:
 *
 * GET /api/v1/jobs/{job_id}
 *
 * =========================================================
 */

async function queryTask(
    taskInput,
    apiKey
) {

    /**
     * -----------------------------------------------------
     * JOB ID
     * -----------------------------------------------------
     */

    const jobId =
        normalizeJobId(
            taskInput
        );


    if (!jobId) {

        const error =
            new Error(
                "job_id Motiongen-AI tidak tersedia."
            );

        error.code =
            "MOTIONGEN_JOB_ID_MISSING";

        error.provider =
            "motiongen";

        error.model =
            config.id;

        throw error;

    }


    /**
     * -----------------------------------------------------
     * REQUEST
     * -----------------------------------------------------
     */

    const response =
        await getJob(
            jobId,
            apiKey
        );


    /**
     * -----------------------------------------------------
     * STATUS
     * -----------------------------------------------------
     */

    const status =
        normalizeStatus(
            response?.status
        );


    /**
     * -----------------------------------------------------
     * OUTPUT
     * -----------------------------------------------------
     */

    const outputUrls =
        normalizeOutputUrls(
            response
        );


    /**
     * -----------------------------------------------------
     * NORMALIZED RESULT
     * -----------------------------------------------------
     */

    return {

        success:
            response?.success !== false,

        provider:
            "motiongen",

        providerId:
            "motiongen",

        providerName:
            "Motiongen-AI",

        model:
            config.id,

        modelId:
            config.id,

        jobId,

        job_id:
            jobId,

        taskId:
            jobId,

        task_id:
            jobId,

        status,

        kind:
            response?.kind ||
            "VIDEO",

        outputUrls,

        output_urls:
            outputUrls,

        outputUrl:
            outputUrls[0] ||
            null,

        output_url:
            outputUrls[0] ||
            null,

        creditCost:
            response?.creditCost ??
            response?.credit_cost ??
            null,

        credit_cost:
            response?.credit_cost ??
            response?.creditCost ??
            null,

        raw:
            response?.raw ??
            response

    };

}


/**
 * =========================================================
 * STATUS HELPERS
 * =========================================================
 */

function isCompleted(
    result
) {

    return (
        normalizeStatus(
            result?.status
        ) ===
        STATUS.COMPLETED
    );

}


function isFailed(
    result
) {

    return (
        normalizeStatus(
            result?.status
        ) ===
        STATUS.FAILED
    );

}


function isProcessing(
    result
) {

    const status =
        normalizeStatus(
            result?.status
        );


    return (

        status ===
        STATUS.QUEUED ||

        status ===
        STATUS.PROCESSING

    );

}


/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export {

    STATUS,

    normalizeJobId,

    normalizeStatus,

    normalizeOutputUrls,

    queryTask,

    isCompleted,

    isFailed,

    isProcessing

};


export default {

    STATUS,

    normalizeJobId,

    normalizeStatus,

    normalizeOutputUrls,

    queryTask,

    isCompleted,

    isFailed,

    isProcessing

};
