/* =========================================================
   GEN-Z.AI
   METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   FFmpeg WASM loader
   ---------------------------------------------------------
   Compatible:
   - @ffmpeg/ffmpeg 0.12.15
   - @ffmpeg/core   0.12.10

   Tanggung jawab:
   - Load FFmpeg WASM
   - Menangani CORS/CDN
   - Menangani module worker
   - Menyediakan singleton FFmpeg instance
   - Menyediakan helper video filename / mime
   - Tidak menangani UI
   - Tidak menangani metadata scanning
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const FFMPEG_VERSION =
    "0.12.15";

const FFMPEG_CORE_VERSION =
    "0.12.10";

const FFMPEG_MODULE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`;

const FFMPEG_WORKER_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js`;

const FFMPEG_CONST_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/const.js`;

const FFMPEG_ERRORS_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/errors.js`;


/*
   PENTING

   Gunakan ESM core.

   Official package:
   @ffmpeg/core@0.12.10
   exports:
      dist/esm/ffmpeg-core.js
      dist/esm/ffmpeg-core.wasm
*/

const FFMPEG_CORE_BASE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

const FFMPEG_CORE_JS_URL =
    `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`;

const FFMPEG_CORE_WASM_URL =
    `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`;


/* =========================================================
   TIMEOUT
========================================================= */

const FFMPEG_LOAD_TIMEOUT =
    30000;


/* =========================================================
   INTERNAL STATE
========================================================= */

let ffmpegInstance =
    null;

let ffmpegLoadPromise =
    null;

let ffmpegModulePromise =
    null;

let ffmpegClassWorkerBlobURL =
    null;

let ffmpegCoreBlobURL =
    null;

let ffmpegWasmBlobURL =
    null;


/* =========================================================
   DIAGNOSTIC STATE
========================================================= */

const ffmpegDiagnostic =
    {
        moduleURL:
            FFMPEG_MODULE_URL,

        workerURL:
            FFMPEG_WORKER_URL,

        constURL:
            FFMPEG_CONST_URL,

        errorsURL:
            FFMPEG_ERRORS_URL,

        coreURL:
            FFMPEG_CORE_JS_URL,

        wasmURL:
            FFMPEG_CORE_WASM_URL,

        moduleLoaded:
            false,

        workerCreated:
            false,

        coreFetched:
            false,

        wasmFetched:
            false,

        coreBlobCreated:
            false,

        wasmBlobCreated:
            false,

        workerBlobCreated:
            false,

        loaded:
            false,

        lastError:
            null
    };


/* =========================================================
   LOGGER
========================================================= */

function log(
    ...args
) {

    console.log(
        "[GEN-Z.AI][FFmpeg]",
        ...args
    );

}


/* =========================================================
   WARN
========================================================= */

function warn(
    ...args
) {

    console.warn(
        "[GEN-Z.AI][FFmpeg]",
        ...args
    );

}


/* =========================================================
   ERROR
========================================================= */

function logError(
    ...args
) {

    console.error(
        "[GEN-Z.AI][FFmpeg]",
        ...args
    );

}


/* =========================================================
   ERROR NORMALIZER
========================================================= */

function getErrorMessage(
    error
) {

    if (
        error === null ||
        error === undefined
    ) {

        return "Unknown FFmpeg error.";

    }


    if (
        typeof error === "string"
    ) {

        return error;

    }


    if (
        error instanceof Error
    ) {

        return (
            error.message ||
            error.toString()
        );

    }


    if (
        typeof error.message === "string" &&
        error.message
    ) {

        return error.message;

    }


    try {

        const json =
            JSON.stringify(
                error
            );

        if (
            json &&
            json !== "{}"
        ) {

            return json;

        }

    }
    catch (
        _
    ) {
        /* ignore */
    }


    return String(
        error
    );

}


/* =========================================================
   DETAILED ERROR LOG
========================================================= */

function logDetailedError(
    error
) {

    ffmpegDiagnostic.lastError =
        error;


    logError(
        "RAW LOAD ERROR"
    );

    logError(
        "Error object:",
        error
    );

    if (
        error &&
        typeof error === "object"
    ) {

        logError(
            "Error name:",
            error.name
        );

        logError(
            "Error message:",
            error.message
        );

        logError(
            "Error stack:",
            error.stack
        );

        logError(
            "Error cause:",
            error.cause
        );

    }

}


