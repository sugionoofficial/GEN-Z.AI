/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - MODAL
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-modal.js

   Fungsi:
   - Open Add User modal
   - Close Add User modal
   - Reset Add User form
   - Open Delete User modal
   - Close Delete User modal
   - Menyimpan target user yang akan dihapus

   Tidak menangani:
   - API
   - Authentication
   - Create user
   - Delete user
   - Render table
========================================================= */

import {
    userState
} from "./user-state.js";


/* =========================================================
   GET ELEMENT
========================================================= */

function getElement(id) {

    return document.getElementById(
        id
    );

}


/* =========================================================
   OPEN ADD USER MODAL
========================================================= */

export function openAddModal() {

    const modal =
        getElement(
            "addModal"
        );

    const form =
        getElement(
            "addUserForm"
        );


    /* -----------------------------------------------------
       RESET FORM
    ----------------------------------------------------- */

    if (form) {

        form.reset();

    }


    /* -----------------------------------------------------
       DEFAULT VALUES
    ----------------------------------------------------- */

    const credits =
        getElement(
            "newCredits"
        );

    const role =
        getElement(
            "newRole"
        );

    const status =
        getElement(
            "newStatus"
        );


    if (credits) {

        credits.value =
            "0";

    }


    if (role) {

        role.value =
            "USER";

    }


    if (status) {

        status.value =
            "active";

    }


    /* -----------------------------------------------------
       OPEN MODAL
    ----------------------------------------------------- */

    if (modal) {

        modal.classList.add(
            "open"
        );

    }


    /* -----------------------------------------------------
       FOCUS EMAIL
    ----------------------------------------------------- */

    window.setTimeout(
        () => {

            const email =
                getElement(
                    "newEmail"
                );


            if (email) {

                email.focus();

            }

        },
        100
    );

}


/* =========================================================
   CLOSE ADD USER MODAL
========================================================= */

export function closeAddModal() {

    const modal =
        getElement(
            "addModal"
        );


    if (modal) {

        modal.classList.remove(
            "open"
        );

    }

}


/* =========================================================
   OPEN DELETE USER MODAL
========================================================= */

export function openDeleteModal(
    userId,
    email,
    name = ""
) {

    userState.userToDelete = {

        id:
            userId,

        email:
            email,

        name:
            name

    };


    const modal =
        getElement(
            "deleteModal"
        );

    const userName =
        getElement(
            "deleteUserName"
        );


    /* -----------------------------------------------------
       DISPLAY TARGET USER
    ----------------------------------------------------- */

    if (userName) {

        userName.textContent =
            name ||
            email ||
            "user";

    }


    /* -----------------------------------------------------
       OPEN MODAL
    ----------------------------------------------------- */

    if (modal) {

        modal.classList.add(
            "open"
        );

    }

}


/* =========================================================
   CLOSE DELETE USER MODAL
========================================================= */

export function closeDeleteModal() {

    const modal =
        getElement(
            "deleteModal"
        );


    if (modal) {

        modal.classList.remove(
            "open"
        );

    }


    userState.userToDelete =
        null;

}
