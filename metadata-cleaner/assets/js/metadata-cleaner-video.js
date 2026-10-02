/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-cleaner-video.js

   Fungsi:
   - Clean video metadata locally
   - Remux video through FFmpeg WASM
   - Preserve media streams
   - Remove global/container metadata
   - Remove per-stream metadata
   - Remove per-chapter metadata
   - Remove per-program metadata
   - Remove chapters
   - Avoid video/audio re-encoding
   - Original video remains untouched

   CATATAN:
   FFmpeg mempunyai beberapa konteks metadata:
   - global/container
   - stream
   - chapter
   - program

   -map_metadata -1 saja tidak cukup untuk seluruh konteks.

   PERBAIKAN:
   - Jangan langsung menganggap exec() gagal hanya karena
     return code bukan 0.
   - Verifikasi output file secara langsung.
   - Jika output valid, hasil cleaning tetap dianggap berhasil.
   - Cleanup file virtual dibuat aman terhadap file yang sudah
     tidak ada.
========================================================= */


import {
    ensureFFmpeg,
    createFFmpegFilename,
    getCleanVideoMimeType,
    isMovLikeVideo,
    safeDeleteFFmpegFile
} from "./metadata-ffmpeg.js";


/* =========================================================
   CLEAN VIDEO
   ---------------------------------------------------------
   Strategy:
   - preserve every media stream
   - remove global metadata
   - remove per-stream metadata
   - remove per-chapter metadata
   - remove per-program metadata
   - remove chapters
   - copy streams without video/audio re-encoding
   - use faststart only for MP4/MOV containers
========================================================= */

