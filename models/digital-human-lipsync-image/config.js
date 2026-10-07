/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   DIGITAL HUMAN - LIPSYNC IMAGE
   ---------------------------------------------------------
   File:
     models/digital-human-lipsync-image/config.js

   Fungsi:
   - Model identity
   - Provider identity
   - Model type
   - API endpoint definition

   Provider:
     motiongen

   Model:
     digital-human-lipsync-image

   IMPORTANT:
   - Tidak menggunakan KIE.AI
   - Tidak ada fallback provider
   - Resolution dan credit dikelola registry/admin model
   - Duration dan aspect ratio mengikuti parameters.js
========================================================= */

const config = {

    /*
     * =====================================================
     * MODEL ID
     * =====================================================
     */

    id:
        "digital-human-lipsync-image",


    /*
     * =====================================================
     * MODEL NAME
     * =====================================================
     */

    name:
        "Digital Human - LipSync Image",


    /*
     * =====================================================
     * PROVIDER
     * =====================================================
     */

    providerId:
        "motiongen",


    providerName:
        "Motiongen-AI",


    /*
     * =====================================================
     * MODEL TYPE
     * =====================================================
     */

    type:
        "image-to-video",


    /*
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
