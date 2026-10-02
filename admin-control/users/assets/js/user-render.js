/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT RENDER
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-render.js

   Fungsi:
   - Render tabel user
   - Render empty state
   - Update statistik
   - Menentukan action berdasarkan role
   - Tidak melakukan API request
   - Tidak melakukan authentication
   - Tidak mengelola modal
   ========================================================= */

import { userState } from "./user-state.js";
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
        Array.isArray(userState.allUsers)
            ? userState.allUsers
            : [];


    const totalUsers =
        document.getElementById("totalUsers");

    const activeUsers =
        document.getElementById("activeUsers");

    const adminUsers =
        document.getElementById("adminUsers");


    /*
       Total user.
    */

    if (totalUsers) {

        totalUsers.textContent =
            formatNumber(users.length);
    }


    /*
       Active user.
    */

    const activeCount =
        users.filter(user => {

            const status =
                String(
                    user?.status || ""
                )
                    .trim()
                    .toLowerCase();

            return status === "active";

        }).length;


    if (activeUsers) {

        activeUsers.textContent =
            formatNumber(activeCount);
    }


    /*
       ADMIN + OWNER.
    */

    const adminCount =
        users.filter(user => {

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

        }).length;


    if (adminUsers) {

        adminUsers.textContent =
            formatNumber(adminCount);
    }
}


/* =========================================================
   CURRENT ADMIN ROLE
========================================================= */

function getCurrentRole() {

    return String(
        userState.currentProfile?.role ||
        window.GENZNavigation?.getRole?.() ||
        window.GENZ_CURRENT_ROLE ||
        "USER"
    )
        .trim()
        .toUpperCase();
}


/* =========================================================
   CURRENT USER ID
========================================================= */

function getCurrentUserId() {

    return String(
        userState.currentUser?.id ||
        window.GENZ_CURRENT_USER?.id ||
        ""
    ).trim();
}


/* =========================================================
   CAN MANAGE TARGET USER
========================================================= */

function canManageTargetUser(user) {

    const currentRole =
        getCurrentRole();

    const targetRole =
        String(
            user?.role || "USER"
        )
            .trim()
            .toUpperCase();


    /*
       OWNER:
       dapat mengelola USER dan ADMIN.
       OWNER sendiri tidak boleh dihapus.
    */

    if (currentRole === "OWNER") {

        return targetRole !== "OWNER";
    }


    /*
       ADMIN:
       hanya dapat mengelola USER.
    */

    if (currentRole === "ADMIN") {

        return targetRole === "USER";
    }


    return false;
}


/* =========================================================
   IS SELF
========================================================= */

function isCurrentUser(user) {

    const currentUserId =
        getCurrentUserId();

    const targetId =
        String(
            user?.id || ""
        ).trim();


    return (
        !!currentUserId &&
        !!targetId &&
        currentUserId === targetId
    );
}


/* =========================================================
   RENDER ACTIONS
========================================================= */

