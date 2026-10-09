/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   KLING MOTION CONTROL 3.0 PRO (30s)
   ---------------------------------------------------------
   File:
     models/kling-motion-control-30-pro/config.js

   Provider:
     motiongen

   Motiongen slug:
     kling-mc-30-pro-s6

   Credit:
     Flat 6 (bukan per-resolution)
========================================================= */

const config = {

    /* =====================================================
       MODEL ID (internal, GEN-Z.AI)
    ===================================================== */

    id:
        "kling-motion-control-30-pro",


    /* =====================================================
       MOTIONGEN MODEL ID (external slug)
    ===================================================== */

    motiongenModelId:
        "kling-mc-30-pro-s6",


    /* =====================================================
       MODEL NAME
    ===================================================== */

    name:
        "Kling Motion Control 3.0 Pro (30s)",


    /* =====================================================
       PROVIDER
    ===================================================== */

    providerId:
        "motiongen",


    providerName:
        "Motiongen-AI",


    /* =====================================================
       MODEL TYPE
    ===================================================== */

    type:
        "motion-control",


    /* =====================================================
       API
    ===================================================== */

    api: {

        createTask:
            "/api/v1/generate",

        queryTask:
            "/api/v1/jobs/{job_id}"

    }

};


export default config;
