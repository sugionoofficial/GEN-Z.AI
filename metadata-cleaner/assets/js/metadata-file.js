/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-file.js

   Tanggung jawab:
   - File picker
   - File input
   - Drag & Drop
   - Validasi format media
   - Deteksi tipe media
   - Menyimpan file aktif ke state
   - Membuat original object URL
   - Menampilkan informasi file
   - Memastikan original preview tampil
========================================================= */


/* =========================================================
   STATE
========================================================= */

import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOM
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   STATUS
========================================================= */

import {
    setStatus
} from "./metadata-status.js";


/* =========================================================
   RESET
========================================================= */

import {
    resetForNewFile
} from "./metadata-reset.js";


/* =========================================================
   PREVIEW
========================================================= */

import {
    renderOriginalPreview,
    setPreviewStatus
} from "./metadata-preview.js";


/* =========================================================
   FILE PICKER
========================================================= */

export function openFilePicker() {

    const input =
        elements?.fileInput;


    if (
        !input
    ) {

        console.error(
            "[GEN-Z.AI] metadata-file: #metadata-file-input tidak ditemukan."
        );

        return;
    }


    try {

        input.click();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-file: gagal membuka file picker.",
            error
        );

    }

}


/* =========================================================
   FILE INPUT CHANGE
========================================================= */

export function handleFileInput(
    event
) {

    const input =
        event?.target;


    if (
        !input
    ) {

        console.warn(
            "[GEN-Z.AI] metadata-file: event file input tidak memiliki target."
        );

        return;
    }


    const files =
        Array.from(
            input.files || []
        );


    console.info(
        "[GEN-Z.AI] File input change:",
        files.length,
        files
    );


    if (
        files.length === 0
    ) {

        return;
    }


    processSelectedFile(
        files[0]
    );


    /*
       Reset value dilakukan setelah file diproses,
       bukan sebelum.

       Dengan demikian user dapat memilih file yang
       sama lagi pada percobaan berikutnya.
    */

    try {

        input.value = "";

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] metadata-file: gagal reset input value.",
            error
        );

    }

}


/* =========================================================
   DRAG OVER
========================================================= */

export function handleDragOver(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    elements.dropzone?.classList.add(
        "is-dragging"
    );

}


/* =========================================================
   DRAG LEAVE
========================================================= */

export function handleDragLeave(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    elements.dropzone?.classList.remove(
        "is-dragging"
    );

}


/* =========================================================
   DROP
========================================================= */

export function handleDrop(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    elements.dropzone?.classList.remove(
        "is-dragging"
    );


    const files =
        Array.from(
            event?.dataTransfer?.files || []
        );


    console.info(
        "[GEN-Z.AI] Drop:",
        files.length,
        files
    );


    if (
        files.length === 0
    ) {

        return;
    }


    processSelectedFile(
        files[0]
    );

}


/* =========================================================
   PROCESS SELECTED FILE
========================================================= */

