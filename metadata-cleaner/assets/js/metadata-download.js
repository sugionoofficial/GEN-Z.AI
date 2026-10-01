/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-download.js

   Fungsi:
   - Download file hasil cleaning
   - Membuat nama file hasil cleaning

   Catatan:
   - Tidak melakukan proses cleaning
   - Tidak membaca metadata
   - Tidak membuat object URL baru
   - Menggunakan cleanedURL yang sudah dibuat oleh app
   - Tidak mengubah file asli
========================================================= */


import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOWNLOAD CLEANED FILE
========================================================= */

export function downloadCleanedFile() {

    /*
       Pastikan hasil cleaning tersedia
    */

    if (
        !state.cleanedURL ||
        !state.cleanedBlob ||
        !state.file
    ) {

        return;
    }


    /*
       Buat temporary anchor
    */

    const link =
        document.createElement(
            "a"
        );


    link.href =
        state.cleanedURL;


    link.download =
        createCleanedFilename(
            state.file.name
        );


    /*
       Beberapa browser membutuhkan
       anchor berada di DOM
    */

    link.style.display =
        "none";


    document.body.appendChild(
        link
    );


    /*
       Trigger download
    */

    link.click();


    /*
       Bersihkan temporary element
    */

    link.remove();

}


/* =========================================================
   CREATE CLEANED FILENAME
   ---------------------------------------------------------
   Mempertahankan perilaku asli metadata-app.js
========================================================= */

export function createCleanedFilename(
    originalName
) {

    const dot =
        originalName.lastIndexOf(
            "."
        );


    /*
       File tanpa extension
    */

    if (
        dot <= 0
    ) {

        return (
            `${originalName}_cleaned`
        );

    }


    /*
       Pisahkan nama dan extension
    */

    const base =
        originalName.slice(
            0,
            dot
        );


    const extension =
        originalName.slice(
            dot + 1
        );


    /*
       Nama hasil cleaning
    */

    return (
        `${base}_cleaned.${extension}`
    );

}
