/* =========================================================
   GEN-Z.AI
   GENERATE MEDIA
   ---------------------------------------------------------
   Media helper khusus Generate page.

   Fungsi:
   - Upload image / video / audio ke Supabase Storage
   - URL input
   - Multiple URL / multiple upload
   - Preview media
   - Validasi MIME type
   - Validasi ukuran file
   - Validasi durasi video/audio
   - Reuse bucket existing: dashboard-videos

   IMPORTANT:
   - Tidak membuat endpoint upload baru.
   - Tidak mengubah auth.
   - Tidak mengubah credit.
   - Tidak mengirim nsfw_checker.
========================================================= */

"use strict";


/* =========================================================
   CONSTANTS
========================================================= */

const STORAGE_BUCKET =
    "dashboard-videos";


/*
 * Ukuran maksimum mengikuti dokumentasi Seedance.
 *
 * Image  : 30 MB
 * Video  : 200 MB total
 * Audio  : 15 MB total
 *
 * Untuk single upload kita gunakan limit tersebut.
 */
const MAX_IMAGE_SIZE =
    30 * 1024 * 1024;

const MAX_VIDEO_SIZE =
    200 * 1024 * 1024;

const MAX_AUDIO_SIZE =
    15 * 1024 * 1024;


/*
 * Seedance:
 *
 * reference video total duration <= 30s
 * reference audio total duration <= 30s
 *
 * Frame image tidak memiliki batas durasi.
 */
const MAX_REFERENCE_VIDEO_DURATION =
    30;

const MAX_REFERENCE_AUDIO_DURATION =
    30;


/* =========================================================
   MIME TYPES
========================================================= */

const IMAGE_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);


const VIDEO_TYPES =
    new Set([
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/mpeg",
        "video/x-m4v"
    ]);


const AUDIO_TYPES =
    new Set([
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
        "audio/webm",
        "audio/x-m4a",
        "audio/m4a"
    ]);


/* =========================================================
   HELPERS
========================================================= */

function getSupabaseClient() {

    /*
     * Gunakan helper/state existing terlebih dahulu.
     */
    try {

        if (
            typeof window !== "undefined" &&
            window.supabaseClient
        ) {

            return window.supabaseClient;

        }

    } catch {
        /* ignore */
    }


    try {

        if (
            typeof window !== "undefined" &&
            window.GENZ_SUPABASE
        ) {

            return window.GENZ_SUPABASE;

        }

    } catch {
        /* ignore */
    }


    return null;

}


/* =========================================================
   CURRENT USER
========================================================= */

