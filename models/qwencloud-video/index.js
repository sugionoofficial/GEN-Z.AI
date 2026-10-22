/* =========================================================
   GEN-Z.AI
   QWENCLOUD VIDEO — MODEL REGISTRY
   ---------------------------------------------------------
   File:
     models/qwencloud-video/index.js

   Semua model video QwenCloud dibuat dari satu factory.
   Menambah model cukup di specs.js — file ini otomatis
   menghasilkan adapter untuk setiap spec.
========================================================= */

import {
    QWENCLOUD_VIDEO_SPECS
} from "./specs.js";

import {
    createQwenCloudVideoModel
} from "./factory.js";


const qwenCloudVideoModels =
    QWENCLOUD_VIDEO_SPECS.map(
        createQwenCloudVideoModel
    );


const qwenCloudVideoModelsById =
    new Map(
        qwenCloudVideoModels.map(
            model => [
                model.config.id,
                model
            ]
        )
    );


function getQwenCloudVideoModel(
    modelId
) {

    return (
        qwenCloudVideoModelsById.get(
            String(
                modelId || ""
            ).trim()
        ) ||
        null
    );

}


export {

    QWENCLOUD_VIDEO_SPECS,

    getQwenCloudVideoModel,

    qwenCloudVideoModels,

    qwenCloudVideoModelsById

};


export default qwenCloudVideoModels;
