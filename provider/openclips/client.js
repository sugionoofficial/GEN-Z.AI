/* OpenClips marketplace: REST for API keys, MCP for OAuth bundles. */

import { OpenClipsRestClient } from "./rest-client.js";
import {
    DEFAULT_OPENCLIPS_MCP_URL,
    OpenClipsMcpClient,
    normalizeOpenClipsMcpUrl
} from "./mcp-client.js";
import {
    describeOpenClipsCredential,
    resolveOpenClipsAccessToken,
    selectOpenClipsCredential
} from "./credentials.js";
import {
    buildOpenClipsCallApiArgs,
    buildOpenClipsCreativeArgs,
    buildOpenClipsGenerationArgs,
    buildOpenClipsMarketplaceModelsArgs,
    findOpenClipsTool,
    openClipsSchemaAcceptsModel
} from "./tool-schema.js";

export const OPENCLIPS_PROVIDER_ID = "openclips";
export const OPENCLIPS_PROVIDER_NAME = "OpenClips";
export { DEFAULT_OPENCLIPS_MCP_URL };

const MARKETPLACE_GENERATE_TOOL = "generate_marketplace_proxy";
const MARKETPLACE_MODELS_TOOL = "marketplace_models";
const CALL_API_TOOL = "call_api";
const LIST_WORKSPACES_TOOL = "list_my_workspaces";
const GET_CREATIVE_TOOL = "get_creative";
const TASK_PREFIX = "openclips:v1";

