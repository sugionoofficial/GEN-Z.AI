/* =========================================================
   GEN-Z.AI
   FFMPEG WASM ENGINE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   Fungsi:
   - Load @ffmpeg/ffmpeg
   - Load @ffmpeg/core single-thread
   - Load FFmpeg core melalui Blob URL
   - Load FFmpeg worker melalui Blob URL
   - Memperbaiki dependency relatif dari core/worker
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


/* =========================================================
   FFMPEG MODULE
========================================================= */

const FFMPEG_MODULE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`;


/* =========================================================
   FFMPEG CLASS WORKER
========================================================= */

const FFMPEG_WORKER_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js`;

const FFMPEG_CONST_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/const.js`;

const FFMPEG_ERRORS_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/errors.js`;


/* =========================================================
   FFMPEG CORE
========================================================= */

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


        if (
            typeof module.FFmpeg !==
            "function"
        ) {

            throw new Error(
                "Export FFmpeg tidak ditemukan dari @ffmpeg/ffmpeg."
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
   INITIALIZE FFMPEG
========================================================= */

async function initializeFFmpeg() {

    state.ffmpegLoading =
        true;

    state.ffmpegLoaded =
        false;

    state.ffmpeg =
        null;


    let coreBlobURL =
        null;

    let wasmBlobURL =
        null;

    let classWorkerBlobURL =
        null;


    try {

        /* -------------------------------------------------
           LOAD MODULE
        ------------------------------------------------- */

        const module =
            await loadFFmpegModule();


        const FFmpegClass =
            module?.FFmpeg;


        if (
            typeof FFmpegClass !==
            "function"
        ) {

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
           EVENTS
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
           LOAD WASM
        ------------------------------------------------- */

        console.info(
            "[GEN-Z.AI][FFmpeg] Core JS:",
            FFMPEG_CORE_JS_URL
        );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core WASM:",
            FFMPEG_CORE_WASM_URL
        );


        /* -------------------------------------------------
           CREATE CORE JS BLOB
           -------------------------------------------------
           Penting:
           ffmpeg-core.js menggunakan path relatif
           menuju ffmpeg-core.wasm.

           Karena core JS dijalankan dari Blob URL,
           path relatif tersebut harus diganti menjadi
           URL CDN absolut.
        ------------------------------------------------- */

        coreBlobURL =
            await createFFmpegCoreBlob(
                FFMPEG_CORE_JS_URL,
                FFMPEG_CORE_WASM_URL
            );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core JS Blob created."
        );


        /* -------------------------------------------------
           CREATE WASM BLOB
        ------------------------------------------------- */

        wasmBlobURL =
            await toBlobURL(
                FFMPEG_CORE_WASM_URL,
                "application/wasm"
            );


        console.info(
            "[GEN-Z.AI][FFmpeg] Core WASM Blob created."
        );


        /* -------------------------------------------------
           CREATE CLASS WORKER
        ------------------------------------------------- */

        classWorkerBlobURL =
            await createFFmpegClassWorker();


        console.info(
            "[GEN-Z.AI][FFmpeg] Class worker Blob created."
        );


        /* -------------------------------------------------
           LOAD FFMPEG
        ------------------------------------------------- */

        console.info(
            "[GEN-Z.AI][FFmpeg] Starting FFmpeg.load()..."
        );


        await ffmpeg.load({

            coreURL:
                coreBlobURL,

            wasmURL:
                wasmBlobURL,

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


        if (
            typeof ffmpeg.ffprobe !==
            "function"
        ) {

            console.warn(
                "[GEN-Z.AI][FFmpeg] ffprobe() tidak tersedia pada instance."
            );

        } else {

            console.info(
                "[GEN-Z.AI][FFmpeg] ffprobe() tersedia."
            );

        }


        /* -------------------------------------------------
           SAVE STATE
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
         * Jangan biarkan Blob URL berserakan setelah
         * FFmpeg selesai melakukan initialization.
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
   CREATE FFMPEG CORE BLOB
   ---------------------------------------------------------
   Mengubah ffmpeg-core.js menjadi Blob URL lokal.

   Dependency WASM yang semula relatif:
       ffmpeg-core.wasm

   diarahkan ke URL CDN absolut.
========================================================= */

async function createFFmpegCoreBlob(
    coreURL,
    wasmURL
) {

    if (
        !coreURL
    ) {

        throw new Error(
            "FFmpeg core JS URL kosong."
        );

    }


    console.info(
        "[GEN-Z.AI][FFmpeg] Fetching core JS..."
    );


    let response;


    try {

        response =
            await fetch(
                coreURL,
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
            `Tidak dapat mengakses FFmpeg core JS: ${coreURL} | ${getErrorMessage(error)}`
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(
            `FFmpeg core JS gagal dimuat (${response.status} ${response.statusText}): ${coreURL}`
        );

    }


    let source =
        await response.text();


    if (
        !source
    ) {

        throw new Error(
            "Isi ffmpeg-core.js kosong."
        );

    }


    /* -----------------------------------------------------
       IMPORTANT:
       Core dijalankan dari blob: URL.

       Path relatif terhadap WASM tidak boleh lagi
       mengarah ke blob:.

       Kita ubah berbagai bentuk referensi WASM
       menjadi URL absolut.
    ----------------------------------------------------- */

    const escapedWasmURL =
        wasmURL.replace(
            /\\/g,
            "\\\\"
        );


    source =
        source.replace(
            /(["'`])ffmpeg-core\.wasm\1/g,
            `$1${escapedWasmURL}$1`
        );


    source =
        source.replace(
            /(["'`])\.\/ffmpeg-core\.wasm\1/g,
            `$1${escapedWasmURL}$1`
        );


    source =
        source.replace(
            /(["'`])ffmpeg-core\.wasm\.js\1/g,
            `$1${escapedWasmURL}.js$1`
        );


    /* -----------------------------------------------------
       Beberapa build Emscripten menyimpan nama WASM
       di variabel JavaScript.
    ----------------------------------------------------- */

    source =
        source.replace(
            /(["'`])\.\/ffmpeg-core\.wasm/g,
            `$1${escapedWasmURL}`
        );


    /* -----------------------------------------------------
       Pastikan source tetap valid.
    ----------------------------------------------------- */

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
            "Blob ffmpeg-core.js kosong."
        );

    }


    return URL.createObjectURL(
        blob
    );

}


/* =========================================================
   CREATE FFMPEG CLASS WORKER
========================================================= */

async function createFFmpegClassWorker() {

    console.info(
        "[GEN-Z.AI][FFmpeg] Fetching class worker:",
        FFMPEG_WORKER_URL
    );


    let response;


    try {

        response =
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

    } catch (error) {

        throw new Error(
            `Tidak dapat mengakses FFmpeg class worker: ${FFMPEG_WORKER_URL} | ${getErrorMessage(error)}`
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(
            `FFmpeg class worker gagal dimuat (${response.status} ${response.statusText}): ${FFMPEG_WORKER_URL}`
        );

    }


    let source =
        await response.text();


    if (
        !source
    ) {

        throw new Error(
            "Isi FFmpeg class worker kosong."
        );

    }


    /* -----------------------------------------------------
       Resolve worker dependencies.
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


    const workerBlob =
        new Blob(
            [source],
            {
                type:
                    "text/javascript"
            }
        );


    if (
        workerBlob.size <= 0
    ) {

        throw new Error(
            "Blob FFmpeg class worker kosong."
        );

    }


    return URL.createObjectURL(
        workerBlob
    );

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
   SAFE DELETE FFMPEG FILE
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

        /* File mungkin sudah dihapus. */

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
