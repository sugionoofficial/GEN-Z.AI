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


import {
    elements
} from "./metadata-dom.js";


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
========================================================= */

export function createCleanedFilename(
    originalName
) {

    const name =
        String(
            originalName || "file"
        );


    /*
       Pisahkan nama dan extension
    */

    const lastDot =
        name.lastIndexOf(
            "."
        );


    let baseName =
        name;


    let extension =
        "";


    if (
        lastDot > 0
    ) {

        baseName =
            name.slice(
                0,
                lastDot
            );


        extension =
            name.slice(
                lastDot
            );

    }


    /*
       Jika nama sudah mengandung suffix
       cleaned, jangan menambahkannya lagi
    */

    if (
        /(?:[_-]cleaned)$/i.test(
            baseName
        )
    ) {

        return (
            baseName +
            extension
        );

    }


    /*
       Nama hasil cleaning
    */

    return (
        `${baseName}_cleaned` +
        extension
    );

}
