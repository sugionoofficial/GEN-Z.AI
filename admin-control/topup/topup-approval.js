/* =========================================================
   GEN-Z.AI
   TOP UP APPROVAL MODULE
   ---------------------------------------------------------
   File:
   admin-control/topup/topup-approval.js

   Tanggung jawab:
   - Approve top up
   - Menambah credit user
   - Mencegah double approval
   - Rollback status jika penambahan credit gagal
   - Tidak mengurus UI utama/topup table
   ========================================================= */

(function () {
  "use strict";

  async function approve(id) {
    const ctx = window.GENZ_TOPUP_CONTEXT;

    if (!ctx || typeof ctx.getClient !== "function") {
      console.error("GENZ_TOPUP_CONTEXT belum tersedia.");
      return false;
    }

    const supabaseClient = ctx.getClient();

    if (!supabaseClient) {
      if (typeof ctx.showToast === "function") {
        ctx.showToast(
          "Supabase belum siap. Silakan refresh halaman.",
          "error"
        );
      }

      return false;
    }

    /* -------------------------------------------------------
       Cari data top up dari data yang sudah dimuat
       ------------------------------------------------------- */

    const item =
      typeof ctx.findTopup === "function"
        ? ctx.findTopup(id)
        : null;

    if (!item) {
      ctx.showToast(
        "Data top up tidak ditemukan.",
        "error"
      );

      return false;
    }

    /* -------------------------------------------------------
       Pastikan status masih pending
       ------------------------------------------------------- */

    if (
      typeof ctx.normalizeStatus === "function" &&
      ctx.normalizeStatus(item.status) !== "pending"
    ) {
      ctx.showToast(
        "Top up ini sudah diproses.",
        "error"
      );

      return false;
    }

    /* -------------------------------------------------------
       Data user
       ------------------------------------------------------- */

    const user =
      typeof ctx.getUserDisplay === "function"
        ? ctx.getUserDisplay(item)
        : {
            name: "User",
            email: "-"
          };

    const formatNumber =
      typeof ctx.formatNumber === "function"
        ? ctx.formatNumber
        : function (value) {
            return Number(value || 0).toLocaleString("id-ID");
          };

    const formatCurrency =
      typeof ctx.formatCurrency === "function"
        ? ctx.formatCurrency
        : function (value) {
            return (
              "Rp" +
              Number(value || 0).toLocaleString("id-ID")
            );
          };

    /* -------------------------------------------------------
       Konfirmasi
       ------------------------------------------------------- */

    const confirmed = window.confirm(
      "Approve top up " +
        formatNumber(item.credits) +
        " credit untuk " +
        user.email +
        " senilai " +
        formatCurrency(item.amount) +
        "?"
    );

    if (!confirmed) {
      return false;
    }

    try {
      /* =====================================================
         STEP 1
         Ambil data terbaru dari database
         ===================================================== */

      const {
        data: fresh,
        error: freshError
      } = await supabaseClient
        .from("topup_requests")
        .select(
          "id,user_id,credits,amount,status"
        )
        .eq("id", id)
        .maybeSingle();

      if (freshError) {
        throw freshError;
      }

      if (!fresh) {
        ctx.showToast(
          "Data top up tidak ditemukan.",
          "error"
        );

        return false;
      }

      /* -----------------------------------------------------
         Jangan proses ulang jika sudah bukan pending
         ----------------------------------------------------- */

      if (
        String(fresh.status || "").toLowerCase() !==
        "pending"
      ) {
        ctx.showToast(
          "Top up ini sudah diproses.",
          "error"
        );

        if (typeof ctx.loadTopups === "function") {
          await ctx.loadTopups();
        }

        return false;
      }

      /* =====================================================
         STEP 2
         Validasi credit
         ===================================================== */

      const creditAmount = Number(fresh.credits);

      if (
        !Number.isInteger(creditAmount) ||
        creditAmount <= 0
      ) {
        throw new Error(
          "Jumlah credit top up tidak valid."
        );
      }

      /* =====================================================
         STEP 3
         Ubah status pending -> approved
         dengan conditional update
         ===================================================== */

      const now = new Date().toISOString();

      const {
        data: approvedRows,
        error: approveError
      } = await supabaseClient
        .from("topup_requests")
        .update({
          status: "approved",
          processed_at: now,
          updated_at: now
        })
        .eq("id", fresh.id)
        .eq("status", "pending")
        .select("id");

      if (approveError) {
        throw approveError;
      }

      /* -----------------------------------------------------
         Jika 0 row berarti kemungkinan diproses proses lain
         ----------------------------------------------------- */

      if (
        !approvedRows ||
        approvedRows.length === 0
      ) {
        ctx.showToast(
          "Top up sudah diproses oleh proses lain atau statusnya berubah.",
          "error"
        );

        if (typeof ctx.loadTopups === "function") {
          await ctx.loadTopups();
        }

        return false;
      }

      /* =====================================================
         STEP 4
         Ambil saldo user terbaru
         ===================================================== */

      const {
        data: profile,
        error: profileError
      } = await supabaseClient
        .from("profiles")
        .select("id,credits")
        .eq("id", fresh.user_id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      /* -----------------------------------------------------
         User tidak ditemukan
         Rollback approval
         ----------------------------------------------------- */

      if (!profile) {
        const rollback =
          await supabaseClient
            .from("topup_requests")
            .update({
              status: "pending",
              processed_at: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", fresh.id)
            .eq("status", "approved");

        if (rollback.error) {
          console.error(
            "GENZ Top Up rollback error:",
            rollback.error
          );

          throw new Error(
            "Profil user tidak ditemukan dan status top up gagal dikembalikan. Periksa data secara manual."
          );
        }

        throw new Error(
          "Profil user tidak ditemukan."
        );
      }

      /* =====================================================
         STEP 5
         Hitung saldo baru
         ===================================================== */

      const currentCredits =
        Number(profile.credits) || 0;

      const newCredits =
        currentCredits + creditAmount;

      /* =====================================================
         STEP 6
         Tambahkan credit ke profiles
         ===================================================== */

      const {
        error: creditError
      } = await supabaseClient
        .from("profiles")
        .update({
          credits: newCredits
        })
        .eq("id", fresh.user_id);

      if (creditError) {
        /* ---------------------------------------------------
           Credit gagal.
           Kembalikan status top up ke pending.
           --------------------------------------------------- */

        const rollback =
          await supabaseClient
            .from("topup_requests")
            .update({
              status: "pending",
              processed_at: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", fresh.id)
            .eq("status", "approved");

        if (rollback.error) {
          console.error(
            "GENZ Top Up rollback after credit error:",
            rollback.error
          );

          throw new Error(
            "Credit user gagal ditambahkan dan status top up juga gagal dikembalikan. Periksa data secara manual."
          );
        }

        throw creditError;
      }

      /* =====================================================
         STEP 7
         Berhasil
         ===================================================== */

      ctx.showToast(
        "Top up disetujui dan " +
          formatNumber(creditAmount) +
          " credit berhasil ditambahkan ke saldo user.",
        "success"
      );

      /* -----------------------------------------------------
         Refresh tabel admin
         ----------------------------------------------------- */

      if (typeof ctx.loadTopups === "function") {
        await ctx.loadTopups();
      }

      return true;

    } catch (error) {
      console.error(
        "GENZ Top Up approval error:",
        error
      );

      ctx.showToast(
        error.message ||
          "Gagal approve top up.",
        "error"
      );

      return false;
    }
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.GENZ_TOPUP_APPROVAL = {
    approve: approve
  };

})();
