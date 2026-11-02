/* =========================================================
   GEN-Z.AI — PROVIDER CREDENTIAL VAULT (GENERIC)
   ---------------------------------------------------------
   File:
     lib/security/provider-credential-vault.js

   Helper netral untuk menyimpan/membaca kredensial provider
   terenkripsi AES-256-GCM di `public.provider_credentials`.
   Dipakai oleh integrasi OAuth multi-user (Facebook/YouTube/TikTok)
   tanpa bergantung pada fitur studio/pihak ketiga tertentu.
========================================================= */

import crypto from "node:crypto";

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
