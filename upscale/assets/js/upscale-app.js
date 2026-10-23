/* =========================================================
   GEN-Z.AI — UPSCALE APP
   ---------------------------------------------------------
   Flow:
     1. Wait for navigation ready
     2. Load user + credit
     3. User upload foto/video → validate → preview
     4. User pilih target → klik Upscale
     5. Foto/video diunggah sementara ke Supabase Storage
     6. Kirim URL ke backend /api/generate
     7. Backend deduct credit + create history + trigger workflow
     8. Video di-upscale + diinterpolasi di server; hasil masuk History
========================================================= */

"use strict";


const CONFIG = Object.freeze({
    /* Bucket privat: input tidak bisa diakses publik tanpa signed URL. */
    bucket: "user-uploads",
    uploadUrlTtlSeconds: 60 * 60,
    photoInputFolder: "upscale-photos/inputs",
    videoInputFolder: "upscale-videos/inputs",
    apiEndpoint: "/api/generate",
    maxPhotoSize: 20 * 1024 * 1024,
    maxVideoSize: 100 * 1024 * 1024,
    maxVideoUploadSize: 48_000_000,
    targetCompressedVideoSize: 44_000_000,
    maxVideoDuration: 15,
    allowedPhotoTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedVideoTypes: [
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-m4v"
    ],
    requestTimeout: 60000
});

const MAX_COMPRESSED_VIDEO_EDGE = 1280;
const COMPRESSED_VIDEO_FPS = 20;


/* =========================================================
   STATE
========================================================= */

const state = {
    user: null,
    session: null,
    credit: null,
    file: null,
    mediaType: null,
    previewUrl: null,
    fileSelectionVersion: 0,
    target: "2k",
    processing: false,
    dom: {}
};


/* =========================================================
   DOM RESOLVER
========================================================= */

function resolveDom() {

    const ids = [
        "dropzone", "fileInput", "uploadState", "previewState",
        "previewImg", "previewVideo", "fileName", "fileSize", "browseBtn", "removeBtn",
        "targetGrid", "upscaleBtn", "upscaleBtnText", "upscaleSpinner",
        "statusMessage", "resultArea", "resultActions", "creditValue",
        "loadingOverlay", "loadingTitle", "loadingText",
        "videoProcessingNote", "engineInfo", "engineDescription",
        "timeInfo", "timeDescription", "outputInfo", "outputDescription"
    ];

    ids.forEach(id => {
        state.dom[id] = document.getElementById(id);
    });
}


/* =========================================================
   UTIL
========================================================= */

function formatBytes(bytes) {

    const v = Number(bytes);

    if (!Number.isFinite(v) || v <= 0) return "0 B";
    if (v < 1024) return v + " B";
    if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";

    return (v / (1024 * 1024)).toFixed(2) + " MB";
}


function readSessionFromStorage() {

    try {
        const config = window.GENZ_CONFIG;
        if (!config?.SUPABASE_URL) return null;

        const match = config.SUPABASE_URL.match(/https:\/\/([^.]+)/);
        if (!match) return null;

        const key = "sb-" + match[1] + "-auth-token";
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const session = JSON.parse(raw);
        if (!session?.access_token) return null;

        return session;
    } catch {
        return null;
    }
}


function getSupabaseClient() {

    if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
    if (window.supabaseClient) return window.supabaseClient;

    const supabaseGlobal = window.supabase;
    const config = window.GENZ_CONFIG;

    if (!supabaseGlobal?.createClient) return null;
    if (!config?.SUPABASE_URL) return null;

    const key = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY;
    if (!key) return null;

    try {
        const client = supabaseGlobal.createClient(config.SUPABASE_URL, key);
        window.GENZ_SUPABASE = client;
        window.supabaseClient = client;
        return client;
    } catch {
        return null;
    }
}


function showStatus(message, type = "info") {

    const el = state.dom.statusMessage;
    if (!el) return;

    el.textContent = message;
    el.className = "status-message " + type;
    el.hidden = false;
}


function hideStatus() {

    const el = state.dom.statusMessage;
    if (!el) return;

    el.hidden = true;
    el.textContent = "";
}


function showLoading(title, text) {

    const { loadingOverlay, loadingTitle, loadingText } = state.dom;
    if (!loadingOverlay) return;

    if (loadingTitle) loadingTitle.textContent = title || "Memproses...";
    if (loadingText) loadingText.textContent = text || "Mohon tunggu";
    loadingOverlay.hidden = false;

    document.body.style.overflow = "hidden";
}


