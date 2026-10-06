/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-upload.js

   Fungsi:
   - File picker
   - Drag & Drop
   - Validasi file video
   - Menyimpan video ke Vision Video State
   - Menghapus video
   - Tidak menangani preview
   - Tidak membaca metadata
   - Tidak melakukan frame extraction
   - Tidak melakukan API analysis
========================================================= */

(function () {

    "use strict";

    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = Object.freeze({

        /*
         * Browser video MIME types yang umum.
         * Extension fallback tetap disediakan karena
         * beberapa browser / file lokal dapat memberikan
         * MIME type kosong atau tidak konsisten.
         */
        allowedMimePrefixes: [
            "video/"
        ],

        allowedExtensions: [
            ".mp4",
            ".mov",
            ".m4v",
            ".webm",
            ".avi",
            ".mkv",
            ".mpeg",
            ".mpg",
            ".3gp",
            ".3g2",
            ".wmv",
            ".flv",
            ".ogv"
        ],

        inputId:
            "visionVideoFileInput",

        dropzoneId:
            "visionVideoDropzone",

        browseButtonId:
            "visionVideoBrowseButton",

        removeButtonId:
            "visionVideoRemoveButton"

    });


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let bound = false;


    /* =====================================================
       DEPENDENCY CHECK
    ===================================================== */

    function getState() {

        const state =
            window.GENZVisionVideoState;

        if (!state) {

            throw new Error(
                "[GEN-Z.AI Vision Video] State module tidak tersedia."
            );

        }

        return state;
    }


    function getDOM() {

        const dom =
            window.GENZVisionVideoDOM;

        if (!dom) {

            throw new Error(
                "[GEN-Z.AI Vision Video] DOM module tidak tersedia."
            );

        }

        return dom;
    }


    /* =====================================================
       ELEMENT ACCESS
    ===================================================== */

    function getInput() {

        return document.getElementById(
            CONFIG.inputId
        );

    }


    function getDropzone() {

        return document.getElementById(
            CONFIG.dropzoneId
        );

    }


    function getBrowseButton() {

        return document.getElementById(
            CONFIG.browseButtonId
        );

    }


    function getRemoveButton() {

        return document.getElementById(
            CONFIG.removeButtonId
        );

    }


    /* =====================================================
       FILE TYPE
    ===================================================== */

    function getFileExtension(file) {

        if (
            !file ||
            typeof file.name !== "string"
        ) {

            return "";

        }

        const name =
            file.name.trim().toLowerCase();

        const lastDot =
            name.lastIndexOf(".");

        if (lastDot === -1) {

            return "";

        }

        return name.slice(lastDot);

    }


    function isSupportedVideoFile(file) {

        if (!(file instanceof File)) {

            return false;

        }

        const mimeType =
            String(file.type || "")
                .trim()
                .toLowerCase();

        /*
         * MIME video/* langsung diterima.
         */
        if (
            CONFIG.allowedMimePrefixes.some(
                prefix => mimeType.startsWith(prefix)
            )
        ) {

            return true;

        }

        /*
         * Fallback berdasarkan extension.
         */
        const extension =
            getFileExtension(file);

        return CONFIG.allowedExtensions.includes(
            extension
        );

    }


    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateFile(file) {

        if (!(file instanceof File)) {

            return {

                valid: false,

                message:
                    "File video tidak valid."

            };

        }

        if (file.size <= 0) {

            return {

                valid: false,

                message:
                    "File video kosong atau rusak."

            };

        }

        if (!isSupportedVideoFile(file)) {

            return {

                valid: false,

                message:
                    "Format file tidak didukung. Pilih file video seperti MP4, MOV, WebM, atau format video lainnya."

            };

        }

        return {

            valid: true,

            message: ""

        };

    }


    /* =====================================================
       ERROR UI
    ===================================================== */

    function showUploadError(message) {

        const dom = getDOM();

        const state =
            window.GENZVisionVideoState;

        /*
         * Reset error process tanpa mengganggu state
         * video yang sedang aktif.
         */
        if (
            state &&
            typeof state.setProcess === "function"
        ) {

            state.setProcess({

                status: "error",

                stage: "upload",

                message: String(message || "Upload gagal."),

                progress: 0

            });

        }

        /*
         * Status utama.
         */
        const status =
            dom.get("status");

        if (status) {

            dom.show(status);

        }

        const indicator =
            dom.get("statusIndicator");

        if (indicator) {

            indicator.classList.remove(
                "is-loading",
                "is-success"
            );

            indicator.classList.add(
                "is-error"
            );

        }

        dom.text(
            "statusText",
            String(message || "Upload gagal.")
        );

        dom.text(
            "progressText",
            ""
        );

        const progressBar =
            dom.get("progressBar");

        if (progressBar) {

            progressBar.style.width = "0%";

        }

    }


    /* =====================================================
       CLEAR ERROR STATE
    ===================================================== */

    function clearUploadError() {

        const state =
            window.GENZVisionVideoState;

        if (
            state &&
            typeof state.setProcess === "function"
        ) {

            state.setProcess({

                status: "idle",

                stage: "",

                message: "",

                progress: 0

            });

        }

    }


    /* =====================================================
       HANDLE FILE
    ===================================================== */

    function handleFile(file) {

        const validation =
            validateFile(file);

        if (!validation.valid) {

            showUploadError(
                validation.message
            );

            return false;

        }

        try {

            const state =
                getState();

            /*
             * State menjadi satu-satunya pemilik object URL.
             * Upload module tidak membuat URL sendiri.
             */
            if (
                typeof state.setVideo === "function"
            ) {

                state.setVideo(file);

            } else if (
                typeof state.setVisionVideoFile === "function"
            ) {

                state.setVisionVideoFile(file);

            } else {

                throw new Error(
                    "State tidak menyediakan fungsi setVideo()."
                );

            }

            clearUploadError();

            /*
             * Reset input value agar file yang sama dapat
             * dipilih ulang setelah dihapus.
             */
            const input =
                getInput();

            if (input) {

                input.value = "";

            }

            /*
             * Preview module akan mengambil video dari state
             * dan menangani metadata / object URL.
             */
            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:file-selected",
                    {
                        detail: {
                            file
                        }
                    }
                )
            );

            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI Vision Video] Gagal menyimpan file:",
                error
            );

            showUploadError(
                error.message ||
                "Video gagal diproses."
            );

            return false;

        }

    }


    /* =====================================================
       INPUT CHANGE
    ===================================================== */

    function handleInputChange(event) {

        const input =
            event &&
            event.target
                ? event.target
                : getInput();

        if (!input) {

            return;

        }

        const files =
            input.files;

        if (
            !files ||
            files.length === 0
        ) {

            return;

        }

        handleFile(
            files[0]
        );

    }


    /* =====================================================
       OPEN FILE PICKER
    ===================================================== */

    function openFilePicker(event) {

        if (event) {

            event.preventDefault();

        }

        const input =
            getInput();

        if (!input) {

            console.warn(
                "[GEN-Z.AI Vision Video] File input tidak ditemukan."
            );

            return;

        }

        input.click();

    }


    /* =====================================================
       DRAG ENTER
    ===================================================== */

    function handleDragEnter(event) {

        event.preventDefault();
        event.stopPropagation();

        const dropzone =
            getDropzone();

        if (dropzone) {

            dropzone.classList.add(
                "is-dragover"
            );

        }

    }


    /* =====================================================
       DRAG OVER
    ===================================================== */

    function handleDragOver(event) {

        event.preventDefault();
        event.stopPropagation();

        /*
         * Penting agar browser mengizinkan drop.
         */
        if (
            event.dataTransfer
        ) {

            event.dataTransfer.dropEffect =
                "copy";

        }

        const dropzone =
            getDropzone();

        if (dropzone) {

            dropzone.classList.add(
                "is-dragover"
            );

        }

    }


    /* =====================================================
       DRAG LEAVE
    ===================================================== */

    function handleDragLeave(event) {

        event.preventDefault();
        event.stopPropagation();

        const dropzone =
            getDropzone();

        if (!dropzone) {

            return;

        }

        /*
         * relatedTarget digunakan supaya class tidak
         * langsung hilang ketika pointer berpindah
         * antar-child di dalam dropzone.
         */
        if (
            event.relatedTarget &&
            dropzone.contains(
                event.relatedTarget
            )
        ) {

            return;

        }

        dropzone.classList.remove(
            "is-dragover"
        );

    }


    /* =====================================================
       DROP
    ===================================================== */

    function handleDrop(event) {

        event.preventDefault();
        event.stopPropagation();

        const dropzone =
            getDropzone();

        if (dropzone) {

            dropzone.classList.remove(
                "is-dragover"
            );

        }

        const dataTransfer =
            event.dataTransfer;

        if (
            !dataTransfer ||
            !dataTransfer.files ||
            dataTransfer.files.length === 0
        ) {

            return;

        }

        handleFile(
            dataTransfer.files[0]
        );

    }


    /* =====================================================
       REMOVE VIDEO
    ===================================================== */

    function removeVideo(event) {

        if (event) {

            event.preventDefault();
            event.stopPropagation();

        }

        try {

            const state =
                getState();

            if (
                typeof state.resetVideo === "function"
            ) {

                state.resetVideo();

            } else {

                /*
                 * Fallback untuk state implementation
                 * yang hanya menyediakan reset().
                 */
                if (
                    typeof state.reset === "function"
                ) {

                    state.reset();

                }

            }

            const input =
                getInput();

            if (input) {

                input.value = "";

            }

            const dropzone =
                getDropzone();

            if (dropzone) {

                dropzone.classList.remove(
                    "is-dragover"
                );

            }

            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:file-removed"
                )
            );

        } catch (error) {

            console.error(
                "[GEN-Z.AI Vision Video] Gagal menghapus video:",
                error
            );

        }

    }


    /* =====================================================
       KEYBOARD SUPPORT
    ===================================================== */

    function handleDropzoneKeydown(event) {

        if (!event) {

            return;

        }

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();

            openFilePicker(event);

        }

    }


    /* =====================================================
       BIND EVENTS
    ===================================================== */

    function bind() {

        if (bound) {

            return;

        }

        const input =
            getInput();

        const dropzone =
            getDropzone();

        const browseButton =
            getBrowseButton();

        const removeButton =
            getRemoveButton();


        /* -------------------------------------------------
           FILE INPUT
        ------------------------------------------------- */

        if (input) {

            input.addEventListener(
                "change",
                handleInputChange
            );

        }


        /* -------------------------------------------------
           BROWSE BUTTON
        ------------------------------------------------- */

        if (browseButton) {

            browseButton.addEventListener(
                "click",
                openFilePicker
            );

        }


        /* -------------------------------------------------
           DROPZONE
        ------------------------------------------------- */

        if (dropzone) {

            dropzone.addEventListener(
                "click",
                function (event) {

                    /*
                     * Jangan membuka picker ketika user
                     * sedang menekan tombol / input internal.
                     */
                    if (
                        event.target.closest(
                            "button, input, a"
                        )
                    ) {

                        return;

                    }

                    openFilePicker(event);

                }
            );

            dropzone.addEventListener(
                "keydown",
                handleDropzoneKeydown
            );

            dropzone.addEventListener(
                "dragenter",
                handleDragEnter
            );

            dropzone.addEventListener(
                "dragover",
                handleDragOver
            );

            dropzone.addEventListener(
                "dragleave",
                handleDragLeave
            );

            dropzone.addEventListener(
                "drop",
                handleDrop
            );

        }


        /* -------------------------------------------------
           REMOVE
        ------------------------------------------------- */

        if (removeButton) {

            removeButton.addEventListener(
                "click",
                removeVideo
            );

        }


        bound = true;

        console.log(
            "[GEN-Z.AI Vision Video] Upload module ready."
        );

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = Object.freeze({

        validateFile,

        isSupportedVideoFile,

        handleFile,

        handleInputChange,

        openFilePicker,

        handleDragEnter,

        handleDragOver,

        handleDragLeave,

        handleDrop,

        removeVideo,

        bind

    });


    /* =====================================================
       EXPORT
    ===================================================== */

    window.GENZVisionVideoUpload =
        API;

    window.GENZVisionVideoUploadReady =
        true;


    /*
     * Loader tetap menjadi pengatur lifecycle.
     * Jika DOM sudah tersedia ketika module dimuat,
     * bind dapat dilakukan oleh loader.
     */
    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                /*
                 * Jangan otomatis bind jika loader belum
                 * mengatur lifecycle. Ini hanya fallback
                 * ketika module dipakai secara mandiri.
                 */
                if (
                    window.GENZVisionVideoState &&
                    window.GENZVisionVideoDOM
                ) {

                    bind();

                }

            },
            {
                once: true
            }
        );

    } else if (
        window.GENZVisionVideoState &&
        window.GENZVisionVideoDOM
    ) {

        bind();

    }

})();
