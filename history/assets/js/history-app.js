/* =========================================================
   GEN-Z.AI
   HISTORY APP BOOTSTRAP MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-app.js

   Tanggung jawab:
   - Bootstrap halaman History
   - Resolve DOM
   - Initialize Auth
   - Bind Events
   - Load History
   - Start status monitor
   - Mencegah double initialization
   - Menangani error startup

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Render tabel
   - Render modal
   - Polling status secara langsung
   - Logic logout/navigation
   ========================================================= */

(function () {
    "use strict";

    window.GENZHistory = window.GENZHistory || {};

    const App = window.GENZHistory;

    /* =====================================================
       STATE
       ===================================================== */

    App.state = App.state || {};

    if (typeof App.state.appInitialized !== "boolean") {
        App.state.appInitialized = false;
    }

    if (typeof App.state.appInitializing !== "boolean") {
        App.state.appInitializing = false;
    }


    /* =====================================================
       STARTUP ERROR HANDLER
       ===================================================== */

    function handleStartupError(error) {
        console.error(
            "[GEN-Z.AI History] Startup error:",
            error
        );

        const message =
            error &&
            error.message
                ? error.message
                : "Gagal memuat halaman History.";

        /*
         * Jangan membuat halaman menjadi blank.
         * Jika module event menyediakan showMessage(),
         * gunakan mekanisme tersebut.
         */
        try {
            if (typeof App.showMessage === "function") {
                App.showMessage(
                    message,
                    "error"
                );

                return;
            }
        } catch (messageError) {
            console.error(
                "[GEN-Z.AI History] Message handler error:",
                messageError
            );
        }

        /*
         * Fallback langsung ke elemen message.
         */
        try {
            const messageElement =
                App.elements &&
                App.elements.message
                    ? App.elements.message
                    : document.getElementById("message");

            if (messageElement) {
                messageElement.textContent = message;
                messageElement.style.display = "block";
                messageElement.className =
                    "message error";
            }
        } catch (fallbackError) {
            console.error(
                "[GEN-Z.AI History] Error fallback failed:",
                fallbackError
            );
        }
    }


    /* =====================================================
       RESOLVE DOM
       ===================================================== */

    function resolveElements() {
        if (typeof App.resolveElements !== "function") {
            throw new Error(
                "History state module belum dimuat."
            );
        }

        App.resolveElements();
    }


    /* =====================================================
       INITIALIZE AUTH
       ===================================================== */

    async function initializeAuthentication() {
        if (typeof App.initializeAuth !== "function") {
            throw new Error(
                "History auth module belum dimuat."
            );
        }

        await App.initializeAuth();
    }


    /* =====================================================
       BIND EVENTS
       ===================================================== */

    function bindEvents() {
        if (typeof App.bindHistoryEvents !== "function") {
            throw new Error(
                "History events module belum dimuat."
            );
        }

        App.bindHistoryEvents();
    }


    /* =====================================================
       LOAD HISTORY
       ===================================================== */

    async function loadInitialHistory() {
        if (typeof App.loadHistory !== "function") {
            throw new Error(
                "History data module belum dimuat."
            );
        }

        await App.loadHistory({
            silent: false
        });
    }


    /* =====================================================
       START STATUS MONITOR
       ===================================================== */

    async function startStatusMonitor() {
        /*
         * Status monitor bersifat tambahan.
         * Jika module belum tersedia, jangan membuat
         * halaman History gagal total.
         */
        if (
            typeof App.startHistoryStatusMonitor !==
            "function"
        ) {
            console.warn(
                "[GEN-Z.AI History] Status monitor module tidak tersedia."
            );

            return;
        }

        try {
            await App.startHistoryStatusMonitor();
        } catch (error) {
            /*
             * Polling gagal tidak boleh menghancurkan
             * halaman History yang sudah berhasil dimuat.
             */
            console.error(
                "[GEN-Z.AI History] Status monitor error:",
                error
            );
        }
    }


    /* =====================================================
       MAIN INITIALIZER
       ===================================================== */

    async function init() {

        /*
         * Mencegah init dipanggil dua kali.
         */
        if (App.state.appInitialized) {
            return;
        }

        /*
         * Mencegah init berjalan bersamaan.
         */
        if (App.state.appInitializing) {
            return;
        }

        App.state.appInitializing = true;

        try {

            /* ---------------------------------------------
               1. Resolve DOM
               --------------------------------------------- */

            resolveElements();


            /* ---------------------------------------------
               2. Bind UI Events
               --------------------------------------------- */

            bindEvents();


            /* ---------------------------------------------
               3. Authentication + Profile
               --------------------------------------------- */

            await initializeAuthentication();


            /* ---------------------------------------------
               4. Load History
               --------------------------------------------- */

            await loadInitialHistory();


            /* ---------------------------------------------
               5. Start Generation Status Monitor
               --------------------------------------------- */

            await startStatusMonitor();


            /* ---------------------------------------------
               INITIALIZATION SUCCESS
               --------------------------------------------- */

            App.state.appInitialized = true;

            console.info(
                "[GEN-Z.AI History] Initialized successfully."
            );

        } catch (error) {

            /*
             * Tandai gagal supaya state tidak menganggap
             * aplikasi berhasil initialized.
             */
            App.state.appInitialized = false;

            handleStartupError(error);

        } finally {

            App.state.appInitializing = false;
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    App.init = init;

    /*
     * Compatibility alias.
     * Berguna jika ada bagian lama halaman yang
     * memanggil initializer secara global.
     */
    window.GENZHistoryAppInit = init;


    /* =====================================================
       DOM READY
       ===================================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            function () {
                init();
            },
            {
                once: true
            }
        );

    } else {

        /*
         * Jika script dimuat setelah DOM selesai,
         * langsung initialize.
         */
        init();
    }

})();
