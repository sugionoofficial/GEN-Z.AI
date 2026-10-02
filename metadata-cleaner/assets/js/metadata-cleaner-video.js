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

   PERBAIKAN:
   - Output filename selalu mempertahankan ekstensi video.
   - FFmpeg membutuhkan ekstensi output untuk menentukan muxer.
   - Contoh:
       input  = input.mp4
       output = cleaned_input.mp4

   - Output diverifikasi langsung dari FFmpeg VFS.
   - FFmpeg log tetap ditangkap untuk diagnosis.
   - Cleanup tidak boleh menyebabkan cleaning gagal.
========================================================= */


import {
    ensureFFmpeg,
    createFFmpegFilename,
    getCleanVideoMimeType,
    isMovLikeVideo,
    safeDeleteFFmpegFile
} from "./metadata-ffmpeg.js";


/* =========================================================
   INTERNAL HELPER
========================================================= */


/* =========================================================
   GET ERROR MESSAGE
========================================================= */

function getErrorMessage(
    error
) {

    if (
        !error
    ) {

        return "";
    }


    if (
        typeof error === "string"
    ) {

        return error;
    }


    if (
        error?.message
    ) {

        return String(
            error.message
        );
    }


    try {

        return JSON.stringify(
            error
        );

    } catch (
        stringifyError
    ) {

        return String(
            error
        );
    }
}


/* =========================================================
   GET FFMPEG LOG MESSAGE
========================================================= */

function getFFmpegLogMessage(
    event
) {

    if (
        !event
    ) {

        return "";
    }


    if (
        typeof event === "string"
    ) {

        return event;
    }


    if (
        typeof event.message === "string"
    ) {

        return event.message;
    }


    if (
        typeof event.data === "string"
    ) {

        return event.data;
    }


    if (
        typeof event.text === "string"
    ) {

        return event.text;
    }


    return "";
}


/* =========================================================
   CREATE OUTPUT FILENAME
   ---------------------------------------------------------
   IMPORTANT:
   FFmpeg menentukan output format dari extension.

   Jangan menghasilkan:
       cleaned_input

   Harus menghasilkan:
       cleaned_input.mp4
       cleaned_input.mov
       cleaned_input.webm
       dst.
========================================================= */

function createCleanOutputFilename(
    inputName
) {

    const safeInputName =
        String(
            inputName ||
            ""
        );


    const lastDot =
        safeInputName.lastIndexOf(
            "."
        );


    /*
     * Tidak ada extension.
     *
     * Jangan membuat output tanpa extension karena FFmpeg
     * tidak dapat menentukan output muxer secara otomatis.
     */
    if (
        lastDot <= 0 ||
        lastDot === safeInputName.length - 1
    ) {

        return (
            `cleaned_${safeInputName}.mp4`
        );
    }


    const baseName =
        safeInputName.slice(
            0,
            lastDot
        );


    const extension =
        safeInputName.slice(
            lastDot
        );


    return (
        `cleaned_${baseName}${extension}`
    );
}


