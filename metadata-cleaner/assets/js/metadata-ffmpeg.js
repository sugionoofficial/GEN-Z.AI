/* =========================================================
   GEN-Z.AI
   FFmpeg WASM ENGINE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   Fungsi:
   - Load @ffmpeg/ffmpeg
   - Load @ffmpeg/core
   - Menyediakan FFmpeg instance global melalui state
   - Mendukung FFprobe / FFmpeg processing
   - Tidak bergantung pada APP.FFMPEG_BASE_URL
   - Tidak bergantung pada window.FFmpeg
   - Tidak memakai script UMD
========================================================= */

import { state } from "./metadata-state.js";


/* =========================================================
   CONFIG
========================================================= */

const FFMPEG_VERSION =
    "0.12.15";

const FFMPEG_CORE_VERSION =
    "0.12.10";

const FFMPEG_MODULE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`;

const FFMPEG_CORE_BASE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;


/* =========================================================
   INTERNAL STATE
========================================================= */

let ffmpegLoadPromise = null;

let ffmpegModulePromise = null;


/* =========================================================
   GET FFMPEG MODULE
========================================================= */

async function loadFFmpegModule() {

    if (
        ffmpegModulePromise
    ) {

        return ffmpegModulePromise;

    }


    ffmpegModulePromise =
        import(
            FFMPEG_MODULE_URL
        );


    try {

        return await ffmpegModulePromise;

    } catch (error) {

        ffmpegModulePromise =
            null;

        throw new Error(
            `FFmpeg module gagal dimuat dari CDN: ${getErrorMessage(error)}`
        );

    }

}


/* =========================================================
   ENSURE FFMPEG
========================================================= */

export async function ensureFFmpeg() {

    if (
        state.ffmpeg &&
        state.ffmpegLoaded
    ) {

        return state.ffmpeg;

    }


    if (
        ffmpegLoadPromise
    ) {

        return ffmpegLoadPromise;

    }


    ffmpegLoadPromise =
        initializeFFmpeg();


    try {

        return await ffmpegLoadPromise;

    } catch (error) {

        ffmpegLoadPromise =
            null;

        state.ffmpeg =
            null;

        state.ffmpegLoaded =
            false;

        throw error;

    }

}


/* =========================================================
   INITIALIZE FFMPEG
========================================================= */

async function initializeFFmpeg() {

    state.ffmpegLoading =
        true;

    state.ffmpegLoaded =
        false;

    state.ffmpeg =
        null;


    try {

        console.info(
            "[GEN-Z.AI][FFmpeg] Loading FFmpeg module..."
        );

        console.info(
            "[GEN-Z.AI][FFmpeg] Module:",
            FFMPEG_MODULE_URL
        );


        /* -------------------------------------------------
           LOAD MODULE
        ------------------------------------------------- */

        const module =
            await loadFFmpegModule();


        if (
            !module
        ) {

            throw new Error(
                "FFmpeg module kosong."
            );

        }


        console.info(
            "[GEN-Z.AI][FFmpeg] Module loaded."
        );


        /* -------------------------------------------------
           RESOLVE CONSTRUCTOR
        ------------------------------------------------- */

        const FFmpegClass =
            module.FFmpeg;


        if (
            typeof FFmpegClass !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI][FFmpeg] Module exports:",
                module
            );

            throw new Error(
                "Export FFmpeg tidak ditemukan dari @ffmpeg/ffmpeg."
            );

        }


        /* -------------------------------------------------
           CREATE INSTANCE
        ------------------------------------------------- */

        const ffmpeg =
            new FFmpegClass();


        if (
            !ffmpeg
        ) {

            throw new Error(
                "FFmpeg instance gagal dibuat."
            );

        }


        /* -------------------------------------------------
           LOG HANDLER
        ------------------------------------------------- */

        if (
            typeof ffmpeg.on ===
            "function"
        ) {

            ffmpeg.on(
                "log",
                ({ message }) => {

                    if (
                        message
                    ) {

                        console.debug(
                            "[GEN-Z.AI][FFmpeg]",
                            message
                        );

                    }

                }
            );

        }


        /* -------------------------------------------------
           CORE URL
        ------------------------------------------------- */

        const baseURL =
            FFMPEG_CORE_BASE_URL;


        const coreURL =
            `${baseURL}/ffmpeg-core.js`;


        const wasmURL =
            `${baseURL}/ffmpeg-core.wasm`;


        const workerURL =
            `${baseURL}/ffmpeg-core.worker.js`;


        console.info(
            "[GEN-Z.AI][FFmpeg] Core:",
            baseURL
        );


        /* -------------------------------------------------
           CREATE BLOB URL
        ------------------------------------------------- */

        const coreBlobURL =
            await toBlobURL(
                coreURL,
                "text/javascript"
            );


        const wasmBlobURL =
            await toBlobURL(
                wasmURL,
                "application/wasm"
            );


        const workerBlobURL =
            await toBlobURL(
                workerURL,
                "text/javascript"
            );


        try {

            /* ---------------------------------------------
               LOAD CORE
            --------------------------------------------- */

            await ffmpeg.load({

                coreURL:
                    coreBlobURL,

                wasmURL:
                    wasmBlobURL,

                workerURL:
                    workerBlobURL

            });

        } finally {

            revokeObjectURL(
                coreBlobURL
            );

            revokeObjectURL(
                wasmBlobURL
            );

            revokeObjectURL(
                workerBlobURL
            );

        }


        /* -------------------------------------------------
           VERIFY INSTANCE
        ------------------------------------------------- */

        if (
            typeof ffmpeg.writeFile !==
            "function"
        ) {

            throw new Error(
                "FFmpeg berhasil dibuat tetapi writeFile tidak tersedia."
            );

        }


        if (
            typeof ffmpeg.readFile !==
            "function"
        ) {

            throw new Error(
                "FFmpeg berhasil dibuat tetapi readFile tidak tersedia."
            );

        }


        if (
            typeof ffmpeg.exec !==
            "function"
        ) {

            throw new Error(
                "FFmpeg berhasil dibuat tetapi exec tidak tersedia."
            );

        }


        /* -------------------------------------------------
           STORE STATE
        ------------------------------------------------- */

        state.ffmpeg =
            ffmpeg;

        state.ffmpegLoaded =
            true;

        state.ffmpegLoading =
            false;


        console.info(
            "[GEN-Z.AI][FFmpeg] FFmpeg ready."
        );


        return ffmpeg;

    } catch (error) {

        state.ffmpeg =
            null;

        state.ffmpegLoaded =
            false;

        state.ffmpegLoading =
            false;


        const normalized =
            normalizeFFmpegError(
                error
            );


        console.error(
            "[GEN-Z.AI][FFmpeg] Initialization failed:",
            normalized
        );


        throw normalized;

    }

}


/* =========================================================
   TO BLOB URL
========================================================= */

async function toBlobURL(
    url,
    mimeType
) {

    const response =
        await fetch(
            url,
            {
                method: "GET",
                mode: "cors",
                cache: "no-store"
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `FFmpeg resource gagal dimuat (${response.status} ${response.statusText}): ${url}`
        );

    }


    const blob =
        await response.blob();


    if (
        !blob ||
        blob.size <= 0
    ) {

        throw new Error(
            `FFmpeg resource kosong: ${url}`
        );

    }


    return URL.createObjectURL(
        new Blob(
            [blob],
            {
                type:
                    mimeType ||
                    blob.type ||
                    "application/octet-stream"
            }
        )
    );

}


/* =========================================================
   REVOKE OBJECT URL
========================================================= */

function revokeObjectURL(
    url
) {

    if (
        !url
    ) {

        return;

    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch {

        /* intentionally ignored */

    }

}


/* =========================================================
   WAIT FOR FFMPEG
========================================================= */

export async function waitForFFmpeg() {

    return ensureFFmpeg();

}


/* =========================================================
   CREATE TEMP FILENAME
========================================================= */

export function createFFmpegFilename(
    originalName = "input.mp4",
    prefix = "genz"
) {

    const extension =
        getExtension(
            originalName
        ) ||
        "mp4";


    const timestamp =
        Date.now();


    const random =
        Math.random()
            .toString(36)
            .slice(2, 9);


    return `${prefix}_${timestamp}_${random}.${extension}`;

}


/* =========================================================
   CLEAN VIDEO MIME
========================================================= */

export function getCleanVideoMimeType(
    originalName = ""
) {

    const extension =
        getExtension(
            originalName
        );


    switch (
        extension
    ) {

        case "webm":

            return "video/webm";


        case "mov":

        case "qt":

            return "video/quicktime";


        case "mkv":

            return "video/x-matroska";


        case "avi":

            return "video/x-msvideo";


        case "m4v":

            return "video/x-m4v";


        case "mp4":

        default:

            return "video/mp4";

    }

}


/* =========================================================
   MOV LIKE
========================================================= */

export function isMovLikeVideo(
    file
) {

    const name =
        String(
            file?.name ||
            ""
        )
            .toLowerCase();


    const type =
        String(
            file?.type ||
            ""
        )
            .toLowerCase();


    return (
        name.endsWith(".mov") ||
        name.endsWith(".qt") ||
        type === "video/quicktime"
    );

}


/* =========================================================
   SAFE DELETE
========================================================= */

export async function safeDeleteFFmpegFile(
    ffmpeg,
    filename
) {

    if (
        !ffmpeg ||
        !filename
    ) {

        return;

    }


    if (
        typeof ffmpeg.deleteFile !==
        "function"
    ) {

        return;

    }


    try {

        await ffmpeg.deleteFile(
            filename
        );

    } catch {

        /* file may already be deleted */

    }

}


/* =========================================================
   ERROR MESSAGE
========================================================= */

export function getErrorMessage(
    error
) {

    if (
        !error
    ) {

        return "Unknown error";

    }


    if (
        typeof error ===
        "string"
    ) {

        return error;

    }


    if (
        typeof error.message ===
        "string"
    ) {

        return error.message;

    }


    try {

        return JSON.stringify(
            error
        );

    } catch {

        return String(
            error
        );

    }

}


/* =========================================================
   NORMALIZE ERROR
========================================================= */

function normalizeFFmpegError(
    error
) {

    if (
        error instanceof Error
    ) {

        return error;

    }


    return new Error(
        getErrorMessage(
            error
        )
    );

}


/* =========================================================
   EXTENSION
========================================================= */

function getExtension(
    filename
) {

    const cleanName =
        String(
            filename ||
            ""
        )
            .split("?")[0]
            .split("#")[0];


    const match =
        cleanName.match(
            /\.([a-z0-9]+)$/i
        );


    return match
        ? match[1].toLowerCase()
        : "";

}


/* =========================================================
   DIAGNOSTIC
========================================================= */

export function getFFmpegDiagnostic() {

    return {

        moduleURL:
            FFMPEG_MODULE_URL,

        coreURL:
            FFMPEG_CORE_BASE_URL,

        libraryVersion:
            FFMPEG_VERSION,

        coreVersion:
            FFMPEG_CORE_VERSION,

        stateLoaded:
            Boolean(
                state.ffmpegLoaded
            ),

        stateLoading:
            Boolean(
                state.ffmpegLoading
            ),

        instanceAvailable:
            Boolean(
                state.ffmpeg
            ),

        constructorAvailable:
            Boolean(
                state.ffmpeg &&
                typeof state.ffmpeg.writeFile ===
                "function"
            )

    };

}


/* =========================================================
   GLOBAL DIAGNOSTIC
========================================================= */

if (
    typeof window !==
    "undefined"
) {

    window.GENZFFmpegDiagnostic =
        getFFmpegDiagnostic;

}


/* =========================================================
   PUBLIC API
========================================================= */

export default {

    ensureFFmpeg,

    waitForFFmpeg,

    createFFmpegFilename,

    getCleanVideoMimeType,

    isMovLikeVideo,

    safeDeleteFFmpegFile,

    getErrorMessage,

    getFFmpegDiagnostic

};
