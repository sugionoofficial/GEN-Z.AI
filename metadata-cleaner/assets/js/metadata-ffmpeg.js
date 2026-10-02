/* =========================================================
   GEN-Z.AI
   FFMPEG WASM ENGINE - DIAGNOSTIC BUILD
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   Tujuan versi ini:
   - Memastikan @ffmpeg/ffmpeg dapat dimuat
   - Memastikan class worker dapat dibuat
   - Memastikan core JS dapat diakses
   - Memastikan core WASM dapat diakses
   - Menampilkan error asli dari FFmpeg
   - Tidak menutupi error internal ffmpeg-core.js
========================================================= */

import { state } from "./metadata-state.js";


/* =========================================================
   CONFIG
========================================================= */

const FFMPEG_VERSION =
    "0.12.15";

const FFMPEG_CORE_VERSION =
    "0.12.10";


/* =========================================================
   URL
========================================================= */

const FFMPEG_MODULE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`;


const FFMPEG_WORKER_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js`;


const FFMPEG_CONST_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/const.js`;


const FFMPEG_ERRORS_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/errors.js`;


const FFMPEG_CORE_BASE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;


const FFMPEG_CORE_JS_URL =
    `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`;


const FFMPEG_CORE_WASM_URL =
    `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`;


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
        "[GEN-Z.AI][FFmpeg] Loading module..."
    );


    console.info(
        "[GEN-Z.AI][FFmpeg] Module URL:",
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
                "Module kosong."
            );

        }


        if (
            typeof module.FFmpeg !==
            "function"
        ) {

            throw new Error(
                "Export FFmpeg tidak ditemukan."
            );

        }


        console.info(
            "[GEN-Z.AI][FFmpeg] Module loaded."
        );


        return module;

    } catch (error) {

        ffmpegModulePromise =
            null;


        console.error(
            "[GEN-Z.AI][FFmpeg] Module error:",
            error
        );


        throw error;

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

        state.ffmpegLoading =
            false;


        throw error;

    }

}


/* =========================================================
   INITIALIZE
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


    try {

        /* =================================================
           STEP 1
        ================================================= */

        console.group(
            "[GEN-Z.AI][FFmpeg] Initialization"
        );


        console.info(
            "Library:",
            FFMPEG_VERSION
        );


        console.info(
            "Core:",
            FFMPEG_CORE_VERSION
        );


        console.info(
            "Core JS:",
            FFMPEG_CORE_JS_URL
        );


        console.info(
            "Core WASM:",
            FFMPEG_CORE_WASM_URL
        );


        /* =================================================
           STEP 2
           Test core JS HTTP access
        ================================================= */

        console.info(
            "[GEN-Z.AI][FFmpeg] Testing core JS access..."
        );


        const coreResponse =
            await fetch(
                FFMPEG_CORE_JS_URL,
                {
                    method:
                        "GET",

                    mode:
                        "cors",

                    cache:
                        "no-store"
                }
            );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core JS HTTP status:",
            coreResponse.status
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core JS content-type:",
            coreResponse.headers.get(
                "content-type"
            )
        );


        if (
            !coreResponse.ok
        ) {

            throw new Error(
                `Core JS HTTP ${coreResponse.status} ${coreResponse.statusText}`
            );

        }


        const coreSource =
            await coreResponse.text();


        console.info(
            "[GEN-Z.AI][FFmpeg] Core JS size:",
            coreSource.length
        );


        if (
            !coreSource
        ) {

            throw new Error(
                "ffmpeg-core.js kosong."
            );

        }


        /* =================================================
           STEP 3
           Test WASM HTTP access
        ================================================= */

        console.info(
            "[GEN-Z.AI][FFmpeg] Testing core WASM access..."
        );


        const wasmResponse =
            await fetch(
                FFMPEG_CORE_WASM_URL,
                {
                    method:
                        "GET",

                    mode:
                        "cors",

                    cache:
                        "no-store"
                }
            );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core WASM HTTP status:",
            wasmResponse.status
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core WASM content-type:",
            wasmResponse.headers.get(
                "content-type"
            )
        );


        if (
            !wasmResponse.ok
        ) {

            throw new Error(
                `Core WASM HTTP ${wasmResponse.status} ${wasmResponse.statusText}`
            );

        }


        const wasmBlob =
            await wasmResponse.blob();


        console.info(
            "[GEN-Z.AI][FFmpeg] Core WASM size:",
            wasmBlob.size
        );


        if (
            wasmBlob.size <= 0
        ) {

            throw new Error(
                "ffmpeg-core.wasm kosong."
            );

        }


        /* =================================================
           STEP 4
           Load FFmpeg library
        ================================================= */

        const module =
            await loadFFmpegModule();


        const FFmpegClass =
            module.FFmpeg;


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


        /* =================================================
           STEP 5
           Events
        ================================================= */

        if (
            typeof ffmpeg.on ===
            "function"
        ) {

            ffmpeg.on(
                "log",
                ({ message }) => {

                    console.debug(
                        "[GEN-Z.AI][FFmpeg][LOG]",
                        message
                    );

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

                        console.debug(
                            "[GEN-Z.AI][FFmpeg][PROGRESS]",
                            Math.round(
                                progress * 100
                            ) + "%"
                        );

                    }

                }
            );

        }


        /* =================================================
           STEP 6
           Worker
        ================================================= */

        classWorkerBlobURL =
            await createFFmpegClassWorker();


        console.info(
            "[GEN-Z.AI][FFmpeg] Class worker Blob:",
            classWorkerBlobURL
        );


        /* =================================================
           STEP 7
           FFmpeg.load
        ================================================= */

        console.info(
            "[GEN-Z.AI][FFmpeg] Calling ffmpeg.load()..."
        );


        try {

            await ffmpeg.load({

                coreURL:
                    FFMPEG_CORE_JS_URL,

                wasmURL:
                    FFMPEG_CORE_WASM_URL,

                classWorkerURL:
                    classWorkerBlobURL

            });

        } catch (loadError) {

            console.group(
                "[GEN-Z.AI][FFmpeg] RAW LOAD ERROR"
            );


            console.error(
                "Error object:",
                loadError
            );


            console.error(
                "Error name:",
                loadError?.name
            );


            console.error(
                "Error message:",
                loadError?.message
            );


            console.error(
                "Error stack:",
                loadError?.stack
            );


            console.error(
                "Error cause:",
                loadError?.cause
            );


            console.groupEnd();


            throw loadError;

        }


        /* =================================================
           STEP 8
        ================================================= */

        console.info(
            "[GEN-Z.AI][FFmpeg] ffmpeg.load() SUCCESS."
        );


        if (
            typeof ffmpeg.writeFile !==
            "function"
        ) {

            throw new Error(
                "writeFile() tidak tersedia."
            );

        }


        if (
            typeof ffmpeg.readFile !==
            "function"
        ) {

            throw new Error(
                "readFile() tidak tersedia."
            );

        }


        if (
            typeof ffmpeg.exec !==
            "function"
        ) {

            throw new Error(
                "exec() tidak tersedia."
            );

        }


        console.info(
            "[GEN-Z.AI][FFmpeg] writeFile(): OK"
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] readFile(): OK"
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] exec(): OK"
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] ffprobe():",
            typeof ffmpeg.ffprobe ===
                "function"
                ? "AVAILABLE"
                : "NOT AVAILABLE"
        );


        /* =================================================
           STEP 9
        ================================================= */

        state.ffmpeg =
            ffmpeg;

        state.ffmpegLoaded =
            true;

        state.ffmpegLoading =
            false;


        console.info(
            "[GEN-Z.AI][FFmpeg] READY."
        );


        console.groupEnd();


        return ffmpeg;

    } catch (error) {

        state.ffmpeg =
            null;

        state.ffmpegLoaded =
            false;

        state.ffmpegLoading =
            false;


        console.error(
            "[GEN-Z.AI][FFmpeg] Initialization failed."
        );


        console.error(
            "NAME:",
            error?.name
        );


        console.error(
            "MESSAGE:",
            error?.message
        );


        console.error(
            "STACK:",
            error?.stack
        );


        console.error(
            "RAW:",
            error
        );


        throw normalizeFFmpegError(
            error
        );

    } finally {

        revokeObjectURL(
            classWorkerBlobURL
        );

    }

}


