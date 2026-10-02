/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - EVENTS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-events.js

   Fungsi:
   - Bind seluruh event halaman Users
   - Add User modal
   - Delete User modal
   - Search
   - Refresh
   - Table action delegation
   - Keyboard Escape
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
   HANDLE TABLE ACTION
   ---------------------------------------------------------
   Event delegation digunakan supaya button yang dibuat
   secara dinamis oleh user-render.js tetap bekerja.
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
        button.dataset.action;


    const userId =
        button.dataset.userId ||
        "";


    const email =
        button.dataset.userEmail ||
        "";


    const name =
        button.dataset.userName ||
        "";


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
   HANDLE ESCAPE
========================================================= */

function handleEscapeKey(event) {

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


    /*
       Jika Add User terbuka,
       tutup Add User terlebih dahulu.
    */

    if (
        addModal &&
        addModal.classList.contains("show")
    ) {

        closeAddModal();

        return;

    }


    /*
       Jika Delete User terbuka,
       tutup Delete User.
    */

    if (
        deleteModal &&
        deleteModal.classList.contains("show")
    ) {

        closeDeleteModal();

    }

}


/* =========================================================
   HANDLE ADD MODAL BACKDROP
========================================================= */

function handleAddModalBackdrop(event) {

    const modal =
        document.getElementById(
            "addModal"
        );


    if (
        !modal ||
        event.target !== modal
    ) {

        return;

    }


    closeAddModal();

}


/* =========================================================
   HANDLE DELETE MODAL BACKDROP
========================================================= */

function handleDeleteModalBackdrop(event) {

    const modal =
        document.getElementById(
            "deleteModal"
        );


    if (
        !modal ||
        event.target !== modal
    ) {

        return;

    }


    closeDeleteModal();

}


/* =========================================================
   INIT EVENTS
========================================================= */

export function initUserEvents() {

    /* =====================================================
       ADD USER BUTTON
    ===================================================== */

    const addUserButton =
        document.getElementById(
            "addUserButton"
        );


    addUserButton?.addEventListener(
        "click",
        openAddModal
    );


    /* =====================================================
       CLOSE ADD MODAL
    ===================================================== */

    const closeAddButton =
        document.getElementById(
            "closeAddButton"
        );


    closeAddButton?.addEventListener(
        "click",
        closeAddModal
    );


    const cancelAddButton =
        document.getElementById(
            "cancelAddButton"
        );


    cancelAddButton?.addEventListener(
        "click",
        closeAddModal
    );


    /* =====================================================
       ADD USER FORM
    ===================================================== */

    const addUserForm =
        document.getElementById(
            "addUserForm"
        );


    addUserForm?.addEventListener(
        "submit",
        submitAddUser
    );


    /* =====================================================
       CLOSE DELETE MODAL
    ===================================================== */

    const closeDeleteButton =
        document.getElementById(
            "closeDeleteButton"
        );


    closeDeleteButton?.addEventListener(
        "click",
        closeDeleteModal
    );


    const cancelDeleteButton =
        document.getElementById(
            "cancelDeleteButton"
        );


    cancelDeleteButton?.addEventListener(
        "click",
        closeDeleteModal
    );


    /* =====================================================
       CONFIRM DELETE
    ===================================================== */

    const confirmDeleteButton =
        document.getElementById(
            "confirmDeleteButton"
        );


    confirmDeleteButton?.addEventListener(
        "click",
        confirmDeleteUser
    );


    /* =====================================================
       SEARCH
    ===================================================== */

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    searchInput?.addEventListener(
        "input",
        filterUsers
    );


    /* =====================================================
       REFRESH
    ===================================================== */

    const refreshButton =
        document.getElementById(
            "refreshButton"
        );


    refreshButton?.addEventListener(
        "click",
        loadUsers
    );


    /* =====================================================
       TABLE ACTION DELEGATION
    ===================================================== */

    const userContainer =
        document.getElementById(
            "userContainer"
        );


    userContainer?.addEventListener(
        "click",
        handleTableAction
    );


    /* =====================================================
       MODAL BACKDROP
    ===================================================== */

    const addModal =
        document.getElementById(
            "addModal"
        );


    addModal?.addEventListener(
        "click",
        handleAddModalBackdrop
    );


    const deleteModal =
        document.getElementById(
            "deleteModal"
        );


    deleteModal?.addEventListener(
        "click",
        handleDeleteModalBackdrop
    );


    /* =====================================================
       ESCAPE KEY
    ===================================================== */

    document.addEventListener(
        "keydown",
        handleEscapeKey
    );

}
