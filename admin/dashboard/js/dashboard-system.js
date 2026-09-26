/* =========================================================
   GEN-Z.AI DASHBOARD
   SYSTEM INFORMATION MODULE

   Tanggung jawab:
   - Authentication status
   - Supabase status
   - Provider status
   - Model status
   - Credit status
   - History status
   - System status utama

   Tidak menangani:
   - Auth/session initialization
   - Dashboard statistics
   - Account Activity
   - Activity Modal
========================================================= */

(function () {
    "use strict";


    const GENZDashboardSystem = {

        /* =====================================================
           STATE
        ===================================================== */

        state: {
            initialized: false,
            loading: false,
            statuses: {}
        },


        /* =====================================================
           HELPERS
        ===================================================== */

        getAuth() {

            const auth =
                window.GENZDashboardAuth;


            if (!auth) {

                throw new Error(
                    "GENZDashboardAuth belum tersedia."
                );

            }


            return auth;

        },


        getClient() {

            return this
                .getAuth()
                .getSupabaseClient();

        },


        getElement(id) {

            return document.getElementById(id);

        },


        /* =====================================================
           SET SERVICE STATUS
        ===================================================== */

        setServiceStatus(
            elementId,
            status,
            text
        ) {

            const element =
                this.getElement(
                    elementId
                );


            if (!element) {
                return;
            }


            const normalized =
                String(
                    status || "unknown"
                )
                    .toLowerCase();


            element.classList.remove(
                "online",
                "offline",
                "warning",
                "checking",
                "unknown"
            );


            element.classList.add(
                normalized
            );


            element.textContent =
                text ||
                this.getStatusLabel(
                    normalized
                );

        },


        /* =====================================================
           STATUS LABEL
        ===================================================== */

        getStatusLabel(status) {

            const labels = {

                online:
                    "Online",

                offline:
                    "Offline",

                warning:
                    "Warning",

                checking:
                    "Checking",

                unknown:
                    "Unknown"

            };


            return (
                labels[status] ||
                "Unknown"
            );

        },


        /* =====================================================
           AUTHENTICATION
        ===================================================== */

        async checkAuthentication() {

            try {

                const auth =
                    this.getAuth();


                const session =
                    auth.state?.session;


                if (!session) {

                    this.setServiceStatus(
                        "authenticationStatus",
                        "offline",
                        "Not Authenticated"
                    );


                    return false;

                }


                const profile =
                    auth.state?.profile;


                const role =
                    String(
                        profile?.role ||
                        ""
                    ).toUpperCase();


                if (
                    role === "ADMIN" ||
                    role === "OWNER"
                ) {

                    this.setServiceStatus(
                        "authenticationStatus",
                        "online",
                        "Authenticated"
                    );


                    return true;

                }


                this.setServiceStatus(
                    "authenticationStatus",
                    "warning",
                    "Role Check"
                );


                return false;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard System Auth]",
                    error
                );


                this.setServiceStatus(
                    "authenticationStatus",
                    "offline",
                    "Unavailable"
                );


                return false;

            }

        },


        /* =====================================================
           SUPABASE
        ===================================================== */

        async checkSupabase() {

            try {

                const client =
                    this.getClient();


                if (!client) {

                    throw new Error(
                        "Supabase client tidak tersedia."
                    );

                }


                /*
                 * Query ringan untuk memastikan
                 * koneksi database dapat digunakan.
                 *
                 * Tidak mengambil data pengguna.
                 */

                const {
                    error
                } =
                    await client
                        .from("profiles")
                        .select(
                            "id",
                            {
                                count: "exact",
                                head: true
                            }
                        );


                if (error) {
                    throw error;
                }


                this.setServiceStatus(
                    "supabaseStatus",
                    "online",
                    "Connected"
                );


                return true;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard System Supabase]",
                    error
                );


                this.setServiceStatus(
                    "supabaseStatus",
                    "offline",
                    "Disconnected"
                );


                return false;

            }

        },


        /* =====================================================
           PROVIDER STATUS
        ===================================================== */

        async checkProviders() {

            try {

                const client =
                    this.getClient();


                /*
                 * Jangan bergantung pada
                 * providers.is_active karena
                 * struktur database project dapat
                 * berbeda.
                 *
                 * Kita hanya memastikan tabel
                 * providers dapat dibaca.
                 */

                const {
                    error
                } =
                    await client
                        .from("providers")
                        .select(
                            "id",
                            {
                                count: "exact",
                                head: true
                            }
                        );


                if (error) {
                    throw error;
                }


                this.setServiceStatus(
                    "providerStatus",
                    "online",
                    "Available"
                );


                return true;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard System Providers]",
                    error
                );


                /*
                 * Provider table gagal dibaca.
                 * Jangan membuat data provider palsu.
                 */

                this.setServiceStatus(
                    "providerStatus",
                    "offline",
                    "Unavailable"
                );


                return false;

            }

        },


        /* =====================================================
           MODEL STATUS
        ===================================================== */

        async checkModels() {

            try {

                const client =
                    this.getClient();


                const {
                    error
                } =
                    await client
                        .from("kie_models")
                        .select(
                            "id",
                            {
                                count: "exact",
                                head: true
                            }
                        );


                if (error) {
                    throw error;
                }


                this.setServiceStatus(
                    "modelStatus",
                    "online",
                    "Available"
                );


                return true;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard System Models]",
                    error
                );


                this.setServiceStatus(
                    "modelStatus",
                    "offline",
                    "Unavailable"
                );


                return false;

            }

        },


        /* =====================================================
           CREDIT STATUS
        ===================================================== */

        async checkCredits() {

            try {

                const client =
                    this.getClient();


                const {
                    error
                } =
                    await client
                        .from("profiles")
                        .select(
                            "credits",
                            {
                                count: "exact",
                                head: true
                            }
                        );


                if (error) {
                    throw error;
                }


                this.setServiceStatus(
                    "creditStatus",
                    "online",
                    "Available"
                );


                return true;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard System Credits]",
                    error
                );


                this.setServiceStatus(
                    "creditStatus",
                    "offline",
                    "Unavailable"
                );


                return false;

            }

        },


        /* =====================================================
           HISTORY STATUS
        ===================================================== */

        async checkHistory() {

            try {

                const client =
                    this.getClient();


                const {
                    error
                } =
                    await client
                        .from("generation_history")
                        .select(
                            "id",
                            {
                                count: "exact",
                                head: true
                            }
                        );


                if (error) {
                    throw error;
                }


                this.setServiceStatus(
                    "historyStatus",
                    "online",
                    "Available"
                );


                return true;

            } catch (error) {

                console.error(
                    "[GENZ Dashboard System History]",
                    error
                );


                this.setServiceStatus(
                    "historyStatus",
                    "offline",
                    "Unavailable"
                );


                return false;

            }

        },


        /* =====================================================
           SYSTEM STATUS UI
        ===================================================== */

        updateSystemStatus(
            statuses
        ) {

            const section =
                this.getElement(
                    "systemStatusSection"
                );


            const title =
                this.getElement(
                    "systemStatusTitle"
                );


            const text =
                this.getElement(
                    "systemStatusText"
                );


            if (!section) {
                return;
            }


            const values =
                Object.values(
                    statuses
                );


            const failed =
                values.filter(
                    value =>
                        value === false
                );


            const passed =
                values.filter(
                    value =>
                        value === true
                );


            section.classList.remove(
                "system-online",
                "system-warning",
                "system-offline"
            );


            /*
             * Semua service berhasil.
             */

            if (
                failed.length === 0 &&
                passed.length > 0
            ) {

                section.classList.add(
                    "system-online"
                );


                if (title) {

                    title.textContent =
                        "All Systems Operational";

                }


                if (text) {

                    text.textContent =
                        "Layanan utama GEN-Z.AI terhubung dan siap digunakan.";

                }


                return;

            }


            /*
             * Sebagian service berhasil.
             */

            if (
                passed.length > 0 &&
                failed.length > 0
            ) {

                section.classList.add(
                    "system-warning"
                );


                if (title) {

                    title.textContent =
                        "System Partially Available";

                }


                if (text) {

                    text.textContent =
                        "Sebagian layanan tidak dapat diverifikasi saat ini.";

                }


                return;

            }


            /*
             * Tidak ada service yang berhasil.
             */

            section.classList.add(
                "system-offline"
            );


            if (title) {

                title.textContent =
                    "System Status Unavailable";

            }


            if (text) {

                text.textContent =
                    "Layanan utama tidak dapat diverifikasi.";

            }

        },


        /* =====================================================
           LOAD
        ===================================================== */

        async load() {

            if (
                this.state.loading
            ) {

                return;

            }


            this.state.loading =
                true;


            /*
             * Status awal.
             */

            this.setServiceStatus(
                "authenticationStatus",
                "checking",
                "Checking"
            );


            this.setServiceStatus(
                "supabaseStatus",
                "checking",
                "Checking"
            );


            this.setServiceStatus(
                "providerStatus",
                "checking",
                "Checking"
            );


            this.setServiceStatus(
                "modelStatus",
                "checking",
                "Checking"
            );


            this.setServiceStatus(
                "creditStatus",
                "checking",
                "Checking"
            );


            this.setServiceStatus(
                "historyStatus",
                "checking",
                "Checking"
            );


            try {

                const auth =
                    this.getAuth();


                if (
                    !auth.state ||
                    !auth.state.initialized
                ) {

                    await auth.init();

                }


                /*
                 * Semua pemeriksaan independen.
                 */

                const results =
                    await Promise.all([
                        this.checkAuthentication(),
                        this.checkSupabase(),
                        this.checkProviders(),
                        this.checkModels(),
                        this.checkCredits(),
                        this.checkHistory()
                    ]);


                this.state.statuses = {

                    authentication:
                        results[0],

                    supabase:
                        results[1],

                    provider:
                        results[2],

                    model:
                        results[3],

                    credit:
                        results[4],

                    history:
                        results[5]

                };


                this.updateSystemStatus(
                    this.state.statuses
                );


                this.state.initialized =
                    true;


                return this.state.statuses;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard System]",
                    error
                );


                this.updateSystemStatus({
                    authentication: false,
                    supabase: false,
                    provider: false,
                    model: false,
                    credit: false,
                    history: false
                });


                throw error;


            } finally {

                this.state.loading =
                    false;

            }

        },


        /* =====================================================
           INIT
        ===================================================== */

        async init() {

            if (
                this.state.initialized
            ) {

                return this.state;

            }


            await this.load();


            return this.state;

        },


        /* =====================================================
           REFRESH
        ===================================================== */

        async refresh() {

            /*
             * Reset initialized agar pemeriksaan
             * dilakukan kembali.
             */

            this.state.initialized =
                false;


            return this.load();

        }

    };


    /* =========================================================
       GLOBAL API
    ========================================================= */

    window.GENZDashboardSystem =
        GENZDashboardSystem;

})();
