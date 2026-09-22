/* =========================================================
   GEN-Z.AI
   HISTORY EVENTS MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-events.js

   Tanggung jawab:
   - Sidebar mobile
   - Navigation
   - Filter
   - Refresh
   - Detail button
   - Thumbnail video
   - Modal close
   - Escape key
   - Logout
   - Redirect Generate
   - Event delegation

   Tidak bertanggung jawab:
   - Query Supabase
   - Authentication bootstrap
   - Polling backend
   - Render data utama
========================================================= */

(function () {
    "use strict";

    window.GENZHistory = window.GENZHistory || {};

    const App = window.GENZHistory;

    App.state = App.state || {
        currentFilter: "all",
        currentModalHistoryId: null
    };

    App.elements = App.elements || {};

    /* =====================================================
       HELPERS
    ===================================================== */

    function getElements() {
        return App.elements;
    }

    function getState() {
        return App.state;
    }

    function safeCall(
        functionName,
        ...args
    ) {

        if (
            typeof App[functionName] ===
            "function"
        ) {
            return App[functionName](...args);
        }

        return undefined;
    }

    /* =====================================================
       MESSAGE
    ===================================================== */

    function showMessage(
        text,
        type = "error"
    ) {

        const elements =
            getElements();

        if (!elements.message) {
            return;
        }

        elements.message.textContent =
            String(text || "");

        elements.message.className =
            "message " +
            String(type || "error");

        elements.message.style.display =
            "block";
    }

    function hideMessage() {

        const elements =
            getElements();

        if (!elements.message) {
            return;
        }

        elements.message.textContent =
            "";

        elements.message.style.display =
            "none";

        elements.message.className =
            "message";
    }

    App.showMessage =
        showMessage;

    App.hideMessage =
        hideMessage;

    /* =====================================================
       SIDEBAR
    ===================================================== */

    function openSidebar() {

        const elements =
            getElements();

        if (elements.sidebar) {
            elements.sidebar.classList.add(
                "open"
            );
        }

        if (elements.overlay) {
            elements.overlay.classList.add(
                "active"
            );
        }

        document.body.classList.add(
            "sidebar-open"
        );
    }

    function closeSidebar() {

        const elements =
            getElements();

        if (elements.sidebar) {
            elements.sidebar.classList.remove(
                "open"
            );
        }

        if (elements.overlay) {
            elements.overlay.classList.remove(
                "active"
            );
        }

        document.body.classList.remove(
            "sidebar-open"
        );
    }

    function toggleSidebar() {

        const elements =
            getElements();

        if (!elements.sidebar) {
            return;
        }

        if (
            elements.sidebar.classList.contains(
                "open"
            )
        ) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    App.openSidebar =
        openSidebar;

    App.closeSidebar =
        closeSidebar;

    App.toggleSidebar =
        toggleSidebar;

    /* =====================================================
       NAVIGATION
    ===================================================== */

    function goToGenerate() {

        window.location.href =
            "../generate/index.html";
    }

    function goToDashboard() {

        const profile =
            App.state?.currentProfile;

        const role =
            typeof App.normalizeRole ===
            "function"
                ? App.normalizeRole(
                    profile?.role
                )
                : String(
                    profile?.role || ""
                )
                    .trim()
                    .toUpperCase();

        if (
            role === "ADMIN" ||
            role === "OWNER"
        ) {

            window.location.href =
                "../admin/dashboard.html";

            return;
        }

        window.location.href =
            "../user/dashboard.html";
    }

    function goToTopup() {

        window.location.href =
            "../user/topup.html";
    }

    function goToHubAdmin() {

        window.location.href =
            "../user/hub-admin.html";
    }

    function goToAdminPanel() {

        window.location.href =
            "../admin-control/admin-panel.html";
    }

    App.goToGenerate =
        goToGenerate;

    App.goToDashboard =
        goToDashboard;

    App.goToTopup =
        goToTopup;

    App.goToHubAdmin =
        goToHubAdmin;

    App.goToAdminPanel =
        goToAdminPanel;

    /*
     * Compatibility untuk inline onclick lama.
     */
    window.goToGenerate =
        goToGenerate;

    window.goToDashboard =
        goToDashboard;

    window.goToTopup =
        goToTopup;

    window.goToHubAdmin =
        goToHubAdmin;

    window.goToAdminPanel =
        goToAdminPanel;

    /* =====================================================
       FILTER
    ===================================================== */

    function setFilter(filter) {

        const normalized =
            String(filter || "all")
                .trim()
                .toLowerCase();

        if (
            typeof App.setCurrentFilter ===
            "function"
        ) {

            App.setCurrentFilter(
                normalized
            );

        } else {

            getState().currentFilter =
                normalized;
        }

        /*
         * Update active button.
         */
        updateFilterButtons(
            normalized
        );

        /*
         * Render hanya menggunakan
         * data yang sudah ada.
         */
        safeCall(
            "renderHistory"
        );
    }

    function updateFilterButtons(
        activeFilter
    ) {

        const filterButtons =
            document.querySelectorAll(
                "[data-history-filter]"
            );

        filterButtons.forEach(button => {

            const value =
                String(
                    button.dataset
                        .historyFilter ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            button.classList.toggle(
                "active",
                value === activeFilter
            );

            button.setAttribute(
                "aria-selected",
                value === activeFilter
                    ? "true"
                    : "false"
            );
        });
    }

    App.setHistoryFilter =
        setFilter;

    /* =====================================================
       REFRESH
    ===================================================== */

    async function handleRefresh() {

        const elements =
            getElements();

        if (
            elements.refreshButton
        ) {

            if (
                elements.refreshButton
                    .dataset.refreshing ===
                "true"
            ) {
                return;
            }

            elements.refreshButton
                .dataset.refreshing =
                "true";

            elements.refreshButton
                .classList.add(
                    "is-refreshing"
                );

            elements.refreshButton
                .setAttribute(
                    "aria-busy",
                    "true"
                );
        }

        try {

            hideMessage();

            if (
                typeof App.loadHistory ===
                "function"
            ) {

                await App.loadHistory({
                    silent: false
                });
            }

            /*
             * Setelah manual refresh, langsung
             * sinkronkan task yang masih aktif.
             */
            if (
                typeof App.refreshActiveGenerationStatus ===
                "function"
            ) {

                await App.refreshActiveGenerationStatus();

            } else if (
                typeof App.startHistoryStatusMonitor ===
                "function"
            ) {

                await App.startHistoryStatusMonitor();
            }

        } catch (error) {

            console.error(
                "Manual history refresh error:",
                error
            );

            showMessage(
                error?.message ||
                "Gagal memperbarui history.",
                "error"
            );

        } finally {

            if (
                elements.refreshButton
            ) {

                elements.refreshButton
                    .dataset.refreshing =
                    "false";

                elements.refreshButton
                    .classList.remove(
                        "is-refreshing"
                    );

                elements.refreshButton
                    .setAttribute(
                        "aria-busy",
                        "false"
                    );
            }
        }
    }

    App.handleRefresh =
        handleRefresh;

    /* =====================================================
       DETAIL
    ===================================================== */

    function openDetail(id) {

        if (
            typeof App.openDetailModal ===
            "function"
        ) {

            App.openDetailModal(id);
        }
    }

    App.openDetail =
        openDetail;

    /* =====================================================
       VIDEO THUMBNAIL
    ===================================================== */

    function openVideo(url) {

        const value =
            String(url || "").trim();

        if (!value) {
            return;
        }

        /*
         * Gunakan modal video bila tersedia.
         * Jika tidak, buka tab baru.
         */
        const modal =
            getElements().detailModal;

        if (
            modal &&
            typeof App.openDetailModal ===
            "function"
        ) {

            /*
             * Detail modal mengambil data dari
             * history ID, sehingga untuk URL saja
             * fallback ke tab baru.
             */
        }

        window.open(
            value,
            "_blank",
            "noopener,noreferrer"
        );
    }

    App.openHistoryVideo =
        openVideo;

    /* =====================================================
       CLICK EVENT DELEGATION
    ===================================================== */

    function handleHistoryBodyClick(
        event
    ) {

        const target =
            event.target;

        if (!target) {
            return;
        }

        /*
         * DETAIL BUTTON
         */
        const detailButton =
            target.closest(
                "[data-action='detail']"
            );

        if (detailButton) {

            event.preventDefault();
            event.stopPropagation();

            const id =
                detailButton.dataset
                    .historyId;

            openDetail(id);

            return;
        }

        /*
         * VIDEO THUMBNAIL
         */
        const thumbnail =
            target.closest(
                ".video-ready"
            );

        if (thumbnail) {

            event.preventDefault();

            const video =
                thumbnail.querySelector(
                    "video"
                );

            if (video) {

                try {

                    /*
                     * Klik thumbnail:
                     * play/pause inline terlebih dahulu.
                     */
                    if (
                        video.paused
                    ) {

                        const result =
                            video.play();

                        if (
                            result &&
                            typeof result.catch ===
                            "function"
                        ) {
                            result.catch(
                                () => {}
                            );
                        }

                    } else {

                        video.pause();
                    }

                    thumbnail.classList.add(
                        "video-active"
                    );

                    return;

                } catch (error) {
                    console.warn(
                        "Inline video playback failed:",
                        error
                    );
                }
            }

            const url =
                thumbnail.dataset
                    .videoUrl;

            openVideo(url);

            return;
        }
    }

    /* =====================================================
       KEYBOARD VIDEO
    ===================================================== */

    function handleHistoryBodyKeydown(
        event
    ) {

        if (
            event.key !== "Enter" &&
            event.key !== " "
        ) {
            return;
        }

        const target =
            event.target;

        if (
            !target ||
            !target.closest
        ) {
            return;
        }

        const thumbnail =
            target.closest(
                ".video-ready"
            );

        if (!thumbnail) {
            return;
        }

        event.preventDefault();

        thumbnail.click();
    }

    /* =====================================================
       MODAL BACKDROP
    ===================================================== */

    function handleModalClick(
        event
    ) {

        const elements =
            getElements();

        if (
            !elements.detailModal
        ) {
            return;
        }

        /*
         * Hanya klik area backdrop yang
         * menutup modal.
         */
        if (
            event.target ===
            elements.detailModal
        ) {

            safeCall(
                "closeDetailModal"
            );
        }
    }

    /* =====================================================
       ESCAPE KEY
    ===================================================== */

    function handleDocumentKeydown(
        event
    ) {

        if (
            event.key !== "Escape"
        ) {
            return;
        }

        const elements =
            getElements();

        /*
         * Tutup modal terlebih dahulu.
         */
        if (
            elements.detailModal &&
            elements.detailModal.style.display ===
                "flex"
        ) {

            safeCall(
                "closeDetailModal"
            );

            return;
        }

        /*
         * Jika sidebar terbuka,
         * tutup sidebar.
         */
        if (
            elements.sidebar &&
            elements.sidebar.classList.contains(
                "open"
            )
        ) {

            closeSidebar();
        }
    }

    /* =====================================================
       LOGOUT
    ===================================================== */

    async function handleLogout() {

        const client =
            App.state?.supabaseClient;

        if (!client) {

            window.location.href =
                "../login.html";

            return;
        }

        const elements =
            getElements();

        if (
            elements.logoutButton
        ) {

            elements.logoutButton.disabled =
                true;

            elements.logoutButton
                .setAttribute(
                    "aria-busy",
                    "true"
                );
        }

        try {

            /*
             * Hentikan polling sebelum logout.
             */
            if (
                typeof App.stopHistoryAutoRefresh ===
                "function"
            ) {

                App.stopHistoryAutoRefresh();
            }

            const {
                error
            } =
                await client.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                throw error;
            }

            window.location.href =
                "../login.html";

        } catch (error) {

            console.error(
                "Logout failed:",
                error
            );

            showMessage(
                error?.message ||
                "Logout gagal.",
                "error"
            );

            if (
                elements.logoutButton
            ) {

                elements.logoutButton.disabled =
                    false;

                elements.logoutButton
                    .setAttribute(
                        "aria-busy",
                        "false"
                    );
            }
        }
    }

    App.handleLogout =
        handleLogout;

    /* =====================================================
       GENERIC NAVIGATION CLICK
    ===================================================== */

    function handleNavigationClick(
        event
    ) {

        const target =
            event.target;

        if (!target) {
            return;
        }

        const link =
            target.closest(
                "a[data-history-nav]"
            );

        if (!link) {
            return;
        }

        /*
         * Biarkan browser melakukan navigation
         * normal. Kita hanya menutup sidebar
         * mobile agar tidak tertinggal terbuka.
         */
        closeSidebar();
    }

    /* =====================================================
       FILTER CLICK
    ===================================================== */

    function handleFilterClick(
        event
    ) {

        const target =
            event.target;

        if (!target) {
            return;
        }

        const button =
            target.closest(
                "[data-filter]"
            );

        if (!button) {
            return;
        }

        event.preventDefault();

        const filter =
            button.dataset
                .Filter ||
            "all";

        setFilter(filter);
    }

    /* =====================================================
       EVENT BINDING
    ===================================================== */

    let eventsBound = false;

    function bindEvents() {

        if (eventsBound) {
            return;
        }

        const elements =
            getElements();

        /*
         * SIDEBAR
         */
        if (
            elements.menuButton
        ) {

            elements.menuButton.addEventListener(
                "click",
                toggleSidebar
            );
        }

        if (
            elements.overlay
        ) {

            elements.overlay.addEventListener(
                "click",
                closeSidebar
            );
        }

        /*
         * NAVIGATION
         */
        if (
            elements.navigation
        ) {

            elements.navigation.addEventListener(
                "click",
                handleNavigationClick
            );
        }

        /*
         * LOGOUT
         */
        if (
            elements.logoutButton
        ) {

            elements.logoutButton.addEventListener(
                "click",
                handleLogout
            );
        }

        /*
         * REFRESH
         */
        if (
            elements.refreshButton
        ) {

            elements.refreshButton.addEventListener(
                "click",
                handleRefresh
            );
        }

        /*
         * HISTORY TABLE
         */
        if (
            elements.historyBody
        ) {

            elements.historyBody.addEventListener(
                "click",
                handleHistoryBodyClick
            );

            elements.historyBody.addEventListener(
                "keydown",
                handleHistoryBodyKeydown
            );
        }

        /*
         * FILTERS
         */
        document.addEventListener(
            "click",
            handleFilterClick
        );

        /*
         * MODAL
         */
        if (
            elements.closeModal
        ) {

            elements.closeModal.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    safeCall(
                        "closeDetailModal"
                    );
                }
            );
        }

        if (
            elements.detailModal
        ) {

            elements.detailModal.addEventListener(
                "click",
                handleModalClick
            );
        }

        /*
         * GLOBAL KEYBOARD
         */
        document.addEventListener(
            "keydown",
            handleDocumentKeydown
        );

        /*
         * Window resize:
         * jika kembali ke desktop, sidebar
         * mobile dipastikan ditutup.
         */
        window.addEventListener(
            "resize",
            function () {

                if (
                    window.innerWidth >= 900
                ) {
                    closeSidebar();
                }
            }
        );

        eventsBound = true;
    }

    App.bindHistoryEvents =
        bindEvents;

    /* =====================================================
       UNBIND
       -----------------------------------------------------
       Tidak dipanggil saat bootstrap normal.
       Disediakan agar modul tidak membuat event
       duplicate jika aplikasi diinisialisasi ulang.
    ===================================================== */

    function unbindEvents() {

        /*
         * Event listener utama sengaja tidak
         * dilepas satu per satu karena sebagian
         * menggunakan anonymous function.
         *
         * Bootstrap dijaga single-init oleh
         * history-app.js sehingga duplicate
         * listener tidak terjadi.
         */
        eventsBound = false;
    }

    App.unbindHistoryEvents =
        unbindEvents;

})();
