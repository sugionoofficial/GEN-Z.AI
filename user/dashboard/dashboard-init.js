/* =========================================================
   GEN-Z.AI
   USER DASHBOARD INITIALIZATION MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-init.js

   Tanggung jawab:
   - Menjalankan module dashboard dalam urutan yang benar
   - Cache DOM
   - Memastikan dependency tersedia
   - Menunggu navigation/auth shared selesai
   - Initialize modal
   - Initialize upload
   - Initialize events
   - Load video dari Supabase
   - Render dashboard
   - Menjamin modal tidak terbuka otomatis

   Tidak bertanggung jawab:
   - Auth implementation
   - Query Supabase langsung
   - CRUD langsung
   - Upload langsung
   - Render detail
   - Navigation implementation
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
       LOG
    ===================================================== */

    function log(...args) {

        console.log(
            "[GEN-Z.AI Dashboard]",
            ...args
        );
    }


    function logError(...args) {

        console.error(
            "[GEN-Z.AI Dashboard]",
            ...args
        );
    }


    /* =====================================================
       ERROR MESSAGE
    ===================================================== */

    function getErrorMessage(error) {

        if (!error) {

            return "Dashboard gagal dimuat.";
        }


        if (
            typeof error === "string"
        ) {

            return error;
        }


        if (
            error.message &&
            typeof error.message === "string"
        ) {

            return error.message;
        }


        return "Terjadi kesalahan saat memuat dashboard.";
    }


    /* =====================================================
       DOM CACHE
    ===================================================== */

    function cacheElements() {

        /*
         * dashboard-config.js adalah pemilik utama
         * cache element.
         */

        if (
            typeof dashboard.cacheElements !==
            "function"
        ) {

            throw new Error(
                "dashboard-config.js belum menyediakan cacheElements()."
            );
        }


        const elements =
            dashboard.cacheElements();


        /*
         * Simpan cache di namespace agar seluruh module
         * menggunakan object yang sama.
         */

        dashboard.elements =
            elements;


        return elements;
    }


    /* =====================================================
       DEPENDENCY CHECK
    ===================================================== */

    function checkDependencies() {

        const required = [

            {
                name: "dashboard-config",
                check: function () {

                    return (
                        dashboard.config &&
                        dashboard.configReady === true
                    );
                }
            },

            {
                name: "dashboard-state",
                check: function () {

                    return (
                        typeof dashboard.getVideos ===
                        "function"
                    );
                }
            },

            {
                name: "dashboard-auth",
                check: function () {

                    return (
                        typeof dashboard.initializeAuth ===
                        "function"
                    );
                }
            },

            {
                name: "dashboard-data",
                check: function () {

                    return (
                        typeof dashboard.loadVideos ===
                        "function"
                    );
                }
            },

            {
                name: "dashboard-render",
                check: function () {

                    return (
                        typeof dashboard.renderDashboard ===
                        "function"
                    );
                }
            },

            {
                name: "dashboard-modal",
                check: function () {

                    return (
                        typeof dashboard.initializeModal ===
                        "function"
                    );
                }
            },

            {
                name: "dashboard-upload",
                check: function () {

                    return (
                        typeof dashboard.initializeUpload ===
                        "function"
                    );
                }
            },

            {
                name: "dashboard-events",
                check: function () {

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
            missing.length > 0
        ) {

            const names =
                missing
                    .map(
                        function (item) {

                            return item.name;
                        }
                    )
                    .join(", ");


            throw new Error(
                "Module dashboard belum lengkap: " +
                names
            );
        }


        return true;
    }


    /* =====================================================
       SUPABASE CLIENT CHECK
    ===================================================== */

    function ensureSupabase() {

        /*
         * Dashboard tidak membuat client baru.
         *
         * Client harus berasal dari config.js.
         */

        if (
            typeof dashboard.requireSupabase ===
            "function"
        ) {

            const client =
                dashboard.requireSupabase();


            if (
                client
            ) {

                return client;
            }
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
       NAVIGATION / AUTH WAIT
    ===================================================== */

    async function waitForSharedNavigation() {

        /*
         * navigation.js melakukan:
         *
         * 1. Session validation
         * 2. Profile lookup
         * 3. Role validation
         * 4. Navigation rendering
         *
         * Dashboard tidak boleh mengulang proses tersebut.
         */


        /*
         * Jika navigation menyediakan Promise ready,
         * tunggu Promise tersebut.
         */

        if (
            window.GENZNavigationReady &&
            typeof window.GENZNavigationReady.then ===
            "function"
        ) {

            try {

                await window.GENZNavigationReady;

            } catch (error) {

                logError(
                    "Navigation ready error:",
                    error
                );
            }
        }


        /*
         * Beberapa versi navigation menggunakan
         * global state setelah initialization.
         */

        if (
            window.GENZ_NAVIGATION_PROFILE
        ) {

            /*
             * Sinkronkan informasi navigation ke dashboard
             * hanya sebagai state UI.
             *
             * Ini BUKAN sumber otorisasi.
             */

            if (
                typeof dashboard.setCurrentUser ===
                "function" &&
                window.GENZ_NAVIGATION_USER
            ) {

                dashboard.setCurrentUser(
                    window.GENZ_NAVIGATION_USER
                );
            }


            if (
                typeof dashboard.setCurrentProfile ===
                "function"
            ) {

                dashboard.setCurrentProfile(
                    window.GENZ_NAVIGATION_PROFILE
                );
            }


            if (
                typeof dashboard.setRole ===
                "function" &&
                window.GENZ_NAVIGATION_ROLE
            ) {

                dashboard.setRole(
                    window.GENZ_NAVIGATION_ROLE
                );
            }
        }


        /*
         * Dashboard auth tetap digunakan untuk state
         * dashboard sendiri.
         *
         * Tetapi auth module harus memanfaatkan session
         * yang sudah ada, bukan membuat sistem auth kedua.
         */

        if (
            typeof dashboard.initializeAuth ===
            "function"
        ) {

            const result =
                await dashboard.initializeAuth();


            if (
                result === false
            ) {

                /*
                 * Auth module mungkin melakukan redirect.
                 * Jangan teruskan loading dashboard.
                 */

                return false;
            }
        }


        return true;
    }


    /* =====================================================
       INITIALIZE UI MODULES
    ===================================================== */

    function initializeUI() {

        /*
         * Modal
         */

        dashboard.initializeModal();


        /*
         * Upload
         */

        dashboard.initializeUpload();


        /*
         * Events
         */

        dashboard.initializeEvents();
    }


    /* =====================================================
       FORCE MODAL CLOSED
    ===================================================== */

    function forceCloseModal() {

        /*
         * Sangat penting untuk bug:
         *
         * Admin / Owner masuk dashboard
         * → form edit langsung muncul
         *
         * Tidak boleh terjadi.
         */

        if (
            typeof dashboard.closeModal ===
            "function"
        ) {

            dashboard.closeModal();
        }


        const modal =
            dashboard.elements &&
            dashboard.elements.videoModal;


        if (
            modal
        ) {

            modal.hidden =
                true;


            modal.classList.add(
                "hidden"
            );


            modal.setAttribute(
                "aria-hidden",
                "true"
            );
        }


        if (
            typeof dashboard.setModalState ===
            "function"
        ) {

            dashboard.setModalState(
                false,
                null,
                null
            );
        }
    }


    /* =====================================================
       LOAD VIDEOS
    ===================================================== */

    async function loadDashboardVideos() {

        if (
            typeof dashboard.loadVideos !==
            "function"
        ) {

            throw new Error(
                "dashboard-data.js belum menyediakan loadVideos()."
            );
        }


        /*
         * User:
         *   hanya video aktif.
         *
         * Admin / Owner + edit mode:
         *   boleh melihat inactive untuk management.
         */

        let includeInactive =
            false;


        if (
            typeof dashboard.isEditMode ===
            "function" &&
            typeof dashboard.hasManagementAccess ===
            "function"
        ) {

            includeInactive =
                dashboard.isEditMode() &&
                dashboard.hasManagementAccess();
        }


        const videos =
            await dashboard.loadVideos({

                includeInactive:
                    includeInactive

            });


        return videos || [];
    }


    /* =====================================================
       INITIAL RENDER
    ===================================================== */

    function renderDashboard() {

        if (
            typeof dashboard.renderDashboard !==
            "function"
        ) {

            throw new Error(
                "dashboard-render.js belum menyediakan renderDashboard()."
            );
        }


        dashboard.renderDashboard();
    }


    /* =====================================================
       READY STATE
    ===================================================== */

    function markReady() {

        dashboard.initialized =
            true;


        dashboard.ready =
            true;


        if (
            typeof dashboard.setInitialized ===
            "function"
        ) {

            dashboard.setInitialized(
                true
            );
        }


        const root =
            dashboard.elements &&
            dashboard.elements.page;


        if (
            root
        ) {

            root.setAttribute(
                "data-dashboard-ready",
                "true"
            );


            root.classList.add(
                "dashboard-ready"
            );
        }


        document.body.setAttribute(
            "data-dashboard-ready",
            "true"
        );
    }


    /* =====================================================
       ERROR STATE
    ===================================================== */

    function handleInitializationError(
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
         * Render error state melalui renderer.
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
                "Gagal render error state:",
                renderError
            );
        }


        return message;
    }


    /* =====================================================
       MAIN INITIALIZATION
    ===================================================== */

    async function initializeDashboard() {

        if (
            initialized
        ) {

            return true;
        }


        if (
            initializing
        ) {

            return false;
        }


        initializing =
            true;


        try {

            log(
                "Starting dashboard initialization..."
            );


            /* ---------------------------------------------
               1. DOM
            --------------------------------------------- */

            cacheElements();


            /* ---------------------------------------------
               2. Dependency
            --------------------------------------------- */

            checkDependencies();


            /* ---------------------------------------------
               3. Supabase
            --------------------------------------------- */

            ensureSupabase();


            /* ---------------------------------------------
               4. Shared Auth / Navigation
            --------------------------------------------- */

            const authenticated =
                await waitForSharedNavigation();


            if (
                authenticated === false
            ) {

                return false;
            }


            /* ---------------------------------------------
               5. UI modules
            --------------------------------------------- */

            initializeUI();


            /* ---------------------------------------------
               6. Force modal closed
            --------------------------------------------- */

            forceCloseModal();


            /* ---------------------------------------------
               7. Load video
            --------------------------------------------- */

            await loadDashboardVideos();


            /* ---------------------------------------------
               8. Render
            --------------------------------------------- */

            renderDashboard();


            /* ---------------------------------------------
               9. Close modal again
               --------------------------------------------- */

            /*
             * Defensive.
             *
             * Jika module lain mengubah modal selama render,
             * dashboard tetap dimulai dalam kondisi tertutup.
             */

            forceCloseModal();


            /* ---------------------------------------------
               10. READY
            --------------------------------------------- */

            initialized =
                true;


            markReady();


            log(
                "Dashboard initialized successfully."
            );


            return true;

        } catch (error) {

            handleInitializationError(
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
       PUBLIC API
    ===================================================== */

    dashboard.checkDependencies =
        checkDependencies;


    dashboard.ensureDashboardSupabase =
        ensureSupabase;


    dashboard.waitForSharedNavigation =
        waitForSharedNavigation;


    dashboard.loadDashboardVideos =
        loadDashboardVideos;


    dashboard.renderInitialDashboard =
        renderDashboard;


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

    function start() {

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


    start();

})();
