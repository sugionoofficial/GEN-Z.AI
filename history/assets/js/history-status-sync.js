/* =========================================================
   GEN-Z.AI
   HISTORY STATUS SYNC MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-status-sync.js

   Tanggung jawab:
   - Sinkronisasi status generation ke backend
   - Memanggil /api/generate-status
   - Polling generation yang masih aktif
   - Reload History secara silent
   - Mencegah concurrent status sync

   Tidak bertanggung jawab:
   - Authentication bootstrap
   - Render table
   - Modal
   - Filter UI
   - Event listener
========================================================= */

(function () {
    "use strict";

    window.GENZHistory = window.GENZHistory || {};

    const App = window.GENZHistory;

    App.state = App.state || {
        supabaseClient: null,
        currentUser: null,
        currentProfile: null,
        historyData: [],
        currentFilter: "all",
        autoRefreshTimer: null,
        historyLoadInProgress: false,
        historyStatusSyncInProgress: false
    };

    App.config = App.config || {
        autoRefreshInterval: 5000,
        statusEndpoint: "/api/generate-status",
        activeStatuses: [
            "processing",
            "pending"
        ]
    };

    /* =====================================================
       HELPERS
    ===================================================== */

    function getState() {
        return App.state;
    }

    function getClient() {
        return getState().supabaseClient;
    }

    function getHistoryData() {

        return Array.isArray(
            getState().historyData
        )
            ? getState().historyData
            : [];
    }

    function normalizeStatus(status) {

        if (
            typeof App.normalizeStatus ===
            "function"
        ) {
            return App.normalizeStatus(status);
        }

        const value =
            String(status || "pending")
                .trim()
                .toLowerCase();

        if (value === "completed") {
            return "success";
        }

        if (value === "queued") {
            return "pending";
        }

        return value;
    }

    function isActiveStatus(status) {

        if (
            typeof App.isActiveStatus ===
            "function"
        ) {
            return App.isActiveStatus(status);
        }

        const normalized =
            normalizeStatus(status);

        return (
            normalized === "processing" ||
            normalized === "pending"
        );
    }

    /* =====================================================
       ACCESS TOKEN
    ===================================================== */

    async function getAccessToken() {

        const client =
            getClient();

        if (!client) {
            throw new Error(
                "Supabase client belum tersedia."
            );
        }

        const {
            data,
            error
        } = await client.auth.getSession();

        if (error) {

            console.error(
                "Supabase getSession error:",
                error
            );

            throw new Error(
                "Gagal mengambil session."
            );
        }

        const session =
            data?.session;

        const token =
            session?.access_token;

        if (!token) {
            throw new Error(
                "Access token tidak tersedia."
            );
        }

        return token;
    }

    App.getHistoryAccessToken =
        getAccessToken;

    /* =====================================================
       ACTIVE HISTORY ITEMS
    ===================================================== */

    function getActiveHistoryItems() {

        return getHistoryData()
            .filter(item => {

                const status =
                    normalizeStatus(
                        item?.status
                    );

                return isActiveStatus(
                    status
                );
            });
    }

    App.getActiveHistoryItems =
        getActiveHistoryItems;

    /* =====================================================
       TASK VALIDATION
    ===================================================== */

    function getTaskId(item) {

        if (
            typeof App.getTaskId ===
            "function"
        ) {
            return App.getTaskId(item);
        }

        return String(
            item?.task_id ||
            item?.taskId ||
            ""
        ).trim();
    }

    function getModelId(item) {

        if (
            typeof App.getModelId ===
            "function"
        ) {
            return App.getModelId(item);
        }

        return String(
            item?.model_id ||
            item?.modelId ||
            ""
        ).trim();
    }

    /* =====================================================
       SYNC ONE TASK
    ===================================================== */

    async function syncGenerationStatus(
        item,
        accessToken
    ) {

        if (!item) {
            return {
                success: false,
                skipped: true,
                reason: "missing_item"
            };
        }

        const taskId =
            getTaskId(item);

        const modelId =
            getModelId(item);

        /*
         * Jangan memanggil endpoint tanpa task_id.
         */
        if (!taskId) {

            console.warn(
                "History status sync skipped: " +
                "task_id tidak tersedia.",
                item
            );

            return {
                success: false,
                skipped: true,
                reason: "missing_task_id",
                item
            };
        }

        /*
         * model_id dikirim bila tersedia.
         *
         * Backend GEN-Z.AI menggunakan task_id
         * sebagai identitas utama dan model_id
         * untuk kebutuhan provider lookup.
         */
        const body = {
            task_id: taskId
        };

        if (modelId) {
            body.model_id = modelId;
        }

        let response;

        try {

            response = await fetch(
                App.config.statusEndpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            "Bearer " +
                            accessToken
                    },

                    body:
                        JSON.stringify(body)
                }
            );

        } catch (networkError) {

            console.error(
                "History status network error:",
                networkError
            );

            return {
                success: false,
                networkError: true,
                error: networkError,
                item
            };
        }

        let payload = null;

        try {
            payload =
                await response.json();
        } catch (parseError) {

            console.error(
                "History status response parse error:",
                parseError
            );
        }

        /*
         * HTTP error tidak boleh membuat
         * seluruh polling berhenti.
         */
        if (!response.ok) {

            console.error(
                "History status API error:",
                response.status,
                payload
            );

            return {
                success: false,
                httpError: true,
                statusCode: response.status,
                payload,
                item
            };
        }

        return {
            success: true,
            statusCode: response.status,
            payload,
            item
        };
    }

    App.syncGenerationStatus =
        syncGenerationStatus;

    /* =====================================================
       SYNC ALL ACTIVE GENERATIONS
    ===================================================== */

    async function syncActiveGenerations() {

        const state =
            getState();

        /*
         * Jangan menjalankan sync kedua
         * sebelum sync sebelumnya selesai.
         */
        if (
            state.historyStatusSyncInProgress
        ) {
            return {
                skipped: true,
                reason:
                    "sync_already_running"
            };
        }

        const activeItems =
            getActiveHistoryItems();

        /*
         * Tidak ada generation aktif.
         */
        if (!activeItems.length) {

            stopHistoryAutoRefresh();

            return {
                skipped: true,
                reason:
                    "no_active_generation",
                synced: 0
            };
        }

        state.historyStatusSyncInProgress =
            true;

        try {

            const accessToken =
                await getAccessToken();

            /*
             * Semua task diproses bersamaan.
             *
             * Promise.allSettled dipakai supaya
             * satu task gagal tidak menghentikan
             * task lainnya.
             */
            const results =
                await Promise.allSettled(
                    activeItems.map(item =>
                        syncGenerationStatus(
                            item,
                            accessToken
                        )
                    )
                );

            let synced = 0;
            let failed = 0;

            results.forEach(result => {

                if (
                    result.status ===
                    "fulfilled"
                ) {

                    if (
                        result.value?.success
                    ) {
                        synced++;
                    }

                } else {

                    failed++;

                    console.error(
                        "History status sync rejected:",
                        result.reason
                    );
                }
            });

            /*
             * Setelah backend melakukan sinkronisasi,
             * ambil ulang generation_history.
             *
             * silent=true sangat penting:
             * tidak boleh membuat tabel berkedip.
             */
            if (
                typeof App.loadHistory ===
                "function"
            ) {

                await App.loadHistory({
                    silent: true
                });
            }

            return {
                skipped: false,
                synced,
                failed,
                activeBeforeSync:
                    activeItems.length
            };

        } catch (error) {

            /*
             * Error auth/network tidak boleh
             * membuat timer mati permanen.
             */
            console.error(
                "History active generation sync error:",
                error
            );

            return {
                skipped: false,
                synced: 0,
                failed: activeItems.length,
                error
            };

        } finally {

            state.historyStatusSyncInProgress =
                false;
        }
    }

    App.syncActiveGenerations =
        syncActiveGenerations;

    /* =====================================================
       STOP AUTO REFRESH
    ===================================================== */

    function stopHistoryAutoRefresh() {

        const state =
            getState();

        if (
            state.autoRefreshTimer !==
            null
        ) {

            clearTimeout(
                state.autoRefreshTimer
            );

            state.autoRefreshTimer =
                null;
        }
    }

    App.stopHistoryAutoRefresh =
        stopHistoryAutoRefresh;

    /* =====================================================
       SCHEDULE NEXT SYNC
    ===================================================== */

    function scheduleHistoryAutoRefresh() {

        const state =
            getState();

        stopHistoryAutoRefresh();

        const activeItems =
            getActiveHistoryItems();

        /*
         * Tidak ada task aktif:
         * timer harus berhenti.
         */
        if (!activeItems.length) {
            return;
        }

        const interval =
            Number(
                App.config.autoRefreshInterval
            ) || 5000;

        state.autoRefreshTimer =
            setTimeout(
                async function () {

                    state.autoRefreshTimer =
                        null;

                    try {

                        await syncActiveGenerations();

                    } catch (error) {

                        console.error(
                            "History auto refresh error:",
                            error
                        );
                    }

                    /*
                     * Setelah sync selesai,
                     * periksa ulang state terbaru.
                     *
                     * Kalau masih processing/pending,
                     * lanjut polling.
                     */
                    if (
                        typeof App.hasActiveGeneration ===
                        "function"
                    ) {

                        if (
                            App.hasActiveGeneration()
                        ) {
                            scheduleHistoryAutoRefresh();
                        }

                    } else {

                        if (
                            getActiveHistoryItems()
                                .length
                        ) {
                            scheduleHistoryAutoRefresh();
                        }
                    }

                },
                interval
            );
    }

    App.scheduleHistoryAutoRefresh =
        scheduleHistoryAutoRefresh;

    /* =====================================================
       START STATUS MONITOR
    ===================================================== */

    async function startHistoryStatusMonitor() {

        /*
         * Jangan membuat timer ganda.
         */
        stopHistoryAutoRefresh();

        const activeItems =
            getActiveHistoryItems();

        if (!activeItems.length) {
            return;
        }

        /*
         * Lakukan sync langsung terlebih dahulu.
         * Tidak perlu menunggu 5 detik hanya karena
         * JavaScript menyukai angka bulat.
         */
        await syncActiveGenerations();

        /*
         * Setelah sync, cek apakah masih aktif.
         */
        const stillActive =
            getActiveHistoryItems()
                .length > 0;

        if (stillActive) {
            scheduleHistoryAutoRefresh();
        }
    }

    App.startHistoryStatusMonitor =
        startHistoryStatusMonitor;

    /* =====================================================
       PUBLIC MANUAL STATUS SYNC
    ===================================================== */

    async function refreshActiveGenerationStatus() {

        stopHistoryAutoRefresh();

        try {

            return await syncActiveGenerations();

        } finally {

            if (
                getActiveHistoryItems()
                    .length > 0
            ) {
                scheduleHistoryAutoRefresh();
            }
        }
    }

    App.refreshActiveGenerationStatus =
        refreshActiveGenerationStatus;

})();
