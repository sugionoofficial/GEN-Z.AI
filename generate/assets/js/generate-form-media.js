/* =========================================================
   GEN-Z.AI
   GENERATE FORM MEDIA
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-media.js

   Tanggung jawab:
   - Image field
   - Audio field
   - Video field
   - URL / Upload mode
   - Preview image
   - Preview audio
   - Preview video
   - Delegasi validation
   - Delegasi upload
   - Menjaga compatibility dengan generate-form.js lama

   Patch UX:
   - Error upload tampil di UI (bukan hanya Console)
   - Indikator state upload (uploading / done / failed)
   - Race condition token untuk multi upload
   - aria-pressed pada tombol mode
   - role="status" aria-live untuk status upload
   - Clear dataset.uploadError saat sukses
========================================================= */

"use strict";

import {
    createFFmpegFilename,
    ensureFFmpeg,
    safeDeleteFFmpegFile
} from "../../../metadata-cleaner/assets/js/metadata-ffmpeg.js";

import {
    getCurrentUser,
    getSupabaseClient
} from "./generate-state.js";

import {
    createStoredUploadsPanel,
    formatStoredUploadRemaining
} from "./generate-stored-uploads.js?v=stored-uploads-20261026-20261030";


/* =========================================================
   DEBUG FLAG
========================================================= */

function isDebugEnabled() {

    return window.GENZ_DEBUG === true;

}


function debugLog(...args) {

    if (isDebugEnabled()) {

        console.debug(...args);

    }

}


/* =========================================================
   HANDLERS
========================================================= */

let imageUploadHandler = null;
let audioUploadHandler = null;
let videoUploadHandler = null;

let imageValidator = null;
let audioValidator = null;
let videoValidator = null;


/* =========================================================
   UI FEEDBACK HELPERS
   ---------------------------------------------------------
   Semua elemen tambahan pakai class unik:
     - .generate-media-status
     - .generate-media-error

   Class ini TIDAK dipakai oleh CSS lama, jadi aman.
========================================================= */

function setUploadState(
    wrapper,
    state,
    message = ""
) {

    const normalized =
        String(
            state ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        normalized
    ) {

        wrapper.dataset.uploadState =
            normalized;

    } else {

        delete wrapper.dataset.uploadState;

    }


    let statusEl =
        wrapper.querySelector(
            ".generate-media-status"
        );


    if (
        !statusEl
    ) {

        statusEl =
            document.createElement(
                "div"
            );


        statusEl.className =
            "generate-media-status";


        statusEl.setAttribute(
            "role",
            "status"
        );

        statusEl.setAttribute(
            "aria-live",
            "polite"
        );


        statusEl.style.cssText =
            "font-size:12px;margin-top:6px;line-height:1.4;";


        wrapper.appendChild(
            statusEl
        );

    }


    statusEl.dataset.state =
        normalized ||
        "idle";


    if (
        normalized ===
        "uploading"
    ) {

        statusEl.textContent =
            message ||
            "Mengunggah...";

        statusEl.style.color =
            "#8ab4ff";

    }

    else if (
        normalized ===
        "done"
    ) {

        statusEl.textContent =
            message ||
            "✓ Berhasil diunggah";

        statusEl.style.color =
            "#6fdd8b";

    }

    else if (
        normalized ===
        "failed"
    ) {

        statusEl.textContent =
            message ||
            "✗ Gagal diunggah";

        statusEl.style.color =
            "#ff7a7a";

    }

    else {

        statusEl.textContent =
            "";

    }

}


function showUploadError(
    wrapper,
    message
) {

    let errEl =
        wrapper.querySelector(
            ".generate-media-error"
        );


    if (
        !errEl
    ) {

        errEl =
            document.createElement(
                "div"
            );


        errEl.className =
            "generate-media-error";


        errEl.setAttribute(
            "role",
            "alert"
        );


        errEl.style.cssText =
            "color:#ff7a7a;font-size:13px;margin-top:6px;" +
            "padding:6px 10px;background:rgba(255,60,60,.08);" +
            "border-left:3px solid #ff7a7a;border-radius:4px;";


        wrapper.appendChild(
            errEl
        );

    }


    errEl.textContent =
        String(
            message ||
            "Upload gagal."
        );

}


function clearUploadError(
    wrapper
) {

    const errEl =
        wrapper.querySelector(
            ".generate-media-error"
        );


    if (
        errEl
    ) {

        errEl.remove();

    }


    delete wrapper.dataset.uploadError;

}


/* =========================================================
   REGISTER IMAGE HANDLERS
========================================================= */

export function registerImageMediaHandlers({
    upload = null,
    validate = null
} = {}) {

    if (
        upload !== null &&
        typeof upload !== "function"
    ) {

        throw new TypeError(
            "Image upload handler must be a function"
        );

    }


    if (
        validate !== null &&
        typeof validate !== "function"
    ) {

        throw new TypeError(
            "Image validator must be a function"
        );

    }


    imageUploadHandler =
        upload;

    imageValidator =
        validate;

}


/* =========================================================
   REGISTER AUDIO HANDLERS
========================================================= */

export function registerAudioMediaHandlers({
    upload = null,
    validate = null
} = {}) {

    if (
        upload !== null &&
        typeof upload !== "function"
    ) {

        throw new TypeError(
            "Audio upload handler must be a function"
        );

    }


    if (
        validate !== null &&
        typeof validate !== "function"
    ) {

        throw new TypeError(
            "Audio validator must be a function"
        );

    }


    audioUploadHandler =
        upload;

    audioValidator =
        validate;

}


/* =========================================================
   REGISTER VIDEO HANDLERS
========================================================= */

export function registerVideoMediaHandlers({
    upload = null,
    validate = null
} = {}) {

    if (
        upload !== null &&
        typeof upload !== "function"
    ) {

        throw new TypeError(
            "Video upload handler must be a function"
        );

    }


    if (
        validate !== null &&
        typeof validate !== "function"
    ) {

        throw new TypeError(
            "Video validator must be a function"
        );

    }


    videoUploadHandler =
        upload;

    videoValidator =
        validate;

}


/* =========================================================
   VALIDATE IMAGE
========================================================= */

function validateImage(
    file
) {

    if (
        typeof imageValidator ===
        "function"
    ) {

        return imageValidator(
            file
        );

    }


    if (
        !file
    ) {

        throw new Error(
            "File gambar tidak ditemukan."
        );

    }


    return true;

}


/* =========================================================
   VALIDATE AUDIO
========================================================= */

function validateAudio(
    file
) {

    if (
        typeof audioValidator ===
        "function"
    ) {

        return audioValidator(
            file
        );

    }


    if (
        !file
    ) {

        throw new Error(
            "File audio tidak ditemukan."
        );

    }


    return true;

}


/* =========================================================
   VALIDATE VIDEO
========================================================= */

function validateVideo(
    file
) {

    if (
        typeof videoValidator ===
        "function"
    ) {

        return videoValidator(
            file
        );

    }


    if (
        !file
    ) {

        throw new Error(
            "File video tidak ditemukan."
        );

    }


    return true;

}


/* =========================================================
   UNGGAHAN TERSIMPAN — KONTEKS
   ---------------------------------------------------------
   Panel "Unggahan tersimpan" hanya butuh client Supabase
   dan user yang sedang login. Keduanya diambil saat panel
   dibuka, bukan saat field dibuat, supaya halaman tidak
   menembak request storage untuk semua field sekaligus.
========================================================= */

async function getStoredUploadContext() {

    const supabase =
        getSupabaseClient();


    if (
        !supabase
    ) {

        throw new Error(
            "Penyimpanan belum siap. Muat ulang halaman lalu coba lagi."
        );
    }


    const user =
        await getCurrentUser();


    let userId =
        String(
            user?.id ||
            user?.user?.id ||
            ""
        )
            .trim();


    if (
        !userId &&
        typeof supabase?.auth?.getSession === "function"
    ) {

        try {

            const sessionResult =
                await supabase.auth.getSession();

            userId =
                String(
                    sessionResult?.data?.session?.user?.id ||
                    ""
                )
                    .trim();

        } catch {
            /* Abaikan jika getSession gagal */
        }
    }


    if (
        !userId &&
        typeof supabase?.auth?.getUser === "function"
    ) {

        try {

            const userResult =
                await supabase.auth.getUser();

            userId =
                String(
                    userResult?.data?.user?.id ||
                    ""
                )
                    .trim();

        } catch {
            /* Abaikan jika getUser gagal */
        }
    }


    if (
        !userId
    ) {

        throw new Error(
            "Masuk dulu untuk memakai unggahan tersimpan."
        );
    }


    return {
        supabase,
        userId
    };

}


/* =========================================================
   PROSES URL FACEBOOK (GETMYFB) & TIKTOK (SSSTIK)
========================================================= */

export function isFacebookMediaUrl(rawUrl) {
    let candidate = String(rawUrl || "").trim();
    if (!candidate) return false;
    if (
        !/^https?:\/\//i.test(candidate) &&
        /^(?:www\.|m\.|web\.|mbasic\.)?(?:facebook\.com|fb\.watch|fb\.com)\//i.test(candidate)
    ) {
        candidate = `https://${candidate}`;
    }
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return false;
        }
        const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
        return ["facebook.com", "fb.watch", "fb.com"].some(
            suffix => host === suffix || host.endsWith(`.${suffix}`)
        );
    } catch {
        return false;
    }
}

export function isTikTokMediaUrl(rawUrl) {
    let candidate = String(rawUrl || "").trim();
    if (!candidate) return false;
    if (
        !/^https?:\/\//i.test(candidate) &&
        /^(?:(?:www|m|vt|vm|t|lite)\.)?(?:tiktok\.com|xzcs3zlph\.com)\//i.test(candidate)
    ) {
        candidate = `https://${candidate}`;
    }
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return false;
        }
        const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
        const matched = ["tiktok.com", "xzcs3zlph.com"].some(
            suffix => host === suffix || host.endsWith(`.${suffix}`)
        );
        if (!matched) return false;
        const pathname = parsed.pathname.replace(/\/+$/, "");
        const hasQueryId = parsed.searchParams.has("item_id") || parsed.searchParams.has("shareId");
        if (!pathname && !hasQueryId) return false;
        if (/^\/@[^/]+$/i.test(pathname) && !hasQueryId) return false;
        return true;
    } catch {
        return false;
    }
}

export function isThreadsMediaUrl(rawUrl) {
    let candidate = String(rawUrl || "").trim();
    if (!candidate) return false;
    if (
        !/^https?:\/\//i.test(candidate) &&
        /^(?:www\.)?threads\.(?:com|net)\//i.test(candidate)
    ) {
        candidate = `https://${candidate}`;
    }
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return false;
        }
        const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
        const matched = ["threads.com", "threads.net"].some(
            suffix => host === suffix || host.endsWith(`.${suffix}`)
        );
        if (!matched) return false;
        const pathname = parsed.pathname.replace(/\/+$/, "");
        return (
            /^\/@?[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]{5,}(?:\/(?:media|embed))?$/i.test(pathname) ||
            /^\/(?:t|share)\/[A-Za-z0-9_-]{5,}(?:\/(?:media|embed))?$/i.test(pathname)
        );
    } catch {
        return false;
    }
}

export function detectSocialMediaUrlProvider(rawUrl) {
    if (isFacebookMediaUrl(rawUrl)) return "facebook";
    if (isTikTokMediaUrl(rawUrl)) return "tiktok";
    if (isThreadsMediaUrl(rawUrl)) return "threads";
    return "";
}

function getSocialMediaProviderLabels(rawUrl) {
    const provider = detectSocialMediaUrlProvider(rawUrl);
    if (provider === "tiktok") {
        return {
            provider: "tiktok",
            platformName: "TikTok",
            serviceName: "SSSTik",
            filePrefix: "tiktok"
        };
    }
    if (provider === "threads") {
        return {
            provider: "threads",
            platformName: "Threads",
            serviceName: "ThreadsDownloader",
            filePrefix: "threads"
        };
    }
    return {
        provider: provider || "facebook",
        platformName: "Facebook",
        serviceName: "GetMyFB",
        filePrefix: "fb"
    };
}

async function getSupabaseAccessTokenForMedia() {
    const supabase = getSupabaseClient();
    if (typeof supabase?.auth?.getSession === "function") {
        try {
            const sessionResult = await supabase.auth.getSession();
            const token = String(sessionResult?.data?.session?.access_token || "").trim();
            if (token) return token;
        } catch {
            /* Lanjut ke fallback sesi global */
        }
    }
    if (typeof window?.GENZSession?.getAccessToken === "function") {
        try {
            const token = String((await window.GENZSession.getAccessToken()) || "").trim();
            if (token) return token;
        } catch {
            /* ignore */
        }
    }
    throw new Error("Silakan login terlebih dahulu untuk memproses link Facebook, TikTok, atau Threads.");
}

