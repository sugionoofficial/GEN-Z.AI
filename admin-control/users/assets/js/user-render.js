/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT RENDER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-render.js

   Fungsi:
   - Render statistik user
   - Render user table
   - Render action buttons
   - Permission UI untuk ADMIN / OWNER
========================================================= */

import {
    userState
} from "./user-state.js";

import {
    escapeHtml,
    formatNumber,
    getRoleClass,
    getStatusClass
} from "./user-utils.js";


/* =========================================================
   UPDATE STATISTICS
========================================================= */

export function updateStats(
    users = userState.allUsers
) {

    const list =
        Array.isArray(users)
            ? users
            : [];


    const totalUsers =
        document.getElementById(
            "totalUsers"
        );


    const activeUsers =
        document.getElementById(
            "activeUsers"
        );


    const adminUsers =
        document.getElementById(
            "adminUsers"
        );


    const total =
        list.length;


    const active =
        list.filter(
            user =>
                String(
                    user.status || ""
                )
                    .trim()
                    .toLowerCase() ===
                "active"
        ).length;


    const admins =
        list.filter(
            user => {

                const role =

                    String(
                        user.role || ""
                    )
                        .trim()
                        .toUpperCase();


                return (
                    role === "ADMIN" ||
                    role === "OWNER"
                );

            }
        ).length;


    if (totalUsers) {

        totalUsers.textContent =
            formatNumber(total);

    }


    if (activeUsers) {

        activeUsers.textContent =
            formatNumber(active);

    }


    if (adminUsers) {

        adminUsers.textContent =
            formatNumber(admins);

    }

}


/* =========================================================
   CURRENT ROLE
========================================================= */

function getCurrentRole() {

    const role =

        userState.currentProfile?.role ||

        window.GENZNavigation?.getRole?.() ||

        window.GENZ_CURRENT_ROLE ||

        window.currentRole ||

        "USER";


    return String(role)
        .trim()
        .toUpperCase();

}


/* =========================================================
   CURRENT USER ID
========================================================= */

function getCurrentUserId() {

    return String(

        userState.currentUser?.id ||

        window.GENZNavigation?.getUser?.()?.id ||

        window.GENZ_CURRENT_USER?.id ||

        window.currentUser?.id ||

        ""

    );

}


/* =========================================================
   TARGET PERMISSION
========================================================= */