function hideLoading() {

    const el = state.dom.loadingOverlay;
    if (el) el.hidden = true;

    document.body.style.overflow = "";
}


/* =========================================================
   CREDIT
========================================================= */

async function loadCredit() {

    const supabase = getSupabaseClient();
    if (!supabase || !state.user?.id) return;

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("credits")
            .eq("id", state.user.id)
            .maybeSingle();

        if (error || !data) return;

        state.credit = Number(data.credits) || 0;

        if (state.dom.creditValue) {
            state.dom.creditValue.textContent = state.credit.toLocaleString("id-ID");
        }
    } catch {
        /* ignore */
    }
}


/* =========================================================
   FILE HANDLING
========================================================= */

async function validateFile(file) {

    if (!file) throw new Error("File tidak ditemukan.");

    if (CONFIG.allowedPhotoTypes.includes(file.type)) {
        if (file.size > CONFIG.maxPhotoSize) {
            throw new Error("Ukuran foto maksimal 20 MB.");
        }

        return "image";
    }

    if (CONFIG.allowedVideoTypes.includes(file.type)) {
        if (file.size > CONFIG.maxVideoSize) {
            throw new Error("Ukuran video maksimal 100 MB.");
        }

        const duration = await getVideoDuration(file);
        if (duration > CONFIG.maxVideoDuration) {
            throw new Error("Durasi video maksimal 15 detik.");
        }

        return "video";
    }

    throw new Error("Format tidak didukung. Gunakan JPG, PNG, WebP, MP4, WebM, MOV, atau M4V.");
}


function getVideoDuration(file) {

    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const url = URL.createObjectURL(file);
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error("Durasi video tidak dapat dibaca."));
        }, 15000);

        video.preload = "metadata";
        video.onloadedmetadata = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);

            if (!Number.isFinite(video.duration) || video.duration <= 0) {
                reject(new Error("Durasi video tidak valid."));
                return;
            }

            resolve(video.duration);
        };
        video.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error("Video tidak dapat dibaca oleh browser."));
        };
        video.src = url;
    });
}

function updateMediaControls() {
    const isVideo = state.mediaType === "video";
    const featureId = isVideo ? "upscale_video" : "upscale";
    const creditLabel = document.getElementById("upscaleCreditLabel");
    document.body.dataset.featureCredit = featureId;
    if (creditLabel) {
        creditLabel.textContent = isVideo
            ? "Biaya Upscale Video"
            : "Biaya Upscale Foto";
    }
    if (typeof window.GENZFeatureCredit?.setFeature === "function") {
        window.GENZFeatureCredit.setFeature(featureId);
    } else {
        document.querySelectorAll("[data-feature-credit-cost]").forEach(element => {
            element.dataset.featureCreditCost = featureId;
        });
    }

    const options = state.dom.targetGrid?.querySelectorAll(".target-option") || [];
    if (isVideo && state.target === "4k") {
        state.target = "2k";
    }

    options.forEach(option => {
        const imageOnlyTarget =
            option.dataset.target === "1080p" ||
            option.dataset.target === "1k";
        option.hidden = isVideo
            ? option.dataset.target === "4k"
            : imageOnlyTarget;
        option.classList.toggle(
            "active",
            option.dataset.target === state.target
        );
    });

    if (state.dom.videoProcessingNote) {
        state.dom.videoProcessingNote.hidden = !isVideo;
    }

    if (state.dom.engineInfo) {
        state.dom.engineInfo.textContent = isVideo
            ? "FFmpeg Motion Interpolation"
            : "Real-ESRGAN";
    }
    if (state.dom.engineDescription) {
        state.dom.engineDescription.textContent = isVideo
            ? "Lanczos + penajaman + estimasi gerak"
            : "AI upscaling foto 4× + downscale ke target";
    }
    if (state.dom.timeInfo) {
        state.dom.timeInfo.textContent = isVideo
            ? "Beberapa menit"
            : "~2-4 menit";
    }
    if (state.dom.timeDescription) {
        state.dom.timeDescription.textContent = isVideo
            ? "Diproses di server; durasi bergantung pada video dan target"
            : "Proses berjalan di server GPU/CPU";
    }
    if (state.dom.outputInfo) {
        state.dom.outputInfo.textContent = isVideo
            ? "MP4 · H.264"
            : "JPG / PNG";
    }
    if (state.dom.outputDescription) {
        state.dom.outputDescription.textContent = isVideo
            ? "Hasil video muncul di halaman History"
            : "Foto hasil upscale siap pakai";
    }
}

