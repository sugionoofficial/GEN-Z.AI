/* =========================================================
   GEN-Z.AI
   TENCENT AI ART
   IMAGE TO IMAGE (FOTO → GAMBAR ANIME)
   ---------------------------------------------------------
   File:
     models/tencent-aiart-image-to-image/create-task.js

   Alur:
   1. Validasi parameter (foto wajib, prompt <= 256).
   2. Susun body `ImageToImage` Tencent.
   3. Kirim `InputUrl` (signed URL Supabase yang berlaku
      1 jam) — Tencent yang mengunduh foto.
   4. Kalau Tencent gagal mengunduh foto
      (`FailedOperation.ImageDownloadError`), ulangi
      sekali dengan foto dikirim sebagai base64, selama
      ukurannya <= 6 MB.
   5. Kembalikan hasil SINKRON (`synchronous: true`) —
      api/generate.js yang menyalin gambar ke Supabase
      Storage lalu mencatat riwayat.

   Response Tencent `ImageToImage`:
     { Response: { ResultImage: "<base64|url>", RequestId } }

   `ResultImage` TIDAK dikembalikan mentah ke browser
   (bisa > 1 MB dan URL-nya hanya 1 jam). api/generate.js
   menyalinnya ke Supabase Storage lebih dulu.
========================================================= */

import {
    imageToImage,
    createProviderError
} from "../../provider/tencent-aiart/client.js";

import config
    from "./config.js";

import {
    validate
} from "./parameters.js";

import {
    getSource,
    sanitizeParameters,
    buildPayload
} from "./parameter-adapter.js";


/* Batas aman base64: Tencent menolak > 8 MB. */
const MAX_INLINE_BYTES =
    6 * 1024 * 1024;


/* =========================================================
   HELPERS
========================================================= */

function createInputError(
    message,
    errors = []
) {

    const error =
        new Error(
            message
        );

    error.code =
        "INVALID_MODEL_INPUT";

    error.provider =
        config.providerId;

    error.model =
        config.id;

    if (
        errors.length
    ) {

        error.validationErrors =
            errors;

    }

    return error;

}


function bytesToBase64(
    bytes
) {

    if (
        typeof Buffer !==
            "undefined"
    ) {

        return Buffer
            .from(
                bytes
            )
            .toString(
                "base64"
            );

    }


    let binary =
        "";


    const chunkSize =
        0x8000;


    for (
        let index = 0;
        index < bytes.length; index += chunkSize
    ) {

        binary +=
            String.fromCharCode
                .apply(
                    null,
                    bytes.subarray(
                        index,
                        index + chunkSize
                    )
                );

    }


    return btoa(
        binary
    );

}


/**
 * Unduh foto sumber lalu ubah ke base64.
 * Dipakai HANYA sebagai fallback bila Tencent gagal
 * mengunduh `InputUrl`.
 *
 * @returns {Promise<string|null>} base64, atau null bila
 *          foto terlalu besar / gagal diunduh.
 */
async function fetchImageAsBase64(
    url,
    fetchImpl
) {

    const doFetch =
        fetchImpl ||
        globalThis.fetch;


    if (
        typeof doFetch !==
            "function"
    ) {

        return null;

    }


    let response;


    try {

        response =
            await doFetch(
                url
            );

    } catch (
        error
    ) {

        return null;

    }


    if (
        !response?.ok
    ) {

        return null;

    }


    const declaredLength =
        Number(
            response.headers.get(
                "content-length"
            )
        );


    if (
        Number.isFinite(
            declaredLength
        ) &&
        declaredLength >
            MAX_INLINE_BYTES
    ) {

        return null;

    }


    let buffer;


    try {

        buffer =
            await response.arrayBuffer();

    } catch (
        error
    ) {

        return null;

    }


    if (
        !buffer ||
        buffer.byteLength >
            MAX_INLINE_BYTES
    ) {

        return null;

    }


    return bytesToBase64(
        new Uint8Array(
            buffer
        )
    );

}


function isImageDownloadError(
    error
) {

    const code =
        String(
            error?.providerCode ||
            error?.code ||
            ""
        );


    return (
        code.includes(
            "ImageDownloadError"
        ) ||

        code.includes(
            "UrlIllegal"
        )
    );

}


