/* =========================================================
   GEN-Z.AI — GENERATE MODE & SUB-MODE STATE
   ---------------------------------------------------------
   File:
     generate/assets/js/generate-mode-state.js

   Mengelola:
   - Mode Utama: "video" (Generate Video) | "image" (Generate Gambar)
   - Sub-Mode Gambar:
       * "standard"        (Generate Biasa: 0–8 gambar referensi + prompt)
       * "character_sheet" (Generate Karakter Sheet: foto karakter +
                            opsi foto outfit + master prompt terkunci +
                            catatan tambahan opsional, default 16:9)
   - Filter katalog model berdasarkan mode utama tanpa mengganggu
     alur Generate Video yang sudah berjalan
   - Adaptasi definisi parameter model gambar sesuai sub-mode aktif
========================================================= */

"use strict";

export const MAIN_MODE_VIDEO = "video";
export const MAIN_MODE_IMAGE = "image";
export const MAIN_MODE_AUDIO = "audio";
export const MAIN_MODE_TRANSCRIBE = "transcribe";

export const IMAGE_SUBMODE_STANDARD = "standard";
export const IMAGE_SUBMODE_CHARACTER_SHEET = "character_sheet";

const MAIN_MODE_STORAGE_KEY = "genz_generate_main_mode";
const IMAGE_SUBMODE_STORAGE_KEY = "genz_generate_image_submode";
const SELECTED_VIDEO_MODEL_KEY = "genz_generate_selected_model";
const SELECTED_IMAGE_MODEL_KEY = "genz_generate_selected_image_model";
const SELECTED_AUDIO_MODEL_KEY = "genz_generate_selected_audio_model";
const SELECTED_TRANSCRIBE_MODEL_KEY = "genz_generate_selected_transcribe_model";

const KNOWN_OPUS_IMAGE_IDS = Object.freeze([
    "opus-gpt-image-2.5-flare",
    "opus-gpt-image-2.5-sunburst",
    "opus-seedream-5.0-pro",
    "opus-nano-banana-2",
    "opus-nano-banana-pro"
]);

const KNOWN_OPUS_AUDIO_IDS = Object.freeze([
    "opus-audio-speech",
    "opus-audio-podcast",
    "opus-audio-music",
    "opus-audio-sfx"
]);

const KNOWN_OPUS_TRANSCRIBE_IDS = Object.freeze([
    "opus-transcribe-audio"
]);

let activeMainMode = MAIN_MODE_VIDEO;
let activeImageSubMode = IMAGE_SUBMODE_STANDARD;
let initializedFromStorage = false;

function readStorage(key) {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return String(window.localStorage.getItem(key) || "").trim();
        }
    } catch {
        /* ignore */
    }
    return "";
}

function writeStorage(key, value) {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            if (value) {
                window.localStorage.setItem(key, String(value));
            } else {
                window.localStorage.removeItem(key);
            }
        }
    } catch {
        /* ignore */
    }
}

export function normalizeMainMode(value) {
    const token = String(value || "").trim().toLowerCase();
    if (token === MAIN_MODE_IMAGE || token === "gambar" || token === "photo") {
        return MAIN_MODE_IMAGE;
    }
    if (
        token === MAIN_MODE_AUDIO ||
        token === "generate_audio" ||
        token === "generate-audio" ||
        token === "suara" ||
        token === "music" ||
        token === "tts"
    ) {
        return MAIN_MODE_AUDIO;
    }
    if (
        token === MAIN_MODE_TRANSCRIBE ||
        token === "transcribe_audio" ||
        token === "transcribe-audio" ||
        token === "transkrip" ||
        token === "subtitle" ||
        token === "srt"
    ) {
        return MAIN_MODE_TRANSCRIBE;
    }
    return MAIN_MODE_VIDEO;
}

export function normalizeImageSubMode(value) {
    const token = String(value || "").trim().toLowerCase();
    if (
        token === IMAGE_SUBMODE_CHARACTER_SHEET ||
        token === "charactersheet" ||
        token === "character-sheet" ||
        token === "karakter_sheet" ||
        token === "karakter-sheet"
    ) {
        return IMAGE_SUBMODE_CHARACTER_SHEET;
    }
    return IMAGE_SUBMODE_STANDARD;
}

function ensureInitialized() {
    if (initializedFromStorage) return;
    initializedFromStorage = true;

    let urlMode = "";
    let urlSubMode = "";
    try {
        if (typeof window !== "undefined" && window.location?.search) {
            const params = new URLSearchParams(window.location.search);
            urlMode = params.get("mode") || "";
            urlSubMode = params.get("submode") || params.get("image_mode") || "";
        }
    } catch {
        /* ignore */
    }

    if (urlMode) {
        activeMainMode = normalizeMainMode(urlMode);
    } else {
        const storedMain = readStorage(MAIN_MODE_STORAGE_KEY);
        if (storedMain) {
            activeMainMode = normalizeMainMode(storedMain);
        }
    }

    if (urlSubMode) {
        activeImageSubMode = normalizeImageSubMode(urlSubMode);
    } else {
        const storedSub = readStorage(IMAGE_SUBMODE_STORAGE_KEY);
        if (storedSub) {
            activeImageSubMode = normalizeImageSubMode(storedSub);
        }
    }
}

