// credit/assets/js/credit-app.js?v=credit-usage-limit-20261018
/* =========================================================
   GEN-Z.AI — CREDIT USAGE APP
   ---------------------------------------------------------
   File:
   credit/assets/js/credit-app.js

   Fungsi:
   - Autentikasi (pola sama dengan history page)
   - Query riwayat pemakaian credit dari generation_history
   - Hitung status: success / failed / proses
   - Render hero saldo, stats, chart 14 hari, tabel transaksi
   - Filter status + filter jumlah tampilan (10 / 50 / 100)
   - Refresh + auto refresh 10 detik

   Tidak bertanggung jawab:
   - Navigasi (navigation.js)
   - Deduksi credit server (api + Supabase RPC)
========================================================= */

(function () {

    "use strict";


    /* =========================================================
       CONFIG
    ========================================================== */

    const CONFIG = Object.freeze({

        historyTable: "generation_history",

        profilesTable: "profiles",

        /*
         * Batas baris yang diambil dari server.
         * = opsi filter tampilan terbesar (10/50/100).
         */
        limit: 100,

        /*
         * Opsi filter jumlah baris yang ditampilkan.
         */
        rowLimits: [10, 50, 100],

        defaultRowLimit: 50,

        /* Panjang grafik harian. */
        chartDays: 14,

        /* Interval auto refresh (ms). */
        autoRefreshInterval: 10000,

        /* Role yang boleh mengakses. */
        allowedRoles: ["USER", "ADMIN", "OWNER"]

    });


    /* =========================================================
       STATE
    ========================================================== */

    const state = {

        client: null,

        currentUser: null,

        profile: null,

        rows: [],

        filter: "all",

        /* Jumlah baris yang ditampilkan (filter 10/50/100). */
        rowLimit: CONFIG.defaultRowLimit,

        autoTimer: null,

        initializing: false

    };


    /* =========================================================
       DOM HELPERS
    ========================================================== */

    const byId = id => document.getElementById(id);


    const elements = {

        loading: byId("cuLoading"),

        message: byId("cuMessage"),

        balance: byId("cuBalance"),

        heroSub: byId("cuHeroSub"),

        totalUsed: byId("cuTotalUsed"),

        totalRows: byId("cuTotalRows"),

        successCount: byId("cuSuccessCount"),

        successCredits: byId("cuSuccessCredits"),

        failedCount: byId("cuFailedCount"),

        failedCredits: byId("cuFailedCredits"),

        prosesCount: byId("cuProsesCount"),

        prosesCredits: byId("cuProsesCredits"),

        chartSub: byId("cuChartSub"),

        chartPeak: byId("cuChartPeak"),

        chart: byId("cuChart"),

        rows: byId("cuRows"),

        empty: byId("cuEmpty"),

        more: byId("cuMore"),

        filters: byId("cuFilters"),

        limits: byId("cuLimits"),

        refresh: byId("cuRefresh"),

        autoToggle: byId("cuAutoToggle")

    };


    /* =========================================================
       SMALL UTILS
    ========================================================== */

    function escapeHtml(value) {

        return String(value == null ? "" : value)

            .replace(/&/g, "&amp;")

            .replace(/</g, "&lt;")

            .replace(/>/g, "&gt;")

            .replace(/"/g, "&quot;")

            .replace(/'/g, "&#39;");
    }


    const numberFormatter =
        new Intl.NumberFormat("id-ID");


    function formatNumber(value) {

        const number = Number(value);

        return numberFormatter.format(
            Number.isFinite(number) ? number : 0
        );
    }


    const dateFormatter =
        new Intl.DateTimeFormat("id-ID", {

            day: "2-digit",

            month: "short",

            year: "numeric"

        });


    const timeFormatter =
        new Intl.DateTimeFormat("id-ID", {

            hour: "2-digit",

            minute: "2-digit"

        });


    function formatDate(value) {

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "-"
            : dateFormatter.format(date);
    }


    function formatTime(value) {

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "-"
            : timeFormatter.format(date);
    }


    /*
     * Animasi angka sederhana (count-up).
     */
    function animateNumber(element, target) {

        if (!element) {
            return;
        }

        const to = Number(target) || 0;

        const from =
            Number(element.dataset.value) || 0;

        element.dataset.value = String(to);


        const reduceMotion =
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;


        if (
            reduceMotion ||
            from === to
        ) {

            element.textContent =
                formatNumber(to);

            return;
        }


        const duration = 650;

        const startedAt =
            performance.now();


        function step(now) {

            const progress =
                Math.min(
                    (now - startedAt) / duration,
                    1
                );

            const eased =
                1 - Math.pow(1 - progress, 3);

            const current =
                Math.round(
                    from + (to - from) * eased
                );


            element.textContent =
                formatNumber(current);


            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }


        requestAnimationFrame(step);
    }


    /* =========================================================
       MESSAGE
    ========================================================== */

    function showMessage(text, isError) {

        if (!elements.message) {
            return;
        }

        if (!text) {
            elements.message.style.display =
                "none";

            elements.message.textContent =
                "";

            elements.message.classList.remove(
                "is-error"
            );

            return;
        }

        elements.message.textContent = text;

        elements.message.style.display =
            "block";

        elements.message.classList.toggle(
            "is-error",
            isError === true
        );
    }


    function hideLoading() {

        if (elements.loading) {
            elements.loading.style.display =
                "none";
        }
    }


    /* =========================================================
       SUPABASE CLIENT
    ========================================================== */

    function getClient() {

        if (state.client) {
            return state.client;
        }

        if (window.GENZ_SUPABASE) {
            state.client = window.GENZ_SUPABASE;

            return state.client;
        }

        if (window.supabaseClient) {
            state.client = window.supabaseClient;

            return state.client;
        }

        const config =
            window.GENZ_CONFIG || {};


        if (
            !window.supabase ||
            !window.supabase.createClient ||
            !config.SUPABASE_URL
        ) {

            return null;
        }


        const key =
            config.SUPABASE_PUBLISHABLE_KEY ||
            config.SUPABASE_ANON_KEY ||
            "";


        if (!key) {
            return null;
        }


        state.client =
            window.supabase.createClient(
                config.SUPABASE_URL,
                key
            );

        window.GENZ_SUPABASE = state.client;

        window.supabaseClient = state.client;


        return state.client;
    }


    function normalizeRole(role) {

        return String(role || "")
            .trim()
            .toUpperCase();
    }


    function isAdminOrOwner() {

        const role =
            normalizeRole(
                state.profile &&
                state.profile.role
            );

        return (
            role === "ADMIN" ||
            role === "OWNER"
        );
    }


    /*
     * Baris yang ditampilkan saat ini:
     * N transaksi terakhir sesuai filter 10/50/100.
     */
    function getVisibleRows() {

        return state.rows.slice(
            0,
            state.rowLimit
        );
    }


    /* =========================================================
       AUTH + PROFILE
    ========================================================== */

    async function loadSession() {

        const client = getClient();


        if (!client) {
            throw new Error(
                "Supabase belum tersedia. Muat ulang halaman."
            );
        }


        const {
            data,
            error
        } = await client.auth.getSession();


        if (error) {
            throw error;
        }


        const user =
            data && data.session
                ? data.session.user
                : null;


        if (!user) {

            window.location.replace(
                "../login.html"
            );

            throw new Error(
                "Belum login."
            );
        }


        state.currentUser = user;

        return user;
    }


    async function loadProfile() {

        const user = state.currentUser;


        if (!state.client || !user) {
            throw new Error(
                "Sesi pengguna belum tersedia."
            );
        }


        const {
            data: profile,
            error
        } = await state.client

            .from(CONFIG.profilesTable)

            .select(
                "id,email,name,role,credits,status"
            )

            .eq("id", user.id)

            .single();


        if (error || !profile) {

            console.error(
                "[credit] Profile error:",
                error
            );

            throw new Error(
                "Profil pengguna tidak ditemukan."
            );
        }


        const role =
            normalizeRole(profile.role);


        if (
            !CONFIG.allowedRoles.includes(role)
        ) {

            await state.client.auth.signOut();

            window.location.replace(
                "../login.html"
            );

            throw new Error(
                "Role tidak diizinkan."
            );
        }


        if (profile.status !== "active") {

            throw new Error(
                "Akun kamu tidak aktif. Hubungi admin."
            );
        }


        state.profile = profile;

        return profile;
    }


    /* =========================================================
       STATUS BUCKET
       --------------------------------------------------------
       3 status sesuai permintaan:
       - success  : success / completed / complete / done
       - failed   : failed / error / cancelled / timeout
       - proses   : processing / pending / queued / lainnya
                   (masih berjalan atau menunggu)
    ========================================================== */

    const SUCCESS_SET = [
        "success",
        "completed",
        "complete",
        "done",
        "succeeded"
    ];


    const FAILED_SET = [
        "failed",
        "error",
        "cancelled",
        "canceled",
        "timeout",
        "timed_out",
        "aborted"
    ];


    function getStatusBucket(status) {

        const value =
            String(status || "")

                .trim()

                .toLowerCase();


        if (SUCCESS_SET.includes(value)) {
            return "success";
        }


        if (FAILED_SET.includes(value)) {
            return "failed";
        }


        return "processing";
    }


    const STATUS_LABELS = {

        success: "Success",

        failed: "Failed",

        processing: "Proses"

    };


    const STATUS_BADGE_CLASSES = {

        success: "gz-badge gz-badge-green cu-badge",

        failed: "gz-badge gz-badge-red cu-badge",

        processing: "gz-badge gz-badge-yellow cu-badge"

    };


    /*
     * Sumber biaya credit per baris.
     * Pola sama dengan history-data.js.
     */
    function getCreditCost(item) {

        if (!item) {
            return 0;
        }

        const value =
            item.credit_cost ??
            item.credits_used ??
            item.cost ??
            0;

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }


    /* =========================================================
       DATA
    ========================================================== */

    async function loadUsage() {

        let query =
            state.client

                .from(CONFIG.historyTable)

                .select("*")

                .order("created_at", {
                    ascending: false
                })

                .limit(CONFIG.limit);


        /*
         * USER hanya melihat pemakaian sendiri.
         * ADMIN / OWNER melihat semua (sama seperti history).
         */
        if (!isAdminOrOwner()) {

            query = query.eq(
                "user_id",
                state.currentUser.id
            );
        }


        const {
            data,
            error
        } = await query;


        if (error) {

            console.error(
                "[credit] Usage query error:",
                error
            );

            throw new Error(
                "Gagal mengambil riwayat credit: " +
                error.message
            );
        }


        state.rows =
            Array.isArray(data) ? data : [];

        return state.rows;
    }


    /* =========================================================
       AGGREGATE
    ========================================================== */

    function buildDailySeries(rows) {

        const days = [];

        const now = new Date();


        /*
         * Mulai dari tengah malam hari ini,
         * mundur chartDays-1 hari ke belakang.
         */
        const start =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );


        start.setDate(
            start.getDate() - (CONFIG.chartDays - 1)
        );


        const byDay = new Map();


        rows.forEach(item => {

            const date =
                item && item.created_at
                    ? new Date(item.created_at)
                    : null;


            if (
                !date ||
                Number.isNaN(date.getTime())
            ) {
                return;
            }


            const key =
                date.getFullYear() + "-" +
                String(date.getMonth() + 1).padStart(2, "0") + "-" +
                String(date.getDate()).padStart(2, "0");


            byDay.set(
                key,
                (byDay.get(key) || 0) +
                    getCreditCost(item)
            );
        });


        for (let i = 0; i < CONFIG.chartDays; i++) {

            const day =
                new Date(start);

            day.setDate(start.getDate() + i);


            const key =
                day.getFullYear() + "-" +
                String(day.getMonth() + 1).padStart(2, "0") + "-" +
                String(day.getDate()).padStart(2, "0");


            days.push({

                key,

                label:
                    String(day.getDate()).padStart(2, "0"),

                month:
                    day.getMonth() + 1,

                credits:
                    byDay.get(key) || 0

            });
        }


        return days;
    }


    function aggregate(rows) {

        const buckets = {

            success: { count: 0, credits: 0 },

            failed: { count: 0, credits: 0 },

            processing: { count: 0, credits: 0 }

        };


        let totalUsed = 0;


        rows.forEach(item => {

            const bucket =
                getStatusBucket(item.status);

            const cost =
                getCreditCost(item);


            buckets[bucket].count += 1;

            buckets[bucket].credits += cost;

            totalUsed += cost;
        });


        return {

            buckets,

            totalUsed,

            totalRows: rows.length,

            daily: buildDailySeries(rows)

        };
    }


    /* =========================================================
       RENDER
    ========================================================== */

    function renderHeader(summary) {

        animateNumber(
            elements.balance,
            state.profile
                ? Number(state.profile.credits) || 0
                : 0
        );

        animateNumber(
            elements.totalUsed,
            summary.totalUsed
        );

        animateNumber(
            elements.totalRows,
            summary.shown
        );


        if (elements.heroSub) {

            const scopeLabel =
                isAdminOrOwner()
                    ? "Semua riwayat credit (admin)"
                    : "Riwayat credit milikmu";


            elements.heroSub.textContent =
                scopeLabel + " · " + (
                    summary.shown < summary.fetched
                        ? "menampilkan " +
                            formatNumber(summary.shown) +
                            " terakhir dari " +
                            formatNumber(summary.fetched) +
                            " transaksi"
                        : formatNumber(summary.shown) +
                            " transaksi tercatat"
                );
        }
    }


    function renderStats(summary) {

        animateNumber(
            elements.successCount,
            summary.buckets.success.count
        );

        animateNumber(
            elements.successCredits,
            summary.buckets.success.credits
        );

        animateNumber(
            elements.failedCount,
            summary.buckets.failed.count
        );

        animateNumber(
            elements.failedCredits,
            summary.buckets.failed.credits
        );

        animateNumber(
            elements.prosesCount,
            summary.buckets.processing.count
        );

        animateNumber(
            elements.prosesCredits,
            summary.buckets.processing.credits
        );
    }


    function renderChart(daily) {

        if (!elements.chart) {
            return;
        }


        const peak =
            daily.reduce(
                (max, day) =>
                    Math.max(max, day.credits),
                0
            );


        const total =
            daily.reduce(
                (sum, day) =>
                    sum + day.credits,
                0
            );


        if (elements.chartSub) {

            elements.chartSub.textContent =
                formatNumber(total) +
                " credit terpakai dalam " +
                CONFIG.chartDays +
                " hari terakhir";
        }


        if (elements.chartPeak) {

            elements.chartPeak.textContent =
                "Puncak " +
                formatNumber(peak) +
                " credit";
        }


        const html =
            daily.map(day => {

                const percent =
                    peak > 0
                        ? Math.max(
                            (day.credits / peak) * 100,
                            day.credits > 0 ? 6 : 2
                        )
                        : (day.credits > 0 ? 6 : 2);


                const emptyClass =
                    day.credits > 0
                        ? ""
                        : " is-empty";


                const title =
                    day.label + "/" +
                    String(day.month).padStart(2, "0") +
                    ": " +
                    formatNumber(day.credits) +
                    " credit";


                return (
                    '<div class="cu-bar-col">' +
                        '<div class="cu-bar' +
                            emptyClass + '"' +
                            ' style="height: ' +
                                percent.toFixed(1) + '%;' +
                                ' animation-delay: ' +
                                (daily.indexOf(day) * 40) + 'ms;"' +
                            ' title="' + escapeHtml(title) + '"></div>' +
                        '<span class="cu-bar-day">' +
                            escapeHtml(day.label) +
                        '</span>' +
                    '</div>'
                );

            }).join("");


        elements.chart.innerHTML = html;
    }


    function renderBadge(bucket) {

        const label =
            STATUS_LABELS[bucket] || bucket;

        const classes =
            STATUS_BADGE_CLASSES[bucket] ||
            "gz-badge gz-badge-dark cu-badge";


        const pulse =
            bucket === "processing"
                ? '<span class="cu-pulse"></span>'
                : "";


        return (
            '<span class="' + classes + '">' +
                pulse +
                escapeHtml(label) +
            '</span>'
        );
    }


    function renderRows(rows) {

        if (!elements.rows) {
            return;
        }


        const fetched =
            state.rows.length;


        if (elements.empty) {

            elements.empty.style.display =
                rows.length
                    ? "none"
                    : "block";
        }


        if (elements.more) {

            if (!rows.length) {

                elements.more.style.display =
                    "none";

            } else if (rows.length < fetched) {

                elements.more.style.display =
                    "block";

                elements.more.textContent =
                    "Menampilkan " +
                    formatNumber(rows.length) +
                    " dari " +
                    formatNumber(fetched) +
                    " transaksi terakhir";

            } else {

                elements.more.style.display =
                    "block";

                elements.more.textContent =
                    formatNumber(rows.length) +
                    " transaksi terakhir";
            }
        }


        const html =
            rows.map(item => {

                const bucket =
                    getStatusBucket(item.status);

                const cost =
                    getCreditCost(item);

                const modelName =
                    String(
                        item.model_name ||
                        item.model_id ||
                        item.feature ||
                        "Generate"
                    ).trim() || "Generate";


                const modelSub =
                    String(
                        item.model_id || ""
                    ).trim();


                const creditHtml =
                    cost > 0
                        ? '<span class="cu-credit gz-money">' +
                            "-" + formatNumber(cost) +
                        '</span>'
                        : '<span class="cu-credit is-free">0</span>';


                return (
                    '<tr data-bucket="' +
                        escapeHtml(bucket) + '">' +
                        '<td>' +
                            '<span class="cu-date-main">' +
                                escapeHtml(
                                    formatDate(item.created_at)
                                ) +
                            '</span>' +
                            '<span class="cu-date-sub">' +
                                escapeHtml(
                                    formatTime(item.created_at)
                                ) +
                            '</span>' +
                        '</td>' +
                        '<td>' +
                            '<span class="cu-model-main">' +
                                escapeHtml(modelName) +
                            '</span>' +
                            (modelSub
                                ? '<span class="cu-model-sub">' +
                                    escapeHtml(modelSub) +
                                '</span>'
                                : "") +
                        '</td>' +
                        '<td>' +
                            renderBadge(bucket) +
                        '</td>' +
                        '<td>' +
                            creditHtml +
                        '</td>' +
                    '</tr>'
                );

            }).join("");


        elements.rows.innerHTML = html;


        applyFilter(state.filter);
    }


    function applyFilter(filter) {

        state.filter = filter;


        if (elements.filters) {

            const buttons =
                elements.filters.querySelectorAll(
                    ".cu-filter"
                );


            buttons.forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.filter === filter
                );
            });
        }


        if (!elements.rows) {
            return;
        }


        const rows =
            elements.rows.querySelectorAll("tr");


        let visible = 0;


        rows.forEach(row => {

            const show =
                filter === "all" ||
                row.dataset.bucket === filter;


            row.classList.toggle(
                "cu-hidden",
                !show
            );


            if (show) {
                visible += 1;
            }
        });


        if (elements.empty) {

            elements.empty.style.display =
                visible
                    ? "none"
                    : "block";
        }
    }


    function renderAll() {

        const visible =
            getVisibleRows();


        const summary =
            aggregate(visible);


        summary.shown = visible.length;

        summary.fetched = state.rows.length;


        renderHeader(summary);

        renderStats(summary);

        renderChart(summary.daily);

        renderRows(visible);
    }


    /* =========================================================
       ROW LIMIT FILTER (10 / 50 / 100)
    ========================================================== */

    function setRowLimit(limit) {

        const value = Number(limit);


        if (
            !Number.isFinite(value) ||
            !CONFIG.rowLimits.includes(value) ||
            value === state.rowLimit
        ) {
            return;
        }


        state.rowLimit = value;


        if (elements.limits) {

            const buttons =
                elements.limits.querySelectorAll(
                    ".cu-filter"
                );


            buttons.forEach(button => {

                button.classList.toggle(
                    "active",
                    Number(button.dataset.limit) === value
                );
            });
        }


        renderAll();
    }


    /* =========================================================
       REFRESH
    ========================================================== */

    async function refreshUsage(showErrors) {

        try {

            await loadUsage();

            renderAll();

            showMessage("", false);

        } catch (error) {

            console.error(
                "[credit] Refresh error:",
                error
            );

            if (showErrors !== false) {

                showMessage(
                    error.message ||
                    "Gagal memuat riwayat credit.",
                    true
                );
            }
        }
    }


    function setAutoRefresh(enabled) {

        if (!elements.autoToggle) {
            return;
        }


        if (enabled) {

            if (state.autoTimer) {
                return;
            }


            state.autoTimer =
                window.setInterval(
                    () => refreshUsage(false),
                    CONFIG.autoRefreshInterval
                );


            elements.autoToggle.textContent =
                "Auto 10s ON";

            elements.autoToggle.setAttribute(
                "aria-pressed",
                "true"
            );

            elements.autoToggle.title =
                "Auto refresh setiap 10 detik: aktif";

        } else {

            if (state.autoTimer) {

                window.clearInterval(
                    state.autoTimer
                );

                state.autoTimer = null;
            }


            elements.autoToggle.textContent =
                "Auto 10s OFF";

            elements.autoToggle.setAttribute(
                "aria-pressed",
                "false"
            );

            elements.autoToggle.title =
                "Auto refresh setiap 10 detik: mati";
        }
    }


    /* =========================================================
       EVENTS
    ========================================================== */

    function bindEvents() {

        if (elements.filters) {

            elements.filters.addEventListener(
                "click",

                event => {

                    const button =
                        event.target.closest(
                            ".cu-filter"
                        );

                    if (!button) {
                        return;
                    }

                    applyFilter(
                        button.dataset.filter
                    );
                }
            );
        }


        if (elements.limits) {

            elements.limits.addEventListener(
                "click",

                event => {

                    const button =
                        event.target.closest(
                            ".cu-filter[data-limit]"
                        );

                    if (!button) {
                        return;
                    }

                    setRowLimit(
                        button.dataset.limit
                    );
                }
            );
        }


        if (elements.refresh) {

            elements.refresh.addEventListener(
                "click",

                () => refreshUsage(true)
            );
        }


        if (elements.autoToggle) {

            elements.autoToggle.addEventListener(
                "click",

                () => {

                    setAutoRefresh(
                        !state.autoTimer
                    );
                }
            );
        }
    }


    /* =========================================================
       INIT
    ========================================================== */

    async function init() {

        if (state.initializing) {
            return;
        }

        state.initializing = true;


        try {

            await loadSession();

            await loadProfile();

            await loadUsage();

            renderAll();

            bindEvents();

            hideLoading();

        } catch (error) {

            console.error(
                "[credit] Init error:",
                error
            );


            if (
                error &&
                error.message === "Belum login."
            ) {
                return;
            }


            hideLoading();

            showMessage(
                error.message ||
                "Terjadi kesalahan saat memuat halaman credit.",
                true
            );
        } finally {

            state.initializing = false;
        }
    }


    document.addEventListener(
        "DOMContentLoaded",
        init
    );

})();
