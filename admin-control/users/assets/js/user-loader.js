/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - LOADER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-loader.js

   Fungsi:
   - Entry point User Management
   - Initialize event handler
   - Validasi authentication
   - Load data users
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

export async function initUsersPage() {

    try {

        /* -------------------------------------------------
           EVENTS
        ------------------------------------------------- */

        initUserEvents();


        /* -------------------------------------------------
           AUTHENTICATION
        ------------------------------------------------- */

        const authenticated =
            await checkAuth();


        if (!authenticated) {

            return;

        }


        /* -------------------------------------------------
           LOAD USERS
        ------------------------------------------------- */

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

                    <div class="empty-icon">
                        ⚠
                    </div>

                    <div class="empty-title">
                        Gagal Memuat Halaman Users
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
   BOOT
========================================================= */

initUsersPage().catch(
    (error) => {

        console.error(
            "[GEN-Z.AI] Fatal Users loader error:",
            error
        );

    }
);
