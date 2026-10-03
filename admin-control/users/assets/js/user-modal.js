/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT MODAL
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-modal.js

   Fungsi:
   - Open / close Add User modal
   - Open / close Edit User modal
   - Open / close Delete User modal
   - Menjaga body modal lock
   - Sinkronisasi visual status Edit User
========================================================= */

import { userState } from "./user-state.js";


/* =========================================================
   MODAL BODY LOCK
========================================================= */

function updateBodyModalLock() {

    const modalIds = [

        "addModal",

        "editModal",

        "deleteModal"

    ];


    const hasOpenModal =
        modalIds.some(
            (id) => {

                const modal =
                    document.getElementById(id);

                return (
                    modal &&
                    modal.classList.contains("show")
                );

            }
        );


    document.body.classList.toggle(
        "modal-open",
        hasOpenModal
    );

}


/* =========================================================
   EDIT STATUS VISUAL SYNC
   ---------------------------------------------------------
   Sinkronisasi class warna pada:

   #editStatus

   Class yang digunakan CSS:

   status-active
   status-suspended
   status-banned
========================================================= */

function syncEditStatusVisual(
    statusSelect
) {

    if (!statusSelect) {

        return;

    }


    /*
     * Bersihkan semua class status
     * sebelum menerapkan status terbaru.
     */

    statusSelect.classList.remove(

        "status-active",

        "status-suspended",

        "status-banned"

    );


    /*
     * Normalisasi value.
     */

    const status =

        String(
            statusSelect.value || ""
        )
            .trim()
            .toLowerCase();


    /*
     * Hanya status database yang valid.
     */

    const allowedStatuses = [

        "active",

        "suspended",

        "banned"

    ];


    if (
        !allowedStatuses.includes(status)
    ) {

        return;

    }


    /*
     * Terapkan class sesuai status.
     */

    statusSelect.classList.add(
        `status-${status}`
    );

}


/* =========================================================
   EDIT STATUS CHANGE LISTENER
   ---------------------------------------------------------
   Pastikan warna berubah ketika operator
   mengganti status secara manual.
========================================================= */

function bindEditStatusVisual() {

    const statusSelect =
        document.getElementById(
            "editStatus"
        );


    if (!statusSelect) {

        return;

    }


    /*
     * Hindari listener ganda jika fungsi ini
     * dipanggil lebih dari satu kali.
     */

    if (
        statusSelect.dataset.visualSyncBound === "true"
    ) {

        syncEditStatusVisual(
            statusSelect
        );

        return;

    }


    statusSelect.addEventListener(
        "change",
        () => {

            syncEditStatusVisual(
                statusSelect
            );

        }
    );


    statusSelect.dataset.visualSyncBound =
        "true";


    /*
     * Sinkronisasi awal.
     */

    syncEditStatusVisual(
        statusSelect
    );

}


/* =========================================================
   OPEN ADD USER MODAL
========================================================= */

export function openAddModal() {

    const modal =
        document.getElementById("addModal");


    if (!modal) {

        console.warn(
            "[GEN-Z.AI UserModal] addModal tidak ditemukan."
        );

        return;

    }


    const form =
        document.getElementById("addUserForm");


    if (form) {

        form.reset();

    }


    /*
     * Default values
     */

    const role =
        document.getElementById("newRole");

    if (role) {

        role.value = "USER";

    }


    const credits =
        document.getElementById("newCredits");

    if (credits) {

        credits.value = "0";

    }


    const status =
        document.getElementById("newStatus");

    if (status) {

        status.value = "active";

    }


    /*
     * Pastikan role ADMIN mengikuti
     * role operator saat ini.
     */

    const currentRole =

        String(

            userState.currentProfile?.role ||

            window.GENZNavigation?.getRole?.() ||

            window.GENZ_CURRENT_ROLE ||

            "USER"

        )
            .trim()
            .toUpperCase();


    const adminOption =
        document.getElementById(
            "adminRoleOption"
        );


    if (adminOption) {

        if (currentRole === "OWNER") {

            adminOption.hidden = false;
            adminOption.disabled = false;

        } else {

            adminOption.hidden = true;
            adminOption.disabled = true;

        }

    }


    modal.classList.add("show");


    updateBodyModalLock();


    setTimeout(() => {

        document
            .getElementById("newEmail")
            ?.focus();

    }, 50);

}


