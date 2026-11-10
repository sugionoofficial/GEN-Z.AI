const $ = id => document.getElementById(id);
const IMAGE_LIMIT = { character: 5, outfit: 1, scene: 2 };
const REF_LIMIT = 8;
let desktopCompanionConnected = false;
let desktopBridge = null;
const selectedFiles = { character: [], outfit: [], scene: [], videoRef: [] };
let subscriptionActive = false;
let toastTimer = 0;

function toast(message) {
    const element = $("flow-toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("is-visible"), 3800);
}

function totalImageReferences() {
    return selectedFiles.character.length + selectedFiles.outfit.length + selectedFiles.scene.length;
}

function updateCounts() {
    $("character-count").textContent = `${selectedFiles.character.length} / 5`;
    $("outfit-count").textContent = `${selectedFiles.outfit.length} / 1`;
    $("scene-count").textContent = `${selectedFiles.scene.length} / 2`;
    $("video-ref-count").textContent = `${selectedFiles.videoRef.length} / 8`;
    const total = totalImageReferences();
    $("total-reference-count").textContent = `${total} / ${REF_LIMIT}`;
    $("reference-meter").style.width = `${Math.min(100, total / REF_LIMIT * 100)}%`;
    $("generate-image").disabled = !subscriptionActive || !desktopCompanionConnected;
    $("generate-video").disabled = !subscriptionActive || !desktopCompanionConnected;
    if (desktopCompanionConnected) {
        $("generate-image").textContent = "Kirim Generate via Flow →";
        $("generate-video").textContent = "Kirim Generate via Flow →";
    } else {
        $("generate-image").textContent = "Companion dibutuhkan";
        $("generate-video").textContent = "Companion dibutuhkan";
    }
}

function renderBucket(bucket) {
    const list = document.querySelector(`[data-thumbs="${bucket}"]`);
    if (!list) return;
    for (const child of [...list.children]) {
        const url = child.dataset.objectUrl;
        if (url) URL.revokeObjectURL(url);
    }
    list.replaceChildren();
    selectedFiles[bucket].forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "thumb-item";
        const url = URL.createObjectURL(file);
        item.dataset.objectUrl = url;
        const image = document.createElement("img");
        image.src = url;
        image.alt = file.name;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Hapus ${file.name}`);
        remove.addEventListener("click", () => {
            selectedFiles[bucket].splice(index, 1);
            renderBucket(bucket);
            updateCounts();
        });
        item.append(image, remove);
        list.append(item);
    });
}

function addFiles(bucket, fileList) {
    const files = [...fileList].filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    const bucketLimit = IMAGE_LIMIT[bucket] || 8;
    const available = Math.max(0, bucketLimit - selectedFiles[bucket].length);
    const overallAvailable = bucket === "videoRef" ? available : Math.max(0, REF_LIMIT - totalImageReferences());
    const chosen = files.slice(0, Math.min(available, overallAvailable));
    const tooLarge = chosen.find(file => file.size > 12 * 1024 * 1024);
    if (tooLarge) {
        toast(`${tooLarge.name} lebih besar dari batas 12 MB.`);
        return;
    }
    if (chosen.length) selectedFiles[bucket].push(...chosen);
    if (chosen.length < files.length) toast(`Batas slot ${bucket === "videoRef" ? "referensi video" : "referensi gambar"} sudah tercapai.`);
    renderBucket(bucket);
    updateCounts();
}

function attachUploadControls() {
    for (const button of document.querySelectorAll("[data-upload]")) {
        const input = button.querySelector('input[type="file"]');
        const bucket = button.dataset.upload;
        button.addEventListener("click", event => {
            if (event.target.closest("input")) return;
            input?.click();
        });
        input?.addEventListener("change", () => {
            addFiles(bucket, input.files || []);
            input.value = "";
        });
        button.addEventListener("dragover", event => {
            event.preventDefault();
            button.classList.add("is-dragover");
        });
        button.addEventListener("dragleave", () => button.classList.remove("is-dragover"));
        button.addEventListener("drop", event => {
            event.preventDefault();
            button.classList.remove("is-dragover");
            addFiles(bucket, event.dataTransfer?.files || []);
        });
    }
}

function attachTabs() {
    document.querySelectorAll(".mode-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const mode = tab.dataset.mode;
            document.querySelectorAll(".mode-tab").forEach(item => {
                const active = item === tab;
                item.classList.toggle("is-active", active);
                item.setAttribute("aria-selected", String(active));
            });
            $("image-mode").hidden = mode !== "image";
            $("video-mode").hidden = mode !== "video";
        });
    });
}

async function detectDesktopCompanion() {
    const bridge = window.studioFlowDesktop;
    if (!bridge || typeof bridge.getStatus !== "function" || typeof bridge.handoffTask !== "function") return;
    try {
        const status = await bridge.getStatus();
        if (status?.connected === true && status.protocolVersion >= 2) {
            desktopBridge = bridge;
            desktopCompanionConnected = true;
            bridge.onOutputImported?.(async result => {
                if (result?.success) {
                    await loadStudioFlowHistory();
                    toast(result.message || "Hasil tersimpan di riwayat STUDIO FLOW.");
                } else if (result?.message) {
                    toast(result.message);
                }
            });
            $("companion-title").textContent = "Desktop Companion tersambung";
            $("companion-copy").textContent = "Siap mengisi prompt dan opsi melalui UI Flow yang terlihat di dalam companion.";
            $("connection-label").textContent = "TERHUBUNG · UI AUTOMATION";
            $("bridge-title").textContent = "Flow UI tersambung";
            $("bridge-copy").textContent = "Companion menyiapkan prompt, model, rasio, jumlah output, durasi, dan referensi melalui kontrol yang terlihat. Kamu menyetujui sebelum Flow Generate dijalankan.";
            $("bridge-privacy").textContent = "Google login tetap berada di jendela Flow companion. Tidak ada cookie atau endpoint privat yang digunakan. Referensi diunggah melalui UI Flow setelah konfirmasi.";
            updateCounts();
        }
    } catch {
        desktopBridge = null;
        desktopCompanionConnected = false;
        updateCounts();
    }
}

function authClient() {
    if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
    if (window.supabaseClient) return window.supabaseClient;
    const config = window.GENZ_CONFIG || {};
    const key = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY;
    if (!window.supabase?.createClient || !config.SUPABASE_URL || !key) return null;
    window.GENZ_SUPABASE = window.supabase.createClient(config.SUPABASE_URL, key);
    return window.GENZ_SUPABASE;
}

async function readAccessToken() {
    if (window.GENZSession?.ensureFreshSession) {
        const session = await window.GENZSession.ensureFreshSession();
        if (session?.access_token) return session.access_token;
    }
    const client = authClient();
    if (!client) throw new Error("Sesi autentikasi belum siap. Muat ulang halaman setelah login.");
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data?.session?.access_token) throw new Error("Silakan login untuk memeriksa langganan Studio Medsos.");
    return data.session.access_token;
}

async function loadSubscription() {
    const pill = $("subscription-pill");
    const label = pill.querySelector("span");
    try {
        const token = await readAccessToken();
        const response = await fetch("/api/social-publisher?action=studio-access-status", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Status langganan gagal dibaca (${response.status}).`);
        subscriptionActive = Boolean(data.access?.active);
        pill.classList.toggle("is-active", subscriptionActive);
        pill.classList.toggle("is-inactive", !subscriptionActive);
        label.textContent = subscriptionActive ? "Langganan Studio Medsos aktif" : "Langganan Studio Medsos tidak aktif";
        if (!subscriptionActive) {
            $("flow-alert").hidden = false;
            $("flow-alert").textContent = "STUDIO FLOW memakai akses langganan Studio Medsos yang sama. Aktifkan atau perpanjang langganan sebelum mulai membuat tugas.";
        }
    } catch (error) {
        subscriptionActive = false;
        pill.classList.add("is-inactive");
        label.textContent = "Langganan belum terverifikasi";
        $("flow-alert").hidden = false;
        $("flow-alert").textContent = error.message || "Status langganan belum dapat diverifikasi.";
    }
    updateCounts();
    if (subscriptionActive) await loadStudioFlowHistory();
}