function showPreview() {

    const {
        uploadState,
        previewState,
        previewImg,
        previewVideo,
        fileName,
        fileSize
    } = state.dom;

    if (uploadState) uploadState.hidden = true;
    if (previewState) previewState.hidden = false;

    if (previewImg) {
        previewImg.hidden = state.mediaType !== "image";
        if (state.mediaType === "image" && state.previewUrl) {
            previewImg.src = state.previewUrl;
        } else {
            previewImg.removeAttribute("src");
        }
    }
    if (previewVideo) {
        previewVideo.hidden = state.mediaType !== "video";
        if (state.mediaType === "video" && state.previewUrl) {
            previewVideo.src = state.previewUrl;
        } else {
            previewVideo.pause();
            previewVideo.removeAttribute("src");
            previewVideo.load();
        }
    }
    if (fileName) fileName.textContent = state.file?.name || "-";
    if (fileSize) fileSize.textContent = formatBytes(state.file?.size || 0);

    updateMediaControls();
    updateUpscaleButton();
}

function hidePreview() {

    const { uploadState, previewState, previewImg, previewVideo } = state.dom;

    if (uploadState) uploadState.hidden = false;
    if (previewState) previewState.hidden = true;
    if (previewImg) previewImg.removeAttribute("src");
    if (previewVideo) {
        previewVideo.pause();
        previewVideo.removeAttribute("src");
        previewVideo.load();
        previewVideo.hidden = true;
    }
    if (previewImg) previewImg.hidden = false;

    updateMediaControls();
    updateUpscaleButton();
}

async function handleFileSelect(file) {
    const selectionVersion = ++state.fileSelectionVersion;

    if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
        state.previewUrl = null;
    }
    state.file = null;
    state.mediaType = null;
    hideStatus();
    hidePreview();

    try {
        const mediaType = await validateFile(file);
        if (selectionVersion !== state.fileSelectionVersion) return;

        state.file = file;
        state.mediaType = mediaType;
        if (mediaType === "image" && !["2k", "4k"].includes(state.target)) {
            state.target = "2k";
        }
        state.previewUrl = URL.createObjectURL(file);

        hideStatus();
        showPreview();

    } catch (err) {
        if (selectionVersion !== state.fileSelectionVersion) return;
        showStatus(err.message, "error");
        state.file = null;
        state.mediaType = null;
        if (state.dom.fileInput) state.dom.fileInput.value = "";
        hidePreview();
    }
}


function clearFile() {
    state.fileSelectionVersion += 1;

    if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
        state.previewUrl = null;
    }

    state.file = null;
    state.mediaType = null;

    const input = state.dom.fileInput;
    if (input) input.value = "";

    hideStatus();
    hidePreview();
}


function getVideoRecorderMimeType() {
    if (
        typeof MediaRecorder === "undefined" ||
        typeof MediaRecorder.isTypeSupported !== "function"
    ) {
        throw new Error("Browser ini tidak mendukung kompresi video. Coba gunakan Chrome versi terbaru.");
    }

    const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4"
    ];
    const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));

    if (!mimeType) {
        throw new Error("Format kompresi video tidak didukung pada perangkat ini.");
    }

    return mimeType;
}