/* =========================================================
   FETCH RESOURCE
========================================================= */

async function fetchResource(
    url,
    expectedType
) {

    log(
        "Fetching resource:",
        url
    );


    const response =
        await fetch(
            url,
            {
                method:
                    "GET",

                mode:
                    "cors",

                credentials:
                    "omit",

                cache:
                    "force-cache"
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `FFmpeg resource HTTP ${response.status}: ${url}`
        );

    }


    const contentType =
        response.headers.get(
            "content-type"
        ) ||
        "";


    log(
        "Resource fetched:",
        {
            url,
            status:
                response.status,
            contentType
        }
    );


    const blob =
        await response.blob();


    if (
        !blob ||
        blob.size <= 0
    ) {

        throw new Error(
            `FFmpeg resource is empty: ${url}`
        );

    }


    /*
       Jangan terlalu ketat terhadap content-type.

       CDN kadang mengirim:
       application/javascript
       text/javascript
       application/octet-stream

       Browser masih bisa menjalankan Blob
       dengan MIME yang kita tentukan sendiri.
    */

    let mime =
        expectedType ||
        contentType ||
        "application/octet-stream";


    if (
        expectedType ===
        "text/javascript"
    ) {

        mime =
            "text/javascript";

    }


    if (
        expectedType ===
        "application/wasm"
    ) {

        mime =
            "application/wasm";

    }


    return new Blob(
        [
            await blob.arrayBuffer()
        ],
        {
            type:
                mime
        }
    );

}


/* =========================================================
   CREATE CORE BLOB
========================================================= */

async function createCoreBlobURL() {

    if (
        ffmpegCoreBlobURL
    ) {

        return ffmpegCoreBlobURL;

    }


    const blob =
        await fetchResource(
            FFMPEG_CORE_JS_URL,
            "text/javascript"
        );


    ffmpegDiagnostic.coreFetched =
        true;


    ffmpegCoreBlobURL =
        URL.createObjectURL(
            blob
        );


    ffmpegDiagnostic.coreBlobCreated =
        true;


    log(
        "Core Blob URL created:",
        ffmpegCoreBlobURL
    );


    return ffmpegCoreBlobURL;

}


/* =========================================================
   CREATE WASM BLOB
========================================================= */

async function createWasmBlobURL() {

    if (
        ffmpegWasmBlobURL
    ) {

        return ffmpegWasmBlobURL;

    }


    const blob =
        await fetchResource(
            FFMPEG_CORE_WASM_URL,
            "application/wasm"
        );


    ffmpegDiagnostic.wasmFetched =
        true;


    ffmpegWasmBlobURL =
        URL.createObjectURL(
            blob
        );


    ffmpegDiagnostic.wasmBlobCreated =
        true;


    log(
        "WASM Blob URL created:",
        ffmpegWasmBlobURL
    );


    return ffmpegWasmBlobURL;

}


/* =========================================================
   LOAD FFmpeg MODULE
========================================================= */

async function loadFFmpegModule() {

    if (
        ffmpegModulePromise
    ) {

        return ffmpegModulePromise;

    }


    ffmpegModulePromise =
        (async () => {

            log(
                "Importing @ffmpeg/ffmpeg:",
                FFMPEG_MODULE_URL
            );


            const module =
                await import(
                    FFMPEG_MODULE_URL
                );


            if (
                !module
            ) {

                throw new Error(
                    "FFmpeg module returned empty module."
                );

            }


            if (
                typeof module.FFmpeg !==
                "function"
            ) {

                throw new Error(
                    "FFmpeg constructor was not exported by @ffmpeg/ffmpeg."
                );

            }


            ffmpegDiagnostic.moduleLoaded =
                true;


            log(
                "FFmpeg module loaded successfully."
            );


            return module;

        })()
        .catch(
            error => {

                ffmpegModulePromise =
                    null;

                throw error;

            }
        );


    return ffmpegModulePromise;

}


/* =========================================================
   CREATE CLASS WORKER SOURCE
========================================================= */