export function processSelectedFile(
    file
) {

    console.group(
        "[GEN-Z.AI] PROCESS SELECTED FILE"
    );


    try {

        /* =====================================================
           VALIDASI FILE
        ===================================================== */

        if (
            !file
        ) {

            console.error(
                "[GEN-Z.AI] File kosong."
            );

            return;
        }


        console.info(
            "Name:",
            file.name
        );

        console.info(
            "Type:",
            file.type
        );

        console.info(
            "Size:",
            file.size
        );


        /* =====================================================
           VALIDASI FORMAT
        ===================================================== */

        if (
            !isSupportedMedia(
                file
            )
        ) {

            console.error(
                "[GEN-Z.AI] Format media tidak didukung:",
                file.name,
                file.type
            );


            setStatus(
                "UNKNOWN",
                "FORMAT TIDAK DIDUKUNG",
                "Pilih file foto atau video yang dapat diproses oleh browser."
            );


            setPreviewStatus(
                "FORMAT MEDIA TIDAK DIDUKUNG."
            );


            return;
        }


        /* =====================================================
           DETECT MEDIA TYPE
        ===================================================== */

        const mediaType =
            detectMediaType(
                file
            );


        console.info(
            "Media type:",
            mediaType
        );


        if (
            mediaType !== "image" &&
            mediaType !== "video"
        ) {

            console.error(
                "[GEN-Z.AI] Media type tidak valid:",
                mediaType
            );


            return;
        }


        /* =====================================================
           RESET FILE LAMA
        ===================================================== */

        resetForNewFile();


        /* =====================================================
           SIMPAN FILE KE STATE
        ===================================================== */

        state.file =
            file;


        state.fileType =
            mediaType;


        /*
           Beberapa bagian aplikasi lama menggunakan
           mediaType / isImage / isVideo.
           Isi juga jika property tersebut tersedia.
        */

        if (
            Object.prototype.hasOwnProperty.call(
                state,
                "mediaType"
            )
        ) {

            state.mediaType =
                mediaType;

        }


        if (
            Object.prototype.hasOwnProperty.call(
                state,
                "isImage"
            )
        ) {

            state.isImage =
                mediaType === "image";

        }


        if (
            Object.prototype.hasOwnProperty.call(
                state,
                "isVideo"
            )
        ) {

            state.isVideo =
                mediaType === "video";

        }


        /* =====================================================
           CREATE OBJECT URL
        ===================================================== */

        let objectURL =
            null;


        try {

            objectURL =
                URL.createObjectURL(
                    file
                );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] URL.createObjectURL gagal:",
                error
            );

        }


        if (
            !objectURL
        ) {

            console.error(
                "[GEN-Z.AI] Original Object URL tidak berhasil dibuat."
            );


            state.originalURL =
                null;


            setPreviewStatus(
                "FILE TERPILIH, TETAPI PREVIEW URL GAGAL DIBUAT."
            );


            return;
        }


        state.originalURL =
            objectURL;


        /*
           Compatibility state untuk versi state yang
           menggunakan nama previewUrl / previewObjectUrl.
        */

        if (
            Object.prototype.hasOwnProperty.call(
                state,
                "previewUrl"
            )
        ) {

            state.previewUrl =
                objectURL;

        }


        if (
            Object.prototype.hasOwnProperty.call(
                state,
                "previewObjectUrl"
            )
        ) {

            state.previewObjectUrl =
                objectURL;

        }


        console.info(
            "Original URL:",
            objectURL
        );


        /* =====================================================
           UPDATE FILE INFO
        ===================================================== */

        updateFileInfo();


        /* =====================================================
           FORCE PREVIEW DOM STATE
        ===================================================== */

        preparePreviewDOM(
            mediaType
        );


        /* =====================================================
           RENDER ORIGINAL PREVIEW
        ===================================================== */

        renderOriginalPreview();


        /*
           renderOriginalPreview() adalah renderer utama.
           Tetapi kita juga memberikan fallback langsung
           apabila renderer tidak berhasil mengubah DOM.
        */

        setTimeout(
            () => {

                verifyPreview(
                    file,
                    mediaType,
                    objectURL
                );

            },
            50
        );


        /* =====================================================
           BUTTON STATE
        ===================================================== */

        if (
            elements.checkButton
        ) {

            elements.checkButton.disabled =
                false;

        }


        if (
            elements.cleanButton
        ) {

            elements.cleanButton.disabled =
                true;

        }


        if (
            elements.downloadButton
        ) {

            elements.downloadButton.disabled =
                true;

        }


        /* =====================================================
           STATUS
        ===================================================== */

        setPreviewStatus(
            mediaType === "image"
                ? "IMAGE SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
                : "VIDEO SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
        );


        setStatus(
            "UNKNOWN",
            "BELUM DIPERIKSA",
            "Tekan CHECK untuk membaca metadata media."
        );


        console.info(
            "[GEN-Z.AI] File berhasil diproses:",
            file.name
        );

    } finally {

        console.groupEnd();

    }

}


/* =========================================================
   PREPARE PREVIEW DOM
   ---------------------------------------------------------
   Ini sengaja berada di file upload sebagai safety layer.

   Tujuannya memastikan CSS class "hidden" tidak tetap
   menutupi media setelah file berhasil dipilih.
========================================================= */

