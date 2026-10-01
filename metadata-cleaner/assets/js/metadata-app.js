/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-app.js

   Fungsi:
   - Inisialisasi aplikasi
   - Menangani file input / drag & drop
   - Koordinasi pembacaan metadata
   - Koordinasi local AI metadata detection
   - Koordinasi Sightengine visual AI detection
   - Menghubungkan module cleaning
   - Menyediakan public API

   Architecture:
   - metadata-state.js
   - metadata-dom.js
   - metadata-events.js
   - metadata-normalizer.js
   - metadata-detector.js
   - metadata-status.js
   - metadata-image.js
   - metadata-video.js
   - metadata-file.js
   - metadata-preview.js
   - metadata-download.js
   - metadata-reset.js
   - metadata-clean.js
   - metadata-cleaner-image.js
   - metadata-cleaner-video.js
   - metadata-sightengine.js

   Catatan:
   - File ini hanya menjadi coordinator.
   - Implementasi fungsi yang sudah dipindahkan
     tidak diduplikasi di sini.
   - Sightengine hanya digunakan untuk IMAGE.
   - Video tetap menggunakan detector metadata lokal.
   - API credential Sightengine tidak pernah berada
     di browser.
========================================================= */


/* =========================================================
   STATE
========================================================= */

import {
    state,
    setSightengineDetection,
    setSightengineLoading,
    setSightengineError
} from "./metadata-state.js";


/* =========================================================
   DOM
========================================================= */

import {
    elements,
    cacheElements
} from "./metadata-dom.js";


/* =========================================================
   EVENTS
========================================================= */

import {
    bindMetadataEvents
} from "./metadata-events.js";


/* =========================================================
   NORMALIZER
========================================================= */

import {
    normalizeMetadata
} from "./metadata-normalizer.js";


/* =========================================================
   LOCAL DETECTOR
========================================================= */

import {
    detectAIIndicators
} from "./metadata-detector.js";


/* =========================================================
   SIGHTENGINE
========================================================= */

import {
    detectSightengine,
    canUseSightengine
} from "./metadata-sightengine.js";


/* =========================================================
   STATUS
========================================================= */

import {
    renderDetectionResult,
    renderMetadata,
    setStatus
} from "./metadata-status.js";


/* =========================================================
   IMAGE METADATA
========================================================= */

import {
    readImageMetadata
} from "./metadata-image.js";


/* =========================================================
   VIDEO METADATA
========================================================= */

import {
    readVideoMetadata
} from "./metadata-video.js";


/* =========================================================
   FILE
========================================================= */

import {
    isSupportedMedia,
    detectMediaType,
    updateFileInfo
} from "./metadata-file.js";


/* =========================================================
   PREVIEW
========================================================= */

import {
    renderOriginalPreview,
    setPreviewStatus
} from "./metadata-preview.js";


/* =========================================================
   DOWNLOAD
========================================================= */

import {
    downloadCleanedFile
} from "./metadata-download.js";


/* =========================================================
   RESET
========================================================= */

import {
    resetForNewFile,
    resetApplication
} from "./metadata-reset.js";


/* =========================================================
   CLEAN
========================================================= */

import {
    cleanMetadata
} from "./metadata-clean.js";


/* =========================================================
   INIT
========================================================= */

function init() {

    /*
       Cache seluruh DOM terlebih dahulu.
    */

    cacheElements();


    /*
       Bind seluruh event aplikasi.

       Event handler berasal dari coordinator
       atau module yang sudah dipisahkan.
    */

    bindMetadataEvents({

        handleFileInput,

        openFilePicker,

        checkMetadata,

        cleanMetadata,

        downloadCleanedFile,

        handleDragOver,

        handleDragLeave,

        handleDrop

    });


    /*
       Kembalikan aplikasi ke kondisi awal.
    */

    resetApplication();


    console.info(
        "[GEN-Z.AI] AI Metadata Cleaner initialized."
    );

}


/* =========================================================
   FILE PICKER
========================================================= */

function openFilePicker() {

    elements.fileInput?.click();

}


