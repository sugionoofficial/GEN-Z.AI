/* OpenClips credential parsing, key-pool selection and OAuth token resolution. */

import { DEFAULT_OPENCLIPS_MCP_URL } from "./mcp-client.js";
import {
    parseJwtExpiryTimestampMs,
    resolveOpenClipsOAuthTokenWithVault
} from "./oauth-vault.js";

export const DEFAULT_OPENCLIPS_TOKEN_ENDPOINT = "https://mcp.openclips.ai/token";
export const DEFAULT_OPENCLIPS_RESOURCE = "https://mcp.openclips.ai";
export const DEFAULT_OPENCLIPS_SCOPE = "mcp";

const SINGLE_ENV_STEMS = [
    "OPENCLIPS_AUTH_TOKEN",
    "OPENCLIPS_ACCESS_TOKEN",
    "OPENCLIPS_API_KEY",
    "OPENCLIPS_TOKEN",
    "OPENCLIPS_KEY",
    "OPENCLIPS_SECRET"
];
const MULTI_ENV_STEMS = [
    "OPENCLIPS_AUTH_TOKENS",
    "OPENCLIPS_ACCESS_TOKENS",
    "OPENCLIPS_API_KEYS",
    "OPENCLIPS_TOKENS",
    "OPENCLIPS_KEYS",
    "OPENCLIPS_KEY_POOL"
];
const NUMBERED_ENV_PATTERN = /^(OPENCLIPS_(?:AUTH_TOKEN|ACCESS_TOKEN|API_KEY|TOKEN|KEY|SECRET))_(\d+)$/;

