/* =========================================================
   GEN-Z.AI — OPUSCLIP STUDIO UNIFIED API (BAGIAN 2: 7 FITUR)
   ---------------------------------------------------------
   File:
     api/opusclip.js

   Menangani seluruh 7 fitur Bagian 2 di `/opusclip/`:
   1. AI Video Clipping (`submit_project`, `list_projects`, `share_project`,
      `get_transcript`, `list_clips`, `get_clip`, `export_clip`,
      `list_brand_templates`, `list_collections`, `create_collection`,
      `delete_collection`, `export_collection`, `add_collection_clip`,
      `remove_collection_clip`, `create_upload_link`, `upload_media_base64`)
   2. AI Video Dubbing & Caption Translation (`submit_project` dengan
      `dubbingLanguage` atau `targetLang`)
   3. AI YouTube Thumbnail Generator (`submit_thumbnail`, `get_thumbnail`)
   4. Server-Side Clip Editor & Profanity Censor (`duplicate_clip`,
      `get_editing_script`, `apply_editing_script`, `censor_clip`, `get_censor`)
   5. Multi-Platform Social Posting, Scheduling & Org API Usage
      [KHUSUS OWNER / ADMIN]: (`list_social_accounts`, `submit_social_copy`,
      `get_social_copy`, `publish_social_post`, `schedule_social_post`,
      `cancel_scheduled_post`, `list_scheduled_posts`, `get_api_usage`)
   6. Deep Video Understanding & Copy Video Style via `https://mcp.opus.pro/mcp`
      (`create_mcp_upload_link`, `submit_understanding`, `get_understanding`)
   7. Motion UI Video Templates via Remotion GitHub Actions
      (`submit_motion_ui`, `list_motion_ui_jobs`, `get_motion_ui_job`)

   KEAMANAN KREDIT:
   - Seluruh mutasi kredit wajib memanggil `charge_feature_credits` &
     `settle_feature_credits` menggunakan `SUPABASE_SERVICE_ROLE_KEY`
     dengan `p_user_id: auth.user.id` hasil verifikasi `/auth/v1/user`
     (tidak pernah dari body request).
========================================================= */

import crypto from "node:crypto";
import {
    authenticateSupabaseUser,
    resolveRuntimeEnv
} from "../lib/opus/load-opus-credential.js";
import {
    loadOpusClipMcpCredential,
    loadOpusClipRestConfig
} from "../lib/opus/opusclip-credentials.js";
import {
    COPYRIGHT_CONFIRMATION_NOTICE,
    addClipToCollection,
    applyClipEditingScript,
    buildSubmitProjectPayload,
    cancelScheduledPost,
    createCollection,
    createOpusClipApiClient,
    createUploadLink,
    deleteCollection,
    duplicateClip,
    exportClipArtifact,
    exportCollection,
    getCensorJob,
    getClipDetail,
    getClipEditingScript,
    getOrgApiUsage,
    getProjectTranscript,
    getSocialCopyJob,
    getThumbnailJob,
    listBrandTemplates,
    listClipProjects,
    listCollections,
    listProjectClips,
    listScheduledPosts,
    listSocialAccounts,
    performResumableGcsUpload,
    publishSocialPost,
    removeClipFromCollection,
    scheduleSocialPost,
    shareClipProject,
    submitCensorJob,
    submitClipProject,
    submitSocialCopyJob,
    submitThumbnailJob
} from "../provider/opusclip/client.js";
import {
    COPY_VIDEO_STYLE_PROMPT_PRESETS,
    createOpusClipMcpUploadLink,
    getOpusClipReferenceAnalysis,
    submitOpusClipReferenceAnalysis
} from "../provider/opusclip/mcp-understanding.js";
import {
    MOTION_UI_ASPECT_CONFIGS,
    MOTION_UI_SUPPORTED_DURATIONS,
    MOTION_UI_TEMPLATES,
    normalizeMotionUiJobInput
} from "../provider/opusclip/motion-ui-templates.js";

const ADMIN_ONLY_ACTIONS = new Set([
    "list_social_accounts",
    "submit_social_copy",
    "get_social_copy",
    "publish_social_post",
    "schedule_social_post",
    "cancel_scheduled_post",
    "list_scheduled_posts",
    "get_api_usage"
]);

