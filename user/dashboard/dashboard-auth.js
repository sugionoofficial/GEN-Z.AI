/* =========================================================
   GEN-Z.AI
   USER DASHBOARD AUTH MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-auth.js

   Tanggung jawab:
   - Mengecek Supabase session
   - Mengambil profile user
   - Menentukan role USER / ADMIN / OWNER
   - Menentukan akses edit mode
   - Mengatur UI berdasarkan role
   - Redirect user yang tidak valid

   Tidak bertanggung jawab:
   - Query dashboard_videos
   - Upload video
   - Delete video
   - Render video
   - Modal
========================================================= */

(function () {
    "use strict";

    window.GENZDashboard =
        window.GENZDashboard || {};

    const dashboard =
        window.GENZDashboard;


    /* =====================================================
       DEPENDENCY CHECK
    ===================================================== */

    function getSupabaseClient() {

        /*
         * Prioritas:
         * 1. window.supabaseClient
         * 2. window.GENZ_SUPABASE
         *
         * Config project GEN-Z.AI dapat menggunakan salah
         * satu referensi tersebut.
         */

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.auth === "object"
        ) {
            return window.supabaseClient;
        }

        if (
            window.GENZ_SUPABASE &&
            typeof window.GENZ_SUPABASE.auth === "object"
        ) {
            return window.GENZ_SUPABASE;
        }

        return null;
    }


    function requireSupabase() {

        const client =
            getSupabaseClient();

        if (!client) {

            throw new Error(
                "Supabase client belum tersedia."
            );
        }

        return client;
    }


    /* =====================================================
       PROFILE SELECT
    ===================================================== */

    function getProfileColumns() {

        return [
            "id",
            "email",
            "name",
            "role",
            "credits",
            "status"
        ].join(",");
    }


    /* =====================================================
       GET SESSION
    ===================================================== */

    async function getSession() {

        const supabase =
            requireSupabase();

        const result =
            await supabase.auth.getSession();

        if (result.error) {
            throw result.error;
        }

        return result.data
            ? result.data.session
            : null;
    }


    /* =====================================================
       GET PROFILE
    ===================================================== */

    async function getProfile(userId) {

        if (!userId) {
            return null;
        }

        const supabase =
            requireSupabase();

        const result =
            await supabase
                .from(
                    dashboard.config.tables.profiles
                )
                .select(
                    getProfileColumns()
                )
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();

        if (result.error) {
            throw result.error;
        }

        return result.data || null;
    }


    /* =====================================================
       PROFILE STATUS
    ===================================================== */

    function isProfileActive(profile) {

        if (!profile) {
            return false;
        }

        /*
         * Status lama GEN-Z.AI menggunakan nilai seperti:
         * active / inactive.
         *
         * Bila status tidak tersedia, jangan langsung
         * menganggap user aktif secara diam-diam.
         */

        if (
            profile.status === null ||
            typeof profile.status === "undefined"
        ) {
            return true;
        }

        const status =
            String(profile.status)
                .trim()
                .toLowerCase();

        return (
            status === "active" ||
            status === "aktif" ||
            status === "enabled"
        );
    }


    /* =====================================================
       ROLE
    ===================================================== */

    function normalizeRole(role) {

        if (
            typeof role !== "string"
        ) {
            return "";
        }

        return role
            .trim()
            .toUpperCase();
    }


    function resolveRole(profile) {

        if (!profile) {
            return "";
        }

        return normalizeRole(
            profile.role
        );
    }


    function hasManagementAccess() {

        return (
            dashboard.isAdmin()
        );
    }


    /* =====================================================
       EDIT MODE
    ===================================================== */

    function shouldEnterEditMode() {

        return dashboard.isEditMode();
    }


    function validateEditModeAccess() {

        if (!shouldEnterEditMode()) {
            return true;
        }

        /*
         * ADMIN dan OWNER boleh menggunakan edit mode.
         *
         * USER biasa tidak boleh mendapatkan akses hanya
         * dengan menambahkan ?edit=1 ke URL.
         */

        if (!hasManagementAccess()) {
            return false;
        }

        return true;
    }


    /* =====================================================
       UI ROLE STATE
    ===================================================== */

    function applyRoleUI() {

        const elements =
            dashboard.elements ||
            dashboard.cacheElements();

        const editMode =
            shouldEnterEditMode();

        const managementAccess =
            hasManagementAccess();


        /* -------------------------------------------------
           Add Video
        ------------------------------------------------- */

        if (elements.addVideoButton) {

            elements.addVideoButton.hidden =
                !(
                    editMode &&
                    managementAccess
                );
        }


        /* -------------------------------------------------
           Edit Mode Banner
        ------------------------------------------------- */

        if (elements.editModeBanner) {

            elements.editModeBanner.hidden =
                !(
                    editMode &&
                    managementAccess
                );
        }


        /* -------------------------------------------------
           Admin Back Button
        ------------------------------------------------- */

        if (elements.adminBackButton) {

            elements.adminBackButton.hidden =
                !(
                    editMode &&
                    managementAccess
                );
        }


        /* -------------------------------------------------
           Page state
        ------------------------------------------------- */

        if (elements.page) {

            elements.page.dataset.role =
                dashboard.getRole() || "USER";

            elements.page.dataset.editMode =
                editMode &&
                managementAccess
                    ? "true"
                    : "false";
        }


        /* -------------------------------------------------
           Body state
        ------------------------------------------------- */

        document.body.dataset.role =
            dashboard.getRole() || "USER";

        document.body.dataset.editMode =
            editMode &&
            managementAccess
                ? "true"
                : "false";
    }


    /* =====================================================
       REDIRECT
    ===================================================== */

    function redirectToLogin() {

        window.location.replace(
            dashboard.config.routes.login
        );
    }


    function redirectToDashboard() {

        window.location.replace(
            dashboard.config.routes.dashboard
        );
    }


    /* =====================================================
       AUTHENTICATE DASHBOARD
    ===================================================== */

    async function authenticate() {

        const session =
            await getSession();

        /* -------------------------------------------------
           Tidak ada session
        ------------------------------------------------- */

        if (!session || !session.user) {

            dashboard.setCurrentUser(null);

            dashboard.setCurrentProfile(null);

            dashboard.setRole(null);

            redirectToLogin();

            return {
                success: false,
                redirected: true,
                reason: "NO_SESSION"
            };
        }


        /* -------------------------------------------------
           Simpan user
        ------------------------------------------------- */

        dashboard.setCurrentUser(
            session.user
        );


        /* -------------------------------------------------
           Ambil profile
        ------------------------------------------------- */

        const profile =
            await getProfile(
                session.user.id
            );


        if (!profile) {

            dashboard.setCurrentProfile(null);

            dashboard.setError(
                new Error(
                    "Profile user tidak ditemukan."
                )
            );

            redirectToLogin();

            return {
                success: false,
                redirected: true,
                reason: "PROFILE_NOT_FOUND"
            };
        }


        /* -------------------------------------------------
           Cek status account
        ------------------------------------------------- */

        if (!isProfileActive(profile)) {

            dashboard.setCurrentProfile(
                profile
            );

            dashboard.setError(
                new Error(
                    "Akun tidak aktif."
                )
            );

            redirectToLogin();

            return {
                success: false,
                redirected: true,
                reason: "ACCOUNT_INACTIVE"
            };
        }


        /* -------------------------------------------------
           Simpan profile
        ------------------------------------------------- */

        dashboard.setCurrentProfile(
            profile
        );


        const role =
            resolveRole(profile);


        dashboard.setRole(role);


        /* -------------------------------------------------
           Validasi role
        ------------------------------------------------- */

        if (
            role !== "USER" &&
            role !== "ADMIN" &&
            role !== "OWNER"
        ) {

            dashboard.setError(
                new Error(
                    "Role akun tidak valid."
                )
            );

            redirectToLogin();

            return {
                success: false,
                redirected: true,
                reason: "INVALID_ROLE"
            };
        }


        /* -------------------------------------------------
           Edit mode security
        ------------------------------------------------- */

        if (
            shouldEnterEditMode() &&
            !validateEditModeAccess()
        ) {

            /*
             * USER tidak boleh masuk ke mode edit.
             * Jangan tampilkan modal lalu berharap CSS
             * menyelamatkan keamanan. URL bukan permission.
             */

            redirectToDashboard();

            return {
                success: false,
                redirected: true,
                reason: "EDIT_ACCESS_DENIED"
            };
        }


        /* -------------------------------------------------
           Apply UI
        ------------------------------------------------- */

        applyRoleUI();


        return {
            success: true,
            redirected: false,
            session: session,
            user: session.user,
            profile: profile,
            role: role,
            isAdmin:
                dashboard.isAdmin(),
            isOwner:
                dashboard.isOwner(),
            editMode:
                shouldEnterEditMode()
        };
    }


    /* =====================================================
       AUTH STATE LISTENER
    ===================================================== */

    function registerAuthListener() {

        const supabase =
            getSupabaseClient();

        if (!supabase) {
            return null;
        }

        /*
         * Hanya mendaftarkan listener sekali.
         */

        if (
            dashboard.authListenerRegistered
        ) {
            return null;
        }

        dashboard.authListenerRegistered =
            true;


        const result =
            supabase.auth.onAuthStateChange(
                function (event, session) {

                    /*
                     * Jangan melakukan query berat langsung
                     * di dalam callback Supabase auth.
                     *
                     * Dashboard init dapat menangani refresh
                     * state bila diperlukan.
                     */

                    if (
                        event === "SIGNED_OUT"
                    ) {

                        dashboard.setCurrentUser(
                            null
                        );

                        dashboard.setCurrentProfile(
                            null
                        );

                        dashboard.setRole(
                            null
                        );

                        redirectToLogin();

                        return;
                    }

                    if (
                        event === "SIGNED_IN" &&
                        session &&
                        session.user
                    ) {

                        dashboard.setCurrentUser(
                            session.user
                        );
                    }

                }
            );

        return result;
    }


    /* =====================================================
       USER DISPLAY HELPERS
    ===================================================== */

    function getDisplayName() {

        const profile =
            dashboard.getCurrentProfile();

        const user =
            dashboard.getCurrentUser();


        if (
            profile &&
            typeof profile.name === "string" &&
            profile.name.trim()
        ) {

            return profile.name.trim();
        }


        if (
            user &&
            user.user_metadata &&
            typeof user.user_metadata.name === "string" &&
            user.user_metadata.name.trim()
        ) {

            return user.user_metadata.name.trim();
        }


        if (
            user &&
            typeof user.email === "string"
        ) {

            return user.email.split("@")[0];
        }


        return "User";
    }


    function getEmail() {

        const profile =
            dashboard.getCurrentProfile();

        const user =
            dashboard.getCurrentUser();


        if (
            profile &&
            typeof profile.email === "string" &&
            profile.email.trim()
        ) {

            return profile.email.trim();
        }


        if (
            user &&
            typeof user.email === "string"
        ) {

            return user.email;
        }


        return "";
    }


    function getCredits() {

        const profile =
            dashboard.getCurrentProfile();

        if (!profile) {
            return 0;
        }

        const credits =
            Number(profile.credits);

        return Number.isFinite(credits)
            ? credits
            : 0;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    dashboard.getSupabaseClient =
        getSupabaseClient;

    dashboard.requireSupabase =
        requireSupabase;

    dashboard.getSession =
        getSession;

    dashboard.getProfile =
        getProfile;

    dashboard.isProfileActive =
        isProfileActive;

    dashboard.resolveRole =
        resolveRole;

    dashboard.hasManagementAccess =
        hasManagementAccess;

    dashboard.shouldEnterEditMode =
        shouldEnterEditMode;

    dashboard.validateEditModeAccess =
        validateEditModeAccess;

    dashboard.applyRoleUI =
        applyRoleUI;

    dashboard.authenticate =
        authenticate;

    dashboard.registerAuthListener =
        registerAuthListener;

    dashboard.getDisplayName =
        getDisplayName;

    dashboard.getEmail =
        getEmail;

    dashboard.getCredits =
        getCredits;


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.authReady = true;

})();
