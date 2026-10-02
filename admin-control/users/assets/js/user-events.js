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
   - Add User
   - Delete User
   - Confirm Email
   - Resend Email
   - Modal interaction
   - Escape key
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
   TABLE ACTION DELEGATION
========================================================= */

function handleTableAction(event) {

    const button =
        event.target.closest(
            "[data-action]"
        );


    if (!button) {

        return;

    }


    const action =
        button.dataset.action || "";


    const userId =
        button.dataset.userId || "";


    const email =
        button.dataset.userEmail || "";


    const name =
        button.dataset.userName || "";


    switch (action) {

        case "confirm":

            confirmEmail(
                userId,
                email
            );

            break;


        case "resend":

            resendEmail(
                email
            );

            break;


        case "delete":

            openDeleteModal(
                userId,
                email,
                name
            );

            break;


        default:

            break;

    }

}


/* =========================================================
   ESCAPE KEY
========================================================= */

function handleEscapeKey(event) {

    if (
        event.key !== "Escape" &&
        event.key !== "Esc"
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
            "show"
        )
    ) {

        closeAddModal();

        return;

    }


    if (
        deleteModal?.classList.contains(
            "show"
        )
    ) {

        closeDeleteModal();

    }

}


/* =========================================================
   ADD MODAL BACKDROP
========================================================= */

function handleAddModalBackdrop(event) {

    const modal =
        document.getElementById(
            "addModal"
        );


    if (!modal) {

        return;

    }


    if (
        event.target === modal
    ) {

        closeAddModal();

    }

}


/* =========================================================
   DELETE MODAL BACKDROP
========================================================= */

function handleDeleteModalBackdrop(event) {

    const modal =
        document.getElementById(
            "deleteModal"
        );


    if (!modal) {

        return;

    }


    if (
        event.target === modal
    ) {

        closeDeleteModal();

    }

}


/* =========================================================
   INITIALIZE EVENTS
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
       ADD MODAL CLOSE
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
       DELETE CONFIRM
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
       USER TABLE ACTIONS
       Event delegation karena tabel dirender
       ulang setiap kali data berubah.
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
            handleAddModalBackdrop
        );

    }


    const deleteModal =
        document.getElementById(
            "deleteModal"
        );


    if (deleteModal) {

        deleteModal.addEventListener(
            "click",
            handleDeleteModalBackdrop
        );

    }


    /* -----------------------------------------------------
       ESCAPE
    ----------------------------------------------------- */

    document.addEventListener(
        "keydown",
        handleEscapeKey
    );

}