function renderActions(user) {

    const currentRole =
        getCurrentRole();

    const targetRole =
        String(
            user?.role || "USER"
        )
            .trim()
            .toUpperCase();

    const status =
        String(
            user?.status || ""
        )
            .trim()
            .toLowerCase();


    const userId =
        escapeHtml(user?.id || "");

    const email =
        escapeHtml(user?.email || "");

    const name =
        escapeHtml(
            user?.name ||
            user?.email ||
            "User"
        );


    const encodedEmail =
        escapeHtml(user?.email || "");


    /*
       Self protection.
    */

    const self =
        isCurrentUser(user);


    /*
       Permission.
    */

    const canManage =
        canManageTargetUser(user);


    /*
       Tidak ada action untuk diri sendiri.
    */

    if (self) {

        return `
            <div class="actions">

                <span class="action-disabled">
                    Current User
                </span>

            </div>
        `;
    }


    /*
       Jika role tidak memiliki permission.
    */

    if (!canManage) {

        return `
            <div class="actions">

                <span class="action-disabled">
                    No Access
                </span>

            </div>
        `;
    }


    const buttons = [];


    /*
       Confirm email.
       Hanya jika belum verified.
    */

    const emailConfirmed =
        Boolean(
            user?.email_confirmed ||
            user?.emailConfirmed ||
            user?.confirmed_at
        );


    if (!emailConfirmed) {

        buttons.push(`
            <button
                type="button"
                class="action-button"
                data-action="confirm"
                data-user-id="${userId}"
                data-user-email="${encodedEmail}"
                title="Confirm email"
            >
                Confirm
            </button>
        `);


        buttons.push(`
            <button
                type="button"
                class="action-button"
                data-action="resend"
                data-user-email="${encodedEmail}"
                title="Resend confirmation email"
            >
                Resend
            </button>
        `);
    }


    /*
       Delete:
       - OWNER dapat delete USER / ADMIN
       - ADMIN hanya USER
       - Tidak pernah delete OWNER
    */

    if (
        currentRole === "OWNER" &&
        targetRole !== "OWNER"
    ) {

        buttons.push(`
            <button
                type="button"
                class="action-button danger-button"
                data-action="delete"
                data-user-id="${userId}"
                data-user-email="${encodedEmail}"
                data-user-name="${name}"
                title="Delete user"
            >
                Delete
            </button>
        `);

    } else if (
        currentRole === "ADMIN" &&
        targetRole === "USER"
    ) {

        buttons.push(`
            <button
                type="button"
                class="action-button danger-button"
                data-action="delete"
                data-user-id="${userId}"
                data-user-email="${encodedEmail}"
                data-user-name="${name}"
                title="Delete user"
            >
                Delete
            </button>
        `);
    }


    /*
       Tidak ada action.
    */

    if (buttons.length === 0) {

        return `
            <div class="actions">

                <span class="action-disabled">
                    -
                </span>

            </div>
        `;
    }


    return `
        <div class="actions">
            ${buttons.join("")}
        </div>
    `;
}


/* =========================================================
   RENDER USER ROW
========================================================= */

function renderUserRow(user) {

    const id =
        escapeHtml(user?.id || "");

    const email =
        escapeHtml(
            user?.email ||
            "-"
        );

    const name =
        escapeHtml(
            user?.name ||
            "-"
        );

    const role =
        String(
            user?.role ||
            "USER"
        )
            .trim()
            .toUpperCase();

    const status =
        String(
            user?.status ||
            "active"
        )
            .trim()
            .toLowerCase();


    const credits =
        formatNumber(
            user?.credits ?? 0
        );


    const roleClass =
        escapeHtml(
            getRoleClass(role)
        );

    const statusClass =
        escapeHtml(
            getStatusClass(status)
        );


    /*
       Email verification.
    */

    const verified =
        Boolean(
            user?.email_confirmed ||
            user?.emailConfirmed ||
            user?.confirmed_at
        );


    const emailBadgeClass =
        verified
            ? "verified"
            : "unverified";


    const emailBadgeText =
        verified
            ? "Verified"
            : "Unverified";


    return `
        <tr data-user-id="${id}">

            <td>

                <div class="user-email">
                    ${email}
                </div>

                <span
                    class="email-badge ${emailBadgeClass}"
                >
                    ${emailBadgeText}
                </span>

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

                <span class="credit-value">
                    ${credits}
                </span>

            </td>


            <td>

                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHtml(status)}
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
                👥
            </div>

            <div class="empty-title">
                Tidak Ada User
            </div>

            <div class="empty-text">
                Belum ada user yang cocok dengan pencarian.
            </div>

        </div>
    `;
}


/* =========================================================
   TABLE HEADER
========================================================= */

function renderTable(users) {

    return `
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

                    ${users
                        .map(renderUserRow)
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   RENDER USERS
========================================================= */

export function renderUsers() {

    const container =
        document.getElementById("userContainer");


    if (!container) {

        console.warn(
            "[GEN-Z.AI UserRender] #userContainer tidak ditemukan."
        );

        return;
    }


    const users =
        Array.isArray(userState.filteredUsers)
            ? userState.filteredUsers
            : [];


    /*
       Tidak ada hasil.
    */

    if (users.length === 0) {

        container.innerHTML =
            renderEmptyState();

        return;
    }


    /*
       Render table.
    */

    container.innerHTML =
        renderTable(users);
}


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (typeof window !== "undefined") {

    window.GENZUserRender = {

        renderUsers,

        updateStats
    };
}
