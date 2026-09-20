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
   - Menunggu shared navigation/auth state tanpa
     menjadikannya dependency wajib untuk loading video
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

        if (!error) {

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
       SHARED NAVIGATION STATE
    ===================================================== */

    function hasSharedNavigationState() {

        /*
         * Navigation state hanya dianggap tersedia jika
         * user + profile + role semuanya sudah siap.
         */

        return !!(
            window.GENZ_NAVIGATION_USER &&
            window.GENZ_NAVIGATION_PROFILE &&
            window.GENZ_NAVIGATION_ROLE
        );
    }


    /* =====================================================
       WAIT FOR SHARED NAVIGATION
       -----------------------------------------------------
       Navigation adalah shared UI/auth layer.
       Dashboard tidak boleh menggantung hanya karena
       navigation belum selesai render.

       Auth dashboard tetap melakukan fallback ke Supabase
       melalui dashboard-auth.js.
    ===================================================== */

    async function waitForNavigationState(
        timeout
    ) {

        const numericTimeout =
            Number(timeout);


        const maxWait =
            Number.isFinite(
                numericTimeout
            )
                ? Math.max(
                    0,
                    numericTimeout
                )
                : 1500;


        const interval =
            50;


        const startedAt =
            Date.now();


        /*
         * State sudah tersedia.
         */

        if (
            hasSharedNavigationState()
        ) {

            return true;
        }


        /*
         * Gunakan Promise ready bila navigation.js
         * menyediakannya.
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

                /*
                 * Navigation gagal bukan berarti dashboard
                 * harus ikut gagal.
                 *
                 * dashboard-auth.js masih mempunyai fallback
                 * authentication melalui Supabase.
                 */

                logError(
                    "Navigation ready promise error:",
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
         * Fallback polling.
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


            await new Promise(
                function (resolve) {

                    setTimeout(
                        resolve,
                        interval
                    );
                }
            );
        }


        /*
         * Tidak ada navigation state.
         *
         * Jangan throw error.
         *
         * Dashboard-auth.js akan melakukan fallback
         * authentication menggunakan Supabase.
         */

        return hasSharedNavigationState();
    }


    /* =====================================================
       SYNC NAVIGATION STATE
    ===================================================== */

    function syncNavigationState() {

        if (
            !hasSharedNavigationState()
        ) {

            return false;
        }


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


        return true;
    }


    /* =====================================================
       SHARED AUTH / NAVIGATION
    ===================================================== */

    async function waitForSharedNavigation() {

        /*
         * Navigation bukan auth gate kedua.
         *
         * Kita hanya mengambil state jika tersedia.
         */

        const navigationReady =
            await waitForNavigationState(
                1500
            );


        if (
            navigationReady
        ) {

            syncNavigationState();

            log(
                "Shared navigation state synchronized."
            );

        } else {

            log(
                "Shared navigation state belum tersedia. " +
                "Dashboard menggunakan auth fallback."
            );
        }


        /*
         * Auth dashboard tetap dijalankan.
         *
         * dashboard-auth.js:
         *
         * 1. menggunakan navigation state jika tersedia
         * 2. fallback ke Supabase jika belum tersedia
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


        /*
         * initializeAuth() dapat mengembalikan:
         *
         * true
         * false
         * object { success: true }
         * object { success: false, redirected: true }
         *
         * Normalisasi hasil agar init tidak salah
         * menganggap object gagal sebagai sukses.
         */

        if (
            result === false
        ) {

            log(
                "Dashboard authentication tidak berhasil."
            );

            return false;
        }


        if (
            result &&
            typeof result === "object" &&
            result.success === false
        ) {

            /*
             * Auth module sudah menangani redirect bila
             * diperlukan.
             *
             * Jangan lanjut query video dalam kondisi
             * authentication gagal.
             */

            log(
                "Dashboard authentication gagal:",
                result.reason || "UNKNOWN"
            );

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
         * modal hanya karena role ADMIN/OWNER atau URL.
         */

        if (
            typeof dashboard.forceCloseModal ===
            "function"
        ) {

            try {

                dashboard.forceCloseModal();

                return;

            } catch (error) {

                logError(
                    "forceCloseModal error:",
                    error
                );
            }
        }


        /*
         * Fallback API.
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


        /*
         * DOM fallback.
         */

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


        /*
         * Sinkronisasi state modal.
         */

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
                : (
                    typeof dashboard.isAdmin ===
                    "function"
                        ? dashboard.isAdmin() === true
                        : false
                );


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
                editMode:
                    editMode,

                managementAccess:
                    managementAccess,

                includeInactive:
                    includeInactive
            }
        );


        /*
         * dashboard-data.js adalah satu-satunya module
         * yang mengatur state hasil query video.
         *
         * Jangan memanggil setVideos() lagi di sini.
         */

        const videos =
            await dashboard.loadVideos({

                includeInactive:
                    includeInactive

            });


        const normalizedVideos =
            Array.isArray(videos)
                ? videos
                : [];


        log(
            "Dashboard videos loaded:",
            normalizedVideos.length
        );


        return normalizedVideos;
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


        if (
            document.body
        ) {

            document.body.setAttribute(
                "data-dashboard-ready",
                "true"
            );
        }
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
         * Tetap gunakan renderer supaya error state
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
               5. AUTH + SHARED NAVIGATION
            --------------------------------------------- */

            const authenticated =
                await waitForSharedNavigation();


            /*
             * Jangan melakukan query video jika auth benar-benar
             * gagal. Navigation/auth module bertanggung jawab
             * melakukan redirect jika diperlukan.
             */

            if (
                authenticated === false
            ) {

                log(
                    "Dashboard initialization dihentikan " +
                    "karena authentication belum valid."
                );


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

            const videos =
                await loadDashboardVideos();


            /*
             * Jangan setVideos() di sini.
             *
             * dashboard-data.js sudah melakukan:
             *
             * dashboard.setVideos(videos)
             *
             * Jika init juga melakukan hal yang sama,
             * dua layer dapat saling menimpa state.
             */

            log(
                "Video state synchronized:",
                videos.length
            );


            /* ---------------------------------------------
               9. INITIAL RENDER
            --------------------------------------------- */

            renderDashboard();


            /* ---------------------------------------------
               10. DEFENSIVE MODAL CLOSE
            --------------------------------------------- */

            /*
             * Render tidak boleh membuka modal.
             * Tetap tutup sebagai guard terakhir.
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
