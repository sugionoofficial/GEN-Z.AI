/* =========================================================
   GEN-Z.AI
   QWENCLOUD VIDEO — MODEL SPECS
   ---------------------------------------------------------
   File:
     models/qwencloud-video/specs.js

   Daftar model video QwenCloud (Alibaba Cloud Model Studio /
   DashScope) yang didukung.

   CARA MENAMBAH MODEL:
   - Tambahkan satu objek baru di array QWENCLOUD_VIDEO_SPECS.
   - Tidak perlu file baru; factory + registry otomatis
     membuat adapter lengkap (config, parameters, validate,
     createTask, queryTask).

   FIELD SPEC:
     id              ID internal GEN-Z.AI (unik)
     dashscopeModel  nama model di DashScope (dikirim ke API)
     name            nama tampilan
     kind            t2v | i2v | kf2v | r2v | animate
     type            tipe model untuk UI/admin
     ratios          pilihan aspect_ratio (kosong = dari input)
     resolutions     pilihan resolusi
     durations       pilihan durasi (detik, string)
     defaultDuration durasi default
     negativePrompt  dukung negative_prompt
     audioTrack      dukung input audio_url (musik/dialog)
     shotType        dukung parameter shot_type
     maxPrompt       batas karakter prompt
========================================================= */

