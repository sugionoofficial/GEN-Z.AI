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
        const select = secrets ? "id,label,ciphertext,iv,tag,updated_at" : "id,label,updated_at";
        const page = await request(env, `?select=${select}&order=created_at.asc,id.asc&limit=500&offset=${offset}`);
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
export async function saveOpusCredential(env, { label, access_token, api_key, refresh_token, client_id }) {
    const { key } = config(env);
    const auth = String(access_token || "").trim();
    const apiKey = String(api_key || "").trim();
    const refresh = String(refresh_token || "").trim();
    if ((!auth && !apiKey && !refresh) || (auth && apiKey)) throw new Error("Isi auth token atau API key (pilih salah satu), atau refresh token.");
    if ([auth, apiKey, refresh, String(client_id || "")].some(s => s.length > 16000)) throw new Error("Kredensial terlalu panjang.");
    const payload = { access_token: auth || apiKey, refresh_token: refresh, ...(client_id ? { client_id: String(client_id).trim() } : {}) };
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    await request(env, "", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ label: String(label || "Akun Opus").trim().slice(0, 100), ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") }) });
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
