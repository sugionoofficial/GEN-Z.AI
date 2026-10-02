/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-video.js

   Fungsi:
   - Read video metadata
   - Browser video metadata
   - FFprobe metadata
   - MP4/MOV fallback scan
   - FFmpeg timeout protection
   - FFprobe output validation
   - Tolerant FFprobe return-code handling
========================================================= */

import {
    appendObjectMetadata
} from "./metadata-normalizer.js";

import {
    ensureFFmpeg,
    createFFmpegFilename,
    safeDeleteFFmpegFile
} from "./metadata-ffmpeg.js";


/* =========================================================
   CONFIGURATION
========================================================= */

const VIDEO_METADATA_TIMEOUT = 12000;

const FFMPEG_METADATA_TIMEOUT = 15000;


/* =========================================================
   VIDEO METADATA
========================================================= */

export async function readVideoMetadata(
    file
) {

    const result = [];


    /* =====================================================
       BASIC FILE INFORMATION
    ===================================================== */

    if (
        !file ||
        !(file instanceof Blob)
    ) {

        throw new Error(
            "File video tidak valid."
        );
    }


    result.push({

        field:
            "File Name",

        value:
            file.name,

        source:
            "File"

    });


    result.push({

        field:
            "File Type",

        value:
            file.type ||
            "Unknown",

        source:
            "File"

    });


    result.push({

        field:
            "File Size",

        value:
            formatBytes(
                file.size
            ),

        source:
            "File"

    });


    result.push({

        field:
            "Last Modified",

        value:
            Number.isFinite(
                file.lastModified
            )
                ? new Date(
                    file.lastModified
                ).toISOString()
                : "Unknown",

        source:
            "File"

    });


    /* =====================================================
       BROWSER MEDIA INFORMATION
    ===================================================== */

    let mediaInfo =
        null;


    try {

        mediaInfo =
            await withTimeout(
                getVideoElementMetadata(
                    file
                ),
                VIDEO_METADATA_TIMEOUT,
                "Browser video metadata timeout"
            );

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Browser video metadata unavailable:",
            error
        );

    }


    if (
        mediaInfo
    ) {

        appendObjectMetadata(
            result,
            mediaInfo,
            "Media"
        );
    }


    /* =====================================================
       CONTAINER
    ===================================================== */

    const extension =
        getExtension(
            file.name
        );


    result.push({

        field:
            "Container Extension",

        value:
            extension
                ? extension.toUpperCase()
                : "UNKNOWN",

        source:
            "Container"

    });


    /* =====================================================
       FFPROBE
    ===================================================== */

    let ffprobeSucceeded =
        false;


    try {

        const ffprobeMetadata =
            await readVideoMetadataWithFFprobe(
                file
            );


        if (
            ffprobeMetadata &&
            typeof ffprobeMetadata === "object"
        ) {

            appendFFprobeMetadata(
                result,
                ffprobeMetadata
            );


            ffprobeSucceeded =
                true;
        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] FFprobe metadata unavailable:",
            error
        );

    }


    /* =====================================================
       FFPROBE STATUS
    ===================================================== */

    if (
        !ffprobeSucceeded
    ) {

        result.push({

            field:
                "FFprobe",

            value:
                "Metadata FFprobe tidak tersedia pada sesi ini.",

            source:
                "FFprobe"

        });
    }


    /* =====================================================
       FALLBACK MP4 CONTAINER SCAN
    ===================================================== */

    if (
        !ffprobeSucceeded &&
        isLikelyMp4(
            file
        )
    ) {

        try {

            const mp4Metadata =
                await readMp4ContainerMetadata(
                    file
                );


            if (
                mp4Metadata &&
                typeof mp4Metadata === "object"
            ) {

                appendObjectMetadata(
                    result,
                    mp4Metadata,
                    "MP4 Container"
                );
            }

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] MP4 container scan failed:",
                error
            );

        }
    }


    return result;
}


/* =========================================================
   FFPROBE VIDEO METADATA
========================================================= */

