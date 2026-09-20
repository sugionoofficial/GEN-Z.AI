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
   - Event Play Video
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
       INTERNAL STATE
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

            dashboard.elements =
                dashboard.cacheElements();

            return dashboard.elements;
        }


        return {};
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
                dashboard.hasManagementAccess() === true
            );
        }


        const isAdmin =
            typeof dashboard.isAdmin ===
            "function"
                ? dashboard.isAdmin() === true
                : false;


        const isEditMode =
            typeof dashboard.isEditMode ===
            "function"
                ? dashboard.isEditMode() === true
                : false;


        return (
            isAdmin &&
            isEditMode
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
                type || "info"
            );

            return;
        }


        console[type === "error" ? "error" : "log"](
            "[GEN-Z.AI Dashboard]",
            message || ""
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

            event.stopPropagation();
        }


        if (
            !hasManagementAccess()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk menambah video.",
                "error"
            );

            return false;
        }


        if (
            typeof dashboard.openAddModal !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI Dashboard] openAddModal tidak tersedia."
            );

            return false;
        }


        return (
            dashboard.openAddModal()
        );
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

            return false;
        }


        if (
            !videoId
        ) {

            showToast(
                "Video ID tidak tersedia.",
                "error"
            );

            return false;
        }


        if (
            typeof dashboard.openEditModal !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI Dashboard] openEditModal tidak tersedia."
            );

            return false;
        }


        return (
            dashboard.openEditModal(
                videoId
            )
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

            return false;
        }


        if (
            !videoId
        ) {

            showToast(
                "Video ID tidak tersedia.",
                "error"
            );

            return false;
        }


        if (
            typeof dashboard.getVideoById !==
            "function"
        ) {

            showToast(
                "Data video belum tersedia.",
                "error"
            );

            return false;
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

            return false;
        }


        const title =
            video.title ||
            "video ini";


        const confirmed =
            window.confirm(
                `Hapus "${title}"?\n\nTindakan ini tidak dapat dibatalkan.`
            );


        if (
            !confirmed
        ) {

            return false;
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
                    "deleteVideo tidak tersedia."
                );
            }


            await dashboard.deleteVideo(
                videoId
            );


            /*
             * Setelah delete, reload data dari Supabase.
             * Jangan hanya mengandalkan state lokal.
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


            return true;

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


            return false;

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

            return false;
        }


        /*
         * Renderer menyediakan openVideoViewer(video)
         * dan playVideo(videoId).
         *
         * Gunakan playVideo terlebih dahulu karena
         * renderer menangani lookup video dari state.
         */

        if (
            typeof dashboard.playVideo ===
            "function"
        ) {

            dashboard.playVideo(
                videoId
            );

            return true;
        }


        if (
            typeof dashboard.openVideoViewer ===
            "function"
        ) {

            const video =
                typeof dashboard.getVideoById ===
                "function"
                    ? dashboard.getVideoById(
                        videoId
                    )
                    : null;


            if (
                video
            ) {

                dashboard.openVideoViewer(
                    video
                );

                return true;
            }
        }


        showToast(
            "Pemutar video belum tersedia.",
            "error"
        );


        return false;
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

            return false;
        }


        const normalized =
            category.trim() ||
            "all";


        if (
            typeof dashboard.setActiveCategory ===
            "function"
        ) {

            dashboard.setActiveCategory(
                normalized
            );
        }


        /*
         * Renderer hanya merender state yang sudah
         * diubah oleh state module.
         */

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


        return true;
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

            event.stopPropagation();
        }


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


            return true;

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
                typeof dashboard.showError ===
                "function"
            ) {

                dashboard.showError(
                    error
                );
            }


            return false;
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

            event.stopPropagation();
        }


        const config =
            dashboard.config ||
            {};


        const routes =
            config.routes ||
            {};


        const target =
            routes.generate ||
            "../generate/index.html";


        window.location.href =
            target;
    }


    /* =====================================================
       ADMIN BACK
    ===================================================== */

    function handleAdminBack(
        event
    ) {

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


        /*
         * Jika href tersedia, browser menangani
         * navigasi normal.
         */

        if (
            href
        ) {

            return;
        }


        if (
            event
        ) {

            event.preventDefault();

            event.stopPropagation();
        }


        const config =
            dashboard.config ||
            {};


        const routes =
            config.routes ||
            {};


        window.location.href =
            routes.adminPanel ||
            "../admin-control/admin-panel.html";
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

            event.stopPropagation();
        }


        if (
            typeof dashboard.isAdmin !==
            "function" ||
            !dashboard.isAdmin()
        ) {

            showToast(
                "Anda tidak memiliki akses management.",
                "error"
            );

            return false;
        }


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


        return true;
    }


    /* =====================================================
       VIDEO GRID
       -----------------------------------------------------
       Harus sinkron dengan dashboard-render.js:

       Play:
         data-video-play="VIDEO_ID"

       Edit:
         data-action="edit"
         data-video-id="VIDEO_ID"

       Delete:
         data-action="delete"
         data-video-id="VIDEO_ID"
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


                if (
                    !target
                ) {

                    return;
                }


                /* -----------------------------------------
                   EDIT
                ----------------------------------------- */

                const editButton =
                    target.closest(
                        "[data-action='edit']"
                    );


                if (
                    editButton &&
                    grid.contains(
                        editButton
                    )
                ) {

                    handleEditVideo(
                        editButton.dataset.videoId,
                        event
                    );

                    return;
                }


                /* -----------------------------------------
                   DELETE
                ----------------------------------------- */

                const deleteButton =
                    target.closest(
                        "[data-action='delete']"
                    );


                if (
                    deleteButton &&
                    grid.contains(
                        deleteButton
                    )
                ) {

                    handleDeleteVideo(
                        deleteButton.dataset.videoId,
                        event
                    );

                    return;
                }


                /* -----------------------------------------
                   PLAY BUTTON / PREVIEW
                ----------------------------------------- */

                const playTarget =
                    target.closest(
                        "[data-video-play]"
                    );


                if (
                    playTarget &&
                    grid.contains(
                        playTarget
                    )
                ) {

                    handlePlayVideo(
                        playTarget.dataset.videoPlay,
                        event
                    );

                    return;
                }


                /* -----------------------------------------
                   CARD FALLBACK
                ----------------------------------------- */

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


                /*
                 * Jangan menganggap klik pada control
                 * sebagai play card.
                 */

                if (
                    target.closest(
                        [
                            "button",
                            "a",
                            "input",
                            "select",
                            "textarea",
                            "label"
                        ].join(",")
                    )
                ) {

                    return;
                }


                const videoId =
                    card.dataset.videoId;


                if (
                    videoId
                ) {

                    handlePlayVideo(
                        videoId,
                        event
                    );
                }
            }
        );


        /*
         * Keyboard support untuk preview/card.
         */

        grid.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key !== "Enter" &&
                    event.key !== " "
                ) {

                    return;
                }


                const target =
                    event.target;


                const playTarget =
                    target.closest(
                        "[data-video-play]"
                    );


                if (
                    !playTarget ||
                    !grid.contains(
                        playTarget
                    )
                ) {

                    return;
                }


                event.preventDefault();


                handlePlayVideo(
                    playTarget.dataset.videoPlay,
                    event
                );
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


                handleCategoryFilter(
                    button.dataset.category,
                    event
                );
            }
        );
    }


    /* =====================================================
       FORM
       ===================================================== */

    function bindFormGuard(
        form
    ) {

        /*
         * Sengaja tidak memasang submit listener.
         *
         * dashboard-upload.js adalah satu-satunya
         * pemilik submit form.
         */

        if (
            !form
        ) {

            return false;
        }


        return true;
    }


    /* =====================================================
       GENERIC CLICK
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
       INITIALIZE
    ===================================================== */

    function initializeEvents() {

        if (
            initialized
        ) {

            return true;
        }


        const elements =
            getElements();


        if (
            !elements
        ) {

            return false;
        }


        /* -----------------------------------------------
           ADD VIDEO
        ----------------------------------------------- */

        bindClick(
            elements.addVideoButton,
            handleAddVideo
        );


        /* -----------------------------------------------
           GENERATE
        ----------------------------------------------- */

        bindClick(
            elements.generateButton,
            handleGenerate
        );


        /* -----------------------------------------------
           RETRY
        ----------------------------------------------- */

        bindClick(
            elements.retryVideoButton,
            handleRetry
        );


        /* -----------------------------------------------
           ADMIN BACK
        ----------------------------------------------- */

        bindClick(
            elements.adminBackButton,
            handleAdminBack
        );


        /* -----------------------------------------------
           OPTIONAL MANAGEMENT BUTTON
        ----------------------------------------------- */

        bindClick(
            elements.managementButton,
            handleManagementMode
        );


        /* -----------------------------------------------
           CATEGORY FILTERS
        ----------------------------------------------- */

        bindCategoryFilters(
            elements.categoryFilters
        );


        /* -----------------------------------------------
           VIDEO GRID
        ----------------------------------------------- */

        bindVideoGrid(
            elements.videoGrid
        );


        /* -----------------------------------------------
           FORM
        ----------------------------------------------- */

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
