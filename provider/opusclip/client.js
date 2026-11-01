/* =========================================================
   GEN-Z.AI — OPUSCLIP CORE REST API CLIENT (BAGIAN 2)
   ---------------------------------------------------------
   File:
     provider/opusclip/client.js

   100% browser-safe ES module (TANPA impor `node:*` / `lib/**`)
   sehingga lolos verifikasi `scripts/build-cloudflare-pages.mjs`
   dan berjalan identik di Cloudflare Workers maupun Node.js 20+.

   Mengimplementasikan kontrak wire resmi `https://api.opus.pro/api`:
   1. AI Video Clipping (`/clip-projects`, `/exportable-clips`, `/transcripts`,
      `/brand-templates`, `/collections`, `/upload-links`)
   2. AI Video Dubbing & Caption Translation (`dubbingOptions` & `importPref`)
   3. AI YouTube Thumbnail Generator (`/generative-jobs` `jobType: "thumbnail"`)
   4. Server-Side Clip Editor & Profanity Censor (`/censor-jobs`, `duplicate`,
      `?include=editingScript`, `re-render`)
   5. Multi-Platform Social Posting, Scheduling & Org API Usage
      (`/social-accounts`, `/social-copy-jobs`, `/post-tasks`,
       `/publish-schedules`, `/api-usage`)
========================================================= */

export const DEFAULT_OPUSCLIP_API_BASE = "https://api.opus.pro/api";
export const DEFAULT_OPUSCLIP_WEB_ORIGIN = "https://clip.opus.pro";
export const COPYRIGHT_CONFIRMATION_NOTICE =
    "Using video you don't own may violate copyright laws. By continuing, you confirm this is your own original content.";

export const VIDEO_DUBBING_QUICKSTART_CONFIG = Object.freeze({
    enableBonusClip: false,
    enableBRoll: false,
    enableVoiceover: false,
    enableVoiceEnhancement: false,
    enableRemoveFillerWords: false,
    enableRemovePauses: false,
    enableSoundEffect: false,
    skipReframe: true
});

const VALID_ASPECT_RATIOS = new Set(["portrait", "landscape", "square"]);
const VALID_CURATION_MODELS = new Set(["ClipBasic", "ClipAnything"]);
const VALID_VISIBILITIES = new Set(["PUBLIC", "DEFAULT"]);
const VALID_EXPORT_TARGETS = new Set(["hd", "4k", "xml"]);

