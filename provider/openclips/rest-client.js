/* OpenClips REST API: tokens belong in X-Auth-Token, never MCP Bearer auth. */
function requestStage(method, path) {
    if (path === "/api/workspaces/") return "workspace";
    if (path.endsWith("/preview_cost/")) return "preview";
    if (method === "POST" && path.endsWith("/marketplace_proxy/")) return "generation";
    return "polling";
}

export class OpenClipsRestClient {
    constructor({ accessToken, fetchImpl = globalThis.fetch, timeoutMs = 45000 }) {
        this.fetchImpl = fetchImpl.bind(globalThis);
        this.accessToken = accessToken;
        this.timeoutMs = Math.max(1000, Number(timeoutMs) || 45000);
        this.transport = "rest";
    }

    async request(method, path, body) {
        if (!path.startsWith("/api/") || path.includes("..") || path.includes("?")) {
            throw new Error("Path REST OpenClips tidak valid.");
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await this.fetchImpl(`https://api.openclips.ai${path}`, {
                method,
                headers: { Accept: "application/json", "Content-Type": "application/json", "X-Auth-Token": this.accessToken },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: controller.signal,
                // Workers supports manual/follow only. Never forward API tokens on redirects.
                redirect: "manual"
            });
            if (response.status >= 300 && response.status < 400) {
                // Reject before reading the body or Location, which could contain secrets.
                const error = new Error(`OpenClips REST HTTP ${response.status}: redirect ditolak demi keamanan token API.`);
                error.status = response.status;
                error.code = "OPENCLIPS_REDIRECT_REJECTED";
                throw error;
            }
            const text = await response.text();
            let payload;
            try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
            if (!response.ok) {
                // Only local labels and a documented challenge marker are exposed.
                // Never echo upstream bodies, URLs, Location, or arbitrary error codes.
                const stage = requestStage(method, path);
                const challenge = response.headers?.get?.("cf-mitigated") === "challenge";
                const html = /text\/html/i.test(response.headers?.get?.("content-type") || "");
                let detail = response.status === 401 ? "token API ditolak (X-Auth-Token)." : "request ditolak upstream.";
                if (response.status === 403) {
                    detail = challenge
                        ? "challenge keamanan Cloudflare terdeteksi; koneksi server-to-server memerlukan izin dari pengelola OpenClips."
                        : html
                            ? "akses ditolak dengan respons HTML; kemungkinan halaman blokir/gateway, belum dapat dipastikan sebagai masalah izin token."
                            : "akses ditolak. Periksa izin token API dan workspace di OpenClips; penyebab pastinya belum diketahui.";
                }
                const error = new Error(`OpenClips REST HTTP ${response.status} [${stage}]: ${detail}`);
                error.status = response.status;
                error.stage = stage;
                error.code = response.status === 401 ? "OPENCLIPS_AUTH_FAILED"
                    : response.status === 403 ? "OPENCLIPS_FORBIDDEN" : "OPENCLIPS_REST_ERROR";
                throw error;
            }
            if (!payload || typeof payload !== "object") throw new Error("Respons REST OpenClips bukan JSON yang valid.");
            return payload;
        } catch (error) {
            if (error?.name === "AbortError") {
                const timeout = new Error("OpenClips REST timeout; jangan otomatis mengirim ulang generation.");
                timeout.status = 408;
                throw timeout;
            }
            throw error;
        } finally { clearTimeout(timer); }
    }
}