function cleanString(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

function stripBearer(value) {
    return cleanString(value).replace(/^Bearer\s+/i, "").trim();
}

function envReader(env) {
    const supplied = env && typeof env === "object" ? env : null;
    const fallback = !supplied && typeof process !== "undefined" ? process.env : {};
    return key => cleanString(supplied?.[key] ?? fallback?.[key]);
}

function parseJson(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    const text = cleanString(value);
    if (!text || !/^[\[{]/.test(text)) return null;
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function objectValue(object, keys) {
    for (const key of keys) {
        if (object?.[key] !== undefined && object?.[key] !== null && cleanString(object[key])) {
            return object[key];
        }
    }
    return "";
}

function normalizeBundle(value) {
    const parsed = parseJson(value);
    if (!parsed || Array.isArray(parsed)) return null;
    return parsed;
}

function rawCredentialValues(value) {
    if (Array.isArray(value)) return value.flatMap(rawCredentialValues);
    if (value && typeof value === "object") {
        for (const key of ["openclips_key_pool", "keys", "tokens", "credentials", "pool"]) {
            if (Array.isArray(value[key])) return value[key].flatMap(rawCredentialValues);
        }
        return [value];
    }
    const text = cleanString(value);
    if (!text) return [];
    const parsed = parseJson(text);
    if (Array.isArray(parsed)) return parsed.flatMap(rawCredentialValues);
    if (parsed && !Array.isArray(parsed)) {
        for (const key of ["openclips_key_pool", "keys", "tokens", "credentials", "pool"]) {
            if (Array.isArray(parsed[key])) return parsed[key].flatMap(rawCredentialValues);
        }
        return [text];
    }
    /* Newlines are unambiguous for pasteable token pools. Commas are accepted
       for compatibility with the Opus pool, except inside JSON (handled above). */
    return text.split(/[\n,]+/).map(cleanString).filter(Boolean);
}

function entryFromRaw(raw, source, slot) {
    const rawText = typeof raw === "string" ? cleanString(raw) : raw;
    if (!rawText || (typeof rawText === "object" && !Object.keys(rawText).length)) return null;
    const bundle = normalizeBundle(rawText);
    return {
        raw: rawText,
        source: source || "credential",
        slot: Number.isInteger(slot) ? slot : 0,
        bundle
    };
}

export function extractOpenClipsCredentialPool(primaryCredential = "", env = null) {
    const readEnv = envReader(env);
    const entries = [];
    const seen = new Set();
    const push = (raw, source) => {
        const values = rawCredentialValues(raw);
        for (const value of values) {
            const signature = typeof value === "string" ? value : JSON.stringify(value);
            if (!signature || seen.has(signature)) continue;
            const entry = entryFromRaw(value, source, entries.length);
            if (!entry) continue;
            seen.add(signature);
            entries.push(entry);
        }
    };

    push(primaryCredential, "provider_credentials");
    for (const key of SINGLE_ENV_STEMS) push(readEnv(key), `env:${key}`);
    for (const key of MULTI_ENV_STEMS) push(readEnv(key), `env:${key}`);

    const numbered = [];
    const source = env && typeof env === "object"
        ? env
        : (typeof process !== "undefined" ? process.env : {});
    for (const [key, value] of Object.entries(source || {})) {
        const match = key.match(NUMBERED_ENV_PATTERN);
        if (!match || !cleanString(value)) continue;
        numbered.push({ key, value, stem: match[1], slot: Number(match[2]) });
    }
    numbered.sort((a, b) => a.slot - b.slot || a.stem.localeCompare(b.stem) || a.key.localeCompare(b.key));
    for (const item of numbered) push(item.value, `env:${item.key}`);

    if (!entries.length && readEnv("OPENCLIPS_REFRESH_TOKEN")) {
        push({
            refresh_token: readEnv("OPENCLIPS_REFRESH_TOKEN"),
            access_token: readEnv("OPENCLIPS_ACCESS_TOKEN") || readEnv("OPENCLIPS_AUTH_TOKEN"),
            client_id: readEnv("OPENCLIPS_CLIENT_ID"),
            client_secret: readEnv("OPENCLIPS_CLIENT_SECRET"),
            token_endpoint: readEnv("OPENCLIPS_TOKEN_ENDPOINT") || DEFAULT_OPENCLIPS_TOKEN_ENDPOINT,
            resource: readEnv("OPENCLIPS_RESOURCE") || DEFAULT_OPENCLIPS_RESOURCE,
            scope: readEnv("OPENCLIPS_SCOPE") || DEFAULT_OPENCLIPS_SCOPE
        }, "env:OPENCLIPS_REFRESH_TOKEN");
    }
    return entries;
}

export async function resolveOpenClipsApiKeyPoolPayload(env = null, primaryCredential = "") {
    const entries = extractOpenClipsCredentialPool(primaryCredential, env);
    if (!entries.length) return "";
    if (entries.length === 1) {
        return typeof entries[0].raw === "string" ? entries[0].raw : JSON.stringify(entries[0].raw);
    }
    return JSON.stringify({
        openclips_key_pool: entries.map(entry => entry.raw)
    });
}

function resolveExpiryMs(bundle, accessToken) {
    const explicit = Number(objectValue(bundle, ["expires_at_ms", "expiresAtMs"])) || 0;
    if (explicit > 0) return explicit;
    const expiresAt = Number(objectValue(bundle, ["expires_at", "expiresAt"])) || 0;
    if (expiresAt > 0) return expiresAt < 10_000_000_000 ? expiresAt * 1000 : expiresAt;
    const expiresIn = Number(objectValue(bundle, ["expires_in", "expiresIn"])) || 0;
    if (expiresIn > 0) return Date.now() + expiresIn * 1000;
    return parseJwtExpiryTimestampMs(accessToken);
}

export function describeOpenClipsCredential(entry, env = null) {
    const readEnv = envReader(env);
    const bundle = entry?.bundle || null;
    const raw = typeof entry?.raw === "string" ? entry.raw : "";
    const source = cleanString(entry?.source);
    const numberedSource = source.match(/^env:OPENCLIPS_(?:AUTH_TOKEN|ACCESS_TOKEN|API_KEY|TOKEN|KEY|SECRET)_(\d+)$/i);
    const suffix = numberedSource ? `_${Number(numberedSource[1])}` : "";
    const canUseDefaultRefresh = !suffix && Number(entry?.slot || 0) === 0;
    const slotValue = base => suffix ? readEnv(`${base}${suffix}`) : readEnv(base);
    const refreshFromRaw = /^refresh:/i.test(raw) ? raw.replace(/^refresh:/i, "").trim() : "";
    const accessFromBundle = stripBearer(objectValue(bundle, ["access_token", "accessToken", "oauth_token", "oauthToken", "api_key", "apiKey", "key", "token"]));
    const accessToken = accessFromBundle || (bundle || refreshFromRaw ? "" : stripBearer(raw));
    const refreshToken = cleanString(
        objectValue(bundle, ["refresh_token", "refreshToken"]) ||
        refreshFromRaw ||
        (suffix ? readEnv(`OPENCLIPS_REFRESH_TOKEN${suffix}`) : (canUseDefaultRefresh ? readEnv("OPENCLIPS_REFRESH_TOKEN") : ""))
    );
    return {
        accessToken,
        refreshToken,
        clientId: cleanString(objectValue(bundle, ["client_id", "clientId"]) || slotValue("OPENCLIPS_CLIENT_ID") || (suffix ? readEnv("OPENCLIPS_CLIENT_ID") : "")),
        clientSecret: cleanString(objectValue(bundle, ["client_secret", "clientSecret"]) || slotValue("OPENCLIPS_CLIENT_SECRET") || (suffix ? readEnv("OPENCLIPS_CLIENT_SECRET") : "")),
        tokenEndpoint: cleanString(objectValue(bundle, ["token_endpoint", "tokenEndpoint"]) || slotValue("OPENCLIPS_TOKEN_ENDPOINT") || (suffix ? readEnv("OPENCLIPS_TOKEN_ENDPOINT") : "")) || DEFAULT_OPENCLIPS_TOKEN_ENDPOINT,
        resource: cleanString(objectValue(bundle, ["resource"]) || slotValue("OPENCLIPS_RESOURCE") || (suffix ? readEnv("OPENCLIPS_RESOURCE") : "")) || DEFAULT_OPENCLIPS_RESOURCE,
        scope: cleanString(objectValue(bundle, ["scope"]) || slotValue("OPENCLIPS_SCOPE") || (suffix ? readEnv("OPENCLIPS_SCOPE") : "")) || DEFAULT_OPENCLIPS_SCOPE,
        mcpUrl: cleanString(objectValue(bundle, ["mcp_url", "mcpUrl"]) || slotValue("OPENCLIPS_MCP_URL") || (suffix ? readEnv("OPENCLIPS_MCP_URL") : "")) || DEFAULT_OPENCLIPS_MCP_URL,
        workspaceId: cleanString(objectValue(bundle, ["workspace_id", "workspaceId"]) || slotValue("OPENCLIPS_WORKSPACE_ID") || (suffix ? readEnv("OPENCLIPS_WORKSPACE_ID") : "")),
        expiresAtMs: resolveExpiryMs(bundle, accessToken)
    };
}

export async function resolveOpenClipsAccessToken(entry, { env = null, forceRefresh = false } = {}) {
    const description = describeOpenClipsCredential(entry, env);
    if (description.refreshToken && !description.clientId && (!description.accessToken || forceRefresh)) {
        const error = new Error("OPENCLIPS_CLIENT_ID wajib dipasangkan dengan refresh token OpenClips. Login ulang melalui /api/openclips-oauth-login untuk membuat bundle lengkap.");
        error.code = "OPENCLIPS_CLIENT_ID_MISSING";
        throw error;
    }
    const resolved = await resolveOpenClipsOAuthTokenWithVault({
        env,
        tokenEndpoint: description.tokenEndpoint,
        clientId: description.clientId,
        clientSecret: description.clientSecret,
        resource: description.resource,
        scope: description.scope,
        accessToken: description.accessToken,
        refreshToken: description.refreshToken,
        expiresAtMs: description.expiresAtMs,
        forceRefresh
    });
    if (!resolved?.accessToken) {
        const error = new Error("Credential OpenClips tidak memiliki access token. Tempel API key/Bearer token atau JSON OAuth dari /api/openclips-oauth-login.");
        error.code = "OPENCLIPS_CREDENTIAL_MISSING";
        error.status = 401;
        throw error;
    }
    return { ...description, ...resolved, accessToken: resolved.accessToken };
}

export function selectOpenClipsCredential(credential, keySlot = 0, env = null) {
    const entries = extractOpenClipsCredentialPool(credential, env);
    if (!entries.length) {
        const error = new Error("Credential OpenClips belum dikonfigurasi. Isi Admin → Providers → OpenClips atau secret OPENCLIPS_AUTH_TOKEN / OPENCLIPS_API_KEY.");
        error.code = "OPENCLIPS_CREDENTIAL_MISSING";
        throw error;
    }
    const normalizedSlot = Number.isInteger(Number(keySlot)) && Number(keySlot) >= 0 ? Number(keySlot) : 0;
    const entry = entries[normalizedSlot] || entries[0];
    return { entry, entries, keySlot: entries.indexOf(entry), keyPoolSize: entries.length };
}

export async function resolveOpenClipsBearerToken(env = null, primaryCredential = "", options = {}) {
    const selection = selectOpenClipsCredential(primaryCredential, options.keySlot || 0, env);
    const resolved = await resolveOpenClipsAccessToken(selection.entry, {
        env,
        forceRefresh: Boolean(options.forceRefresh)
    });
    return {
        token: resolved.accessToken,
        keySlot: selection.keySlot,
        keyPoolSize: selection.keyPoolSize,
        canRefresh: Boolean(resolved.canRefresh),
        entry: selection.entry
    };
}
