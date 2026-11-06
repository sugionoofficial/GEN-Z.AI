/*
 * GEN-Z.AI — OpenClips MCP Streamable HTTP client
 *
 * Transport-only module. Provider credentials, tool argument mapping and
 * generation orchestration live in separate modules so they can be tested
 * without contacting the live OpenClips service.
 */

export const DEFAULT_OPENCLIPS_MCP_URL = "https://mcp.openclips.ai";
export const OPENCLIPS_MCP_PROTOCOL_VERSION = "2025-03-26";
const DEFAULT_TIMEOUT_MS = 45_000;

function cleanString(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

export function normalizeOpenClipsMcpUrl(value) {
    const raw = cleanString(value) || DEFAULT_OPENCLIPS_MCP_URL;
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("OpenClips MCP URL harus memakai HTTP(S).");
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
}

function parseJsonSafe(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export function parseOpenClipsMcpResponse(text, contentType = "") {
    const raw = cleanString(text);
    if (!raw) return null;

    const direct = parseJsonSafe(raw);
    if (direct) return direct;

    if (!/text\/event-stream/i.test(String(contentType || "")) && !/^event:|^data:/m.test(raw)) {
        return null;
    }

    const messages = [];
    for (const line of raw.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const parsed = parseJsonSafe(data);
        if (parsed) messages.push(parsed);
    }
    return messages.length ? messages[messages.length - 1] : null;
}

export function unwrapOpenClipsToolPayload(result) {
    if (!result || typeof result !== "object") return result;
    if (result.structuredContent !== undefined && result.structuredContent !== null) {
        const structured = result.structuredContent;
        if (
            structured &&
            typeof structured === "object" &&
            !Array.isArray(structured) &&
            Object.keys(structured).length === 1 &&
            Object.prototype.hasOwnProperty.call(structured, "result")
        ) {
            return structured.result;
        }
        return structured;
    }

    const content = Array.isArray(result.content) ? result.content : [];
    const parsedItems = [];
    for (const item of content) {
        if (item?.type !== "text") continue;
        const text = cleanString(item.text);
        if (!text) continue;
        const parsed = parseJsonSafe(text);
        parsedItems.push(parsed === null ? text : parsed);
    }
    if (parsedItems.length === 1) return parsedItems[0];
    if (parsedItems.length > 1) return parsedItems;
    return result;
}

function toolErrorText(result) {
    const content = Array.isArray(result?.content) ? result.content : [];
    return content
        .filter(item => item?.type === "text")
        .map(item => cleanString(item.text))
        .filter(Boolean)
        .join("\n") || "OpenClips MCP mengembalikan tool error.";
}

function makeHttpError(status, message, data = null) {
    const error = new Error(message);
    error.status = Number(status) || 0;
    if (data !== null) error.data = data;
    return error;
}

export class OpenClipsMcpClient {
    constructor({
        url = DEFAULT_OPENCLIPS_MCP_URL,
        accessToken,
        fetchImpl = globalThis.fetch,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        protocolVersion = OPENCLIPS_MCP_PROTOCOL_VERSION
    } = {}) {
        if (typeof fetchImpl !== "function") {
            throw new Error("Fetch implementation untuk OpenClips MCP tidak tersedia.");
        }
        this.baseUrl = normalizeOpenClipsMcpUrl(url);
        this.accessToken = cleanString(accessToken).replace(/^Bearer\s+/i, "");
        this.fetchImpl = fetchImpl;
        this.timeoutMs = Math.max(1_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
        this.protocolVersion = protocolVersion;
        this.sessionId = "";
        this.requestId = 0;
        this.initialized = false;
        this.initializePromise = null;
        this.toolsPromise = null;
        this.endpointUrl = this.baseUrl;
    }

    endpointCandidates() {
        const candidates = [this.endpointUrl || this.baseUrl];
        const isDefaultHost = /^https:\/\/mcp\.openclips\.ai(?:\/mcp)?$/i.test(this.baseUrl);
        if (isDefaultHost) {
            const alternate = /\/mcp$/i.test(this.baseUrl)
                ? this.baseUrl.replace(/\/mcp$/i, "")
                : `${this.baseUrl}/mcp`;
            if (!candidates.includes(alternate)) candidates.push(alternate);
        }
        return candidates;
    }

    async post(message, { notification = false, allowEndpointFallback = true } = {}) {
        const candidates = this.endpointCandidates();
        let lastError = null;

        for (let index = 0; index < candidates.length; index += 1) {
            const endpoint = candidates[index];
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                const headers = {
                    Accept: "application/json, text/event-stream",
                    "Content-Type": "application/json",
                    "MCP-Protocol-Version": this.protocolVersion
                };
                if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
                if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

                const response = await this.fetchImpl(endpoint, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(message),
                    signal: controller.signal
                });
                const responseText = await response.text();
                const sessionId = cleanString(response.headers?.get?.("mcp-session-id"));
                if (sessionId) this.sessionId = sessionId;

                if ((response.status === 404 || response.status === 405) && allowEndpointFallback && index < candidates.length - 1) {
                    lastError = makeHttpError(response.status, `OpenClips MCP endpoint HTTP ${response.status}.`);
                    continue;
                }

                this.endpointUrl = endpoint;
                if (!response.ok) {
                    const parsed = parseOpenClipsMcpResponse(responseText, response.headers?.get?.("content-type"));
                    const detail = cleanString(
                        parsed?.error?.message || parsed?.message || responseText.slice(0, 500)
                    );
                    const error = makeHttpError(
                        response.status,
                        `OpenClips MCP HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
                        parsed || responseText.slice(0, 500)
                    );
                    if (response.status === 401) error.code = "OPENCLIPS_AUTH_FAILED";
                    throw error;
                }

                if (notification && !responseText) return null;
                const parsed = parseOpenClipsMcpResponse(responseText, response.headers?.get?.("content-type"));
                if (!parsed) {
                    if (notification) return null;
                    throw new Error("Respons OpenClips MCP bukan JSON-RPC/SSE yang valid.");
                }
                return parsed;
            } catch (error) {
                if (error?.name === "AbortError") {
                    throw makeHttpError(408, `OpenClips MCP timeout setelah ${this.timeoutMs} ms.`);
                }
                throw error;
            } finally {
                clearTimeout(timer);
            }
        }
        throw lastError || new Error("OpenClips MCP endpoint tidak tersedia.");
    }

    async initialize() {
        if (this.initialized) return null;
        if (this.initializePromise) return this.initializePromise;
        this.initializePromise = (async () => {
            const id = ++this.requestId;
            const response = await this.post({
                jsonrpc: "2.0",
                id,
                method: "initialize",
                params: {
                    protocolVersion: this.protocolVersion,
                    capabilities: {},
                    clientInfo: { name: "genz-ai-openclips-provider", version: "1.0.0" }
                }
            }, { allowEndpointFallback: true });
            if (response?.error) {
                throw new Error(cleanString(response.error.message) || "Inisialisasi OpenClips MCP gagal.");
            }
            const serverProtocol = cleanString(response?.result?.protocolVersion);
            if (serverProtocol) this.protocolVersion = serverProtocol;
            await this.post({
                jsonrpc: "2.0",
                method: "notifications/initialized"
            }, { notification: true, allowEndpointFallback: false });
            this.initialized = true;
            return response?.result || null;
        })();
        try {
            return await this.initializePromise;
        } catch (error) {
            this.initializePromise = null;
            throw error;
        }
    }

    async request(method, params = {}) {
        await this.initialize();
        const id = ++this.requestId;
        const response = await this.post({
            jsonrpc: "2.0",
            id,
            method,
            params
        }, { allowEndpointFallback: false });
        if (response?.error) {
            const error = new Error(cleanString(response.error.message) || `OpenClips MCP ${method} gagal.`);
            error.code = cleanString(response.error.data?.code || response.error.code) || "OPENCLIPS_MCP_ERROR";
            error.data = response.error.data ?? response.error;
            if (Number(response.error.code) === -32001 || /\b401\b|unauthori[sz]ed|invalid.*token|authentication/i.test(error.message)) {
                error.status = 401;
            }
            throw error;
        }
        return response?.result;
    }

    async listTools({ force = false } = {}) {
        if (!force && this.toolsPromise) return this.toolsPromise;
        this.toolsPromise = (async () => {
            const tools = [];
            let cursor = "";
            do {
                const result = await this.request("tools/list", cursor ? { cursor } : {});
                if (Array.isArray(result?.tools)) tools.push(...result.tools);
                cursor = cleanString(result?.nextCursor);
            } while (cursor);
            return tools;
        })();
        try {
            return await this.toolsPromise;
        } catch (error) {
            this.toolsPromise = null;
            throw error;
        }
    }

    async callTool(name, args = {}) {
        const result = await this.request("tools/call", { name, arguments: args });
        if (result?.isError) {
            const message = toolErrorText(result);
            const error = new Error(message);
            error.code = "OPENCLIPS_TOOL_ERROR";
            error.data = unwrapOpenClipsToolPayload(result);
            if (/\b401\b|unauthori[sz]ed|invalid[_ ]?token|authentication(?:\s+required|\s+failed)/i.test(message)) {
                error.status = 401;
                error.code = "OPENCLIPS_AUTH_FAILED";
            } else if (/\b402\b|insufficient|not enough|token.limit|balance/i.test(message)) {
                error.status = 402;
            }
            throw error;
        }
        return unwrapOpenClipsToolPayload(result);
    }
}

export default OpenClipsMcpClient;
