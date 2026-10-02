/* =========================================================
   GEN-Z.AI
   METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   FFmpeg WASM Loader
   ---------------------------------------------------------
   Compatible:
   - @ffmpeg/ffmpeg 0.12.15
   - @ffmpeg/core   0.12.10

   Public exports:
   - ensureFFmpeg
   - waitForFFmpeg
   - createFFmpegFilename
   - getCleanVideoMimeType
   - isMovLikeVideo
   - safeDeleteFFmpegFile
   - getErrorMessage
   - getFFmpegDiagnostic
   - getFFmpegInstance
   - resetFFmpegInstance
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


const FFMPEG_CORE_JS_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm/ffmpeg-core.js`;


const FFMPEG_CORE_WASM_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm/ffmpeg-core.wasm`;


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

let coreBlobURL =
    null;

let wasmBlobURL =
    null;


/* =========================================================
   DIAGNOSTIC
========================================================= */

const diagnostic =
    {
        ffmpegVersion:
            FFMPEG_VERSION,

        coreVersion:
            FFMPEG_CORE_VERSION,

        moduleURL:
            FFMPEG_MODULE_URL,

        coreURL:
            FFMPEG_CORE_JS_URL,

        wasmURL:
            FFMPEG_CORE_WASM_URL,

        moduleLoaded:
            false,

        coreFetched:
            false,

        wasmFetched:
            false,

        coreBlobCreated:
            false,

        wasmBlobCreated:
            false,

        loaded:
            false,

        lastError:
            null
    };


/* =========================================================
   LOG
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
   ERROR MESSAGE
========================================================= */

export function getErrorMessage(
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
   DETAILED ERROR
========================================================= */

function recordError(
    error
) {

    diagnostic.lastError =
        error;


    logError(
        "FFmpeg error:",
        error
    );


    if (
        error &&
        typeof error === "object"
    ) {

        logError(
            "NAME:",
            error.name
        );

        logError(
            "MESSAGE:",
            error.message
        );

        logError(
            "STACK:",
            error.stack
        );

        logError(
            "CAUSE:",
            error.cause
        );

    }

}


/* =========================================================
   FETCH BLOB
========================================================= */

async function fetchAsBlob(
    url,
    mimeType
) {

    log(
        "Fetching:",
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


    const buffer =
        await response.arrayBuffer();


    if (
        !buffer ||
        buffer.byteLength === 0
    ) {

        throw new Error(
            `FFmpeg resource is empty: ${url}`
        );

    }


    log(
        "Fetched:",
        url,
        "size:",
        buffer.byteLength,
        "bytes"
    );


    return new Blob(
        [
            buffer
        ],
        {
            type:
                mimeType
        }
    );

}


/* =========================================================
   CORE BLOB
========================================================= */

async function getCoreBlobURL() {

    if (
        coreBlobURL
    ) {

        return coreBlobURL;

    }


    const blob =
        await fetchAsBlob(
            FFMPEG_CORE_JS_URL,
            "text/javascript"
        );


    diagnostic.coreFetched =
        true;


    coreBlobURL =
        URL.createObjectURL(
            blob
        );


    diagnostic.coreBlobCreated =
        true;


    log(
        "Core Blob created:",
        coreBlobURL
    );


    return coreBlobURL;

}


/* =========================================================
   WASM BLOB
========================================================= */

async function getWasmBlobURL() {

    if (
        wasmBlobURL
    ) {

        return wasmBlobURL;

    }


    const blob =
        await fetchAsBlob(
            FFMPEG_CORE_WASM_URL,
            "application/wasm"
        );


    diagnostic.wasmFetched =
        true;


    wasmBlobURL =
        URL.createObjectURL(
            blob
        );


    diagnostic.wasmBlobCreated =
        true;


    log(
        "WASM Blob created:",
        wasmBlobURL
    );


    return wasmBlobURL;

}


/* =========================================================
   LOAD FFMPEG MODULE
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
                "Loading FFmpeg module:",
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
                    "FFmpeg module is empty."
                );

            }


            if (
                typeof module.FFmpeg !==
                "function"
            ) {

                throw new Error(
                    "FFmpeg constructor was not exported."
                );

            }


            diagnostic.moduleLoaded =
                true;


            log(
                "FFmpeg module loaded."
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
   CREATE WORKER SOURCE
========================================================= */

function createWorkerSource(
    coreURL,
    wasmURL
) {

    /*
       Worker ini sengaja dibuat same-origin
       melalui Blob URL.

       Resource core dan wasm juga sudah menjadi
       Blob URL sehingga tidak bergantung pada
       cross-origin worker loading.
    */

    return `
const CORE_URL =
    ${JSON.stringify(coreURL)};

const WASM_URL =
    ${JSON.stringify(wasmURL)};

let ffmpegCore = null;


async function loadCore() {

    if (
        ffmpegCore
    ) {

        return ffmpegCore;

    }


    try {

        const module =
            await import(
                CORE_URL
            );


        ffmpegCore =
            module?.default ||
            module;


        if (
            !ffmpegCore
        ) {

            throw new Error(
                "ffmpeg-core.js returned an empty module."
            );

        }


        return ffmpegCore;

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

}


self.onmessage =
    async event => {

        const data =
            event.data;


        if (
            !data
        ) {

            return;

        }


        try {

            /*
               FFmpeg's class worker protocol is normally
               responsible for constructing the core.

               This custom worker exists only to keep the
               worker itself same-origin.
            */

            if (
                data.type ===
                "LOAD"
            ) {

                await loadCore();


                self.postMessage(
                    {
                        id:
                            data.id,

                        type:
                            data.type,

                        data:
                            true
                    }
                );


                return;

            }


            self.postMessage(
                {
                    id:
                        data.id,

                    type:
                        "ERROR",

                    data:
                        "FFmpeg worker protocol was not initialized."
                }
            );

        }
        catch (
            error
        ) {

            self.postMessage(
                {
                    id:
                        data.id,

                    type:
                        "ERROR",

                    data:
                        error instanceof Error
                            ? error.toString()
                            : String(
                                error
                            )
                }
            );

        }

    };
`;

}


/* =========================================================
   CREATE WORKER
========================================================= */

async function createWorkerURL(
    coreURL,
    wasmURL
) {

    const source =
        createWorkerSource(
            coreURL,
            wasmURL
        );


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


    return URL.createObjectURL(
        blob
    );

}


/* =========================================================
   CREATE FFmpeg
========================================================= */

async function createFFmpeg() {

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

            if (
                typeof progress ===
                "number"
            ) {

                console.log(
                    "[GEN-Z.AI][FFmpeg PROGRESS]",
                    Math.round(
                        progress * 100
                    ) + "%",
                    time
                );

            }

        }
    );


    return ffmpeg;

}


