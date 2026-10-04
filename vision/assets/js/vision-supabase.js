//vision-supabase.js?v=1.1
/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-supabase.js

   Fungsi:
   - Membuat Supabase client khusus Vision
   - Menggunakan konfigurasi global GENZ_CONFIG
   - Menyediakan window.supabaseClient
   - Tidak menangani UI
   - Tidak menangani credit
   - Tidak menangani history
   - Tidak menangani Vision API
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    function getConfig() {

        if (
            !window.GENZ_CONFIG
        ) {

            throw new Error(
                "GENZ_CONFIG belum tersedia."
            );

        }


        const url =
            String(
                window.GENZ_CONFIG.SUPABASE_URL ||
                ""
            ).trim();


        const key =
            String(
                window.GENZ_CONFIG.SUPABASE_KEY ||
                ""
            ).trim();


        if (
            !url ||
            !key
        ) {

            throw new Error(
                "Konfigurasi Supabase tidak lengkap."
            );

        }


        return {

            url,

            key

        };

    }


    /* =====================================================
       VALIDATE SUPABASE LIBRARY
    ===================================================== */

    function validateLibrary() {

        if (
            !window.supabase
        ) {

            throw new Error(
                "Supabase JS belum dimuat."
            );

        }


        if (
            typeof window.supabase.createClient !==
            "function"
        ) {

            throw new Error(
                "Supabase createClient tidak tersedia."
            );

        }


        return true;

    }


    /* =====================================================
       CREATE CLIENT
    ===================================================== */

    function createClient() {

        /*
         * Jika client sudah dibuat oleh
         * halaman lain / modul lain,
         * gunakan kembali.
         */

        if (
            window.supabaseClient
        ) {

            return window.supabaseClient;

        }


        validateLibrary();


        const config =
            getConfig();


        const client =
            window.supabase.createClient(

                config.url,

                config.key,

                {

                    auth: {

                        persistSession:
                            true,

                        autoRefreshToken:
                            true,

                        detectSessionInUrl:
                            true

                    }

                }

            );


        window.supabaseClient =
            client;


        return client;

    }


    /* =====================================================
       GET CLIENT
    ===================================================== */

    function getClient() {

        if (
            window.supabaseClient
        ) {

            return window.supabaseClient;

        }


        return createClient();

    }


    /* =====================================================
       HAS CLIENT
    ===================================================== */

    function hasClient() {

        return Boolean(
            window.supabaseClient &&
            typeof
                window.supabaseClient
                    .auth
                    ?.getSession ===
                "function"
        );

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        return createClient();

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const GENZVisionSupabase =
        Object.freeze({

            createClient,

            getClient,

            hasClient,

            initialize,

            getConfig

        });


    /* =====================================================
       GLOBAL EXPORT
    ===================================================== */

    window.GENZVisionSupabase =
        GENZVisionSupabase;


})();
