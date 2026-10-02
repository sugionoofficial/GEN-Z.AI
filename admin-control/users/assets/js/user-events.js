/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - EVENTS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-events.js

   Fungsi:
   - Bind seluruh event halaman Users
   - Search
   - Refresh
   - Add User modal
   - Delete User modal
   - Confirm
   - Resend
   - Delete
   - Backdrop
   - Escape

   Tidak menangani:
   - API implementation
   - Authentication
   - Render logic
   - State implementation
========================================================= */

import {
    filterUsers,
    loadUsers
} from "./user-data.js";

import {
    openAddModal,
    closeAddModal,
    openDeleteModal,
    closeDeleteModal
} from "./user-modal.js";

import {
    submitAddUser,
    confirmEmail,
    resendEmail,
    confirmDeleteUser
} from "./user-actions.js";


/* =========================================================
   EVENT INITIALIZER
========================================================= */

export function initUserEvents() {

    /* -----------------------------------------------------
       ADD USER BUTTON
    ----------------------------------------------------- */

    const addUserButton =
        document.getElementById(
            "addUserButton"
        );


    if (addUserButton) {

        addUserButton.addEventListener(
            "click",
            openAddModal
        );

    }


    /* -----------------------------------------------------
       CLOSE ADD MODAL
    ----------------------------------------------------- */

    const closeAddButton =
        document.getElementById(
            "closeAddButton"
        );


    if (closeAddButton) {

        closeAddButton.addEventListener(
            "click",
            closeAddModal
        );

    }


    /* -----------------------------------------------------
       CANCEL ADD MODAL
    ----------------------------------------------------- */

    const cancelAddButton =
        document.getElementById(
            "cancelAddButton"
        );


    if (cancelAddButton) {

        cancelAddButton.addEventListener(
            "click",
            closeAddModal
        );

    }


    /* -----------------------------------------------------
       ADD USER FORM
    ----------------------------------------------------- */

    const addUserForm =
        document.getElementById(
            "addUserForm"
        );


    if (addUserForm) {

        addUserForm.addEventListener(
            "submit",
            submitAddUser
        );

    }


    /* -----------------------------------------------------
       DELETE MODAL CLOSE
    ----------------------------------------------------- */

    const closeDeleteButton =
        document.getElementById(
            "closeDeleteButton"
        );


    if (closeDeleteButton) {

        closeDeleteButton.addEventListener(
            "click",
            closeDeleteModal
        );

    }


    /* -----------------------------------------------------
       DELETE MODAL CANCEL
    ----------------------------------------------------- */

    const cancelDeleteButton =
        document.getElementById(
            "cancelDeleteButton"
        );


    if (cancelDeleteButton) {

        cancelDeleteButton.addEventListener(
            "click",
            closeDeleteModal
        );

    }


    /* -----------------------------------------------------
       CONFIRM DELETE
    ----------------------------------------------------- */

    const confirmDeleteButton =
        document.getElementById(
            "confirmDeleteButton"
        );


    if (confirmDeleteButton) {

        confirmDeleteButton.addEventListener(
            "click",
            confirmDeleteUser
        );

    }


    /* -----------------------------------------------------
       SEARCH
    ----------------------------------------------------- */

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            filterUsers
        );

    }


    /* -----------------------------------------------------
       REFRESH
    ----------------------------------------------------- */

    const refreshButton =
        document.getElementById(
            "refreshButton"
        );


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            loadUsers
        );

    }


    /* -----------------------------------------------------
       TABLE ACTIONS
       -----------------------------------------------------
       Event delegation digunakan karena tombol action
       dibuat secara dinamis oleh user-render.js.
    ----------------------------------------------------- */

    const userContainer =
        document.getElementById(
            "userContainer"
        );


    if (userContainer) {

        userContainer.addEventListener(
            "click",
            handleTableAction
        );

    }


    /* -----------------------------------------------------
       MODAL BACKDROP
    ----------------------------------------------------- */

    const addModal =
        document.getElementById(
            "addModal"
        );


    if (addModal) {

        addModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    addModal
                ) {

                    closeAddModal();

                }

            }
        );

    }


    const deleteModal =
        document.getElementById(
            "deleteModal"
        );


    if (deleteModal) {

        deleteModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    deleteModal
                ) {

                    closeDeleteModal();

                }

            }
        );

    }


    /* -----------------------------------------------------
       ESCAPE KEY
    ----------------------------------------------------- */

    document.addEventListener(
        "keydown",
        handleEscapeKey
    );

}


/* =========================================================
   TABLE ACTION HANDLER
========================================================= */

function handleTableAction(
    event
) {

    const button =
        event.target.closest(
            "[data-action]"
        );


    if (!button) {

        return;

    }


    const action =
        button.dataset.action;


    /* -----------------------------------------------------
       CONFIRM
    ----------------------------------------------------- */

    if (
        action === "confirm"
    ) {

        const userId =
            button.dataset.userId || "";


        const email =
            button.dataset.userEmail || "";


        confirmEmail(
            userId,
            email
        );

        return;

    }


    /* -----------------------------------------------------
       RESEND
    ----------------------------------------------------- */

    if (
        action === "resend"
    ) {

        const email =
            button.dataset.userEmail || "";


        resendEmail(
            email
        );

        return;

    }


    /* -----------------------------------------------------
       DELETE
    ----------------------------------------------------- */

    if (
        action === "delete"
    ) {

        const userId =
            button.dataset.userId || "";


        const email =
            button.dataset.userEmail || "";


        const name =
            button.dataset.userName || "";


        openDeleteModal(
            userId,
            email,
            name
        );

    }

}


/* =========================================================
   ESCAPE HANDLER
========================================================= */

function handleEscapeKey(
    event
) {

    if (
        event.key !== "Escape"
    ) {

        return;

    }


    const addModal =
        document.getElementById(
            "addModal"
        );

    const deleteModal =
        document.getElementById(
            "deleteModal"
        );


    if (
        addModal?.classList.contains(
            "open"
        )
    ) {

        closeAddModal();

        return;

    }


    if (
        deleteModal?.classList.contains(
            "open"
        )
    ) {

        closeDeleteModal();

    }

}
