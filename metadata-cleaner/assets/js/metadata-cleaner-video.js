/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-cleaner-video.js

   Fungsi:
   - Clean video metadata locally
   - Remux video through FFmpeg WASM
   - Preserve media streams during the first pass
   - Remove global/container metadata
   - Remove per-stream metadata
   - Remove per-chapter metadata
   - Remove per-program metadata
   - Remove chapters
   - Verify cleaned metadata
   - Re-encode MP4/MOV only if AI metadata or provenance remains
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

import {
    normalizeMetadata
} from "./metadata-normalizer.js";

import {
    detectAIIndicators
} from "./metadata-detector.js?v=aigc-detection-20261026";

import {
    readVideoMetadata
} from "./metadata-video.js";

import {
    inspectProvenance
} from "./metadata-provenance.js";

import {
    stripIsoBmffMetadata
} from "./metadata-iso-bmff.js";


/* =========================================================
   INTERNAL HELPER
========================================================= */

function getResidualMetadata(
    metadata
) {

    return (metadata || []).filter(
        item => {

            const field =
                String(item?.field || "")
                    .trim()
                    .toLowerCase();

            return (
                /software.?agent/i.test(field) ||
                detectAIIndicators([item]).length > 0
            );
        }
    );
}

function canReencodeVideo(
    file
) {

    return (
        isMovLikeVideo(file) ||
        String(file?.type || "")
            .toLowerCase() === "video/mp4" ||
        /\.mp4$/i.test(
            String(file?.name || "")
        )
    );
}


/**
 * Menghapus kotak metadata C2PA / JUMBF / XMP langsung dari
 * container MP4/MOV.
 *
 * Kotak diubah menjadi `free` dengan ukuran identik, sehingga
 * offset `stco`/`co64` tidak bergeser dan video tidak perlu
 * di-encode ulang (jauh lebih cepat di HP).
 */
function stripContainerProvenance(
    data
) {

    try {

        return stripIsoBmffMetadata(
            data instanceof Uint8Array
                ? data
                : new Uint8Array(
                    data
                )
        );

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][CLEAN] Pemangkasan kotak metadata dilewati:",
            getErrorMessage(
                error
            )
        );


        return {
            bytes:
                data,
            removed: [],
            changed:
                false
        };

    }

}


/**
 * Ringkasan residu yang masih terdeteksi setelah semua upaya
 * pembersihan. Dipakai untuk peringatan jujur, bukan untuk
 * menggagalkan cleaning.
 */
function describeResidual(
    verification
) {

    const residualItems =
        verification?.residualMetadata || [];


    /*
       Penandaan AIGC yang masih terbaca setelah cleaning harus
       disebut apa adanya sebagai penandaan AI, bukan disamarkan
       menjadi "residu provenance" biasa.
    */
    const aigcFields =
        residualItems
            .filter(
                item =>
                    detectAIIndicators(
                        [item]
                    ).length > 0
            )
            .map(
                item =>
                    item?.field
            )
            .filter(
                Boolean
            );


    const fields =
        residualItems
            .map(
                item =>
                    item?.field
            )
            .filter(
                Boolean
            )
            .slice(
                0,
                4
            );


    const findings =
        (verification?.provenance?.findings || [])
            .slice(
                0,
                4
            );


    const agent =
        verification?.provenance?.softwareAgent;


    const joined =
        [
            ...(
                agent
                    ? [`softwareAgent: ${agent}`]
                    : []
            ),
            ...findings,
            ...fields
        ]
            .filter(
                Boolean
            )
            .slice(
                0,
                4
            )
            .join(
                ", "
            );


    const aigcNote =
        aigcFields.length > 0
            ? `penandaan AIGC masih terbaca (${aigcFields
                .slice(
                    0,
                    3
                )
                .join(
                    ", "
                )})`
            : "";


    const summary =
        joined ||
        "sinyal provenance masih terbaca pada berkas hasil";


    return aigcNote
        ? `${aigcNote}; ${summary}`
        : summary;

}