function strOrUndef(value) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function numOrUndef(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asIso(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return "";
}

function bytesToMb(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    return Math.round(value / (1024 * 1024));
}

export function normalizeHashtags(value) {
    if (Array.isArray(value)) {
        return value
            .filter(item => typeof item === "string")
            .map(item => item.trim())
            .filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(/[\s,]+/)
            .map(item => item.trim())
            .filter(Boolean);
    }
    return [];
}

export function clipSuffix(clipId, projectId) {
    const cleanClip = String(clipId || "").trim();
    const cleanProject = String(projectId || "").trim();
    if (!cleanClip) return "";
    if (cleanProject && cleanClip.startsWith(`${cleanProject}.`)) {
        return cleanClip.slice(cleanProject.length + 1);
    }
    return cleanClip;
}

export function buildClipFullId(projectId, clipId) {
    const cleanProject = String(projectId || "").trim();
    const suffix = clipSuffix(clipId, cleanProject);
    if (!cleanProject || !suffix) {
        throw createOpusClipError("projectId dan clipId wajib diisi.", 400);
    }
    return `${cleanProject}.${suffix}`;
}

export function createOpusClipError(message, status = 500, code = "OPUSCLIP_ERROR", details = null) {
    const err = new Error(message);
    err.status = status;
    err.code = code;
    if (details !== null && details !== undefined) {
        err.details = details;
    }
    return err;
}

function normalizeClipDurations(rawDurations) {
    if (!rawDurations) return undefined;
    if (Array.isArray(rawDurations)) {
        const pairs = [];
        for (const item of rawDurations) {
            if (Array.isArray(item) && item.length === 2) {
                const minSec = Number(item[0]);
                const maxSec = Number(item[1]);
                if (!Number.isFinite(minSec) || !Number.isFinite(maxSec) || minSec < 0 || maxSec <= minSec) {
                    throw createOpusClipError("Rentang durasi klip tidak valid (contoh valid: [30, 60]).", 400);
                }
                pairs.push([Math.round(minSec), Math.round(maxSec)]);
            } else if (typeof item === "string" && item.includes("-")) {
                const [left, right] = item.split("-").map(part => Number(part.trim()));
                if (!Number.isFinite(left) || !Number.isFinite(right) || left < 0 || right <= left) {
                    throw createOpusClipError(`Format durasi klip '${item}' tidak valid.`, 400);
                }
                pairs.push([Math.round(left), Math.round(right)]);
            }
        }
        return pairs.length > 0 ? pairs : undefined;
    }
    if (typeof rawDurations === "string") {
        const trimmed = rawDurations.trim();
        if (!trimmed || trimmed === "auto") return undefined;
        return normalizeClipDurations(trimmed.split(",").map(s => s.trim()).filter(Boolean));
    }
    return undefined;
}

function normalizeTopicKeywords(rawKeywords) {
    if (!rawKeywords) return undefined;
    const list = Array.isArray(rawKeywords)
        ? rawKeywords
        : typeof rawKeywords === "string"
            ? rawKeywords.split(",")
            : [];
    const cleaned = list
        .map(item => String(item || "").trim())
        .filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
}

export function applyVideoDubbingQuickStart(rawInput = {}) {
    const dubbingLanguage = strOrUndef(rawInput.dubbingLanguage);
    if (!dubbingLanguage) {
        return { ...rawInput, dubbingLanguage: undefined };
    }

    const incompatibleChecks = [
        ["targetLang", Boolean(strOrUndef(rawInput.targetLang))],
        ["brandTemplateId", Boolean(strOrUndef(rawInput.brandTemplateId))],
        ["skipCurate", rawInput.skipCurate === true],
        ["enableAutoHook", rawInput.enableAutoHook === true],
        ["enableCaption", rawInput.enableCaption !== undefined],
        ["removeFiller", rawInput.removeFiller === true],
        ["clipDurationsSec", Boolean(normalizeClipDurations(rawInput.clipDurationsSec))],
        ["genre", Boolean(strOrUndef(rawInput.genre))],
        ["customPrompt", Boolean(strOrUndef(rawInput.customPrompt))],
        ["topicKeywords", Boolean(normalizeTopicKeywords(rawInput.topicKeywords))],
        ["rangeStart", rawInput.rangeStart !== undefined && rawInput.rangeStart !== null && rawInput.rangeStart !== ""],
        ["rangeEnd", rawInput.rangeEnd !== undefined && rawInput.rangeEnd !== null && rawInput.rangeEnd !== ""],
        ["model=ClipBasic", rawInput.model === "ClipBasic"],
        ["skipSlicing=false", rawInput.skipSlicing === false]
    ];

    const conflicts = incompatibleChecks
        .filter(([, triggered]) => triggered)
        .map(([label]) => label);

    if (conflicts.length > 0) {
        throw createOpusClipError(
            `Mode AI Video Dubbing (dubbingLanguage) tidak dapat digabung dengan opsi clipping: ${conflicts.join(", ")}. Kosongkan opsi tersebut atau gunakan Terjemah Caption (targetLang).`,
            400,
            "DUBBING_CONFLICT"
        );
    }

    return {
        ...rawInput,
        dubbingLanguage,
        model: "ClipAnything",
        skipSlicing: true,
        quickstartConfigOverride: { ...VIDEO_DUBBING_QUICKSTART_CONFIG }
    };
}

export function buildCurationPref(input = {}) {
    const skipSlicing = input.skipSlicing === true;
    const skipCurate = input.skipCurate === true;
    const enableAutoHook = input.enableAutoHook === true;
    const clipDurations = normalizeClipDurations(input.clipDurationsSec ?? input.clipDurations);
    const topicKeywords = normalizeTopicKeywords(input.topicKeywords);
    const customPrompt = strOrUndef(input.customPrompt);
    const genre = strOrUndef(input.genre);
    const model = strOrUndef(input.model);

    if (model && !VALID_CURATION_MODELS.has(model)) {
        throw createOpusClipError("Model kurasi harus 'ClipBasic' atau 'ClipAnything'.", 400);
    }

    if (enableAutoHook && (skipSlicing || skipCurate)) {
        throw createOpusClipError(
            "enableAutoHook tidak dapat digabung dengan skipSlicing atau skipCurate.",
            400,
            "CURATION_CONFLICT"
        );
    }

    if (clipDurations && (skipSlicing || skipCurate)) {
        throw createOpusClipError(
            "Rentang durasi klip (clipDurations) tidak dapat digabung dengan skipSlicing atau skipCurate.",
            400,
            "CURATION_CONFLICT"
        );
    }

    let range;
    const hasStart = input.rangeStart !== undefined && input.rangeStart !== null && input.rangeStart !== "";
    const hasEnd = input.rangeEnd !== undefined && input.rangeEnd !== null && input.rangeEnd !== "";
    if (hasStart || hasEnd) {
        const startSec = hasStart ? Number(input.rangeStart) : 0;
        const endSec = hasEnd ? Number(input.rangeEnd) : NaN;
        if (!Number.isFinite(startSec) || startSec < 0 || !Number.isFinite(endSec) || endSec <= startSec) {
            throw createOpusClipError("Rentang waktu video (rangeStart & rangeEnd) harus berupa detik valid dan end > start.", 400);
        }
        range = {
            startSec: Math.round(startSec),
            endSec: Math.round(endSec)
        };
    }

    const pref = {};
    if (model) pref.model = model;
    if (genre) pref.genre = genre;
    if (topicKeywords) pref.topicKeywords = topicKeywords;
    if (customPrompt) pref.customPrompt = customPrompt;
    if (clipDurations) pref.clipDurations = clipDurations;
    if (skipCurate) pref.skipCurate = true;
    if (skipSlicing) pref.skipSlicing = true;
    if (enableAutoHook) pref.enableAutoHook = true;
    if (range) pref.range = range;

    return Object.keys(pref).length > 0 ? pref : undefined;
}

export function buildSubmitProjectPayload(rawInput = {}) {
    const videoUrl = strOrUndef(rawInput.videoUrl);
    if (!videoUrl) {
        throw createOpusClipError("URL video publik atau Upload ID wajib diisi.", 400);
    }

    if (rawInput.confirmCopyright !== true) {
        throw createOpusClipError(
            "Anda wajib menyetujui konfirmasi hak cipta sebelum mengirim video ke OpusClip.",
            400,
            "COPYRIGHT_CONFIRMATION_REQUIRED"
        );
    }

    const input = applyVideoDubbingQuickStart(rawInput);
    const aspectRatio = strOrUndef(input.aspectRatio) || "portrait";
    if (!VALID_ASPECT_RATIOS.has(aspectRatio)) {
        throw createOpusClipError("Rasio aspek harus 'portrait' (9:16), 'landscape' (16:9), atau 'square' (1:1).", 400);
    }

    const renderPref = {
        layoutAspectRatio: aspectRatio
    };
    if (typeof input.enableCaption === "boolean") {
        renderPref.enableCaption = input.enableCaption;
    }
    if (input.quickstartConfigOverride) {
        renderPref.quickstartConfig = input.quickstartConfigOverride;
    } else if (typeof input.removeFiller === "boolean") {
        renderPref.quickstartConfig = {
            enableRemoveFillerWords: input.removeFiller
        };
    }

    const payload = {
        videoUrl,
        renderPref
    };

    const brandTemplateId = strOrUndef(input.brandTemplateId);
    if (brandTemplateId) payload.brandTemplateId = brandTemplateId;

    const title = strOrUndef(input.title);
    if (title) {
        payload.uploadedVideoAttr = { title };
    }

    if (input.dubbingLanguage) {
        payload.dubbingOptions = {
            enabled: true,
            targetLanguage: input.dubbingLanguage
        };
    }

    const sourceLang = strOrUndef(input.sourceLang);
    const targetLang = strOrUndef(input.targetLang);
    if (sourceLang || targetLang) {
        payload.importPref = {};
        if (sourceLang) payload.importPref.sourceLang = sourceLang;
        if (targetLang) payload.importPref.targetLang = targetLang;
    }

    const curationPref = buildCurationPref(input);
    if (curationPref) {
        payload.curationPref = curationPref;
    }

    const webhookUrl = strOrUndef(input.webhookUrl);
    if (webhookUrl) {
        payload.conclusionActions = [{ type: "WEBHOOK", url: webhookUrl }];
    }

    return payload;
}

/* =========================================================
   PROJECTORS (Sesuai skema upstream opus-skills)
========================================================= */

function renderPending(clip) {
    const file = clip?.renderAsVideoFile?.pending;
    const preview = clip?.renderAsVideoPreview?.pending;
    if (typeof file !== "boolean" && typeof preview !== "boolean") return undefined;
    return file === true || preview === true;
}

export function projectClip(c = {}) {
    const [projectId = "", ...rest] = String(c.id ?? "").split(".");
    const judge = c.judgeResult ?? {};
    return {
        project_id: projectId,
        clip_id: rest.join("."),
        rank: numOrUndef(c.rank),
        score: numOrUndef(c.score),
        title: c.title ?? "",
        description: c.description ?? "",
        hashtags: normalizeHashtags(c.hashtags),
        duration_sec: Math.round((Number(c.durationMs) || 0) / 1000),
        is_bonus: Boolean(c.isBonusClip),
        preview_url: strOrUndef(c.uriForPreview),
        export_url: strOrUndef(c.uriForExport),
        thumbnail_url: strOrUndef(c.uriForThumbnail),
        hook_score: numOrUndef(judge.hookScore),
        coherence_score: numOrUndef(judge.coherenceScore),
        connection_score: numOrUndef(judge.connectionScore),
        trend_score: numOrUndef(judge.trendScore),
        render_pending: renderPending(c)
    };
}

export function projectClipDetail(c = {}) {
    const [projectId = "", ...rest] = String(c.id ?? "").split(".");
    return {
        project_id: projectId,
        clip_id: rest.join("."),
        title: c.title ?? "",
        description: c.description ?? "",
        transcript: strOrUndef(c.text),
        keywords: Array.isArray(c.clipKeywords)
            ? c.clipKeywords.map(k => (typeof k === "string" ? k : k?.value)).filter(Boolean)
            : [],
        hashtags: normalizeHashtags(c.hashtags),
        duration_sec: Math.round((Number(c.durationMs) || 0) / 1000),
        score: numOrUndef(c.score),
        layout: strOrUndef(c.renderPref?.layoutType),
        aspect: strOrUndef(c.renderPref?.layoutAspectRatio),
        preview_url: strOrUndef(c.uriForPreview),
        export_url: strOrUndef(c.uriForExport),
        thumbnail_url: strOrUndef(c.uriForThumbnail),
        render_pending: renderPending(c)
    };
}

const EXPORT_TARGET_FIELDS = {
    hd: {
        url: c => c?.uriForExport,
        pending: c => c?.renderAsVideoFile?.pending,
        label: "HD"
    },
    "4k": {
        url: c => c?.uriForExport4K,
        pending: c => c?.renderAsVideoFile4K?.pending,
        label: "4K"
    },
    xml: {
        url: c => c?.uriForAdobePr,
        pending: c => c?.renderAsAdobeXml?.pending,
        label: "Adobe Premiere XML"
    }
};

export function projectClipExport(c = {}, opts = {}) {
    const target = VALID_EXPORT_TARGETS.has(opts.target) ? opts.target : "hd";
    const fields = EXPORT_TARGET_FIELDS[target];
    const [projectId = "", ...rest] = String(c.id ?? "").split(".");
    const base = {
        project_id: projectId,
        clip_id: rest.join("."),
        target
    };
    if (fields.pending(c) === true) {
        return {
            ...base,
            status: "rendering",
            export_url: undefined,
            message: `Render ${fields.label} sedang diproses — silakan cek lagi beberapa saat.`
        };
    }
    const url = strOrUndef(fields.url(c));
    if (url) {
        return {
            ...base,
            status: "ready",
            export_url: url
        };
    }
    return {
        ...base,
        status: "unavailable",
        export_url: undefined,
        preview_url: strOrUndef(c.uriForPreview),
        message: `Artefak ${fields.label} belum tersedia untuk klip ini.`
    };
}

export function projectClipProject(p = {}, webOrigin = DEFAULT_OPUSCLIP_WEB_ORIGIN) {
    const projectId = strOrUndef(p.projectId) ?? strOrUndef(p.id) ?? "";
    return {
        project_id: projectId,
        title: p.title ?? "",
        source_type: strOrUndef(p.sourceInfo?.type),
        source_video_id: strOrUndef(p.sourceInfo?.videoId),
        product_tier: strOrUndef(p.productTier),
        upload_id: strOrUndef(p.sourceId),
        stage: strOrUndef(p.stage),
        share_url: projectId ? `${webOrigin.replace(/\/+$/, "")}/clip/${projectId}` : "",
        created_at: asIso(p.createdAt),
        updated_at: asIso(p.updatedAt),
        is_deleted: Boolean(p.isDeleted)
    };
}

export function projectBrandTemplate(t = {}) {
    return {
        template_id: t.templateId ?? "",
        name: t.name ?? "",
        is_default: Boolean(t.isDefault),
        aspect_ratio: strOrUndef(t.preferences?.layoutAspectRatio),
        caption_animation: strOrUndef(t.preferences?.captionAnimation?.name)
    };
}

export function projectCollection(c = {}) {
    return {
        collection_id: c.collectionId ?? "",
        name: c.collectionName ?? "",
        created_at: asIso(c.createdAt),
        updated_at: asIso(c.updatedAt)
    };
}

export function projectTranscript(projectId, paragraphs) {
    if (!Array.isArray(paragraphs)) {
        return { project_id: projectId, paragraphs: [] };
    }
    return {
        project_id: projectId,
        paragraphs: paragraphs.map(p => ({
            paragraph_id: p?.id ?? "",
            start_ms: Math.round((Number(p?.start) || 0) * 1000),
            end_ms: Math.round((Number(p?.end) || 0) * 1000),
            text: p?.text ?? "",
            speaker: strOrUndef(p?.speaker),
            words: Array.isArray(p?.words)
                ? p.words.map(w => ({
                      word: w?.word ?? "",
                      start_ms: Math.round((Number(w?.start) || 0) * 1000),
                      end_ms: Math.round((Number(w?.end) || 0) * 1000),
                      is_filler_word: typeof w?.isFillerWord === "boolean" ? w.isFillerWord : undefined
                  }))
                : []
        }))
    };
}

export function projectUploadLink(raw = {}) {
    const data = raw?.data ?? raw ?? {};
    return {
        upload_id: String(data.uploadId || ""),
        upload_url: String(data.url || ""),
        gcs_url: strOrUndef(data.gsUrl),
        cdn_url: strOrUndef(data.cdnUrl),
        storage_quota_total_mb: bytesToMb(data.totalAmount),
        storage_quota_used_mb: bytesToMb(data.useAmount)
    };
}

export function projectThumbnailJob(jobId, raw = {}) {
    const body = raw?.data ?? raw ?? {};
    const uris = Array.isArray(body?.result?.generatedThumbnailUris)
        ? body.result.generatedThumbnailUris.filter(u => typeof u === "string" && u.trim())
        : [];
    return {
        job_id: jobId,
        status: String(body.status || "PROCESSING").toUpperCase(),
        progress: typeof body?.progress?.progress === "number" ? body.progress.progress : undefined,
        thumbnail_urls: uris,
        error_message: strOrUndef(body.errorMessage) || strOrUndef(body?.error?.message)
    };
}

export function projectSocialAccount(a = {}) {
    return {
        post_account_id: String(a.postAccountId || ""),
        sub_account_id: strOrUndef(a.subAccountId),
        platform: String(a.platform || ""),
        name: strOrUndef(a.extUserName),
        profile_url: strOrUndef(a.extUserProfileLink)
    };
}

export function projectSocialCopyJob(raw = {}) {
    const data = raw?.data ?? raw ?? {};
    const hashtags = normalizeHashtags(data.hashtags);
    return {
        job_id: String(data.jobId || ""),
        status: strOrUndef(data.status),
        is_cached: typeof data.cached === "boolean" ? data.cached : undefined,
        title: strOrUndef(data.title),
        description: strOrUndef(data.description),
        hashtags: hashtags.length > 0 ? hashtags : undefined
    };
}

export function projectScheduledPost(raw = {}) {
    return {
        schedule_id: strOrUndef(raw.scheduleId) ?? null,
        project_id: String(raw.projectId || ""),
        clip_id: String(raw.clipId || ""),
        publish_at: asIso(raw.publishAt),
        status: strOrUndef(raw.status),
        platform: strOrUndef(raw.platform),
        post_url: strOrUndef(raw.extVideoLink),
        failure_reason: strOrUndef(raw.errorMessage)
    };
}

/* =========================================================
   LOW-LEVEL HTTP CLIENT (`https://api.opus.pro/api`)
========================================================= */

export function createOpusClipApiClient({
    apiKey,
    orgId = "",
    baseUrl = DEFAULT_OPUSCLIP_API_BASE,
    webOrigin = DEFAULT_OPUSCLIP_WEB_ORIGIN,
    fetchImpl = globalThis.fetch,
    timeoutMs = 35_000
} = {}) {
    const cleanKey = String(apiKey || "").trim().replace(/^Bearer\s+/i, "").trim();
    if (!cleanKey) {
        throw createOpusClipError(
            "OPUSCLIP_API_KEY belum dikonfigurasi. Simpan di BLACK BOX Modul 03 terlebih dahulu.",
            503,
            "MISSING_API_KEY"
        );
    }

    const cleanBase = String(baseUrl || DEFAULT_OPUSCLIP_API_BASE).trim().replace(/\/+$/, "");
    const cleanOrgId = String(orgId || "").trim();

    async function request(method, path, body = undefined) {
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        const url = `${cleanBase}${cleanPath}`;
        const headers = {
            Authorization: `Bearer ${cleanKey}`,
            Accept: "application/json"
        };
        if (cleanOrgId) {
            headers["x-opus-org-id"] = cleanOrgId;
        }
        if (body !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let resp;
        try {
            resp = await fetchImpl(url, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });
        } catch (err) {
            if (controller.signal.aborted) {
                throw createOpusClipError(
                    `Permintaan ke OpusClip API melewati batas waktu (${Math.round(timeoutMs / 1000)} detik).`,
                    504,
                    "UPSTREAM_TIMEOUT"
                );
            }
            throw createOpusClipError(
                `Gagal menghubungi OpusClip API: ${err?.message || "network error"}`,
                502,
                "UPSTREAM_NETWORK"
            );
        } finally {
            clearTimeout(timer);
        }

        const rawText = await resp.text().catch(() => "");
        let parsed = null;
        if (rawText) {
            try {
                parsed = JSON.parse(rawText);
            } catch {
                parsed = null;
            }
        }

        if (!resp.ok) {
            const upstreamMsg =
                strOrUndef(parsed?.message) ||
                strOrUndef(parsed?.error?.message) ||
                strOrUndef(typeof parsed?.error === "string" ? parsed.error : "") ||
                (rawText ? rawText.slice(0, 220) : `HTTP ${resp.status}`);

            if (resp.status === 429) {
                const retryAfter = resp.headers?.get?.("Retry-After") || "beberapa";
                throw createOpusClipError(
                    `Batas rate OpusClip API tercapai (30 req/menit). Coba lagi dalam ${retryAfter} detik.`,
                    429,
                    "RATE_LIMITED",
                    parsed
                );
            }

            const mappedStatus =
                resp.status === 401 || resp.status === 403
                    ? 502
                    : resp.status >= 400 && resp.status < 500
                        ? resp.status
                        : 502;

            throw createOpusClipError(
                `OpusClip API menolak permintaan (${resp.status}): ${upstreamMsg}`,
                mappedStatus,
                "UPSTREAM_HTTP_ERROR",
                parsed
            );
        }

        return parsed ?? {};
    }

    return {
        webOrigin,
        get: path => request("GET", path),
        post: (path, body = {}) => request("POST", path, body),
        delete: path => request("DELETE", path)
    };
}

function unwrapData(raw) {
    if (raw && typeof raw === "object" && "data" in raw && raw.data !== undefined) {
        return raw.data;
    }
    return raw;
}

function unwrapList(raw) {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.list)) return raw.list;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.data?.list)) return raw.data.list;
    if (Array.isArray(raw?.data?.data)) return raw.data.data;
    return [];
}

