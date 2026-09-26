/* =========================================================
   GEN-Z.AI DASHBOARD
   AUTH MODULE

   Tanggung jawab:
   - mendapatkan Supabase client
   - membaca session
   - membaca profile admin
   - validasi role ADMIN / OWNER
   - mengisi informasi account
   - mengisi role badge

   Tidak menangani:
   - statistics
   - account activity
   - modal
   - system information
========================================================= */

(function () {
    "use strict";

    const GENZDashboardAuth = {

        /* =====================================================
           STATE
        ===================================================== */

        state: {
            client: null,
            session: null,
            user: null,
            profile: null,
            initialized: false
        },


        /* =====================================================
           SUPABASE CLIENT
        ===================================================== */

        getSupabaseClient() {

            if (this.state.client) {
                return this.state.client;
            }

            /*
             * Prioritaskan client global yang sudah digunakan
             * oleh project GEN-Z.AI.
             */

            if (
                window.GENZ_SUPABASE &&
                typeof window.GENZ_SUPABASE.from === "function"
            ) {
                this.state.client =
                    window.GENZ_SUPABASE;

                return this.state.client;
            }


            if (
                window.supabaseClient &&
                typeof window.supabaseClient.from === "function"
            ) {
                this.state.client =
                    window.supabaseClient;

                return this.state.client;
            }


            /*
             * Fallback menggunakan GENZ_CONFIG.
             * Tidak membuat konfigurasi baru.
             */

            const config =
                window.GENZ_CONFIG ||
                window.GENZ_CONFIGS ||
                window.config ||
                null;


            const supabaseUrl =
                config?.SUPABASE_URL ||
                config?.supabaseUrl ||
                config?.supabase?.url ||
                null;


            const supabaseKey =
                config?.SUPABASE_ANON_KEY ||
                config?.SUPABASE_KEY ||
                config?.supabaseAnonKey ||
                config?.supabase?.anonKey ||
                null;


            if (
                supabaseUrl &&
                supabaseKey &&
                window.supabase &&
                typeof window.supabase.createClient === "function"
            ) {

                this.state.client =
                    window.supabase.createClient(
                        supabaseUrl,
                        supabaseKey
                    );

                /*
                 * Simpan ke global agar modul lain menggunakan
                 * instance yang sama.
                 */

                if (!window.GENZ_SUPABASE) {
                    window.GENZ_SUPABASE =
                        this.state.client;
                }

                if (!window.supabaseClient) {
                    window.supabaseClient =
                        this.state.client;
                }

                return this.state.client;
            }


            throw new Error(
                "Supabase client GEN-Z.AI tidak tersedia."
            );
        },


        /* =====================================================
           GET SESSION
        ===================================================== */

        async getSession() {

            const client =
                this.getSupabaseClient();


            const {
                data,
                error
            } =
                await client.auth.getSession();


            if (error) {
                throw error;
            }


            const session =
                data?.session || null;


            if (!session) {
                throw new Error(
                    "Session admin tidak ditemukan."
                );
            }


            this.state.session =
                session;


            this.state.user =
                session.user || null;


            return session;
        },


        /* =====================================================
           GET PROFILE
        ===================================================== */

        async getProfile(userId) {

            const client =
                this.getSupabaseClient();


            if (!userId) {
                throw new Error(
                    "User ID tidak tersedia."
                );
            }


            const {
                data,
                error
            } =
                await client
                    .from("profiles")
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();


            if (error) {
                throw error;
            }


            if (!data) {
                throw new Error(
                    "Profile admin tidak ditemukan."
                );
            }


            this.state.profile =
                data;


            return data;
        },


        /* =====================================================
           NORMALIZE ROLE
        ===================================================== */

        normalizeRole(role) {

            return String(
                role || ""
            )
                .trim()
                .toUpperCase();
        },


        /* =====================================================
           CHECK ADMIN ACCESS
        ===================================================== */

        hasAdminAccess(profile) {

            if (!profile) {
                return false;
            }


            const role =
                this.normalizeRole(
                    profile.role
                );


            return (
                role === "ADMIN" ||
                role === "OWNER"
            );
        },


        /* =====================================================
           SET TEXT SAFELY
        ===================================================== */

        setText(id, value) {

            const element =
                document.getElementById(id);


            if (!element) {
                return;
            }


            element.textContent =
                value ?? "—";
        },


        /* =====================================================
           UPDATE ACCOUNT UI
        ===================================================== */

        updateAccountUI(profile) {

            if (!profile) {
                return;
            }


            const role =
                this.normalizeRole(
                    profile.role
                );


            const name =
                profile.name ||
                profile.full_name ||
                profile.username ||
                "Admin";


            const email =
                profile.email ||
                this.state.user?.email ||
                "—";


            this.setText(
                "accountName",
                name
            );


            this.setText(
                "accountEmail",
                email
            );


            this.setText(
                "accountRole",
                role || "ADMIN"
            );


            this.setText(
                "accountStatus",
                profile.status ||
                "active"
            );


            this.setText(
                "roleBadge",
                role || "ADMIN"
            );


            const accountStatus =
                document.getElementById(
                    "accountStatus"
                );


            if (accountStatus) {

                accountStatus.classList.add(
                    "active"
                );

            }
        },


        /* =====================================================
           UPDATE SYSTEM AUTH STATUS
        ===================================================== */

        updateAuthenticationStatus(
            connected = true
        ) {

            const element =
                document.getElementById(
                    "authenticationStatus"
                );


            if (!element) {
                return;
            }


            element.textContent =
                connected
                    ? "Connected"
                    : "Offline";


            element.classList.toggle(
                "active",
                connected
            );


            element.classList.toggle(
                "error",
                !connected
            );
        },


        /* =====================================================
           ERROR UI
        ===================================================== */

        showError(error) {

            console.error(
                "[GENZ Dashboard Auth]",
                error
            );


            const diagnostic =
                document.getElementById(
                    "dashboardDiagnostic"
                );


            if (diagnostic) {

                diagnostic.textContent =
                    error?.message ||
                    "Gagal memuat autentikasi dashboard.";

                diagnostic.classList.add(
                    "error"
                );
            }


            this.updateAuthenticationStatus(
                false
            );
        },


        /* =====================================================
           AUTH REDIRECT
        ===================================================== */

        redirectToLogin() {

            /*
             * Jangan hardcode halaman login baru.
             * Gunakan login yang sudah dipakai project
             * apabila tersedia.
             */

            const loginPaths = [
                "../login.html",
                "../../login.html",
                "/login.html"
            ];


            const currentPath =
                window.location.pathname;


            /*
             * Hindari redirect berulang.
             */

            if (
                currentPath.endsWith(
                    "/login.html"
                )
            ) {
                return;
            }


            /*
             * Project existing biasanya berada di
             * root login.html.
             *
             * Untuk tahap modular ini kita gunakan
             * relative root path.
             */

            window.location.href =
                "../../login.html";
        },


        /* =====================================================
           INITIALIZE
        ===================================================== */

        async init() {

            if (this.state.initialized) {
                return this.state;
            }


            try {

                const session =
                    await this.getSession();


                const profile =
                    await this.getProfile(
                        session.user.id
                    );


                if (
                    !this.hasAdminAccess(
                        profile
                    )
                ) {

                    throw new Error(
                        "Akses ditolak. Dashboard hanya tersedia untuk ADMIN atau OWNER."
                    );
                }


                this.updateAccountUI(
                    profile
                );


                this.updateAuthenticationStatus(
                    true
                );


                this.state.initialized =
                    true;


                return this.state;

            } catch (error) {

                this.showError(
                    error
                );


                /*
                 * Jangan langsung redirect ketika
                 * debugging modular dashboard.
                 *
                 * Dashboard tetap menunjukkan error
                 * agar penyebabnya terlihat.
                 */

                throw error;
            }
        }
    };


    /* =========================================================
       GLOBAL API
    ========================================================= */

    window.GENZDashboardAuth =
        GENZDashboardAuth;

})();
