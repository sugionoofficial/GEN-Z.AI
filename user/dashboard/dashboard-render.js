/* =========================================================
   GEN-Z.AI
   USER DASHBOARD RENDER MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-render.js

   Tanggung jawab:
   - Render category filter
   - Render video cards
   - Render statistics
   - Loading state
   - Empty state
   - Error state
   - Update result counter
   - Management buttons ADMIN / OWNER

   Tidak bertanggung jawab:
   - Auth
   - Query Supabase
   - Upload
   - CRUD
   - Modal lifecycle
========================================================= */

(function () {
    "use strict";

    window.GENZDashboard =
        window.GENZDashboard || {};

    const dashboard =
        window.GENZDashboard;


    /* =====================================================
       ELEMENTS
    ===================================================== */

    function getElements() {

        if (
            dashboard.elements &&
            dashboard.elements.videoGrid
        ) {
            return dashboard.elements;
        }

        dashboard.elements =
            dashboard.cacheElements();

        return dashboard.elements;
    }


    /* =====================================================
       HTML ESCAPE
       Semua data dari database wajib di-escape sebelum
       dimasukkan ke innerHTML.
    ===================================================== */

    function escapeHtml(value) {

        if (
            value === null ||
            typeof value === "undefined"
        ) {
            return "";
        }

        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* =====================================================
       TEXT HELPERS
    ===================================================== */

    function truncateText(
        value,
        maxLength
    ) {

        const text =
            typeof value === "string"
                ? value.trim()
                : "";

        if (
            !maxLength ||
            text.length <= maxLength
        ) {
            return text;
        }

        return (
            text.slice(
                0,
                maxLength - 1
            ) +
            "…"
        );
    }


    function normalizeCategory(value) {

        return typeof value === "string"
            ? value.trim()
            : "";
    }


    /* =====================================================
       VISIBILITY STATES
    ===================================================== */

    function showElement(element) {

        if (!element) {
            return;
        }

        element.hidden = false;
    }


    function hideElement(element) {

        if (!element) {
            return;
        }

        element.hidden = true;
    }


    function showLoading() {

        const elements =
            getElements();

        showElement(
            elements.videoLoading
        );

        hideElement(
            elements.videoEmpty
        );

        hideElement(
            elements.videoError
        );

        if (elements.videoGrid) {

            elements.videoGrid.innerHTML = "";
        }
    }


    function hideLoading() {

        const elements =
            getElements();

        hideElement(
            elements.videoLoading
        );
    }


    function showEmpty() {

        const elements =
            getElements();

        hideElement(
            elements.videoLoading
        );

        showElement(
            elements.videoEmpty
        );

        hideElement(
            elements.videoError
        );
    }


    function showError(error) {

        const elements =
            getElements();

        hideElement(
            elements.videoLoading
        );

        hideElement(
            elements.videoEmpty
        );

        showElement(
            elements.videoError
        );


        if (elements.videoGrid) {

            elements.videoGrid.innerHTML = "";
        }


        if (
            elements.videoErrorMessage
        ) {

            const message =
                error &&
                error.message
                    ? error.message
                    : "Terjadi kesalahan saat memuat video.";

            elements.videoErrorMessage.textContent =
                message;
        }
    }


    /* =====================================================
       CATEGORY FILTER
    ===================================================== */

    function renderCategoryFilters() {

        const elements =
            getElements();

        if (
            !elements.categoryFilters
        ) {
            return;
        }


        const categories =
            dashboard.config &&
            Array.isArray(
                dashboard.config.categories
            )
                ? dashboard.config.categories
                : [];


        const activeCategory =
            dashboard.getActiveCategory();


        elements.categoryFilters.innerHTML =
            categories.map(
                function (category) {

                    const active =
                        String(
                            category.value
                        ) ===
                        String(
                            activeCategory
                        );


                    return `
                        <button
                            type="button"
                            class="genz-filter-chip${active ? " active" : ""}"
                            data-category="${escapeHtml(category.value)}"
                            role="tab"
                            aria-selected="${active ? "true" : "false"}"
                        >
                            ${escapeHtml(category.label)}
                        </button>
                    `;

                }
            ).join("");
    }


    /* =====================================================
       FILTER ACTIVE STATE
    ===================================================== */

    function updateCategoryFilterState() {

        const elements =
            getElements();

        if (
            !elements.categoryFilters
        ) {
            return;
        }


        const activeCategory =
            dashboard.getActiveCategory();


        const buttons =
            elements.categoryFilters
                .querySelectorAll(
                    "[data-category]"
                );


        buttons.forEach(
            function (button) {

                const active =
                    String(
                        button.dataset.category
                    ) ===
                    String(
                        activeCategory
                    );


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


    /* =====================================================
       GET FILTERED VIDEOS
    ===================================================== */

    function getFilteredVideos() {

        const videos =
            dashboard.getVideos();


        const category =
            dashboard.getActiveCategory();


        if (
            typeof dashboard.filterVideos ===
            "function"
        ) {

            return dashboard.filterVideos(
                videos,
                category
            );
        }


        if (
            !category ||
            category === "all"
        ) {
            return videos.slice();
        }


        return videos.filter(
            function (video) {

                return String(
                    video.category || ""
                ).toUpperCase() ===
                    String(
                        category
                    ).toUpperCase();

            }
        );
    }


    /* =====================================================
       STATS
    ===================================================== */

    function renderStats() {

        const elements =
            getElements();

        const videos =
            dashboard.getVideos();


        const total =
            videos.length;


        const active =
            videos.filter(
                function (video) {

                    return video.is_active === true;

                }
            ).length;


        const categorySet =
            new Set();


        videos.forEach(
            function (video) {

                const category =
                    normalizeCategory(
                        video.category
                    );

                if (category) {
                    categorySet.add(
                        category.toUpperCase()
                    );
                }
            }
        );


        if (
            elements.totalVideoCount
        ) {

            elements.totalVideoCount.textContent =
                String(total);
        }


        if (
            elements.activeVideoCount
        ) {

            elements.activeVideoCount.textContent =
                String(active);
        }


        if (
            elements.categoryCount
        ) {

            elements.categoryCount.textContent =
                String(
                    categorySet.size
                );
        }
    }


    /* =====================================================
       RESULT LABEL
    ===================================================== */

    function renderResultLabel(
        count
    ) {

        const elements =
            getElements();


        if (
            !elements.videoResultLabel
        ) {
            return;
        }


        const number =
            Number.isFinite(
                Number(count)
            )
                ? Number(count)
                : 0;


        elements.videoResultLabel.textContent =
            number +
            (
                number === 1
                    ? " video"
                    : " video"
            );
    }


    /* =====================================================
       VIDEO CARD
    ===================================================== */

    function renderVideoCard(
        video
    ) {

        if (!video) {
            return "";
        }


        const id =
            escapeHtml(
                video.id
            );


        const title =
            escapeHtml(
                video.title || "Untitled Video"
            );


        const description =
            escapeHtml(
                truncateText(
                    video.description,
                    130
                )
            );


        const category =
            escapeHtml(
                video.category || "GENERAL"
            );


        const aspectRatio =
            escapeHtml(
                video.aspect_ratio || "16:9"
            );


        const thumbnail =
            escapeHtml(
                video.thumbnail_url || ""
            );


        const videoUrl =
            escapeHtml(
                video.video_url || ""
            );


        const active =
            video.is_active === true;


        const managementAccess =
            dashboard.isAdmin() &&
            dashboard.isEditMode();


        const thumbnailHtml =
            thumbnail
                ? `
                    <img
                        src="${thumbnail}"
                        alt="${title}"
                        class="genz-video-thumbnail"
                        loading="lazy"
                        decoding="async"
                    >
                `
                : `
                    <div
                        class="genz-video-thumbnail genz-video-thumbnail-placeholder"
                        aria-hidden="true"
                    >
                        <span>GEN-Z.AI</span>
                    </div>
                `;


        const managementHtml =
            managementAccess
                ? `
                    <div
                        class="genz-video-management"
                        data-management="${id}"
                    >

                        <button
                            type="button"
                            class="genz-video-action genz-video-edit"
                            data-action="edit"
                            data-video-id="${id}"
                            aria-label="Edit ${title}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="genz-video-action genz-video-delete"
                            data-action="delete"
                            data-video-id="${id}"
                            aria-label="Delete ${title}"
                        >
                            Hapus
                        </button>

                    </div>
                `
                : "";


        const statusHtml =
            managementAccess
                ? `
                    <span
                        class="genz-video-status ${active ? "is-active" : "is-inactive"}"
                    >
                        ${active ? "ACTIVE" : "INACTIVE"}
                    </span>
                `
                : "";


        return `
            <article
                class="genz-video-card${active ? "" : " is-inactive"}"
                data-video-id="${id}"
                data-category="${category}"
            >

                <div
                    class="genz-video-preview"
                    data-video-play="${id}"
                    role="button"
                    tabindex="0"
                    aria-label="Putar ${title}"
                >

                    ${thumbnailHtml}

                    <div
                        class="genz-video-overlay"
                        aria-hidden="true"
                    ></div>

                    <div
                        class="genz-video-play"
                        aria-hidden="true"
                    >
                        ▶
                    </div>

                    <div class="genz-video-meta">

                        <span class="genz-video-category">
                            ${category}
                        </span>

                        <span class="genz-video-ratio">
                            ${aspectRatio}
                        </span>

                    </div>

                </div>


                <div class="genz-video-content">

                    <div class="genz-video-title-row">

                        <h3>
                            ${title}
                        </h3>

                        ${statusHtml}

                    </div>


                    ${
                        description
                            ? `
                                <p>
                                    ${description}
                                </p>
                            `
                            : ""
                    }

                </div>


                ${managementHtml}

            </article>
        `;
    }


    /* =====================================================
       RENDER VIDEO GRID
    ===================================================== */

    function renderVideos(
        videos
    ) {

        const elements =
            getElements();


        if (
            !elements.videoGrid
        ) {
            return;
        }


        const source =
            Array.isArray(videos)
                ? videos
                : [];


        const sorted =
            typeof dashboard.sortVideos ===
            "function"
                ? dashboard.sortVideos(source)
                : source;


        renderResultLabel(
            sorted.length
        );


        if (
            sorted.length === 0
        ) {

            elements.videoGrid.innerHTML =
                "";

            showEmpty();

            return;
        }


        hideElement(
            elements.videoLoading
        );

        hideElement(
            elements.videoEmpty
        );

        hideElement(
            elements.videoError
        );


        elements.videoGrid.innerHTML =
            sorted
                .map(
                    renderVideoCard
                )
                .join("");
    }


    /* =====================================================
       RENDER ALL
    ===================================================== */

    function renderDashboard() {

        renderStats();

        renderCategoryFilters();

        renderVideos(
            getFilteredVideos()
        );

        updateCategoryFilterState();
    }


    /* =====================================================
       REFRESH VIDEO VIEW
    ===================================================== */

    function refreshVideoView() {

        renderStats();

        renderVideos(
            getFilteredVideos()
        );

        updateCategoryFilterState();
    }


    /* =====================================================
       VIDEO PLAY
    ===================================================== */

    function playVideo(videoId) {

        const video =
            dashboard.getVideoById(
                videoId
            );


        if (!video) {

            showToast(
                "Video tidak ditemukan.",
                "error"
            );

            return;
        }


        if (
            !video.video_url
        ) {

            showToast(
                "URL video tidak tersedia.",
                "error"
            );

            return;
        }


        /*
         * Video player menggunakan elemen dialog sederhana
         * yang dibuat secara runtime.
         *
         * Tidak mengubah data database.
         */

        openVideoViewer(
            video
        );
    }


    /* =====================================================
       VIDEO VIEWER
    ===================================================== */

    function openVideoViewer(
        video
    ) {

        closeVideoViewer();


        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "genz-video-viewer";


        overlay.setAttribute(
            "role",
            "dialog"
        );


        overlay.setAttribute(
            "aria-modal",
            "true"
        );


        overlay.innerHTML = `
            <div
                class="genz-video-viewer-backdrop"
                data-viewer-close="true"
            ></div>

            <div class="genz-video-viewer-dialog">

                <button
                    type="button"
                    class="genz-video-viewer-close"
                    data-viewer-close="true"
                    aria-label="Tutup video"
                >
                    ×
                </button>

                <video
                    class="genz-video-player"
                    controls
                    autoplay
                    playsinline
                    preload="metadata"
                    ${
                        video.thumbnail_url
                            ? `poster="${escapeHtml(video.thumbnail_url)}"`
                            : ""
                    }
                >
                    <source
                        src="${escapeHtml(video.video_url)}"
                    >
                    Browser Anda tidak mendukung video.
                </video>

                <div class="genz-video-viewer-info">

                    <h2>
                        ${escapeHtml(video.title)}
                    </h2>

                    ${
                        video.description
                            ? `
                                <p>
                                    ${escapeHtml(
                                        video.description
                                    )}
                                </p>
                            `
                            : ""
                    }

                </div>

            </div>
        `;


        document.body.appendChild(
            overlay
        );


        function closeFromViewer(
            event
        ) {

            if (
                event.target.closest(
                    "[data-viewer-close='true']"
                )
            ) {

                closeVideoViewer();
            }
        }


        overlay.addEventListener(
            "click",
            closeFromViewer
        );


        overlay.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    closeVideoViewer();
                }

            }
        );


        requestAnimationFrame(
            function () {

                overlay.classList.add(
                    "is-visible"
                );

                const player =
                    overlay.querySelector(
                        "video"
                    );

                if (player) {

                    player.focus({
                        preventScroll: true
                    });
                }
            }
        );


        document.body.classList.add(
            "genz-modal-open"
        );
    }


    function closeVideoViewer() {

        const existing =
            document.querySelector(
                ".genz-video-viewer"
            );


        if (!existing) {
            return;
        }


        const player =
            existing.querySelector(
                "video"
            );


        if (player) {

            try {
                player.pause();
            } catch (error) {
                console.warn(
                    "[GEN-Z.AI] Unable to pause video:",
                    error
                );
            }
        }


        existing.remove();


        document.body.classList.remove(
            "genz-modal-open"
        );
    }


    /* =====================================================
       TOAST FALLBACK
       dashboard-events / modal dapat memakai helper ini.
    ===================================================== */

    function showToast(
        message,
        type
    ) {

        const elements =
            getElements();


        if (
            !elements.dashboardToast ||
            !elements.dashboardToastMessage
        ) {

            console[
                type === "error"
                    ? "error"
                    : "log"
            ](
                message
            );

            return;
        }


        const toast =
            elements.dashboardToast;


        const messageElement =
            elements.dashboardToastMessage;


        messageElement.textContent =
            message || "";


        toast.dataset.type =
            type || "info";


        toast.hidden = false;


        if (
            dashboard.state &&
            dashboard.state.toastTimer
        ) {

            clearTimeout(
                dashboard.state.toastTimer
            );
        }


        dashboard.state.toastTimer =
            setTimeout(
                function () {

                    toast.hidden = true;

                },
                3500
            );
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    dashboard.escapeHtml =
        escapeHtml;

    dashboard.truncateText =
        truncateText;

    dashboard.showLoading =
        showLoading;

    dashboard.hideLoading =
        hideLoading;

    dashboard.showEmpty =
        showEmpty;

    dashboard.showError =
        showError;

    dashboard.renderCategoryFilters =
        renderCategoryFilters;

    dashboard.updateCategoryFilterState =
        updateCategoryFilterState;

    dashboard.getFilteredVideos =
        getFilteredVideos;

    dashboard.renderStats =
        renderStats;

    dashboard.renderResultLabel =
        renderResultLabel;

    dashboard.renderVideoCard =
        renderVideoCard;

    dashboard.renderVideos =
        renderVideos;

    dashboard.renderDashboard =
        renderDashboard;

    dashboard.refreshVideoView =
        refreshVideoView;

    dashboard.playVideo =
        playVideo;

    dashboard.openVideoViewer =
        openVideoViewer;

    dashboard.closeVideoViewer =
        closeVideoViewer;

    dashboard.showToast =
        showToast;


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.renderReady = true;

})();
