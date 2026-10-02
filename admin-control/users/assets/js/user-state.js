/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT STATE
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-state.js
========================================================= */

export const userState = {

    /*
     * Current authenticated admin / owner
     */
    currentUser: null,

    currentProfile: null,


    /*
     * User data
     */
    allUsers: [],

    filteredUsers: [],


    /*
     * Delete target
     */
    userToDelete: null,


    /*
     * Edit target
     *
     * Menyimpan user yang sedang dibuka
     * pada modal Edit User.
     */
    editingUser: null

};