const DEFAULT_OPUSCLIP_CREDITS = Object.freeze({
    opusclip_clipping: 2500,
    opusclip_dubbing: 3500,
    opusclip_thumbnail: 1000,
    opusclip_censor_edit: 500,
    opusclip_understanding: 1000,
    opusclip_motion_ui: 2500
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
    if (req?.body && typeof req.body === "object") return req.body;
    if (typeof req?.body === "string" && req.body.trim()) {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return {};
}

function ensureTransactionId(rawTx) {
    const clean = String(rawTx || "").trim();
    if (UUID_REGEX.test(clean)) return clean;
    return crypto.randomUUID();
}

async function fetchUserProfileRoleAndCredits(supabaseUrl, serviceKey, userId, fetchImpl) {
    try {
        const resp = await fetchImpl(
            `${supabaseUrl}/rest/v1/profiles?select=id,role,credits&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (!resp.ok) return { role: "user", credits: null };
        const rows = await resp.json().catch(() => []);
        const row = Array.isArray(rows) ? rows[0] : null;
        return {
            role: String(row?.role || "user").trim().toLowerCase() || "user",
            credits: row?.credits !== undefined ? Number(row.credits) : null
        };
    } catch {
        return { role: "user", credits: null };
    }
}

async function fetchOpusClipFeatureCosts(supabaseUrl, serviceKey, fetchImpl) {
    const costs = { ...DEFAULT_OPUSCLIP_CREDITS };
    try {
        const resp = await fetchImpl(
            `${supabaseUrl}/rest/v1/feature_credit_settings?select=feature_id,credit_cost`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (resp.ok) {
            const rows = await resp.json().catch(() => []);
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    if (row?.feature_id && Object.prototype.hasOwnProperty.call(costs, row.feature_id)) {
                        costs[row.feature_id] = Number(row.credit_cost ?? costs[row.feature_id]);
                    }
                }
            }
        }
    } catch {
        /* use defaults */
    }
    return costs;
}

async function chargeFeatureCreditsRpc({
    supabaseUrl,
    serviceKey,
    userId,
    featureId,
    transactionId,
    prompt,
    modelId,
    modelName,
    fetchImpl
}) {
    const resp = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/charge_feature_credits`, {
        method: "POST",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_user_id: userId,
            p_feature_id: featureId,
            p_transaction_id: transactionId,
            p_prompt: prompt || null,
            p_model_id: modelId || null,
            p_model_name: modelName || null
        })
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        const msg = String(data?.message || data?.error || "");
        if (msg.includes("INSUFFICIENT_CREDITS")) {
            const err = new Error("Saldo kredit tidak mencukupi untuk menjalankan fitur OpusClip ini.");
            err.status = 402;
            err.code = "INSUFFICIENT_CREDITS";
            throw err;
        }
        const err = new Error(`Gagal memproses pemotongan kredit fitur: ${msg || resp.status}`);
        err.status = 500;
        throw err;
    }

    return Array.isArray(data) ? data[0] : data;
}

async function settleFeatureCreditsRpc({
    supabaseUrl,
    serviceKey,
    userId,
    transactionId,
    outcome,
    errorMessage = null,
    resultUrl = null,
    fetchImpl
}) {
    if (!transactionId || !UUID_REGEX.test(String(transactionId))) return null;

    const resp = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/settle_feature_credits`, {
        method: "POST",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_user_id: userId,
            p_transaction_id: transactionId,
            p_outcome: outcome,
            p_error_message: errorMessage || null
        })
    });

    const data = await resp.json().catch(() => null);
    const settled = Array.isArray(data) ? data[0] : data;

    if (resultUrl && settled?.task_id) {
        await fetchImpl(
            `${supabaseUrl}/rest/v1/generation_history?user_id=eq.${encodeURIComponent(userId)}&task_id=eq.${encodeURIComponent(settled.task_id)}`,
            {
                method: "PATCH",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    result_url: resultUrl
                })
            }
        ).catch(() => {});
    }

    return settled;
}

function getGithubWorkflowConfig(env) {
    return {
        token: String(env.GITHUB_PAT || "").trim(),
        owner: String(env.GITHUB_OWNER || "sugionoofficial").trim(),
        repo: String(env.GITHUB_REPO || "GEN-Z.AI").trim(),
        ref: String(env.GITHUB_REF || "main").trim(),
        workflowFile: "motion-ui-render.yml"
    };
}

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return sendJson(res, 405, {
            success: false,
            error: "Method tidak diizinkan."
        });
    }

    const env = resolveRuntimeEnv(req);
    const fetchImpl = req?.fetchImpl || globalThis.fetch;

    const auth = await authenticateSupabaseUser(req, env, {
        requireAdminOrOwner: false,
        fetchImpl
    });
    if (!auth.ok) {
        return sendJson(res, auth.status, {
            success: false,
            error: auth.error
        });
    }

    const body = parseJsonBody(req);
    const url = new URL(req.url || "/api/opusclip", "https://genzai.local");
    const action = String(
        body.action || url.searchParams.get("action") || "studio_bootstrap"
    ).trim().toLowerCase();

    const profileInfo = await fetchUserProfileRoleAndCredits(
        auth.supabaseUrl,
        auth.serviceKey,
        auth.user.id,
        fetchImpl
    );
    const effectiveRole =
        profileInfo.role === "owner" || profileInfo.role === "admin"
            ? profileInfo.role
            : auth.user.role;
    const isAdminOrOwner = effectiveRole === "owner" || effectiveRole === "admin";

    if (ADMIN_ONLY_ACTIONS.has(action) && !isAdminOrOwner) {
        return sendJson(res, 403, {
            success: false,
            error: "Akses ditolak. Tab Social Posting & Kuota API Organisasi khusus Owner / Admin."
        });
    }

    /* =========================================================
       BOOTSTRAP DATA STUDIO (Semua User Login)
    ========================================================= */
    if (action === "studio_bootstrap") {
        const [costs, restCfg, mcpCfg] = await Promise.all([
            fetchOpusClipFeatureCosts(auth.supabaseUrl, auth.serviceKey, fetchImpl),
            loadOpusClipRestConfig(env, { fetchImpl }),
            loadOpusClipMcpCredential(env, { fetchImpl })
        ]);

        return sendJson(res, 200, {
            success: true,
            viewer: {
                id: auth.user.id,
                email: auth.user.email,
                role: effectiveRole,
                isAdminOrOwner,
                credits: profileInfo.credits
            },
            readiness: {
                restConfigured: restCfg.configured,
                mcpConfigured: mcpCfg.configured,
                githubActionsConfigured: Boolean(getGithubWorkflowConfig(env).token)
            },
            copyrightNotice: COPYRIGHT_CONFIRMATION_NOTICE,
            costs,
            understandingPresets: Object.keys(COPY_VIDEO_STYLE_PROMPT_PRESETS),
            motionUi: {
                templates: MOTION_UI_TEMPLATES,
                aspects: MOTION_UI_ASPECT_CONFIGS,
                durations: MOTION_UI_SUPPORTED_DURATIONS
            }
        });
    }

    /* =========================================================
       FITUR 7 — MOTION UI REMOTION TEMPLATES (GitHub Actions)
    ========================================================= */
    if (action === "submit_motion_ui") {
        if (req.method !== "POST") {
            return sendJson(res, 405, { success: false, error: "Gunakan POST." });
        }

        let normalized;
        try {
            normalized = normalizeMotionUiJobInput(body);
        } catch (err) {
            return sendJson(res, err?.status || 400, {
                success: false,
                error: err?.message || "Input Motion UI tidak valid."
            });
        }

        const gh = getGithubWorkflowConfig(env);
        if (!gh.token) {
            return sendJson(res, 503, {
                success: false,
                error: "Secret GITHUB_PAT belum dikonfigurasi pada server untuk menjalankan render Remotion."
            });
        }

        const transactionId = ensureTransactionId(body.transactionId || body.transaction_id);
        const jobKey = `mui_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

        let chargeResult;
        try {
            chargeResult = await chargeFeatureCreditsRpc({
                supabaseUrl: auth.supabaseUrl,
                serviceKey: auth.serviceKey,
                userId: auth.user.id,
                featureId: "opusclip_motion_ui",
                transactionId,
                prompt: `Motion UI (${normalized.templateName} · ${normalized.aspectRatio} · ${normalized.durationSec}s): ${normalized.props.headline}`,
                modelId: `opusclip-motion-${normalized.templateId}`,
                modelName: `Motion UI — ${normalized.templateName}`,
                fetchImpl
            });
        } catch (err) {
            return sendJson(res, err?.status || 500, {
                success: false,
                code: err?.code,
                error: err?.message
            });
        }

        try {
            const insertResp = await fetchImpl(`${auth.supabaseUrl}/rest/v1/motion_ui_jobs`, {
                method: "POST",
                headers: {
                    apikey: auth.serviceKey,
                    Authorization: `Bearer ${auth.serviceKey}`,
                    "Content-Type": "application/json",
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    job_key: jobKey,
                    user_id: auth.user.id,
                    transaction_id: transactionId,
                    history_id: chargeResult?.history_id || null,
                    template_id: normalized.templateId,
                    aspect_ratio: normalized.aspectRatio,
                    duration_sec: normalized.durationSec,
                    props: normalized.props,
                    status: "queued",
                    progress: 5
                })
            });

            if (!insertResp.ok) {
                const detail = await insertResp.text().catch(() => "");
                throw new Error(`Gagal mencatat job Motion UI (${insertResp.status}): ${detail.slice(0, 140)}`);
            }

            const dispatchResp = await fetchImpl(
                `https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/actions/workflows/${encodeURIComponent(gh.workflowFile)}/dispatches`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${gh.token}`,
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                        "User-Agent": "genz-ai-opusclip-studio",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        ref: gh.ref,
                        inputs: {
                            job_key: jobKey,
                            user_id: auth.user.id,
                            transaction_id: transactionId
                        }
                    })
                }
            );

            if (!dispatchResp.ok) {
                const ghTxt = await dispatchResp.text().catch(() => "");
                throw new Error(`Gagal memicu GitHub Actions Remotion (${dispatchResp.status}): ${ghTxt.slice(0, 160)}`);
            }

            return sendJson(res, 200, {
                success: true,
                job: {
                    job_key: jobKey,
                    template_id: normalized.templateId,
                    template_name: normalized.templateName,
                    aspect_ratio: normalized.aspectRatio,
                    duration_sec: normalized.durationSec,
                    status: "queued",
                    progress: 5
                },
                billing: chargeResult
            });
        } catch (err) {
            await settleFeatureCreditsRpc({
                supabaseUrl: auth.supabaseUrl,
                serviceKey: auth.serviceKey,
                userId: auth.user.id,
                transactionId,
                outcome: "refund",
                errorMessage: err?.message || "Gagal memulai render Motion UI.",
                fetchImpl
            });

            return sendJson(res, 502, {
                success: false,
                refunded: true,
                error: `${err?.message || "Gagal memulai render Motion UI."} (Kredit telah dikembalikan otomatis.)`
            });
        }
    }

    if (action === "list_motion_ui_jobs") {
        const resp = await fetchImpl(
            `${auth.supabaseUrl}/rest/v1/motion_ui_jobs?select=job_key,template_id,aspect_ratio,duration_sec,props,status,progress,result_url,error_message,created_at,completed_at&user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc&limit=20`,
            {
                method: "GET",
                headers: {
                    apikey: auth.serviceKey,
                    Authorization: `Bearer ${auth.serviceKey}`
                }
            }
        );
        const rows = resp.ok ? await resp.json().catch(() => []) : [];
        return sendJson(res, 200, {
            success: true,
            jobs: Array.isArray(rows) ? rows : []
        });
    }

    if (action === "get_motion_ui_job") {
        const jobKey = String(body.jobKey || body.job_key || url.searchParams.get("job_key") || "").trim();
        if (!jobKey) {
            return sendJson(res, 400, { success: false, error: "job_key wajib diisi." });
        }
        const resp = await fetchImpl(
            `${auth.supabaseUrl}/rest/v1/motion_ui_jobs?select=job_key,template_id,aspect_ratio,duration_sec,props,status,progress,result_url,error_message,created_at,completed_at&user_id=eq.${encodeURIComponent(auth.user.id)}&job_key=eq.${encodeURIComponent(jobKey)}&limit=1`,
            {
                method: "GET",
                headers: {
                    apikey: auth.serviceKey,
                    Authorization: `Bearer ${auth.serviceKey}`
                }
            }
        );
        const rows = resp.ok ? await resp.json().catch(() => []) : [];
        const job = Array.isArray(rows) ? rows[0] : null;
        if (!job) {
            return sendJson(res, 404, { success: false, error: "Job Motion UI tidak ditemukan." });
        }
        return sendJson(res, 200, { success: true, job });
    }

    /* =========================================================
       FITUR 6 — DEEP VIDEO UNDERSTANDING (`https://mcp.opus.pro/mcp`)
    ========================================================= */
    if (
        action === "create_mcp_upload_link" ||
        action === "submit_understanding" ||
        action === "get_understanding"
    ) {
        const mcpCfg = await loadOpusClipMcpCredential(env, { fetchImpl });
        if (!mcpCfg.configured) {
            return sendJson(res, 503, {
                success: false,
                code: "MISSING_MCP_OAUTH",
                error: "Sesi OAuth mcp.opus.pro belum dikonfigurasi oleh Owner/Admin di BLACK BOX Modul 03."
            });
        }

        const mcpOpts = {
            env,
            mcpUrl: mcpCfg.mcpUrl,
            fetchImpl
        };

        if (action === "create_mcp_upload_link") {
            try {
                const upload = await createOpusClipMcpUploadLink(
                    {
                        fileName: body.fileName || "reference.mp4",
                        mimeType: body.mimeType || "video/mp4"
                    },
                    mcpCfg.rawCredential,
                    mcpOpts
                );
                return sendJson(res, 200, { success: true, upload });
            } catch (err) {
                return sendJson(res, err?.status || 502, {
                    success: false,
                    error: err?.message || "Gagal membuat link upload referensi MCP."
                });
            }
        }

        if (action === "submit_understanding") {
            const mediaUrl = String(body.mediaUrl || "").trim();
            const uploadId = String(body.uploadId || "").trim();
            const durationSeconds = Number(body.durationSeconds || 60);

            if (!mediaUrl && !uploadId) {
                return sendJson(res, 400, {
                    success: false,
                    error: "Masukkan URL video langsung (HTTPS <= 15 MB) atau unggah file video terlebih dahulu."
                });
            }
            if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 300) {
                return sendJson(res, 400, {
                    success: false,
                    error: "Durasi video referensi wajib antara 1 hingga 300 detik (maks 5 menit)."
                });
            }

            const transactionId = ensureTransactionId(body.transactionId || body.transaction_id);
            let chargeResult;
            try {
                chargeResult = await chargeFeatureCreditsRpc({
                    supabaseUrl: auth.supabaseUrl,
                    serviceKey: auth.serviceKey,
                    userId: auth.user.id,
                    featureId: "opusclip_understanding",
                    transactionId,
                    prompt: `Deep Video Understanding (${body.preset || "copy_video_style"}): ${mediaUrl || uploadId}`,
                    fetchImpl
                });
            } catch (err) {
                return sendJson(res, err?.status || 500, {
                    success: false,
                    code: err?.code,
                    error: err?.message
                });
            }

            try {
                const submitted = await submitOpusClipReferenceAnalysis(
                    {
                        mediaUrl,
                        uploadId,
                        mediaType: body.mediaType || "video",
                        durationSeconds,
                        preset: body.preset || "copy_video_style",
                        customPrompt: body.customPrompt || "",
                        idempotencyKey: `genzai-${transactionId}`
                    },
                    mcpCfg.rawCredential,
                    mcpOpts
                );

                const immediateText =
                    submitted?.result?.text ||
                    (typeof submitted?.text === "string" && !submitted?.jobId ? submitted.text : "");

                if (immediateText) {
                    const settled = await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "complete",
                        fetchImpl
                    });
                    return sendJson(res, 200, {
                        success: true,
                        status: "CONCLUDED",
                        analysisText: immediateText,
                        analysis: submitted,
                        transactionId,
                        billing: settled || chargeResult
                    });
                }

                return sendJson(res, 200, {
                    success: true,
                    status: submitted?.status || "PROCESSING",
                    jobId: submitted?.jobId || submitted?.job_id || "",
                    analysis: submitted,
                    transactionId,
                    billing: chargeResult
                });
            } catch (err) {
                await settleFeatureCreditsRpc({
                    supabaseUrl: auth.supabaseUrl,
                    serviceKey: auth.serviceKey,
                    userId: auth.user.id,
                    transactionId,
                    outcome: "refund",
                    errorMessage: err?.message || "Gagal menjalankan analisis video MCP.",
                    fetchImpl
                });
                return sendJson(res, err?.status || 502, {
                    success: false,
                    refunded: true,
                    error: `${err?.message || "Gagal memulai analisis video."} (Kredit telah dikembalikan otomatis.)`
                });
            }
        }

        if (action === "get_understanding") {
            const jobId = String(body.jobId || url.searchParams.get("jobId") || "").trim();
            const transactionId = String(body.transactionId || url.searchParams.get("transactionId") || "").trim();
            try {
                const polled = await getOpusClipReferenceAnalysis(
                    { jobId },
                    mcpCfg.rawCredential,
                    mcpOpts
                );
                const statusUpper = String(polled?.status || "").toUpperCase();
                const analysisText = polled?.result?.text || polled?.text || "";

                if ((statusUpper === "CONCLUDED" || statusUpper === "COMPLETED" || analysisText) && transactionId) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "complete",
                        fetchImpl
                    });
                } else if (statusUpper === "FAILED" && transactionId) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "refund",
                        errorMessage: polled?.errorMessage || "Analisis video referensi gagal di upstream.",
                        fetchImpl
                    });
                }

                return sendJson(res, 200, {
                    success: true,
                    status: analysisText ? "CONCLUDED" : statusUpper || "PROCESSING",
                    analysisText,
                    retryAfterSeconds: polled?.retryAfterSeconds || 5,
                    analysis: polled
                });
            } catch (err) {
                return sendJson(res, err?.status || 502, {
                    success: false,
                    error: err?.message || "Gagal mengecek status analisis video."
                });
            }
        }
    }

    /* =========================================================
       FITUR 1 s/d 5 — CORE OPUSCLIP REST API (`api.opus.pro`)
    ========================================================= */
    const restCfg = await loadOpusClipRestConfig(env, { fetchImpl });
    if (!restCfg.configured) {
        return sendJson(res, 503, {
            success: false,
            code: "MISSING_API_KEY",
            error: "OPUSCLIP_API_KEY belum dikonfigurasi oleh Owner/Admin di BLACK BOX Modul 03."
        });
    }

    const client = createOpusClipApiClient({
        apiKey: restCfg.apiKey,
        orgId: restCfg.orgId,
        baseUrl: restCfg.baseUrl,
        fetchImpl
    });

    try {
        switch (action) {
            /* --- Upload Media Lokal (4-Step GCS Resumable) --- */
            case "create_upload_link": {
                const upload = await createUploadLink(client, {
                    fileName: body.fileName || "video.mp4",
                    usecase: body.usecase || "LocalUpload",
                    size: body.size ? Number(body.size) : undefined
                });
                return sendJson(res, 200, { success: true, upload });
            }

            case "upload_media_base64": {
                const b64 = String(body.base64Data || "").replace(/^data:[^;]+;base64,/, "").trim();
                if (!b64) {
                    return sendJson(res, 400, { success: false, error: "Data file base64 kosong." });
                }
                const bytes = new Uint8Array(Buffer.from(b64, "base64"));
                if (bytes.byteLength > 15 * 1024 * 1024) {
                    return sendJson(res, 413, {
                        success: false,
                        error: "Proxy upload server maksimal 15 MB. Untuk video lebih besar, unggah langsung dari browser memakai upload_url."
                    });
                }
                const upload = await createUploadLink(client, {
                    fileName: body.fileName || "media.png",
                    usecase: body.usecase || "FreeToolMedia",
                    size: bytes.byteLength
                });
                await performResumableGcsUpload({
                    uploadUrl: upload.upload_url,
                    bytes,
                    contentType: body.contentType || "application/octet-stream",
                    fetchImpl
                });
                return sendJson(res, 200, { success: true, upload });
            }

            /* --- Fitur 1 & 2: Submit Project Clipping / AI Dubbing / Translate Caption --- */
            case "submit_project": {
                /* Validasi kontrak wire terlebih dahulu sebelum potong kredit */
                buildSubmitProjectPayload(body);

                const isDubbing = Boolean(String(body.dubbingLanguage || "").trim());
                const featureId = isDubbing ? "opusclip_dubbing" : "opusclip_clipping";
                const transactionId = ensureTransactionId(body.transactionId || body.transaction_id);

                const chargeResult = await chargeFeatureCreditsRpc({
                    supabaseUrl: auth.supabaseUrl,
                    serviceKey: auth.serviceKey,
                    userId: auth.user.id,
                    featureId,
                    transactionId,
                    prompt: isDubbing
                        ? `OpusClip AI Dubbing (${body.dubbingLanguage}): ${body.title || body.videoUrl}`
                        : `OpusClip AI Clipping (${body.aspectRatio || "portrait"}): ${body.title || body.videoUrl}`,
                    fetchImpl
                });

                try {
                    const submitted = await submitClipProject(client, body);
                    const settled = await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "complete",
                        resultUrl: submitted.project?.share_url || null,
                        fetchImpl
                    });
                    return sendJson(res, 200, {
                        success: true,
                        featureId,
                        project: submitted.project,
                        billing: settled || chargeResult
                    });
                } catch (upstreamErr) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "refund",
                        errorMessage: upstreamErr?.message || "Submit project OpusClip gagal.",
                        fetchImpl
                    });
                    return sendJson(res, upstreamErr?.status || 502, {
                        success: false,
                        refunded: true,
                        error: `${upstreamErr?.message || "Gagal mengirim project ke OpusClip."} (Kredit telah dikembalikan otomatis.)`
                    });
                }
            }

            case "list_projects": {
                const projects = await listClipProjects(client, {
                    page: body.page ?? url.searchParams.get("page") ?? 0,
                    pageSize: body.pageSize ?? url.searchParams.get("pageSize") ?? 20
                });
                return sendJson(res, 200, { success: true, projects });
            }

            case "share_project": {
                const shared = await shareClipProject(client, {
                    projectId: body.projectId,
                    visibility: body.visibility || "PUBLIC"
                });
                return sendJson(res, 200, { success: true, share: shared });
            }

            case "get_transcript": {
                const transcript = await getProjectTranscript(client, {
                    projectId: body.projectId || url.searchParams.get("projectId")
                });
                return sendJson(res, 200, { success: true, transcript });
            }

            case "list_clips": {
                const clips = await listProjectClips(client, {
                    projectId: body.projectId || url.searchParams.get("projectId")
                });
                return sendJson(res, 200, { success: true, clips });
            }

            case "get_clip": {
                const clip = await getClipDetail(client, {
                    projectId: body.projectId || url.searchParams.get("projectId"),
                    clipId: body.clipId || url.searchParams.get("clipId")
                });
                return sendJson(res, 200, { success: true, clip });
            }

            case "export_clip": {
                const exported = await exportClipArtifact(client, {
                    projectId: body.projectId || url.searchParams.get("projectId"),
                    clipId: body.clipId || url.searchParams.get("clipId"),
                    target: body.target || url.searchParams.get("target") || "hd"
                });
                return sendJson(res, 200, { success: true, export: exported });
            }

            case "list_brand_templates": {
                const templates = await listBrandTemplates(client);
                return sendJson(res, 200, { success: true, templates });
            }

            case "list_collections": {
                const collections = await listCollections(client);
                return sendJson(res, 200, { success: true, collections });
            }

            case "create_collection": {
                const collection = await createCollection(client, { name: body.name });
                return sendJson(res, 200, { success: true, collection });
            }

            case "delete_collection": {
                const deleted = await deleteCollection(client, { collectionId: body.collectionId });
                return sendJson(res, 200, { success: true, ...deleted });
            }

            case "export_collection": {
                const exported = await exportCollection(client, { collectionId: body.collectionId });
                return sendJson(res, 200, { success: true, exported });
            }

            case "add_collection_clip": {
                const added = await addClipToCollection(client, {
                    collectionId: body.collectionId,
                    projectId: body.projectId,
                    clipId: body.clipId
                });
                return sendJson(res, 200, { success: true, added });
            }

            case "remove_collection_clip": {
                const removed = await removeClipFromCollection(client, {
                    collectionId: body.collectionId,
                    projectId: body.projectId,
                    clipId: body.clipId
                });
                return sendJson(res, 200, { success: true, removed });
            }

            /* --- Fitur 3: AI YouTube Thumbnail Generator --- */
            case "submit_thumbnail": {
                const sourceUri = String(body.sourceUri || "").trim();
                if (!sourceUri) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "URL video sumber (sourceUri) wajib diisi untuk generate thumbnail."
                    });
                }

                const transactionId = ensureTransactionId(body.transactionId || body.transaction_id);
                const chargeResult = await chargeFeatureCreditsRpc({
                    supabaseUrl: auth.supabaseUrl,
                    serviceKey: auth.serviceKey,
                    userId: auth.user.id,
                    featureId: "opusclip_thumbnail",
                    transactionId,
                    prompt: `OpusClip Thumbnail AI: ${body.prompt || sourceUri}`,
                    fetchImpl
                });

                try {
                    const job = await submitThumbnailJob(client, {
                        sourceUri,
                        referenceImageUri: body.referenceImageUri,
                        maskImageUri: body.maskImageUri,
                        prompt: body.prompt
                    });
                    return sendJson(res, 200, {
                        success: true,
                        job,
                        transactionId,
                        billing: chargeResult
                    });
                } catch (upstreamErr) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "refund",
                        errorMessage: upstreamErr?.message || "Gagal membuat job thumbnail AI.",
                        fetchImpl
                    });
                    return sendJson(res, upstreamErr?.status || 502, {
                        success: false,
                        refunded: true,
                        error: `${upstreamErr?.message || "Gagal memulai generate thumbnail."} (Kredit telah dikembalikan otomatis.)`
                    });
                }
            }

            case "get_thumbnail": {
                const jobId = body.jobId || url.searchParams.get("jobId");
                const transactionId = body.transactionId || url.searchParams.get("transactionId");
                const job = await getThumbnailJob(client, { jobId });

                if (job.status === "CONCLUDED" && transactionId) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "complete",
                        resultUrl: job.thumbnail_urls?.[0] || null,
                        fetchImpl
                    });
                } else if (job.status === "FAILED" && transactionId) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "refund",
                        errorMessage: job.error_message || "Generate thumbnail gagal di upstream.",
                        fetchImpl
                    });
                }

                return sendJson(res, 200, { success: true, job });
            }

            /* --- Fitur 4: Server-Side Clip Editor & Profanity Censor --- */
            case "duplicate_clip": {
                const duplicated = await duplicateClip(client, {
                    projectId: body.projectId,
                    clipId: body.clipId
                });
                return sendJson(res, 200, { success: true, duplicated });
            }

            case "get_editing_script": {
                const scriptData = await getClipEditingScript(client, {
                    projectId: body.projectId || url.searchParams.get("projectId"),
                    clipId: body.clipId || url.searchParams.get("clipId")
                });
                return sendJson(res, 200, { success: true, ...scriptData });
            }

            case "apply_editing_script": {
                if (!body.projectId || !body.clipId || !body.editingScript) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "projectId, clipId, dan editingScript wajib diisi."
                    });
                }
                const transactionId = ensureTransactionId(body.transactionId || body.transaction_id);
                const chargeResult = await chargeFeatureCreditsRpc({
                    supabaseUrl: auth.supabaseUrl,
                    serviceKey: auth.serviceKey,
                    userId: auth.user.id,
                    featureId: "opusclip_censor_edit",
                    transactionId,
                    prompt: `OpusClip Apply EditingScript (${body.projectId}.${body.clipId})`,
                    fetchImpl
                });

                try {
                    const applied = await applyClipEditingScript(client, {
                        projectId: body.projectId,
                        clipId: body.clipId,
                        editingScript: body.editingScript
                    });
                    const settled = await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "complete",
                        fetchImpl
                    });
                    return sendJson(res, 200, {
                        success: true,
                        render: applied,
                        billing: settled || chargeResult
                    });
                } catch (upstreamErr) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "refund",
                        errorMessage: upstreamErr?.message || "Gagal menerapkan EditingScript.",
                        fetchImpl
                    });
                    return sendJson(res, upstreamErr?.status || 502, {
                        success: false,
                        refunded: true,
                        error: `${upstreamErr?.message || "Gagal re-render klip."} (Kredit telah dikembalikan otomatis.)`
                    });
                }
            }

            case "censor_clip": {
                if (!body.projectId || !body.clipId) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "projectId dan clipId wajib diisi untuk sensor kata kasar."
                    });
                }
                const transactionId = ensureTransactionId(body.transactionId || body.transaction_id);
                const chargeResult = await chargeFeatureCreditsRpc({
                    supabaseUrl: auth.supabaseUrl,
                    serviceKey: auth.serviceKey,
                    userId: auth.user.id,
                    featureId: "opusclip_censor_edit",
                    transactionId,
                    prompt: `OpusClip Sensor Kata Kasar (${body.projectId}.${body.clipId}, beep=${Boolean(body.beepSound)})`,
                    fetchImpl
                });

                try {
                    const censor = await submitCensorJob(client, {
                        projectId: body.projectId,
                        clipId: body.clipId,
                        beepSound: Boolean(body.beepSound)
                    });
                    const settled = await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "complete",
                        fetchImpl
                    });
                    return sendJson(res, 200, {
                        success: true,
                        censor,
                        billing: settled || chargeResult
                    });
                } catch (upstreamErr) {
                    await settleFeatureCreditsRpc({
                        supabaseUrl: auth.supabaseUrl,
                        serviceKey: auth.serviceKey,
                        userId: auth.user.id,
                        transactionId,
                        outcome: "refund",
                        errorMessage: upstreamErr?.message || "Gagal mengirim job sensor klip.",
                        fetchImpl
                    });
                    return sendJson(res, upstreamErr?.status || 502, {
                        success: false,
                        refunded: true,
                        error: `${upstreamErr?.message || "Gagal memulai sensor klip."} (Kredit telah dikembalikan otomatis.)`
                    });
                }
            }

            case "get_censor": {
                const censor = await getCensorJob(client, {
                    jobId: body.jobId || url.searchParams.get("jobId")
                });
                return sendJson(res, 200, { success: true, censor });
            }

            /* --- Fitur 5: Social Posting, Scheduling & Org API Usage (Owner/Admin) --- */
            case "list_social_accounts": {
                const accounts = await listSocialAccounts(client);
                return sendJson(res, 200, { success: true, accounts });
            }

            case "submit_social_copy": {
                const copyJob = await submitSocialCopyJob(client, {
                    projectId: body.projectId,
                    clipId: body.clipId,
                    platform: body.platform
                });
                return sendJson(res, 200, { success: true, copyJob });
            }

            case "get_social_copy": {
                const copyJob = await getSocialCopyJob(client, {
                    jobId: body.jobId || url.searchParams.get("jobId")
                });
                return sendJson(res, 200, { success: true, copyJob });
            }

            case "publish_social_post": {
                const published = await publishSocialPost(client, body);
                return sendJson(res, 200, { success: true, published });
            }

            case "schedule_social_post": {
                const scheduled = await scheduleSocialPost(client, body);
                return sendJson(res, 200, { success: true, scheduled });
            }

            case "cancel_scheduled_post": {
                const cancelled = await cancelScheduledPost(client, {
                    scheduleId: body.scheduleId
                });
                return sendJson(res, 200, { success: true, ...cancelled });
            }

            case "list_scheduled_posts": {
                const posts = await listScheduledPosts(client, {
                    projectId: body.projectId || url.searchParams.get("projectId"),
                    startAt: body.startAt || url.searchParams.get("startAt"),
                    endAt: body.endAt || url.searchParams.get("endAt"),
                    page: body.page ?? url.searchParams.get("page") ?? 0,
                    pageSize: body.pageSize ?? url.searchParams.get("pageSize") ?? 30
                });
                return sendJson(res, 200, { success: true, posts });
            }

            case "get_api_usage": {
                const usage = await getOrgApiUsage(client);
                return sendJson(res, 200, { success: true, usage });
            }

            default:
                return sendJson(res, 400, {
                    success: false,
                    error: `Action '${action}' tidak dikenali pada /api/opusclip.`
                });
        }
    } catch (err) {
        return sendJson(res, err?.status || 502, {
            success: false,
            code: err?.code,
            error: err?.message || "Terjadi kesalahan saat memproses permintaan OpusClip."
        });
    }
}