function renderHistory(items) {
    const grid = $("history-grid");
    const empty = $("history-empty");
    grid.replaceChildren();
    if (!items.length) {
        grid.hidden = true;
        empty.hidden = false;
        empty.querySelector("small").textContent = "Tugas dan hasil STUDIO FLOW akan tersimpan di sini secara privat untuk akunmu.";
        return;
    }
    empty.hidden = true;
    grid.hidden = false;
    for (const item of items) {
        const card = document.createElement("article");
        card.className = "history-item";
        const top = document.createElement("div");
        top.className = "history-item-top";
        const badge = document.createElement("span");
        badge.className = "history-type";
        badge.textContent = item.media_type === "video" ? "VIDEO" : "GAMBAR";
        const status = document.createElement("span");
        status.className = `history-status is-${item.status || "queued"}`;
        status.textContent = item.options?.workflow === "manual-handoff"
            ? "Siap dilanjutkan di Flow"
            : ({ queued: "Dalam antrean", running: "Diproses", succeeded: "Selesai", failed: "Gagal" })[item.status] || "Tersimpan";
        top.append(badge, status);
        const title = document.createElement("h4");
        title.textContent = item.title || (item.media_type === "video" ? "Kreasi video" : "Kreasi gambar");
        const prompt = document.createElement("p");
        prompt.className = "history-prompt";
        prompt.textContent = item.prompt || "Tidak ada prompt tersimpan.";
        const meta = document.createElement("small");
        const date = item.created_at ? new Date(item.created_at) : null;
        meta.textContent = [item.model, date && Number.isFinite(date.getTime()) ? date.toLocaleString("id-ID") : ""].filter(Boolean).join(" · ");
        card.append(top, title, prompt, meta);
        const outputs = Array.isArray(item.outputs) ? item.outputs : [];
        for (const output of outputs) {
            if (!output?.url || !String(output.url).startsWith("https://")) continue;
            if (output.media_type === "video") {
                const video = document.createElement("video");
                video.className = "history-output-media";
                video.src = output.url;
                video.controls = true;
                video.preload = "metadata";
                video.setAttribute("aria-label", output.label || "Hasil video STUDIO FLOW");
                card.append(video);
            } else if (output.media_type === "image") {
                const image = document.createElement("img");
                image.className = "history-output-media";
                image.src = output.url;
                image.alt = output.label || "Hasil gambar STUDIO FLOW";
                image.loading = "lazy";
                card.append(image);
            }
            const link = document.createElement("a");
            link.href = output.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = output.label || "Buka hasil ↗";
            card.append(link);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "history-delete";
        remove.textContent = "Hapus";
        remove.setAttribute("aria-label", `Hapus riwayat ${title.textContent}`);
        remove.addEventListener("click", async () => {
            remove.disabled = true;
            try {
                const token = await readAccessToken();
                const response = await fetch("/api/social-publisher?action=studio-flow-history-delete", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ id: item.id })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || `Riwayat gagal dihapus (${response.status}).`);
                await loadStudioFlowHistory();
            } catch (error) {
                toast(error.message || "Riwayat belum dapat dihapus.");
                remove.disabled = false;
            }
        });
        card.append(remove);
        grid.append(card);
    }
}

