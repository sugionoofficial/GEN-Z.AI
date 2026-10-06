/* =========================================================
   GEN-Z.AI
   VISION VIDEO CHARACTER UPLOAD
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-character-upload.js

   Fungsi:
   - Upload Replacement Character
   - Browse file
   - Drag & Drop
   - Preview image
   - Remove character
   - Menyimpan character reference ke state
   - Tidak mengubah Video Source
   - Tidak melakukan API request
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = Object.freeze({

        allowedTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/jpg"
        ],

        allowedExtensions: [
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        ]

    });


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let characterObjectURL = null;

    let initialized = false;

    let elementsCache = null;


    /* =====================================================
       DOM
    ===================================================== */

    function get(id) {

        return document.getElementById(id);

    }


    /* =====================================================
       ELEMENTS
    ===================================================== */

    function getElements() {

        if (
            elementsCache &&
            elementsCache.dropzone &&
            elementsCache.fileInput &&
            elementsCache.uploadState &&
            elementsCache.browseButton &&
            elementsCache.previewState &&
            elementsCache.previewImage &&
            elementsCache.fileName &&
            elementsCache.fileSize &&
            elementsCache.removeButton
        ) {

            return elementsCache;

        }


        elementsCache = {

            dropzone:
                get(
                    "visionVideoCharacterDropzone"
                ),

            fileInput:
                get(
                    "visionVideoCharacterFileInput"
                ),

            uploadState:
                get(
                    "visionVideoCharacterUploadState"
                ),

            browseButton:
                get(
                    "visionVideoCharacterBrowseButton"
                ),

            previewState:
                get(
                    "visionVideoCharacterPreviewState"
                ),

            previewImage:
                get(
                    "visionVideoCharacterPreviewImage"
                ),

            fileName:
                get(
                    "visionVideoCharacterFileName"
                ),

            fileSize:
                get(
                    "visionVideoCharacterFileSize"
                ),

            removeButton:
                get(
                    "visionVideoCharacterRemoveButton"
                ),

            notice:
                get(
                    "visionVideoCharacterNotice"
                )

        };


        return elementsCache;

    }


    /* =====================================================
       STATE ACCESS
    ===================================================== */

    function getState() {

        return (
            window.GENZVisionVideoState ||
            null
        );

    }


    /* =====================================================
       STATE SET
    ===================================================== */

    function setStateValue(
        key,
        value
    ) {

        const state =
            getState();


        if (!state) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] Vision Video State belum tersedia."
            );

            return false;

        }


        if (
            typeof state.set ===
            "function"
        ) {

            state.set(
                key,
                value
            );

            return true;

        }


        /*
         * Compatibility fallback.
         */

        if (
            typeof state.update ===
            "function"
        ) {

            state.update(
                key,
                value
            );

            return true;

        }


        console.warn(
            "[GEN-Z.AI Vision Video Character] State tidak memiliki set/update."
        );


        return false;

    }


    /* =====================================================
       CHARACTER STATE
    ===================================================== */

    function setCharacterState(file) {

        const character = {

            file: file,

            objectUrl:
                characterObjectURL,

            name:
                file.name,

            size:
                file.size,

            type:
                file.type,

            ready:
                true

        };


        return setStateValue(
            "character",
            character
        );

    }


    function clearCharacterState() {

        const character = {

            file: null,

            objectUrl: null,

            name: "",

            size: 0,

            type: "",

            ready: false

        };


        return setStateValue(
            "character",
            character
        );

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validateFile(file) {

        if (
            !(file instanceof File)
        ) {

            throw new Error(
                "File character tidak ditemukan."
            );

        }


        const type =
            String(
                file.type || ""
            )
                .trim()
                .toLowerCase();


        const name =
            String(
                file.name || ""
            )
                .trim()
                .toLowerCase();


        const validType =
            CONFIG.allowedTypes.includes(
                type
            );


        const validExtension =
            CONFIG.allowedExtensions.some(
                extension =>
                    name.endsWith(
                        extension
                    )
            );


        /*
         * Browser kadang tidak mengisi
         * file.type secara konsisten.
         *
         * Karena itu extension tetap
         * menjadi fallback.
         */

        if (
            !validType &&
            !validExtension
        ) {

            throw new Error(
                "Format character tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP."
            );

        }


        return true;

    }


    /* =====================================================
       FILE SIZE
    ===================================================== */

    function formatFileSize(bytes) {

        const size =
            Number(bytes);


        if (
            !Number.isFinite(size) ||
            size <= 0
        ) {

            return "0 KB";

        }


        if (
            size < 1024 * 1024
        ) {

            return (
                Math.max(
                    1,
                    Math.round(
                        size / 1024
                    )
                ) +
                " KB"
            );

        }


        return (
            (
                size /
                (1024 * 1024)
            )
                .toFixed(2) +
            " MB"
        );

    }


    /* =====================================================
       NOTICE
    ===================================================== */

    function showNotice(message) {

        const elements =
            getElements();


        const notice =
            elements.notice;


        if (!notice) {

            return;

        }


        notice.textContent =
            message || "";


        notice.hidden =
            !message;

    }


    function clearNotice() {

        showNotice("");

    }


    /* =====================================================
       ERROR
    ===================================================== */

    function showError(message) {

        const elements =
            getElements();


        /*
         * Jangan pernah mengganti
         * innerHTML/textContent uploadState.
         *
         * Upload state berisi:
         * - icon
         * - heading
         * - description
         * - browse button
         * - format info
         *
         * Jika diganti textContent,
         * seluruh kontrol upload hilang.
         */

        if (
            elements.uploadState
        ) {

            elements.uploadState.hidden =
                false;

            elements.uploadState.classList.add(
                "is-error"
            );

        }


        if (
            elements.dropzone
        ) {

            elements.dropzone.classList.add(
                "is-error"
            );

        }


        showNotice(
            message
        );

    }


    /* =====================================================
       UI STATE
    ===================================================== */

    function showUploadState() {

        const elements =
            getElements();


        if (
            elements.uploadState
        ) {

            elements.uploadState.hidden =
                false;

            elements.uploadState.classList.remove(
                "is-error"
            );

        }


        if (
            elements.previewState
        ) {

            elements.previewState.hidden =
                true;

        }

    }


    function showPreviewState() {

        const elements =
            getElements();


        if (
            elements.uploadState
        ) {

            elements.uploadState.hidden =
                true;

        }


        if (
            elements.previewState
        ) {

            elements.previewState.hidden =
                false;

        }

    }


    /* =====================================================
       OBJECT URL
    ===================================================== */

    function revokeCharacterObjectURL() {

        if (
            characterObjectURL
        ) {

            try {

                URL.revokeObjectURL(
                    characterObjectURL
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI Vision Video Character] Failed to revoke object URL.",
                    error
                );

            }

            characterObjectURL =
                null;

        }

    }


    /* =====================================================
       LOAD CHARACTER
    ===================================================== */

    function loadCharacter(file) {

        try {

            /*
             * Pastikan DOM sudah tersedia.
             */

            const elements =
                getElements();


            if (
                !elements.fileInput ||
                !elements.previewImage ||
                !elements.previewState
            ) {

                throw new Error(
                    "Character upload interface belum siap."
                );

            }


            /*
             * Validasi file.
             */

            validateFile(
                file
            );


            /*
             * Bersihkan error.
             */

            clearNotice();


            /*
             * Hapus object URL lama.
             */

            revokeCharacterObjectURL();


            /*
             * Buat object URL baru.
             */

            characterObjectURL =
                URL.createObjectURL(
                    file
                );


            /*
             * Simpan ke state.
             */

            setCharacterState(
                file
            );


            /*
             * Preview image.
             */

            elements.previewImage.src =
                characterObjectURL;


            elements.previewImage.alt =
                file.name ||
                "Replacement Character";


            /*
             * File name.
             */

            if (
                elements.fileName
            ) {

                elements.fileName.textContent =
                    file.name ||
                    "-";

            }


            /*
             * File size.
             */

            if (
                elements.fileSize
            ) {

                elements.fileSize.textContent =
                    formatFileSize(
                        file.size
                    );

            }


            /*
             * UI.
             */

            showPreviewState();


            /*
             * Active state.
             */

            if (
                elements.dropzone
            ) {

                elements.dropzone.classList.add(
                    "has-character"
                );

                elements.dropzone.classList.remove(
                    "is-error"
                );

                elements.dropzone.classList.remove(
                    "is-dragover"
                );

            }


            /*
             * Pastikan input tetap
             * memiliki file yang dipilih.
             */

            /*
             * Jangan mengubah input.value.
             * Browser mengontrol nilainya.
             */


            /*
             * Dispatch event.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:character-selected",
                    {
                        detail: {

                            file: file,

                            objectUrl:
                                characterObjectURL

                        }
                    }
                )
            );


            console.log(
                "[GEN-Z.AI Vision Video Character] Character selected:",
                file.name
            );


            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI Vision Video Character]",
                error
            );


            showError(
                error?.message ||
                "Character tidak dapat diproses."
            );


            return false;

        }

    }


    /* =====================================================
       REMOVE CHARACTER
    ===================================================== */

    function removeCharacter() {

        const elements =
            getElements();


        /*
         * Hapus object URL.
         */

        revokeCharacterObjectURL();


        /*
         * Reset state.
         */

        clearCharacterState();


        /*
         * Reset file input.
         */

        if (
            elements.fileInput
        ) {

            elements.fileInput.value =
                "";

        }


        /*
         * Reset preview.
         */

        if (
            elements.previewImage
        ) {

            elements.previewImage.removeAttribute(
                "src"
            );

            elements.previewImage.alt =
                "";

        }


        /*
         * Reset file name.
         */

        if (
            elements.fileName
        ) {

            elements.fileName.textContent =
                "-";

        }


        /*
         * Reset file size.
         */

        if (
            elements.fileSize
        ) {

            elements.fileSize.textContent =
                "-";

        }


        /*
         * Reset UI.
         */

        showUploadState();


        /*
         * Reset classes.
         */

        if (
            elements.dropzone
        ) {

            elements.dropzone.classList.remove(
                "has-character"
            );

            elements.dropzone.classList.remove(
                "is-dragover"
            );

            elements.dropzone.classList.remove(
                "is-error"
            );

        }


        /*
         * Reset notice.
         */

        clearNotice();


        /*
         * Dispatch event.
         */

        document.dispatchEvent(
            new CustomEvent(
                "genz:vision-video:character-removed"
            )
        );


        console.log(
            "[GEN-Z.AI Vision Video Character] Character removed."
        );

    }


    /* =====================================================
       FILE INPUT
    ===================================================== */

    function handleFileInput(event) {

        const input =
            event.currentTarget;


        const file =
            input?.files?.[0];


        if (!file) {

            return;

        }


        loadCharacter(
            file
        );

    }


    /* =====================================================
       BROWSE
    ===================================================== */

    function openFilePicker(event) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        const elements =
            getElements();


        const fileInput =
            elements.fileInput;


        if (!fileInput) {

            showError(
                "Input file character tidak ditemukan."
            );

            return;

        }


        /*
         * Pastikan error sebelumnya
         * tidak mengunci tampilan.
         */

        clearNotice();


        fileInput.click();

    }


    /* =====================================================
       DROPZONE CLICK
    ===================================================== */

    function handleDropzoneClick(event) {

        const elements =
            getElements();


        if (
            !elements.dropzone
        ) {

            return;

        }


        /*
         * Remove button ditangani
         * oleh handler khusus.
         */

        if (
            event.target?.closest(
                "#visionVideoCharacterRemoveButton"
            )
        ) {

            return;

        }


        /*
         * Browse button juga memiliki
         * handler sendiri.
         */

        if (
            event.target?.closest(
                "#visionVideoCharacterBrowseButton"
            )
        ) {

            return;

        }


        /*
         * Klik area dropzone membuka
         * file picker.
         */

        openFilePicker(
            event
        );

    }


    /* =====================================================
       KEYBOARD
    ===================================================== */

    function handleDropzoneKeydown(event) {

        if (
            event.key !== "Enter" &&
            event.key !== " "
        ) {

            return;

        }


        /*
         * Jangan menangkap keyboard
         * ketika fokus berada di button.
         */

        if (
            event.target?.closest(
                "button"
            )
        ) {

            return;

        }


        event.preventDefault();


        openFilePicker(
            event
        );

    }


    /* =====================================================
       DRAG OVER
    ===================================================== */

    function handleDragOver(event) {

        event.preventDefault();

        event.stopPropagation();


        const elements =
            getElements();


        if (
            elements.dropzone
        ) {

            elements.dropzone.classList.add(
                "is-dragover"
            );

        }


        if (
            event.dataTransfer
        ) {

            event.dataTransfer.dropEffect =
                "copy";

        }

    }


    /* =====================================================
       DRAG LEAVE
    ===================================================== */

    function handleDragLeave(event) {

        event.preventDefault();

        event.stopPropagation();


        const elements =
            getElements();


        if (
            elements.dropzone
        ) {

            elements.dropzone.classList.remove(
                "is-dragover"
            );

        }

    }


    /* =====================================================
       DROP
    ===================================================== */

    function handleDrop(event) {

        event.preventDefault();

        event.stopPropagation();


        const elements =
            getElements();


        if (
            elements.dropzone
        ) {

            elements.dropzone.classList.remove(
                "is-dragover"
            );

        }


        const files =
            event.dataTransfer?.files;


        if (
            !files ||
            files.length === 0
        ) {

            return;

        }


        /*
         * Ambil file pertama.
         */

        const file =
            files[0];


        loadCharacter(
            file
        );

    }


    /* =====================================================
       BIND EVENTS
    ===================================================== */

    function bind() {

        const elements =
            getElements();


        if (
            !elements.dropzone &&
            !elements.fileInput
        ) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] Character upload DOM belum tersedia."
            );


            return false;

        }


        /*
         * File input.
         */

        if (
            elements.fileInput
        ) {

            elements.fileInput.addEventListener(
                "change",
                handleFileInput
            );

        }


        /*
         * Browse button.
         */

        if (
            elements.browseButton
        ) {

            elements.browseButton.addEventListener(
                "click",
                openFilePicker
            );

        }


        /*
         * Remove button.
         */

        if (
            elements.removeButton
        ) {

            elements.removeButton.addEventListener(
                "click",
                function(event) {

                    event.preventDefault();

                    event.stopPropagation();


                    removeCharacter();

                }
            );

        }


        /*
         * Dropzone.
         */

        if (
            elements.dropzone
        ) {

            elements.dropzone.addEventListener(
                "click",
                handleDropzoneClick
            );


            elements.dropzone.addEventListener(
                "keydown",
                handleDropzoneKeydown
            );


            elements.dropzone.addEventListener(
                "dragover",
                handleDragOver
            );


            elements.dropzone.addEventListener(
                "dragleave",
                handleDragLeave
            );


            elements.dropzone.addEventListener(
                "drop",
                handleDrop
            );

        }


        return true;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        /*
         * Jangan initialize dua kali.
         */

        if (
            initialized
        ) {

            return true;

        }


        /*
         * Pastikan DOM sudah tersedia.
         */

        const elements =
            getElements();


        if (
            !elements.dropzone &&
            !elements.fileInput
        ) {

            return false;

        }


        /*
         * Pastikan element penting tersedia.
         */

        if (
            !elements.fileInput
        ) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] File input tidak ditemukan."
            );


            return false;

        }


        if (
            !elements.dropzone
        ) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] Dropzone tidak ditemukan."
            );


            return false;

        }


        /*
         * Bind.
         */

        const bound =
            bind();


        if (!bound) {

            return false;

        }


        initialized =
            true;


        window.GENZVisionVideoCharacterUploadReady =
            true;


        console.log(
            "[GEN-Z.AI Vision Video Character] Character upload ready."
        );


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZVisionVideoCharacterUpload = {

        initialize,

        loadCharacter,

        removeCharacter,

        validateFile,

        getFile() {

            const state =
                getState();


            if (
                state &&
                typeof state.getValue ===
                "function"
            ) {

                return (
                    state.getValue(
                        "character.file",
                        null
                    ) ||
                    null
                );

            }


            if (
                state &&
                typeof state.get ===
                "function"
            ) {

                const character =
                    state.get(
                        "character"
                    );


                return (
                    character?.file ||
                    null
                );

            }


            return null;

        },

        getObjectURL() {

            return (
                characterObjectURL ||
                null
            );

        },

        isReady() {

            const state =
                getState();


            if (
                state &&
                typeof state.getValue ===
                "function"
            ) {

                return Boolean(
                    state.getValue(
                        "character.ready",
                        false
                    )
                );

            }


            if (
                state &&
                typeof state.get ===
                "function"
            ) {

                const character =
                    state.get(
                        "character"
                    );


                return Boolean(
                    character?.ready
                );

            }


            return false;

        }

    };


    /* =====================================================
       AUTO INITIALIZE
    ===================================================== */

    function autoInitialize() {

        /*
         * Jika DOM belum selesai,
         * tunggu DOMContentLoaded.
         */

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                initialize,
                {
                    once: true
                }
            );


            return;

        }


        /*
         * DOM sudah tersedia.
         */

        initialize();

    }


    autoInitialize();


})();
