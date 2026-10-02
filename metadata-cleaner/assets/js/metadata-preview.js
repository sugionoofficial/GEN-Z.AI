/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Fungsi:
   - Preview original image / video
   - Preview cleaned image / video
   - Object URL management
   - Show / hide element
   - Preview status
   - Tidak mengubah file asli
========================================================= */

import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   SHOW ELEMENT
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


    element.removeAttribute(
        "hidden"
    );


    element.classList.remove(
        "hidden"
    );


    element.style.removeProperty(
        "display"
    );


    element.style.removeProperty(
        "visibility"
    );


    element.style.removeProperty(
        "opacity"
    );


    element.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    element.style.setProperty(
        "opacity",
        "1",
        "important"
    );

}


/* =========================================================
   HIDE ELEMENT
========================================================= */

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


    element.setAttribute(
        "hidden",
        "hidden"
    );


    element.classList.add(
        "hidden"
    );


    element.style.setProperty(
        "display",
        "none",
        "important"
    );


    element.style.setProperty(
        "visibility",
        "hidden",
        "important"
    );


    element.style.setProperty(
        "opacity",
        "0",
        "important"
    );

}


/* =========================================================
   SET PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    message
) {

    const element =
        elements?.previewStatus ||
        document.getElementById(
            "metadata-preview-status"
        );


    if (
        !element
    ) {

        return;

    }


    element.textContent =
        String(
            message || ""
        );


    showElement(
        element
    );


    element.style.setProperty(
        "display",
        "block",
        "important"
    );

}


/* =========================================================
   FILE / BLOB VALIDATION
   ---------------------------------------------------------
   Jangan hanya menggunakan instanceof Blob.

   File dapat berasal dari:
   - input[type=file]
   - DataTransfer
   - browser realm berbeda
   - wrapper object
   - library internal

   Semua tetap harus diperlakukan sebagai media
   selama memiliki API Blob yang valid.
========================================================= */

function isBlobLike(
    value
) {

    if (
        !value
    ) {

        return false;

    }


    /*
       Jalur normal.
    */

    if (
        typeof Blob !==
        "undefined" &&
        value instanceof Blob
    ) {

        return true;

    }


    /*
       Jalur File.
    */

    if (
        typeof File !==
        "undefined" &&
        value instanceof File
    ) {

        return true;

    }


    /*
       Cross-realm / wrapper fallback.

       Yang penting object tersebut memiliki:
       - size
       - type
       - slice()
       - arrayBuffer() atau stream()
    */

    if (
        typeof value !==
        "object"
    ) {

        return false;

    }


    const hasSize =
        typeof value.size ===
        "number";


    const hasType =
        typeof value.type ===
        "string";


    const hasSlice =
        typeof value.slice ===
        "function";


    const hasArrayBuffer =
        typeof value.arrayBuffer ===
        "function";


    const hasStream =
        typeof value.stream ===
        "function";


    return (
        hasSize &&
        hasType &&
        hasSlice &&
        (
            hasArrayBuffer ||
            hasStream
        )
    );

}


/* =========================================================
   GET SAFE MEDIA TYPE
========================================================= */

