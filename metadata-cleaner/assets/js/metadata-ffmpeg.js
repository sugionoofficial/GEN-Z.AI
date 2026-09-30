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
   - Create FFmpeg filenames
   - Cleanup virtual filesystem
========================================================= */

import {
    APP,
    state
} from "./metadata-state.js";


/* =========================================================
   ENSURE FFMPEG
========================================================= */

export async function ensureFFmpeg() {

    if (
        state.ffmpegLoaded &&
        state.ffmpeg
    ) {

        return state.ffmpeg;
    }


    if (
        state.ffmpegLoading
    ) {

        return waitForFFmpeg();
    }


    state.ffmpegLoading =
        true;


    try {

        await loadFFmpegScripts();


        if (
            typeof window.FFmpeg ===
            "undefined"
        ) {

            throw new Error(
                "FFmpeg browser library tidak tersedia."
            );
        }


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


        const ffmpeg =
            new FFmpegClass();


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


        const coreURL =
            `${APP.FFMPEG_BASE_URL}/ffmpeg-core.js`;


        const wasmURL =
            `${APP.FFMPEG_BASE_URL}/ffmpeg-core.wasm`;


        await ffmpeg.load({

            coreURL:
                await toBlobURL(
                    coreURL,
                    "text/javascript"
                ),

            wasmURL:
                await toBlobURL(
                    wasmURL,
                    "application/wasm"
                )

        });


        state.ffmpeg =
            ffmpeg;


        state.ffmpegLoaded =
            true;


        return ffmpeg;

    } finally {

        state.ffmpegLoading =
            false;
    }
}


/* =========================================================
   FFMPEG SCRIPT LOADER
========================================================= */

async function loadFFmpegScripts() {

    if (
        state.ffmpegScriptsLoaded
    ) {

        return;
    }


    return new Promise(
        (
            resolve,
            reject
        ) => {

            const existing =
                document.querySelector(
                    'script[data-genz-ffmpeg="true"]'
                );


            if (
                existing
            ) {

                if (
                    typeof window.FFmpeg !==
                    "undefined"
                ) {

                    state.ffmpegScriptsLoaded =
                        true;

                    resolve();

                    return;
                }
            }


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


                state.ffmpegScriptsLoaded =
                    true;


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
   BLOB URL HELPER
========================================================= */

async function toBlobURL(
    url,
    mimeType
) {

    const response =
        await fetch(
            url
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Gagal mengambil FFmpeg resource: ${response.status}`
        );
    }


    const blob =
        await response.blob();


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
   FFMPEG WAIT
========================================================= */

function waitForFFmpeg() {

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
                            state.ffmpegLoaded &&
                            state.ffmpeg
                        ) {

                            clearInterval(
                                timer
                            );


                            resolve(
                                state.ffmpeg
                            );


                            return;
                        }


                        if (
                            Date.now() -
                            start >
                            120000
                        ) {

                            clearInterval(
                                timer
                            );


                            reject(
                                new Error(
                                    "FFmpeg membutuhkan waktu terlalu lama untuk dimuat."
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
            file.name
        ).toLowerCase();


    if (
        extension === "webm" ||
        file.type === "video/webm"
    ) {

        return "video/webm";
    }


    if (
        extension === "mov" ||
        file.type === "video/quicktime"
    ) {

        return "video/quicktime";
    }


    if (
        extension === "mkv" ||
        file.type === "video/x-matroska"
    ) {

        return "video/x-matroska";
    }


    if (
        extension === "avi" ||
        file.type === "video/x-msvideo"
    ) {

        return "video/x-msvideo";
    }


    if (
        extension === "ogv" ||
        file.type === "video/ogg"
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
            file.name
        ).toLowerCase();


    return (
        extension === "mp4" ||
        extension === "m4v" ||
        extension === "mov" ||
        file.type === "video/mp4" ||
        file.type === "video/quicktime"
    );
}


/* =========================================================
   FFMPEG DELETE
========================================================= */

export async function safeDeleteFFmpegFile(
    ffmpeg,
    filename
) {

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