const QWENCLOUD_VIDEO_SPECS = Object.freeze([

    /* =====================================================
       TEXT TO VIDEO
    ===================================================== */

    {
        id: "qwen-wan2.6-t2v",
        dashscopeModel: "wan2.6-t2v",
        name: "Wan 2.6 Text to Video",
        kind: "t2v",
        type: "text-to-video",
        ratios: ["16:9", "9:16", "1:1"],
        resolutions: ["720P", "1080P"],
        durations: ["5", "10", "15"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: true,
        shotType: true,
        maxPrompt: 2000
    },

    {
        id: "qwen-wan2.5-t2v-preview",
        dashscopeModel: "wan2.5-t2v-preview",
        name: "Wan 2.5 Text to Video (Preview)",
        kind: "t2v",
        type: "text-to-video",
        ratios: ["16:9", "9:16", "1:1"],
        resolutions: ["720P", "480P", "1080P"],
        durations: ["5", "10"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: true,
        shotType: false,
        maxPrompt: 2000
    },

    {
        id: "qwen-wan2.2-t2v-plus",
        dashscopeModel: "wan2.2-t2v-plus",
        name: "Wan 2.2 Text to Video Plus",
        kind: "t2v",
        type: "text-to-video",
        ratios: ["16:9", "9:16", "1:1"],
        resolutions: ["720P", "1080P"],
        durations: ["5"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: false,
        shotType: false,
        maxPrompt: 800
    },


    /* =====================================================
       IMAGE TO VIDEO (FIRST FRAME)
    ===================================================== */

    {
        id: "qwen-wan2.6-i2v-flash",
        dashscopeModel: "wan2.6-i2v-flash",
        name: "Wan 2.6 Image to Video Flash",
        kind: "i2v",
        type: "image-to-video",
        ratios: [],
        resolutions: ["720P", "1080P"],
        durations: ["5", "10"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: true,
        shotType: false,
        maxPrompt: 2000
    },

    {
        id: "qwen-wan2.6-i2v",
        dashscopeModel: "wan2.6-i2v",
        name: "Wan 2.6 Image to Video",
        kind: "i2v",
        type: "image-to-video",
        ratios: [],
        resolutions: ["720P", "1080P"],
        durations: ["5", "10"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: true,
        shotType: false,
        maxPrompt: 2000
    },

    {
        id: "qwen-wan2.5-i2v-preview",
        dashscopeModel: "wan2.5-i2v-preview",
        name: "Wan 2.5 Image to Video (Preview)",
        kind: "i2v",
        type: "image-to-video",
        ratios: [],
        resolutions: ["720P", "480P", "1080P"],
        durations: ["5", "10"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: true,
        shotType: false,
        maxPrompt: 2000
    },

    {
        id: "qwen-wan2.2-i2v-flash",
        dashscopeModel: "wan2.2-i2v-flash",
        name: "Wan 2.2 Image to Video Flash",
        kind: "i2v",
        type: "image-to-video",
        ratios: [],
        resolutions: ["720P", "480P"],
        durations: ["5"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: false,
        shotType: false,
        maxPrompt: 800
    },

    {
        id: "qwen-wan2.2-i2v-plus",
        dashscopeModel: "wan2.2-i2v-plus",
        name: "Wan 2.2 Image to Video Plus",
        kind: "i2v",
        type: "image-to-video",
        ratios: [],
        resolutions: ["720P", "1080P"],
        durations: ["5"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: false,
        shotType: false,
        maxPrompt: 800
    },


    /* =====================================================
       KEYFRAME (FIRST + LAST FRAME)
    ===================================================== */

    {
        id: "qwen-wan2.2-kf2v-flash",
        dashscopeModel: "wan2.2-kf2v-flash",
        name: "Wan 2.2 First & Last Frame",
        kind: "kf2v",
        type: "image-to-video",
        ratios: [],
        resolutions: ["720P", "480P", "1080P"],
        durations: ["5"],
        defaultDuration: "5",
        negativePrompt: true,
        audioTrack: false,
        shotType: false,
        maxPrompt: 800
    },


    /* =====================================================
       REFERENCE TO VIDEO (KONSISTENSI KARAKTER)
    ===================================================== */

    {
        id: "qwen-wan2.6-r2v-flash",
        dashscopeModel: "wan2.6-r2v-flash",
        name: "Wan 2.6 Reference to Video Flash",
        kind: "r2v",
        type: "image-to-video",
        ratios: ["16:9", "9:16", "1:1"],
        resolutions: ["720P", "1080P"],
        durations: ["5", "10"],
        defaultDuration: "5",
        negativePrompt: false,
        audioTrack: false,
        shotType: true,
        maxPrompt: 2000
    },

    {
        id: "qwen-wan2.6-r2v",
        dashscopeModel: "wan2.6-r2v",
        name: "Wan 2.6 Reference to Video",
        kind: "r2v",
        type: "image-to-video",
        ratios: ["16:9", "9:16", "1:1"],
        resolutions: ["720P", "1080P"],
        durations: ["5", "10"],
        defaultDuration: "5",
        negativePrompt: false,
        audioTrack: false,
        shotType: true,
        maxPrompt: 2000
    },


    /* =====================================================
       WAN ANIMATE (MOTION TRANSFER)
    ===================================================== */

    {
        id: "qwen-wan2.2-animate-move",
        dashscopeModel: "wan2.2-animate-move",
        name: "Wan 2.2 Animate Move",
        kind: "animate",
        type: "image-to-video",
        ratios: [],
        resolutions: [],
        durations: [],
        defaultDuration: "",
        negativePrompt: false,
        audioTrack: false,
        shotType: false,
        modes: ["wan-std", "wan-pro"],
        defaultMode: "wan-std",
        maxPrompt: 800
    },

    {
        id: "qwen-wan2.2-animate-mix",
        dashscopeModel: "wan2.2-animate-mix",
        name: "Wan 2.2 Animate Mix",
        kind: "animate",
        type: "image-to-video",
        ratios: [],
        resolutions: [],
        durations: [],
        defaultDuration: "",
        negativePrompt: false,
        audioTrack: false,
        shotType: false,
        modes: ["wan-std", "wan-pro"],
        defaultMode: "wan-std",
        maxPrompt: 800
    }

]);


/* =========================================================
   SIZE TABLE
   ---------------------------------------------------------
   Legacy Wan endpoint memakai `size` (lebar*tinggi),
   bukan aspect_ratio + resolution terpisah.
========================================================= */

const SIZE_TABLE =
    Object.freeze({

        "480P": Object.freeze({
            "16:9": "832*480",
            "9:16": "480*832",
            "1:1": "640*640"
        }),

        "720P": Object.freeze({
            "16:9": "1280*720",
            "9:16": "720*1280",
            "1:1": "960*960"
        }),

        "1080P": Object.freeze({
            "16:9": "1920*1080",
            "9:16": "1080*1920",
            "1:1": "1440*1440"
        })

    });


function resolveSize(
    resolution,
    aspectRatio
) {

    const res =
        SIZE_TABLE[
            String(
                resolution || "720P"
            ).toUpperCase()
        ];


    if (!res) {

        return null;

    }


    return (
        res[
            String(
                aspectRatio || "16:9"
            )
        ] ||
        res["16:9"]
    );

}


export {

    QWENCLOUD_VIDEO_SPECS,
    SIZE_TABLE,
    resolveSize
};


export default QWENCLOUD_VIDEO_SPECS;
