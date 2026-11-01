/* =========================================================
   GEN-Z.AI
   OPUS LABS TRANSCRIBE — REGISTRY BARREL EXPORT
   ---------------------------------------------------------
   File:
     models/opus-transcribe/index.js
========================================================= */

import {
    DEFAULT_OPUS_TRANSCRIBE_CREDIT,
    OPUS_TRANSCRIBE_LANGUAGES,
    OPUS_TRANSCRIBE_LANGUAGE_CODES,
    OPUS_TRANSCRIBE_MODEL_IDS,
    OPUS_TRANSCRIBE_SPECS,
    isOpusTranscribeModelId
} from "./specs.js";
import { createOpusTranscribeModel } from "./factory.js";

export const opusTranscribeModels = OPUS_TRANSCRIBE_SPECS.map(spec =>
    createOpusTranscribeModel(spec)
);

export const opusTranscribeModelMap = Object.fromEntries(
    opusTranscribeModels.map(model => [
        model.id || model.config?.id,
        model
    ])
);

export {
    DEFAULT_OPUS_TRANSCRIBE_CREDIT,
    OPUS_TRANSCRIBE_LANGUAGES,
    OPUS_TRANSCRIBE_LANGUAGE_CODES,
    OPUS_TRANSCRIBE_MODEL_IDS,
    OPUS_TRANSCRIBE_SPECS,
    isOpusTranscribeModelId
};

export default opusTranscribeModels;
