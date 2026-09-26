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

            /*
             * Setiap load mendapat nomor request.
             *
             * Response lama tidak boleh menimpa
             * response yang lebih baru.
             */
            requestSequence: 0,

            /*
             * Digunakan ketika ada perubahan lokal
             * seperti Cancel Generate.
             *
             * Request yang sudah dimulai sebelum
             * perubahan lokal tidak boleh menimpa
             * state terbaru.
             */
            stateRevision: 0

        },


        /* =====================================================
           CONSTANTS
        ===================================================== */

        RUNNING_STATUSES: [
            "processing",
            "pending",
            "queued",
            "running",
            "generating",
            "in_progress",
            "in-progress"
        ],


        SUCCESS_STATUSES: [
            "completed",
            "complete",
            "success",
            "succeeded",
            "done"
        ],


        FAILED_STATUSES: [
            "failed",
            "failure",
            "error",
            "rejected"
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
                .replace(/\s+/g, "_");

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

            /*
             * Naikkan revision agar seluruh request
             * yang sedang berjalan menjadi stale.
             */

            this.state.stateRevision += 1;


            /*
             * Naikkan sequence juga supaya request
             * lama tidak pernah dianggap terbaru.
             */

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


            /*
             * Setiap load mendapatkan token unik.
             *
             * Jika ada refresh baru sebelum request
             * lama selesai, request lama tidak boleh
             * menulis state.
             */

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


                /*
                 * Pastikan session masih tersedia.
                 */

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


                /*
                 * Profiles dan history tidak
                 * saling bergantung.
                 *
                 * Ambil bersamaan.
                 */

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
                 * REQUEST SEQUENCE GUARD
                 *
                 * Jika selama request berlangsung
                 * ada Cancel Generate atau refresh
                 * baru, response ini dianggap stale.
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


                /*
                 * Hanya response terbaru yang
                 * boleh menulis state.
                 */

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

                /*
                 * Jangan menampilkan error dari request
                 * yang sudah tidak relevan.
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

                        /*
                         * Struktur utama biasanya
                         * user_id.
                         *
                         * Fallback tetap dipertahankan
                         * untuk kompatibilitas data lama.
                         */

                        const historyUserId =
                            item?.user_id ||
                            item?.profile_id ||
                            item?.owner_id;


                        return String(
                            historyUserId || ""
                        ) === String(
                            userId
                        );

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
                        this.isRunningStatus(
                            item?.status
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
                        this.isRunningStatus(
                            item?.status
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
                            Klik untuk melihat aktivitas
                        </span>

                        ${
                            account.latestActivity
                                ? `
                                    <span class="account-last-activity">
                                        ${this.escapeHTML(
                                            this.formatDate(
                                                account
                                                    .latestActivity
                                                    ?.created_at
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


            /*
             * Akun yang sedang generate
             * ditampilkan lebih dahulu.
             */

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


            /*
             * Event delegation.
             *
             * Listener hanya dipasang satu kali.
             */

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


                    /*
                     * Modal ditangani
                     * dashboard-modal.js.
                     */

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
             * Batalkan request lama yang masih
             * mungkin sedang berjalan.
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
                                item?.user_id ||
                                item?.profile_id ||
                                item?.owner_id;


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


            historyItem.status =
                "cancelled";


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
