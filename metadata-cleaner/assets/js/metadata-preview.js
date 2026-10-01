/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Tanggung jawab:
   - Preview original image/video
   - Preview cleaned image/video
   - Object URL lifecycle
   - Rasio preview
   - Tidak pernah membuat Object URL dari string
========================================================= */

import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   ELEMENT HELPERS
========================================================= */

function getElement(
    key,
    id
) {

    return (
        elements?.[key] ||
        document.getElementById(
            id
        )
    );

}


/* =========================================================
   SHOW / HIDE
========================================================= */

export function showElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.hidden =
        false;


    element.style.removeProperty(
        "display"
    );


    /*
       Beberapa CSS menggunakan display:block
       melalui class. Jangan memaksakan display
       selain ketika elemen sebelumnya memang hidden.
    */

}


export function hideElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.hidden =
        true;


    element.style.display =
        "none";

}


/* =========================================================
   OBJECT URL CHECK
========================================================= */

function isBlob(
    value
) {

    return (
        typeof Blob !== "undefined" &&
        value instanceof Blob
    );

}


function isBlobUrl(
    value
) {

    return (
        typeof value === "string" &&
        value.startsWith(
            "blob:"
        )
    );

}


/* =========================================================
   CREATE URL ONLY FROM BLOB
========================================================= */

function createBlobUrl(
    blob
) {

    if (
        !isBlob(
            blob
        )
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] createBlobUrl menerima bukan Blob:",
            {
                value:
                    blob,

                constructor:
                    blob?.constructor?.name ||
                    null,

                type:
                    blob?.type ||
                    null
            }
        );


        return null;

    }


    if (
        blob.size <= 0
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Blob hasil kosong."
        );


        return null;

    }


    try {

        return URL.createObjectURL(
            blob
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] URL.createObjectURL gagal:",
            error
        );


        return null;

    }

}


/* =========================================================
   SAFE REVOKE
========================================================= */

function revokeObjectUrl(
    url
) {

    if (
        !isBlobUrl(
            url
        )
    ) {

        return;

    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][PREVIEW] revokeObjectURL gagal:",
            error
        );

    }

}


/* =========================================================
   PREVIEW STAGE
========================================================= */

function getPreviewStage() {

    return getElement(
        "previewStage",
        "metadata-preview-stage"
    );

}


/* =========================================================
   RESET ORIGINAL STAGE
========================================================= */

function resetPreviewStage() {

    const stage =
        getPreviewStage();


    if (
        !stage
    ) {

        return;

    }


    stage.style.removeProperty(
        "aspect-ratio"
    );


    stage.style.removeProperty(
        "height"
    );


    stage.style.removeProperty(
        "min-height"
    );


    stage.style.removeProperty(
        "max-height"
    );


    stage.dataset.previewWidth =
        "";


    stage.dataset.previewHeight =
        "";


    stage.dataset.previewRatio =
        "";

}


/* =========================================================
   APPLY MEDIA RATIO
========================================================= */

function applyMediaRatio(
    media,
    stage
) {

    if (
        !media ||
        !stage
    ) {

        return false;

    }


    const width =
        Number(
            media.naturalWidth ||
            media.videoWidth ||
            0
        );


    const height =
        Number(
            media.naturalHeight ||
            media.videoHeight ||
            0
        );


    if (
        width <= 0 ||
        height <= 0
    ) {

        return false;

    }


    stage.style.width =
        "100%";


    stage.style.height =
        "auto";


    stage.style.minHeight =
        "0";


    stage.style.maxHeight =
        "none";


    stage.style.aspectRatio =
        `${width} / ${height}`;


    stage.dataset.previewWidth =
        String(
            width
        );


    stage.dataset.previewHeight =
        String(
            height
        );


    stage.dataset.previewRatio =
        String(
            width / height
        );


    return true;

}


/* =========================================================
   MEDIA STYLE
========================================================= */

function applyMediaStyle(
    media
) {

    if (
        !media
    ) {

        return;

    }


    media.style.display =
        "block";


    media.style.width =
        "100%";


    media.style.height =
        "100%";


    media.style.maxWidth =
        "100%";


    media.style.maxHeight =
        "100%";


    media.style.objectFit =
        "contain";


    media.style.objectPosition =
        "center";


    media.style.margin =
        "0";


    media.style.padding =
        "0";


    media.style.boxSizing =
        "border-box";

}


