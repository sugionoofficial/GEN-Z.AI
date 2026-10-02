/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT DATA
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-data.js

   Fungsi:
   - Mengambil daftar user dari API
   - Menyimpan data ke userState
   - Filter user
   - Update statistik
   - Render daftar user
   - Tidak mengelola authentication
   - Tidak mengelola modal
   - Tidak mengelola action CRUD langsung
   ========================================================= */

import { userState } from "./user-state.js";
import { getUsers } from "./user-api.js";
import { renderUsers, updateStats } from "./user-render.js";
import {
    showMessage,
    clearMessage
} from "./user-utils.js";


/* =========================================================
   NORMALIZE USER LIST
========================================================= */

function normalizeUserList(result) {

    /*
       API dapat mengembalikan:
       - array langsung
       - { users: [...] }
       - { data: [...] }
    */

    if (Array.isArray(result)) {

        return result;
    }


    if (
        result &&
        Array.isArray(result.users)
    ) {

        return result.users;
    }


    if (
        result &&
        Array.isArray(result.data)
    ) {

        return result.data;
    }


    return [];
}


/* =========================================================
   LOAD USERS
========================================================= */

export async function loadUsers() {

    const container =
        document.getElementById("userContainer");

    const refreshButton =
        document.getElementById("refreshButton");


    try {

        clearMessage();


        /*
           Loading state.
        */

        if (container) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        ⟳
                    </div>

                    <div class="empty-title">
                        Memuat User
                    </div>

                    <div class="empty-text">
                        Mengambil data user...
                    </div>

                </div>
            `;
        }


        if (refreshButton) {

            refreshButton.disabled = true;
            refreshButton.classList.add("loading");
        }


        /*
           Request ke API.
        */

        const result =
            await getUsers();


        /*
           Normalisasi response.
        */

        const users =
            normalizeUserList(result);


        /*
           Simpan data asli.
        */

        userState.allUsers =
            Array.isArray(users)
                ? users
                : [];


        /*
           Default filtered list = semua user.
        */

        userState.filteredUsers =
            [...userState.allUsers];


        /*
           Update statistik.
        */

        updateStats();


        /*
           Render tabel.
        */

        renderUsers();


        console.log(
            "[GEN-Z.AI UserData] Users loaded:",
            userState.allUsers.length
        );


    } catch (error) {

        console.error(
            "[GEN-Z.AI UserData] Gagal memuat users:",
            error
        );


        userState.allUsers = [];
        userState.filteredUsers = [];


        updateStats();


        if (container) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        ⚠
                    </div>

                    <div class="empty-title">
                        Gagal Memuat User
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


        showMessage(
            error?.message ||
            "Gagal memuat daftar user.",
            "error"
        );


    } finally {

        if (refreshButton) {

            refreshButton.disabled = false;
            refreshButton.classList.remove("loading");
        }
    }
}


/* =========================================================
   FILTER USERS
========================================================= */

export function filterUsers() {

    const searchInput =
        document.getElementById("searchInput");


    const keyword =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    /*
       Tanpa keyword:
       tampilkan semua user.
    */

    if (!keyword) {

        userState.filteredUsers =
            [...userState.allUsers];

        renderUsers();

        return;
    }


    /*
       Filter berdasarkan:
       - email
       - name
       - role
       - status
    */

    userState.filteredUsers =
        userState.allUsers.filter(user => {

            const email =
                String(
                    user?.email || ""
                ).toLowerCase();

            const name =
                String(
                    user?.name || ""
                ).toLowerCase();

            const role =
                String(
                    user?.role || ""
                ).toLowerCase();

            const status =
                String(
                    user?.status || ""
                ).toLowerCase();


            return (
                email.includes(keyword) ||
                name.includes(keyword) ||
                role.includes(keyword) ||
                status.includes(keyword)
            );
        });


    renderUsers();
}


/* =========================================================
   ESCAPE HTML
   ---------------------------------------------------------
   Digunakan hanya untuk pesan error dari API.
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
   GLOBAL BRIDGE
========================================================= */

if (typeof window !== "undefined") {

    window.GENZUserData = {

        loadUsers,

        filterUsers
    };
}
