/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   DIGITAL HUMAN - LIPSYNC IMAGE
   ---------------------------------------------------------
   File:
     models/digital-human-lipsync-image/query-task.js

   Fungsi:
   - Query status job Motiongen
   - Normalisasi status provider
   - Mengambil output video
   - Menangani failed job
   - Menyediakan helper status

   PROVIDER:
     motiongen

   MODEL:
     digital-human-lipsync-image

   STATUS:
     QUEUED
     PROCESSING
     COMPLETED
     FAILED

   IMPORTANT:
   - Tidak menggunakan KIE.AI
   - Tidak melakukan refund sendiri
   - Refund provider dilakukan oleh Motiongen
   - Refund kredit GEN-Z.AI ditangani oleh generation/history layer
========================================================= */

import {
    getJob
} from "../../provider/motiongen-ai/client.js";


import config
    from "./config.js";


/* =========================================================
   NORMALIZE JOB ID
========================================================= */

function normalizeJobId(
    value
) {

    if (
        value ===
            undefined ||
        value ===
            null
    ) {

        return "";

    }


    return String(
        value
    ).trim();

}


/* =========================================================
   NORMALIZE STATUS
========================================================= */

function normalizeStatus(
    status
) {

    const value =
        String(
            status || ""
        )
            .trim()
            .toUpperCase();


    switch (
        value
    ) {

        case "QUEUED":

            return "QUEUED";


        case "PROCESSING":

            return "PROCESSING";


        case "COMPLETED":

            return "COMPLETED";


        case "FAILED":

            return "FAILED";


        default:

            return "UNKNOWN";

    }

}


/* =========================================================
   NORMALIZE OUTPUT URLS
========================================================= */

function normalizeOutputUrls(
    response
) {

    if (
        Array.isArray(
            response?.outputUrls
        )
    ) {

        return response.outputUrls
            .filter(
                url =>
                    typeof url ===
                        "string" &&
                    url.trim()
            )
            .map(
                url =>
                    url.trim()
            );

    }


    if (
        Array.isArray(
            response?.output_urls
        )
    ) {

        return response.output_urls
            .filter(
                url =>
                    typeof url ===
                        "string" &&
                    url.trim()
            )
            .map(
                url =>
                    url.trim()
            );

    }


    return [];

}


/* =========================================================
   QUERY TASK
========================================================= */

async function queryTask(
    taskId,
    apiKey
) {

    const jobId =
        normalizeJobId(
            taskId
        );


    if (
        !jobId
    ) {

        const error =
            new Error(
                "Motiongen-AI job ID is required."
            );


        error.code =
            "JOB_ID_MISSING";


        error.provider =
            config.providerId;


        error.model =
            config.id;


        throw error;

    }


    /*
     * -----------------------------------------------------
     * QUERY PROVIDER
     * -----------------------------------------------------
     */

    const response =
        await getJob(
            jobId,
            apiKey
        );


    /*
     * -----------------------------------------------------
     * NORMALIZE STATUS
     * -----------------------------------------------------
     */

    const status =
        normalizeStatus(
            response?.status
        );


    /*
     * -----------------------------------------------------
     * OUTPUT
     * -----------------------------------------------------
     */

    const outputUrls =
        normalizeOutputUrls(
            response
        );


    /*
     * -----------------------------------------------------
     * RESULT
     * -----------------------------------------------------
     */

    return {

        success:
            response?.success !== false,

        provider:
            config.providerId,

        providerName:
            config.providerName,

        model:
            config.id,

        id:
            response?.id ||
            jobId,

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
            null,

        creditCost:
            response?.creditCost ??
            response?.credit_cost ??
            null,

        credit_cost:
            response?.credit_cost ??
            response?.creditCost ??
            null,

        outputUrls,

        output_urls:
            outputUrls,

        outputUrl:
            outputUrls[0] ||
            null,

        errorMessage:
            response?.errorMessage ||
            response?.error_message ||
            null,

        error_message:
            response?.error_message ||
            response?.errorMessage ||
            null,

        raw:
            response?.raw ||
            response

    };

}


/* =========================================================
   STATUS HELPERS
========================================================= */

function isCompleted(
    result
) {

    return (
        normalizeStatus(
            result?.status
        ) ===
        "COMPLETED"
    );

}


function isFailed(
    result
) {

    return (
        normalizeStatus(
            result?.status
        ) ===
        "FAILED"
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
            "QUEUED" ||
        status ===
            "PROCESSING"
    );

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    normalizeJobId,

    normalizeStatus,

    normalizeOutputUrls,

    queryTask,

    isCompleted,

    isFailed,

    isProcessing

};


export default queryTask;
