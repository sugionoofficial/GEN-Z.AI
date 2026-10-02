/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - LOADER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-loader.js

   Fungsi:
   - Entry point halaman Users
   - Memulai event handler
   - Memeriksa authentication
   - Memuat data users

   Dependency order:
   1. user-events.js
   2. user-auth.js
   3. user-data.js

   File ini tidak menangani:
   - API implementation
   - Render
   - Modal
   - CRUD logic
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
   INITIALIZE USERS PAGE
========================================================= */

async function initUsersPage() {

    /* -----------------------------------------------------
       BIND EVENTS
       -----------------------------------------------------
       Event dipasang terlebih dahulu supaya setelah data
       selesai dimuat seluruh tombol sudah siap digunakan.
    ----------------------------------------------------- */

    initUserEvents();


    /* -----------------------------------------------------
       AUTHENTICATION
    ----------------------------------------------------- */

    const authenticated =
        await checkAuth();


    if (!authenticated) {

        return;

    }


    /* -----------------------------------------------------
       LOAD USERS
    ----------------------------------------------------- */

    await loadUsers();

}


/* =========================================================
   START
========================================================= */

initUsersPage()
    .catch(
        error => {

            console.error(
                "[GEN-Z.AI] Users page initialization error:",
                error
            );

            const container =
                document.getElementById(
                    "userContainer"
                );


            if (container) {

                container.innerHTML = `
                    <div class="empty">
                        Gagal menginisialisasi halaman Users.
                    </div>
                `;

            }

        }
    );
