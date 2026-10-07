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
   - Menunggu upload promise
   - Fallback upload dari file input
========================================================= */

"use strict";

import {
    uploadImageFile,
    uploadAudioFile
} from "./generate-form-upload.js";


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
       WAIT FOR ACTIVE UPLOAD
    ----------------------------------------------------- */

    if (
        imageInput._imageUploadPromise &&
        typeof imageInput._imageUploadPromise.then ===
        "function"
    ) {

        try {

            await imageInput._imageUploadPromise;

        } catch {
            /* upload error handled by uploader */
        }

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

        return [];

    }


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

            const url =
                await uploadImageFile(
                    file
                );


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
       WAIT FOR ACTIVE UPLOAD
    ----------------------------------------------------- */

    if (
        audioInput._audioUploadPromise &&
        typeof audioInput._audioUploadPromise.then ===
        "function"
    ) {

        try {

            await audioInput._audioUploadPromise;

        } catch {
            /* upload error handled by uploader */
        }

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

        return "";

    }


    try {

        const url =
            await uploadAudioFile(
                file
            );


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
