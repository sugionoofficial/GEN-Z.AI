/* =========================================================
   GEN-Z.AI
   TENCENT CLOUD AI ART (aiart)
   PROVIDER CLIENT
   ---------------------------------------------------------
   File:
     provider/tencent-aiart/client.js

   Fungsi:
   - HTTP client untuk Tencent Cloud AI Art
   - Signature TC3-HMAC-SHA256 (Signature Version 3)
   - Aksi ImageToImage (foto → gambar bergaya / anime)
   - Normalisasi error Tencent → pesan yang bisa ditindaklanjuti

   DOKUMENTASI
     https://cloud.tencent.com/document/product/1668/88066
     Host    : aiart.tencentcloudapi.com
     Action  : ImageToImage
     Version : 2022-12-29

   PENTING
   - Produk ini BUKAN TokenHub. Kredensialnya pasangan
     SecretId + SecretKey dari Tencent Cloud (CAM), bukan
     Bearer API key.
   - AI Art menagih per gambar. Free trial (kalau ada)
     melekat pada produk AI Art, bukan TokenHub.
   - Response `ResultImage` bisa base64 atau URL yang
     berlaku 1 jam. Penyimpanan permanen ditangani
     `storage.js`, bukan file ini.

   SIGNING
   Memakai Web Crypto (`crypto.subtle`) supaya modul ini
   tetap aman bila ikut terbundel ke runtime tanpa
   `node:crypto`.
========================================================= */


/* =========================================================
   CONSTANT
========================================================= */

const PROVIDER_ID =
    "tencent-aiart";


const PROVIDER_NAME =
    "Tencent AI Art";


const DEFAULT_HOST =
    "aiart.tencentcloudapi.com";


const API_VERSION =
    "2022-12-29";


const DEFAULT_REGION =
    "ap-guangzhou";


const SERVICE =
    "aiart";


const DEFAULT_TIMEOUT_MS =
    120_000;


/* =========================================================
   ENV GUARD
========================================================= */

function getEnv() {

    return (
        typeof process !== "undefined" &&
        process &&
        process.env
            ? process.env
            : {}
    );

}


function getHost() {

    const configured =
        String(
            getEnv().TENCENT_AIART_HOST ||
            ""
        ).trim();


    return (
        configured ||
        DEFAULT_HOST
    )
        .replace(
            /^https?:\/\//i,
            ""
        )
        .replace(
            /\/+$/,
            ""
        );

}


/* =========================================================
   CREDENTIAL
========================================================= */

/**
 * Membaca kredensial provider menjadi { secretId, secretKey, region }.
 *
 * Format yang diterima (satu kolom tersimpan di provider_credentials):
 *
 *   SecretId|SecretKey
 *   SecretId:SecretKey
 *   SecretId,SecretKey
 *   {"secretId":"...","secretKey":"...","region":"ap-guangzhou"}
 *
 * Region opsional; default ap-guangzhou. AI Art mendukung
 * ap-guangzhou & ap-shanghai — region yang salah menghasilkan
 * AuthFailure/UnsupportedRegion, jadi bisa dioverride di sini
 * atau lewat Worker variable TENCENT_AIART_REGION.
 */
function parseCredential(
    raw
) {

    const text =
        String(
            raw ||
            ""
        ).trim();


    if (
        !text
    ) {

        const error = new Error(
            "Kredensial Tencent AI Art kosong. Isi SecretId dan SecretKey produk AI Art di Admin → Providers."
        );

        error.code = "MISSING_CREDENTIAL";

        throw error;

    }


    if (
        text.startsWith("{")
    ) {

        let parsed;

        try {

            parsed =
                JSON.parse(
                    text
                );

        } catch (
            error
        ) {

            const failure = new Error(
                "Kredensial Tencent AI Art berformat JSON tetapi tidak valid."
            );

            failure.code = "INVALID_CREDENTIAL";

            throw failure;

        }


        const secretId =
            String(
                parsed?.secretId ||
                parsed?.SecretId ||
                parsed?.secret_id ||
                ""
            ).trim();


        const secretKey =
            String(
                parsed?.secretKey ||
                parsed?.SecretKey ||
                parsed?.secret_key ||
                ""
            ).trim();


        if (
            !secretId ||
            !secretKey
        ) {

            const failure = new Error(
                "JSON kredensial Tencent AI Art harus memuat secretId dan secretKey."
            );

            failure.code = "INVALID_CREDENTIAL";

            throw failure;

        }


        return {
            secretId,
            secretKey,
            region:
                String(
                    parsed?.region ||
                    parsed?.Region ||
                    ""
                ).trim() ||
                resolveRegion()
        };

    }


    /*
       Pemisah: "|" (disarankan), ":" , atau ",".
    */

    const separator =
        text.includes("|")
            ? "|"
            : text.includes(":")
                ? ":"
                : text.includes(",")
                    ? ","
                    : "";


    const parts =
        separator
            ? text.split(
                separator
            )
            : [];


    const secretId =
        String(
            parts[0] ||
            ""
        ).trim();


    const secretKey =
        String(
            parts.slice(1).join(separator) ||
            ""
        ).trim();


    if (
        !secretId ||
        !secretKey
    ) {

        const failure = new Error(
            "Kredensial Tencent AI Art harus berisi SecretId dan SecretKey, dipisah dengan \"|\". Contoh: AKIDxxxx|xxxxxxxx"
        );

        failure.code = "INVALID_CREDENTIAL";

        throw failure;

    }


    return {
        secretId,
        secretKey,
        region:
            resolveRegion()
    };

}


