/* =========================================================
   GEN-Z.AI
   METADATA DOWNLOAD MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-download.js

   Fungsi:
   - Download file hasil cleaning
   - Menentukan nama file hasil
   - Tidak mengubah state cleaning
   - Tidak mengubah file asli
========================================================= */


import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOWNLOAD CLEANED FILE
========================================================= */

async function saveBlobInAndroid(
    blob,
    fileName
) {

    const bridge =
        window.GENZAndroidDownloads;

    if (!bridge) {
        return null;
    }

    if (
        typeof window.GENZMobileDownload ===
        "function"
    ) {
        return window.GENZMobileDownload(
            blob,
            fileName
        );
    }

    const downloadId =
        bridge.beginBlobDownload(
            fileName,
            blob.type || "application/octet-stream"
        );

    if (!downloadId) {
        throw new Error(
            "Android gagal menyiapkan file unduhan."
        );
    }

    try {
        const chunkSize = 48 * 1024;

        for (
            let offset = 0;
            offset < blob.size;
            offset += chunkSize
        ) {
            const bytes = new Uint8Array(
                await blob
                    .slice(offset, Math.min(offset + chunkSize, blob.size))
                    .arrayBuffer()
            );

            let binary = "";
            for (const byte of bytes) {
                binary += String.fromCharCode(byte);
            }

            if (
                !bridge.writeBlobChunk(
                    downloadId,
                    window.btoa(binary)
                )
            ) {
                throw new Error(
                    "Android gagal menerima isi file unduhan."
                );
            }
        }

        if (!bridge.finishBlobDownload(downloadId)) {
            throw new Error(
                "Android gagal menyimpan file unduhan."
            );
        }

        return true;
    } catch (error) {
        bridge.cancelBlobDownload(downloadId);
        throw error;
    }
}


async function downloadCleanedFile() {

    if (
        !(state.cleanedBlob instanceof Blob) ||
        state.cleanedBlob.size === 0
    ) {

        console.error(
            "[GEN-Z.AI][DOWNLOAD] Blob hasil cleaning tidak tersedia atau kosong.",
            {
                hasBlob: Boolean(state.cleanedBlob),
                size: state.cleanedBlob?.size || 0
            }
        );

        return false;
    }

    const fileName =
        state.cleanedFile?.name ||
        createCleanedFilename(
            state.file?.name ||
            "media"
        );

    if (window.GENZAndroidDownloads) {
        try {
            const saved =
                await saveBlobInAndroid(
                    state.cleanedBlob,
                    fileName
                );

            if (saved !== true) {
                throw new Error(
                    "File tidak berhasil disimpan di perangkat."
                );
            }

            return true;
        } catch (error) {
            console.error(
                "[GEN-Z.AI][DOWNLOAD] Android gagal menyimpan hasil cleaning.",
                error
            );
            window.GENZAndroidDownloads
                .notifyDownloadFailure?.();
            throw error;
        }
    }

    let downloadURL;

    try {

        downloadURL =
            URL.createObjectURL(
                state.cleanedBlob
            );

        const anchor =
            document.createElement(
                "a"
            );

        anchor.href =
            downloadURL;


        anchor.download =
            fileName;


        anchor.style.display =
            "none";


        document.body.appendChild(
            anchor
        );

        anchor.click();


        anchor.remove();

        setTimeout(
            () => URL.revokeObjectURL(downloadURL),
            60_000
        );

        return true;

    } catch (error) {

        if (downloadURL) {

            URL.revokeObjectURL(
                downloadURL
            );
        }

        console.error(
            "[GEN-Z.AI][DOWNLOAD] Gagal mengunduh file hasil cleaning.",
            error
        );

        throw error;
    }
}


/* =========================================================
   CREATE CLEANED FILENAME
========================================================= */

function createCleanedFilename(
    originalName
) {

    const safeName =
        String(
            originalName ||
            "media"
        );


    const dot =
        safeName.lastIndexOf(
            "."
        );


    if (
        dot <= 0
    ) {

        return `${safeName}_cleaned`;
    }


    const base =
        safeName.slice(
            0,
            dot
        );


    const extension =
        safeName.slice(
            dot + 1
        );


    return `${base}_cleaned.${extension}`;
}


/* =========================================================
   PUBLIC API
========================================================= */

export {

    downloadCleanedFile,

    createCleanedFilename

};


window.GENZMetadataDownload = {

    downloadCleanedFile,

    createCleanedFilename

};