function preparePreviewDOM(
    mediaType
) {

    const stage =
        document.getElementById(
            "metadata-preview-stage"
        );


    const empty =
        document.getElementById(
            "metadata-preview-empty"
        );


    const image =
        document.getElementById(
            "metadata-image-preview"
        );


    const video =
        document.getElementById(
            "metadata-video-preview"
        );


    if (
        stage
    ) {

        stage.hidden =
            false;

        stage.removeAttribute(
            "hidden"
        );

        stage.style.setProperty(
            "display",
            "flex",
            "important"
        );

        stage.style.setProperty(
            "visibility",
            "visible",
            "important"
        );

        stage.style.setProperty(
            "opacity",
            "1",
            "important"
        );

    }


    if (
        empty
    ) {

        empty.hidden =
            true;

        empty.classList.add(
            "hidden"
        );

        empty.style.setProperty(
            "display",
            "none",
            "important"
        );

    }


    if (
        mediaType === "image"
    ) {

        /*
           IMAGE tampil.
        */

        if (
            image
        ) {

            image.hidden =
                false;

            image.removeAttribute(
                "hidden"
            );

            image.classList.remove(
                "hidden"
            );

            image.style.setProperty(
                "display",
                "block",
                "important"
            );

            image.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            image.style.setProperty(
                "opacity",
                "1",
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

            image.style.setProperty(
                "position",
                "relative",
                "important"
            );

            image.style.setProperty(
                "z-index",
                "2",
                "important"
            );

        }


        /*
           VIDEO disembunyikan.
        */

        if (
            video
        ) {

            video.pause?.();

            video.hidden =
                true;

            video.classList.add(
                "hidden"
            );

            video.style.setProperty(
                "display",
                "none",
                "important"
            );

        }

        return;
    }


    if (
        mediaType === "video"
    ) {

        /*
           IMAGE disembunyikan.
        */

        if (
            image
        ) {

            image.hidden =
                true;

            image.classList.add(
                "hidden"
            );

            image.style.setProperty(
                "display",
                "none",
                "important"
            );

        }


        /*
           VIDEO tampil.
        */

        if (
            video
        ) {

            video.hidden =
                false;

            video.removeAttribute(
                "hidden"
            );

            video.classList.remove(
                "hidden"
            );

            video.style.setProperty(
                "display",
                "block",
                "important"
            );

            video.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            video.style.setProperty(
                "opacity",
                "1",
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

            video.style.setProperty(
                "position",
                "relative",
                "important"
            );

            video.style.setProperty(
                "z-index",
                "2",
                "important"
            );

        }

    }

}


/* =========================================================
   VERIFY PREVIEW
   ---------------------------------------------------------
   Jika renderer preview gagal bekerja karena masalah
   module/cache/DOM, fungsi ini melakukan fallback langsung.
========================================================= */

function verifyPreview(
    file,
    mediaType,
    objectURL
) {

    if (
        !file ||
        !objectURL
    ) {

        return;
    }


    if (
        state.file !== file
    ) {

        return;
    }


    const image =
        document.getElementById(
            "metadata-image-preview"
        );


    const video =
        document.getElementById(
            "metadata-video-preview"
        );


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        mediaType === "image"
    ) {

        if (
            !image
        ) {

            console.error(
                "[GEN-Z.AI] #metadata-image-preview tidak ditemukan."
            );

            return;
        }


        /*
           Pastikan DOM tidak lagi hidden.
        */

        image.hidden =
            false;

        image.removeAttribute(
            "hidden"
        );

        image.classList.remove(
            "hidden"
        );

        image.style.setProperty(
            "display",
            "block",
            "important"
        );

        image.style.setProperty(
            "visibility",
            "visible",
            "important"
        );

        image.style.setProperty(
            "opacity",
            "1",
            "important"
        );


        /*
           Jika src kosong, pasang ulang.
        */

        if (
            !image.src ||
            image.src !== objectURL
        ) {

            try {

                image.src =
                    objectURL;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Fallback image src gagal:",
                    error
                );

                fallbackImageReader(
                    image,
                    file
                );

                return;
            }

        }


        /*
           Jika browser sudah berhasil decode image,
           pastikan preview tetap terlihat.
        */

        if (
            image.complete &&
            image.naturalWidth > 0
        ) {

            image.style.setProperty(
                "display",
                "block",
                "important"
            );

            image.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            image.style.setProperty(
                "opacity",
                "1",
                "important"
            );


            console.info(
                "[GEN-Z.AI] Preview image terverifikasi:",
                image.naturalWidth,
                "x",
                image.naturalHeight
            );


            return;
        }


        /*
           Jika belum berhasil decode, pasang event
           fallback.
        */

        image.onload = () => {

            if (
                state.file !== file
            ) {

                return;
            }


            image.hidden =
                false;

            image.classList.remove(
                "hidden"
            );

            image.style.setProperty(
                "display",
                "block",
                "important"
            );

            image.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            image.style.setProperty(
                "opacity",
                "1",
                "important"
            );


            console.info(
                "[GEN-Z.AI] Preview image berhasil tampil."
            );

        };


        image.onerror = () => {

            if (
                state.file !== file
            ) {

                return;
            }


            console.warn(
                "[GEN-Z.AI] Object URL gagal. Menggunakan FileReader."
            );


            fallbackImageReader(
                image,
                file
            );

        };


        return;
    }


    /* =====================================================
       VIDEO
    ===================================================== */

    if (
        mediaType === "video"
    ) {

        if (
            !video
        ) {

            console.error(
                "[GEN-Z.AI] #metadata-video-preview tidak ditemukan."
            );

            return;
        }


        video.hidden =
            false;

        video.removeAttribute(
            "hidden"
        );

        video.classList.remove(
            "hidden"
        );

        video.style.setProperty(
            "display",
            "block",
            "important"
        );

        video.style.setProperty(
            "visibility",
            "visible",
            "important"
        );

        video.style.setProperty(
            "opacity",
            "1",
            "important"
        );


        video.controls =
            true;

        video.playsInline =
            true;

        video.preload =
            "metadata";


        if (
            video.src !== objectURL
        ) {

            try {

                video.src =
                    objectURL;

                video.load();

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Fallback video src gagal:",
                    error
                );

            }

        }

    }

}


