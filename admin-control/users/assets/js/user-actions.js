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
    resendConfirmation,
    confirmUserEmail,
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
   SUBMIT CREATE USER
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
        ).trim();


    let role =
        String(
            roleInput?.value || "USER"
        )
        .trim()
        .toUpperCase();


    const creditsRaw =
        creditsInput?.value;


    const status =
        String(
            statusInput?.value || "active"
        )
        .trim()
        .toLowerCase();


    /* =====================================================
       VALIDASI EMAIL
    ===================================================== */

    if (!email) {

        showMessage(
            "Email wajib diisi.",
            "error"
        );

        emailInput?.focus();

        return;

    }


    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
        )
    ) {

        showMessage(
            "Format email tidak valid.",
            "error"
        );

        emailInput?.focus();

        return;

    }


    /* =====================================================
       VALIDASI PASSWORD
    ===================================================== */

    if (password.length < 6) {

        showMessage(
            "Password minimal 6 karakter.",
            "error"
        );

        passwordInput?.focus();

        return;

    }


    /* =====================================================
       VALIDASI ROLE
    ===================================================== */

    const allowedRoles = [
        "USER",
        "ADMIN",
        "OWNER"
    ];


    if (
        !allowedRoles.includes(role)
    ) {

        role = "USER";

    }


    const currentRole =
        String(
            userState.currentProfile?.role ||
            ""
        )
        .trim()
        .toUpperCase();


    /*
       ADMIN hanya boleh membuat USER.
    */

    if (
        currentRole === "ADMIN"
    ) {

        role = "USER";

    }


    /*
       OWNER tidak dapat dibuat melalui
       User Management.
    */

    if (
        role === "OWNER"
    ) {

        showMessage(
            "Role OWNER tidak dapat dibuat dari User Management.",
            "error"
        );

        return;

    }


    /* =====================================================
       VALIDASI CREDIT
    ===================================================== */

    const credits =
        Number(
            creditsRaw || 0
        );


    if (
        !Number.isFinite(credits) ||
        credits < 0
    ) {

        showMessage(
            "Credit harus berupa angka 0 atau lebih.",
            "error"
        );

        creditsInput?.focus();

        return;

    }


    /* =====================================================
       VALIDASI STATUS
    ===================================================== */

    const allowedStatuses = [
        "active",
        "inactive",
        "suspended"
    ];


    const finalStatus =
        allowedStatuses.includes(status)
            ? status
            : "active";


    /* =====================================================
       BUTTON STATE
    ===================================================== */

    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    const originalText =
        submitButton?.textContent ||
        "CREATE USER";


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
            "MEMBUAT...";

    }


    try {

        /* =================================================
           CREATE USER
        ================================================= */

        const result =
            await createUser({

                email,

                password,

                name,

                role,

                credits,

                status: finalStatus

            });


        /* =================================================
           CLOSE MODAL
        ================================================= */

        closeAddModal();


        /* =================================================
           REFRESH DATA
        ================================================= */

        await loadUsers();


        /* =================================================
           RESULT MESSAGE
        ================================================= */

        if (
            result?.emailSent === false
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
    email
) {

    if (!userId) {

        showMessage(
            "User ID tidak ditemukan.",
            "error"
        );

        return;

    }


    try {

        const confirmed =
            window.confirm(
                `Konfirmasi email user:\n${email || userId}?`
            );


        if (!confirmed) {

            return;

        }


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

    const normalizedEmail =
        String(
            email || ""
        )
        .trim()
        .toLowerCase();


    if (!normalizedEmail) {

        showMessage(
            "Email user tidak ditemukan.",
            "error"
        );

        return;

    }


    try {

        const confirmed =
            window.confirm(
                `Kirim ulang email konfirmasi ke:\n${normalizedEmail}?`
            );


        if (!confirmed) {

            return;

        }


        await resendConfirmation(
            normalizedEmail
        );


        showMessage(
            "Email konfirmasi berhasil dikirim ulang.",
            "success"
        );

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
   ---------------------------------------------------------
   Tidak menggunakan window.confirm().
   Konfirmasi dilakukan melalui deleteModal.
========================================================= */

export async function confirmDeleteUser() {

    const target =
        userState.userToDelete;


    if (!target?.id) {

        showMessage(
            "User yang akan dihapus tidak ditemukan.",
            "error"
        );

        closeDeleteModal();

        return;

    }


    const button =
        document.getElementById(
            "confirmDeleteButton"
        );


    const originalText =
        button?.textContent ||
        "DELETE USER";


    if (button) {

        button.disabled = true;

        button.textContent =
            "MENGHAPUS...";

    }


    try {

        await deleteUser(
            target.id
        );


        closeDeleteModal();


        await loadUsers();


        showMessage(
            `User ${target.email || target.name || ""} berhasil dihapus.`,
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
                originalText;

        }

    }

}
