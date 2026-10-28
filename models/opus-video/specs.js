/* =========================================================
   GEN-Z.AI
   OPUS LABS VIDEO — MODEL SPECS
   ---------------------------------------------------------
   File:
     models/opus-video/specs.js

   Daftar model video Opus Labs MCP (labs.opus.pro/opus-video-tools/mcp)
   yang didukung pada halaman /generate.

   CARA MENAMBAH MODEL:
   - Tambahkan satu objek baru di OPUS_VIDEO_SPECS.
   - Factory + registry otomatis membuat adapter lengkap
     (config, parameters, validate, getParameters,
     sanitizeParameters, buildPayload, createTask, queryTask).
========================================================= */

const OPUS_VIDEO_SPECS = Object.freeze([

    /* =====================================================
       SEEDANCE 2.5 (4–30 DETIK, AUDIO NATIVE, 480p / 720p)
    ===================================================== */

    {
        id: "opus-seedance-2.5-t2v",
        opusModel: "seedance-2.5",
        modelAliases: [
            "seedance-2.5",
            "bytedance/seedance-2.5",
            "byteplus/seedance-2.5",
            "dreamina/seedance-2.5",
            "volcengine/seedance-2.5",
            "dreamina-seedance-2-5-260628",
            "byteplus/dreamina-seedance-2-5-260628",
            "seedance-2-5",
            "Seedance 2.5"
        ],
        name: "Seedance 2.5 Text to Video (Opus)",
        logo: "seedance.svg",
        kind: "t2v",
        type: "text-to-video",
        workflow: "reference2video",
        ratios: ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"],
        defaultRatio: "9:16",
        resolutions: ["720p", "480p"],
        defaultResolution: "720p",
        durationRange: { min: 4, max: 30 },
        defaultDuration: "5",
        generateAudio: true,
        maxPrompt: 8000
    },

    {
        id: "opus-seedance-2.5-i2v",
        opusModel: "seedance-2.5",
        modelAliases: [
            "seedance-2.5",
            "bytedance/seedance-2.5",
            "byteplus/seedance-2.5",
            "dreamina/seedance-2.5",
            "volcengine/seedance-2.5",
            "dreamina-seedance-2-5-260628",
            "byteplus/dreamina-seedance-2-5-260628",
            "seedance-2-5",
            "Seedance 2.5"
        ],
        name: "Seedance 2.5 Image to Video (Opus)",
        logo: "seedance.svg",
        kind: "i2v",
        type: "image-to-video",
        workflow: "first_last_frame",
        allowLastFrame: false,
        ratios: [],
        resolutions: ["720p", "480p"],
        defaultResolution: "720p",
        durationRange: { min: 4, max: 30 },
        defaultDuration: "5",
        generateAudio: true,
        maxPrompt: 8000
    },

    {
        id: "opus-seedance-2.5-r2v",
        opusModel: "seedance-2.5",
        modelAliases: [
            "seedance-2.5",
            "bytedance/seedance-2.5",
            "byteplus/seedance-2.5",
            "dreamina/seedance-2.5",
            "volcengine/seedance-2.5",
            "dreamina-seedance-2-5-260628",
            "byteplus/dreamina-seedance-2-5-260628",
            "seedance-2-5",
            "Seedance 2.5"
        ],
        name: "Seedance 2.5 Reference to Video (Opus)",
        logo: "seedance.svg",
        kind: "r2v",
        type: "image-to-video",
        workflow: "reference2video",
        referenceRequired: true,
        maxReferences: 3,
        ratios: ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"],
        defaultRatio: "9:16",
        resolutions: ["720p", "480p"],
        defaultResolution: "720p",
        durationRange: { min: 4, max: 30 },
        defaultDuration: "5",
        generateAudio: true,
        maxPrompt: 8000
    },

    /* =====================================================
       SEEDANCE 2.0 (4–15 DETIK, T2V & REFERENCE TO VIDEO)
    ===================================================== */

    {
        id: "opus-seedance-2.0-r2v",
        opusModel: "seedance-2.0",
        modelAliases: [
            "seedance-2.0",
            "bytedance/seedance-2.0",
            "byteplus/seedance-2.0",
            "dreamina/seedance-2.0",
            "dreamina-seedance-2-0-260128",
            "Seedance 2.0",
            "seedance-2"
        ],
        name: "Seedance 2.0 Video (Opus)",
        logo: "seedance.svg",
        kind: "r2v",
        type: "text-to-video",
        workflow: "reference2video",
        referenceRequired: false,
        maxReferences: 3,
        ratios: ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"],
        defaultRatio: "9:16",
        resolutions: ["720p", "480p"],
        defaultResolution: "720p",
        durationRange: { min: 4, max: 15 },
        defaultDuration: "5",
        generateAudio: true,
        maxPrompt: 8000
    },

    /* =====================================================
       MINIMAX HAILUO 3 (5–15 DETIK, 768p / 2K)
    ===================================================== */

    {
        id: "opus-hailuo-3-t2v",
        opusModel: "hailuo-3",
        modelAliases: [
            "hailuo-3",
            "minimax/hailuo-3",
            "minimax/MiniMax-H3",
            "MiniMax-H3",
            "Hailuo 3",
            "minimax-hailuo-3"
        ],
        name: "MiniMax Hailuo 3 Text to Video (Opus)",
        logo: "minimax.svg",
        kind: "t2v",
        type: "text-to-video",
        workflow: "reference2video",
        ratios: ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"],
        defaultRatio: "9:16",
        resolutions: ["768p", "2k"],
        defaultResolution: "768p",
        durationRange: { min: 5, max: 15 },
        defaultDuration: "5",
        generateAudio: false,
        maxPrompt: 7000
    },

    {
        id: "opus-hailuo-3-i2v",
        opusModel: "hailuo-3",
        modelAliases: [
            "hailuo-3",
            "minimax/hailuo-3",
            "minimax/MiniMax-H3",
            "MiniMax-H3",
            "Hailuo 3",
            "minimax-hailuo-3"
        ],
        name: "MiniMax Hailuo 3 First & Last Frame (Opus)",
        logo: "minimax.svg",
        kind: "i2v",
        type: "image-to-video",
        workflow: "first_last_frame",
        allowLastFrame: true,
        ratios: [],
        resolutions: ["768p", "2k"],
        defaultResolution: "768p",
        durationRange: { min: 5, max: 15 },
        defaultDuration: "5",
        generateAudio: false,
        maxPrompt: 7000
    }

]);

export {
    OPUS_VIDEO_SPECS
};

export default OPUS_VIDEO_SPECS;
