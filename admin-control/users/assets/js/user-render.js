/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - RENDER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-render.js

   Fungsi:
   - Render tabel users
   - Render badge role
   - Render badge status
   - Render status email
   - Render action button
   - Update statistik
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

export function updateStats() {

    const users =
        Array.isArray(
            userState.allUsers
        )
            ? userState.allUsers
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
        users.length;


    const active =
        users.filter(
            (user) =>
                String(
                    user?.status || ""
                )
                    .trim()
                    .toLowerCase() === "active"
        ).length;


    const admins =
        users.filter(
            (user) => {

                const role =
                    String(
                        user?.role || ""
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

        return;

    }


    const userList =
        Array.isArray(users)
            ? users
            : [];


    /* -----------------------------------------------------
       EMPTY STATE
    ----------------------------------------------------- */

    if (
        userList.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    👥
                </div>

                <div class="empty-title">
                    Tidak Ada User
                </div>

                <div class="empty-text">
                    Belum ada user yang sesuai dengan pencarian.
                </div>

            </div>
        `;

        return;

    }


    /* -----------------------------------------------------
       CURRENT USER
    ----------------------------------------------------- */

    const currentUserId =
        String(
            userState.currentUser?.id || ""
        );


    const currentRole =
        String(
            userState.currentProfile?.role || ""
        )
            .trim()
            .toUpperCase();


    /* -----------------------------------------------------
       TABLE
    ----------------------------------------------------- */

    const rows =
        userList.map(
            (user) => {

                const userId =
                    String(
                        user?.id || ""
                    );


                const email =
                    String(
                        user?.email || ""
                    );


                const name =
                    String(
                        user?.name || ""
                    );


                const role =
                    String(
                        user?.role || "USER"
                    )
                        .trim()
                        .toUpperCase();


                const status =
                    String(
                        user?.status || "active"
                    )
                        .trim()
                        .toLowerCase();


                const credits =
                    Number(
                        user?.credits || 0
                    );


                const emailConfirmed =
                    Boolean(
                        user?.email_confirmed
                    );


                /* -----------------------------------------
                   PERMISSION
                ----------------------------------------- */

                const isSelf =
                    userId === currentUserId;


                const isOwner =
                    role === "OWNER";


                /*
                 * OWNER:
                 * - dapat mengelola USER
                 * - dapat mengelola ADMIN
                 *
                 * ADMIN:
                 * - hanya dapat mengelola USER
                 */

                const adminCanManage =
                    currentRole === "OWNER" ||
                    (
                        currentRole === "ADMIN" &&
                        role === "USER"
                    );


                const canDelete =
                    !isSelf &&
                    !isOwner &&
                    adminCanManage;


                const canManageConfirmation =
                    !isSelf &&
                    !isOwner &&
                    adminCanManage &&
                    !emailConfirmed;


                /* -----------------------------------------
                   ACTION BUTTONS
                ----------------------------------------- */

                let actions = "";


                if (
                    canManageConfirmation
                ) {

                    actions += `
                        <button
                            type="button"
                            class="action-button"
                            data-action="confirm"
                            data-user-id="${escapeHtml(userId)}"
                            data-user-email="${escapeHtml(email)}"
                        >
                            Confirm
                        </button>

                        <button
                            type="button"
                            class="action-button"
                            data-action="resend"
                            data-user-email="${escapeHtml(email)}"
                        >
                            Resend
                        </button>
                    `;

                }


                if (canDelete) {

                    actions += `
                        <button
                            type="button"
                            class="action-button danger"
                            data-action="delete"
                            data-user-id="${escapeHtml(userId)}"
                            data-user-email="${escapeHtml(email)}"
                            data-user-name="${escapeHtml(name)}"
                        >
                            Delete
                        </button>
                    `;

                }


                if (!actions) {

                    actions = `
                        <span class="action-disabled">
                            -
                        </span>
                    `;

                }


                /* -----------------------------------------
                   DISPLAY NAME
                ----------------------------------------- */

                const displayName =
                    name.trim()
                        ? name
                        : "-";


                /* -----------------------------------------
                   ROLE BADGE
                ----------------------------------------- */

                const roleClass =
                    getRoleClass(role);


                const roleLabel =
                    escapeHtml(role);


                /* -----------------------------------------
                   STATUS BADGE
                ----------------------------------------- */

                const statusClass =
                    getStatusClass(status);


                const statusLabel =
                    status
                        .charAt(0)
                        .toUpperCase() +
                    status.slice(1);


                /* -----------------------------------------
                   EMAIL STATUS
                ----------------------------------------- */

                const emailBadge =
                    emailConfirmed
                        ? `
                            <span class="email-badge verified">
                                Verified
                            </span>
                        `
                        : `
                            <span class="email-badge unverified">
                                Unverified
                            </span>
                        `;


                /* -----------------------------------------
                   ROW
                ----------------------------------------- */

                return `
                    <tr>

                        <td>
                            <div class="user-email">
                                ${escapeHtml(email)}
                            </div>

                            ${emailBadge}
                        </td>


                        <td>
                            <div class="user-name">
                                ${escapeHtml(displayName)}
                            </div>
                        </td>


                        <td>
                            <span
                                class="role-badge ${escapeHtml(roleClass)}"
                            >
                                ${roleLabel}
                            </span>
                        </td>


                        <td>
                            <span class="credit-value">
                                ${formatNumber(credits)}
                            </span>
                        </td>


                        <td>
                            <span
                                class="status-badge ${escapeHtml(statusClass)}"
                            >
                                ${escapeHtml(statusLabel)}
                            </span>
                        </td>


                        <td>
                            <div class="actions">
                                ${actions}
                            </div>
                        </td>

                    </tr>
                `;

            }
        ).join("");


    /* -----------------------------------------------------
       FINAL TABLE
    ----------------------------------------------------- */

    container.innerHTML = `
        <div class="table-wrapper">

            <table class="users-table">

                <thead>

                    <tr>

                        <th>
                            Email
                        </th>

                        <th>
                            Name
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
                    ${rows}
                </tbody>

            </table>

        </div>
    `;

}