/* =========================================================
   HIGH-LEVEL OPUSCLIP OPERATIONS (FITUR 1 s/d 5)
========================================================= */

export async function submitClipProject(client, input) {
    const payload = buildSubmitProjectPayload(input);
    const raw = await client.post("/clip-projects", payload);
    const data = unwrapData(raw) || {};
    return {
        payload,
        project: projectClipProject(data, client.webOrigin)
    };
}

export async function listClipProjects(client, { page = 0, pageSize = 20 } = {}) {
    const safePage = Math.max(0, Math.min(1000, Math.trunc(Number(page) || 0)));
    const safeSize = Math.max(1, Math.min(100, Math.trunc(Number(pageSize) || 20)));
    const raw = await client.get(`/clip-projects?page=${safePage}&pageSize=${safeSize}`);
    return unwrapList(raw).map(row => projectClipProject(row, client.webOrigin));
}

export async function shareClipProject(client, { projectId, visibility = "PUBLIC" } = {}) {
    const cleanProject = strOrUndef(projectId);
    if (!cleanProject) throw createOpusClipError("projectId wajib diisi.", 400);
    const upperVis = String(visibility || "PUBLIC").trim().toUpperCase();
    if (!VALID_VISIBILITIES.has(upperVis)) {
        throw createOpusClipError("visibility harus 'PUBLIC' atau 'DEFAULT'.", 400);
    }
    const raw = await client.post(`/clip-projects/${encodeURIComponent(cleanProject)}/update-visibility`, {
        visibility: upperVis
    });
    const data = unwrapData(raw) || {};
    return {
        project_id: cleanProject,
        visibility: strOrUndef(data.visibility) || upperVis,
        share_url: `${client.webOrigin.replace(/\/+$/, "")}/clip/${cleanProject}`
    };
}

