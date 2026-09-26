/* =========================================================
   GEN-Z.AI DASHBOARD
   STATISTICS MODULE

   Tanggung jawab:
   - Total Users
   - Active Users
   - Total Generations
   - Total Credits

   Tidak menangani:
   - Auth/session
   - Account Activity
   - Modal
   - Navigation
========================================================= */

(function () {
    "use strict";


    const GENZDashboardStats = {

        /* =====================================================
           STATE
        ===================================================== */

        state: {
            initialized: false,
            loading: false,
            lastLoadedAt: null
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

            const auth =
                this.getAuth();


            return auth.getSupabaseClient();
        },


        setText(id, value) {

            const element =
                document.getElementById(id);


            if (!element) {
                return;
            }


            element.textContent =
                value ?? "0";
        },


        formatNumber(value) {

            const number =
                Number(value) || 0;


            return new Intl.NumberFormat(
                "id-ID"
            ).format(number);
        },


        /* =====================================================
           DIAGNOSTIC
        ===================================================== */

        diagnostic(message) {

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
           LOAD TOTAL USERS
        ===================================================== */

        async loadTotalUsers() {

            const client =
                this.getClient();


            const {
                count,
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


            const total =
                Number(count) || 0;


            this.setText(
                "totalUsers",
                this.formatNumber(total)
            );


            return total;
        },


        /* =====================================================
           LOAD ACTIVE USERS
        ===================================================== */

        async loadActiveUsers() {

            const client =
                this.getClient();


            /*
             * Mengikuti struktur yang sudah digunakan
             * dashboard lama:
             *
             * profiles.status = "active"
             */

            const {
                count,
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
                    )
                    .eq(
                        "status",
                        "active"
                    );


            if (error) {
                throw error;
            }


            const total =
                Number(count) || 0;


            this.setText(
                "activeUsers",
                this.formatNumber(total)
            );


            return total;
        },


        /* =====================================================
           LOAD TOTAL GENERATIONS
        ===================================================== */

        async loadTotalGenerations() {

            const client =
                this.getClient();


            const {
                count,
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


            const total =
                Number(count) || 0;


            this.setText(
                "totalGenerations",
                this.formatNumber(total)
            );


            return total;
        },


        /* =====================================================
           LOAD TOTAL CREDITS
        ===================================================== */

        async loadTotalCredits() {

            const client =
                this.getClient();


            /*
             * Credit tetap bersumber dari:
             *
             * profiles.credits
             *
             * Tidak menghitung dari generation_history.
             */

            const {
                data,
                error
            } =
                await client
                    .from("profiles")
                    .select(
                        "credits"
                    );


            if (error) {
                throw error;
            }


            let total =
                0;


            if (Array.isArray(data)) {

                for (
                    const profile
                    of data
                ) {

                    const credits =
                        Number(
                            profile?.credits
                        );


                    if (
                        Number.isFinite(
                            credits
                        )
                    ) {

                        total += credits;

                    }
                }
            }


            this.setText(
                "totalCredits",
                this.formatNumber(total)
            );


            return total;
        },


        /* =====================================================
           LOAD ALL STATISTICS
        ===================================================== */

        async load() {

            if (this.state.loading) {
                return;
            }


            this.state.loading =
                true;


            try {

                this.diagnostic(
                    "Memuat statistik dashboard..."
                );


                /*
                 * Auth harus sudah tersedia.
                 */

                const auth =
                    this.getAuth();


                if (
                    !auth.state ||
                    !auth.state.initialized
                ) {

                    await auth.init();

                }


                /*
                 * Jalankan query secara paralel.
                 * Tidak ada query yang saling bergantung.
                 */

                const results =
                    await Promise.all([
                        this.loadTotalUsers(),
                        this.loadActiveUsers(),
                        this.loadTotalGenerations(),
                        this.loadTotalCredits()
                    ]);


                this.state.lastLoadedAt =
                    new Date();


                this.state.initialized =
                    true;


                this.diagnostic(
                    "Statistik dashboard berhasil diperbarui."
                );


                return {
                    totalUsers:
                        results[0],

                    activeUsers:
                        results[1],

                    totalGenerations:
                        results[2],

                    totalCredits:
                        results[3]
                };


            } catch (error) {

                console.error(
                    "[GENZ Dashboard Stats]",
                    error
                );


                this.diagnostic(
                    error?.message ||
                    "Gagal memuat statistik dashboard."
                );


                throw error;


            } finally {

                this.state.loading =
                    false;
            }
        },


        /* =====================================================
           REFRESH
        ===================================================== */

        async refresh() {

            return this.load();

        }

    };


    /* =========================================================
       GLOBAL API
    ========================================================= */

    window.GENZDashboardStats =
        GENZDashboardStats;

})();
