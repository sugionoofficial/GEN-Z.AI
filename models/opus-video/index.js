/* =========================================================
   GEN-Z.AI
   OPUS LABS VIDEO — MODEL REGISTRY
   ---------------------------------------------------------
   File:
     models/opus-video/index.js

   Semua model video Opus Labs dibuat dari satu factory.
========================================================= */

import {
    OPUS_VIDEO_SPECS
} from "./specs.js";

import {
    createOpusVideoModel
} from "./factory.js";

const opusVideoModels =
    OPUS_VIDEO_SPECS.map(
        createOpusVideoModel
    );

const opusVideoModelsById =
    new Map(
        opusVideoModels.map(
            model => [
                model.config.id,
                model
            ]
        )
    );

function getOpusVideoModel(modelId) {
    return (
        opusVideoModelsById.get(
            String(modelId || "").trim()
        ) ||
        null
    );
}

export {
    OPUS_VIDEO_SPECS,
    getOpusVideoModel,
    opusVideoModels,
    opusVideoModelsById
};

export default opusVideoModels;
