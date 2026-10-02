/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT EVENTS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-events.js

   Fungsi:
   - Add User events
   - Edit User events
   - Delete User events
   - Search
   - Refresh
   - Table action delegation
   - Modal backdrop
   - Escape key
========================================================= */

import { userState } from "./user-state.js";

import {
    filterUsers,
    loadUsers
} from "./user-data.js";

import {
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal
} from "./user-modal.js";

import {
    submitAddUser,
    submitEditUser,
    confirmEmail,
    resendEmail,
    confirmDeleteUser
} from "./user-actions.js";


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
        button.dataset.action || "";


    const userId =
        button.dataset.userId || "";


    const email =
        button.dataset.userEmail || "";


    const name =
        button.dataset.userName || "";


    switch (action) {

        /* -------------------------------------------------
           EDIT
        ------------------------------------------------- */

        case "edit": {

            if (!userId) {

                console.warn(
                    "[GEN-Z.AI UserEvents] Edit user ID tidak ditemukan."
                );

                return;

            }


            /*
             * Ambil data lengkap dari state.
             *
             * Jangan mengandalkan data-* untuk seluruh
             * object user karena credits/status/email
             * bisa mengandung format yang tidak perlu
             * dipindahkan ke HTML.
             */

            const user =
                userState.allUsers.find(
                    item =>
                        String(item.id) ===
                        String(userId)
                );


            if (!user) {

                console.warn(
                    "[GEN-Z.AI UserEvents] User edit tidak ditemukan:",
                    userId
                );

                return;

            }


            openEditModal(
                user
            );

            break;

        }


        /* -------------------------------------------------
           CONFIRM EMAIL
        ------------------------------------------------- */

        case "confirm": {

            confirmEmail(
                userId,
                email
            );

            break;

        }


        /* -------------------------------------------------
           RESEND EMAIL
        ------------------------------------------------- */

        case "resend": {

            resendEmail(
                email
            );

            break;

        }


        /* -------------------------------------------------
           DELETE
        ------------------------------------------------- */

        case "delete": {

            openDeleteModal(
                userId,
                email,
                name
            );

            break;

        }


        default:

            break;

    }

}


/* =========================================================
   ESCAPE KEY
========================================================= */

function handleEscapeKey(
    event
) {

    if (
        event.key !== "Escape" &&
        event.key !== "Esc"
    ) {

        return;

    }


    const editModal =
        document.getElementById(
            "editModal"
        );


    const addModal =
        document.getElementById(
            "addModal"
        );


    const deleteModal =
        document.getElementById(
            "deleteModal"
        );


    /*
     * Prioritas:
     * Edit → Add → Delete
     */

    if (
        editModal?.classList.contains(
            "show"
        )
    ) {

        closeEditModal();

        return;

    }


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

function handleAddModalBackdrop(
    event
) {

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
   EDIT MODAL BACKDROP
========================================================= */

function handleEditModalBackdrop(
    event
) {

    const modal =
        document.getElementById(
            "editModal"
        );


    if (!modal) {

        return;

    }


    if (
        event.target === modal
    ) {

        closeEditModal();

    }

}


/* =========================================================
   DELETE MODAL BACKDROP
========================================================= */

function handleDeleteModalBackdrop(
    event
) {

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
   INIT USER EVENTS
========================================================= */

export function initUserEvents() {

    console.log(
        "[GEN-Z.AI UserEvents] Initializing events..."
    );


    /* =====================================================
       ADD USER
    ===================================================== */

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


    /* =====================================================
       EDIT USER
    ===================================================== */

    const closeEditButton =
        document.getElementById(
            "closeEditButton"
        );


    if (closeEditButton) {

        closeEditButton.addEventListener(
            "click",
            closeEditModal
        );

    }


    const cancelEditButton =
        document.getElementById(
            "cancelEditButton"
        );


    if (cancelEditButton) {

        cancelEditButton.addEventListener(
            "click",
            closeEditModal
        );

    }


    const editUserForm =
        document.getElementById(
            "editUserForm"
        );


    if (editUserForm) {

        editUserForm.addEventListener(
            "submit",
            submitEditUser
        );

    }


    /* =====================================================
       DELETE USER
    ===================================================== */

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


    /* =====================================================
       SEARCH
    ===================================================== */

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


    /* =====================================================
       REFRESH
    ===================================================== */

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


    /* =====================================================
       TABLE DELEGATION
    ===================================================== */

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


    /* =====================================================
       MODAL BACKDROPS
    ===================================================== */

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


    const editModal =
        document.getElementById(
            "editModal"
        );


    if (editModal) {

        editModal.addEventListener(
            "click",
            handleEditModalBackdrop
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


    /* =====================================================
       ESCAPE
    ===================================================== */

    document.addEventListener(
        "keydown",
        handleEscapeKey
    );


    console.log(
        "[GEN-Z.AI UserEvents] ✓ Events siap."
    );

}
