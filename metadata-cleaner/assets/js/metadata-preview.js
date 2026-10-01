/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Fungsi:
   - Render preview file asli
   - Render preview hasil cleaning
   - Mengatur status preview
   - Helper show / hide element

   Catatan:
   - Tidak mengubah state file
   - Tidak mengubah proses metadata
   - Tidak mengubah proses cleaning
   - Tidak membuat object URL baru
   - Menggunakan object URL yang dibuat oleh metadata-app.js
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
   ORIGINAL PREVIEW
========================================================= */

export function renderOriginalPreview() {

    const image =
        elements?.imagePreview;

    const video =
        elements?.videoPreview;

    const empty =
        elements?.previewEmpty;


    /* =====================================================
       RESET VISUAL PREVIEW
    ===================================================== */

    hideElement(
        image
    );

    hideElement(
        video
    );

    hideElement(
        elements?.aiOverlay
    );


    /* =====================================================
       NO FILE
    ===================================================== */

    if (
        !state.file ||
        !state.originalURL
    ) {

        showElement(
            empty
        );

        return;
    }


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        state.fileType === "image"
    ) {

        /*
           Pastikan element image memang tersedia.
        */

        if (
            !image
        ) {

            console.error(
                "[GEN-Z.AI] Preview image element tidak ditemukan: #metadata-image-preview"
            );

            showElement(
                empty
            );

            return;
        }


        /*
           Pastikan preview kosong terlebih dahulu.
        */

        image.removeAttribute(
            "hidden"
        );

        image.classList.remove(
            "hidden"
        );

        image.style.display =
            "block";

        image.style.visibility =
            "visible";

        image.style.opacity =
            "1";


        /*
           Pasang object URL file asli.
        */

        image.src =
            state.originalURL;


        /*
           Pastikan browser melakukan load
           terhadap object URL baru.
        */

        image.onload =
            () => {

                /*
                   Jangan mengubah state.

                   Hanya memastikan preview tetap
                   terlihat setelah browser selesai
                   memuat image.
                */

                if (
                    state.file &&
                    state.fileType === "image" &&
                    state.originalURL === image.src
                ) {

                    showElement(
                        image
                    );

                }

            };


        image.onerror =
            (error) => {

                console.error(
                    "[GEN-Z.AI] Gagal memuat image preview:",
                    error
                );


                /*
                   Jangan biarkan image rusak
                   tetap menutupi empty state.
                */

                hideElement(
                    image
                );


                showElement(
                    empty
                );

            };


        /*
           Empty state harus disembunyikan.
        */

        hideElement(
            empty
        );


        return;
    }


    /* =====================================================
       VIDEO
    ===================================================== */

    if (
        state.fileType === "video"
    ) {

        if (
            !video
        ) {

            console.error(
                "[GEN-Z.AI] Preview video element tidak ditemukan: #metadata-video-preview"
            );

            showElement(
                empty
            );

            return;
        }


        /*
           Bersihkan source lama.
        */

        video.pause();


        video.removeAttribute(
            "hidden"
        );

        video.classList.remove(
            "hidden"
        );

        video.style.display =
            "block";

        video.style.visibility =
            "visible";

        video.style.opacity =
            "1";


        /*
           Pasang object URL.
        */

        video.src =
            state.originalURL;


        /*
           Browser memuat video.
        */

        video.load();


        /*
           Empty state disembunyikan.
        */

        hideElement(
            empty
        );


        return;
    }


    /* =====================================================
       FALLBACK
    ===================================================== */

    showElement(
        empty
    );

}


/* =========================================================
   CLEANED PREVIEW
========================================================= */

export function renderCleanedPreview(
    url
) {

    const image =
        elements?.cleanImagePreview;

    const video =
        elements?.cleanVideoPreview;


    /* =====================================================
       BERSIHKAN PREVIEW HASIL SEBELUMNYA
    ===================================================== */

    hideElement(
        image
    );

    hideElement(
        video
    );


    /* =====================================================
       NO CLEANED URL
    ===================================================== */

    if (
        !url
    ) {

        return;
    }


    /* =====================================================
       CLEANED IMAGE
    ===================================================== */

    if (
        state.fileType === "image"
    ) {

        if (
            !image
        ) {

            console.error(
                "[GEN-Z.AI] Cleaned image preview element tidak ditemukan."
            );

            return;
        }


        image.removeAttribute(
            "hidden"
        );

        image.classList.remove(
            "hidden"
        );

        image.style.display =
            "block";

        image.style.visibility =
            "visible";

        image.style.opacity =
            "1";


        image.src =
            url;


        hideElement(
            video
        );


        return;
    }


    /* =====================================================
       CLEANED VIDEO
    ===================================================== */

    if (
        state.fileType === "video"
    ) {

        if (
            !video
        ) {

            console.error(
                "[GEN-Z.AI] Cleaned video preview element tidak ditemukan."
            );

            return;
        }


        video.removeAttribute(
            "hidden"
        );

        video.classList.remove(
            "hidden"
        );

        video.style.display =
            "block";

        video.style.visibility =
            "visible";

        video.style.opacity =
            "1";


        video.src =
            url;


        video.load();


        hideElement(
            image
        );

    }

}


/* =========================================================
   PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    text
) {

    if (
        !elements?.previewStatus
    ) {

        return;
    }


    elements.previewStatus.textContent =
        text || "";

}


/* =========================================================
   SHOW ELEMENT
   ---------------------------------------------------------
   Jangan hanya menghapus class.

   Property hidden juga dikembalikan ke false
   supaya tidak ada konflik dengan HTML/DOM state.
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


    element.classList.add(
        "hidden"
    );


    /*
       Jangan menggunakan property hidden
       untuk preview utama karena CSS aplikasi
       menggunakan class .hidden sebagai sumber
       visibility.

       Cukup classList di sini.
    */

}
