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
   ---------------------------------------------------------
   Halaman ini berada di:

   /admin-control/users/user.html

   Karena /admin-control/index.html TIDAK ADA,
   redirect authentication diarahkan ke root login.
========================================================= */

function redirectToLogin() {

    window.location.href = "/";

}


/* =========================================================
   REDIRECT NON ADMIN
   ---------------------------------------------------------
   Jangan mengarang path /admin-control/user/dashboard.html.
   Jika navigation/session menyatakan user bukan admin,
   kembali ke root agar sistem login/navigation menentukan
   halaman tujuan yang benar.
========================================================= */

function redirectUnauthorized() {

    window.location.href = "/";

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


    /* =====================================================
       SUPABASE MISSING
    ====================================================== */

    if (!supabase) {

        console.error(
            "[GEN-Z.AI] Supabase client tidak tersedia."
        );

        redirectToLogin();

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


        /* =================================================
           NO SESSION
        ================================================= */

        if (!session?.user) {

            redirectToLogin();

            return false;

        }


        userState.currentUser =
            session.user;


        /* =================================================
           LOAD PROFILE
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


        /* =================================================
           PROFILE NOT FOUND
        ================================================= */

        if (!profile) {

            console.error(
                "[GEN-Z.AI] Profile admin tidak ditemukan."
            );

            redirectToLogin();

            return false;

        }


        /* =================================================
           NORMALIZE ROLE / STATUS
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
           ADMIN / OWNER ONLY
        ================================================= */

        if (
            role !== "ADMIN" &&
            role !== "OWNER"
        ) {

            redirectUnauthorized();

            return false;

        }


        /* =================================================
           ACTIVE ONLY
        ================================================= */

        if (status !== "active") {

            redirectUnauthorized();

            return false;

        }


        /* =================================================
           SAVE PROFILE
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

        redirectToLogin();

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