/* =========================================================
   CREATE CLASS WORKER
========================================================= */

async function createFFmpegClassWorker() {

    console.info(
        "[GEN-Z.AI][FFmpeg] Fetching worker..."
    );


    const response =
        await fetch(
            FFMPEG_WORKER_URL,
            {
                method:
                    "GET",

                mode:
                    "cors",

                cache:
                    "no-store"
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Worker HTTP ${response.status} ${response.statusText}`
        );

    }


    let source =
        await response.text();


    if (
        !source
    ) {

        throw new Error(
            "worker.js kosong."
        );

    }


    console.info(
        "[GEN-Z.AI][FFmpeg] Worker size:",
        source.length
    );


    /* -----------------------------------------------------
       Relative imports -> absolute CDN imports
    ----------------------------------------------------- */

    source =
        source.replace(
            /from\s+["']\.\/const\.js["']/g,
            `from "${FFMPEG_CONST_URL}"`
        );


    source =
        source.replace(
            /from\s+["']\.\/errors\.js["']/g,
            `from "${FFMPEG_ERRORS_URL}"`
        );


    source =
        source.replace(
            /import\s*\(\s*["']\.\/const\.js["']\s*\)/g,
            `import("${FFMPEG_CONST_URL}")`
        );


    source =
        source.replace(
            /import\s*\(\s*["']\.\/errors\.js["']\s*\)/g,
            `import("${FFMPEG_ERRORS_URL}")`
        );


    const blob =
        new Blob(
            [source],
            {
                type:
                    "text/javascript"
            }
        );


    if (
        blob.size <= 0
    ) {

        throw new Error(
            "Blob worker kosong."
        );

    }


    return URL.createObjectURL(
        blob
    );

}


/* =========================================================
   WAIT
========================================================= */

export async function waitForFFmpeg() {

    return ensureFFmpeg();

}


/* =========================================================
   FILENAME
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
   MIME TYPE
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


        default:

            return "video/mp4";

    }

}


/* =========================================================
   MOV
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

        /* ignore */

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

        coreBaseURL:
            FFMPEG_CORE_BASE_URL,

        coreJSURL:
            FFMPEG_CORE_JS_URL,

        coreWASMURL:
            FFMPEG_CORE_WASM_URL,

        workerURL:
            FFMPEG_WORKER_URL,

        constURL:
            FFMPEG_CONST_URL,

        errorsURL:
            FFMPEG_ERRORS_URL,

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
   DEFAULT EXPORT
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