/* =========================================================
   ORIGINAL IMAGE
========================================================= */

export function renderImagePreview(
    url
) {

    const image =
        getElement(
            "imagePreview",
            "metadata-image-preview"
        );


    const video =
        getElement(
            "videoPreview",
            "metadata-video-preview"
        );


    const empty =
        getElement(
            "previewEmpty",
            "metadata-preview-empty"
        );


    const stage =
        getPreviewStage();


    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Original image element tidak ditemukan."
        );


        return false;

    }


    if (
        video
    ) {

        video.pause?.();


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch {}

        hideElement(
            video
        );

    }


    if (
        empty
    ) {

        hideElement(
            empty
        );

    }


    resetPreviewStage();


    image.onload =
        function () {

            applyMediaStyle(
                image
            );


            applyMediaRatio(
                image,
                stage
            );

        };


    image.onerror =
        function (
            error
        ) {

            console.error(
                "[GEN-Z.AI][PREVIEW] Original image gagal:",
                error
            );

        };


    image.removeAttribute(
        "srcset"
    );


    image.src =
        url;


    showElement(
        image
    );


    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        applyMediaStyle(
            image
        );


        applyMediaRatio(
            image,
            stage
        );

    }


    return true;

}


/* =========================================================
   ORIGINAL VIDEO
========================================================= */

export function renderVideoPreview(
    url
) {

    const image =
        getElement(
            "imagePreview",
            "metadata-image-preview"
        );


    const video =
        getElement(
            "videoPreview",
            "metadata-video-preview"
        );


    const empty =
        getElement(
            "previewEmpty",
            "metadata-preview-empty"
        );


    const stage =
        getPreviewStage();


    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Original video element tidak ditemukan."
        );


        return false;

    }


    if (
        image
    ) {

        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    if (
        empty
    ) {

        hideElement(
            empty
        );

    }


    resetPreviewStage();


    video.onloadedmetadata =
        function () {

            applyMediaStyle(
                video
            );


            applyMediaRatio(
                video,
                stage
            );

        };


    video.onerror =
        function (
            error
        ) {

            console.error(
                "[GEN-Z.AI][PREVIEW] Original video gagal:",
                error
            );

        };


    video.pause?.();


    video.removeAttribute(
        "src"
    );


    try {

        video.load();

    } catch {}


    video.src =
        url;


    try {

        video.load();

    } catch {}


    showElement(
        video
    );


    return true;

}


/* =========================================================
   ORIGINAL FILE
========================================================= */

export function renderOriginalPreview(
    file
) {

    if (
        !isBlob(
            file
        )
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] File original bukan Blob/File.",
            file
        );


        return false;

    }


    clearOriginalPreview();


    const url =
        createBlobUrl(
            file
        );


    if (
        !url
    ) {

        return false;

    }


    state.originalPreviewUrl =
        url;


    const type =
        String(
            file.type ||
            ""
        ).toLowerCase();


    if (
        type.startsWith(
            "image/"
        )
    ) {

        return renderImagePreview(
            url
        );

    }


    if (
        type.startsWith(
            "video/"
        )
    ) {

        return renderVideoPreview(
            url
        );

    }


    revokeObjectUrl(
        url
    );


    state.originalPreviewUrl =
        null;


    return false;

}


/* =========================================================
   CLEANED IMAGE
========================================================= */

function renderCleanedImage(
    url
) {

    const image =
        getElement(
            "cleanImagePreview",
            "metadata-clean-image-preview"
        );


    const video =
        getElement(
            "cleanVideoPreview",
            "metadata-clean-video-preview"
        );


    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Clean image element tidak ditemukan."
        );


        return false;

    }


    if (
        video
    ) {

        video.pause?.();


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch {}


        hideElement(
            video
        );

    }


    image.onload =
        function () {

            applyMediaStyle(
                image
            );

        };


    image.onerror =
        function (
            error
        ) {

            console.error(
                "[GEN-Z.AI][PREVIEW] Cleaned image gagal dimuat:",
                error
            );

        };


    image.removeAttribute(
        "srcset"
    );


    image.src =
        url;


    showElement(
        image
    );


    /*
       Browser dapat menyelesaikan image load
       sangat cepat untuk Blob URL.
    */

    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        applyMediaStyle(
            image
        );

    }


    return true;

}