async function downloadFacebookMediaFromServer(mediaUrl, kind) {
    const labels = getSocialMediaProviderLabels(mediaUrl);
    const token = await getSupabaseAccessTokenForMedia();
    const response = await fetch("/api/fb-media-download", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            url: mediaUrl,
            kind
        })
    });

    if (!response.ok) {
        let message = `Gagal memproses link ${labels.platformName} lewat ${labels.serviceName}.`;
        try {
            const payload = await response.json();
            if (payload?.error) {
                message = String(payload.error);
            }
        } catch {
            /* ignore JSON parse failure */
        }
        throw new Error(message);
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
        throw new Error(`File hasil unduhan ${labels.platformName} kosong.`);
    }

    const headerType = String(response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
    const contentType = headerType || String(blob.type || "").toLowerCase();
    const filename =
        String(response.headers.get("x-fb-media-filename") || "").trim() ||
        `${labels.filePrefix}-${kind}-${Date.now()}`;
    const needsAudioExtract =
        response.headers.get("x-fb-media-needs-audio-extract") === "1" ||
        (kind === "audio" && contentType.startsWith("video/"));

    return {
        blob,
        contentType,
        filename,
        needsAudioExtract,
        provider: labels.provider
    };
}

async function normalizeDownloadedImageFile(blob, filename) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    const mime = String(blob.type || "").toLowerCase();
    if (allowed.has(mime)) {
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const safeName = /\.(jpe?g|png|webp)$/i.test(filename)
            ? filename
            : `${filename.replace(/\.[^.]+$/, "")}.${ext}`;
        return new File([blob], safeName, {
            type: mime,
            lastModified: Date.now()
        });
    }

    /* Konversi ke JPEG bila format gambar dari sumber di luar JPEG/PNG/WebP */
    const objectUrl = URL.createObjectURL(blob);
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error("Format gambar dari link media tidak dapat dibaca."));
            el.src = objectUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const convertedBlob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                out => (out ? resolve(out) : reject(new Error("Gagal mengonversi foto hasil unduhan."))),
                "image/jpeg",
                0.92
            );
        });
        const base = filename.replace(/\.[^.]+$/, "") || `fb-photo-${Date.now()}`;
        return new File([convertedBlob], `${base}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now()
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function extractAudioFileFromVideoBlob(videoBlob, baseFilename = "fb-audio") {
    const cleanBase = String(baseFilename || "fb-audio").replace(/\.[^.]+$/, "") || "fb-audio";
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (typeof AudioContextConstructor === "function") {
        const context = new AudioContextConstructor();
        try {
            const buffer = await context.decodeAudioData(await videoBlob.arrayBuffer());
            const estimatedWavBytes =
                buffer.length * buffer.numberOfChannels * 2 + 44;
            if (buffer.duration > 0 && estimatedWavBytes <= 48 * 1024 * 1024) {
                const wavBlob = encodeAudioBufferRangeToWav(buffer, 0, buffer.duration);
                return new File([wavBlob], `${cleanBase}.wav`, {
                    type: "audio/wav",
                    lastModified: Date.now()
                });
            }
        } catch {
            /* Lanjut ke ekstraksi FFmpeg bila dekoder WebAudio tidak mendukung kontainer */
        } finally {
            try {
                await context.close();
            } catch {
                /* ignore */
            }
        }
    }

    const ffmpeg = await ensureFFmpeg();
    const uniqueId =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputName = `fb_audio_src_${uniqueId}.mp4`;
    const outputName = `fb_audio_out_${uniqueId}.m4a`;

    try {
        await ffmpeg.writeFile(inputName, new Uint8Array(await videoBlob.arrayBuffer()));
        const exitCode = await ffmpeg.exec([
            "-i",
            inputName,
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outputName
        ]);
        if (exitCode !== 0) {
            throw new Error(`Video tidak memiliki jalur audio yang dapat diekstrak (kode ${exitCode}).`);
        }
        const outBytes = await ffmpeg.readFile(outputName);
        if (!outBytes?.length) {
            throw new Error("Hasil ekstraksi audio dari video kosong.");
        }
        return new File([outBytes], `${cleanBase}.m4a`, {
            type: "audio/mp4",
            lastModified: Date.now()
        });
    } finally {
        await Promise.all([
            safeDeleteFFmpegFile(ffmpeg, inputName),
            safeDeleteFFmpegFile(ffmpeg, outputName)
        ]);
    }
}

function attachFacebookUrlControls(urlContainer, urlInput, {
    kindLabel,
    onProcess,
    onUrlChanged
}) {
    const inputRow = document.createElement("div");
    inputRow.className = "generate-url-input-row";

    const processButton = document.createElement("button");
    processButton.type = "button";
    processButton.className = "generate-fb-process-btn";
    processButton.textContent = "Proses";
    processButton.title = `Proses & unduh ${kindLabel} dari link Facebook (GetMyFB), TikTok (SSSTik), atau Threads (ThreadsDownloader)`;
    processButton.setAttribute("aria-label", `Proses link Facebook, TikTok, atau Threads untuk ${kindLabel}`);

    const hintEl = document.createElement("div");
    hintEl.className = "generate-fb-url-hint";
    hintEl.hidden = true;
    hintEl.textContent =
        `Link Facebook terdeteksi — klik Proses untuk mengunduh lewat GetMyFB & menyimpan ke ${kindLabel}.`;

    inputRow.append(urlInput, processButton);
    urlContainer.append(inputRow, hintEl);

    let busy = false;
    const setBusy = nextBusy => {
        busy = Boolean(nextBusy);
        processButton.disabled = busy;
        processButton.textContent = busy ? "Memproses…" : "Proses";
    };

    const syncHint = () => {
        const val = String(urlInput.value || "").trim();
        const provider = detectSocialMediaUrlProvider(val);
        if (!provider) {
            hintEl.hidden = true;
            return;
        }
        const labels = getSocialMediaProviderLabels(val);
        hintEl.textContent =
            `Link ${labels.platformName} terdeteksi — klik Proses untuk mengunduh lewat ${labels.serviceName} & menyimpan ke ${kindLabel}.`;
        hintEl.hidden = false;
    };

    urlInput.addEventListener("input", () => {
        syncHint();
        onUrlChanged?.(String(urlInput.value || "").trim());
    });

    const triggerProcess = async () => {
        if (busy) return;
        const val = String(urlInput.value || "").trim();
        await onProcess(val, { setBusy, syncHint });
    };

    processButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        triggerProcess();
    });

    syncHint();

    return {
        processButton,
        hintEl,
        syncHint,
        triggerProcess,
        isBusy: () => busy
    };
}


/* =========================================================
   UPLOAD IMAGE
========================================================= */

async function uploadImage(
    file
) {

    validateImage(
        file
    );


    if (
        typeof imageUploadHandler !==
        "function"
    ) {

        throw new Error(
            "Image upload handler is not registered"
        );

    }


    return await imageUploadHandler(
        file
    );

}


/* =========================================================
   UPLOAD AUDIO
========================================================= */

async function uploadAudio(
    file
) {

    validateAudio(
        file
    );


    if (
        typeof audioUploadHandler !==
        "function"
    ) {

        throw new Error(
            "Audio upload handler is not registered"
        );

    }


    return await audioUploadHandler(
        file
    );

}


/* =========================================================
   UPLOAD VIDEO
========================================================= */

async function uploadVideo(
    file
) {

    validateVideo(
        file
    );


    if (
        typeof videoUploadHandler !==
        "function"
    ) {

        throw new Error(
            "Video upload handler is not registered"
        );

    }


    return await videoUploadHandler(
        file
    );

}


/* =========================================================
   EXTRACT UPLOAD URL
   ---------------------------------------------------------
   Uploader bisa mengembalikan string ATAU object.
   Helper ini menangani keduanya.
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

        if (
            typeof result.url ===
            "string"
        ) {

            return String(
                result.url
            ).trim();

        }


        if (
            typeof result.publicUrl ===
            "string"
        ) {

            return String(
                result.publicUrl
            ).trim();

        }


        if (
            typeof result.public_url ===
            "string"
        ) {

            return String(
                result.public_url
            ).trim();

        }


        if (
            typeof result.href ===
            "string"
        ) {

            return String(
                result.href
            ).trim();

        }

    }


    return "";

}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function renderImagePreview(
    preview,
    files
) {

    if (
        !preview
    ) {

        return;

    }


    preview.innerHTML =
        "";


    const selectedFiles =
        Array.from(
            files || []
        ).filter(
            file =>
                file &&
                file.type &&
                file.type.startsWith(
                    "image/"
                )
        );


    if (
        !selectedFiles.length
    ) {

        preview.style.display =
            "none";

        return;

    }


    preview.style.display =
        "flex";

    preview.style.flexWrap =
        "wrap";

    preview.style.gap =
        "8px";


    selectedFiles.forEach(
        file => {

            const reader =
                new FileReader();


            reader.onload =
                event => {

                    const image =
                        document.createElement(
                            "img"
                        );


                    image.src =
                        String(
                            event.target?.result ||
                            ""
                        );


                    image.alt =
                        "Preview gambar";


                    image.style.width =
                        "160px";

                    image.style.height =
                        "160px";

                    image.style.maxWidth =
                        "160px";

                    image.style.maxHeight =
                        "160px";

                    image.style.objectFit =
                        "cover";

                    image.style.display =
                        "block";

                    image.style.borderRadius =
                        "10px";

                    image.style.border =
                        "1px solid rgba(255,255,255,.12)";


                    preview.appendChild(
                        image
                    );

                };


            reader.onerror =
                () => {

                    console.warn(
                        "[GEN-Z.AI][Generate Form] Preview gambar gagal:",
                        file?.name
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   AUDIO PREVIEW
========================================================= */

function createAudioPreview(
    preview
) {

    const audio =
        document.createElement(
            "audio"
        );


    audio.controls =
        true;

    audio.preload =
        "metadata";

    audio.style.width =
        "100%";

    audio.style.maxWidth =
        "500px";


    preview.appendChild(
        audio
    );


    return audio;

}


function encodeAudioBufferRangeToWav(
    audioBuffer,
    startSeconds,
    endSeconds
) {
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const startFrame = Math.max(0, Math.floor(startSeconds * sampleRate));
    const endFrame = Math.min(
        audioBuffer.length,
        Math.ceil(endSeconds * sampleRate)
    );
    const frameCount = endFrame - startFrame;

    if (frameCount < 1) {
        throw new Error("Rentang klip audio tidak valid.");
    }

    const bytesPerSample = 2;
    const dataSize = frameCount * channels * bytesPerSample;
    if (dataSize + 44 > 50 * 1024 * 1024) {
        throw new Error(
            "Ukuran klip audio melebihi batas 50 MB. Pilih durasi yang lebih pendek."
        );
    }

    const wav = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wav);
    const channelData = Array.from(
        { length: channels },
        (_, channel) => audioBuffer.getChannelData(channel)
    );
    const writeText = (offset, text) => {
        for (let index = 0; index < text.length; index += 1) {
            view.setUint8(offset + index, text.charCodeAt(index));
        }
    };

    writeText(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let frame = startFrame; frame < endFrame; frame += 1) {
        for (let channel = 0; channel < channels; channel += 1) {
            const sample = Math.max(
                -1,
                Math.min(1, channelData[channel][frame])
            );
            view.setInt16(
                offset,
                sample < 0 ? sample * 32768 : sample * 32767,
                true
            );
            offset += bytesPerSample;
        }
    }

    return new Blob([wav], { type: "audio/wav" });
}


async function createAudioClip(
    file,
    startSeconds,
    endSeconds
) {
    const AudioContextConstructor =
        window.AudioContext ||
        window.webkitAudioContext;

    if (typeof AudioContextConstructor !== "function") {
        throw new Error("Pemotongan audio tidak didukung di browser ini.");
    }

    const context = new AudioContextConstructor();

    try {
        const buffer = await context.decodeAudioData(
            await file.arrayBuffer()
        );

        if (
            !Number.isFinite(startSeconds) ||
            !Number.isFinite(endSeconds) ||
            startSeconds < 0 ||
            endSeconds > buffer.duration ||
            endSeconds - startSeconds < 0.1
        ) {
            throw new Error("Pilih rentang audio minimal 0,1 detik dan masih dalam durasi file.");
        }

        const blob = encodeAudioBufferRangeToWav(
            buffer,
            startSeconds,
            endSeconds
        );
        const baseName =
            String(file.name || "audio")
                .replace(/\.[^.]+$/, "") ||
            "audio";
        const clip = new File(
            [blob],
            `${baseName}-clip.wav`,
            {
                type: "audio/wav",
                lastModified: Date.now()
            }
        );

        validateAudio(clip);
        return clip;
    } finally {
        await context.close();
    }
}

async function createVideoClip(
    file,
    startSeconds,
    endSeconds,
    onProgress
) {
    if (
        !Number.isFinite(startSeconds) ||
        !Number.isFinite(endSeconds) ||
        startSeconds < 0 ||
        endSeconds - startSeconds < 0.1
    ) {
        throw new Error("Pilih rentang video minimal 0,1 detik.");
    }

    onProgress?.({ stage: "prepare" });
    const ffmpeg = await ensureFFmpeg();
    const uniqueId = globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const sourceName = `generate_video_source_${uniqueId}_${createFFmpegFilename(file)}`;
    const outputName = `generate_video_clip_${uniqueId}.mp4`;
    const progressListener = ({ progress }) => {
        if (Number.isFinite(progress)) {
            onProgress?.({ stage: "encode", progress });
        }
    };
    let progressListenerAttached = false;

    try {
        await ffmpeg.writeFile(
            sourceName,
            new Uint8Array(await file.arrayBuffer())
        );
        onProgress?.({ stage: "encode", progress: 0 });
        ffmpeg.on("progress", progressListener);
        progressListenerAttached = true;
        const exitCode = await ffmpeg.exec([
            "-ss",
            String(startSeconds),
            "-i",
            sourceName,
            "-t",
            String(endSeconds - startSeconds),
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            outputName
        ]);

        if (exitCode !== 0) {
            throw new Error(`FFmpeg gagal memotong video (kode ${exitCode}).`);
        }
        onProgress?.({ stage: "encode", progress: 1 });

        const output = await ffmpeg.readFile(outputName);
        if (!output?.length) {
            throw new Error("FFmpeg tidak menghasilkan klip video.");
        }

        const baseName =
            String(file.name || "video").replace(/\.[^.]+$/, "") || "video";
        const clip = new File(
            [output],
            `${baseName}-clip.mp4`,
            {
                type: "video/mp4",
                lastModified: Date.now()
            }
        );

        validateVideo(clip);
        return clip;
    } finally {
        if (progressListenerAttached && typeof ffmpeg.off === "function") {
            ffmpeg.off("progress", progressListener);
        }
        await Promise.all([
            safeDeleteFFmpegFile(ffmpeg, sourceName),
            safeDeleteFFmpegFile(ffmpeg, outputName)
        ]);
    }
}


function showAudioClipNotice(
    file,
    duration
) {
    document.querySelectorAll(".generate-audio-clip-toast").forEach(
        toast => toast.remove()
    );

    const toast = document.createElement("div");
    toast.className = "generate-audio-clip-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const icon = document.createElement("span");
    icon.className = "generate-audio-clip-toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Klip audio siap digunakan";
    const description = document.createElement("span");
    description.textContent =
        `${file.name} · ${duration.toFixed(1)} detik · ${formatAudioFileSize(file.size)}`;
    content.append(title, description);
    toast.append(icon, content);
    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add("is-leaving");
        window.setTimeout(() => toast.remove(), 250);
    }, 5000);
}


function formatAudioFileSize(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showVideoClipNotice(
    file,
    duration
) {
    document.querySelectorAll(".generate-video-clip-toast").forEach(
        toast => toast.remove()
    );

    const toast = document.createElement("div");
    toast.className = "generate-video-clip-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const icon = document.createElement("span");
    icon.className = "generate-video-clip-toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Klip video siap digunakan";
    const description = document.createElement("span");
    description.textContent =
        `${file.name} · ${duration.toFixed(1)} detik · ${formatAudioFileSize(file.size)}`;
    content.append(title, description);
    toast.append(icon, content);
    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add("is-leaving");
        window.setTimeout(() => toast.remove(), 250);
    }, 5000);
}


/* =========================================================
   VIDEO PREVIEW
========================================================= */

function createVideoPreview(
    preview
) {

    const video =
        document.createElement(
            "video"
        );


    video.controls =
        true;

    video.preload =
        "metadata";

    video.muted =
        true;

    video.playsInline =
        true;

    video.style.width =
        "100%";

    video.style.maxWidth =
        "500px";

    video.style.borderRadius =
        "10px";

    video.style.border =
        "1px solid rgba(255,255,255,.12)";


    preview.appendChild(
        video
    );


    return video;

}


/* =========================================================
   IMAGE FIELD
========================================================= */

export function createImageField(
    definition = {},
    parameterName = ""
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-image-input";


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    if (
        parameterName
    ) {

        wrapper.dataset.parameter =
            parameterName;

    }


    wrapper.dataset.imageMode =
        "url";


    /* =====================================================
       RACE CONDITION TOKEN
    ===================================================== */

    let uploadToken =
        0;


    /* =====================================================
       MODE SELECTOR
    ===================================================== */

    const modeSelector =
        document.createElement(
            "div"
        );


    modeSelector.className =
        "generate-image-mode-selector";


    modeSelector.style.display =
        "flex";

    modeSelector.style.gap =
        "8px";

    modeSelector.style.marginBottom =
        "10px";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";

    urlButton.textContent =
        "Gunakan URL";

    urlButton.className =
        "generate-image-mode-button active";

    urlButton.style.cursor =
        "pointer";

    urlButton.setAttribute(
        "aria-pressed",
        "true"
    );


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";

    uploadButton.textContent =
        "Upload Gambar";

    uploadButton.className =
        "generate-image-mode-button";

    uploadButton.style.cursor =
        "pointer";

    uploadButton.setAttribute(
        "aria-pressed",
        "false"
    );


    modeSelector.appendChild(
        urlButton
    );

    modeSelector.appendChild(
        uploadButton
    );


    /* =====================================================
       URL
    ===================================================== */

    const urlContainer =
        document.createElement(
            "div"
        );


    urlContainer.className =
        "generate-image-url-container";


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";

    urlInput.className =
        "generate-image-url";

    urlInput.placeholder =
        definition.placeholder ||
        "Masukkan URL gambar atau link FB / TikTok / Threads";

    urlInput.autocomplete =
        "off";


    urlInput.style.setProperty(
        "width",
        "100%",
        "important"
    );


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !== undefined &&
        defaultValue !== null
    ) {

        if (
            Array.isArray(
                defaultValue
            )
        ) {

            urlInput.value =
                String(
                    defaultValue[0] ||
                    ""
                );

        } else {

            urlInput.value =
                String(
                    defaultValue
                );

        }

    }


    const fbImageControls = attachFacebookUrlControls(
        urlContainer,
        urlInput,
        {
            kindLabel: "foto referensi",
            onUrlChanged: nextVal => {
                if (
                    wrapper.dataset.fbProcessedForUrl &&
                    wrapper.dataset.fbProcessedForUrl !== nextVal
                ) {
                    uploadToken += 1;
                    delete wrapper.dataset.fbProcessedForUrl;
                    delete wrapper.dataset.uploadedUrl;
                    delete wrapper.dataset.uploadedUrls;
                    delete wrapper._genzaiUploadedUrls;
                    preview.innerHTML = "";
                    preview.style.display = "none";
                    clearUploadError(wrapper);
                    setUploadState(wrapper, "");
                }
            },
            onProcess: async (trimmedUrl, { setBusy }) => {
                clearUploadError(wrapper);
                if (!trimmedUrl) {
                    showUploadError(wrapper, "Masukkan link Facebook, TikTok, atau Threads terlebih dahulu.");
                    return;
                }
                if (!detectSocialMediaUrlProvider(trimmedUrl)) {
                    showUploadError(
                        wrapper,
                        "URL langsung dapat dipakai tanpa Proses, atau tempelkan link Facebook (GetMyFB), TikTok (SSSTik), maupun Threads (ThreadsDownloader)."
                    );
                    return;
                }

                const labels = getSocialMediaProviderLabels(trimmedUrl);
                const myToken = ++uploadToken;
                setBusy(true);
                delete wrapper.dataset.fbProcessedForUrl;
                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;
                delete wrapper._genzaiUploadedUrls;
                setUploadState(
                    wrapper,
                    "uploading",
                    `Memproses link ${labels.platformName} lewat ${labels.serviceName} & mengunduh foto...`
                );

                const processTask = (async () => {
                    try {
                        const downloaded = await downloadFacebookMediaFromServer(
                            trimmedUrl,
                            "image"
                        );
                        if (myToken !== uploadToken) return "";

                        const imageFile = await normalizeDownloadedImageFile(
                            downloaded.blob,
                            downloaded.filename
                        );
                        validateImage(imageFile);
                        if (myToken !== uploadToken) return "";

                        renderImagePreview(preview, [imageFile]);
                        setUploadState(
                            wrapper,
                            "uploading",
                            `Menyimpan foto ${labels.platformName} ke referensi...`
                        );

                        wrapper._imageUploadPromise = (async () => {
                            const uploaded = await uploadImage(imageFile);
                            const uploadedUrl = extractUploadUrl(uploaded);
                            if (!uploadedUrl) {
                                throw new Error(
                                    "Foto berhasil diunduh tetapi URL penyimpanan tidak tersedia."
                                );
                            }
                            return [uploadedUrl];
                        })();

                        const uploadedUrls = await wrapper._imageUploadPromise;
                        if (myToken !== uploadToken) return "";

                        wrapper.dataset.uploadedUrl = uploadedUrls[0];
                        wrapper.dataset.uploadedUrls = JSON.stringify(uploadedUrls);
                        wrapper.dataset.fbProcessedForUrl = trimmedUrl;
                        wrapper.dataset.uploadSource = labels.provider;
                        preview.style.display = "flex";
                        setUploadState(
                            wrapper,
                            "done",
                            `✓ Foto ${labels.platformName} berhasil diunduh lewat ${labels.serviceName} & disimpan ke referensi`
                        );
                        return uploadedUrls[0];
                    } catch (error) {
                        if (myToken === uploadToken) {
                            delete wrapper.dataset.fbProcessedForUrl;
                            delete wrapper.dataset.uploadedUrl;
                            delete wrapper.dataset.uploadedUrls;
                            preview.innerHTML = "";
                            preview.style.display = "none";
                            const errorMessage = String(
                                error?.message ||
                                `Gagal memproses foto dari link ${labels.platformName}.`
                            );
                            wrapper.dataset.uploadError = errorMessage;
                            showUploadError(wrapper, errorMessage);
                            setUploadState(
                                wrapper,
                                "failed",
                                `✗ Gagal memproses link ${labels.platformName}`
                            );
                        }
                        return "";
                    } finally {
                        wrapper._imageUploadPromise = null;
                        if (myToken === uploadToken) {
                            setBusy(false);
                        } else {
                            setBusy(false);
                        }
                    }
                })();

                wrapper._fbProcessPromise = processTask;
                try {
                    await processTask;
                } finally {
                    if (wrapper._fbProcessPromise === processTask) {
                        wrapper._fbProcessPromise = null;
                    }
                }
            }
        }
    );

    urlInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (detectSocialMediaUrlProvider(urlInput.value)) {
                fbImageControls.triggerProcess();
            }
        }
    });


    /* =====================================================
       UPLOAD
    ===================================================== */

    const uploadContainer =
        document.createElement(
            "div"
        );


    uploadContainer.className =
        "generate-image-upload-container";


    uploadContainer.style.display =
        "none";


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";


    fileInput.accept =
        definition.accept ||
        "image/jpeg,image/png,image/webp";


    fileInput.multiple =
        definition.multiple === true ||
        Number(
            definition.maxItems ??
            definition.max_items
        ) > 1;


    fileInput.className =
        "generate-image-file";


    uploadContainer.appendChild(
        fileInput
    );


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-image-preview";


    preview.style.display =
        "none";

    preview.style.flexWrap =
        "wrap";

    preview.style.gap =
        "8px";

    preview.style.marginTop =
        "10px";

    preview.style.maxWidth =
        "360px";


    /* =====================================================
       MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const uploadMode =
            mode === "upload";


        if (
            uploadMode
        ) {

            urlContainer.style.display =
                "none";

            uploadContainer.style.display =
                "block";


            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "false"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "true"
            );


            if (
                fileInput.files &&
                fileInput.files.length
            ) {

                renderImagePreview(
                    preview,
                    fileInput.files
                );

            }

        } else {

            urlContainer.style.display =
                "block";

            uploadContainer.style.display =
                "none";


            const hasFbImagePreview =
                Boolean(wrapper.dataset.fbProcessedForUrl) &&
                wrapper.dataset.fbProcessedForUrl === String(urlInput.value || "").trim() &&
                preview.children.length > 0;

            preview.style.display =
                hasFbImagePreview
                    ? "flex"
                    : "none";


            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "true"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "false"
            );

        }


        wrapper.dataset.imageMode =
            uploadMode
                ? "upload"
                : "url";

    }


    /* =====================================================
       BUTTON EVENTS
    ===================================================== */

    urlButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "upload"
            );

        }
    );


    /* =====================================================
       FILE CHANGE
    ===================================================== */

    fileInput.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    fileInput.files || []
                );


            /* =============================================
               CLEAR OLD STATE
            ============================================= */

            clearUploadError(
                wrapper
            );


            /* =============================================
               EMPTY SELECTION
            ============================================= */

            if (
                !files.length
            ) {

                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;

                wrapper._imageUploadPromise =
                    null;

                setUploadState(
                    wrapper,
                    ""
                );

                renderImagePreview(
                    preview,
                    []
                );

                return;

            }


            try {

                files.forEach(
                    file => {

                        validateImage(
                            file
                        );

                    }
                );


                renderImagePreview(
                    preview,
                    files
                );


                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;


                const configuredMaxItems =
                    Number(
                        definition?.maxItems ??
                        definition?.max_items
                    );


                const maxItems =
                    Number.isFinite(
                        configuredMaxItems
                    ) &&
                    configuredMaxItems > 0

                        ? Math.floor(
                            configuredMaxItems
                        )

                        : 1;


                const selectedFiles =
                    files.slice(
                        0,
                        maxItems
                    );


                /* =========================================
                   RACE TOKEN
                ========================================= */

                const myToken =
                    ++uploadToken;


                setUploadState(
                    wrapper,
                    "uploading",
                    "Mengunggah gambar..."
                );


                wrapper._imageUploadPromise =
                    (async () => {

                        const uploadedUrls =
                            [];


                        for (
                            const file
                            of selectedFiles
                        ) {

                            const uploaded =
                                await uploadImage(
                                    file
                                );


                            const uploadedUrl =
                                extractUploadUrl(
                                    uploaded
                                );


                            if (
                                uploadedUrl
                            ) {

                                uploadedUrls.push(
                                    uploadedUrl
                                );

                            }

                        }


                        /* =================================
                           STALE CHECK
                        ================================= */

                        if (
                            myToken !==
                            uploadToken
                        ) {

                            debugLog(
                                "[GEN-Z.AI][Generate Form] Upload image stale diabaikan (race condition)."
                            );


                            return uploadedUrls;

                        }


                        if (
                            !uploadedUrls.length
                        ) {

                            throw new Error(
                                "Upload gambar berhasil tetapi URL gambar tidak tersedia."
                            );

                        }


                        wrapper.dataset.uploadedUrl =
                            uploadedUrls[0];


                        wrapper.dataset.uploadedUrls =
                            JSON.stringify(
                                uploadedUrls
                            );


                        debugLog(
                            "[GEN-Z.AI][Generate Form] Image upload ready:",
                            uploadedUrls
                        );


                        return uploadedUrls;

                    })();


                await wrapper._imageUploadPromise;


                if (
                    myToken ===
                    uploadToken
                ) {

                    setUploadState(
                        wrapper,
                        "done",
                        "✓ Gambar berhasil diunggah"
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Image upload gagal:",
                    error
                );


                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;


                try {

                    fileInput.value =
                        "";

                } catch {
                    /* ignore */
                }


                renderImagePreview(
                    preview,
                    []
                );


                const errorMessage =
                    String(
                        error?.message ||
                        "Gagal mengupload gambar."
                    );


                wrapper.dataset.uploadError =
                    errorMessage;


                showUploadError(
                    wrapper,
                    errorMessage
                );


                setUploadState(
                    wrapper,
                    "failed",
                    "✗ Gagal mengunggah gambar"
                );

            } finally {

                wrapper._imageUploadPromise =
                    null;

            }

        }
    );


    /* =====================================================
       HELPERS
    ===================================================== */

    wrapper._imageUploadPromise =
        null;

    wrapper._imageMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";

    wrapper._urlInput =
        urlInput;

    wrapper._fileInput =
        fileInput;

    wrapper._preview =
        preview;


    wrapper.getInputMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getFileInput =
        () =>
            fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


    wrapper.getUploadedUrls =
        () => {

            try {

                const parsed =
                    JSON.parse(
                        wrapper.dataset.uploadedUrls ||
                        "[]"
                    );


                return Array.isArray(
                    parsed
                )
                    ? parsed
                    : [];

            } catch {

                return [];

            }

        };


    wrapper.setUploadedUrl =
        url => {

            const normalized =
                String(
                    url ||
                    ""
                ).trim();


            if (
                normalized
            ) {

                wrapper.dataset.uploadedUrl =
                    normalized;

            } else {

                delete wrapper.dataset.uploadedUrl;

            }


            return normalized;

        };


    wrapper.getSelectedFiles =
        () =>
            Array.from(
                fileInput.files || []
            );


    wrapper.getImageMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    /* =====================================================
       UNGGAHAN TERSIMPAN (IMAGE)
       -----------------------------------------------------
       Memakai file yang masih ada di storage (maksimal
       1 jam) tanpa mengunggah ulang.
    ===================================================== */

    function getStoredImageLimit() {

        const configuredMaxItems =
            Number(
                definition?.maxItems ??
                definition?.max_items
            );


        return (
            Number.isFinite(
                configuredMaxItems
            ) &&
            configuredMaxItems > 0
        )
            ? Math.floor(
                configuredMaxItems
            )
            : 1;
    }


    function renderStoredImagePreview(
        urls
    ) {

        preview.innerHTML =
            "";


        const list =
            (
                urls ||
                []
            ).filter(
                Boolean
            );


        if (
            !list.length
        ) {

            preview.style.display =
                "none";

            return;
        }


        preview.style.display =
            "flex";

        preview.style.flexWrap =
            "wrap";

        preview.style.gap =
            "8px";


        list.forEach(
            url => {

                const image =
                    document.createElement(
                        "img"
                    );


                image.src =
                    url;

                image.alt =
                    "Preview gambar tersimpan";

                image.style.width =
                    "160px";

                image.style.height =
                    "160px";

                image.style.maxWidth =
                    "160px";

                image.style.maxHeight =
                    "160px";

                image.style.objectFit =
                    "cover";

                image.style.display =
                    "block";

                image.style.borderRadius =
                    "10px";

                image.style.border =
                    "1px solid rgba(255,255,255,.12)";


                preview.appendChild(
                    image
                );
            }
        );
    }


    function applyStoredImage(
        entry
    ) {

        if (
            !entry?.url
        ) {

            throw new Error(
                "URL gambar tidak tersedia."
            );
        }


        /* Batalkan upload yang mungkin masih berjalan. */
        uploadToken +=
            1;

        wrapper._imageUploadPromise =
            null;


        try {

            fileInput.value =
                "";

        } catch {
            /* ignore */
        }


        clearUploadError(
            wrapper
        );


        const limit =
            getStoredImageLimit();

        const current =
            limit > 1
                ? wrapper.getUploadedUrls()
                : [];

        const urls =
            [
                ...current.filter(
                    item =>
                        item !==
                        entry.url
                ),
                entry.url
            ].slice(
                0,
                limit
            );


        wrapper.dataset.uploadedUrl =
            urls[0];

        wrapper.dataset.uploadedUrls =
            JSON.stringify(
                urls
            );

        wrapper.dataset.uploadSource =
            "stored";

        wrapper.dataset.storedUploadPath =
            String(
                entry.path ||
                ""
            );


        renderStoredImagePreview(
            urls
        );


        setUploadState(
            wrapper,
            "done",
            `✓ Memakai unggahan tersimpan: ${entry.name} · ${formatStoredUploadRemaining(entry.expiresAt)}`
        );
    }


    const storedUploadsPanel =
        createStoredUploadsPanel({
            kinds:
                ["image"],

            getContext:
                getStoredUploadContext,

            onPick:
                entry =>
                    applyStoredImage(
                        entry
                    )
        });


    wrapper.clearUploadedFile =
        async () => {

            fileInput.value =
                "";

            urlInput.value =
                "";

            preview.innerHTML =
                "";

            preview.style.display =
                "none";


            delete wrapper.dataset.uploadedUrl;
            delete wrapper.dataset.uploadedUrls;
            delete wrapper.dataset.fbProcessedForUrl;

            delete wrapper.dataset.uploadState;

            delete wrapper.dataset.uploadSource;
            delete wrapper.dataset.storedUploadPath;

            fbImageControls.syncHint();


            clearUploadError(
                wrapper
            );

            setUploadState(
                wrapper,
                ""
            );


            wrapper._imageUploadPromise =
                null;


            /* Invalidate stale uploads */
            uploadToken +=
                1;


            setMode(
                "url"
            );

        };


    /* =====================================================
       APPEND
    ===================================================== */

    wrapper.appendChild(
        modeSelector
    );

    wrapper.appendChild(
        urlContainer
    );

    uploadContainer.appendChild(
        storedUploadsPanel.element
    );


    wrapper.appendChild(
        uploadContainer
    );

    wrapper.appendChild(
        preview
    );


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   AUDIO FIELD
========================================================= */

export function createAudioField(
    definition = {},
    parameterName = "audio_url"
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-audio-input";


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    if (
        parameterName
    ) {

        wrapper.dataset.parameter =
            parameterName;

    }


    wrapper.dataset.audioMode =
        "url";


    /* =====================================================
       RACE CONDITION TOKEN
    ===================================================== */

    let uploadToken =
        0;


    /* =====================================================
       MODE SELECTOR
    ===================================================== */

    const modeSelector =
        document.createElement(
            "div"
        );


    modeSelector.className =
        "generate-audio-mode-selector";


    modeSelector.style.display =
        "flex";

    modeSelector.style.gap =
        "8px";

    modeSelector.style.marginBottom =
        "10px";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";

    urlButton.textContent =
        "Gunakan URL";

    urlButton.className =
        "generate-audio-mode-button active";

    urlButton.style.cursor =
        "pointer";

    urlButton.setAttribute(
        "aria-pressed",
        "true"
    );


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";

    uploadButton.textContent =
        "Upload Audio";

    uploadButton.className =
        "generate-audio-mode-button";

    uploadButton.style.cursor =
        "pointer";

    uploadButton.setAttribute(
        "aria-pressed",
        "false"
    );


    modeSelector.appendChild(
        urlButton
    );

    modeSelector.appendChild(
        uploadButton
    );


    /* =====================================================
       URL
    ===================================================== */

    const urlContainer =
        document.createElement(
            "div"
        );


    urlContainer.className =
        "generate-audio-url-container";


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";

    urlInput.className =
        "generate-audio-url";

    urlInput.placeholder =
        "Masukkan URL audio MP3/WAV atau link FB / TikTok / Threads";

    urlInput.autocomplete =
        "off";


    urlInput.style.setProperty(
        "width",
        "100%",
        "important"
    );


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !== undefined &&
        defaultValue !== null
    ) {

        urlInput.value =
            String(
                Array.isArray(
                    defaultValue
                )
                    ? (
                        defaultValue[0] ||
                        ""
                    )
                    : defaultValue
            );

    }


    /* =====================================================
       UPLOAD
    ===================================================== */

    const uploadContainer =
        document.createElement(
            "div"
        );


    uploadContainer.className =
        "generate-audio-upload-container";


    uploadContainer.style.display =
        "none";


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";

    fileInput.accept =
        definition.accept ||
        ".mp3,.wav,audio/mpeg,audio/wav";

    fileInput.multiple =
        false;

    fileInput.className =
        "generate-audio-file";


    uploadContainer.appendChild(
        fileInput
    );


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-audio-preview";


    preview.style.display =
        "none";

    preview.style.marginTop =
        "10px";


    const audio =
        createAudioPreview(
            preview
        );

    let sourceAudioFile = null;
    let sourceAudioDuration = 0;

    const trimPanel = document.createElement("section");
    trimPanel.className = "generate-audio-trim-panel";
    trimPanel.hidden = true;

    const trimHeading = document.createElement("div");
    trimHeading.className = "generate-audio-trim-heading";
    const trimEyebrow = document.createElement("span");
    trimEyebrow.textContent = "AUDIO EDITOR";
    const trimTitle = document.createElement("strong");
    trimTitle.textContent = "Pilih bagian audio";
    trimHeading.append(trimEyebrow, trimTitle);

    const trimDescription = document.createElement("p");
    trimDescription.className = "generate-audio-trim-description";
    trimDescription.textContent =
        "Atur titik mulai dan akhir, lalu gunakan klip pilihan Anda untuk model.";

    const trimControls = document.createElement("div");
    trimControls.className = "generate-audio-trim-controls";

    function createTrimControl(labelText, inputType, className) {
        const group = document.createElement("label");
        group.className = "generate-audio-trim-control";
        const label = document.createElement("span");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = inputType;
        input.className = className;
        input.step = "0.01";
        if (inputType === "number") {
            input.min = "0";
            input.inputMode = "decimal";
            input.setAttribute("aria-label", `${labelText} (detik)`);
        }
        group.append(label, input);
        return { group, input };
    }

    const startRangeControl = createTrimControl(
        "MULAI",
        "range",
        "generate-audio-trim-start-range"
    );
    const endRangeControl = createTrimControl(
        "AKHIR",
        "range",
        "generate-audio-trim-end-range"
    );
    const startNumberControl = createTrimControl(
        "Mulai (detik)",
        "number",
        "generate-audio-trim-start-number"
    );
    const endNumberControl = createTrimControl(
        "Akhir (detik)",
        "number",
        "generate-audio-trim-end-number"
    );
    trimControls.append(
        startRangeControl.group,
        endRangeControl.group,
        startNumberControl.group,
        endNumberControl.group
    );

    const trimActions = document.createElement("div");
    trimActions.className = "generate-audio-trim-actions";
    const useWholeButton = document.createElement("button");
    useWholeButton.type = "button";
    useWholeButton.className = "generate-audio-trim-whole";
    useWholeButton.textContent = "Gunakan audio utuh";
    const trimButton = document.createElement("button");
    trimButton.type = "button";
    trimButton.className = "generate-audio-trim-submit";
    trimButton.textContent = "Potong & gunakan klip";
    trimActions.append(useWholeButton, trimButton);

    const trimStatus = document.createElement("p");
    trimStatus.className = "generate-audio-trim-status";
    trimStatus.setAttribute("role", "status");
    trimStatus.setAttribute("aria-live", "polite");

    trimPanel.append(
        trimHeading,
        trimDescription,
        trimControls,
        trimActions,
        trimStatus
    );
    preview.appendChild(trimPanel);


    function renderPreview(
        file
    ) {

        audio.removeAttribute(
            "src"
        );

        audio.load();


        if (
            !file
        ) {

            preview.style.display =
                "none";

            return;

        }


        const previousUrl =
            audio.dataset.objectUrl;


        if (
            previousUrl
        ) {

            try {

                URL.revokeObjectURL(
                    previousUrl
                );

            } catch {
                /* ignore */
            }

        }


        const objectUrl =
            URL.createObjectURL(
                file
            );


        audio.src =
            objectUrl;

        audio.dataset.objectUrl =
            objectUrl;

        audio.onloadedmetadata = () => {
            if (file !== sourceAudioFile) return;
            if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
                trimStatus.textContent =
                    "Durasi audio tidak dapat dibaca. Coba file MP3 atau WAV lain.";
                return;
            }
            sourceAudioDuration = audio.duration;
            const duration = sourceAudioDuration;
            [
                startRangeControl.input,
                endRangeControl.input,
                startNumberControl.input,
                endNumberControl.input
            ].forEach(input => {
                input.min = "0";
                input.max = String(duration);
            });
            endRangeControl.input.value = String(duration);
            endNumberControl.input.value = duration.toFixed(2);
            startNumberControl.input.value = "0";
            startRangeControl.input.value = "0";
            trimStatus.textContent =
                `Durasi sumber ${duration.toFixed(2)} detik.`;
            trimButton.disabled = duration < 0.1;
            useWholeButton.disabled = false;
            if (duration < 0.1) {
                trimStatus.textContent =
                    "Durasi terlalu singkat untuk dipotong. Audio utuh tetap dapat digunakan.";
            }
        };


        preview.style.display =
            "block";

    }


    function clearPreview(
        preserveEditor = false
    ) {

        const objectUrl =
            audio.dataset.objectUrl;


        if (
            objectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    objectUrl
                );

            } catch {
                /* ignore */
            }

        }


        delete audio.dataset.objectUrl;


        audio.removeAttribute(
            "src"
        );

        audio.load();


        preview.style.display =
            "none";

        if (!preserveEditor) {
            trimPanel.hidden = true;
            sourceAudioFile = null;
            sourceAudioDuration = 0;
        }

    }


    async function uploadSelectedAudio(
        file,
        clipDuration = null
    ) {
        validateAudio(file);

        const myToken = ++uploadToken;
        wrapper._audioSelectionPending = false;
        wrapper._audioSelectedFile = file;
        delete wrapper.dataset.uploadedUrl;
        clearUploadError(wrapper);
        renderPreview(file);
        trimPanel.hidden = !sourceAudioFile;
        trimStatus.textContent = clipDuration === null
            ? "Mengunggah audio utuh..."
            : `Klip ${clipDuration.toFixed(2)} detik siap. Mengunggah klip pilihan...`;
        useWholeButton.disabled = true;
        trimButton.disabled = true;
        setUploadState(wrapper, "uploading", "Mengunggah audio pilihan...");

        wrapper._audioUploadPromise = (async () => {
            try {
                const uploaded = await uploadAudio(file);
                const uploadedUrl = extractUploadUrl(uploaded);
                if (!uploadedUrl) {
                    throw new Error(
                        "Upload audio berhasil tetapi URL audio tidak tersedia."
                    );
                }

                if (myToken !== uploadToken) return "";

                wrapper.dataset.uploadedUrl = uploadedUrl;
                wrapper.dataset.uploadState = "done";
                setUploadState(
                    wrapper,
                    "done",
                    clipDuration === null
                        ? "✓ Audio utuh berhasil diunggah"
                        : "✓ Klip audio berhasil diunggah dan siap digunakan"
                );
                if (clipDuration !== null) {
                    showAudioClipNotice(file, clipDuration);
                }
                return uploadedUrl;
            } catch (error) {
                if (myToken === uploadToken) {
                    console.error(
                        "[GEN-Z.AI][Generate Form] Upload audio gagal:",
                        error
                    );
                    delete wrapper.dataset.uploadedUrl;
                    wrapper.dataset.uploadError =
                        String(error?.message || "Gagal mengupload audio.");
                    showUploadError(wrapper, wrapper.dataset.uploadError);
                    setUploadState(wrapper, "failed", "✗ Gagal mengunggah audio");
                    trimStatus.textContent = wrapper.dataset.uploadError;
                }
                return "";
            } finally {
                if (myToken === uploadToken) {
                    useWholeButton.disabled = false;
                    trimButton.disabled = sourceAudioDuration < 0.1;
                    wrapper._audioUploadPromise = null;
                }
            }
        })();

        return await wrapper._audioUploadPromise;

    }


    /* =====================================================
       MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const uploadMode =
            mode === "upload";


        if (
            uploadMode
        ) {

            urlContainer.style.display =
                "none";

            uploadContainer.style.display =
                "block";


            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "false"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "true"
            );


            if (
                fileInput.files &&
                fileInput.files.length
            ) {

                sourceAudioFile = fileInput.files[0];
                renderPreview(
                    wrapper._audioSelectedFile ||
                    sourceAudioFile
                );
                trimPanel.hidden = false;

            }

        } else {

            urlContainer.style.display =
                "block";

            uploadContainer.style.display =
                "none";


            const hasFbAudioPreview =
                Boolean(wrapper.dataset.fbProcessedForUrl) &&
                wrapper.dataset.fbProcessedForUrl === String(urlInput.value || "").trim() &&
                Boolean(sourceAudioFile);

            if (hasFbAudioPreview) {
                renderPreview(
                    wrapper._audioSelectedFile ||
                    sourceAudioFile
                );
                trimPanel.hidden = false;
            } else {
                clearPreview(true);
            }


            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "true"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "false"
            );

        }


        wrapper.dataset.audioMode =
            uploadMode
                ? "upload"
                : "url";

    }


    /* =====================================================
       BUTTON EVENTS
    ===================================================== */

    urlButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "upload"
            );

        }
    );


    /* =====================================================
       FILE CHANGE
    ===================================================== */

    fileInput.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    fileInput.files || []
                );


            /* =============================================
               CLEAR OLD STATE
            ============================================= */

            clearUploadError(
                wrapper
            );


            /* =============================================
               EMPTY SELECTION
            ============================================= */

            if (
                !files.length
            ) {

                delete wrapper.dataset.uploadedUrl;

                wrapper._audioUploadPromise =
                    null;

                wrapper._audioSelectionPending = false;
                wrapper._audioSelectedFile = null;

                setUploadState(
                    wrapper,
                    ""
                );

                clearPreview();

                return;

            }


            const file =
                files[0];

            try {

                validateAudio(
                    file
                );

                uploadToken += 1;
                sourceAudioFile = file;
                sourceAudioDuration = 0;
                wrapper._audioSelectionPending = true;
                wrapper._audioSelectedFile = null;
                wrapper._audioUploadPromise = null;
                delete wrapper.dataset.uploadedUrl;
                renderPreview(
                    file
                );
                trimPanel.hidden = false;
                trimButton.disabled = true;
                useWholeButton.disabled = true;
                trimStatus.textContent =
                    "Pilih audio utuh atau potong bagian yang ingin digunakan.";
                setUploadState(wrapper, "");

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Audio upload gagal:",
                    error
                );


                delete wrapper.dataset.uploadedUrl;
                wrapper._audioSelectionPending = false;
                wrapper._audioSelectedFile = null;


                try {

                    fileInput.value =
                        "";

                } catch {
                    /* ignore */
                }


                clearPreview();


                const errorMessage =
                    String(
                        error?.message ||
                        "Gagal mengupload audio."
                    );


                wrapper.dataset.uploadError =
                    errorMessage;


                showUploadError(
                    wrapper,
                    errorMessage
                );


                setUploadState(
                    wrapper,
                    "failed",
                    "✗ Gagal mengunggah audio"
                );

            } finally {

                wrapper._audioUploadPromise =
                    null;

            }

        }
    );


    function syncTrimInputs(source) {
        const start = source === "start-range"
            ? Number(startRangeControl.input.value)
            : Number(startNumberControl.input.value);
        const end = source === "end-range"
            ? Number(endRangeControl.input.value)
            : Number(endNumberControl.input.value);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;

        if (source === "start-range" || source === "start-number") {
            const nextStart = Math.max(
                0,
                Math.min(start, sourceAudioDuration - 0.1)
            );
            startNumberControl.input.value = nextStart.toFixed(2);
            startRangeControl.input.value = String(nextStart);
            if (end - nextStart < 0.1) {
                const nextEnd = Math.min(
                    sourceAudioDuration,
                    nextStart + 0.1
                );
                endNumberControl.input.value = nextEnd.toFixed(2);
                endRangeControl.input.value = String(nextEnd);
            }
        } else {
            const nextEnd = Math.max(
                0.1,
                Math.min(end, sourceAudioDuration)
            );
            endNumberControl.input.value = nextEnd.toFixed(2);
            endRangeControl.input.value = String(nextEnd);
            if (nextEnd - start < 0.1) {
                const nextStart = Math.max(0, nextEnd - 0.1);
                startNumberControl.input.value = nextStart.toFixed(2);
                startRangeControl.input.value = String(nextStart);
            }
        }

        const selectedDuration =
            Number(endNumberControl.input.value) -
            Number(startNumberControl.input.value);
        trimStatus.textContent =
            `Klip terpilih ${selectedDuration.toFixed(2)} detik dari ${sourceAudioDuration.toFixed(2)} detik.`;
    }

    startRangeControl.input.addEventListener(
        "input",
        () => syncTrimInputs("start-range")
    );
    startNumberControl.input.addEventListener(
        "input",
        () => syncTrimInputs("start-number")
    );
    endRangeControl.input.addEventListener(
        "input",
        () => syncTrimInputs("end-range")
    );
    endNumberControl.input.addEventListener(
        "input",
        () => syncTrimInputs("end-number")
    );

    useWholeButton.addEventListener("click", async () => {
        if (!sourceAudioFile) return;
        await uploadSelectedAudio(sourceAudioFile);
    });

    trimButton.addEventListener("click", async () => {
        if (!sourceAudioFile || !sourceAudioDuration) return;

        const sourceFile = sourceAudioFile;
        const selectionToken = uploadToken;
        const start = Number(startNumberControl.input.value);
        const end = Number(endNumberControl.input.value);
        useWholeButton.disabled = true;
        trimButton.disabled = true;
        trimStatus.textContent = "Memotong klip audio...";

        try {
            const clip = await createAudioClip(
                sourceFile,
                start,
                end
            );
            if (
                selectionToken !== uploadToken ||
                sourceAudioFile !== sourceFile
            ) {
                return;
            }
            await uploadSelectedAudio(clip, end - start);
        } catch (error) {
            if (
                selectionToken === uploadToken &&
                sourceAudioFile === sourceFile
            ) {
                trimStatus.textContent =
                    error?.message || "Klip audio gagal dipotong.";
                useWholeButton.disabled = false;
                trimButton.disabled = false;
            }
        }
    });


    const fbAudioControls = attachFacebookUrlControls(
        urlContainer,
        urlInput,
        {
            kindLabel: "audio referensi",
            onUrlChanged: nextVal => {
                if (
                    wrapper.dataset.fbProcessedForUrl &&
                    wrapper.dataset.fbProcessedForUrl !== nextVal
                ) {
                    uploadToken += 1;
                    delete wrapper.dataset.fbProcessedForUrl;
                    delete wrapper.dataset.uploadedUrl;
                    delete wrapper._genzaiUploadedUrls;
                    wrapper._audioSelectionPending = false;
                    wrapper._audioSelectedFile = null;
                    clearPreview();
                    clearUploadError(wrapper);
                    setUploadState(wrapper, "");
                }
            },
            onProcess: async (trimmedUrl, { setBusy }) => {
                clearUploadError(wrapper);
                if (!trimmedUrl) {
                    showUploadError(wrapper, "Masukkan link Facebook, TikTok, atau Threads terlebih dahulu.");
                    return;
                }
                if (!detectSocialMediaUrlProvider(trimmedUrl)) {
                    showUploadError(
                        wrapper,
                        "URL langsung dapat dipakai tanpa Proses, atau tempelkan link Facebook (GetMyFB), TikTok (SSSTik), maupun Threads (ThreadsDownloader)."
                    );
                    return;
                }

                const labels = getSocialMediaProviderLabels(trimmedUrl);
                const myToken = ++uploadToken;
                setBusy(true);
                delete wrapper.dataset.fbProcessedForUrl;
                delete wrapper.dataset.uploadedUrl;
                delete wrapper._genzaiUploadedUrls;
                setUploadState(
                    wrapper,
                    "uploading",
                    `Memproses link ${labels.platformName} lewat ${labels.serviceName} & mengunduh audio...`
                );

                const processTask = (async () => {
                    try {
                        const downloaded = await downloadFacebookMediaFromServer(
                            trimmedUrl,
                            "audio"
                        );
                        if (myToken !== uploadToken) return "";

                        let audioFile;
                        if (downloaded.needsAudioExtract) {
                            setUploadState(
                                wrapper,
                                "uploading",
                                `Mengekstrak jalur audio dari video ${labels.platformName}...`
                            );
                            audioFile = await extractAudioFileFromVideoBlob(
                                downloaded.blob,
                                downloaded.filename
                            );
                        } else {
                            const mime = downloaded.contentType.startsWith("audio/")
                                ? downloaded.contentType
                                : "audio/mpeg";
                            audioFile = new File(
                                [downloaded.blob],
                                downloaded.filename.includes(".")
                                    ? downloaded.filename
                                    : `${downloaded.filename}.mp3`,
                                {
                                    type: mime,
                                    lastModified: Date.now()
                                }
                            );
                        }

                        validateAudio(audioFile);
                        if (myToken !== uploadToken) return "";

                        sourceAudioFile = audioFile;
                        sourceAudioDuration = 0;
                        wrapper.dataset.fbProcessedForUrl = trimmedUrl;
                        wrapper.dataset.uploadSource = labels.provider;

                        const uploadedUrl = await uploadSelectedAudio(audioFile);
                        if (!uploadedUrl) {
                            delete wrapper.dataset.fbProcessedForUrl;
                            return "";
                        }

                        setUploadState(
                            wrapper,
                            "done",
                            `✓ Audio ${labels.platformName} berhasil diunduh lewat ${labels.serviceName} & disimpan. Anda bisa langsung pakai atau potong klip audio di bawah.`
                        );
                        return uploadedUrl;
                    } catch (error) {
                        if (myToken === uploadToken) {
                            delete wrapper.dataset.fbProcessedForUrl;
                            delete wrapper.dataset.uploadedUrl;
                            clearPreview();
                            const errorMessage = String(
                                error?.message ||
                                `Gagal memproses audio dari link ${labels.platformName}.`
                            );
                            wrapper.dataset.uploadError = errorMessage;
                            showUploadError(wrapper, errorMessage);
                            setUploadState(
                                wrapper,
                                "failed",
                                `✗ Gagal memproses link ${labels.platformName}`
                            );
                        }
                        return "";
                    } finally {
                        setBusy(false);
                    }
                })();

                wrapper._fbProcessPromise = processTask;
                try {
                    await processTask;
                } finally {
                    if (wrapper._fbProcessPromise === processTask) {
                        wrapper._fbProcessPromise = null;
                    }
                }
            }
        }
    );

    urlInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();
                if (detectSocialMediaUrlProvider(urlInput.value)) {
                    fbAudioControls.triggerProcess();
                }

            }

        }
    );


    /* =====================================================
       HELPERS
    ===================================================== */

    wrapper._audioUploadPromise =
        null;

    wrapper._audioMode =
        () =>
            wrapper.dataset.audioMode ||
            "url";

    wrapper._urlInput =
        urlInput;

    wrapper._fileInput =
        fileInput;

    wrapper._preview =
        preview;


    wrapper.getInputMode =
        () =>
            wrapper.dataset.audioMode ||
            "url";


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getFileInput =
        () =>
            fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


    wrapper.getAudioMode =
        () =>
            wrapper.dataset.audioMode ||
            "url";


    /* =====================================================
       UNGGAHAN TERSIMPAN (AUDIO)
    ===================================================== */

    function applyStoredAudio(
        entry
    ) {

        if (
            !entry?.url
        ) {

            throw new Error(
                "URL audio tidak tersedia."
            );
        }


        uploadToken +=
            1;

        wrapper._audioUploadPromise =
            null;

        wrapper._audioSelectionPending =
            false;

        wrapper._audioSelectedFile =
            null;

        sourceAudioFile =
            null;

        sourceAudioDuration =
            0;


        try {

            fileInput.value =
                "";

        } catch {
            /* ignore */
        }


        clearUploadError(
            wrapper
        );


        const objectUrl =
            audio.dataset.objectUrl;


        if (
            objectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    objectUrl
                );

            } catch {
                /* ignore */
            }
        }


        delete audio.dataset.objectUrl;


        audio.src =
            entry.url;

        preview.style.display =
            "block";


        trimPanel.hidden =
            true;

        trimButton.disabled =
            true;

        useWholeButton.disabled =
            true;

        trimStatus.textContent =
            "Audio dari unggahan tersimpan dipakai utuh (tidak dipotong ulang).";


        wrapper.dataset.uploadedUrl =
            entry.url;

        wrapper.dataset.uploadSource =
            "stored";

        wrapper.dataset.storedUploadPath =
            String(
                entry.path ||
                ""
            );


        setUploadState(
            wrapper,
            "done",
            `✓ Memakai unggahan tersimpan: ${entry.name} · ${formatStoredUploadRemaining(entry.expiresAt)}`
        );
    }


    const storedUploadsPanel =
        createStoredUploadsPanel({
            kinds:
                ["audio"],

            getContext:
                getStoredUploadContext,

            onPick:
                entry =>
                    applyStoredAudio(
                        entry
                    )
        });


    wrapper.clearUploadedFile =
        async () => {

            fileInput.value =
                "";

            urlInput.value =
                "";

            clearPreview();


            delete wrapper.dataset.uploadedUrl;
            delete wrapper.dataset.fbProcessedForUrl;
            delete wrapper.dataset.uploadState;

            delete wrapper.dataset.uploadSource;
            delete wrapper.dataset.storedUploadPath;

            fbAudioControls.syncHint();


            clearUploadError(
                wrapper
            );

            setUploadState(
                wrapper,
                ""
            );


            wrapper._audioUploadPromise =
                null;

            wrapper._audioSelectionPending =
                false;

            wrapper._audioSelectedFile =
                null;


            /* Invalidate stale uploads */
            uploadToken +=
                1;


            setMode(
                "url"
            );

        };


    /* =====================================================
       APPEND
    ===================================================== */

    wrapper.appendChild(
        modeSelector
    );

    wrapper.appendChild(
        urlContainer
    );

    uploadContainer.appendChild(
        storedUploadsPanel.element
    );


    wrapper.appendChild(
        uploadContainer
    );

    wrapper.appendChild(
        preview
    );


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   VIDEO FIELD
========================================================= */

export function createVideoField(
    definition = {},
    parameterName = "video_urls"
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-video-input";


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    if (
        parameterName
    ) {

        wrapper.dataset.parameter =
            parameterName;

    }


    wrapper.dataset.videoMode =
        "url";


    /* =====================================================
       RACE CONDITION TOKEN
    ===================================================== */

    let uploadToken =
        0;


    /* =====================================================
       MODE SELECTOR
    ===================================================== */

    const modeSelector =
        document.createElement(
            "div"
        );


    modeSelector.className =
        "generate-video-mode-selector";


    modeSelector.style.display =
        "flex";

    modeSelector.style.gap =
        "8px";

    modeSelector.style.marginBottom =
        "10px";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";

    urlButton.textContent =
        "Gunakan URL";

    urlButton.className =
        "generate-video-mode-button active";

    urlButton.style.cursor =
        "pointer";

    urlButton.setAttribute(
        "aria-pressed",
        "true"
    );


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";

    uploadButton.textContent =
        "Upload Video";

    uploadButton.className =
        "generate-video-mode-button";

    uploadButton.style.cursor =
        "pointer";

    uploadButton.setAttribute(
        "aria-pressed",
        "false"
    );


    modeSelector.appendChild(
        urlButton
    );

    modeSelector.appendChild(
        uploadButton
    );


    /* =====================================================
       URL
    ===================================================== */

    const urlContainer =
        document.createElement(
            "div"
        );


    urlContainer.className =
        "generate-video-url-container";


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";

    urlInput.className =
        "generate-video-url";

    urlInput.placeholder =
        definition.placeholder ||
        "Masukkan URL video MP4/WebM atau link FB / TikTok / Threads";

    urlInput.autocomplete =
        "off";


    urlInput.style.setProperty(
        "width",
        "100%",
        "important"
    );


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !== undefined &&
        defaultValue !== null
    ) {

        urlInput.value =
            String(
                Array.isArray(
                    defaultValue
                )
                    ? (
                        defaultValue[0] ||
                        ""
                    )
                    : defaultValue
            );

    }


    /* =====================================================
       UPLOAD
    ===================================================== */

    const uploadContainer =
        document.createElement(
            "div"
        );


    uploadContainer.className =
        "generate-video-upload-container";


    uploadContainer.style.display =
        "none";


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";

    fileInput.accept =
        definition.accept ||
        "video/mp4,video/webm,.mp4,.webm";

    fileInput.multiple =
        false;

    fileInput.className =
        "generate-video-file";


    uploadContainer.appendChild(
        fileInput
    );


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-video-preview";


    preview.style.display =
        "none";

    preview.style.marginTop =
        "10px";


    const video =
        createVideoPreview(
            preview
        );

    let sourceVideoFile = null;
    let sourceVideoDuration = 0;
    wrapper._videoSelectionPending = false;
    wrapper._videoSelectedFile = null;

    const trimPanel = document.createElement("section");
    trimPanel.className = "generate-audio-trim-panel generate-video-trim-panel";
    trimPanel.hidden = true;

    const trimHeading = document.createElement("div");
    trimHeading.className = "generate-audio-trim-heading";
    const trimEyebrow = document.createElement("span");
    trimEyebrow.textContent = "VIDEO EDITOR";
    const trimTitle = document.createElement("strong");
    trimTitle.textContent = "Pilih bagian video";
    trimHeading.append(trimEyebrow, trimTitle);

    const trimDescription = document.createElement("p");
    trimDescription.className = "generate-audio-trim-description";
    trimDescription.textContent =
        "Tentukan titik mulai dan akhir. Klip dipotong sebelum diunggah.";

    const trimControls = document.createElement("div");
    trimControls.className = "generate-audio-trim-controls";

    function createTrimControl(labelText, inputType, className) {
        const group = document.createElement("label");
        group.className = "generate-audio-trim-control";
        const label = document.createElement("span");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = inputType;
        input.className = className;
        input.step = "0.01";
        if (inputType === "number") {
            input.min = "0";
            input.inputMode = "decimal";
            input.setAttribute("aria-label", `${labelText} (detik)`);
        }
        group.append(label, input);
        return { group, input };
    }

    const startRangeControl = createTrimControl(
        "MULAI",
        "range",
        "generate-video-trim-start-range"
    );
    const endRangeControl = createTrimControl(
        "AKHIR",
        "range",
        "generate-video-trim-end-range"
    );
    const startNumberControl = createTrimControl(
        "Mulai (detik)",
        "number",
        "generate-video-trim-start-number"
    );
    const endNumberControl = createTrimControl(
        "Akhir (detik)",
        "number",
        "generate-video-trim-end-number"
    );
    trimControls.append(
        startRangeControl.group,
        endRangeControl.group,
        startNumberControl.group,
        endNumberControl.group
    );

    const trimActions = document.createElement("div");
    trimActions.className = "generate-audio-trim-actions";
    const useWholeButton = document.createElement("button");
    useWholeButton.type = "button";
    useWholeButton.className = "generate-audio-trim-whole";
    useWholeButton.textContent = "Gunakan video utuh";
    const trimButton = document.createElement("button");
    trimButton.type = "button";
    trimButton.className = "generate-audio-trim-submit";
    trimButton.textContent = "Potong & gunakan klip";
    const trimProgress = document.createElement("progress");
    trimProgress.className = "generate-video-trim-progress";
    trimProgress.max = 100;
    trimProgress.hidden = true;
    trimProgress.setAttribute("aria-label", "Progres pemotongan video");
    trimActions.append(useWholeButton, trimButton, trimProgress);

    const trimStatus = document.createElement("p");
    trimStatus.className = "generate-audio-trim-status";
    trimStatus.setAttribute("role", "status");
    trimStatus.setAttribute("aria-live", "polite");

    trimPanel.append(
        trimHeading,
        trimDescription,
        trimControls,
        trimActions,
        trimStatus
    );
    preview.appendChild(trimPanel);


    function renderPreview(
        file
    ) {

        video.removeAttribute(
            "src"
        );

        video.load();


        if (
            !file
        ) {

            preview.style.display =
                "none";

            return;

        }


        const previousUrl =
            video.dataset.objectUrl;


        if (
            previousUrl
        ) {

            try {

                URL.revokeObjectURL(
                    previousUrl
                );

            } catch {
                /* ignore */
            }

        }


        const objectUrl =
            URL.createObjectURL(
                file
            );


        video.src =
            objectUrl;

        video.dataset.objectUrl =
            objectUrl;

        video.onloadedmetadata = () => {
            if (file !== sourceVideoFile) return;
            if (!Number.isFinite(video.duration) || video.duration <= 0) {
                trimStatus.textContent =
                    "Durasi video tidak dapat dibaca. Coba file MP4 atau WebM lain.";
                trimButton.disabled = true;
                return;
            }

            sourceVideoDuration = video.duration;
            for (const input of [
                startRangeControl.input,
                endRangeControl.input,
                startNumberControl.input,
                endNumberControl.input
            ]) {
                input.min = "0";
                input.max = String(sourceVideoDuration);
            }
            startRangeControl.input.value = "0";
            startNumberControl.input.value = "0";
            endRangeControl.input.value = String(sourceVideoDuration);
            endNumberControl.input.value = sourceVideoDuration.toFixed(2);
            trimStatus.textContent =
                `Durasi sumber ${sourceVideoDuration.toFixed(2)} detik.`;
            trimButton.disabled = sourceVideoDuration < 0.1;
            useWholeButton.disabled = false;
        };

        preview.style.display =
            "block";

    }


    function clearPreview(
        preserveEditor = false
    ) {

        const objectUrl =
            video.dataset.objectUrl;


        if (
            objectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    objectUrl
                );

            } catch {
                /* ignore */
            }

        }


        delete video.dataset.objectUrl;


        video.removeAttribute(
            "src"
        );

        video.load();


        preview.style.display =
            "none";

        if (!preserveEditor) {
            trimPanel.hidden = true;
            sourceVideoFile = null;
            sourceVideoDuration = 0;
            wrapper._videoSelectionPending = false;
            wrapper._videoSelectedFile = null;
            delete wrapper._genzaiUploadedUrls;
        }

    }

    async function uploadSelectedVideo(
        file,
        clipDuration = null
    ) {
        validateVideo(file);

        const myToken = ++uploadToken;
        wrapper._videoSelectionPending = false;
        wrapper._videoSelectedFile = file;
        delete wrapper._genzaiUploadedUrls;
        delete wrapper.dataset.uploadedUrl;
        clearUploadError(wrapper);
        renderPreview(file);
        trimPanel.hidden = false;
        trimStatus.textContent = clipDuration === null
            ? "Mengunggah video utuh..."
            : `Klip ${clipDuration.toFixed(2)} detik siap. Mengunggah klip pilihan...`;
        useWholeButton.disabled = true;
        trimButton.disabled = true;
        setUploadState(wrapper, "uploading", "Mengunggah video pilihan...");

        wrapper._videoUploadPromise = (async () => {
            try {
                const uploaded = await uploadVideo(file);
                const uploadedUrl = extractUploadUrl(uploaded);
                if (!uploadedUrl) {
                    throw new Error(
                        "Upload video berhasil tetapi URL video tidak tersedia."
                    );
                }
                if (myToken !== uploadToken) return "";

                wrapper.dataset.uploadedUrl = uploadedUrl;
                wrapper.dataset.uploadState = "done";
                setUploadState(
                    wrapper,
                    "done",
                    clipDuration === null
                        ? "✓ Video utuh berhasil diunggah"
                        : "✓ Klip video berhasil diunggah dan siap digunakan"
                );
                if (clipDuration !== null) {
                    showVideoClipNotice(file, clipDuration);
                }
                return uploadedUrl;
            } catch (error) {
                if (myToken === uploadToken) {
                    console.error(
                        "[GEN-Z.AI][Generate Form] Upload video gagal:",
                        error
                    );
                    delete wrapper.dataset.uploadedUrl;
                    wrapper.dataset.uploadError =
                        String(error?.message || "Gagal mengupload video.");
                    showUploadError(wrapper, wrapper.dataset.uploadError);
                    setUploadState(wrapper, "failed", "✗ Gagal mengunggah video");
                    trimStatus.textContent = wrapper.dataset.uploadError;
                }
                return "";
            } finally {
                if (myToken === uploadToken) {
                    useWholeButton.disabled = false;
                    trimButton.disabled = sourceVideoDuration < 0.1;
                    wrapper._videoUploadPromise = null;
                }
            }
        })();

        return await wrapper._videoUploadPromise;
    }


    function syncTrimInputs(source) {
        const start = source === "start-range"
            ? Number(startRangeControl.input.value)
            : Number(startNumberControl.input.value);
        const end = source === "end-range"
            ? Number(endRangeControl.input.value)
            : Number(endNumberControl.input.value);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;

        if (source === "start-range" || source === "start-number") {
            const nextStart = Math.max(
                0,
                Math.min(start, sourceVideoDuration - 0.1)
            );
            startNumberControl.input.value = nextStart.toFixed(2);
            startRangeControl.input.value = String(nextStart);
            if (end - nextStart < 0.1) {
                const nextEnd = Math.min(
                    sourceVideoDuration,
                    nextStart + 0.1
                );
                endNumberControl.input.value = nextEnd.toFixed(2);
                endRangeControl.input.value = String(nextEnd);
            }
        } else {
            const nextEnd = Math.max(
                0.1,
                Math.min(end, sourceVideoDuration)
            );
            endNumberControl.input.value = nextEnd.toFixed(2);
            endRangeControl.input.value = String(nextEnd);
            if (nextEnd - start < 0.1) {
                const nextStart = Math.max(0, nextEnd - 0.1);
                startNumberControl.input.value = nextStart.toFixed(2);
                startRangeControl.input.value = String(nextStart);
            }
        }

        const selectedDuration =
            Number(endNumberControl.input.value) -
            Number(startNumberControl.input.value);
        trimStatus.textContent =
            `Klip terpilih ${selectedDuration.toFixed(2)} detik dari ${sourceVideoDuration.toFixed(2)} detik.`;
    }


    for (const [control, source] of [
        [startRangeControl.input, "start-range"],
        [startNumberControl.input, "start-number"],
        [endRangeControl.input, "end-range"],
        [endNumberControl.input, "end-number"]
    ]) {
        control.addEventListener("input", () => syncTrimInputs(source));
    }

    useWholeButton.addEventListener("click", async () => {
        if (!sourceVideoFile) return;
        await uploadSelectedVideo(sourceVideoFile);
    });

    trimButton.addEventListener("click", async () => {
        if (!sourceVideoFile || !sourceVideoDuration) return;

        const sourceFile = sourceVideoFile;
        const selectionToken = uploadToken;
        const start = Number(startNumberControl.input.value);
        const end = Number(endNumberControl.input.value);
        useWholeButton.disabled = true;
        trimButton.disabled = true;
        trimProgress.hidden = false;
        trimProgress.removeAttribute("value");
        trimButton.textContent = "Menyiapkan FFmpeg…";
        trimStatus.textContent = "Memotong video. Proses dapat memerlukan waktu...";

        try {
            const clip = await createVideoClip(
                sourceFile,
                start,
                end,
                ({ stage, progress }) => {
                    if (stage === "prepare") {
                        trimProgress.removeAttribute("value");
                        trimButton.textContent = "Menyiapkan FFmpeg…";
                        trimStatus.textContent = "Menyiapkan mesin pemotong video...";
                        return;
                    }

                    const percentage = Math.round(
                        Math.max(0, Math.min(1, progress)) * 100
                    );
                    trimProgress.value = percentage;
                    trimButton.textContent = `Memotong ${percentage}%`;
                    trimStatus.textContent = `Progres pemotongan video ${percentage}%`;
                }
            );
            if (
                selectionToken !== uploadToken ||
                sourceVideoFile !== sourceFile
            ) {
                return;
            }
            await uploadSelectedVideo(clip, end - start);
        } catch (error) {
            if (
                selectionToken === uploadToken &&
                sourceVideoFile === sourceFile
            ) {
                console.error(
                    "[GEN-Z.AI][Generate Form] Pemotongan video gagal:",
                    error
                );
                trimStatus.textContent =
                    error?.message || "Klip video gagal dipotong.";
                useWholeButton.disabled = false;
                trimButton.disabled = false;
            }
        } finally {
            if (
                selectionToken === uploadToken &&
                sourceVideoFile === sourceFile
            ) {
                trimProgress.hidden = true;
                trimButton.textContent = "Potong & gunakan klip";
            }
        }
    });


    /* =====================================================
       MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const uploadMode =
            mode === "upload";


        if (
            uploadMode
        ) {

            urlContainer.style.display =
                "none";

            uploadContainer.style.display =
                "block";


            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "false"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "true"
            );


            if (
                fileInput.files &&
                fileInput.files.length
            ) {

                sourceVideoFile =
                    wrapper._videoSelectedFile ||
                    fileInput.files[0];
                renderPreview(
                    sourceVideoFile
                );
                trimPanel.hidden = false;

            }

        } else {

            urlContainer.style.display =
                "block";

            uploadContainer.style.display =
                "none";


            const hasFbVideoPreview =
                Boolean(wrapper.dataset.fbProcessedForUrl) &&
                wrapper.dataset.fbProcessedForUrl === String(urlInput.value || "").trim() &&
                Boolean(sourceVideoFile);

            if (hasFbVideoPreview) {
                renderPreview(
                    wrapper._videoSelectedFile ||
                    sourceVideoFile
                );
                trimPanel.hidden = false;
            } else {
                clearPreview(true);
            }


            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "true"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "false"
            );

        }


        wrapper.dataset.videoMode =
            uploadMode
                ? "upload"
                : "url";

    }


    /* =====================================================
       BUTTON EVENTS
    ===================================================== */

    urlButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "upload"
            );

        }
    );


    /* =====================================================
       FILE CHANGE
    ===================================================== */

    fileInput.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    fileInput.files || []
                );


            /* =============================================
               CLEAR OLD STATE
            ============================================= */

            clearUploadError(
                wrapper
            );


            /* =============================================
               EMPTY SELECTION
            ============================================= */

            if (
                !files.length
            ) {

                delete wrapper.dataset.uploadedUrl;

                wrapper._videoUploadPromise =
                    null;

                wrapper._videoSelectionPending = false;
                wrapper._videoSelectedFile = null;
                sourceVideoFile = null;
                sourceVideoDuration = 0;
                uploadToken += 1;
                delete wrapper._genzaiUploadedUrls;

                setUploadState(
                    wrapper,
                    ""
                );

                clearPreview();

                return;

            }


            const file =
                files[0];


            try {

                validateVideo(
                    file
                );

                uploadToken += 1;
                sourceVideoFile = file;
                sourceVideoDuration = 0;
                wrapper._videoSelectionPending = true;
                wrapper._videoSelectedFile = null;
                wrapper._videoUploadPromise = null;
                delete wrapper._genzaiUploadedUrls;
                delete wrapper.dataset.uploadedUrl;
                renderPreview(
                    file
                );
                trimPanel.hidden = false;
                trimButton.disabled = true;
                useWholeButton.disabled = true;
                trimStatus.textContent =
                    "Pilih video utuh atau potong bagian yang ingin digunakan.";
                setUploadState(wrapper, "");


            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Video upload gagal:",
                    error
                );


                delete wrapper.dataset.uploadedUrl;


                try {

                    fileInput.value =
                        "";

                } catch {
                    /* ignore */
                }


                clearPreview();


                const errorMessage =
                    String(
                        error?.message ||
                        "Gagal mengupload video."
                    );


                wrapper.dataset.uploadError =
                    errorMessage;


                showUploadError(
                    wrapper,
                    errorMessage
                );


                setUploadState(
                    wrapper,
                    "failed",
                    "✗ Gagal mengunggah video"
                );

            } finally {

                wrapper._videoUploadPromise =
                    null;

            }

        }
    );


    const fbVideoControls = attachFacebookUrlControls(
        urlContainer,
        urlInput,
        {
            kindLabel: "video referensi",
            onUrlChanged: nextVal => {
                if (
                    wrapper.dataset.fbProcessedForUrl &&
                    wrapper.dataset.fbProcessedForUrl !== nextVal
                ) {
                    uploadToken += 1;
                    delete wrapper.dataset.fbProcessedForUrl;
                    delete wrapper.dataset.uploadedUrl;
                    delete wrapper._genzaiUploadedUrls;
                    wrapper._videoSelectionPending = false;
                    wrapper._videoSelectedFile = null;
                    clearPreview();
                    clearUploadError(wrapper);
                    setUploadState(wrapper, "");
                }
            },
            onProcess: async (trimmedUrl, { setBusy }) => {
                clearUploadError(wrapper);
                if (!trimmedUrl) {
                    showUploadError(wrapper, "Masukkan link Facebook, TikTok, atau Threads terlebih dahulu.");
                    return;
                }
                if (!detectSocialMediaUrlProvider(trimmedUrl)) {
                    showUploadError(
                        wrapper,
                        "URL langsung dapat dipakai tanpa Proses, atau tempelkan link Facebook (GetMyFB), TikTok (SSSTik), maupun Threads (ThreadsDownloader)."
                    );
                    return;
                }

                const labels = getSocialMediaProviderLabels(trimmedUrl);
                const myToken = ++uploadToken;
                setBusy(true);
                delete wrapper.dataset.fbProcessedForUrl;
                delete wrapper.dataset.uploadedUrl;
                delete wrapper._genzaiUploadedUrls;
                setUploadState(
                    wrapper,
                    "uploading",
                    `Memproses link ${labels.platformName} lewat ${labels.serviceName} & mengunduh video...`
                );

                const processTask = (async () => {
                    try {
                        const downloaded = await downloadFacebookMediaFromServer(
                            trimmedUrl,
                            "video"
                        );
                        if (myToken !== uploadToken) return "";

                        const mime = downloaded.contentType === "video/webm"
                            ? "video/webm"
                            : "video/mp4";
                        const ext = mime === "video/webm" ? "webm" : "mp4";
                        const safeName = /\.(mp4|webm)$/i.test(downloaded.filename)
                            ? downloaded.filename
                            : `${downloaded.filename.replace(/\.[^.]+$/, "")}.${ext}`;

                        const videoFile = new File(
                            [downloaded.blob],
                            safeName,
                            {
                                type: mime,
                                lastModified: Date.now()
                            }
                        );

                        validateVideo(videoFile);
                        if (myToken !== uploadToken) return "";

                        sourceVideoFile = videoFile;
                        sourceVideoDuration = 0;
                        wrapper.dataset.fbProcessedForUrl = trimmedUrl;
                        wrapper.dataset.uploadSource = labels.provider;

                        /* Simpan hasil unduhan ke storage sehingga langsung siap dipakai,
                           sekaligus tampilkan panel VIDEO EDITOR (cut video) agar pengguna
                           tetap bisa memotong klip dan memakai hasil akhirnya sebagai Video Referensi. */
                        const uploadedUrl = await uploadSelectedVideo(videoFile);
                        if (!uploadedUrl) {
                            delete wrapper.dataset.fbProcessedForUrl;
                            return "";
                        }

                        trimPanel.hidden = false;
                        setUploadState(
                            wrapper,
                            "done",
                            `✓ Video ${labels.platformName} berhasil diunduh lewat ${labels.serviceName} & disimpan. Anda bisa langsung pakai atau potong klip video di bawah.`
                        );
                        return uploadedUrl;
                    } catch (error) {
                        if (myToken === uploadToken) {
                            delete wrapper.dataset.fbProcessedForUrl;
                            delete wrapper.dataset.uploadedUrl;
                            clearPreview();
                            const errorMessage = String(
                                error?.message ||
                                `Gagal memproses video dari link ${labels.platformName}.`
                            );
                            wrapper.dataset.uploadError = errorMessage;
                            showUploadError(wrapper, errorMessage);
                            setUploadState(
                                wrapper,
                                "failed",
                                `✗ Gagal memproses link ${labels.platformName}`
                            );
                        }
                        return "";
                    } finally {
                        setBusy(false);
                    }
                })();

                wrapper._fbProcessPromise = processTask;
                try {
                    await processTask;
                } finally {
                    if (wrapper._fbProcessPromise === processTask) {
                        wrapper._fbProcessPromise = null;
                    }
                }
            }
        }
    );

    urlInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();
                if (detectSocialMediaUrlProvider(urlInput.value)) {
                    fbVideoControls.triggerProcess();
                }

            }

        }
    );


    /* =====================================================
       HELPERS
    ===================================================== */

    wrapper._videoUploadPromise =
        null;

    wrapper._videoMode =
        () =>
            wrapper.dataset.videoMode ||
            "url";

    wrapper._urlInput =
        urlInput;

    wrapper._fileInput =
        fileInput;

    wrapper._preview =
        preview;


    wrapper.getInputMode =
        () =>
            wrapper.dataset.videoMode ||
            "url";


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getFileInput =
        () =>
            fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


    wrapper.getVideoMode =
        () =>
            wrapper.dataset.videoMode ||
            "url";


    /* =====================================================
       UNGGAHAN TERSIMPAN (VIDEO)
       -----------------------------------------------------
       Video yang sudah diunggah dipakai utuh. Pemotongan
       klip hanya tersedia untuk file lokal, karena butuh
       File asli — UI mengatakannya apa adanya.
    ===================================================== */

    function applyStoredVideo(
        entry
    ) {

        if (
            !entry?.url
        ) {

            throw new Error(
                "URL video tidak tersedia."
            );
        }


        uploadToken +=
            1;

        wrapper._videoUploadPromise =
            null;

        wrapper._videoSelectionPending =
            false;

        wrapper._videoSelectedFile =
            null;

        sourceVideoFile =
            null;

        sourceVideoDuration =
            0;


        try {

            fileInput.value =
                "";

        } catch {
            /* ignore */
        }


        clearUploadError(
            wrapper
        );

        delete wrapper._genzaiUploadedUrls;
        delete wrapper.dataset.uploadedUrls;


        const objectUrl =
            video.dataset.objectUrl;


        if (
            objectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    objectUrl
                );

            } catch {
                /* ignore */
            }
        }


        delete video.dataset.objectUrl;

        video.onloadedmetadata =
            null;

        video.src =
            entry.url;

        preview.style.display =
            "block";


        trimPanel.hidden =
            true;

        trimButton.disabled =
            true;

        useWholeButton.disabled =
            true;

        trimStatus.textContent =
            "Video dari unggahan tersimpan dipakai utuh (tidak dipotong ulang).";


        wrapper.dataset.uploadedUrl =
            entry.url;

        wrapper.dataset.uploadSource =
            "stored";

        wrapper.dataset.storedUploadPath =
            String(
                entry.path ||
                ""
            );


        setUploadState(
            wrapper,
            "done",
            `✓ Memakai unggahan tersimpan: ${entry.name} · ${formatStoredUploadRemaining(entry.expiresAt)}`
        );
    }


    const storedUploadsPanel =
        createStoredUploadsPanel({
            kinds:
                ["video"],

            getContext:
                getStoredUploadContext,

            onPick:
                entry =>
                    applyStoredVideo(
                        entry
                    )
        });


    wrapper.setUploadedUrl =
        url => {

            const normalized =
                String(
                    url ||
                    ""
                ).trim();


            if (
                normalized
            ) {

                wrapper.dataset.uploadedUrl =
                    normalized;

            } else {

                delete wrapper.dataset.uploadedUrl;

            }


            return normalized;

        };


    wrapper.clearUploadedFile =
        async () => {

            fileInput.value =
                "";

            urlInput.value =
                "";

            clearPreview();


            delete wrapper.dataset.uploadedUrl;
            delete wrapper.dataset.fbProcessedForUrl;
            delete wrapper.dataset.uploadState;

            delete wrapper.dataset.uploadSource;
            delete wrapper.dataset.storedUploadPath;

            fbVideoControls.syncHint();


            clearUploadError(
                wrapper
            );

            setUploadState(
                wrapper,
                ""
            );


            wrapper._videoUploadPromise =
                null;

            delete wrapper._genzaiUploadedUrls;


            /* Invalidate stale uploads */
            uploadToken +=
                1;


            setMode(
                "url"
            );

        };


    /* =====================================================
       APPEND
    ===================================================== */

    wrapper.appendChild(
        modeSelector
    );

    wrapper.appendChild(
        urlContainer
    );

    uploadContainer.appendChild(
        storedUploadsPanel.element
    );


    wrapper.appendChild(
        uploadContainer
    );

    wrapper.appendChild(
        preview
    );


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   PUBLIC API
========================================================= */

function getMediaMaxItems(definition = {}) {
    const configured = Number(
        definition.maxItems ??
        definition.max_items ??
        (definition.multiple === true ? 9 : 1)
    );

    return Number.isFinite(configured) && configured > 0
        ? Math.floor(configured)
        : 1;
}


function createMediaCollectionField(
    baseFactory,
    definition = {},
    parameterName = "",
    kind = "gambar"
) {
    const maxItems = getMediaMaxItems(definition);
    if (maxItems <= 1) {
        return baseFactory(definition, parameterName);
    }

    const isVideo = kind === "video";
    const baseClass = isVideo ? "generate-video-input" : "generate-image-input";
    const wrapper = document.createElement("div");
    const list = document.createElement("div");
    const addButton = document.createElement("button");
    const entries = [];

    wrapper.className = `${baseClass} generate-media-collection`;
    wrapper.dataset.parameter = parameterName;
    wrapper.dataset.mediaCollection = kind;
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "10px";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";

    addButton.type = "button";
    addButton.className = "btn btn-secondary generate-add-media-item";

    function updateCollectionControls() {
        addButton.disabled = entries.length >= maxItems;
        addButton.textContent = `+ Tambah ${kind === "video" ? "video" : "gambar"} (${entries.length}/${maxItems})`;

        for (const entry of entries) {
            entry.removeButton.hidden = entries.length <= 1;
        }
    }

    function addEntry(value) {
        if (entries.length >= maxItems) return null;

        const row = document.createElement("div");
        const itemDefinition = {
            ...definition,
            maxItems: 1,
            max_items: 1,
            multiple: false
        };

        if (value !== undefined && value !== null && value !== "") {
            itemDefinition.default = value;
        } else {
            delete itemDefinition.default;
            delete itemDefinition.default_value;
            delete itemDefinition.value;
        }

        const field = baseFactory(itemDefinition, parameterName);
        field.classList.remove(baseClass);
        field.classList.add("generate-media-collection-item");

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "btn btn-secondary generate-remove-media-item";
        removeButton.textContent = "Hapus";
        removeButton.setAttribute("aria-label", `Hapus ${kind === "video" ? "video" : "gambar"}`);
        removeButton.addEventListener("click", async () => {
            if (typeof field.clearUploadedFile === "function") {
                await field.clearUploadedFile();
            }
            const index = entries.findIndex(entry => entry.field === field);
            if (index >= 0) entries.splice(index, 1);
            row.remove();
            updateCollectionControls();
        });

        row.className = "generate-media-collection-row";
        row.append(field, removeButton);
        list.appendChild(row);
        entries.push({ field, removeButton });
        updateCollectionControls();
        return field;
    }

    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;
    const initialValues = Array.isArray(defaultValue)
        ? defaultValue.slice(0, maxItems)
        : defaultValue != null && defaultValue !== ""
            ? [defaultValue]
            : [];

    initialValues.forEach(value => addEntry(value));
    if (entries.length === 0) addEntry();

    addButton.addEventListener("click", () => addEntry()?.focus?.());
    wrapper.getMediaItems = () => entries.map(entry => entry.field);
    wrapper.clearUploadedFile = async () => {
        await Promise.all(entries.map(entry =>
            typeof entry.field.clearUploadedFile === "function"
                ? entry.field.clearUploadedFile()
                : Promise.resolve()
        ));
    };
    wrapper.append(list, addButton);
    updateCollectionControls();
    return wrapper;
}


export function createImageArrayField(definition = {}, parameterName = "image_urls") {
    return createMediaCollectionField(
        createImageField,
        definition,
        parameterName,
        "gambar"
    );
}


export function createVideoArrayField(definition = {}, parameterName = "video_urls") {
    return createMediaCollectionField(
        createVideoField,
        definition,
        parameterName,
        "video"
    );
}

export default Object.freeze({
    registerImageMediaHandlers,
    registerAudioMediaHandlers,
    registerVideoMediaHandlers,
    createImageField,
    createImageArrayField,
    createAudioField,
    createVideoField,
    createVideoArrayField
});
