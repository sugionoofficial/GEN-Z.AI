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
   - Mencegah approval ganda
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

        return (
            "Rp " +
            normalizeNumber(value).toLocaleString("id-ID")
        );
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

        return (
            list.find(function (item) {
                return String(item?.id) === String(id);
            }) || null
        );
    }

    async function refreshTopups() {
        if (typeof window.loadTopups === "function") {
            try {
                await window.loadTopups();
            } catch (error) {
                console.warn(
                    "GENZ Top Up refresh warning:",
                    error
                );
            }
        }
    }

    async function refreshStats() {
        if (typeof window.loadStats === "function") {
            try {
                await window.loadStats();
            } catch (error) {
                console.warn(
                    "GENZ Top Up stats refresh warning:",
                    error
                );
            }
        }
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

        if (!id) {
            showToast(
                "ID top up tidak valid.",
                "error"
            );

            return false;
        }

        /*
         * =====================================================
         * CEK DATA LOKAL
         * =====================================================
         */

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
             * =================================================
             * 1. AMBIL DATA TERBARU
             * =================================================
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
             * =================================================
             * 2. PASTIKAN MASIH PENDING
             * =================================================
             */

            if (
                normalizeStatus(topup.status) !== "pending"
            ) {
                showToast(
                    "Top up ini sudah diproses sebelumnya.",
                    "error"
                );

                await refreshTopups();

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

            /*
             * =================================================
             * 3. KONFIRMASI ADMIN
             * =================================================
             */

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
             * =================================================
             * 4. CLAIM TOP UP
             * =================================================
             *
             * Penting:
             *
             * Pending -> Approved dilakukan TERLEBIH DAHULU.
             *
             * Kondisi .eq("status", "pending") memastikan hanya
             * satu proses yang dapat mengambil request tersebut.
             *
             * Ini lebih aman daripada menambahkan credit terlebih
             * dahulu lalu baru mengubah status.
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
                throw approveError;
            }

            /*
             * Tidak ada row berarti request sudah diambil /
             * diproses oleh proses lain.
             */
            if (
                !Array.isArray(approvedRows) ||
                approvedRows.length === 0
            ) {
                showToast(
                    "Top up sudah diproses oleh proses lain.",
                    "error"
                );

                await refreshTopups();

                return false;
            }

            /*
             * =================================================
             * 5. AMBIL PROFILE TERBARU
             * =================================================
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
                /*
                 * Credit belum berubah, jadi aman mengembalikan
                 * status request ke pending.
                 */
                await rollbackApproval(
                    supabase,
                    id
                );

                throw profileError;
            }

            if (!profile) {
                await rollbackApproval(
                    supabase,
                    id
                );

                throw new Error(
                    "Profile user tidak ditemukan."
                );
            }

            /*
             * =================================================
             * 6. HITUNG SALDO BARU
             * =================================================
             */

            const currentCredits =
                normalizeNumber(profile.credits);

            const newCredits =
                currentCredits + creditsToAdd;

            /*
             * =================================================
             * 7. TAMBAHKAN CREDIT
             * =================================================
             */

            const {
                data: updatedProfile,
                error: creditError
            } = await supabase
                .from("profiles")
                .update({
                    credits: newCredits
                })
                .eq("id", topup.user_id)
                .select("id, credits");

            if (creditError) {
                await rollbackApproval(
                    supabase,
                    id
                );

                throw creditError;
            }

            if (
                !Array.isArray(updatedProfile) ||
                updatedProfile.length === 0
            ) {
                await rollbackApproval(
                    supabase,
                    id
                );

                throw new Error(
                    "Saldo user gagal diperbarui."
                );
            }

            /*
             * =================================================
             * 8. BERHASIL
             * =================================================
             */

            showToast(
                "Top up berhasil. " +
                getFormatNumber(creditsToAdd) +
                " credit telah ditambahkan ke saldo user.",
                "success"
            );

            await refreshTopups();
            await refreshStats();

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

            await refreshTopups();

            return false;
        }
    }

    /*
     * =========================================================
     * ROLLBACK APPROVAL
     * =========================================================
     *
     * Dipanggil hanya ketika status sudah berubah menjadi
     * approved tetapi proses penambahan credit gagal.
     */

    async function rollbackApproval(
        supabase,
        id
    ) {
        try {
            const rollbackTime =
                new Date().toISOString();

            const {
                data: rollbackRows,
                error: rollbackError
            } = await supabase
                .from("topup_requests")
                .update({
                    status: "pending",
                    processed_at: null,
                    updated_at: rollbackTime
                })
                .eq("id", id)
                .eq("status", "approved")
                .select("id");

            if (rollbackError) {
                console.error(
                    "GENZ Top Up rollback error:",
                    rollbackError
                );

                showToast(
                    "Credit gagal ditambahkan dan status top up gagal dikembalikan. Periksa transaksi ini secara manual.",
                    "error"
                );

                return false;
            }

            if (
                !Array.isArray(rollbackRows) ||
                rollbackRows.length === 0
            ) {
                console.error(
                    "GENZ Top Up rollback: no rows updated."
                );

                showToast(
                    "Status top up tidak dapat dikembalikan. Periksa transaksi ini secara manual.",
                    "error"
                );

                return false;
            }

            return true;

        } catch (error) {
            console.error(
                "GENZ Top Up rollback exception:",
                error
            );

            showToast(
                "Rollback approval gagal. Periksa transaksi secara manual.",
                "error"
            );

            return false;
        }
    }

    /*
     * =========================================================
     * PUBLIC API
     * =========================================================
     */

    window.GENZTopUpApproval = {
        approveTopup: approveTopup
    };

    /*
     * Kompatibilitas dengan sistem lama.
     */
    window.GENZApproveTopup =
        approveTopup;

    console.log(
        MODULE_NAME +
        ": approval module loaded."
    );
})();