export async function readVideoMetadataWithFFprobe(
    file
) {

    let ffmpeg =
        null;

    let inputName =
        "";

    let probeName =
        "";


    try {

        /* =================================================
           ENSURE FFMPEG WITH TIMEOUT
        ================================================= */

        ffmpeg =
            await withTimeout(
                ensureFFmpeg(),
                FFMPEG_METADATA_TIMEOUT,
                "FFmpeg initialization timeout"
            );


        if (
            !ffmpeg
        ) {

            throw new Error(
                "FFmpeg instance tidak tersedia."
            );
        }


        /* =================================================
           CHECK REQUIRED API
        ================================================= */

        if (
            typeof ffmpeg.writeFile !==
            "function"
        ) {

            throw new Error(
                "FFmpeg writeFile() tidak tersedia."
            );
        }


        if (
            typeof ffmpeg.readFile !==
            "function"
        ) {

            throw new Error(
                "FFmpeg readFile() tidak tersedia."
            );
        }


        if (
            typeof ffmpeg.ffprobe !==
            "function"
        ) {

            throw new Error(
                "FFprobe API tidak tersedia pada instance FFmpeg."
            );
        }


        /* =================================================
           FILE NAMES
        ================================================= */

        inputName =
            createFFmpegFilename(
                file.name
            );


        probeName =
            `probe_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}.json`;


        /* =================================================
           READ INPUT
        ================================================= */

        const inputData =
            new Uint8Array(
                await file.arrayBuffer()
            );


        if (
            inputData.byteLength === 0
        ) {

            throw new Error(
                "Video kosong atau tidak memiliki data."
            );
        }


        /* =================================================
           WRITE INPUT TO FFMPEG FS
        ================================================= */

        await withTimeout(
            ffmpeg.writeFile(
                inputName,
                inputData
            ),
            FFMPEG_METADATA_TIMEOUT,
            "FFmpeg writeFile timeout"
        );


        /* =================================================
           FFPROBE
           
           Catatan:
           ffprobe() dapat mengembalikan status non-zero
           pada beberapa kombinasi FFmpeg WASM/core walaupun
           output JSON sudah berhasil dibuat.

           Karena itu status return TIDAK langsung dianggap
           gagal. Output JSON adalah sumber validasi utama.
        ===================================================== */

        let ffprobeResult =
            null;

        let ffprobeExecutionError =
            null;


        try {

            ffprobeResult =
                await withTimeout(
                    ffmpeg.ffprobe(
                        [

                            "-v",
                            "error",

                            "-print_format",
                            "json",

                            "-show_format",

                            "-show_streams",

                            "-show_chapters",

                            inputName,

                            "-o",
                            probeName

                        ]
                    ),
                    FFMPEG_METADATA_TIMEOUT,
                    "FFprobe execution timeout"
                );

        } catch (
            error
        ) {

            ffprobeExecutionError =
                error;

        }


        /* =================================================
           READ FFPROBE JSON
           
           Bahkan jika return code non-zero atau promise
           melempar error, coba baca output terlebih dahulu.
        ===================================================== */

        let probeData =
            null;

        let readProbeError =
            null;


        try {

            probeData =
                await withTimeout(
                    ffmpeg.readFile(
                        probeName,
                        "utf8"
                    ),
                    FFMPEG_METADATA_TIMEOUT,
                    "FFprobe readFile timeout"
                );

        } catch (
            error
        ) {

            readProbeError =
                error;

        }


        /* =================================================
           HANDLE MISSING OUTPUT
        ===================================================== */

        if (
            probeData === null ||
            probeData === undefined
        ) {

            if (
                ffprobeExecutionError
            ) {

                throw new Error(
                    `FFprobe gagal dan tidak menghasilkan output JSON: ${
                        getErrorMessage(
                            ffprobeExecutionError
                        )
                    }`
                );
            }


            if (
                readProbeError
            ) {

                throw new Error(
                    `FFprobe tidak menghasilkan file output: ${
                        getErrorMessage(
                            readProbeError
                        )
                    }`
                );
            }


            throw new Error(
                `FFprobe tidak menghasilkan output JSON. Return code: ${
                    String(
                        ffprobeResult
                    )
                }`
            );
        }


        /* =================================================
           CONVERT OUTPUT TO STRING
        ================================================= */

        let jsonText =
            "";


        if (
            typeof probeData === "string"
        ) {

            jsonText =
                probeData;

        } else if (
            probeData instanceof Uint8Array
        ) {

            jsonText =
                new TextDecoder(
                    "utf-8"
                ).decode(
                    probeData
                );

        } else if (
            probeData instanceof ArrayBuffer
        ) {

            jsonText =
                new TextDecoder(
                    "utf-8"
                ).decode(
                    new Uint8Array(
                        probeData
                    )
                );

        } else if (
            probeData &&
            probeData.buffer instanceof ArrayBuffer
        ) {

            jsonText =
                new TextDecoder(
                    "utf-8"
                ).decode(
                    new Uint8Array(
                        probeData.buffer,
                        probeData.byteOffset || 0,
                        probeData.byteLength
                    )
                );

        } else {

            jsonText =
                String(
                    probeData
                );
        }


        /* =================================================
           CLEAN JSON TEXT
        ================================================= */

        jsonText =
            String(
                jsonText || ""
            )
            .replace(
                /^\uFEFF/,
                ""
            )
            .trim();


        /* =================================================
           EMPTY OUTPUT
        ================================================= */

        if (
            !jsonText
        ) {

            if (
                ffprobeExecutionError
            ) {

                throw new Error(
                    `FFprobe menghasilkan output kosong: ${
                        getErrorMessage(
                            ffprobeExecutionError
                        )
                    }`
                );
            }


            throw new Error(
                `FFprobe tidak menghasilkan JSON metadata. Return code: ${
                    String(
                        ffprobeResult
                    )
                }`
            );
        }


        /* =================================================
           PARSE JSON
        ================================================= */

        let parsed;


        try {

            parsed =
                JSON.parse(
                    jsonText
                );

        } catch (
            error
        ) {

            /*
             * Kalau output bukan JSON valid, jangan diam-diam
             * menganggap FFprobe berhasil hanya karena file
             * output ada.
             */

            const preview =
                jsonText
                    .slice(
                        0,
                        300
                    )
                    .replace(
                        /\s+/g,
                        " "
                    );


            throw new Error(
                `JSON FFprobe tidak valid: ${
                    error?.message ||
                    "Unknown error"
                }. Output: ${preview}`
            );
        }


        /* =================================================
           VALIDATE PARSED RESULT
        ================================================= */

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {

            throw new Error(
                "Struktur JSON FFprobe tidak valid."
            );
        }


        const hasFormat =
            parsed.format &&
            typeof parsed.format === "object";


        const hasStreams =
            Array.isArray(
                parsed.streams
            );


        const hasChapters =
            Array.isArray(
                parsed.chapters
            );


        if (
            !hasFormat &&
            !hasStreams &&
            !hasChapters
        ) {

            throw new Error(
                `JSON FFprobe tidak memiliki format, streams, atau chapters. Return code: ${
                    String(
                        ffprobeResult
                    )
                }`
            );
        }


        /* =================================================
           DIAGNOSTIC LOG
        ================================================= */

        if (
            ffprobeExecutionError
        ) {

            console.warn(
                "[GEN-Z.AI][FFprobe] Execution reported an error, tetapi output JSON valid dan akan digunakan:",
                getErrorMessage(
                    ffprobeExecutionError
                )
            );

        } else if (
            ffprobeResult !== 0
        ) {

            console.warn(
                "[GEN-Z.AI][FFprobe] Return code non-zero, tetapi output JSON valid dan akan digunakan:",
                ffprobeResult
            );
        }


        /* =================================================
           SUCCESS
        ================================================= */

        return parsed;

    } finally {

        /* =================================================
           CLEAN FFMPEG INPUT
        ================================================= */

        if (
            ffmpeg &&
            inputName
        ) {

            try {

                await safeDeleteFFmpegFile(
                    ffmpeg,
                    inputName
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal menghapus file FFmpeg input:",
                    error
                );

            }
        }


        /* =================================================
           CLEAN FFPROBE OUTPUT
        ================================================= */

        if (
            ffmpeg &&
            probeName
        ) {

            try {

                await safeDeleteFFmpegFile(
                    ffmpeg,
                    probeName
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal menghapus file FFprobe:",
                    error
                );

            }
        }
    }
}


