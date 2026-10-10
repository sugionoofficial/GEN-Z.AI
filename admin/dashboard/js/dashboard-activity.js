/* =========================================================
   GEN-Z.AI DASHBOARD
   ACCOUNT ACTIVITY MODULE

   Tanggung jawab:
   - Load profiles
   - Load generation_history
   - Menentukan akun yang sedang aktif
   - Render Account Activity
   - Indikator aktif / running
   - Refresh otomatis
   - Menyimpan state aktivitas
   - Melindungi state dari race condition refresh
   - Menjaga status cancelled agar tidak kembali processing

   Tidak menangani:
   - Auth/session
   - Statistik global
   - Modal detail
   - Cancel Generate
   - System Information
========================================================= */

(function () {
    "use strict";


    const GENZDashboardActivity = {

        /* =====================================================
           STATE
        ===================================================== */

        state: {

            initialized: false,

            loading: false,

            refreshing: false,

            profiles: [],

            history: [],

            selectedUserId: null,

            refreshTimer: null,

            refreshInterval: 5000,

            lastLoadedAt: null,

            requestSequence: 0,

            stateRevision: 0

        },


        /* =====================================================
           CONSTANTS
        ===================================================== */

        RUNNING_STATUSES: [
            "processing",
            "pending",
            "queued",
            "queue",
            "running",
            "generating",
            "in_progress",
            "in-progress",
            "created",
            "submitted",
            "starting",
            "started",
            "waiting"
        ],


        SUCCESS_STATUSES: [
            "completed",
            "complete",
            "success",
            "succeeded",
            "successful",
            "done",
            "finished"
        ],


        FAILED_STATUSES: [
            "failed",
            "failure",
            "error",
            "rejected",
            "terminated"
        ],


        CANCELLED_STATUSES: [
            "cancelled",
            "canceled"
        ],


        /* =====================================================
           AUTH / SUPABASE
        ===================================================== */

        getAuth() {

            const auth =
                window.GENZDashboardAuth;


            if (!auth) {

                throw new Error(
                    "GENZDashboardAuth belum tersedia."
                );

            }


            return auth;

        },


        getClient() {

            return this
                .getAuth()
                .getSupabaseClient();

        },


        /* =====================================================
           NORMALIZATION
        ===================================================== */

        normalizeStatus(status) {

            return String(
                status || ""
            )
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_");

        },


        getHistoryStatus(item) {

            if (!item) {
                return "";
            }


            return (
                item.status ??
                item.state ??
                item.provider_state ??
                item.history_status ??
                ""
            );

        },


        isRunningStatus(status) {

            const normalized =
                this.normalizeStatus(
                    status
                );


            return this.RUNNING_STATUSES
                .includes(
                    normalized
                );

        },


        isSuccessStatus(status) {

            const normalized =
                this.normalizeStatus(
                    status
                );


            return this.SUCCESS_STATUSES
                .includes(
                    normalized
                );

        },


        isCancelledStatus(status) {

            const normalized =
                this.normalizeStatus(
                    status
                );


            return this.CANCELLED_STATUSES
                .includes(
                    normalized
                );

        },


        isFailedStatus(status) {

            const normalized =
                this.normalizeStatus(
                    status
                );


            return this.FAILED_STATUSES
                .includes(
                    normalized
                );

        },


        isHistoryRunning(item) {

            if (!item) {
                return false;
            }


            /*
             * Cancellation selalu memiliki prioritas.
             *
             * Jangan pernah menganggap row cancelled
             * sebagai processing walaupun ada field
             * provider_state lama yang masih running.
             */

            if (
                this.isCancelledStatus(
                    item.status
                ) ||
                this.isCancelledStatus(
                    item.history_status
                ) ||
                this.isCancelledStatus(
                    item.state
                )
            ) {

                return false;

            }


            /*
             * Status utama generation_history.
             */

            if (
                this.isRunningStatus(
                    item.status
                )
            ) {

                return true;

            }


            /*
             * Fallback untuk data provider lama.
             */

            if (
                !item.status &&
                this.isRunningStatus(
                    item.state
                )
            ) {

                return true;

            }


            if (
                !item.status &&
                !item.state &&
                this.isRunningStatus(
                    item.provider_state
                )
            ) {

                return true;

            }


            return false;

        },


        /* =====================================================
           REQUEST CONTROL
        ===================================================== */

        createRequestToken() {

            this.state.requestSequence += 1;


            return {

                sequence:
                    this.state.requestSequence,

                revision:
                    this.state.stateRevision

            };

        },


        isRequestCurrent(token) {

            if (!token) {
                return false;
            }


            return (
                token.sequence ===
                this.state.requestSequence
            ) && (
                token.revision ===
                this.state.stateRevision
            );

        },


        invalidatePendingRequests() {

            this.state.stateRevision += 1;

            this.state.requestSequence += 1;

        },


        markLocalStateChanged() {

            this.state.stateRevision += 1;

        },


        /* =====================================================
           HELPERS
        ===================================================== */

        escapeHTML(value) {

            if (
                value === null ||
                value === undefined
            ) {

                return "";

            }


            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

        },


        formatNumber(value) {

            return new Intl.NumberFormat(
                "id-ID"
            ).format(
                Number(value) || 0
            );

        },


        formatDate(value) {

            if (!value) {
                return "-";
            }


            const date =
                new Date(value);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return "-";

            }


            return date.toLocaleString(
                "id-ID",
                {
                    dateStyle: "medium",
                    timeStyle: "short"
                }
            );

        },


        getProfileName(profile) {

            return (
                profile?.name ||
                profile?.full_name ||
                profile?.display_name ||
                profile?.email ||
                "Unknown User"
            );

        },


        getProfileEmail(profile) {

            return (
                profile?.email ||
                "-"
            );

        },


        getHistoryUserId(item) {

            return (
                item?.user_id ||
                item?.profile_id ||
                item?.owner_id ||
                null
            );

        },


        getHistoryDate(item) {

            return (
                item?.created_at ||
                item?.updated_at ||
                item?.started_at ||
                item?.createdAt ||
                null
            );

        },


        /* =====================================================
           DIAGNOSTIC
        ===================================================== */

        setDiagnostic(message) {

            const element =
                document.getElementById(
                    "dashboardDiagnostic"
                );


            if (!element) {
                return;
            }


            element.textContent =
                message || "";

        },


        /* =====================================================
           LOAD PROFILES
        ===================================================== */

        async loadProfiles(client = null) {

            const supabase =
                client ||
                this.getClient();


            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "id,name,email,role,credits,status"
                    )
                    .order(
                        "email",
                        {
                            ascending: true
                        }
                    );


            if (error) {
                throw error;
            }


            return Array.isArray(data)
                ? data
                : [];

        },


        /* =====================================================
           LOAD GENERATION HISTORY
        ===================================================== */

        async loadHistory(client = null) {

            const supabase =
                client ||
                this.getClient();


            const {
                data,
                error
            } =
                await supabase
                    .from("generation_history")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );


            if (error) {
                throw error;
            }


            return Array.isArray(data)
                ? data
                : [];

        },


        /* =====================================================
           LOAD DATA
        ===================================================== */

        async load(options = {}) {

            const silent =
                options.silent === true;


            const requestToken =
                this.createRequestToken();


            if (
                this.state.loading &&
                !silent
            ) {

                return;

            }


            if (!silent) {

                this.state.loading =
                    true;

            }


            try {

                const auth =
                    this.getAuth();


                if (
                    !auth.state ||
                    !auth.state.initialized
                ) {

                    await auth.init();

                }


                if (
                    !auth.state ||
                    !auth.state.session
                ) {

                    throw new Error(
                        "Session admin tidak tersedia."
                    );

                }


                const client =
                    this.getClient();


                const [
                    profiles,
                    history
                ] =
                    await Promise.all([
                        this.loadProfiles(
                            client
                        ),
                        this.loadHistory(
                            client
                        )
                    ]);


                /*
                 * Jangan biarkan response lama
                 * menimpa state terbaru.
                 */

                if (
                    !this.isRequestCurrent(
                        requestToken
                    )
                ) {

                    return {

                        stale: true,

                        profiles:
                            this.state.profiles,

                        history:
                            this.state.history

                    };

                }


                this.state.profiles =
                    profiles;


                this.state.history =
                    history;


                this.state.lastLoadedAt =
                    new Date();


                this.state.initialized =
                    true;


                this.render();


                return {

                    profiles:
                        this.state.profiles,

                    history:
                        this.state.history,

                    stale: false

                };


            } catch (error) {

                if (
                    !this.isRequestCurrent(
                        requestToken
                    )
                ) {

                    return {

                        stale: true,

                        profiles:
                            this.state.profiles,

                        history:
                            this.state.history

                    };

                }


                console.error(
                    "[GENZ Dashboard Activity]",
                    error
                );


                this.setDiagnostic(
                    error?.message ||
                    "Gagal memuat aktivitas akun."
                );


                throw error;


            } finally {

                if (!silent) {

                    this.state.loading =
                        false;

                }

            }

        },


        /* =====================================================
           GET USER HISTORY
        ===================================================== */

        getUserHistory(userId) {

            if (!userId) {
                return [];
            }


            return this.state.history
                .filter(
                    item => {

                        const historyUserId =
                            this.getHistoryUserId(
                                item
                            );


                        return String(
                            historyUserId || ""
                        ) === String(
                            userId
                        );

                    }
                )
                .sort(
                    (a, b) => {

                        const aDate =
                            new Date(
                                this.getHistoryDate(
                                    a
                                ) || 0
                            ).getTime();


                        const bDate =
                            new Date(
                                this.getHistoryDate(
                                    b
                                ) || 0
                            ).getTime();


                        return bDate - aDate;

                    }
                );

        },


        /* =====================================================
           GET ACTIVE GENERATIONS
        ===================================================== */

        getUserActiveGenerations(userId) {

            return this
                .getUserHistory(
                    userId
                )
                .filter(
                    item =>
                        this.isHistoryRunning(
                            item
                        )
                );

        },


        /* =====================================================
           ACCOUNT ACTIVITY DATA
        ===================================================== */

        buildAccountData(profile) {

            const history =
                this.getUserHistory(
                    profile?.id
                );


            const activeGenerations =
                history.filter(
                    item =>
                        this.isHistoryRunning(
                            item
                        )
                );


            const latestActivity =
                history.length
                    ? history[0]
                    : null;


            return {

                profile,

                history,

                activeGenerations,

                latestActivity,

                isActive:
                    activeGenerations.length > 0

            };

        },


        /* =====================================================
           RENDER EMPTY STATE
        ===================================================== */

        renderEmptyState(container) {

            container.innerHTML = `
                <div class="activity-empty">

                    <div class="activity-empty-icon">
                        ◌
                    </div>

                    <div class="activity-empty-title">
                        Belum ada aktivitas akun
                    </div>

                    <div class="activity-empty-text">
                        Aktivitas generate akan muncul
                        di sini secara otomatis.
                    </div>

                </div>
            `;

        },


        /* =====================================================
           RENDER ACCOUNT CARD
        ===================================================== */

        renderAccountCard(account) {

            const profile =
                account.profile;


            const active =
                account.isActive;


            const historyCount =
                account.history.length;


            const activeCount =
                account.activeGenerations.length;


            const name =
                this.escapeHTML(
                    this.getProfileName(
                        profile
                    )
                );


            const email =
                this.escapeHTML(
                    this.getProfileEmail(
                        profile
                    )
                );


            const role =
                this.escapeHTML(
                    profile?.role ||
                    "USER"
                );


            const status =
                this.escapeHTML(
                    profile?.status ||
                    "unknown"
                );


            const credits =
                this.formatNumber(
                    profile?.credits || 0
                );


            const activeLabel =
                activeCount === 1
                    ? "1 Generate Aktif"
                    : `${this.formatNumber(activeCount)} Generate Aktif`;


            return `
                <article
                    class="
                        account-card
                        ${active ? "is-running" : ""}
                    "
                    data-user-id="${this.escapeHTML(
                        profile?.id
                    )}"
                    tabindex="0"
                    role="button"
                    aria-label="Aktivitas akun ${name}"
                >

                    <div class="account-card-top">

                        <div class="account-identity">

                            <div
                                class="
                                    account-light
                                    ${active ? "active" : ""}
                                "
                                aria-hidden="true"
                            ></div>

                            <div class="account-avatar">
                                ${this.escapeHTML(
                                    name
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>

                            <div class="account-info">

                                <div class="account-name">
                                    ${name}
                                </div>

                                <div class="account-email">
                                    ${email}
                                </div>

                            </div>

                        </div>


                        <div class="account-role">
                            ${role}
                        </div>

                    </div>


                    <div class="account-card-middle">

                        <div class="account-status-row">

                            <span class="account-status-label">
                                Status
                            </span>

                            <span
                                class="
                                    account-status
                                    ${active
                                        ? "running"
                                        : "idle"}
                                "
                            >
                                ${
                                    active
                                        ? "Generating"
                                        : status
                                }
                            </span>

                        </div>


                        ${
                            active
                                ? `
                                    <div class="account-running-info">
                                        <span
                                            class="account-running-dot"
                                            aria-hidden="true"
                                        ></span>

                                        <span>
                                            ${this.escapeHTML(
                                                activeLabel
                                            )}
                                        </span>
                                    </div>
                                  `
                                : ""
                        }


                        <div class="account-activity-summary">

                            <div class="activity-summary-item">

                                <span class="summary-label">
                                    Aktivitas
                                </span>

                                <strong>
                                    ${this.formatNumber(
                                        historyCount
                                    )}
                                </strong>

                            </div>


                            <div class="activity-summary-item">

                                <span class="summary-label">
                                    Berjalan
                                </span>

                                <strong>
                                    ${this.formatNumber(
                                        activeCount
                                    )}
                                </strong>

                            </div>


                            <div class="activity-summary-item">

                                <span class="summary-label">
                                    Credit
                                </span>

                                <strong>
                                    ${credits}
                                </strong>

                            </div>

                        </div>

                    </div>


                    <div class="account-card-bottom">

                        <span class="account-view-hint">
                            Klik untuk melihat semua aktivitas
                        </span>

                        ${
                            account.latestActivity
                                ? `
                                    <span class="account-last-activity">
                                        ${this.escapeHTML(
                                            this.formatDate(
                                                this.getHistoryDate(
                                                    account.latestActivity
                                                )
                                            )
                                        )}
                                    </span>
                                  `
                                : `
                                    <span class="account-last-activity">
                                        Belum ada aktivitas
                                    </span>
                                  `
                        }

                    </div>

                </article>
            `;

        },


        /* =====================================================
           RENDER ACCOUNT GRID
        ===================================================== */

        render() {

            const container =
                document.getElementById(
                    "accountActivityGrid"
                );


            if (!container) {
                return;
            }


            const loading =
                document.getElementById(
                    "accountActivityLoading"
                );


            if (loading) {

                loading.style.display =
                    "none";

            }


            const profiles =
                this.state.profiles;


            if (!profiles.length) {

                this.renderEmptyState(
                    container
                );


                this.updateLiveIndicator(
                    false
                );


                return;

            }


            const accounts =
                profiles.map(
                    profile =>
                        this.buildAccountData(
                            profile
                        )
                );


            accounts.sort(
                (a, b) => {

                    if (
                        a.isActive &&
                        !b.isActive
                    ) {

                        return -1;

                    }


                    if (
                        !a.isActive &&
                        b.isActive
                    ) {

                        return 1;

                    }


                    const aDate =
                        new Date(
                            this.getHistoryDate(
                                a.latestActivity
                            ) || 0
                        ).getTime();


                    const bDate =
                        new Date(
                            this.getHistoryDate(
                                b.latestActivity
                            ) || 0
                        ).getTime();


                    if (
                        aDate !== bDate
                    ) {

                        return bDate - aDate;

                    }


                    return String(
                        this.getProfileName(
                            a.profile
                        )
                    ).localeCompare(
                        String(
                            this.getProfileName(
                                b.profile
                            )
                        ),
                        "id"
                    );

                }
            );


            container.innerHTML =
                accounts
                    .map(
                        account =>
                            this.renderAccountCard(
                                account
                            )
                    )
                    .join("");


            this.updateLiveIndicator(
                accounts.some(
                    account =>
                        account.isActive
                )
            );


            this.bindCardEvents();

        },


        /* =====================================================
           LIVE INDICATOR
        ===================================================== */

        updateLiveIndicator(isLive) {

            const element =
                document.getElementById(
                    "accountActivityLive"
                );


            if (!element) {
                return;
            }


            if (isLive) {

                element.classList.add(
                    "is-live"
                );


                element.innerHTML = `
                    <span class="live-indicator-dot"></span>
                    LIVE
                `;

            } else {

                element.classList.remove(
                    "is-live"
                );


                element.innerHTML = `
                    <span class="live-indicator-dot"></span>
                    MONITORING
                `;

            }

        },


        /* =====================================================
           CARD EVENTS
        ===================================================== */

        bindCardEvents() {

            const container =
                document.getElementById(
                    "accountActivityGrid"
                );


            if (!container) {
                return;
            }


            if (
                container.dataset
                    .activityEventsBound === "true"
            ) {

                return;

            }


            container.dataset
                .activityEventsBound = "true";


            container.addEventListener(
                "click",
                event => {

                    const card =
                        event.target.closest(
                            ".account-card"
                        );


                    if (!card) {
                        return;
                    }


                    const userId =
                        card.dataset.userId;


                    if (!userId) {
                        return;
                    }


                    this.state.selectedUserId =
                        userId;


                    if (
                        window.GENZDashboardModal &&
                        typeof window
                            .GENZDashboardModal
                            .openForUser ===
                            "function"
                    ) {

                        window
                            .GENZDashboardModal
                            .openForUser(
                                userId,
                                this.state
                            );

                    }

                }
            );


            container.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key !== "Enter" &&
                        event.key !== " "
                    ) {

                        return;

                    }


                    const card =
                        event.target.closest(
                            ".account-card"
                        );


                    if (!card) {
                        return;
                    }


                    event.preventDefault();


                    const userId =
                        card.dataset.userId;


                    if (!userId) {
                        return;
                    }


                    this.state.selectedUserId =
                        userId;


                    if (
                        window.GENZDashboardModal &&
                        typeof window
                            .GENZDashboardModal
                            .openForUser ===
                            "function"
                    ) {

                        window
                            .GENZDashboardModal
                            .openForUser(
                                userId,
                                this.state
                            );

                    }

                }
            );

        },


        /* =====================================================
           REFRESH
        ===================================================== */

        async refresh() {

            if (
                this.state.refreshing
            ) {

                return;

            }


            this.state.refreshing =
                true;


            try {

                await this.load({
                    silent: true
                });


            } catch (error) {

                console.error(
                    "[GENZ Dashboard Activity Refresh]",
                    error
                );


            } finally {

                this.state.refreshing =
                    false;

            }

        },


        /* =====================================================
           START AUTO REFRESH
        ===================================================== */

        startAutoRefresh() {

            this.stopAutoRefresh();


            this.state.refreshTimer =
                window.setInterval(
                    () => {

                        this.refresh();

                    },
                    this.state.refreshInterval
                );

        },


        /* =====================================================
           STOP AUTO REFRESH
        ===================================================== */

        stopAutoRefresh() {

            if (
                this.state.refreshTimer
            ) {

                window.clearInterval(
                    this.state.refreshTimer
                );

                this.state.refreshTimer =
                    null;

            }

        },


        /* =====================================================
           MARK LOCAL CANCEL
        ===================================================== */

        markGenerationCancelled(
            generationId,
            userId
        ) {

            if (!generationId) {
                return false;
            }


            /*
             * Batalkan request lama yang masih berjalan.
             */

            this.invalidatePendingRequests();


            const historyItem =
                this.state.history
                    .find(
                        item => {

                            const itemId =
                                String(
                                    item?.id ||
                                    ""
                                );


                            const itemUserId =
                                this.getHistoryUserId(
                                    item
                                );


                            return (
                                itemId ===
                                String(
                                    generationId
                                )
                            ) && (
                                !userId ||
                                String(
                                    itemUserId || ""
                                ) ===
                                String(
                                    userId
                                )
                            );

                        }
                    );


            if (!historyItem) {

                return false;

            }


            /*
             * Cancellation adalah terminal state.
             *
             * Hapus kemungkinan state running
             * yang tersimpan di field lain.
             */

            historyItem.status =
                "cancelled";


            if (
                Object.prototype.hasOwnProperty.call(
                    historyItem,
                    "history_status"
                )
            ) {

                historyItem.history_status =
                    "cancelled";

            }


            if (
                Object.prototype.hasOwnProperty.call(
                    historyItem,
                    "state"
                )
            ) {

                historyItem.state =
                    "cancelled";

            }


            if (
                Object.prototype.hasOwnProperty.call(
                    historyItem,
                    "provider_state"
                )
            ) {

                historyItem.provider_state =
                    "cancelled";

            }


            if (
                Object.prototype.hasOwnProperty.call(
                    historyItem,
                    "history_reason"
                )
            ) {

                historyItem.history_reason =
                    "generation_cancelled";

            }


            this.markLocalStateChanged();


            this.render();


            return true;

        },


        /* =====================================================
           INIT
        ===================================================== */

        async init() {

            if (
                this.state.initialized
            ) {

                return this.state;

            }


            try {

                await this.load();


                this.startAutoRefresh();


                return this.state;


            } catch (error) {

                console.error(
                    "[GENZ Dashboard Activity Init]",
                    error
                );


                throw error;

            }

        },


        /* =====================================================
           DESTROY
        ===================================================== */

        destroy() {

            this.stopAutoRefresh();


            this.invalidatePendingRequests();


            this.state.initialized =
                false;


            this.state.loading =
                false;


            this.state.refreshing =
                false;


            this.state.profiles =
                [];


            this.state.history =
                [];


            this.state.selectedUserId =
                null;


            this.state.lastLoadedAt =
                null;

        }

    };


    /* =========================================================
       GLOBAL API
    ========================================================= */

    window.GENZDashboardActivity =
        GENZDashboardActivity;


})();
