/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - AUTH
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-auth.js

   Fungsi:
   - Cek session Supabase
   - Ambil profile admin
   - Validasi role ADMIN / OWNER
   - Validasi status active
   - Simpan current user/profile ke userState
   - Update userInfo

   Catatan:
   - Tidak mengatur sidebar/navigation
   - Tidak melakukan logout
   - Tidak mengubah API server
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

function redirectTo(path) {

    window.location.href = path;

}


/* =========================================================
   CHECK AUTH
========================================================= */

export async function checkAuth() {

    const supabase =
        getSupabaseClient();


    /* =====================================================
       SUPABASE CHECK
    ====================================================== */

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

        /* =================================================
           SESSION
        ================================================== */

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

            redirectTo(
                "../index.html"
            );

            return false;

        }


        userState.currentUser =
            session.user;


        /* =================================================
           PROFILE
        ================================================== */

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

            redirectTo(
                "../index.html"
            );

            return false;

        }


        /* =================================================
           NORMALIZE ROLE
        ================================================== */

        const role =
            String(
                profile.role || "USER"
            )
            .trim()
            .toUpperCase();


        /* =================================================
           NORMALIZE STATUS
        ================================================== */

        const status =
            String(
                profile.status || "active"
            )
            .trim()
            .toLowerCase();


        /* =================================================
           ROLE VALIDATION
        ================================================== */

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
           STATUS VALIDATION
        ================================================== */

        if (
            status !== "active"
        ) {

            redirectTo(
                "../user/dashboard.html"
            );

            return false;

        }


        /* =================================================
           SAVE PROFILE STATE
        ================================================== */

        userState.currentProfile = {

            ...profile,

            role,

            status

        };


        /* =================================================
           USER INFO
        ================================================== */

        const userInfo =
            document.getElementById(
                "userInfo"
            );


        if (userInfo) {

            userInfo.textContent =
                `${profile.email || session.user.email || ""} • ${role}`;

        }


        /* =================================================
           ADMIN ROLE OPTION
           -------------------------------------------------
           ADMIN tidak boleh membuat ADMIN / OWNER.
        ================================================== */

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


        /* =================================================
           AUTH SUCCESS
        ================================================== */

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
   GET CURRENT PROFILE
========================================================= */

export function getCurrentProfile() {

    return (
        userState.currentProfile ||
        null
    );

}


/* =========================================================
   GET CURRENT ROLE
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
   ADMIN CHECK
========================================================= */

export function isAdmin() {

    return (
        getCurrentRole() === "ADMIN"
    );

}


/* =========================================================
   OWNER CHECK
========================================================= */

export function isOwner() {

    return (
        getCurrentRole() === "OWNER"
    );

}


/* =========================================================
   MANAGEMENT CHECK
========================================================= */

export function canManageUsers() {

    const role =
        getCurrentRole();


    return (
        role === "ADMIN" ||
        role === "OWNER"
    );

}
