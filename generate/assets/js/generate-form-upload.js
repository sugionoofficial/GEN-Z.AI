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

export const STORAGE_BUCKET =
    "dashboard-videos";


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
        "audio/x-pn-wav"
    ]);


export const MAX_AUDIO_SIZE =
    50 * 1024 * 1024;


export const ALLOWED_VIDEO_TYPES =
    new Set([
        "video/mp4",
        "video/webm"
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
            "Format audio tidak didukung. Gunakan MP3 atau WAV."
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
            "Format video tidak didukung. Gunakan MP4 atau WebM."
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


    const publicResult =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            publicResult?.data?.publicUrl ||
            ""
        ).trim();


    if (
        !publicUrl
    ) {

        throw new Error(
            "Upload berhasil tetapi URL publik gambar tidak tersedia."
        );

    }


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload gambar berhasil:",
        publicUrl
    );


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


    const contentType =
        file.type ||
        (
            file.name
                .toLowerCase()
                .endsWith(
                    ".wav"
                )
                ? "audio/wav"
                : "audio/mpeg"
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


    const publicResult =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            publicResult?.data?.publicUrl ||
            ""
        ).trim();


    if (
        !publicUrl
    ) {

        throw new Error(
            "Upload berhasil tetapi URL publik audio tidak tersedia."
        );

    }


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload audio berhasil:",
        publicUrl
    );


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


    const contentType =
        file.type ||
        (
            file.name
                .toLowerCase()
                .endsWith(
                    ".webm"
                )
                ? "video/webm"
                : "video/mp4"
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


    const publicResult =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            publicResult?.data?.publicUrl ||
            ""
        ).trim();


    if (
        !publicUrl
    ) {

        throw new Error(
            "Upload berhasil tetapi URL publik video tidak tersedia."
        );

    }


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload video berhasil:",
        publicUrl
    );


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