export function getActiveMainMode() {
    ensureInitialized();
    return activeMainMode;
}

export function setActiveMainMode(mode) {
    ensureInitialized();
    activeMainMode = normalizeMainMode(mode);
    writeStorage(MAIN_MODE_STORAGE_KEY, activeMainMode);
    return activeMainMode;
}

export function getActiveImageSubMode() {
    ensureInitialized();
    return activeImageSubMode;
}

export function setActiveImageSubMode(subMode) {
    ensureInitialized();
    activeImageSubMode = normalizeImageSubMode(subMode);
    writeStorage(IMAGE_SUBMODE_STORAGE_KEY, activeImageSubMode);
    return activeImageSubMode;
}

export function getSelectedModelStorageKeyForMode(mode = getActiveMainMode()) {
    const normalized = normalizeMainMode(mode);
    if (normalized === MAIN_MODE_IMAGE) return SELECTED_IMAGE_MODEL_KEY;
    if (normalized === MAIN_MODE_AUDIO) return SELECTED_AUDIO_MODEL_KEY;
    if (normalized === MAIN_MODE_TRANSCRIBE) return SELECTED_TRANSCRIBE_MODEL_KEY;
    return SELECTED_VIDEO_MODEL_KEY;
}

export function isImageModel(model) {
    if (!model) return false;
    if (typeof model === "string") {
        const cleanId = model.trim().toLowerCase();
        return KNOWN_OPUS_IMAGE_IDS.includes(cleanId) || cleanId.startsWith("opus-image-");
    }
    if (typeof model !== "object") return false;

    const mediaType = String(
        model.media_type ||
        model.mediaType ||
        model.generation_type ||
        model.generationType ||
        model.config?.mediaType ||
        model.config?.generationType ||
        model.repository?.mediaType ||
        ""
    )
        .trim()
        .toLowerCase();

    if (mediaType === "image") {
        return true;
    }

    const typeToken = String(
        model.type ||
        model.category ||
        model.config?.type ||
        model.config?.category ||
        ""
    )
        .trim()
        .toLowerCase();

    if (typeToken === "image-generation" || typeToken === "text-to-image" || typeToken === "image") {
        return true;
    }

    const modelId = String(
        model.model_id ||
        model.modelId ||
        model.id ||
        model.config?.id ||
        ""
    )
        .trim()
        .toLowerCase();

    return KNOWN_OPUS_IMAGE_IDS.includes(modelId) || modelId.startsWith("opus-image-");
}

export function isAudioModel(model) {
    if (!model) return false;
    if (typeof model === "string") {
        const cleanId = model.trim().toLowerCase();
        return KNOWN_OPUS_AUDIO_IDS.includes(cleanId) || cleanId.startsWith("opus-audio-");
    }
    if (typeof model !== "object") return false;

    const mediaType = String(
        model.media_type ||
        model.mediaType ||
        model.generation_type ||
        model.generationType ||
        model.config?.mediaType ||
        model.config?.generationType ||
        model.repository?.mediaType ||
        ""
    )
        .trim()
        .toLowerCase();

    if (mediaType === "audio") {
        return true;
    }

    const typeToken = String(
        model.type ||
        model.category ||
        model.config?.type ||
        model.config?.category ||
        ""
    )
        .trim()
        .toLowerCase();

    if (typeToken === "audio-generation" || typeToken === "text-to-audio" || typeToken === "audio") {
        return true;
    }

    const modelId = String(
        model.model_id ||
        model.modelId ||
        model.id ||
        model.config?.id ||
        ""
    )
        .trim()
        .toLowerCase();

    return KNOWN_OPUS_AUDIO_IDS.includes(modelId) || modelId.startsWith("opus-audio-");
}

export function isTranscribeModel(model) {
    if (!model) return false;
    if (typeof model === "string") {
        const cleanId = model.trim().toLowerCase();
        return KNOWN_OPUS_TRANSCRIBE_IDS.includes(cleanId) || cleanId.startsWith("opus-transcribe-");
    }
    if (typeof model !== "object") return false;

    const mediaType = String(
        model.media_type ||
        model.mediaType ||
        model.generation_type ||
        model.generationType ||
        model.config?.mediaType ||
        model.config?.generationType ||
        model.repository?.mediaType ||
        ""
    )
        .trim()
        .toLowerCase();

    if (mediaType === "transcribe" || mediaType === "transcription") {
        return true;
    }

    const typeToken = String(
        model.type ||
        model.category ||
        model.config?.type ||
        model.config?.category ||
        ""
    )
        .trim()
        .toLowerCase();

    if (typeToken === "audio-transcription" || typeToken === "speech-to-text" || typeToken === "transcribe") {
        return true;
    }

    const modelId = String(
        model.model_id ||
        model.modelId ||
        model.id ||
        model.config?.id ||
        ""
    )
        .trim()
        .toLowerCase();

    return KNOWN_OPUS_TRANSCRIBE_IDS.includes(modelId) || modelId.startsWith("opus-transcribe-");
}

