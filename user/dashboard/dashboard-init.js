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
   - Menunggu shared navigation/auth state
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
       LOGGING
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

        if (
            !error
        ) {

            return "Dashboard gagal dimuat.";
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
       DOM CACHE
    ===================================================== */

    function cacheElements() {

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
                        "function" &&
                        typeof dashboard.setInitialized ===
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

                        return (
                            !item.check()
                        );

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
       SUPABASE CHECK
    ===================================================== */

    function ensureSupabase() {

        /*
         * Dashboard tidak membuat Supabase client baru.
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
       CHECK SHARED NAVIGATION STATE
    ===================================================== */

    function hasSharedNavigationState() {

        return !!(
            window.GENZ_NAVIGATION_USER &&
            window.GENZ_NAVIGATION_PROFILE &&
            window.GENZ_NAVIGATION_ROLE
        );
    }


    /* =====================================================
       WAIT FOR SHARED NAVIGATION
       -----------------------------------------------------
       navigation/navigation.js berjalan lebih dahulu,
       tetapi proses auth/profile bersifat async.

       Kita tunggu state navigation sebentar agar dashboard
       tidak langsung melakukan query profile kedua.
    ===================================================== */

    async function waitForNavigationState(
        timeout
    ) {

        const maxWait =
            Number.isFinite(
                Number(timeout)
            )
                ? Number(timeout)
                : 3000;


        const interval =
            50;


        const startedAt =
            Date.now();


        /*
         * Jika state sudah tersedia, langsung lanjut.
         */

        if (
            hasSharedNavigationState()
        ) {

            return true;
        }


        /*
         * Jika navigation menyediakan Promise ready,
         * gunakan terlebih dahulu.
         */

        if (
            window.GENZNavigationReady &&
            typeof window.GENZNavigationReady.then ===
            "function"
        ) {

            try {

                await Promise.race([

                    window.GENZNavigationReady,

                    new Promise(
                        function (resolve) {

                            setTimeout(
                                resolve,
                                maxWait
                            );
                        }
                    )

                ]);

            } catch (error) {

                logError(
                    "Shared navigation promise error:",
                    error
                );
            }


            if (
                hasSharedNavigationState()
            ) {

                return true;
            }
        }


        /*
         * Fallback untuk navigation.js versi yang
         * menggunakan global state tanpa Promise.
         */

        while (
            Date.now() -
            startedAt <
            maxWait
        ) {

            if (
                hasSharedNavigationState()
            ) {

                return true;
            }


            /*
             * Beri kesempatan navigation.js menyelesaikan
             * request Supabase.
             */

            await new Promise(
                function (resolve) {

                    setTimeout(
                        resolve,
                        interval
                    );
                }
            );
        }


        return hasSharedNavigationState();
    }


    /* =====================================================
       SYNC NAVIGATION STATE
    ===================================================== */

    function syncNavigationState() {

        const user =
            window.GENZ_NAVIGATION_USER;


        const profile =
            window.GENZ_NAVIGATION_PROFILE;


        const role =
            window.GENZ_NAVIGATION_ROLE;


        if (
            user &&
            typeof dashboard.setCurrentUser ===
            "function"
        ) {

            dashboard.setCurrentUser(
                user
            );
        }


        if (
            profile &&
            typeof dashboard.setCurrentProfile ===
            "function"
        ) {

            dashboard.setCurrentProfile(
                profile
            );
        }


        if (
            role &&
            typeof dashboard.setRole ===
            "function"
        ) {

            dashboard.setRole(
                role
            );
        }


        return !!(
            user &&
            profile &&
            role
        );
    }


    /* =====================================================
       SHARED AUTH / NAVIGATION
    ===================================================== */

    async function waitForSharedNavigation() {

        /*
         * Jangan langsung menjalankan dashboard auth.
         *
         * navigation.js sudah bertanggung jawab terhadap:
         *
         * - session
         * - profile
         * - role
         * - status account
         * - redirect login
         *
         * Dashboard hanya mengambil state yang sudah tersedia.
         */

        const navigationReady =
            await waitForNavigationState(
                3000
            );


        if (
            navigationReady
        ) {

            syncNavigationState();
        }


        /*
         * initializeAuth() tetap dipanggil karena dashboard
         * membutuhkan state internalnya sendiri.
         *
         * dashboard-auth.js akan:
         *
         * 1. memakai state navigation jika tersedia
         * 2. fallback ke Supabase hanya jika state navigation
         *    belum tersedia
         */

        if (
            typeof dashboard.initializeAuth !==
            "function"
        ) {

            throw new Error(
                "dashboard-auth.js belum menyediakan initializeAuth()."
            );
        }


        const result =
            await dashboard.initializeAuth();


        if (
            result === false
        ) {

            /*
             * Biasanya terjadi ketika auth module
             * sedang melakukan redirect.
             */

            return false;
        }


        return true;
    }


    /* =====================================================
       INITIALIZE UI MODULES
    ===================================================== */

    function initializeUI() {

        /*
         * Modal lifecycle
         */

        dashboard.initializeModal();


        /*
         * Upload/form lifecycle
         */

        dashboard.initializeUpload();


        /*
         * Button/event delegation
         */

        dashboard.initializeEvents();
    }


    /* =====================================================
       FORCE MODAL CLOSED
    ===================================================== */

    function forceCloseModal() {

        /*
         * Dashboard tidak boleh otomatis membuka Add/Edit
         * modal hanya karena user adalah ADMIN/OWNER
         * atau karena ?edit=1.
         */

        if (
            typeof dashboard.forceCloseModal ===
            "function"
        ) {

            dashboard.forceCloseModal();

            return;
        }


        /*
         * Fallback jika API forceCloseModal belum tersedia.
         */

        if (
            typeof dashboard.closeModal ===
            "function"
        ) {

            try {

                dashboard.closeModal();

            } catch (error) {

                logError(
                    "closeModal fallback error:",
                    error
                );
            }
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
         * Default:
         *
         * USER
         *   -> active saja
         *
         * ADMIN / OWNER
         *   -> active saja
         *
         * ADMIN / OWNER + ?edit=1
         *   -> active + inactive
         */

        let includeInactive =
            false;


        const editMode =
            typeof dashboard.isEditMode ===
            "function"
                ? dashboard.isEditMode() === true
                : false;


        const managementAccess =
            typeof dashboard.hasManagementAccess ===
            "function"
                ? dashboard.hasManagementAccess() === true
                : false;


        if (
            editMode &&
            managementAccess
        ) {

            includeInactive =
                true;
        }


        log(
            "Loading dashboard videos:",
            {
                editMode,
                managementAccess,
                includeInactive
            }
        );


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
         * Tetap gunakan renderer agar error state
         * mengikuti UI dashboard.
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
               1. CACHE DOM
            --------------------------------------------- */

            cacheElements();


            /* ---------------------------------------------
               2. CHECK MODULES
            --------------------------------------------- */

            checkDependencies();


            /* ---------------------------------------------
               3. CHECK SUPABASE
            --------------------------------------------- */

            ensureSupabase();


            /* ---------------------------------------------
               4. INITIALIZE EDIT MODE STATE
            --------------------------------------------- */

            if (
                typeof dashboard.initializeEditMode ===
                "function"
            ) {

                dashboard.initializeEditMode();
            }


            /* ---------------------------------------------
               5. SHARED NAVIGATION + AUTH
            --------------------------------------------- */

            const authenticated =
                await waitForSharedNavigation();


            if (
                authenticated === false
            ) {

                return false;
            }


            /* ---------------------------------------------
               6. INITIALIZE UI MODULES
            --------------------------------------------- */

            initializeUI();


            /* ---------------------------------------------
               7. FORCE MODAL CLOSED
            --------------------------------------------- */

            forceCloseModal();


            /* ---------------------------------------------
               8. LOAD VIDEOS
            --------------------------------------------- */

            await loadDashboardVideos();


            /* ---------------------------------------------
               9. INITIAL RENDER
            --------------------------------------------- */

            renderDashboard();


            /* ---------------------------------------------
               10. DEFENSIVE MODAL CLOSE
            --------------------------------------------- */

            /*
             * Render tidak seharusnya membuka modal.
             * Tetap dipastikan tertutup sebagai guard terakhir.
             */

            forceCloseModal();


            /* ---------------------------------------------
               11. READY
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

    dashboard.checkDashboardDependencies =
        checkDependencies;


    dashboard.ensureDashboardSupabase =
        ensureSupabase;


    dashboard.hasSharedNavigationState =
        hasSharedNavigationState;


    dashboard.waitForNavigationState =
        waitForNavigationState;


    dashboard.syncNavigationState =
        syncNavigationState;


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