/* =========================================================
   CLEAN VIDEO
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
       CREATE INPUT FILENAME
    ===================================================== */

    const inputName =
        createFFmpegFilename(
            file.name
        );


    /* =====================================================
       CREATE OUTPUT FILENAME
       -----------------------------------------------------
       IMPORTANT:
       Output HARUS mempunyai extension.
    ===================================================== */

    const outputName =
        createCleanOutputFilename(
            inputName
        );


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


    /* =====================================================
       FFMPEG LOG BUFFER
    ===================================================== */

    const ffmpegLogs = [];


    let logHandler =
        null;


    try {

        /* ===================================================
           ATTACH FFMPEG LOGGER
        =================================================== */

        if (
            typeof ffmpeg.on === "function"
        ) {

            logHandler =
                (
                    event
                ) => {

                    const message =
                        getFFmpegLogMessage(
                            event
                        );


                    if (
                        !message
                    ) {

                        return;
                    }


                    ffmpegLogs.push(
                        message
                    );


                    console.log(
                        "[GEN-Z.AI][CLEAN][FFmpeg]",
                        message
                    );
                };


            ffmpeg.on(
                "log",
                logHandler
            );
        }


        /* ===================================================
           WRITE INPUT
        =================================================== */

        await ffmpeg.writeFile(
            inputName,
            inputData
        );


        console.log(
            "[GEN-Z.AI][CLEAN] Input video:",
            inputName
        );


        console.log(
            "[GEN-Z.AI][CLEAN] Output video:",
            outputName
        );


        /* ===================================================
           FFMPEG ARGUMENTS
        =================================================== */

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
               REMOVE PER-PROGRAM METADATA
            ------------------------------------------------- */

            "-map_metadata:p",
            "-1",


            /* -------------------------------------------------
               REMOVE CHAPTERS
            ------------------------------------------------- */

            "-map_chapters",
            "-1",


            /* -------------------------------------------------
               STREAM COPY
               Tidak melakukan re-encode.
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
           LOG FINAL COMMAND
        ===================================================== */

        console.log(
            "[GEN-Z.AI][CLEAN] FFmpeg command:",
            ffmpegArguments
        );


        /* =====================================================
           EXECUTE
        ===================================================== */

        let execResult =
            null;


        let execError =
            null;


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


            console.error(
                "[GEN-Z.AI][CLEAN][FFmpeg] Exec error:",
                error
            );
        }


        /* =====================================================
           READ OUTPUT
        ===================================================== */

        let outputData =
            null;


        let outputReadError =
            null;


        try {

            outputData =
                await ffmpeg.readFile(
                    outputName
                );

        } catch (
            error
        ) {

            outputReadError =
                error;


            console.error(
                "[GEN-Z.AI][CLEAN][FFmpeg] Output read error:",
                error
            );
        }


        /* =====================================================
           VALIDATE OUTPUT
        ===================================================== */

        if (
            outputData &&
            outputData.length > 0
        ) {

            console.log(
                "[GEN-Z.AI][CLEAN] Output video berhasil dibuat:",
                {
                    name:
                        outputName,

                    size:
                        outputData.length,

                    returnCode:
                        execResult
                }
            );


            /* =================================================
               OUTPUT MIME
            ================================================= */

            const outputType =
                getCleanVideoMimeType(
                    file
                );


            /* =================================================
               RETURN CLEANED VIDEO
            ================================================= */

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
        }


        /* =====================================================
           OUTPUT GAGAL
        ===================================================== */

        let errorMessage =
            "FFmpeg tidak menghasilkan file video.";


        if (
            execError
        ) {

            const message =
                getErrorMessage(
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
            outputReadError
        ) {

            const message =
                getErrorMessage(
                    outputReadError
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


        /* =====================================================
           FFMPEG LOG
        ===================================================== */

        if (
            ffmpegLogs.length > 0
        ) {

            const recentLogs =
                ffmpegLogs
                    .slice(-20)
                    .join(
                        "\n"
                    );


            console.error(
                "[GEN-Z.AI][CLEAN][FFmpeg] Last logs:\n" +
                recentLogs
            );


            errorMessage +=
                `\nFFmpeg log terakhir:\n${recentLogs}`;
        }


        throw new Error(
            errorMessage
        );

    } finally {

        /* =====================================================
           REMOVE LOGGER
        ===================================================== */

        if (
            logHandler &&
            typeof ffmpeg.off === "function"
        ) {

            try {

                ffmpeg.off(
                    "log",
                    logHandler
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][CLEAN] FFmpeg logger cleanup dilewati:",
                    error
                );
            }
        }


        /* =====================================================
           DELETE INPUT
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
                getErrorMessage(
                    error
                )
            );
        }


        /* =====================================================
           DELETE OUTPUT
        ===================================================== */

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
                getErrorMessage(
                    error
                )
            );
        }
    }
}
