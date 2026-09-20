/* =========================================================
   GEN-Z.AI
   USER DASHBOARD EVENTS MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-events.js

   Tanggung jawab:
   - Event tombol Add
   - Event Edit
   - Event Delete
   - Event filter kategori
   - Event retry
   - Event submit form
   - Event navigasi
   - Delegasi ke module lain

   Tidak bertanggung jawab:
   - Query Supabase
   - CRUD database
   - Upload Storage
   - Render HTML utama
   - Auth
   - Navigation implementation
   - Modal lifecycle implementation
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
       INTERNAL STATE
    ===================================================== */

    let initialized = false;


    /* =====================================================
       ELEMENTS
    ===================================================== */

    function getElements() {

        if (
            dashboard.elements &&
            dashboard.elements.dashboardRoot
        ) {
            return dashboard.elements;
        }

        if (
            typeof dashboard.cacheElements ===
            "function"
        ) {

            dashboard.elements =
                dashboard.cacheElements();

            return dashboard.elements;
        }

        return {};
    }


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(
        message,
        type
    ) {

        if (
            typeof dashboard.showToast ===
            "function"
        ) {

            dashboard.showToast(
                message,
                type || "info"
            );

            return;
        }

        if (
            type === "error"
        ) {

            console.error(
                "[GEN-Z.AI Dashboard]",
                message
            );

            return;
        }

        console.log(
            "[GEN-Z.AI Dashboard]",
            message
        );
    }


    /* =====================================================
       ERROR MESSAGE
    ===================================================== */

    function getErrorMessage(error) {

        if (!error) {
            return "Terjadi kesalahan.";
        }

        if (
            typeof error ===
            "string"
        ) {

            return error;
        }

        if (
            error.message &&
            typeof error.message ===
            "string"
        ) {

            return error.message;
        }

        return "Terjadi kesalahan pada dashboard.";
    }


    /* =====================================================
       ADD VIDEO
    ===================================================== */

    function handleAddVideo() {

        /*
         * USER biasa tidak boleh membuka form management.
         */

        if (
            typeof dashboard.isAdmin ===
            "function" &&
            !dashboard.isAdmin()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk menambah video.",
                "error"
            );

            return;
        }


        if (
            typeof dashboard.isEditMode ===
            "function" &&
            !dashboard.isEditMode()
        ) {

            showToast(
                "Mode manajemen video tidak aktif.",
                "error"
            );

            return;
        }


        if (
            typeof dashboard.openAddModal !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI] openAddModal() tidak tersedia."
            );

            return;
        }


        dashboard.openAddModal();
    }


    /* =====================================================
       EDIT VIDEO
    ===================================================== */

    function handleEditVideo(
        videoId
    ) {

        if (!videoId) {
            return;
        }


        if (
            typeof dashboard.isAdmin ===
            "function" &&
            !dashboard.isAdmin()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk mengedit video.",
                "error"
            );

            return;
        }


        if (
            typeof dashboard.isEditMode ===
            "function" &&
            !dashboard.isEditMode()
        ) {

            showToast(
                "Mode manajemen video tidak aktif.",
                "error"
            );

            return;
        }


        if (
            typeof dashboard.openEditModal !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI] openEditModal() tidak tersedia."
            );

            return;
        }


        dashboard.openEditModal(
            videoId
        );
    }


    /* =====================================================
       DELETE VIDEO
    ===================================================== */

    async function handleDeleteVideo(
        videoId
    ) {

        if (!videoId) {
            return;
        }


        if (
            typeof dashboard.isAdmin ===
            "function" &&
            !dashboard.isAdmin()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk menghapus video.",
                "error"
            );

            return;
        }


        if (
            typeof dashboard.isEditMode ===
            "function" &&
            !dashboard.isEditMode()
        ) {

            showToast(
                "Mode manajemen video tidak aktif.",
                "error"
            );

            return;
        }


        const video =
            typeof dashboard.getVideoById ===
            "function"
                ? dashboard.getVideoById(
                    videoId
                )
                : null;


        const title =
            video &&
            video.title
                ? video.title
                : "video ini";


        /*
         * Konfirmasi native.
         *
         * Sengaja tidak membuat modal konfirmasi kedua.
         * Dashboard sudah memiliki modal management sendiri.
         */

        const confirmed =
            window.confirm(
                'Hapus "' +
                title +
                '"?\n\n' +
                "Video dan file terkait akan dihapus."
            );


        if (!confirmed) {
            return;
        }


        try {

            if (
                typeof dashboard.setDeleting ===
                "function"
            ) {

                dashboard.setDeleting(
                    true
                );
            }


            if (
                typeof dashboard.deleteVideo !==
                "function"
            ) {

                throw new Error(
                    "Module data video belum tersedia."
                );
            }


            await dashboard.deleteVideo(
                videoId
            );


            /*
             * Pastikan tampilan mengikuti database.
             */

            if (
                typeof dashboard.loadVideos ===
                "function"
            ) {

                await dashboard.loadVideos({
                    includeInactive:
                        typeof dashboard.isEditMode ===
                        "function" &&
                        dashboard.isEditMode()
                });
            }


            if (
                typeof dashboard.refreshVideoView ===
                "function"
            ) {

                dashboard.refreshVideoView();

            } else if (
                typeof dashboard.renderDashboard ===
                "function"
            ) {

                dashboard.renderDashboard();
            }


            showToast(
                "Video berhasil dihapus.",
                "success"
            );


        } catch (error) {

            console.error(
                "[GEN-Z.AI Dashboard] Delete error:",
                error
            );


            if (
                typeof dashboard.setError ===
                "function"
            ) {

                dashboard.setError(
                    error
                );
            }


            showToast(
                getErrorMessage(
                    error
                ),
                "error"
            );


        } finally {

            if (
                typeof dashboard.setDeleting ===
                "function"
            ) {

                dashboard.setDeleting(
                    false
                );
            }
        }
    }


    /* =====================================================
       CATEGORY FILTER
    ===================================================== */

    function handleCategoryFilter(
        category
    ) {

        const normalized =
            typeof category ===
            "string"
                ? category.trim()
                : "all";


        if (
            typeof dashboard.setActiveCategory ===
            "function"
        ) {

            dashboard.setActiveCategory(
                normalized || "all"
            );
        }


        if (
            typeof dashboard.refreshVideoView ===
            "function"
        ) {

            dashboard.refreshVideoView();

        } else if (
            typeof dashboard.renderDashboard ===
            "function"
        ) {

            dashboard.renderDashboard();
        }
    }


    /* =====================================================
       FILTER CLICK DELEGATION
    ===================================================== */

    function handleFilterContainerClick(
        event
    ) {

        const target =
            event.target;


        if (!target) {
            return;
        }


        const button =
            target.closest(
                "[data-category]"
            );


        if (!button) {
            return;
        }


        /*
         * Pastikan button memang berada di
         * area category filter.
         */

        const filterContainer =
            button.closest(
                "[data-dashboard-category-filter]"
            );


        if (!filterContainer) {
            return;
        }


        event.preventDefault();


        const category =
            button.getAttribute(
                "data-category"
            ) ||
            "all";


        /*
         * Active class.
         *
         * Render module juga akan melakukan sinkronisasi
         * saat refresh, tetapi update langsung membuat UI
         * terasa responsif.
         */

        filterContainer
            .querySelectorAll(
                "[data-category]"
            )
            .forEach(
                function (item) {

                    item.classList.toggle(
                        "active",
                        item === button
                    );

                    item.setAttribute(
                        "aria-pressed",
                        item === button
                            ? "true"
                            : "false"
                    );
                }
            );


        handleCategoryFilter(
            category
        );
    }


    /* =====================================================
       VIDEO GRID DELEGATION
    ===================================================== */

    function handleVideoGridClick(
        event
    ) {

        const target =
            event.target;


        if (!target) {
            return;
        }


        /*
         * PLAY
         */

        const playButton =
            target.closest(
                "[data-action='play-video']"
            );


        if (playButton) {

            event.preventDefault();
            event.stopPropagation();


            const videoId =
                playButton.getAttribute(
                    "data-video-id"
                );


            if (
                videoId &&
                typeof dashboard.openVideoViewer ===
                "function"
            ) {

                dashboard.openVideoViewer(
                    videoId
                );
            }


            return;
        }


        /*
         * EDIT
         */

        const editButton =
            target.closest(
                "[data-action='edit-video']"
            );


        if (editButton) {

            event.preventDefault();
            event.stopPropagation();


            const videoId =
                editButton.getAttribute(
                    "data-video-id"
                );


            handleEditVideo(
                videoId
            );


            return;
        }


        /*
         * DELETE
         */

        const deleteButton =
            target.closest(
                "[data-action='delete-video']"
            );


        if (deleteButton) {

            event.preventDefault();
            event.stopPropagation();


            const videoId =
                deleteButton.getAttribute(
                    "data-video-id"
                );


            handleDeleteVideo(
                videoId
            );


            return;
        }


        /*
         * CARD PLAY FALLBACK
         *
         * Jika card sendiri mempunyai data-video-id,
         * klik card dapat membuka viewer.
         *
         * Jangan menjalankan ini pada tombol.
         */

        if (
            target.closest(
                "button, a, input, textarea, select, label"
            )
        ) {

            return;
        }


        const card =
            target.closest(
                "[data-video-id]"
            );


        if (!card) {
            return;
        }


        const videoId =
            card.getAttribute(
                "data-video-id"
            );


        if (
            videoId &&
            typeof dashboard.openVideoViewer ===
            "function"
        ) {

            dashboard.openVideoViewer(
                videoId
            );
        }
    }


    /* =====================================================
       RETRY
    ===================================================== */

    async function handleRetry() {

        try {

            if (
                typeof dashboard.clearError ===
                "function"
            ) {

                dashboard.clearError();
            }


            if (
                typeof dashboard.showLoading ===
                "function"
            ) {

                dashboard.showLoading();
            }


            if (
                typeof dashboard.loadVideos !==
                "function"
            ) {

                throw new Error(
                    "Module data video belum tersedia."
                );
            }


            await dashboard.loadVideos({
                includeInactive:
                    typeof dashboard.isEditMode ===
                    "function" &&
                    dashboard.isEditMode()
            });


            if (
                typeof dashboard.refreshVideoView ===
                "function"
            ) {

                dashboard.refreshVideoView();

            } else if (
                typeof dashboard.renderDashboard ===
                "function"
            ) {

                dashboard.renderDashboard();
            }


        } catch (error) {

            console.error(
                "[GEN-Z.AI Dashboard] Retry error:",
                error
            );


            if (
                typeof dashboard.setError ===
                "function"
            ) {

                dashboard.setError(
                    error
                );
            }


            if (
                typeof dashboard.renderDashboard ===
                "function"
            ) {

                dashboard.renderDashboard();
            }


            showToast(
                getErrorMessage(
                    error
                ),
                "error"
            );
        }
    }


    /* =====================================================
       BACK TO NORMAL DASHBOARD
    ===================================================== */

    function handleBackToDashboard(
        event
    ) {

        /*
         * Tombol ini biasanya berupa anchor.
         * Jangan melakukan preventDefault agar browser
         * tetap menggunakan href apabila tersedia.
         */

        const element =
            event.currentTarget;


        if (!element) {
            return;
        }


        const href =
            element.getAttribute(
                "href"
            );


        if (
            href &&
            href !== "#" &&
            href !== "javascript:void(0)"
        ) {

            return;
        }


        event.preventDefault();


        if (
            typeof dashboard.isEditMode ===
            "function" &&
            dashboard.isEditMode()
        ) {

            window.location.href =
                "./dashboard.html";
        }
    }


    /* =====================================================
       ADMIN MODE TOGGLE
    ===================================================== */

    function handleAdminModeClick(
        event
    ) {

        const target =
            event.currentTarget;


        if (!target) {
            return;
        }


        /*
         * Jika sudah berada di edit mode,
         * jangan membuka form secara otomatis.
         */

        if (
            typeof dashboard.isEditMode ===
            "function" &&
            dashboard.isEditMode()
        ) {

            return;
        }


        /*
         * Hanya admin / owner.
         */

        if (
            typeof dashboard.isAdmin ===
            "function" &&
            !dashboard.isAdmin()
        ) {

            event.preventDefault();

            showToast(
                "Akses management hanya untuk Admin / Owner.",
                "error"
            );

            return;
        }
    }


    /* =====================================================
       ADD BUTTON LISTENER
    ===================================================== */

    function bindAddButton(
        elements
    ) {

        const button =
            elements.addVideoButton;


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                handleAddVideo();
            }
        );
    }


    /* =====================================================
       FILTER LISTENER
    ===================================================== */

    function bindFilter(
        elements
    ) {

        const container =
            elements.categoryFilters;


        if (!container) {
            return;
        }


        container.addEventListener(
            "click",
            handleFilterContainerClick
        );
    }


    /* =====================================================
       VIDEO GRID LISTENER
    ===================================================== */

    function bindVideoGrid(
        elements
    ) {

        const grid =
            elements.videoGrid;


        if (!grid) {
            return;
        }


        grid.addEventListener(
            "click",
            handleVideoGridClick
        );
    }


    /* =====================================================
       RETRY LISTENER
    ===================================================== */

    function bindRetry(
        elements
    ) {

        const retryButton =
            elements.retryButton;


        if (!retryButton) {
            return;
        }


        retryButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                handleRetry();
            }
        );
    }


    /* =====================================================
       BACK LISTENER
    ===================================================== */

    function bindBackButton(
        elements
    ) {

        const button =
            elements.adminBackButton;


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            handleBackToDashboard
        );
    }


    /* =====================================================
       MANAGEMENT BUTTON
    ===================================================== */

    function bindManagementButton(
        elements
    ) {

        const button =
            elements.managementButton;


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            handleAdminModeClick
        );
    }


    /* =====================================================
       FORM
    ===================================================== */

    function bindForm(
        elements
    ) {

        const form =
            elements.videoForm;


        if (!form) {
            return;
        }


        /*
         * Upload module adalah pemilik submit.
         *
         * Di sini hanya fallback apabila upload module
         * belum memasang listener.
         */

        if (
            typeof dashboard.submitDashboardForm !==
            "function"
        ) {

            return;
        }


        /*
         * Jangan menambahkan listener submit kedua.
         *
         * Upload module sudah bertanggung jawab atas
         * submit form.
         */
    }


    /* =====================================================
       GLOBAL ESCAPE
    ===================================================== */

    function handleGlobalEscape(
        event
    ) {

        if (
            event.key !==
            "Escape"
        ) {

            return;
        }


        /*
         * Modal module menangani modal.
         * Viewer juga menangani viewer sendiri.
         *
         * Event ini sengaja tidak menutup apa pun,
         * sehingga tidak terjadi double-close.
         */
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initializeEvents() {

        if (initialized) {
            return true;
        }


        const elements =
            getElements();


        /*
         * Pastikan element cache tersedia.
         */

        if (
            !elements ||
            Object.keys(elements).length === 0
        ) {

            console.error(
                "[GEN-Z.AI] Dashboard events: element cache tidak tersedia."
            );

            return false;
        }


        bindAddButton(
            elements
        );


        bindFilter(
            elements
        );


        bindVideoGrid(
            elements
        );


        bindRetry(
            elements
        );


        bindBackButton(
            elements
        );


        bindManagementButton(
            elements
        );


        bindForm(
            elements
        );


        document.addEventListener(
            "keydown",
            handleGlobalEscape
        );


        initialized = true;


        return true;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    dashboard.handleAddVideo =
        handleAddVideo;

    dashboard.handleEditVideo =
        handleEditVideo;

    dashboard.handleDeleteVideo =
        handleDeleteVideo;

    dashboard.handleCategoryFilter =
        handleCategoryFilter;

    dashboard.handleRetry =
        handleRetry;

    dashboard.initializeEvents =
        initializeEvents;


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.eventsReady =
        true;

})();