async function encodeVideoAttempt(file, videoBitsPerSecond, mimeType, onProgress) {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const objectUrl = URL.createObjectURL(file);
    let sourceStream = null;
    let canvasStream = null;
    let recorder = null;
    let animationFrame = 0;

    video.preload = "auto";
    video.playsInline = true;
    video.muted = true;
    video.src = objectUrl;

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Video terlalu lama disiapkan untuk kompresi.")),
                30000
            );
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                resolve();
            };
            video.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Video tidak dapat dibuka untuk kompresi."));
            };
        });

        if (!video.videoWidth || !video.videoHeight) {
            throw new Error("Resolusi video sumber tidak valid.");
        }

        const captureSource = video.captureStream || video.mozCaptureStream;
        if (typeof captureSource !== "function" || typeof canvas.captureStream !== "function") {
            throw new Error("Perangkat ini tidak mendukung kompresi video lokal. Coba gunakan Chrome versi terbaru.");
        }

        video.currentTime = 0;
        const scale = Math.min(
            1,
            MAX_COMPRESSED_VIDEO_EDGE / Math.max(video.videoWidth, video.videoHeight)
        );
        canvas.width = Math.max(
            2,
            Math.floor((video.videoWidth * scale) / 2) * 2
        );
        canvas.height = Math.max(
            2,
            Math.floor((video.videoHeight * scale) / 2) * 2
        );
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
            throw new Error("Perangkat tidak dapat menyiapkan kompresi video.");
        }

        sourceStream = captureSource.call(video);
        canvasStream = canvas.captureStream(COMPRESSED_VIDEO_FPS);
        const tracks = [
            ...canvasStream.getVideoTracks(),
            ...sourceStream.getAudioTracks()
        ];
        const outputStream = new MediaStream(tracks);
        recorder = new MediaRecorder(outputStream, {
            mimeType,
            videoBitsPerSecond
        });

        const chunks = [];
        const recording = new Promise((resolve, reject) => {
            let settled = false;
            let recordingTimeout;
            let stopError = null;
            let stopRequested = false;
            let lastProgressUpdate = 0;
            const finalize = () => {
                if (settled) return;
                settled = true;
                clearTimeout(recordingTimeout);
                cancelAnimationFrame(animationFrame);
                canvasStream?.getTracks().forEach(track => track.stop());
                sourceStream?.getTracks().forEach(track => track.stop());
                video.pause();
                video.removeAttribute("src");
                video.load();
                URL.revokeObjectURL(objectUrl);

                if (stopError) {
                    reject(stopError);
                } else {
                    resolve(new Blob(chunks, {
                        type: recorder.mimeType || mimeType
                    }));
                }
            };
            const finish = error => {
                if (settled || stopRequested) return;
                stopRequested = true;
                if (error) stopError = error;
                if (recorder?.state === "recording" || recorder?.state === "paused") {
                    recorder.stop();
                } else if (recorder?.state === "inactive") {
                    finalize();
                }
            };

            recorder.ondataavailable = event => {
                if (event.data.size > 0) chunks.push(event.data);
            };
            recorder.onerror = event => {
                finish(event.error || new Error("Kompresi video gagal."));
            };
            recorder.onstop = finalize;
            video.onended = () => {
                finish();
            };
            video.ontimeupdate = () => {
                if (
                    video.duration > 0 &&
                    video.currentTime >= video.duration - 0.1
                ) {
                    finish();
                }
                const progress = Math.min(
                    99,
                    Math.floor((video.currentTime / video.duration) * 100)
                );
                const now = Date.now();
                if (progress > 0 && now - lastProgressUpdate >= 1000) {
                    lastProgressUpdate = now;
                    onProgress?.(progress);
                }
            };
            sourceStream.getVideoTracks().forEach(track => {
                track.addEventListener("ended", () => {
                    finish();
                }, { once: true });
            });

            const drawFrame = () => {
                if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    try {
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    } catch (error) {
                        finish(error);
                        return;
                    }
                }
                if (
                    video.duration > 0 &&
                    video.currentTime >= video.duration - 0.1
                ) {
                    finish();
                    return;
                }
                if (!video.ended && recorder.state === "recording") {
                    animationFrame = requestAnimationFrame(drawFrame);
                }
            };

            try {
                recordingTimeout = setTimeout(
                    () => finish(new Error("Kompresi video belum selesai. Pastikan aplikasi tetap terbuka dan layar tidak terkunci, lalu coba lagi.")),
                    Math.min(
                        15 * 60 * 1000,
                        Math.max(5 * 60 * 1000, (video.duration * 4000) + 120000)
                    )
                );
                recorder.start(1000);
                animationFrame = requestAnimationFrame(drawFrame);
                video.play().catch(finish);
            } catch (error) {
                finish(error);
            }
        });

        return await recording;
    } catch (error) {
        if (recorder?.state !== "inactive") recorder.stop();
        canvasStream?.getTracks().forEach(track => track.stop());
        sourceStream?.getTracks().forEach(track => track.stop());
        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(objectUrl);
        throw error;
    }
}