function getMediaType(
    file
) {

    return String(
        file?.type ||
        ""
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   IS IMAGE
========================================================= */

function isImageFile(
    file
) {

    const type =
        getMediaType(
            file
        );


    return type.startsWith(
        "image/"
    );

}


/* =========================================================
   IS VIDEO
========================================================= */

function isVideoFile(
    file
) {

    const type =
        getMediaType(
            file
        );


    return type.startsWith(
        "video/"
    );

}


/* =========================================================
   CLEAR ORIGINAL PREVIEW
========================================================= */

export function clearOriginalPreview() {

    const image =
        elements?.imagePreview ||
        document.getElementById(
            "metadata-image-preview"
        );


    const video =
        elements?.videoPreview ||
        document.getElementById(
            "metadata-video-preview"
        );


    const empty =
        elements?.previewEmpty ||
        document.getElementById(
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


        try {

            video.pause();

        } catch (
            error
        ) {

            /* ignore */

        }


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            /* ignore */

        }


        hideElement(
            video
        );

    }


    if (
        empty
    ) {

        showElement(
            empty
        );


        empty.style.setProperty(
            "display",
            "flex",
            "important"
        );

    }

}


/* =========================================================
   CLEAR CLEANED PREVIEW
========================================================= */

export function clearCleanedPreview() {

    const image =
        elements?.cleanImagePreview ||
        document.getElementById(
            "metadata-clean-image-preview"
        );


    const video =
        elements?.cleanVideoPreview ||
        document.getElementById(
            "metadata-clean-video-preview"
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


        try {

            video.pause();

        } catch (
            error
        ) {

            /* ignore */

        }


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            /* ignore */

        }


        hideElement(
            video
        );

    }


    /*
       Revoke URL lama setelah elemen
       tidak lagi menggunakannya.
    */

    if (
        state.cleanedPreviewUrl
    ) {

        try {

            URL.revokeObjectURL(
                state.cleanedPreviewUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][PREVIEW] Revoke cleanedPreviewUrl gagal.",
                error
            );

        }

    }


    if (
        state.cleanedURL &&
        state.cleanedURL !==
            state.cleanedPreviewUrl
    ) {

        try {

            URL.revokeObjectURL(
                state.cleanedURL
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][PREVIEW] Revoke cleanedURL gagal.",
                error
            );

        }

    }


    state.cleanedPreviewUrl =
        null;


    state.cleanedURL =
        null;

}


/* =========================================================
   RENDER ORIGINAL PREVIEW
========================================================= */

export async function renderOriginalPreview(
    file
) {

    /*
       PERBAIKAN UTAMA:

       Sebelumnya:

       !(file instanceof Blob)

       Sekarang memakai isBlobLike()
       sehingga File valid tidak ditolak hanya
       karena berasal dari realm / wrapper berbeda.
    */

    if (
        !isBlobLike(
            file
        )
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] File original tidak valid.",
            {
                value: file,
                constructor:
                    file?.constructor?.name,
                type:
                    file?.type,
                size:
                    file?.size,
                name:
                    file?.name
            }
        );


        return false;

    }


    /*
       File kosong tetap tidak valid.
    */

    if (
        typeof file.size ===
            "number" &&
        file.size <= 0
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] File original kosong."
        );


        return false;

    }


    const image =
        elements?.imagePreview ||
        document.getElementById(
            "metadata-image-preview"
        );


    const video =
        elements?.videoPreview ||
        document.getElementById(
            "metadata-video-preview"
        );


    const empty =
        elements?.previewEmpty ||
        document.getElementById(
            "metadata-preview-empty"
        );


    if (
        !image ||
        !video
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Element original preview tidak lengkap."
        );


        return false;

    }


    /*
       Bersihkan original preview lama.
    */

    clearOriginalPreview();


    const type =
        getMediaType(
            file
        );


    /*
       Jika MIME kosong, coba tentukan dari nama file.
    */

    let mediaType =
        type;


    if (
        !mediaType
    ) {

        const name =
            String(
                file?.name ||
                ""
            )
                .toLowerCase();


        if (
            /\.(jpg|jpeg|png|gif|webp|bmp|avif|heic|heif)$/i
                .test(name)
        ) {

            mediaType =
                "image/*";

        }


        else if (
            /\.(mp4|mov|webm|mkv|avi|m4v|mpeg|mpg)$/i
                .test(name)
        ) {

            mediaType =
                "video/*";

        }

    }


    let url;


    try {

        url =
            URL.createObjectURL(
                file
            );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Gagal membuat Object URL.",
            error
        );


        return false;

    }


    /*
       Revoke URL original lama.
    */

    if (
        state.originalPreviewUrl
    ) {

        try {

            URL.revokeObjectURL(
                state.originalPreviewUrl
            );

        } catch (
            error
        ) {

            /* ignore */

        }

    }


    state.originalPreviewUrl =
        url;


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        mediaType.startsWith(
            "image/"
        )
    ) {

        hideElement(
            video
        );


        if (
            empty
        ) {

            hideElement(
                empty
            );

        }


        image.onload =
            function () {

                showElement(
                    image
                );


                image.style.setProperty(
                    "display",
                    "block",
                    "important"
                );


                image.style.setProperty(
                    "max-width",
                    "100%",
                    "important"
                );


                image.style.setProperty(
                    "max-height",
                    "540px",
                    "important"
                );


                image.style.setProperty(
                    "width",
                    "auto",
                    "important"
                );


                image.style.setProperty(
                    "height",
                    "auto",
                    "important"
                );


                image.style.setProperty(
                    "object-fit",
                    "contain",
                    "important"
                );


                console.info(
                    "[GEN-Z.AI][PREVIEW] Original IMAGE preview OK."
                );

            };


        image.onerror =
            function () {

                console.error(
                    "[GEN-Z.AI][PREVIEW] Original image gagal ditampilkan."
                );

            };


        image.src =
            url;


        setPreviewStatus(
            "IMAGE SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
        );


        return true;

    }


    /* =====================================================
       VIDEO
    ===================================================== */

    if (
        mediaType.startsWith(
            "video/"
        )
    ) {

        hideElement(
            image
        );


        if (
            empty
        ) {

            hideElement(
                empty
            );

        }


        video.onloadedmetadata =
            function () {

                showElement(
                    video
                );


                video.style.setProperty(
                    "display",
                    "block",
                    "important"
                );


                video.style.setProperty(
                    "max-width",
                    "100%",
                    "important"
                );


                video.style.setProperty(
                    "max-height",
                    "540px",
                    "important"
                );


                video.style.setProperty(
                    "width",
                    "auto",
                    "important"
                );


                video.style.setProperty(
                    "height",
                    "auto",
                    "important"
                );


                video.style.setProperty(
                    "object-fit",
                    "contain",
                    "important"
                );


                console.info(
                    "[GEN-Z.AI][PREVIEW] Original VIDEO preview OK."
                );

            };


        video.onerror =
            function (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][PREVIEW] Original video gagal ditampilkan.",
                    error
                );

            };


        video.src =
            url;


        video.load();


        setPreviewStatus(
            "VIDEO SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
        );


        return true;

    }


    /* =====================================================
       UNSUPPORTED
    ===================================================== */

    try {

        URL.revokeObjectURL(
            url
        );

    } catch (
        error
    ) {

        /* ignore */

    }


    state.originalPreviewUrl =
        null;


    console.error(
        "[GEN-Z.AI][PREVIEW] Format media tidak didukung.",
        {
            type:
                type,
            name:
                file?.name
        }
    );


    return false;

}