function resolveRegion() {

    return String(
        getEnv().TENCENT_AIART_REGION ||
        DEFAULT_REGION
    ).trim() ||
        DEFAULT_REGION;

}


/* =========================================================
   CRYPTO HELPERS (WEB CRYPTO)
========================================================= */

function getSubtle() {

    const subtle =
        globalThis.crypto &&
        globalThis.crypto.subtle;


    if (
        !subtle
    ) {

        throw new Error(
            "crypto.subtle tidak tersedia; signature Tencent tidak bisa dibuat."
        );

    }


    return subtle;

}


function toHex(
    buffer
) {

    const bytes =
        new Uint8Array(
            buffer
        );


    let hex =
        "";


    for (
        let index = 0;
        index < bytes.length; index += 1
    ) {

        hex +=
            bytes[index]
                .toString(16)
                .padStart(2, "0");

    }


    return hex;

}


async function sha256Hex(
    text
) {

    const data =
        new TextEncoder()
            .encode(
                text
            );


    const digest =
        await getSubtle()
            .digest(
                "SHA-256",
                data
            );


    return toHex(
        digest
    );

}


async function hmacSha256(
    keyBytes,
    text
) {

    const key =
        await getSubtle()
            .importKey(
                "raw",
                keyBytes,
                {
                    name:
                        "HMAC",
                    hash:
                        "SHA-256"
                },
                false,
                [
                    "sign"
                ]
            );


    const signature =
        await getSubtle()
            .sign(
                "HMAC",
                key,
                new TextEncoder()
                    .encode(
                        text
                    )
            );


    return new Uint8Array(
        signature
    );

}


/* =========================================================
   TC3 SIGNATURE
========================================================= */

/**
 * Membuat header Authorization TC3-HMAC-SHA256.
 *
 * @param {object} options
 * @param {string} options.secretId
 * @param {string} options.secretKey
 * @param {string} options.host
 * @param {string} options.action      contoh: "ImageToImage"
 * @param {string} options.payload     body JSON sebagai string
 * @param {number} [options.timestamp] detik UNIX
 * @param {string} [options.contentType]
 * @returns {Promise<{authorization: string, timestamp: number, date: string}>}
 */
async function signTc3({
    secretId,
    secretKey,
    host,
    action,
    payload,
    timestamp = Math.floor(Date.now() / 1000),
    contentType = "application/json; charset=utf-8",
    service = SERVICE
}) {

    /*
       Tanggal harus dalam UTC, format YYYY-MM-DD.
    */

    const date =
        new Date(
            timestamp * 1000
        )
            .toISOString()
            .slice(
                0,
                10
            );


    const hashedPayload =
        await sha256Hex(
            payload
        );


    /*
       Canonical headers WAJIB huruf kecil dan diurutkan:
       content-type, host, x-tc-action
    */

    const canonicalHeaders =
        `content-type:${contentType}\n`
        + `host:${host}\n`
        + `x-tc-action:${String(action).toLowerCase()}\n`;


    const signedHeaders =
        "content-type;host;x-tc-action";


    const canonicalRequest =
        `POST\n`
        + `/\n`
        + `\n`
        + `${canonicalHeaders}\n`
        + `${signedHeaders}\n`
        + `${hashedPayload}`;


    const credentialScope =
        `${date}/${service}/tc3_request`;


    const stringToSign =
        `TC3-HMAC-SHA256\n`
        + `${timestamp}\n`
        + `${credentialScope}\n`
        + `${await sha256Hex(canonicalRequest)}`;


    const encoder =
        new TextEncoder();


    const secretDate =
        await hmacSha256(
            encoder.encode(
                `TC3${secretKey}`
            ),
            date
        );


    const secretService =
        await hmacSha256(
            secretDate,
            service
        );


    const secretSigning =
        await hmacSha256(
            secretService,
            "tc3_request"
        );


    const signature =
        toHex(
            await hmacSha256(
                secretSigning,
                stringToSign
            )
        );


    return {
        authorization:
            "TC3-HMAC-SHA256 "
            + `Credential=${secretId}/${credentialScope}, `
            + `SignedHeaders=${signedHeaders}, `
            + `Signature=${signature}`,
        timestamp,
        date
    };

}


