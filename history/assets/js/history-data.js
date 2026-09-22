/* =========================================================
   GEN-Z.AI
   HISTORY DATA MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-data.js

   Tanggung jawab:
   - Query generation_history
   - Menyimpan hasil ke state
   - Helper data history
   - Filter data
   - Status aktif

   Tidak bertanggung jawab:
   - Render HTML
   - Modal
   - Event listener
   - Authentication
   - Polling provider status
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
        historyTable: "generation_history",
        activeStatuses: ["processing", "pending"]
    };

    /* =====================================================
       INTERNAL HELPERS
    ===================================================== */

    function getState() {
        return App.state;
    }

    function getSupabaseClient() {
        return getState().supabaseClient;
    }

    function getCurrentUser() {
        return getState().currentUser;
    }

    function getCurrentProfile() {
        return getState().currentProfile;
    }

    /* =====================================================
       ROLE
    ===================================================== */

    function normalizeRole(role) {
        return String(role || "")
            .trim()
            .toUpperCase();
    }

    function isAdminOrOwner() {
        const profile = getCurrentProfile();

        const role = normalizeRole(profile?.role);

        return role === "ADMIN" || role === "OWNER";
    }

    App.normalizeRole = normalizeRole;
    App.isAdminOrOwner = isAdminOrOwner;

    /* =====================================================
       STATUS
    ===================================================== */

    function normalizeStatus(status) {
        const value = String(status || "pending")
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
        const normalized = normalizeStatus(status);

        return (
            normalized === "processing" ||
            normalized === "pending"
        );
    }

    App.normalizeStatus = normalizeStatus;
    App.isActiveStatus = isActiveStatus;

    /* =====================================================
       LOAD HISTORY
    ===================================================== */

    async function loadHistory(options = {}) {

        const silent = options.silent === true;

        const state = getState();

        const client = getSupabaseClient();
        const currentUser = getCurrentUser();

        if (!client) {
            throw new Error(
                "Supabase client belum tersedia."
            );
        }

        if (!currentUser?.id) {
            throw new Error(
                "User session tidak tersedia."
            );
        }

        /*
         * Jangan jalankan query ganda bersamaan.
         */
        if (state.historyLoadInProgress) {
            return state.historyData;
        }

        state.historyLoadInProgress = true;

        try {

            /*
             * Loading UI hanya boleh dilakukan
             * ketika bukan silent refresh.
             *
             * Silent refresh dipakai oleh status sync
             * supaya halaman tidak berkedip.
             */
            if (!silent) {

                const elements =
                    App.elements || {};

                if (elements.loadingState) {
                    elements.loadingState.style.display =
                        "block";
                }

                if (elements.tableWrap) {
                    elements.tableWrap.style.display =
                        "none";
                }

                if (elements.emptyState) {
                    elements.emptyState.style.display =
                        "none";
                }

                if (
                    typeof App.hideMessage ===
                    "function"
                ) {
                    App.hideMessage();
                }
            }

            /*
             * Query generation history.
             */
            let query = client
                .from(App.config.historyTable)
                .select("*")
                .order("created_at", {
                    ascending: false
                });

            /*
             * USER hanya boleh melihat history
             * miliknya sendiri.
             *
             * ADMIN / OWNER tetap dapat melihat
             * seluruh history seperti sistem lama.
             */
            if (!isAdminOrOwner()) {

                query = query.eq(
                    "user_id",
                    currentUser.id
                );
            }

            const {
                data,
                error
            } = await query;

            if (error) {

                console.error(
                    "History query error:",
                    error
                );

                throw new Error(
                    "Gagal mengambil generation history: " +
                    error.message
                );
            }

            /*
             * Selalu normalisasi menjadi array.
             */
            state.historyData =
                Array.isArray(data)
                    ? data
                    : [];

            /*
             * Render dilakukan oleh history-render.js.
             *
             * Kita sengaja tidak membuat ketergantungan
             * langsung ke fungsi render di sini.
             */
            if (
                typeof App.renderHistory ===
                "function"
            ) {
                App.renderHistory();
            }

            return state.historyData;

        } finally {

            state.historyLoadInProgress =
                false;
        }
    }

    App.loadHistory = loadHistory;

    /* =====================================================
       GET CURRENT HISTORY DATA
    ===================================================== */

    function getHistoryData() {

        return Array.isArray(
            getState().historyData
        )
            ? getState().historyData
            : [];
    }

    App.getHistoryData = getHistoryData;

    /* =====================================================
       FILTER
    ===================================================== */

    function setCurrentFilter(filter) {

        const normalized =
            String(filter || "all")
                .trim()
                .toLowerCase();

        const allowedFilters = [
            "all",
            "success",
            "processing",
            "pending",
            "failed",
            "cancelled"
        ];

        getState().currentFilter =
            allowedFilters.includes(normalized)
                ? normalized
                : "all";

        return getState().currentFilter;
    }

    function getCurrentFilter() {

        return (
            getState().currentFilter ||
            "all"
        );
    }

    function getFilteredHistory() {

        const data =
            getHistoryData();

        const filter =
            getCurrentFilter();

        if (filter === "all") {
            return data;
        }

        return data.filter(item => {

            const status =
                normalizeStatus(
                    item?.status
                );

            return status === filter;
        });
    }

    App.setCurrentFilter =
        setCurrentFilter;

    App.getCurrentFilter =
        getCurrentFilter;

    App.getFilteredHistory =
        getFilteredHistory;

    /* =====================================================
       ACTIVE GENERATION
    ===================================================== */

    function hasActiveGeneration() {

        return getHistoryData()
            .some(item => {

                const status =
                    normalizeStatus(
                        item?.status
                    );

                return isActiveStatus(status);
            });
    }

    App.hasActiveGeneration =
        hasActiveGeneration;

    /* =====================================================
       RESULT URL
    ===================================================== */

    function getResultUrl(item) {

        if (!item) {
            return "";
        }

        const value =
            item.result_url;

        if (
            typeof value !== "string"
        ) {
            return "";
        }

        const url =
            value.trim();

        if (!url) {
            return "";
        }

        /*
         * Jangan izinkan javascript:
         * atau scheme berbahaya masuk
         * ke HTML media element.
         */
        const lower =
            url.toLowerCase();

        if (
            lower.startsWith(
                "javascript:"
            ) ||
            lower.startsWith(
                "data:text/html"
            )
        ) {
            return "";
        }

        return url;
    }

    App.getResultUrl =
        getResultUrl;

    /* =====================================================
       BASIC DATA HELPERS
    ===================================================== */

    function getTaskId(item) {

        if (!item) {
            return "";
        }

        return String(
            item.task_id ||
            item.taskId ||
            ""
        ).trim();
    }

    function getModelId(item) {

        if (!item) {
            return "";
        }

        return String(
            item.model_id ||
            item.modelId ||
            ""
        ).trim();
    }

    function getModelName(item) {

        if (!item) {
            return "";
        }

        return String(
            item.model_name ||
            item.modelName ||
            item.model ||
            ""
        ).trim();
    }

    function getProviderName(item) {

        if (!item) {
            return "";
        }

        return String(
            item.provider_name ||
            item.providerName ||
            item.provider ||
            ""
        ).trim();
    }

    function getPrompt(item) {

        if (!item) {
            return "";
        }

        return String(
            item.prompt ||
            item.input_prompt ||
            ""
        ).trim();
    }

    function getUserId(item) {

        if (!item) {
            return "";
        }

        return String(
            item.user_id ||
            ""
        ).trim();
    }

    function getCreditCost(item) {

        if (!item) {
            return 0;
        }

        const value =
            item.credit_cost ??
            item.credits_used ??
            item.cost ??
            0;

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    function getErrorMessage(item) {

        if (!item) {
            return "";
        }

        return String(
            item.error_message ||
            item.error ||
            item.message ||
            ""
        ).trim();
    }

    App.getTaskId =
        getTaskId;

    App.getModelId =
        getModelId;

    App.getModelName =
        getModelName;

    App.getProviderName =
        getProviderName;

    App.getPrompt =
        getPrompt;

    App.getUserId =
        getUserId;

    App.getCreditCost =
        getCreditCost;

    App.getErrorMessage =
        getErrorMessage;

    /* =====================================================
       CREATED / COMPLETED DATE
    ===================================================== */

    function getCreatedAt(item) {

        if (!item) {
            return null;
        }

        return (
            item.created_at ||
            item.createdAt ||
            null
        );
    }

    function getCompletedAt(item) {

        if (!item) {
            return null;
        }

        return (
            item.completed_at ||
            item.completedAt ||
            null
        );
    }

    App.getCreatedAt =
        getCreatedAt;

    App.getCompletedAt =
        getCompletedAt;

    /* =====================================================
       DATA LOOKUP
    ===================================================== */

    function findHistoryById(id) {

        const target =
            String(id || "").trim();

        if (!target) {
            return null;
        }

        return getHistoryData()
            .find(item => {

                return String(
                    item?.id || ""
                ).trim() === target;
            }) || null;
    }

    function findHistoryByTaskId(taskId) {

        const target =
            String(taskId || "").trim();

        if (!target) {
            return null;
        }

        return getHistoryData()
            .find(item => {

                return getTaskId(item) === target;
            }) || null;
    }

    App.findHistoryById =
        findHistoryById;

    App.findHistoryByTaskId =
        findHistoryByTaskId;

    /* =====================================================
       STATUS COUNTS
    ===================================================== */

    function getStatusCounts() {

        const counts = {
            all: 0,
            success: 0,
            processing: 0,
            pending: 0,
            failed: 0,
            cancelled: 0
        };

        const data =
            getHistoryData();

        counts.all =
            data.length;

        data.forEach(item => {

            const status =
                normalizeStatus(
                    item?.status
                );

            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        counts,
                        status
                    )
            ) {
                counts[status]++;
            }
        });

        return counts;
    }

    App.getStatusCounts =
        getStatusCounts;

    /* =====================================================
       DEBUG / SAFE SNAPSHOT
    ===================================================== */

    function getDataSnapshot() {

        return {
            total:
                getHistoryData().length,

            filter:
                getCurrentFilter(),

            active:
                hasActiveGeneration(),

            counts:
                getStatusCounts()
        };
    }

    App.getDataSnapshot =
        getDataSnapshot;

})();