async function getCurrentUser() {

    const supabase =
        getSupabaseClient();


    if (
        !supabase ||
        !supabase.auth
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const result =
        await supabase.auth.getUser();


    if (
        result?.error
    ) {

        throw result.error;

    }


    const user =
        result?.data?.user;


    if (
        !user ||
        !user.id
    ) {

        throw new Error(
            "Sesi pengguna tidak ditemukan."
        );

    }


    return user;

}


/* =========================================================
   SAFE FILE NAME
========================================================= */

function sanitizeFileName(
    name
) {

    const original =
        String(
            name || "media"
        ).trim();


    const parts =
        original.split(".");


    const extension =
        parts.length > 1
            ? parts.pop()
            : "";


    const base =
        parts
            .join(".")
            .replace(
                /[^a-zA-Z0-9_-]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .slice(
                0,
                80
            );


    const safeBase =
        base ||
        "media";


    const safeExtension =
        extension
            ? extension
                .replace(
                    /[^a-zA-Z0-9]+/g,
                    ""
                )
                .slice(
                    0,
                    12
                )
            : "";


    return safeExtension
        ? `${safeBase}.${safeExtension}`
        : safeBase;

}


/* =========================================================
   RANDOM ID
========================================================= */

function randomId(
    length = 12
) {

    const chars =
        "abcdefghijklmnopqrstuvwxyz0123456789";


    let result =
        "";


    for (
        let i = 0;
        i < length;
        i++
    ) {

        result +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];

    }


    return result;

}


/* =========================================================
   STORAGE PATH
========================================================= */

function createStoragePath(
    userId,
    file
) {

    const safeName =
        sanitizeFileName(
            file?.name
        );


    const timestamp =
        Date.now();


    return [
        userId,
        "generate",
        timestamp,
        `${randomId(8)}-${safeName}`
    ].join("/");

}


/* =========================================================
   MEDIA TYPE
========================================================= */

function getMediaType(
    file
) {

    const mime =
        String(
            file?.type || ""
        )
            .toLowerCase()
            .trim();


    if (
        IMAGE_TYPES.has(mime)
    ) {

        return "image";

    }


    if (
        VIDEO_TYPES.has(mime)
    ) {

        return "video";

    }


    if (
        AUDIO_TYPES.has(mime)
    ) {

        return "audio";

    }


    return null;

}


/* =========================================================
   FILE SIZE LIMIT
========================================================= */

function getMaxFileSize(
    type
) {

    switch (type) {

        case "image":
            return MAX_IMAGE_SIZE;

        case "video":
            return MAX_VIDEO_SIZE;

        case "audio":
            return MAX_AUDIO_SIZE;

        default:
            return 0;

    }

}


/* =========================================================
   FORMAT SIZE
========================================================= */

function formatFileSize(
    bytes
) {

    const value =
        Number(bytes) || 0;


    if (
        value < 1024
    ) {

        return `${value} B`;

    }


    if (
        value < 1024 * 1024
    ) {

        return `${(
            value / 1024
        ).toFixed(1)} KB`;

    }


    if (
        value < 1024 * 1024 * 1024
    ) {

        return `${(
            value /
            (1024 * 1024)
        ).toFixed(1)} MB`;

    }


    return `${(
        value /
        (1024 * 1024 * 1024)
    ).toFixed(2)} GB`;

}


/* =========================================================
   VALIDATE FILE
========================================================= */

function validateFile(
    file,
    expectedType = null
) {

    if (
        !file
    ) {

        throw new Error(
            "File tidak ditemukan."
        );

    }


    const mediaType =
        getMediaType(file);


    if (
        !mediaType
    ) {

        throw new Error(
            `Format file tidak didukung: ${
                file.type ||
                "unknown"
            }`
        );

    }


    if (
        expectedType &&
        mediaType !== expectedType
    ) {

        throw new Error(
            `File harus berupa ${expectedType}.`
        );

    }


    const maxSize =
        getMaxFileSize(
            mediaType
        );


    if (
        maxSize > 0 &&
        file.size > maxSize
    ) {

        throw new Error(
            `Ukuran ${mediaType} terlalu besar. ` +
            `Maksimum ${formatFileSize(maxSize)}.`
        );

    }


    return {
        type: mediaType,
        size: file.size,
        mimeType: file.type || ""
    };

}


/* =========================================================
   READ MEDIA DURATION
========================================================= */

function getMediaDuration(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (
                !file
            ) {

                reject(
                    new Error(
                        "File media tidak tersedia."
                    )
                );

                return;

            }


            const type =
                getMediaType(file);


            if (
                type !== "video" &&
                type !== "audio"
            ) {

                resolve(null);

                return;

            }


            const objectUrl =
                URL.createObjectURL(
                    file
                );


            const media =
                document.createElement(
                    type
                );


            let settled =
                false;


            const cleanup =
                () => {

                    try {

                        URL.revokeObjectURL(
                            objectUrl
                        );

                    } catch {
                        /* ignore */
                    }

                    try {

                        media.removeAttribute(
                            "src"
                        );

                        media.load();

                    } catch {
                        /* ignore */
                    }

                };


            const finish =
                (
                    callback,
                    value
                ) => {

                    if (
                        settled
                    ) {

                        return;

                    }


                    settled =
                        true;


                    cleanup();


                    callback(
                        value
                    );

                };


            media.preload =
                "metadata";


            media.onloadedmetadata =
                () => {

                    const duration =
                        Number(
                            media.duration
                        );


                    if (
                        !Number.isFinite(
                            duration
                        ) ||
                        duration < 0
                    ) {

                        finish(
                            reject,
                            new Error(
                                "Durasi media tidak dapat dibaca."
                            )
                        );

                        return;

                    }


                    finish(
                        resolve,
                        duration
                    );

                };


            media.onerror =
                () => {

                    finish(
                        reject,
                        new Error(
                            "Media tidak dapat dibaca browser."
                        )
                    );

                };


            media.src =
                objectUrl;

        }
    );

}


