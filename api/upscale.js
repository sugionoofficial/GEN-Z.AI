/* =========================================================
   GEN-Z.AI
   UPSCALE API
   ---------------------------------------------------------
   File:
     api/upscale.js

   Endpoint:
     POST /api/upscale

   Body:
     { history_id: string }

   Header:
     Authorization: Bearer <supabase-access-token>

   Alur:
     1. Autentikasi user
     2. Validasi history: milik user, status=success, ada result_url
     3. Cek belum pernah diupscale
     4. Deduct 1 credit
     5. Insert row history baru (status=processing)
     6. Trigger GitHub Actions workflow_dispatch
     7. Return { upscale_history_id, task_id, remaining_credits }

   Kalau trigger GitHub gagal:
     - Refund credit
     - Mark history row failed
     - Return error
========================================================= */

const SUPABASE_URL =
    String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");

const SUPABASE_SERVICE_ROLE_KEY =
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const GITHUB_PAT =
    String(process.env.GITHUB_PAT || "").trim();

const GITHUB_OWNER =
    String(process.env.GITHUB_OWNER || "").trim();

const GITHUB_REPO =
    String(process.env.GITHUB_REPO || "").trim();

const GITHUB_WORKFLOW_FILE =
    String(process.env.GITHUB_WORKFLOW_FILE || "upscale.yml").trim();

const GITHUB_REF =
    String(process.env.GITHUB_REF || "main").trim();

const UPSCALE_CREDIT_COST = 1;
const UPSCALE_TARGET_LABEL = "1440p";


/* =========================================================
   RESPONSE HELPERS
========================================================= */

function json(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify(data));
}

function success(res, data = {}) {
    return json(res, 200, { success: true, ...data });
}

function failure(res, statusCode, message, extra = {}) {
    return json(res, statusCode, { success: false, error: message, ...extra });
}


/* =========================================================
   SUPABASE REQUEST
========================================================= */

