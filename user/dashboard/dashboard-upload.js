/* =========================================================
   GEN-Z.AI
   USER DASHBOARD UPLOAD MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-upload.js

   Tanggung jawab:
   - Submit form video
   - Membaca nilai form
   - Validasi file
   - Menjalankan create / update melalui DATA MODULE
   - Menampilkan status proses
   - Mengunci form selama proses
   - Menutup modal setelah berhasil
   - Memicu refresh/render setelah operasi

   Tidak bertanggung jawab:
   - Query Supabase secara langsung
   - Storage upload secara langsung
   - CRUD database secara langsung
   - Render card
   - Auth
   - Navigation
   - Modal lifecycle utama
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
            dashboard.elements.videoForm
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
       ERROR MESSAGE
    ===================================================== */

    function getErrorMessage(error) {

        if (!error) {
            return "Terjadi kesalahan.";
        }


        if (
            typeof error === "string"
        ) {
            return error;
        }


        if (
            typeof error.message ===
            "string" &&
            error.message.trim()
        ) {
            return error.message.trim();
        }


        if (
            typeof error.error_description ===
            "string" &&
            error.error_description.trim()
        ) {
            return error.error_description.trim();
        }


        if (
            typeof error.details ===
            "string" &&
            error.details.trim()
        ) {
            return error.details.trim();
        }


        if (
            typeof error.hint ===
            "string" &&
            error.hint.trim()
        ) {
            return error.hint.trim();
        }


        return "Terjadi kesalahan saat memproses video.";
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


        /*
         * Fallback sederhana.
         * Tidak membuat komponen UI baru.
         */

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
       PROGRESS ELEMENTS
    ===================================================== */

    function getProgressElements() {

        const elements =
            getElements();

        return {
            container:
                elements.uploadProgress || null,

            percent:
                elements.uploadProgressPercent || null,

            bar:
                elements.uploadProgressBar || null,

            text:
                elements.uploadProgressText || null
        };
    }


    /* =====================================================
       PROGRESS UI
    ===================================================== */

    function setProgress(
        progress,
        message
    ) {

        const numericProgress =
            Number.isFinite(
                Number(progress)
            )
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        Number(progress)
                    )
                )
                : 0;


        const text =
            typeof message === "string"
                ? message
                : "";


        /*
         * Simpan state.
         */

        if (
            typeof dashboard.setUploadState ===
            "function"
        ) {

            dashboard.setUploadState(
                numericProgress < 100,
                numericProgress,
                text
            );
        }


        const progressElements =
            getProgressElements();


        if (
            progressElements.container
        ) {

            progressElements.container.hidden =
                false;
        }


        if (
            progressElements.percent
        ) {

            progressElements.percent.textContent =
                numericProgress +
                "%";
        }


        if (
            progressElements.bar
        ) {

            progressElements.bar.style.width =
                numericProgress +
                "%";
        }


        if (
            progressElements.text
        ) {

            progressElements.textContent =
                text;
        }
    }


    function hideProgress() {

        const progressElements =
            getProgressElements();


        if (
            progressElements.container
        ) {

            progressElements.container.hidden =
                true;
        }


        if (
            progressElements.percent
        ) {

            progressElements.percent.textContent =
                "0%";
        }


        if (
            progressElements.bar
        ) {

            progressElements.bar.style.width =
                "0%";
        }


        if (
            progressElements.text
        ) {

            progressElements.textContent =
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
       FORM VALUES
    ===================================================== */

    function getFormValues() {

        const elements =
            getElements();


        return {

            videoId:
                elements.videoId
                    ? String(
                        elements.videoId.value ||
                        ""
                    ).trim()
                    : "",


            title:
                elements.videoTitle
                    ? String(
                        elements.videoTitle.value ||
                        ""
                    ).trim()
                    : "",


            description:
                elements.videoDescription
                    ? String(
                        elements.videoDescription.value ||
                        ""
                    ).trim()
                    : "",


            category:
                elements.videoCategory
                    ? String(
                        elements.videoCategory.value ||
                        ""
                    ).trim()
                    : "",


            aspectRatio:
                elements.videoAspectRatio
                    ? String(
                        elements.videoAspectRatio.value ||
                        ""
                    ).trim()
                    : "",


            videoFile:
                elements.videoFile &&
                elements.videoFile.files &&
                elements.videoFile.files[0]
                    ? elements.videoFile.files[0]
                    : null,


            thumbnailFile:
                elements.thumbnailFile &&
                elements.thumbnailFile.files &&
                elements.thumbnailFile.files[0]
                    ? elements.thumbnailFile.files[0]
                    : null,


            sortOrder:
                elements.videoSortOrder
                    ? Number(
                        elements.videoSortOrder.value
                    )
                    : 0,


            isActive:
                elements.videoIsActive
                    ? elements.videoIsActive.checked
                    : true
        };
    }


    /* =====================================================
       BASIC FORM VALIDATION
    ===================================================== */

    function validateFormValues(
        data,
        mode
    ) {

        if (!data.title) {

            throw new Error(
                "Judul video wajib diisi."
            );
        }


        if (
            data.title.length >
            150
        ) {

            throw new Error(
                "Judul video maksimal 150 karakter."
            );
        }


        if (
            data.description.length >
            1000
        ) {

            throw new Error(
                "Deskripsi maksimal 1000 karakter."
            );
        }


        if (!data.category) {

            throw new Error(
                "Kategori video wajib dipilih."
            );
        }


        if (
            typeof dashboard.getCategoryValues ===
            "function"
        ) {

            const categories =
                dashboard.getCategoryValues();


            if (
                Array.isArray(categories) &&
                categories.length &&
                !categories.includes(
                    data.category
                )
            ) {

                throw new Error(
                    "Kategori video tidak valid."
                );
            }
        }


        if (
            typeof dashboard.config !==
            "undefined" &&
            dashboard.config &&
            Array.isArray(
                dashboard.config.aspectRatios
            ) &&
            dashboard.config.aspectRatios.length
        ) {

            if (
                !dashboard.config.aspectRatios.includes(
                    data.aspectRatio
                )
            ) {

                throw new Error(
                    "Aspect ratio tidak valid."
                );
            }
        }


        if (
            !Number.isFinite(
                data.sortOrder
            ) ||
            data.sortOrder < 0
        ) {

            data.sortOrder = 0;
        }


        data.sortOrder =
            Math.floor(
                data.sortOrder
            );


        /*
         * Tambah:
         * File video wajib.
         *
         * Edit:
         * File video hanya wajib jika
         * belum ada file lama.
         */

        if (
            mode === "add" &&
            !data.videoFile
        ) {

            throw new Error(
                "File video wajib dipilih."
            );
        }


        /*
         * Thumbnail tidak diwajibkan.
         * Ini menjaga kompatibilitas dengan
         * data lama yang mungkin tidak mempunyai
         * thumbnail.
         */


        return data;
    }


    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateFiles(data) {

        if (
            data.videoFile &&
            typeof dashboard.validateVideoFile ===
            "function"
        ) {

            dashboard.validateVideoFile(
                data.videoFile
            );
        }


        if (
            data.thumbnailFile &&
            typeof dashboard.validateThumbnailFile ===
            "function"
        ) {

            dashboard.validateThumbnailFile(
                data.thumbnailFile
            );
        }
    }


    /* =====================================================
       DISABLE FORM
    ===================================================== */

    function setFormDisabled(
        disabled
    ) {

        const elements =
            getElements();


        const form =
            elements.videoForm;


        if (!form) {
            return;
        }


        const controls =
            form.querySelectorAll(
                "input, textarea, select, button"
            );


        controls.forEach(
            function (control) {

                /*
                 * Jangan mengubah hidden input.
                 */

                if (
                    control.type ===
                    "hidden"
                ) {
                    return;
                }


                control.disabled =
                    disabled;
            }
        );


        /*
         * Tandai form.
         */

        form.setAttribute(
            "aria-busy",
            disabled
                ? "true"
                : "false"
        );
    }


    /* =====================================================
       MODE
    ===================================================== */

    function getMode() {

        if (
            typeof dashboard.getModalMode ===
            "function"
        ) {

            const mode =
                dashboard.getModalMode();


            if (
                mode === "edit" ||
                mode === "add"
            ) {

                return mode;
            }
        }


        const elements =
            getElements();


        const videoId =
            elements.videoId
                ? String(
                    elements.videoId.value ||
                    ""
                ).trim()
                : "";


        return videoId
            ? "edit"
            : "add";
    }


    /* =====================================================
       SUCCESS REFRESH
    ===================================================== */

    async function refreshAfterSave() {

        /*
         * Jangan mengandalkan state lokal saja.
         *
         * Setelah CREATE / UPDATE, reload dari Supabase
         * agar data yang tampil benar-benar berasal dari
         * database.
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

            return;
        }


        if (
            typeof dashboard.renderDashboard ===
            "function"
        ) {

            dashboard.renderDashboard();
        }
    }


    /* =====================================================
       CLOSE MODAL
    ===================================================== */

    function closeModalAfterSuccess() {

        if (
            typeof dashboard.closeModal ===
            "function"
        ) {

            dashboard.closeModal();

            return;
        }


        if (
            dashboard.modal &&
            typeof dashboard.modal.close ===
            "function"
        ) {

            dashboard.modal.close();
        }
    }


    /* =====================================================
       SUBMIT
    ===================================================== */

    async function submitForm(
        event
    ) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();
        }


        if (
            typeof dashboard.isUploadInProgress ===
            "function" &&
            dashboard.isUploadInProgress()
        ) {

            return false;
        }


        /*
         * Management access tetap diverifikasi di sini
         * sebagai guard tambahan.
         */

        if (
            typeof dashboard.isAdmin ===
            "function" &&
            !dashboard.isAdmin()
        ) {

            showToast(
                "Anda tidak memiliki akses untuk mengelola video.",
                "error"
            );

            return false;
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

            return false;
        }


        const elements =
            getElements();


        const mode =
            getMode();


        let data;


        try {

            data =
                getFormValues();


            validateFormValues(
                data,
                mode
            );


            validateFiles(
                data
            );

        } catch (error) {

            const message =
                getErrorMessage(
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
                message,
                "error"
            );


            return false;
        }


        /*
         * Mulai proses.
         */

        if (
            typeof dashboard.setSaving ===
            "function"
        ) {

            dashboard.setSaving(
                true
            );
        }


        if (
            typeof dashboard.setUploadState ===
            "function"
        ) {

            dashboard.setUploadState(
                true,
                0,
                "Menyiapkan proses..."
            );
        }


        setFormDisabled(
            true
        );


        try {

            /*
             * Tahap 1
             */

            setProgress(
                10,
                mode === "add"
                    ? "Menyiapkan video baru..."
                    : "Menyiapkan perubahan..."
            );


            let result;


            /* =================================================
               CREATE
            ================================================= */

            if (
                mode === "add"
            ) {

                if (
                    typeof dashboard.createVideo !==
                    "function"
                ) {

                    throw new Error(
                        "Module data video belum tersedia."
                    );
                }


                setProgress(
                    20,
                    "Mengupload dan menyimpan video..."
                );


                result =
                    await dashboard.createVideo(
                        data
                    );
            }


            /* =================================================
               UPDATE
            ================================================= */

            else {

                if (
                    !data.videoId
                ) {

                    throw new Error(
                        "Video ID tidak tersedia."
                    );
                }


                if (
                    typeof dashboard.updateVideo !==
                    "function"
                ) {

                    throw new Error(
                        "Module data video belum tersedia."
                    );
                }


                setProgress(
                    20,
                    "Mengupdate data video..."
                );


                result =
                    await dashboard.updateVideo(
                        data.videoId,
                        data
                    );
            }


            /*
             * Data module menggunakan Supabase Storage
             * dan Database secara berurutan.
             *
             * Karena Supabase Storage upload standar tidak
             * memberikan progress byte-level pada API yang
             * digunakan module data, angka di bawah adalah
             * progress tahap proses, bukan persentase byte
             * upload.
             */

            setProgress(
                80,
                "Menyegarkan data dashboard..."
            );


            await refreshAfterSave();


            setProgress(
                100,
                mode === "add"
                    ? "Video berhasil ditambahkan."
                    : "Video berhasil diperbarui."
            );


            /*
             * Beri waktu singkat agar status 100% terlihat.
             */

            await new Promise(
                function (resolve) {

                    setTimeout(
                        resolve,
                        180
                    );

                }
            );


            hideProgress();


            if (
                typeof dashboard.setSaving ===
                "function"
            ) {

                dashboard.setSaving(
                    false
                );
            }


            if (
                typeof dashboard.clearError ===
                "function"
            ) {

                dashboard.clearError();
            }


            setFormDisabled(
                false
            );


            closeModalAfterSuccess();


            showToast(
                mode === "add"
                    ? "Video berhasil ditambahkan."
                    : "Video berhasil diperbarui.",
                "success"
            );


            return result || true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI Dashboard Upload]",
                error
            );


            const message =
                getErrorMessage(
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


            setProgress(
                0,
                message
            );


            if (
                typeof dashboard.setUploadState ===
                "function"
            ) {

                dashboard.setUploadState(
                    false,
                    0,
                    message
                );
            }


            if (
                typeof dashboard.setSaving ===
                "function"
            ) {

                dashboard.setSaving(
                    false
                );
            }


            setFormDisabled(
                false
            );


            showToast(
                message,
                "error"
            );


            /*
             * Progress tetap ditampilkan sebentar supaya
             * user tahu proses gagal, kemudian disembunyikan.
             */

            setTimeout(
                function () {

                    if (
                        typeof dashboard.isUploadInProgress !==
                        "function" ||
                        !dashboard.isUploadInProgress()
                    ) {

                        hideProgress();
                    }

                },
                1200
            );


            return false;
        }
    }


    /* =====================================================
       FILE INPUT PREVIEW / INFO
    ===================================================== */

    function updateFileHint(
        input,
        hintElement
    ) {

        if (
            !input ||
            !hintElement
        ) {
            return;
        }


        const file =
            input.files &&
            input.files[0]
                ? input.files[0]
                : null;


        if (!file) {
            return;
        }


        if (
            typeof dashboard.formatFileSize ===
            "function"
        ) {

            hintElement.textContent =
                file.name +
                " • " +
                dashboard.formatFileSize(
                    file.size
                );

            return;
        }


        hintElement.textContent =
            file.name;
    }


    function handleVideoFileChange() {

        const elements =
            getElements();


        updateFileHint(
            elements.videoFile,
            elements.currentVideoFile
        );
    }


    function handleThumbnailFileChange() {

        const elements =
            getElements();


        updateFileHint(
            elements.thumbnailFile,
            elements.currentThumbnailFile
        );
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    let initialized = false;


    function initializeUpload() {

        if (initialized) {
            return true;
        }


        const elements =
            getElements();


        if (
            !elements.videoForm
        ) {

            console.error(
                "[GEN-Z.AI] Dashboard upload: videoForm tidak ditemukan."
            );

            return false;
        }


        /*
         * Submit handler.
         */

        elements.videoForm.addEventListener(
            "submit",
            submitForm
        );


        /*
         * File info.
         */

        if (
            elements.videoFile
        ) {

            elements.videoFile.addEventListener(
                "change",
                handleVideoFileChange
            );
        }


        if (
            elements.thumbnailFile
        ) {

            elements.thumbnailFile.addEventListener(
                "change",
                handleThumbnailFileChange
            );
        }


        /*
         * State awal.
         */

        hideProgress();


        initialized = true;


        return true;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    dashboard.setUploadProgress =
        setProgress;

    dashboard.hideUploadProgress =
        hideProgress;

    dashboard.getDashboardFormValues =
        getFormValues;

    dashboard.validateDashboardForm =
        validateFormValues;

    dashboard.submitDashboardForm =
        submitForm;

    dashboard.initializeUpload =
        initializeUpload;

    dashboard.setDashboardFormDisabled =
        setFormDisabled;


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.uploadReady =
        true;

})();