/* =========================================================
   CLEANED VIDEO
========================================================= */

function renderCleanedVideo(
    url
) {

    const image =
        getElement(
            "cleanImagePreview",
            "metadata-clean-image-preview"
        );


    const video =
        getElement(
            "cleanVideoPreview",
            "metadata-clean-video-preview"
        );


    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Clean video element tidak ditemukan."
        );


        return false;

    }


    if (
        image
    ) {

        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    video.onloadedmetadata =
        function () {

            applyMediaStyle(
                video
            );

        };


    video.onerror =
        function (
            error
        ) {

            console.error(
                "[GEN-Z.AI][PREVIEW] Cleaned video gagal dimuat:",
                error
            );

        };


    video.pause?.();


    video.removeAttribute(
        "src"
    );


    try {

        video.load();

    } catch {}


    video.src =
        url;


    try {

        video.load();

    } catch {}


    showElement(
        video
    );


    return true;

}


/* =========================================================
   CLEANED PREVIEW
   ---------------------------------------------------------
   PENTING:

   Fungsi ini menerima Blob ATAU Blob URL.

   Jika Blob:
       buat URL baru.

   Jika Blob URL:
       gunakan langsung.

   TIDAK memanggil clearCleanedPreview()
   di awal karena itu dapat merevoke URL
   hasil yang baru saja disiapkan.
========================================================= */

export function renderCleanedPreview(
    source
) {

    console.log(
        "[GEN-Z.AI][PREVIEW] renderCleanedPreview():",
        {
            constructor:
                source?.constructor?.name ||
                null,

            isBlob:
                isBlob(
                    source
                ),

            isBlobUrl:
                isBlobUrl(
                    source
                ),

            type:
                source?.type ||
                null,

            size:
                source?.size ||
                null
        }
    );


    if (
        !source
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Cleaned preview source kosong."
        );


        return false;

    }


    let url =
        null;


    let ownsUrl =
        false;


    /*
       BLO B
    */

    if (
        isBlob(
            source
        )
    ) {

        url =
            createBlobUrl(
                source
            );


        ownsUrl =
            true;

    }


    /*
       OBJECT URL
    */

    else if (
        isBlobUrl(
            source
        )
    ) {

        url =
            source;

        ownsUrl =
            false;

    }


    /*
       FORMAT LAIN
    */

    else {

        console.error(
            "[GEN-Z.AI][PREVIEW] Source cleaned preview tidak valid:",
            source
        );


        return false;

    }


    if (
        !url
    ) {

        return false;

    }


    /*
       Jangan revoke URL baru sebelum selesai render.
    */

    const previousUrl =
        state.cleanedPreviewUrl ||
        state.cleanedURL;


    /*
       Render berdasarkan tipe.
    */

    let type =
        "";


    if (
        isBlob(
            source
        )
    ) {

        type =
            String(
                source.type ||
                ""
            ).toLowerCase();

    }


    /*
       Fallback ke file asli.
    */

    if (
        !type
    ) {

        type =
            String(
                state.file?.type ||
                state.fileType ||
                ""
            ).toLowerCase();

    }


    let rendered =
        false;


    if (
        type.startsWith(
            "image/"
        )
    ) {

        rendered =
            renderCleanedImage(
                url
            );

    }


    else if (
        type.startsWith(
            "video/"
        )
    ) {

        rendered =
            renderCleanedVideo(
                url
            );

    }


    else {

        console.error(
            "[GEN-Z.AI][PREVIEW] Tipe cleaned file tidak diketahui:",
            type
        );

    }


    if (
        !rendered
    ) {

        /*
           URL baru hanya direvoke kalau memang
           dibuat oleh fungsi ini.
        */

        if (
            ownsUrl
        ) {

            revokeObjectUrl(
                url
            );

        }


        return false;

    }


    /*
       Sekarang hasil sudah berhasil dipasang
       ke elemen preview.
    */

    state.cleanedPreviewUrl =
        url;


    state.cleanedURL =
        url;


    /*
       Setelah URL baru aman, baru lepaskan URL lama.
    */

    if (
        previousUrl &&
        previousUrl !== url
    ) {

        revokeObjectUrl(
            previousUrl
        );

    }


    console.log(
        "[GEN-Z.AI][PREVIEW] Cleaned preview berhasil ditampilkan.",
        {
            url,
            type
        }
    );


    return true;

}