export async function getProjectTranscript(client, { projectId } = {}) {
    const cleanProject = strOrUndef(projectId);
    if (!cleanProject) throw createOpusClipError("projectId wajib diisi.", 400);
    const raw = await client.get(
        `/transcripts?q=findByProjectId&projectId=${encodeURIComponent(cleanProject)}`
    );
    const rows = unwrapList(raw);
    const first = rows[0] || unwrapData(raw) || {};
    const paragraphs = Array.isArray(first?.paragraphs)
        ? first.paragraphs
        : Array.isArray(first?.data)
            ? first.data
            : Array.isArray(rows) && rows[0]?.words
                ? rows
                : [];
    return projectTranscript(cleanProject, paragraphs);
}

export async function listProjectClips(client, { projectId } = {}) {
    const cleanProject = strOrUndef(projectId);
    if (!cleanProject) throw createOpusClipError("projectId wajib diisi.", 400);
    const raw = await client.get(
        `/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(cleanProject)}`
    );
    return unwrapList(raw).map(projectClip);
}

export async function getClipDetail(client, { projectId, clipId } = {}) {
    const fullId = buildClipFullId(projectId, clipId);
    const raw = await client.get(`/exportable-clips/${encodeURIComponent(fullId)}`);
    const body = unwrapData(raw);
    const clip = Array.isArray(body) ? body[0] : body;
    if (!clip || typeof clip !== "object") {
        throw createOpusClipError(`Klip '${fullId}' tidak ditemukan.`, 404);
    }
    return projectClipDetail(clip);
}