/* =========================================================
   ERROR NORMALIZATION
========================================================= */

/*
   Kode error Tencent → pesan yang menyebut apa yang harus diperbaiki.
   Kode di luar daftar tetap diteruskan apa adanya supaya tidak ada
   klaim yang tidak berdasar.
*/

const ERROR_HINTS = Object.freeze({

    "AuthFailure.SignatureFailure":
        "SecretKey salah atau tidak cocok dengan SecretId yang dipakai.",

    "AuthFailure.SecretIdNotFound":
        "SecretId tidak ditemukan. Periksa pasangan kunci di Admin → Providers.",

    "AuthFailure.SignatureExpire":
        "Jam server berbeda terlalu jauh dengan Tencent. Coba lagi beberapa saat lagi.",

    "AuthFailure.UnauthorizedOperation":
        "Akun ini belum diberi izin memakai AI Art. Aktifkan produk AI Art di console Tencent Cloud.",

    "AuthFailure.InvalidSecretId":
        "SecretId tidak valid untuk produk AI Art.",

    "UnauthorizedOperation.ServiceNotActivated":
        "Produk AI Art belum diaktifkan pada akun Tencent Cloud ini.",

    "UnsupportedOperation":
        "Region atau operasi tidak didukung. Coba region ap-guangzhou atau ap-shanghai.",

    "FailedOperation.ImageDownloadError":
        "Tencent gagal mengunduh foto acuan. Coba unggah ulang fotonya.",

    "FailedOperation.ImageResolutionTooSmall":
        "Foto acuan terlalu kecil. Sisi terpendek minimal 50 px.",

    "FailedOperation.ImageSizeTooLarge":
        "Foto acuan terlalu besar (maksimal 8 MB setelah base64). Unggah foto yang lebih kecil.",

    "FailedOperation.ImageDecodeFailed":
        "Foto acuan tidak bisa dibaca. Gunakan JPG, PNG, atau WebP yang valid.",

    /*
       Kuota gratis AI Art (50 gambar, berlaku 1 tahun)
       habis atau layanan belum diaktifkan. Tencent TIDAK
       otomatis pindah ke tagihan berbayar, jadi request
       memang gagal — bukan bug GEN-Z.AI.
    */

    "FailedOperation.ArrearsError":
        "Kuota gratis AI Art habis atau tagihan akun belum beres. Tencent tidak otomatis memakai mode berbayar, jadi gambar berikutnya gagal sampai kuota/tagihan dibereskan.",

    "FailedOperation.AccountInArrears":
        "Tagihan Tencent Cloud akun ini belum beres, jadi AI Art menolak permintaan.",

    "ResourceUnavailable.InArrears":
        "Tagihan Tencent Cloud akun ini belum beres, jadi AI Art menolak permintaan.",

    "FailedOperation.ServiceNotOpened":
        "Produk AI Art belum dibuka di console Tencent Cloud. Buka 混元生图 → 立即使用 lalu klaim paket gratis.",

    "LimitExceeded":
        "Kuota/batas pemakaian AI Art akun ini tercapai (kuota gratis 50 gambar per akun; setelah habis Tencent tidak otomatis beralih ke berbayar).",

    "RequestLimitExceeded":
        "Terlalu banyak permintaan sekaligus (AI Art membatasi 3 tugas paralel). Coba lagi sebentar.",

    "ResourceUnavailable":
        "Layanan AI Art sedang tidak tersedia. Coba lagi.",

    "InternalError":
        "Kesalahan internal Tencent. Coba lagi."

});


