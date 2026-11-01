/* =========================================================
   GEN-Z.AI — OPUSCLIP STUDIO FRONTEND CONTROLLER (BAGIAN 2)
   ---------------------------------------------------------
   File:
     opusclip/assets/js/opusclip-app.js

   Mengendalikan seluruh 7 fitur Bagian 2 di `/opusclip/`
   termasuk upload GCS resumable langsung dari browser,
   polling thumbnail & video understanding, Editor/Sensor klip,
   Live Interactive 60fps Canvas Motion UI Preview + GitHub
   Actions Remotion queue, serta tab khusus Owner/Admin untuk
   Social Posting & Kuota API Organisasi.
========================================================= */

import {
    MOTION_UI_ASPECT_CONFIGS,
    MOTION_UI_TEMPLATES,
    springProgress
} from "../../../provider/opusclip/motion-ui-templates.js";

const state = {
    clipMode: "clipping",
    costs: {
        opusclip_clipping: 2500,
        opusclip_dubbing: 3500,
        opusclip_thumbnail: 1000,
        opusclip_censor_edit: 500,
        opusclip_understanding: 1000,
        opusclip_motion_ui: 2500,
        opusclip_social_post: 250
    },
    viewer: { isAdminOrOwner: false, credits: null },
    templates: MOTION_UI_TEMPLATES,
    selectedTemplateId: MOTION_UI_TEMPLATES[0].id,
    socialAccounts: [],
    userSocialAccounts: [],
    historyVideos: [],
    canvasStartMs: performance.now(),
    lastTranscriptPlain: ""
};

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatNum(num) {
    const n = Number(num);
    if (!Number.isFinite(n)) return "--";
    return n.toLocaleString("id-ID");
}

function notify(msg, isError = false) {
    const banner = $("ocGlobalBanner");
    if (banner) {
        banner.textContent = msg;
        banner.style.borderColor = isError ? "rgba(239,68,68,0.5)" : "";
        banner.style.color = isError ? "#f87171" : "";
    }
    if (window.GENZToast && typeof window.GENZToast.show === "function") {
        window.GENZToast.show(msg, isError ? "error" : "info");
    }
}

async function getAccessToken() {
    try {
        if (window.GENZSession && typeof window.GENZSession.getAccessToken === "function") {
            const tok = await window.GENZSession.getAccessToken();
            if (tok) return String(tok).trim();
        }
    } catch {
        /* ignore */
    }
    try {
        if (window.supabaseClient?.auth) {
            const { data } = await window.supabaseClient.auth.getSession();
            if (data?.session?.access_token) return data.session.access_token;
        }
    } catch {
        /* ignore */
    }
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i) || "";
            if (key.includes("-auth-token")) {
                const parsed = JSON.parse(localStorage.getItem(key) || "{}");
                const tok = parsed.access_token || parsed?.currentSession?.access_token;
                if (tok) return String(tok).trim();
            }
        }
    } catch {
        /* ignore */
    }
    return "";
}

async function callOpusClipApi(action, payload = {}, method = "POST") {
    const token = await getAccessToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let url = "/api/opusclip";
    const init = { method, headers };

    if (method === "GET") {
        const qs = new URLSearchParams({ action, ...payload });
        url += `?${qs.toString()}`;
    } else {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify({ action, ...payload });
    }

    const resp = await fetch(url, init);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.success) {
        throw new Error(data?.error || `Permintaan gagal (HTTP ${resp.status}).`);
    }

    if (data?.billing?.credits !== undefined && data.billing.credits !== null) {
        updateCreditDisplay(data.billing.credits);
    }
    return data;
}

async function callSocialVideoApi(action, payload = {}, method = "POST") {
    const token = await getAccessToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let url = "/api/social-video-autopost";
    const init = { method, headers };

    if (method === "GET") {
        const qs = new URLSearchParams({ action, ...payload });
        url += `?${qs.toString()}`;
    } else {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify({ action, ...payload });
    }

    const resp = await fetch(url, init);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.success) {
        throw new Error(data?.error || `Permintaan gagal (HTTP ${resp.status}).`);
    }

    if (data?.creditsRemaining !== undefined && data.creditsRemaining !== null) {
        updateCreditDisplay(data.creditsRemaining);
    }
    return data;
}

function updateCreditDisplay(credits) {
    state.viewer.credits = credits;
    const el = $("ocCreditValue");
    if (el && credits !== null && credits !== undefined) {
        el.textContent = formatNum(credits);
    }
}

function updateCostBadges() {
    const c = state.costs;
    if ($("ocCostBadgeClipping")) {
        $("ocCostBadgeClipping").textContent = formatNum(
            state.clipMode === "dubbing" ? c.opusclip_dubbing : c.opusclip_clipping
        );
    }
    if ($("ocCostBadgeThumbnail")) $("ocCostBadgeThumbnail").textContent = formatNum(c.opusclip_thumbnail);
    if ($("ocCostBadgeEditor")) $("ocCostBadgeEditor").textContent = formatNum(c.opusclip_censor_edit);
    if ($("ocCostBadgeUnderstanding")) $("ocCostBadgeUnderstanding").textContent = formatNum(c.opusclip_understanding);
    if ($("ocCostBadgeMotion")) $("ocCostBadgeMotion").textContent = formatNum(c.opusclip_motion_ui);
    if ($("ocCostBadgeSocial")) $("ocCostBadgeSocial").textContent = formatNum(c.opusclip_social_post);
    if ($("ocNativeUnitCostLabel")) $("ocNativeUnitCostLabel").textContent = formatNum(c.opusclip_social_post);
    if ($("ocModeLabelClipCost")) {
        $("ocModeLabelClipCost").textContent = `${formatNum(c.opusclip_clipping)} kredit / project`;
    }
    if ($("ocModeLabelDubCost")) {
        $("ocModeLabelDubCost").textContent = `${formatNum(c.opusclip_dubbing)} kredit / video`;
    }
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Gagal membaca file lokal."));
        reader.readAsDataURL(file);
    });
}

async function uploadBrowserFileToOpusClip(file, usecase = "LocalUpload") {
    if (file.size <= 12 * 1024 * 1024) {
        const base64Data = await fileToBase64(file);
        const res = await callOpusClipApi("upload_media_base64", {
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            usecase,
            base64Data
        });
        return res.upload;
    }

    /* Untuk video > 12 MB, lakukan GCS resumable upload langsung dari browser */
    const linkRes = await callOpusClipApi("create_upload_link", {
        fileName: file.name,
        usecase,
        size: file.size
    });
    const upload = linkRes.upload;
    const initResp = await fetch(upload.upload_url, {
        method: "POST",
        headers: {
            "x-goog-resumable": "start",
            "Content-Length": "0",
            "Content-Type": file.type || "application/octet-stream"
        }
    });
    if (!initResp.ok) {
        throw new Error(`Gagal inisialisasi upload cloud (HTTP ${initResp.status}).`);
    }
    const sessionUrl = initResp.headers.get("Location") || initResp.headers.get("location");
    if (!sessionUrl) {
        throw new Error("URL sesi resumable cloud tidak tersedia.");
    }
    const putResp = await fetch(sessionUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
    });
    if (!putResp.ok) {
        throw new Error(`Gagal mengunggah video ke cloud (HTTP ${putResp.status}).`);
    }
    return upload;
}

/* =========================================================
   TABS & CLIP/DUBBING MODE SWITCHING
========================================================= */

function initTabs() {
    const buttons = document.querySelectorAll("[data-oc-tab]");
    const panels = document.querySelectorAll("[data-oc-panel]");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-oc-tab");
            buttons.forEach(b => {
                const active = b === btn;
                b.classList.toggle("active", active);
                b.setAttribute("aria-selected", active ? "true" : "false");
            });
            panels.forEach(p => {
                p.hidden = p.getAttribute("data-oc-panel") !== target;
            });
            if (target === "motion") {
                state.canvasStartMs = performance.now();
            }
        });
    });

    const clipBtn = $("ocModeBtnClipping");
    const dubBtn = $("ocModeBtnDubbing");
    const setMode = mode => {
        state.clipMode = mode;
        clipBtn?.classList.toggle("active", mode === "clipping");
        dubBtn?.classList.toggle("active", mode === "dubbing");
        if ($("ocClippingFields")) $("ocClippingFields").hidden = mode !== "clipping";
        if ($("ocDubbingFields")) $("ocDubbingFields").hidden = mode !== "dubbing";
        updateCostBadges();
    };
    clipBtn?.addEventListener("click", () => setMode("clipping"));
    dubBtn?.addEventListener("click", () => setMode("dubbing"));
}

function getActiveProjectId() {
    const manual = $("ocManualProjectId")?.value.trim();
    if (manual) return manual;
    return $("ocProjectSelect")?.value.trim() || "";
}

/* =========================================================
   PANEL 1: AI CLIPPING, DUBBING, TRANSCRIPT & COLLECTIONS
========================================================= */

