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
   - Remove chapters
   - Avoid video/audio re-encoding
   - Original video remains untouched
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
   - preserve all media streams
   - remove global/container metadata
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


        /*
         * Base remux arguments.
         *
         * -map 0
         *     Preserve every input stream.
         *
         * -map_metadata -1
         *     Remove container/global metadata.
         *
         * -map_chapters -1
         *     Remove chapter metadata.
         *
         * -c copy
         *     Do not re-encode video/audio.
         */

        const ffmpegArguments = [

            "-i",
            inputName,

            "-map",
            "0",

            "-map_metadata",
            "-1",

            "-map_chapters",
            "-1",

            "-c",
            "copy"

        ];


        /*
         * +faststart hanya untuk container
         * ISO-BMFF seperti MP4/MOV.
         */

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


        ffmpegArguments.push(
            outputName
        );


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


        const outputType =
            getCleanVideoMimeType(
                file
            );


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
