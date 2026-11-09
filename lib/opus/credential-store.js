import crypto from "node:crypto";

function config(env) {
    const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
    const secret = String(env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || env.API_KEY_ENCRYPTION_SECRET || "").trim();
    if (!url || !serviceKey || !secret) throw new Error("Konfigurasi Supabase dan PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum lengkap.");
    const key = /^[a-f0-9]{64}$/i.test(secret) ? Buffer.from(secret, "hex") : (/^[A-Za-z0-9+/]+={0,2}$/.test(secret) && Buffer.from(secret, "base64").length === 32 ? Buffer.from(secret, "base64") : crypto.createHash("sha256").update(secret).digest());
    return { url, serviceKey, key };
}
async function request(env, query, options = {}) {
    const { url, serviceKey } = config(env);
    const response = await fetch(`${url}/rest/v1/opus_credentials${query}`, { ...options, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    if (!response.ok) throw new Error("Gagal mengakses penyimpanan kredensial Opus. Pastikan tabel sudah dibuat.");
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}
export async function listOpusCredentials(env, secrets = false) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
        const select = secrets ? "id,slot,label,ciphertext,iv,tag,updated_at" : "id,slot,updated_at";
        const page = await request(env, `?select=${select}&order=slot.asc&limit=500&offset=${offset}`);
        rows.push(...page);
        if (page.length < 500) break;
    }
    if (!secrets) return rows;
    const { key } = config(env);
    return rows.map(row => {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(row.iv, "base64"));
        decipher.setAuthTag(Buffer.from(row.tag, "base64"));
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8"));
    });
}
export async function saveOpusCredential(env, { slot, credential }) {
    const number = Number(slot);
    if (!Number.isSafeInteger(number) || number < 1) throw new Error("Nomor slot tidak valid.");
    const raw = String(credential || "").trim();
    if (!raw || raw.length > 64000) throw new Error("Token kosong atau terlalu panjang.");
    let payload;
    if (raw.startsWith("{")) {
        try { payload = JSON.parse(raw); } catch { throw new Error("JSON token tidak valid."); }
        if (!payload || Array.isArray(payload) || typeof payload !== "object" ||
            !(payload.access_token || payload.accessToken || payload.auth_token || payload.authToken || payload.token || payload.refresh_token || payload.refreshToken)) {
            throw new Error("JSON harus berisi access_token atau refresh_token hasil login Opus.");
        }
    } else {
        payload = { access_token: raw };
    }
    const { key } = config(env);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    await request(env, "?on_conflict=slot", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ slot: number, label: `OPUS_AUTH_TOKEN_${number}`, ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), updated_at: new Date().toISOString() }) });
}

// Generation uses only this explicit pool; no legacy Worker or provider token fallback.
export async function loadStoredOpusPool(env) {
    const entries = await listOpusCredentials(env, true);
    if (!entries.length) throw new Error("Kredensial Opus di Supabase belum dikonfigurasi.");
    return JSON.stringify({ opus_key_pool: entries });
}
export async function deleteOpusCredential(env, id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("ID tidak valid.");
    await request(env, `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}
// Optional during rollout: legacy environment credentials continue working until the vault is configured.
export async function withStoredOpusCredentials(env) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !(env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || env.API_KEY_ENCRYPTION_SECRET)) return env;
    try {
        const credentials = await listOpusCredentials(env, true);
        if (!credentials.length) return env;
        return { ...env, OPUS_AUTH_TOKENS: JSON.stringify([...credentials, ...(env.OPUS_AUTH_TOKENS ? [env.OPUS_AUTH_TOKENS] : [])]) };
    } catch (error) {
        console.warn("[opus] Penyimpanan kredensial tidak tersedia; memakai konfigurasi lama.");
        return env;
    }
}
