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

   PATCH:
   - Tambah failedSyncTracker: skip task setelah 3x gagal
   - Reset tracker ketika task sukses
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
       SYNC FAILURE TRACKER
       -----------------------------------------------------
       Task yang gagal sync beberapa kali akan di-skip
       sampai reload halaman.
    ===================================================== */

    const failedSyncTracker = new Map();
    const MAX_SYNC_FAILURES = 3;

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
       ACTIVE HISTORY ITEMS
       -----------------------------------------------------
       Skip task yang sudah gagal sync 3x berturut-turut.
    ===================================================== */

    function getActiveHistoryItems() {

        return getHistoryData()
            .filter(item => {

                const status =
                    normalizeStatus(
                        item?.status
                    );

                if (!isActiveStatus(status)) {
                    return false;
                }

                const taskId =
                    getTaskId(item);

                if (
                    taskId &&
                    failedSyncTracker.get(taskId) >=
                        MAX_SYNC_FAILURES
                ) {
                    return false;
                }

                return true;
            });
    }

    App.getActiveHistoryItems =
        getActiveHistoryItems;

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

            /*
             * Hitung network error juga sebagai failure.
             */
            if (taskId) {
                const count =
                    (failedSyncTracker.get(taskId) || 0) + 1;
                failedSyncTracker.set(taskId, count);
            }

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

        /* =================================================
           HTTP ERROR
        ================================================= */

        if (!response.ok) {

            console.error(
                "History status API error:",
                response.status,
                payload
            );

            /*
             * Catat kegagalan per task.
             */
            if (taskId) {

                const count =
                    (failedSyncTracker.get(taskId) || 0) + 1;

                failedSyncTracker.set(taskId, count);

                if (count >= MAX_SYNC_FAILURES) {
                    console.warn(
                        "[history-sync] Task " +
                        taskId +
                        " di-skip setelah " +
                        count +
                        " kali gagal. Reload halaman untuk reset."
                    );
                }
            }

            return {
                success: false,
                httpError: true,
                statusCode: response.status,
                payload,
                item
            };
        }

        /* =================================================
           SUCCESS — reset tracker untuk task ini
        ================================================= */

        if (taskId) {
            failedSyncTracker.delete(taskId);
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

        stopHistoryAutoRefresh();

        const activeItems =
            getActiveHistoryItems();

        if (!activeItems.length) {
            return;
        }

        await syncActiveGenerations();

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
