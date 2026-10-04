/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-preview.js

   Fungsi:
   - Menampilkan preview gambar
   - Menampilkan nama file
   - Menampilkan ukuran file
   - Menampilkan dimensi gambar
   - Mengatur state upload / preview
   - Membersihkan preview
   - Tidak melakukan API
   - Tidak melakukan credit
   - Tidak melakukan history
   - Tidak melakukan analysis
========================================================= */


/* =========================================================
   INTERNAL HELPERS
========================================================= */

function getDOM() {

    if (
        !window.GENZVisionDOM
    ) {

        throw new Error(
            "GENZVisionDOM belum tersedia."
        );

    }


    return window.GENZVisionDOM.getDOM();

}


function getState() {

    if (
        !window.GENZVisionState
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    return window.GENZVisionState;

}


function getUpload() {

    if (
        !window.GENZVisionUpload
    ) {

        throw new Error(
            "GENZVisionUpload belum tersedia."
        );

    }


    return window.GENZVisionUpload;

}


/* =========================================================
   FORMAT DIMENSIONS
========================================================= */

function formatDimensions(
    width,
    height
) {

    const safeWidth =
        Number(width);


    const safeHeight =
        Number(height);


    if (
        !Number.isFinite(
            safeWidth
        ) ||
        !Number.isFinite(
            safeHeight
        ) ||
        safeWidth <= 0 ||
        safeHeight <= 0
    ) {

        return "";

    }


    return `${safeWidth} × ${safeHeight} px`;

}


/* =========================================================
   FORMAT FILE INFORMATION
========================================================= */

function formatFileInformation(
    file
) {

    if (!file) {

        return {

            name:
                "",

            size:
                "",

            dimensions:
                "",

            type:
                ""

        };

    }


    const upload =
        getUpload();


    return {

        name:
            file.name ||
            "reference-image",

        size:
            upload.formatFileSize(
                file.size
            ),

        dimensions:
            formatDimensions(
                file.width,
                file.height
            ),

        type:
            String(
                file.mimeType ||
                file.type ||
                ""
            )
                .replace(
                    "image/",
                    ""
                )
                .toUpperCase()

    };

}


/* =========================================================
   SET PREVIEW IMAGE
========================================================= */

function setPreviewImage(
    dataUrl
) {

    const dom =
        getDOM();


    if (
        !dom.previewImage
    ) {

        return false;

    }


    if (
        typeof dataUrl !==
        "string" ||
        !dataUrl
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


/* =========================================================
   CLEAR PREVIEW IMAGE
========================================================= */

function clearPreviewImage() {

    const dom =
        getDOM();


    if (
        !dom.previewImage
    ) {

        return false;

    }


    dom.previewImage.removeAttribute(
        "src"
    );


    dom.previewImage.removeAttribute(
        "alt"
    );


    return true;

}


/* =========================================================
   UPDATE FILE NAME
========================================================= */

function updateFileName(
    file
) {

    const dom =
        getDOM();


    if (
        !dom.previewName
    ) {

        return false;

    }


    const info =
        formatFileInformation(
            file
        );


    dom.previewName.textContent =
        info.name;


    return true;

}


/* =========================================================
   UPDATE FILE SIZE
========================================================= */

function updateFileSize(
    file
) {

    const dom =
        getDOM();


    if (
        !dom.previewSize
    ) {

        return false;

    }


    const info =
        formatFileInformation(
            file
        );


    const parts = [];


    if (
        info.size
    ) {

        parts.push(
            info.size
        );

    }


    if (
        info.dimensions
    ) {

        parts.push(
            info.dimensions
        );

    }


    if (
        info.type
    ) {

        parts.push(
            info.type
        );

    }


    dom.previewSize.textContent =
        parts.join(
            " • "
        );


    return true;

}


/* =========================================================
   UPDATE PREVIEW INFORMATION
========================================================= */

function updatePreviewInformation(
    file
) {

    if (!file) {

        return false;

    }


    updateFileName(
        file
    );


    updateFileSize(
        file
    );


    return true;

}


/* =========================================================
   SHOW UPLOAD STATE
========================================================= */

function showUploadState() {

    const dom =
        getDOM();


    if (
        dom.uploadState
    ) {

        dom.uploadState.hidden =
            false;

        dom.uploadState
            .classList
            .remove(
                "vision-hidden"
            );

    }


    if (
        dom.previewState
    ) {

        dom.previewState.hidden =
            true;

        dom.previewState
            .classList
            .add(
                "vision-hidden"
            );

    }


    return true;

}


/* =========================================================
   SHOW PREVIEW STATE
========================================================= */

function showPreviewState() {

    const dom =
        getDOM();


    if (
        dom.uploadState
    ) {

        dom.uploadState.hidden =
            true;

        dom.uploadState
            .classList
            .add(
                "vision-hidden"
            );

    }


    if (
        dom.previewState
    ) {

        dom.previewState.hidden =
            false;

        dom.previewState
            .classList
            .remove(
                "vision-hidden"
            );

    }


    return true;

}


/* =========================================================
   RENDER PREVIEW
========================================================= */

function renderPreview(
    file
) {

    if (!file) {

        clearPreview();

        return false;

    }


    setPreviewImage(
        file.dataUrl
    );


    updatePreviewInformation(
        file
    );


    showPreviewState();


    return true;

}


/* =========================================================
   RENDER FROM STATE
========================================================= */

function renderFromState() {

    const state =
        getState();


    const file =
        state.get(
            "file",
            null
        );


    if (
        !file ||
        !file.dataUrl
    ) {

        showUploadState();

        clearPreviewImage();

        return false;

    }


    return renderPreview(
        file
    );

}


/* =========================================================
   CLEAR PREVIEW INFORMATION
========================================================= */

function clearPreviewInformation() {

    const dom =
        getDOM();


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


    return true;

}


/* =========================================================
   CLEAR PREVIEW
========================================================= */

function clearPreview(
    options = {}
) {

    const state =
        getState();


    clearPreviewImage();

    clearPreviewInformation();

    showUploadState();


    if (
        options.clearState !== false
    ) {

        state.clearFile();

    }


    if (
        options.resetInput !== false &&
        window.GENZVisionUpload
    ) {

        window.GENZVisionUpload
            .resetFileInput();

    }


    return true;

}


/* =========================================================
   PREVIEW IMAGE LOAD CHECK
========================================================= */

function isPreviewLoaded() {

    const dom =
        getDOM();


    if (
        !dom.previewImage
    ) {

        return false;

    }


    return Boolean(
        dom.previewImage.complete &&
        dom.previewImage.naturalWidth > 0 &&
        dom.previewImage.naturalHeight > 0
    );

}


/* =========================================================
   GET PREVIEW DIMENSIONS
========================================================= */

function getPreviewDimensions() {

    const dom =
        getDOM();


    if (
        !dom.previewImage
    ) {

        return {

            width:
                0,

            height:
                0

        };

    }


    return {

        width:
            Number(
                dom.previewImage
                    .naturalWidth ||
                0
            ),

        height:
            Number(
                dom.previewImage
                    .naturalHeight ||
                0
            )

    };

}


/* =========================================================
   HANDLE IMAGE LOAD
========================================================= */

function handlePreviewImageLoad() {

    const dimensions =
        getPreviewDimensions();


    const state =
        getState();


    if (
        dimensions.width > 0 &&
        dimensions.height > 0
    ) {

        state.merge(
            "file",
            {

                width:
                    dimensions.width,

                height:
                    dimensions.height

            }
        );

    }


    return dimensions;

}


/* =========================================================
   SET DROPZONE ACTIVE
========================================================= */

function setDropzoneActive(
    active
) {

    const dom =
        getDOM();


    if (
        !dom.dropzone
    ) {

        return false;

    }


    dom.dropzone
        .classList
        .toggle(
            "vision-dropzone-active",
            Boolean(active)
        );


    return true;

}


/* =========================================================
   SET DROPZONE DISABLED
========================================================= */

function setDropzoneDisabled(
    disabled
) {

    const dom =
        getDOM();


    if (
        !dom.dropzone
    ) {

        return false;

    }


    dom.dropzone
        .classList
        .toggle(
            "vision-dropzone-disabled",
            Boolean(disabled)
        );


    return true;

}


/* =========================================================
   PREVIEW STATE FROM FILE
========================================================= */

function updateFromFile(
    file
) {

    if (
        !file
    ) {

        return clearPreview();

    }


    const rendered =
        renderPreview(
            file
        );


    setDropzoneActive(
        false
    );


    return rendered;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionPreview = Object.freeze({

    formatDimensions,

    formatFileInformation,

    setPreviewImage,

    clearPreviewImage,

    updateFileName,

    updateFileSize,

    updatePreviewInformation,

    showUploadState,

    showPreviewState,

    renderPreview,

    renderFromState,

    clearPreviewInformation,

    clearPreview,

    isPreviewLoaded,

    getPreviewDimensions,

    handlePreviewImageLoad,

    setDropzoneActive,

    setDropzoneDisabled,

    updateFromFile

});


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionPreview =
    GENZVisionPreview;
