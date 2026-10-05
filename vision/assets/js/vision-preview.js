/* =========================================================
   GEN-Z.AI
   VISION PREVIEW MODULE
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-preview.js

   Fungsi:
   - Render preview Reference Image
   - Render preview Replacement Character
   - Update informasi file
   - Clear preview masing-masing image secara independen
   - Restore preview dari state
   - Tidak mengubah fungsi upload / API / analysis
========================================================= */

import { getState } from "./vision-state.js";
import { getDOM } from "./vision-dom.js";


/* =========================================================
   INTERNAL HELPERS
========================================================= */

function isValidDataUrl(dataUrl) {

    return (
        typeof dataUrl === "string" &&
        dataUrl.trim().length > 0
    );

}


function formatFileSize(bytes) {

    const size = Number(bytes);

    if (!Number.isFinite(size) || size <= 0) {
        return "Unknown size";
    }

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(2)} MB`;

}


/* =========================================================
   REFERENCE IMAGE
========================================================= */

function setPreviewImage(dataUrl) {

    const dom = getDOM();

    if (!dom.previewImage) {
        return false;
    }

    if (!isValidDataUrl(dataUrl)) {

        dom.previewImage.removeAttribute("src");
        dom.previewImage.removeAttribute("alt");

        return false;
    }

    dom.previewImage.src = dataUrl;
    dom.previewImage.alt = "Vision reference image";

    return true;
}


function updatePreviewInformation(file) {

    const dom = getDOM();

    if (!file) {
        return false;
    }

    if (dom.previewName) {

        dom.previewName.textContent =
            file.name ||
            file.original?.name ||
            "Reference image";

    }

    if (dom.previewSize) {

        dom.previewSize.textContent =
            formatFileSize(
                file.size ||
                file.original?.size
            );

    }

    return true;
}


function showUploadState() {

    const dom = getDOM();

    if (dom.uploadState) {

        dom.uploadState.hidden = false;

        dom.uploadState.classList.remove(
            "vision-hidden"
        );
    }

    if (dom.previewState) {

        dom.previewState.hidden = true;

        dom.previewState.classList.add(
            "vision-hidden"
        );

        dom.previewState.classList.remove(
            "is-visible"
        );
    }

}


function showPreviewState() {

    const dom = getDOM();

    if (dom.uploadState) {

        dom.uploadState.hidden = true;

        dom.uploadState.classList.add(
            "vision-hidden"
        );
    }

    if (dom.previewState) {

        dom.previewState.hidden = false;

        dom.previewState.classList.remove(
            "vision-hidden"
        );

        dom.previewState.classList.add(
            "is-visible"
        );
    }

}


function clearPreviewImage() {

    const dom = getDOM();

    if (!dom.previewImage) {
        return;
    }

    dom.previewImage.removeAttribute("src");
    dom.previewImage.removeAttribute("alt");

}


function clearPreview() {

    const dom = getDOM();

    clearPreviewImage();

    if (dom.previewName) {
        dom.previewName.textContent = "";
    }

    if (dom.previewSize) {
        dom.previewSize.textContent = "";
    }

    showUploadState();

}


/* =========================================================
   RENDER REFERENCE IMAGE
========================================================= */

function renderPreview(file) {

    if (!file) {

        clearPreview();

        return false;
    }

    const imageSet = setPreviewImage(
        file.dataUrl
    );

    if (!imageSet) {

        showUploadState();

        return false;
    }

    updatePreviewInformation(file);

    showPreviewState();

    return true;

}


/* =========================================================
   REPLACEMENT CHARACTER
========================================================= */

function setCharacterPreviewImage(dataUrl) {

    const dom = getDOM();

    if (!dom.characterPreviewImage) {
        return false;
    }

    if (!isValidDataUrl(dataUrl)) {

        dom.characterPreviewImage.removeAttribute(
            "src"
        );

        dom.characterPreviewImage.removeAttribute(
            "alt"
        );

        return false;
    }

    dom.characterPreviewImage.src = dataUrl;

    dom.characterPreviewImage.alt =
        "Replacement character image";

    return true;

}


function updateCharacterPreviewInformation(file) {

    const dom = getDOM();

    if (!file) {
        return false;
    }

    if (dom.characterPreviewName) {

        dom.characterPreviewName.textContent =
            file.name ||
            file.original?.name ||
            "Replacement character";

    }

    if (dom.characterPreviewSize) {

        dom.characterPreviewSize.textContent =
            formatFileSize(
                file.size ||
                file.original?.size
            );

    }

    return true;

}


function showCharacterUploadState() {

    const dom = getDOM();

    if (dom.characterUploadState) {

        dom.characterUploadState.hidden = false;

        dom.characterUploadState.classList.remove(
            "vision-hidden"
        );
    }

    if (dom.characterPreviewState) {

        dom.characterPreviewState.hidden = true;

        dom.characterPreviewState.classList.add(
            "vision-hidden"
        );

        dom.characterPreviewState.classList.remove(
            "is-visible"
        );
    }

}


function showCharacterPreviewState() {

    const dom = getDOM();

    if (dom.characterUploadState) {

        dom.characterUploadState.hidden = true;

        dom.characterUploadState.classList.add(
            "vision-hidden"
        );
    }

    if (dom.characterPreviewState) {

        dom.characterPreviewState.hidden = false;

        dom.characterPreviewState.classList.remove(
            "vision-hidden"
        );

        dom.characterPreviewState.classList.add(
            "is-visible"
        );
    }

}


function clearCharacterPreviewImage() {

    const dom = getDOM();

    if (!dom.characterPreviewImage) {
        return;
    }

    dom.characterPreviewImage.removeAttribute(
        "src"
    );

    dom.characterPreviewImage.removeAttribute(
        "alt"
    );

}


function clearCharacterPreview() {

    const dom = getDOM();

    clearCharacterPreviewImage();

    if (dom.characterPreviewName) {
        dom.characterPreviewName.textContent = "";
    }

    if (dom.characterPreviewSize) {
        dom.characterPreviewSize.textContent = "";
    }

    showCharacterUploadState();

}


function renderCharacterPreview(file) {

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


/* =========================================================
   RESTORE REFERENCE PREVIEW FROM STATE
========================================================= */

function renderFromState() {

    const state = getState();

    const file =
        state.get(
            "file",
            null
        );

    if (
        !file ||
        !isValidDataUrl(file.dataUrl)
    ) {

        showUploadState();

        clearPreviewImage();

    } else {

        renderPreview(file);

    }


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
        reference: !!file,
        replacementCharacter:
            !!replacementCharacter
    };

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionPreview = {

    /* Reference */
    setPreviewImage,
    updatePreviewInformation,
    showUploadState,
    showPreviewState,
    clearPreviewImage,
    clearPreview,
    renderPreview,

    /* Replacement Character */
    setCharacterPreviewImage,
    updateCharacterPreviewInformation,
    showCharacterUploadState,
    showCharacterPreviewState,
    clearCharacterPreviewImage,
    clearCharacterPreview,
    renderCharacterPreview,

    /* State restore */
    renderFromState

};


export {

    setPreviewImage,
    updatePreviewInformation,
    showUploadState,
    showPreviewState,
    clearPreviewImage,
    clearPreview,
    renderPreview,

    setCharacterPreviewImage,
    updateCharacterPreviewInformation,
    showCharacterUploadState,
    showCharacterPreviewState,
    clearCharacterPreviewImage,
    clearCharacterPreview,
    renderCharacterPreview,

    renderFromState

};


if (
    typeof window !== "undefined"
) {

    window.GENZVisionPreview =
        GENZVisionPreview;

}
