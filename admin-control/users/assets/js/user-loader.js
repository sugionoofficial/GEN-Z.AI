 /* =========================================================
    GEN-Z.AI
    USER MANAGEMENT LOADER
    ---------------------------------------------------------
    File:
    admin-control/users/assets/js/user-loader.js

    Fungsi:
    - Menunggu shared navigation
    - Tidak membuat authentication sendiri
    - Tidak melakukan redirect sendiri
    - Menginisialisasi event User Management
    - Memuat daftar user setelah navigation siap

    AUTH OWNER:
    /navigation/navigation.js
    ========================================================= */

import {
    initUserEvents
} from "./user-events.js";

import {
    checkAuth
} from "./user-auth.js";

import {
    loadUsers
} from "./user-data.js";


/* =========================================================
   WAIT FOR SHARED NAVIGATION
========================================================= */

async function waitForNavigation() {

    /*
     * navigation.js sudah menyediakan Promise global:
     *
     * window.GENZNavigationReady
     *
     * Jangan membuat timeout redirect sendiri di sini.
     */

    if (
        window.GENZNavigationReady &&
        typeof window.GENZNavigationReady.then ===
            "function"
    ) {

        try {

            const result =
                await window.GENZNavigationReady;

            return result !== false;

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


    /*
     * Fallback jika navigation API belum tersedia
     * saat module pertama kali dieksekusi.
     */

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

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI] Navigation wait error:",
                    error
                );

                return false;

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


    console.error(
        "[GEN-Z.AI] Shared navigation tidak tersedia."
    );


    return false;

}


/* =========================================================
   PAGE ERROR
========================================================= */

function showPageError(
    message
) {

    const container =
        document.getElementById(
            "userContainer"
        );


    if (
        !container
    ) {

        return;

    }


    const safeMessage =
        String(
            message ||
            "Terjadi kesalahan saat memuat User Management."
        );


    container.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">
                ⚠
            </div>

            <div class="empty-title">
                Gagal Memuat User Management
            </div>

            <div class="empty-text">
                ${safeMessage}
            </div>

        </div>

    `;

}


/* =========================================================
   INITIALIZE
========================================================= */

export async function initUsersPage() {

    try {

        /*
         * =====================================================
         * 1. TUNGGU NAVIGATION
         * =====================================================
         */

        const navigationReady =
            await waitForNavigation();


        /*
         * Jika navigation gagal karena session invalid,
         * navigation.js sendiri yang menangani redirect.
         *
         * User Management tidak melakukan redirect kedua.
         */

        if (
            !navigationReady
        ) {

            console.warn(
                "[GEN-Z.AI] User Management menunggu authentication navigation."
            );

            return;

        }


        /*
         * =====================================================
         * 2. CHECK AUTH BRIDGE
         * =====================================================
         */

        const authenticated =
            await checkAuth();


        if (
            !authenticated
        ) {

            console.warn(
                "[GEN-Z.AI] User Management tidak dapat memperoleh authentication state."
            );

            return;

        }


        /*
         * =====================================================
         * 3. INIT PAGE EVENTS
         * =====================================================
         *
         * Event hanya dipasang setelah auth valid.
         */

        initUserEvents();


        /*
         * =====================================================
         * 4. LOAD USERS
         * =====================================================
         */

        await loadUsers();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Users page initialization error:",
            error
        );


        showPageError(
            "Terjadi kesalahan saat memuat User Management."
        );

    }

}


/* =========================================================
   START
========================================================= */

initUsersPage()
    .catch(
        error => {

            console.error(
                "[GEN-Z.AI] Fatal Users loader error:",
                error
            );

        }
    );
