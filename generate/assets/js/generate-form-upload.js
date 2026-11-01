/* =========================================================
   GEN-Z.AI
   GENERATE FORM UPLOAD
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-upload.js

   Tanggung jawab:
   - Image storage path
   - Audio storage path
   - Video storage path
   - Image validation
   - Audio validation
   - Video validation
   - Supabase Storage upload image
   - Supabase Storage upload audio
   - Supabase Storage upload video

   Tidak menangani:
   - Field UI
   - Render form
   - Submit
   - Credit
   - Model state
========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

import {
    getCurrentUser,
    getSupabaseClient
} from "./generate-state.js";


/* =========================================================
   CONSTANTS
========================================================= */

/*
 * Upload user masuk ke bucket PRIVAT `user-uploads`.
 * URL yang dipakai provider / preview adalah SIGNED URL
 * berdurasi 1 jam (sama dengan masa retensi file).
 */
export const STORAGE_BUCKET =
    "user-uploads";


export const STORAGE_URL_TTL_SECONDS =
    60 * 60;

/* =========================================================
   SIGNED URL (BUCKET PRIVAT)
========================================================= */

async function createMediaUrl(
    supabase,
    path,
    label
) {

    const signedResult =
        await supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .createSignedUrl(
                path,
                STORAGE_URL_TTL_SECONDS
            );


    const signedUrl =
        String(
            signedResult?.data?.signedUrl ||
            ""
        ).trim();


    if (
        !signedUrl
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Signed URL gagal:",
            signedResult?.error
        );


        throw new Error(
            "Upload berhasil tetapi URL " +
            label +
            " tidak tersedia."
        );

    }


    /*
     * Beberapa versi SDK mengembalikan path relatif;
     * lengkapi dengan origin Supabase bila perlu.
     */

    if (
        signedUrl.startsWith(
            "http"
        )
    ) {

        return signedUrl;

    }


    return (
        String(
            supabase?.supabaseUrl ||
            ""
        ).replace(
            /\/+$/,
            ""
        ) +
        signedUrl
    );

}


function notifyStoredUploadsChanged(
    detail = {}
) {

    try {

        if (
            typeof globalThis?.dispatchEvent === "function" &&
            typeof Event === "function"
        ) {

            const evt =
                typeof CustomEvent === "function"
                    ? new CustomEvent(
                        "genz:stored-uploads-changed",
                        { detail }
                    )
                    : new Event(
                        "genz:stored-uploads-changed"
                    );

            globalThis.dispatchEvent(
                evt
            );
        }

    } catch {
        /* Abaikan pada runtime non-DOM */
    }

}



export const ALLOWED_IMAGE_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);


export const MAX_IMAGE_SIZE =
    10 * 1024 * 1024;


export const ALLOWED_AUDIO_TYPES =
    new Set([
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/x-pn-wav",
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
        "audio/aac",
        "audio/ogg",
        "audio/opus",
        "audio/flac",
        "audio/x-flac"
    ]);


export const MAX_AUDIO_SIZE =
    50 * 1024 * 1024;


export const ALLOWED_VIDEO_TYPES =
    new Set([
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-m4v"
    ]);


export const MAX_VIDEO_SIZE =
    200 * 1024 * 1024;


/* =========================================================
   RANDOM ID
========================================================= */

function createRandomPart() {

    if (
        typeof crypto !==
            "undefined" &&
        typeof crypto.randomUUID ===
            "function"
    ) {

        return crypto.randomUUID();

    }


    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 12)
    );

}


/* =========================================================
   IMAGE STORAGE PATH
========================================================= */

export function createImageStoragePath(
    userId,
    file
) {

    const safeUserId =
        String(
            userId ||
            "anonymous"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                ""
            );


    const originalName =
        String(
            file?.name ||
            "image"
        );


    const extensionMatch =
        originalName.match(
            /\.([a-zA-Z0-9]+)$/
        );


    const extension =
        extensionMatch
            ? extensionMatch[1]
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                )
            : "jpg";


    return (
        "generate-input/" +
        safeUserId +
        "/" +
        createRandomPart() +
        "." +
        extension
    );

}


/* =========================================================
   AUDIO STORAGE PATH
========================================================= */

export function createAudioStoragePath(
    userId,
    file
) {

    const safeUserId =
        String(
            userId ||
            "anonymous"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                ""
            );


    const originalName =
        String(
            file?.name ||
            "audio"
        );


    const extensionMatch =
        originalName.match(
            /\.([a-zA-Z0-9]+)$/
        );


    let extension =
        extensionMatch
            ? extensionMatch[1]
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                )
            : "mp3";


    if (
        extension ===
        "mpeg"
    ) {

        extension =
            "mp3";

    }


    return (
        "generate-input/" +
        safeUserId +
        "/audio-" +
        createRandomPart() +
        "." +
        extension
    );

}