function canManageTarget(
    user
) {

    if (!user?.id) {

        return false;

    }


    const currentRole =
        getCurrentRole();


    const currentUserId =
        getCurrentUserId();


    /*
     * Hanya ADMIN / OWNER.
     */

    if (
        currentRole !== "ADMIN" &&
        currentRole !== "OWNER"
    ) {

        return false;

    }


    /*
     * Tidak boleh mengelola diri sendiri.
     */

    if (
        currentUserId &&
        String(user.id) ===
        currentUserId
    ) {

        return false;

    }


    const targetRole =

        String(
            user.role || "USER"
        )
            .trim()
            .toUpperCase();


    /*
     * OWNER tidak dapat dikelola.
     */

    if (
        targetRole === "OWNER"
    ) {

        return false;

    }


    /*
     * ADMIN hanya dapat mengelola USER.
     */

    if (
        currentRole === "ADMIN" &&
        targetRole !== "USER"
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   ACTION BUTTON
========================================================= */

function createActionButton(
    action,
    user,
    label,
    className = ""
) {

    const userId =
        escapeHtml(
            user.id
        );


    const email =
        escapeHtml(
            user.email || ""
        );


    const name =
        escapeHtml(
            user.name || ""
        );


    return `

        <button
            type="button"
            class="action-button ${escapeHtml(className)}"
            data-action="${escapeHtml(action)}"
            data-user-id="${userId}"
            data-user-email="${email}"
            data-user-name="${name}"
        >
            ${escapeHtml(label)}
        </button>

    `;

}


/* =========================================================
   RENDER ACTIONS
========================================================= */

function renderActions(
    user
) {

    const actions = [];


    /*
     * User yang tidak boleh dikelola
     * tidak mendapatkan Edit/Delete.
     */

    if (
        canManageTarget(user)
    ) {

        /*
         * EDIT
         */

        actions.push(

            createActionButton(
                "edit",
                user,
                "Edit",
                "edit"
            )

        );


        /*
         * DELETE
         */

        actions.push(

            createActionButton(
                "delete",
                user,
                "Hapus",
                "delete"
            )

        );

    }


    /*
     * Email confirmation.
     *
     * Tetap mengikuti behavior lama:
     * user belum terverifikasi →
     * tampilkan Confirm + Resend.
     */

    const emailConfirmed =
        Boolean(
            user.email_confirmed
        );


    if (
        !emailConfirmed &&
        canManageTarget(user)
    ) {

        actions.push(

            createActionButton(
                "confirm",
                user,
                "Konfirmasi",
                "confirm"
            )

        );


        actions.push(

            createActionButton(
                "resend",
                user,
                "Kirim Ulang",
                "resend"
            )

        );

    }


    if (
        actions.length === 0
    ) {

        return `
            <span class="action-disabled">
                -
            </span>
        `;

    }


    return `

        <div class="user-actions">

            ${actions.join("")}

        </div>

    `;

}


/* =========================================================
   RENDER USER ROW
========================================================= */

function renderUserRow(
    user
) {

    const email =
        escapeHtml(
            user.email || "-"
        );


    const name =
        escapeHtml(
            user.name || "-"
        );


    const role =
        String(
            user.role || "USER"
        )
            .trim()
            .toUpperCase();


    const status =
        String(
            user.status || "active"
        )
            .trim()
            .toLowerCase();


    const roleClass =
        escapeHtml(
            getRoleClass(role)
        );


    const statusClass =
        escapeHtml(
            getStatusClass(status)
        );


    const credits =
        formatNumber(
            user.credits ?? 0
        );


    const statusLabel =

        status === "suspended"

            ? "Suspended"

            : status === "inactive"

                ? "Inactive"

                : "Active";


    return `

        <tr>

            <td>

                <div class="user-email">

                    ${email}

                </div>

            </td>


            <td>

                <div class="user-name">

                    ${name}

                </div>

            </td>


            <td>

                <span
                    class="role-badge ${roleClass}"
                >

                    ${escapeHtml(role)}

                </span>

            </td>


            <td>

                <span class="credits-value">

                    ${escapeHtml(credits)}

                </span>

            </td>


            <td>

                <span
                    class="status-badge ${statusClass}"
                >

                    ${escapeHtml(statusLabel)}

                </span>

            </td>


            <td>

                ${renderActions(user)}

            </td>

        </tr>

    `;

}


/* =========================================================
   EMPTY STATE
========================================================= */

function renderEmptyState() {

    return `

        <div class="empty-state">

            <div class="empty-icon">
                👤
            </div>

            <div class="empty-title">
                Tidak Ada User
            </div>

            <div class="empty-text">
                Belum ada user yang sesuai dengan pencarian.
            </div>

        </div>

    `;

}


/* =========================================================
   RENDER USERS
========================================================= */

export function renderUsers(
    users = userState.filteredUsers
) {

    const container =
        document.getElementById(
            "userContainer"
        );


    if (!container) {

        console.warn(
            "[GEN-Z.AI UserRender] userContainer tidak ditemukan."
        );

        return;

    }


    const list =
        Array.isArray(users)
            ? users
            : [];


    /*
     * Simpan filtered state.
     */

    userState.filteredUsers =
        list;


    /*
     * Tidak ada data.
     */

    if (
        list.length === 0
    ) {

        container.innerHTML =
            renderEmptyState();

        return;

    }


    /*
     * Render table.
     */

    container.innerHTML = `

        <div class="table-wrapper">

            <table class="users-table">

                <thead>

                    <tr>

                        <th>
                            Email
                        </th>

                        <th>
                            Nama
                        </th>

                        <th>
                            Role
                        </th>

                        <th>
                            Credits
                        </th>

                        <th>
                            Status
                        </th>

                        <th>
                            Actions
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${list
                        .map(
                            user =>
                                renderUserRow(
                                    user
                                )
                        )
                        .join("")}

                </tbody>

            </table>

        </div>

    `;

}


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZUserRender = {

        renderUsers,

        updateStats

    };

}