/* =========================================================
   IMAGE FILEREADER FALLBACK
========================================================= */

function fallbackImageReader(
    image,
    file
) {

    if (
        !image ||
        !file
    ) {

        return;
    }


    if (
        state.file !== file
    ) {

        return;
    }


    if (
        typeof FileReader ===
        "undefined"
    ) {

        console.error(
            "[GEN-Z.AI] FileReader tidak tersedia."
        );

        return;
    }


    const reader =
        new FileReader();


    reader.onload = () => {

        if (
            state.file !== file
        ) {

            return;
        }


        const result =
            reader.result;


        if (
            typeof result !== "string" ||
            !result
        ) {

            console.error(
                "[GEN-Z.AI] FileReader tidak menghasilkan source image."
            );

            return;
        }


        image.onload = () => {

            if (
                state.file !== file
            ) {

                return;
            }


            image.hidden =
                false;

            image.removeAttribute(
                "hidden"
            );

            image.classList.remove(
                "hidden"
            );

            image.style.setProperty(
                "display",
                "block",
                "important"
            );

            image.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            image.style.setProperty(
                "opacity",
                "1",
                "important"
            );


            console.info(
                "[GEN-Z.AI] Preview image berhasil melalui FileReader."
            );

        };


        image.onerror = () => {

            console.error(
                "[GEN-Z.AI] FileReader juga gagal membaca image:",
                file.name
            );

        };


        try {

            image.src =
                result;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Gagal memasang FileReader source:",
                error
            );

        }

    };


    reader.onerror = () => {

        console.error(
            "[GEN-Z.AI] FileReader error:",
            reader.error
        );

    };


    reader.onabort = () => {

        console.warn(
            "[GEN-Z.AI] FileReader dibatalkan."
        );

    };


    try {

        reader.readAsDataURL(
            file
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] readAsDataURL gagal:",
            error
        );

    }

}


/* =========================================================
   SUPPORTED MEDIA
========================================================= */