/* =========================================================
   FILE INPUT
========================================================= */

function handleFileInput(
    event
) {

    const files =
        Array.from(
            event.target?.files || []
        );


    if (
        !files.length
    ) {

        return;
    }


    processSelectedFile(
        files[0]
    );

}


/* =========================================================
   DRAG OVER
========================================================= */

function handleDragOver(
    event
) {

    event.preventDefault();


    elements.dropzone?.classList.add(
        "is-dragging"
    );

}


/* =========================================================
   DRAG LEAVE
========================================================= */

function handleDragLeave(
    event
) {

    event.preventDefault();


    elements.dropzone?.classList.remove(
        "is-dragging"
    );

}


/* =========================================================
   DROP
========================================================= */

function handleDrop(
    event
) {

    event.preventDefault();


    elements.dropzone?.classList.remove(
        "is-dragging"
    );


    const files =
        Array.from(
            event.dataTransfer?.files || []
        );


    if (
        !files.length
    ) {

        return;
    }


    processSelectedFile(
        files[0]
    );

}


/* =========================================================
   FILE PROCESSING
========================================================= */

function processSelectedFile(
    file
) {

    if (
        !file
    ) {

        return;
    }


    /*
       Pastikan file merupakan media
       yang didukung aplikasi.
    */

    if (
        !isSupportedMedia(
            file
        )
    ) {

        setStatus(
            "UNKNOWN",
            "FORMAT TIDAK DIDUKUNG",
            "Pilih file foto atau video yang dapat diproses oleh browser."
        );


        return;
    }


    /*
       Bersihkan file sebelumnya
       sebelum memasukkan file baru.

       resetForNewFile() juga mereset:
       - Sightengine detection
       - Sightengine loading
       - Sightengine error
       - Sightengine checked
       - metadata
       - local AI indicators
       - cleaning result
       - object URLs
    */

    resetForNewFile();


    /*
       Simpan file aktif.
    */

    state.file =
        file;


    /*
       Tentukan image / video.
    */

    state.fileType =
        detectMediaType(
            file
        );


    /*
       Buat object URL untuk preview
       file asli.

       File asli tidak disentuh.
    */

    state.originalURL =
        URL.createObjectURL(
            file
        );


    /*
       Update informasi file.
    */

    updateFileInfo();


    /*
       Render preview file asli.
    */

    renderOriginalPreview();


    /*
       CHECK aktif karena file sudah tersedia.
    */

    elements.checkButton.disabled =
        false;


    /*
       CLEAN belum boleh digunakan
       sebelum metadata diperiksa.
    */

    elements.cleanButton.disabled =
        true;


    /*
       DOWNLOAD belum tersedia.
    */

    elements.downloadButton.disabled =
        true;


    /*
       Status preview.
    */

    setPreviewStatus(
        "MEDIA SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
    );


    /*
       Status detection.
    */

    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );

}


/* =========================================================
   CHECK METADATA
   ---------------------------------------------------------
   Coordinator metadata.

   IMAGE:
   1. Read metadata lokal
   2. Normalize metadata
   3. Local metadata AI detection
   4. Sightengine visual AI detection
   5. Render metadata
   6. Render detection
   7. Enable cleaning

   VIDEO:
   1. Read metadata lokal
   2. Normalize metadata
   3. Local metadata AI detection
   4. Render metadata
   5. Render detection
   6. Enable cleaning

   Sightengine TIDAK digunakan untuk video.
========================================================= */