function cleanString(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unwrapData(payload) {
    let current = payload;
    for (let depth = 0; depth < 6; depth += 1) {
        if (!current || typeof current !== "object" || Array.isArray(current)) break;
        if (current.creative && typeof current.creative === "object") {
            current = current.creative;
            continue;
        }
        if (current.generatedCreative && typeof current.generatedCreative === "object") {
            current = current.generatedCreative;
            continue;
        }
        if (current.data && typeof current.data === "object" && !Array.isArray(current.data)) {
            current = current.data;
            continue;
        }
        if (current.result && typeof current.result === "object" && !Array.isArray(current.result)) {
            current = current.result;
            continue;
        }
        break;
    }
    return current;
}

function findArray(payload, keys, depth = 0) {
    if (depth > 6 || !payload || typeof payload !== "object") return null;
    if (Array.isArray(payload)) return payload;
    for (const key of keys) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    for (const key of ["result", "data", "structuredContent"]) {
        if (payload?.[key] && typeof payload[key] === "object") {
            const found = findArray(payload[key], keys, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

function normalizeWorkspace(row) {
    const item = unwrapData(row);
    const id = cleanString(item?.id ?? item?.workspaceId ?? item?.workspace_id);
    if (!id) return null;
    return {
        id,
        name: cleanString(item?.name ?? item?.workspaceName ?? item?.workspace_name) || `Workspace ${id}`,
        raw: item
    };
}

function marketplacePath(workspaceId, suffix = "") {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/generated_creatives/generate/marketplace_proxy/${suffix}`;
}

function creativePath(workspaceId, creativeId) {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/generated_creatives/${encodeURIComponent(creativeId)}/`;
}

function isAuthError(error) {
    const text = `${error?.code || ""} ${error?.message || ""}`;
    return Number(error?.status) === 401 ||
        error?.code === "OPENCLIPS_AUTH_FAILED" ||
        /\b401\b|unauthori[sz]ed|invalid[_ ]?token|authentication(?:\s+required|\s+failed)/i.test(text);
}

function isInsufficientBalanceError(error) {
    const text = `${error?.code || ""} ${error?.message || ""} ${JSON.stringify(error?.data || "")}`.toLowerCase();
    return Number(error?.status) === 402 || /insufficient|not enough|token.limit|balance|saldo/.test(text);
}

async function withOpenClipsClient(entry, options, operation) {
    const env = options.env || null;
    const description = describeOpenClipsCredential(entry, env);
    const transport = options.transport || (description.refreshToken || description.clientId || entry.bundle?.access_token || entry.bundle?.accessToken ? "mcp" : "rest");
    if (transport === "rest") {
        if (!description.accessToken) throw new Error("Token API OpenClips kosong.");
        const client = new OpenClipsRestClient({
            accessToken: description.accessToken,
            fetchImpl: options.fetchImpl || globalThis.fetch,
            timeoutMs: options.timeoutMs
        });
        return await operation(client, description);
    }
    const mcpUrl = normalizeOpenClipsMcpUrl(options.mcpUrl || description.mcpUrl || DEFAULT_OPENCLIPS_MCP_URL);
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const resolved = await resolveOpenClipsAccessToken(entry, {
            env,
            forceRefresh: attempt > 0
        });
        const client = new OpenClipsMcpClient({
            url: mcpUrl,
            accessToken: resolved.accessToken,
            fetchImpl: options.fetchImpl || globalThis.fetch,
            timeoutMs: options.timeoutMs
        });
        try {
            return await operation(client, resolved);
        } catch (error) {
            lastError = error;
            if (attempt === 0 && isAuthError(error) && resolved.canRefresh) continue;
            throw error;
        }
    }
    throw lastError;
}

async function listWorkspaces(client, tools) {
    if (client.transport === "rest") {
        const payload = await client.request("GET", "/api/workspaces/");
        return (findArray(payload, ["workspaces", "items", "results", "data"]) || []).map(normalizeWorkspace).filter(Boolean);
    }
    const tool = findOpenClipsTool(tools, LIST_WORKSPACES_TOOL);
    if (!tool) {
        const error = new Error("Tool OpenClips list_my_workspaces tidak tersedia pada server MCP.");
        error.code = "OPENCLIPS_TOOL_UNAVAILABLE";
        throw error;
    }
    const payload = await client.callTool(tool.name, {});
    const rows = findArray(payload, ["workspaces", "items", "results", "data"]) || [];
    return rows.map(normalizeWorkspace).filter(Boolean);
}

async function resolveWorkspace(client, tools, configuredWorkspaceId) {
    const workspaces = await listWorkspaces(client, tools);
    const configured = cleanString(configuredWorkspaceId);
    if (configured) {
        const selected = workspaces.find(workspace => workspace.id === configured);
        if (selected) return selected;
        /* A configured id remains usable when a server intentionally omits the
           workspace list from a scoped token. Generation will still authorize it. */
        if (!workspaces.length) return { id: configured, name: `Workspace ${configured}` };
        const error = new Error(`OPENCLIPS_WORKSPACE_ID "${configured}" tidak ditemukan pada akun ini.`);
        error.code = "OPENCLIPS_WORKSPACE_NOT_FOUND";
        error.data = { availableWorkspaces: workspaces.map(({ id, name }) => ({ id, name })) };
        throw error;
    }
    if (workspaces.length === 1) return workspaces[0];
    const error = new Error(
        workspaces.length
            ? "Akun OpenClips memiliki beberapa workspace. Set OPENCLIPS_WORKSPACE_ID atau workspace_id pada JSON credential."
            : "Tidak ada workspace OpenClips yang dapat digunakan oleh credential ini."
    );
    error.code = workspaces.length ? "OPENCLIPS_WORKSPACE_REQUIRED" : "OPENCLIPS_WORKSPACE_NOT_FOUND";
    error.data = { availableWorkspaces: workspaces.map(({ id, name }) => ({ id, name })) };
    throw error;
}

async function readModelContract(client, tools, { workspaceId, model, mediaType }) {
    const tool = findOpenClipsTool(tools, MARKETPLACE_MODELS_TOOL);
    if (!tool) return null;
    const args = buildOpenClipsMarketplaceModelsArgs(tool, { workspaceId, model, mediaType });
    return await client.callTool(tool.name, args);
}

async function previewMarketplaceCost(client, tools, workspaceId, body) {
    const tool = client.transport === "rest" ? null : findOpenClipsTool(tools, CALL_API_TOOL);
    if (!tool && client.transport !== "rest") {
        const error = new Error("Tool OpenClips call_api diperlukan untuk preview_cost sebelum generation.");
        error.code = "OPENCLIPS_PREVIEW_UNAVAILABLE";
        throw error;
    }
    const path = marketplacePath(workspaceId, "preview_cost/");
    const args = client.transport === "rest" ? null : buildOpenClipsCallApiArgs(tool, {
        method: "POST",
        path,
        body,
        workspaceId
    });
    const preview = client.transport === "rest" ? await client.request("POST", path, body) : await client.callTool(tool.name, args);
    const data = asObject(unwrapData(preview));
    if (data.sufficient === false || data.sufficient === "false") {
        const error = new Error("Saldo credit OpenClips tidak cukup untuk request ini. Generation tidak dikirim.");
        error.code = "OPENCLIPS_INSUFFICIENT_BALANCE";
        error.status = 402;
        error.data = preview;
        throw error;
    }
    if (client.transport === "rest" && data.sufficient !== true) {
        const error = new Error("Preview biaya REST OpenClips tidak memberikan konfirmasi saldo cukup. Generation tidak dikirim.");
        error.code = "OPENCLIPS_PREVIEW_INVALID";
        throw error;
    }
    return preview;
}

async function generateMarketplace(client, tools, workspaceId, body) {
    if (client.transport === "rest") return await client.request("POST", marketplacePath(workspaceId), body);
    const directTool = findOpenClipsTool(tools, MARKETPLACE_GENERATE_TOOL);
    if (directTool) {
        if (!openClipsSchemaAcceptsModel(directTool, body.model)) {
            const error = new Error(`Model "${body.model}" tidak diterima oleh schema live ${MARKETPLACE_GENERATE_TOOL}.`);
            error.code = "OPENCLIPS_MODEL_NOT_SUPPORTED";
            error.status = 422;
            throw error;
        }
        const args = buildOpenClipsGenerationArgs(directTool, { workspaceId, body });
        return await client.callTool(directTool.name, args);
    }

    /* Documented OpenAPI route remains available through MCP on reduced tool
       surfaces. This is not a direct REST call from GEN-Z.AI. */
    const callApiTool = findOpenClipsTool(tools, CALL_API_TOOL);
    if (!callApiTool) {
        const error = new Error("OpenClips MCP tidak menyediakan generate_marketplace_proxy atau call_api.");
        error.code = "OPENCLIPS_GENERATION_TOOL_UNAVAILABLE";
        throw error;
    }
    const args = buildOpenClipsCallApiArgs(callApiTool, {
        method: "POST",
        path: marketplacePath(workspaceId),
        body,
        workspaceId
    });
    return await client.callTool(callApiTool.name, args);
}

function extractCreativeId(payload) {
    const direct = unwrapData(payload);
    const candidates = [
        direct?.id,
        direct?.creativeId,
        direct?.creative_id,
        direct?.generatedCreativeId,
        direct?.generated_creative_id,
        payload?.creativeId,
        payload?.creative_id,
        payload?.id
    ];
    for (const candidate of candidates) {
        const value = cleanString(candidate);
        if (value && /^\d+$/.test(value)) return value;
    }
    const progress = findArray(payload, ["generationProgress", "generation_progress", "creatives"]);
    if (progress?.length) return extractCreativeId(progress[0]);
    return "";
}

export function createOpenClipsTaskId({ workspaceId, creativeId, keySlot = 0, transport = "mcp" }) {
    return `${transport === "rest" ? "openclips:v2" : TASK_PREFIX}:${encodeURIComponent(workspaceId)}:${encodeURIComponent(creativeId)}:${Number(keySlot) || 0}`;
}

export function parseOpenClipsTaskId(taskId) {
    const raw = cleanString(taskId);
    const parts = raw.split(":");
    if (parts.length !== 5 || parts[0] !== "openclips" || !["v1", "v2"].includes(parts[1])) {
        const error = new Error("Task ID OpenClips tidak valid.");
        error.code = "OPENCLIPS_TASK_ID_INVALID";
        throw error;
    }
    const workspaceId = cleanString(decodeURIComponent(parts[2]));
    const creativeId = cleanString(decodeURIComponent(parts[3]));
    const keySlot = Number(parts[4]);
    if (!workspaceId || !creativeId || !Number.isInteger(keySlot) || keySlot < 0) {
        const error = new Error("Task ID OpenClips tidak lengkap.");
        error.code = "OPENCLIPS_TASK_ID_INVALID";
        throw error;
    }
    return { workspaceId, creativeId, keySlot, ...(parts[1] === "v2" ? { transport: "rest" } : {}) };
}

function findMediaUrl(payload, mediaType) {
    const item = unwrapData(payload);
    const keys = mediaType === "image"
        ? ["imageUrl", "image_url"]
        : ["videoUrl", "video_url"];
    for (const key of keys) {
        const value = cleanString(item?.[key]);
        if (/^https?:\/\//i.test(value)) return value;
    }
    const mediaKind = cleanString(item?.mediaKind || item?.media_kind).toLowerCase();
    const genericUrl = cleanString(item?.url);
    if (mediaKind === mediaType && /^https?:\/\//i.test(genericUrl)) return genericUrl;
    return "";
}

export function normalizeOpenClipsStatus(payload, mediaType = "video") {
    const item = asObject(unwrapData(payload));
    const rawStatus = cleanString(
        item.actionStatus || item.action_status || item.status || item.state || payload?.status
    ).toLowerCase();
    const outputUrl = findMediaUrl(payload, mediaType);
    const outputUrls = outputUrl ? [outputUrl] : [];
    const errorCode = cleanString(item.errorCode || item.error_code || item.code) || null;
    const errorMessage = cleanString(
        item.errorMessage || item.error_message || (typeof item.error === "string" ? item.error : item.error?.message)
    ) || null;

    if (["failed", "failure", "error", "cancelled", "canceled", "rejected"].includes(rawStatus)) {
        return { status: "FAILED", outputUrls: [], errorCode, errorMessage, providerState: rawStatus };
    }
    if (rawStatus === "awaiting_approval") {
        return {
            status: "FAILED",
            outputUrls: [],
            errorCode: errorCode || "OPENCLIPS_APPROVAL_REQUIRED",
            errorMessage: errorMessage || "Creative menunggu approval di aplikasi OpenClips.",
            providerState: rawStatus
        };
    }
    if (["success", "succeeded", "done", "complete", "completed", "finished"].includes(rawStatus)) {
        if (!outputUrl) {
            return {
                status: "PROCESSING",
                outputUrls: [],
                errorCode,
                errorMessage,
                providerState: rawStatus
            };
        }
        return { status: "COMPLETED", outputUrls, errorCode, errorMessage, providerState: rawStatus };
    }
    if (outputUrl && !rawStatus) {
        return { status: "COMPLETED", outputUrls, errorCode, errorMessage, providerState: "success" };
    }
    if (outputUrl && !["queued", "pending", "processing", "running", "waiting_for_assets", "processing_unknown"].includes(rawStatus)) {
        return { status: "COMPLETED", outputUrls, errorCode, errorMessage, providerState: rawStatus || "success" };
    }
    const providerState = rawStatus || (payload?.stillProcessing ? "processing" : "queued");
    return {
        status: ["queued", "pending", "created", "waiting_for_assets"].includes(providerState) ? "QUEUED" : "PROCESSING",
        outputUrls: [],
        errorCode,
        errorMessage,
        providerState
    };
}

function normalizeTaskResult(payload, { taskId, mediaType, keySlot, keyPoolSize }) {
    const normalized = normalizeOpenClipsStatus(payload, mediaType);
    const completed = normalized.status === "COMPLETED";
    return {
        success: true,
        provider: OPENCLIPS_PROVIDER_ID,
        providerName: OPENCLIPS_PROVIDER_NAME,
        mediaType,
        taskId,
        task_id: taskId,
        id: taskId,
        status: normalized.status,
        provider_state: normalized.providerState,
        completed,
        failed: normalized.status === "FAILED",
        processing: normalized.status === "QUEUED" || normalized.status === "PROCESSING",
        outputUrls: completed ? normalized.outputUrls : [],
        output_urls: completed ? normalized.outputUrls : [],
        outputUrl: completed ? normalized.outputUrls[0] || null : null,
        keySlot,
        keyPoolSize,
        errorCode: normalized.errorCode,
        error_code: normalized.errorCode,
        errorMessage: normalized.errorMessage,
        error_message: normalized.errorMessage,
        raw: {
            status: normalized.status,
            provider_state: normalized.providerState,
            ...(completed && normalized.outputUrls.length
                ? { [mediaType === "image" ? "image_urls" : "video_urls"]: normalized.outputUrls }
                : {}),
            ...(normalized.errorCode ? { error_code: normalized.errorCode } : {}),
            ...(normalized.errorMessage ? { error_message: normalized.errorMessage } : {})
        }
    };
}

export async function createOpenClipsMarketplaceTask(payload, credential, options = {}) {
    const excluded = new Set((options.excludeKeySlots || []).map(Number));
    const initial = selectOpenClipsCredential(credential, options.keySlot || 0, options.env || null);
    let lastError = null;

    for (let index = 0; index < initial.entries.length; index += 1) {
        if (excluded.has(index)) continue;
        const entry = initial.entries[index];
        try {
            return await withOpenClipsClient(entry, options, async (client, resolvedCredential) => {
                const tools = client.transport === "rest" ? [] : await client.listTools();
                const workspace = await resolveWorkspace(client, tools, options.workspaceId || resolvedCredential.workspaceId);
                const modelContract = await readModelContract(client, tools, {
                    workspaceId: workspace.id,
                    model: payload.model,
                    mediaType: options.mediaType
                });
                const preview = await previewMarketplaceCost(client, tools, workspace.id, payload);
                const generated = await generateMarketplace(client, tools, workspace.id, payload);
                const creativeId = extractCreativeId(generated);
                if (!creativeId) {
                    const error = new Error("OpenClips tidak mengembalikan creative ID.");
                    error.code = "OPENCLIPS_CREATIVE_ID_MISSING";
                    error.data = generated;
                    throw error;
                }
                const taskId = createOpenClipsTaskId({ workspaceId: workspace.id, creativeId, keySlot: index, transport: client.transport });
                return {
                    ...normalizeTaskResult(generated, {
                        taskId,
                        mediaType: options.mediaType,
                        keySlot: index,
                        keyPoolSize: initial.entries.length
                    }),
                    jobId: taskId,
                    job_id: taskId,
                    creativeId,
                    workspaceId: workspace.id,
                    payload,
                    preview,
                    modelContractLoaded: Boolean(modelContract)
                };
            });
        } catch (error) {
            lastError = error;
            const canTryNext = index < initial.entries.length - 1 && (isAuthError(error) || isInsufficientBalanceError(error));
            if (canTryNext) continue;
            throw error;
        }
    }
    throw lastError || new Error("Tidak ada credential OpenClips yang dapat digunakan.");
}

export async function getOpenClipsMarketplaceTask(taskId, credential, options = {}) {
    const parsedId = parseOpenClipsTaskId(taskId);
    const selection = selectOpenClipsCredential(credential, parsedId.keySlot, options.env || null);
    return await withOpenClipsClient(selection.entry, { ...options, transport: parsedId.transport || "mcp" }, async client => {
        const tools = client.transport === "rest" ? [] : await client.listTools();
        const getTool = findOpenClipsTool(tools, GET_CREATIVE_TOOL);
        let payload;
        if (client.transport === "rest") {
            payload = await client.request("GET", creativePath(parsedId.workspaceId, parsedId.creativeId));
        } else if (getTool) {
            const args = buildOpenClipsCreativeArgs(getTool, parsedId);
            payload = await client.callTool(getTool.name, args);
        } else {
            const callApiTool = findOpenClipsTool(tools, CALL_API_TOOL);
            if (!callApiTool) {
                const error = new Error("OpenClips MCP tidak menyediakan get_creative atau call_api.");
                error.code = "OPENCLIPS_STATUS_TOOL_UNAVAILABLE";
                throw error;
            }
            const args = buildOpenClipsCallApiArgs(callApiTool, {
                method: "GET",
                path: creativePath(parsedId.workspaceId, parsedId.creativeId),
                workspaceId: parsedId.workspaceId
            });
            payload = await client.callTool(callApiTool.name, args);
        }
        return normalizeTaskResult(payload, {
            taskId,
            mediaType: options.mediaType,
            keySlot: selection.keySlot,
            keyPoolSize: selection.keyPoolSize
        });
    });
}

/* API credential loader hooks (kept here as a small provider-facing barrel). */
export {
    resolveOpenClipsApiKeyPoolPayload,
    resolveOpenClipsBearerToken
} from "./credentials.js";