async function loadStudioFlowHistory() {
    const empty = $("history-empty");
    const message = empty.querySelector("small");
    message.textContent = "Memuat riwayat privat akun ini…";
    empty.hidden = false;
    $("history-grid").hidden = true;
    try {
        const token = await readAccessToken();
        const response = await fetch("/api/social-publisher?action=studio-flow-history", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Riwayat gagal dimuat (${response.status}).`);
        renderHistory(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
        $("history-grid").hidden = true;
        empty.hidden = false;
        message.textContent = error.message || "Riwayat belum dapat dimuat.";
    }
}

async function saveHandoffHistory(mediaType, task, workflow = "manual-handoff", status = "queued", tokenValue = "", id = "") {
    const token = tokenValue || await readAccessToken();
    const options = {
        ratio: task.ratio,
        output_count: task.outputCount,
        workflow
    };
    if (mediaType === "video") {
        options.duration = task.duration;
        options.input_mode = task.inputMode;
    }
    const response = await fetch("/api/social-publisher?action=studio-flow-history-save", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            ...(id ? { id } : {}),
            media_type: mediaType,
            title: `${status === "failed" ? "Gagal" : "Task Flow"} · ${task.prompt.slice(0, 70)}`,
            prompt: task.prompt,
            model: task.model,
            status,
            options,
            outputs: []
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Riwayat gagal disimpan (${response.status}).`);
    return data.item?.id || id;
}

async function runStudioFlowHandoff(mediaType, button) {
    if (!subscriptionActive) {
        toast("Akses Studio Medsos belum aktif. Aktifkan langganan untuk memakai STUDIO FLOW.");
        return;
    }
    if (!desktopBridge || !desktopCompanionConnected) {
        toast("Buka halaman ini dari aplikasi Windows STUDIO FLOW Companion terlebih dahulu.");
        return;
    }

    const isVideo = mediaType === "video";
    const prompt = $(isVideo ? "video-prompt" : "image-prompt").value.trim();
    if (!prompt) {
        toast("Isi prompt sebelum menyiapkan tugas di Google Flow.");
        return;
    }
    const task = {
        mediaType,
        prompt,
        model: $(isVideo ? "video-model" : "image-model").value,
        ratio: $(isVideo ? "video-ratio" : "image-ratio").value,
        outputCount: Number($(isVideo ? "video-count" : "image-count").value),
        referenceCount: isVideo ? selectedFiles.videoRef.length : totalImageReferences()
    };
    if (isVideo) {
        task.duration = Number($("video-duration").value);
        task.inputMode = $("video-input-mode").value;
    }

    button.disabled = true;
    let accessToken = "";
    let historyId = "";
    try {
        const referenceEntries = isVideo
            ? [["videoRef", selectedFiles.videoRef]]
            : [["character", selectedFiles.character], ["outfit", selectedFiles.outfit], ["scene", selectedFiles.scene]];
        const references = await Promise.all(referenceEntries.flatMap(([bucket, files]) =>
            files.map(async file => ({ bucket, mimeType: file.type, bytes: await file.arrayBuffer() }))
        ));
        let stagingId = "";
        if (references.length) {
            const staged = await desktopBridge.stageReferences(references);
            if (!staged?.accepted) {
                toast("Penyiapan referensi dibatalkan. Task tidak dikirim.");
                return;
            }
            stagingId = staged.stagingId || "";
        }
        accessToken = await readAccessToken();
        historyId = await saveHandoffHistory(mediaType, task, "visible-ui-automation", "queued", accessToken);
        if (!historyId) throw new Error("Task berhasil disiapkan, tetapi ID riwayat tidak diterima.");
        const result = await desktopBridge.handoffTask(task, stagingId, { historyId, accessToken });
        if (!result?.accepted) {
            await saveHandoffHistory(mediaType, task, "visible-ui-automation", "failed", accessToken, historyId).catch(() => {});
            const detail = Array.isArray(result?.missing) ? ` ${result.missing.join("; ")}` : "";
            toast(`${result?.message || "Flow belum siap."}${detail}`);
            await loadStudioFlowHistory();
            return;
        }
        if (result.protocolVersion !== 2 || result.generationSubmitted !== true) {
            throw new Error("Companion tidak mengonfirmasi pengiriman Generate ke UI Flow.");
        }
        try {
            await saveHandoffHistory(mediaType, task, "visible-ui-automation", "running", accessToken, historyId);
            await loadStudioFlowHistory();
            toast(`${result.message} Unduh hasil dari jendela Flow untuk mengembalikannya ke riwayat.`);
        } catch (historyError) {
            toast(`${result.message} Riwayat belum tersimpan: ${historyError.message}`);
        }
    } catch (error) {
        if (historyId && accessToken) {
            await saveHandoffHistory(mediaType, task, "visible-ui-automation", "failed", accessToken, historyId).catch(() => {});
            await loadStudioFlowHistory();
        }
        toast(error.message || "Companion belum dapat membuka Google Flow.");
    } finally {
        updateCounts();
    }
}

function bindCounters() {
    for (const [inputId, countId] of [["image-prompt", "image-prompt-count"], ["video-prompt", "video-prompt-count"]]) {
        const input = $(inputId);
        const output = $(countId);
        input.addEventListener("input", () => { output.textContent = `${input.value.length} / 5000`; });
    }
    $("clear-image-prompt").addEventListener("click", () => {
        $("image-prompt").value = "";
        $("image-prompt").dispatchEvent(new Event("input"));
    });
    $("history-open").addEventListener("click", () => $("history-section").scrollIntoView({ behavior: "smooth" }));
    $("generate-image").addEventListener("click", event => runStudioFlowHandoff("image", event.currentTarget));
    $("generate-video").addEventListener("click", event => runStudioFlowHandoff("video", event.currentTarget));
}

attachUploadControls();
attachTabs();
bindCounters();
updateCounts();
void detectDesktopCompanion();
loadSubscription();
