/* =========================================================
   GEN-Z.AI — SHARED OPUS CREDENTIAL & AUTH LOADER
   ---------------------------------------------------------
   File:
     lib/opus/load-opus-credential.js

   Digunakan oleh:
     - `api/opus-voice-preview.js` (Preview Suara gratis ber-cache)
     - `api/opus-blackbox.js` (Panel Status Akun & Job Recovery Opus)
========================================================= */

import crypto from "node:crypto";
import {
    resolveOpusApiKeyPoolPayload,
    resolveOpusBearerToken
} from "../social-publisher/opus.js";

const OPUS_PROVIDER_UUID = "5797af7d-518b-4c49-a01d-508d555f2bd1";

export function resolveRuntimeEnv(req) {
    if (req && req.env && typeof req.env === "object") {
        return {
            ...(typeof process !== "undefined" && process?.env ? process.env : {}),
            ...req.env
        };
    }
    return typeof process !== "undefined" && process?.env ? process.env : {};
}

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
        /* invalid */
    }
    return null;
}

function deriveEncryptionKey(rawEncSecret) {
    const clean = String(rawEncSecret || "").trim();
    if (!clean) return null;
    if (/^[0-9a-fA-F]{64}$/.test(clean)) {
        return Buffer.from(clean, "hex");
    }
    try {
        const buf = Buffer.from(clean, "base64");
        if (buf.length === 32) return buf;
    } catch {
        /* fallback sha256 */
    }
    return crypto.createHash("sha256").update(clean).digest();
}

function decryptCredentialRow(row, encSecret) {
    const key = deriveEncryptionKey(encSecret);
    if (!key || key.length !== 32) return "";
    const iv = decodeCipherBuffer(row?.api_key_iv);
    const tag = decodeCipherBuffer(row?.api_key_tag);
    const ciphertext = decodeCipherBuffer(row?.api_key_ciphertext);
    if (!iv || !tag || !ciphertext) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8").trim();
}

export async function authenticateSupabaseUser(req, env, { requireAdminOrOwner = false, fetchImpl = globalThis.fetch } = {}) {
    const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const anonKey = String(env.SUPABASE_ANON_KEY || serviceKey).trim();

    if (!supabaseUrl || !serviceKey) {
        return {
            ok: false,
            status: 500,
            error: "Konfigurasi SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum lengkap."
        };
    }

    const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || "").trim();
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader);
    const jwt = bearerMatch ? bearerMatch[1].trim() : "";

    if (!jwt) {
        return {
            ok: false,
            status: 401,
            error: "Sesi login diperlukan. Silakan login terlebih dahulu."
        };
    }

    const userResp = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${jwt}`
        }
    });

    if (!userResp.ok) {
        return {
            ok: false,
            status: 401,
            error: "Sesi login kedaluwarsa atau tidak valid."
        };
    }

    const authUser = await userResp.json().catch(() => null);
    const userId = String(authUser?.id || "").trim();
    if (!userId) {
        return {
            ok: false,
            status: 401,
            error: "Identitas pengguna tidak ditemukan."
        };
    }

    let role = String(authUser?.app_metadata?.role || authUser?.user_metadata?.role || "user").toLowerCase();

    if (requireAdminOrOwner) {
        const profileResp = await fetchImpl(
            `${supabaseUrl}/rest/v1/profiles?select=id,email,role&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (profileResp.ok) {
            const rows = await profileResp.json().catch(() => []);
            const dbRole = String(rows?.[0]?.role || "").trim().toLowerCase();
            if (dbRole) role = dbRole;
        }
        if (role !== "owner" && role !== "admin") {
            return {
                ok: false,
                status: 403,
                error: "Akses ditolak. Fitur ini khusus Owner / Admin."
            };
        }
    }

    return {
        ok: true,
        user: {
            id: userId,
            email: String(authUser?.email || "").trim(),
            role
        },
        supabaseUrl,
        serviceKey
    };
}

export async function loadOpusCredentialPayload(env, { fetchImpl = globalThis.fetch } = {}) {
    const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const encSecret = String(
        env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || env.API_KEY_ENCRYPTION_SECRET || ""
    ).trim();

    let decryptedDbKey = "";

    if (supabaseUrl && serviceKey && encSecret && typeof fetchImpl === "function") {
        for (const candidateId of ["opus", OPUS_PROVIDER_UUID]) {
            try {
                const qs = new URLSearchParams({
                    select: "id,provider_id,api_key_ciphertext,api_key_iv,api_key_tag",
                    provider_id: `eq.${candidateId}`,
                    limit: "1"
                });
                const resp = await fetchImpl(`${supabaseUrl}/rest/v1/provider_credentials?${qs.toString()}`, {
                    method: "GET",
                    headers: {
                        apikey: serviceKey,
                        Authorization: `Bearer ${serviceKey}`
                    }
                });
                if (resp.ok) {
                    const rows = await resp.json().catch(() => []);
                    if (Array.isArray(rows) && rows[0]) {
                        const candidate = decryptCredentialRow(rows[0], encSecret);
                        if (candidate) {
                            decryptedDbKey = candidate;
                            break;
                        }
                    }
                }
            } catch {
                /* lanjut fallback env */
            }
        }
    }

    const poolPayload = await resolveOpusApiKeyPoolPayload(env, decryptedDbKey);
    if (poolPayload) {
        return poolPayload;
    }

    if (decryptedDbKey) {
        return decryptedDbKey;
    }

    try {
        const bearer = await resolveOpusBearerToken(env);
        if (bearer?.token) {
            return bearer.token;
        }
    } catch {
        /* lanjut ke fallback env langsung */
    }

    const directEnvKey = String(
        env.OPUS_API_KEY || env.OPUS_ACCESS_TOKEN || env.OPUS_AUTH_TOKEN || ""
    ).trim();
    if (directEnvKey) {
        return directEnvKey;
    }

    return "";
}
