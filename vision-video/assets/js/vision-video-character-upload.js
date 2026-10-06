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
       DOM HELPER
    ===================================================== */

    function get(id) {

        return document.getElementById(id);

    }


    /* =====================================================
       ELEMENTS
    ===================================================== */

    function getElements(forceRefresh = false) {

        if (
            !forceRefresh &&
            elementsCache
        ) {

            /*
             * Pastikan element utama masih
             * berada di document.
             */

            if (
                elementsCache.dropzone &&
                document.contains(
                    elementsCache.dropzone
                ) &&
                elementsCache.fileInput &&
                document.contains(
                    elementsCache.fileInput
                )
            ) {

                return elementsCache;

            }

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


        /*
         * State boleh saja belum tersedia
         * ketika upload module pertama kali
         * dijalankan.
         *
         * Upload UI tetap boleh bekerja.
         */

        if (!state) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] Vision Video State belum tersedia. Character tetap diproses secara lokal."
            );

            return false;

        }


        try {

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

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] Gagal menyimpan character ke State.",
                error
            );

            return false;

        }


        console.warn(
            "[GEN-Z.AI Vision Video Character] State tidak memiliki set/update."
        );


        return false;

    }


    /* =====================================================
       CHARACTER STATE
    ===================================================== */

    function createCharacterState(file) {

        return {

            file:
                file || null,

            objectUrl:
                characterObjectURL || null,

            name:
                file?.name || "",

            size:
                Number(
                    file?.size || 0
                ),

            type:
                file?.type || "",

            ready:
                Boolean(file)

        };

    }


    function setCharacterState(file) {

        return setStateValue(
            "character",
            createCharacterState(file)
        );

    }


    function clearCharacterState() {

        return setStateValue(
            "character",
            createCharacterState(null)
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
         * Browser dapat memberikan
         * file.type kosong.
         *
         * Extension tetap menjadi
         * fallback.
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
            getElements(
                true
            );


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
            message ||
            "Character tidak dapat diproses."
        );

    }


    /* =====================================================
       UI STATE
    ===================================================== */

    function showUploadState() {

        const elements =
            getElements(
                true
            );


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
            getElements(
                true
            );


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
            !characterObjectURL
        ) {

            return;

        }


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


    /* =====================================================
       LOAD CHARACTER
    ===================================================== */

    function loadCharacter(file) {

        try {

            const elements =
                getElements(
                    true
                );


            /*
             * Element minimum yang benar-benar
             * dibutuhkan untuk upload.
             */

            if (
                !elements.fileInput
            ) {

                throw new Error(
                    "Input file character belum tersedia."
                );

            }


            if (
                !elements.previewImage
            ) {

                throw new Error(
                    "Preview character belum tersedia."
                );

            }


            if (
                !elements.previewState
            ) {

                throw new Error(
                    "Preview state character belum tersedia."
                );

            }


            /*
             * Validasi.
             */

            validateFile(
                file
            );


            /*
             * Bersihkan error.
             */

            clearNotice();


            /*
             * Bersihkan object URL sebelumnya.
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
             * Simpan state.
             *
             * Kegagalan state tidak boleh
             * membatalkan preview lokal.
             */

            setCharacterState(
                file
            );


            /* =================================================
               PREVIEW
            ================================================= */

            elements.previewImage.src =
                characterObjectURL;


            elements.previewImage.alt =
                file.name ||
                "Replacement Character";


            /*
             * Nama file.
             */

            if (
                elements.fileName
            ) {

                elements.fileName.textContent =
                    file.name ||
                    "-";

            }


            /*
             * Ukuran file.
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
             * Tampilkan preview.
             */

            showPreviewState();


            /*
             * Update class.
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
             * Event.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:character-selected",
                    {
                        detail: {

                            file:
                                file,

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
            getElements(
                true
            );


        /*
         * Object URL.
         */

        revokeCharacterObjectURL();


        /*
         * State.
         */

        clearCharacterState();


        /*
         * Input.
         */

        if (
            elements.fileInput
        ) {

            try {

                elements.fileInput.value =
                    "";

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI Vision Video Character] Tidak dapat reset file input.",
                    error
                );

            }

        }


        /*
         * Preview.
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
         * File name.
         */

        if (
            elements.fileName
        ) {

            elements.fileName.textContent =
                "-";

        }


        /*
         * File size.
         */

        if (
            elements.fileSize
        ) {

            elements.fileSize.textContent =
                "-";

        }


        /*
         * UI.
         */

        showUploadState();


        /*
         * Class.
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
         * Notice.
         */

        clearNotice();


        /*
         * Event.
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
            event.currentTarget ||
            event.target;


        if (
            !input
        ) {

            return;

        }


        const file =
            input.files?.[0] ||
            null;


        if (!file) {

            return;

        }


        loadCharacter(
            file
        );

    }


    /* =====================================================
       OPEN FILE PICKER
    ===================================================== */

    function openFilePicker(event) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        const elements =
            getElements(
                true
            );


        const fileInput =
            elements.fileInput;


        if (
            !fileInput
        ) {

            showError(
                "Input file character tidak ditemukan."
            );

            return false;

        }


        clearNotice();


        /*
         * Pastikan input aktif.
         */

        try {

            fileInput.removeAttribute(
                "disabled"
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] Tidak dapat memastikan input aktif.",
                error
            );

        }


        /*
         * Browser file picker.
         */

        try {

            fileInput.click();

            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI Vision Video Character] File picker gagal dibuka.",
                error
            );


            showError(
                "File picker character tidak dapat dibuka."
            );


            return false;

        }

    }


    /* =====================================================
       BROWSE BUTTON
    ===================================================== */

    function handleBrowseButtonClick(event) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        openFilePicker();

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
         * Jangan trigger picker dari
         * Remove button.
         */

        if (
            event.target?.closest(
                "#visionVideoCharacterRemoveButton"
            )
        ) {

            return;

        }


        /*
         * Browse button punya handler
         * tersendiri.
         */

        if (
            event.target?.closest(
                "#visionVideoCharacterBrowseButton"
            )
        ) {

            return;

        }


        openFilePicker(
            event
        );

    }


    /* =====================================================
       REMOVE BUTTON
    ===================================================== */

    function handleRemoveButtonClick(event) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        removeCharacter();

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
         * dari button.
         */

        if (
            event.target?.closest(
                "button"
            )
        ) {

            return;

        }


        event.preventDefault();

        event.stopPropagation();


        openFilePicker();

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


        loadCharacter(
            files[0]
        );

    }


    /* =====================================================
       BIND EVENTS
    ===================================================== */

    function bind() {

        const elements =
            getElements(
                true
            );


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
         * Hindari binding ganda.
         *
         * Semua listener utama dipasang
         * hanya sekali oleh initialize().
         */

        if (
            elements.fileInput
        ) {

            elements.fileInput.addEventListener(
                "change",
                handleFileInput,
                false
            );

        }


        if (
            elements.browseButton
        ) {

            elements.browseButton.addEventListener(
                "click",
                handleBrowseButtonClick,
                false
            );

        }


        if (
            elements.removeButton
        ) {

            elements.removeButton.addEventListener(
                "click",
                handleRemoveButtonClick,
                false
            );

        }


        if (
            elements.dropzone
        ) {

            elements.dropzone.addEventListener(
                "click",
                handleDropzoneClick,
                false
            );


            elements.dropzone.addEventListener(
                "keydown",
                handleDropzoneKeydown,
                false
            );


            elements.dropzone.addEventListener(
                "dragover",
                handleDragOver,
                false
            );


            elements.dropzone.addEventListener(
                "dragleave",
                handleDragLeave,
                false
            );


            elements.dropzone.addEventListener(
                "drop",
                handleDrop,
                false
            );

        }


        return true;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        /*
         * Jangan double initialize.
         */

        if (
            initialized
        ) {

            return true;

        }


        /*
         * Refresh DOM.
         */

        const elements =
            getElements(
                true
            );


        /*
         * Kalau DOM belum tersedia,
         * jangan mengunci initialized.
         */

        if (
            !elements.dropzone &&
            !elements.fileInput
        ) {

            console.warn(
                "[GEN-Z.AI Vision Video Character] Character upload DOM belum tersedia."
            );


            return false;

        }


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
       RETRY INITIALIZATION
    ===================================================== */

    function scheduleInitialization() {

        /*
         * Attempt pertama.
         */

        initialize();


        /*
         * Jika module lain membangun/
         * mengganti DOM setelahnya,
         * lakukan retry tanpa duplicate
         * karena initialize() memiliki
         * guard initialized.
         */

        if (
            !initialized
        ) {

            requestAnimationFrame(
                () => {

                    if (
                        !initialized
                    ) {

                        initialize();

                    }

                }
            );

        }


        if (
            !initialized
        ) {

            setTimeout(
                () => {

                    if (
                        !initialized
                    ) {

                        initialize();

                    }

                },
                300
            );

        }

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

                try {

                    const character =
                        state.get(
                            "character"
                        );


                    return (
                        character?.file ||
                        null
                    );

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI Vision Video Character] Gagal membaca character state.",
                        error
                    );

                }

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

                try {

                    const character =
                        state.get(
                            "character"
                        );


                    return Boolean(
                        character?.ready
                    );

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI Vision Video Character] Gagal membaca character readiness.",
                        error
                    );

                }

            }


            /*
             * Fallback lokal.
             */

            return Boolean(
                characterObjectURL
            );

        }

    };


    /* =====================================================
       AUTO INITIALIZE
    ===================================================== */

    function autoInitialize() {

        /*
         * DOM masih loading.
         */

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                scheduleInitialization,
                {
                    once: true
                }
            );


            return;

        }


        /*
         * DOM sudah tersedia.
         */

        scheduleInitialization();

    }


    /* =====================================================
       GLOBAL DOM READY FALLBACK
    ===================================================== */

    /*
     * Ini sengaja memakai event delegation
     * tambahan untuk kasus ekstrem ketika
     * element dibuat ulang setelah module
     * initialize.
     *
     * Listener hanya aktif untuk target
     * Character Upload.
     */

    document.addEventListener(
        "click",
        function(event) {

            const browseButton =
                event.target?.closest(
                    "#visionVideoCharacterBrowseButton"
                );


            if (
                browseButton
            ) {

                /*
                 * Kalau sudah ada handler
                 * langsung, jangan melakukan
                 * picker kedua kali.
                 */

                if (
                    initialized
                ) {

                    return;

                }


                handleBrowseButtonClick(
                    event
                );

                return;

            }


            const removeButton =
                event.target?.closest(
                    "#visionVideoCharacterRemoveButton"
                );


            if (
                removeButton &&
                !initialized
            ) {

                handleRemoveButtonClick(
                    event
                );

            }

        },
        true
    );


    /* =====================================================
       START
    ===================================================== */

    autoInitialize();


})();
