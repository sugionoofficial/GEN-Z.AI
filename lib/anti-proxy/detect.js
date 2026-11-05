/*
 * =========================================================
 * GEN-Z.AI — ANTI PROXY / MITM (Reqable) DETECTOR
 * ---------------------------------------------------------
 * Dipakai di 2 tempat:
 *   - functions/worker.mjs   (Cloudflare Worker, utama)
 *   - api/*                   (fallback handler-adapter)
 * Deteksi berdasarkan header proxy + fingerprint browser.
 * =========================================================
 */

const PROXY_HEADER_NAMES = [
    "via",
    "proxy-connection",
    "proxy-authorization",
    "x-forwarded-for", // diperiksa khusus: >1 IP = chain
    "x-real-ip",
    "x-forwarded-host",
    "x-proxy",
    "x-proxy-authorization",
    "x-proxy-connection",
    "x-http-proxy",
    "x-reqable",
    "x-reqable-id",
    "x-reqable-tag",
    "x-charles",
    "x-fiddler",
    "x-mitmproxy",
    "x-insomnia",
    "forwarded", // RFC 7239
    "x-forwarded-proto",
    "x-forwarded-server",
    "x-bluecoat",
    "x-squid",
];

const PROXY_VIA_KEYWORDS = [
    "reqable",
    "charles",
    "fiddler",
    "mitmproxy",
    "mitm",
    "squid",
    "privoxy",
    "burp",
    "zap",
    "proxy",
    "tinyproxy",
    "ccproxy",
];

const SUSPICIOUS_UA_KEYWORDS = [
    "reqable",
    "charles",
    "fiddler",
    "mitmproxy",
    "postmanruntime",
    "curl/",
    "wget/",
    "python-requests",
    "python-urllib",
    "go-http-client",
    "go-http",
    "java/",
    "okhttp",
    "apache-httpclient",
    "httpclient",
    "axios/",
    "node-fetch",
    "undici",
    "insomnia",
    "httpie",
];

// origin yang sah — tambah domain kamu di sini
const ALLOWED_ORIGINS = [
    "https://genzai.genzai-f37.workers.dev",
    "https://gen-z.ai",
    "https://www.gen-z.ai",
    "https://api.gen-z.ai",
    "http://localhost:3000",
    "http://localhost:8787",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8787",
];

function normalizeHeaders(headers) {
    if (!headers) return {};
    if (headers instanceof Headers) {
        const out = {};
        for (const [k, v] of headers.entries()) out[k.toLowerCase()] = String(v);
        return out;
    }
    if (typeof headers === "object") {
        const out = {};
        for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = String(v || "");
        return out;
    }
    return {};
}

function containsKeyword(value, keywords) {
    const low = String(value || "").toLowerCase();
    return keywords.some(kw => low.includes(kw));
}

function isPrivateIp(ip) {
    const t = String(ip || "").trim();
    return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|0\.0\.0\.0|::1|fc00:|fe80:)/i.test(t);
}

