/* =========================================================
   GEN-Z.AI — UPSCALE APP
   ---------------------------------------------------------
   Flow:
     1. Wait for navigation ready
     2. Load user + credit
     3. User upload foto → validate → preview
     4. User pilih target → klik Upscale
     5. Upload ke Supabase Storage bucket dashboard-upscales/photos/inputs/
     6. Kirim URL ke backend /api/generate (action: upscale-photo)
     7. Backend deduct credit + create history + trigger workflow
     8. Tampil status + redirect ke history
========================================================= */

"use strict";


const CONFIG = Object.freeze({
    bucket: "dashboard-videos",
    photoInputFolder: "upscale-photos/inputs",
    apiEndpoint: "/api/generate",
    maxFileSize: 20 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    requestTimeout: 60000,
    creditCost: 1
});


/* =========================================================
   STATE
========================================================= */

const state = {
    user: null,
    session: null,
    credit: null,
    file: null,
    previewUrl: null,
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
        "previewImg", "fileName", "fileSize", "browseBtn", "removeBtn",
        "targetGrid", "upscaleBtn", "upscaleBtnText", "upscaleSpinner",
        "statusMessage", "resultArea", "resultActions", "creditValue",
        "loadingOverlay", "loadingTitle", "loadingText"
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

function validateFile(file) {

    if (!file) throw new Error("File tidak ditemukan.");

    if (!CONFIG.allowedTypes.includes(file.type)) {
        throw new Error("Format tidak didukung. Gunakan JPG, PNG, atau WebP.");
    }

    if (file.size > CONFIG.maxFileSize) {
        throw new Error("Ukuran file maksimal 20 MB.");
    }

    return true;
}


function showPreview() {

    const { uploadState, previewState, previewImg, fileName, fileSize } = state.dom;

    if (uploadState) uploadState.hidden = true;
    if (previewState) previewState.hidden = false;

    if (previewImg && state.previewUrl) previewImg.src = state.previewUrl;
    if (fileName) fileName.textContent = state.file?.name || "-";
    if (fileSize) fileSize.textContent = formatBytes(state.file?.size || 0);

    updateUpscaleButton();
}


function hidePreview() {

    const { uploadState, previewState, previewImg } = state.dom;

    if (uploadState) uploadState.hidden = false;
    if (previewState) previewState.hidden = true;
    if (previewImg) previewImg.removeAttribute("src");

    updateUpscaleButton();
}


function handleFileSelect(file) {

    try {
        validateFile(file);

        if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);

        state.file = file;
        state.previewUrl = URL.createObjectURL(file);

        hideStatus();
        showPreview();

    } catch (err) {
        showStatus(err.message, "error");
        state.file = null;
        hidePreview();
    }
}


function clearFile() {

    if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
        state.previewUrl = null;
    }

    state.file = null;

    const input = state.dom.fileInput;
    if (input) input.value = "";

    hideStatus();
    hidePreview();
}


/* =========================================================
   UPLOAD TO SUPABASE
========================================================= */

async function uploadPhoto(file) {

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client tidak tersedia.");

    if (!state.user?.id) throw new Error("User belum terautentikasi.");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${CONFIG.photoInputFolder}/${state.user.id}/${Date.now()}-${rand}.${ext}`;

    const { error } = await supabase.storage
        .from(CONFIG.bucket)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw new Error("Upload gagal: " + error.message);

    const { data: { publicUrl } } = supabase.storage
        .from(CONFIG.bucket)
        .getPublicUrl(path);

    if (!publicUrl) throw new Error("URL publik tidak tersedia.");

    return publicUrl;
}


/* =========================================================
   BACKEND CALL
========================================================= */

async function callBackend(sourceUrl) {

    const session = state.session;
    if (!session?.access_token) {
        throw new Error("Session tidak ditemukan. Silakan login ulang.");
    }

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
                action: "upscale-photo",
                source_url: sourceUrl,
                target_resolution: state.target
            }),
            signal: controller.signal,
            credentials: "same-origin"
        });

        const data = await response.json().catch(() => ({}));

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


/* =========================================================
   UPSCALE FLOW
========================================================= */

async function startUpscale() {

    if (state.processing) return;
    if (!state.file) {
        showStatus("Upload foto terlebih dahulu.", "error");
        return;
    }

    state.processing = true;

    const btn = state.dom.upscaleBtn;
    const btnText = state.dom.upscaleBtnText;
    const spinner = state.dom.upscaleSpinner;

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = "MEMPROSES...";
    if (spinner) spinner.hidden = false;

    hideStatus();

    try {
        showLoading("Mengunggah foto...", "Menyiapkan file untuk upscale");

        const publicUrl = await uploadPhoto(state.file);

        showLoading("Memulai upscale...", "Menghubungi server");

        const result = await callBackend(publicUrl);

        hideLoading();

        showStatus(
            `Berhasil! Upscale sedang diproses. Hasil akan muncul di History dalam beberapa menit.`,
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
