/* =========================================================
   GEN-Z.AI
   TOP UP APPROVAL MODULE
   ---------------------------------------------------------
   File:
   admin-control/topup/topup-approval.js

   Tanggung jawab:
   - Approve top up melalui Supabase RPC
   - Menambah credit user secara atomic
   - Mencegah double approval
   - Menjaga status topup dan credit tetap sinkron
   - Tidak mengubah profiles secara langsung dari browser
   - Tidak mengurus UI utama/topup table
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     HELPER
     ========================================================= */

  function showToast(ctx, message, type) {
    if (
      ctx &&
      typeof ctx.showToast === "function"
    ) {
      ctx.showToast(message, type);
      return;
    }

    if (type === "error") {
      console.error(
        "GENZ Top Up:",
        message
      );
    } else {
      console.log(
        "GENZ Top Up:",
        message
      );
    }
  }

  async function reloadTopups(ctx) {
    if (
      ctx &&
      typeof ctx.loadTopups === "function"
    ) {
      try {
        await ctx.loadTopups();
      } catch (error) {
        console.error(
          "GENZ Top Up reload error:",
          error
        );
      }
    }
  }

  /* =========================================================
     APPROVE TOP UP
     ========================================================= */

  async function approve(id) {
    const ctx =
      window.GENZ_TOPUP_CONTEXT;

    /* -------------------------------------------------------
       Pastikan context tersedia
       ------------------------------------------------------- */

    if (
      !ctx ||
      typeof ctx.getClient !== "function"
    ) {
      console.error(
        "GENZ_TOPUP_CONTEXT belum tersedia."
      );

      return false;
    }

    /* -------------------------------------------------------
       Ambil Supabase client
       ------------------------------------------------------- */

    const supabaseClient =
      ctx.getClient();

    if (!supabaseClient) {
      showToast(
        ctx,
        "Supabase belum siap. Silakan refresh halaman.",
        "error"
      );

      return false;
    }

    /* =======================================================
       STEP 1
       Cari data topup dari tabel yang sudah dimuat
       ======================================================= */

    const item =
      typeof ctx.findTopup === "function"
        ? ctx.findTopup(id)
        : null;

    if (!item) {
      showToast(
        ctx,
        "Data top up tidak ditemukan.",
        "error"
      );

      return false;
    }

    /* =======================================================
       STEP 2
       Pastikan masih pending
       ======================================================= */

    if (
      typeof ctx.normalizeStatus ===
        "function" &&
      ctx.normalizeStatus(
        item.status
      ) !== "pending"
    ) {
      showToast(
        ctx,
        "Top up ini sudah diproses.",
        "error"
      );

      return false;
    }

    /* =======================================================
       STEP 3
       Data user
       ======================================================= */

    const user =
      typeof ctx.getUserDisplay ===
        "function"
        ? ctx.getUserDisplay(item)
        : {
            name: "User",
            email: "-"
          };

    const formatNumber =
      typeof ctx.formatNumber ===
        "function"
        ? ctx.formatNumber
        : function (value) {
            return Number(
              value || 0
            ).toLocaleString("id-ID");
          };

    const formatCurrency =
      typeof ctx.formatCurrency ===
        "function"
        ? ctx.formatCurrency
        : function (value) {
            return (
              "Rp" +
              Number(
                value || 0
              ).toLocaleString("id-ID")
            );
          };

    /* =======================================================
       STEP 4
       Konfirmasi admin
       ======================================================= */

    const confirmed =
      window.confirm(
        "Approve top up " +
          formatNumber(
            item.credits
          ) +
          " credit untuk " +
          user.email +
          " senilai " +
          formatCurrency(
            item.amount
          ) +
          "?"
      );

    if (!confirmed) {
      return false;
    }

    try {
      /* =====================================================
         STEP 5
         Panggil RPC DATABASE
         -----------------------------------------------------
         Semua proses berikut dilakukan di database:

         - cek admin / owner
         - cek topup
         - lock topup
         - cek pending
         - lock profile
         - tambah credits
         - ubah status approved

         Jadi tidak ada lagi UPDATE profiles dari browser.
         ===================================================== */

      const {
        data,
        error
      } = await supabaseClient.rpc(
        "approve_topup",
        {
          p_topup_id: id
        }
      );

      /* =====================================================
         STEP 6
         Tangani error RPC
         ===================================================== */

      if (error) {
        console.error(
          "GENZ Top Up RPC error:",
          error
        );

        let message =
          error.message ||
          "Gagal approve top up.";

        /* ---------------------------------------------------
           Pesan lebih jelas untuk beberapa kondisi umum
           --------------------------------------------------- */

        if (
          String(message)
            .toLowerCase()
            .includes("unauthorized")
        ) {
          message =
            "Anda tidak memiliki izin untuk approve top up.";
        }

        if (
          String(message)
            .toLowerCase()
            .includes(
              "top up sudah diproses"
            )
        ) {
          message =
            "Top up ini sudah diproses sebelumnya.";
        }

        showToast(
          ctx,
          message,
          "error"
        );

        await reloadTopups(ctx);

        return false;
      }

      /* =====================================================
         STEP 7
         Validasi hasil RPC
         ===================================================== */

      if (
        !data ||
        data.success !== true
      ) {
        console.error(
          "GENZ Top Up RPC invalid response:",
          data
        );

        showToast(
          ctx,
          "Top up gagal diproses. Database tidak memberikan hasil yang valid.",
          "error"
        );

        await reloadTopups(ctx);

        return false;
      }

      /* =====================================================
         STEP 8
         Ambil hasil dari RPC
         ===================================================== */

      const creditsAdded =
        Number(
          data.credits_added
        );

      const newCredits =
        Number(
          data.new_credits
        );

      /* -----------------------------------------------------
         Pastikan hasil credit valid
         ----------------------------------------------------- */

      if (
        !Number.isFinite(
          creditsAdded
        ) ||
        creditsAdded <= 0
      ) {
        console.error(
          "GENZ Top Up invalid credits_added:",
          data
        );

        showToast(
          ctx,
          "Top up diproses tetapi jumlah credit tidak valid.",
          "error"
        );

        await reloadTopups(ctx);

        return false;
      }

      /* =====================================================
         STEP 9
         SUCCESS
         ===================================================== */

      let successMessage =
        "Top up disetujui dan " +
        formatNumber(
          creditsAdded
        ) +
        " credit berhasil ditambahkan ke saldo user.";

      /* -----------------------------------------------------
         Tambahkan saldo baru bila tersedia
         ----------------------------------------------------- */

      if (
        Number.isFinite(
          newCredits
        )
      ) {
        successMessage +=
          " Saldo sekarang " +
          formatNumber(
            newCredits
          ) +
          " credit.";
      }

      showToast(
        ctx,
        successMessage,
        "success"
      );

      /* =====================================================
         STEP 10
         Refresh tabel admin
         ===================================================== */

      await reloadTopups(ctx);

      return true;

    } catch (error) {
      console.error(
        "GENZ Top Up approval exception:",
        error
      );

      showToast(
        ctx,
        error &&
        error.message
          ? error.message
          : "Gagal approve top up.",
        "error"
      );

      await reloadTopups(ctx);

      return false;
    }
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.GENZ_TOPUP_APPROVAL = {
    approve: approve
  };

  /* ---------------------------------------------------------
     Compatibility API lama
     --------------------------------------------------------- */

  window.GENZTopUpApproval = {
    approveTopup: approve
  };

  window.GENZApproveTopup =
    approve;

})();
