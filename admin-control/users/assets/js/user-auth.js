/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT AUTH BRIDGE
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-auth.js

   AUTH OWNER:
   /navigation/navigation.js?v=2

   Fungsi:
   - Mengambil authentication state dari shared navigation
   - Tidak membuat session sendiri
   - Tidak melakukan signOut sendiri
   - Tidak melakukan redirect sendiri
   - Menentukan hak akses User Management
   ========================================================= */

import { userState } from "./user-state.js";


/* =========================================================
   WAIT FOR SHARED NAVIGATION
========================================================= */

async function waitForNavigation() {

    if (
        window.GENZNavigationReady &&
        typeof window.GENZNavigationReady.then === "function"
    ) {

        try {

            const result =
                await window.GENZNavigationReady;

            return result !== false;

        } catch (error) {

            console.error(
                "[GEN-Z.AI UserAuth] Navigation error:",
                error
            );

            return false;
        }
    }


    for (
        let attempt = 0;
        attempt < 30;
        attempt++
    ) {

        if (
            window.GENZNavigation &&
            window.GENZNavigationReady
        ) {

            try {

                const result =
                    await window.GENZNavigationReady;

                return result !== false;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI UserAuth] Navigation wait error:",
                    error
                );

                return false;
            }
        }


        await new Promise(
            resolve => setTimeout(resolve, 100)
        );
    }


    console.error(
        "[GEN-Z.AI UserAuth] Shared navigation tidak tersedia."
    );

    return false;
}


/* =========================================================
   ROLE OPTIONS
========================================================= */

function configureRoleOptions(role) {

    const roleSelect =
        document.getElementById("newRole");

    const adminOption =
        document.getElementById("adminRoleOption");

    if (!roleSelect) {
        return;
    }


    const normalizedRole =
        String(role || "USER")
            .trim()
            .toUpperCase();


    /*
       OWNER:
       USER + ADMIN
    */

    if (normalizedRole === "OWNER") {

        if (adminOption) {

            adminOption.hidden = false;
            adminOption.disabled = false;
        }

        roleSelect.value = "USER";

        return;
    }


    /*
       ADMIN:
       USER only
    */

    if (normalizedRole === "ADMIN") {

        if (adminOption) {

            adminOption.hidden = true;
            adminOption.disabled = true;
        }

        roleSelect.value = "USER";

        return;
    }


    /*
       USER:
       Tidak boleh mengelola User Management.
    */

    if (adminOption) {

        adminOption.hidden = true;
        adminOption.disabled = true;
    }

    roleSelect.value = "USER";
}


/* =========================================================
   CHECK AUTH
========================================================= */

export async function checkAuth() {

    const navigationReady =
        await waitForNavigation();

    if (!navigationReady) {

        console.warn(
            "[GEN-Z.AI UserAuth] Navigation belum authenticated."
        );

        return false;
    }


    const navigation =
        window.GENZNavigation;

    if (!navigation) {

        console.error(
            "[GEN-Z.AI UserAuth] window.GENZNavigation tidak tersedia."
        );

        return false;
    }


    let currentUser = null;
    let currentProfile = null;
    let currentRole = "USER";


    try {

        if (
            typeof navigation.getUser === "function"
        ) {

            currentUser =
                navigation.getUser();
        }


        if (
            typeof navigation.getProfile === "function"
        ) {

            currentProfile =
                navigation.getProfile();
        }


        if (
            typeof navigation.getRole === "function"
        ) {

            currentRole =
                navigation.getRole();
        }


    } catch (error) {

        console.error(
            "[GEN-Z.AI UserAuth] Gagal membaca navigation state:",
            error
        );

        return false;
    }


    /*
       Fallback ke global navigation state.
    */

    if (!currentUser) {

        currentUser =
            window.GENZ_CURRENT_USER ||
            window.currentUser ||
            null;
    }


    if (!currentProfile) {

        currentProfile =
            window.GENZ_CURRENT_PROFILE ||
            window.currentProfile ||
            null;
    }


    if (!currentRole) {

        currentRole =
            window.GENZ_CURRENT_ROLE ||
            window.currentRole ||
            "USER";
    }


    currentRole =
        String(currentRole || "USER")
            .trim()
            .toUpperCase();


    /*
       User Management hanya untuk ADMIN / OWNER.
    */

    if (
        currentRole !== "ADMIN" &&
        currentRole !== "OWNER"
    ) {

        console.warn(
            "[GEN-Z.AI UserAuth] Role tidak memiliki akses:",
            currentRole
        );

        return false;
    }


    if (!currentUser) {

        console.warn(
            "[GEN-Z.AI UserAuth] Current user tidak tersedia."
        );

        return false;
    }


    /*
       Simpan state halaman.
    */

    userState.currentUser =
        currentUser;

    userState.currentProfile =
        currentProfile;


    /*
       Update informasi user di halaman.
    */

    const userInfo =
        document.getElementById("userInfo");

    if (userInfo) {

        const email =
            currentProfile?.email ||
            currentUser?.email ||
            "-";

        userInfo.textContent =
            `${email} • ${currentRole}`;
    }


    configureRoleOptions(
        currentRole
    );


    return true;
}


/* =========================================================
   STATE ACCESSORS
========================================================= */

export function getCurrentProfile() {

    return userState.currentProfile;
}


export function getCurrentRole() {

    const navigation =
        window.GENZNavigation;

    if (
        navigation &&
        typeof navigation.getRole === "function"
    ) {

        return String(
            navigation.getRole() || "USER"
        )
            .trim()
            .toUpperCase();
    }


    return "USER";
}


/* =========================================================
   ROLE HELPERS
========================================================= */

export function isAdmin() {

    return (
        getCurrentRole() === "ADMIN"
    );
}


export function isOwner() {

    return (
        getCurrentRole() === "OWNER"
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


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (typeof window !== "undefined") {

    window.GENZUserAuth = {

        checkAuth,

        getCurrentProfile,

        getCurrentRole,

        isAdmin,

        isOwner,

        canManageUsers
    };
}