export function isSupportedMedia(
    file
) {

    if (
        !file
    ) {

        return false;
    }


    /*
       MIME utama.
    */

    if (
        typeof file.type === "string" &&
        file.type
    ) {

        if (
            file.type.startsWith(
                "image/"
            )
        ) {

            return true;
        }


        if (
            file.type.startsWith(
                "video/"
            )
        ) {

            return true;
        }

    }


    /*
       Extension fallback.
    */

    const extension =
        getExtension(
            file.name
        );


    return [

        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "tif",
        "tiff",
        "avif",

        "mp4",
        "mov",
        "m4v",
        "webm",
        "mkv",
        "avi",
        "mpeg",
        "mpg",
        "3gp",
        "ogv"

    ].includes(
        extension
    );

}


/* =========================================================
   DETECT MEDIA TYPE
========================================================= */

export function detectMediaType(
    file
) {

    if (
        !file
    ) {

        return null;
    }


    if (
        typeof file.type === "string"
    ) {

        if (
            file.type.startsWith(
                "image/"
            )
        ) {

            return "image";
        }


        if (
            file.type.startsWith(
                "video/"
            )
        ) {

            return "video";
        }

    }


    const extension =
        getExtension(
            file.name
        );


    if (
        [

            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif",
            "bmp",
            "tif",
            "tiff",
            "avif"

        ].includes(
            extension
        )
    ) {

        return "image";
    }


    if (
        [

            "mp4",
            "mov",
            "m4v",
            "webm",
            "mkv",
            "avi",
            "mpeg",
            "mpg",
            "3gp",
            "ogv"

        ].includes(
            extension
        )
    ) {

        return "video";
    }


    return null;

}


/* =========================================================
   UPDATE FILE INFO
========================================================= */

export function updateFileInfo() {

    if (
        !state.file
    ) {

        return;
    }


    const fileInfo =
        elements.fileInfo;


    if (
        fileInfo
    ) {

        fileInfo.classList.remove(
            "hidden"
        );

        fileInfo.hidden =
            false;

        fileInfo.removeAttribute(
            "hidden"
        );

        fileInfo.style.setProperty(
            "display",
            "flex",
            "important"
        );

    }


    if (
        elements.fileType
    ) {

        elements.fileType.textContent =
            state.fileType === "image"
                ? "IMAGE"
                : "VIDEO";

    }


    if (
        elements.fileName
    ) {

        elements.fileName.textContent =
            state.file.name ||
            "";

    }


    if (
        elements.fileSize
    ) {

        elements.fileSize.textContent =
            formatBytes(
                state.file.size
            );

    }

}


/* =========================================================
   FORMAT BYTES
========================================================= */

export function formatBytes(
    bytes
) {

    const numeric =
        Number(
            bytes
        );


    if (
        !Number.isFinite(
            numeric
        ) ||
        numeric <= 0
    ) {

        return "0 B";
    }


    const units = [

        "B",
        "KB",
        "MB",
        "GB",
        "TB"

    ];


    const index =
        Math.floor(
            Math.log(
                numeric
            ) /
            Math.log(
                1024
            )
        );


    const safeIndex =
        Math.max(
            0,
            Math.min(
                index,
                units.length - 1
            )
        );


    const value =
        numeric /
        Math.pow(
            1024,
            safeIndex
        );


    return `${value.toFixed(
        safeIndex === 0
            ? 0
            : 2
    )} ${units[safeIndex]}`;

}


/* =========================================================
   EXTENSION
========================================================= */

export function getExtension(
    filename
) {

    const clean =
        String(
            filename || ""
        )
        .split("?")[0]
        .split("#")[0];


    const dot =
        clean.lastIndexOf(
            "."
        );


    if (
        dot < 0
    ) {

        return "";
    }


    return clean
        .slice(
            dot + 1
        )
        .toLowerCase();

}


/* =========================================================
   REVOKE OBJECT URL
========================================================= */

export function revokeObjectURL(
    url
) {

    if (
        !url ||
        typeof url !== "string"
    ) {

        return;
    }


    if (
        !url.startsWith(
            "blob:"
        )
    ) {

        return;
    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] revokeObjectURL gagal:",
            error
        );

    }

}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    openFilePicker,

    handleFileInput,

    handleDragOver,

    handleDragLeave,

    handleDrop,

    processSelectedFile,

    isSupportedMedia,

    detectMediaType,

    updateFileInfo,

    formatBytes,

    getExtension,

    revokeObjectURL

};