/* =========================================================
   VALIDATE REFERENCE MEDIA
========================================================= */

async function validateReferenceMedia(
    file,
    expectedType
) {

    const info =
        validateFile(
            file,
            expectedType
        );


    if (
        info.type === "video"
    ) {

        const duration =
            await getMediaDuration(
                file
            );


        if (
            duration >
            MAX_REFERENCE_VIDEO_DURATION
        ) {

            throw new Error(
                `Video referensi maksimal ` +
                `${MAX_REFERENCE_VIDEO_DURATION} detik. ` +
                `Durasi file: ${duration.toFixed(2)} detik.`
            );

        }


        return {
            ...info,
            duration
        };

    }


    if (
        info.type === "audio"
    ) {

        const duration =
            await getMediaDuration(
                file
            );


        if (
            duration >
            MAX_REFERENCE_AUDIO_DURATION
        ) {

            throw new Error(
                `Audio referensi maksimal ` +
                `${MAX_REFERENCE_AUDIO_DURATION} detik. ` +
                `Durasi file: ${duration.toFixed(2)} detik.`
            );

        }


        return {
            ...info,
            duration
        };

    }


    return info;

}


/* =========================================================
   UPLOAD FILE
========================================================= */

async function uploadFile(
    file,
    options = {}
) {

    const expectedType =
        options?.expectedType ||
        null;


    const validation =
        await validateReferenceMedia(
            file,
            expectedType
        );


    const supabase =
        getSupabaseClient();


    if (
        !supabase
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const user =
        await getCurrentUser();


    const path =
        createStoragePath(
            user.id,
            file
        );


    const uploadResult =
        await supabase
            .storage
            .from(
                STORAGE_BUCKET
            )
            .upload(
                path,
                file,
                {
                    cacheControl:
                        "3600",

                    upsert:
                        false,

                    contentType:
                        file.type ||
                        "application/octet-stream"
                }
            );


    if (
        uploadResult?.error
    ) {

        throw uploadResult.error;

    }


    const publicResult =
        supabase
            .storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        publicResult
            ?.data
            ?.publicUrl ||
        "";


    if (
        !publicUrl
    ) {

        throw new Error(
            "URL media berhasil dibuat tetapi URL publik kosong."
        );

    }


    return {

        url:
            publicUrl,

        path,

        name:
            file.name,

        type:
            validation.type,

        mimeType:
            validation.mimeType,

        size:
            validation.size,

        duration:
            validation.duration ??
            null

    };

}


/* =========================================================
   UPLOAD MULTIPLE FILES
========================================================= */

async function uploadFiles(
    files,
    options = {}
) {

    const list =
        Array.from(
            files || []
        );


    if (
        list.length === 0
    ) {

        return [];

    }


    const results =
        [];


    for (
        const file of list
    ) {

        const result =
            await uploadFile(
                file,
                options
            );


        results.push(
            result
        );

    }


    return results;

}


/* =========================================================
   URL VALIDATION
========================================================= */

function normalizeUrl(
    value
) {

    const url =
        String(
            value || ""
        ).trim();


    if (
        !url
    ) {

        return "";

    }


    let parsed;


    try {

        parsed =
            new URL(
                url
            );

    } catch {

        throw new Error(
            `URL media tidak valid: ${url}`
        );

    }


    if (
        parsed.protocol !==
            "http:" &&
        parsed.protocol !==
            "https:"
    ) {

        throw new Error(
            "URL media harus menggunakan HTTP atau HTTPS."
        );

    }


    return parsed.toString();

}


/* =========================================================
   NORMALIZE URL LIST
========================================================= */

function normalizeUrlList(
    values
) {

    const source =
        Array.isArray(values)
            ? values
            : String(
                values || ""
            )
                .split(/\r?\n/);


    const result =
        [];


    for (
        const value of source
    ) {

        const normalized =
            normalizeUrl(
                value
            );


        if (
            normalized &&
            !result.includes(
                normalized
            )
        ) {

            result.push(
                normalized
            );

        }

    }


    return result;

}


/* =========================================================
   URL OR FILE
========================================================= */

async function resolveMedia(
    value,
    options = {}
) {

    /*
     * File langsung.
     */
    if (
        value instanceof File
    ) {

        const uploaded =
            await uploadFile(
                value,
                options
            );


        return uploaded.url;

    }


    /*
     * URL/string.
     */
    return normalizeUrl(
        value
    );

}


/* =========================================================
   URL OR FILE LIST
========================================================= */

async function resolveMediaList(
    values,
    options = {}
) {

    const source =
        Array.isArray(values)
            ? values
            : [];


    const urls =
        [];


    for (
        const value of source
    ) {

        if (
            value instanceof File
        ) {

            const uploaded =
                await uploadFile(
                    value,
                    options
                );


            urls.push(
                uploaded.url
            );

            continue;

        }


        const url =
            normalizeUrl(
                value
            );


        if (
            url &&
            !urls.includes(
                url
            )
        ) {

            urls.push(
                url
            );

        }

    }


    return urls;

}


/* =========================================================
   CREATE PREVIEW URL
========================================================= */

function createPreviewUrl(
    file
) {

    if (
        !file
    ) {

        return "";

    }


    try {

        return URL.createObjectURL(
            file
        );

    } catch {

        return "";

    }

}


/* =========================================================
   RELEASE PREVIEW URL
========================================================= */

function releasePreviewUrl(
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
        /* ignore */
    }

}