function buildClassWorkerSource() {

    /*
       @ffmpeg/ffmpeg worker.js menggunakan:

          import { CORE_URL, FFMessageType }
          from "./const.js";

          import {
             ERROR_UNKNOWN_MESSAGE_TYPE,
             ERROR_NOT_LOADED,
             ERROR_IMPORT_FAILURE
          } from "./errors.js";

       Karena worker akan dibuat dari Blob,
       relative imports "./const.js" dan "./errors.js"
       tidak boleh dibiarkan.

       Kita ubah menjadi absolute CDN URL.
    */

    return `
/*
 * GEN-Z.AI FFmpeg class worker bridge
 * Generated dynamically.
 */

import {
    CORE_URL,
    FFMessageType
} from "${FFMPEG_CONST_URL}";

import {
    ERROR_UNKNOWN_MESSAGE_TYPE,
    ERROR_NOT_LOADED,
    ERROR_IMPORT_FAILURE
} from "${FFMPEG_ERRORS_URL}";

let ffmpeg = null;

const load = async ({
    coreURL: _coreURL,
    wasmURL: _wasmURL,
    workerURL: _workerURL
}) => {

    const first =
        !ffmpeg;

    try {

        /*
         * Jangan gunakan importScripts() terhadap
         * cross-origin CDN di Blob worker.

         * Gunakan dynamic import untuk ESM core.
         */

        if (
            !_coreURL
        ) {

            _coreURL =
                CORE_URL
                    .replace(
                        "/umd/",
                        "/esm/"
                    );

        }


        const imported =
            await import(
                /* @vite-ignore */
                _coreURL
            );


        if (
            imported &&
            imported.default
        ) {

            self.createFFmpegCore =
                imported.default;

        }
        else if (
            imported
        ) {

            self.createFFmpegCore =
                imported;

        }


        if (
            typeof self.createFFmpegCore !==
            "function"
        ) {

            throw ERROR_IMPORT_FAILURE;

        }

    }
    catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][FFmpeg Worker] Core import failed:",
            error
        );

        throw error;

    }


    const coreURL =
        _coreURL;


    const wasmURL =
        _wasmURL
            ? _wasmURL
            : coreURL.replace(
                /\\.js$/g,
                ".wasm"
            );


    const workerURL =
        _workerURL
            ? _workerURL
            : coreURL.replace(
                /\\.js$/g,
                ".worker.js"
            );


    /*
       FFmpeg core expects these URLs encoded
       into mainScriptUrlOrBlob.

       This is the mechanism used by the
       official ffmpeg.wasm worker.
    */

    ffmpeg =
        await self.createFFmpegCore(
            {
                mainScriptUrlOrBlob:
                    coreURL +
                    "#" +
                    btoa(
                        JSON.stringify(
                            {
                                wasmURL,
                                workerURL
                            }
                        )
                    )
            }
        );


    ffmpeg.setLogger(
        data => {

            self.postMessage(
                {
                    type:
                        FFMessageType.LOG,

                    data
                }
            );

        }
    );


    ffmpeg.setProgress(
        data => {

            self.postMessage(
                {
                    type:
                        FFMessageType.PROGRESS,

                    data
                }
            );

        }
    );


    return first;

};


/* =========================================================
   EXEC
========================================================= */

const exec = ({
    args,
    timeout = -1
}) => {

    ffmpeg.setTimeout(
        timeout
    );

    ffmpeg.exec(
        ...args
    );

    const ret =
        ffmpeg.ret;

    ffmpeg.reset();

    return ret;

};


/* =========================================================
   FFPROBE
========================================================= */

const ffprobe = ({
    args,
    timeout = -1
}) => {

    ffmpeg.setTimeout(
        timeout
    );

    ffmpeg.ffprobe(
        ...args
    );

    const ret =
        ffmpeg.ret;

    ffmpeg.reset();

    return ret;

};


/* =========================================================
   FILE SYSTEM
========================================================= */

const writeFile = ({
    path,
    data
}) => {

    ffmpeg.FS.writeFile(
        path,
        data
    );

    return true;

};


const readFile = ({
    path,
    encoding
}) => {

    return ffmpeg.FS.readFile(
        path,
        {
            encoding
        }
    );

};


const deleteFile = ({
    path
}) => {

    ffmpeg.FS.unlink(
        path
    );

    return true;

};


const rename = ({
    oldPath,
    newPath
}) => {

    ffmpeg.FS.rename(
        oldPath,
        newPath
    );

    return true;

};


const createDir = ({
    path
}) => {

    ffmpeg.FS.mkdir(
        path
    );

    return true;

};


const listDir = ({
    path
}) => {

    const names =
        ffmpeg.FS.readdir(
            path
        );

    const nodes =
        [];

    for (
        const name of names
    ) {

        const stat =
            ffmpeg.FS.stat(
                path +
                "/" +
                name
            );

        nodes.push(
            {
                name,

                isDir:
                    ffmpeg.FS.isDir(
                        stat.mode
                    )
            }
        );

    }

    return nodes;

};


const deleteDir = ({
    path
}) => {

    ffmpeg.FS.rmdir(
        path
    );

    return true;

};


const mount = ({
    fsType,
    options,
    mountPoint
}) => {

    const str =
        fsType;

    const fs =
        ffmpeg
            .FS
            .filesystems[
                str
            ];

    if (
        !fs
    ) {

        return false;

    }


    ffmpeg.FS.mount(
        fs,
        options,
        mountPoint
    );

    return true;

};


const unmount = ({
    mountPoint
}) => {

    ffmpeg.FS.unmount(
        mountPoint
    );

    return true;

};


/* =========================================================
   MESSAGE HANDLER
========================================================= */

self.onmessage =
    async event => {

        const {
            id,
            type,
            data: _data
        } =
            event.data;


        const trans =
            [];


        let data;


        try {

            if (
                type !==
                    FFMessageType.LOAD &&
                !ffmpeg
            ) {

                throw ERROR_NOT_LOADED;

            }


            switch (
                type
            ) {

                case FFMessageType.LOAD:

                    data =
                        await load(
                            _data
                        );

                    break;


                case FFMessageType.EXEC:

                    data =
                        exec(
                            _data
                        );

                    break;


                case FFMessageType.FFPROBE:

                    data =
                        ffprobe(
                            _data
                        );

                    break;


                case FFMessageType.WRITE_FILE:

                    data =
                        writeFile(
                            _data
                        );

                    break;


                case FFMessageType.READ_FILE:

                    data =
                        readFile(
                            _data
                        );

                    break;


                case FFMessageType.DELETE_FILE:

                    data =
                        deleteFile(
                            _data
                        );

                    break;


                case FFMessageType.RENAME:

                    data =
                        rename(
                            _data
                        );

                    break;


                case FFMessageType.CREATE_DIR:

                    data =
                        createDir(
                            _data
                        );

                    break;


                case FFMessageType.LIST_DIR:

                    data =
                        listDir(
                            _data
                        );

                    break;


                case FFMessageType.DELETE_DIR:

                    data =
                        deleteDir(
                            _data
                        );

                    break;


                case FFMessageType.MOUNT:

                    data =
                        mount(
                            _data
                        );

                    break;


                case FFMessageType.UNMOUNT:

                    data =
                        unmount(
                            _data
                        );

                    break;


                default:

                    throw ERROR_UNKNOWN_MESSAGE_TYPE;

            }

        }
        catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI][FFmpeg Worker] Error:",
                error
            );


            self.postMessage(
                {
                    id,

                    type:
                        FFMessageType.ERROR,

                    data:
                        error instanceof Error
                            ? error.toString()
                            : String(
                                error
                            )
                }
            );


            return;

        }


        if (
            data instanceof Uint8Array
        ) {

            trans.push(
                data.buffer
            );

        }


        self.postMessage(
            {
                id,

                type,

                data
            },
            trans
        );

    };
`;

}


