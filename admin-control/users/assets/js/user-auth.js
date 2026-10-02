/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - AUTH
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-auth.js

   Fungsi:
   - Memastikan Supabase tersedia
   - Memeriksa session login
   - Membaca profile admin
   - Memvalidasi role ADMIN / OWNER
   - Memvalidasi status active
   - Menampilkan identitas admin

   CATATAN:
   - Navigation tetap ditangani oleh:
     /navigation/navigation.js
   - File ini tidak membuat sidebar/menu/logout.
========================================================= */

import {
    userState
} from "./user-state.js";


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

function redirectTo(
    path
) {

    window.location.href =
        path;

}


/* =========================================================
   CHECK AUTH
========================================================= */

export async function checkAuth() {

    const supabase =
        getSupabaseClient();


    /* -----------------------------------------------------
       SUPABASE CHECK
    ----------------------------------------------------- */

    if (!supabase) {

        console.error(
            "[GEN-Z.AI] Supabase client tidak tersedia."
        );

        redirectTo(
            "../index.html"
        );

        return false;

    }


    try {

        /* -------------------------------------------------
           GET SESSION
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           SESSION CHECK
        ------------------------------------------------- */

        if (
            !session?.user
        ) {

            redirectTo(
                "../index.html"
            );

            return false;

        }


        userState.currentUser =
            session.user;


        /* -------------------------------------------------
           LOAD PROFILE
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           PROFILE CHECK
        ------------------------------------------------- */

        if (!profile) {

            console.error(
                "[GEN-Z.AI] Profile admin tidak ditemukan."
            );

            redirectTo(
                "../index.html"
            );

            return false;

        }


        /* -------------------------------------------------
           NORMALIZE ROLE + STATUS
        ------------------------------------------------- */

        const role =
            String(
                profile.role ||
                "USER"
            )
                .trim()
                .toUpperCase();


        const status =
            String(
                profile.status ||
                "active"
            )
                .trim()
                .toLowerCase();


        /* -------------------------------------------------
           ROLE CHECK
        ------------------------------------------------- */

        if (
            role !== "ADMIN" &&
            role !== "OWNER"
        ) {

            redirectTo(
                "../user/dashboard.html"
            );

            return false;

        }


        /* -------------------------------------------------
           STATUS CHECK
        ------------------------------------------------- */

        if (
            status !== "active"
        ) {

            redirectTo(
                "../user/dashboard.html"
            );

            return false;

        }


        /* -------------------------------------------------
           SAVE PROFILE STATE
        ------------------------------------------------- */

        userState.currentProfile = {

            ...profile,

            role,

            status

        };


        /* -------------------------------------------------
           ADMIN IDENTITY
        ------------------------------------------------- */

        const userInfo =
            document.getElementById(
                "userInfo"
            );


        if (userInfo) {

            userInfo.textContent =
                `${
                    profile.email ||
                    session.user.email ||
                    ""
                } • ${role}`;

        }


        /* -------------------------------------------------
           ADMIN ROLE OPTION
           -------------------------------------------------
           ADMIN tidak boleh membuat ADMIN.
        ----------------------------------------------------- */

        const adminRoleOption =
            document.getElementById(
                "adminRoleOption"
            );


        if (
            role === "ADMIN" &&
            adminRoleOption
        ) {

            adminRoleOption.remove();

        }


        return true;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] User auth error:",
            error
        );


        redirectTo(
            "../index.html"
        );

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
        userState.currentProfile?.role ||
        ""
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   ROLE HELPERS
========================================================= */

export function isAdmin() {

    return (
        getCurrentRole() ===
        "ADMIN"
    );

}


export function isOwner() {

    return (
        getCurrentRole() ===
        "OWNER"
    );

}


export function canManageUsers() {

    const role =
        getCurrentRole();


    return (
        role === "ADMIN" ||
        role === "OWNER"
    );

}
