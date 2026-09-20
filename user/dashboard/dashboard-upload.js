/* =========================================================
   GEN-Z.AI
   USER DASHBOARD UPLOAD MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-upload.js

   Tanggung jawab:
   - Submit form video
   - Membaca nilai form
   - Validasi form dan file
   - Delegasi CREATE / UPDATE ke DATA MODULE
   - Progress UI
   - Lock form selama proses
   - Refresh data setelah berhasil

   Tidak bertanggung jawab:
   - Query Supabase
   - Storage upload langsung
   - CRUD database langsung
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
       INITIALIZATION GUARD
    ===================================================== */

    let initialized = false;


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
       CONFIG
    ===================================================== */

    function getConfig() {

        return (
            dashboard.config ||
            {}
        );
    }


    /* =====================================================
       ERROR MESSAGE
    ===================================================== */

    function getErrorMessage(
        error
    ) {

        if (
            !error
        ) {

            return "Terjadi kesalahan.";
        }


        if (
            typeof error === "string"
        ) {

            return error;
        }


        const candidates = [

            error.message,

            error.error_description,

            error.details,

            error.hint

        ];


        for (
            let index = 0;
            index < candidates.length;
            index += 1
        ) {

            if (
                typeof candidates[index] ===
                "string" &&
                candidates[index].trim()
            ) {

                return candidates[index].trim();
            }
        }


        return (
            "Terjadi kesalahan saat memproses video."
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
                elements.uploadProgress ||
                null,

            percent:
                elements.uploadProgressPercent ||
                null,

            bar:
                elements.uploadProgressBar ||
                null,

            text:
                elements.uploadProgressText ||
                null
        };
    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function setProgress(
        progress,
        message
    ) {

        const value =
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
         * Simpan ke central state.
         */

        if (
            typeof dashboard.setUploadState ===
            "function"
        ) {

            dashboard.setUploadState(
                value < 100,
                value,
                text
            );

        } else if (
            typeof dashboard.setUploadProgress ===
            "function" &&
            dashboard.setUploadProgress !==
            setProgress
        ) {

            dashboard.setUploadProgress(
                value
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
                value +
                "%";
        }


        if (
            progressElements.bar
        ) {

            progressElements.bar.style.width =
                value +
                "%";

            progressElements.bar.setAttribute(
                "aria-valuenow",
                String(value)
            );
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

            progressElements.bar.setAttribute(
                "aria-valuenow",
                "0"
            );
        }


        if (
            progressElements.text
        ) {

            progressElements.text.textContent =
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


        const sortOrder =
            elements.videoSortOrder
                ? Number(
                    elements.videoSortOrder.value
                )
                : 0;


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
                Number.isFinite(sortOrder)
                    ? sortOrder
                    : 0,


            isActive:
                elements.videoIsActive
                    ? elements.videoIsActive.checked
                    : true
        };
    }


    /* =====================================================
       CURRENT VIDEO
    ===================================================== */

    function getCurrentVideo(
        videoId
    ) {

        if (
            !videoId ||
            typeof dashboard.getVideoById !==
            "function"
        ) {

            return null;
        }


        return dashboard.getVideoById(
            videoId
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

            const modalMode =
                dashboard.getModalMode();


            if (
                modalMode === "create"
            ) {

                return "create";
            }


            if (
                modalMode === "add"
            ) {

                return "create";
            }


            if (
                modalMode === "edit"
            ) {

                return "edit";
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
            : "create";
    }


    /* =====================================================
       FORM VALIDATION
    ===================================================== */

    function validateFormValues(
        data,
        mode
    ) {

        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                "Data form tidak valid."
            );
        }


        /* -------------------------------------------------
           TITLE
        ------------------------------------------------- */

        if (
            !data.title
        ) {

            throw new Error(
                "Judul video wajib diisi."
            );
        }


        if (
            data.title.length > 150
        ) {

            throw new Error(
                "Judul video maksimal 150 karakter."
            );
        }


        /* -------------------------------------------------
           DESCRIPTION
        ------------------------------------------------- */

        if (
            data.description.length > 1000
        ) {

            throw new Error(
                "Deskripsi maksimal 1000 karakter."
            );
        }


        /* -------------------------------------------------
           CATEGORY
        ------------------------------------------------- */

        if (
            !data.category
        ) {

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


        /* -------------------------------------------------
           ASPECT RATIO
        ------------------------------------------------- */

        const config =
            getConfig();


        if (
            Array.isArray(
                config.aspectRatios
            ) &&
            config.aspectRatios.length
        ) {

            if (
                !config.aspectRatios.includes(
                    data.aspectRatio
                )
            ) {

                throw new Error(
                    "Aspect ratio tidak valid."
                );
            }
        }


        /* -------------------------------------------------
           SORT ORDER
        ------------------------------------------------- */

        if (
            !Number.isFinite(
                Number(data.sortOrder)
            )
        ) {

            data.sortOrder =
                0;
        }


        data.sortOrder =
            Math.max(
                0,
                Math.floor(
                    Number(data.sortOrder)
                )
            );


        /* -------------------------------------------------
           VIDEO FILE
        ------------------------------------------------- */

        if (
            mode === "create" &&
            !data.videoFile
        ) {

            throw new Error(
                "File video wajib dipilih."
            );
        }


        /*
         * EDIT:
         * File baru tidak wajib.
         * Data module mempertahankan file lama.
         */

        return data;
    }


    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateFiles(
        data
    ) {

        if (
            data.videoFile
        ) {

            if (
                typeof dashboard.validateVideoFile !==
                "function"
            ) {

                throw new Error(
                    "Validator video belum tersedia."
                );
            }


            dashboard.validateVideoFile(
                data.videoFile
            );
        }


        if (
            data.thumbnailFile
        ) {

            if (
                typeof dashboard.validateThumbnailFile !==
                "function"
            ) {

                throw new Error(
                    "Validator thumbnail belum tersedia."
                );
            }


            dashboard.validateThumbnailFile(
                data.thumbnailFile
            );
        }
    }


    /* =====================================================
       MANAGEMENT GUARD
    ===================================================== */

    function requireManagementAccess() {

        if (
            typeof dashboard.hasManagementAccess ===
            "function"
        ) {

            if (
                !dashboard.hasManagementAccess()
            ) {

                throw new Error(
                    "Anda tidak memiliki akses untuk mengelola video."
                );
            }

        } else if (
            typeof dashboard.isAdmin ===
            "function"
        ) {

            if (
                !dashboard.isAdmin()
            ) {

                throw new Error(
                    "Anda tidak memiliki akses untuk mengelola video."
                );
            }
        }


        if (
            typeof dashboard.isEditMode ===
            "function"
        ) {

            if (
                !dashboard.isEditMode()
            ) {

                throw new Error(
                    "Mode manajemen video tidak aktif."
                );
            }
        }
    }


    /* =====================================================
       FORM DISABLED
    ===================================================== */

    function setFormDisabled(
        disabled
    ) {

        const elements =
            getElements();


        const form =
            elements.videoForm;


        if (
            !form
        ) {

            return;
        }


        const controls =
            form.querySelectorAll(
                "input, textarea, select, button"
            );


        controls.forEach(
            function (control) {

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


        form.setAttribute(
            "aria-busy",
            disabled
                ? "true"
                : "false"
        );


        form.dataset.submitting =
            disabled
                ? "true"
                : "false";
    }


    /* =====================================================
       REFRESH DATA
    ===================================================== */

    async function refreshAfterSave() {

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
       CLOSE MODAL AFTER SUCCESS
    ===================================================== */

    function closeModalAfterSuccess() {

        if (
            typeof dashboard.closeModal ===
            "function"
        ) {

            dashboard.closeModal();
        }
    }


    /* =====================================================
       SUBMIT
    ===================================================== */

    async function submitForm(
        event
    ) {

        if (
            event
        ) {

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


        let mode =
            "create";


        try {

            requireManagementAccess();


            mode =
                getMode();


            const data =
                getFormValues();


            /*
             * Saat edit, pastikan ID benar-benar berasal
             * dari state/form dan record memang tersedia.
             */

            if (
                mode === "edit"
            ) {

                if (
                    !data.videoId
                ) {

                    throw new Error(
                        "Video ID tidak tersedia."
                    );
                }


                const currentVideo =
                    getCurrentVideo(
                        data.videoId
                    );


                if (
                    !currentVideo
                ) {

                    throw new Error(
                        "Video yang akan diedit tidak ditemukan."
                    );
                }
            }


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


        const elements =
            getElements();


        const data =
            getFormValues();


        /*
         * Mulai state saving.
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

            /* -------------------------------------------------
               STEP 1
            ------------------------------------------------- */

            setProgress(
                10,
                mode === "create"
                    ? "Menyiapkan video baru..."
                    : "Menyiapkan perubahan..."
            );


            let result;


            /* -------------------------------------------------
               CREATE
            ------------------------------------------------- */

            if (
                mode === "create"
            ) {

                if (
                    typeof dashboard.createVideo !==
                    "function"
                ) {

                    throw new Error(
                        "Fungsi create video belum tersedia."
                    );
                }


                setProgress(
                    20,
                    "Mengupload video..."
                );


                result =
                    await dashboard.createVideo(
                        data
                    );
            }


            /* -------------------------------------------------
               UPDATE
            ------------------------------------------------- */

            else {

                if (
                    typeof dashboard.updateVideo !==
                    "function"
                ) {

                    throw new Error(
                        "Fungsi update video belum tersedia."
                    );
                }


                setProgress(
                    20,
                    "Mengupdate video..."
                );


                result =
                    await dashboard.updateVideo(
                        data.videoId,
                        data
                    );
            }


            /* -------------------------------------------------
               REFRESH
            ------------------------------------------------- */

            setProgress(
                80,
                "Menyegarkan dashboard..."
            );


            await refreshAfterSave();


            /* -------------------------------------------------
               COMPLETE
            ------------------------------------------------- */

            setProgress(
                100,
                mode === "create"
                    ? "Video berhasil ditambahkan."
                    : "Video berhasil diperbarui."
            );


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
                typeof dashboard.clearError ===
                "function"
            ) {

                dashboard.clearError();
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


            closeModalAfterSuccess();


            showToast(
                mode === "create"
                    ? "Video berhasil ditambahkan."
                    : "Video berhasil diperbarui.",
                "success"
            );


            return (
                result ||
                true
            );

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


            setProgress(
                0,
                message
            );


            showToast(
                message,
                "error"
            );


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
       FILE INFORMATION
    ===================================================== */

    function updateFileHint(
        input,
        output
    ) {

        if (
            !input ||
            !output
        ) {

            return;
        }


        const file =
            input.files &&
            input.files[0]
                ? input.files[0]
                : null;


        if (
            !file
        ) {

            return;
        }


        if (
            typeof dashboard.formatFileSize ===
            "function"
        ) {

            output.textContent =
                file.name +
                " • " +
                dashboard.formatFileSize(
                    file.size
                );

            return;
        }


        output.textContent =
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

    function initializeUpload() {

        if (
            initialized
        ) {

            return true;
        }


        const elements =
            getElements();


        if (
            !elements.videoForm
        ) {

            console.error(
                "[GEN-Z.AI] Dashboard upload: #videoForm tidak ditemukan."
            );


            return false;
        }


        elements.videoForm.addEventListener(
            "submit",
            submitForm
        );


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


        hideProgress();


        initialized =
            true;


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


    dashboard.getDashboardUploadMode =
        getMode;


    /* =====================================================
       READY
    ===================================================== */

    dashboard.uploadReady =
        true;

})();
