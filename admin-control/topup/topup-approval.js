/* =========================================================
   GEN-Z.AI
   TOP UP APPROVAL MODULE
   ---------------------------------------------------------
   File:
   admin-control/topup/topup-approval.js
   ========================================================= */

(function () {
  "use strict";

  console.log(
    "[GEN-Z.AI] topup-approval.js loaded"
  );

  async function approve(id) {

    console.log(
      "[GEN-Z.AI] approveTopup module called:",
      id
    );

    const ctx = window.GENZ_TOPUP_CONTEXT;

    if (!ctx) {
      console.error(
        "[GEN-Z.AI] GENZ_TOPUP_CONTEXT belum tersedia."
      );

      return;
    }

    if (typeof ctx.getClient !== "function") {
      console.error(
        "[GEN-Z.AI] getClient() tidak tersedia."
      );

      if (typeof ctx.showToast === "function") {
        ctx.showToast(
          "Supabase client belum tersedia.",
          "error"
        );
      }

      return;
    }

    const supabaseClient = ctx.getClient();

    if (!supabaseClient) {
      if (typeof ctx.showToast === "function") {
        ctx.showToast(
          "Supabase belum siap. Silakan refresh halaman.",
          "error"
        );
      }

      return;
    }

    /* =====================================================
       AMBIL DATA TOPUP DARI UI
       ===================================================== */

    const item =
      typeof ctx.findTopup === "function"
        ? ctx.findTopup(id)
        : null;

    if (!item) {

      if (typeof ctx.showToast === "function") {
        ctx.showToast(
          "Data top up tidak ditemukan.",
          "error"
        );
      }

      return;
    }

    /* =====================================================
       CEK STATUS
       ===================================================== */

    const status = String(
      item.status || ""
    )
      .trim()
      .toLowerCase();

    if (status !== "pending") {

      if (typeof ctx.showToast === "function") {
        ctx.showToast(
          "Top up ini sudah diproses.",
          "error"
        );
      }

      return;
    }

    /* =====================================================
       DATA USER
       ===================================================== */

    const user =
      typeof ctx.getUserDisplay === "function"
        ? ctx.getUserDisplay(item)
        : {
            name: "User",
            email: "-"
          };

    const credits = Number(
      item.credits || 0
    );

    const amount = Number(
      item.amount || 0
    );

    const formatNumber =
      typeof ctx.formatNumber === "function"
        ? ctx.formatNumber
        : function (value) {
            return Number(
              value || 0
            ).toLocaleString("id-ID");
          };

    const formatCurrency =
      typeof ctx.formatCurrency === "function"
        ? ctx.formatCurrency
        : function (value) {
            return (
              "Rp" +
              Number(
                value || 0
              ).toLocaleString("id-ID")
            );
          };

    /* =====================================================
       KONFIRMASI
       ===================================================== */

    const confirmed = window.confirm(
      "Approve top up " +
        formatNumber(credits) +
        " credit untuk " +
        (user.email || user.name || "user") +
        " senilai " +
        formatCurrency(amount) +
        "?"
    );

    if (!confirmed) {
      return;
    }

    /* =====================================================
       RPC
       ===================================================== */

    try {

      if (typeof ctx.showToast === "function") {
        ctx.showToast(
          "Memproses approval top up...",
          "info"
        );
      }

      console.log(
        "[GEN-Z.AI] Calling RPC approve_topup_and_add_credits:",
        id
      );

      const {
        data,
        error
      } = await supabaseClient.rpc(
        "approve_topup_and_add_credits",
        {
          p_topup_id: id
        }
      );

      if (error) {

        console.error(
          "[GEN-Z.AI] RPC error:",
          error
        );

        throw error;
      }

      console.log(
        "[GEN-Z.AI] RPC result:",
        data
      );

      if (
        !data ||
        data.success !== true
      ) {
        throw new Error(
          "Approval top up gagal diproses."
        );
      }

      /* ===================================================
         SUKSES
         =================================================== */

      const addedCredits = Number(
        data.added_credits || credits
      );

      const newCredits = Number(
        data.new_credits || 0
      );

      if (typeof ctx.showToast === "function") {
        ctx.showToast(
          "Top up berhasil disetujui. " +
            formatNumber(addedCredits) +
            " credit berhasil ditambahkan. " +
            "Saldo sekarang " +
            formatNumber(newCredits) +
            " credit.",
          "success"
        );
      }

      /* ===================================================
         RELOAD
         =================================================== */

      if (
        typeof ctx.loadTopups === "function"
      ) {
        await ctx.loadTopups();
      }

    } catch (error) {

      console.error(
        "[GEN-Z.AI] Approval error:",
        error
      );

      let message =
        error &&
        error.message
          ? error.message
          : "Gagal approve top up.";

      if (
        message
          .toLowerCase()
          .includes("sudah diproses")
      ) {
        message =
          "Top up ini sudah diproses.";
      }

      if (
        typeof ctx.showToast === "function"
      ) {
        ctx.showToast(
          message,
          "error"
        );
      }

    }
  }

  /* =======================================================
     PUBLIC MODULE
     ======================================================= */

  window.GENZ_TOPUP_APPROVAL = {
    approve: approve
  };

  console.log(
    "[GEN-Z.AI] GENZ_TOPUP_APPROVAL registered:",
    typeof window.GENZ_TOPUP_APPROVAL.approve
  );

})();
