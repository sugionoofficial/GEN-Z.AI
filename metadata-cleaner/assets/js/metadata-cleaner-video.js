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


    const ffmpeg =
        await ensureFFmpeg();


    const inputName =
        createFFmpegFilename(
            file.name
        );


    const outputName =
        `cleaned_${inputName}`;


    const inputData =
        new Uint8Array(
            await file.arrayBuffer()
        );


    try {

        await ffmpeg.writeFile(
            inputName,
            inputData
        );


        /* =====================================================
           FFMPEG ARGUMENTS
           =====================================================

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

           ===================================================== */

        const ffmpegArguments = [

            "-i",
            inputName,


            /* -------------------------------------------------
               PRESERVE ALL MEDIA STREAMS
            ------------------------------------------------- */

            "-map",
            "0",


            /* -------------------------------------------------
               REMOVE GLOBAL / CONTAINER METADATA

               Global metadata:
               title
               artist
               comment
               description
               creation_time
               encoder
               software
               copyright
               location
               dll.
            ------------------------------------------------- */

            "-map_metadata",
            "-1",


            /* -------------------------------------------------
               REMOVE PER-STREAM METADATA

               Contoh:
               stream title
               handler_name
               language metadata
               encoder tags
               stream-specific tags
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

               Video/audio tidak di-decode dan tidak di-encode
               ulang.
            ------------------------------------------------- */

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

        const result =
            await ffmpeg.exec(
                ffmpegArguments
            );


        if (
            result !== 0
        ) {

            throw new Error(
                "FFmpeg gagal melakukan remux video."
            );
        }


        /* =====================================================
           READ CLEANED FILE
           ===================================================== */

        const outputData =
            await ffmpeg.readFile(
                outputName
            );


        if (
            !outputData ||
            !outputData.length
        ) {

            throw new Error(
                "FFmpeg tidak menghasilkan file video."
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
        ===================================================== */

        await safeDeleteFFmpegFile(
            ffmpeg,
            inputName
        );


        await safeDeleteFFmpegFile(
            ffmpeg,
            outputName
        );
    }
}
