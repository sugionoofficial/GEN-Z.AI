/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - STATE
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-state.js

   Fungsi:
   - Menyimpan state bersama seluruh User Management module
   - Tidak melakukan API request
   - Tidak mengakses DOM
   - Tidak menangani event
========================================================= */

export const userState = {

    /* -----------------------------------------------------
       AUTHENTICATED USER
    ----------------------------------------------------- */

    currentUser: null,


    /* -----------------------------------------------------
       AUTHENTICATED USER PROFILE
       Berisi:
       - id
       - email
       - name
       - role
       - status
       - credits
    ----------------------------------------------------- */

    currentProfile: null,


    /* -----------------------------------------------------
       ALL USERS
       Data asli hasil API.
    ----------------------------------------------------- */

    allUsers: [],


    /* -----------------------------------------------------
       FILTERED USERS
       Data yang ditampilkan setelah search/filter.
    ----------------------------------------------------- */

    filteredUsers: [],


    /* -----------------------------------------------------
       USER YANG SEDANG AKAN DIHAPUS
       Format:
       {
           id,
           email,
           name
       }
    ----------------------------------------------------- */

    userToDelete: null

};