/* =========================================================
   CLOSE ADD USER MODAL
========================================================= */

export function closeAddModal() {

    const modal =
        document.getElementById("addModal");


    if (modal) {

        modal.classList.remove("show");

    }


    updateBodyModalLock();

}


/* =========================================================
   OPEN EDIT USER MODAL
========================================================= */

export function openEditModal(
    user
) {

    if (!user || !user.id) {

        console.warn(
            "[GEN-Z.AI UserModal] Target Edit User tidak valid."
        );

        return;

    }


    /*
     * Simpan target edit ke state.
     */

    userState.editingUser = {
        ...user
    };


    const modal =
        document.getElementById("editModal");


    if (!modal) {

        console.error(
            "[GEN-Z.AI UserModal] editModal tidak ditemukan."
        );

        return;

    }


    /*
     * ID
     */

    const idInput =
        document.getElementById(
            "editUserId"
        );


    if (idInput) {

        idInput.value =
            String(
                user.id || ""
            );

    }


    /*
     * Email
     *
     * Email dibuat readonly pada HTML.
     * Kita hanya mengisi nilainya di sini.
     */

    const emailInput =
        document.getElementById(
            "editEmail"
        );


    if (emailInput) {

        emailInput.value =
            String(
                user.email || ""
            );

    }


    /*
     * Name
     */

    const nameInput =
        document.getElementById(
            "editName"
        );


    if (nameInput) {

        nameInput.value =
            String(
                user.name || ""
            );

    }


    /*
     * Role
     */

    const roleSelect =
        document.getElementById(
            "editRole"
        );


    const currentOperatorRole =

        String(

            userState.currentProfile?.role ||

            window.GENZNavigation?.getRole?.() ||

            window.GENZ_CURRENT_ROLE ||

            "USER"

        )
            .trim()
            .toUpperCase();


    const targetRole =

        String(
            user.role || "USER"
        )
            .trim()
            .toUpperCase();


    if (roleSelect) {

        roleSelect.value =
            targetRole === "ADMIN"
                ? "ADMIN"
                : "USER";

    }


    /*
     * ADMIN option
     *
     * OWNER:
     * USER / ADMIN dapat dipilih.
     *
     * ADMIN:
     * hanya USER.
     */

    const adminOption =
        document.getElementById(
            "editAdminRoleOption"
        );


    if (adminOption) {

        if (
            currentOperatorRole === "OWNER"
        ) {

            adminOption.hidden = false;
            adminOption.disabled = false;

        } else {

            adminOption.hidden = true;
            adminOption.disabled = true;

            if (roleSelect) {

                roleSelect.value =
                    "USER";

            }

        }

    }


    /*
     * Credits
     */

    const creditsInput =
        document.getElementById(
            "editCredits"
        );


    if (creditsInput) {

        const credits =
            Number(
                user.credits ?? 0
            );


        creditsInput.value =
            Number.isFinite(credits)
                ? String(credits)
                : "0";

    }


    /*
     * Status
     * -----------------------------------------------------
     * STATUS DATABASE YANG VALID:
     *
     * active
     * suspended
     * banned
     *
     * Tidak menggunakan "inactive".
     * Jika user.status = "banned", maka dropdown
     * Edit User harus tetap memilih "banned".
     */

    const statusSelect =
        document.getElementById(
            "editStatus"
        );


    if (statusSelect) {

        const status =

            String(
                user.status || "active"
            )
                .trim()
                .toLowerCase();


        const allowedStatuses = [

            "active",

            "suspended",

            "banned"

        ];


        statusSelect.value =

            allowedStatuses.includes(status)

                ? status

                : "active";


        /*
         * Sinkronkan warna berdasarkan
         * status yang benar-benar terpilih.
         */

        syncEditStatusVisual(
            statusSelect
        );


        /*
         * Pastikan perubahan manual pada
         * dropdown juga mengubah warna.
         */

        bindEditStatusVisual();


        /*
         * Debug ringan untuk memastikan nilai status
         * yang diterima dari database sesuai dengan
         * option yang tersedia pada select.
         */

        console.log(
            "[GEN-Z.AI UserModal] Edit status:",
            {
                userId: user.id,
                databaseStatus: user.status,
                normalizedStatus: status,
                selectedStatus: statusSelect.value,
                visualClasses:
                    statusSelect.className
            }
        );

    }


    /*
     * Email verification
     */

    const emailConfirmed =
        document.getElementById(
            "editEmailConfirmed"
        );


    if (emailConfirmed) {

        emailConfirmed.checked =
            Boolean(
                user.email_confirmed
            );

    }


    /*
     * Tampilkan modal.
     */

    modal.classList.add("show");


    updateBodyModalLock();


    setTimeout(() => {

        document
            .getElementById("editName")
            ?.focus();

    }, 50);

}


