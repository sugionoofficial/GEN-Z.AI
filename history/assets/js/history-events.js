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


    /* =====================================================
       ROOT NAMESPACE
    ===================================================== */

    window.GENZHistory =
        window.GENZHistory || {};

    const App =
        window.GENZHistory;


    /* =====================================================
       STATE
       -----------------------------------------------------
       Jangan mengganti state yang sudah dibuat oleh
       history-state.js.
    ===================================================== */

    App.state =
        App.state || {};

    if (
        typeof App.state.currentFilter !==
        "string"
    ) {

        App.state.currentFilter =
            "all";

    }

    if (
        !Object.prototype.hasOwnProperty.call(
            App.state,
            "currentModalHistoryId"
        )
    ) {

        App.state.currentModalHistoryId =
            null;

    }


    /* =====================================================
       ELEMENTS
       ===================================================== */

    App.elements =
        App.elements || {};


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

            return App[functionName](
                ...args
            );

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

        if (
            !elements.message
        ) {

            return;

        }


        elements.message.textContent =
            String(
                text || ""
            );


        elements.message.className =
            "message " +
            String(
                type || "error"
            );


        elements.message.style.display =
            "block";

    }


    function hideMessage() {

        const elements =
            getElements();

        if (
            !elements.message
        ) {

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

    function syncMenuState(
        expanded
    ) {

        const elements =
            getElements();

        if (
            !elements.menuButton
        ) {

            return;

        }


        elements.menuButton.setAttribute(
            "aria-expanded",
            expanded
                ? "true"
                : "false"
        );

    }


    function openSidebar() {

        const elements =
            getElements();


        if (
            elements.sidebar
        ) {

            elements.sidebar.classList.add(
                "open"
            );

        }


        /*
         * CSS History menggunakan
         * .overlay.active.
         */
        if (
            elements.overlay
        ) {

            elements.overlay.classList.add(
                "active"
            );

        }


        document.body.classList.add(
            "sidebar-open"
        );


        syncMenuState(
            true
        );

    }


    function closeSidebar() {

        const elements =
            getElements();


        if (
            elements.sidebar
        ) {

            elements.sidebar.classList.remove(
                "open"
            );

        }


        /*
         * CSS History menggunakan
         * .overlay.active.
         */
        if (
            elements.overlay
        ) {

            elements.overlay.classList.remove(
                "active"
            );

        }


        document.body.classList.remove(
            "sidebar-open"
        );


        syncMenuState(
            false
        );

    }


    function toggleSidebar() {

        const elements =
            getElements();


        if (
            !elements.sidebar
        ) {

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
     * Compatibility untuk inline onclick
     * yang masih terdapat pada HTML.
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

    function normalizeFilter(
        filter
    ) {

        const value =
            String(
                filter || "all"
            )
                .trim()
                .toLowerCase();


        const allowedFilters = [
            "all",
            "success",
            "processing",
            "failed",
            "pending"
        ];


        if (
            allowedFilters.includes(
                value
            )
        ) {

            return value;

        }


        return "all";

    }


    function updateFilterButtons(
        activeFilter
    ) {

        /*
         * HTML aktual menggunakan:
         *
         * data-filter="all"
         *
         * bukan:
         *
         * data-history-filter
         */
        const filterButtons =
            document.querySelectorAll(
                ".filter-button[data-filter]"
            );


        filterButtons.forEach(
            function (button) {

                const value =
                    normalizeFilter(
                        button.dataset.filter
                    );


                const active =
                    value ===
                    activeFilter;


                button.classList.toggle(
                    "active",
                    active
                );


                button.setAttribute(
                    "aria-selected",
                    active
                        ? "true"
                        : "false"
                );

            }
        );

    }


    function setFilter(
        filter
    ) {

        const normalized =
            normalizeFilter(
                filter
            );


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


        updateFilterButtons(
            normalized
        );


        /*
         * Render menggunakan data yang
         * sudah dimuat. Tidak melakukan
         * query Supabase tambahan.
         */
        safeCall(
            "renderHistory"
        );

    }


    App.setHistoryFilter =
        setFilter;


    /*
     * Compatibility tambahan.
     */
    App.setFilter =
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


            /*
             * Reload history dari Supabase.
             */
            if (
                typeof App.loadHistory ===
                "function"
            ) {

                await App.loadHistory({
                    silent: false
                });

            }


            /*
             * Setelah data dimuat ulang,
             * langsung sinkronkan generation
             * yang masih aktif dengan backend.
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
                "[GEN-Z.AI History] Manual refresh error:",
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

    function openDetail(
        id
    ) {

        const value =
            String(
                id || ""
            ).trim();


        if (!value) {

            return;

        }


        if (
            typeof App.openDetailModal ===
            "function"
        ) {

            App.openDetailModal(
                value
            );

        }

    }


    App.openDetail =
        openDetail;


    /* =====================================================
       VIDEO THUMBNAIL
    ===================================================== */

    function openVideo(
        url
    ) {

        const value =
            String(
                url || ""
            ).trim();


        if (!value) {

            return;

        }


        /*
         * Video tidak dipaksa masuk ke
         * detail modal karena modal saat ini
         * bekerja berdasarkan history ID.
         *
         * Fallback aman:
         * buka result URL di tab baru.
         */
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


        /* =================================================
           DETAIL BUTTON
        ================================================= */

        const detailButton =
            target.closest(
                "[data-action='detail']"
            );


        if (
            detailButton
        ) {

            event.preventDefault();
            event.stopPropagation();


            const id =
                detailButton.dataset
                    .historyId;


            openDetail(
                id
            );


            return;

        }


        /* =================================================
           VIDEO THUMBNAIL
        ================================================= */

        const thumbnail =
            target.closest(
                ".video-ready"
            );


        if (
            !thumbnail
        ) {

            return;

        }


        event.preventDefault();


        const video =
            thumbnail.querySelector(
                "video"
            );


        if (
            video
        ) {

            try {

                if (
                    video.paused
                ) {

                    const playPromise =
                        video.play();


                    if (
                        playPromise &&
                        typeof playPromise.catch ===
                        "function"
                    ) {

                        playPromise.catch(
                            function () {

                                /*
                                 * Autoplay/browser
                                 * restriction.
                                 * Fallback di bawah
                                 * tetap tersedia.
                                 */

                            }
                        );

                    }


                    thumbnail.classList.add(
                        "video-active"
                    );


                    return;

                }


                video.pause();


                thumbnail.classList.remove(
                    "video-active"
                );


                return;

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI History] Inline video playback failed:",
                    error
                );

            }

        }


        /*
         * Jika inline video tidak bisa
         * dimainkan, gunakan URL.
         */
        const url =
            thumbnail.dataset
                .videoUrl;


        openVideo(
            url
        );

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


        if (
            !thumbnail
        ) {

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
         * Hanya klik backdrop yang
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
            event.key !==
            "Escape"
        ) {

            return;

        }


        const elements =
            getElements();


        /*
         * Modal bisa menggunakan display:flex
         * atau class active, tergantung CSS.
         */
        if (
            elements.detailModal
        ) {

            const modalVisible =
                elements.detailModal.style.display ===
                    "flex" ||

                elements.detailModal.classList.contains(
                    "active"
                );


            if (
                modalVisible
            ) {

                safeCall(
                    "closeDetailModal"
                );


                return;

            }

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
             * Hentikan polling sebelum
             * session dihapus.
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


            if (
                error
            ) {

                console.error(
                    "[GEN-Z.AI History] Logout error:",
                    error
                );


                throw error;

            }


            window.location.href =
                "../login.html";


        } catch (error) {

            console.error(
                "[GEN-Z.AI History] Logout failed:",
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


        /*
         * Navigation HTML dibuat dinamis
         * oleh history-auth.js.
         *
         * Jangan bergantung pada
         * data-history-nav karena anchor
         * aktual tidak memiliki atribut tersebut.
         */
        const link =
            target.closest(
                "#navigation a"
            );


        if (
            !link
        ) {

            return;

        }


        /*
         * Biarkan browser melakukan
         * navigation normal.
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


        /*
         * HTML aktual:
         *
         * <button
         *     class="filter-button"
         *     data-filter="success"
         * >
         *
         * Jadi selector harus memakai
         * data-filter.
         */
        const button =
            target.closest(
                ".filter-button[data-filter]"
            );


        if (
            !button
        ) {

            return;

        }


        event.preventDefault();


        const filter =
            button.dataset.filter ||
            "all";


        setFilter(
            filter
        );

    }


    /* =====================================================
       EVENT BINDING
    ===================================================== */

    let eventsBound =
        false;


    function bindEvents() {

        if (
            eventsBound
        ) {

            return;

        }


        const elements =
            getElements();


        /* =================================================
           SIDEBAR
        ================================================= */

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


        /* =================================================
           NAVIGATION
        ================================================= */

        if (
            elements.navigation
        ) {

            elements.navigation.addEventListener(
                "click",
                handleNavigationClick
            );

        }


        /* =================================================
           LOGOUT
        ================================================= */

        if (
            elements.logoutButton
        ) {

            elements.logoutButton.addEventListener(
                "click",
                handleLogout
            );

        }


        /* =================================================
           REFRESH
        ================================================= */

        if (
            elements.refreshButton
        ) {

            elements.refreshButton.addEventListener(
                "click",
                handleRefresh
            );

        }


        /* =================================================
           HISTORY TABLE
        ================================================= */

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


        /* =================================================
           FILTERS
        ================================================= */

        document.addEventListener(
            "click",
            handleFilterClick
        );


        /* =================================================
           MODAL CLOSE BUTTON
        ================================================= */

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


        /* =================================================
           MODAL BACKDROP
        ================================================= */

        if (
            elements.detailModal
        ) {

            elements.detailModal.addEventListener(
                "click",
                handleModalClick
            );

        }


        /* =================================================
           GLOBAL KEYBOARD
        ================================================= */

        document.addEventListener(
            "keydown",
            handleDocumentKeydown
        );


        /* =================================================
           WINDOW RESIZE
        ================================================= */

        window.addEventListener(
            "resize",
            function () {

                if (
                    window.innerWidth >=
                    900
                ) {

                    closeSidebar();

                }

            }
        );


        /*
         * Sinkronkan filter pertama kali
         * setelah semua event siap.
         */
        updateFilterButtons(
            normalizeFilter(
                getState().currentFilter
            )
        );


        eventsBound =
            true;

    }


    App.bindHistoryEvents =
        bindEvents;


    /* =====================================================
       UNBIND
       -----------------------------------------------------
       Bootstrap normal menggunakan single-init.
       Fungsi tetap dipertahankan untuk compatibility.
    ===================================================== */

    function unbindEvents() {

        /*
         * Event listener tidak dilepas satu per satu
         * karena beberapa listener menggunakan
         * anonymous function.
         *
         * history-app.js mencegah bootstrap
         * berjalan dua kali.
         */
        eventsBound =
            false;

    }


    App.unbindHistoryEvents =
        unbindEvents;


})();