/* =========================================================
   INITIALIZE
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
                   Load JS package.
                */

                await loadFFmpegModule();


                /*
                   Download core JS.
                */

                const coreURL =
                    await getCoreBlobURL();


                /*
                   Download WASM.
                */

                const wasmURL =
                    await getWasmBlobURL();


                /*
                   Jangan mengganti classWorkerURL
                   dengan worker custom yang hanya
                   memahami LOAD.

                   @ffmpeg/ffmpeg membutuhkan worker
                   resminya.

                   Kita ambil source worker resmi,
                   ubah relative imports menjadi absolute,
                   lalu jadikan Blob URL.
                */

                const workerResponse =
                    await fetch(
                        `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js`,
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
                    !workerResponse.ok
                ) {

                    throw new Error(
                        `FFmpeg worker HTTP ${workerResponse.status}`
                    );

                }


                let workerSource =
                    await workerResponse.text();


                /*
                   worker.js resmi memiliki import:

                   ./const.js
                   ./errors.js

                   Karena worker dibuat dari Blob,
                   relative import tersebut harus
                   menjadi absolute CDN URL.
                */

                workerSource =
                    workerSource.replace(
                        /from\s+["']\.\/const\.js["']/g,
                        `from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/const.js"`
                    );


                workerSource =
                    workerSource.replace(
                        /from\s+["']\.\/errors\.js["']/g,
                        `from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/errors.js"`
                    );


                const workerBlob =
                    new Blob(
                        [
                            workerSource
                        ],
                        {
                            type:
                                "text/javascript"
                        }
                    );


                const classWorkerURL =
                    URL.createObjectURL(
                        workerBlob
                    );


                log(
                    "Creating FFmpeg instance..."
                );


                const ffmpeg =
                    await createFFmpeg();


                log(
                    "Calling ffmpeg.load()..."
                );


                log(
                    "FFmpeg configuration:",
                    {
                        coreURL,
                        wasmURL,
                        classWorkerURL
                    }
                );


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


                diagnostic.loaded =
                    true;


                log(
                    "FFmpeg initialized successfully."
                );


                return ffmpegInstance;

            }
            catch (
                error
            ) {

                diagnostic.loaded =
                    false;


                recordError(
                    error
                );


                ffmpegInstance =
                    null;


                ffmpegLoadPromise =
                    null;


                throw error;

            }

        })();


    return ffmpegLoadPromise;

}