export async function cleanVideo(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File video tidak tersedia."
        );
    }


    /* =====================================================
       ENSURE FFMPEG
    ===================================================== */

    const ffmpeg =
        await ensureFFmpeg();


    /* =====================================================
       CREATE TEMPORARY FILENAMES
    ===================================================== */

    const inputName =
        createFFmpegFilename(
            file.name
        );


    const outputName =
        `cleaned_${inputName}`;


    /* =====================================================
       READ SOURCE FILE
    ===================================================== */

    const inputData =
        new Uint8Array(
            await file.arrayBuffer()
        );


    if (
        !inputData ||
        inputData.length === 0
    ) {

        throw new Error(
            "Data video kosong atau tidak dapat dibaca."
        );
    }


    try {

        /* =================================================
           WRITE INPUT TO FFMPEG VIRTUAL FILESYSTEM
        ================================================= */

        await ffmpeg.writeFile(
            inputName,
            inputData
        );


        /* =================================================
           FFMPEG ARGUMENTS
           =================================================

           -i inputName
               Membaca file sumber.

           -map 0
               Mempertahankan seluruh media stream.

           -map_metadata -1
               Mematikan automatic global/container metadata
               mapping.

           -map_metadata:s -1
               Mematikan automatic per-stream metadata
               mapping.

           -map_metadata:c -1
               Mematikan automatic per-chapter metadata
               mapping.

           -map_metadata:p -1
               Mematikan automatic per-program metadata
               mapping.

           -map_chapters -1
               Tidak menyalin chapter.

           -c copy
               Tidak melakukan re-encode video/audio.

           ================================================= */

        const ffmpegArguments = [

            /* -------------------------------------------------
               INPUT
            ------------------------------------------------- */

            "-i",
            inputName,


            /* -------------------------------------------------
               PRESERVE ALL MEDIA STREAMS
            ------------------------------------------------- */

            "-map",
            "0",


            /* -------------------------------------------------
               REMOVE GLOBAL / CONTAINER METADATA
            ------------------------------------------------- */

            "-map_metadata",
            "-1",


            /* -------------------------------------------------
               REMOVE PER-STREAM METADATA
            ------------------------------------------------- */

            "-map_metadata:s",
            "-1",


            /* -------------------------------------------------
               REMOVE PER-CHAPTER METADATA
            ------------------------------------------------- */

            "-map_metadata:c",
            "-1",


            /* -------------------------------------------------
               REMOVE PER-PROGRAM METADATA
            ------------------------------------------------- */

            "-map_metadata:p",
            "-1",


            /* -------------------------------------------------
               DO NOT COPY CHAPTERS
            ------------------------------------------------- */

            "-map_chapters",
            "-1",


            /* -------------------------------------------------
               STREAM COPY
            -------------------------------------------------

               Tidak melakukan re-encode video/audio.
            */

            "-c",
            "copy"

        ];


        /* =====================================================
           MP4 / MOV FASTSTART
           ===================================================== */

        if (
            isMovLikeVideo(
                file
            )
        ) {

            ffmpegArguments.push(

                "-movflags",
                "+faststart"

            );
        }


        /* =====================================================
           OUTPUT
        ===================================================== */

        ffmpegArguments.push(
            outputName
        );


        /* =====================================================
           EXECUTE FFMPEG
           ===================================================== */

        let execResult = null;
        let execError = null;


        try {

            execResult =
                await ffmpeg.exec(
                    ffmpegArguments
                );

        } catch (
            error
        ) {

            execError =
                error;

        }


        /* =====================================================
           CHECK OUTPUT FILE
           -----------------------------------------------------
           Jangan hanya mengandalkan return code exec().

           Pada FFmpeg WASM tertentu, command dapat menghasilkan
           output yang valid walaupun return code yang diterima
           oleh wrapper bukan 0.

           Karena itu output filesystem menjadi pemeriksaan
           keberhasilan utama.
        ===================================================== */

        let outputData = null;


        try {

            outputData =
                await ffmpeg.readFile(
                    outputName
                );

        } catch (
            readError
        ) {

            outputData =
                null;


            if (
                !execError
            ) {

                execError =
                    readError;
            }
        }


        /* =====================================================
           NORMALIZE OUTPUT DATA
        ===================================================== */

        if (
            outputData &&
            outputData.length > 0
        ) {

            /*
             * Output video benar-benar tersedia.
             *
             * Jika execResult bukan 0 tetapi file output valid,
             * jangan menggagalkan cleaning.
             */

        } else {

            /* =================================================
               OUTPUT TIDAK ADA
            ================================================= */

            let errorMessage =
                "FFmpeg tidak menghasilkan file video.";


            if (
                execError
            ) {

                const message =
                    execError?.message ||
                    String(
                        execError
                    );


                if (
                    message
                ) {

                    errorMessage +=
                        ` ${message}`;
                }
            }


            if (
                execResult !== null &&
                execResult !== undefined
            ) {

                errorMessage +=
                    ` Return code: ${execResult}.`;
            }


            throw new Error(
                errorMessage
            );
        }


        /* =====================================================
           OUTPUT MIME TYPE
        ===================================================== */

        const outputType =
            getCleanVideoMimeType(
                file
            );


        /* =====================================================
           RETURN NEW BLOB
        ===================================================== */

        return {

            blob:
                new Blob(
                    [
                        outputData
                    ],
                    {
                        type:
                            outputType
                    }
                ),

            type:
                outputType

        };

    } finally {

        /* =====================================================
           CLEAN FFMPEG VIRTUAL FILES
           -----------------------------------------------------
           Cleanup tidak boleh mengubah hasil cleaning menjadi
           gagal.

           Jika file sudah otomatis dihapus oleh FFmpeg atau
           filesystem virtual, safeDeleteFFmpegFile menangani
           kondisi tersebut.
        ===================================================== */

        try {

            await safeDeleteFFmpegFile(
                ffmpeg,
                inputName
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] Input cleanup dilewati:",
                error
            );
        }


        try {

            await safeDeleteFFmpegFile(
                ffmpeg,
                outputName
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] Output cleanup dilewati:",
                error
            );
        }
    }
}