export async function exportClipArtifact(client, { projectId, clipId, target = "hd" } = {}) {
    const fullId = buildClipFullId(projectId, clipId);
    const raw = await client.get(`/exportable-clips/${encodeURIComponent(fullId)}`);
    const body = unwrapData(raw);
    const clip = Array.isArray(body) ? body[0] : body;
    if (!clip || typeof clip !== "object") {
        throw createOpusClipError(`Klip '${fullId}' tidak ditemukan.`, 404);
    }
    return projectClipExport(clip, { target });
}

export async function listBrandTemplates(client) {
    const raw = await client.get("/brand-templates?q=mine");
    return unwrapList(raw).map(projectBrandTemplate);
}

export async function listCollections(client) {
    const raw = await client.get("/collections?q=mine");
    return unwrapList(raw).map(projectCollection);
}

export async function createCollection(client, { name } = {}) {
    const cleanName = strOrUndef(name);
    if (!cleanName) throw createOpusClipError("Nama koleksi wajib diisi.", 400);
    const raw = await client.post("/collections", { collectionName: cleanName });
    return projectCollection(unwrapData(raw) || {});
}

export async function deleteCollection(client, { collectionId } = {}) {
    const cleanId = strOrUndef(collectionId);
    if (!cleanId) throw createOpusClipError("collectionId wajib diisi.", 400);
    await client.delete(`/collections/${encodeURIComponent(cleanId)}`);
    return { collection_id: cleanId, deleted: true };
}

