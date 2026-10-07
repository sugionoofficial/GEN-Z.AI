/**
 * =========================================================
 * GEN-Z.AI
 * DIGITAL HUMAN - LIPSYNC IMAGE
 * ---------------------------------------------------------
 * File:
 * models/digital-human-lipsync-image/config.js
 *
 * Provider:
 * Motiongen-AI
 *
 * Model:
 * digital-human-lipsync-image
 * =========================================================
 */

const config = {

    /**
     * =====================================================
     * MODEL ID
     * =====================================================
     */

    id:
        "digital-human-lipsync-image",


    /**
     * =====================================================
     * DISPLAY NAME
     * =====================================================
     */

    name:
        "Digital Human - LipSync Image",


    /**
     * =====================================================
     * PROVIDER
     * =====================================================
     *
     * HARUS menggunakan provider code:
     *
     * motiongen
     *
     * Bukan:
     *
     * motiongen_ai
     * kie
     * kie_ai
     *
     */

    providerId:
        "motiongen",

    providerName:
        "Motiongen-AI",


    /**
     * =====================================================
     * MODEL TYPE
     * =====================================================
     */

    type:
        "image-to-video",


    /**
     * =====================================================
     * API
     * =====================================================
     */

    api: {

        createTask:
            "/api/v1/generate",

        queryTask:
            "/api/v1/jobs/{job_id}"

    }

};


export default config;
