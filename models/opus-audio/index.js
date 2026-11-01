/* =========================================================
   GEN-Z.AI
   OPUS LABS AUDIO — REGISTRY BARREL EXPORT
   ---------------------------------------------------------
   File:
     models/opus-audio/index.js
========================================================= */

import {
    DEFAULT_OPUS_AUDIO_CREDIT,
    OPUS_AUDIO_MODEL_IDS,
    OPUS_AUDIO_SPECS,
    OPUS_SPEECH_VOICES,
    OPUS_SPEECH_VOICE_IDS,
    computeSpeechWeightedLength,
    isOpusAudioModelId
} from "./specs.js";
import { createOpusAudioModel } from "./factory.js";

export const opusAudioModels = OPUS_AUDIO_SPECS.map(spec =>
    createOpusAudioModel(spec)
);

export const opusAudioModelMap = Object.fromEntries(
    opusAudioModels.map(model => [
        model.id || model.config?.id,
        model
    ])
);

export {
    DEFAULT_OPUS_AUDIO_CREDIT,
    OPUS_AUDIO_MODEL_IDS,
    OPUS_AUDIO_SPECS,
    OPUS_SPEECH_VOICES,
    OPUS_SPEECH_VOICE_IDS,
    computeSpeechWeightedLength,
    isOpusAudioModelId
};

export default opusAudioModels;