/* =========================================================
   FFPROBE METADATA APPEND
========================================================= */

export function appendFFprobeMetadata(
    target,
    data
) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        return;
    }


    /* =====================================================
       FORMAT
    ===================================================== */

    if (
        data.format &&
        typeof data.format === "object"
    ) {

        appendObjectMetadata(
            target,
            data.format,
            "FFprobe Format"
        );
    }


    /* =====================================================
       STREAMS
    ===================================================== */

    if (
        Array.isArray(
            data.streams
        )
    ) {

        data.streams.forEach(
            (
                stream,
                index
            ) => {

                const streamType =
                    stream?.codec_type ||
                    "unknown";


                const prefix =
                    `Stream ${index} (${streamType})`;


                appendObjectMetadata(
                    target,
                    stream,
                    prefix
                );

            }
        );
    }


    /* =====================================================
       CHAPTERS
    ===================================================== */

    if (
        Array.isArray(
            data.chapters
        )
    ) {

        data.chapters.forEach(
            (
                chapter,
                index
            ) => {

                appendObjectMetadata(
                    target,
                    chapter,
                    `Chapter ${index}`
                );

            }
        );
    }
}


/* =========================================================
   VIDEO ELEMENT METADATA
========================================================= */

export function getVideoElementMetadata(
    file
) {

    return new Promise(
        resolve => {

            if (
                !file ||
                !(file instanceof Blob)
            ) {

                resolve(
                    null
                );

                return;
            }


            const video =
                document.createElement(
                    "video"
                );


            const url =
                URL.createObjectURL(
                    file
                );


            let finished =
                false;


            let timeoutId =
                null;


            const cleanup = () => {

                if (
                    timeoutId
                ) {

                    clearTimeout(
                        timeoutId
                    );

                    timeoutId =
                        null;
                }


                try {

                    URL.revokeObjectURL(
                        url
                    );

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI] Failed to revoke video URL:",
                        error
                    );

                }


                try {

                    video.pause();

                } catch (
                    error
                ) {
                    /* Ignore */
                }


                video.removeAttribute(
                    "src"
                );


                try {

                    video.load();

                } catch (
                    error
                ) {
                    /* Ignore */
                }
            };


            const finish = value => {

                if (
                    finished
                ) {

                    return;
                }


                finished =
                    true;


                cleanup();


                resolve(
                    value
                );
            };


            video.preload =
                "metadata";


            video.muted =
                true;


            video.playsInline =
                true;


            video.addEventListener(
                "loadedmetadata",
                () => {

                    finish({

                        Duration:
                            Number.isFinite(
                                video.duration
                            )
                                ? `${video.duration.toFixed(3)} s`
                                : "Unknown",

                        Width:
                            video.videoWidth
                                ? `${video.videoWidth} px`
                                : "Unknown",

                        Height:
                            video.videoHeight
                                ? `${video.videoHeight} px`
                                : "Unknown",

                        ReadyState:
                            String(
                                video.readyState
                            )

                    });

                },
                {
                    once: true
                }
            );


            video.addEventListener(
                "error",
                () => {

                    finish(
                        null
                    );

                },
                {
                    once: true
                }
            );


            timeoutId =
                setTimeout(
                    () => {

                        finish(
                            null
                        );

                    },
                    VIDEO_METADATA_TIMEOUT
                );


            video.src =
                url;


            try {

                video.load();

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Video metadata load failed:",
                    error
                );

            }

        }
    );
}


