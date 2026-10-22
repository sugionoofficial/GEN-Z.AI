/* =========================================================
   GEN-Z.AI
   MODEL QUOTA (SERVER RE-EXPORT)
   ---------------------------------------------------------
   File:
   lib/generate/model-quota.js

   Implementasi aslinya ada di
   admin-control/assets/js/model-quota.js supaya file yang
   sama bisa dipakai browser (halaman Edit/Tambah Model)
   dan server (api/admin-models.js) tanpa duplikasi.

   Folder lib/ tidak ikut di-copy ke dist oleh
   scripts/build-cloudflare-pages.mjs, jadi modul yang
   dibutuhkan browser wajib berada di folder statis.
========================================================= */

"use strict";

export * from "../../admin-control/assets/js/model-quota.js";
