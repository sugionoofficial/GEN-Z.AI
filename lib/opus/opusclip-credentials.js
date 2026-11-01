/* =========================================================
   GEN-Z.AI — OPUSCLIP ENCRYPTED CREDENTIALS LOADER & SAVER
   ---------------------------------------------------------
   File:
     lib/opus/opusclip-credentials.js

   Mengelola dua kredensial Bagian 2 secara terenkripsi AES-256-GCM
   di tabel Supabase `public.provider_credentials` + sinkronisasi
   seed OAuth ke `public.opus_oauth_tokens` (TANPA PERNAH menghapus
   baris di `opus_oauth_tokens`):

   1. `provider_id = "opusclip"`     -> `{ apiKey, orgId }` untuk
      REST API `https://api.opus.pro/api` (fallback `env.OPUSCLIP_API_KEY`)
   2. `provider_id = "opusclip_mcp"` -> JSON seed OAuth PKCE untuk
      MCP `https://mcp.opus.pro/mcp` (fallback `env.OPUSCLIP_MCP_AUTH_TOKEN`)
========================================================= */

import crypto from "node:crypto";
import { resolveOpusOAuthTokenWithVault } from "../../provider/opus/oauth-vault.js";
import { parseOpusClipMcpAuthConfig } from "../../provider/opusclip/mcp-understanding.js";

export const OPUSCLIP_REST_PROVIDER_ID = "opusclip";
export const OPUSCLIP_MCP_PROVIDER_ID = "opusclip_mcp";

function decodeCipherBuffer(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    if (/^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0) {
        try {
            return Buffer.from(text, "hex");
        } catch {
            /* fallback base64 */
        }
    }
    try {
        const buf = Buffer.from(text, "base64");
        if (buf.length > 0) return buf;
    } catch {
        /* ignore */
    }
    return null;
}

function deriveEncryptionKey(env = {}) {
    const rawSecret = String(
        env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ||
        env.API_KEY_ENCRYPTION_SECRET ||
        env.PROVIDER_CREDENTIAL_KEY ||
        env.SUPABASE_SERVICE_ROLE_KEY ||
        ""
    ).trim();

    if (!rawSecret) return null;
    if (/^[0-9a-fA-F]{64}$/.test(rawSecret)) {
        return Buffer.from(rawSecret, "hex");
    }
    try {
        const buf = Buffer.from(rawSecret, "base64");
        if (buf.length === 32) return buf;
    } catch {
        /* fallback sha256 */
    }
    return crypto.createHash("sha256").update(rawSecret).digest();
}

export function encryptCredentialPlaintext(plaintext, env = {}) {
    const key = deriveEncryptionKey(env);
    if (!key || key.length !== 32) {
        throw new Error(
            "Kunci enkripsi server (PROVIDER_CREDENTIAL_ENCRYPTION_KEY) belum tersedia."
        );
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(plaintext || ""), "utf8"),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return {
        api_key_ciphertext: encrypted.toString("base64"),
        api_key_iv: iv.toString("base64"),
        api_key_tag: tag.toString("base64")
    };
}

export function decryptCredentialRow(row, env = {}) {
    const key = deriveEncryptionKey(env);
    if (!key || key.length !== 32) return "";
    const iv = decodeCipherBuffer(row?.api_key_iv);
    const tag = decodeCipherBuffer(row?.api_key_tag);
    const ciphertext = decodeCipherBuffer(row?.api_key_ciphertext);
    if (!iv || !tag || !ciphertext) return "";
    try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8").trim();
    } catch {
        return "";
    }
}

