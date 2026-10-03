/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT ACTIONS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-actions.js

   Fungsi:
   - Create user
   - Confirm email
   - Resend confirmation
   - Edit user
   - Delete user

   Catatan:
   - Permission frontend hanya sebagai guard.
   - Permission sebenarnya tetap divalidasi oleh API.
========================================================= */

import { userState } from "./user-state.js";

import {
    createUser,
    resendConfirmation,
    confirmUserEmail,
    updateUser,
    deleteUser
} from "./user-api.js";

import {
    closeAddModal,
    closeEditModal,
    closeDeleteModal
} from "./user-modal.js";

import {
    loadUsers
} from "./user-data.js";

import {
    showMessage,
    clearMessage
} from "./user-utils.js";


/* =========================================================
   CURRENT ROLE
========================================================= */

function getCurrentRole() {

    const role =

        userState.currentProfile?.role ||

        window.GENZNavigation?.getRole?.() ||

        window.GENZ_CURRENT_ROLE ||

        "USER";


    return String(role)
        .trim()
        .toUpperCase();

}


/* =========================================================
   TARGET PERMISSION
========================================================= */

function canManageTarget(
    target
) {

    if (!target?.id) {

        return false;

    }


    const currentRole =
        getCurrentRole();


    const currentUserId =

        userState.currentUser?.id ||

        window.GENZNavigation?.getUser?.()?.id ||

        window.GENZ_CURRENT_USER?.id ||

        "";


    /*
     * Tidak boleh mengelola akun sendiri.
     */

    if (
        currentUserId &&
        String(target.id) ===
        String(currentUserId)
    ) {

        return false;

    }


    const targetRole =

        String(
            target.role || "USER"
        )
            .trim()
            .toUpperCase();


    /*
     * OWNER tidak dapat mengedit OWNER.
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


    /*
     * Hanya ADMIN / OWNER.
     */

    if (
        currentRole !== "ADMIN" &&
        currentRole !== "OWNER"
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   VALIDATE CREDITS
========================================================= */

function parseCredits(
    value
) {

    const credits =
        Number(value);


    if (
        !Number.isFinite(credits)
    ) {

        throw new Error(
            "Credits harus berupa angka yang valid."
        );

    }


    if (
        credits < 0
    ) {

        throw new Error(
            "Credits tidak boleh kurang dari 0."
        );

    }


    return credits;

}


/* =========================================================
   VALIDATE STATUS
   ---------------------------------------------------------
   STATUS DATABASE YANG VALID:
   - active
   - suspended
   - banned

   Tidak menggunakan "inactive".
========================================================= */

function parseStatus(
    value
) {

    const status =

        String(
            value || ""
        )
            .trim()
            .toLowerCase();


    const allowed = [

        "active",

        "suspended",

        "banned"

    ];


    if (
        !allowed.includes(status)
    ) {

        throw new Error(
            "Status user tidak valid."
        );

    }


    return status;

}


/* =========================================================
   VALIDATE ROLE
========================================================= */

function parseRole(
    value
) {

    const role =

        String(
            value || ""
        )
            .trim()
            .toUpperCase();


    if (
        role !== "USER" &&
        role !== "ADMIN"
    ) {

        throw new Error(
            "Role user tidak valid."
        );

    }


    return role;

}


/* =========================================================
   SUBMIT ADD USER
========================================================= */

export async function submitAddUser(
    event
) {

    event.preventDefault();


    clearMessage();


    const email =
        document
            .getElementById("newEmail")
            ?.value
            .trim() || "";


    const password =
        document
            .getElementById("newPassword")
            ?.value || "";


    const name =
        document
            .getElementById("newName")
            ?.value
            .trim() || "";


    let role =

        document
            .getElementById("newRole")
            ?.value || "USER";


    const credits =
        parseCredits(

            document
                .getElementById("newCredits")
                ?.value ?? 0

        );


    const status =
        parseStatus(

            document
                .getElementById("newStatus")
                ?.value || "active"

        );


    const currentRole =
        getCurrentRole();


    /*
     * Email
     */

    if (!email) {

        showMessage(
            "Email wajib diisi.",
            "error"
        );

        return;

    }


    /*
     * Password
     */

    if (
        password.length < 6
    ) {

        showMessage(
            "Password minimal 6 karakter.",
            "error"
        );

        return;

    }


    /*
     * Role
     */

    try {

        role =
            parseRole(role);

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

        return;

    }


    /*
     * ADMIN tidak boleh membuat ADMIN.
     */

    if (
        currentRole === "ADMIN"
    ) {

        role = "USER";

    }


    /*
     * OWNER creation tidak diizinkan.
     */

    if (
        role === "OWNER"
    ) {

        showMessage(
            "Pembuatan user dengan role OWNER tidak diizinkan.",
            "error"
        );

        return;

    }


    /*
     * Role operator harus valid.
     */

    if (
        currentRole !== "ADMIN" &&
        currentRole !== "OWNER"
    ) {

        showMessage(
            "Anda tidak memiliki izin untuk membuat user.",
            "error"
        );

        return;

    }


    const button =
        document.querySelector(
            "#addUserForm button[type='submit']"
        );


    const originalText =
        button?.textContent || "Tambah User";


    try {

        if (button) {

            button.disabled = true;

            button.textContent =
                "Menyimpan...";

        }


        const result =
            await createUser({

                email,

                password,

                name,

                role,

                status,

                credits

            });


        closeAddModal();


        await loadUsers();


        if (
            result?.emailSent === false
        ) {

            showMessage(
                "User berhasil dibuat, tetapi email konfirmasi belum terkirim.",
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

        if (button) {

            button.disabled = false;

            button.textContent =
                originalText;

        }

    }

}


/* =========================================================
   SUBMIT EDIT USER
========================================================= */

export async function submitEditUser(
    event
) {

    event.preventDefault();


    clearMessage();


    const editingUser =
        userState.editingUser;


    if (
        !editingUser?.id
    ) {

        showMessage(
            "User yang akan diedit tidak ditemukan.",
            "error"
        );

        return;

    }


    /*
     * Pastikan target masih merupakan
     * user yang boleh dikelola.
     */

    if (
        !canManageTarget(
            editingUser
        )
    ) {

        showMessage(
            "Anda tidak memiliki izin untuk mengedit user ini.",
            "error"
        );

        return;

    }


    const userId =
        document
            .getElementById("editUserId")
            ?.value
            .trim() ||

        String(
            editingUser.id
        );


    const name =
        document
            .getElementById("editName")
            ?.value
            .trim() || "";


    let role =

        document
            .getElementById("editRole")
            ?.value || "USER";


    let credits;


    let status;


    const emailConfirmedElement =
        document.getElementById(
            "editEmailConfirmed"
        );


    const emailConfirmed =
        Boolean(
            emailConfirmedElement?.checked
        );


    /*
     * Validasi role.
     */

    try {

        role =
            parseRole(role);

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

        return;

    }


    /*
     * Validasi credits.
     */

    try {

        credits =
            parseCredits(

                document
                    .getElementById(
                        "editCredits"
                    )
                    ?.value ?? 0

            );

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

        return;

    }


    /*
     * Validasi status.
     *
     * Status yang diperbolehkan:
     *
     * active
     * suspended
     * banned
     */

    try {

        status =
            parseStatus(

                document
                    .getElementById(
                        "editStatus"
                    )
                    ?.value ||

                "active"

            );

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

        return;

    }


    const currentRole =
        getCurrentRole();


    /*
     * ADMIN tidak boleh memberikan
     * role ADMIN.
     */

    if (
        currentRole === "ADMIN"
    ) {

        role = "USER";

    }


    /*
     * OWNER adalah satu-satunya role
     * yang dapat memberikan ADMIN.
     *
     * OWNER sendiri tidak dapat disentuh.
     */

    if (
        editingUser.role
            ?.toString()
            .trim()
            .toUpperCase() ===
        "OWNER"
    ) {

        showMessage(
            "Akun OWNER tidak dapat diedit.",
            "error"
        );

        return;

    }


    /*
     * ID wajib ada.
     */

    if (!userId) {

        showMessage(
            "ID user tidak ditemukan.",
            "error"
        );

        return;

    }


    /*
     * Tombol submit.
     */

    const button =
        document.querySelector(
            "#editUserForm button[type='submit']"
        );


    const originalText =
        button?.textContent ||
        "Simpan Perubahan";


    try {

        if (button) {

            button.disabled = true;

            button.textContent =
                "Menyimpan...";

        }


        console.log(
            "[GEN-Z.AI UserActions] Updating user:",
            {
                userId,
                name,
                role,
                credits,
                status,
                emailConfirmed
            }
        );


        const result =
            await updateUser({

                userId,

                name,

                role,

                credits,

                status,

                emailConfirmed

            });


        /*
         * Tutup modal setelah API
         * berhasil menyimpan.
         */

        closeEditModal();


        /*
         * Reload data agar tabel langsung
         * menggunakan data database terbaru.
         */

        await loadUsers();


        showMessage(
            result?.user
                ? "Data user berhasil diperbarui."
                : "Data user berhasil diperbarui.",
            "success"
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI UserActions] Update user error:",
            error
        );


        showMessage(
            error?.message ||
            "Gagal memperbarui data user.",
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


/* =========================================================
   CONFIRM EMAIL
========================================================= */

export async function confirmEmail(
    userId,
    email = ""
) {

    if (!userId) {

        showMessage(
            "ID user tidak ditemukan.",
            "error"
        );

        return;

    }


    const target =
        userState.allUsers.find(
            user =>
                String(user.id) ===
                String(userId)
        );


    if (
        target &&
        !canManageTarget(target)
    ) {

        showMessage(
            "Anda tidak memiliki izin untuk mengonfirmasi user ini.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(

            `Konfirmasi email user${email ? `:\n${email}` : ""}?`

        );


    if (!confirmed) {

        return;

    }


    clearMessage();


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

export async function resendEmail(
    email
) {

    if (!email) {

        showMessage(
            "Email user tidak ditemukan.",
            "error"
        );

        return;

    }


    const target =
        userState.allUsers.find(
            user =>
                String(
                    user.email || ""
                ).toLowerCase() ===
                String(email).toLowerCase()
        );


    if (
        target &&
        !canManageTarget(target)
    ) {

        showMessage(
            "Anda tidak memiliki izin untuk mengirim ulang email user ini.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(

            `Kirim ulang email konfirmasi ke:\n${email}?`

        );


    if (!confirmed) {

        return;

    }


    clearMessage();


    try {

        const result =
            await resendConfirmation(
                email
            );


        showMessage(

            result?.emailSent === false

                ? "Permintaan berhasil diproses, tetapi email belum terkirim."

                : "Email konfirmasi berhasil dikirim ulang.",

            result?.emailSent === false
                ? "warning"
                : "success"

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
   DELETE USER
========================================================= */

export async function confirmDeleteUser() {

    const target =
        userState.userToDelete;


    if (!target?.id) {

        showMessage(
            "User yang akan dihapus tidak ditemukan.",
            "error"
        );

        return;

    }


    const fullTarget =
        userState.allUsers.find(
            user =>
                String(user.id) ===
                String(target.id)
        ) ||
        target;


    if (
        !canManageTarget(
            fullTarget
        )
    ) {

        closeDeleteModal();


        showMessage(
            "Anda tidak memiliki izin untuk menghapus user ini.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(

            `Hapus user ini?\n\n` +

            `${target.name || target.email || "User"}\n` +

            `${target.email || ""}\n\n` +

            `Tindakan ini tidak dapat dibatalkan.`

        );


    if (!confirmed) {

        return;

    }


    clearMessage();


    const button =
        document.getElementById(
            "confirmDeleteButton"
        );


    const originalText =
        button?.textContent ||
        "Hapus User";


    try {

        if (button) {

            button.disabled = true;

            button.textContent =
                "Menghapus...";

        }


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
            "[GEN-Z.AI UserActions] Delete user error:",
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


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZUserActions = {

        submitAddUser,

        submitEditUser,

        confirmEmail,

        resendEmail,

        confirmDeleteUser

    };

}
