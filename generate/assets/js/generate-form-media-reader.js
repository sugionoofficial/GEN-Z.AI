/* =========================================================
   GEN-Z.AI
   GENERATE FORM MEDIA READER
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-media-reader.js

   Fungsi:
   - Resolve final image parameter value
   - Resolve final audio parameter value
   - Menangani URL input
   - Menangani uploaded media
   - Menunggu upload promise (DENGAN TIMEOUT)
   - Fallback upload dari file input (DENGAN TIMEOUT)
========================================================= */

"use strict";

import {
    uploadImageFile,
    uploadAudioFile
} from "./generate-form-upload.js";


/* =========================================================
   HELPER: AWAIT WITH TIMEOUT
   ---------------------------------------------------------
   Mencegah hang total ketika promise tidak pernah
   settle (resolve/reject). Setelah timeout, eksekusi
   dilanjutkan seolah-olah promise sudah selesai.
========================================================= */

async function awaitWithTimeout(
    promise,
    label,
    ms = 30000
) {

    if (
        !promise ||
        typeof promise.then !==
        "function"
    ) {

        return;

    }


    let timer =
        null;


    const timeout =
        new Promise(
            resolve => {

                timer =
                    setTimeout(
                        () => {

                            console.warn(
                                `[GEN-Z.AI][MediaReader] TIMEOUT ${ms}ms pada ${label}. Melanjutkan tanpa menunggu promise.`
                            );

                            resolve();

                        },
                        ms
                    );

            }
        );


    try {

        await Promise.race([

            promise.catch(
                () => {}
            ),

            timeout

        ]);

    } finally {

        if (
            timer
        ) {

            clearTimeout(
                timer
            );

        }

    }

}


/* =========================================================
   IMAGE
========================================================= */

export async function resolveImageParameterValue(
    imageInput,
    definition = {}
) {

    if (
        !imageInput
    ) {

        console.debug(
            "[GEN-Z.AI][MediaReader] Image input kosong."
        );

        return [];

    }


    const mode =
        typeof imageInput.getInputMode ===
        "function"

            ? imageInput.getInputMode()

            : (
                imageInput.dataset.imageMode ||
                "url"
            );


    console.debug(
        "[GEN-Z.AI][MediaReader] Image mode:",
        mode
    );


    /* -----------------------------------------------------
       URL MODE
    ----------------------------------------------------- */

    if (
        mode ===
        "url"
    ) {

        if (
            typeof imageInput.getUrls ===
            "function"
        ) {

            const urls =
                imageInput.getUrls();


            if (
                Array.isArray(urls)
            ) {

                return urls
                    .map(
                        value =>
                            String(
                                value ||
                                ""
                            ).trim()
                    )
                    .filter(Boolean);

            }

        }


        const urlInput =
            typeof imageInput.getUrlInput ===
            "function"

                ? imageInput.getUrlInput()

                : imageInput.querySelector(
                    'input[type="url"]'
                );


        const value =
            String(
                urlInput?.value ||
                ""
            ).trim();


        return value
            ? [value]
            : [];

    }


    /* -----------------------------------------------------
       WAIT FOR ACTIVE UPLOAD (DENGAN TIMEOUT)
    ----------------------------------------------------- */

    if (
        imageInput._imageUploadPromise &&
        typeof imageInput._imageUploadPromise.then ===
        "function"
    ) {

        console.debug(
            "[GEN-Z.AI][MediaReader] Menunggu _imageUploadPromise (max 30s)..."
        );


        await awaitWithTimeout(
            imageInput._imageUploadPromise,
            "image upload",
            30000
        );


        console.debug(
            "[GEN-Z.AI][MediaReader] _imageUploadPromise selesai atau timeout."
        );

    }


    /* -----------------------------------------------------
       EXISTING UPLOADED URLS
    ----------------------------------------------------- */

    if (
        typeof imageInput.getUploadedUrls ===
        "function"
    ) {

        const uploadedUrls =
            imageInput.getUploadedUrls();


        if (
            Array.isArray(uploadedUrls) &&
            uploadedUrls.length > 0
        ) {

            return uploadedUrls
                .map(
                    value =>
                        String(
                            value ||
                            ""
                        ).trim()
                )
                .filter(Boolean);

        }

    }


    /* -----------------------------------------------------
       SINGLE UPLOADED URL
    ----------------------------------------------------- */

    if (
        typeof imageInput.getUploadedUrl ===
        "function"
    ) {

        const uploadedUrl =
            String(
                imageInput.getUploadedUrl() ||
                ""
            ).trim();


        if (
            uploadedUrl
        ) {

            return [
                uploadedUrl
            ];

        }

    }


    /* -----------------------------------------------------
       FALLBACK FILE INPUT
    ----------------------------------------------------- */

    const fileInput =
        imageInput.querySelector(
            ".generate-image-file"
        );


    const files =
        fileInput?.files;


    if (
        !files ||
        files.length ===
        0
    ) {

        console.debug(
            "[GEN-Z.AI][MediaReader] Tidak ada file image untuk di-upload."
        );

        return [];

    }


    console.debug(
        "[GEN-Z.AI][MediaReader] Fallback upload image:",
        files.length,
        "file"
    );


    const uploaded =
        [];


    for (
        const file of files
    ) {

        if (
            !file
        ) {

            continue;

        }


        try {

            /*
             * -------------------------------------------------
             * FIX: uploadImageFile() juga dibungkus
             * awaitWithTimeout supaya tidak hang selamanya
             * ketika fetch ke storage tidak pernah settle
             * (CORS, network, atau CSP block).
             * -------------------------------------------------
             */

            await awaitWithTimeout(

                uploadImageFile(
                    file
                ),

                "uploadImageFile:" +
                (
                    file?.name ||
                    "?"
                ),

                30000

            );


            /*
             * Setelah timeout, kita tidak tahu apakah upload
             * berhasil. Ambil URL dari helper internal jika
             * tersedia — kalau tidak, ambil dari dataset
             * yang mungkin sudah di-set oleh uploader.
             */

            let url =
                "";


            if (
                typeof imageInput.getUploadedUrls ===
                "function"
            ) {

                const current =
                    imageInput.getUploadedUrls();


                if (
                    Array.isArray(current) &&
                    current.length > 0
                ) {

                    url =
                        current[
                            current.length -
                            1
                        ];

                }

            }


            if (
                !url &&
                typeof imageInput.getUploadedUrl ===
                "function"
            ) {

                url =
                    imageInput.getUploadedUrl();

            }


            if (
                url
            ) {

                uploaded.push(
                    String(
                        url
                    ).trim()
                );

            }

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI][Generate Form] Upload image gagal:",
                error
            );

        }

    }


    if (
        uploaded.length > 0
    ) {

        imageInput.dataset.uploadedUrl =
            uploaded[0];

        imageInput.dataset.uploadedUrls =
            JSON.stringify(
                uploaded
            );

    }


    return uploaded;

}


