/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - MODAL
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-modal.js

   Fungsi:
   - Open Add User modal
   - Close Add User modal
   - Open Delete User modal
   - Close Delete User modal
   - Menyimpan user target untuk proses DELETE

   Catatan:
   - Tidak melakukan API request
   - Tidak melakukan authentication
   - Tidak melakukan render tabel
========================================================= */

import {
    userState
} from "./user-state.js";


/* =========================================================
   ADD USER MODAL
========================================================= */

export function openAddModal() {

    const modal =
        document.getElementById(
            "addModal"
        );


    const form =
        document.getElementById(
            "addUserForm"
        );


    if (!modal) {

        return;

    }


    /* =====================================================
       RESET FORM
    ====================================================== */

    if (form) {

        form.reset();

    }


    /* =====================================================
       DEFAULT VALUES
    ====================================================== */

    const creditsInput =
        document.getElementById(
            "newCredits"
        );


    if (creditsInput) {

        creditsInput.value = "0";

    }


    const roleInput =
        document.getElementById(
            "newRole"
        );


    if (roleInput) {

        roleInput.value = "USER";

    }


    const statusInput =
        document.getElementById(
            "newStatus"
        );


    if (statusInput) {

        statusInput.value = "active";

    }


    /* =====================================================
       OPEN
    ====================================================== */

    modal.classList.add(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    /* =====================================================
       FOCUS
    ====================================================== */

    window.setTimeout(
        () => {

            const emailInput =
                document.getElementById(
                    "newEmail"
                );


            emailInput?.focus();

        },
        100
    );

}


/* =========================================================
   CLOSE ADD USER MODAL
========================================================= */

export function closeAddModal() {

    const modal =
        document.getElementById(
            "addModal"
        );


    if (!modal) {

        return;

    }


    modal.classList.remove(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   DELETE USER MODAL
========================================================= */

export function openDeleteModal(
    userId,
    email,
    name = ""
) {

    const modal =
        document.getElementById(
            "deleteModal"
        );


    if (!modal) {

        return;

    }


    /* =====================================================
       VALIDATE USER ID
    ====================================================== */

    if (!userId) {

        return;

    }


    /* =====================================================
       SAVE TARGET
    ====================================================== */

    userState.userToDelete = {

        id: String(userId),

        email:
            String(email || "")
            .trim(),

        name:
            String(name || "")
            .trim()

    };


    /* =====================================================
       DISPLAY TARGET
    ====================================================== */

    const nameElement =
        document.getElementById(
            "deleteUserName"
        );


    if (nameElement) {

        const displayName =
            userState.userToDelete.name ||
            userState.userToDelete.email ||
            userState.userToDelete.id;


        nameElement.textContent =
            displayName;

    }


    /* =====================================================
       OPEN
    ====================================================== */

    modal.classList.add(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );

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

        modal.classList.remove(
            "show"
        );


        modal.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    /* =====================================================
       CLEAR TARGET
    ====================================================== */

    userState.userToDelete =
        null;

}
