export const QWENCLOUD_IMAGE_MODELS = [
    { id: "qwen-image-3.0-pro", label: "qwen-image-3.0-pro", note: "Image-to-image · free quota 10 images", defaultQuota: 10 },
    { id: "qwen-image-3.0", label: "qwen-image-3.0", note: "Image-to-image · $0.003–0.03/image · RPM 20 · 10 concurrent", defaultQuota: 0 },
    { id: "qwen-image-2.1-pro", label: "qwen-image-2.1-pro", note: "Image-to-image · $0.04/image · RPM 20 · free quota 10 images", defaultQuota: 10 },
    { id: "qwen-image-2.1-turbo", label: "qwen-image-2.1-turbo", note: "Image-to-image · free quota 10 images", defaultQuota: 10 },
    { id: "qwen-image-2.0-pro", label: "qwen-image-2.0-pro", note: "Image-to-image · $0.075/image · RPM 2", defaultQuota: 0 },
    { id: "qwen-mt-image-2.0", label: "qwen-mt-image-2.0", note: "Image→image (terjemahan teks pada gambar) · $0.0006/image · RPM 60", defaultQuota: 0 },
    { id: "wan2.7-image-pro", label: "wan2.7-image-pro", note: "Image+text→image · $0.075/image · RPM 300 · free quota 50 images", defaultQuota: 50 , protocol: "async" },
    { id: "wan2.7-image", label: "wan2.7-image", note: "Image-to-image · free quota 50 images", defaultQuota: 50 , protocol: "async" },
    { id: "wan2.6-image", label: "wan2.6-image", note: "Image-to-image · free quota 50 images", defaultQuota: 50 , protocol: "async" },
    { id: "wan2.5-i2i-preview", label: "wan2.5-i2i-preview", note: "Image-to-image · free quota 50 images", defaultQuota: 50 , protocol: "async" },
    { id: "wan2.6-t2i", label: "wan2.6-t2i", note: "Text-to-image · free quota 50 images", defaultQuota: 50 , protocol: "async" },
    { id: "wan2.5-t2i-preview", label: "wan2.5-t2i-preview", note: "Text-to-image · free quota 50 images", defaultQuota: 50 , protocol: "async" },
    { id: "wan2.2-t2i-plus", label: "wan2.2-t2i-plus", note: "Text-to-image · free quota 100 images", defaultQuota: 100 , protocol: "async" },
    { id: "wan2.2-t2i-flash", label: "wan2.2-t2i-flash", note: "Text-to-image · free quota 100 images", defaultQuota: 100 , protocol: "async" },
    { id: "z-image-turbo", label: "z-image-turbo", note: "Text-to-image · free quota 100 images", defaultQuota: 100 , protocol: "async" },
    { id: "vidu/vidu-image_reference2image", label: "vidu/vidu-image_reference2image", note: "Reference→image · $0.1–0.24/image · RPM 300", defaultQuota: 0 , protocol: "async" }
];
export const DEFAULT_QWENCLOUD_IMAGE_MODEL = "qwen-image-3.0-pro";

