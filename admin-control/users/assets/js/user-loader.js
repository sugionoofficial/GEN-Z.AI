/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - LOADER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-loader.js

   Fungsi:
   - Entry point Users module
   - Bind event
   - Validasi authentication
   - Load data users

   Dependency order:
   1. user-events.js
   2. user-auth.js
   3. user-data.js

   Catatan:
   - Jangan load user-loader.js dari module lain.
   - Jangan menambahkan script module Users lain langsung
     ke HTML.
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
   PAGE INIT
========================================================= */

export async function initUsersPage() {

    try {

        /* =================================================
           EVENT LISTENER
        ================================================= */

        initUserEvents();


        /* =================================================
           AUTHENTICATION
        ================================================= */

        const authenticated =
            await checkAuth();


        if (!authenticated) {

            return;

        }


        /* =================================================
           LOAD USERS
        ================================================= */

        await loadUsers();

    } catch (error) {

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
                <div class="empty-state">
                    <div class="empty-icon">⚠</div>
                    <div class="empty-title">
                        Gagal memuat halaman Users
                    </div>
                    <div class="empty-text">
                        Terjadi kesalahan saat memuat User Management.
                    </div>
                </div>
            `;

        }

    }

}


/* =========================================================
   START
========================================================= */

initUsersPage().catch(
    (error) => {

        console.error(
            "[GEN-Z.AI] Fatal Users loader error:",
            error
        );

    }
);