export function isFlatCreditNonVideoModel(model) {
    return isImageModel(model) || isAudioModel(model) || isTranscribeModel(model);
}

export function resolveMainModeForModel(model) {
    if (isImageModel(model)) return MAIN_MODE_IMAGE;
    if (isAudioModel(model)) return MAIN_MODE_AUDIO;
    if (isTranscribeModel(model)) return MAIN_MODE_TRANSCRIBE;
    return MAIN_MODE_VIDEO;
}

export function filterModelsByMainMode(models, mode = getActiveMainMode()) {
    const list = Array.isArray(models) ? models : [];
    const targetMode = normalizeMainMode(mode);
    if (targetMode === MAIN_MODE_IMAGE) {
        return list.filter(model => isImageModel(model));
    }
    if (targetMode === MAIN_MODE_AUDIO) {
        return list.filter(model => isAudioModel(model));
    }
    if (targetMode === MAIN_MODE_TRANSCRIBE) {
        return list.filter(model => isTranscribeModel(model));
    }
    return list.filter(
        model => !isImageModel(model) && !isAudioModel(model) && !isTranscribeModel(model)
    );
}

export function inferSubModeFromRegenerateParameters(parameters = {}) {
    if (!parameters || typeof parameters !== "object") {
        return IMAGE_SUBMODE_STANDARD;
    }
    if (parameters.image_mode) {
        return normalizeImageSubMode(parameters.image_mode);
    }
    const promptText = String(parameters.prompt || "").trim();
    if (/^\[karakter\s+sheet/i.test(promptText) || parameters.character_image_url) {
        return IMAGE_SUBMODE_CHARACTER_SHEET;
    }
    return IMAGE_SUBMODE_STANDARD;
}

export function adaptDefinitionsForImageSubMode(
    rawDefinitions,
    model = null,
    subMode = getActiveImageSubMode()
) {
    if (!rawDefinitions || typeof rawDefinitions !== "object") {
        return Array.isArray(rawDefinitions) ? [] : {};
    }

    const isArrayInput = Array.isArray(rawDefinitions);
    const valuesList = isArrayInput ? rawDefinitions : Object.values(rawDefinitions);

    /* Jangan sentuh model video sama sekali */
    const hasSubModeParam = valuesList.some(
        def => def && typeof def === "object" && typeof def.subMode === "string"
    );
    if (!isImageModel(model) && !hasSubModeParam) {
        return rawDefinitions;
    }

    const normalizedSubMode = normalizeImageSubMode(subMode);

    const adaptSingleField = (name, definition) => {
        if (!name || !definition || typeof definition !== "object") return null;
        if (name === "image_mode") return null;

        const fieldSubMode = typeof definition.subMode === "string"
            ? normalizeImageSubMode(definition.subMode)
            : "";

        if (fieldSubMode && fieldSubMode !== normalizedSubMode) {
            return null;
        }

        const cloned = { ...definition };

        if (normalizedSubMode === IMAGE_SUBMODE_CHARACTER_SHEET) {
            if (name === "character_image_url") {
                cloned.required = true;
            }
            if (name === "aspect_ratio") {
                const allowed = Array.isArray(cloned.enum) ? cloned.enum : [];
                if (!allowed.length || allowed.includes("16:9")) {
                    cloned.default = "16:9";
                }
            }
        } else {
            if (name === "prompt") {
                cloned.required = true;
            }
            if (name === "aspect_ratio") {
                const allowed = Array.isArray(cloned.enum) ? cloned.enum : [];
                if (!allowed.length || allowed.includes("1:1")) {
                    cloned.default = "1:1";
                }
            }
        }

        return cloned;
    };

    if (isArrayInput) {
        const adaptedArray = [];
        for (const item of rawDefinitions) {
            const name = String(
                item?.name || item?.key || item?.parameter || item?.id || ""
            ).trim();
            const adaptedItem = adaptSingleField(name, item);
            if (adaptedItem) {
                adaptedArray.push(adaptedItem);
            }
        }
        return adaptedArray;
    }

    const adapted = {};
    for (const [name, definition] of Object.entries(rawDefinitions)) {
        const adaptedItem = adaptSingleField(name, definition);
        if (adaptedItem) {
            adapted[name] = adaptedItem;
        }
    }

    return adapted;
}