/* =========================================================
   VIDEO STORAGE PATH
========================================================= */

export function createVideoStoragePath(
    userId,
    file
) {

    const safeUserId =
        String(
            userId ||
            "anonymous"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                ""
            );


    const originalName =
        String(
            file?.name ||
            "video"
        );


    const extensionMatch =
        originalName.match(
            /\.([a-zA-Z0-9]+)$/
        );


    let extension =
        extensionMatch
            ? extensionMatch[1]
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                )
            : "mp4";


    if (
        extension === "mov" ||
        extension === "m4v"
    ) {

        extension =
            "mp4";

    }


    return (
        "generate-input/" +
        safeUserId +
        "/video-" +
        createRandomPart() +
        "." +
        extension
    );

}


/* =========================================================
   IMAGE VALIDATION
========================================================= */

export function validateImageFile(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File gambar tidak ditemukan."
        );

    }


    if (
        !ALLOWED_IMAGE_TYPES.has(
            file.type
        )
    ) {

        throw new Error(
            "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP."
        );

    }


    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Ukuran gambar maksimal 10 MB."
        );

    }


    return true;

}


/* =========================================================
   AUDIO VALIDATION
========================================================= */

export function validateAudioFile(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File audio tidak ditemukan."
        );

    }


    const mimeType =
        String(
            file.type ||
            ""
        )
            .split(";")[0]
            .trim()
            .toLowerCase();


    const fileName =
        String(
            file.name ||
            ""
        )
            .trim()
            .toLowerCase();


    const extensionAllowed =
        fileName.endsWith(
            ".mp3"
        ) ||
        fileName.endsWith(
            ".wav"
        ) ||
        fileName.endsWith(
            ".m4a"
        ) ||
        fileName.endsWith(
            ".aac"
        ) ||
        fileName.endsWith(
            ".ogg"
        ) ||
        fileName.endsWith(
            ".opus"
        ) ||
        fileName.endsWith(
            ".flac"
        );


    const mimeAllowed =
        ALLOWED_AUDIO_TYPES.has(
            mimeType
        );


    if (
        !mimeAllowed &&
        !extensionAllowed
    ) {

        throw new Error(
            "Format audio tidak didukung. Gunakan MP3, WAV, M4A, AAC, OGG, atau FLAC."
        );

    }


    if (
        file.size >
        MAX_AUDIO_SIZE
    ) {

        throw new Error(
            "Ukuran audio maksimal 50 MB."
        );

    }


    return true;

}


/* =========================================================
   VIDEO VALIDATION
========================================================= */

export function validateVideoFile(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File video tidak ditemukan."
        );

    }


    const mimeType =
        String(
            file.type ||
            ""
        )
            .split(";")[0]
            .trim()
            .toLowerCase();


    const fileName =
        String(
            file.name ||
            ""
        )
            .trim()
            .toLowerCase();


    const extensionAllowed =
        fileName.endsWith(
            ".mp4"
        ) ||
        fileName.endsWith(
            ".mov"
        ) ||
        fileName.endsWith(
            ".m4v"
        ) ||
        fileName.endsWith(
            ".webm"
        );


    const mimeAllowed =
        ALLOWED_VIDEO_TYPES.has(
            mimeType
        );


    if (
        !mimeAllowed &&
        !extensionAllowed
    ) {

        throw new Error(
            "Format video tidak didukung. Gunakan MP4, MOV, atau WebM."
        );

    }


    if (
        file.size >
        MAX_VIDEO_SIZE
    ) {

        throw new Error(
            "Ukuran video maksimal 200 MB."
        );

    }


    return true;

}


/* =========================================================
   UPLOAD IMAGE
========================================================= */

export async function uploadImageFile(
    file
) {

    validateImageFile(
        file
    );


    const supabase =
        getSupabaseClient();


    if (
        !supabase ||
        !supabase.storage
    ) {

        throw new Error(
            "Supabase Storage belum tersedia."
        );

    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (
        !userId
    ) {

        throw new Error(
            "User belum terautentikasi untuk upload gambar."
        );

    }


    const path =
        createImageStoragePath(
            userId,
            file
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload gambar:",
        {
            bucket:
                STORAGE_BUCKET,

            path,

            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        }
    );


    const {
        error:
            uploadError
    } =
        await supabase.storage
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
                        file.type
                }
            );


    if (
        uploadError
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Upload gambar gagal:",
            uploadError
        );


        throw uploadError;

    }


    const publicUrl =
        await createMediaUrl(
            supabase,
            path,
            "gambar"
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload gambar berhasil:",
        publicUrl
    );


    notifyStoredUploadsChanged({
        kind:
            "image",
        path
    });


    return {
        path,
        url:
            publicUrl
    };

}


