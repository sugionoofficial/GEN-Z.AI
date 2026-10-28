/* =========================================================
   GEN-Z.AI — OPUS OAUTH ROTATING TOKEN VAULT
   ---------------------------------------------------------
   File:
     provider/opus/oauth-vault.js

   Menyimpan & memulihkan pasangan { access_token, refresh_token }
   hasil rotasi single-use WorkOS AuthKit secara persisten dan
   terenkripsi AES-256-GCM di tabel Supabase `public.opus_oauth_tokens`.

   100% browser-safe ES module (menggunakan Web Crypto API standar
   `globalThis.crypto.subtle` tanpa ketergantungan `node:*`) sehingga
   aman ikut di-bundle di `dist/` sekaligus berjalan native di
   Cloudflare Workers & Node.js 20+.
========================================================= */

const DEFAULT_OAUTH_TOKEN_URL = "https://focused-horizon-38.authkit.app/oauth2/token";
const VAULT_TABLE = "opus_oauth_tokens";
const VAULT_HTTP_TIMEOUT_MS = 4_500;
const FRESH_BUFFER_MS = 90_000;

const memoryVaultBySeedHash = new Map();
const inflightRefreshBySeedHash = new Map();
const cryptoKeyCache = new Map();

function getProcessEnv() {
    return typeof process !== "undefined" && process && process.env
        ? process.env
        : {};
}

function readEnvString(envObj, key) {
    if (envObj && typeof envObj === "object") {
        const direct = envObj[key];
        if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
            return String(direct).trim();
        }
    }
    const fallback = getProcessEnv()[key];
    return fallback !== undefined && fallback !== null ? String(fallback).trim() : "";
}

function stripBearer(value) {
    return String(value || "").trim().replace(/^Bearer\s+/i, "").trim();
}

function bytesToHex(bytes) {
    let hex = "";
    for (let i = 0; i < bytes.length; i += 1) {
        hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
}

function bytesToBase64(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof Buffer !== "undefined") {
        return Buffer.from(view).toString("base64");
    }
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < view.length; i += chunk) {
        binary += String.fromCharCode(...view.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function base64ToBytes(b64) {
    const clean = String(b64 || "").trim();
    if (!clean) return new Uint8Array(0);
    if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(clean, "base64"));
    }
    const binary = atob(clean);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

function decodeBase64UrlUtf8(input) {
    const normalized = String(input || "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = base64ToBytes(padded);
    return new TextDecoder().decode(bytes);
}

export function parseJwtExpiryTimestampMs(token) {
    const raw = stripBearer(token);
    const parts = raw.split(".");
    if (parts.length !== 3) return 0;
    try {
        const payload = JSON.parse(decodeBase64UrlUtf8(parts[1]));
        return typeof payload?.exp === "number" && Number.isFinite(payload.exp)
            ? payload.exp * 1000
            : 0;
    } catch {
        return 0;
    }
}

export function clearOpusMemoryTokenVault() {
    memoryVaultBySeedHash.clear();
    inflightRefreshBySeedHash.clear();
}

export async function computeOpusSeedHash({
    tokenEndpoint = DEFAULT_OAUTH_TOKEN_URL,
    clientId = "",
    seedRefreshToken = ""
} = {}) {
    const canonical = [
        "opus-oauth-v1",
        String(tokenEndpoint || DEFAULT_OAUTH_TOKEN_URL).trim().toLowerCase(),
        String(clientId || "").trim(),
        String(seedRefreshToken || "").trim()
    ].join("|");
    const data = new TextEncoder().encode(canonical);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
}

function resolveSupabaseVaultConfig(envObj) {
    if (readEnvString(envObj, "OPUS_DISABLE_SUPABASE_VAULT") === "1") {
        return null;
    }
    const supabaseUrl = readEnvString(envObj, "SUPABASE_URL").replace(/\/+$/, "");
    const serviceRoleKey = readEnvString(envObj, "SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
        return null;
    }
    const secretMaterial =
        readEnvString(envObj, "PROVIDER_CREDENTIAL_KEY") ||
        readEnvString(envObj, "SOCIAL_TOKEN_ENCRYPTION_KEY") ||
        serviceRoleKey;
    return {
        supabaseUrl,
        serviceRoleKey,
        secretMaterial
    };
}

async function getVaultAesKey(secretMaterial) {
    if (cryptoKeyCache.has(secretMaterial)) {
        return cryptoKeyCache.get(secretMaterial);
    }
    const rawMaterial = new TextEncoder().encode(`genz-opus-oauth-vault-v1:${secretMaterial}`);
    const keyHash = await globalThis.crypto.subtle.digest("SHA-256", rawMaterial);
    const aesKey = await globalThis.crypto.subtle.importKey(
        "raw",
        keyHash,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
    cryptoKeyCache.set(secretMaterial, aesKey);
    return aesKey;
}

export async function encryptOpusVaultRecord(secretMaterial, record) {
    const aesKey = await getVaultAesKey(secretMaterial);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(record));
    const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        plaintext
    );
    return {
        ciphertextBase64: bytesToBase64(new Uint8Array(encryptedBuffer)),
        ivBase64: bytesToBase64(iv)
    };
}

export async function decryptOpusVaultRecord(secretMaterial, ciphertextBase64, ivBase64) {
    const aesKey = await getVaultAesKey(secretMaterial);
    const ciphertextBytes = base64ToBytes(ciphertextBase64);
    const ivBytes = base64ToBytes(ivBase64);
    if (!ciphertextBytes.byteLength || ivBytes.byteLength !== 12) {
        return null;
    }
    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        aesKey,
        ciphertextBytes
    );
    const parsed = JSON.parse(new TextDecoder().decode(decryptedBuffer));
    return parsed && typeof parsed === "object" ? parsed : null;
}

