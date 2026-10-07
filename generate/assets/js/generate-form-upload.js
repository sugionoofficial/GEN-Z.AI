"use strict";

/* =========================================================
   GEN-Z.AI
   GENERATE FORM UPLOAD
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-upload.js

   Fungsi:
   - Image upload validation
   - Image storage path
   - Image upload ke Supabase
   - Audio upload validation
   - Audio storage path
   - Audio upload ke Supabase

   Catatan:
   - Tidak mengubah file asli
   - Tidak mengubah format media
   - Tidak menghitung credit
   - Tidak mengubah payload provider
========================================================= */

import {
    getCurrentUser,
    getSupabaseClient
} from "./generate-state.js";


/* =========================================================
   CONFIGURATION
========================================================= */

const STORAGE_BUCKET = "dashboard-videos";

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const MAX_IMAGE_SIZE =
    10 * 1024 * 1024;


const ALLOWED_AUDIO_TYPES = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/x-pn-wav"
]);

const MAX_AUDIO_SIZE =
    50 * 1024 * 1024;


/* =========================================================
   RANDOM PART
========================================================= */

function createRandomPart() {

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}


/* =========================================================
   SAFE USER ID
========================================================= */

function normalizeUserId(userId) {

    return String(userId || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_");
}


/* =========================================================
   FILE EXTENSION
========================================================= */

function getFileExtension(file, fallback = "bin") {

    const name =
        String(file?.name || "")
            .trim();

    const match =
        name.match(/\.([a-zA-Z0-9]+)$/);

    if (match?.[1]) {

        return match[1]
            .toLowerCase();

    }

    const type =
        String(file?.type || "")
            .toLowerCase();

    if (type === "image/jpeg") {
        return "jpg";
    }

    if (type === "image/png") {
        return "png";
    }

    if (type === "image/webp") {
        return "webp";
    }

    if (
        type === "audio/mpeg" ||
        type === "audio/mp3"
    ) {
        return "mp3";
    }

    if (
        type === "audio/wav" ||
        type === "audio/x-wav" ||
        type === "audio/wave" ||
        type === "audio/x-pn-wav"
    ) {
        return "wav";
    }

    return fallback;
}


/* =========================================================
   IMAGE STORAGE PATH
========================================================= */

export function createImageStoragePath(
    userId,
    file
) {

    const safeUserId =
        normalizeUserId(userId);

    const extension =
        getFileExtension(
            file,
            "jpg"
        );

    const randomPart =
        createRandomPart();

    return (
        `generate-input/` +
        `${safeUserId}/` +
        `${randomPart}.` +
        `${extension}`
    );
}


/* =========================================================
   IMAGE VALIDATION
========================================================= */

export function validateImageFile(
    file
) {

    if (!file) {

        throw new Error(
            "File gambar tidak ditemukan."
        );

    }

    const type =
        String(file.type || "")
            .toLowerCase();

    if (
        !ALLOWED_IMAGE_TYPES.has(type)
    ) {

        throw new Error(
            "Format gambar tidak didukung. " +
            "Gunakan JPG, PNG, atau WEBP."
        );

    }

    if (
        Number(file.size || 0) >
        MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Ukuran gambar terlalu besar. " +
            "Maksimal 10 MB."
        );

    }

    return true;
}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

export async function uploadImageFile(
    file
) {

    validateImageFile(file);

    const supabase =
        getSupabaseClient();

    if (!supabase) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }

    const user =
        getCurrentUser();

    if (!user?.id) {

        throw new Error(
            "User belum terautentikasi."
        );

    }

    const path =
        createImageStoragePath(
            user.id,
            file
        );

    const {
        error
    } =
        await supabase
            .storage
            .from(STORAGE_BUCKET)
            .upload(
                path,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType:
                        file.type
                }
            );

    if (error) {

        throw new Error(
            error.message ||
            "Gagal mengupload gambar."
        );

    }

    const {
        data
    } =
        supabase
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(path);

    const url =
        data?.publicUrl || "";

    if (!url) {

        throw new Error(
            "URL gambar hasil upload tidak tersedia."
        );

    }

    return {
        path,
        url
    };
}


/* =========================================================
   AUDIO STORAGE PATH
========================================================= */

export function createAudioStoragePath(
    userId,
    file
) {

    const safeUserId =
        normalizeUserId(userId);

    let extension =
        getFileExtension(
            file,
            "mp3"
        );

    if (
        extension === "mpeg"
    ) {

        extension = "mp3";

    }

    const randomPart =
        createRandomPart();

    return (
        `generate-input/` +
        `${safeUserId}/` +
        `audio-${randomPart}.` +
        `${extension}`
    );
}


/* =========================================================
   AUDIO VALIDATION
========================================================= */

export function validateAudioFile(
    file
) {

    if (!file) {

        throw new Error(
            "File audio tidak ditemukan."
        );

    }

    const type =
        String(file.type || "")
            .toLowerCase();

    const name =
        String(file.name || "")
            .toLowerCase();

    const extensionAllowed =
        name.endsWith(".mp3") ||
        name.endsWith(".wav");

    if (
        !ALLOWED_AUDIO_TYPES.has(type) &&
        !extensionAllowed
    ) {

        throw new Error(
            "Format audio tidak didukung. " +
            "Gunakan MP3 atau WAV."
        );

    }

    if (
        Number(file.size || 0) >
        MAX_AUDIO_SIZE
    ) {

        throw new Error(
            "Ukuran audio terlalu besar. " +
            "Maksimal 50 MB."
        );

    }

    return true;
}


/* =========================================================
   AUDIO UPLOAD
========================================================= */

export async function uploadAudioFile(
    file
) {

    validateAudioFile(file);

    const supabase =
        getSupabaseClient();

    if (!supabase) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }

    const user =
        getCurrentUser();

    if (!user?.id) {

        throw new Error(
            "User belum terautentikasi."
        );

    }

    const path =
        createAudioStoragePath(
            user.id,
            file
        );

    let contentType =
        String(file.type || "")
            .trim()
            .toLowerCase();

    if (!contentType) {

        if (
            String(file.name || "")
                .toLowerCase()
                .endsWith(".wav")
        ) {

            contentType =
                "audio/wav";

        } else {

            contentType =
                "audio/mpeg";

        }

    }

    const {
        error
    } =
        await supabase
            .storage
            .from(STORAGE_BUCKET)
            .upload(
                path,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType
                }
            );

    if (error) {

        throw new Error(
            error.message ||
            "Gagal mengupload audio."
        );

    }

    const {
        data
    } =
        supabase
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(path);

    const url =
        data?.publicUrl || "";

    if (!url) {

        throw new Error(
            "URL audio hasil upload tidak tersedia."
        );

    }

    return {
        path,
        url
    };
}


/* =========================================================
   PUBLIC API
========================================================= */

export const GenerateFormUpload =
    Object.freeze({

        createImageStoragePath,

        validateImageFile,

        uploadImageFile,

        createAudioStoragePath,

        validateAudioFile,

        uploadAudioFile

    });


export default GenerateFormUpload;
