/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - RENDER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-render.js

   Fungsi:
   - Render tabel users
   - Render empty state
   - Render action buttons
   - Update statistics

   Tidak menangani:
   - Authentication
   - API request
   - Create user
   - Delete user
   - Modal
   - Event listener
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

    const totalUsers =
        userState.allUsers.length;


    const activeUsers =
        userState.allUsers.filter(
            user =>
                String(
                    user?.status || ""
                )
                    .trim()
                    .toLowerCase() ===
                "active"
        ).length;


    const adminUsers =
        userState.allUsers.filter(
            user => {

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
            formatNumber(
                totalUsers
            );

    }


    if (activeElement) {

        activeElement.textContent =
            formatNumber(
                activeUsers
            );

    }


    if (adminElement) {

        adminElement.textContent =
            formatNumber(
                adminUsers
            );

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


    /* -----------------------------------------------------
       EMPTY STATE
    ----------------------------------------------------- */

    if (
        !Array.isArray(users) ||
        users.length === 0
    ) {

        container.innerHTML = `
            <div class="empty">
                Tidak ada pengguna ditemukan.
            </div>
        `;

        return;

    }


    /* -----------------------------------------------------
       CURRENT PROFILE
    ----------------------------------------------------- */

    const currentProfile =
        userState.currentProfile;


    const currentUserId =
        userState.currentUser?.id ||
        currentProfile?.id ||
        "";


    const currentRole =
        String(
            currentProfile?.role || ""
        )
            .trim()
            .toUpperCase();


    /* -----------------------------------------------------
       BUILD TABLE
    ----------------------------------------------------- */

    const rows =
        users.map(
            user => {

                const userId =
                    String(
                        user?.id || ""
                    );


                const email =
                    user?.email || "";


                const name =
                    user?.name || "-";


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
                   PERMISSION FLAGS
                ----------------------------------------- */

                const isSelf =
                    Boolean(
                        currentUserId &&
                        userId === currentUserId
                    );


                const isOwner =
                    role === "OWNER";


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
                   ROLE BADGE
                ----------------------------------------- */

                const roleClass =
                    getRoleClass(
                        role
                    );


                /* -----------------------------------------
                   STATUS BADGE
                ----------------------------------------- */

                const statusClass =
                    getStatusClass(
                        status
                    );


                /* -----------------------------------------
                   EMAIL STATUS
                ----------------------------------------- */

                const verificationHtml =
                    emailConfirmed

                        ? `
                            <span class="verified">
                                VERIFIED
                            </span>
                        `

                        : `
                            <span class="unverified">
                                UNVERIFIED
                            </span>
                        `;


                /* -----------------------------------------
                   ACTIONS
                ----------------------------------------- */

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


                if (
                    canDelete
                ) {

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


                if (
                    actions.length === 0
                ) {

                    actions.push(`
                        <span class="no-action">
                            —
                        </span>
                    `);

                }


                /* -----------------------------------------
                   TABLE ROW
                ----------------------------------------- */

                return `
                    <tr>

                        <td>
                            <div class="email-cell">
                                ${escapeHtml(email)}
                            </div>
                        </td>

                        <td>
                            <div class="name-cell">
                                ${escapeHtml(name)}
                            </div>
                        </td>

                        <td>
                            <span
                                class="badge role-${escapeHtml(roleClass)}"
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
                                class="badge status-${escapeHtml(statusClass)}"
                            >
                                ${escapeHtml(status.toUpperCase())}
                            </span>
                        </td>

                        <td>
                            ${verificationHtml}
                        </td>

                        <td>
                            <div class="actions">
                                ${actions.join("")}
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
