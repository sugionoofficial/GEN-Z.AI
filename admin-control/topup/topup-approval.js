/* =========================================================
   GEN-Z.AI
   TOP UP APPROVAL MODULE
   ---------------------------------------------------------
   File:
   admin-control/topup/topup-approval.js

   Tanggung jawab:
   - Approve top up
   - Tambah credit user
   - Update status top up
   - Menjaga proses approval tetap terpisah
   - Tidak menangani UI/package/topup request lainnya
   ========================================================= */

(function () {
    "use strict";

    const MODULE_NAME = "GENZTopUpApproval";

    function getSupabase() {
        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        if (window.GENZ_SUPABASE) {
            return window.GENZ_SUPABASE;
        }

        return null;
    }

    function normalizeNumber(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return number;
    }

    function normalizeStatus(value) {
        return String(value || "")
            .trim()
            .toLowerCase();
    }

    function getFormatNumber(value) {
        if (typeof window.formatNumber === "function") {
            return window.formatNumber(value);
        }

        return normalizeNumber(value).toLocaleString("id-ID");
    }

    function getFormatCurrency(value) {
        if (typeof window.formatCurrency === "function") {
            return window.formatCurrency(value);
        }

        return "Rp " + normalizeNumber(value).toLocaleString("id-ID");
    }

    function showToast(message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
            return;
        }

        if (type === "error") {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    function getUserDisplay(item) {
        if (typeof window.getUserDisplay === "function") {
            return window.getUserDisplay(item);
        }

        return {
            email:
                item?.profiles?.email ||
                item?.email ||
                "user"
        };
    }

    function findTopup(id) {
        if (typeof window.findTopup === "function") {
            return window.findTopup(id);
        }

        const list =
            Array.isArray(window.GENZ_TOPUPS)
                ? window.GENZ_TOPUPS
                : Array.isArray(window.topups)
                    ? window.topups
                    : [];

        return list.find(function (item) {
            return String(item?.id) === String(id);
        }) || null;
    }

    async function approveTopup(id) {
        const supabase = getSupabase();

        if (!supabase) {
            showToast(
                "Supabase belum siap. Tidak dapat approve top up.",
                "error"
            );
            return false;
        }

        const localItem = findTopup(id);

        if (
            localItem &&
            normalizeStatus(localItem.status) !== "pending"
        ) {
            showToast(
                "Top up ini sudah diproses.",
                "error"
            );
            return false;
        }

        try {
            /*
             * Ambil data terbaru langsung dari database.
             * Jangan hanya mengandalkan data yang sedang tampil
             * di tabel admin.
             */
            const {
                data: topup,
                error: topupError
            } = await supabase
                .from("topup_requests")
                .select(`
                    id,
                    user_id,
                    package_name,
                    credits,
                    amount,
                    status,
                    processed_at,
                    created_at,
                    updated_at
                `)
                .eq("id", id)
                .maybeSingle();

            if (topupError) {
                throw topupError;
            }

            if (!topup) {
                throw new Error(
                    "Data top up tidak ditemukan."
                );
            }

            /*
             * Pastikan request masih pending.
             */
            if (
                normalizeStatus(topup.status) !== "pending"
            ) {
                showToast(
                    "Top up ini sudah diproses sebelumnya.",
                    "error"
                );

                if (typeof window.loadTopups === "function") {
                    await window.loadTopups();
                }

                return false;
            }

            const creditsToAdd =
                normalizeNumber(topup.credits);

            if (creditsToAdd <= 0) {
                throw new Error(
                    "Jumlah credit top up tidak valid."
                );
            }

            if (!topup.user_id) {
                throw new Error(
                    "User ID pada top up tidak ditemukan."
                );
            }

            const user = getUserDisplay(topup);

            const confirmed = window.confirm(
                "Approve top up " +
                getFormatNumber(creditsToAdd) +
                " credit untuk " +
                (user.email || "user") +
                " senilai " +
                getFormatCurrency(topup.amount) +
                "?"
            );

            if (!confirmed) {
                return false;
            }

            /*
             * Ambil saldo user terbaru.
             */
            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .select("id, credits")
                .eq("id", topup.user_id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            if (!profile) {
                throw new Error(
                    "Profile user tidak ditemukan."
                );
            }

            const currentCredits =
                normalizeNumber(profile.credits);

            const newCredits =
                currentCredits + creditsToAdd;

            /*
             * Tambahkan credit user.
             */
            const {
                error: creditError
            } = await supabase
                .from("profiles")
                .update({
                    credits: newCredits
                })
                .eq("id", topup.user_id);

            if (creditError) {
                throw creditError;
            }

            /*
             * Setelah credit berhasil ditambahkan,
             * ubah status request menjadi approved.
             *
             * Tetap menggunakan kondisi status = pending
             * agar request yang sudah diproses tidak diproses ulang.
             */
            const processedAt =
                new Date().toISOString();

            const {
                data: approvedRows,
                error: approveError
            } = await supabase
                .from("topup_requests")
                .update({
                    status: "approved",
                    processed_at: processedAt,
                    updated_at: processedAt
                })
                .eq("id", id)
                .eq("status", "pending")
                .select("id");

            if (approveError) {
                /*
                 * Jika update status gagal, coba kembalikan
                 * saldo ke nilai sebelum approval.
                 *
                 * Ini fallback agar kegagalan proses tidak
                 * meninggalkan saldo bertambah sementara
                 * status masih pending.
                 */
                try {
                    await supabase
                        .from("profiles")
                        .update({
                            credits: currentCredits
                        })
                        .eq("id", topup.user_id);
                } catch (rollbackError) {
                    console.error(
                        "GENZ Top Up rollback error:",
                        rollbackError
                    );
                }

                throw approveError;
            }

            /*
             * Jika tidak ada row yang di-update, kemungkinan
             * request sudah diproses oleh proses lain.
             */
            if (
                !Array.isArray(approvedRows) ||
                approvedRows.length === 0
            ) {
                try {
                    await supabase
                        .from("profiles")
                        .update({
                            credits: currentCredits
                        })
                        .eq("id", topup.user_id);
                } catch (rollbackError) {
                    console.error(
                        "GENZ Top Up rollback error:",
                        rollbackError
                    );
                }

                showToast(
                    "Top up sudah diproses oleh proses lain.",
                    "error"
                );

                if (typeof window.loadTopups === "function") {
                    await window.loadTopups();
                }

                return false;
            }

            showToast(
                "Top up berhasil. " +
                getFormatNumber(creditsToAdd) +
                " credit telah ditambahkan ke saldo user.",
                "success"
            );

            /*
             * Refresh tabel admin.
             */
            if (typeof window.loadTopups === "function") {
                await window.loadTopups();
            }

            /*
             * Refresh statistik apabila tersedia.
             */
            if (typeof window.loadStats === "function") {
                try {
                    await window.loadStats();
                } catch (statsError) {
                    console.warn(
                        "GENZ Top Up stats refresh warning:",
                        statsError
                    );
                }
            }

            return true;

        } catch (error) {
            console.error(
                "GENZ Top Up approval error:",
                error
            );

            showToast(
                error?.message ||
                "Gagal approve top up.",
                "error"
            );

            return false;
        }
    }

    /*
     * Public API
     */
    window.GENZTopUpApproval = {
        approveTopup: approveTopup
    };

    /*
     * Kompatibilitas dengan tombol/event lama.
     * index.html cukup memanggil approveTopup(id)
     * seperti sebelumnya.
     */
    window.GENZApproveTopup = approveTopup;

    console.log(
        MODULE_NAME +
        ": approval module loaded."
    );
})();
