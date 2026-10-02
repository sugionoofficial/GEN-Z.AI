/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - DATA
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-data.js

   Fungsi:
   - Load users dari API
   - Menyimpan allUsers
   - Filter users
   - Menghitung statistics
   - Mengontrol loading state dasar

   Tidak menangani:
   - Authentication
   - API implementation
   - HTML table rendering
   - Modal
   - Create / delete action
========================================================= */

import {
    userState
} from "./user-state.js";

import {
    getUsers
} from "./user-api.js";

import {
    renderUsers,
    updateStats
} from "./user-render.js";

import {
    showMessage,
    clearMessage
} from "./user-utils.js";


/* =========================================================
   LOAD USERS
========================================================= */

export async function loadUsers() {

    const container =
        document.getElementById(
            "userContainer"
        );

    const refreshButton =
        document.getElementById(
            "refreshButton"
        );


    /* -----------------------------------------------------
       CLEAR PREVIOUS MESSAGE
    ----------------------------------------------------- */

    clearMessage();


    /* -----------------------------------------------------
       LOADING UI
    ----------------------------------------------------- */

    if (container) {

        container.innerHTML = `
            <div class="loading">
                Memuat data pengguna...
            </div>
        `;

    }


    if (refreshButton) {

        refreshButton.disabled =
            true;

        refreshButton.textContent =
            "LOADING...";

    }


    try {

        /* -------------------------------------------------
           API REQUEST
        ------------------------------------------------- */

        const result =
            await getUsers();


        /* -------------------------------------------------
           EXTRACT USERS
        ------------------------------------------------- */

        const users =
            Array.isArray(
                result?.users
            )
                ? result.users
                : [];


        /* -------------------------------------------------
           STORE USERS
        ------------------------------------------------- */

        userState.allUsers =
            users;


        /* -------------------------------------------------
           APPLY FILTER
        ------------------------------------------------- */

        filterUsers();


        /* -------------------------------------------------
           UPDATE STATISTICS
        ------------------------------------------------- */

        updateStats();


    } catch (error) {

        console.error(
            "[GEN-Z.AI] Gagal memuat users:",
            error
        );


        userState.allUsers =
            [];

        userState.filteredUsers =
            [];


        /* -------------------------------------------------
           ERROR UI
        ------------------------------------------------- */

        if (container) {

            container.innerHTML = `
                <div class="empty">
                    Gagal memuat data pengguna.
                </div>
            `;

        }


        showMessage(

            error?.message ||
            "Gagal memuat data pengguna.",

            "error"

        );


    } finally {

        /* -------------------------------------------------
           RESTORE REFRESH BUTTON
        ------------------------------------------------- */

        if (refreshButton) {

            refreshButton.disabled =
                false;

            refreshButton.textContent =
                "REFRESH";

        }

    }

}


/* =========================================================
   FILTER USERS
========================================================= */

export function filterUsers() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    /* -----------------------------------------------------
       NO SEARCH
    ----------------------------------------------------- */

    if (!search) {

        userState.filteredUsers =
            [
                ...userState.allUsers
            ];

        renderUsers(
            userState.filteredUsers
        );

        return;

    }


    /* -----------------------------------------------------
       FILTER
       Search:
       - email
       - name
       - role
       - status
    ----------------------------------------------------- */

    userState.filteredUsers =
        userState.allUsers.filter(
            user => {

                const email =
                    String(
                        user?.email || ""
                    )
                        .toLowerCase();


                const name =
                    String(
                        user?.name || ""
                    )
                        .toLowerCase();


                const role =
                    String(
                        user?.role || ""
                    )
                        .toLowerCase();


                const status =
                    String(
                        user?.status || ""
                    )
                        .toLowerCase();


                return (

                    email.includes(
                        search
                    ) ||

                    name.includes(
                        search
                    ) ||

                    role.includes(
                        search
                    ) ||

                    status.includes(
                        search
                    )

                );

            }
        );


    /* -----------------------------------------------------
       RENDER FILTERED RESULT
    ----------------------------------------------------- */

    renderUsers(
        userState.filteredUsers
    );

}
