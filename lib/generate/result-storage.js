/* =========================================================
   GEN-Z.AI
   PENYIMPANAN HASIL GAMBAR SINKRON
   ---------------------------------------------------------
   File:
     lib/generate/result-storage.js

   Kenapa modul ini ada?
   Model seperti Tencent AI Art membalas gambar di response
   yang sama (sinkron). URL hasil Tencent hanya berlaku
   1 JAM, jadi gambar harus segera disalin ke Supabase
   Storage supaya baris riwayat tetap punya hasil yang bisa
   dibuka.

   Yang dilakukan modul ini:
   1. Ambil byte gambar (base64 dari provider, atau unduh
      dari URL provider).
   2. Deteksi format dari magic bytes (jpeg/png/webp) —
      ekstensi TIDAK ditebak dari nama file.
   3. Unggah ke bucket privat `user-uploads` dengan
      service-role key.
   4. Kembalikan referensi stabil
      `supabase-private://user-uploads/<path>`.

   Catatan retensi
   Cron retensi (lib/storage-retention/cleanup.js) hanya
   menghapus prefix yang terdaftar. Prefix hasil AI Art
   sengaja TIDAK terdaftar, artinya hasil generate user
   tidak ikut terhapus otomatis.

   Catatan keamanan
   Modul ini HANYA untuk server (butuh service-role key),
   jangan diimpor dari bundel browser.
========================================================= */

import {
    buildPrivateMediaRef
} from "./private-media.js";


export const RESULT_BUCKET =
    "user-uploads";


export const RESULT_PREFIX =
    "aiart-outputs";


/** Batas byte gambar yang mau disimpan (12 MB). */
export const MAX_RESULT_BYTES =
    12 * 1024 * 1024;


const REQUEST_TIMEOUT_MS =
    60_000;


/* =========================================================
   HELPERS
========================================================= */

function requireConfig({
    supabaseUrl,
    serviceKey
}) {

    if (
        !supabaseUrl ||
        !serviceKey
    ) {

        const error =
            new Error(
                "Penyimpanan hasil belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong)."
            );

        error.code =
            "RESULT_STORAGE_NOT_CONFIGURED";

        throw error;

    }

}


function sanitizeUserId(
    userId
) {

    const safe =
        String(
            userId ||
            ""
        ).trim();


    if (
        !safe ||
        !/^[A-Za-z0-9._-]+$/.test(
            safe
        )
    ) {

        const error =
            new Error(
                "User ID tidak valid untuk menyimpan hasil."
            );

        error.code =
            "RESULT_STORAGE_INVALID_USER";

        throw error;

    }


    return safe;

}


function randomToken() {

    return Math.random()
        .toString(
            36
        )
        .slice(
            2,
            10
        );

}


/**
 * Deteksi format gambar dari magic bytes.
 *
 * @returns {{extension: string, mimeType: string} | null}
 */