function bindClippingHandlers() {
    $("ocUploadLocalVideoBtn")?.addEventListener("click", async () => {
        const file = $("ocLocalVideoFile")?.files?.[0];
        if (!file) return notify("Pilih file video lokal terlebih dahulu.", true);
        const btn = $("ocUploadLocalVideoBtn");
        btn.disabled = true;
        try {
            notify(`Mengunggah ${file.name} ke cloud OpusClip…`);
            const upload = await uploadBrowserFileToOpusClip(file, "LocalUpload");
            $("ocVideoUrl").value = upload.upload_id;
            if (!$("ocProjectTitle").value) {
                $("ocProjectTitle").value = file.name.replace(/\.[^.]+$/, "");
            }
            notify(`Upload berhasil! Upload ID siap diproses: ${upload.upload_id}`);
        } catch (err) {
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    $("ocSubmitProjectBtn")?.addEventListener("click", async () => {
        const videoUrl = $("ocVideoUrl")?.value.trim();
        const confirmCopyright = $("ocCopyrightConfirm")?.checked === true;
        if (!videoUrl) return notify("Masukkan URL video publik atau unggah file lokal terlebih dahulu.", true);
        if (!confirmCopyright) return notify("Centang konfirmasi hak cipta terlebih dahulu.", true);

        const payload = {
            videoUrl,
            confirmCopyright: true,
            title: $("ocProjectTitle")?.value.trim() || undefined,
            aspectRatio: $("ocAspectRatio")?.value || "portrait"
        };

        if (state.clipMode === "dubbing") {
            payload.dubbingLanguage = $("ocDubbingLang")?.value || "id";
            const srcLang = $("ocSourceLangDub")?.value || "";
            if (srcLang) payload.sourceLang = srcLang;
        } else {
            payload.model = $("ocCurationModel")?.value || "ClipAnything";
            const dur = $("ocClipDuration")?.value || "auto";
            if (dur !== "auto" && !$("ocSkipSlicing")?.checked) {
                payload.clipDurationsSec = [dur];
            }
            const targetLang = $("ocTargetLang")?.value || "";
            if (targetLang) payload.targetLang = targetLang;
            const brandTpl = $("ocBrandTemplate")?.value || "";
            if (brandTpl) payload.brandTemplateId = brandTpl;
            const rs = $("ocRangeStart")?.value.trim();
            const re = $("ocRangeEnd")?.value.trim();
            if (rs) payload.rangeStart = Number(rs);
            if (re) payload.rangeEnd = Number(re);
            const customPrompt = $("ocCustomPrompt")?.value.trim();
            if (customPrompt) payload.customPrompt = customPrompt;
            payload.enableCaption = Boolean($("ocEnableCaption")?.checked);
            if ($("ocEnableAutoHook")?.checked && !$("ocSkipSlicing")?.checked) {
                payload.enableAutoHook = true;
            }
            if ($("ocRemoveFiller")?.checked) payload.removeFiller = true;
            if ($("ocSkipSlicing")?.checked) payload.skipSlicing = true;
        }

        const btn = $("ocSubmitProjectBtn");
        btn.disabled = true;
        try {
            notify("Mengirim project ke OpusClip & memproses kredit fitur…");
            const res = await callOpusClipApi("submit_project", payload);
            const pid = res.project?.project_id || "";
            if (pid && $("ocManualProjectId")) {
                $("ocManualProjectId").value = pid;
            }
            notify(`Project berhasil dibuat! Project ID: ${pid} (${res.project?.stage || "PROCESSING"})`);
            await refreshProjectsList(pid);
        } catch (err) {
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    $("ocRefreshProjectsBtn")?.addEventListener("click", () => refreshProjectsList());
    $("ocLoadTemplatesBtn")?.addEventListener("click", async () => {
        try {
            const res = await callOpusClipApi("list_brand_templates", {}, "GET");
            const sel = $("ocBrandTemplate");
            if (sel) {
                sel.innerHTML = `<option value="">Default OpusClip</option>` +
                    (res.templates || []).map(t =>
                        `<option value="${escapeHtml(t.template_id)}">${escapeHtml(t.name)}${t.is_default ? " (Default)" : ""}</option>`
                    ).join("");
            }
            notify(`Berhasil memuat ${(res.templates || []).length} Brand Template.`);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocLoadClipsBtn")?.addEventListener("click", async () => {
        const projectId = getActiveProjectId();
        if (!projectId) return notify("Pilih atau tempel Project ID terlebih dahulu.", true);
        try {
            notify(`Memuat daftar klip untuk project ${projectId}…`);
            const res = await callOpusClipApi("list_clips", { projectId }, "GET");
            renderClipsGallery(res.clips || [], projectId);
            notify(`Ditemukan ${(res.clips || []).length} klip pada project ${projectId}.`);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocLoadTranscriptBtn")?.addEventListener("click", async () => {
        const projectId = getActiveProjectId();
        if (!projectId) return notify("Pilih Project ID terlebih dahulu.", true);
        try {
            const res = await callOpusClipApi("get_transcript", { projectId }, "GET");
            const paragraphs = res.transcript?.paragraphs || [];
            const box = $("ocTranscriptBox");
            const content = $("ocTranscriptContent");
            if (box && content) {
                box.hidden = false;
                if (paragraphs.length === 0) {
                    content.textContent = "Transkrip belum selesai diproses atau kosong.";
                    state.lastTranscriptPlain = "";
                } else {
                    state.lastTranscriptPlain = paragraphs
                        .map(p => `[${Math.floor(p.start_ms / 1000)}s] ${p.speaker ? p.speaker + ": " : ""}${p.text}`)
                        .join("\n\n");
                    content.innerHTML = paragraphs.map(p => {
                        const sec = Math.floor((p.start_ms || 0) / 1000);
                        const wordsHtml = Array.isArray(p.words) && p.words.length > 0
                            ? p.words.map(w => w.is_filler_word
                                ? `<span class="oc-filler-word" title="Filler Word">${escapeHtml(w.word)}</span>`
                                : escapeHtml(w.word)).join(" ")
                            : escapeHtml(p.text);
                        return `<div><strong>[${sec}s${p.speaker ? " · " + escapeHtml(p.speaker) : ""}]</strong> ${wordsHtml}</div>`;
                    }).join("<br>");
                }
            }
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocCopyTranscriptBtn")?.addEventListener("click", async () => {
        if (!state.lastTranscriptPlain) return;
        await navigator.clipboard?.writeText(state.lastTranscriptPlain);
        notify("Transkrip berhasil disalin ke clipboard!");
    });

    $("ocShareProjectBtn")?.addEventListener("click", async () => {
        const projectId = getActiveProjectId();
        if (!projectId) return notify("Pilih Project ID terlebih dahulu.", true);
        try {
            const res = await callOpusClipApi("share_project", { projectId, visibility: "PUBLIC" });
            const shareUrl = res.share?.share_url || "";
            if (shareUrl) {
                await navigator.clipboard?.writeText(shareUrl).catch(() => {});
                notify(`Link Share Publik aktif & disalin: ${shareUrl}`);
            }
        } catch (err) {
            notify(err.message, true);
        }
    });

    /* Collections */
    $("ocLoadCollectionsBtn")?.addEventListener("click", async () => {
        try {
            const res = await callOpusClipApi("list_collections", {}, "GET");
            const sel = $("ocCollectionSelect");
            if (sel) {
                sel.innerHTML = `<option value="">-- Pilih Koleksi Aktif --</option>` +
                    (res.collections || []).map(c =>
                        `<option value="${escapeHtml(c.collection_id)}">${escapeHtml(c.name)}</option>`
                    ).join("");
            }
            notify(`Berhasil memuat ${(res.collections || []).length} koleksi.`);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocCreateCollectionBtn")?.addEventListener("click", async () => {
        const name = $("ocNewCollectionName")?.value.trim();
        if (!name) return notify("Masukkan nama koleksi baru.", true);
        try {
            const res = await callOpusClipApi("create_collection", { name });
            $("ocNewCollectionName").value = "";
            notify(`Koleksi '${res.collection?.name || name}' dibuat.`);
            $("ocLoadCollectionsBtn")?.click();
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocExportCollectionBtn")?.addEventListener("click", async () => {
        const collectionId = $("ocCollectionSelect")?.value;
        if (!collectionId) return notify("Pilih koleksi terlebih dahulu.", true);
        try {
            const res = await callOpusClipApi("export_collection", { collectionId });
            const out = $("ocCollectionOutput");
            if (out) {
                out.hidden = false;
                out.textContent = JSON.stringify(res.exported, null, 2);
            }
        } catch (err) {
            notify(err.message, true);
        }
    });
}

async function refreshProjectsList(selectId = "") {
    try {
        const res = await callOpusClipApi("list_projects", { page: 0, pageSize: 25 }, "GET");
        const sel = $("ocProjectSelect");
        if (sel) {
            sel.innerHTML = `<option value="">-- Pilih dari ${(res.projects || []).length} Project Terbaru --</option>` +
                (res.projects || []).map(p =>
                    `<option value="${escapeHtml(p.project_id)}"${p.project_id === selectId ? " selected" : ""}>` +
                    `${escapeHtml(p.title || p.project_id)} [${escapeHtml(p.stage || "-")}]</option>`
                ).join("");
        }
    } catch (err) {
        notify(err.message, true);
    }
}

function renderClipsGallery(clips, projectId) {
    const grid = $("ocClipsGrid");
    const countLabel = $("ocClipsCountLabel");
    if (countLabel) countLabel.textContent = `${clips.length} Klip`;
    if (!grid) return;

    if (clips.length === 0) {
        grid.innerHTML = `<p class="oc-card-sub">Belum ada klip siap ekspor pada project ini (masih diolah AI atau kosong). Coba klik Tampilkan Klip beberapa saat lagi.</p>`;
        return;
    }

    grid.innerHTML = clips.map((c, idx) => {
        const mediaHtml = c.preview_url
            ? `<video controls preload="metadata" poster="${escapeHtml(c.thumbnail_url || "")}" src="${escapeHtml(c.preview_url)}"></video>`
            : c.thumbnail_url
                ? `<img src="${escapeHtml(c.thumbnail_url)}" alt="${escapeHtml(c.title)}">`
                : "";

        return `
            <article class="oc-clip-card">
                ${mediaHtml}
                <div class="oc-clip-body">
                    <div class="oc-score-row">
                        <span class="oc-score-badge">#${c.rank ?? idx + 1} · Skor ${c.score ?? "-"}</span>
                        <span class="oc-subscore">${c.duration_sec || 0}s</span>
                        ${c.render_pending ? `<span class="oc-subscore">⏳ Rendering</span>` : ""}
                    </div>
                    <strong style="font-size: 13.5px;">${escapeHtml(c.title || `Clip ${idx + 1}`)}</strong>
                    <div class="oc-score-row">
                        <span class="oc-subscore">Hook: ${c.hook_score ?? "-"}</span>
                        <span class="oc-subscore">Coherence: ${c.coherence_score ?? "-"}</span>
                        <span class="oc-subscore">Conn: ${c.connection_score ?? "-"}</span>
                        <span class="oc-subscore">Trend: ${c.trend_score ?? "-"}</span>
                    </div>
                    <div class="oc-clip-actions">
                        <button type="button" class="oc-btn oc-btn--primary oc-btn--sm" data-export-clip="${escapeHtml(c.clip_id)}" data-export-proj="${escapeHtml(c.project_id || projectId)}" data-export-target="hd">⬇️ HD</button>
                        <button type="button" class="oc-btn oc-btn--sm" data-export-clip="${escapeHtml(c.clip_id)}" data-export-proj="${escapeHtml(c.project_id || projectId)}" data-export-target="4k">4K</button>
                        <button type="button" class="oc-btn oc-btn--sm" data-export-clip="${escapeHtml(c.clip_id)}" data-export-proj="${escapeHtml(c.project_id || projectId)}" data-export-target="xml">XML</button>
                        <button type="button" class="oc-btn oc-btn--sm" data-send-edit="${escapeHtml(c.clip_id)}" data-send-proj="${escapeHtml(c.project_id || projectId)}">🔇 Sensor/Edit</button>
                        <button type="button" class="oc-btn oc-btn--sm" data-add-col="${escapeHtml(c.clip_id)}" data-send-proj="${escapeHtml(c.project_id || projectId)}">➕ Koleksi</button>
                        <button type="button" class="oc-btn oc-btn--sm" data-send-soc="${escapeHtml(c.clip_id)}" data-send-proj="${escapeHtml(c.project_id || projectId)}" data-send-url="${escapeHtml(c.export_url || c.preview_url || "")}" data-send-title="${escapeHtml(c.title || "")}">📡 Post</button>
                    </div>
                </div>
            </article>
        `;
    }).join("");

    grid.onclick = async ev => {
        const exportBtn = ev.target.closest?.("[data-export-clip]");
        if (exportBtn) {
            const clipId = exportBtn.getAttribute("data-export-clip");
            const proj = exportBtn.getAttribute("data-export-proj");
            const target = exportBtn.getAttribute("data-export-target") || "hd";
            try {
                const res = await callOpusClipApi("export_clip", { projectId: proj, clipId, target }, "GET");
                if (res.export?.export_url) {
                    window.open(res.export.export_url, "_blank", "noopener");
                } else {
                    notify(res.export?.message || "File ekspor belum siap.", true);
                }
            } catch (err) {
                notify(err.message, true);
            }
            return;
        }

        const editBtn = ev.target.closest?.("[data-send-edit]");
        if (editBtn) {
            $("ocEditProjectId").value = editBtn.getAttribute("data-send-proj") || "";
            $("ocEditClipId").value = editBtn.getAttribute("data-send-edit") || "";
            document.querySelector('[data-oc-tab="editor"]')?.click();
            return;
        }

        const colBtn = ev.target.closest?.("[data-add-col]");
        if (colBtn) {
            const collectionId = $("ocCollectionSelect")?.value;
            if (!collectionId) return notify("Pilih Koleksi Aktif terlebih dahulu di panel Koleksi.", true);
            try {
                await callOpusClipApi("add_collection_clip", {
                    collectionId,
                    projectId: colBtn.getAttribute("data-send-proj"),
                    clipId: colBtn.getAttribute("data-add-col")
                });
                notify("Klip ditambahkan ke koleksi!");
            } catch (err) {
                notify(err.message, true);
            }
            return;
        }

        const socBtn = ev.target.closest?.("[data-send-soc]");
        if (socBtn) {
            const proj = socBtn.getAttribute("data-send-proj") || "";
            const clip = socBtn.getAttribute("data-send-soc") || "";
            const clipUrl = socBtn.getAttribute("data-send-url") || "";
            const clipTitle = socBtn.getAttribute("data-send-title") || "";
            if ($("ocSocProjectId")) $("ocSocProjectId").value = proj;
            if ($("ocSocClipId")) $("ocSocClipId").value = clip;
            if (clipUrl) {
                sendVideoToNativeSocialComposer({
                    videoRef: clipUrl,
                    sourceType: "opusclip",
                    title: clipTitle
                });
            }
            document.querySelector('[data-oc-tab="social"]')?.click();
        }
    };
}

/* =========================================================
   PANEL 2: AI YOUTUBE THUMBNAIL GENERATOR
========================================================= */

function bindThumbnailHandlers() {
    $("ocSubmitThumbBtn")?.addEventListener("click", async () => {
        const sourceUri = $("ocThumbVideoUrl")?.value.trim();
        if (!sourceUri) return notify("Masukkan URL video sumber untuk membuat thumbnail.", true);

        const btn = $("ocSubmitThumbBtn");
        const badge = $("ocThumbStatusBadge");
        btn.disabled = true;

        try {
            let referenceImageUri;
            let maskImageUri;
            const refFile = $("ocThumbRefFile")?.files?.[0];
            const maskFile = $("ocThumbMaskFile")?.files?.[0];

            if (refFile) {
                notify("Mengunggah gambar referensi thumbnail…");
                const up = await uploadBrowserFileToOpusClip(refFile, "FreeToolMedia");
                referenceImageUri = up.cdn_url || up.upload_id;
            }
            if (maskFile) {
                notify("Mengunggah mask image thumbnail…");
                const up = await uploadBrowserFileToOpusClip(maskFile, "FreeToolMedia");
                maskImageUri = up.cdn_url || up.upload_id;
            }

            if (badge) badge.textContent = "Membuat Job…";
            const submitted = await callOpusClipApi("submit_thumbnail", {
                sourceUri,
                referenceImageUri,
                maskImageUri,
                prompt: $("ocThumbPrompt")?.value.trim() || undefined
            });

            const jobId = submitted.job?.job_id;
            const transactionId = submitted.transactionId;
            notify(`Job Thumbnail dibuat (${jobId}). Menunggu proses render AI…`);

            for (let attempt = 0; attempt < 36; attempt += 1) {
                await new Promise(r => setTimeout(r, 4000));
                const poll = await callOpusClipApi("get_thumbnail", { jobId, transactionId }, "GET");
                const st = poll.job?.status || "PROCESSING";
                if (badge) badge.textContent = st;
                if (st === "CONCLUDED") {
                    const urls = poll.job?.thumbnail_urls || [];
                    $("ocThumbGallery").innerHTML = urls.map((u, idx) => `
                        <article class="oc-clip-card oc-thumb-card">
                            <img src="${escapeHtml(u)}" alt="Thumbnail AI ${idx + 1}">
                            <div class="oc-clip-body">
                                <strong>Variasi Thumbnail #${idx + 1}</strong>
                                <a class="oc-btn oc-btn--primary oc-btn--sm" href="${escapeHtml(u)}" target="_blank" rel="noopener" download="thumbnail-${idx + 1}.png">⬇️ Buka / Unduh</a>
                            </div>
                        </article>
                    `).join("");
                    notify(`Selesai! ${urls.length} desain Thumbnail YouTube AI berhasil dibuat.`);
                    break;
                }
                if (st === "FAILED") {
                    throw new Error(poll.job?.error_message || "Generate thumbnail gagal di upstream.");
                }
            }
        } catch (err) {
            if (badge) badge.textContent = "Gagal";
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });
}

/* =========================================================
   PANEL 3: SERVER-SIDE CLIP EDITOR & PROFANITY CENSOR
========================================================= */

function bindEditorHandlers() {
    $("ocDuplicateClipBtn")?.addEventListener("click", async () => {
        const projectId = $("ocEditProjectId")?.value.trim();
        const clipId = $("ocEditClipId")?.value.trim();
        if (!projectId || !clipId) return notify("Isi Project ID dan Clip ID terlebih dahulu.", true);
        try {
            const res = await callOpusClipApi("duplicate_clip", { projectId, clipId });
            const dupId = res.duplicated?.duplicated_clip_id || "";
            if (dupId) $("ocEditClipId").value = dupId;
            notify(`Klip berhasil diduplikasi secara gratis! Clip ID salinan aktif: ${dupId}`);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocCensorClipBtn")?.addEventListener("click", async () => {
        const projectId = $("ocEditProjectId")?.value.trim();
        const clipId = $("ocEditClipId")?.value.trim();
        if (!projectId || !clipId) return notify("Isi Project ID dan Clip ID terlebih dahulu.", true);

        const box = $("ocCensorStatusBox");
        const btn = $("ocCensorClipBtn");
        btn.disabled = true;
        try {
            const res = await callOpusClipApi("censor_clip", {
                projectId,
                clipId,
                beepSound: Boolean($("ocCensorBeep")?.checked)
            });
            const jobId = res.censor?.job_id;
            if (box) {
                box.hidden = false;
                box.textContent = `Job Sensor dikirim (${jobId}) — memeriksa progres…`;
            }
            for (let i = 0; i < 24; i += 1) {
                await new Promise(r => setTimeout(r, 4000));
                const poll = await callOpusClipApi("get_censor", { jobId }, "GET");
                const st = poll.censor?.status || "PROCESSING";
                if (box) box.textContent = `Status Sensor Kata Kasar (${jobId}): ${st}`;
                if (st === "CONCLUDED") {
                    notify("Sensor kata kasar selesai! Klip telah diperbarui.");
                    break;
                }
                if (st === "FAILED") {
                    throw new Error(poll.censor?.error_message || "Sensor klip gagal.");
                }
            }
        } catch (err) {
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    $("ocFetchScriptBtn")?.addEventListener("click", async () => {
        const projectId = $("ocEditProjectId")?.value.trim();
        const clipId = $("ocEditClipId")?.value.trim();
        if (!projectId || !clipId) return notify("Isi Project ID dan Clip ID terlebih dahulu.", true);
        try {
            const res = await callOpusClipApi("get_editing_script", { projectId, clipId }, "GET");
            $("ocEditingScriptArea").value = JSON.stringify(res.editing_script, null, 2);
            notify("EditingScript berhasil dimuat.");
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocApplyScriptBtn")?.addEventListener("click", async () => {
        const projectId = $("ocEditProjectId")?.value.trim();
        const clipId = $("ocEditClipId")?.value.trim();
        const rawJson = $("ocEditingScriptArea")?.value.trim();
        if (!projectId || !clipId || !rawJson) {
            return notify("Project ID, Clip ID, dan JSON EditingScript wajib diisi.", true);
        }
        let parsed;
        try {
            parsed = JSON.parse(rawJson);
        } catch {
            return notify("Format JSON EditingScript tidak valid.", true);
        }
        const btn = $("ocApplyScriptBtn");
        btn.disabled = true;
        try {
            const res = await callOpusClipApi("apply_editing_script", {
                projectId,
                clipId,
                editingScript: parsed
            });
            notify(res.render?.message || "Re-render EditingScript dimulai!");
        } catch (err) {
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });
}

/* =========================================================
   PANEL 4: DEEP VIDEO UNDERSTANDING (`mcp.opus.pro`)
========================================================= */

function bindUnderstandingHandlers() {
    let uploadedMcpId = "";

    $("ocUndUploadBtn")?.addEventListener("click", async () => {
        const file = $("ocUndVideoFile")?.files?.[0];
        if (!file) return notify("Pilih file video referensi terlebih dahulu.", true);
        const btn = $("ocUndUploadBtn");
        btn.disabled = true;
        try {
            notify(`Meminta link upload MCP untuk ${file.name}…`);
            const linkRes = await callOpusClipApi("create_mcp_upload_link", {
                fileName: file.name,
                mimeType: file.type || "video/mp4"
            });
            const up = linkRes.upload || {};
            const uploadUrl = up.uploadUrl || up.upload_url || up.url;
            const uploadId = up.uploadId || up.upload_id;
            if (!uploadUrl || !uploadId) {
                throw new Error("Respons link upload MCP tidak lengkap.");
            }

            const initResp = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "x-goog-resumable": "start",
                    "Content-Length": "0",
                    "Content-Type": file.type || "video/mp4"
                }
            });
            const sessionUrl = initResp.headers.get("Location") || initResp.headers.get("location") || uploadUrl;
            const putResp = await fetch(sessionUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type || "video/mp4" },
                body: file
            });
            if (!putResp.ok) throw new Error(`Gagal upload video referensi (HTTP ${putResp.status}).`);

            uploadedMcpId = uploadId;
            $("ocUndMediaUrl").value = uploadId;
            notify(`Video referensi berhasil diunggah ke MCP (${uploadId})!`);
        } catch (err) {
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    $("ocSubmitUndBtn")?.addEventListener("click", async () => {
        const rawInput = $("ocUndMediaUrl")?.value.trim() || "";
        if (!rawInput) return notify("Masukkan URL video langsung atau unggah video referensi.", true);

        const isUrl = /^https?:\/\//i.test(rawInput);
        const btn = $("ocSubmitUndBtn");
        const out = $("ocUndOutput");
        btn.disabled = true;

        try {
            if (out) out.textContent = "Mengirim video ke Deep Video Understanding (mcp.opus.pro)…";
            const res = await callOpusClipApi("submit_understanding", {
                mediaUrl: isUrl ? rawInput : "",
                uploadId: isUrl ? (uploadedMcpId || "") : rawInput,
                durationSeconds: Number($("ocUndDuration")?.value || 60),
                preset: $("ocUndPreset")?.value || "copy_video_style",
                customPrompt: $("ocUndCustomPrompt")?.value.trim() || ""
            });

            if (res.analysisText) {
                out.textContent = res.analysisText;
                notify("Analisis Deep Video Understanding selesai!");
                return;
            }

            const jobId = res.jobId;
            const transactionId = res.transactionId;
            for (let attempt = 0; attempt < 40; attempt += 1) {
                await new Promise(r => setTimeout(r, 4500));
                const poll = await callOpusClipApi("get_understanding", { jobId, transactionId }, "GET");
                if (poll.analysisText) {
                    out.textContent = poll.analysisText;
                    notify("Blueprint Copy Video Style selesai dianalisis!");
                    return;
                }
                if (poll.status === "FAILED") {
                    throw new Error("Analisis video referensi gagal di upstream MCP.");
                }
                if (out) out.textContent = `Menganalisis video referensi (${poll.status})… Mohon tunggu.`;
            }
        } catch (err) {
            if (out) out.textContent = `Error: ${err.message}`;
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    $("ocCopyUndBtn")?.addEventListener("click", async () => {
        const txt = $("ocUndOutput")?.textContent || "";
        if (!txt) return;
        await navigator.clipboard?.writeText(txt);
        notify("Blueprint disalin ke clipboard!");
    });

    $("ocDownloadUndBtn")?.addEventListener("click", () => {
        const txt = $("ocUndOutput")?.textContent || "";
        const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `copy-video-style-${Date.now()}.txt`;
        a.click();
    });
}

/* =========================================================
   PANEL 5: MOTION UI REMOTION TEMPLATES + LIVE 60FPS CANVAS
========================================================= */

function populateMotionTemplateFields(tpl) {
    if (!tpl) return;
    const d = tpl.defaults;
    $("ocMuiBrand").value = d.brandName;
    $("ocMuiBadge").value = d.badgeText;
    $("ocMuiHeadline").value = d.headline;
    $("ocMuiSubheadline").value = d.subheadline;
    $("ocMuiCta").value = d.ctaText;
    $("ocMuiAccent").value = tpl.defaultAccent;
    $("ocMuiSecondary").value = tpl.defaultSecondary;
    $("ocMuiM1Label").value = d.metric1Label;
    $("ocMuiM1Val").value = d.metric1Value;
    $("ocMuiM2Label").value = d.metric2Label;
    $("ocMuiM2Val").value = d.metric2Value;
    $("ocMuiM3Label").value = d.metric3Label;
    $("ocMuiM3Val").value = d.metric3Value;
    state.canvasStartMs = performance.now();
}

function readCurrentMotionProps() {
    return {
        brandName: $("ocMuiBrand")?.value || "GEN-Z.AI",
        badgeText: $("ocMuiBadge")?.value || "MOTION UI",
        headline: $("ocMuiHeadline")?.value || "",
        subheadline: $("ocMuiSubheadline")?.value || "",
        ctaText: $("ocMuiCta")?.value || "Mulai Sekarang",
        accentColor: $("ocMuiAccent")?.value || "#22c55e",
        secondaryColor: $("ocMuiSecondary")?.value || "#06b6d4",
        themeMode: $("ocMuiTheme")?.value || "dark",
        metric1Label: $("ocMuiM1Label")?.value || "",
        metric1Value: $("ocMuiM1Val")?.value || "",
        metric2Label: $("ocMuiM2Label")?.value || "",
        metric2Value: $("ocMuiM2Val")?.value || "",
        metric3Label: $("ocMuiM3Label")?.value || "",
        metric3Value: $("ocMuiM3Val")?.value || ""
    };
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text || "").split(/\s+/);
    let line = "";
    let lineCount = 0;
    for (let n = 0; n < words.length; n += 1) {
        const testLine = line ? `${line} ${words[n]}` : words[n];
        if (ctx.measureText(testLine).width > maxWidth && line) {
            ctx.fillText(line, x, y + lineCount * lineHeight);
            line = words[n];
            lineCount += 1;
            if (lineCount >= maxLines - 1) break;
        } else {
            line = testLine;
        }
    }
    if (line && lineCount < maxLines) {
        ctx.fillText(line, x, y + lineCount * lineHeight);
        lineCount += 1;
    }
    return lineCount;
}

function startMotionCanvasLoop() {
    const canvas = $("ocMotionCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function renderFrame(nowMs) {
        const aspect = $("ocMuiAspect")?.value || "16:9";
        const cfg = MOTION_UI_ASPECT_CONFIGS[aspect] || MOTION_UI_ASPECT_CONFIGS["16:9"];
        const targetW = Math.round(cfg.width / 2);
        const targetH = Math.round(cfg.height / 2);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }

        const durSec = Number($("ocMuiDuration")?.value || 10);
        const elapsedSec = ((nowMs - state.canvasStartMs) / 1000) % durSec;
        const frame = Math.floor(elapsedSec * 30);
        const p = readCurrentMotionProps();
        const isDark = p.themeMode !== "light";

        ctx.save();
        ctx.fillStyle = isDark ? "#050507" : "#f8fafc";
        ctx.fillRect(0, 0, targetW, targetH);

        const shift = Math.sin(frame / 20) * 18;
        const grad1 = ctx.createRadialGradient(targetW - 90 - shift, 80 + shift, 10, targetW - 90, 80, 320);
        grad1.addColorStop(0, `${p.accentColor}55`);
        grad1.addColorStop(1, "transparent");
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, targetW, targetH);

        const grad2 = ctx.createRadialGradient(110 + shift, targetH - 70, 10, 110, targetH - 70, 290);
        grad2.addColorStop(0, `${p.secondaryColor}44`);
        grad2.addColorStop(1, "transparent");
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, targetW, targetH);

        const padX = targetH > targetW ? 36 : 48;
        const padY = 40;
        const sBadge = springProgress(frame, 30, 0);
        const sTitle = springProgress(frame, 30, 7);
        const sSub = springProgress(frame, 30, 15);
        const sCards = springProgress(frame, 30, 24);

        ctx.globalAlpha = Math.min(1, sBadge);
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.font = "800 14px Inter, sans-serif";
        ctx.fillText(p.brandName, padX, padY + (1 - sBadge) * -14);

        ctx.fillStyle = p.accentColor;
        ctx.font = "700 11px Inter, sans-serif";
        const badgeWidth = ctx.measureText(p.badgeText).width + 20;
        ctx.strokeStyle = `${p.accentColor}88`;
        ctx.strokeRect(targetW - padX - badgeWidth, padY - 14, badgeWidth, 22);
        ctx.fillText(p.badgeText, targetW - padX - badgeWidth + 10, padY + 1);

        ctx.globalAlpha = Math.min(1, sTitle);
        ctx.fillStyle = isDark ? "#ffffff" : "#09090b";
        const titleSize = targetH > targetW ? 32 : 34;
        ctx.font = `900 ${titleSize}px Inter, sans-serif`;
        const titleY = targetH * 0.30 + (1 - sTitle) * 20;
        const usedLines = wrapCanvasText(ctx, p.headline, padX, titleY, targetW - padX * 2, titleSize * 1.15, 3);

        ctx.globalAlpha = Math.min(1, sSub);
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.68)" : "rgba(15,23,42,0.7)";
        ctx.font = "500 15px Inter, sans-serif";
        wrapCanvasText(
            ctx,
            p.subheadline,
            padX,
            titleY + usedLines * (titleSize * 1.15) + 10,
            targetW - padX * 2,
            21,
            2
        );

        ctx.globalAlpha = Math.min(1, sCards);
        const metrics = [
            [p.metric1Label, p.metric1Value],
            [p.metric2Label, p.metric2Value],
            [p.metric3Label, p.metric3Value]
        ];
        const cardY = targetH - padY - 76 + (1 - sCards) * 18;
        const cardW = Math.floor((targetW - padX * 2 - 20) / 3);
        metrics.forEach(([lbl, val], idx) => {
            const cx = padX + idx * (cardW + 10);
            ctx.fillStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
            ctx.fillRect(cx, cardY, cardW, 64);
            ctx.strokeStyle = isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)";
            ctx.strokeRect(cx, cardY, cardW, 64);
            ctx.fillStyle = isDark ? "#94a3b8" : "#475569";
            ctx.font = "700 10px Inter, sans-serif";
            ctx.fillText(String(lbl || "").slice(0, 18), cx + 10, cardY + 20);
            ctx.fillStyle = p.accentColor;
            ctx.font = "900 17px Inter, sans-serif";
            ctx.fillText(String(val || "").slice(0, 14), cx + 10, cardY + 46);
        });

        ctx.restore();
        requestAnimationFrame(renderFrame);
    }

    requestAnimationFrame(renderFrame);
}

function bindMotionUiHandlers() {
    const grid = $("ocMotionTemplateGrid");
    if (grid) {
        grid.innerHTML = state.templates.map((tpl, idx) => `
            <button type="button" class="oc-tpl-item${idx === 0 ? " active" : ""}" data-tpl-id="${escapeHtml(tpl.id)}">
                <span class="oc-tpl-cat">${escapeHtml(tpl.category)}</span>
                <strong class="oc-tpl-name">${escapeHtml(tpl.name)}</strong>
                <span class="oc-tpl-desc">${escapeHtml(tpl.description)}</span>
            </button>
        `).join("");

        grid.addEventListener("click", ev => {
            const item = ev.target.closest?.("[data-tpl-id]");
            if (!item) return;
            const id = item.getAttribute("data-tpl-id");
            state.selectedTemplateId = id;
            grid.querySelectorAll(".oc-tpl-item").forEach(el => el.classList.toggle("active", el === item));
            const found = state.templates.find(t => t.id === id);
            populateMotionTemplateFields(found);
        });
    }

    populateMotionTemplateFields(state.templates[0]);
    startMotionCanvasLoop();

    $("ocReplayCanvasBtn")?.addEventListener("click", () => {
        state.canvasStartMs = performance.now();
    });

    $("ocSubmitMotionBtn")?.addEventListener("click", async () => {
        const btn = $("ocSubmitMotionBtn");
        btn.disabled = true;
        try {
            notify("Memulai job render Motion UI Remotion di GitHub Actions…");
            const res = await callOpusClipApi("submit_motion_ui", {
                templateId: state.selectedTemplateId,
                aspectRatio: $("ocMuiAspect")?.value || "16:9",
                durationSec: Number($("ocMuiDuration")?.value || 10),
                props: readCurrentMotionProps()
            });
            notify(`Render dimulai (${res.job?.job_key})! Video MP4 akan muncul otomatis setelah selesai.`);
            await loadMotionJobs();
        } catch (err) {
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    $("ocRefreshMotionJobsBtn")?.addEventListener("click", () => loadMotionJobs());
}

async function loadMotionJobs() {
    try {
        const res = await callOpusClipApi("list_motion_ui_jobs", {}, "GET");
        const box = $("ocMotionJobsList");
        if (!box) return;
        const jobs = res.jobs || [];
        if (jobs.length === 0) {
            box.innerHTML = `<p class="oc-card-sub">Belum ada riwayat render Motion UI.</p>`;
            return;
        }
        box.innerHTML = jobs.map(j => `
            <div style="border: 1px solid var(--oc-border); border-radius: 12px; padding: 12px; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <strong>${escapeHtml(j.template_id)} (${escapeHtml(j.aspect_ratio)} · ${j.duration_sec}s)</strong>
                    <span class="oc-pill ${j.status === "completed" ? "oc-pill--ok" : "oc-pill--warn"}">${escapeHtml(j.status.toUpperCase())}</span>
                </div>
                ${j.result_url ? `
                    <video controls preload="metadata" src="${escapeHtml(j.result_url)}" style="width:100%; border-radius:10px; margin-top:8px; max-height:240px; background:#000;"></video>
                    <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:8px;">
                        <a class="oc-btn oc-btn--primary oc-btn--sm" href="${escapeHtml(j.result_url)}" target="_blank" rel="noopener" download="${escapeHtml(j.job_key)}.mp4">⬇️ Unduh MP4 Full HD</a>
                        <button type="button" class="oc-btn oc-btn--sm" data-mui-send-soc="${escapeHtml(j.result_url)}" data-mui-title="${escapeHtml(j.headline || j.brand_name || j.template_id)}">📡 Auto Post ke Medsos</button>
                    </div>
                ` : j.error_message ? `<p class="oc-card-sub" style="color:#f87171;">${escapeHtml(j.error_message)}</p>` : `<p class="oc-card-sub">Sedang di-render di GitHub Actions… Klik Cek Status Render dalam 1-2 menit.</p>`}
            </div>
        `).join("");
        box.onclick = ev => {
            const sendBtn = ev.target.closest?.("[data-mui-send-soc]");
            if (!sendBtn) return;
            sendVideoToNativeSocialComposer({
                videoRef: sendBtn.getAttribute("data-mui-send-soc") || "",
                sourceType: "history",
                title: sendBtn.getAttribute("data-mui-title") || ""
            });
            document.querySelector('[data-oc-tab="social"]')?.click();
        };
    } catch (err) {
        notify(err.message, true);
    }
}

/* =========================================================
   PANEL 6: SOCIAL POSTING & ORG API USAGE (OWNER / ADMIN)
========================================================= */

function bindSocialAdminHandlers() {
    $("ocLoadSocialAccountsBtn")?.addEventListener("click", async () => {
        try {
            const res = await callOpusClipApi("list_social_accounts", {}, "GET");
            state.socialAccounts = res.accounts || [];
            const sel = $("ocSocAccountSelect");
            if (sel) {
                sel.innerHTML = state.socialAccounts.length === 0
                    ? `<option value="">Belum ada akun sosial terhubung di OpusClip</option>`
                    : state.socialAccounts.map((a, idx) =>
                        `<option value="${idx}">${escapeHtml(a.platform)} — ${escapeHtml(a.name || a.post_account_id)}</option>`
                    ).join("");
                if (state.socialAccounts[0]) {
                    $("ocSocPlatform").value = state.socialAccounts[0].platform || "YOUTUBE";
                }
            }
            notify(`Berhasil memuat ${state.socialAccounts.length} akun sosial organisasi.`);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocSocAccountSelect")?.addEventListener("change", () => {
        const idx = Number($("ocSocAccountSelect")?.value);
        const acct = state.socialAccounts[idx];
        if (acct?.platform) $("ocSocPlatform").value = acct.platform;
    });

    $("ocGenSocialCopyBtn")?.addEventListener("click", async () => {
        const projectId = $("ocSocProjectId")?.value.trim();
        const clipId = $("ocSocClipId")?.value.trim();
        const platform = $("ocSocPlatform")?.value || "YOUTUBE";
        if (!projectId || !clipId) return notify("Isi Project ID dan Clip ID terlebih dahulu.", true);
        try {
            notify("Membuat AI Caption & Hashtags sesuai platform…");
            const start = await callOpusClipApi("submit_social_copy", { projectId, clipId, platform });
            let job = start.copyJob;
            if (!job?.description && job?.job_id) {
                for (let i = 0; i < 15; i += 1) {
                    await new Promise(r => setTimeout(r, 2500));
                    const poll = await callOpusClipApi("get_social_copy", { jobId: job.job_id }, "GET");
                    job = poll.copyJob;
                    if (job?.description || job?.title || job?.status === "CONCLUDED") break;
                }
            }
            if (job?.title) $("ocSocTitle").value = job.title;
            if (job?.description) $("ocSocDesc").value = job.description;
            if (Array.isArray(job?.hashtags)) $("ocSocTags").value = job.hashtags.join(" ");
            notify("AI Social Copy siap!");
        } catch (err) {
            notify(err.message, true);
        }
    });

    const collectPostPayload = () => {
        const idx = Number($("ocSocAccountSelect")?.value);
        const acct = state.socialAccounts[idx];
        if (!acct) throw new Error("Muat & pilih akun sosial terlebih dahulu.");
        return {
            projectId: $("ocSocProjectId")?.value.trim(),
            clipId: $("ocSocClipId")?.value.trim(),
            platform: $("ocSocPlatform")?.value || acct.platform,
            postAccountId: acct.post_account_id,
            subAccountId: acct.sub_account_id,
            title: $("ocSocTitle")?.value.trim(),
            description: $("ocSocDesc")?.value.trim(),
            hashtags: $("ocSocTags")?.value.trim()
        };
    };

    $("ocPublishNowBtn")?.addEventListener("click", async () => {
        try {
            const payload = collectPostPayload();
            const res = await callOpusClipApi("publish_social_post", payload);
            notify(`Postingan dikirim! Task ID: ${res.published?.post_task_id || "-"}`);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocSchedulePostBtn")?.addEventListener("click", async () => {
        try {
            const payload = collectPostPayload();
            const rawDt = $("ocSocScheduleTime")?.value;
            if (!rawDt) return notify("Pilih tanggal & jam tayang terlebih dahulu.", true);
            payload.publishAt = new Date(rawDt).toISOString();
            const res = await callOpusClipApi("schedule_social_post", payload);
            notify(`Berhasil dijadwalkan (${res.scheduled?.schedule_id}) pada ${res.scheduled?.scheduled_at}!`);
            $("ocLoadScheduledBtn")?.click();
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocLoadApiUsageBtn")?.addEventListener("click", async () => {
        try {
            const res = await callOpusClipApi("get_api_usage", {}, "GET");
            $("ocApiUsageBox").textContent = JSON.stringify(res.usage, null, 2);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocLoadScheduledBtn")?.addEventListener("click", async () => {
        try {
            const res = await callOpusClipApi("list_scheduled_posts", {
                projectId: $("ocSocProjectId")?.value.trim() || ""
            }, "GET");
            const box = $("ocScheduledPostsList");
            const posts = res.posts || [];
            if (!box) return;
            if (posts.length === 0) {
                box.innerHTML = `<p class="oc-card-sub">Tidak ada jadwal posting ditemukan pada periode ini.</p>`;
                return;
            }
            box.innerHTML = posts.map(p => `
                <div style="border:1px solid var(--oc-border); border-radius:10px; padding:10px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${escapeHtml(p.platform || "-")} · ${escapeHtml(p.status || "-")}</strong>
                        ${p.schedule_id ? `<button type="button" class="oc-btn oc-btn--sm oc-btn--danger" data-cancel-sched="${escapeHtml(p.schedule_id)}">Batalkan</button>` : ""}
                    </div>
                    <div class="oc-card-sub">Jadwal: ${escapeHtml(p.publish_at || "-")} · Klip: ${escapeHtml(p.project_id)}.${escapeHtml(p.clip_id)}</div>
                </div>
            `).join("");

            box.onclick = async ev => {
                const btn = ev.target.closest?.("[data-cancel-sched]");
                if (!btn) return;
                const scheduleId = btn.getAttribute("data-cancel-sched");
                try {
                    await callOpusClipApi("cancel_scheduled_post", { scheduleId });
                    notify(`Jadwal ${scheduleId} dibatalkan.`);
                    $("ocLoadScheduledBtn")?.click();
                } catch (err) {
                    notify(err.message, true);
                }
            };
        } catch (err) {
            notify(err.message, true);
        }
    });
}

/* =========================================================
   MULTI-USER SOCIAL VIDEO AUTO POST (SEMUA USER)
========================================================= */

function switchVideoSourceMode(mode) {
    document.querySelectorAll("[data-vid-src]").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-vid-src") === mode);
    });
    document.querySelectorAll("[data-vid-src-box]").forEach(box => {
        box.hidden = box.getAttribute("data-vid-src-box") !== mode;
    });
}

async function updateSelectedVideoPreview(videoRef, sourceType = "url") {
    const cleanRef = String(videoRef || "").trim();
    if ($("ocSelectedVideoRef")) $("ocSelectedVideoRef").value = cleanRef;
    if ($("ocSelectedVideoSourceType")) $("ocSelectedVideoSourceType").value = sourceType;

    const wrap = $("ocNativePreviewWrap");
    const vid = $("ocNativeVideoPreview");
    if (!wrap || !vid) return;

    if (!cleanRef) {
        vid.removeAttribute("src");
        wrap.hidden = true;
        return;
    }

    try {
        let previewUrl = cleanRef;
        if (cleanRef.startsWith("supabase-private://")) {
            const signed = await callSocialVideoApi("sign_preview", { videoRef: cleanRef }, "GET");
            previewUrl = signed.previewUrl;
        }
        vid.src = previewUrl;
        wrap.hidden = false;
    } catch (err) {
        notify(err.message, true);
    }
}

function sendVideoToNativeSocialComposer({ videoRef, sourceType = "url", title = "" }) {
    switchVideoSourceMode("url");
    if ($("ocNativeVideoUrlInput")) $("ocNativeVideoUrlInput").value = videoRef;
    if (title && $("ocNativePostTitle") && !$("ocNativePostTitle").value.trim()) {
        $("ocNativePostTitle").value = title;
    }
    updateSelectedVideoPreview(videoRef, sourceType);
}

function platformIconLabel(platform) {
    const p = String(platform || "").toLowerCase();
    if (p === "facebook") return "📘 Facebook Page";
    if (p === "youtube") return "▶️ YouTube";
    if (p === "tiktok") return "🎵 TikTok";
    return String(platform || "").toUpperCase();
}

function renderUserSocialAccounts(accounts = []) {
    state.userSocialAccounts = accounts;
    const box = $("ocUserSocialAccountsList");
    if (!box) return;

    if (!Array.isArray(accounts) || accounts.length === 0) {
        box.innerHTML = `<p class="oc-card-sub">Belum ada akun medsos terhubung. Ketuk tombol Hubungkan Facebook, YouTube, atau TikTok di atas.</p>`;
        return;
    }

    box.innerHTML = accounts.map((acct, idx) => `
        <div class="oc-acct-item">
            <label class="oc-acct-check">
                <input type="checkbox" name="ocTargetSocialAcct" value="${escapeHtml(acct.id)}" ${idx === 0 ? "checked" : ""}>
                <span class="oc-pill oc-pill--ok">${escapeHtml(platformIconLabel(acct.platform))}</span>
                <span class="oc-acct-name">${escapeHtml(acct.account_name || acct.external_account_id)}${acct.account_handle ? ` (${escapeHtml(acct.account_handle)})` : ""}</span>
            </label>
            <button type="button" class="oc-btn oc-btn--sm oc-btn--danger" data-disconnect-acct="${escapeHtml(acct.id)}">Putuskan</button>
        </div>
    `).join("");

    box.onclick = async ev => {
        const discBtn = ev.target.closest?.("[data-disconnect-acct]");
        if (!discBtn) return;
        const accountId = discBtn.getAttribute("data-disconnect-acct");
        discBtn.disabled = true;
        try {
            const res = await callSocialVideoApi("disconnect_account", { accountId });
            renderUserSocialAccounts(res.accounts || []);
            notify("Akun medsos berhasil diputuskan.");
        } catch (err) {
            notify(err.message, true);
            discBtn.disabled = false;
        }
    };
}

function renderHistoryVideoOptions(historyVideos = []) {
    state.historyVideos = historyVideos;
    const sel = $("ocNativeHistoryVideoSelect");
    if (!sel) return;
    if (!Array.isArray(historyVideos) || historyVideos.length === 0) {
        sel.innerHTML = `<option value="">Belum ada video selesai di Riwayat Generate / Motion UI</option>`;
        return;
    }
    sel.innerHTML = `<option value="">-- Pilih dari ${historyVideos.length} Video Riwayat Saya --</option>` +
        historyVideos.map((v, idx) => `<option value="${idx}">${escapeHtml(v.label)}</option>`).join("");
}

function renderNativePostsList(posts = []) {
    const box = $("ocNativePostsList");
    if (!box) return;

    if (!Array.isArray(posts) || posts.length === 0) {
        box.innerHTML = `<p class="oc-card-sub">Belum ada antrean jadwal atau riwayat Auto Post pada akun Anda.</p>`;
        return;
    }

    box.innerHTML = posts.map(p => {
        const st = String(p.status || "").toLowerCase();
        const badgeCls = st === "published"
            ? "oc-pill--ok"
            : st === "failed" || st === "cancelled"
                ? "oc-pill--warn"
                : "";
        const timeStr = p.published_at
            ? `Tayang: ${new Date(p.published_at).toLocaleString("id-ID")}`
            : p.scheduled_for
                ? `Jadwal: ${new Date(p.scheduled_for).toLocaleString("id-ID")}`
                : "";

        return `
            <div class="oc-post-item">
                <div class="oc-post-head">
                    <strong>${escapeHtml(platformIconLabel(p.platform))} · ${escapeHtml(p.title || "Video Post")}</strong>
                    <span class="oc-pill ${badgeCls}">${escapeHtml(st.toUpperCase())}</span>
                </div>
                <div class="oc-card-sub">${escapeHtml(timeStr)}${p.credit_cost ? ` · ${formatNum(p.credit_cost)} kredit${p.credit_refunded ? " (Refunded)" : ""}` : ""}</div>
                ${p.error_message ? `<div class="oc-card-sub" style="color:#f87171; margin-top:4px;">${escapeHtml(p.error_message)}</div>` : ""}
                <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                    ${p.remote_post_url ? `<a class="oc-btn oc-btn--primary oc-btn--sm" href="${escapeHtml(p.remote_post_url)}" target="_blank" rel="noopener">🔗 Buka Postingan ↗</a>` : ""}
                    ${st === "scheduled" ? `<button type="button" class="oc-btn oc-btn--sm oc-btn--danger" data-cancel-native-post="${escapeHtml(p.id)}">Batalkan Jadwal</button>` : ""}
                </div>
            </div>
        `;
    }).join("");

    box.onclick = async ev => {
        const cancelBtn = ev.target.closest?.("[data-cancel-native-post]");
        if (!cancelBtn) return;
        cancelBtn.disabled = true;
        try {
            const res = await callSocialVideoApi("cancel_post", {
                postId: cancelBtn.getAttribute("data-cancel-native-post")
            });
            renderNativePostsList(res.posts || []);
            notify("Jadwal Auto Post dibatalkan.");
        } catch (err) {
            notify(err.message, true);
            cancelBtn.disabled = false;
        }
    };
}

async function loadNativeSocialBootstrap() {
    try {
        const data = await callSocialVideoApi("bootstrap", {}, "GET");
        if (typeof data.creditCost === "number") {
            state.costs.opusclip_social_post = data.creditCost;
            updateCostBadges();
        }
        renderUserSocialAccounts(data.accounts || []);
        renderHistoryVideoOptions(data.historyVideos || []);
        renderNativePostsList(data.posts || []);
    } catch (err) {
        const box = $("ocUserSocialAccountsList");
        if (box) box.innerHTML = `<p class="oc-card-sub">${escapeHtml(err.message)}</p>`;
    }
}

function bindMultiUserSocialHandlers() {
    const startOAuth = async platform => {
        try {
            notify(`Membuka halaman izin resmi ${platform.toUpperCase()}…`);
            const res = await callSocialVideoApi("oauth_start", { platform });
            if (res.authorizeUrl) {
                window.location.href = res.authorizeUrl;
            }
        } catch (err) {
            notify(err.message, true);
        }
    };

    $("ocConnectFbBtn")?.addEventListener("click", () => startOAuth("facebook"));
    $("ocConnectYtBtn")?.addEventListener("click", () => startOAuth("youtube"));
    $("ocConnectTtBtn")?.addEventListener("click", () => startOAuth("tiktok"));

    $("ocRefreshUserAccountsBtn")?.addEventListener("click", async () => {
        try {
            const res = await callSocialVideoApi("list_accounts", {}, "GET");
            renderUserSocialAccounts(res.accounts || []);
            notify("Daftar akun medsos diperbarui.");
        } catch (err) {
            notify(err.message, true);
        }
    });

    document.querySelectorAll("[data-vid-src]").forEach(btn => {
        btn.addEventListener("click", () => {
            switchVideoSourceMode(btn.getAttribute("data-vid-src") || "upload");
        });
    });

    $("ocNativeUploadVideoBtn")?.addEventListener("click", async () => {
        const file = $("ocNativeVideoFile")?.files?.[0];
        if (!file) return notify("Pilih file video MP4 dari HP terlebih dahulu.", true);
        const btn = $("ocNativeUploadVideoBtn");
        const statusEl = $("ocNativeUploadStatus");
        btn.disabled = true;
        try {
            if (statusEl) statusEl.textContent = `Mengunggah ${file.name} (${Math.round(file.size / (1024 * 1024) * 10) / 10} MB)…`;
            const signed = await callSocialVideoApi("create_upload_url", {
                fileName: file.name,
                fileSize: file.size
            });
            const putResp = await fetch(signed.uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": file.type || "video/mp4",
                    "x-upsert": "true"
                },
                body: file
            });
            if (!putResp.ok) {
                throw new Error(`Unggah video ke penyimpanan gagal (HTTP ${putResp.status}).`);
            }
            if (statusEl) statusEl.textContent = `✅ Video '${file.name}' siap di-post / dijadwalkan!`;
            if ($("ocNativePostTitle") && !$("ocNativePostTitle").value.trim()) {
                $("ocNativePostTitle").value = file.name.replace(/\.[^.]+$/, "").slice(0, 80);
            }
            await updateSelectedVideoPreview(signed.storageRef, "upload");
            notify("Video MP4 berhasil diunggah dan siap dipublikasikan!");
        } catch (err) {
            if (statusEl) statusEl.textContent = `Gagal mengunggah: ${err.message}`;
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    $("ocRefreshHistoryVideosBtn")?.addEventListener("click", async () => {
        try {
            const res = await callSocialVideoApi("list_history_videos", {}, "GET");
            renderHistoryVideoOptions(res.historyVideos || []);
            notify(`Memuat ${(res.historyVideos || []).length} video dari riwayat Anda.`);
        } catch (err) {
            notify(err.message, true);
        }
    });

    $("ocNativeHistoryVideoSelect")?.addEventListener("change", () => {
        const idx = Number($("ocNativeHistoryVideoSelect")?.value);
        const item = state.historyVideos[idx];
        if (!item) return;
        if ($("ocNativePostTitle") && !$("ocNativePostTitle").value.trim()) {
            $("ocNativePostTitle").value = item.title || "";
        }
        updateSelectedVideoPreview(item.video_ref, "history");
    });

    $("ocNativeVideoUrlInput")?.addEventListener("change", () => {
        const val = $("ocNativeVideoUrlInput")?.value.trim() || "";
        updateSelectedVideoPreview(val, "url");
    });

    $("ocGenNativeAiCopyBtn")?.addEventListener("click", async () => {
        const btn = $("ocGenNativeAiCopyBtn");
        btn.disabled = true;
        try {
            const checkedIds = [...document.querySelectorAll('input[name="ocTargetSocialAcct"]:checked')].map(el => el.value);
            const platforms = state.userSocialAccounts
                .filter(a => checkedIds.includes(a.id))
                .map(a => a.platform);
            const topic = $("ocNativePostTitle")?.value.trim() || $("ocNativePostCaption")?.value.trim() || "Video kreatif AI viral";
            const res = await callSocialVideoApi("generate_ai_caption", { topic, platforms });
            if (res.copy?.title) $("ocNativePostTitle").value = res.copy.title;
            if (res.copy?.caption) $("ocNativePostCaption").value = res.copy.caption;
            if (res.copy?.hashtags) $("ocNativePostHashtags").value = res.copy.hashtags;
            notify("Judul, Caption & Hashtag AI siap!");
        } catch (err) {
            notify(err.message, true);
        } finally {
            btn.disabled = false;
        }
    });

    const submitNativePost = async publishNow => {
        const checkedIds = [...document.querySelectorAll('input[name="ocTargetSocialAcct"]:checked')].map(el => el.value);
        if (checkedIds.length === 0) {
            return notify("Centang minimal 1 akun medsos terhubung terlebih dahulu.", true);
        }

        let videoRef = $("ocSelectedVideoRef")?.value.trim() || "";
        let sourceType = $("ocSelectedVideoSourceType")?.value || "url";
        if (!videoRef && !$("ocVidSrcBoxUrl")?.hidden) {
            videoRef = $("ocNativeVideoUrlInput")?.value.trim() || "";
            sourceType = "url";
        }
        if (!videoRef) {
            return notify("Unggah atau pilih sumber video MP4 terlebih dahulu.", true);
        }

        const rawSchedule = $("ocNativeScheduleTime")?.value || "";
        if (!publishNow && !rawSchedule) {
            return notify("Pilih tanggal & jam pada kolom Jadwal Tayang Auto Post terlebih dahulu.", true);
        }

        const btn = publishNow ? $("ocNativePublishNowBtn") : $("ocNativeScheduleBtn");
        if (btn) btn.disabled = true;

        try {
            notify(
                publishNow
                    ? `Memublikasikan video ke ${checkedIds.length} akun medsos…`
                    : `Menyimpan jadwal Auto Post untuk ${checkedIds.length} akun medsos…`
            );
            const res = await callSocialVideoApi("create_posts", {
                accountIds: checkedIds,
                videoRef,
                videoSourceType: sourceType,
                title: $("ocNativePostTitle")?.value.trim() || "",
                caption: $("ocNativePostCaption")?.value.trim() || "",
                hashtags: $("ocNativePostHashtags")?.value.trim() || "",
                privacyLevel: $("ocNativePostPrivacy")?.value || "public",
                publishNow,
                scheduledFor: !publishNow && rawSchedule ? new Date(rawSchedule).toISOString() : ""
            });

            if (res.posts) renderNativePostsList(res.posts);
            else await $("ocRefreshNativePostsBtn")?.click();

            if (publishNow) {
                notify(`Berhasil mem-posting ke ${res.succeeded} akun medsos!`);
            } else {
                notify(`Jadwal Auto Post tersimpan untuk ${res.scheduledCount} akun pada ${new Date(res.scheduledFor).toLocaleString("id-ID")}!`);
            }
        } catch (err) {
            notify(err.message, true);
            loadNativeSocialBootstrap().catch(() => {});
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    $("ocNativePublishNowBtn")?.addEventListener("click", () => submitNativePost(true));
    $("ocNativeScheduleBtn")?.addEventListener("click", () => submitNativePost(false));

    $("ocRefreshNativePostsBtn")?.addEventListener("click", async () => {
        try {
            const res = await callSocialVideoApi("list_posts", {}, "GET");
            renderNativePostsList(res.posts || []);
            notify("Riwayat & antrean Auto Post diperbarui.");
        } catch (err) {
            notify(err.message, true);
        }
    });
}

/* =========================================================
   BOOTSTRAP INITIALIZATION
========================================================= */

async function bootstrapStudio() {
    initTabs();
    bindClippingHandlers();
    bindThumbnailHandlers();
    bindEditorHandlers();
    bindUnderstandingHandlers();
    bindMotionUiHandlers();
    bindMultiUserSocialHandlers();
    bindSocialAdminHandlers();

    /* Buka tab Social otomatis jika kembali dari callback OAuth */
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get("tab") === "social") {
        document.querySelector('[data-oc-tab="social"]')?.click();
    }
    if (currentParams.get("connected")) {
        const plat = currentParams.get("connected").toUpperCase();
        notify(`✅ Akun ${plat} berhasil ditautkan ke profil GEN-Z.AI Anda!`);
        window.history.replaceState({}, "", `${window.location.pathname}?tab=social`);
    } else if (currentParams.get("oauth_error")) {
        notify(currentParams.get("oauth_error"), true);
        window.history.replaceState({}, "", `${window.location.pathname}?tab=social`);
    }

    if (window.GENZNavigationReady?.then) {
        await window.GENZNavigationReady.catch(() => {});
    }

    loadNativeSocialBootstrap().catch(() => {});

    try {
        const boot = await callOpusClipApi("studio_bootstrap", {}, "GET");
        if (boot.costs) {
            state.costs = { ...state.costs, ...boot.costs };
            updateCostBadges();
        }
        if (boot.viewer) {
            state.viewer = boot.viewer;
            if (boot.viewer.credits !== null && boot.viewer.credits !== undefined) {
                updateCreditDisplay(boot.viewer.credits);
            }
            if (boot.viewer.isAdminOrOwner && $("ocAdminOpusOrgSection")) {
                $("ocAdminOpusOrgSection").hidden = false;
            }
        }
        const badges = $("ocReadinessBadges");
        if (badges && boot.readiness) {
            badges.innerHTML = [
                `<span class="oc-pill ${boot.readiness.restConfigured ? "oc-pill--ok" : "oc-pill--warn"}">API: ${boot.readiness.restConfigured ? "Siap" : "Atur di Black Box"}</span>`,
                `<span class="oc-pill ${boot.readiness.mcpConfigured ? "oc-pill--ok" : "oc-pill--warn"}">MCP Style: ${boot.readiness.mcpConfigured ? "Siap" : "Login di Black Box"}</span>`,
                `<span class="oc-pill ${boot.readiness.githubActionsConfigured ? "oc-pill--ok" : "oc-pill--warn"}">Remotion: ${boot.readiness.githubActionsConfigured ? "Siap" : "Perlu GITHUB_PAT"}</span>`
            ].join("");
        }
        loadMotionJobs().catch(() => {});
    } catch (err) {
        notify(`Gagal memuat konfigurasi awal: ${err.message}`, true);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapStudio, { once: true });
} else {
    bootstrapStudio();
}