/* =========================================================
   CLOSE EDIT USER MODAL
========================================================= */

export function closeEditModal() {

    const modal =
        document.getElementById(
            "editModal"
        );


    if (modal) {

        modal.classList.remove("show");

    }


    userState.editingUser =
        null;


    updateBodyModalLock();

}


/* =========================================================
   OPEN DELETE USER MODAL
========================================================= */

export function openDeleteModal(
    userId,
    email = "",
    name = ""
) {

    if (!userId) {

        console.warn(
            "[GEN-Z.AI UserModal] Delete target tidak valid."
        );

        return;

    }


    userState.userToDelete = {

        id:
            String(userId),

        email:
            String(email || ""),

        name:
            String(name || "")

    };


    const modal =
        document.getElementById(
            "deleteModal"
        );


    if (!modal) {

        console.warn(
            "[GEN-Z.AI UserModal] deleteModal tidak ditemukan."
        );

        return;

    }


    const nameElement =
        document.getElementById(
            "deleteUserName"
        );


    if (nameElement) {

        nameElement.textContent =

            String(
                name ||
                email ||
                "User"
            );

    }


    const emailElement =
        document.getElementById(
            "deleteUserEmail"
        );


    if (emailElement) {

        emailElement.textContent =
            String(email || "");

    }


    const idElement =
        document.getElementById(
            "deleteUserId"
        );


    if (idElement) {

        idElement.value =
            String(userId);

    }


    modal.classList.add("show");


    updateBodyModalLock();

}


/* =========================================================
   CLOSE DELETE USER MODAL
========================================================= */

export function closeDeleteModal() {

    const modal =
        document.getElementById(
            "deleteModal"
        );


    if (modal) {

        modal.classList.remove("show");

    }


    userState.userToDelete =
        null;


    updateBodyModalLock();

}


/* =========================================================
   CLOSE ALL MODALS
========================================================= */

export function closeAllModals() {

    const addModal =
        document.getElementById(
            "addModal"
        );


    const editModal =
        document.getElementById(
            "editModal"
        );


    const deleteModal =
        document.getElementById(
            "deleteModal"
        );


    if (addModal) {

        addModal.classList.remove(
            "show"
        );

    }


    if (editModal) {

        editModal.classList.remove(
            "show"
        );

    }


    if (deleteModal) {

        deleteModal.classList.remove(
            "show"
        );

    }


    userState.userToDelete =
        null;


    userState.editingUser =
        null;


    updateBodyModalLock();

}


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZUserModal = {

        openAddModal,

        closeAddModal,

        openEditModal,

        closeEditModal,

        openDeleteModal,

        closeDeleteModal,

        closeAllModals

    };

}
