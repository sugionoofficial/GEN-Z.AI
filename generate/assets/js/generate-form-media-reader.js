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
   - Normalisasi return value uploader (string ATAU object)

   Changelog (audit fix):
   - FIX #1 : awaitWithTimeout sekarang MENGEMBALIKAN hasil promise
             (sebelumnya selalu undefined -> fallback upload mati)
   - FIX #2 : Error upload tidak lagi di-swallow; dikembalikan / dicatat
   - FIX #3 : Mode "both" / "mixed" ditangani eksplisit
   - FIX #4 : Normalisasi mode (trim + lowercase + fallback)
   - FIX #5 : Timeout diekstrak ke konstanta
   - FIX #6 : Cache URL pakai properti internal (bukan dataset JSON)
   - FIX #7 : Logging bisa dimatikan lewat flag DEBUG
   - FIX #8 : Validasi MIME + fallback selector file input
   - FIX #9 : Deduplikasi URL hasil upload
   - FIX #10: Timeout sentinel (Symbol) dibedakan dari hasil valid
========================================================= */

"use strict";

import {
    uploadImageFile,
    uploadAudioFile
} from "./generate-form-upload.js";


/* =========================================================
   KONFIGURASI
========================================================= */

const UPLOAD_TIMEOUT_MS =
    30000;

const DEBUG =
    false;


/* =========================================================
   LOGGER
========================================================= */

function debugLog(
    ...args
) {

    if (
        DEBUG
    ) {

        console.debug(
            "[GEN-Z.AI][MediaReader]",
            ...args
        );

    }

}


function warnLog(
    ...args
) {

    console.warn(
        "[GEN-Z.AI][MediaReader]",
        ...args
    );

}


function errorLog(
    ...args
) {

    console.error(
        "[GEN-Z.AI][MediaReader]",
        ...args
    );

}


/* =========================================================
   TIMEOUT SENTINEL
   ---------------------------------------------------------
   Dibedakan dari `undefined` / `null` supaya pemanggil bisa
   membedakan antara "timeout" dan "hasil kosong".
========================================================= */

const TIMEOUT_SENTINEL =
    Symbol(
        "GENZAI_MEDIA_TIMEOUT"
    );


/* =========================================================
   HELPER: NORMALIZE UPLOAD RESULT
   ---------------------------------------------------------
   uploadImageFile() / uploadAudioFile() bisa mengembalikan
   STRING ATAU OBJECT { path, url }.
========================================================= */

function extractUploadUrl(
    result
) {

    if (
        !result
    ) {

        return "";

    }


    if (
        typeof result ===
        "string"
    ) {

        return String(
            result
        ).trim();

    }


    if (
        typeof result ===
        "object"
    ) {

        const candidateKeys = [

            "url",
            "publicUrl",
            "public_url",
            "href",
            "path"

        ];


        for (
            const key of candidateKeys
        ) {

            const value =
                result[key];


            if (
                typeof value ===
                "string" &&
                value.trim() !==
                ""
            ) {

                return value.trim();

            }

        }

    }


    return "";

}


/* =========================================================
   HELPER: AWAIT WITH TIMEOUT
   ---------------------------------------------------------
   Mengembalikan hasil promise, atau TIMEOUT_SENTINEL kalau
   melewati batas ms. Error promise juga dikembalikan sebagai
   { __error } supaya caller bisa memutuskan.

   Return:
   - hasil promise (bisa apa saja)
   - TIMEOUT_SENTINEL
   - undefined kalau bukan thenable
========================================================= */

