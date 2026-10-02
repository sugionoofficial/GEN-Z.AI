/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT ACTIONS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-actions.js

   Fungsi:
   - Create user
   - Confirm email
   - Resend confirmation email
   - Delete user
   - Validasi form
   - Loading state tombol
   - Tidak mengelola authentication session
   - Tidak melakukan redirect
   - Tidak melakukan signOut
   ========================================================= */

import { userState } from "./user-state.js";

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

import { loadUsers } from "./user-data.js";

import {
    showMessage,
    clearMessage
} from "./user-utils.js";


/* =========================================================
   ELEMENT HELPER
========================================================= */

function getElement(id) {

    return document.getElementById(id);
}


/* =========================================================
   CURRENT ROLE
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
   EMAIL VALIDATION
========================================================= */

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            String(email || "").trim()
        );
}


/* =========================================================
   NUMBER VALIDATION
========================================================= */

function getCreditsValue(value) {

    const credits =
        Number(value);


    if (!Number.isFinite(credits)) {

        return null;
    }


    if (credits < 0) {

        return null;
    }


    return credits;
}


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(
    button,
    loading,
    loadingText = "Memproses..."
) {

    if (!button) {
        return;
    }


    if (loading) {

        if (
            !button.dataset.originalText
        ) {

            button.dataset.originalText =
                button.textContent;
        }


        button.disabled = true;

        button.classList.add(
            "loading"
        );

        button.textContent =
            loadingText;

        return;
    }


    button.disabled = false;

    button.classList.remove(
        "loading"
    );


    if (
        button.dataset.originalText !==
        undefined
    ) {

        button.textContent =
            button.dataset.originalText;

        delete button.dataset.originalText;
    }
}


/* =========================================================
   SUBMIT ADD USER
========================================================= */

export async function submitAddUser(event) {

    event.preventDefault();


    const form =
        event.currentTarget ||
        getElement("addUserForm");


    if (!form) {
        return;
    }


    clearMessage();


    /*
       Fields.
    */

    const emailInput =
        getElement("newEmail");

    const passwordInput =
        getElement("newPassword");

    const nameInput =
        getElement("newName");

    const roleInput =
        getElement("newRole");

    const creditsInput =
        getElement("newCredits");

    const statusInput =
        getElement("newStatus");


    const email =
        String(
            emailInput?.value || ""
        ).trim();


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


    const credits =
        getCreditsValue(
            creditsInput?.value ?? 0
        );


    const status =
        String(
            statusInput?.value || "active"
        )
            .trim()
            .toLowerCase();


    const currentRole =
        getCurrentRole();


    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!isValidEmail(email)) {

        showMessage(
            "Format email tidak valid.",
            "error"
        );

        emailInput?.focus();

        return;
    }


    if (password.length < 6) {

        showMessage(
            "Password minimal 6 karakter.",
            "error"
        );

        passwordInput?.focus();

        return;
    }


    if (
        ![
            "USER",
            "ADMIN",
            "OWNER"
        ].includes(role)
    ) {

        showMessage(
            "Role user tidak valid.",
            "error"
        );

        return;
    }


    /*
       ADMIN hanya boleh membuat USER.
       OWNER boleh membuat USER / ADMIN.
       OWNER tidak boleh dibuat melalui UI.
    */

    if (currentRole === "ADMIN") {

        role = "USER";
    }


    if (role === "OWNER") {

        showMessage(
            "Pembuatan akun OWNER tidak diizinkan.",
            "error"
        );

        return;
    }


    if (credits === null) {

        showMessage(
            "Credits harus berupa angka 0 atau lebih.",
            "error"
        );

        creditsInput?.focus();

        return;
    }


    if (
        ![
            "active",
            "inactive",
            "suspended"
        ].includes(status)
    ) {

        showMessage(
            "Status user tidak valid.",
            "error"
        );

        return;
    }


    /*
       Submit button.
    */

    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    setButtonLoading(
        submitButton,
        true,
        "Membuat User..."
    );


    try {

        /*
           Request ke API.
        */

        const result =
            await createUser({

                email,

                password,

                name,

                role,

                credits,

                status
            });


        /*
           Tutup modal.
        */

        closeAddModal();


        /*
           Refresh data.
        */

        await loadUsers();


        /*
           API dapat memberi informasi
           apakah email confirmation berhasil
           dikirim.
        */

        if (
            result &&
            result.emailSent === false
        ) {

            showMessage(
                "User berhasil dibuat, tetapi email konfirmasi gagal dikirim.",
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
            "[GEN-Z.AI UserActions] Create user error:",
            error
        );


        showMessage(
            error?.message ||
            "Gagal membuat user.",
            "error"
        );

    } finally {

        setButtonLoading(
            submitButton,
            false
        );
    }
}


/* =========================================================
   CONFIRM USER EMAIL
========================================================= */

export async function confirmEmail(
    userId,
    email
) {

    const id =
        String(userId || "").trim();


    if (!id) {

        showMessage(
            "User ID tidak tersedia.",
            "error"
        );

        return;
    }


    const targetEmail =
        String(email || "").trim();


    const confirmed =
        window.confirm(
            targetEmail
                ? `Confirm email untuk ${targetEmail}?`
                : "Confirm email user ini?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const result =
            await confirmUserEmail(id);


        await loadUsers();


        showMessage(
            result?.message ||
            "Email user berhasil dikonfirmasi.",
            "success"
        );


    } catch (error) {

        console.error(
            "[GEN-Z.AI UserActions] Confirm email error:",
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

export async function resendEmail(email) {

    const targetEmail =
        String(email || "").trim();


    if (!targetEmail) {

        showMessage(
            "Email user tidak tersedia.",
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


        showMessage(
            result?.message ||
            "Email konfirmasi berhasil dikirim ulang.",
            "success"
        );


    } catch (error) {

        console.error(
            "[GEN-Z.AI UserActions] Resend email error:",
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
   CONFIRM DELETE USER
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


    const confirmButton =
        getElement("confirmDeleteButton");


    setButtonLoading(
        confirmButton,
        true,
        "Menghapus..."
    );


    try {

        /*
           API tetap menjadi authority untuk
           permission delete.
        */

        const result =
            await deleteUser(
                target.id
            );


        closeDeleteModal();


        await loadUsers();


        showMessage(
            result?.message ||
            "User berhasil dihapus.",
            "success"
        );


    } catch (error) {

        console.error(
            "[GEN-Z.AI UserActions] Delete user error:",
            error
        );


        showMessage(
            error?.message ||
            "Gagal menghapus user.",
            "error"
        );

    } finally {

        setButtonLoading(
            confirmButton,
            false
        );
    }
}


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (typeof window !== "undefined") {

    window.GENZUserActions = {

        submitAddUser,

        confirmEmail,

        resendEmail,

        confirmDeleteUser
    };
}