/* =========================================================
   CREATE CLASS WORKER
========================================================= */

async function createClassWorkerBlobURL() {

    if (
        ffmpegClassWorkerBlobURL
    ) {

        return ffmpegClassWorkerBlobURL;

    }


    const source =
        buildClassWorkerSource();


    const blob =
        new Blob(
            [
                source
            ],
            {
                type:
                    "text/javascript"
            }
        );


    ffmpegClassWorkerBlobURL =
        URL.createObjectURL(
            blob
        );


    ffmpegDiagnostic.workerBlobCreated =
        true;


    log(
        "Class worker Blob URL created:",
        ffmpegClassWorkerBlobURL
    );


    return ffmpegClassWorkerBlobURL;

}


/* =========================================================
   CREATE FFmpeg INSTANCE
========================================================= */

async function createFFmpegInstance() {

    const {
        FFmpeg
    } =
        await loadFFmpegModule();


    const ffmpeg =
        new FFmpeg();


    ffmpeg.on(
        "log",
        ({
            message
        }) => {

            console.log(
                "[GEN-Z.AI][FFmpeg LOG]",
                message
            );

        }
    );


    ffmpeg.on(
        "progress",
        ({
            progress,
            time
        }) => {

            /*
               Jangan terlalu verbose.
            */

            if (
                typeof progress ===
                "number"
            ) {

                console.log(
                    "[GEN-Z.AI][FFmpeg PROGRESS]",
                    Math.round(
                        progress *
                        100
                    ) + "%",
                    time
                );

            }

        }
    );


    return ffmpeg;

}