async function awaitWithTimeout(
    promise,
    label,
    ms = UPLOAD_TIMEOUT_MS
) {

    if (
        !promise ||
        typeof promise.then !==
        "function"
    ) {

        warnLog(
            `${label}: bukan thenable, dilewati.`
        );

        return undefined;

    }


    let timer =
        null;


    const timeoutPromise =
        new Promise(
            resolve => {

                timer =
                    setTimeout(
                        () => {

                            warnLog(
                                `TIMEOUT ${ms}ms pada ${label}.`
                            );

                            resolve(
                                TIMEOUT_SENTINEL
                            );

                        },
                        ms
                    );

            }
        );


    try {

        const winner =
            await Promise.race([

                promise,

                timeoutPromise

            ]);


        return winner;

    } catch (
        error
    ) {

        errorLog(
            `${label} gagal:`,
            error
        );

        return {

            __error:
                error

        };

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
   HELPER: NORMALIZE MODE
========================================================= */

function resolveMode(
    input,
    datasetKey,
    defaultMode = "url"
) {

    let raw;


    if (
        input &&
        typeof input.getInputMode ===
        "function"
    ) {

        try {

            raw =
                input.getInputMode();

        } catch (
            error
        ) {

            warnLog(
                "getInputMode() error:",
                error
            );

            raw =
                undefined;

        }

    }


    if (
        !raw &&
        input?.dataset
    ) {

        raw =
            input.dataset[datasetKey];

    }


    const normalized =
        String(
            raw ||
            defaultMode
        )
            .trim()
            .toLowerCase();


    return normalized ||
        defaultMode;

}


/* =========================================================
   HELPER: STATE CACHE (bukan dataset JSON)
========================================================= */

function setUploadedUrlsCache(
    input,
    urls
) {

    if (
        !input ||
        !Array.isArray(urls)
    ) {

        return;

    }


    Object.defineProperty(
        input,
        "_genzaiUploadedUrls",
        {

            value:
                urls.slice(),

            writable:
                true,

            configurable:
                true,

            enumerable:
                false

        }
    );

}


function getUploadedUrlsCache(
    input
) {

    if (
        !input ||
        !Array.isArray(
            input._genzaiUploadedUrls
        )
    ) {

        return [];

    }


    return input
        ._genzaiUploadedUrls
        .slice();

}


/* =========================================================
   HELPER: DEDUPE
========================================================= */

function dedupe(
    arr
) {

    if (
        !Array.isArray(arr)
    ) {

        return [];

    }


    const seen =
        new Set();


    const out =
        [];


    for (
        const item of arr
    ) {

        const key =
            String(
                item ||
                ""
            ).trim();


        if (
            !key ||
            seen.has(
                key
            )
        ) {

            continue;

        }


        seen.add(
            key
        );

        out.push(
            key
        );

    }


    return out;

}


/* =========================================================
   HELPER: FILE INPUT RESOLVER
========================================================= */

function getFileInput(
    container,
    preferredSelector,
    acceptPrefix
) {

    if (
        !container ||
        typeof container.querySelector !==
        "function"
    ) {

        return null;

    }


    let el =
        container.querySelector(
            preferredSelector
        );


    if (
        !el
    ) {

        el =
            container.querySelector(
                'input[type="file"]'
            );

    }


    if (
        el &&
        acceptPrefix &&
        el.accept &&
        !String(
            el.accept
        ).includes(
            acceptPrefix
        )
    ) {

        debugLog(
            `File input accept="${el.accept}" tidak match prefix "${acceptPrefix}", tapi tetap dipakai.`
        );

    }


    return el;

}


/* =========================================================
   HELPER: VALIDASI TIPE FILE
========================================================= */

function isFileTypeOk(
    file,
    prefix
) {

    if (
        !file
    ) {

        return false;

    }


    const type =
        String(
            file.type ||
            ""
        ).toLowerCase();


    if (
        !type
    ) {

        /*
         * Sebagian browser lama tidak mengisi .type,
         * jangan blokir di kasus itu.
         */

        return true;

    }


    return type.startsWith(
        prefix
    );

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

        debugLog(
            "Image input kosong."
        );

        return [];

    }


    const mode =
        resolveMode(
            imageInput,
            "imageMode",
            "url"
        );


    debugLog(
        "Image mode:",
        mode
    );


    /* -----------------------------------------------------
       URL MODE (dan "both" -> prioritaskan URL dulu)
    ----------------------------------------------------- */

    if (
        mode ===
        "url" ||
        mode ===
        "both" ||
        mode ===
        "mixed"
    ) {

        let urls =
            [];


        if (
            typeof imageInput.getUrls ===
            "function"
        ) {

            const result =
                imageInput.getUrls();


            if (
                Array.isArray(
                    result
                )
            ) {

                urls =
                    result;

            }

        }


        if (
            urls.length ===
            0
        ) {

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


            if (
                value
            ) {

                urls =
                    [
                        value
                    ];

            }

        }


        const cleaned =
            dedupe(
                urls
            );


        if (
            cleaned.length >
            0
        ) {

            return cleaned;

        }


        if (
            mode ===
            "url"
        ) {

            return [];

        }

        /* mode both/mixed -> lanjut ke upload path */

    }


    /* -----------------------------------------------------
       WAIT FOR ACTIVE UPLOAD (DENGAN TIMEOUT)
    ----------------------------------------------------- */

    if (
        imageInput._imageUploadPromise &&
        typeof imageInput._imageUploadPromise.then ===
        "function"
    ) {

        debugLog(
            `Menunggu _imageUploadPromise (max ${UPLOAD_TIMEOUT_MS}ms)...`
        );


        const result =
            await awaitWithTimeout(
                imageInput._imageUploadPromise,
                "image upload",
                UPLOAD_TIMEOUT_MS
            );


        if (
            result ===
            TIMEOUT_SENTINEL
        ) {

            warnLog(
                "_imageUploadPromise timeout, lanjut cek cache/file."
            );

        } else {

            debugLog(
                "_imageUploadPromise selesai."
            );

        }

    }


    /* -----------------------------------------------------
       EXISTING UPLOADED URLS (via method)
    ----------------------------------------------------- */

    if (
        typeof imageInput.getUploadedUrls ===
        "function"
    ) {

        const uploadedUrls =
            imageInput.getUploadedUrls();


        if (
            Array.isArray(
                uploadedUrls
            ) &&
            uploadedUrls.length >
            0
        ) {

            const cleaned =
                dedupe(
                    uploadedUrls.map(
                        value =>
                            extractUploadUrl(
                                value
                            )
                    )
                );


            if (
                cleaned.length >
                0
            ) {

                setUploadedUrlsCache(
                    imageInput,
                    cleaned
                );


                return cleaned;

            }

        }

    }


    /* -----------------------------------------------------
       EXISTING UPLOADED URL (via cache internal)
    ----------------------------------------------------- */

    const cachedUrls =
        getUploadedUrlsCache(
            imageInput
        );


    if (
        cachedUrls.length >
        0
    ) {

        return cachedUrls;

    }


    /* -----------------------------------------------------
       SINGLE UPLOADED URL
    ----------------------------------------------------- */

    if (
        typeof imageInput.getUploadedUrl ===
        "function"
    ) {

        const uploadedUrl =
            extractUploadUrl(
                imageInput.getUploadedUrl()
            );


        if (
            uploadedUrl
        ) {

            setUploadedUrlsCache(
                imageInput,
                [
                    uploadedUrl
                ]
            );


            return [
                uploadedUrl
            ];

        }

    }


    /* -----------------------------------------------------
       FALLBACK FILE INPUT
    ----------------------------------------------------- */

    const fileInput =
        getFileInput(
            imageInput,
            ".generate-image-file",
            "image/"
        );


    const files =
        fileInput?.files;


    if (
        !files ||
        files.length ===
        0
    ) {

        debugLog(
            "Tidak ada file image untuk di-upload."
        );

        return [];

    }


    debugLog(
        "Fallback upload image:",
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


        if (
            !isFileTypeOk(
                file,
                "image/"
            )
        ) {

            warnLog(
                `Skip file non-image: ${file.name} (${file.type})`
            );

            continue;

        }


        const result =
            await awaitWithTimeout(

                uploadImageFile(
                    file
                ),

                "uploadImageFile:" +
                (
                    file?.name ||
                    "?"
                ),

                UPLOAD_TIMEOUT_MS

            );


        if (
            result ===
            TIMEOUT_SENTINEL
        ) {

            errorLog(
                `Upload image timeout: ${file.name}`
            );

            continue;

        }


        if (
            result &&
            result.__error
        ) {

            errorLog(
                `Upload image gagal: ${file.name}`,
                result.__error
            );

            continue;

        }


        const url =
            extractUploadUrl(
                result
            );


        if (
            url
        ) {

            uploaded.push(
                url
            );

        }

    }


    const finalUrls =
        dedupe(
            uploaded
        );


    if (
        finalUrls.length >
        0
    ) {

        setUploadedUrlsCache(
            imageInput,
            finalUrls
        );


        /* -------------------------------------------------
           Backward-compat: isi dataset juga supaya kode
           lama yang membaca dataset tetap dapat nilai.
        ------------------------------------------------- */

        try {

            imageInput.dataset.uploadedUrl =
                finalUrls[0];

            imageInput.dataset.uploadedUrls =
                JSON.stringify(
                    finalUrls
                );

        } catch (
            error
        ) {

            debugLog(
                "Gagal menulis dataset cache:",
                error
            );

        }

    }


    return finalUrls;

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

        debugLog(
            "Audio input kosong."
        );

        return "";

    }


    const mode =
        resolveMode(
            audioInput,
            "audioMode",
            "url"
        );


    debugLog(
        "Audio mode:",
        mode
    );


    /* -----------------------------------------------------
       URL MODE (dan both/mixed -> cek URL dulu)
    ----------------------------------------------------- */

    if (
        mode ===
        "url" ||
        mode ===
        "both" ||
        mode ===
        "mixed"
    ) {

        const urlInput =
            typeof audioInput.getUrlInput ===
            "function"

                ? audioInput.getUrlInput()

                : audioInput.querySelector(
                    'input[type="url"]'
                );


        const value =
            String(
                urlInput?.value ||
                ""
            ).trim();


        if (
            value
        ) {

            return value;

        }


        if (
            mode ===
            "url"
        ) {

            return "";

        }

        /* mode both/mixed -> lanjut ke upload path */

    }


    /* -----------------------------------------------------
       WAIT FOR ACTIVE UPLOAD (DENGAN TIMEOUT)
    ----------------------------------------------------- */

    if (
        audioInput._audioUploadPromise &&
        typeof audioInput._audioUploadPromise.then ===
        "function"
    ) {

        debugLog(
            `Menunggu _audioUploadPromise (max ${UPLOAD_TIMEOUT_MS}ms)...`
        );


        const result =
            await awaitWithTimeout(
                audioInput._audioUploadPromise,
                "audio upload",
                UPLOAD_TIMEOUT_MS
            );


        if (
            result ===
            TIMEOUT_SENTINEL
        ) {

            warnLog(
                "_audioUploadPromise timeout, lanjut cek cache/file."
            );

        } else {

            debugLog(
                "_audioUploadPromise selesai."
            );

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
            extractUploadUrl(
                audioInput.getUploadedUrl()
            );


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
        getFileInput(
            audioInput,
            ".generate-audio-file",
            "audio/"
        );


    const file =
        fileInput?.files?.[0];


    if (
        !file
    ) {

        debugLog(
            "Tidak ada file audio untuk di-upload."
        );

        return "";

    }


    if (
        !isFileTypeOk(
            file,
            "audio/"
        )
    ) {

        warnLog(
            `Skip file non-audio: ${file.name} (${file.type})`
        );

        return "";

    }


    debugLog(
        "Fallback upload audio:",
        file.name
    );


    const result =
        await awaitWithTimeout(

            uploadAudioFile(
                file
            ),

            "uploadAudioFile:" +
            (
                file?.name ||
                "?"
            ),

            UPLOAD_TIMEOUT_MS

        );


    if (
        result ===
        TIMEOUT_SENTINEL
    ) {

        errorLog(
            `Upload audio timeout: ${file.name}`
        );

        return "";

    }


    if (
        result &&
        result.__error
    ) {

        errorLog(
            `Upload audio gagal: ${file.name}`,
            result.__error
        );

        return "";

    }


    const url =
        extractUploadUrl(
            result
        );


    if (
        url
    ) {

        try {

            audioInput.dataset.uploadedUrl =
                url;

        } catch (
            error
        ) {

            debugLog(
                "Gagal menulis dataset cache audio:",
                error
            );

        }

    }


    return url;

}


/* =========================================================
   DEFAULT
========================================================= */

export default {
    resolveImageParameterValue,
    resolveAudioParameterValue
};