/* =========================================================
   CLEAR ORIGINAL
========================================================= */

export function clearOriginalPreview() {

    const image =
        getElement(
            "imagePreview",
            "metadata-image-preview"
        );


    const video =
        getElement(
            "videoPreview",
            "metadata-video-preview"
        );


    const empty =
        getElement(
            "previewEmpty",
            "metadata-preview-empty"
        );


    if (
        image
    ) {

        image.onload =
            null;


        image.onerror =
            null;


        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    if (
        video
    ) {

        video.onloadedmetadata =
            null;


        video.onerror =
            null;


        video.pause?.();


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch {}


        hideElement(
            video
        );

    }


    if (
        state.originalPreviewUrl
    ) {

        revokeObjectUrl(
            state.originalPreviewUrl
        );

    }


    state.originalPreviewUrl =
        null;


    if (
        empty
    ) {

        showElement(
            empty
        );

    }


    resetPreviewStage();

}


/* =========================================================
   CLEAR CLEANED
========================================================= */

export function clearCleanedPreview() {

    const image =
        getElement(
            "cleanImagePreview",
            "metadata-clean-image-preview"
        );


    const video =
        getElement(
            "cleanVideoPreview",
            "metadata-clean-video-preview"
        );


    const url1 =
        state.cleanedPreviewUrl;


    const url2 =
        state.cleanedURL;


    if (
        image
    ) {

        image.onload =
            null;


        image.onerror =
            null;


        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    if (
        video
    ) {

        video.onloadedmetadata =
            null;


        video.onerror =
            null;


        video.pause?.();


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch {}


        hideElement(
            video
        );

    }


    if (
        url1
    ) {

        revokeObjectUrl(
            url1
        );

    }


    if (
        url2 &&
        url2 !== url1
    ) {

        revokeObjectUrl(
            url2
        );

    }


    state.cleanedPreviewUrl =
        null;


    state.cleanedURL =
        null;

}


/* =========================================================
   PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    text
) {

    const status =
        getElement(
            "previewStatus",
            "metadata-preview-status"
        );


    if (
        !status
    ) {

        return;

    }


    status.textContent =
        String(
            text ?? ""
        );

}


/* =========================================================
   RESET PREVIEW
========================================================= */

export function resetPreview() {

    clearOriginalPreview();

    clearCleanedPreview();

}


/* =========================================================
   RESIZE
========================================================= */

let resizeTimer =
    null;


window.addEventListener(
    "resize",
    function () {

        clearTimeout(
            resizeTimer
        );


        resizeTimer =
            setTimeout(
                function () {

                    const stage =
                        getPreviewStage();


                    const image =
                        getElement(
                            "imagePreview",
                            "metadata-image-preview"
                        );


                    const video =
                        getElement(
                            "videoPreview",
                            "metadata-video-preview"
                        );


                    if (
                        image &&
                        !image.hidden &&
                        image.naturalWidth > 0
                    ) {

                        applyMediaRatio(
                            image,
                            stage
                        );

                    }


                    if (
                        video &&
                        !video.hidden &&
                        video.videoWidth > 0
                    ) {

                        applyMediaRatio(
                            video,
                            stage
                        );

                    }

                },
                100
            );

    },
    {
        passive: true
    }
);


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    showElement,

    hideElement,

    renderImagePreview,

    renderVideoPreview,

    renderOriginalPreview,

    renderCleanedPreview,

    clearOriginalPreview,

    clearCleanedPreview,

    setPreviewStatus,

    resetPreview

};
