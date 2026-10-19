export const SOCIAL_REFERENCE_STORAGE_BUCKET = "social-character-references";
const MAX_ERROR_LENGTH = 500;

function encodedObjectPath(key) {
    const segments = String(key || "").split("/");
    if (segments.length < 3 || segments.some(segment => !segment || segment === "." || segment === "..")) {
        throw new Error("Invalid reference object path.");
    }
    return segments.map(segment => encodeURIComponent(segment)).join("/");
}

async function storageRequest(config, path, options = {}) {
    if (!config?.url || !config?.serviceRoleKey) {
        throw new Error("Supabase Storage server configuration is missing.");
    }
    const response = await fetch(`${String(config.url).replace(/\/+$/, "")}${path}`, {
        ...options,
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const text = await response.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch { data = { message: text }; }
        }
        const message = String(data?.message || data?.error || data?.statusCode || `Supabase Storage request failed (HTTP ${response.status}).`)
            .slice(0, MAX_ERROR_LENGTH);
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response;
}

export async function isPrivateReferenceBucket(config) {
    try {
        const response = await storageRequest(
            config,
            `/storage/v1/bucket/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}`
        );
        const bucket = await response.json();
        return bucket?.id === SOCIAL_REFERENCE_STORAGE_BUCKET && bucket?.public === false;
    } catch {
        return false;
    }
}

export async function uploadReferenceObject(config, key, bytes, mimeType) {
    const path = encodedObjectPath(key);
    await storageRequest(
        config,
        `/storage/v1/object/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}/${path}`,
        {
            method: "POST",
            headers: {
                "Content-Type": mimeType,
                "x-upsert": "false"
            },
            body: bytes
        }
    );
}

export async function downloadReferenceObject(config, key) {
    const path = encodedObjectPath(key);
    const response = await storageRequest(
        config,
        `/storage/v1/object/authenticated/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}/${path}`
    );
    return new Uint8Array(await response.arrayBuffer());
}

export async function deleteReferenceObject(config, key) {
    encodedObjectPath(key);
    await storageRequest(
        config,
        `/storage/v1/object/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}`,
        {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefixes: [key] })
        }
    );
}
