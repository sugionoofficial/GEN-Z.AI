/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - DATA
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-data.js

   Fungsi:
   - Load users dari API
   - Menyimpan data users ke state
   - Filtering users
   - Update statistik
========================================================= */

import { userState } from "./user-state.js";

import {
    getUsers
} from "./user-api.js";

import {
    renderUsers,
    updateStats
} from "./user-render.js";

import {
    showMessage,
    clearMessage,
    escapeHtml
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


    try {

        clearMessage();


        /* -------------------------------------------------
           LOADING STATE
        ------------------------------------------------- */

        if (container) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        ...
                    </div>

                    <div class="empty-title">
                        Memuat Users
                    </div>

                    <div class="empty-text">
                        Mengambil data user...
                    </div>

                </div>
            `;

        }


        if (refreshButton) {

            refreshButton.disabled = true;

        }


        /* -------------------------------------------------
           API REQUEST
        ------------------------------------------------- */

        const result =
            await getUsers();


        /* -------------------------------------------------
           NORMALIZE RESPONSE
        ------------------------------------------------- */

        let users = [];


        if (Array.isArray(result)) {

            users = result;

        } else if (
            Array.isArray(result?.users)
        ) {

            users = result.users;

        } else if (
            Array.isArray(result?.data)
        ) {

            users = result.data;

        }


        /* -------------------------------------------------
           UPDATE STATE
        ------------------------------------------------- */

        userState.allUsers =
            users;


        /* -------------------------------------------------
           FILTER + RENDER
        ------------------------------------------------- */

        filterUsers();


        /* -------------------------------------------------
           STATISTICS
        ------------------------------------------------- */

        updateStats();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Load users error:",
            error
        );


        userState.allUsers = [];

        userState.filteredUsers = [];


        /* -------------------------------------------------
           ERROR STATE
        ------------------------------------------------- */

        if (container) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        ⚠
                    </div>

                    <div class="empty-title">
                        Gagal Memuat Users
                    </div>

                    <div class="empty-text">
                        ${escapeHtml(
                            error?.message ||
                            "Terjadi kesalahan saat mengambil data user."
                        )}
                    </div>

                </div>
            `;

        }


        updateStats();


        showMessage(
            error?.message ||
            "Gagal memuat data users.",
            "error"
        );

    } finally {

        if (refreshButton) {

            refreshButton.disabled = false;

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


    const keyword =
        String(
            searchInput?.value || ""
        )
        .trim()
        .toLowerCase();


    const users =
        Array.isArray(
            userState.allUsers
        )
            ? userState.allUsers
            : [];


    /* -----------------------------------------------------
       NO SEARCH
    ----------------------------------------------------- */

    if (!keyword) {

        userState.filteredUsers =
            [...users];

    } else {

        /* -------------------------------------------------
           SEARCH
        ------------------------------------------------- */

        userState.filteredUsers =
            users.filter(
                (user) => {

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
                            keyword
                        ) ||

                        name.includes(
                            keyword
                        ) ||

                        role.includes(
                            keyword
                        ) ||

                        status.includes(
                            keyword
                        )
                    );

                }
            );

    }


    /* -----------------------------------------------------
       RENDER FILTERED RESULT
    ----------------------------------------------------- */

    renderUsers(
        userState.filteredUsers
    );

}