/* =========================================================
   CREATE MEDIA PREVIEW
========================================================= */

function createPreviewElement(
    file,
    options = {}
) {

    if (
        !file
    ) {

        return null;

    }


    const type =
        getMediaType(
            file
        );


    const url =
        createPreviewUrl(
            file
        );


    if (
        !url
    ) {

        return null;

    }


    let element =
        null;


    if (
        type === "image"
    ) {

        element =
            document.createElement(
                "img"
            );

        element.alt =
            options.alt ||
            "Preview";


        element.loading =
            "lazy";

    }


    else if (
        type === "video"
    ) {

        element =
            document.createElement(
                "video"
            );

        element.controls =
            true;

        element.preload =
            "metadata";

    }


    else if (
        type === "audio"
    ) {

        element =
            document.createElement(
                "audio"
            );

        element.controls =
            true;

    }


    if (
        !element
    ) {

        releasePreviewUrl(
            url
        );

        return null;

    }


    element.src =
        url;


    element.dataset.previewUrl =
        url;


    if (
        options.className
    ) {

        element.className =
            options.className;

    }


    /*
     * Cleanup otomatis jika element
     * dilepas dari DOM.
     */
    const cleanup =
        () => {

            const previewUrl =
                element.dataset.previewUrl;


            if (
                previewUrl
            ) {

                releasePreviewUrl(
                    previewUrl
                );

                delete element.dataset
                    .previewUrl;

            }

        };


    element.cleanupPreview =
        cleanup;


    return element;

}


/* =========================================================
   CREATE URL PREVIEW
========================================================= */

function createUrlPreviewElement(
    url,
    type,
    options = {}
) {

    const normalized =
        normalizeUrl(
            url
        );


    if (
        !normalized
    ) {

        return null;

    }


    let element =
        null;


    if (
        type === "image"
    ) {

        element =
            document.createElement(
                "img"
            );

        element.alt =
            options.alt ||
            "Preview";

        element.loading =
            "lazy";

    }


    else if (
        type === "video"
    ) {

        element =
            document.createElement(
                "video"
            );

        element.controls =
            true;

        element.preload =
            "metadata";

    }


    else if (
        type === "audio"
    ) {

        element =
            document.createElement(
                "audio"
            );

        element.controls =
            true;

    }


    if (
        !element
    ) {

        return null;

    }


    element.src =
        normalized;


    if (
        options.className
    ) {

        element.className =
            options.className;

    }


    return element;

}


/* =========================================================
   CREATE FILE INPUT
========================================================= */

function createFileInput(
    options = {}
) {

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "file";


    if (
        options.accept
    ) {

        input.accept =
            options.accept;

    }


    if (
        options.multiple
    ) {

        input.multiple =
            true;

    }


    if (
        options.capture
    ) {

        input.capture =
            options.capture;

    }


    return input;

}


