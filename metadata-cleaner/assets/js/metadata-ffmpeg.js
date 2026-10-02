/* =========================================================
   GEN-Z.AI
   FFMPEG WASM ENGINE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   Fungsi:
   - Load @ffmpeg/ffmpeg
   - Load @ffmpeg/core single-thread
   - FFprobe
   - FFmpeg video cleaning
   - Tidak bergantung pada window.FFmpeg
   - Tidak menggunakan ffmpeg-core.worker.js
========================================================= */

import { state } from "./metadata-state.js";


/* =========================================================
   CONFIG
========================================================= */

const FFMPEG_VERSION =
    "0.12.15";

const FFMPEG_CORE_VERSION =
    "0.12.10";


/*
   @ffmpeg/ffmpeg
   ---------------------------------------------------------
   Kita menggunakan ESM langsung.
*/

const FFMPEG_MODULE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`;


/*
   @ffmpeg/core
   ---------------------------------------------------------
   Single-thread.

   Penting:
   @ffmpeg/core@0.12.10/dist/esm
   hanya menyediakan:

   - ffmpeg-core.js
   - ffmpeg-core.wasm

   Tidak ada:
   - ffmpeg-core.worker.js
*/

const FFMPEG_CORE_BASE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;


/*
   Worker milik @ffmpeg/ffmpeg.

   Ini berbeda dengan:

   ffmpeg-core.worker.js

   yang hanya digunakan oleh core-mt.
*/

const FFMPEG_CLASS_WORKER_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js`;


/* =========================================================
   INTERNAL STATE
========================================================= */

let ffmpegLoadPromise =
    null;

let ffmpegModulePromise =
    null;


/* =========================================================
   LOAD FFMPEG MODULE
========================================================= */

async function loadFFmpegModule() {

    if (
        ffmpegModulePromise
    ) {

        return ffmpegModulePromise;

    }


    console.info(
        "[GEN-Z.AI][FFmpeg] Loading FFmpeg module..."
    );


    console.info(
        "[GEN-Z.AI][FFmpeg] Module:",
        FFMPEG_MODULE_URL
    );


    ffmpegModulePromise =
        import(
            FFMPEG_MODULE_URL
        );


    try {

        const module =
            await ffmpegModulePromise;


        if (
            !module
        ) {

            throw new Error(
                "Module @ffmpeg/ffmpeg kosong."
            );

        }


        console.info(
            "[GEN-Z.AI][FFmpeg] Module loaded."
        );


        return module;

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

    /*
       Sudah siap.
    */

    if (
        state.ffmpeg &&
        state.ffmpegLoaded
    ) {

        return state.ffmpeg;

    }


    /*
       Jangan membuat dua instance
       secara bersamaan.
    */

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

        state.ffmpegLoading =
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


    let classWorkerBlobURL =
        null;

    let coreBlobURL =
        null;

    let wasmBlobURL =
        null;


    try {

        /* -------------------------------------------------
           LOAD JAVASCRIPT MODULE
        ------------------------------------------------- */

        const module =
            await loadFFmpegModule();


        /* -------------------------------------------------
           GET FFmpeg CLASS
        ------------------------------------------------- */

        const FFmpegClass =
            module?.FFmpeg;


        if (
            typeof FFmpegClass !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI][FFmpeg] Invalid module exports:",
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


        console.info(
            "[GEN-Z.AI][FFmpeg] FFmpeg instance created."
        );


        /* -------------------------------------------------
           LOG EVENT
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


            ffmpeg.on(
                "progress",
                ({ progress }) => {

                    if (
                        Number.isFinite(
                            progress
                        )
                    ) {

                        const percent =
                            Math.round(
                                progress * 100
                            );


                        console.debug(
                            `[GEN-Z.AI][FFmpeg] Progress: ${percent}%`
                        );

                    }

                }
            );

        }


        /* -------------------------------------------------
           CORE URL
        ------------------------------------------------- */

        const coreURL =
            `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`;


        const wasmURL =
            `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`;


        console.info(
            "[GEN-Z.AI][FFmpeg] Core JS:",
            coreURL
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core WASM:",
            wasmURL
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] Class worker:",
            FFMPEG_CLASS_WORKER_URL
        );


        /* -------------------------------------------------
           DOWNLOAD CORE
        ------------------------------------------------- */

        coreBlobURL =
            await toBlobURL(
                coreURL,
                "text/javascript"
            );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core JS loaded."
        );


        /* -------------------------------------------------
           DOWNLOAD WASM
        ------------------------------------------------- */

        wasmBlobURL =
            await toBlobURL(
                wasmURL,
                "application/wasm"
            );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core WASM loaded."
        );


        /* -------------------------------------------------
           DOWNLOAD CLASS WORKER
        ------------------------------------------------- */

        classWorkerBlobURL =
            await toBlobURL(
                FFMPEG_CLASS_WORKER_URL,
                "text/javascript"
            );


        console.info(
            "[GEN-Z.AI][FFmpeg] Class worker loaded."
        );


        /* -------------------------------------------------
           LOAD FFMPEG
        ------------------------------------------------- */

        console.info(
            "[GEN-Z.AI][FFmpeg] Starting FFmpeg.load()..."
        );


        await ffmpeg.load({

            /*
               Core JavaScript
            */

            coreURL:
                coreBlobURL,


            /*
               WebAssembly binary
            */

            wasmURL:
                wasmBlobURL,


            /*
               Worker yang digunakan
               oleh class FFmpeg.

               BUKAN:
               ffmpeg-core.worker.js
            */

            classWorkerURL:
                classWorkerBlobURL

        });


        console.info(
            "[GEN-Z.AI][FFmpeg] FFmpeg.load() completed."
        );


        /* -------------------------------------------------
           VERIFY API
        ------------------------------------------------- */

        if (
            typeof ffmpeg.writeFile !==
            "function"
        ) {

            throw new Error(
                "FFmpeg loaded tetapi writeFile() tidak tersedia."
            );

        }


        if (
            typeof ffmpeg.readFile !==
            "function"
        ) {

            throw new Error(
                "FFmpeg loaded tetapi readFile() tidak tersedia."
            );

        }


        if (
            typeof ffmpeg.exec !==
            "function"
        ) {

            throw new Error(
                "FFmpeg loaded tetapi exec() tidak tersedia."
            );

        }


        /*
           FFprobe tersedia di API versi modern
           melalui ffprobe().
        */

        if (
            typeof ffmpeg.ffprobe !==
            "function"
        ) {

            console.warn(
                "[GEN-Z.AI][FFmpeg] ffprobe() tidak tersedia pada instance."
            );

        }


        /* -------------------------------------------------
           SAVE INSTANCE
        ------------------------------------------------- */

        state.ffmpeg =
            ffmpeg;

        state.ffmpegLoaded =
            true;

        state.ffmpegLoading =
            false;


        console.info(
            "[GEN-Z.AI][FFmpeg] FFmpeg READY."
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

    } finally {

        /*
           Setelah ffmpeg.load() selesai,
           Blob URL sudah tidak diperlukan.
        */

        revokeObjectURL(
            coreBlobURL
        );

        revokeObjectURL(
            wasmBlobURL
        );

        revokeObjectURL(
            classWorkerBlobURL
        );

    }

}


