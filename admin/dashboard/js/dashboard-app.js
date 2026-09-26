/* =========================================================
   GEN-Z.AI DASHBOARD
   APPLICATION ORCHESTRATOR

   Tanggung jawab:
   - Menjalankan seluruh module dashboard
   - Menjaga urutan initialization
   - Menangani error global dashboard
   - Menjalankan refresh statistik
   - Menjalankan refresh system
   - Menangani lifecycle halaman

   Tidak menangani:
   - Query data secara langsung
   - Auth logic
   - Activity logic
   - Modal logic
   - System logic
========================================================= */

(function () {
    "use strict";


    const GENZDashboardApp = {

        /* =====================================================
           STATE
        ===================================================== */

        state: {

            initialized: false,

            initializing: false,

            statsRefreshTimer: null,

            systemRefreshTimer: null,

            statsRefreshInterval: 30000,

            systemRefreshInterval: 30000

        },


        /* =====================================================
           MODULE GETTERS
        ===================================================== */

        getAuth() {

            return window.GENZDashboardAuth;

        },


        getStats() {

            return window.GENZDashboardStats;

        },


        getActivity() {

            return window.GENZDashboardActivity;

        },


        getModal() {

            return window.GENZDashboardModal;

        },


        getSystem() {

            return window.GENZDashboardSystem;

        },


        /* =====================================================
           MODULE VALIDATION
        ===================================================== */

        validateModules() {

            const modules = {

                Auth:
                    this.getAuth(),

                Stats:
                    this.getStats(),

                Activity:
                    this.getActivity(),

                Modal:
                    this.getModal(),

                System:
                    this.getSystem()

            };


            const missing =
                Object.entries(
                    modules
                )
                    .filter(
                        ([, module]) =>
                            !module
                    )
                    .map(
                        ([name]) =>
                            name
                    );


            if (missing.length) {

                throw new Error(
                    "Dashboard module belum tersedia: " +
                    missing.join(", ")
                );

            }


            return true;

        },


        /* =====================================================
           DIAGNOSTIC
        ===================================================== */

        setDiagnostic(message) {

            const element =
                document.getElementById(
                    "dashboardDiagnostic"
                );


            if (!element) {
                return;
            }


            element.textContent =
                message || "";

        },


        /* =====================================================
           SHOW APPLICATION
        ===================================================== */

        showApplication() {

            const app =
                document.getElementById(
                    "dashboardApp"
                );


            if (!app) {
                return;
            }


            app.classList.add(
                "dashboard-ready"
            );


            app.removeAttribute(
                "aria-busy"
            );

        },


        /* =====================================================
           AUTH INITIALIZATION
        ===================================================== */

        async initializeAuth() {

            const auth =
                this.getAuth();


            if (!auth) {

                throw new Error(
                    "Authentication module tidak tersedia."
                );

            }


            return auth.init();

        },


        /* =====================================================
           STATS INITIALIZATION
        ===================================================== */

        async initializeStats() {

            const stats =
                this.getStats();


            if (!stats) {

                throw new Error(
                    "Statistics module tidak tersedia."
                );

            }


            return stats.init
                ? stats.init()
                : stats.load();

        },


        /* =====================================================
           ACTIVITY INITIALIZATION
        ===================================================== */

        async initializeActivity() {

            const activity =
                this.getActivity();


            if (!activity) {

                throw new Error(
                    "Activity module tidak tersedia."
                );

            }


            return activity.init();

        },


        /* =====================================================
           MODAL INITIALIZATION
        ===================================================== */

        initializeModal() {

            const modal =
                this.getModal();


            if (!modal) {

                throw new Error(
                    "Modal module tidak tersedia."
                );

            }


            modal.init();

        },


        /* =====================================================
           SYSTEM INITIALIZATION
        ===================================================== */

        async initializeSystem() {

            const system =
                this.getSystem();


            if (!system) {

                throw new Error(
                    "System module tidak tersedia."
                );

            }


            return system.init();

        },


        /* =====================================================
           FULL INITIALIZATION
        ===================================================== */

        async init() {

            if (
                this.state.initialized
            ) {

                return this.state;

            }


            if (
                this.state.initializing
            ) {

                return;

            }


            this.state.initializing =
                true;


            try {

                this.setDiagnostic(
                    "Memulai dashboard..."
                );


                /*
                 * Pastikan seluruh module
                 * benar-benar tersedia.
                 */

                this.validateModules();


                /*
                 * =================================================
                 * STEP 1
                 * AUTH
                 * =================================================
                 */

                await this.initializeAuth();


                /*
                 * =================================================
                 * STEP 2
                 * MODAL
                 *
                 * Modal di-init lebih awal supaya
                 * tidak pernah tampil sendiri.
                 * =================================================
                 */

                this.initializeModal();


                /*
                 * =================================================
                 * STEP 3
                 * STATISTICS
                 * =================================================
                 */

                try {

                    await this.initializeStats();

                } catch (error) {

                    console.error(
                        "[GENZ Dashboard App Stats]",
                        error
                    );

                }


                /*
                 * =================================================
                 * STEP 4
                 * ACCOUNT ACTIVITY
                 * =================================================
                 */

                try {

                    await this.initializeActivity();

                } catch (error) {

                    console.error(
                        "[GENZ Dashboard App Activity]",
                        error
                    );

                }


                /*
                 * =================================================
                 * STEP 5
                 * SYSTEM INFORMATION
                 * =================================================
                 */

                try {

                    await this.initializeSystem();

                } catch (error) {

                    console.error(
                        "[GENZ Dashboard App System]",
                        error
                    );

                }


                /*
                 * Dashboard dianggap siap setelah
                 * seluruh module utama sudah dicoba.
                 */

                this.state.initialized =
                    true;


                this.showApplication();


                this.setDiagnostic(
                    "Dashboard siap."
                );


                /*
                 * Refresh ringan.
                 */

                this.startRefreshTimers();


                return this.state;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard App]",
                    error
                );


                this.handleFatalError(
                    error
                );


                throw error;


            } finally {

                this.state.initializing =
                    false;

            }

        },


        /* =====================================================
           REFRESH TIMERS
        ===================================================== */

        startRefreshTimers() {

            this.stopRefreshTimers();


            /*
             * Statistics refresh.
             *
             * Account Activity sudah memiliki
             * refresh internal 5 detik sendiri.
             */

            this.state.statsRefreshTimer =
                window.setInterval(
                    () => {

                        this.refreshStats();

                    },
                    this.state.statsRefreshInterval
                );


            /*
             * System status refresh.
             */

            this.state.systemRefreshTimer =
                window.setInterval(
                    () => {

                        this.refreshSystem();

                    },
                    this.state.systemRefreshInterval
                );

        },


        /* =====================================================
           STOP REFRESH
        ===================================================== */

        stopRefreshTimers() {

            if (
                this.state.statsRefreshTimer
            ) {

                window.clearInterval(
                    this.state.statsRefreshTimer
                );


                this.state.statsRefreshTimer =
                    null;

            }


            if (
                this.state.systemRefreshTimer
            ) {

                window.clearInterval(
                    this.state.systemRefreshTimer
                );


                this.state.systemRefreshTimer =
                    null;

            }

        },


        /* =====================================================
           REFRESH STATS
        ===================================================== */

        async refreshStats() {

            const stats =
                this.getStats();


            if (!stats) {
                return;
            }


            try {

                await stats.refresh();


            } catch (error) {

                console.error(
                    "[GENZ Dashboard App Stats Refresh]",
                    error
                );

            }

        },


        /* =====================================================
           REFRESH SYSTEM
        ===================================================== */

        async refreshSystem() {

            const system =
                this.getSystem();


            if (!system) {
                return;
            }


            try {

                await system.refresh();


            } catch (error) {

                console.error(
                    "[GENZ Dashboard App System Refresh]",
                    error
                );

            }

        },


        /* =====================================================
           FATAL ERROR
        ===================================================== */

        handleFatalError(error) {

            const message =
                error?.message ||
                "Dashboard gagal diinisialisasi.";


            console.error(
                "[GENZ Dashboard Fatal]",
                error
            );


            this.setDiagnostic(
                message
            );


            const app =
                document.getElementById(
                    "dashboardApp"
                );


            if (app) {

                app.classList.add(
                    "dashboard-error"
                );


                app.setAttribute(
                    "aria-busy",
                    "false"
                );

            }

        },


        /* =====================================================
           DESTROY
        ===================================================== */

        destroy() {

            this.stopRefreshTimers();


            const activity =
                this.getActivity();


            if (
                activity &&
                typeof activity.destroy ===
                    "function"
            ) {

                activity.destroy();

            }


            this.state.initialized =
                false;


            this.state.initializing =
                false;

        }

    };


    /* =========================================================
       GLOBAL API
    ========================================================= */

    window.GENZDashboardApp =
        GENZDashboardApp;


    /* =========================================================
       PAGE INITIALIZATION
    ========================================================= */

    function bootDashboard() {

        /*
         * DOM harus sudah tersedia.
         */

        GENZDashboardApp
            .init()
            .catch(
                error => {

                    console.error(
                        "[GENZ Dashboard Boot]",
                        error
                    );

                }
            );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bootDashboard,
            {
                once: true
            }
        );

    } else {

        bootDashboard();

    }


    /* =========================================================
       PAGE LIFECYCLE
    ========================================================= */

    window.addEventListener(
        "beforeunload",
        () => {

            GENZDashboardApp
                .destroy();

        }
    );


})();
