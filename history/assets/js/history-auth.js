/* =========================================================
   GEN-Z.AI
   HISTORY AUTH MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-auth.js

   Tanggung jawab:
   - Supabase client
   - Session
   - Current user
   - Profile
   - Role
   - Credit
   - Navigation

   Tidak bertanggung jawab:
   - Query generation_history
   - Render tabel History
   - Polling provider
========================================================= */

(function (window) {

    "use strict";


    /* =====================================================
       ROOT NAMESPACE
    ===================================================== */

    const GENZHistory =
        window.GENZHistory =
            window.GENZHistory || {};


    const state =
        GENZHistory.state;


    const config =
        GENZHistory.config;


    const elements =
        GENZHistory.elements;


    /* =====================================================
       NORMALIZE ROLE
    ===================================================== */

    function normalizeRole(role) {

        return String(
            role || ""
        )
            .trim()
            .toUpperCase();

    }


    GENZHistory.normalizeRole =
        normalizeRole;


    /* =====================================================
       ADMIN / OWNER CHECK
    ===================================================== */

    GENZHistory.isAdminOrOwner =
        function () {

            const role =
                normalizeRole(
                    state.currentProfile?.role
                );


            return (
                role === "ADMIN" ||
                role === "OWNER"
            );

        };


    /* =====================================================
       BUILD NAVIGATION
    ===================================================== */

    GENZHistory.buildNavigation =
        function () {

            if (
                !state.currentProfile ||
                !elements.navigation
            ) {

                return;

            }


            const role =
                normalizeRole(
                    state.currentProfile.role
                );


            let html = "";


            if (
                role === "USER"
            ) {

                html = `

                    <a
                        href="../user/dashboard.html"
                    >
                        Dashboard
                    </a>

                    <a
                        href="../generate/index.html"
                    >
                        Generate
                    </a>

                    <a
                        href="../history/index.html"
                        class="active"
                    >
                        History
                    </a>

                    <a
                        href="../user/topup.html"
                    >
                        Top Up
                    </a>

                    <a
                        href="../user/hub-admin.html"
                    >
                        Hub Admin
                    </a>

                `;

            } else if (
                role === "ADMIN" ||
                role === "OWNER"
            ) {

                html = `

                    <a
                        href="../admin/dashboard.html"
                    >
                        Dashboard
                    </a>

                    <a
                        href="../generate/index.html"
                    >
                        Generate
                    </a>

                    <a
                        href="../history/index.html"
                        class="active"
                    >
                        History
                    </a>

                    <a
                        href="../admin-control/admin-panel.html"
                    >
                        Admin Panel
                    </a>

                `;

            }


            elements.navigation.innerHTML =
                html;


            elements.navigation
                .querySelectorAll("a")
                .forEach(
                    function (link) {

                        link.addEventListener(
                            "click",
                            GENZHistory.closeSidebar
                        );

                    }
                );

        };


    /* =====================================================
       LOAD PROFILE
    ===================================================== */

    GENZHistory.loadProfile =
        async function () {

            if (
                !state.supabaseClient ||
                !state.currentUser
            ) {

                throw new Error(
                    "Supabase session belum tersedia."
                );

            }


            const {
                data: profile,
                error
            } =
                await state.supabaseClient

                    .from("profiles")

                    .select(
                        "id,email,name,role,credits,status"
                    )

                    .eq(
                        "id",
                        state.currentUser.id
                    )

                    .single();


            if (
                error ||
                !profile
            ) {

                console.error(
                    "Profile error:",
                    error
                );


                throw new Error(
                    "Profil pengguna tidak ditemukan."
                );

            }


            const role =
                normalizeRole(
                    profile.role
                );


            if (
                ![
                    "USER",
                    "ADMIN",
                    "OWNER"
                ].includes(role)
            ) {

                await state.supabaseClient
                    .auth
                    .signOut();


                window.location.replace(
                    "../login.html"
                );


                return false;

            }


            if (
                profile.status !== "active"
            ) {

                await state.supabaseClient
                    .auth
                    .signOut();


                window.location.replace(
                    "../login.html"
                );


                return false;

            }


            state.currentProfile =
                profile;


            if (
                elements.creditBalance
            ) {

                elements.creditBalance.textContent =
                    Number(
                        profile.credits || 0
                    ).toLocaleString(
                        "id-ID"
                    );

            }


            if (
                elements.sidebarEmail
            ) {

                elements.sidebarEmail.textContent =
                    profile.email ||
                    state.currentUser.email ||
                    "User";

            }


            if (
                elements.sidebarRole
            ) {

                elements.sidebarRole.textContent =
                    role;

            }


            GENZHistory.buildNavigation();


            if (
                GENZHistory.isAdminOrOwner()
            ) {

                if (
                    elements.historySubtitle
                ) {

                    elements.historySubtitle.textContent =
                        "Riwayat generate seluruh aplikasi.";

                }


                if (
                    elements.userColumnHeader
                ) {

                    elements.userColumnHeader.style.display =
                        "table-cell";

                }

            } else {

                if (
                    elements.historySubtitle
                ) {

                    elements.historySubtitle.textContent =
                        "Riwayat generate yang terkait dengan akun kamu.";

                }


                if (
                    elements.userColumnHeader
                ) {

                    elements.userColumnHeader.style.display =
                        "none";

                }

            }


            return true;

        };


    /* =====================================================
       INITIALIZE SUPABASE SESSION
    ===================================================== */

    GENZHistory.initializeAuth =
        async function () {

            if (
                !window.supabase
            ) {

                throw new Error(
                    "Supabase JS belum dimuat."
                );

            }


            if (
                !window.GENZ_CONFIG
            ) {

                throw new Error(
                    "GENZ_CONFIG belum tersedia."
                );

            }


            state.supabaseClient =
                window.supabase.createClient(
                    GENZ_CONFIG.SUPABASE_URL,
                    GENZ_CONFIG.SUPABASE_KEY
                );


            const {
                data,
                error
            } =
                await state.supabaseClient
                    .auth
                    .getSession();


            if (
                error ||
                !data?.session
            ) {

                window.location.replace(
                    "../login.html"
                );


                return false;

            }


            state.currentUser =
                data.session.user;


            return await GENZHistory.loadProfile();

        };


})(window);
