/* OpenClips REST API: tokens belong in X-Auth-Token, never MCP Bearer auth. */
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
                // Do not echo upstream bodies: they may contain credential material.
                const error = new Error(`OpenClips REST HTTP ${response.status}${response.status === 401 ? ": token API ditolak (X-Auth-Token)." : "."}`);
                error.status = response.status;
                error.code = response.status === 401 ? "OPENCLIPS_AUTH_FAILED" : "OPENCLIPS_REST_ERROR";
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