export function maskSecretPreview(secret) {
    const clean = String(secret || "").trim();
    if (!clean) return "";
    if (clean.length <= 8) return "••••••••";
    return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

async function ensureProviderRowExists(supabaseUrl, serviceKey, providerId, providerName, description, fetchImpl) {
    try {
        await fetchImpl(`${supabaseUrl}/rest/v1/providers?on_conflict=provider_id`, {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify({
                provider_id: providerId,
                provider_name: providerName,
                description,
                status: "active",
                is_default: false
            })
        });
    } catch {
        /* non-fatal */
    }
}

async function readProviderCredentialPlaintext(env, providerId, fetchImpl = globalThis.fetch) {
    const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceKey || typeof fetchImpl !== "function") {
        return { plaintext: "", updatedAt: null, fromDb: false };
    }

    try {
        const qs = new URLSearchParams({
            select: "provider_id,api_key_ciphertext,api_key_iv,api_key_tag,updated_at",
            provider_id: `eq.${providerId}`,
            limit: "1"
        });
        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/provider_credentials?${qs.toString()}`, {
            method: "GET",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        });
        if (!resp.ok) return { plaintext: "", updatedAt: null, fromDb: false };
        const rows = await resp.json().catch(() => []);
        if (!Array.isArray(rows) || !rows[0]) {
            return { plaintext: "", updatedAt: null, fromDb: false };
        }
        const plaintext = decryptCredentialRow(rows[0], env);
        return {
            plaintext,
            updatedAt: rows[0].updated_at || null,
            fromDb: Boolean(plaintext)
        };
    } catch {
        return { plaintext: "", updatedAt: null, fromDb: false };
    }
}

export async function saveProviderCredentialPlaintext(env, {
    providerId,
    providerName,
    description,
    plaintext,
    fetchImpl = globalThis.fetch
} = {}) {
    const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceKey) {
        throw new Error("Konfigurasi SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum lengkap.");
    }

    await ensureProviderRowExists(supabaseUrl, serviceKey, providerId, providerName, description, fetchImpl);
    const encrypted = encryptCredentialPlaintext(plaintext, env);
    const updatedAt = new Date().toISOString();

    const resp = await fetchImpl(
        `${supabaseUrl}/rest/v1/provider_credentials?on_conflict=provider_id`,
        {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify({
                provider_id: providerId,
                ...encrypted,
                updated_at: updatedAt
            })
        }
    );

    if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Gagal menyimpan kredensial terenkripsi (${resp.status}): ${errText.slice(0, 160)}`);
    }

    return { updatedAt };
}

export async function loadOpusClipRestConfig(env = {}, { fetchImpl = globalThis.fetch } = {}) {
    const dbCred = await readProviderCredentialPlaintext(env, OPUSCLIP_REST_PROVIDER_ID, fetchImpl);
    let apiKey = "";
    let orgId = String(env.OPUSCLIP_ORG_ID || "").trim();
    let source = "none";

    if (dbCred.plaintext) {
        source = "supabase_vault";
        if (dbCred.plaintext.startsWith("{")) {
            try {
                const parsed = JSON.parse(dbCred.plaintext);
                apiKey = String(parsed.apiKey || parsed.api_key || "").trim();
                if (parsed.orgId || parsed.org_id) {
                    orgId = String(parsed.orgId || parsed.org_id).trim();
                }
            } catch {
                apiKey = dbCred.plaintext;
            }
        } else {
            apiKey = dbCred.plaintext;
        }
    }

    if (!apiKey) {
        const envKey = String(env.OPUSCLIP_API_KEY || "").trim();
        if (envKey) {
            apiKey = envKey;
            source = "worker_env";
        }
    }

    return {
        configured: Boolean(apiKey),
        apiKey,
        orgId,
        source,
        maskedKey: maskSecretPreview(apiKey),
        updatedAt: dbCred.updatedAt,
        baseUrl: String(env.OPUSCLIP_API_BASE || "https://api.opus.pro/api").trim()
    };
}

