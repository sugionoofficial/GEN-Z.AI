/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-ffmpeg.js

   Fungsi:
   - Load FFmpeg browser library
   - Initialize FFmpeg WASM
   - Wait for concurrent loading
   - Prevent duplicate FFmpeg script loading
   - Create FFmpeg filenames
   - Cleanup virtual filesystem
========================================================= */

import {
    APP,
    state
} from "./metadata-state.js";


/* =========================================================
   INTERNAL LOADING STATE
========================================================= */

let ffmpegLoadPromise = null;

let ffmpegScriptPromise = null;


/* =========================================================
   ENSURE FFMPEG
========================================================= */

export async function ensureFFmpeg() {

    /* -----------------------------------------------------
       Already loaded
    ----------------------------------------------------- */

    if (
        state.ffmpegLoaded &&
        state.ffmpeg
    ) {

        return state.ffmpeg;
    }


    /* -----------------------------------------------------
       Existing loading operation
    ----------------------------------------------------- */

    if (
        ffmpegLoadPromise
    ) {

        return ffmpegLoadPromise;
    }


    /* -----------------------------------------------------
       Create one shared loading promise
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
           Load browser library
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
                "FFmpeg browser library tidak tersedia."
            );
        }


        /* -------------------------------------------------
           Resolve constructor
        ------------------------------------------------- */

        const FFmpegClass =
            window.FFmpeg.FFmpeg;


        if (
            typeof FFmpegClass !==
            "function"
        ) {

            throw new Error(
                "FFmpeg constructor tidak tersedia."
            );
        }


        /* -------------------------------------------------
           Create instance
        ------------------------------------------------- */

        const ffmpeg =
            new FFmpegClass();


        /* -------------------------------------------------
           FFmpeg log listener
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
           Resolve core URLs
        ------------------------------------------------- */

        const baseURL =
            String(
                APP.FFMPEG_BASE_URL ||
                ""
            )
            .replace(
                /\/+$/,
                ""
            );


        if (
            !baseURL
        ) {

            throw new Error(
                "FFmpeg core base URL tidak dikonfigurasi."
            );
        }


        const coreURL =
            `${baseURL}/ffmpeg-core.js`;


        const wasmURL =
            `${baseURL}/ffmpeg-core.wasm`;


        /* -------------------------------------------------
           Convert resources to Blob URLs
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


        try {

            /* ---------------------------------------------
               Load FFmpeg WASM
            --------------------------------------------- */

            await ffmpeg.load({

                coreURL:
                    coreBlobURL,

                wasmURL:
                    wasmBlobURL

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
               Blob URLs are no longer needed after load
            --------------------------------------------- */

            revokeObjectURL(
                coreBlobURL
            );


            revokeObjectURL(
                wasmBlobURL
            );
        }


        /* -------------------------------------------------
           Validate successful initialization
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
           Keep shared state consistent after failure
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
   FFMPEG SCRIPT LOADER
========================================================= */

async function loadFFmpegScripts() {

    /* -----------------------------------------------------
       Already loaded
    ----------------------------------------------------- */

    if (
        state.ffmpegScriptsLoaded &&
        typeof window.FFmpeg !==
        "undefined"
    ) {

        return;
    }


    /* -----------------------------------------------------
       Existing shared script-loading operation
    ----------------------------------------------------- */

    if (
        ffmpegScriptPromise
    ) {

        await ffmpegScriptPromise;

        return;
    }


    /* -----------------------------------------------------
       Check for existing script in document
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
                "FFmpeg script berhasil dimuat tetapi global FFmpeg tidak ditemukan."
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
                APP.FFMPEG_PACKAGE_URL;


            script.async =
                false;


            script.dataset.genzFfmpeg =
                "true";


            script.onload = () => {

                if (
                    typeof window.FFmpeg ===
                    "undefined"
                ) {

                    reject(
                        new Error(
                            "FFmpeg script berhasil dimuat tetapi global FFmpeg tidak ditemukan."
                        )
                    );

                    return;
                }


                resolve();
            };


            script.onerror = () => {

                reject(
                    new Error(
                        "FFmpeg browser library gagal dimuat."
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
                                "FFmpeg script berhasil dimuat tetapi global FFmpeg tidak ditemukan."
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
                            "FFmpeg browser library gagal dimuat."
                        )
                    );
                };


            script.addEventListener(
                "load",
                handleLoad,
                {
                    once: true
                }
            );


            script.addEventListener(
                "error",
                handleError,
                {
                    once: true
                }
            );


            /* -------------------------------------------------
               Race protection:
               script may already have completed before
               listeners were attached.
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
   WAIT FOR FFMPEG GLOBAL
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
   BLOB URL HELPER
========================================================= */

async function toBlobURL(
    url,
    mimeType
) {

    if (
        !url
    ) {

        throw new Error(
            "URL resource FFmpeg tidak tersedia."
        );
    }


    let response;


    try {

        response =
            await fetch(
                url
            );

    } catch (
        error
    ) {

        throw new Error(
            `Gagal mengambil FFmpeg resource: ${
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
            `Gagal mengambil FFmpeg resource: ${response.status} ${response.statusText || ""}`.trim()
        );
    }


    let blob;


    try {

        blob =
            await response.blob();

    } catch (
        error
    ) {

        throw new Error(
            `Gagal membaca FFmpeg resource: ${
                getErrorMessage(
                    error
                )
            }`
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
         * Ignore object URL cleanup errors.
         */
    }
}


/* =========================================================
   FFMPEG WAIT
   ---------------------------------------------------------
   Compatibility helper.
   ensureFFmpeg() now uses a shared Promise, but this
   function remains available internally for the existing
   architecture.
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
   FFMPEG FILE NAME
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
   VIDEO MIME
========================================================= */

export function getCleanVideoMimeType(
    file
) {

    const extension =
        getExtension(
            file?.name
        ).toLowerCase();


    const fileType =
        String(
            file?.type ||
            ""
        ).toLowerCase();


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
   MOV / MP4 CONTAINER CHECK
========================================================= */

export function isMovLikeVideo(
    file
) {

    const extension =
        getExtension(
            file?.name
        ).toLowerCase();


    const fileType =
        String(
            file?.type ||
            ""
        ).toLowerCase();


    return (
        extension === "mp4" ||
        extension === "m4v" ||
        extension === "mov" ||
        fileType === "video/mp4" ||
        fileType === "video/quicktime"
    );
}


/* =========================================================
   FFMPEG DELETE
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

        await ffmpeg.deleteFile(
            filename
        );

    } catch {

        /*
         * Ignore cleanup errors.
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
   NORMALIZE FFMPEG ERROR
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
   LOCAL EXTENSION HELPER
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
