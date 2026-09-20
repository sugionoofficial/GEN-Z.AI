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
   - Loading / empty / error state
   - Result counter
   - Management controls
   - Video viewer
   - Toast

   Tidak bertanggung jawab:
   - Auth
   - Query Supabase
   - Upload
   - CRUD
   - Modal lifecycle
   - Event binding
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       NAMESPACE
    ===================================================== */

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


        if (
            typeof dashboard.cacheElements !==
            "function"
        ) {

            return {};
        }


        dashboard.elements =
            dashboard.cacheElements();


        return dashboard.elements;
    }


    /* =====================================================
       HTML ESCAPE
    ===================================================== */

    function escapeHtml(
        value
    ) {

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
                Math.max(
                    1,
                    maxLength - 1
                )
            ) +
            "…"
        );
    }


    function normalizeCategory(
        value
    ) {

        return typeof value === "string"
            ? value.trim()
            : "";
    }


    /* =====================================================
       MANAGEMENT ACCESS
    ===================================================== */

    function hasManagementAccess() {

        if (
            typeof dashboard.hasManagementAccess ===
            "function"
        ) {

            return (
                dashboard.hasManagementAccess()
            );
        }


        if (
            typeof dashboard.isAdmin ===
            "function"
        ) {

            return (
                dashboard.isAdmin()
            );
        }


        return false;
    }


    function isEditMode() {

        if (
            typeof dashboard.isEditMode ===
            "function"
        ) {

            return (
                dashboard.isEditMode()
            );
        }


        return false;
    }


    function canManageVideos() {

        return (
            hasManagementAccess() &&
            isEditMode()
        );
    }


    /* =====================================================
       VISIBILITY
    ===================================================== */

    function showElement(
        element
    ) {

        if (!element) {

            return;
        }


        element.hidden =
            false;
    }


    function hideElement(
        element
    ) {

        if (!element) {

            return;
        }


        element.hidden =
            true;
    }


    /* =====================================================
       LOADING
    ===================================================== */

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


        if (
            elements.videoGrid
        ) {

            elements.videoGrid.innerHTML =
                "";
        }


        if (
            elements.videoResultLabel
        ) {

            elements.videoResultLabel.textContent =
                "";
        }
    }


    function hideLoading() {

        const elements =
            getElements();


        hideElement(
            elements.videoLoading
        );
    }


    /* =====================================================
       EMPTY
    ===================================================== */

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


    /* =====================================================
       ERROR
    ===================================================== */

    function showError(
        error
    ) {

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


        if (
            elements.videoGrid
        ) {

            elements.videoGrid.innerHTML =
                "";
        }


        if (
            elements.videoErrorMessage
        ) {

            let message =
                "Terjadi kesalahan saat memuat video.";


            if (
                error &&
                error.message
            ) {

                message =
                    error.message;
            }


            elements.videoErrorMessage.textContent =
                message;
        }
    }


    /* =====================================================
       CATEGORY FILTERS
    ===================================================== */

    function getCategories() {

        if (
            dashboard.config &&
            Array.isArray(
                dashboard.config.categories
            )
        ) {

            return dashboard.config.categories;
        }


        return [];
    }


    function renderCategoryFilters() {

        const elements =
            getElements();


        if (
            !elements.categoryFilters
        ) {

            return;
        }


        const categories =
            getCategories();


        const activeCategory =
            typeof dashboard.getActiveCategory ===
            "function"
                ? dashboard.getActiveCategory()
                : "all";


        elements.categoryFilters.innerHTML =
            categories
                .map(
                    function (category) {

                        const value =
                            category &&
                            typeof category.value !==
                            "undefined"
                                ? category.value
                                : "";


                        const label =
                            category &&
                            typeof category.label !==
                            "undefined"
                                ? category.label
                                : value;


                        const active =
                            String(value) ===
                            String(activeCategory);


                        return `
                            <button
                                type="button"
                                class="genz-filter-chip${active ? " active" : ""}"
                                data-category="${escapeHtml(value)}"
                                role="tab"
                                aria-selected="${active ? "true" : "false"}"
                            >
                                ${escapeHtml(label)}
                            </button>
                        `;

                    }
                )
                .join("");
    }


    function updateCategoryFilterState() {

        const elements =
            getElements();


        if (
            !elements.categoryFilters
        ) {

            return;
        }


        const activeCategory =
            typeof dashboard.getActiveCategory ===
            "function"
                ? dashboard.getActiveCategory()
                : "all";


        const buttons =
            elements.categoryFilters.querySelectorAll(
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
       FILTERED VIDEOS
    ===================================================== */

    function getFilteredVideos() {

        const videos =
            typeof dashboard.getVideos ===
            "function"
                ? dashboard.getVideos()
                : [];


        const category =
            typeof dashboard.getActiveCategory ===
            "function"
                ? dashboard.getActiveCategory()
                : "all";


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
            String(
                category
            ).toLowerCase() === "all"
        ) {

            return videos.slice();
        }


        const target =
            String(
                category
            )
                .trim()
                .toUpperCase();


        return videos.filter(
            function (video) {

                return (
                    String(
                        video &&
                        video.category
                            ? video.category
                            : ""
                    )
                        .trim()
                        .toUpperCase() ===
                    target
                );
            }
        );
    }


    /* =====================================================
       STATISTICS
    ===================================================== */

    function renderStats() {

        const elements =
            getElements();


        const videos =
            typeof dashboard.getVideos ===
            "function"
                ? dashboard.getVideos()
                : [];


        const total =
            videos.length;


        const active =
            videos.filter(
                function (video) {

                    return (
                        video &&
                        video.is_active === true
                    );
                }
            ).length;


        const categorySet =
            new Set();


        videos.forEach(
            function (video) {

                const category =
                    normalizeCategory(
                        video &&
                        video.category
                    );


                if (
                    category
                ) {

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
       THUMBNAIL
    ===================================================== */

    function renderThumbnail(
        video
    ) {

        const title =
            escapeHtml(
                video.title ||
                "Untitled Video"
            );


        const thumbnail =
            typeof video.thumbnail_url ===
            "string"
                ? video.thumbnail_url.trim()
                : "";


        if (
            !thumbnail
        ) {

            return `
                <div
                    class="genz-video-thumbnail genz-video-thumbnail-placeholder"
                    aria-hidden="true"
                >
                    <span>GEN-Z.AI</span>
                </div>
            `;
        }


        return `
            <img
                src="${escapeHtml(thumbnail)}"
                alt="${title}"
                class="genz-video-thumbnail"
                loading="lazy"
                decoding="async"
            >
        `;
    }


    /* =====================================================
       MANAGEMENT CONTROLS
    ===================================================== */

    function renderManagementControls(
        video
    ) {

        if (
            !canManageVideos()
        ) {

            return "";
        }


        const id =
            escapeHtml(
                video.id
            );


        const title =
            escapeHtml(
                video.title ||
                "video"
            );


        const active =
            video.is_active === true;


        return `
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
                    aria-label="Hapus ${title}"
                >
                    Hapus
                </button>

            </div>
        `;
    }


    /* =====================================================
       STATUS
    ===================================================== */

    function renderStatus(
        video
    ) {

        if (
            !canManageVideos()
        ) {

            return "";
        }


        const active =
            video.is_active === true;


        return `
            <span
                class="genz-video-status ${active ? "is-active" : "is-inactive"}"
            >
                ${active ? "ACTIVE" : "INACTIVE"}
            </span>
        `;
    }


    /* =====================================================
       VIDEO CARD
    ===================================================== */

    function renderVideoCard(
        video
    ) {

        if (
            !video
        ) {

            return "";
        }


        const id =
            escapeHtml(
                video.id
            );


        const title =
            escapeHtml(
                video.title ||
                "Untitled Video"
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
                video.category ||
                "GENERAL"
            );


        const aspectRatio =
            escapeHtml(
                video.aspect_ratio ||
                "16:9"
            );


        const active =
            video.is_active === true;


        const videoUrl =
            typeof video.video_url ===
            "string"
                ? video.video_url.trim()
                : "";


        const management =
            renderManagementControls(
                video
            );


        const status =
            renderStatus(
                video
            );


        /*
         * Jika video URL tidak tersedia, card tetap tampil,
         * tetapi tombol play tidak akan melakukan apa-apa
         * selain memberikan toast.
         */

        const playable =
            !!videoUrl;


        return `
            <article
                class="genz-video-card${active ? "" : " is-inactive"}"
                data-video-id="${id}"
                data-category="${category}"
            >

                <div
                    class="genz-video-preview${playable ? "" : " is-unavailable"}"
                    data-video-play="${id}"
                    role="button"
                    tabindex="0"
                    aria-label="${
                        playable
                            ? `Putar ${title}`
                            : `Video ${title} tidak tersedia`
                    }"
                >

                    ${renderThumbnail(video)}

                    <div
                        class="genz-video-overlay"
                        aria-hidden="true"
                    ></div>

                    ${
                        playable
                            ? `
                                <div
                                    class="genz-video-play"
                                    aria-hidden="true"
                                >
                                    ▶
                                </div>
                            `
                            : `
                                <div
                                    class="genz-video-play is-disabled"
                                    aria-hidden="true"
                                >
                                    !
                                </div>
                            `
                    }

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

                        ${status}

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


                ${management}

            </article>
        `;
    }


    /* =====================================================
       RENDER VIDEOS
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
                ? dashboard.sortVideos(
                    source
                )
                : source.slice();


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
       FULL DASHBOARD
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

    function playVideo(
        videoId
    ) {

        const video =
            typeof dashboard.getVideoById ===
            "function"
                ? dashboard.getVideoById(
                    videoId
                )
                : null;


        if (
            !video
        ) {

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

        if (
            !video ||
            !video.video_url
        ) {

            return;
        }


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


        const title =
            escapeHtml(
                video.title ||
                "Video"
            );


        const description =
            escapeHtml(
                video.description ||
                ""
            );


        const poster =
            video.thumbnail_url
                ? `
                    poster="${escapeHtml(
                        video.thumbnail_url
                    )}"
                `
                : "";


        overlay.innerHTML = `
            <div
                class="genz-video-viewer-backdrop"
                data-viewer-close="true"
            ></div>

            <div
                class="genz-video-viewer-dialog"
                role="document"
            >

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
                    ${poster}
                >
                    <source
                        src="${escapeHtml(
                            video.video_url
                        )}"
                    >

                    Browser Anda tidak mendukung video.
                </video>

                <div class="genz-video-viewer-info">

                    <h2>
                        ${title}
                    </h2>

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

            </div>
        `;


        document.body.appendChild(
            overlay
        );


        const closeTargets =
            overlay.querySelectorAll(
                "[data-viewer-close='true']"
            );


        closeTargets.forEach(
            function (element) {

                element.addEventListener(
                    "click",
                    closeVideoViewer
                );
            }
        );


        overlay.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    event.preventDefault();

                    closeVideoViewer();
                }
            }
        );


        requestAnimationFrame(
            function () {

                overlay.classList.add(
                    "is-visible"
                );


                const closeButton =
                    overlay.querySelector(
                        ".genz-video-viewer-close"
                    );


                if (
                    closeButton
                ) {

                    closeButton.focus({
                        preventScroll: true
                    });
                }


                const player =
                    overlay.querySelector(
                        "video"
                    );


                if (
                    player
                ) {

                    const playPromise =
                        player.play();


                    if (
                        playPromise &&
                        typeof playPromise.catch ===
                        "function"
                    ) {

                        playPromise.catch(
                            function () {

                                /*
                                 * Browser dapat menolak autoplay.
                                 * Controls tetap tersedia.
                                 */
                            }
                        );
                    }
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


        if (
            !existing
        ) {

            return;
        }


        const player =
            existing.querySelector(
                "video"
            );


        if (
            player
        ) {

            try {

                player.pause();

                player.removeAttribute(
                    "src"
                );

                player.load();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Video cleanup failed:",
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
       GLOBAL VIEWER ESCAPE
    ===================================================== */

    function handleViewerEscape(
        event
    ) {

        if (
            event.key !== "Escape"
        ) {

            return;
        }


        const viewer =
            document.querySelector(
                ".genz-video-viewer"
            );


        if (
            viewer
        ) {

            closeVideoViewer();
        }
    }


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(
        message,
        type
    ) {

        const elements =
            getElements();


        const text =
            typeof message === "string"
                ? message
                : "";


        if (
            !elements.dashboardToast ||
            !elements.dashboardToastMessage
        ) {

            if (
                type === "error"
            ) {

                console.error(
                    text
                );

            } else {

                console.log(
                    text
                );
            }


            return;
        }


        const toast =
            elements.dashboardToast;


        const messageElement =
            elements.dashboardToastMessage;


        messageElement.textContent =
            text;


        toast.dataset.type =
            type || "info";


        toast.hidden =
            false;


        if (
            dashboard.state &&
            dashboard.state.toastTimer
        ) {

            clearTimeout(
                dashboard.state.toastTimer
            );
        }


        const timer =
            setTimeout(
                function () {

                    toast.hidden =
                        true;

                },
                3500
            );


        if (
            dashboard.state
        ) {

            dashboard.state.toastTimer =
                timer;
        }
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


    dashboard.handleViewerEscape =
        handleViewerEscape;


    dashboard.showToast =
        showToast;


    /* =====================================================
       GLOBAL ESCAPE LISTENER
    ===================================================== */

    if (
        !dashboard.renderEscapeBound
    ) {

        document.addEventListener(
            "keydown",
            handleViewerEscape
        );


        dashboard.renderEscapeBound =
            true;
    }


    /* =====================================================
       READY
    ===================================================== */

    dashboard.renderReady =
        true;

})();