/* =========================================================
   UPLOAD AUDIO
========================================================= */

export async function uploadAudioFile(
    file
) {

    validateAudioFile(
        file
    );


    const supabase =
        getSupabaseClient();


    if (
        !supabase ||
        !supabase.storage
    ) {

        throw new Error(
            "Supabase Storage belum tersedia."
        );

    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (
        !userId
    ) {

        throw new Error(
            "User belum terautentikasi untuk upload audio."
        );

    }


    const path =
        createAudioStoragePath(
            userId,
            file
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload audio:",
        {
            bucket:
                STORAGE_BUCKET,

            path,

            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        }
    );


    const lowerAudioName =
        String(file.name || "").toLowerCase();
    const rawAudioMime =
        String(file.type || "").split(";")[0].trim().toLowerCase();
    const contentType =
        (rawAudioMime && ALLOWED_AUDIO_TYPES.has(rawAudioMime) ? rawAudioMime : "") ||
        (lowerAudioName.endsWith(".wav")
            ? "audio/wav"
            : lowerAudioName.endsWith(".m4a")
                ? "audio/mp4"
                : lowerAudioName.endsWith(".aac")
                    ? "audio/aac"
                    : lowerAudioName.endsWith(".ogg") || lowerAudioName.endsWith(".opus")
                        ? "audio/ogg"
                        : lowerAudioName.endsWith(".flac")
                            ? "audio/flac"
                            : "audio/mpeg");


    const {
        error:
            uploadError
    } =
        await supabase.storage
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

                    contentType
                }
            );


    if (
        uploadError
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Upload audio gagal:",
            uploadError
        );


        throw uploadError;

    }


    const publicUrl =
        await createMediaUrl(
            supabase,
            path,
            "audio"
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload audio berhasil:",
        publicUrl
    );


    notifyStoredUploadsChanged({
        kind:
            "audio",
        path
    });


    return {
        path,
        url:
            publicUrl
    };

}


/* =========================================================
   UPLOAD VIDEO
========================================================= */

export async function uploadVideoFile(
    file
) {

    validateVideoFile(
        file
    );


    const supabase =
        getSupabaseClient();


    if (
        !supabase ||
        !supabase.storage
    ) {

        throw new Error(
            "Supabase Storage belum tersedia."
        );

    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (
        !userId
    ) {

        throw new Error(
            "User belum terautentikasi untuk upload video."
        );

    }


    const path =
        createVideoStoragePath(
            userId,
            file
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload video:",
        {
            bucket:
                STORAGE_BUCKET,

            path,

            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        }
    );


    const lowerVideoName = String(file.name || "").toLowerCase();
    const rawVideoMime = String(file.type || "").split(";")[0].trim().toLowerCase();
    const contentType =
        (rawVideoMime && ALLOWED_VIDEO_TYPES.has(rawVideoMime) ? rawVideoMime : "") ||
        (lowerVideoName.endsWith(".webm")
            ? "video/webm"
            : lowerVideoName.endsWith(".mov")
                ? "video/quicktime"
                : lowerVideoName.endsWith(".m4v")
                    ? "video/x-m4v"
                    : "video/mp4");


    const {
        error:
            uploadError
    } =
        await supabase.storage
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

                    contentType
                }
            );


    if (
        uploadError
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Upload video gagal:",
            uploadError
        );


        throw uploadError;

    }


    const publicUrl =
        await createMediaUrl(
            supabase,
            path,
            "video"
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload video berhasil:",
        publicUrl
    );


    notifyStoredUploadsChanged({
        kind:
            "video",
        path
    });


    return {
        path,
        url:
            publicUrl
    };

}


/* =========================================================
   PUBLIC API
========================================================= */

export const GenerateFormUpload =
    Object.freeze({

        createImageStoragePath,

        createAudioStoragePath,

        createVideoStoragePath,

        validateImageFile,

        validateAudioFile,

        validateVideoFile,

        uploadImageFile,

        uploadAudioFile,

        uploadVideoFile

    });


export default GenerateFormUpload;