export async function exportCollection(client, { collectionId } = {}) {
    const cleanId = strOrUndef(collectionId);
    if (!cleanId) throw createOpusClipError("collectionId wajib diisi.", 400);
    const raw = await client.post(`/collections/${encodeURIComponent(cleanId)}/export`, {});
    const data = unwrapData(raw) || {};
    const contentList = Array.isArray(data.contentList) ? data.contentList : [];
    return {
        collection_id: cleanId,
        clips: contentList.map(item => {
            const [projectId = "", ...rest] = String(item?.contentId || "").split(".");
            return {
                project_id: projectId,
                clip_id: rest.join("."),
                export_url: strOrUndef(item?.uriForExport)
            };
        })
    };
}

export async function addClipToCollection(client, { collectionId, projectId, clipId } = {}) {
    const cleanCollection = strOrUndef(collectionId);
    if (!cleanCollection) throw createOpusClipError("collectionId wajib diisi.", 400);
    const contentId = buildClipFullId(projectId, clipId);
    await client.post("/collection-contents", {
        collectionId: cleanCollection,
        contentId
    });
    return {
        collection_id: cleanCollection,
        project_id: String(projectId).trim(),
        clip_id: clipSuffix(clipId, projectId)
    };
}

export async function removeClipFromCollection(client, { collectionId, projectId, clipId } = {}) {
    const cleanCollection = strOrUndef(collectionId);
    if (!cleanCollection) throw createOpusClipError("collectionId wajib diisi.", 400);
    const contentId = buildClipFullId(projectId, clipId);
    await client.post("/collection-contents/delete-collection-contents", {
        collectionId: cleanCollection,
        contentIds: [contentId]
    });
    return {
        collection_id: cleanCollection,
        removed: contentId
    };
}

export async function createUploadLink(client, { fileName, usecase = "LocalUpload", size } = {}) {
    const cleanFileName = strOrUndef(fileName) || "video.mp4";
    const dotIdx = cleanFileName.lastIndexOf(".");
    const extension = dotIdx >= 0 ? cleanFileName.slice(dotIdx + 1).toLowerCase() : "mp4";
    const allowedUsecase = usecase === "FreeToolMedia" ? "FreeToolMedia" : "LocalUpload";

    const payload = {
        type: "Upload",
        domain: "Google",
        usecase: allowedUsecase,
        extension,
        fileName: cleanFileName
    };
    if (typeof size === "number" && Number.isFinite(size) && size > 0) {
        payload.size = Math.round(size);
    }

    const raw = await client.post("/upload-links", payload);
    return projectUploadLink(raw);
}

export async function performResumableGcsUpload({
    uploadUrl,
    bytes,
    contentType = "application/octet-stream",
    fetchImpl = globalThis.fetch
} = {}) {
    const cleanUrl = strOrUndef(uploadUrl);
    if (!cleanUrl) {
        throw createOpusClipError("uploadUrl kosong dari OpusClip /upload-links.", 502);
    }
    const bodyBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (bodyBytes.byteLength === 0) {
        throw createOpusClipError("File upload tidak boleh kosong.", 400);
    }

    const initResp = await fetchImpl(cleanUrl, {
        method: "POST",
        headers: {
            "x-goog-resumable": "start",
            "Content-Length": "0",
            "Content-Type": contentType
        }
    });
    if (!initResp.ok) {
        throw createOpusClipError(
            `Gagal memulai sesi upload GCS OpusClip (HTTP ${initResp.status}).`,
            502
        );
    }

    const sessionUrl = initResp.headers?.get?.("Location") || initResp.headers?.get?.("location");
    if (!sessionUrl) {
        throw createOpusClipError("Header Location GCS resumable tidak ditemukan.", 502);
    }

    const putResp = await fetchImpl(sessionUrl, {
        method: "PUT",
        headers: {
            "Content-Type": contentType
        },
        body: bodyBytes
    });
    if (!putResp.ok) {
        throw createOpusClipError(
            `Gagal mengunggah byte media ke GCS OpusClip (HTTP ${putResp.status}).`,
            502
        );
    }

    return { uploadedBytes: bodyBytes.byteLength };
}

/* =========================================================
   FITUR 3 — AI YOUTUBE THUMBNAIL GENERATOR (`/generative-jobs`)
========================================================= */