/* =========================================================
   MP4 CONTAINER METADATA
========================================================= */

export async function readMp4ContainerMetadata(
    file
) {

    const result = {};


    if (
        !file ||
        !(file instanceof Blob)
    ) {

        return result;
    }


    const maxRead =
        Math.min(
            file.size,
            16 * 1024 * 1024
        );


    const buffer =
        await file
            .slice(
                0,
                maxRead
            )
            .arrayBuffer();


    const view =
        new DataView(
            buffer
        );


    const strings =
        extractAsciiStrings(
            view
        );


    /* =====================================================
       SOFTWARE
    ===================================================== */

    const software =
        findMetadataString(
            strings,
            [

                "software",
                "encoder",
                "handler",
                "writing application",
                "encoded"

            ]
        );


    if (
        software
    ) {

        result.Software =
            software;
    }


    /* =====================================================
       CREATION
    ===================================================== */

    const creation =
        findMetadataString(
            strings,
            [

                "creation",
                "created"

            ]
        );


    if (
        creation
    ) {

        result.CreationHint =
            creation;
    }


    /* =====================================================
       COPYRIGHT
    ===================================================== */

    const copyright =
        findMetadataString(
            strings,
            [

                "copyright"

            ]
        );


    if (
        copyright
    ) {

        result.Copyright =
            copyright;
    }


    /* =====================================================
       LOCATION
    ===================================================== */

    const location =
        findMetadataString(
            strings,
            [

                "location",
                "latitude",
                "longitude",
                "gps"

            ]
        );


    if (
        location
    ) {

        result.LocationHint =
            location;
    }


    /* =====================================================
       ENCODER
    ===================================================== */

    const encoder =
        findMetadataString(
            strings,
            [

                "lavf",
                "ffmpeg",
                "libav",
                "x264",
                "x265",
                "avc",
                "hevc",
                "vp8",
                "vp9",
                "av01"

            ]
        );


    if (
        encoder
    ) {

        result.EncoderHint =
            encoder;
    }


    return result;
}