function resolveResult(
    response
) {

    const raw =
        String(
            response?.ResultImage ||
            ""
        ).trim();


    if (
        !raw
    ) {

        return null;

    }


    if (
        /^https?:\/\//i.test(
            raw
        )
    ) {

        return {
            type: "url",
            value: raw
        };

    }


    /* Buang prefix data-URL bila ada. */
    const withoutPrefix =
        raw.replace(
            /^data:image\/[a-z0-9.+-]+;base64,/i,
            ""
        );


    return {
        type: "base64",
        value: withoutPrefix
    };

}


function createSyntheticTaskId(
    requestId
) {

    const suffix =
        String(
            requestId ||
            ""
        )
            .trim()
            .replace(
                /[^A-Za-z0-9_-]/g,
                ""
            ) ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;


    return `tencent-aiart-${suffix}`;

}


/* =========================================================
   CREATE TASK
========================================================= */

async function createTask(
    body = {},
    apiKey,

    /*
     * Opsi tambahan (dipakai pengujian): `fetchImpl`
     * supaya request Tencent bisa diganti tanpa jaringan.
     */
    options = {}
) {

    const input =
        sanitizeParameters(
            getSource(
                body
            )
        );


    const validation =
        validate(
            input
        );


    if (
        !validation.valid
    ) {

        throw createInputError(
            validation.errors.join(
                " "
            ),
            validation.errors
        );

    }


    const payload =
        buildPayload(
            input
        );


    if (
        !payload ||
        !payload.InputUrl
    ) {

        throw createInputError(
            "Satu foto asli wajib diunggah."
        );

    }


    const requestBase = {

        apiKey,

        prompt:
            payload.Prompt ||
            "",

        negativePrompt:
            payload.NegativePrompt ||
            "",

        styles:
            payload.Styles,

        strength:
            payload.Strength,

        logoAdd:
            false,

        responseType:
            "base64",

        region:
            config.api?.region ||
            "",

        fetchImpl:
            options?.fetchImpl ||
            undefined

    };


    let response;


    try {

        response =
            await imageToImage({

                ...requestBase,

                inputUrl:
                    payload.InputUrl

            });

    } catch (
        error
    ) {

        if (
            !isImageDownloadError(
                error
            )
        ) {

            throw error;

        }


        /*
         * Fallback: kirim foto sebagai base64.
         */

        const inlineImage =
            await fetchImageAsBase64(
                payload.InputUrl,
                options?.fetchImpl
            );


        if (
            !inlineImage
        ) {

            const failure =
                new Error(
                    "Tencent gagal mengunduh foto dari penyimpanan GEN-Z.AI, dan foto juga terlalu besar untuk dikirim langsung (maks 6 MB). Unggah foto yang lebih kecil lalu coba lagi."
                );


            failure.code =
                "INPUT_IMAGE_UNREACHABLE";

            failure.provider =
                config.providerId;

            failure.model =
                config.id;

            failure.cause =
                error;


            throw failure;

        }


        response =
            await imageToImage({

                ...requestBase,

                inputImageBase64:
                    inlineImage

            });

    }


    const result =
        resolveResult(
            response
        );


    if (
        !result
    ) {

        throw createProviderError(
            "MISSING_RESULT_IMAGE",
            "Tencent AI Art tidak mengembalikan gambar hasil.",
            {
                requestId:
                    response?.RequestId ||
                    "",
                status:
                    502,
                raw: {
                    RequestId:
                        response?.RequestId ||
                        null
                }
            }
        );

    }


    const requestId =
        String(
            response?.RequestId ||
            ""
        ).trim();


    const taskId =
        createSyntheticTaskId(
            requestId
        );


    return {

        success:
            true,

        synchronous:
            true,

        provider:
            config.providerId,

        providerName:
            config.providerName,

        model:
            config.id,

        status:
            "SUCCEEDED",

        state:
            "succeeded",

        completed:
            true,

        /*

           taskId sintetis supaya riwayat punya kunci unik
           tanpa berpura-pura ada task async di Tencent.
        */

        taskId,

        task_id:
            taskId,

        requestId,

        result: {
            type:
                result.type,

            value:
                result.value,

            mime:
                "image/jpeg"
        },

        style_code:
            payload.Styles?.[0] ||
            "",

        strength:
            payload.Strength ?? null

    };

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    MAX_INLINE_BYTES,

    bytesToBase64,

    fetchImageAsBase64,

    createSyntheticTaskId,

    createTask

};


export default createTask;
