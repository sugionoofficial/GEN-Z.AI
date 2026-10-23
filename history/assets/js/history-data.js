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
       PRIVATE MEDIA (output upscale di bucket privat)
       -----------------------------------------------------
       Output upscale disimpan di bucket privat
       `user-uploads` dan DB menyimpan referensi
       `supabase-private://<bucket>/<object-path>`.

       Halaman riwayat menukarnya menjadi signed URL lewat
       Supabase client. RLS hanya mengizinkan folder milik
       user sendiri (admin/owner boleh semua).
    ===================================================== */

    const PRIVATE_MEDIA_SCHEME =
        "supabase-private";

    const PRIVATE_MEDIA_TTL_SECONDS =
        60 * 60;

    const privateMediaCache =
        new Map();

    /*
     * Signed URL hanya berlaku 1 jam. Halaman riwayat bisa dibiarkan
     * terbuka lebih lama, jadi token diperbarui jauh sebelum habis.
     */
    const PRIVATE_MEDIA_REFRESH_MS =
        5 * 60 * 1000;

    /*
     * Kolom yang bisa berisi referensi media privat.
     * `result_url`       = hasil upscale
     * `image_reference_url` / `video_reference_url` = input yang dipakai
     */
    const PRIVATE_MEDIA_FIELDS = [
        "result_url",
        "image_reference_url",
        "video_reference_url"
    ];


    function parsePrivateMediaRef(value) {

        const raw =
            String(value || "")
                .trim();

        if (
            !raw
                .toLowerCase()
                .startsWith(PRIVATE_MEDIA_SCHEME + "://")
        ) {

            return null;
        }

        const rest =
            raw.slice(
                PRIVATE_MEDIA_SCHEME.length + 3
            );

        const slash =
            rest.indexOf("/");

        if (slash <= 0) {
            return null;
        }

        const bucket =
            rest.slice(0, slash).trim();

        const objectPath =
            rest.slice(slash + 1).trim();

        if (
            !bucket ||
            !objectPath ||
            objectPath.includes("..")
        ) {

            return null;
        }

        return {
            bucket,
            objectPath
        };
    }


    function isPrivateMediaRef(value) {

        return Boolean(
            parsePrivateMediaRef(value)
        );
    }


    async function signPrivateMediaUrl(
        client,
        ref,
        options = {}
    ) {

        const parsed =
            parsePrivateMediaRef(ref);

        if (!client || !parsed) {
            return "";
        }

        const force =
            options.force === true;

        const cached =
            privateMediaCache.get(ref);

        if (
            !force &&
            cached &&
            cached.expiresAt > Date.now()
        ) {

            return cached.url;
        }

        try {

            const {
                data,
                error
            } = await client
                .storage
                .from(parsed.bucket)
                .createSignedUrl(
                    parsed.objectPath,
                    PRIVATE_MEDIA_TTL_SECONDS
                );

            if (error || !data?.signedUrl) {

                console.warn(
                    "Gagal membuat signed URL:",
                    parsed.objectPath,
                    error?.message || ""
                );

                return "";
            }

            privateMediaCache.set(
                ref,
                {
                    url: data.signedUrl,
                    expiresAt:
                        Date.now() +
                        (PRIVATE_MEDIA_TTL_SECONDS - 60) *
                        1000
                }
            );

            return data.signedUrl;

        } catch (err) {

            console.warn(
                "Gagal membuat signed URL:",
                parsed.objectPath,
                err?.message || err
            );

            return "";
        }
    }


    async function resolvePrivateMediaRefs(items) {

        if (
            !Array.isArray(items) ||
            !items.length
        ) {

            return items;
        }

        const client =
            getSupabaseClient();

        if (!client) {
            return items;
        }

        const tasks = [];

        items.forEach(item => {

            if (!item || typeof item !== "object") {
                return;
            }

            PRIVATE_MEDIA_FIELDS.forEach(field => {

                const ref =
                    item[field];

                if (
                    typeof ref !== "string" ||
                    !isPrivateMediaRef(ref)
                ) {

                    return;
                }

                tasks.push(
                    (async () => {

                        const cleanRef =
                            ref.trim();

                        /*
                         * Simpan referensi asli supaya bisa
                         * ditandatangani ulang saat token
                         * mendekati kedaluwarsa.
                         */
                        item.__privateMediaRefs =
                            item.__privateMediaRefs || {};

                        item.__privateMediaRefs[field] =
                            cleanRef;

                        const url =
                            await signPrivateMediaUrl(
                                client,
                                cleanRef
                            );

                        /*
                         * Kosongkan kalau gagal: lebih baik UI
                         * menampilkan placeholder daripada
                         * "supabase-private://" mentah.
                         */
                        item[field] =
                            url || "";

                        /*
                         * Gagal sign = file sudah dihapus cron
                         * retensi. Beri tanda supaya baris
                         * ditandai KEDALUWARSA.
                         */
                        if (!url) {

                            item.media_expired =
                                true;

                        } else {

                            delete item.media_expired;
                        }
                    })()
                );
            });
        });

        if (!tasks.length) {
            return items;
        }

        await Promise.all(tasks);

        ensurePrivateMediaWatch();

        return items;
    }

    /*
     * Perbarui signed URL yang mendekati kedaluwarsa tanpa reload
     * halaman. Hanya baris yang punya referensi tersimpan.
     */
    async function refreshPrivateMediaRefs() {

        const state =
            getState();

        const items =
            Array.isArray(state.historyData)
                ? state.historyData
                : [];

        const client =
            getSupabaseClient();

        if (!client || !items.length) {
            return false;
        }

        const now =
            Date.now();

        const tasks = [];
        let changed = false;

        items.forEach(item => {

            const refs =
                item?.__privateMediaRefs;

            if (!refs || typeof refs !== "object") {
                return;
            }

            Object.entries(refs).forEach(([field, ref]) => {

                if (
                    typeof ref !== "string" ||
                    !isPrivateMediaRef(ref)
                ) {

                    return;
                }

                const cached =
                    privateMediaCache.get(ref);

                const needsRefresh =
                    !cached ||
                    cached.expiresAt - now <=
                        PRIVATE_MEDIA_REFRESH_MS;

                if (!needsRefresh) {
                    return;
                }

                tasks.push(
                    (async () => {

                        const url =
                            await signPrivateMediaUrl(
                                client,
                                ref,
                                { force: true }
                            );

                        if (!url) {

                            item[field] = "";
                            item.media_expired = true;
                            changed = true;

                            return;
                        }

                        item[field] = url;
                        delete item.media_expired;
                        changed = true;
                    })()
                );
            });
        });

        if (!tasks.length) {
            return false;
        }

        await Promise.all(tasks);

        if (
            changed &&
            typeof App.renderHistory ===
                "function"
        ) {

            App.renderHistory();
        }

        return changed;
    }

    App.refreshPrivateMediaRefs =
        refreshPrivateMediaRefs;


    let privateMediaWatchTimer = null;

    function ensurePrivateMediaWatch() {

        if (
            privateMediaWatchTimer ||
            typeof window === "undefined" ||
            typeof window.setInterval !==
                "function"
        ) {

            return;
        }

        privateMediaWatchTimer =
            window.setInterval(() => {

                refreshPrivateMediaRefs()
                    .catch(() => {});

            }, PRIVATE_MEDIA_REFRESH_MS);
    }

    App.ensurePrivateMediaWatch =
        ensurePrivateMediaWatch;


    App.resolvePrivateMediaRefs =
        resolvePrivateMediaRefs;


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
                })
                .limit(200);

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
             * Tukar referensi media privat menjadi signed URL
             * sebelum render supaya thumbnail langsung tampil.
             */
            await resolvePrivateMediaRefs(
                state.historyData
            );

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
