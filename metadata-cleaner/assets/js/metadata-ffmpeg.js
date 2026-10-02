/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   Fungsi:
   - Load FFmpeg browser library
   - Initialize FFmpeg WASM
   - Load FFmpeg core + WASM + worker
   - Prevent duplicate loading
   - Support concurrent callers
   - Create FFmpeg filenames
   - Cleanup virtual filesystem
   - Tidak bergantung pada config FFmpeg eksternal

   FFmpeg:
   @ffmpeg/ffmpeg 0.12.15
   @ffmpeg/core   0.12.10
========================================================= */


import {
    APP,
    state
} from "./metadata-state.js";


/* =========================================================
   FFMPEG CDN CONFIGURATION
   ---------------------------------------------------------
   Jangan bergantung pada:
   APP.FFMPEG_PACKAGE_URL
   APP.FFMPEG_BASE_URL

   Karena konfigurasi tersebut tidak tersedia
   di metadata-state.js.
========================================================= */

const FFMPEG_VERSION =
    "0.12.15";


const FFMPEG_CORE_VERSION =
    "0.12.10";


const FFMPEG_PACKAGE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd/ffmpeg.js`;


const FFMPEG_CORE_BASE_URL =
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;


/* =========================================================
   INTERNAL LOADING STATE
========================================================= */

let ffmpegLoadPromise =
    null;


let ffmpegScriptPromise =
    null;


/* =========================================================
   ENSURE FFMPEG
========================================================= */

export async function ensureFFmpeg() {

    /* -----------------------------------------------------
       Already initialized
    ----------------------------------------------------- */

    if (
        state.ffmpegLoaded &&
        state.ffmpeg
    ) {

        return state.ffmpeg;
    }


    /* -----------------------------------------------------
       Existing initialization
    ----------------------------------------------------- */

    if (
        ffmpegLoadPromise
    ) {

        return ffmpegLoadPromise;
    }


    /* -----------------------------------------------------
       Create shared initialization promise
    ----------------------------------------------------- */

    ffmpegLoadPromise =
        initializeFFmpeg();


    try {

        return await ffmpegLoadPromise;

    } finally {

        ffmpegLoadPromise =
            null;
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

        /* -------------------------------------------------
           Load browser wrapper
        ------------------------------------------------- */

        await loadFFmpegScripts();


        /* -------------------------------------------------
           Validate global
        ------------------------------------------------- */

        if (
            typeof window.FFmpeg ===
            "undefined"
        ) {

            throw new Error(
                "Global FFmpeg tidak tersedia setelah library dimuat."
            );
        }


        /* -------------------------------------------------
           Resolve FFmpeg constructor
        ------------------------------------------------- */

        const FFmpegClass =
            window.FFmpeg.FFmpeg;


        if (
            typeof FFmpegClass !==
            "function"
        ) {

            throw new Error(
                "Constructor window.FFmpeg.FFmpeg tidak tersedia."
            );
        }


        /* -------------------------------------------------
           Create FFmpeg instance
        ------------------------------------------------- */

        const ffmpeg =
            new FFmpegClass();


        /* -------------------------------------------------
           Log listener
        ------------------------------------------------- */

        if (
            typeof ffmpeg.on ===
            "function"
        ) {

            ffmpeg.on(
                "log",
                ({
                    message
                }) => {

                    console.debug(
                        "[FFmpeg]",
                        message
                    );

                }
            );

        }


        /* -------------------------------------------------
           Resolve core resources
        ------------------------------------------------- */

        const baseURL =
            FFMPEG_CORE_BASE_URL
                .replace(
                    /\/+$/,
                    ""
                );


        const coreURL =
            `${baseURL}/ffmpeg-core.js`;


        const wasmURL =
            `${baseURL}/ffmpeg-core.wasm`;


        const workerURL =
            `${baseURL}/ffmpeg-core.worker.js`;


        console.debug(
            "[GEN-Z.AI][FFmpeg] Core:",
            baseURL
        );


        /* -------------------------------------------------
           Download core resources through fetch
           and convert them to blob URLs.

           This avoids browser cross-origin restrictions
           when FFmpeg internally creates workers.
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
               Load FFmpeg WASM
            --------------------------------------------- */

            await ffmpeg.load({

                coreURL:
                    coreBlobURL,

                wasmURL:
                    wasmBlobURL,

                workerURL:
                    workerBlobURL

            });

        } catch (
            error
        ) {

            throw new Error(
                `FFmpeg WASM gagal diinisialisasi: ${
                    getErrorMessage(
                        error
                    )
                }`
            );

        } finally {

            /* ---------------------------------------------
               Blob URLs are no longer required
            --------------------------------------------- */

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
           Final validation
        ------------------------------------------------- */

        if (
            typeof ffmpeg.writeFile !==
            "function" ||
            typeof ffmpeg.readFile !==
            "function" ||
            typeof ffmpeg.exec !==
            "function"
        ) {

            throw new Error(
                "FFmpeg berhasil dimuat tetapi API writeFile/readFile/exec tidak lengkap."
            );
        }


        /* -------------------------------------------------
           Save shared instance
        ------------------------------------------------- */

        state.ffmpeg =
            ffmpeg;


        state.ffmpegLoaded =
            true;


        return ffmpeg;

    } catch (
        error
    ) {

        /* -------------------------------------------------
           Reset failed state
        ------------------------------------------------- */

        state.ffmpeg =
            null;


        state.ffmpegLoaded =
            false;


        throw normalizeFFmpegError(
            error
        );

    } finally {

        state.ffmpegLoading =
            false;

    }
}


/* =========================================================
   LOAD FFMPEG BROWSER LIBRARY
========================================================= */

async function loadFFmpegScripts() {

    /* -----------------------------------------------------
       Already available
    ----------------------------------------------------- */

    if (
        state.ffmpegScriptsLoaded &&
        typeof window.FFmpeg !==
        "undefined"
    ) {

        return;
    }


    /* -----------------------------------------------------
       Another caller is loading it
    ----------------------------------------------------- */

    if (
        ffmpegScriptPromise
    ) {

        await ffmpegScriptPromise;

        return;
    }


    /* -----------------------------------------------------
       Check for existing GEN-Z.AI script
    ----------------------------------------------------- */

    const existingScript =
        document.querySelector(
            'script[data-genz-ffmpeg="true"]'
        );


    if (
        existingScript
    ) {

        if (
            typeof window.FFmpeg !==
            "undefined"
        ) {

            state.ffmpegScriptsLoaded =
                true;

            return;
        }


        ffmpegScriptPromise =
            waitForExistingFFmpegScript(
                existingScript
            );

    } else {

        ffmpegScriptPromise =
            createFFmpegScript();

    }


    try {

        await ffmpegScriptPromise;


        if (
            typeof window.FFmpeg ===
            "undefined"
        ) {

            throw new Error(
                "FFmpeg library berhasil dimuat tetapi global FFmpeg tidak ditemukan."
            );
        }


        state.ffmpegScriptsLoaded =
            true;

    } finally {

        ffmpegScriptPromise =
            null;
    }

}


/* =========================================================
   CREATE FFMPEG SCRIPT
========================================================= */

function createFFmpegScript() {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const script =
                document.createElement(
                    "script"
                );


            script.src =
                FFMPEG_PACKAGE_URL;


            script.async =
                true;


            script.crossOrigin =
                "anonymous";


            script.dataset.genzFfmpeg =
                "true";


            script.onload =
                () => {

                    if (
                        typeof window.FFmpeg ===
                        "undefined"
                    ) {

                        reject(
                            new Error(
                                "FFmpeg library dimuat tetapi window.FFmpeg tidak tersedia."
                            )
                        );

                        return;
                    }


                    resolve();

                };


            script.onerror =
                () => {

                    reject(
                        new Error(
                            `FFmpeg browser library gagal dimuat dari CDN: ${FFMPEG_PACKAGE_URL}`
                        )
                    );

                };


            document.head.appendChild(
                script
            );

        }
    );

}


/* =========================================================
   WAIT FOR EXISTING SCRIPT
========================================================= */

function waitForExistingFFmpegScript(
    script
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            let settled =
                false;


            const cleanup =
                () => {

                    script.removeEventListener(
                        "load",
                        handleLoad
                    );


                    script.removeEventListener(
                        "error",
                        handleError
                    );

                };


            const handleLoad =
                () => {

                    if (
                        settled
                    ) {

                        return;
                    }


                    settled =
                        true;


                    cleanup();


                    if (
                        typeof window.FFmpeg ===
                        "undefined"
                    ) {

                        reject(
                            new Error(
                                "FFmpeg existing script selesai loading tetapi window.FFmpeg tidak tersedia."
                            )
                        );

                        return;
                    }


                    resolve();

                };


            const handleError =
                () => {

                    if (
                        settled
                    ) {

                        return;
                    }


                    settled =
                        true;


                    cleanup();


                    reject(
                        new Error(
                            "Existing FFmpeg browser script gagal dimuat."
                        )
                    );

                };


            script.addEventListener(
                "load",
                handleLoad,
                {
                    once:
                        true
                }
            );


            script.addEventListener(
                "error",
                handleError,
                {
                    once:
                        true
                }
            );


            /* -------------------------------------------------
               Script mungkin selesai sebelum listener terpasang.
            ------------------------------------------------- */

            if (
                typeof window.FFmpeg !==
                "undefined"
            ) {

                handleLoad();

                return;
            }


            waitForGlobalFFmpeg(
                120000
            )
            .then(
                () => {

                    if (
                        settled
                    ) {

                        return;
                    }


                    settled =
                        true;


                    cleanup();


                    resolve();

                }
            )
            .catch(
                (
                    error
                ) => {

                    if (
                        settled
                    ) {

                        return;
                    }


                    settled =
                        true;


                    cleanup();


                    reject(
                        error
                    );

                }
            );

        }
    );

}


/* =========================================================
   WAIT FOR GLOBAL FFMPEG
========================================================= */

function waitForGlobalFFmpeg(
    timeout = 120000
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const start =
                Date.now();


            const timer =
                setInterval(
                    () => {

                        if (
                            typeof window.FFmpeg !==
                            "undefined"
                        ) {

                            clearInterval(
                                timer
                            );


                            resolve();

                            return;
                        }


                        if (
                            Date.now() -
                            start >=
                            timeout
                        ) {

                            clearInterval(
                                timer
                            );


                            reject(
                                new Error(
                                    "FFmpeg browser library membutuhkan waktu terlalu lama untuk dimuat."
                                )
                            );

                        }

                    },
                    100
                );

        }
    );

}


/* =========================================================
   FETCH RESOURCE → BLOB URL
========================================================= */

async function toBlobURL(
    url,
    mimeType
) {

    if (
        !url
    ) {

        throw new Error(
            "URL resource FFmpeg kosong."
        );
    }


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

                    credentials:
                        "omit",

                    cache:
                        "no-store"
                }
            );

    } catch (
        error
    ) {

        throw new Error(
            `Gagal mengambil FFmpeg resource (${url}): ${
                getErrorMessage(
                    error
                )
            }`
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(
            `FFmpeg resource HTTP ${response.status}: ${url}`
        );

    }


    const blob =
        await response.blob();


    if (
        !blob ||
        blob.size === 0
    ) {

        throw new Error(
            `FFmpeg resource kosong: ${url}`
        );

    }


    return URL.createObjectURL(
        new Blob(
            [
                blob
            ],
            {
                type:
                    mimeType
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

        /*
         * Ignore cleanup errors.
         */

    }

}


/* =========================================================
   FFMPEG WAIT
========================================================= */

function waitForFFmpeg() {

    if (
        state.ffmpegLoaded &&
        state.ffmpeg
    ) {

        return Promise.resolve(
            state.ffmpeg
        );
    }


    if (
        ffmpegLoadPromise
    ) {

        return ffmpegLoadPromise;
    }


    return ensureFFmpeg();

}


/* =========================================================
   CREATE FFMPEG FILENAME
========================================================= */

export function createFFmpegFilename(
    originalName
) {

    const extension =
        getExtension(
            originalName
        );


    const safeExtension =
        extension ||
        "mp4";


    return (
        `input.${safeExtension}`
    );

}


/* =========================================================
   VIDEO MIME TYPE
========================================================= */

export function getCleanVideoMimeType(
    file
) {

    const extension =
        getExtension(
            file?.name
        );


    const fileType =
        String(
            file?.type ||
            ""
        )
        .toLowerCase();


    if (
        extension === "webm" ||
        fileType === "video/webm"
    ) {

        return "video/webm";

    }


    if (
        extension === "mov" ||
        fileType === "video/quicktime"
    ) {

        return "video/quicktime";

    }


    if (
        extension === "mkv" ||
        fileType === "video/x-matroska"
    ) {

        return "video/x-matroska";

    }


    if (
        extension === "avi" ||
        fileType === "video/x-msvideo"
    ) {

        return "video/x-msvideo";

    }


    if (
        extension === "ogv" ||
        fileType === "video/ogg"
    ) {

        return "video/ogg";

    }


    if (
        extension === "mpeg" ||
        extension === "mpg"
    ) {

        return "video/mpeg";

    }


    return "video/mp4";

}


/* =========================================================
   MOV / MP4 CHECK
========================================================= */

export function isMovLikeVideo(
    file
) {

    const extension =
        getExtension(
            file?.name
        );


    const fileType =
        String(
            file?.type ||
            ""
        )
        .toLowerCase();


    return (

        extension === "mp4" ||

        extension === "m4v" ||

        extension === "mov" ||

        fileType === "video/mp4" ||

        fileType === "video/quicktime"

    );

}


/* =========================================================
   DELETE FFMPEG FILE
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


    try {

        if (
            typeof ffmpeg.deleteFile ===
            "function"
        ) {

            await ffmpeg.deleteFile(
                filename
            );

        }

    } catch {

        /*
         * Cleanup failure should never
         * invalidate the cleaned output.
         */

    }

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
        typeof error ===
        "string"
    ) {

        return error;
    }


    try {

        const serialized =
            JSON.stringify(
                error
            );


        if (
            serialized &&
            serialized !== "{}"
        ) {

            return serialized;
        }

    } catch {

        /*
         * Ignore serialization errors.
         */

    }


    return "Unknown error";

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
   ---------------------------------------------------------
   Hanya satu fungsi.
   Tidak ada duplicate declaration.
========================================================= */

function getExtension(
    filename
) {

    const clean =
        String(
            filename || ""
        )
        .split("?")[0]
        .split("#")[0]
        .trim();


    const dot =
        clean.lastIndexOf(
            "."
        );


    if (
        dot < 0
    ) {

        return "";

    }


    if (
        dot ===
        clean.length - 1
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
   PUBLIC DIAGNOSTIC
   ---------------------------------------------------------
   Bisa dipanggil dari Console:
   window.GENZFFmpegDiagnostic()
========================================================= */

window.GENZFFmpegDiagnostic =
    () => {

        return {

            libraryURL:
                FFMPEG_PACKAGE_URL,

            coreURL:
                FFMPEG_CORE_BASE_URL,

            libraryVersion:
                FFMPEG_VERSION,

            coreVersion:
                FFMPEG_CORE_VERSION,

            globalAvailable:
                typeof window.FFmpeg !==
                "undefined",

            constructorAvailable:
                Boolean(
                    window.FFmpeg &&
                    typeof window.FFmpeg.FFmpeg ===
                    "function"
                ),

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
                )

        };

    };