export async function submitThumbnailJob(client, {
    sourceUri,
    referenceImageUri,
    maskImageUri,
    prompt
} = {}) {
    const cleanSource = strOrUndef(sourceUri);
    if (!cleanSource) {
        throw createOpusClipError("URL video sumber (sourceUri) wajib diisi untuk generate thumbnail.", 400);
    }

    const payload = {
        jobType: "thumbnail",
        sourceUri: cleanSource
    };
    const refUri = strOrUndef(referenceImageUri);
    const maskUri = strOrUndef(maskImageUri);
    const cleanPrompt = strOrUndef(prompt);

    if (refUri) payload.referenceImageUri = refUri;
    if (maskUri) payload.maskImageUri = maskUri;
    if (cleanPrompt) payload.prompt = cleanPrompt;

    const raw = await client.post("/generative-jobs", payload);
    const data = unwrapData(raw) || {};
    const jobId = strOrUndef(data.jobId) || strOrUndef(data.id);
    if (!jobId) {
        throw createOpusClipError("OpusClip tidak mengembalikan jobId thumbnail.", 502);
    }
    return projectThumbnailJob(jobId, data);
}

export async function getThumbnailJob(client, { jobId } = {}) {
    const cleanJobId = strOrUndef(jobId);
    if (!cleanJobId) throw createOpusClipError("jobId thumbnail wajib diisi.", 400);
    const raw = await client.get(`/generative-jobs/${encodeURIComponent(cleanJobId)}`);
    return projectThumbnailJob(cleanJobId, raw);
}

/* =========================================================
   FITUR 4 — SERVER-SIDE CLIP EDITOR & PROFANITY CENSOR
========================================================= */

export async function duplicateClip(client, { projectId, clipId } = {}) {
    const fullId = buildClipFullId(projectId, clipId);
    const raw = await client.post(`/exportable-clips/${encodeURIComponent(fullId)}/duplicate`, {});
    const data = unwrapData(raw) || {};
    const newFullId = strOrUndef(data.id) || strOrUndef(data.clipId) || "";
    const [, ...rest] = newFullId.split(".");
    return {
        project_id: String(projectId).trim(),
        source_clip_id: clipSuffix(clipId, projectId),
        duplicated_clip_id: rest.length > 0 ? rest.join(".") : newFullId,
        raw: data
    };
}

export async function getClipEditingScript(client, { projectId, clipId } = {}) {
    const fullId = buildClipFullId(projectId, clipId);
    const raw = await client.get(
        `/exportable-clips/${encodeURIComponent(fullId)}?include=editingScript`
    );
    const body = unwrapData(raw);
    const clip = Array.isArray(body) ? body[0] : body;
    if (!clip || typeof clip !== "object") {
        throw createOpusClipError(`EditingScript untuk klip '${fullId}' tidak ditemukan.`, 404);
    }
    return {
        project_id: String(projectId).trim(),
        clip_id: clipSuffix(clipId, projectId),
        title: clip.title ?? "",
        editing_script: clip.editingScript ?? clip
    };
}

export async function applyClipEditingScript(client, { projectId, clipId, editingScript } = {}) {
    const fullId = buildClipFullId(projectId, clipId);
    let parsedScript = editingScript;
    if (typeof editingScript === "string") {
        try {
            parsedScript = JSON.parse(editingScript);
        } catch {
            throw createOpusClipError("EditingScript harus berupa JSON yang valid.", 400);
        }
    }
    if (!parsedScript || typeof parsedScript !== "object") {
        throw createOpusClipError("Objek editingScript wajib diisi.", 400);
    }
    const raw = await client.post(`/exportable-clips/${encodeURIComponent(fullId)}/re-render`, {
        editingScript: parsedScript
    });
    const data = unwrapData(raw) || {};
    return {
        project_id: String(projectId).trim(),
        clip_id: clipSuffix(clipId, projectId),
        job_id: strOrUndef(data.jobId) || fullId,
        render_pending: true,
        message: strOrUndef(data.message) || "Re-render EditingScript sedang diproses."
    };
}

export async function submitCensorJob(client, { projectId, clipId, beepSound = true } = {}) {
    const cleanProject = strOrUndef(projectId);
    const suffix = clipSuffix(clipId, cleanProject);
    if (!cleanProject || !suffix) {
        throw createOpusClipError("projectId dan clipId wajib diisi untuk sensor klip.", 400);
    }
    const raw = await client.post("/censor-jobs", {
        projectId: cleanProject,
        clipId: suffix,
        options: {
            beepSound: Boolean(beepSound)
        }
    });
    const data = unwrapData(raw) || {};
    return {
        project_id: cleanProject,
        clip_id: suffix,
        job_id: strOrUndef(data.jobId) || strOrUndef(data.id) || `${cleanProject}.${suffix}`,
        status: strOrUndef(data.status) || "QUEUED",
        beep_sound: Boolean(beepSound)
    };
}

export async function getCensorJob(client, { jobId } = {}) {
    const cleanJobId = strOrUndef(jobId);
    if (!cleanJobId) throw createOpusClipError("jobId sensor wajib diisi.", 400);
    const raw = await client.get(`/censor-jobs/${encodeURIComponent(cleanJobId)}`);
    const data = unwrapData(raw) || {};
    return {
        job_id: cleanJobId,
        status: String(data.status || "PROCESSING").toUpperCase(),
        project_id: strOrUndef(data.projectId),
        clip_id: strOrUndef(data.clipId),
        error_message: strOrUndef(data.errorMessage)
    };
}

/* =========================================================
   FITUR 5 — SOCIAL POSTING, SCHEDULING & ORG API USAGE
========================================================= */

export async function listSocialAccounts(client) {
    const raw = await client.get("/social-accounts?q=mine");
    return unwrapList(raw).map(projectSocialAccount);
}

export async function submitSocialCopyJob(client, { projectId, clipId, platform } = {}) {
    const cleanProject = strOrUndef(projectId);
    const suffix = clipSuffix(clipId, cleanProject);
    const cleanPlatform = strOrUndef(platform);
    if (!cleanProject || !suffix || !cleanPlatform) {
        throw createOpusClipError("projectId, clipId, dan platform wajib diisi.", 400);
    }
    const raw = await client.post("/social-copy-jobs", {
        projectId: cleanProject,
        clipId: suffix,
        platform: cleanPlatform
    });
    return projectSocialCopyJob(raw);
}