function createProviderError(
    code,
    message,
    {
        requestId = "",
        status = 0,
        raw = null
    } = {}
) {

    const hint =
        ERROR_HINTS[
            code
        ] ||
        "";


    const error = new Error(
        hint
            ? `${message || code} — ${hint}`
            : (message || code || "Tencent AI Art menolak permintaan.")
    );


    error.code =
        code ||
        "TENCENT_AIART_ERROR";


    error.provider =
        PROVIDER_ID;

    error.providerCode =
        code ||
        "";

    error.requestId =
        requestId ||
        "";

    error.status =
        status ||
        502;

    error.providerResponse =
        raw;


    return error;

}


/* =========================================================
   REQUEST
========================================================= */

/**
 * Memanggil satu aksi Tencent Cloud AI Art.
 *
 * @param {object} options
 * @param {string} options.action
 * @param {object} options.payload
 * @param {string} options.apiKey  kredensial mentah (SecretId + SecretKey)
 * @param {string} [options.region]
 * @param {number} [options.timeoutMs]
 * @param {Function} [options.fetchImpl] untuk pengujian
 * @returns {Promise<object>} `Response` dari Tencent
 */
async function request({
    action,
    payload,
    apiKey,
    region,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl
}) {

    const credential =
        parseCredential(
            apiKey
        );


    const resolvedRegion =
        region ||
        credential.region ||
        resolveRegion();


    const host =
        getHost();


    const body =
        JSON.stringify(
            payload ||
            {}
        );


    const signed =
        await signTc3({
            secretId:
                credential.secretId,
            secretKey:
                credential.secretKey,
            host,
            action,
            payload:
                body
        });


    const doFetch =
        fetchImpl ||
        globalThis.fetch;


    if (
        typeof doFetch !==
        "function"
    ) {

        throw new Error(
            "fetch tidak tersedia untuk memanggil Tencent AI Art."
        );

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
                Math.max(
                    5000,
                    Number(
                        timeoutMs
                    ) ||
                    DEFAULT_TIMEOUT_MS
                )
            )
            : null;


    let response;

    let text =
        "";


    try {

        response =
            await doFetch(
                `https://${host}/`,
                {
                    method:
                        "POST",
                    headers: {
                        "Authorization":
                            signed.authorization,
                        "Content-Type":
                            "application/json; charset=utf-8",
                        "Host":
                            host,
                        "X-TC-Action":
                            action,
                        "X-TC-Version":
                            API_VERSION,
                        "X-TC-Timestamp":
                            String(
                                signed.timestamp
                            ),
                        "X-TC-Region":
                            resolvedRegion
                    },
                    body,
                    signal:
                        controller
                            ? controller.signal
                            : undefined
                }
            );


        text =
            await response.text();

    } catch (
        error
    ) {

        if (
            error?.name ===
            "AbortError"
        ) {

            const timeout = new Error(
                `Tencent AI Art tidak menjawab dalam ${Math.round((Number(timeoutMs) || DEFAULT_TIMEOUT_MS) / 1000)} detik.`
            );

            timeout.code =
                "TENCENT_AIART_TIMEOUT";

            timeout.status =
                504;

            throw timeout;

        }


        const failure = new Error(
            `Gagal menghubungi Tencent AI Art: ${error?.message || "jaringan error"}`
        );

        failure.code =
            "TENCENT_AIART_NETWORK";

        failure.status =
            502;

        throw failure;

    } finally {

        if (
            timer
        ) {

            clearTimeout(
                timer
            );

        }

    }


    let parsed =
        null;


    try {

        parsed =
            text
                ? JSON.parse(
                    text
                )
                : null;

    } catch (
        error
    ) {

        throw createProviderError(
            "TENCENT_AIART_INVALID_JSON",
            `Tencent AI Art mengembalikan respons yang tidak bisa dibaca (HTTP ${response?.status || 0}).`,
            {
                status:
                    502,
                raw:
                    text.slice(
                        0,
                        500
                    )
            }
        );

    }


    const providerError =
        parsed?.Response
            ?.Error;


    if (
        providerError
    ) {

        throw createProviderError(
            providerError.Code ||
            "TENCENT_AIART_ERROR",
            providerError.Message ||
            "",
            {
                requestId:
                    parsed?.Response?.RequestId ||
                    "",
                status:
                    response?.status &&
                    response.status >= 400
                        ? response.status
                        : 502,
                raw:
                    parsed?.Response ||
                    parsed
            }
        );

    }


    if (
        !response?.ok
    ) {

        throw createProviderError(
            "TENCENT_AIART_HTTP_ERROR",
            `Tencent AI Art membalas HTTP ${response?.status || 0} tanpa detail error.`,
            {
                requestId:
                    parsed?.Response?.RequestId ||
                    "",
                status:
                    502,
                raw:
                    parsed?.Response ||
                    parsed
            }
        );

    }


    return parsed?.Response || {};

}


