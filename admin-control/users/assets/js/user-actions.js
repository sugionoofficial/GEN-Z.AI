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

   Dependency:
   - user-state.js
   - user-api.js
   - user-modal.js
   - user-data.js
   - user-utils.js

   Tidak menangani:
   - Authentication halaman
   - Render table
   - Event binding
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
   CREATE USER
========================================================= */

export async function submitAddUser(
    event
) {

    if (event) {

        event.preventDefault();

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

    const submitButton =
        document.querySelector(
            '#addUserForm button[type="submit"]'
        );


    /* -----------------------------------------------------
       READ VALUES
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


    const credits =
        Number(
            creditsInput?.value || 0
        );


    const status =
        String(
            statusInput?.value || "active"
        )
            .trim()
            .toLowerCase();


    /* -----------------------------------------------------
       VALIDATE EMAIL
    ----------------------------------------------------- */

    if (!email) {

        showMessage(
            "Email wajib diisi.",
            "error"
        );

        emailInput?.focus();

        return;

    }


    /* -----------------------------------------------------
       BASIC EMAIL FORMAT
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       VALIDATE PASSWORD
    ----------------------------------------------------- */

    if (
        password.length < 6
    ) {

        showMessage(
            "Password minimal 6 karakter.",
            "error"
        );

        passwordInput?.focus();

        return;

    }


    /* -----------------------------------------------------
       VALIDATE ROLE
    ----------------------------------------------------- */

    if (
        ![
            "USER",
            "ADMIN",
            "OWNER"
        ].includes(
            role
        )
    ) {

        role =
            "USER";

    }


    /* -----------------------------------------------------
       ADMIN CAN ONLY CREATE USER
    ----------------------------------------------------- */

    const currentRole =
        String(
            userState.currentProfile?.role || ""
        )
            .trim()
            .toUpperCase();


    if (
        currentRole === "ADMIN"
    ) {

        role =
            "USER";

    }


    /* -----------------------------------------------------
       OWNER CREATION IS NOT ALLOWED
    ----------------------------------------------------- */

    if (
        role === "OWNER"
    ) {

        showMessage(
            "Pembuatan akun OWNER tidak diizinkan.",
            "error"
        );

        return;

    }


    /* -----------------------------------------------------
       VALIDATE CREDITS
    ----------------------------------------------------- */

    if (
        !Number.isFinite(
            credits
        ) ||
        credits < 0
    ) {

        showMessage(
            "Credit harus berupa angka 0 atau lebih.",
            "error"
        );

        creditsInput?.focus();

        return;

    }


    /* -----------------------------------------------------
       VALIDATE STATUS
    ----------------------------------------------------- */

    const validStatuses = [

        "active",
        "inactive",
        "suspended"

    ];


    const normalizedStatus =
        validStatuses.includes(
            status
        )
            ? status
            : "active";


    /* -----------------------------------------------------
       DISABLE SUBMIT
    ----------------------------------------------------- */

    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            "MEMBUAT...";

    }


    try {

        /* -------------------------------------------------
           CREATE REQUEST
        ------------------------------------------------- */

        const result =
            await createUser({

                email,

                password,

                name,

                role,

                credits,

                status:
                    normalizedStatus

            });


        /* -------------------------------------------------
           CLOSE MODAL
        ------------------------------------------------- */

        closeAddModal();


        /* -------------------------------------------------
           RELOAD USER LIST
        ------------------------------------------------- */

        await loadUsers();


        /* -------------------------------------------------
           EMAIL RESULT
        ------------------------------------------------- */

        if (
            result?.emailSent === false
        ) {

            showMessage(

                result?.message ||
                "User berhasil dibuat, tetapi email konfirmasi gagal dikirim.",

                "warning"

            );

        } else {

            showMessage(

                result?.message ||
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

        /* -------------------------------------------------
           RESTORE BUTTON
        ------------------------------------------------- */

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.textContent =
                "CREATE USER";

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
            "User ID tidak tersedia.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(
            `Konfirmasi email ${email || "user ini"}?`
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
            "Gagal mengonfirmasi email.",

            "error"

        );

    }

}


/* =========================================================
   RESEND CONFIRMATION EMAIL
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
            "Email user tidak tersedia.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(
            `Kirim ulang email konfirmasi ke ${normalizedEmail}?`
        );


    if (!confirmed) {

        return;

    }


    try {

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
========================================================= */

export async function confirmDeleteUser() {

    const target =
        userState.userToDelete;


    if (
        !target?.id
    ) {

        showMessage(
            "User yang akan dihapus tidak tersedia.",
            "error"
        );

        return;

    }


    const confirmButton =
        document.getElementById(
            "confirmDeleteButton"
        );


    const confirmed =
        window.confirm(
            `Hapus user ${target.name || target.email || "ini"}? Tindakan ini tidak dapat dibatalkan.`
        );


    if (!confirmed) {

        return;

    }


    /* -----------------------------------------------------
       DISABLE BUTTON
    ----------------------------------------------------- */

    if (confirmButton) {

        confirmButton.disabled =
            true;

        confirmButton.textContent =
            "MENGHAPUS...";

    }


    try {

        await deleteUser(
            target.id
        );


        /* -------------------------------------------------
           CLOSE MODAL
        ------------------------------------------------- */

        closeDeleteModal();


        /* -------------------------------------------------
           RELOAD USERS
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           RESTORE BUTTON
        ------------------------------------------------- */

        if (confirmButton) {

            confirmButton.disabled =
                false;

            confirmButton.textContent =
                "DELETE USER";

        }

    }

}
