/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - AUTHENTICATION
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-auth.js

   Fungsi:
   - Memeriksa Supabase client
   - Memeriksa session
   - Mengambil profile pengguna
   - Memvalidasi ADMIN / OWNER
   - Memvalidasi status active
   - Mengisi user info
   - Menyembunyikan opsi ADMIN untuk ADMIN

   Tidak menangani:
   - User API
   - Load users
   - Render table
   - Modal
   - Create / delete user
========================================================= */

import {
    currentUser,
    currentProfile
} from "./user-state.js";