/* =========================================================
   PUBLIC:
   ENSURE FFMPEG
========================================================= */

export async function ensureFFmpeg() {

    return initializeFFmpeg();

}


/* =========================================================
   PUBLIC:
   WAIT FFMPEG
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


    await initializeFFmpeg();


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


    let cleanName =
        String(
            originalName
        )
            .trim();


    /*
       Hapus karakter yang tidak aman
       untuk FFmpeg virtual filesystem.
    */

    cleanName =
        cleanName.replace(
            /[^\w.\-]+/g,
            "_"
        );


    if (
        !cleanName
    ) {

        cleanName =
            fallbackName;

    }


    return cleanName;

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
            .toLowerCase()
            .trim();


    switch (
        type
    ) {

        case "video/quicktime":

            return "video/mp4";


        case "video/x-m4v":

            return "video/mp4";


        case "video/mp4":

            return "video/mp4";


        case "video/webm":

            return "video/webm";


        case "video/ogg":

            return "video/ogg";


        default:

            return (
                type ||
                "video/mp4"
            );

    }

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
   ---------------------------------------------------------
   Supports:

   safeDeleteFFmpegFile(filename)

   safeDeleteFFmpegFile(ffmpeg, filename)
========================================================= */

export async function safeDeleteFFmpegFile(
    firstArgument,
    secondArgument
) {

    let ffmpeg =
        null;

    let filename =
        "";


    /*
       Pattern:
       safeDeleteFFmpegFile(ffmpeg, filename)
    */

    if (
        firstArgument &&
        typeof firstArgument === "object" &&
        typeof firstArgument.deleteFile === "function"
    ) {

        ffmpeg =
            firstArgument;

        filename =
            secondArgument;

    }

    /*
       Pattern:
       safeDeleteFFmpegFile(filename)
    */

    else {

        filename =
            firstArgument;

    }


    /*
       Filename HARUS string.

       Ini yang mencegah kasus sebelumnya:
       FFmpeg object masuk ke postMessage().
    */

    if (
        typeof filename !== "string"
    ) {

        warn(
            "safeDeleteFFmpegFile received invalid filename:",
            filename
        );

        return false;

    }


    filename =
        filename.trim();


    if (
        !filename
    ) {

        return false;

    }


    /*
       Resolve instance jika tidak dikirim
       oleh caller.
    */

    if (
        !ffmpeg
    ) {

        try {

            ffmpeg =
                await ensureFFmpeg();

        }
        catch (
            error
        ) {

            warn(
                "Unable to initialize FFmpeg for cleanup:",
                getErrorMessage(
                    error
                )
            );

            return false;

        }

    }


    if (
        !ffmpeg ||
        typeof ffmpeg.deleteFile !== "function"
    ) {

        warn(
            "Invalid FFmpeg instance during cleanup."
        );

        return false;

    }


    try {

        await ffmpeg.deleteFile(
            filename
        );


        log(
            "Temporary file deleted:",
            filename
        );


        return true;

    }
    catch (
        error
    ) {

        /*
           Cleanup failure tidak boleh
           menggagalkan metadata checking.
        */

        warn(
            "Unable to delete file:",
            filename,
            getErrorMessage(
                error
            )
        );


        return false;

    }

}


/* =========================================================
   PUBLIC:
   GET DIAGNOSTIC
========================================================= */

export function getFFmpegDiagnostic() {

    return {
        ...diagnostic
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
   GLOBAL DEBUG OBJECT
========================================================= */

if (
    typeof window !== "undefined"
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
   MODULE LOADED
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