/* =========================================================
   MP4 DETECTION
========================================================= */

export function isLikelyMp4(
    file
) {

    if (
        !file
    ) {

        return false;
    }


    const extension =
        getExtension(
            file.name
        );


    return (

        file.type === "video/mp4" ||

        file.type === "video/quicktime" ||

        [

            "mp4",
            "m4v",
            "mov"

        ].includes(
            extension
        )

    );
}


/* =========================================================
   ASCII EXTRACTION
========================================================= */

function extractAsciiStrings(
    dataView
) {

    const output = [];


    let current =
        "";


    for (
        let index = 0;
        index < dataView.byteLength;
        index++
    ) {

        const value =
            dataView.getUint8(
                index
            );


        const valid =
            (

                value >= 32 &&
                value <= 126

            );


        if (
            valid
        ) {

            current +=
                String.fromCharCode(
                    value
                );

        } else {

            if (
                current.length >= 4
            ) {

                output.push(
                    current
                );
            }


            current =
                "";
        }
    }


    if (
        current.length >= 4
    ) {

        output.push(
            current
        );
    }


    return output;
}


/* =========================================================
   STRING SEARCH
========================================================= */

function findMetadataString(
    strings,
    keywords
) {

    for (
        const string of strings
    ) {

        const lower =
            string.toLowerCase();


        for (
            const keyword of keywords
        ) {

            if (
                lower.includes(
                    keyword
                )
            ) {

                return string;
            }
        }
    }


    return "";
}


/* =========================================================
   FORMAT BYTES
========================================================= */

function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {

        return "0 B";
    }


    const units = [

        "B",
        "KB",
        "MB",
        "GB",
        "TB"

    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    const safeIndex =
        Math.min(
            index,
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            safeIndex
        );


    return `${value.toFixed(
        safeIndex === 0
            ? 0
            : 2
    )} ${units[safeIndex]}`;
}


/* =========================================================
   EXTENSION
========================================================= */

function getExtension(
    filename
) {

    const clean =
        String(
            filename || ""
        )
        .split("?")[0]
        .split("#")[0];


    const dot =
        clean.lastIndexOf(
            "."
        );


    if (
        dot < 0
    ) {

        return "";
    }


    return clean
        .slice(
            dot + 1
        )
        .toLowerCase();
}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function getErrorMessage(
    error
) {

    if (
        error instanceof Error
    ) {

        return (
            error.message ||
            error.name ||
            "Unknown error"
        );
    }


    if (
        typeof error === "string"
    ) {

        return error;
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
   GENERIC TIMEOUT
========================================================= */

function withTimeout(
    promise,
    milliseconds,
    label
) {

    const timeout =
        Math.max(
            1,
            Number(
                milliseconds
            ) || 1
        );


    return new Promise(
        (
            resolve,
            reject
        ) => {

            let settled =
                false;


            const timer =
                setTimeout(
                    () => {

                        if (
                            settled
                        ) {

                            return;
                        }


                        settled =
                            true;


                        reject(
                            new Error(
                                `${label} (${timeout} ms)`
                            )
                        );

                    },
                    timeout
                );


            Promise.resolve(
                promise
            )
            .then(
                value => {

                    if (
                        settled
                    ) {

                        return;
                    }


                    settled =
                        true;


                    clearTimeout(
                        timer
                    );


                    resolve(
                        value
                    );

                }
            )
            .catch(
                error => {

                    if (
                        settled
                    ) {

                        return;
                    }


                    settled =
                        true;


                    clearTimeout(
                        timer
                    );


                    reject(
                        error
                    );

                }
            );

        }
    );
}