/* =========================================================
   RENDER CLEANED PREVIEW
========================================================= */

export async function renderCleanedPreview(
    source
) {

    /*
       Source WAJIB Blob/File atau blob URL string.
       Jangan pernah memanggil createObjectURL()
       terhadap string.
    */

    let blob =
        null;


    if (
        isBlobLike(
            source
        )
    ) {

        blob =
            source;

    }


    else if (
        source &&
        isBlobLike(
            source.blob
        )
    ) {

        blob =
            source.blob;

    }


    else if (
        source &&
        isBlobLike(
            source.file
        )
    ) {

        blob =
            source.file;

    }


    /*
       Jika source adalah URL string,
       gunakan langsung.
    */

    let url =
        null;


    let ownsURL =
        false;


    if (
        typeof source ===
        "string"
    ) {

        url =
            source;

    }


    else if (
        isBlobLike(
            blob
        )
    ) {

        if (
            !blob.size
        ) {

            console.error(
                "[GEN-Z.AI][PREVIEW] Cleaned Blob kosong."
            );


            return false;

        }


        try {

            url =
                URL.createObjectURL(
                    blob
                );

            ownsURL =
                true;

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI][PREVIEW] Gagal membuat cleaned Object URL.",
                error
            );


            return false;

        }

    }


    if (
        !url
    ) {

        console.error(
            "[GEN-Z.AI][PREVIEW] Source cleaned preview tidak valid:",
            source
        );


        return false;

    }


    const image =
        elements?.cleanImagePreview ||
        document.getElementById(
            "metadata-clean-image-preview"
        );


    const video =
        elements?.cleanVideoPreview ||
        document.getElementById(
            "metadata-clean-video-preview"
        );


    if (
        !image ||
        !video
    ) {

        if (
            ownsURL
        ) {

            try {

                URL.revokeObjectURL(
                    url
                );

            } catch (
                error
            ) {

                /* ignore */

            }

        }


        console.error(
            "[GEN-Z.AI][PREVIEW] Cleaned preview elements tidak lengkap."
        );


        return false;

    }


    /*
       Tentukan MIME type.
    */

    const type =
        String(
            blob?.type ||
            state?.fileType ||
            ""
        )
            .toLowerCase();


    /*
       Simpan URL baru terlebih dahulu.
    */

    const previousURL =
        state.cleanedPreviewUrl ||
        state.cleanedURL ||
        null;


    state.cleanedPreviewUrl =
        url;


    state.cleanedURL =
        url;


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        type.startsWith(
            "image/"
        )
    ) {

        hideElement(
            video
        );


        showElement(
            image
        );


        image.style.setProperty(
            "display",
            "block",
            "important"
        );


        image.style.setProperty(
            "max-width",
            "100%",
            "important"
        );


        image.style.setProperty(
            "max-height",
            "540px",
            "important"
        );


        image.style.setProperty(
            "width",
            "auto",
            "important"
        );


        image.style.setProperty(
            "height",
            "auto",
            "important"
        );


        image.style.setProperty(
            "object-fit",
            "contain",
            "important"
        );


        image.onload =
            function () {

                showElement(
                    image
                );


                image.style.setProperty(
                    "display",
                    "block",
                    "important"
                );


                console.info(
                    "[GEN-Z.AI][PREVIEW] Cleaned IMAGE preview OK."
                );

            };


        image.onerror =
            function () {

                console.error(
                    "[GEN-Z.AI][PREVIEW] Cleaned IMAGE preview gagal."
                );

            };


        image.src =
            url;

    }


    /* =====================================================
       VIDEO
    ===================================================== */

    else if (
        type.startsWith(
            "video/"
        )
    ) {

        hideElement(
            image
        );


        showElement(
            video
        );


        video.style.setProperty(
            "display",
            "block",
            "important"
        );


        video.style.setProperty(
            "max-width",
            "100%",
            "important"
        );


        video.style.setProperty(
            "max-height",
            "540px",
            "important"
        );


        video.style.setProperty(
            "width",
            "auto",
            "important"
        );


        video.style.setProperty(
            "height",
            "auto",
            "important"
        );


        video.style.setProperty(
            "object-fit",
            "contain",
            "important"
        );


        video.onloadedmetadata =
            function () {

                showElement(
                    video
                );


                video.style.setProperty(
                    "display",
                    "block",
                    "important"
                );


                console.info(
                    "[GEN-Z.AI][PREVIEW] Cleaned VIDEO preview OK."
                );

            };


        video.onerror =
            function () {

                console.error(
                    "[GEN-Z.AI][PREVIEW] Cleaned VIDEO preview gagal."
                );

            };


        video.src =
            url;


        video.load();

    }


    /* =====================================================
       FALLBACK MIME
    ===================================================== */

    else {

        const originalType =
            String(
                state?.file?.type ||
                ""
            )
                .toLowerCase();


        if (
            originalType.startsWith(
                "image/"
            )
        ) {

            hideElement(
                video
            );


            showElement(
                image
            );


            image.style.setProperty(
                "display",
                "block",
                "important"
            );


            image.src =
                url;

        }


        else if (
            originalType.startsWith(
                "video/"
            )
        ) {

            hideElement(
                image
            );


            showElement(
                video
            );


            video.style.setProperty(
                "display",
                "block",
                "important"
            );


            video.src =
                url;


            video.load();

        }


        else {

            if (
                ownsURL
            ) {

                try {

                    URL.revokeObjectURL(
                        url
                    );

                } catch (
                    error
                ) {

                    /* ignore */

                }

            }


            state.cleanedPreviewUrl =
                null;


            state.cleanedURL =
                null;


            return false;

        }

    }


    /*
       Setelah URL baru dipasang,
       revoke URL hasil lama.
    */

    if (
        previousURL &&
        previousURL !== url
    ) {

        try {

            URL.revokeObjectURL(
                previousURL
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][PREVIEW] Revoke URL lama gagal.",
                error
            );

        }

    }


    console.info(
        "[GEN-Z.AI][PREVIEW] Cleaned preview rendered:",
        {
            type,
            url
        }
    );


    return true;

}
