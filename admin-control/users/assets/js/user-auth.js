/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT AUTH
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-auth.js

   Fungsi:
   - Memastikan session tersedia
   - Memuat profile admin
   - Validasi role ADMIN / OWNER
   - Validasi status active
   - Mengatur role option pada Add User
   - Tidak menangani navigation
========================================================= */

import { userState } from "./user-state.js";


/* =========================================================
   SUPABASE CLIENT
========================================================= */

function getSupabaseClient() {

    return (
        window.GENZ_SUPABASE ||
        window.supabaseClient ||
        null
    );

}


/* =========================================================
   REDIRECT
========================================================= */

function redirectTo(path) {

    window.location.href = path;

}


/* =========================================================
   CONFIGURE ROLE OPTIONS
========================================================= */

function configureRoleOptions(role) {

    const roleInput =
        document.getElementById("newRole");

    const adminRoleOption =
        document.getElementById("adminRoleOption");

    if (!roleInput) {
        return;
    }


    const currentRole =
        String(role || "")
            .trim()
            .toUpperCase();


    /* =====================================================
       OWNER CREATION IS NEVER ALLOWED
    ====================================================== */

    const ownerOption =
        Array.from(
            roleInput.options || []
        ).find(
            option =>
                String(option.value || "")
                    .trim()
                    .toUpperCase() === "OWNER"
        );


    if (ownerOption) {

        ownerOption.remove();

    }


    /* =====================================================
       ADMIN MAY ONLY CREATE USER
    ====================================================== */

    if (currentRole === "ADMIN") {

        if (adminRoleOption) {
            adminRoleOption.remove();
        }

        roleInput.value = "USER";

        return;

    }


    /* =====================================================
       OWNER MAY CREATE USER / ADMIN
    ====================================================== */

    if (currentRole === "OWNER") {

        if (
            !Array.from(
                roleInput.options || []
            ).some(
                option =>
                    String(option.value || "")
                        .trim()
                        .toUpperCase() === "ADMIN"
            )
        ) {

            const option =
                document.createElement("option");

            option.id = "adminRoleOption";
            option.value = "ADMIN";
            option.textContent = "ADMIN";

            roleInput.appendChild(option);

        }

        roleInput.value = "USER";

    }

}


/* =========================================================
   CHECK AUTH
========================================================= */

export async function checkAuth() {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        console.error(
            "[GEN-Z.AI] Supabase client tidak tersedia."
        );

        redirectTo("../index.html");

        return false;

    }


    try {

        /* =================================================
           SESSION
        ================================================= */

        const {
            data,
            error
        } =
            await supabase.auth.getSession();


        if (error) {
            throw error;
        }


        const session =
            data?.session || null;


        if (!session?.user) {

            redirectTo("../index.html");

            return false;

        }


        userState.currentUser =
            session.user;


        /* =================================================
           PROFILE
        ================================================= */

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .select(
                    "id,email,name,role,status,credits"
                )
                .eq(
                    "id",
                    session.user.id
                )
                .maybeSingle();


        if (profileError) {
            throw profileError;
        }


        if (!profile) {

            console.error(
                "[GEN-Z.AI] Profile admin tidak ditemukan."
            );

            redirectTo("../index.html");

            return false;

        }


        /* =================================================
           NORMALIZE
        ================================================= */

        const role =
            String(
                profile.role || "USER"
            )
                .trim()
                .toUpperCase();


        const status =
            String(
                profile.status || "active"
            )
                .trim()
                .toLowerCase();


        /* =================================================
           ROLE AUTHORIZATION
        ================================================= */

        if (
            role !== "ADMIN" &&
            role !== "OWNER"
        ) {

            redirectTo(
                "../user/dashboard.html"
            );

            return false;

        }


        /* =================================================
           STATUS AUTHORIZATION
        ================================================= */

        if (status !== "active") {

            redirectTo(
                "../user/dashboard.html"
            );

            return false;

        }


        /* =================================================
           SAVE PROFILE STATE
        ================================================= */

        userState.currentProfile = {

            ...profile,

            role,

            status

        };


        /* =================================================
           PAGE USER INFO
        ================================================= */

        const userInfo =
            document.getElementById(
                "userInfo"
            );


        if (userInfo) {

            userInfo.textContent =
                `${profile.email || session.user.email || ""} • ${role}`;

        }


        /* =================================================
           CONFIGURE ADD USER ROLE
        ================================================= */

        configureRoleOptions(role);


        return true;


    } catch (error) {

        console.error(
            "[GEN-Z.AI] User auth error:",
            error
        );

        redirectTo("../index.html");

        return false;

    }

}


/* =========================================================
   CURRENT PROFILE
========================================================= */

export function getCurrentProfile() {

    return (
        userState.currentProfile ||
        null
    );

}


/* =========================================================
   CURRENT ROLE
========================================================= */

export function getCurrentRole() {

    return String(
        userState.currentProfile?.role || ""
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   IS ADMIN
========================================================= */

export function isAdmin() {

    return (
        getCurrentRole() === "ADMIN"
    );

}


/* =========================================================
   IS OWNER
========================================================= */

export function isOwner() {

    return (
        getCurrentRole() === "OWNER"
    );

}


/* =========================================================
   CAN MANAGE USERS
========================================================= */

export function canManageUsers() {

    const role =
        getCurrentRole();


    return (
        role === "ADMIN" ||
        role === "OWNER"
    );

}
