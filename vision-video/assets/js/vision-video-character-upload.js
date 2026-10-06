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
       STATE
    ===================================================== */

    let characterObjectURL = null;
    let initialized = false;


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

        return {

            dropzone:
                get("visionVideoCharacterDropzone"),

            fileInput:
                get("visionVideoCharacterFileInput"),

            uploadState:
                get("visionVideoCharacterUploadState"),

            browseButton:
                get("visionVideoCharacterBrowseButton"),

            previewState:
                get("visionVideoCharacterPreviewState"),

            previewImage:
                get("visionVideoCharacterPreviewImage"),

            fileName:
                get("visionVideoCharacterFileName"),

            fileSize:
                get("visionVideoCharacterFileSize"),

            removeButton:
                get("visionVideoCharacterRemoveButton"),

            notice:
                get("visionVideoCharacterNotice")

        };

    }


    /* =====================================================
       STATE ACCESS
    ===================================================== */

    function getState() {

        return window.GENZVisionVideoState || null;

    }


    /* =====================================================
       CHARACTER STATE
    ===================================================== */

    function setCharacterState(file) {

        const state =
            getState();

        if (!state) {

            return;

        }


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


        if (
            typeof state.set ===
            "function"
        ) {

            state.set(
                "character",
                character
            );

        }

    }


    function clearCharacterState() {

        const state =
            getState();

        if (!state) {

            return;

        }


        if (
            typeof state.set ===
            "function"
        ) {

            state.set(
                "character",
                {

                    file: null,
                    objectUrl: null,
                    name: "",
                    size: 0,
                    type: "",
                    ready: false

                }
            );

        }

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validateFile(file) {

        if (!file) {

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


        if (size < 1024 * 1024) {

            return (
                Math.round(
                    size / 1024
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

        const uploadState =
            elements.uploadState;


        if (uploadState) {

            uploadState.hidden =
                false;

            uploadState.textContent =
                message;

            uploadState.classList.add(
                "is-error"
            );

        }


        showNotice(message);

    }


    /* =====================================================
       UI
    ===================================================== */

    function showUploadState() {

        const elements =
            getElements();


        if (elements.uploadState) {

            elements.uploadState.hidden =
                false;

            elements.uploadState.classList.remove(
                "is-error"
            );

        }


        if (elements.previewState) {

            elements.previewState.hidden =
                true;

        }

    }


    function showPreviewState() {

        const elements =
            getElements();


        if (elements.uploadState) {

            elements.uploadState.hidden =
                true;

        }


        if (elements.previewState) {

            elements.previewState.hidden =
                false;

        }

    }


    /* =====================================================
       LOAD CHARACTER
    ===================================================== */

    function loadCharacter(file) {

        try {

            validateFile(file);


            const elements =
                getElements();


            clearNotice();


            /*
             * Hapus object URL lama.
             */

            if (characterObjectURL) {

                URL.revokeObjectURL(
                    characterObjectURL
                );

                characterObjectURL =
                    null;

            }


            /*
             * Buat preview baru.
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

            if (
                elements.previewImage
            ) {

                elements.previewImage.src =
                    characterObjectURL;

                elements.previewImage.alt =
                    "Replacement Character";

            }


            /*
             * File name.
             */

            if (
                elements.fileName
            ) {

                elements.fileName.textContent =
                    file.name;

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


            showPreviewState();


            /*
             * Active visual state.
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

            }


            /*
             * Event.
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


        if (characterObjectURL) {

            URL.revokeObjectURL(
                characterObjectURL
            );

            characterObjectURL =
                null;

        }


        clearCharacterState();


        if (
            elements.fileInput
        ) {

            elements.fileInput.value =
                "";

        }


        if (
            elements.previewImage
        ) {

            elements.previewImage.removeAttribute(
                "src"
            );

        }


        if (
            elements.fileName
        ) {

            elements.fileName.textContent =
                "-";

        }


        if (
            elements.fileSize
        ) {

            elements.fileSize.textContent =
                "-";

        }


        if (
            elements.previewState
        ) {

            elements.previewState.hidden =
                true;

        }


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
            elements.dropzone
        ) {

            elements.dropzone.classList.remove(
                "has-character"
            );

            elements.dropzone.classList.remove(
                "is-dragover"
            );

        }


        clearNotice();


        document.dispatchEvent(
            new CustomEvent(
                "genz:vision-video:character-removed"
            )
        );

    }


    /* =====================================================
       FILE INPUT
    ===================================================== */

    function handleFileInput(event) {

        const file =
            event.target?.files?.[0];


        if (!file) {

            return;

        }


        loadCharacter(
            file
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
            !files.length
        ) {

            return;

        }


        loadCharacter(
            files[0]
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


        if (
            !elements.fileInput
        ) {

            showError(
                "Input file character tidak ditemukan."
            );

            return;

        }


        elements.fileInput.click();

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
         * Jika yang diklik adalah tombol,
         * handler tombol sendiri yang bekerja.
         */

        if (
            event.target?.closest(
                "#visionVideoCharacterBrowseButton"
            )
        ) {

            return;

        }


        if (
            event.target?.closest(
                "#visionVideoCharacterRemoveButton"
            )
        ) {

            return;

        }


        /*
         * Jika klik area dropzone,
         * buka picker.
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
            event.key !==
                "Enter" &&
            event.key !==
                " "
        ) {

            return;

        }


        event.preventDefault();


        openFilePicker(
            event
        );

    }


    /* =====================================================
       BIND
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
         * Input.
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
                event => {

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

        if (initialized) {

            return true;

        }


        const elements =
            getElements();


        if (
            !elements.dropzone &&
            !elements.fileInput
        ) {

            return false;

        }


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

            return (
                state?.getValue?.(
                    "character.file",
                    null
                ) ||
                null
            );

        },

        getObjectURL() {

            return characterObjectURL;

        },

        isReady() {

            const state =
                getState();

            return Boolean(
                state?.getValue?.(
                    "character.ready",
                    false
                )
            );

        }

    };


    /*
     * Initialize setelah DOM tersedia.
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

    } else {

        initialize();

    }

})();
