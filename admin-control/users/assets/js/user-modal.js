/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT MODAL
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-modal.js

   Fungsi:
   - Membuka modal Add User
   - Menutup modal Add User
   - Membuka modal Delete User
   - Menutup modal Delete User
   - Menyimpan user yang akan dihapus
   - Tidak melakukan API request
   - Tidak melakukan authentication
   - Tidak melakukan redirect
   ========================================================= */

import { userState } from "./user-state.js";


/* =========================================================
   ELEMENT HELPER
========================================================= */

function getElement(id) {

    return document.getElementById(id);
}


/* =========================================================
   RESET ADD FORM
========================================================= */

function resetAddForm() {

    const form =
        getElement("addUserForm");

    if (!form) {
        return;
    }


    form.reset();


    /*
       Default values.
    */

    const role =
        getElement("newRole");

    if (role) {

        role.value = "USER";
    }


    const credits =
        getElement("newCredits");

    if (credits) {

        credits.value = "0";
    }


    const status =
        getElement("newStatus");

    if (status) {

        status.value = "active";
    }


    /*
       Pastikan field password kembali normal.
    */

    const password =
        getElement("newPassword");

    if (password) {

        password.value = "";
    }
}


/* =========================================================
   OPEN ADD MODAL
========================================================= */

export function openAddModal() {

    const modal =
        getElement("addModal");

    if (!modal) {

        console.warn(
            "[GEN-Z.AI UserModal] #addModal tidak ditemukan."
        );

        return;
    }


    resetAddForm();


    /*
       Hapus state delete.
    */

    userState.userToDelete = null;


    /*
       Tampilkan modal.
    */

    modal.classList.add("show");


    /*
       Lock body scroll.
    */

    document.body.classList.add(
        "modal-open"
    );


    /*
       Focus email field.
    */

    window.setTimeout(() => {

        const email =
            getElement("newEmail");

        if (email) {

            email.focus();
        }

    }, 50);
}


/* =========================================================
   CLOSE ADD MODAL
========================================================= */

export function closeAddModal() {

    const modal =
        getElement("addModal");

    if (!modal) {
        return;
    }


    modal.classList.remove("show");


    /*
       Hanya hapus modal-open jika
       modal delete juga tidak terbuka.
    */

    const deleteModal =
        getElement("deleteModal");


    if (
        !deleteModal ||
        !deleteModal.classList.contains("show")
    ) {

        document.body.classList.remove(
            "modal-open"
        );
    }
}


/* =========================================================
   OPEN DELETE MODAL
========================================================= */

export function openDeleteModal(
    userId,
    email,
    name
) {

    const modal =
        getElement("deleteModal");

    if (!modal) {

        console.warn(
            "[GEN-Z.AI UserModal] #deleteModal tidak ditemukan."
        );

        return;
    }


    /*
       Simpan target user.
    */

    userState.userToDelete = {

        id: String(userId || "").trim(),

        email: String(email || "").trim(),

        name: String(
            name ||
            email ||
            "User"
        ).trim()
    };


    /*
       Tampilkan nama user.
    */

    const nameElement =
        getElement("deleteUserName");

    if (nameElement) {

        nameElement.textContent =
            userState.userToDelete.name;
    }


    /*
       Tampilkan email / ID bila element tersedia.
       Tidak memaksa struktur HTML tertentu.
    */

    const emailElement =
        getElement("deleteUserEmail");

    if (emailElement) {

        emailElement.textContent =
            userState.userToDelete.email;
    }


    const idElement =
        getElement("deleteUserId");

    if (idElement) {

        idElement.textContent =
            userState.userToDelete.id;
    }


    /*
       Tampilkan modal.
    */

    modal.classList.add("show");


    document.body.classList.add(
        "modal-open"
    );
}


/* =========================================================
   CLOSE DELETE MODAL
========================================================= */

export function closeDeleteModal() {

    const modal =
        getElement("deleteModal");

    if (modal) {

        modal.classList.remove("show");
    }


    /*
       Hapus target.
    */

    userState.userToDelete = null;


    /*
       Lepas body lock jika Add Modal
       juga tidak sedang terbuka.
    */

    const addModal =
        getElement("addModal");


    if (
        !addModal ||
        !addModal.classList.contains("show")
    ) {

        document.body.classList.remove(
            "modal-open"
        );
    }
}


/* =========================================================
   CLOSE ALL MODALS
========================================================= */

export function closeAllModals() {

    closeAddModal();
    closeDeleteModal();
}


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (typeof window !== "undefined") {

    window.GENZUserModal = {

        openAddModal,

        closeAddModal,

        openDeleteModal,

        closeDeleteModal,

        closeAllModals
    };
}