/* =========================================================
   INITIALIZE FFmpeg
========================================================= */

async function initializeFFmpeg() {

    if (
        ffmpegInstance &&
        ffmpegInstance.loaded
    ) {

        return ffmpegInstance;

    }


    if (
        ffmpegLoadPromise
    ) {

        return ffmpegLoadPromise;

    }


    ffmpegLoadPromise =
        (async () => {

            try {

                log(
                    "Initializing FFmpeg..."
                );


                /*
                   1.
                   Load FFmpeg JS module.
                */

                await loadFFmpegModule();


                /*
                   2.
                   Fetch core JS.

                   Harus selesai sebelum worker dibuat.
                */

                const coreURL =
                    await createCoreBlobURL();


                /*
                   3.
                   Fetch WASM.
                */

                const wasmURL =
                    await createWasmBlobURL();


                /*
                   4.
                   Create class worker Blob.
                */

                const classWorkerURL =
                    await createClassWorkerBlobURL();


                /*
                   5.
                   Create FFmpeg instance.
                */

                const ffmpeg =
                    await createFFmpegInstance();


                ffmpegDiagnostic.workerCreated =
                    true;


                log(
                    "Calling ffmpeg.load()..."
                );


                log(
                    "Load configuration:",
                    {
                        coreURL,
                        wasmURL,
                        classWorkerURL
                    }
                );


                /*
                   6.
                   Actual FFmpeg load.

                   Timeout dibuat 30 detik.
                   15 detik terlalu agresif untuk
                   first-load WASM di browser.
                */

                const loadPromise =
                    ffmpeg.load(
                        {
                            coreURL,
                            wasmURL,
                            classWorkerURL
                        }
                    );


                const timeoutPromise =
                    new Promise(
                        (
                            _resolve,
                            reject
                        ) => {

                            setTimeout(
                                () => {

                                    reject(
                                        new Error(
                                            `FFmpeg initialization timeout (${FFMPEG_LOAD_TIMEOUT} ms)`
                                        )
                                    );

                                },
                                FFMPEG_LOAD_TIMEOUT
                            );

                        }
                    );


                await Promise.race(
                    [
                        loadPromise,
                        timeoutPromise
                    ]
                );


                ffmpegInstance =
                    ffmpeg;


                ffmpegDiagnostic.loaded =
                    true;


                log(
                    "FFmpeg initialized successfully."
                );


                return ffmpegInstance;

            }
            catch (
                error
            ) {

                ffmpegDiagnostic.loaded =
                    false;


                logDetailedError(
                    error
                );


                logError(
                    "Initialization failed."
                );


                logError(
                    "NAME:",
                    error?.name
                );


                logError(
                    "MESSAGE:",
                    error?.message
                );


                logError(
                    "STACK:",
                    error?.stack
                );


                logError(
                    "RAW:",
                    error
                );


                /*
                   Jangan menyimpan Promise reject.
                   Percobaan berikutnya harus bisa
                   mencoba ulang.
                */

                ffmpegLoadPromise =
                    null;


                /*
                   Instance gagal jangan dipakai.
                */

                ffmpegInstance =
                    null;


                throw error;

            }

        })();


    return ffmpegLoadPromise;

}