async function fetchVaultWithTimeout(url, init) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
        ? setTimeout(() => controller.abort(), VAULT_HTTP_TIMEOUT_MS)
        : null;
    try {
        return await fetch(url, {
            ...init,
            ...(controller ? { signal: controller.signal } : {})
        });
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export async function readPersistedOpusTokenState(envObj, seedHash) {
    const cfg = resolveSupabaseVaultConfig(envObj);
    if (!cfg || !seedHash) return null;

    try {
        const params = new URLSearchParams({
            select: "token_ciphertext,token_iv,expires_at,updated_at",
            seed_hash: `eq.${seedHash}`,
            limit: "1"
        });
        const res = await fetchVaultWithTimeout(
            `${cfg.supabaseUrl}/rest/v1/${VAULT_TABLE}?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    apikey: cfg.serviceRoleKey,
                    Authorization: `Bearer ${cfg.serviceRoleKey}`,
                    Accept: "application/json"
                }
            }
        );
        if (!res || !res.ok) return null;
        const rows = await res.json().catch(() => null);
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row?.token_ciphertext || !row?.token_iv) {
            return null;
        }
        const decrypted = await decryptOpusVaultRecord(
            cfg.secretMaterial,
            row.token_ciphertext,
            row.token_iv
        );
        if (!decrypted) return null;
        const accessToken = stripBearer(decrypted.access_token || decrypted.accessToken || "");
        const refreshToken = String(decrypted.refresh_token || decrypted.refreshToken || "").trim();
        const expiresAtMs =
            Number(decrypted.expires_at_ms || decrypted.expiresAtMs || 0) ||
            (row.expires_at ? Date.parse(row.expires_at) || 0 : 0) ||
            parseJwtExpiryTimestampMs(accessToken);
        if (!accessToken && !refreshToken) {
            return null;
        }
        return {
            accessToken,
            refreshToken,
            expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0
        };
    } catch {
        return null;
    }
}

export async function writePersistedOpusTokenState(
    envObj,
    seedHash,
    { accessToken = "", refreshToken = "", expiresAtMs = 0 } = {}
) {
    const cfg = resolveSupabaseVaultConfig(envObj);
    if (!cfg || !seedHash || (!accessToken && !refreshToken)) {
        return false;
    }

    try {
        const encrypted = await encryptOpusVaultRecord(cfg.secretMaterial, {
            access_token: stripBearer(accessToken),
            refresh_token: String(refreshToken || "").trim(),
            expires_at_ms: Number(expiresAtMs) || 0
        });
        const nowIso = new Date().toISOString();
        const expiresIso =
            Number(expiresAtMs) > 0
                ? new Date(Number(expiresAtMs)).toISOString()
                : null;
        const res = await fetchVaultWithTimeout(
            `${cfg.supabaseUrl}/rest/v1/${VAULT_TABLE}?on_conflict=seed_hash`,
            {
                method: "POST",
                headers: {
                    apikey: cfg.serviceRoleKey,
                    Authorization: `Bearer ${cfg.serviceRoleKey}`,
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify({
                    seed_hash: seedHash,
                    token_ciphertext: encrypted.ciphertextBase64,
                    token_iv: encrypted.ivBase64,
                    expires_at: expiresIso,
                    updated_at: nowIso
                })
            }
        );
        return Boolean(res && res.ok);
    } catch {
        return false;
    }
}

function isTokenStillFresh(accessToken, expiresAtMs = 0, bufferMs = FRESH_BUFFER_MS) {
    if (!accessToken) return false;
    const effectiveExp = Number(expiresAtMs) || parseJwtExpiryTimestampMs(accessToken);
    if (effectiveExp > 0) {
        return effectiveExp - Date.now() > bufferMs;
    }
    return true;
}

function sleepShort(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function performWorkosTokenRefresh({
    tokenEndpoint,
    refreshToken,
    clientId,
    clientSecret,
    resource,
    scope
}) {
    const sendOnce = async includeResourceAndScope => {
        const form = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId
        });
        if (clientSecret) {
            form.set("client_secret", clientSecret);
        }
        if (includeResourceAndScope) {
            if (resource) form.set("resource", resource);
            if (scope) form.set("scope", scope);
        }
        const response = await fetch(tokenEndpoint || DEFAULT_OAUTH_TOKEN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json"
            },
            body: form.toString()
        });
        const rawText = await response.text();
        let data = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch {
            data = null;
        }
        return { response, data, rawText };
    };

    let attempt = await sendOnce(Boolean(resource || scope));
    if (
        (!attempt.response.ok || !attempt.data?.access_token) &&
        (resource || scope) &&
        /^(invalid_target|invalid_scope)$/i.test(String(attempt.data?.error || ""))
    ) {
        attempt = await sendOnce(false);
    }
    return attempt;
}

export async function resolveOpusOAuthTokenWithVault({
    env = null,
    tokenEndpoint = DEFAULT_OAUTH_TOKEN_URL,
    clientId = "",
    clientSecret = "",
    resource = "",
    scope = "",
    accessToken = "",
    refreshToken = "",
    expiresAtMs = 0,
    forceRefresh = false
} = {}) {
    const cleanInitialAccess = stripBearer(accessToken);
    const seedRefreshToken = String(refreshToken || "").trim();
    const cleanClientId = String(clientId || "").trim();

    if (!seedRefreshToken || !cleanClientId) {
        return {
            accessToken: cleanInitialAccess,
            refreshToken: seedRefreshToken,
            expiresAtMs: Number(expiresAtMs) || parseJwtExpiryTimestampMs(cleanInitialAccess),
            canRefresh: false
        };
    }

    const seedHash = await computeOpusSeedHash({
        tokenEndpoint,
        clientId: cleanClientId,
        seedRefreshToken
    });

    const memEntry = memoryVaultBySeedHash.get(seedHash) || null;
    if (
        !forceRefresh &&
        memEntry?.accessToken &&
        isTokenStillFresh(memEntry.accessToken, memEntry.expiresAtMs)
    ) {
        return {
            accessToken: memEntry.accessToken,
            refreshToken: memEntry.refreshToken || seedRefreshToken,
            expiresAtMs: memEntry.expiresAtMs,
            canRefresh: true,
            seedHash
        };
    }

    const initialExpMs = parseJwtExpiryTimestampMs(cleanInitialAccess) || Number(expiresAtMs || 0);
    if (
        !forceRefresh &&
        !memEntry &&
        cleanInitialAccess &&
        (!initialExpMs || initialExpMs - Date.now() > FRESH_BUFFER_MS)
    ) {
        const entry = {
            accessToken: cleanInitialAccess,
            refreshToken: seedRefreshToken,
            expiresAtMs: initialExpMs
        };
        memoryVaultBySeedHash.set(seedHash, entry);
        return {
            ...entry,
            canRefresh: true,
            seedHash
        };
    }

    const inflightKey = `${seedHash}:${forceRefresh ? "force" : "auto"}`;
    if (inflightRefreshBySeedHash.has(inflightKey)) {
        return await inflightRefreshBySeedHash.get(inflightKey);
    }

    const refreshTask = (async () => {
        /* 1. Cek brankas persisten Supabase terlebih dahulu (menangani rotasi lintas isolate / pasca-deploy) */
        const persisted = await readPersistedOpusTokenState(env, seedHash);
        if (persisted) {
            memoryVaultBySeedHash.set(seedHash, persisted);
            if (
                !forceRefresh &&
                persisted.accessToken &&
                isTokenStillFresh(persisted.accessToken, persisted.expiresAtMs)
            ) {
                return {
                    accessToken: persisted.accessToken,
                    refreshToken: persisted.refreshToken || seedRefreshToken,
                    expiresAtMs: persisted.expiresAtMs,
                    canRefresh: true,
                    seedHash
                };
            }
        }

        /* 2. Susun kandidat refresh_token dari yang paling baru (DB -> RAM -> Seed Cloudflare Secret) */
        const candidates = [];
        for (const rt of [
            persisted?.refreshToken,
            memEntry?.refreshToken,
            seedRefreshToken
        ]) {
            const trimmed = String(rt || "").trim();
            if (trimmed && !candidates.includes(trimmed)) {
                candidates.push(trimmed);
            }
        }

        let lastAttempt = null;
        const triedRefreshTokens = new Set();

        for (const candidateRt of candidates) {
            triedRefreshTokens.add(candidateRt);
            const attempt = await performWorkosTokenRefresh({
                tokenEndpoint,
                refreshToken: candidateRt,
                clientId: cleanClientId,
                clientSecret,
                resource,
                scope
            });
            lastAttempt = attempt;

            if (attempt.response.ok && typeof attempt.data?.access_token === "string" && attempt.data.access_token.trim()) {
                const nextAccess = stripBearer(attempt.data.access_token);
                const nextRefresh =
                    typeof attempt.data.refresh_token === "string" && attempt.data.refresh_token.trim()
                        ? attempt.data.refresh_token.trim()
                        : candidateRt;
                const expiresInSec = Number(attempt.data.expires_in) || 3600;
                const nextExpMs =
                    parseJwtExpiryTimestampMs(nextAccess) ||
                    (Date.now() + expiresInSec * 1000);

                const updatedRecord = {
                    accessToken: nextAccess,
                    refreshToken: nextRefresh,
                    expiresAtMs: nextExpMs
                };
                memoryVaultBySeedHash.set(seedHash, updatedRecord);
                await writePersistedOpusTokenState(env, seedHash, updatedRecord);

                return {
                    ...updatedRecord,
                    canRefresh: false,
                    seedHash
                };
            }

            /* Jika bukan invalid_grant, hentikan loop kandidat */
            if (!/invalid_grant/i.test(String(attempt.data?.error || attempt.rawText || ""))) {
                break;
            }
        }

        /* 3. Pemulihan race condition lintas-isolate: bila isolate lain baru saja me-refresh token yang sama */
        if (
            lastAttempt &&
            /invalid_grant/i.test(String(lastAttempt.data?.error || lastAttempt.rawText || "")) &&
            resolveSupabaseVaultConfig(env)
        ) {
            await sleepShort(300);
            const racedPersisted = await readPersistedOpusTokenState(env, seedHash);
            if (racedPersisted) {
                memoryVaultBySeedHash.set(seedHash, racedPersisted);
                if (
                    racedPersisted.accessToken &&
                    isTokenStillFresh(racedPersisted.accessToken, racedPersisted.expiresAtMs, 30_000)
                ) {
                    return {
                        accessToken: racedPersisted.accessToken,
                        refreshToken: racedPersisted.refreshToken || seedRefreshToken,
                        expiresAtMs: racedPersisted.expiresAtMs,
                        canRefresh: true,
                        seedHash
                    };
                }
                if (racedPersisted.refreshToken && !triedRefreshTokens.has(racedPersisted.refreshToken)) {
                    const retryAttempt = await performWorkosTokenRefresh({
                        tokenEndpoint,
                        refreshToken: racedPersisted.refreshToken,
                        clientId: cleanClientId,
                        clientSecret,
                        resource,
                        scope
                    });
                    if (
                        retryAttempt.response.ok &&
                        typeof retryAttempt.data?.access_token === "string" &&
                        retryAttempt.data.access_token.trim()
                    ) {
                        const nextAccess = stripBearer(retryAttempt.data.access_token);
                        const nextRefresh =
                            typeof retryAttempt.data.refresh_token === "string" && retryAttempt.data.refresh_token.trim()
                                ? retryAttempt.data.refresh_token.trim()
                                : racedPersisted.refreshToken;
                        const expiresInSec = Number(retryAttempt.data.expires_in) || 3600;
                        const nextExpMs =
                            parseJwtExpiryTimestampMs(nextAccess) ||
                            (Date.now() + expiresInSec * 1000);
                        const updatedRecord = {
                            accessToken: nextAccess,
                            refreshToken: nextRefresh,
                            expiresAtMs: nextExpMs
                        };
                        memoryVaultBySeedHash.set(seedHash, updatedRecord);
                        await writePersistedOpusTokenState(env, seedHash, updatedRecord);
                        return {
                            ...updatedRecord,
                            canRefresh: false,
                            seedHash
                        };
                    }
                    lastAttempt = retryAttempt;
                }
            }
        }

        if (!forceRefresh && cleanInitialAccess && !initialExpMs) {
            return {
                accessToken: cleanInitialAccess,
                refreshToken: seedRefreshToken,
                expiresAtMs: 0,
                canRefresh: false,
                seedHash
            };
        }

        const status = lastAttempt?.response?.status || 401;
        const errCode = String(lastAttempt?.data?.error || "invalid_grant").trim();
        const errDetail = String(
            lastAttempt?.data?.error_description ||
            lastAttempt?.data?.message ||
            lastAttempt?.data?.error ||
            (lastAttempt?.rawText ? lastAttempt.rawText.slice(0, 180) : "")
        ).trim();
        const err = new Error(errDetail || `Refresh token OAuth Opus gagal (HTTP ${status}).`);
        err.status = status;
        err.oauthErrorCode = errCode;
        err.oauthDetail = errDetail;
        throw err;
    })();

    inflightRefreshBySeedHash.set(inflightKey, refreshTask);
    try {
        return await refreshTask;
    } finally {
        inflightRefreshBySeedHash.delete(inflightKey);
    }
}
