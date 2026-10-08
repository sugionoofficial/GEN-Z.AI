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

   PATCH:
   - Tambah `motiongenModelId` untuk mengirim slug yang
     benar ke Motiongen API.
   - `id` tetap "digital-human-lipsync-image" agar tidak
     merusak: Supabase models table, credit lookup,
     generation_history, dan frontend option value.
   - Motiongen slug resmi: "digital-human-lipsync-image-s3"
========================================================= */

const config = {

    /*
     * =====================================================
     * MODEL ID (internal, GEN-Z.AI)
     * =====================================================
     * Nilai ini dipakai untuk:
     * - Registry lookup
     * - Supabase models.model_id
     * - Frontend option value
     * - generation_history.model_id
     */

    id:
        "digital-human-lipsync-image",


    /*
     * =====================================================
     * MOTIONGEN MODEL ID (external slug)
     * =====================================================
     * Slug yang dikirim ke Motiongen API.
     * Berbeda dari id internal.
     */

    motiongenModelId:
        "digital-human-lipsync-image-s3",


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
