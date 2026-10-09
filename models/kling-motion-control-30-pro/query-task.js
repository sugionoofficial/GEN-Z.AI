/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   KLING MOTION CONTROL 3.0 PRO (30s)
   ---------------------------------------------------------
   File:
     models/kling-motion-control-30-pro/query-task.js

   Polling status job Motiongen.
========================================================= */

import {
    queryGeneration
} from "../../provider/motiongen-ai/client.js";

import config
    from "./config.js";


async function queryTask(
    jobId,
    apiKey
) {

    if (
        !jobId
    ) {

        throw new Error(
            "Job ID is required"
        );

    }


    const response =
        await queryGeneration(
            jobId,
            apiKey
        );


    const status =
        String(
            response?.status ||
            response?.data?.status ||
            ""
        )
            .trim()
            .toUpperCase();


    const resultUrls =

        Array.isArray(
            response?.output_urls
        )

            ? response.output_urls

            : Array.isArray(
                response?.data?.output_urls
            )

                ? response.data.output_urls

                : Array.isArray(
                    response?.result_urls
                )

                    ? response.result_urls

                    : Array.isArray(
                        response?.data?.result_urls
                    )

                        ? response.data.result_urls

                        : [];


    return {

        ...response,

        provider:
            config.providerId,

        providerName:
            config.providerName,

        model:
            config.id,

        taskId:
            jobId,

        task_id:
            jobId,

        jobId,

        job_id:
            jobId,

        status,

        state:
            status.toLowerCase(),

        completed:
            status === "COMPLETED",

        failed:
            status === "FAILED",

        processing:
            status === "PROCESSING" ||
            status === "QUEUED",

        result_urls:
            resultUrls,

        resultUrls

    };

}


export default queryTask;
