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
   - Remove chapters
   - Preserve video/audio without re-encoding
   - Original video remains untouched

   STRATEGY:
   - Input dipertahankan apa adanya.
   - Semua media stream dipetakan dengan -map 0.
   - Metadata global tidak disalin.
   - Metadata stream dibersihkan setelah mapping.
   - Chapter tidak disalin.
   - Video/audio tetap stream-copy.
   - Output diverifikasi langsung dari FFmpeg VFS.
   - FFmpeg log ditangkap agar kegagalan remux dapat didiagnosis.
========================================================= */


import {
    ensureFFmpeg,
    createFFmpegFilename,
    getCleanVideoMimeType,
    isMovLikeVideo,
    safeDeleteFFmpegFile
} from "./metadata-ffmpeg.js";


/* =========================================================
   INTERNAL HELPERS
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
   NORMALIZE FFMPEG LOG ENTRY
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


    /* =====================================================
       FFMPEG LOG BUFFER
       -----------------------------------------------------
       Kita simpan log selama proses cleaning supaya apabila
       remux gagal, penyebab sebenarnya dapat diketahui.
    ===================================================== */

    const ffmpegLogs = [];


    let logHandler = null;


    try {

        /* ===================================================
           ATTACH FFMPEG LOGGER
           ---------------------------------------------------
           FFmpeg 0.12.x menyediakan event "log".
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
           WRITE INPUT TO FFMPEG VIRTUAL FILESYSTEM
        =================================================== */

        await ffmpeg.writeFile(
            inputName,
            inputData
        );


        console.log(
            "[GEN-Z.AI][CLEAN] Input video ditulis ke FFmpeg:",
            inputName
        );


        /* ===================================================
           FFMPEG ARGUMENTS
           ===================================================

           INPUT:
               -i inputName

           STREAM:
               -map 0

               Semua stream dari input dipertahankan.

           GLOBAL METADATA:
               -map_metadata -1

               Tidak menyalin metadata global/container.

           CHAPTER:
               -map_chapters -1

               Tidak menyalin chapter.

           STREAM METADATA:
               -map_metadata:s -1

               Tidak menyalin metadata stream dari input.

           PROGRAM METADATA:
               -map_metadata:p -1

               Tidak menyalin metadata program.

           CODEC:
               -c copy

               Tidak melakukan re-encoding.

           =================================================== */

        const ffmpegArguments = [

            /* -------------------------------------------------
               INPUT
            ------------------------------------------------- */

            "-i",
            inputName,


            /* -------------------------------------------------
               MAP ALL MEDIA STREAMS
            ------------------------------------------------- */

            "-map",
            "0",


            /* -------------------------------------------------
               REMOVE GLOBAL METADATA
            ------------------------------------------------- */

            "-map_metadata",
            "-1",


            /* -------------------------------------------------
               REMOVE STREAM METADATA
            ------------------------------------------------- */

            "-map_metadata:s",
            "-1",


            /* -------------------------------------------------
               REMOVE PROGRAM METADATA
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
            ------------------------------------------------- */

            "-c",
            "copy",


            /* -------------------------------------------------
               OUTPUT
            ------------------------------------------------- */

            outputName

        ];


        /* ===================================================
           LOG COMMAND
        =================================================== */

        console.log(
            "[GEN-Z.AI][CLEAN] FFmpeg command:",
            ffmpegArguments
        );


        /* ===================================================
           EXECUTE FFMPEG
        =================================================== */

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


        /* ===================================================
           CHECK OUTPUT FILE
           ---------------------------------------------------
           Jangan langsung menganggap gagal hanya berdasarkan
           return code. Periksa VFS secara langsung.
        =================================================== */

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


        /* ===================================================
           VALIDATE OUTPUT
        =================================================== */

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
               OUTPUT MIME TYPE
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
           REMUX FAILED
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
           INCLUDE LAST FFMPEG LOGS
           -----------------------------------------------------
           Hanya beberapa baris terakhir supaya error tidak
           menjadi ribuan karakter.
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
           ---------------------------------------------------
           Jangan meninggalkan listener setiap kali user
           melakukan cleaning. Kalau tidak, satu video saja
           bisa menghasilkan log berlipat-lipat.
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
           CLEAN INPUT FILE
           -----------------------------------------------------
           Cleanup tidak boleh mengubah hasil cleaning menjadi
           gagal.
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
           CLEAN OUTPUT FILE
           -----------------------------------------------------
           Output sudah dibaca menjadi Uint8Array sebelum
           cleanup, jadi aman untuk dihapus dari VFS.
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
