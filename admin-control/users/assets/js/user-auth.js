/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT AUTH BRIDGE
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-auth.js

   Fungsi:
   - Menggunakan authentication dari shared navigation
   - Tidak melakukan getSession() sendiri
   - Tidak melakukan query profiles sendiri
   - Tidak melakukan redirect sendiri
   - Mengambil user/profile/role dari navigation
   - Menjaga compatibility dengan modul User Management

   OWNER AUTH SYSTEM:
   /navigation/navigation.js
   ========================================================= */

import {
    userState
} from "./user-state.js";


/* =========================================================
   NAVIGATION READY
========================================================= */

async function waitForNavigation() {

    /*
       navigation.js membuat:

       window.GENZNavigationReady

       Promise tersebut selesai setelah:
       - session berhasil diperiksa
       - profile berhasil dimuat
       - role ditentukan
       - navigation dirender

       Jadi User Management tidak perlu menjalankan
       sistem authentication kedua.
    */

    try {

        if (
            window.GENZNavigationReady &&
            typeof window.GENZNavigationReady.then ===
                "function"
        ) {

            const ready =
                await window.GENZNavigationReady;

            return ready !== false;

        }


        /*
           Fallback jika Promise belum tersedia.

           Jangan langsung redirect.
           Tunggu sebentar agar navigation.js memiliki
           kesempatan melakukan initialization.
        */

        for (
            let attempt = 0;
            attempt < 20;
            attempt++
        ) {

            if (
                window.GENZNavigation
            ) {

                if (
                    window.GENZNavigation.getUser &&
                    window.GENZNavigation.getProfile
                ) {

                    return true;

                }

            }


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        100
                    )
            );

        }


        return false;

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Navigation ready error:",
            error
        );

        return false;

    }

}


/* =========================================================
   ROLE OPTIONS
========================================================= */

function configureRoleOptions(
    role
) {

    const roleInput =
        document.getElementById(
            "newRole"
        );


    const adminRoleOption =
        document.getElementById(
            "adminRoleOption"
        );


    if (
        !roleInput
    ) {

        return;

    }


    const currentRole =
        String(
            role || ""
        )
            .trim()
            .toUpperCase();


    /*
       OWNER tidak boleh dibuat melalui User Management.

       API juga tetap melakukan validasi server-side.
       Ini hanya menjaga UI agar konsisten.
    */

    const ownerOption =
        Array.from(
            roleInput.options || []
        )
            .find(
                option =>
                    String(
                        option.value || ""
                    )
                        .trim()
                        .toUpperCase() ===
                    "OWNER"
            );


    if (
        ownerOption
    ) {

        ownerOption.remove();

    }


    /*
       ADMIN hanya boleh membuat USER.

       Karena itu pilihan ADMIN disembunyikan untuk ADMIN.
    */

    if (
        currentRole ===
        "ADMIN"
    ) {

        if (
            adminRoleOption
        ) {

            adminRoleOption.remove();

        }


        roleInput.value =
            "USER";


        return;

    }


    /*
       OWNER boleh membuat ADMIN atau USER.
    */

    if (
        currentRole ===
        "OWNER"
    ) {

        const hasAdminOption =
            Array.from(
                roleInput.options || []
            )
                .some(
                    option =>
                        String(
                            option.value || ""
                        )
                            .trim()
                            .toUpperCase() ===
                        "ADMIN"
                );


        if (
            !hasAdminOption
        ) {

            const option =
                document.createElement(
                    "option"
                );


            option.id =
                "adminRoleOption";


            option.value =
                "ADMIN";


            option.textContent =
                "ADMIN";


            roleInput.appendChild(
                option
            );

        }


        roleInput.value =
            "USER";

    }

}


/* =========================================================
   CHECK AUTH
   ---------------------------------------------------------
   Shared navigation adalah sumber auth utama.
========================================================= */