/* =========================================================
   AUDIO
========================================================= */

export async function resolveAudioParameterValue(
    audioInput
) {

    if (
        !audioInput
    ) {

        console.debug(
            "[GEN-Z.AI][MediaReader] Audio input kosong."
        );

        return "";

    }


    const mode =
        typeof audioInput.getInputMode ===
        "function"

            ? audioInput.getInputMode()

            : (
                audioInput.dataset.audioMode ||
                "url"
            );


    console.debug(
        "[GEN-Z.AI][MediaReader] Audio mode:",
        mode
    );


    /* -----------------------------------------------------
       URL MODE
    ----------------------------------------------------- */

    if (
        mode ===
        "url"
    ) {

        const urlInput =
            typeof audioInput.getUrlInput ===
            "function"

                ? audioInput.getUrlInput()

                : audioInput.querySelector(
                    'input[type="url"]'
                );


        return String(
            urlInput?.value ||
            ""
        ).trim();

    }


    /* -----------------------------------------------------
       WAIT FOR ACTIVE UPLOAD (DENGAN TIMEOUT)
    ----------------------------------------------------- */

    if (
        audioInput._audioUploadPromise &&
        typeof audioInput._audioUploadPromise.then ===
        "function"
    ) {

        console.debug(
            "[GEN-Z.AI][MediaReader] Menunggu _audioUploadPromise (max 30s)..."
        );


        await awaitWithTimeout(
            audioInput._audioUploadPromise,
            "audio upload",
            30000
        );


        console.debug(
            "[GEN-Z.AI][MediaReader] _audioUploadPromise selesai atau timeout."
        );

    }


    /* -----------------------------------------------------
       EXISTING UPLOADED URL
    ----------------------------------------------------- */

    if (
        typeof audioInput.getUploadedUrl ===
        "function"
    ) {

        const uploadedUrl =
            String(
                audioInput.getUploadedUrl() ||
                ""
            ).trim();


        if (
            uploadedUrl
        ) {

            return uploadedUrl;

        }

    }


    /* -----------------------------------------------------
       FALLBACK FILE INPUT
    ----------------------------------------------------- */

    const fileInput =
        audioInput.querySelector(
            ".generate-audio-file"
        );


    const file =
        fileInput?.files?.[0];


    if (
        !file
    ) {

        console.debug(
            "[GEN-Z.AI][MediaReader] Tidak ada file audio untuk di-upload."
        );

        return "";

    }


    console.debug(
        "[GEN-Z.AI][MediaReader] Fallback upload audio:",
        file.name
    );


    try {

        /*
         * -------------------------------------------------
         * FIX: uploadAudioFile() juga dibungkus
         * awaitWithTimeout supaya tidak hang selamanya.
         * -------------------------------------------------
         */

        await awaitWithTimeout(

            uploadAudioFile(
                file
            ),

            "uploadAudioFile:" +
            (
                file?.name ||
                "?"
            ),

            30000

        );


        /*
         * Setelah timeout, ambil URL dari helper internal
         * jika tersedia — kalau tidak, ambil dari dataset.
         */

        let url =
            "";


        if (
            typeof audioInput.getUploadedUrl ===
            "function"
        ) {

            url =
                audioInput.getUploadedUrl();

        }


        if (
            !url &&
            audioInput.dataset.uploadedUrl
        ) {

            url =
                audioInput.dataset.uploadedUrl;

        }


        if (
            url
        ) {

            audioInput.dataset.uploadedUrl =
                String(
                    url
                ).trim();

        }


        return String(
            url ||
            ""
        ).trim();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Upload audio gagal:",
            error
        );

        return "";

    }

}


/* =========================================================
   DEFAULT
========================================================= */

export default {
    resolveImageParameterValue,
    resolveAudioParameterValue
};
