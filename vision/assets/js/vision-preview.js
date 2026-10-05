// =========================================================
// GEN-Z.AI
// VISION ENGINE
// ---------------------------------------------------------
// File:
// vision/assets/js/vision-preview.js
//
// Fungsi:
// - Preview reference image
// - Preview replacement character
// - Update informasi file
// - Dropzone active state
// - Clear reference preview
// - Clear replacement character preview
// - Restore preview dari state
// - Tidak mengubah logic API / credit / history
// =========================================================

(function () {

    "use strict";


    // =====================================================
    // MODULE GETTERS
    // =====================================================

    function getState() {

        if (!window.GENZVisionState) {

            throw new Error(
                "GENZVisionState belum tersedia."
            );

        }

        return window.GENZVisionState;

    }


    function getDOM() {

        if (!window.GENZVisionDOM) {

            throw new Error(
                "GENZVisionDOM belum tersedia."
            );

        }


        if (
            typeof window.GENZVisionDOM.getDOM !==
            "function"
        ) {

            throw new Error(
                "GENZVisionDOM.getDOM() belum tersedia."
            );

        }


        return window.GENZVisionDOM.getDOM();

    }


    // =====================================================
    // INTERNAL HELPERS
    // =====================================================

    function isValidDataUrl(
        dataUrl
    ) {

        return (
            typeof dataUrl === "string" &&
            dataUrl.trim().length > 0
        );

    }


    function formatFileSize(
        bytes
    ) {

        const size =
            Number(bytes);


        if (
            !Number.isFinite(size) ||
            size <= 0
        ) {

            return "Unknown size";

        }


        if (
            size < 1024
        ) {

            return `${size} B`;

        }


        if (
            size < 1024 * 1024
        ) {

            return `${(
                size / 1024
            ).toFixed(1)} KB`;

        }


        return `${(
            size / (
                1024 * 1024
            )
        ).toFixed(2)} MB`;

    }


    // =====================================================
    // REFERENCE IMAGE
    // =====================================================

    function setPreviewImage(
        dataUrl
    ) {

        const dom =
            getDOM();


        if (!dom.previewImage) {

            return false;

        }


        if (
            !isValidDataUrl(
                dataUrl
            )
        ) {

            dom.previewImage.removeAttribute(
                "src"
            );

            dom.previewImage.removeAttribute(
                "alt"
            );

            return false;

        }


        dom.previewImage.src =
            dataUrl;


        dom.previewImage.alt =
            "Vision reference image";


        return true;

    }


    // =====================================================
    // REFERENCE INFORMATION
    // =====================================================

    function updatePreviewInformation(
        file
    ) {

        const dom =
            getDOM();


        if (!file) {

            return false;

        }


        if (
            dom.previewName
        ) {

            dom.previewName.textContent =
                file.name ||
                file.original?.name ||
                "Reference image";

        }


        if (
            dom.previewSize
        ) {

            dom.previewSize.textContent =
                formatFileSize(
                    file.size ||
                    file.original?.size
                );

        }


        return true;

    }


    // =====================================================
    // REFERENCE UPLOAD STATE
    // =====================================================

    function showUploadState() {

        const dom =
            getDOM();


        if (
            dom.uploadState
        ) {

            dom.uploadState.hidden =
                false;


            dom.uploadState.classList.remove(
                "vision-hidden"
            );

        }


        if (
            dom.previewState
        ) {

            dom.previewState.hidden =
                true;


            dom.previewState.classList.add(
                "vision-hidden"
            );


            dom.previewState.classList.remove(
                "is-visible"
            );

        }

    }


    // =====================================================
    // REFERENCE PREVIEW STATE
    // =====================================================

    function showPreviewState() {

        const dom =
            getDOM();


        if (
            dom.uploadState
        ) {

            dom.uploadState.hidden =
                true;


            dom.uploadState.classList.add(
                "vision-hidden"
            );

        }


        if (
            dom.previewState
        ) {

            dom.previewState.hidden =
                false;


            dom.previewState.classList.remove(
                "vision-hidden"
            );


            dom.previewState.classList.add(
                "is-visible"
            );

        }

    }


    // =====================================================
    // REFERENCE DROPZONE STATE
    // =====================================================

    function setDropzoneActive(
        active
    ) {

        const dom =
            getDOM();


        if (
            !dom.dropzone
        ) {

            return;

        }


        dom.dropzone.classList.toggle(
            "is-dragover",
            active === true
        );

    }


    // =====================================================
    // REFERENCE CLEAR IMAGE
    // =====================================================

    function clearPreviewImage() {

        const dom =
            getDOM();


        if (
            !dom.previewImage
        ) {

            return;

        }


        dom.previewImage.removeAttribute(
            "src"
        );


        dom.previewImage.removeAttribute(
            "alt"
        );

    }


    // =====================================================
    // REFERENCE CLEAR PREVIEW
    // =====================================================

    function clearPreview() {

        const dom =
            getDOM();


        clearPreviewImage();


        if (
            dom.previewName
        ) {

            dom.previewName.textContent =
                "";

        }


        if (
            dom.previewSize
        ) {

            dom.previewSize.textContent =
                "";

        }


        setDropzoneActive(
            false
        );


        showUploadState();

    }


    // =====================================================
    // REFERENCE RENDER
    // =====================================================

    function renderPreview(
        file
    ) {

        if (!file) {

            clearPreview();

            return false;

        }


        const imageSet =
            setPreviewImage(
                file.dataUrl
            );


        if (!imageSet) {

            showUploadState();

            return false;

        }


        updatePreviewInformation(
            file
        );


        showPreviewState();


        return true;

    }


    // =====================================================
    // REPLACEMENT CHARACTER IMAGE
    // =====================================================

    function setCharacterPreviewImage(
        dataUrl
    ) {

        const dom =
            getDOM();


        if (
            !dom.characterPreviewImage
        ) {

            return false;

        }


        if (
            !isValidDataUrl(
                dataUrl
            )
        ) {

            dom.characterPreviewImage
                .removeAttribute(
                    "src"
                );


            dom.characterPreviewImage
                .removeAttribute(
                    "alt"
                );


            return false;

        }


        dom.characterPreviewImage.src =
            dataUrl;


        dom.characterPreviewImage.alt =
            "Replacement character image";


        return true;

    }


    // =====================================================
    // REPLACEMENT CHARACTER INFORMATION
    // =====================================================

    function updateCharacterPreviewInformation(
        file
    ) {

        const dom =
            getDOM();


        if (!file) {

            return false;

        }


        if (
            dom.characterPreviewName
        ) {

            dom.characterPreviewName.textContent =
                file.name ||
                file.original?.name ||
                "Replacement character";

        }


        if (
            dom.characterPreviewSize
        ) {

            dom.characterPreviewSize.textContent =
                formatFileSize(
                    file.size ||
                    file.original?.size
                );

        }


        return true;

    }


    // =====================================================
    // REPLACEMENT CHARACTER UPLOAD STATE
    // =====================================================

    function showCharacterUploadState() {

        const dom =
            getDOM();


        if (
            dom.characterUploadState
        ) {

            dom.characterUploadState.hidden =
                false;


            dom.characterUploadState.classList.remove(
                "vision-hidden"
            );

        }


        if (
            dom.characterPreviewState
        ) {

            dom.characterPreviewState.hidden =
                true;


            dom.characterPreviewState.classList.add(
                "vision-hidden"
            );


            dom.characterPreviewState.classList.remove(
                "is-visible"
            );

        }

    }


    // =====================================================
    // REPLACEMENT CHARACTER PREVIEW STATE
    // =====================================================

    function showCharacterPreviewState() {

        const dom =
            getDOM();


        if (
            dom.characterUploadState
        ) {

            dom.characterUploadState.hidden =
                true;


            dom.characterUploadState.classList.add(
                "vision-hidden"
            );

        }


        if (
            dom.characterPreviewState
        ) {

            dom.characterPreviewState.hidden =
                false;


            dom.characterPreviewState.classList.remove(
                "vision-hidden"
            );


            dom.characterPreviewState.classList.add(
                "is-visible"
            );

        }

    }


    // =====================================================
    // REPLACEMENT CHARACTER CLEAR IMAGE
    // =====================================================

    function clearCharacterPreviewImage() {

        const dom =
            getDOM();


        if (
            !dom.characterPreviewImage
        ) {

            return;

        }


        dom.characterPreviewImage
            .removeAttribute(
                "src"
            );


        dom.characterPreviewImage
            .removeAttribute(
                "alt"
            );

    }


    // =====================================================
    // REPLACEMENT CHARACTER CLEAR PREVIEW
    // =====================================================

    function clearCharacterPreview() {

        const dom =
            getDOM();


        clearCharacterPreviewImage();


        if (
            dom.characterPreviewName
        ) {

            dom.characterPreviewName.textContent =
                "";

        }


        if (
            dom.characterPreviewSize
        ) {

            dom.characterPreviewSize.textContent =
                "";

        }


        if (
            dom.characterDropzone
        ) {

            dom.characterDropzone.classList.remove(
                "is-dragover"
            );

        }


        showCharacterUploadState();

    }


    // =====================================================
    // REPLACEMENT CHARACTER RENDER
    // =====================================================

    function renderCharacterPreview(
        file
    ) {

        if (!file) {

            clearCharacterPreview();

            return false;

        }


        const imageSet =
            setCharacterPreviewImage(
                file.dataUrl
            );


        if (!imageSet) {

            showCharacterUploadState();

            return false;

        }


        updateCharacterPreviewInformation(
            file
        );


        showCharacterPreviewState();


        return true;

    }


    // =====================================================
    // RESTORE FROM STATE
    // =====================================================

    function renderFromState() {

        const state =
            getState();


        // =================================================
        // REFERENCE IMAGE
        // =================================================

        const file =
            state.get(
                "file",
                null
            );


        if (
            !file ||
            !isValidDataUrl(
                file.dataUrl
            )
        ) {

            showUploadState();

            clearPreviewImage();

        } else {

            renderPreview(
                file
            );

        }


        // =================================================
        // REPLACEMENT CHARACTER
        // =================================================

        const replacementCharacter =
            state.get(
                "replacementCharacter",
                null
            );


        if (
            !replacementCharacter ||
            !isValidDataUrl(
                replacementCharacter.dataUrl
            )
        ) {

            showCharacterUploadState();

            clearCharacterPreviewImage();

        } else {

            renderCharacterPreview(
                replacementCharacter
            );

        }


        return {

            reference:
                !!file,

            replacementCharacter:
                !!replacementCharacter

        };

    }


    // =====================================================
    // PUBLIC API
    // =====================================================

    const GENZVisionPreview =
        Object.freeze({

            // ---------------------------------------------
            // Reference image
            // ---------------------------------------------

            setPreviewImage,

            updatePreviewInformation,

            showUploadState,

            showPreviewState,

            setDropzoneActive,

            clearPreviewImage,

            clearPreview,

            renderPreview,


            // ---------------------------------------------
            // Replacement character
            // ---------------------------------------------

            setCharacterPreviewImage,

            updateCharacterPreviewInformation,

            showCharacterUploadState,

            showCharacterPreviewState,

            clearCharacterPreviewImage,

            clearCharacterPreview,

            renderCharacterPreview,


            // ---------------------------------------------
            // State
            // ---------------------------------------------

            renderFromState

        });


    // =====================================================
    // GLOBAL EXPORT
    // =====================================================

    window.GENZVisionPreview =
        GENZVisionPreview;


})();