async function compressVideoForStorage(file) {
    if (file.size <= CONFIG.targetCompressedVideoSize) return file;

    const mimeType = getVideoRecorderMimeType();
    const duration = await getVideoDuration(file);
    const targetBitsPerSecond = Math.floor(
        (CONFIG.targetCompressedVideoSize * 8 * 0.7) / duration
    );
    const audioBitsPerSecond = 96_000;
    const videoBitsPerSecond = Math.max(
        250_000,
        targetBitsPerSecond - audioBitsPerSecond
    );
    const blob = await encodeVideoAttempt(
        file,
        videoBitsPerSecond,
        mimeType,
        progress => {
            if (state.dom.loadingText) {
                state.dom.loadingText.textContent = `Mengompres video: ${progress}%`;
            }
        }
    );

    if (blob.size <= CONFIG.maxVideoUploadSize) {
        const outputType = blob.type.split(";")[0] || "video/webm";
        const extension = outputType === "video/mp4" ? "mp4" : "webm";
        const name = file.name.replace(/\.[^.]+$/, "") || "video";
        return new File([blob], `${name}-compressed.${extension}`, {
            type: outputType,
            lastModified: Date.now()
        });
    }

    throw new Error("Ukuran video tetap melebihi batas upload 50 MB setelah dikompres. Coba video yang lebih pendek atau lebih kecil.");
}


async function ensureActiveSession(force = false) {
    if (window.GENZSession?.ensureFreshSession) {
        const refreshed = await window.GENZSession.ensureFreshSession({ force });
        if (refreshed?.access_token) {
            state.session = refreshed;
            if (refreshed.user) state.user = refreshed.user;
            return refreshed;
        }
    }

    const stored = readSessionFromStorage();
    if (stored?.access_token) {
        state.session = stored;
        if (stored.user && !state.user) state.user = stored.user;
    }
    return state.session;
}


/* =========================================================
   UPLOAD TO SUPABASE
========================================================= */

async function uploadMedia(file, mediaType) {

    await ensureActiveSession(false);

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client tidak tersedia.");

    if (!state.user?.id) throw new Error("User belum terautentikasi.");

    const extensionByType = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/quicktime": "mov",
        "video/x-m4v": "m4v"
    };
    const ext = extensionByType[file.type];
    const rand = window.crypto?.randomUUID
        ? window.crypto.randomUUID().replace(/-/g, "").slice(0, 8)
        : Math.random().toString(36).slice(2).padEnd(8, "0").slice(0, 8);
    const folder = mediaType === "video"
        ? CONFIG.videoInputFolder
        : CONFIG.photoInputFolder;
    const path = `${folder}/${state.user.id}/${Date.now()}-${rand}.${ext}`;

    const { error } = await supabase.storage
        .from(CONFIG.bucket)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw new Error("Upload gagal: " + error.message);

    const signedResult = await supabase.storage
        .from(CONFIG.bucket)
        .createSignedUrl(path, CONFIG.uploadUrlTtlSeconds);

    const signedUrl = String(signedResult?.data?.signedUrl || "").trim();

    if (!signedUrl) {
        console.error("[GEN-Z.AI][Upscale] Signed URL gagal:", signedResult?.error);
        throw new Error("Signed URL media tidak tersedia.");
    }

    const publicUrl = signedUrl.startsWith("http")
        ? signedUrl
        : String(supabase?.supabaseUrl || "").replace(/\/+$/, "") + signedUrl;

    return { publicUrl, path };
}


/* =========================================================
   BACKEND CALL
========================================================= */

async function callBackend(sourceUrl, mediaType, targetResolution) {

    let session = await ensureActiveSession(false);
    if (!session?.access_token) {
        throw new Error("Session tidak ditemukan. Silakan login ulang.");
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

        try {
            const response = await fetch(CONFIG.apiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + session.access_token
                },
                body: JSON.stringify({
                    action: mediaType === "video"
                        ? "upscale-video-upload"
                        : "upscale-photo",
                    source_url: sourceUrl,
                    target_resolution: targetResolution
                }),
                signal: controller.signal,
                credentials: "same-origin"
            });

            const data = await response.json().catch(() => ({}));

            if (response.status === 401 && attempt === 0) {
                const retrySession = await ensureActiveSession(true);
                if (retrySession?.access_token) {
                    session = retrySession;
                    continue;
                }
            }

            if (!response.ok) {
                throw new Error(
                    data?.error || `HTTP ${response.status}`
                );
            }

            return data;

        } finally {
            clearTimeout(timer);
        }
    }
}


/* =========================================================
   UPSCALE FLOW
========================================================= */