async function supabaseRequest(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Supabase configuration is incomplete");
    }

    const response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    let data = null;

    if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!response.ok) {
        const error = new Error(
            (data && typeof data === "object" && (data.message || data.error || data.error_description)) ||
            `Supabase request failed with status ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}


/* =========================================================
   AUTH
========================================================= */

async function authenticateUser(req) {
    const authorization = String(
        req.headers?.authorization || req.headers?.Authorization || ""
    ).trim();

    if (!authorization) {
        throw Object.assign(new Error("Authorization header is required"), { status: 401 });
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        throw Object.assign(new Error("Invalid Authorization header"), { status: 401 });
    }

    const accessToken = match[1].trim();

    const user = await supabaseRequest("/auth/v1/user", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY
        }
    });

    if (!user || !user.id) {
        throw Object.assign(new Error("Invalid or expired session"), { status: 401 });
    }

    return user;
}


/* =========================================================
   READ BODY
========================================================= */

async function readBody(req) {
    if (req.body && typeof req.body === "object") {
        return req.body;
    }

    let body = "";
    for await (const chunk of req) body += chunk;

    if (!body.trim()) return {};

    try {
        return JSON.parse(body);
    } catch {
        throw Object.assign(new Error("Request body must be valid JSON"), { status: 400 });
    }
}


/* =========================================================
   CREDIT — DEDUCT & REFUND
========================================================= */

async function deductCredit(userId, amount) {
    const data = await supabaseRequest("/rest/v1/rpc/deduct_generate_credits", {
        method: "POST",
        body: JSON.stringify({ p_user_id: userId, p_amount: amount })
    });

    const num = Number(data);
    if (Number.isFinite(num)) return num;

    if (data && typeof data === "object") {
        for (const k of ["credits", "new_credits", "remaining_credits"]) {
            const n = Number(data[k]);
            if (Number.isFinite(n)) return n;
        }
    }

    return null;
}

async function refundCredit(userId, amount) {
    const data = await supabaseRequest("/rest/v1/rpc/refund_generate_credits", {
        method: "POST",
        body: JSON.stringify({ p_user_id: userId, p_amount: amount })
    });

    const num = Number(data);
    if (Number.isFinite(num)) return num;

    if (data && typeof data === "object") {
        for (const k of ["credits", "new_credits", "remaining_credits"]) {
            const n = Number(data[k]);
            if (Number.isFinite(n)) return n;
        }
    }

    return null;
}


/* =========================================================
   FETCH HISTORY ROW
========================================================= */

async function fetchHistoryRow(historyId) {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("id", `eq.${historyId}`);
    params.set("limit", "1");

    const rows = await supabaseRequest(
        `/rest/v1/generation_history?${params.toString()}`,
        { method: "GET" }
    );

    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0];
}


/* =========================================================
   CHECK ALREADY UPSCALED
========================================================= */

async function hasActiveOrSuccessfulUpscale(historyId) {
    const params = new URLSearchParams();
    params.set("select", "id,status");
    params.set("upscale_of_history_id", `eq.${historyId}`);
    params.set("status", "in.(pending,processing,success)");
    params.set("limit", "1");

    const rows = await supabaseRequest(
        `/rest/v1/generation_history?${params.toString()}`,
        { method: "GET" }
    );

    return Array.isArray(rows) && rows.length > 0;
}


/* =========================================================
   CREATE UPSCALE HISTORY ROW
========================================================= */

function generateTaskId() {
    const rand = Math.random().toString(36).slice(2, 10);
    return `upscale_${Date.now()}_${rand}`;
}

async function createUpscaleHistoryRow({
    user,
    parent,
    sourceUrl,
    taskId
}) {
    const payload = {
        user_id: user.id,
        user_email: user.email || null,
        provider_id: parent.provider_id || null,
        provider_name: parent.provider_name || null,
        model_id: parent.model_id || null,
        model_name: parent.model_name || null,
        prompt: parent.prompt || null,
        image_reference_url: parent.image_reference_url || null,
        video_reference_url: parent.video_reference_url || null,
        ratio: parent.ratio || null,
        duration: parent.duration || null,
        resolution: UPSCALE_TARGET_LABEL,
        status: "processing",
        task_id: taskId,
        result_url: null,
        error_message: null,
        credit_cost: UPSCALE_CREDIT_COST,
        upscale_of_history_id: parent.id,
        upscale_source_url: sourceUrl,
        upscale_target: UPSCALE_TARGET_LABEL
    };

    const rows = await supabaseRequest(
        "/rest/v1/generation_history?select=*",
        {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify([payload])
        }
    );

    if (!Array.isArray(rows) || !rows.length) {
        throw new Error("Failed to create upscale history row");
    }

    return rows[0];
}


/* =========================================================
   MARK FAILED + REFUND
========================================================= */

async function markFailedAndRefund({
    historyId,
    userId,
    errorMessage
}) {
    try {
        await supabaseRequest(
            `/rest/v1/generation_history?id=eq.${historyId}`,
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    status: "failed",
                    error_message: errorMessage
                })
            }
        );
    } catch (e) {
        console.error("[upscale] Failed to mark history row:", e);
    }

    try {
        await refundCredit(userId, UPSCALE_CREDIT_COST);
    } catch (e) {
        console.error("[upscale] Refund failed:", e);
    }
}


/* =========================================================
   TRIGGER GITHUB ACTIONS
========================================================= */

async function triggerGithubWorkflow({
    historyId,
    sourceUrl,
    userId
}) {
    if (!GITHUB_PAT || !GITHUB_OWNER || !GITHUB_REPO) {
        throw new Error("GitHub Actions configuration is incomplete");
    }

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITHUB_PAT}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "GENZ-AI-Upscale"
        },
        body: JSON.stringify({
            ref: GITHUB_REF,
            inputs: {
                history_id: String(historyId),
                source_url: String(sourceUrl),
                user_id: String(userId),
                credit_cost: String(UPSCALE_CREDIT_COST)
            }
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `GitHub Actions dispatch failed (${response.status}): ${text}`
        );
    }

    return true;
}


/* =========================================================
   HANDLER
========================================================= */

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return failure(res, 405, "Method not allowed");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return failure(res, 500, "Server configuration is incomplete");
    }

    /* ===== AUTH ===== */

    let user;
    try {
        user = await authenticateUser(req);
    } catch (err) {
        return failure(res, err.status || 401, err.message || "Unauthorized");
    }

    /* ===== BODY ===== */

    let body;
    try {
        body = await readBody(req);
    } catch (err) {
        return failure(res, err.status || 400, err.message || "Invalid request body");
    }

    const historyId = String(body?.history_id || "").trim();
    if (!historyId) {
        return failure(res, 400, "history_id is required");
    }

    /* ===== FETCH PARENT ===== */

    let parent;
    try {
        parent = await fetchHistoryRow(historyId);
    } catch (err) {
        console.error("[upscale] Failed to fetch history:", err);
        return failure(res, 500, "Failed to fetch history");
    }

    if (!parent) {
        return failure(res, 404, "History tidak ditemukan");
    }

    if (String(parent.user_id) !== String(user.id)) {
        return failure(res, 403, "Tidak boleh mengakses history user lain");
    }

    if (String(parent.status).toLowerCase() !== "success") {
        return failure(res, 409, "Hanya video dengan status success yang bisa diupscale");
    }

    const sourceUrl = String(parent.result_url || "").trim();
    if (!sourceUrl) {
        return failure(res, 409, "Video sumber tidak punya result_url");
    }

    /* ===== CEK SUDAH PERNAH DIUPSCALE ===== */

    try {
        const already = await hasActiveOrSuccessfulUpscale(historyId);
        if (already) {
            return failure(res, 409, "Video ini sudah pernah diupscale atau sedang diproses");
        }
    } catch (err) {
        console.error("[upscale] Failed to check upscale status:", err);
        return failure(res, 500, "Failed to check upscale status");
    }

    /* ===== DEDUCT CREDIT ===== */

    let remainingCredits = null;
    try {
        remainingCredits = await deductCredit(user.id, UPSCALE_CREDIT_COST);
    } catch (err) {
        console.error("[upscale] Credit deduction failed:", err);
        const combined = String(err?.message || "").toUpperCase();
        const insufficient = combined.includes("INSUFFICIENT_CREDITS");
        return failure(
            res,
            insufficient ? 402 : 500,
            insufficient ? "Kredit tidak cukup" : "Gagal potong kredit",
            { code: insufficient ? "INSUFFICIENT_CREDITS" : "CREDIT_DEDUCTION_FAILED" }
        );
    }

    /* ===== CREATE HISTORY ROW ===== */

    const taskId = generateTaskId();
    let upscaleRow;

    try {
        upscaleRow = await createUpscaleHistoryRow({
            user,
            parent,
            sourceUrl,
            taskId
        });
    } catch (err) {
        console.error("[upscale] Failed to create history row:", err);
        await refundCredit(user.id, UPSCALE_CREDIT_COST);
        return failure(res, 500, "Gagal membuat catatan history");
    }

    /* ===== TRIGGER GITHUB ===== */

    try {
        await triggerGithubWorkflow({
            historyId: upscaleRow.id,
            sourceUrl,
            userId: user.id
        });
    } catch (err) {
        console.error("[upscale] GitHub dispatch failed:", err);
        await markFailedAndRefund({
            historyId: upscaleRow.id,
            userId: user.id,
            errorMessage: "Gagal memulai upscale di GitHub Actions"
        });
        return failure(res, 502, "Gagal memulai upscale di GitHub Actions");
    }

    /* ===== SUCCESS ===== */

    return success(res, {
        upscale_history_id: upscaleRow.id,
        task_id: taskId,
        status: "processing",
        credit_used: UPSCALE_CREDIT_COST,
        remaining_credits: remainingCredits,
        target: UPSCALE_TARGET_LABEL
    });
}
