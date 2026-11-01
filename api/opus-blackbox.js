/* =========================================================
   GEN-Z.AI — BLACK BOX MODUL 02: OPUS STATUS & JOB RECOVERY API
   ---------------------------------------------------------
   File:
     api/opus-blackbox.js

   Endpoint khusus Owner & Admin (`/api/opus-blackbox`):
   - `action=status`      : Cek kesehatan slot OAuth Vault + MCP `whoami`
                            + daftar job Opus yang menggantung/gagal terbaru
   - `action=list_jobs`   : Panggil `list_jobs` pada `projectId` Opus Labs MCP
   - `action=resolve_job` : Panggil `get_status` + `resolve_job` untuk memulihkan
                            hasil job `submission_unknown`/menggantung tanpa
                            submit ulang & tanpa memotong kredit dua kali.

   KEAMANAN:
   - Wajib JWT Supabase dengan role `owner` atau `admin`.
   - TIDAK PERNAH menampilkan ciphertext/token mentah.
   - TIDAK PERNAH menghapus baris `opus_oauth_tokens`.
========================================================= */

import {
    inspectOpusMcpAccountStatus,
    listOpusProjectJobs,
    parseOpusTaskId,
    resolveOpusJobDirectly
} from "../provider/opus/client.js";
import {
    authenticateSupabaseUser,
    loadOpusCredentialPayload,
    resolveRuntimeEnv
} from "../lib/opus/load-opus-credential.js";

function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.end(JSON.stringify(payload));
}

function maskSeedHash(seedHash) {
    const clean = String(seedHash || "").trim();
    if (!clean) return "-";
    if (clean.length <= 12) return clean;
    return `${clean.slice(0, 10)}…${clean.slice(-4)}`;
}