export async function getSocialCopyJob(client, { jobId } = {}) {
    const cleanJobId = strOrUndef(jobId);
    if (!cleanJobId) throw createOpusClipError("jobId social copy wajib diisi.", 400);
    const raw = await client.get(`/social-copy-jobs/${encodeURIComponent(cleanJobId)}`);
    return projectSocialCopyJob(raw);
}

export async function publishSocialPost(client, {
    projectId,
    clipId,
    platform,
    postAccountId,
    subAccountId,
    title,
    description,
    hashtags,
    privacy
} = {}) {
    const cleanProject = strOrUndef(projectId);
    const suffix = clipSuffix(clipId, cleanProject);
    const cleanPlatform = strOrUndef(platform);
    const cleanAccount = strOrUndef(postAccountId);
    if (!cleanProject || !suffix || !cleanPlatform || !cleanAccount) {
        throw createOpusClipError("projectId, clipId, platform, dan postAccountId wajib diisi.", 400);
    }

    const contents = {};
    if (strOrUndef(title)) contents.title = strOrUndef(title);
    if (strOrUndef(description)) contents.description = strOrUndef(description);
    const tags = normalizeHashtags(hashtags);
    if (tags.length > 0) contents.hashtags = tags;

    const payload = {
        projectId: cleanProject,
        clipId: suffix,
        platform: cleanPlatform,
        postAccountId: cleanAccount,
        contents
    };
    if (strOrUndef(subAccountId)) payload.subAccountId = strOrUndef(subAccountId);
    if (strOrUndef(privacy)) payload.privacy = strOrUndef(privacy);

    const raw = await client.post("/post-tasks", payload);
    const data = unwrapData(raw) || {};
    return {
        post_task_id: strOrUndef(data.postId) || strOrUndef(data.id) || "",
        status: strOrUndef(data.status) || "SUBMITTED",
        has_conflict: typeof data.hasConflict === "boolean" ? data.hasConflict : undefined
    };
}

export async function scheduleSocialPost(client, {
    projectId,
    clipId,
    platform,
    postAccountId,
    subAccountId,
    publishAt,
    title,
    description,
    hashtags,
    privacy
} = {}) {
    const cleanProject = strOrUndef(projectId);
    const suffix = clipSuffix(clipId, cleanProject);
    const cleanPlatform = strOrUndef(platform);
    const cleanAccount = strOrUndef(postAccountId);
    const cleanPublishAt = strOrUndef(publishAt);
    if (!cleanProject || !suffix || !cleanPlatform || !cleanAccount || !cleanPublishAt) {
        throw createOpusClipError(
            "projectId, clipId, platform, postAccountId, dan publishAt (ISO UTC) wajib diisi.",
            400
        );
    }
    const parsedMs = Date.parse(cleanPublishAt);
    if (!Number.isFinite(parsedMs)) {
        throw createOpusClipError("publishAt harus berupa waktu ISO-8601 yang valid.", 400);
    }

    const contents = {};
    if (strOrUndef(title)) contents.title = strOrUndef(title);
    if (strOrUndef(description)) contents.description = strOrUndef(description);
    const tags = normalizeHashtags(hashtags);
    if (tags.length > 0) contents.hashtags = tags;

    const payload = {
        projectId: cleanProject,
        clipId: suffix,
        platform: cleanPlatform,
        postAccountId: cleanAccount,
        publishAt: new Date(parsedMs).toISOString(),
        contents
    };
    if (strOrUndef(subAccountId)) payload.subAccountId = strOrUndef(subAccountId);
    if (strOrUndef(privacy)) payload.privacy = strOrUndef(privacy);

    const raw = await client.post("/publish-schedules", payload);
    const data = unwrapData(raw) || {};
    return {
        schedule_id: strOrUndef(data.scheduleId) || strOrUndef(data.id) || "",
        has_conflict: typeof data.hasConflict === "boolean" ? data.hasConflict : undefined,
        scheduled_at: strOrUndef(data.publishAt) || payload.publishAt
    };
}

export async function cancelScheduledPost(client, { scheduleId } = {}) {
    const cleanScheduleId = strOrUndef(scheduleId);
    if (!cleanScheduleId) throw createOpusClipError("scheduleId wajib diisi.", 400);
    await client.delete(`/publish-schedules/${encodeURIComponent(cleanScheduleId)}`);
    return { schedule_id: cleanScheduleId, cancelled: true };
}

export async function listScheduledPosts(client, { projectId, startAt, endAt, page = 0, pageSize = 30 } = {}) {
    const cleanProject = strOrUndef(projectId);
    if (cleanProject) {
        const raw = await client.get(
            `/post-tasks?q=findByProjectId&projectId=${encodeURIComponent(cleanProject)}`
        );
        return unwrapList(raw).map(projectScheduledPost);
    }
    const now = Date.now();
    const startIso = strOrUndef(startAt) || new Date(now - 7 * 86_400_000).toISOString();
    const endIso = strOrUndef(endAt) || new Date(now + 30 * 86_400_000).toISOString();
    const safePage = Math.max(0, Math.trunc(Number(page) || 0));
    const safeSize = Math.max(1, Math.min(100, Math.trunc(Number(pageSize) || 30)));
    const qs = new URLSearchParams({
        q: "findByPeriodPage",
        startAt: startIso,
        endAt: endIso,
        page: String(safePage),
        pageSize: String(safeSize)
    });
    const raw = await client.get(`/post-tasks?${qs.toString()}`);
    return unwrapList(raw).map(projectScheduledPost);
}

export async function getOrgApiUsage(client) {
    const raw = await client.get("/api-usage?q=mine");
    return unwrapData(raw) || {};
}
