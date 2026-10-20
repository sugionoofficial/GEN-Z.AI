export const QWENCLOUD_IMAGE_MODELS = [
    { id: "qwen-image-3.0-pro", label: "qwen-image-3.0-pro", note: "Edited image kualitas tertinggi, 1–6 output" },
    { id: "qwen-image-3.0", label: "qwen-image-3.0", note: "Edited image standar" },
    { id: "qwen-image-edit-max", label: "qwen-image-edit-max", note: "Edit instruksi kualitas tinggi" },
    { id: "qwen-image-edit-plus", label: "qwen-image-edit-plus", note: "Edit instruksi lebih cepat" }
];
export const DEFAULT_QWENCLOUD_IMAGE_MODEL = "qwen-image-3.0-pro";

export function normalizeQwenCloudImageModel(value) {
    const found = QWENCLOUD_IMAGE_MODELS.find(model => model.id === String(value || "").trim());
    return found ? found.id : DEFAULT_QWENCLOUD_IMAGE_MODEL;
}

export function isQuotaErrorMessage(message) {
    return /FreeTierOnly|Allocated quota|exceeded your current quota|quota.*exceeded|exceeded.*quota|insufficient.*quota/i.test(String(message || ""));
}

export function quotaPercentAvailable(row) {
    if (!row) return null;
    if (row.exhausted === true) return 0;
    const limit = Number(row.quota_limit) || 0;
    if (limit <= 0) return null;
    const used = Number(row.requests_used) || 0;
    return Math.max(0, Math.min(100, Math.round(100 - (used / limit) * 100)));
}

async function restRequest(config, path, options = {}) {
    if (!config?.url || !config?.serviceRoleKey) {
        throw new Error("Supabase server configuration is missing.");
    }
    const response = await fetch(`${String(config.url).replace(/\/+$/, "")}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const text = await response.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch { data = { message: text }; }
        }
        const error = new Error(String(data?.message || `Supabase request failed (HTTP ${response.status}).`).slice(0, 500));
        error.status = response.status;
        throw error;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export async function getModelQuotas(config) {
    const rows = await restRequest(config, "social_publisher_model_quotas?select=model,requests_used,quota_limit,exhausted,last_status,window_started_at,updated_at");
    const byModel = new Map();
    for (const row of rows || []) byModel.set(row.model, row);
    return byModel;
}

export async function recordModelUsage(config, model, { quotaError = false, message = "" } = {}) {
    const safeModel = normalizeQwenCloudImageModel(model);
    const now = new Date().toISOString();
    const rows = await restRequest(
        config,
        `social_publisher_model_quotas?select=model,requests_used,exhausted&model=eq.${encodeURIComponent(safeModel)}&limit=1`
    );
    const current = rows?.[0];
    if (!current) {
        await restRequest(config, "social_publisher_model_quotas", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                model: safeModel,
                requests_used: quotaError ? 0 : 1,
                exhausted: quotaError === true,
                last_status: quotaError ? String(message).slice(0, 300) : "ok",
                window_started_at: now,
                updated_at: now
            })
        });
        return;
    }
    await restRequest(config, `social_publisher_model_quotas?model=eq.${encodeURIComponent(safeModel)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
            requests_used: quotaError ? Number(current.requests_used) || 0 : (Number(current.requests_used) || 0) + 1,
            exhausted: quotaError ? true : false,
            last_status: quotaError ? String(message).slice(0, 300) : "ok",
            updated_at: now
        })
    });
}

export async function setModelQuotaLimit(config, model, quotaLimit) {
    const safeModel = normalizeQwenCloudImageModel(model);
    const limit = Number(quotaLimit);
    if (!Number.isInteger(limit) || limit < 0) {
        const error = new Error("Batas tier harus berupa bilangan bulat >= 0.");
        error.status = 400;
        throw error;
    }
    const rows = await restRequest(config, "social_publisher_model_quotas?on_conflict=model&select=model", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify({ model: safeModel, quota_limit: limit, updated_at: new Date().toISOString() })
    });
    return rows?.[0] || { model: safeModel };
}

export async function resetModelQuota(config, model) {
    const safeModel = normalizeQwenCloudImageModel(model);
    const now = new Date().toISOString();
    const rows = await restRequest(
        config,
        `social_publisher_model_quotas?select=model&model=eq.${encodeURIComponent(safeModel)}&limit=1`
    );
    if (!rows?.length) {
        await restRequest(config, "social_publisher_model_quotas", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ model: safeModel, requests_used: 0, exhausted: false, last_status: "", window_started_at: now, updated_at: now })
        });
        return;
    }
    await restRequest(config, `social_publisher_model_quotas?model=eq.${encodeURIComponent(safeModel)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ requests_used: 0, exhausted: false, last_status: "", window_started_at: now, updated_at: now })
    });
}
