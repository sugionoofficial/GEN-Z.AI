/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - AUTHENTICATION
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-auth.js

   Fungsi:
   - Memeriksa Supabase client
   - Memeriksa session
   - Mengambil profile pengguna
   - Memvalidasi role ADMIN / OWNER
   - Memvalidasi status active
   - Mengisi informasi user di topbar
   - Mengatur opsi role berdasarkan role admin

   Tidak menangani:
   - User API
   - Load users
   - Render table
   - Modal
   - Create / confirm / resend / delete
========================================================= */

import {
    userState
} from "./user-state.js";


/* =========================================================
   AUTH REDIRECT
========================================================= */

function redirectToLogin() {

    window.location.href =
        "../index.html";

}


/* =========================================================
   AUTH REDIRECT USER
========================================================= */

function redirectToUserDashboard() {

    window.location.href =
        "../user/dashboard.html";

}


/* =========================================================
   GET SUPABASE CLIENT
========================================================= */

function getSupabaseClient() {

    return window.GENZ_SUPABASE || null;

}


/* =========================================================
   CHECK AUTHENTICATION
========================================================= */

export async function checkAuth() {

    const supabaseClient =
        getSupabaseClient();


    /* -----------------------------------------------------
       SUPABASE CLIENT CHECK
    ----------------------------------------------------- */

    if (!supabaseClient) {

        console.error(
            "[GEN-Z.AI] Supabase client tidak tersedia."
        );

        redirectToLogin();

        return false;

    }


    /* -----------------------------------------------------
       GET SESSION
    ----------------------------------------------------- */

    let sessionResult;

    try {

        sessionResult =
            await supabaseClient.auth.getSession();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Gagal mengambil session:",
            error
        );

        redirectToLogin();

        return false;

    }


    const session =
        sessionResult?.data?.session;


    if (!session) {

        redirectToLogin();

        return false;

    }


    /* -----------------------------------------------------
       STORE CURRENT USER
    ----------------------------------------------------- */

    userState.currentUser =
        session.user;


    /* -----------------------------------------------------
       LOAD PROFILE
    ----------------------------------------------------- */

    let profileResult;

    try {

        profileResult =
            await supabaseClient

                .from("profiles")

                .select(
                    "id,email,name,role,status,credits"
                )

                .eq(
                    "id",
                    session.user.id
                )

                .maybeSingle();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Gagal mengambil profile:",
            error
        );

        await supabaseClient.auth.signOut();

        redirectToLogin();

        return false;

    }


    const profile =
        profileResult?.data;

    const profileError =
        profileResult?.error;


    /* -----------------------------------------------------
       PROFILE VALIDATION
    ----------------------------------------------------- */

    if (
        profileError ||
        !profile
    ) {

        console.error(
            "[GEN-Z.AI] Profile tidak ditemukan:",
            profileError
        );

        await supabaseClient.auth.signOut();

        redirectToLogin();

        return false;

    }


    /* -----------------------------------------------------
       NORMALIZE ROLE
    ----------------------------------------------------- */

    const role =
        String(
            profile.role || "USER"
        )
            .trim()
            .toUpperCase();


    /* -----------------------------------------------------
       NORMALIZE STATUS
    ----------------------------------------------------- */

    const status =
        String(
            profile.status || "active"
        )
            .trim()
            .toLowerCase();


    /* -----------------------------------------------------
       ADMIN / OWNER ACCESS
    ----------------------------------------------------- */

    if (
        role !== "ADMIN" &&
        role !== "OWNER"
    ) {

        redirectToUserDashboard();

        return false;

    }


    /* -----------------------------------------------------
       ACTIVE STATUS REQUIRED
    ----------------------------------------------------- */

    if (
        status !== "active"
    ) {

        redirectToUserDashboard();

        return false;

    }


    /* -----------------------------------------------------
       STORE CURRENT PROFILE
    ----------------------------------------------------- */

    userState.currentProfile = {

        ...profile,

        role

    };


    /* -----------------------------------------------------
       UPDATE USER INFO
    ----------------------------------------------------- */

    const userInfo =
        document.getElementById(
            "userInfo"
        );


    if (userInfo) {

        userInfo.textContent =
            `${profile.email || session.user.email || ""} • ${role}`;

    }


    /* -----------------------------------------------------
       ADMIN ROLE RESTRICTION
       -----------------------------------------------------
       ADMIN tidak boleh membuat ADMIN.
       OWNER tetap dapat melihat opsi ADMIN.
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


    /* -----------------------------------------------------
       SUCCESS
    ----------------------------------------------------- */

    return true;

}