/* =========================================================
   IMAGE TO IMAGE
========================================================= */

/**
 * Foto → gambar bergaya AI (default 201: 日系动漫 / anime Jepang).
 *
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} [options.inputImageBase64]
 * @param {string} [options.inputUrl]
 * @param {string} [options.prompt]
 * @param {string} [options.negativePrompt]
 * @param {string[]} [options.styles]
 * @param {string} [options.resolution] "origin" | "768:768" | "768:1024" | "1024:768"
 * @param {number} [options.strength]
 * @param {boolean} [options.logoAdd]
 * @param {number} [options.restoreFace]
 * @param {boolean} [options.enhanceImage]
 * @param {"base64"|"url"} [options.responseType]
 * @param {string} [options.region]
 * @param {Function} [options.fetchImpl]
 */
async function imageToImage({
    apiKey,
    inputImageBase64 = "",
    inputUrl = "",
    prompt = "",
    negativePrompt = "",
    styles = [],
    resolution = "",
    strength = null,
    logoAdd = false,
    restoreFace = 0,
    enhanceImage = false,
    responseType = "base64",
    region,
    fetchImpl,
    timeoutMs
} = {}) {

    if (
        !inputImageBase64 &&
        !inputUrl
    ) {

        const error = new Error(
            "Foto acuan wajib dikirim ke Tencent AI Art."
        );

        error.code =
            "MISSING_INPUT_IMAGE";

        throw error;

    }


    const payload = {};


    if (
        inputUrl
    ) {

        /*
           Url diprioritaskan Tencent bila keduanya dikirim,
           jadi hanya salah satu yang diisi.
        */

        payload.InputUrl =
            String(
                inputUrl
            ).trim();

    } else {

        payload.InputImage =
            String(
                inputImageBase64
            );

    }


    const cleanPrompt =
        String(
            prompt ||
            ""
        )
            .trim()
            .slice(
                0,
                256
            );


    if (
        cleanPrompt
    ) {

        payload.Prompt =
            cleanPrompt;

    }


    const cleanNegative =
        String(
            negativePrompt ||
            ""
        )
            .trim()
            .slice(
                0,
                256
            );


    if (
        cleanNegative
    ) {

        payload.NegativePrompt =
            cleanNegative;

    }


    const styleList =
        (
            Array.isArray(
                styles
            )
                ? styles
                : []
        )
            .map(
                item =>
                    String(
                        item
                    ).trim()
            )
            .filter(
                Boolean
            )
            .slice(
                0,
                1
            );


    if (
        styleList.length
    ) {

        payload.Styles =
            styleList;

    }


    /*
       Hanya nilai yang didukung dokumentasi yang diteruskan.
    */

    const allowedResolutions =
        new Set(
            [
                "origin",
                "768:768",
                "768:1024",
                "1024:768"
            ]
        );


    const cleanResolution =
        String(
            resolution ||
            ""
        ).trim();


    if (
        allowedResolutions.has(
            cleanResolution
        )
    ) {

        payload.ResultConfig = {
            Resolution:
                cleanResolution
        };

    }


    const numericStrength =
        Number(
            strength
        );


    if (
        Number.isFinite(
            numericStrength
        ) &&
        numericStrength > 0 &&
        numericStrength <= 1
    ) {

        payload.Strength =
            numericStrength;

    }


    payload.LogoAdd =
        logoAdd
            ? 1
            : 0;


    const faceCount =
        Math.max(
            0,
            Math.min(
                6,
                Math.round(
                    Number(
                        restoreFace
                    ) ||
                    0
                )
            )
        );


    if (
        faceCount > 0
    ) {

        payload.RestoreFace =
            faceCount;

    }


    if (
        enhanceImage
    ) {

        payload.EnhanceImage =
            1;

    }


    payload.RspImgType =
        responseType === "url"
            ? "url"
            : "base64";


    return request({
        action:
            "ImageToImage",
        payload,
        apiKey,
        region,
        fetchImpl,
        timeoutMs
    });

}


/* =========================================================
   EXPORTS
========================================================= */

export {
    PROVIDER_ID,
    PROVIDER_NAME,
    API_VERSION,
    DEFAULT_REGION,
    DEFAULT_HOST,
    parseCredential,
    signTc3,
    request,
    imageToImage,
    createProviderError,
    sha256Hex
};


export default {

    providerId:
        PROVIDER_ID,

    providerName:
        PROVIDER_NAME,

    parseCredential,

    signTc3,

    request,

    imageToImage

};
