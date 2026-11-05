/*
 * =========================================================
 * GEN-Z.AI — ANTI PROXY CHECK
 * Endpoint: GET /api/anti-proxy-check
 * Dipakai guard client untuk test koneksi lewat proxy.
 * =========================================================
 */
import { buildProxyResponse, detectProxy } from "../lib/anti-proxy/detect.js";

export default async function handler(req, res) {
    const probe = detectProxy(req);
    if (probe.blocked) {
        const built = buildProxyResponse(probe.reasonText);
        res.setHeader("X-Proxy-Detected", "1");
        res.setHeader("X-Proxy-Reason", probe.reasonText.slice(0, 120));
        return res.status(built.status).json(JSON.parse(built.body));
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Proxy-Detected", "0");
    return res.status(200).json({ ok: true, proxy: false });
}