export function detectImageFormat(
    bytes
) {

    if (
        !bytes ||
        bytes.length <
            4
    ) {

        return null;

    }


    const first =
        bytes[0];

    const second =
        bytes[1];

    const third =
        bytes[2];

    const fourth =
        bytes[3];


    if (
        first === 0xff &&
        second === 0xd8 &&
        third === 0xff
    ) {

        return {
            extension:
                "jpg",
            mimeType:
                "image/jpeg"
        };

    }


    if (
        first === 0x89 &&
        second === 0x50 &&
        third === 0x4e &&
        fourth === 0x47
    ) {

        return {
            extension:
                "png",
            mimeType:
                "image/png"
        };

    }


    if (
        first === 0x52 &&
        second === 0x49 &&
        third === 0x46 &&
        fourth === 0x46 &&
        bytes.length >=
            12 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {

        return {
            extension:
                "webp",
            mimeType:
                "image/webp"
        };

    }


    if (
        first === 0x42 &&
        second === 0x4d
    ) {

        return {
            extension:
                "bmp",
            mimeType:
                "image/bmp"
        };

    }


    return null;

}


/**
 * Decode base64 (menerima data-URL) menjadi Uint8Array.
 * Memakai Buffer bila tersedia (Node/Worker), kalau tidak
 * memakai atob.
 */
export function decodeBase64(
    input
) {

    const raw =
        String(
            input ||
            ""
        )
            .trim()
            .replace(
                /^data:[^,]*;base64,/i,
                ""
            )
            .replace(
                /\s+/g,
                ""
            );


    if (
        !raw
    ) {

        const error =
            new Error(
                "Gambar hasil kosong."
            );

        error.code =
            "EMPTY_RESULT_IMAGE";

        throw error;

    }


    if (
        typeof Buffer !==
            "undefined"
    ) {

        return new Uint8Array(
            Buffer.from(
                raw,
                "base64"
            )
        );

    }


    const binary =
        atob(
            raw
        );

    const bytes =
        new Uint8Array(
            binary.length
        );


    for (
        let index = 0; index < binary.length; index += 1
    ) {

        bytes[index] =
            binary.charCodeAt(
                index
            );

    }


    return bytes;

}


async function downloadBytes(
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

        const error =
            new Error(
                "fetch tidak tersedia untuk mengunduh gambar hasil."
            );

        error.code =
            "RESULT_DOWNLOAD_UNAVAILABLE";

        throw error;

    }


    const controller =
        typeof AbortController ===
        "function"
            ? new AbortController()
            : null;


    const timer =
        controller
            ? setTimeout(
                () => controller.abort(),
                REQUEST_TIMEOUT_MS
            )
            : null;


    try {

        const response =
            await doFetch(
                url,
                {
                    signal:
                        controller
                            ? controller.signal
                            : undefined
                }
            );


        if (
            !response?.ok
        ) {

            const error =
                new Error(
                    `Gagal mengunduh gambar hasil dari provider (HTTP ${response?.status || 0}).`
                );

            error.code =
                "RESULT_DOWNLOAD_FAILED";

            throw error;

        }


        const buffer =
            await response.arrayBuffer();


        return new Uint8Array(
            buffer
        );

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


async function uploadBytes({

    bytes,
    mimeType,
    extension,
    userId,
    supabaseUrl,
    serviceKey,
    fetchImpl

}) {

    const safeUrl =
        String(
            supabaseUrl ||
            ""
        )
            .trim()
            .replace(
                /\/+$/,
                ""
            );


    const objectPath =
        `${RESULT_PREFIX}/${sanitizeUserId(userId)}/${Date.now()}-${randomToken()}.${extension}`;


    const encodedPath =
        objectPath
            .split(
                "/"
            )
            .map(
                encodeURIComponent
            )
            .join(
                "/"
            );


    const endpoint =
        `${safeUrl}/storage/v1/object/${RESULT_BUCKET}/${encodedPath}`;


    const doFetch =
        fetchImpl ||
        globalThis.fetch;


    if (
        typeof doFetch !==
            "function"
    ) {

        const error =
            new Error(
                "fetch tidak tersedia untuk menyimpan hasil."
            );

        error.code =
            "RESULT_UPLOAD_UNAVAILABLE";

        throw error;

    }


    const body =
        typeof Buffer !==
            "undefined"
            ? Buffer.from(
                bytes
            )
            : bytes;


    let response;

    let text =
        "";


    try {

        response =
            await doFetch(
                endpoint,
                {
                    method:
                        "POST",
                    headers: {
                        "apikey":
                            serviceKey,
                        "Authorization":
                            `Bearer ${serviceKey}`,
                        "Content-Type":
                            mimeType,
                        "Cache-Control":
                            "3600",
                        "x-upsert":
                            "false"
                    },
                    body
                }
            );


        text =
            await response.text();

    } catch (
        error
    ) {

        const failure =
            new Error(
                `Gagal mengunggah hasil ke Supabase Storage: ${error?.message || "jaringan error"}.`
            );

        failure.code =
            "RESULT_UPLOAD_FAILED";

        throw failure;

    }


    if (
        !response?.ok
    ) {

        const failure =
            new Error(
                `Supabase Storage menolak hasil (HTTP ${response?.status || 0}). ${String(text || "").slice(0, 200)}`
            );

        failure.code =
            "RESULT_UPLOAD_REJECTED";

        failure.status =
            response?.status ||
            null;

        throw failure;

    }


    return {
        bucket:
            RESULT_BUCKET,
        objectPath,
        ref:
            buildPrivateMediaRef({
                bucket:
                    RESULT_BUCKET,
                objectPath
            }),
        mimeType,
        extension,
        bytes:
            bytes.length
    };

}


/* =========================================================
   PUBLIC API
========================================================= */

/**
 * Simpan gambar hasil (base64 atau URL) ke Supabase Storage.
 *
 * @param {object} options
 * @param {{type: "base64"|"url", value: string}} options.result
 * @param {string} options.userId
 * @param {string} options.supabaseUrl
 * @param {string} options.serviceKey
 * @param {Function} [options.fetchImpl]
 * @returns {Promise<{bucket: string, objectPath: string, ref: string, mimeType: string, extension: string, bytes: number}>}
 */
async function persistResultImage({

    result,
    userId,
    supabaseUrl,
    serviceKey,
    fetchImpl

}) {

    requireConfig({
        supabaseUrl,
        serviceKey
    });


    sanitizeUserId(
        userId
    );


    if (
        !result ||
        !result.value
    ) {

        const error =
            new Error(
                "Provider tidak mengirim gambar hasil."
            );

        error.code =
            "MISSING_RESULT_IMAGE";

        throw error;

    }


    const bytes =
        result.type ===
            "url"
            ? await downloadBytes(
                result.value,
                fetchImpl
            )
            : decodeBase64(
                result.value
            );


    if (
        !bytes ||
        !bytes.length
    ) {

        const error =
            new Error(
                "Gambar hasil kosong setelah diunduh."
            );

        error.code =
            "EMPTY_RESULT_IMAGE";

        throw error;

    }


    if (
        bytes.length >
            MAX_RESULT_BYTES
    ) {

        const error =
            new Error(
                `Gambar hasil terlalu besar (${Math.round(bytes.length / 1024 / 1024)} MB, maksimal ${MAX_RESULT_BYTES / 1024 / 1024} MB).`
            );

        error.code =
            "RESULT_TOO_LARGE";

        throw error;

    }


    const format =
        detectImageFormat(
            bytes
        );


    if (
        !format
    ) {

        const error =
            new Error(
                "Format gambar hasil tidak dikenali (bukan JPEG, PNG, WebP, atau BMP)."
            );

        error.code =
            "RESULT_FORMAT_UNKNOWN";

        throw error;

    }


    return uploadBytes({
        bytes,
        mimeType:
            format.mimeType,
        extension:
            format.extension,
        userId,
        supabaseUrl,
        serviceKey,
        fetchImpl
    });

}


export {
    persistResultImage
};


export default {
    RESULT_BUCKET,
    RESULT_PREFIX,
    MAX_RESULT_BYTES,
    detectImageFormat,
    decodeBase64,
    persistResultImage
};
