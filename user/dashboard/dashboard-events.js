/* =========================================================
   GEN-Z.AI
   USER DASHBOARD EVENTS MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-events.js

   Tanggung jawab:
   - Event tombol Add Video
   - Event tombol Edit
   - Event tombol Delete
   - Event filter kategori
   - Event Retry
   - Event Generate
   - Event Admin Back
   - Delegasi ke module terkait

   Tidak bertanggung jawab:
   - Query Supabase
   - CRUD langsung
   - Upload langsung
   - Render HTML
   - Modal lifecycle
   - Auth
   - Navigation
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
       INTERNAL
    ===================================================== */

    let initialized = false;


    /* =====================================================
       ELEMENTS
    ===================================================== */

    function getElements() {

        if (
            dashboard.elements
        ) {

            return dashboard.elements;
        }


        if (
            typeof dashboard.cacheElements ===
            "function"
        ) {

            return dashboard.cacheElements();
        }


        return {};
    }


    /* =====================================================
       ACCESS CHECK
    ===================================================== */

    function hasManagementAccess() {

        if (
            typeof dashboard.hasManagementAccess ===
            "function"
        ) {

            return (
                dashboard.hasManagementAccess() === true
            );
        }


        /*
         * Fallback hanya untuk kompatibilitas.
         *
         * Otorisasi sebenarnya tetap berasal dari
         * dashboard-auth.js / Supabase.
         */

        const admin =
            typeof dashboard.isAdmin ===
            "function"
                ? dashboard.isAdmin()
                : false;


        const editMode =
            typeof dashboard.isEditMode ===
            "function"
                ? dashboard.isEditMode()
                : false;


        return (
            admin &&
            editMode
        );
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
                type
            );

            return;
        }


        const elements =
            getElements();


        const toast =
            elements.dashboardToast;


        const toastMessage =
            elements.dashboardToastMessage;


        if (
            !toast ||
            !toastMessage
        ) {

            return;
        }


        toastMessage.textContent =
            message || "";


        toast.hidden =
            false;


        toast.classList.remove(
            "hidden"
        );


        clearTimeout(
            dashboard.toastTimer
        );


        dashboard.toastTimer =
            setTimeout(
                function () {

                    toast.hidden =
                        true;

                    toast.classList.add(
                        "hidden"
                    );

                },
                3500
            );
    }


    /* =====================================================
       ADD VIDEO
    ===================================================== */

    function handleAddVideo(
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();
        }


        if (
            !hasManagementAccess()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk menambah video.",
                "error"
            );

            return;
        }


        if (
            typeof dashboard.openAddModal !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI Dashboard] openAddModal tidak tersedia."
            );

            return;
        }


        dashboard.openAddModal();
    }


    /* =====================================================
       EDIT VIDEO
    ===================================================== */

    function handleEditVideo(
        videoId,
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();

            event.stopPropagation();
        }


        if (
            !hasManagementAccess()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk mengedit video.",
                "error"
            );

            return;
        }


        if (
            !videoId
        ) {

            return;
        }


        if (
            typeof dashboard.openEditModal !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI Dashboard] openEditModal tidak tersedia."
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
        videoId,
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();

            event.stopPropagation();
        }


        if (
            !hasManagementAccess()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk menghapus video.",
                "error"
            );

            return;
        }


        if (
            !videoId
        ) {

            return;
        }


        if (
            typeof dashboard.getVideoById !==
            "function"
        ) {

            return;
        }


        const video =
            dashboard.getVideoById(
                videoId
            );


        if (
            !video
        ) {

            showToast(
                "Video tidak ditemukan.",
                "error"
            );

            return;
        }


        const title =
            video.title ||
            "video ini";


        /*
         * Native confirm dipakai sengaja.
         * Tidak menambah modal kedua hanya untuk delete.
         */

        const confirmed =
            window.confirm(
                `Hapus "${title}"?\n\nTindakan ini tidak dapat dibatalkan.`
            );


        if (
            !confirmed
        ) {

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


            /*
             * Data module adalah satu-satunya module
             * yang boleh melakukan delete Supabase.
             */

            if (
                typeof dashboard.deleteVideo !==
                "function"
            ) {

                throw new Error(
                    "deleteVideo tidak tersedia."
                );
            }


            await dashboard.deleteVideo(
                videoId
            );


            /*
             * Reload dari Supabase.
             *
             * Ini memastikan UI tidak hanya bergantung
             * pada state lokal.
             */

            if (
                typeof dashboard.loadVideos ===
                "function"
            ) {

                await dashboard.loadVideos({

                    includeInactive:
                        hasManagementAccess()

                });
            }


            if (
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
                "[GEN-Z.AI Dashboard] Delete video error:",
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
                error &&
                error.message
                    ? error.message
                    : "Gagal menghapus video.",
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
       PLAY VIDEO
    ===================================================== */

    function handlePlayVideo(
        videoId,
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();

            event.stopPropagation();
        }


        if (
            !videoId
        ) {

            return;
        }


        /*
         * Player dimiliki render module.
         */

        if (
            typeof dashboard.openVideoViewer ===
            "function"
        ) {

            dashboard.openVideoViewer(
                videoId
            );

            return;
        }


        /*
         * Compatibility dengan nama API lain.
         */

        if (
            typeof dashboard.playVideo ===
            "function"
        ) {

            dashboard.playVideo(
                videoId
            );
        }
    }


    /* =====================================================
       CATEGORY FILTER
    ===================================================== */

    function handleCategoryFilter(
        category,
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();

            event.stopPropagation();
        }


        if (
            typeof category !==
            "string"
        ) {

            return;
        }


        const normalized =
            category.trim() || "all";


        if (
            typeof dashboard.setActiveCategory ===
            "function"
        ) {

            dashboard.setActiveCategory(
                normalized
            );
        }


        if (
            typeof dashboard.renderDashboard ===
            "function"
        ) {

            dashboard.renderDashboard();
        }
    }


    /* =====================================================
       RETRY
    ===================================================== */

    async function handleRetry(
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();
        }


        try {

            if (
                typeof dashboard.clearError ===
                "function"
            ) {

                dashboard.clearError();
            }


            if (
                typeof dashboard.loadVideos !==
                "function"
            ) {

                throw new Error(
                    "loadVideos tidak tersedia."
                );
            }


            await dashboard.loadVideos({

                includeInactive:
                    hasManagementAccess()

            });


            if (
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
        }
    }


    /* =====================================================
       GENERATE
    ===================================================== */

    function handleGenerate(
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();
        }


        const config =
            dashboard.config;


        const target =
            config &&
            config.routes &&
            config.routes.generate
                ? config.routes.generate
                : "../generate/index.html";


        window.location.href =
            target;
    }


    /* =====================================================
       ADMIN BACK
    ===================================================== */

    function handleAdminBack(
        event
    ) {

        /*
         * Jika element berupa anchor dengan href,
         * biarkan browser melakukan navigasi normal.
         *
         * Event handler hanya mencegah navigasi apabila
         * href tidak tersedia.
         */

        const elements =
            getElements();


        const button =
            elements.adminBackButton;


        if (
            !button
        ) {

            return;
        }


        const href =
            button.getAttribute(
                "href"
            );


        if (
            !href
        ) {

            if (
                event
            ) {

                event.preventDefault();
            }


            const config =
                dashboard.config;


            const target =
                config &&
                config.routes &&
                config.routes.adminPanel
                    ? config.routes.adminPanel
                    : "../admin-control/admin-panel.html";


            window.location.href =
                target;
        }
    }


    /* =====================================================
       MANAGEMENT MODE
    ===================================================== */

    function handleManagementMode(
        event
    ) {

        if (
            event
        ) {

            event.preventDefault();
        }


        if (
            !dashboard.isAdmin ||
            !dashboard.isAdmin()
        ) {

            return;
        }


        /*
         * Jangan memanipulasi URL secara manual di sini.
         * Halaman dashboard menggunakan ?edit=1 sebagai
         * mode management.
         */

        const currentUrl =
            new URL(
                window.location.href
            );


        currentUrl.searchParams.set(
            "edit",
            "1"
        );


        window.location.href =
            currentUrl.toString();
    }


    /* =====================================================
       VIDEO GRID DELEGATION
    ===================================================== */

    function bindVideoGrid(
        grid
    ) {

        if (
            !grid
        ) {

            return;
        }


        if (
            grid.dataset.eventsBound ===
            "true"
        ) {

            return;
        }


        grid.dataset.eventsBound =
            "true";


        grid.addEventListener(
            "click",
            function (event) {

                const target =
                    event.target;


                /*
                 * PLAY
                 */

                const playButton =
                    target.closest(
                        "[data-action='play-video']"
                    );


                if (
                    playButton &&
                    grid.contains(
                        playButton
                    )
                ) {

                    const videoId =
                        playButton.dataset.videoId;


                    handlePlayVideo(
                        videoId,
                        event
                    );

                    return;
                }


                /*
                 * EDIT
                 */

                const editButton =
                    target.closest(
                        "[data-action='edit-video']"
                    );


                if (
                    editButton &&
                    grid.contains(
                        editButton
                    )
                ) {

                    const videoId =
                        editButton.dataset.videoId;


                    handleEditVideo(
                        videoId,
                        event
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


                if (
                    deleteButton &&
                    grid.contains(
                        deleteButton
                    )
                ) {

                    const videoId =
                        deleteButton.dataset.videoId;


                    handleDeleteVideo(
                        videoId,
                        event
                    );

                    return;
                }


                /*
                 * CARD PLAY FALLBACK
                 *
                 * Hanya jika klik bukan pada button,
                 * link, input, select, textarea, atau label.
                 */

                const card =
                    target.closest(
                        "[data-video-id]"
                    );


                if (
                    !card ||
                    !grid.contains(
                        card
                    )
                ) {

                    return;
                }


                if (
                    target.closest(
                        "button,a,input,select,textarea,label"
                    )
                ) {

                    return;
                }


                const cardVideoId =
                    card.dataset.videoId;


                if (
                    cardVideoId
                ) {

                    handlePlayVideo(
                        cardVideoId,
                        event
                    );
                }

            }
        );
    }


    /* =====================================================
       CATEGORY FILTER EVENTS
    ===================================================== */

    function bindCategoryFilters(
        container
    ) {

        if (
            !container
        ) {

            return;
        }


        if (
            container.dataset.eventsBound ===
            "true"
        ) {

            return;
        }


        container.dataset.eventsBound =
            "true";


        container.addEventListener(
            "click",
            function (event) {

                const button =
                    event.target.closest(
                        "[data-category]"
                    );


                if (
                    !button ||
                    !container.contains(
                        button
                    )
                ) {

                    return;
                }


                const category =
                    button.dataset.category;


                handleCategoryFilter(
                    category,
                    event
                );
            }
        );
    }


    /* =====================================================
       FORM GUARD
    ===================================================== */

    function bindFormGuard(
        form
    ) {

        if (
            !form
        ) {

            return;
        }


        /*
         * Submit listener sengaja TIDAK dipasang.
         *
         * dashboard-upload.js adalah pemilik submit
         * form agar tidak terjadi:
         *
         * submit → upload module
         * submit → events module
         * submit → upload module lagi
         *
         * yang berujung duplicate request / stack error.
         */

        return true;
    }


    /* =====================================================
       SIMPLE EVENT
    ===================================================== */

    function bindClick(
        element,
        handler
    ) {

        if (
            !element ||
            typeof handler !==
            "function"
        ) {

            return;
        }


        if (
            element.dataset.eventBound ===
            "true"
        ) {

            return;
        }


        element.dataset.eventBound =
            "true";


        element.addEventListener(
            "click",
            handler
        );
    }


    /* =====================================================
       INITIALIZE EVENTS
    ===================================================== */

    function initializeEvents() {

        if (
            initialized
        ) {

            return true;
        }


        const elements =
            getElements();


        /*
         * ADD
         */

        bindClick(
            elements.addVideoButton,
            handleAddVideo
        );


        /*
         * GENERATE
         */

        bindClick(
            elements.generateButton,
            handleGenerate
        );


        /*
         * RETRY
         *
         * Penting:
         * Config memakai retryVideoButton,
         * bukan retryButton.
         */

        bindClick(
            elements.retryVideoButton,
            handleRetry
        );


        /*
         * ADMIN BACK
         */

        bindClick(
            elements.adminBackButton,
            handleAdminBack
        );


        /*
         * MANAGEMENT
         */

        bindClick(
            elements.managementButton,
            handleManagementMode
        );


        /*
         * CATEGORY
         */

        bindCategoryFilters(
            elements.categoryFilters
        );


        /*
         * VIDEO GRID
         */

        bindVideoGrid(
            elements.videoGrid
        );


        /*
         * FORM
         *
         * Hanya guard. Submit dimiliki upload module.
         */

        bindFormGuard(
            elements.videoForm
        );


        initialized =
            true;


        dashboard.eventsInitialized =
            true;


        dashboard.eventsReady =
            true;


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


    dashboard.handlePlayVideo =
        handlePlayVideo;


    dashboard.handleCategoryFilter =
        handleCategoryFilter;


    dashboard.handleRetry =
        handleRetry;


    dashboard.handleGenerate =
        handleGenerate;


    dashboard.handleAdminBack =
        handleAdminBack;


    dashboard.handleManagementMode =
        handleManagementMode;


    dashboard.initializeEvents =
        initializeEvents;


    /* =====================================================
       READY
    ===================================================== */

    dashboard.eventsReady =
        true;

})();
