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

        dashboard.elements =
            dashboard.cacheElements();

        return dashboard.elements;
    }


    /* =====================================================
       MODAL STATE
    ===================================================== */

    function setModalVisibility(
        open
    ) {

        const elements =
            getElements();

        const modal =
            elements.videoModal;


        if (!modal) {
            return;
        }


        const shouldOpen =
            open === true;


        /*
         * hidden adalah sumber state utama.
         *
         * class hidden tetap disinkronkan agar kompatibel
         * dengan CSS / kode lama.
         */

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


        if (shouldOpen) {

            document.body.classList.add(
                "genz-modal-open"
            );

        } else {

            document.body.classList.remove(
                "genz-modal-open"
            );
        }


        dashboard.setModalState(
            shouldOpen,
            dashboard.getModalMode
                ? dashboard.getModalMode()
                : null,
            dashboard.getSelectedVideoId
                ? dashboard.getSelectedVideoId()
                : null
        );
    }


    /* =====================================================
       FORM
    ===================================================== */

    function getForm() {

        const elements =
            getElements();

        return elements.videoForm || null;
    }


    function resetForm() {

        const elements =
            getElements();

        const form =
            getForm();


        if (form) {

            form.reset();
        }


        /* -------------------------------------------------
           Explicit defaults
        ------------------------------------------------- */

        if (
            elements.videoId
        ) {

            elements.videoId.value =
                "";
        }


        if (
            elements.videoCategory
        ) {

            elements.videoCategory.value =
                dashboard.config.defaults.category;
        }


        if (
            elements.videoAspectRatio
        ) {

            elements.videoAspectRatio.value =
                dashboard.config.defaults.aspectRatio;
        }


        if (
            elements.videoSortOrder
        ) {

            elements.videoSortOrder.value =
                String(
                    dashboard.config.defaults.sortOrder
                );
        }


        if (
            elements.videoIsActive
        ) {

            elements.videoIsActive.checked =
                dashboard.config.defaults.isActive;
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


        dashboard.clearError();
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


        if (!form) {
            return;
        }


        const fields =
            form.querySelectorAll(
                ".is-invalid, [aria-invalid='true']"
            );


        fields.forEach(
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
    }


    /* =====================================================
       TITLE
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
                title;
        }
    }


    /* =====================================================
       ADD MODE
    ===================================================== */

    function openAddModal() {

        /*
         * Security:
         * Hanya ADMIN / OWNER dan edit mode.
         */

        if (
            !dashboard.isAdmin() ||
            !dashboard.isEditMode()
        ) {

            dashboard.showToast(
                "Anda tidak memiliki akses untuk menambah video.",
                "error"
            );

            return false;
        }


        resetForm();


        const videos =
            dashboard.getVideos();


        const nextOrder =
            videos.length > 0
                ? Math.max.apply(
                    null,
                    videos.map(
                        function (video) {

                            const value =
                                Number(
                                    video.sort_order
                                );

                            return Number.isFinite(value)
                                ? value
                                : 0;
                        }
                    )
                ) + 1
                : 1;


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


        dashboard.setModalState(
            true,
            "create",
            null
        );


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

        /*
         * Security:
         * Jangan hanya mengandalkan tombol UI.
         */

        if (
            !dashboard.isAdmin() ||
            !dashboard.isEditMode()
        ) {

            dashboard.showToast(
                "Anda tidak memiliki akses untuk mengedit video.",
                "error"
            );

            return false;
        }


        if (!videoId) {

            dashboard.showToast(
                "Video ID tidak tersedia.",
                "error"
            );

            return false;
        }


        const video =
            dashboard.getVideoById(
                videoId
            );


        if (!video) {

            dashboard.showToast(
                "Video tidak ditemukan.",
                "error"
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
           Title
        ------------------------------------------------- */

        if (
            elements.videoTitle
        ) {

            elements.videoTitle.value =
                video.title || "";
        }


        /* -------------------------------------------------
           Description
        ------------------------------------------------- */

        if (
            elements.videoDescription
        ) {

            elements.videoDescription.value =
                video.description || "";
        }


        /* -------------------------------------------------
           Category
        ------------------------------------------------- */

        if (
            elements.videoCategory
        ) {

            elements.videoCategory.value =
                video.category || "";
        }


        /* -------------------------------------------------
           Aspect Ratio
        ------------------------------------------------- */

        if (
            elements.videoAspectRatio
        ) {

            elements.videoAspectRatio.value =
                video.aspect_ratio ||
                dashboard.config.defaults.aspectRatio;
        }


        /* -------------------------------------------------
           Sort Order
        ------------------------------------------------- */

        if (
            elements.videoSortOrder
        ) {

            elements.videoSortOrder.value =
                String(
                    Number.isFinite(
                        Number(
                            video.sort_order
                        )
                    )
                        ? Number(
                            video.sort_order
                        )
                        : 0
                );
        }


        /* -------------------------------------------------
           Active
        ------------------------------------------------- */

        if (
            elements.videoIsActive
        ) {

            elements.videoIsActive.checked =
                video.is_active === true;
        }


        /* -------------------------------------------------
           Existing Video
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
           Existing Thumbnail
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


        dashboard.setModalState(
            true,
            "edit",
            video.id
        );


        setModalVisibility(
            true
        );


        focusFirstField();


        return true;
    }


    /* =====================================================
       CLOSE MODAL
    ===================================================== */

    function closeModal() {

        const elements =
            getElements();

        const modal =
            elements.videoModal;


        if (!modal) {
            return;
        }


        /*
         * Hentikan proses close hanya jika upload sedang
         * berlangsung. Upload module dapat mengatur state ini.
         */

        if (
            typeof dashboard.isUploadInProgress ===
            "function" &&
            dashboard.isUploadInProgress()
        ) {

            dashboard.showToast(
                "Tunggu sampai upload selesai.",
                "error"
            );

            return;
        }


        /*
         * Hapus fokus dari elemen modal sebelum modal
         * disembunyikan.
         */

        if (
            document.activeElement &&
            modal.contains(
                document.activeElement
            )
        ) {

            document.activeElement.blur();
        }


        setModalVisibility(
            false
        );


        /*
         * Reset setelah modal tertutup.
         */

        resetForm();


        dashboard.setModalState(
            false,
            null,
            null
        );
    }


    /* =====================================================
       FORCE CLOSE
       Digunakan ketika terjadi error fatal / logout.
    ===================================================== */

    function forceCloseModal() {

        const elements =
            getElements();

        const modal =
            elements.videoModal;


        if (!modal) {
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


        dashboard.setModalState(
            false,
            null,
            null
        );
    }


    /* =====================================================
       FOCUS
    ===================================================== */

    function focusFirstField() {

        const elements =
            getElements();


        const candidates = [

            elements.videoTitle,

            elements.videoDescription,

            elements.videoCategory

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


        if (!field) {
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


        /*
         * Basic focus trap.
         *
         * Tidak menggunakan library tambahan.
         */

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


        /*
         * Hanya backdrop yang boleh menutup modal.
         * Klik isi dialog tidak boleh menutup.
         */

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
       INITIALIZE MODAL
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
         * PENTING:
         * Modal selalu dipaksa tertutup ketika dashboard
         * pertama kali diinisialisasi.
         *
         * Ini mencegah ADMIN / OWNER melihat form edit
         * otomatis hanya karena mode ?edit=1 aktif.
         */

        forceCloseModal();


        /* -------------------------------------------------
           Close button
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           Cancel button
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           Backdrop
        ------------------------------------------------- */

        elements.videoModal.addEventListener(
            "click",
            handleBackdropClick
        );


        /* -------------------------------------------------
           Keyboard
        ------------------------------------------------- */

        document.addEventListener(
            "keydown",
            handleKeydown
        );


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


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.modalReady = true;

})();
