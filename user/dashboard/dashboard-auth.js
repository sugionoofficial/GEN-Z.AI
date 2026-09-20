/* =========================================================
   GEN-Z.AI
   USER DASHBOARD AUTH MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-auth.js

   Tanggung jawab:
   - Sinkronisasi auth dashboard dengan navigation.js
   - Fallback session validation bila navigation state
     belum tersedia
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
   - Navigation rendering

   CATATAN:
   navigation/navigation.js adalah auth gate utama aplikasi.
   Module ini tidak membuat sistem authentication kedua.
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

    let authenticatedOnce =
        false;


    /* =====================================================
       SUPABASE CLIENT
    ===================================================== */

    function getSupabaseClient() {

        /*
         * Jangan membuat Supabase client baru.
         *
         * Gunakan client global yang sudah dibuat oleh
         * config.js / application bootstrap.
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
       PROFILE COLUMNS
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
       SESSION
    ===================================================== */

    async function getSession() {

        const supabase =
            requireSupabase();


        const result =
            await supabase.auth.getSession();


        if (
            result.error
        ) {

            throw result.error;
        }


        return (
            result.data &&
            result.data.session
        )
            ? result.data.session
            : null;
    }


    /* =====================================================
       PROFILE
    ===================================================== */

    async function getProfile(
        userId
    ) {

        if (!userId) {

            return null;
        }


        const supabase =
            requireSupabase();


        if (
            !dashboard.config ||
            !dashboard.config.tables ||
            !dashboard.config.tables.profiles
        ) {

            throw new Error(
                "Konfigurasi profiles belum tersedia."
            );
        }


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


        if (
            result.error
        ) {

            throw result.error;
        }


        return result.data || null;
    }


    /* =====================================================
       PROFILE STATUS
    ===================================================== */

    function isProfileActive(
        profile
    ) {

        if (!profile) {

            return false;
        }


        /*
         * Jika kolom status tidak tersedia/null,
         * jangan memblokir akun yang valid.
         *
         * Navigation.js juga menggunakan pendekatan
         * validasi profile tersendiri.
         */

        if (
            profile.status === null ||
            typeof profile.status === "undefined"
        ) {

            return true;
        }


        const status =
            String(
                profile.status
            )
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

    function normalizeRole(
        role
    ) {

        if (
            typeof role !== "string"
        ) {

            return "";
        }


        return role
            .trim()
            .toUpperCase();
    }


    function resolveRole(
        profile
    ) {

        if (!profile) {

            return "";
        }


        return normalizeRole(
            profile.role
        );
    }


    /* =====================================================
       MANAGEMENT ACCESS
    ===================================================== */

    function hasManagementAccess() {

        if (
            typeof dashboard.isAdmin ===
            "function"
        ) {

            return (
                dashboard.isAdmin()
            );
        }


        const role =
            typeof dashboard.getRole ===
            "function"
                ? dashboard.getRole()
                : "";


        return (
            role === "ADMIN" ||
            role === "OWNER"
        );
    }


    /* =====================================================
       EDIT MODE
    ===================================================== */

    function shouldEnterEditMode() {

        if (
            typeof dashboard.isEditMode ===
            "function"
        ) {

            return (
                dashboard.isEditMode()
            );
        }


        /*
         * Fallback langsung dari URL.
         */

        const params =
            new URLSearchParams(
                window.location.search
            );


        return (
            params.get("edit") === "1" ||
            params.get("edit") === "true"
        );
    }


    function validateEditModeAccess() {

        if (
            !shouldEnterEditMode()
        ) {

            return true;
        }


        return (
            hasManagementAccess()
        );
    }


    /* =====================================================
       VALID ROLE
    ===================================================== */

    function isValidRole(
        role
    ) {

        return (
            role === "USER" ||
            role === "ADMIN" ||
            role === "OWNER"
        );
    }


    /* =====================================================
       NAVIGATION STATE
    ===================================================== */

    function hasNavigationAuthState() {

        return !!(
            window.GENZ_NAVIGATION_USER &&
            window.GENZ_NAVIGATION_PROFILE &&
            window.GENZ_NAVIGATION_ROLE
        );
    }


    function syncFromNavigation() {

        if (
            !hasNavigationAuthState()
        ) {

            return false;
        }


        const user =
            window.GENZ_NAVIGATION_USER;


        const profile =
            window.GENZ_NAVIGATION_PROFILE;


        const role =
            normalizeRole(
                window.GENZ_NAVIGATION_ROLE
            );


        /*
         * Pastikan navigation state benar-benar valid
         * sebelum dimasukkan ke dashboard state.
         */

        if (
            !user ||
            !profile ||
            !isValidRole(role)
        ) {

            return false;
        }


        if (
            typeof dashboard.setCurrentUser ===
            "function"
        ) {

            dashboard.setCurrentUser(
                user
            );
        }


        if (
            typeof dashboard.setCurrentProfile ===
            "function"
        ) {

            dashboard.setCurrentProfile(
                profile
            );
        }


        if (
            typeof dashboard.setRole ===
            "function"
        ) {

            dashboard.setRole(
                role
            );
        }


        authenticatedOnce =
            true;


        return true;
    }


    /* =====================================================
       UI ROLE STATE
    ===================================================== */

    function applyRoleUI() {

        const elements =
            dashboard.elements ||
            (
                typeof dashboard.cacheElements ===
                "function"
                    ? dashboard.cacheElements()
                    : {}
            );


        const editMode =
            shouldEnterEditMode();


        const managementAccess =
            hasManagementAccess();


        const effectiveEditMode =
            editMode &&
            managementAccess;


        /* -------------------------------------------------
           Add Video
        ------------------------------------------------- */

        if (
            elements.addVideoButton
        ) {

            elements.addVideoButton.hidden =
                !effectiveEditMode;
        }


        /* -------------------------------------------------
           Edit Mode Banner
        ------------------------------------------------- */

        if (
            elements.editModeBanner
        ) {

            elements.editModeBanner.hidden =
                !effectiveEditMode;
        }


        /* -------------------------------------------------
           Admin Back Button
        ------------------------------------------------- */

        if (
            elements.adminBackButton
        ) {

            elements.adminBackButton.hidden =
                !effectiveEditMode;
        }


        /* -------------------------------------------------
           Page dataset
        ------------------------------------------------- */

        if (
            elements.page
        ) {

            elements.page.dataset.role =
                (
                    typeof dashboard.getRole ===
                    "function"
                        ? dashboard.getRole()
                        : "USER"
                ) || "USER";


            elements.page.dataset.editMode =
                effectiveEditMode
                    ? "true"
                    : "false";
        }


        /* -------------------------------------------------
           Body dataset
        ------------------------------------------------- */

        document.body.dataset.role =
            (
                typeof dashboard.getRole ===
                "function"
                    ? dashboard.getRole()
                    : "USER"
            ) || "USER";


        document.body.dataset.editMode =
            effectiveEditMode
                ? "true"
                : "false";
    }


    /* =====================================================
       REDIRECT
    ===================================================== */

    function redirectToLogin() {

        const loginPath =
            dashboard.config &&
            dashboard.config.routes &&
            dashboard.config.routes.login
                ? dashboard.config.routes.login
                : "../login.html";


        window.location.replace(
            loginPath
        );
    }


    function redirectToDashboard() {

        const dashboardPath =
            dashboard.config &&
            dashboard.config.routes &&
            dashboard.config.routes.dashboard
                ? dashboard.config.routes.dashboard
                : "./dashboard.html";


        /*
         * Hindari redirect ke URL yang sama terus-menerus.
         */

        const currentPath =
            window.location.pathname;


        const targetPath =
            new URL(
                dashboardPath,
                window.location.href
            ).pathname;


        if (
            currentPath === targetPath &&
            !window.location.search
        ) {

            return;
        }


        window.location.replace(
            dashboardPath
        );
    }


    /* =====================================================
       FALLBACK AUTHENTICATION
    ===================================================== */

    async function authenticateFromSupabase() {

        const session =
            await getSession();


        /* -------------------------------------------------
           Tidak ada session
        ------------------------------------------------- */

        if (
            !session ||
            !session.user
        ) {

            if (
                typeof dashboard.setCurrentUser ===
                "function"
            ) {

                dashboard.setCurrentUser(
                    null
                );
            }


            if (
                typeof dashboard.setCurrentProfile ===
                "function"
            ) {

                dashboard.setCurrentProfile(
                    null
                );
            }


            if (
                typeof dashboard.setRole ===
                "function"
            ) {

                dashboard.setRole(
                    null
                );
            }


            redirectToLogin();


            return {
                success: false,
                redirected: true,
                reason: "NO_SESSION"
            };
        }


        /* -------------------------------------------------
           User
        ------------------------------------------------- */

        dashboard.setCurrentUser(
            session.user
        );


        /* -------------------------------------------------
           Profile
        ------------------------------------------------- */

        const profile =
            await getProfile(
                session.user.id
            );


        if (
            !profile
        ) {

            dashboard.setCurrentProfile(
                null
            );


            dashboard.setRole(
                null
            );


            if (
                typeof dashboard.setError ===
                "function"
            ) {

                dashboard.setError(
                    new Error(
                        "Profile user tidak ditemukan."
                    )
                );
            }


            redirectToLogin();


            return {
                success: false,
                redirected: true,
                reason: "PROFILE_NOT_FOUND"
            };
        }


        /* -------------------------------------------------
           Account status
        ------------------------------------------------- */

        if (
            !isProfileActive(
                profile
            )
        ) {

            dashboard.setCurrentProfile(
                profile
            );


            if (
                typeof dashboard.setError ===
                "function"
            ) {

                dashboard.setError(
                    new Error(
                        "Akun tidak aktif."
                    )
                );
            }


            redirectToLogin();


            return {
                success: false,
                redirected: true,
                reason: "ACCOUNT_INACTIVE"
            };
        }


        /* -------------------------------------------------
           Role
        ------------------------------------------------- */

        const role =
            resolveRole(
                profile
            );


        if (
            !isValidRole(
                role
            )
        ) {

            dashboard.setCurrentProfile(
                profile
            );


            dashboard.setRole(
                role
            );


            if (
                typeof dashboard.setError ===
                "function"
            ) {

                dashboard.setError(
                    new Error(
                        "Role akun tidak valid."
                    )
                );
            }


            redirectToLogin();


            return {
                success: false,
                redirected: true,
                reason: "INVALID_ROLE"
            };
        }


        dashboard.setCurrentProfile(
            profile
        );


        dashboard.setRole(
            role
        );


        authenticatedOnce =
            true;


        return {
            success: true,
            redirected: false,
            session: session,
            user: session.user,
            profile: profile,
            role: role
        };
    }


    /* =====================================================
       AUTHENTICATE
    ===================================================== */

    async function authenticate() {

        /*
         * =================================================
         * PRIORITY 1
         * =================================================
         *
         * Navigation.js sudah melakukan auth.
         *
         * Jangan query profiles lagi.
         */

        if (
            syncFromNavigation()
        ) {

            /*
             * User yang mencoba ?edit=1 tetap harus
             * melewati authorization check.
             */

            if (
                shouldEnterEditMode() &&
                !validateEditModeAccess()
            ) {

                redirectToDashboard();


                return {
                    success: false,
                    redirected: true,
                    reason: "EDIT_ACCESS_DENIED"
                };
            }


            applyRoleUI();


            return {
                success: true,
                redirected: false,
                source: "navigation",
                user:
                    dashboard.getCurrentUser(),
                profile:
                    dashboard.getCurrentProfile(),
                role:
                    dashboard.getRole(),
                isAdmin:
                    typeof dashboard.isAdmin ===
                    "function"
                        ? dashboard.isAdmin()
                        : false,
                isOwner:
                    typeof dashboard.isOwner ===
                    "function"
                        ? dashboard.isOwner()
                        : false,
                editMode:
                    shouldEnterEditMode()
            };
        }


        /*
         * =================================================
         * PRIORITY 2
         * =================================================
         *
         * Navigation belum menyediakan state.
         *
         * Gunakan fallback Supabase.
         */

        const result =
            await authenticateFromSupabase();


        if (
            !result ||
            !result.success
        ) {

            return result;
        }


        /*
         * Edit mode security.
         */

        if (
            shouldEnterEditMode() &&
            !validateEditModeAccess()
        ) {

            redirectToDashboard();


            return {
                success: false,
                redirected: true,
                reason: "EDIT_ACCESS_DENIED"
            };
        }


        applyRoleUI();


        return {
            success: true,
            redirected: false,
            source: "supabase",
            session:
                result.session,
            user:
                result.user,
            profile:
                result.profile,
            role:
                result.role,
            isAdmin:
                typeof dashboard.isAdmin ===
                "function"
                    ? dashboard.isAdmin()
                    : false,
            isOwner:
                typeof dashboard.isOwner ===
                "function"
                    ? dashboard.isOwner()
                    : false,
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


        if (
            !supabase
        ) {

            return null;
        }


        /*
         * Register hanya sekali.
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
                function (
                    event,
                    session
                ) {

                    /*
                     * Jangan melakukan query profile berat
                     * di callback auth.
                     *
                     * Navigation.js tetap menjadi pemilik
                     * lifecycle authentication.
                     */

                    if (
                        event === "SIGNED_OUT"
                    ) {

                        authenticatedOnce =
                            false;


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
                        (
                            event === "SIGNED_IN" ||
                            event === "INITIAL_SESSION"
                        ) &&
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

            return user.email
                .split("@")[0];
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


        if (
            !profile
        ) {

            return 0;
        }


        const credits =
            Number(
                profile.credits
            );


        return Number.isFinite(
            credits
        )
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


    dashboard.normalizeRole =
        normalizeRole;


    dashboard.resolveRole =
        resolveRole;


    dashboard.hasManagementAccess =
        hasManagementAccess;


    dashboard.shouldEnterEditMode =
        shouldEnterEditMode;


    dashboard.validateEditModeAccess =
        validateEditModeAccess;


    dashboard.hasNavigationAuthState =
        hasNavigationAuthState;


    dashboard.syncFromNavigation =
        syncFromNavigation;


    dashboard.applyRoleUI =
        applyRoleUI;


    dashboard.authenticateFromSupabase =
        authenticateFromSupabase;


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
       READY
    ===================================================== */

    dashboard.authReady =
        true;

})();