/* =========================================================
   TO BLOB URL
========================================================= */

async function toBlobURL(
    url,
    mimeType
) {

    if (
        !url
    ) {

        throw new Error(
            "FFmpeg resource URL kosong."
        );

    }


    console.debug(
        "[GEN-Z.AI][FFmpeg] Fetching:",
        url
    );


    let response;


    try {

        response =
            await fetch(
                url,
                {
                    method:
                        "GET",

                    mode:
                        "cors",

                    cache:
                        "no-store"
                }
            );

    } catch (error) {

        throw new Error(
            `Tidak dapat mengakses FFmpeg resource: ${url} | ${getErrorMessage(error)}`
        );

    }


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
   CREATE FFMPEG FILENAME
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


    return (
        `${prefix}_${timestamp}_${random}.${extension}`
    );

}


/* =========================================================
   GET CLEAN VIDEO MIME TYPE
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
   IS MOV LIKE
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

        name.endsWith(
            ".mov"
        ) ||

        name.endsWith(
            ".qt"
        ) ||

        type ===
            "video/quicktime"

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

        /*
           File mungkin sudah dihapus.
        */

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
   GET EXTENSION
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

        classWorkerURL:
            FFMPEG_CLASS_WORKER_URL,

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

        writeFileAvailable:
            Boolean(
                state.ffmpeg &&
                typeof state.ffmpeg.writeFile ===
                "function"
            ),

        readFileAvailable:
            Boolean(
                state.ffmpeg &&
                typeof state.ffmpeg.readFile ===
                "function"
            ),

        execAvailable:
            Boolean(
                state.ffmpeg &&
                typeof state.ffmpeg.exec ===
                "function"
            ),

        ffprobeAvailable:
            Boolean(
                state.ffmpeg &&
                typeof state.ffmpeg.ffprobe ===
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
