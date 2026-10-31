/* =========================================================
   GEN-Z.AI
   OPUS LABS IMAGE — REGISTRY BARREL EXPORT
   ---------------------------------------------------------
   File:
     models/opus-image/index.js
========================================================= */

import { OPUS_IMAGE_SPECS, OPUS_IMAGE_MODEL_IDS, isOpusImageModelId } from "./specs.js";
import { createOpusImageModel } from "./factory.js";
import { buildCharacterSheetPrompt } from "./character-sheet-prompt.js";

export const opusImageModels = OPUS_IMAGE_SPECS.map(spec =>
    createOpusImageModel(spec)
);

export const opusImageModelMap = Object.fromEntries(
    opusImageModels.map(model => [
        model.id || model.config?.id,
        model
    ])
);

export {
    OPUS_IMAGE_SPECS,
    OPUS_IMAGE_MODEL_IDS,
    isOpusImageModelId,
    buildCharacterSheetPrompt
};

export default opusImageModels;
