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
       LOGGING
    ===================================================== */

    function log() {

        console.log.apply(
            console,
            [
                "[GEN-Z.AI Vision Video Upload]"
            ].concat(
                Array.from(arguments)
            )
        );

    }


    function warn() {

        console.warn.apply(
            console,
            [
                "[GEN-Z.AI Vision Video Upload]"
            ].concat(
                Array.from(arguments)
            )
        );

    }


    function logFile(file) {

        if (!file) {

            log(
                "File: <none>"
            );

            return;

        }

        log(
            "File:",
            {
                name:
                    file.name || "",

                type:
                    file.type || "",

                size:
                    file.size || 0,

                lastModified:
                    file.lastModified || 0
            }
        );

    }


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

            warn(
                "isSupportedVideoFile(): object bukan File.",
                file
            );

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

            log(
                "Video diterima berdasarkan MIME:",
                mimeType
            );

            return true;

        }


        /*
         * Fallback berdasarkan extension.
         */
        const extension =
            getFileExtension(file);


        const supported =
            CONFIG.allowedExtensions.includes(
                extension
            );


        log(
            "Video MIME tidak cocok, fallback extension:",
            {
                extension,
                supported
            }
        );


        return supported;

    }


    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateFile(file) {

        log(
            "Memulai validasi file."
        );

        logFile(file);


        if (!(file instanceof File)) {

            warn(
                "Validasi gagal: object bukan File."
            );

            return {

                valid: false,

                message:
                    "File video tidak valid."

            };

        }


        if (file.size <= 0) {

            warn(
                "Validasi gagal: ukuran file 0 byte."
            );

            return {

                valid: false,

                message:
                    "File video kosong atau rusak."

            };

        }


        if (!isSupportedVideoFile(file)) {

            warn(
                "Validasi gagal: format video tidak didukung.",
                {
                    name:
                        file.name,

                    type:
                        file.type,

                    extension:
                        getFileExtension(file)
                }
            );

            return {

                valid: false,

                message:
                    "Format file tidak didukung. Pilih file video seperti MP4, MOV, WebM, atau format video lainnya."

            };

        }


        log(
            "Validasi file berhasil."
        );


        return {

            valid: true,

            message: ""

        };

    }


    /* =====================================================
       ERROR UI
    ===================================================== */

    function showUploadError(message) {

        warn(
            "Upload error:",
            message
        );


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

        log(
            "Membersihkan upload error state."
        );


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

        log(
            "========================================"
        );

        log(
            "handleFile() dipanggil."
        );

        logFile(file);


        const validation =
            validateFile(file);


        if (!validation.valid) {

            warn(
                "handleFile(): validasi gagal.",
                validation.message
            );


            showUploadError(
                validation.message
            );


            return false;

        }


        log(
            "handleFile(): validasi berhasil."
        );


        try {

            const state =
                getState();


            log(
                "State module ditemukan."
            );


            /*
             * State menjadi satu-satunya pemilik object URL.
             * Upload module tidak membuat URL sendiri.
             */
            if (
                typeof state.setVideo === "function"
            ) {

                log(
                    "Menyimpan video menggunakan state.setVideo()."
                );


                state.setVideo(file);


                log(
                    "state.setVideo() berhasil."
                );

            } else if (
                typeof state.setVisionVideoFile === "function"
            ) {

                log(
                    "Menyimpan video menggunakan state.setVisionVideoFile()."
                );


                state.setVisionVideoFile(file);


                log(
                    "state.setVisionVideoFile() berhasil."
                );

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


                log(
                    "File input value berhasil di-reset."
                );

            } else {

                warn(
                    "File input tidak ditemukan saat reset value."
                );

            }


            /*
             * Preview module akan mengambil video dari state
             * dan menangani metadata / object URL.
             */
            log(
                "Dispatch event: genz:vision-video:file-selected"
            );


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


            log(
                "Event file-selected berhasil di-dispatch."
            );


            log(
                "handleFile(): SELESAI."
            );


            log(
                "========================================"
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

        log(
            "INPUT CHANGE terdeteksi."
        );


        const input =
            event &&
            event.target
                ? event.target
                : getInput();


        if (!input) {

            warn(
                "handleInputChange(): file input tidak ditemukan."
            );

            return;

        }


        const files =
            input.files;


        log(
            "Jumlah file dari input:",
            files
                ? files.length
                : 0
        );


        if (
            !files ||
            files.length === 0
        ) {

            warn(
                "INPUT CHANGE terjadi tetapi tidak ada file."
            );

            return;

        }


        logFile(
            files[0]
        );


        handleFile(
            files[0]
        );

    }


    /* =====================================================
       OPEN FILE PICKER
    ===================================================== */

    function openFilePicker(event) {

        log(
            "openFilePicker() dipanggil."
        );


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


        log(
            "Membuka native file picker."
        );


        input.click();

    }


    /* =====================================================
       DRAG ENTER
    ===================================================== */

    function handleDragEnter(event) {

        event.preventDefault();
        event.stopPropagation();


        log(
            "DRAG ENTER."
        );


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


        log(
            "DRAG LEAVE."
        );


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


        log(
            "DROP terdeteksi."
        );


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

            warn(
                "DROP terjadi tetapi tidak ada file."
            );

            return;

        }


        log(
            "Jumlah file hasil DROP:",
            dataTransfer.files.length
        );


        logFile(
            dataTransfer.files[0]
        );


        handleFile(
            dataTransfer.files[0]
        );

    }


    /* =====================================================
       REMOVE VIDEO
    ===================================================== */

    function removeVideo(event) {

        log(
            "removeVideo() dipanggil."
        );


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

                log(
                    "Mereset video menggunakan state.resetVideo()."
                );


                state.resetVideo();

            } else {

                /*
                 * Fallback untuk state implementation
                 * yang hanya menyediakan reset().
                 */
                if (
                    typeof state.reset === "function"
                ) {

                    log(
                        "Mereset state menggunakan state.reset()."
                    );


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


            log(
                "Video berhasil dihapus."
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

            log(
                "Dropzone keyboard activation:",
                event.key
            );


            event.preventDefault();


            openFilePicker(event);

        }

    }


    /* =====================================================
       BIND EVENTS
    ===================================================== */

    function bind() {

        if (bound) {

            log(
                "bind() dilewati karena module sudah bound."
            );

            return;

        }


        log(
            "Memulai binding upload events..."
        );


        const input =
            getInput();


        const dropzone =
            getDropzone();


        const browseButton =
            getBrowseButton();


        const removeButton =
            getRemoveButton();


        log(
            "DOM upload elements:",
            {
                input:
                    Boolean(input),

                dropzone:
                    Boolean(dropzone),

                browseButton:
                    Boolean(browseButton),

                removeButton:
                    Boolean(removeButton)
            }
        );


        /* -------------------------------------------------
           FILE INPUT
        ------------------------------------------------- */

        if (input) {

            input.addEventListener(
                "change",
                handleInputChange
            );


            log(
                "File input event berhasil di-bind."
            );

        } else {

            warn(
                `Element #${CONFIG.inputId} tidak ditemukan.`
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


            log(
                "Browse button event berhasil di-bind."
            );

        } else {

            warn(
                `Element #${CONFIG.browseButtonId} tidak ditemukan.`
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


            log(
                "Dropzone events berhasil di-bind."
            );

        } else {

            warn(
                `Element #${CONFIG.dropzoneId} tidak ditemukan.`
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


            log(
                "Remove button event berhasil di-bind."
            );

        } else {

            warn(
                `Element #${CONFIG.removeButtonId} tidak ditemukan.`
            );

        }


        bound = true;


        log(
            "Upload module READY."
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