async function checkMetadata() {

    /*
       Tidak ada file.
    */

    if (
        !state.file
    ) {

        return;
    }


    /*
       Jangan membaca ulang metadata
       jika sudah berhasil diperiksa.
    */

    if (
        state.checked
    ) {

        return;
    }


    /*
       Simpan reference file.

       Ini penting agar hasil asynchronous
       dari Sightengine tidak masuk ke file
       baru apabila user mengganti file
       ketika request masih berjalan.
    */

    const sourceFile =
        state.file;


    /*
       Disable CHECK selama proses.
    */

    elements.checkButton.disabled =
        true;


    setStatus(
        "UNKNOWN",
        "MEMBACA METADATA...",
        "Metadata sedang diperiksa secara lokal di browser."
    );


    setPreviewStatus(
        "MEMBACA METADATA..."
    );


    try {

        let metadata;


        /* =================================================
           IMAGE
        ================================================= */

        if (
            state.fileType === "image"
        ) {

            metadata =
                await readImageMetadata(
                    sourceFile
                );

        }


        /* =================================================
           VIDEO
        ================================================= */

        else {

            metadata =
                await readVideoMetadata(
                    sourceFile
                );

        }


        /*
           Pastikan user belum memilih file lain
           selama metadata dibaca.
        */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        /* =================================================
           NORMALIZE
        ================================================= */

        state.metadata =
            normalizeMetadata(
                metadata
            );


        /*
           Sinkronkan count lokal apabila state
           memakai field count.
        */

        state.metadataCount =
            Array.isArray(
                state.metadata
            )
                ? state.metadata.length
                : 0;


        /* =================================================
           LOCAL AI DETECTION
        ================================================= */

        state.aiIndicators =
            detectAIIndicators(
                state.metadata
            );


        /* =================================================
           SIGHTENGINE
           -------------------------------------------------
           Hanya IMAGE.
        ================================================= */

        /*
           Reset hasil detection sebelumnya.

           Menggunakan setter agar struktur state
           tetap konsisten.
        */

        setSightengineDetection(
            null
        );


        setSightengineLoading(
            false
        );


        setSightengineError(
            null
        );


        /*
           Sightengine hanya dijalankan untuk image
           yang memenuhi batas dan validasi provider.
        */

        if (
            state.fileType === "image" &&
            canUseSightengine(
                sourceFile
            )
        ) {

            /*
               Sightengine merupakan layanan eksternal.

               Loading dicatat secara eksplisit agar
               state mengetahui bahwa request sedang
               berjalan.
            */

            setSightengineLoading(
                true
            );


            setSightengineError(
                null
            );


            try {

                setPreviewStatus(
                    "MEMERIKSA IMAGE DENGAN AI DETECTION..."
                );


                const sightengineResult =
                    await detectSightengine(
                        sourceFile
                    );


                /*
                   Jangan memasukkan hasil request
                   ke file baru.

                   Ini penting karena request API
                   berjalan asynchronous.
                */

                if (
                    state.file === sourceFile
                ) {

                    setSightengineDetection(
                        sightengineResult
                    );

                }

            } catch (
                sightengineError
            ) {

                /*
                   Sightengine gagal bukan berarti
                   metadata lokal gagal.

                   Detection dikembalikan ke empty
                   canonical object, bukan null.

                   Error disimpan terpisah sehingga
                   UI / coordinator dapat membedakan:
                   - belum diperiksa
                   - sedang diperiksa
                   - berhasil
                   - provider gagal
                */

                if (
                    state.file === sourceFile
                ) {

                    setSightengineDetection(
                        null
                    );


                    setSightengineError(
                        sightengineError
                    );

                }


                console.error(
                    "[GEN-Z.AI] Sightengine detection failed:",
                    sightengineError
                );

            } finally {

                /*
                   Loading hanya dihentikan apabila
                   request masih terkait dengan file
                   aktif.

                   File baru akan sudah memiliki
                   state loading sendiri melalui
                   resetForNewFile().
                */

                if (
                    state.file === sourceFile
                ) {

                    setSightengineLoading(
                        false
                    );

                }

            }

        } else {

            /*
               Bukan image atau tidak memenuhi
               syarat Sightengine.

               Tidak dianggap sebagai error.
            */

            setSightengineLoading(
                false
            );

        }


        /*
           Pastikan file masih sama sebelum
           menyimpan hasil final.
        */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        /*
           Metadata berhasil diperiksa.

           Sightengine boleh gagal tanpa
           menggagalkan metadata lokal.
        */

        state.checked =
            true;


        /* =================================================
           RENDER METADATA
        ================================================= */

        renderMetadata();


        /* =================================================
           RENDER AI DETECTION
        ================================================= */

        renderDetectionResult();


        /*
           Cleaning baru tersedia
           setelah pemeriksaan metadata.
        */

        elements.cleanButton.disabled =
            false;


        /*
           Tentukan apakah hasil Sightengine
           memiliki indikasi visual AI.

           GenAI:
               is_ai_generated

           Face manipulation:
               is_face_manipulated

           Deepfake:
               is_deepfake
        */

        const sightengineDetection =
            state.sightengineDetection;


        const hasSightengineAI =
            Boolean(
                sightengineDetection &&
                (
                    sightengineDetection.is_ai_generated === true ||
                    sightengineDetection.is_face_manipulated === true ||
                    sightengineDetection.is_deepfake === true
                )
            );


        /*
           Preview status.

           Prioritas:
           1. Local metadata AI indicator
           2. Sightengine visual AI
           3. Sightengine error
           4. Normal completion
        */

        if (
            Array.isArray(
                state.aiIndicators
            ) &&
            state.aiIndicators.length
        ) {

            setPreviewStatus(
                "INDIKATOR AI DITEMUKAN PADA METADATA."
            );

        } else if (
            hasSightengineAI
        ) {

            setPreviewStatus(
                "AI VISUAL DETECTION MENUNJUKKAN INDIKASI MANIPULASI / IMAGE AI."
            );

        } else if (
            state.sightengineError
        ) {

            setPreviewStatus(
                "METADATA SELESAI. AI VISUAL DETECTION TIDAK TERSEDIA."
            );

        } else {

            setPreviewStatus(
                "PEMERIKSAAN METADATA DAN AI DETECTION SELESAI."
            );

        }

    } catch (
        error
    ) {

        /*
           Jangan mengubah hasil file baru
           apabila proses sebelumnya selesai
           setelah user mengganti file.
        */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        console.error(
            "[GEN-Z.AI] Metadata check failed:",
            error
        );


        /*
           Jika pembacaan metadata gagal,
           jangan menyimpan metadata parsial.
        */

        state.metadata =
            [];


        state.metadataCount =
            0;


        state.aiIndicators =
            [];


        /*
           Metadata gagal berarti Sightengine
           juga tidak boleh meninggalkan hasil
           dari proses sebelumnya.
        */

        setSightengineLoading(
            false
        );


        setSightengineDetection(
            null
        );


        setSightengineError(
            null
        );


        /*
           Render kondisi metadata kosong.
        */

        renderMetadata();


        /*
           Pertahankan perilaku aplikasi asli.
           Jangan mengubah state.checked di sini.
        */

        setStatus(
            "UNKNOWN",
            "METADATA TIDAK DAPAT DIBACA SEPENUHNYA",
            getReadableError(
                error
            )
        );


        setPreviewStatus(
            "PEMERIKSAAN SELESAI DENGAN KETERBATASAN."
        );

    } finally {

        /*
           CHECK kembali aktif.

           Jika metadata berhasil, state.checked
           mencegah pemeriksaan ulang.

           Jika gagal, CHECK tetap dapat dicoba
           kembali seperti perilaku sebelumnya.
        */

        if (
            state.file === sourceFile
        ) {

            elements.checkButton.disabled =
                false;

        }

    }

}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function getReadableError(
    error
) {

    if (
        !error
    ) {

        return "Terjadi kesalahan yang tidak diketahui.";
    }


    if (
        error instanceof Error
    ) {

        return error.message;
    }


    return String(
        error
    );

}


/* =========================================================
   PUBLIC API
   ---------------------------------------------------------
   API lama tetap dipertahankan agar kode lain
   yang menggunakan GENZMetadataCleaner tidak rusak.
========================================================= */

window.GENZMetadataCleaner =
    Object.freeze({

        getState() {

            return state;

        },


        reset() {

            resetApplication();

        }

    });


/* =========================================================
   START APPLICATION
========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        {
            once: true
        }
    );

} else {

    init();

}