async function startUpscale() {

    if (state.processing) return;
    if (!state.file) {
        showStatus("Upload foto atau video terlebih dahulu.", "error");
        return;
    }

    const mediaType = state.mediaType;
    const targetResolution = state.target;
    const file = state.file;
    state.processing = true;

    const btn = state.dom.upscaleBtn;
    const btnText = state.dom.upscaleBtnText;
    const spinner = state.dom.upscaleSpinner;

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = "MEMPROSES...";
    if (spinner) spinner.hidden = false;

    hideStatus();

    try {
        let uploadFile = file;
        if (
            mediaType === "video" &&
            file.size > CONFIG.targetCompressedVideoSize
        ) {
            showLoading(
                "Mengompres video...",
                `Ukuran sumber ${formatBytes(file.size)}. Mengurangi ukuran agar sesuai dengan batas upload Supabase 50 MB.`
            );
            uploadFile = await compressVideoForStorage(file);
        }

        showLoading(
            mediaType === "video" ? "Mengunggah video..." : "Mengunggah foto...",
            mediaType === "video" && uploadFile !== file
                ? `Video sudah dikompres menjadi ${formatBytes(uploadFile.size)}. Mengunggah file...`
                : "Menyiapkan file untuk upscale"
        );

        const upload = await uploadMedia(uploadFile, mediaType);

        showLoading("Memulai upscale...", "Menghubungi server");

        const result = await callBackend(
            upload.publicUrl,
            mediaType,
            targetResolution
        );

        hideLoading();

        showStatus(
            mediaType === "video"
                ? `Berhasil! Video ${result.target || targetResolution} sedang di-upscale dan dihaluskan. Hasil akan muncul di History setelah proses server selesai.`
                : "Berhasil! Upscale foto sedang diproses. Hasil akan muncul di History dalam beberapa menit.",
            "success"
        );

        if (state.dom.resultActions) state.dom.resultActions.hidden = false;

        await loadCredit();

        setTimeout(() => {
            window.location.href = "/history/index.html";
        }, 3000);

    } catch (err) {

        hideLoading();
        showStatus(err.message || "Upscale gagal.", "error");

    } finally {

        state.processing = false;

        if (btn) btn.disabled = !state.file;
        if (btnText) btnText.textContent = "MULAI UPSCALE";
        if (spinner) spinner.hidden = true;
    }
}


/* =========================================================
   UI UPDATER
========================================================= */

function updateUpscaleButton() {

    const btn = state.dom.upscaleBtn;
    if (!btn) return;

    btn.disabled = !state.file || state.processing;
}


/* =========================================================
   EVENT BINDING
========================================================= */

function bindEvents() {

    const { dropzone, fileInput, browseBtn, removeBtn, targetGrid, upscaleBtn } = state.dom;

    /* ---- Browse ---- */
    if (browseBtn) {
        browseBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fileInput?.click();
        });
    }

    /* ---- File input ---- */
    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            if (file) handleFileSelect(file);
        });
    }

    /* ---- Dropzone click ---- */
    if (dropzone) {
        dropzone.addEventListener("click", (e) => {
            if (e.target.closest("button, input, a")) return;
            if (state.file) return;
            fileInput?.click();
        });

        /* ---- Drag & drop ---- */
        ["dragenter", "dragover"].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                if (state.file) return;
                dropzone.classList.add("dragover");
            });
        });

        ["dragleave", "drop"].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropzone.classList.remove("dragover");
            });
        });

        dropzone.addEventListener("drop", (e) => {
            if (state.file) return;
            const file = e.dataTransfer?.files?.[0];
            if (file) handleFileSelect(file);
        });
    }

    /* ---- Remove ---- */
    if (removeBtn) {
        removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            clearFile();
        });
    }

    /* ---- Target ---- */
    if (targetGrid) {
        targetGrid.addEventListener("click", (e) => {
            const btn = e.target.closest(".target-option");
            if (!btn) return;

            targetGrid.querySelectorAll(".target-option").forEach(el => el.classList.remove("active"));
            btn.classList.add("active");

            state.target = btn.dataset.target || "2k";
        });
    }

    /* ---- Upscale ---- */
    if (upscaleBtn) {
        upscaleBtn.addEventListener("click", startUpscale);
    }
}


/* =========================================================
   INIT
========================================================= */

async function init() {

    resolveDom();

    /* Wait for navigation ready */
    if (window.GENZNavigationReady) {
        try { await window.GENZNavigationReady; } catch { /* ignore */ }
    }

    /* Read session */
    state.session = readSessionFromStorage();

    if (state.session?.user) {
        state.user = state.session.user;
    } else if (window.GENZ_NAVIGATION_USER) {
        state.user = window.GENZ_NAVIGATION_USER;
    }

    /* Load credit + bind events */
    await loadCredit();
    bindEvents();

    console.info("[GEN-Z.AI Upscale] Ready.");
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
    init();
}
