/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - RENDER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-render.js

   Fungsi:
   - Render statistik
   - Render daftar users
   - Menentukan permission action
   - Render tombol Confirm / Resend / Delete
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


    const totalElement =
        document.getElementById(
            "totalUsers"
        );


    const activeElement =
        document.getElementById(
            "activeUsers"
        );


    const adminElement =
        document.getElementById(
            "adminUsers"
        );


    if (totalElement) {

        totalElement.textContent =
            formatNumber(total);

    }


    if (activeElement) {

        activeElement.textContent =
            formatNumber(active);

    }


    if (adminElement) {

        adminElement.textContent =
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


    const list =
        Array.isArray(users)
            ? users
            : [];


    /* =====================================================
       EMPTY STATE
    ====================================================== */

    if (list.length === 0) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ◌
                </div>

                <div class="empty-title">
                    Tidak Ada User
                </div>

                <div class="empty-text">
                    Tidak ditemukan user yang sesuai.
                </div>

            </div>
        `;

        return;

    }


    /* =====================================================
       CURRENT USER
    ====================================================== */

    const currentUserId =
        userState.currentUser?.id ||
        userState.currentProfile?.id ||
        "";


    const currentRole =
        String(
            userState.currentProfile?.role ||
            ""
        )
        .trim()
        .toUpperCase();


    /* =====================================================
       TABLE ROWS
    ====================================================== */

    const rows =
        list.map(
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


                /* =========================================
                   PERMISSION
                ========================================== */

                const isSelf =
                    Boolean(
                        currentUserId &&
                        userId &&
                        currentUserId === userId
                    );


                const isOwner =
                    role === "OWNER";


                /*
                   OWNER:
                   dapat mengelola USER dan ADMIN.

                   ADMIN:
                   hanya dapat mengelola USER.
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


                /* =========================================
                   ROLE BADGE
                ========================================== */

                const roleClass =
                    getRoleClass(role);


                /* =========================================
                   STATUS BADGE
                ========================================== */

                const statusClass =
                    getStatusClass(status);


                /* =========================================
                   ACTIONS
                ========================================== */

                const actions = [];


                if (
                    canManageConfirmation
                ) {

                    actions.push(`
                        <button
                            type="button"
                            class="action-button confirm"
                            data-action="confirm"
                            data-user-id="${escapeHtml(userId)}"
                            data-user-email="${escapeHtml(email)}"
                        >
                            CONFIRM
                        </button>
                    `);


                    actions.push(`
                        <button
                            type="button"
                            class="action-button resend"
                            data-action="resend"
                            data-user-email="${escapeHtml(email)}"
                        >
                            RESEND
                        </button>
                    `);

                }


                if (canDelete) {

                    actions.push(`
                        <button
                            type="button"
                            class="action-button delete"
                            data-action="delete"
                            data-user-id="${escapeHtml(userId)}"
                            data-user-email="${escapeHtml(email)}"
                            data-user-name="${escapeHtml(name)}"
                        >
                            DELETE
                        </button>
                    `);

                }


                if (actions.length === 0) {

                    actions.push(`
                        <span class="action-disabled">
                            —
                        </span>
                    `);

                }


                /* =========================================
                   RETURN ROW
                ========================================== */

                return `
                    <tr>

                        <td>

                            <div class="user-email">
                                ${escapeHtml(email)}
                            </div>

                        </td>


                        <td>

                            <div class="user-name">
                                ${escapeHtml(name || "—")}
                            </div>

                        </td>


                        <td>

                            <span
                                class="role-badge ${escapeHtml(roleClass)}"
                            >
                                ${escapeHtml(role)}
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
                                ${escapeHtml(status)}
                            </span>

                        </td>


                        <td>

                            ${
                                emailConfirmed
                                    ? `
                                        <span class="email-badge verified">
                                            VERIFIED
                                        </span>
                                      `
                                    : `
                                        <span class="email-badge unverified">
                                            UNVERIFIED
                                        </span>
                                      `
                            }

                        </td>


                        <td>

                            <div class="actions">
                                ${actions.join("")}
                            </div>

                        </td>

                    </tr>
                `;

            }
        )
        .join("");


    /* =====================================================
       TABLE
    ====================================================== */

    container.innerHTML = `

        <div class="table-wrapper">

            <table class="users-table">

                <thead>

                    <tr>

                        <th>
                            EMAIL
                        </th>

                        <th>
                            NAMA
                        </th>

                        <th>
                            ROLE
                        </th>

                        <th>
                            CREDIT
                        </th>

                        <th>
                            STATUS
                        </th>

                        <th>
                            EMAIL
                        </th>

                        <th>
                            ACTION
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