async function inspectCleanedVideo(
    blob,
    name
) {

    const file =
        new File(
            [blob],
            name,
            {
                type: blob.type
            }
        );

    const metadata =
        await readVideoMetadata(file);

    const provenance =
        await inspectProvenance(file);

    return {
        residualMetadata:
            getResidualMetadata(
                normalizeMetadata(metadata)
            ),

        provenance
    };
}


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

    let reencodedOutputName =
        "";


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


            const outputType =
                getCleanVideoMimeType(
                    file
                );

            let finalOutputData =
                outputData;


            let finalOutputName =
                outputName;


            let notice =
                "";


            /*
               LANGKAH 1 — pemangkasan kotak metadata.

               C2PA pada MP4/MOV umumnya berada di kotak `uuid`,
               `jumb`, atau `udta`. Kotak itu diubah menjadi `free`
               dengan ukuran identik, jadi offset video tidak
               bergeser dan tidak perlu encode ulang.
            */

            const containerStrip =
                stripContainerProvenance(
                    outputData
                );


            if (
                containerStrip.changed
            ) {

                finalOutputData =
                    containerStrip.bytes;


                notice =
                    `Kotak metadata provenance (${[...new Set(containerStrip.removed)].join(", ")}) dihapus dari container video tanpa mengubah kualitas.`;

            }


            let verification =
                await inspectCleanedVideo(
                    new Blob(
                        [finalOutputData],
                        { type: outputType }
                    ),
                    finalOutputName
                );


            const hasResidual =
                current =>
                    current.residualMetadata.length > 0 ||
                    current.provenance.detected ||
                    current.provenance.softwareAgent;


            /*
               LANGKAH 2 — encode ulang.

               Dipakai hanya bila residu masih ada (mis. tag
               tertanam di stream atau container yang tidak bisa
               dipangkas) DAN formatnya mendukung.
            */

            /*
               Encode ulang dilewati bila provenance hanya diperiksa
               sebagian pada berkas besar.

               Alasannya: pada pemindaian sebagian, satu kecocokan
               teks pendek belum cukup bukti, sementara encode ulang
               video besar di HP memakan waktu sangat lama.
            */

            const skipReencodeForPartialScan =
                verification.provenance.partial === true;


            if (
                skipReencodeForPartialScan &&
                hasResidual(
                    verification
                )
            ) {

                console.warn(
                    "[GEN-Z.AI][CLEAN] Encode ulang dilewati: provenance hanya diperiksa sebagian (berkas besar)."
                );

            }


            if (
                hasResidual(
                    verification
                ) &&
                !skipReencodeForPartialScan &&
                canReencodeVideo(
                    file
                )
            ) {

                const outputExtension =
                    outputName.slice(
                        outputName.lastIndexOf(".")
                    );

                reencodedOutputName =
                    `verified_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2, 8)}${outputExtension}`;

                const reencodeArguments = [
                    "-i",
                    outputName,
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a?",
                    "-map_metadata",
                    "-1",
                    "-map_metadata:s",
                    "-1",
                    "-map_chapters",
                    "-1",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "20",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "192k",
                    "-sn",
                    "-dn",
                    "-movflags",
                    "+faststart",
                    reencodedOutputName
                ];

                console.warn(
                    "[GEN-Z.AI][CLEAN] Residu provenance masih terdeteksi setelah pemangkasan kotak; encode ulang video."
                );


                try {

                    await ffmpeg.exec(
                        reencodeArguments
                    );


                    const reencoded =
                        await ffmpeg.readFile(
                            reencodedOutputName
                        );


                    if (
                        reencoded &&
                        reencoded.length > 0
                    ) {

                        finalOutputData =
                            reencoded;

                        finalOutputName =
                            reencodedOutputName;

                        verification =
                            await inspectCleanedVideo(
                                new Blob(
                                    [finalOutputData],
                                    {
                                        type:
                                            "video/mp4"
                                    }
                                ),
                                finalOutputName
                            );


                        notice =
                            "Residu C2PA/metadata AI ditemukan; video di-encode ulang untuk menghapusnya. Kualitas video bisa berubah dan subtitle/track tambahan tidak disertakan.";

                    }

                } catch (
                    reencodeError
                ) {

                    /*
                       Encode ulang gagal bukan alasan membuang
                       hasil. Video hasil remux tetap dikirim,
                       lengkap dengan peringatan jujur.
                    */

                    console.warn(
                        "[GEN-Z.AI][CLEAN] Encode ulang gagal; hasil remux tetap dipakai:",
                        getErrorMessage(
                            reencodeError
                        )
                    );
                }

            }


            /*
               LANGKAH 3 — bila residu masih ada, JANGAN gagal.

               Hasil cleaning sudah benar-benar dibersihkan
               sebisa mungkin. Membuang hasil hanya membuat
               pengguna kehilangan berkas yang sebenarnya sudah
               diproses. Statusnya dibuat jujur lewat `residual`.
            */

            let residual =
                "";


            if (
                hasResidual(
                    verification
                )
            ) {

                residual =
                    describeResidual(
                        verification
                    );


                console.warn(
                    "[GEN-Z.AI][CLEAN] Residu provenance tersisa setelah semua upaya:",
                    residual
                );

            }


            /* =================================================
               RETURN CLEANED VIDEO
            ================================================= */

            return {

                blob:
                    new Blob(
                        [
                            finalOutputData
                        ],
                        {
                            type:
                                outputType
                        }
                    ),

                type:
                    outputType,

                notice,

                residual

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

        if (
            reencodedOutputName
        ) {

            try {

                await safeDeleteFFmpegFile(
                    ffmpeg,
                    reencodedOutputName
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][CLEAN] Re-encoded output cleanup dilewati:",
                    getErrorMessage(error)
                );
            }
        }
    }
}