/* =========================================================
   PUBLIC:
   ENSURE FFmpeg
========================================================= */

export async function ensureFFmpeg() {

    return initializeFFmpeg();

}


/* =========================================================
   PUBLIC:
   WAIT FOR FFmpeg
========================================================= */

export async function waitForFFmpeg(
    timeout =
        FFMPEG_LOAD_TIMEOUT
) {

    if (
        ffmpegInstance &&
        ffmpegInstance.loaded
    ) {

        return ffmpegInstance;

    }


    const started =
        Date.now();


    while (
        Date.now() -
        started <
        timeout
    ) {

        if (
            ffmpegInstance &&
            ffmpegInstance.loaded
        ) {

            return ffmpegInstance;

        }


        if (
            !ffmpegLoadPromise
        ) {

            await initializeFFmpeg();

        }


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    100
                )
        );

    }


    throw new Error(
        `FFmpeg initialization timeout (${timeout} ms)`
    );

}


/* =========================================================
   PUBLIC:
   CREATE FFMPEG FILENAME
========================================================= */

export function createFFmpegFilename(
    file,
    fallbackName =
        "input"
) {

    const originalName =
        file?.name ||
        fallbackName;


    const cleanName =
        String(
            originalName
        )
            .replace(
                /[^\w.\-]+/g,
                "_"
            );


    if (
        cleanName
    ) {

        return cleanName;

    }


    return fallbackName;

}


/* =========================================================
   PUBLIC:
   VIDEO MIME
========================================================= */

export function getCleanVideoMimeType(
    file
) {

    const type =
        String(
            file?.type ||
            ""
        )
            .toLowerCase();


    if (
        type ===
        "video/quicktime"
    ) {

        return "video/mp4";

    }


    if (
        type ===
        "video/x-m4v"
    ) {

        return "video/mp4";

    }


    if (
        type ===
        "video/webm"
    ) {

        return "video/webm";

    }


    if (
        type ===
        "video/mp4"
    ) {

        return "video/mp4";

    }


    if (
        type ===
        "video/ogg"
    ) {

        return "video/ogg";

    }


    return (
        type ||
        "video/mp4"
    );

}


/* =========================================================
   PUBLIC:
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
        type ===
            "video/quicktime" ||

        type ===
            "video/x-m4v" ||

        /\.mov$/i.test(
            name
        ) ||

        /\.m4v$/i.test(
            name
        )
    );

}


/* =========================================================
   PUBLIC:
   SAFE DELETE
========================================================= */

export async function safeDeleteFFmpegFile(
    filename
) {

    if (
        !filename
    ) {

        return false;

    }


    try {

        const ffmpeg =
            await ensureFFmpeg();


        await ffmpeg.deleteFile(
            filename
        );


        return true;

    }
    catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][FFmpeg] Unable to delete file:",
            filename,
            error
        );


        return false;

    }

}


/* =========================================================
   PUBLIC:
   DIAGNOSTIC
========================================================= */

export function getFFmpegDiagnostic() {

    return {
        ...ffmpegDiagnostic
    };

}


/* =========================================================
   PUBLIC:
   GET INSTANCE
========================================================= */

export function getFFmpegInstance() {

    return ffmpegInstance;

}


/* =========================================================
   PUBLIC:
   RESET INSTANCE
========================================================= */

export function resetFFmpegInstance() {

    ffmpegInstance =
        null;

    ffmpegLoadPromise =
        null;

}


/* =========================================================
   GLOBAL DIAGNOSTIC HELPER
========================================================= */

if (
    typeof window !==
    "undefined"
) {

    window.GENZ_FFMPEG =
        {
            ensure:
                ensureFFmpeg,

            wait:
                waitForFFmpeg,

            diagnostic:
                getFFmpegDiagnostic,

            instance:
                getFFmpegInstance,

            reset:
                resetFFmpegInstance
        };

}


/* =========================================================
   INITIAL LOG
========================================================= */

log(
    "metadata-ffmpeg.js loaded.",
    {
        ffmpeg:
            FFMPEG_VERSION,

        core:
            FFMPEG_CORE_VERSION
    }
);