export async function saveOpusClipRestConfig(env, { apiKey, orgId = "" } = {}, { fetchImpl = globalThis.fetch } = {}) {
    const cleanKey = String(apiKey || "").trim().replace(/^Bearer\s+/i, "").trim();
    if (!cleanKey || cleanKey.length < 8) {
        const err = new Error("OPUSCLIP_API_KEY tidak valid atau terlalu pendek.");
        err.status = 400;
        throw err;
    }
    const cleanOrg = String(orgId || "").trim();
    const payload = JSON.stringify({
        apiKey: cleanKey,
        ...(cleanOrg ? { orgId: cleanOrg } : {})
    });

    const saved = await saveProviderCredentialPlaintext(env, {
        providerId: OPUSCLIP_REST_PROVIDER_ID,
        providerName: "OpusClip API & MCP",
        description: "OpusClip Core REST API Key (api.opus.pro) terenkripsi AES-256-GCM.",
        plaintext: payload,
        fetchImpl
    });

    return {
        configured: true,
        maskedKey: maskSecretPreview(cleanKey),
        orgId: cleanOrg || null,
        updatedAt: saved.updatedAt
    };
}

export async function loadOpusClipMcpCredential(env = {}, { fetchImpl = globalThis.fetch } = {}) {
    const dbCred = await readProviderCredentialPlaintext(env, OPUSCLIP_MCP_PROVIDER_ID, fetchImpl);
    let rawToken = dbCred.plaintext;
    let source = rawToken ? "supabase_vault" : "none";

    if (!rawToken) {
        const envToken = String(
            env.OPUSCLIP_MCP_AUTH_TOKEN || env.OPUS_MCP_UNDERSTANDING_TOKEN || ""
        ).trim();
        if (envToken) {
            rawToken = envToken;
            source = "worker_env";
        }
    }

    const parsed = parseOpusClipMcpAuthConfig(rawToken);
    return {
        configured: Boolean(rawToken),
        rawCredential: rawToken,
        source,
        updatedAt: dbCred.updatedAt,
        hasRefreshToken: Boolean(parsed?.refreshToken),
        mcpUrl: parsed?.mcpUrl || String(env.OPUSCLIP_MCP_URL || "https://mcp.opus.pro/mcp").trim()
    };
}

export async function saveOpusClipMcpCredential(env, { rawToken } = {}, { fetchImpl = globalThis.fetch } = {}) {
    const cleanRaw = String(rawToken || "").trim();
    if (!cleanRaw || cleanRaw.length < 10) {
        const err = new Error("Token OAuth JSON mcp.opus.pro tidak boleh kosong.");
        err.status = 400;
        throw err;
    }

    const parsed = parseOpusClipMcpAuthConfig(cleanRaw);
    if (!parsed || (!parsed.accessToken && !parsed.refreshToken)) {
        const err = new Error("Format token OAuth mcp.opus.pro tidak dikenali. Tempel JSON hasil tombol Salin Token.");
        err.status = 400;
        throw err;
    }

    const saved = await saveProviderCredentialPlaintext(env, {
        providerId: OPUSCLIP_MCP_PROVIDER_ID,
        providerName: "OpusClip Video Understanding MCP",
        description: "Token OAuth PKCE https://mcp.opus.pro/mcp untuk Deep Video Understanding.",
        plaintext: cleanRaw,
        fetchImpl
    });

    /* Warm & upsert ke opus_oauth_tokens (strictly upsert, TIDAK PERNAH DELETE baris) */
    let seedHash = null;
    if (parsed.type === "oauth" && parsed.refreshToken && parsed.clientId) {
        try {
            const resolved = await resolveOpusOAuthTokenWithVault({
                env,
                tokenEndpoint: parsed.tokenEndpoint,
                clientId: parsed.clientId,
                clientSecret: parsed.clientSecret,
                resource: parsed.resource || "https://mcp.opus.pro/mcp",
                scope: parsed.scope,
                accessToken: parsed.accessToken,
                refreshToken: parsed.refreshToken,
                expiresAtMs: parsed.expiresAtMs,
                forceRefresh: false
            });
            seedHash = resolved?.seedHash || null;
        } catch {
            /* non-fatal during save */
        }
    }

    return {
        configured: true,
        hasRefreshToken: Boolean(parsed.refreshToken),
        mcpUrl: parsed.mcpUrl,
        seedHash,
        updatedAt: saved.updatedAt
    };
}