async function fetchOpusVaultMetadata(supabaseUrl, serviceKey, fetchImpl = globalThis.fetch) {
    try {
        const qs = new URLSearchParams({
            select: "seed_hash,expires_at,updated_at",
            order: "updated_at.desc",
            limit: "10"
        });
        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/opus_oauth_tokens?${qs.toString()}`, {
            method: "GET",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        });
        if (!resp.ok) return [];
        const rows = await resp.json().catch(() => []);
        if (!Array.isArray(rows)) return [];
        const nowMs = Date.now();
        return rows.map((row, index) => {
            const expMs = row?.expires_at ? Date.parse(row.expires_at) : NaN;
            return {
                index: index + 1,
                seedId: maskSeedHash(row?.seed_hash),
                expiresAt: row?.expires_at || null,
                updatedAt: row?.updated_at || null,
                isAccessFresh: Number.isFinite(expMs) ? expMs > nowMs : null
            };
        });
    } catch {
        return [];
    }
}

async function fetchRecoverableOpusHistory(supabaseUrl, serviceKey, fetchImpl = globalThis.fetch) {
    try {
        const qs = new URLSearchParams({
            select: "id,user_email,model_id,model_name,status,task_id,result_url,error_message,credit_cost,credit_refunded,created_at",
            provider_id: "eq.opus",
            status: "in.(processing,queued,failed)",
            order: "created_at.desc",
            limit: "15"
        });
        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/generation_history?${qs.toString()}`, {
            method: "GET",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        });
        if (!resp.ok) return [];
        const rows = await resp.json().catch(() => []);
        if (!Array.isArray(rows)) return [];
        return rows
            .filter(r => r && r.task_id && !String(r.task_id).startsWith("failed-init:"))
            .map(r => {
                const parsed = parseOpusTaskId(r.task_id);
                return {
                    id: r.id,
                    userEmail: r.user_email || "-",
                    modelId: r.model_id,
                    modelName: r.model_name || r.model_id,
                    status: r.status,
                    taskId: r.task_id,
                    projectId: parsed.projectId || null,
                    jobId: parsed.jobId || null,
                    keySlot: parsed.keySlot ?? 0,
                    errorMessage: r.error_message || null,
                    creditCost: r.credit_cost ?? 0,
                    creditRefunded: Boolean(r.credit_refunded),
                    createdAt: r.created_at
                };
            });
    } catch {
        return [];
    }
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
    const auth = await authenticateSupabaseUser(req, env, { requireAdminOrOwner: true });
    if (!auth.ok) {
        return sendJson(res, auth.status, {
            success: false,
            error: auth.error
        });
    }

    const url = new URL(req.url || "/api/opus-blackbox", "https://genzai.local");
    const action = String(
        req.body?.action ||
        url.searchParams.get("action") ||
        "status"
    ).trim().toLowerCase();

    const opusApiKey = await loadOpusCredentialPayload(env);

    const mcpUrl = String(env.OPUS_MCP_URL || "").trim() || undefined;

    if (action === "status") {
        const [vaultEntries, recentRecoverable, mcpAccount] = await Promise.all([
            fetchOpusVaultMetadata(auth.supabaseUrl, auth.serviceKey),
            fetchRecoverableOpusHistory(auth.supabaseUrl, auth.serviceKey),
            opusApiKey
                ? inspectOpusMcpAccountStatus(opusApiKey, { env, mcpUrl })
                : Promise.resolve({
                      configured: false,
                      endpoint: "https://labs.opus.pro/opus-video-tools/mcp",
                      activeSlot: 0,
                      totalSlots: 0,
                      slots: []
                  })
        ]);

        return sendJson(res, 200, {
            success: true,
            action: "status",
            checkedAt: new Date().toISOString(),
            operator: {
                email: auth.user.email,
                role: auth.user.role
            },
            mcp: mcpAccount,
            vault: {
                count: vaultEntries.length,
                entries: vaultEntries
            },
            recoverableHistory: recentRecoverable
        });
    }

    if (!opusApiKey) {
        return sendJson(res, 503, {
            success: false,
            error: "Kredensial Opus Labs belum dikonfigurasi pada server."
        });
    }

    if (action === "list_jobs") {
        const projectId = String(
            req.body?.project_id ||
            req.body?.projectId ||
            url.searchParams.get("project_id") ||
            ""
        ).trim();
        const rawSlot = req.body?.key_slot ?? url.searchParams.get("key_slot");
        const keySlot = rawSlot !== undefined && rawSlot !== null && rawSlot !== ""
            ? Math.max(0, Number.parseInt(String(rawSlot), 10) || 0)
            : 0;

        try {
            const listed = await listOpusProjectJobs(projectId, opusApiKey, { env, mcpUrl, keySlot });
            return sendJson(res, 200, {
                success: true,
                action: "list_jobs",
                ...listed
            });
        } catch (err) {
            return sendJson(res, err?.status || 502, {
                success: false,
                error: err?.message || "Gagal mengambil daftar job project Opus."
            });
        }
    }

    if (action === "resolve_job") {
        const taskId = String(req.body?.task_id || req.body?.taskId || "").trim();
        const projectId = String(req.body?.project_id || req.body?.projectId || "").trim();
        const jobId = String(req.body?.job_id || req.body?.jobId || "").trim();
        const historyId = String(req.body?.history_id || req.body?.historyId || "").trim();
        const rawSlot = req.body?.key_slot ?? req.body?.keySlot;
        const keySlot = rawSlot !== undefined && rawSlot !== null && rawSlot !== ""
            ? Math.max(0, Number.parseInt(String(rawSlot), 10) || 0)
            : undefined;

        try {
            const resolved = await resolveOpusJobDirectly(
                { taskId, projectId, jobId, keySlot },
                opusApiKey,
                { env, mcpUrl }
            );

            let historyUpdated = false;
            if (
                historyId &&
                resolved.recovered &&
                Array.isArray(resolved.outputUrls) &&
                resolved.outputUrls[0]
            ) {
                const patchResp = await fetch(
                    `${auth.supabaseUrl}/rest/v1/generation_history?id=eq.${encodeURIComponent(historyId)}`,
                    {
                        method: "PATCH",
                        headers: {
                            apikey: auth.serviceKey,
                            Authorization: `Bearer ${auth.serviceKey}`,
                            "Content-Type": "application/json",
                            Prefer: "return=representation"
                        },
                        body: JSON.stringify({
                            status: "success",
                            result_url: resolved.outputUrls[0],
                            error_message: null,
                            completed_at: new Date().toISOString()
                        })
                    }
                );
                if (patchResp.ok) {
                    const updatedRows = await patchResp.json().catch(() => []);
                    historyUpdated = Array.isArray(updatedRows) && updatedRows.length > 0;
                }
            }

            return sendJson(res, 200, {
                success: true,
                action: "resolve_job",
                historyUpdated,
                ...resolved
            });
        } catch (err) {
            return sendJson(res, err?.status || 502, {
                success: false,
                error: err?.message || "Gagal memulihkan job melalui resolve_job Opus."
            });
        }
    }

    return sendJson(res, 400, {
        success: false,
        error: `Action "${action}" tidak dikenali. Gunakan status, list_jobs, atau resolve_job.`
    });
}
