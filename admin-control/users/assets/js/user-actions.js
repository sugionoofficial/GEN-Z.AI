/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - ACTIONS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-actions.js

   Fungsi:
   - Create user
   - Confirm email
   - Resend confirmation email
   - Delete user
========================================================= */

import {
    userState
} from "./user-state.js";

import {
    createUser,
    confirmUserEmail,
    resendConfirmation,
    deleteUser
} from "./user-api.js";

import {
    closeAddModal,
    closeDeleteModal
} from "./user-modal.js";

import {
    loadUsers
} from "./user-data.js";

import {
    showMessage
} from "./user-utils.js";


/* =========================================================
   CREATE USER
========================================================= */

export async function submitAddUser(event) {

    event.preventDefault();


    const form =
        document.getElementById(
            "addUserForm"
        );


    if (!form) {

        return;

    }


    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    const emailInput =
        document.getElementById(
            "newEmail"
        );

    const passwordInput =
        document.getElementById(
            "newPassword"
        );

    const nameInput =
        document.getElementById(
            "newName"
        );

    const roleInput =
        document.getElementById(
            "newRole"
        );

    const creditsInput =
        document.getElementById(
            "newCredits"
        );

    const statusInput =
        document.getElementById(
            "newStatus"
        );


    /* -----------------------------------------------------
       READ INPUT
    ----------------------------------------------------- */

    const email =
        String(
            emailInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const password =
        String(
            passwordInput?.value || ""
        );


    const name =
        String(
            nameInput?.value || ""
        )
            .trim();


    let role =
        String(
            roleInput?.value || "USER"
        )
            .trim()
            .toUpperCase();


    const creditsRaw =
        String(
            creditsInput?.value || "0"
        )
            .trim();


    let status =
        String(
            statusInput?.value || "active"
        )
            .trim()
            .toLowerCase();


    /* -----------------------------------------------------
       EMAIL VALIDATION
    ----------------------------------------------------- */

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!email) {

        showMessage(
            "Email wajib diisi.",
            "error"
        );

        emailInput?.focus();

        return;

    }


    if (!emailPattern.test(email)) {

        showMessage(
            "Format email tidak valid.",
            "error"
        );

        emailInput?.focus();

        return;

    }


    /* -----------------------------------------------------
       PASSWORD VALIDATION
    ----------------------------------------------------- */

    if (password.length < 6) {

        showMessage(
            "Password minimal 6 karakter.",
            "error"
        );

        passwordInput?.focus();

        return;

    }


    /* -----------------------------------------------------
       ROLE VALIDATION
    ----------------------------------------------------- */

    const currentRole =
        String(
            userState.currentProfile?.role || ""
        )
            .trim()
            .toUpperCase();


    const allowedRoles =
        ["USER", "ADMIN", "OWNER"];


    if (
        !allowedRoles.includes(role)
    ) {

        role = "USER";

    }


    /*
     * ADMIN hanya boleh membuat USER.
     */

    if (currentRole === "ADMIN") {

        role = "USER";

    }


    /*
     * OWNER tidak boleh dibuat melalui
     * User Management.
     */

    if (role === "OWNER") {

        showMessage(
            "Role OWNER tidak dapat dibuat melalui User Management.",
            "error"
        );

        return;

    }


    /* -----------------------------------------------------
       CREDIT VALIDATION
    ----------------------------------------------------- */

    const credits =
        Number(
            creditsRaw || 0
        );


    if (
        !Number.isFinite(credits) ||
        credits < 0
    ) {

        showMessage(
            "Credits harus berupa angka 0 atau lebih.",
            "error"
        );

        creditsInput?.focus();

        return;

    }


    /* -----------------------------------------------------
       STATUS VALIDATION
    ----------------------------------------------------- */

    const allowedStatuses =
        [
            "active",
            "inactive",
            "suspended"
        ];


    if (
        !allowedStatuses.includes(status)
    ) {

        status = "active";

    }


    /* -----------------------------------------------------
       LOCK SUBMIT
    ----------------------------------------------------- */

    const originalText =
        submitButton?.textContent ||
        "Create User";


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
            "Creating...";

    }


    try {

        /* -------------------------------------------------
           CREATE
        ------------------------------------------------- */

        const result =
            await createUser({

                email,

                password,

                name,

                role,

                credits,

                status

            });


        /* -------------------------------------------------
           CLOSE MODAL
        ------------------------------------------------- */

        closeAddModal();


        /* -------------------------------------------------
           REFRESH DATA
        ------------------------------------------------- */

        await loadUsers();


        /* -------------------------------------------------
           EMAIL RESULT
        ------------------------------------------------- */

        if (
            result &&
            result.emailSent === false
        ) {

            showMessage(
                "User berhasil dibuat, tetapi email konfirmasi belum berhasil dikirim.",
                "warning"
            );

        } else {

            showMessage(
                "User berhasil dibuat.",
                "success"
            );

        }

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Create user error:",
            error
        );


        showMessage(
            error?.message ||
            "Gagal membuat user.",
            "error"
        );

    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                originalText;

        }

    }

}


/* =========================================================
   CONFIRM EMAIL
========================================================= */

export async function confirmEmail(
    userId,
    email = ""
) {

    if (!userId) {

        return;

    }


    const displayEmail =
        String(
            email || ""
        ).trim();


    const confirmed =
        window.confirm(
            displayEmail
                ? `Konfirmasi email ${displayEmail}?`
                : "Konfirmasi email user ini?"
        );


    if (!confirmed) {

        return;

    }


    try {

        await confirmUserEmail(
            userId
        );


        await loadUsers();


        showMessage(
            "Email user berhasil dikonfirmasi.",
            "success"
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Confirm email error:",
            error
        );


        showMessage(
            error?.message ||
            "Gagal mengonfirmasi email user.",
            "error"
        );

    }

}


/* =========================================================
   RESEND CONFIRMATION
========================================================= */

export async function resendEmail(
    email
) {

    const targetEmail =
        String(
            email || ""
        ).trim();


    if (!targetEmail) {

        showMessage(
            "Email user tidak ditemukan.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(
            `Kirim ulang email konfirmasi ke ${targetEmail}?`
        );


    if (!confirmed) {

        return;

    }


    try {

        const result =
            await resendConfirmation(
                targetEmail
            );


        if (
            result &&
            result.emailSent === false
        ) {

            showMessage(
                "Permintaan berhasil diproses, tetapi email konfirmasi belum berhasil dikirim.",
                "warning"
            );

        } else {

            showMessage(
                "Email konfirmasi berhasil dikirim ulang.",
                "success"
            );

        }

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Resend confirmation error:",
            error
        );


        showMessage(
            error?.message ||
            "Gagal mengirim ulang email konfirmasi.",
            "error"
        );

    }

}


/* =========================================================
   DELETE USER
========================================================= */

export async function confirmDeleteUser() {

    const target =
        userState.userToDelete;


    if (!target?.id) {

        closeDeleteModal();

        return;

    }


    const button =
        document.getElementById(
            "confirmDeleteButton"
        );


    if (button) {

        button.disabled = true;

        button.textContent =
            "Deleting...";

    }


    try {

        await deleteUser(
            target.id
        );


        closeDeleteModal();


        await loadUsers();


        showMessage(
            "User berhasil dihapus.",
            "success"
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Delete user error:",
            error
        );


        showMessage(
            error?.message ||
            "Gagal menghapus user.",
            "error"
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Delete User";

        }

    }

}