export function detectProxy(request) {
    const headers = normalizeHeaders(request.headers || {});
    const method = String(request.method || "GET").toUpperCase();
    const url = (() => {
        try { return new URL(request.url); } catch { return null; }
    })();
    const pathname = url ? url.pathname : String(request.url || "");
    const isApi = pathname.startsWith("/api/");

    // Hanya enforce keras untuk /api/* — jangan ganggu asset HTML/CSS/JS
    // (asset boleh lewat proxy, tapi API tidak)
    if (!isApi) return { blocked: false };

    const reasons = [];
    let severity = "low";

    // 1) Header proxy eksplisit
    for (const name of PROXY_HEADER_NAMES) {
        const val = headers[name];
        if (!val) continue;

        // x-forwarded-for perlu cek khusus — single IP sah (Cloudflare menambah 1),
        // tapi chain >1 atau mismatch dengan cf-connecting-ip = proxy
        if (name === "x-forwarded-for") {
            const parts = String(val).split(",").map(s => s.trim()).filter(Boolean);
            const cfIp = String(headers["cf-connecting-ip"] || "").trim();
            if (parts.length > 1) {
                reasons.push(`X-Forwarded-For chain (${parts.length} hop): ${val.slice(0, 120)}`);
                severity = "high";
            } else if (parts.length === 1 && cfIp && parts[0] !== cfIp) {
                // XFF single tapi beda dari CF IP = ada hop tambahan
                // jangan langsung block medium, tapi catat
                reasons.push(`X-Forwarded-For mismatch CF IP`);
                if (severity !== "high") severity = "medium";
            }
            continue;
        }

        // via harus mengandung keyword proxy
        if (name === "via") {
            if (containsKeyword(val, PROXY_VIA_KEYWORDS) || String(val).includes(",")) {
                reasons.push(`Via: ${val.slice(0, 120)}`);
                severity = "high";
            } else if (String(val).trim()) {
                // Via apa pun sudah indikasi proxy — tandai medium
                reasons.push(`Via header present: ${val.slice(0, 80)}`);
                if (severity !== "high") severity = "medium";
            }
            continue;
        }

        // header proxy lain yang keberadaannya saja sudah cukup
        if (["proxy-connection", "proxy-authorization", "x-reqable", "x-reqable-id", "x-charles", "x-fiddler", "x-mitmproxy"].includes(name)) {
            reasons.push(`${name}: ${String(val).slice(0, 80)}`);
            severity = "high";
        } else {
            reasons.push(`${name}: ${String(val).slice(0, 80)}`);
            if (severity !== "high") severity = "medium";
        }
    }

    // 2) User-Agent aneh / kosong untuk API
    const ua = String(headers["user-agent"] || "").trim();
    if (!ua) {
        reasons.push("User-Agent kosong");
        // GET boleh tanpa UA (mis health check), tapi POST tanpa UA = pasti tool
        if (method !== "GET" && method !== "HEAD") {
            if (severity !== "high") severity = "high";
        }
    } else if (containsKeyword(ua, SUSPICIOUS_UA_KEYWORDS)) {
        reasons.push(`User-Agent mencurigakan: ${ua.slice(0, 80)}`);
        severity = "high";
    }

    // 3) Header browser wajib untuk POST /api/* — Origin/Referer + Sec-Fetch-*
    if (isApi && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        const origin = String(headers["origin"] || "").trim();
        const referer = String(headers["referer"] || "").trim();
        const secFetchSite = String(headers["sec-fetch-site"] || "").trim().toLowerCase();
        const secFetchMode = String(headers["sec-fetch-mode"] || "").trim().toLowerCase();

        // Origin/Referer harus salah satu ada dan match allowlist (jika ada)
        const originOk = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o));
        const refererOk = referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o));
        // localhost dan preview branch juga sah — longgar: cek mengandung genzai / gen-z.ai / localhost
        const looseOk = (origin || referer) && /(genzai|gen-z\.ai|localhost|127\.0\.0\.1)/i.test(origin || referer);

        if (!origin && !referer) {
            reasons.push("Origin & Referer kosong (bukan browser)");
            severity = "high";
        } else if (!originOk && !refererOk && !looseOk) {
            // origin asing — mungkin replay dari domain lain
            reasons.push(`Origin asing: ${origin || referer}`.slice(0, 120));
            if (severity !== "high") severity = "medium";
        }

        // Sec-Fetch-* hanya dikirim browser modern — tool sering tidak kirim
        if (!secFetchSite && !secFetchMode) {
            reasons.push("Sec-Fetch-* hilang (bukan browser)");
            if (severity !== "high") severity = "high";
        } else if (secFetchSite === "none" && originOk) {
            // browser normal untuk same-origin XHR adalah same-origin / same-site, bukan none
            // 'none' artinya direct navigation — aneh untuk POST API
            reasons.push(`Sec-Fetch-Site=none untuk POST API`);
            if (severity !== "high") severity = "medium";
        }
    }

    // 4) Cloudflare signals (jika ada)
    const cf = request.cf || null;
    if (cf) {
        // botManagement.score rendah = otomatis
        const score = cf.botManagement ? Number(cf.botManagement.score) : null;
        if (Number.isFinite(score) && score < 30) {
            reasons.push(`CF bot score rendah: ${score}`);
            if (severity !== "high") severity = "medium";
        }
        // ja3 hash kosong? tidak ada — lewati
        // tlsVersion null = tidak TLS (http plain) — blokir API
        if (cf.tlsVersion === "" || cf.tlsVersion === null) {
            // biasanya hanya untuk http:// — tapi API harus https
            const proto = String(headers["x-forwarded-proto"] || headers["cf-visitor"] || url?.protocol || "");
            if (/http:/i.test(proto)) {
                reasons.push("Koneksi bukan HTTPS");
                severity = "high";
            }
        }
    }

    // Keputusan: block bila high, atau >=2 medium
    const blocked = severity === "high" || reasons.length >= 2;
    return {
        blocked,
        severity,
        reasons,
        reasonText: reasons.join(" | "),
    };
}

export function buildProxyResponse(reasonText) {
    return {
        status: 403,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Proxy-Detected": "1",
            "X-Content-Type-Options": "nosniff",
        },
        body: JSON.stringify({
            success: false,
            error: "Koneksi diputus: proxy / MITM terdeteksi. Matikan Reqable/Charles/Fiddler/VPN proxy dan muat ulang halaman.",
            code: "PROXY_DETECTED",
            reason: reasonText ? reasonText.slice(0, 200) : "proxy header",
        }),
    };
}