export const QWENCLOUD_LLM_MODELS = [
    { id: "qwen-plus", label: "qwen-plus", note: "LLM seimbang & natural · free quota 1M tokens (~1.000+ post)", defaultQuota: 1000 },
    { id: "qwen-flash", label: "qwen-flash", note: "LLM super cepat & paling irit · free quota 1M tokens (~1.000+ post)", defaultQuota: 1000 },
    { id: "qwen-turbo", label: "qwen-turbo", note: "LLM cepat & ringan · free quota 1M tokens (~1.000+ post)", defaultQuota: 1000 },
    { id: "qwen-max", label: "qwen-max", note: "LLM kualitas puitis tertinggi · free quota 1M tokens (~1.000+ post)", defaultQuota: 1000 },
    { id: "qwen3-max", label: "qwen3-max", note: "Qwen3 Flagship LLM · free quota 1M tokens (~1.000+ post)", defaultQuota: 1000 },
    { id: "qwen3.5-plus", label: "qwen3.5-plus", note: "Qwen 3.5 Plus · free quota 1M tokens (~1.000+ post)", defaultQuota: 1000 },
    { id: "qwen3.5-flash", label: "qwen3.5-flash", note: "Qwen 3.5 Flash cepat & hemat · free quota 1M tokens (~1.000+ post)", defaultQuota: 1000 },
    { id: "qwen3-235b-a22b-instruct-2507", label: "qwen3-235b-a22b-instruct-2507", note: "Qwen3 235B Instruct (kreatif & puitis) · free quota 1M tokens", defaultQuota: 1000 },
    { id: "qwen3-30b-a3b-instruct-2507", label: "qwen3-30b-a3b-instruct-2507", note: "Qwen3 30B Instruct cepat · free quota 1M tokens", defaultQuota: 1000 },
    { id: "qwen3-next-80b-a3b-instruct", label: "qwen3-next-80b-a3b-instruct", note: "Qwen3-Next 80B Instruct · free quota 1M tokens", defaultQuota: 1000 },
    { id: "qwen3-32b", label: "qwen3-32b", note: "Qwen3 32B · free quota 1M tokens", defaultQuota: 1000 },
    { id: "qwen3-14b", label: "qwen3-14b", note: "Qwen3 14B · free quota 1M tokens", defaultQuota: 1000 },
    { id: "qwen3-8b", label: "qwen3-8b", note: "Qwen3 8B ringan · free quota 1M tokens", defaultQuota: 1000 },
    { id: "qwq-plus", label: "qwq-plus", note: "QwQ Plus Reasoning · free quota 1M tokens", defaultQuota: 1000, protocol: "compat" },
    { id: "qwen3-vl-plus", label: "qwen3-vl-plus", note: "Qwen3 VL Plus (Multimodal + Teks) · free quota 1M tokens", defaultQuota: 1000, protocol: "multimodal" },
    { id: "qwen3-vl-flash", label: "qwen3-vl-flash", note: "Qwen3 VL Flash (Multimodal + Teks cepat) · free quota 1M tokens", defaultQuota: 1000, protocol: "multimodal" }
];
export const DEFAULT_QWENCLOUD_LLM_MODEL = "qwen-plus";

export function qwenCloudProtocolFor(model) {
    const found = QWENCLOUD_IMAGE_MODELS.find(entry => entry.id === String(model || "").trim());
    return found?.protocol === "async" ? "async" : "sync";
}

export function qwenCloudLlmProtocolFor(model) {
    const found = QWENCLOUD_LLM_MODELS.find(entry => entry.id === String(model || "").trim());
    if (found?.protocol === "multimodal") return "multimodal";
    if (found?.protocol === "compat") return "compat";
    return "text";
}

export function defaultQuotaLimitFor(model) {
    const key = String(model || "").trim();
    const found = QWENCLOUD_IMAGE_MODELS.find(entry => entry.id === key)
        || QWENCLOUD_LLM_MODELS.find(entry => entry.id === key);
    return Number(found?.defaultQuota) || 0;
}

export function normalizeQwenCloudImageModel(value) {
    const found = QWENCLOUD_IMAGE_MODELS.find(model => model.id === String(value || "").trim());
    return found ? found.id : DEFAULT_QWENCLOUD_IMAGE_MODEL;
}

export function normalizeQwenCloudLlmModel(value) {
    const found = QWENCLOUD_LLM_MODELS.find(model => model.id === String(value || "").trim());
    return found ? found.id : DEFAULT_QWENCLOUD_LLM_MODEL;
}

export function isQwenCloudLlmModel(value) {
    return QWENCLOUD_LLM_MODELS.some(model => model.id === String(value || "").trim());
}

export function normalizeQwenCloudQuotaModel(value) {
    const clean = String(value || "").trim();
    const foundImage = QWENCLOUD_IMAGE_MODELS.find(model => model.id === clean);
    if (foundImage) return foundImage.id;
    const foundLlm = QWENCLOUD_LLM_MODELS.find(model => model.id === clean);
    if (foundLlm) return foundLlm.id;
    return DEFAULT_QWENCLOUD_IMAGE_MODEL;
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
    const safeModel = normalizeQwenCloudQuotaModel(model);
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
                quota_limit: defaultQuotaLimitFor(safeModel),
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
    const safeModel = normalizeQwenCloudQuotaModel(model);
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
    const safeModel = normalizeQwenCloudQuotaModel(model);
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
