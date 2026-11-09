import { resolveRuntimeEnv } from "../lib/opus/load-opus-credential.js";
import { listOpusCredentials, saveOpusCredential, deleteOpusCredential } from "../lib/opus/credential-store.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    const send = (status, body) => res.status(status).json(body);
    if (!["GET", "POST", "DELETE"].includes(req.method)) return send(405, { error: "Method tidak didukung." });
    const env = resolveRuntimeEnv(req);
    const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
    const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
    const jwt = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || "")?.[1];
    if (!jwt) return send(401, { error: "Silakan login." });
    if (!url || !key) return send(503, { error: "Supabase belum dikonfigurasi." });
    try {
        const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || key, Authorization: `Bearer ${jwt}` } });
        if (!userResponse.ok) return send(401, { error: "Sesi tidak valid." });
        const user = await userResponse.json();
        if (!user.id) return send(401, { error: "Sesi tidak valid." });
        const profile = await fetch(`${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
        if (!profile.ok) return send(503, { error: "Gagal memeriksa hak akses." });
        const rows = await profile.json();
        if (!["admin", "owner"].includes(String(rows?.[0]?.role || "").toLowerCase())) return send(403, { error: "Khusus admin atau owner." });
        if (req.method === "GET") return send(200, { credentials: await listOpusCredentials(env) });
        if (req.method === "POST") await saveOpusCredential(env, req.body || {});
        else await deleteOpusCredential(env, String(req.body?.id || ""));
        return send(200, { success: true });
    } catch (error) {
        return send(400, { error: error.message || "Permintaan gagal." });
    }
}
