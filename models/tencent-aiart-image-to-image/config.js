/* =========================================================
   GEN-Z.AI
   TENCENT AI ART
   IMAGE TO IMAGE (FOTO → GAMBAR ANIME)
   ---------------------------------------------------------
   File:
     models/tencent-aiart-image-to-image/config.js

   Provider:
     tencent-aiart

   Produk:
     Tencent Cloud AI Art — 图像风格化（图生图）
     https://cloud.tencent.com/document/product/1668/88066

   Endpoint:
     aiart.tencentcloudapi.com
     Action  : ImageToImage
     Version : 2022-12-29

   CATATAN PENTING
   - API ini SINKRON: hasil dikembalikan di response yang
     sama, bukan lewat task ID. Jalur "hasil langsung" ada di
     api/generate.js (lihat `synchronous` di bawah).
   - Kredensial = SecretId + SecretKey (CAM), BUKAN
     TokenHub key.
   - Credit: flat (tidak ada pilihan resolusi di form).
========================================================= */

const config = {

    /* =====================================================
       MODEL ID (internal, GEN-Z.AI)
    ===================================================== */

    id:
        "tencent-aiart-image-to-image",


    /* =====================================================
       MODEL NAME
    ===================================================== */

    name:
        "Tencent AI Art — Foto jadi Anime",


    /* =====================================================
       PROVIDER
    ===================================================== */

    providerId:
        "tencent-aiart",

    providerName:
        "Tencent AI Art",

    logo:
        "tencent.svg",


    /* =====================================================
       MODEL TYPE
    ===================================================== */

    type:
        "image-to-image",


    /* =====================================================
       PENANDA JALUR SINKRON
       -----------------------------------------------------
       Dibaca api/generate.js: model dengan `synchronous`
       menyimpan gambar hasil sendiri (bukan menunggu
       polling), karena Tencent membalas gambar di response
       yang sama.
    ===================================================== */

    synchronous:
        true,

    adminEditor: {
        resolutionIndependent: true
    },


    /* =====================================================
       API
    ===================================================== */

    api: {

        host:
            "aiart.tencentcloudapi.com",

        action:
            "ImageToImage",

        version:
            "2022-12-29",

        region:
            "ap-guangzhou"

    }

};


export default config;
