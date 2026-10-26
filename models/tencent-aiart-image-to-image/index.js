//models/tencent-aiart-image-to-image/index.js?v=tencent-aiart-20261026
/* =========================================================
   GEN-Z.AI
   TENCENT AI ART
   IMAGE TO IMAGE (FOTO → GAMBAR ANIME)
   ---------------------------------------------------------
   File:
     models/tencent-aiart-image-to-image/index.js

   Entry point model.

   CATATAN
   Model ini SINKRON: tidak ada `queryTask`. Hasil dikirim
   di response `/api/generate` dan disimpan ke Supabase
   Storage oleh api/generate.js. Karena itu model ini
   sengaja TIDAK didaftarkan di api/generate-status.js —
   polling tidak berlaku untuk model ini.
========================================================= */

import config
    from "./config.js";

import parameters, {
    validate,
    STYLE_PRESETS,
    SIMILARITY_PRESETS
} from "./parameters.js";

import createTask
    from "./create-task.js";

import {
    getSource,
    getParameters,
    sanitizeParameters,
    resolveStyleCode,
    resolveStrength,
    buildPayload,
    validateParameters
} from "./parameter-adapter.js";


export default {

    config,

    parameters,

    validate,

    STYLE_PRESETS,

    SIMILARITY_PRESETS,

    getSource,

    getParameters,

    sanitizeParameters,

    resolveStyleCode,

    resolveStrength,

    buildPayload,

    validateParameters,

    createTask

};
