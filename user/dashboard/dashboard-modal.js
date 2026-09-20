/* =========================================================
   GEN-Z.AI
   USER DASHBOARD MODAL MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-modal.js

   Tanggung jawab:
   - Open modal
   - Close modal
   - Add mode
   - Edit mode
   - Populate form
   - Reset form
   - Modal accessibility
   - Escape / backdrop / close button

   Tidak bertanggung jawab:
   - Query Supabase
   - Upload file
   - CRUD database
   - Render video
   - Auth
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
            dashboard.elements.videoModal
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
       CONFIG HELPERS
    ===================================================== */

    function getConfig() {

        return (
            dashboard.config ||
            {}
        );
    }


    function getDefaults() {

        const config =
            getConfig();


        return (
            config.defaults ||
            {}
        );
    }


    /* =====================================================
       ACCESS CONTROL
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
       MODAL VISIBILITY
    ===================================================== */

    function setModalVisibility(
        open
    ) {

        const elements =
            getElements();


        const modal =
            elements.videoModal;


        if (
            !modal
        ) {

            return;
        }


        const shouldOpen =
            open === true;


        modal.hidden =
            !shouldOpen;


        modal.classList.toggle(
            "hidden",
            !shouldOpen
        );


        modal.setAttribute(
            "aria-hidden",
            shouldOpen
                ? "false"
                : "true"
        );


        if (
            shouldOpen
        ) {

            document.body.classList.add(
                "genz-modal-open"
            );

        } else {

            document.body.classList.remove(
                "genz-modal-open"
            );
        }


        if (
            typeof dashboard.setModalState ===
            "function"
        ) {

            const mode =
                typeof dashboard.getModalMode ===
                "function"
                    ? dashboard.getModalMode()
                    : null;


            const selectedId =
                typeof dashboard.getSelectedVideoId ===
                "function"
                    ? dashboard.getSelectedVideoId()
                    : null;


            dashboard.setModalState(
                shouldOpen,
                mode,
                selectedId
            );
        }
    }


    /* =====================================================
       FORM
    ===================================================== */

    function getForm() {

        const elements =
            getElements();


        return (
            elements.videoForm ||
            null
        );
    }


    function clearCurrentFiles() {

        const elements =
            getElements();


        if (
            elements.currentVideoFile
        ) {

            elements.currentVideoFile.textContent =
                "";
        }


        if (
            elements.currentThumbnailFile
        ) {

            elements.currentThumbnailFile.textContent =
                "";
        }
    }


    function clearFormValidation() {

        const form =
            getForm();


        if (
            !form
        ) {

            return;
        }


        const invalidFields =
            form.querySelectorAll(
                ".is-invalid, [aria-invalid='true']"
            );


        invalidFields.forEach(
            function (field) {

                field.classList.remove(
                    "is-invalid"
                );


                field.removeAttribute(
                    "aria-invalid"
                );
            }
        );
    }


    /* =====================================================
       UPLOAD PROGRESS RESET
    ===================================================== */

    function resetUploadProgress() {

        const elements =
            getElements();


        if (
            elements.uploadProgress
        ) {

            elements.uploadProgress.hidden =
                true;
        }


        if (
            elements.uploadProgressPercent
        ) {

            elements.uploadProgressPercent.textContent =
                "0%";
        }


        if (
            elements.uploadProgressBar
        ) {

            elements.uploadProgressBar.style.width =
                "0%";
        }


        if (
            elements.uploadProgressText
        ) {

            elements.uploadProgressText.textContent =
                "Menyiapkan upload...";
        }


        if (
            typeof dashboard.setUploadState ===
            "function"
        ) {

            dashboard.setUploadState(
                false,
                0,
                ""
            );
        }
    }


    /* =====================================================
       RESET FORM
    ===================================================== */

    function resetForm() {

        const elements =
            getElements();


        const form =
            getForm();


        if (
            form
        ) {

            form.reset();
        }


        const defaults =
            getDefaults();


        if (
            elements.videoId
        ) {

            elements.videoId.value =
                "";
        }


        if (
            elements.videoTitle
        ) {

            elements.videoTitle.value =
                "";
        }


        if (
            elements.videoDescription
        ) {

            elements.videoDescription.value =
                "";
        }


        if (
            elements.videoCategory
        ) {

            elements.videoCategory.value =
                defaults.category ||
                "";
        }


        if (
            elements.videoAspectRatio
        ) {

            elements.videoAspectRatio.value =
                defaults.aspectRatio ||
                "";
        }


        if (
            elements.videoSortOrder
        ) {

            elements.videoSortOrder.value =
                String(
                    Number.isFinite(
                        Number(
                            defaults.sortOrder
                        )
                    )
                        ? Number(
                            defaults.sortOrder
                        )
                        : 0
                );
        }


        if (
            elements.videoIsActive
        ) {

            elements.videoIsActive.checked =
                defaults.isActive !== false;
        }


        if (
            elements.videoFile
        ) {

            elements.videoFile.value =
                "";
        }


        if (
            elements.thumbnailFile
        ) {

            elements.thumbnailFile.value =
                "";
        }


        clearCurrentFiles();

        resetUploadProgress();

        clearFormValidation();


        if (
            typeof dashboard.clearError ===
            "function"
        ) {

            dashboard.clearError();
        }
    }


    /* =====================================================
       MODAL TITLE
    ===================================================== */

    function setModalTitle(
        title
    ) {

        const elements =
            getElements();


        if (
            elements.modalTitle
        ) {

            elements.modalTitle.textContent =
                title || "";
        }
    }


    /* =====================================================
       ADD MODE
    ===================================================== */

    function openAddModal() {

        if (
            !canManageVideos()
        ) {

            showAccessError(
                "Anda tidak memiliki akses untuk menambah video."
            );


            return false;
        }


        resetForm();


        const videos =
            typeof dashboard.getVideos ===
            "function"
                ? dashboard.getVideos()
                : [];


        let nextOrder =
            1;


        if (
            videos.length
        ) {

            const orders =
                videos.map(
                    function (video) {

                        const value =
                            Number(
                                video &&
                                video.sort_order
                            );


                        return Number.isFinite(
                            value
                        )
                            ? value
                            : 0;
                    }
                );


            const maximum =
                Math.max.apply(
                    null,
                    orders
                );


            nextOrder =
                maximum + 1;
        }


        const elements =
            getElements();


        if (
            elements.videoSortOrder
        ) {

            elements.videoSortOrder.value =
                String(nextOrder);
        }


        setModalTitle(
            "Tambah Video"
        );


        if (
            typeof dashboard.setModalState ===
            "function"
        ) {

            dashboard.setModalState(
                true,
                "create",
                null
            );
        }


        setModalVisibility(
            true
        );


        focusFirstField();


        return true;
    }


    /* =====================================================
       EDIT MODE
    ===================================================== */

    function openEditModal(
        videoId
    ) {

        if (
            !canManageVideos()
        ) {

            showAccessError(
                "Anda tidak memiliki akses untuk mengedit video."
            );


            return false;
        }


        if (
            !videoId
        ) {

            showAccessError(
                "Video ID tidak tersedia."
            );


            return false;
        }


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

            showAccessError(
                "Video tidak ditemukan."
            );


            return false;
        }


        resetForm();


        const elements =
            getElements();


        /* -------------------------------------------------
           ID
        ------------------------------------------------- */

        if (
            elements.videoId
        ) {

            elements.videoId.value =
                video.id || "";
        }


        /* -------------------------------------------------
           TITLE
        ------------------------------------------------- */

        if (
            elements.videoTitle
        ) {

            elements.videoTitle.value =
                video.title || "";
        }


        /* -------------------------------------------------
           DESCRIPTION
        ------------------------------------------------- */

        if (
            elements.videoDescription
        ) {

            elements.videoDescription.value =
                video.description || "";
        }


        /* -------------------------------------------------
           CATEGORY
        ------------------------------------------------- */

        if (
            elements.videoCategory
        ) {

            elements.videoCategory.value =
                video.category || "";
        }


        /* -------------------------------------------------
           ASPECT RATIO
        ------------------------------------------------- */

        if (
            elements.videoAspectRatio
        ) {

            const defaults =
                getDefaults();


            elements.videoAspectRatio.value =
                video.aspect_ratio ||
                defaults.aspectRatio ||
                "";
        }


        /* -------------------------------------------------
           SORT ORDER
        ------------------------------------------------- */

        if (
            elements.videoSortOrder
        ) {

            const order =
                Number(
                    video.sort_order
                );


            elements.videoSortOrder.value =
                String(
                    Number.isFinite(order)
                        ? order
                        : 0
                );
        }


        /* -------------------------------------------------
           ACTIVE
        ------------------------------------------------- */

        if (
            elements.videoIsActive
        ) {

            elements.videoIsActive.checked =
                video.is_active === true;
        }


        /* -------------------------------------------------
           EXISTING VIDEO
        ------------------------------------------------- */

        if (
            elements.currentVideoFile
        ) {

            elements.currentVideoFile.textContent =
                video.video_path
                    ? "Video saat ini tersedia."
                    : "Belum ada video.";
        }


        /* -------------------------------------------------
           EXISTING THUMBNAIL
        ------------------------------------------------- */

        if (
            elements.currentThumbnailFile
        ) {

            elements.currentThumbnailFile.textContent =
                video.thumbnail_path
                    ? "Thumbnail saat ini tersedia."
                    : "Belum ada thumbnail.";
        }


        setModalTitle(
            "Edit Video"
        );


        if (
            typeof dashboard.setModalState ===
            "function"
        ) {

            dashboard.setModalState(
                true,
                "edit",
                video.id
            );
        }


        setModalVisibility(
            true
        );


        focusFirstField();


        return true;
    }


    /* =====================================================
       ACCESS ERROR
    ===================================================== */

    function showAccessError(
        message
    ) {

        if (
            typeof dashboard.showToast ===
            "function"
        ) {

            dashboard.showToast(
                message,
                "error"
            );

            return;
        }


        console.error(
            "[GEN-Z.AI]",
            message
        );
    }


    /* =====================================================
       CLOSE MODAL
    ===================================================== */

    function closeModal() {

        const elements =
            getElements();


        const modal =
            elements.videoModal;


        if (
            !modal
        ) {

            return;
        }


        if (
            typeof dashboard.isUploadInProgress ===
            "function" &&
            dashboard.isUploadInProgress()
        ) {

            showAccessError(
                "Tunggu sampai upload selesai."
            );


            return;
        }


        if (
            document.activeElement &&
            modal.contains(
                document.activeElement
            )
        ) {

            try {

                document.activeElement.blur();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Modal blur failed:",
                    error
                );
            }
        }


        setModalVisibility(
            false
        );


        resetForm();


        if (
            typeof dashboard.setModalState ===
            "function"
        ) {

            dashboard.setModalState(
                false,
                null,
                null
            );
        }
    }


    /* =====================================================
       FORCE CLOSE
    ===================================================== */

    function forceCloseModal() {

        const elements =
            getElements();


        const modal =
            elements.videoModal;


        if (
            !modal
        ) {

            return;
        }


        modal.hidden =
            true;


        modal.classList.add(
            "hidden"
        );


        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.classList.remove(
            "genz-modal-open"
        );


        resetForm();


        if (
            typeof dashboard.setModalState ===
            "function"
        ) {

            dashboard.setModalState(
                false,
                null,
                null
            );
        }
    }


    /* =====================================================
       FOCUS FIRST FIELD
    ===================================================== */

    function focusFirstField() {

        const elements =
            getElements();


        const candidates = [

            elements.videoTitle,

            elements.videoDescription,

            elements.videoCategory,

            elements.videoAspectRatio

        ];


        const field =
            candidates.find(
                function (element) {

                    return (
                        element &&
                        !element.disabled &&
                        !element.hidden
                    );
                }
            );


        if (
            !field
        ) {

            return;
        }


        requestAnimationFrame(
            function () {

                try {

                    field.focus({
                        preventScroll: true
                    });

                } catch (error) {

                    try {

                        field.focus();

                    } catch (focusError) {

                        console.warn(
                            "[GEN-Z.AI] Modal focus failed:",
                            focusError
                        );
                    }
                }
            }
        );
    }


    /* =====================================================
       KEYBOARD
    ===================================================== */

    function handleKeydown(
        event
    ) {

        const elements =
            getElements();


        const modal =
            elements.videoModal;


        if (
            !modal ||
            modal.hidden
        ) {

            return;
        }


        if (
            event.key === "Escape"
        ) {

            event.preventDefault();

            closeModal();

            return;
        }


        if (
            event.key !== "Tab"
        ) {

            return;
        }


        const focusable =
            modal.querySelectorAll(
                [
                    "button:not([disabled])",
                    "input:not([disabled])",
                    "select:not([disabled])",
                    "textarea:not([disabled])",
                    "a[href]:not([disabled])"
                ].join(",")
            );


        if (
            !focusable.length
        ) {

            return;
        }


        const first =
            focusable[0];


        const last =
            focusable[
                focusable.length - 1
            ];


        if (
            event.shiftKey &&
            document.activeElement === first
        ) {

            event.preventDefault();

            last.focus();

            return;
        }


        if (
            !event.shiftKey &&
            document.activeElement === last
        ) {

            event.preventDefault();

            first.focus();
        }
    }


    /* =====================================================
       BACKDROP
    ===================================================== */

    function handleBackdropClick(
        event
    ) {

        const elements =
            getElements();


        const modal =
            elements.videoModal;


        if (
            !modal ||
            modal.hidden
        ) {

            return;
        }


        if (
            event.target &&
            event.target.matches(
                ".genz-modal-backdrop"
            )
        ) {

            closeModal();
        }
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initializeModal() {

        const elements =
            getElements();


        if (
            !elements.videoModal
        ) {

            console.error(
                "[GEN-Z.AI] #videoModal tidak ditemukan."
            );


            return false;
        }


        /*
         * Pastikan modal selalu tertutup ketika halaman
         * pertama kali dimuat.
         *
         * ?edit=1 hanya mengaktifkan management mode.
         * Itu TIDAK berarti modal harus otomatis terbuka.
         */

        forceCloseModal();


        /* -------------------------------------------------
           Hindari duplicate event binding
        ------------------------------------------------- */

        const modal =
            elements.videoModal;


        if (
            !modal.dataset.modalEventsBound
        ) {

            if (
                elements.modalClose
            ) {

                elements.modalClose.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();

                        closeModal();
                    }
                );
            }


            if (
                elements.cancelModalButton
            ) {

                elements.cancelModalButton.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();

                        closeModal();
                    }
                );
            }


            modal.addEventListener(
                "click",
                handleBackdropClick
            );


            modal.dataset.modalEventsBound =
                "true";
        }


        /*
         * Keyboard listener global hanya dipasang satu kali.
         */

        if (
            !dashboard.modalKeyboardBound
        ) {

            document.addEventListener(
                "keydown",
                handleKeydown
            );


            dashboard.modalKeyboardBound =
                true;
        }


        return true;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    dashboard.setModalVisibility =
        setModalVisibility;


    dashboard.resetModalForm =
        resetForm;


    dashboard.openAddModal =
        openAddModal;


    dashboard.openEditModal =
        openEditModal;


    dashboard.closeModal =
        closeModal;


    dashboard.forceCloseModal =
        forceCloseModal;


    dashboard.initializeModal =
        initializeModal;


    dashboard.focusModalField =
        focusFirstField;


    dashboard.setModalTitle =
        setModalTitle;


    dashboard.clearModalCurrentFiles =
        clearCurrentFiles;


    dashboard.resetModalUploadProgress =
        resetUploadProgress;


    /* =====================================================
       READY
    ===================================================== */

    dashboard.modalReady =
        true;

})();
