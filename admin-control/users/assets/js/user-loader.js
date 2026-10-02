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
   - Tidak melakukan logout sendiri
   - Menginisialisasi User Management
   - Memuat daftar user setelah authentication siap
   ========================================================= */

import { initUserEvents } from "./user-events.js";
import { checkAuth } from "./user-auth.js";
import { loadUsers } from "./user-data.js";


/* =========================================================
   PAGE ERROR
========================================================= */

function showPageError(message) {

    const container =
        document.getElementById("userContainer");

    if (!container) {
        return;
    }


    const text =
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
                ${escapeHtml(text)}
            </div>

        </div>
    `;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   WAIT FOR NAVIGATION
========================================================= */

async function waitForNavigation() {

    /*
       Shared navigation sudah membuat Promise
       window.GENZNavigationReady.
    */

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
                "[GEN-Z.AI UserLoader] Navigation gagal:",
                error
            );

            return false;
        }
    }


    /*
       Fallback apabila navigation.js belum selesai
       membuat global promise.
    */

    for (
        let attempt = 0;
        attempt < 50;
        attempt++
    ) {

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
                    "[GEN-Z.AI UserLoader] Navigation wait error:",
                    error
                );

                return false;
            }
        }


        await new Promise(
            resolve =>
                setTimeout(resolve, 100)
        );
    }


    console.error(
        "[GEN-Z.AI UserLoader] Shared navigation tidak tersedia."
    );

    return false;
}


/* =========================================================
   INITIALIZE PAGE
========================================================= */

export async function initUsersPage() {

    console.log(
        "[GEN-Z.AI UserLoader] Initializing User Management..."
    );


    /*
       STEP 1
       Tunggu shared navigation.
    */

    const navigationReady =
        await waitForNavigation();


    if (!navigationReady) {

        console.warn(
            "[GEN-Z.AI UserLoader] Navigation belum authenticated."
        );

        return;
    }


    /*
       STEP 2
       Ambil authentication state dari navigation.
    */

    const authenticated =
        await checkAuth();


    if (!authenticated) {

        console.warn(
            "[GEN-Z.AI UserLoader] User Management tidak memiliki akses."
        );

        return;
    }


    /*
       STEP 3
       Event hanya dipasang sekali.
    */

    initUserEvents();


    /*
       STEP 4
       Ambil data user dari API.
    */

    await loadUsers();


    console.log(
        "[GEN-Z.AI UserLoader] ✓ User Management siap."
    );
}


/* =========================================================
   START
========================================================= */

initUsersPage()
    .catch(error => {

        console.error(
            "[GEN-Z.AI UserLoader] Fatal initialization error:",
            error
        );

        showPageError(
            "Terjadi kesalahan saat memuat halaman User Management."
        );
    });
