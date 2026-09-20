/* =========================================================
   GEN-Z.AI
   USER DASHBOARD INITIALIZATION MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-init.js

   Tanggung jawab:
   - Menjalankan seluruh module dashboard
   - Memastikan dependency tersedia
   - Menjalankan auth
   - Menjalankan navigation
   - Menjalankan modal
   - Menjalankan upload
   - Menjalankan events
   - Memuat data video
   - Render awal dashboard

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - CRUD video
   - Upload Storage
   - HTML rendering detail
   - CSS
   - Implementasi authentication
   - Implementasi navigation
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       NAMESPACE
    ===================================================== */

    window.GENZDashboard =
        window.GENZDashboard || {};

    const dashboard =
        window.GENZDashboard;


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let initialized = false;

    let initializing = false;


    /* =====================================================
       ERROR MESSAGE
    ===================================================== */

    function getErrorMessage(error) {

        if (!error) {

            return (
                "Dashboard gagal dimuat."
            );
        }


        if (
            typeof error ===
            "string"
        ) {

            return error;
        }


        if (
            error.message &&
            typeof error.message ===
            "string"
        ) {

            return error.message;
        }


        return (
            "Terjadi kesalahan saat memuat dashboard."
        );
    }


    /* =====================================================
       LOG
    ===================================================== */

    function log(
        ...args
    ) {

        console.log(
            "[GEN-Z.AI Dashboard]",
            ...args
        );
    }


    function logError(
        ...args
    ) {

        console.error(
            "[GEN-Z.AI Dashboard]",
            ...args
        );
    }


    /* =====================================================
       DEPENDENCY CHECK
    ===================================================== */

    function checkDependencies() {

        const required =
            [

                {
                    name:
                        "dashboard-config",
                    check:
                        function () {

                            return (
                                dashboard.config &&
                                typeof dashboard.config ===
                                "object"
                            );
                        }
                },

                {
                    name:
                        "dashboard-state",
                    check:
                        function () {

                            return (
                                typeof dashboard.getVideos ===
                                "function"
                            );
                        }
                },

                {
                    name:
                        "dashboard-auth",
                    check:
                        function () {

                            return (
                                typeof dashboard.initializeAuth ===
                                "function"
                            );
                        }
                },

                {
                    name:
                        "dashboard-data",
                    check:
                        function () {

                            return (
                                typeof dashboard.loadVideos ===
                                "function"
                            );
                        }
                },

                {
                    name:
                        "dashboard-render",
                    check:
                        function () {

                            return (
                                typeof dashboard.renderDashboard ===
                                "function"
                            );
                        }
                },

                {
                    name:
                        "dashboard-modal",
                    check:
                        function () {

                            return (
                                typeof dashboard.initializeModal ===
                                "function"
                            );
                        }
                },

                {
                    name:
                        "dashboard-upload",
                    check:
                        function () {

                            return (
                                typeof dashboard.initializeUpload ===
                                "function"
                            );
                        }
                },

                {
                    name:
                        "dashboard-events",
                    check:
                        function () {

                            return (
                                typeof dashboard.initializeEvents ===
                                "function"
                            );
                        }
                }

            ];


        const missing =
            required.filter(
                function (item) {

                    try {

                        return !item.check();

                    } catch (error) {

                        return true;
                    }
                }
            );


        if (
            missing.length
        ) {

            const names =
                missing
                    .map(
                        function (item) {

                            return item.name;

                        }
                    )
                    .join(
                        ", "
                    );


            throw new Error(
                "Module dashboard belum lengkap: " +
                names
            );
        }


        return true;
    }


    /* =====================================================
       CACHE ELEMENTS
    ===================================================== */

    function cacheElements() {

        /*
         * Jika state module sudah menyediakan cache,
         * gunakan itu.
         */

        if (
            typeof dashboard.cacheElements ===
            "function"
        ) {

            return dashboard.cacheElements();
        }


        /*
         * Fallback.
         *
         * State module seharusnya menyediakan fungsi ini,
         * tetapi fallback membuat initialization lebih aman.
         */

        const elements = {

            dashboardRoot:
                document.querySelector(
                    "[data-dashboard-root]"
                ) ||
                document.getElementById(
                    "dashboard"
                ),


            categoryFilters:
                document.querySelector(
                    "[data-dashboard-category-filter]"
                ) ||
                document.getElementById(
                    "categoryFilters"
                ),


            videoGrid:
                document.querySelector(
                    "[data-video-grid]"
                ) ||
                document.getElementById(
                    "videoGrid"
                ),


            videoModal:
                document.getElementById(
                    "videoModal"
                ),


            videoForm:
                document.getElementById(
                    "videoForm"
                ),


            videoId:
                document.getElementById(
                    "videoId"
                ),


            videoTitle:
                document.getElementById(
                    "videoTitle"
                ),


            videoDescription:
                document.getElementById(
                    "videoDescription"
                ),


            videoCategory:
                document.getElementById(
                    "videoCategory"
                ),


            videoAspectRatio:
                document.getElementById(
                    "videoAspectRatio"
                ),


            videoFile:
                document.getElementById(
                    "videoFile"
                ),


            thumbnailFile:
                document.getElementById(
                    "thumbnailFile"
                ),


            videoSortOrder:
                document.getElementById(
                    "videoSortOrder"
                ),


            videoIsActive:
                document.getElementById(
                    "videoIsActive"
                ),


            currentVideoFile:
                document.getElementById(
                    "currentVideoFile"
                ),


            currentThumbnailFile:
                document.getElementById(
                    "currentThumbnailFile"
                ),


            uploadProgress:
                document.getElementById(
                    "uploadProgress"
                ),


            uploadProgressPercent:
                document.getElementById(
                    "uploadProgressPercent"
                ),


            uploadProgressBar:
                document.getElementById(
                    "uploadProgressBar"
                ),


            uploadProgressText:
                document.getElementById(
                    "uploadProgressText"
                ),


            modalTitle:
                document.getElementById(
                    "modalTitle"
                ),


            modalClose:
                document.getElementById(
                    "modalClose"
                ),


            cancelModalButton:
                document.getElementById(
                    "cancelModalButton"
                ),


            addVideoButton:
                document.getElementById(
                    "addVideoButton"
                ),


            retryButton:
                document.getElementById(
                    "retryButton"
                ),


            adminBackButton:
                document.getElementById(
                    "adminBackButton"
                ),


            managementButton:
                document.getElementById(
                    "managementButton"
                )

        };


        dashboard.elements =
            elements;


        return elements;
    }


    /* =====================================================
       SUPABASE CHECK
    ===================================================== */

    function ensureSupabase() {

        /*
         * Config.js seharusnya sudah menyediakan client.
         * Dashboard tidak membuat client kedua.
         */

        if (
            typeof dashboard.requireSupabase ===
            "function"
        ) {

            return dashboard.requireSupabase();
        }


        if (
            window.supabaseClient
        ) {

            return window.supabaseClient;
        }


        if (
            window.GENZ_SUPABASE
        ) {

            return window.GENZ_SUPABASE;
        }


        throw new Error(
            "Supabase client belum tersedia."
        );
    }


    /* =====================================================
       NAVIGATION
    ===================================================== */

    async function initializeNavigation() {

        /*
         * Navigation adalah module global.
         *
         * Dashboard tidak mengimplementasikan navigation
         * sendiri.
         */

        try {

            if (
                typeof window.GENZNavigation !==
                "undefined"
            ) {

                const navigation =
                    window.GENZNavigation;


                if (
                    typeof navigation.init ===
                    "function"
                ) {

                    await navigation.init();

                    log(
                        "Navigation initialized."
                    );

                    return true;
                }


                if (
                    typeof navigation.initialize ===
                    "function"
                ) {

                    await navigation.initialize();

                    log(
                        "Navigation initialized."
                    );

                    return true;
                }
            }


            /*
             * Beberapa versi navigation.js mungkin
             * menggunakan global function.
             */

            if (
                typeof window.initializeNavigation ===
                "function"
            ) {

                await window.initializeNavigation();

                log(
                    "Navigation initialized."
                );

                return true;
            }


            /*
             * Navigation optional pada saat development.
             *
             * Jangan menggagalkan dashboard hanya karena
             * navigation belum tersedia.
             */

            log(
                "Navigation module belum tersedia, dashboard tetap dilanjutkan."
            );


            return false;

        } catch (error) {

            /*
             * Navigation error tidak boleh menghapus
             * fungsi utama dashboard.
             */

            logError(
                "Navigation initialization failed:",
                error
            );


            return false;
        }
    }


    /* =====================================================
       AUTH
    ===================================================== */

    async function initializeAuthentication() {

        if (
            typeof dashboard.initializeAuth !==
            "function"
        ) {

            throw new Error(
                "Authentication module tidak tersedia."
            );
        }


        const result =
            await dashboard.initializeAuth();


        /*
         * Auth module bertanggung jawab terhadap:
         * - session
         * - profile
         * - role
         * - active status
         * - redirect
         * - edit mode permission
         */


        if (
            result === false
        ) {

            throw new Error(
                "Autentikasi dashboard gagal."
            );
        }


        return result;
    }


    /* =====================================================
       INITIALIZE UI MODULES
    ===================================================== */

    function initializeUI() {

        /*
         * Modal.
         */

        if (
            typeof dashboard.initializeModal ===
            "function"
        ) {

            dashboard.initializeModal();
        }


        /*
         * Upload.
         */

        if (
            typeof dashboard.initializeUpload ===
            "function"
        ) {

            dashboard.initializeUpload();
        }


        /*
         * Events.
         */

        if (
            typeof dashboard.initializeEvents ===
            "function"
        ) {

            dashboard.initializeEvents();
        }
    }


    /* =====================================================
       LOAD VIDEO DATA
    ===================================================== */

    async function loadDashboardVideos() {

        if (
            typeof dashboard.loadVideos !==
            "function"
        ) {

            throw new Error(
                "Video data module tidak tersedia."
            );
        }


        /*
         * Admin / Owner pada edit mode boleh melihat
         * video inactive.
         *
         * User biasa hanya mendapat video aktif.
         */

        const includeInactive =
            typeof dashboard.isEditMode ===
            "function" &&
            typeof dashboard.hasManagementAccess ===
            "function" &&
            dashboard.isEditMode() &&
            dashboard.hasManagementAccess();


        await dashboard.loadVideos({

            includeInactive:
                includeInactive

        });


        return (
            typeof dashboard.getVideos ===
            "function"
                ? dashboard.getVideos()
                : []
        );
    }


    /* =====================================================
       INITIAL RENDER
    ===================================================== */

    function renderInitialDashboard() {

        if (
            typeof dashboard.renderDashboard !==
            "function"
        ) {

            throw new Error(
                "Render module tidak tersedia."
            );
        }


        dashboard.renderDashboard();
    }


    /* =====================================================
       CLOSE MODAL ON START
    ===================================================== */

    function forceCloseModalOnStartup() {

        /*
         * Admin / Owner masuk edit mode TIDAK berarti
         * form otomatis terbuka.
         *
         * Ini penting untuk bug sebelumnya:
         * form edit muncul otomatis dan tidak bisa ditutup.
         */

        if (
            typeof dashboard.closeModal ===
            "function"
        ) {

            dashboard.closeModal();
        }
    }


    /* =====================================================
       READY UI
    ===================================================== */

    function markDashboardReady() {

        const root =
            dashboard.elements &&
            dashboard.elements.dashboardRoot
                ? dashboard.elements.dashboardRoot
                : document.querySelector(
                    "[data-dashboard-root]"
                );


        if (!root) {
            return;
        }


        root.setAttribute(
            "data-dashboard-ready",
            "true"
        );


        root.classList.add(
            "dashboard-ready"
        );
    }


    /* =====================================================
       ERROR UI
    ===================================================== */

    function renderInitializationError(
        error
    ) {

        const message =
            getErrorMessage(
                error
            );


        logError(
            message,
            error
        );


        if (
            typeof dashboard.setError ===
            "function"
        ) {

            dashboard.setError(
                error
            );
        }


        /*
         * Coba gunakan render module untuk menampilkan
         * error secara konsisten.
         */

        try {

            if (
                typeof dashboard.renderDashboard ===
                "function"
            ) {

                dashboard.renderDashboard();
            }

        } catch (renderError) {

            logError(
                "Error renderer juga gagal:",
                renderError
            );
        }


        /*
         * Fallback console.
         *
         * Tidak membuat alert browser karena alert
         * mengganggu UX dashboard.
         */

        return message;
    }


    /* =====================================================
       MAIN INITIALIZATION
    ===================================================== */

    async function initializeDashboard() {

        if (initialized) {

            return true;
        }


        if (initializing) {

            return false;
        }


        initializing = true;


        try {

            log(
                "Initializing dashboard..."
            );


            /* ---------------------------------------------
               1. Cache DOM
            --------------------------------------------- */

            cacheElements();


            /* ---------------------------------------------
               2. Check modules
            --------------------------------------------- */

            checkDependencies();


            /* ---------------------------------------------
               3. Supabase
            --------------------------------------------- */

            ensureSupabase();


            /* ---------------------------------------------
               4. Authentication
            --------------------------------------------- */

            await initializeAuthentication();


            /*
             * Auth module dapat melakukan redirect.
             *
             * Jika halaman masih aktif, lanjut.
             */

            if (
                !document.body
            ) {

                throw new Error(
                    "DOM dashboard belum siap."
                );
            }


            /* ---------------------------------------------
               5. Navigation
            --------------------------------------------- */

            await initializeNavigation();


            /* ---------------------------------------------
               6. UI modules
            --------------------------------------------- */

            initializeUI();


            /* ---------------------------------------------
               7. Force close modal
            --------------------------------------------- */

            forceCloseModalOnStartup();


            /* ---------------------------------------------
               8. Load videos
            --------------------------------------------- */

            await loadDashboardVideos();


            /* ---------------------------------------------
               9. Initial render
            --------------------------------------------- */

            renderInitialDashboard();


            /* ---------------------------------------------
               10. Ready
            --------------------------------------------- */

            markDashboardReady();


            initialized =
                true;


            dashboard.initialized =
                true;


            dashboard.ready =
                true;


            log(
                "Dashboard initialized successfully."
            );


            return true;

        } catch (error) {

            renderInitializationError(
                error
            );


            dashboard.initialized =
                false;


            dashboard.ready =
                false;


            return false;

        } finally {

            initializing =
                false;
        }
    }


    /* =====================================================
       DOM READY
    ===================================================== */

    function start() {

        /*
         * Jika DOM sudah siap, langsung jalankan.
         */

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                function () {

                    initializeDashboard();

                },
                {
                    once: true
                }
            );

            return;
        }


        initializeDashboard();
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    dashboard.checkDependencies =
        checkDependencies;

    dashboard.initializeNavigation =
        initializeNavigation;

    dashboard.initializeAuthentication =
        initializeAuthentication;

    dashboard.loadDashboardVideos =
        loadDashboardVideos;

    dashboard.renderInitialDashboard =
        renderInitialDashboard;

    dashboard.initializeDashboard =
        initializeDashboard;


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.initReady =
        true;


    /* =====================================================
       START
    ===================================================== */

    start();

})();
