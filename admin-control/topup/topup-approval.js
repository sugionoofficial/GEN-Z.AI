/* =========================================================
   GEN-Z.AI
   TOP UP APPROVAL MODULE
   ---------------------------------------------------------
   File:
   admin-control/topup/topup-approval.js

   Tanggung jawab:
   - Approve top up
   - Memanggil RPC Supabase
   - Menambahkan credit secara atomic
   - Menjaga agar top up tidak diproses dua kali
   - Reload tabel setelah proses

   RPC:
   public.approve_topup_and_add_credits
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     HELPERS
     ======================================================= */

  function getContext() {
    return window.GENZ_TOPUP_CONTEXT || null;
  }

  function showToast(message, type) {
    const ctx = getContext();

    if (ctx && typeof ctx.showToast === "function") {
      ctx.showToast(message, type);
      return;
    }

    console[type === "error" ? "error" : "log"](
      "GENZ Top Up:",
      message
    );
  }

  function formatNumber(value) {
    const ctx = getContext();

    if (ctx && typeof ctx.formatNumber === "function") {
      return ctx.formatNumber(value);
    }

    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatCurrency(value) {
    const ctx = getContext();

    if (ctx && typeof ctx.formatCurrency === "function") {
      return ctx.formatCurrency(value);
    }

    return (
      "Rp" +
      Number(value || 0).toLocaleString("id-ID")
    );
  }

  function getSupabaseClient() {
    const ctx = getContext();

    if (!ctx || typeof ctx.getClient !== "function") {
      return null;
    }

    return ctx.getClient();
  }

  function findTopup(id) {
    const ctx = getContext();

    if (!ctx || typeof ctx.findTopup !== "function") {
      return null;
    }

    return ctx.findTopup(id);
  }

  function getUserDisplay(item) {
    const ctx = getContext();

    if (ctx && typeof ctx.getUserDisplay === "function") {
      return ctx.getUserDisplay(item);
    }

    return {
      name: "User",
      email: "-"
    };
  }

  async function reloadTopups() {
    const ctx = getContext();

    if (ctx && typeof ctx.loadTopups === "function") {
      await ctx.loadTopups();
    }
  }

  /* =======================================================
     APPROVE TOP UP
     ======================================================= */

  async function approve(id) {
    const ctx = getContext();

    if (!ctx) {
      showToast(
        "Modul Top Up belum siap. Silakan refresh halaman.",
        "error"
      );
      return;
    }

    const supabaseClient = getSupabaseClient();

    if (!supabaseClient) {
      showToast(
        "Supabase belum siap. Silakan refresh halaman.",
        "error"
      );
      return;
    }

    /* -----------------------------------------------------
       Cari data dari tabel yang sedang tampil
       ----------------------------------------------------- */

    const item = findTopup(id);

    if (!item) {
      showToast(
        "Data top up tidak ditemukan.",
        "error"
      );
      return;
    }

    /* -----------------------------------------------------
       Pastikan status masih pending
       ----------------------------------------------------- */

    const status = String(
      item.status || ""
    ).trim().toLowerCase();

    if (status !== "pending") {
      showToast(
        "Top up ini sudah diproses.",
        "error"
      );

      await reloadTopups();

      return;
    }

    /* -----------------------------------------------------
       Data user
       ----------------------------------------------------- */

    const user = getUserDisplay(item);

    const creditAmount = Number(item.credits);

    const amount = Number(item.amount);

    /* -----------------------------------------------------
       Validasi credit
       ----------------------------------------------------- */

    if (
      !Number.isInteger(creditAmount) ||
      creditAmount <= 0
    ) {
      showToast(
        "Jumlah credit top up tidak valid.",
        "error"
      );
      return;
    }

    /* -----------------------------------------------------
       Konfirmasi admin
       ----------------------------------------------------- */

    const confirmed = window.confirm(
      "Approve top up " +
        formatNumber(creditAmount) +
        " credit untuk " +
        (user.email || user.name || "user") +
        " senilai " +
        formatCurrency(amount) +
        "?"
    );

    if (!confirmed) {
      return;
    }

    /* -----------------------------------------------------
       Tandai proses
       ----------------------------------------------------- */

    showToast(
      "Memproses approval top up...",
      "info"
    );

    try {
      /* ===================================================
         PANGGIL RPC ATOMIC
         =================================================== */

      const { data, error } =
        await supabaseClient.rpc(
          "approve_topup_and_add_credits",
          {
            p_topup_id: id
          }
        );

      if (error) {
        console.error(
          "GENZ Top Up RPC error:",
          error
        );

        throw error;
      }

      /* ---------------------------------------------------
         Validasi hasil RPC
         --------------------------------------------------- */

      if (!data || data.success !== true) {
        throw new Error(
          "Approval top up gagal diproses."
        );
      }

      /* ---------------------------------------------------
         Ambil hasil transaksi
         --------------------------------------------------- */

      const addedCredits = Number(
        data.added_credits || creditAmount
      );

      const newCredits = Number(
        data.new_credits || 0
      );

      /* ---------------------------------------------------
         Toast sukses
         --------------------------------------------------- */

      showToast(
        "Top up berhasil disetujui. " +
          formatNumber(addedCredits) +
          " credit telah ditambahkan. " +
          "Saldo sekarang " +
          formatNumber(newCredits) +
          " credit.",
        "success"
      );

      /* ---------------------------------------------------
         Refresh tabel
         --------------------------------------------------- */

      await reloadTopups();

    } catch (error) {
      console.error(
        "GENZ Top Up approval error:",
        error
      );

      let message =
        error &&
        error.message
          ? error.message
          : "Gagal approve top up.";

      /* ---------------------------------------------------
         Normalisasi pesan error PostgreSQL
         --------------------------------------------------- */

      if (
        message
          .toLowerCase()
          .includes("top up sudah diproses")
      ) {
        message =
          "Top up ini sudah diproses oleh proses lain.";
      }

      if (
        message
          .toLowerCase()
          .includes("top up tidak ditemukan")
      ) {
        message =
          "Data top up tidak ditemukan.";
      }

      if (
        message
          .toLowerCase()
          .includes("profil user tidak ditemukan")
      ) {
        message =
          "Profil user tidak ditemukan. Credit tidak ditambahkan.";
      }

      showToast(
        message,
        "error"
      );

      /* ---------------------------------------------------
         Tetap reload agar status UI sinkron
         --------------------------------------------------- */

      try {
        await reloadTopups();
      } catch (reloadError) {
        console.error(
          "GENZ Top Up reload error:",
          reloadError
        );
      }
    }
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.GENZ_TOPUP_APPROVAL = {
    approve: approve
  };

})();