/* =========================================================
   ACCEPT STRING
========================================================= */

function getAcceptForType(
    type
) {

    switch (type) {

        case "image":
            return "image/jpeg,image/png,image/webp";

        case "video":
            return "video/mp4,video/quicktime,video/webm";

        case "audio":
            return [
                "audio/mpeg",
                "audio/mp4",
                "audio/wav",
                "audio/aac",
                "audio/ogg",
                "audio/webm"
            ].join(",");

        default:
            return "";

    }

}


/* =========================================================
   VALIDATE TOTAL SIZE
========================================================= */

function validateTotalSize(
    files,
    type
) {

    const list =
        Array.from(
            files || []
        );


    const total =
        list.reduce(
            (
                sum,
                file
            ) =>
                sum +
                (
                    Number(
                        file?.size
                    ) || 0
                ),
            0
        );


    let max =
        0;


    if (
        type === "image"
    ) {

        max =
            MAX_IMAGE_SIZE;

    }

    else if (
        type === "video"
    ) {

        max =
            MAX_VIDEO_SIZE;

    }

    else if (
        type === "audio"
    ) {

        max =
            MAX_AUDIO_SIZE;

    }


    if (
        max > 0 &&
        total > max
    ) {

        throw new Error(
            `Total ukuran ${type} terlalu besar. ` +
            `Maksimum ${formatFileSize(max)}.`
        );

    }


    return {
        total,
        max
    };

}


/* =========================================================
   VALIDATE TOTAL DURATION
========================================================= */

async function validateTotalDuration(
    files,
    type
) {

    const list =
        Array.from(
            files || []
        );


    if (
        type !== "video" &&
        type !== "audio"
    ) {

        return 0;

    }


    let total =
        0;


    for (
        const file of list
    ) {

        const duration =
            await getMediaDuration(
                file
            );


        total +=
            Number(
                duration
            ) || 0;

    }


    const max =
        type === "video"
            ? MAX_REFERENCE_VIDEO_DURATION
            : MAX_REFERENCE_AUDIO_DURATION;


    if (
        total > max
    ) {

        throw new Error(
            `Total durasi ${type} referensi ` +
            `maksimal ${max} detik. ` +
            `Total: ${total.toFixed(2)} detik.`
        );

    }


    return total;

}


/* =========================================================
   EXPORT
========================================================= */

const mediaModule = {

    STORAGE_BUCKET,

    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
    MAX_AUDIO_SIZE,

    MAX_REFERENCE_VIDEO_DURATION,
    MAX_REFERENCE_AUDIO_DURATION,

    IMAGE_TYPES,
    VIDEO_TYPES,
    AUDIO_TYPES,

    getSupabaseClient,
    getCurrentUser,

    getMediaType,
    getMaxFileSize,
    formatFileSize,

    sanitizeFileName,
    createStoragePath,

    validateFile,
    getMediaDuration,
    validateReferenceMedia,

    uploadFile,
    uploadFiles,

    normalizeUrl,
    normalizeUrlList,

    resolveMedia,
    resolveMediaList,

    createPreviewUrl,
    releasePreviewUrl,

    createPreviewElement,
    createUrlPreviewElement,

    createFileInput,
    getAcceptForType,

    validateTotalSize,
    validateTotalDuration

};


export default Object.freeze(
    mediaModule
);


export {

    STORAGE_BUCKET,

    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
    MAX_AUDIO_SIZE,

    MAX_REFERENCE_VIDEO_DURATION,
    MAX_REFERENCE_AUDIO_DURATION,

    IMAGE_TYPES,
    VIDEO_TYPES,
    AUDIO_TYPES,

    getSupabaseClient,
    getCurrentUser,

    getMediaType,
    getMaxFileSize,
    formatFileSize,

    sanitizeFileName,
    createStoragePath,

    validateFile,
    getMediaDuration,
    validateReferenceMedia,

    uploadFile,
    uploadFiles,

    normalizeUrl,
    normalizeUrlList,

    resolveMedia,
    resolveMediaList,

    createPreviewUrl,
    releasePreviewUrl,

    createPreviewElement,
    createUrlPreviewElement,

    createFileInput,
    getAcceptForType,

    validateTotalSize,
    validateTotalDuration

};
