/* =========================================================
   GEN-Z.AI
   TOP UP APPROVAL MODULE
   ---------------------------------------------------------
   File:
   admin-control/topup/topup-approval.js

   Tanggung jawab:
   - Approve top up
   - Menambah credit user
   - Memastikan credit benar-benar tersimpan
   - Mencegah double approval
   - Rollback status jika penambahan credit gagal
   - Tidak mengurus UI utama/topup table
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     HELPER
     ========================================================= */

  function showToast(ctx, message, type) {
    if (ctx && typeof ctx.showToast === "function") {
      ctx.showToast(message, type);
    } else {
      console[type === "error" ? "error" : "log"](
        "GENZ Top Up:",
        message
      );
    }
  }

  async function reloadTopups(ctx) {
    if (ctx && typeof ctx.loadTopups === "function") {
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
     ROLLBACK APPROVAL
     ---------------------------------------------------------
     Mengembalikan status approved -> pending.
     Hasil rollback juga diverifikasi.
     ========================================================= */

  async function rollbackApproval(
    supabaseClient,
    topupId
  ) {
    const rollbackTime =
      new Date().toISOString();

    const {
      data: rollbackRows,
      error: rollbackError
    } = await supabaseClient
      .from("topup_requests")
      .update({
        status: "pending",
        processed_at: null,
        updated_at: rollbackTime
      })
      .eq("id", topupId)
      .eq("status", "approved")
      .select("id,status")
      .maybeSingle();

    if (rollbackError) {
      console.error(
        "GENZ Top Up rollback error:",
        rollbackError
      );

      return {
        success: false,
        error: rollbackError
      };
    }

    if (
      !rollbackRows ||
      String(rollbackRows.status || "").toLowerCase() !==
        "pending"
    ) {
      console.error(
        "GENZ Top Up rollback tidak berhasil:",
        rollbackRows
      );

      return {
        success: false,
        error: new Error(
          "Status top up gagal dikembalikan ke pending."
        )
      };
    }

    return {
      success: true
    };
  }

  /* =========================================================
     APPROVE
     ========================================================= */

  async function approve(id) {
    const ctx = window.GENZ_TOPUP_CONTEXT;

    /* -------------------------------------------------------
       Context
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

    /* -------------------------------------------------------
       Cari data top up dari data yang sudah dimuat
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       Pastikan status masih pending
       ------------------------------------------------------- */

    if (
      typeof ctx.normalizeStatus ===
        "function" &&
      ctx.normalizeStatus(item.status) !==
        "pending"
    ) {
      showToast(
        ctx,
        "Top up ini sudah diproses.",
        "error"
      );

      return false;
    }

    /* -------------------------------------------------------
       Data user
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       Konfirmasi
       ------------------------------------------------------- */

    const confirmed =
      window.confirm(
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
         Ambil data top up terbaru
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
        showToast(
          ctx,
          "Data top up tidak ditemukan.",
          "error"
        );

        return false;
      }

      /* -----------------------------------------------------
         Jangan proses ulang
         ----------------------------------------------------- */

      if (
        String(
          fresh.status || ""
        ).toLowerCase() !== "pending"
      ) {
        showToast(
          ctx,
          "Top up ini sudah diproses.",
          "error"
        );

        await reloadTopups(ctx);

        return false;
      }

      /* =====================================================
         STEP 2
         Validasi user ID
         ===================================================== */

      if (!fresh.user_id) {
        throw new Error(
          "User ID pada top up tidak ditemukan."
        );
      }

      /* =====================================================
         STEP 3
         Validasi credit
         ===================================================== */

      const creditAmount =
        Number(fresh.credits);

      if (
        !Number.isInteger(
          creditAmount
        ) ||
        creditAmount <= 0
      ) {
        throw new Error(
          "Jumlah credit top up tidak valid."
        );
      }

      /* =====================================================
         STEP 4
         Lock sederhana:
         pending -> approved
         ===================================================== */

      const now =
        new Date().toISOString();

      const {
        data: approvedRow,
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
        .select(
          "id,user_id,credits,status"
        )
        .maybeSingle();

      if (approveError) {
        throw approveError;
      }

      /* -----------------------------------------------------
         Update tidak mengenai row
         ----------------------------------------------------- */

      if (
        !approvedRow ||
        String(
          approvedRow.status || ""
        ).toLowerCase() !== "approved"
      ) {
        showToast(
          ctx,
          "Top up tidak dapat diproses. Status mungkin sudah berubah.",
          "error"
        );

        await reloadTopups(ctx);

        return false;
      }

      /* =====================================================
         STEP 5
         Ambil saldo user terbaru
         ===================================================== */

      const {
        data: profile,
        error: profileError
      } = await supabaseClient
        .from("profiles")
        .select(
          "id,credits"
        )
        .eq(
          "id",
          fresh.user_id
        )
        .maybeSingle();

      if (profileError) {
        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Profil user gagal dibaca dan status top up juga gagal dikembalikan. Periksa database secara manual."
          );
        }

        throw profileError;
      }

      /* -----------------------------------------------------
         Profil tidak ditemukan
         ----------------------------------------------------- */

      if (!profile) {
        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Profil user tidak ditemukan dan status top up gagal dikembalikan. Periksa database secara manual."
          );
        }

        throw new Error(
          "Profil user tidak ditemukan."
        );
      }

      /* =====================================================
         STEP 6
         Hitung saldo baru
         ===================================================== */

      const currentCredits =
        Number(profile.credits);

      if (
        !Number.isFinite(
          currentCredits
        ) ||
        currentCredits < 0
      ) {
        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Saldo user tidak valid dan status top up gagal dikembalikan."
          );
        }

        throw new Error(
          "Saldo credit user tidak valid."
        );
      }

      const newCredits =
        currentCredits +
        creditAmount;

      /* =====================================================
         STEP 7
         Update credit user
         -----------------------------------------------------
         PENTING:
         Gunakan SELECT setelah UPDATE agar kita tahu
         apakah row benar-benar berubah.
         ===================================================== */

      const {
        data: updatedProfile,
        error: creditError
      } = await supabaseClient
        .from("profiles")
        .update({
          credits: newCredits
        })
        .eq(
          "id",
          fresh.user_id
        )
        .select(
          "id,credits"
        )
        .maybeSingle();

      /* -----------------------------------------------------
         Error database / RLS / permission
         ----------------------------------------------------- */

      if (creditError) {
        console.error(
          "GENZ Top Up credit update error:",
          creditError
        );

        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Credit user gagal ditambahkan dan status top up juga gagal dikembalikan. Periksa RLS/permission Supabase dan data secara manual."
          );
        }

        throw new Error(
          "Credit user gagal ditambahkan: " +
            (
              creditError.message ||
              "database menolak perubahan."
            )
        );
      }

      /* =====================================================
         STEP 8
         VERIFIKASI HASIL UPDATE
         ===================================================== */

      if (!updatedProfile) {
        console.error(
          "GENZ Top Up: profiles tidak mengembalikan row setelah update."
        );

        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Saldo user tidak terverifikasi dan status top up gagal dikembalikan. Periksa database secara manual."
          );
        }

        throw new Error(
          "Credit user tidak berhasil disimpan ke database."
        );
      }

      const savedCredits =
        Number(
          updatedProfile.credits
        );

      /* -----------------------------------------------------
         Pastikan nilai benar-benar sesuai
         ----------------------------------------------------- */

      if (
        !Number.isFinite(
          savedCredits
        ) ||
        savedCredits !==
          newCredits
      ) {
        console.error(
          "GENZ Top Up: saldo setelah update tidak sesuai.",
          {
            currentCredits:
              currentCredits,
            creditAmount:
              creditAmount,
            expectedCredits:
              newCredits,
            savedCredits:
              savedCredits
          }
        );

        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Saldo user tidak sesuai dan status top up gagal dikembalikan. Periksa database secara manual."
          );
        }

        throw new Error(
          "Credit user tidak berhasil diperbarui dengan benar."
        );
      }

      /* =====================================================
         STEP 9
         VERIFIKASI ULANG DARI DATABASE
         -----------------------------------------------------
         Ini memastikan nilai yang tersimpan memang benar,
         bukan hanya nilai response dari UPDATE.
         ===================================================== */

      const {
        data: verifyProfile,
        error: verifyError
      } = await supabaseClient
        .from("profiles")
        .select(
          "id,credits"
        )
        .eq(
          "id",
          fresh.user_id
        )
        .maybeSingle();

      if (verifyError) {
        console.error(
          "GENZ Top Up verification error:",
          verifyError
        );

        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Credit telah diperbarui tetapi gagal diverifikasi dan status top up gagal dikembalikan. Periksa database secara manual."
          );
        }

        throw new Error(
          "Credit user gagal diverifikasi setelah update."
        );
      }

      const verifiedCredits =
        verifyProfile
          ? Number(
              verifyProfile.credits
            )
          : NaN;

      if (
        !verifyProfile ||
        !Number.isFinite(
          verifiedCredits
        ) ||
        verifiedCredits !==
          newCredits
      ) {
        console.error(
          "GENZ Top Up: verifikasi saldo gagal.",
          {
            expected:
              newCredits,
            actual:
              verifiedCredits
          }
        );

        const rollback =
          await rollbackApproval(
            supabaseClient,
            fresh.id
          );

        if (!rollback.success) {
          throw new Error(
            "Saldo user gagal diverifikasi dan status top up gagal dikembalikan. Periksa database secara manual."
          );
        }

        throw new Error(
          "Saldo user tidak bertambah sesuai jumlah top up."
        );
      }

      /* =====================================================
         STEP 10
         SEMUA BERHASIL
         ===================================================== */

      showToast(
        ctx,
        "Top up disetujui dan " +
          formatNumber(
            creditAmount
          ) +
          " credit berhasil ditambahkan ke saldo user.",
        "success"
      );

      /* -----------------------------------------------------
         Refresh tabel admin
         ----------------------------------------------------- */

      await reloadTopups(ctx);

      return true;

    } catch (error) {
      console.error(
        "GENZ Top Up approval error:",
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
     Compatibility dengan API lama
     --------------------------------------------------------- */

  window.GENZTopUpApproval = {
    approveTopup: approve
  };

  window.GENZApproveTopup = approve;

})();