export async function checkAuth() {

    /*
       Tunggu shared navigation selesai.

       navigation.js yang menangani:
       - tidak ada session
       - redirect ke /login.html
       - profile
       - role
       - status
    */

    const navigationReady =
        await waitForNavigation();


    if (
        !navigationReady
    ) {

        /*
           Jangan melakukan redirect dari halaman ini.

           Jika session tidak valid, navigation.js sudah
           menangani redirect ke LOGIN_PATH.

           Menghindari redirect kedua yang menyebabkan
           halaman saling melempar.
        */

        return false;

    }


    /*
       Ambil data langsung dari shared navigation.
    */

    const navigation =
        window.GENZNavigation;


    if (
        !navigation
    ) {

        console.error(
            "[GEN-Z.AI] Shared navigation tidak tersedia."
        );

        return false;

    }


    const currentUser =
        typeof navigation.getUser ===
            "function"
            ? navigation.getUser()
            : null;


    const currentProfile =
        typeof navigation.getProfile ===
            "function"
            ? navigation.getProfile()
            : null;


    const navigationRole =
        typeof navigation.getRole ===
            "function"
            ? navigation.getRole()
            : "";


    /*
       Navigation globals menjadi fallback.
    */

    const user =
        currentUser ||
        window.GENZ_NAVIGATION_USER ||
        null;


    const profile =
        currentProfile ||
        window.GENZ_NAVIGATION_PROFILE ||
        window.GENZ_CURRENT_PROFILE ||
        null;


    const role =
        String(
            navigationRole ||
            window.GENZ_NAVIGATION_ROLE ||
            profile?.role ||
            ""
        )
            .trim()
            .toUpperCase();


    /*
       Kalau navigation sudah ready tetapi user/profile
       benar-benar tidak ada, jangan membuat auth system
       kedua.

       navigation sendiri yang bertanggung jawab terhadap
       redirect login.
    */

    if (
        !user
    ) {

        console.error(
            "[GEN-Z.AI] User session tidak tersedia dari shared navigation."
        );

        return false;

    }


    if (
        !profile
    ) {

        console.error(
            "[GEN-Z.AI] Profile tidak tersedia dari shared navigation."
        );

        return false;

    }


    /*
       User Management hanya menerima ADMIN / OWNER.
    */

    if (
        role !== "ADMIN" &&
        role !== "OWNER"
    ) {

        console.error(
            "[GEN-Z.AI] User Management membutuhkan role ADMIN atau OWNER."
        );

        return false;

    }


    /*
       Status sudah diperiksa oleh navigation.js.

       Kita tetap normalisasi di state agar modul lain
       mendapatkan struktur yang konsisten.
    */

    const status =
        String(
            profile.status ||
            "active"
        )
            .trim()
            .toLowerCase();


    /*
       Simpan ke state lokal User Management.

       Tidak ada query Supabase tambahan.
    */

    userState.currentUser =
        user;


    userState.currentProfile = {

        ...profile,

        role,

        status

    };


    /* =====================================================
       USER INFO
    ===================================================== */

    const userInfo =
        document.getElementById(
            "userInfo"
        );


    if (
        userInfo
    ) {

        userInfo.textContent =
            `${profile.email || user.email || ""} • ${role}`;

    }


    /* =====================================================
       ROLE OPTIONS
    ===================================================== */

    configureRoleOptions(
        role
    );


    return true;

}


/* =========================================================
   CURRENT PROFILE
========================================================= */

export function getCurrentProfile() {

    return (
        userState.currentProfile ||
        window.GENZ_CURRENT_PROFILE ||
        window.GENZ_NAVIGATION_PROFILE ||
        null
    );

}


/* =========================================================
   CURRENT ROLE
========================================================= */

export function getCurrentRole() {

    const profile =
        getCurrentProfile();


    if (
        profile?.role
    ) {

        return String(
            profile.role
        )
            .trim()
            .toUpperCase();

    }


    return String(
        window.GENZ_NAVIGATION_ROLE ||
        ""
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   IS ADMIN
========================================================= */

export function isAdmin() {

    return (
        getCurrentRole() ===
        "ADMIN"
    );

}


/* =========================================================
   IS OWNER
========================================================= */

export function isOwner() {

    return (
        getCurrentRole() ===
        "OWNER"
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


/* =========================================================
   GLOBAL COMPATIBILITY
   ---------------------------------------------------------
   Beberapa modul lama mungkin membaca helper ini dari
   window. Tetap expose tanpa mengambil alih auth.
========================================================= */

if (
    typeof window !==
    "undefined"
) {

    window.GENZUserAuth = {

        checkAuth,

        getCurrentProfile,

        getCurrentRole,

        isAdmin,

        isOwner,

        canManageUsers

    };

}
