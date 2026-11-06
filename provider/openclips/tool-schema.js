/* Pure helpers for mapping GEN-Z.AI requests onto live OpenClips MCP schemas. */

function cleanString(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

function normalizedKey(value) {
    return cleanString(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findOpenClipsTool(tools, name) {
    const target = cleanString(name).toLowerCase();
    return (Array.isArray(tools) ? tools : []).find(tool => {
        const candidate = cleanString(tool?.name).toLowerCase();
        return candidate === target || candidate.endsWith(`__${target}`) || candidate.endsWith(`:${target}`);
    }) || null;
}

function dereferenceSchema(schema, rootSchema, seen = new Set()) {
    if (!schema || typeof schema !== "object") return {};
    const ref = cleanString(schema.$ref);
    if (!ref.startsWith("#/")) return schema;
    if (seen.has(ref)) return {};
    seen.add(ref);
    let current = rootSchema;
    for (const part of ref.slice(2).split("/")) {
        current = current?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    }
    const resolved = dereferenceSchema(current, rootSchema, seen);
    return { ...resolved, ...Object.fromEntries(Object.entries(schema).filter(([key]) => key !== "$ref")) };
}

function mergeSchemas(schemas) {
    return schemas.reduce((merged, schema) => ({
        ...merged,
        ...schema,
        properties: { ...(merged?.properties || {}), ...(schema?.properties || {}) },
        required: [...new Set([...(merged?.required || []), ...(schema?.required || [])])]
    }), {});
}

function modelConst(schema, rootSchema) {
    const resolved = dereferenceSchema(schema, rootSchema);
    const model = resolved?.properties?.model;
    const resolvedModel = dereferenceSchema(model, rootSchema);
    return cleanString(resolvedModel?.const || resolvedModel?.enum?.[0]);
}

export function resolveOpenClipsModelSchema(schema, model, rootSchema = schema) {
    const resolved = dereferenceSchema(schema, rootSchema);
    if (!resolved || typeof resolved !== "object") return {};

    const allOf = Array.isArray(resolved.allOf)
        ? resolved.allOf.map(item => resolveOpenClipsModelSchema(item, model, rootSchema))
        : [];
    const own = { ...resolved };
    delete own.allOf;
    delete own.oneOf;
    delete own.anyOf;
    const base = allOf.length ? mergeSchemas([own, ...allOf]) : own;

    const branches = [...(resolved.oneOf || []), ...(resolved.anyOf || [])];
    if (!branches.length) return base;
    const target = cleanString(model);
    const matching = branches.filter(branch => modelConst(branch, rootSchema) === target);
    const withoutOtherModel = branches.filter(branch => !modelConst(branch, rootSchema));
    const selected = matching.length ? matching : withoutOtherModel;
    if (!selected.length) return base;
    return mergeSchemas([
        base,
        ...selected.map(branch => resolveOpenClipsModelSchema(branch, model, rootSchema))
    ]);
}

function schemaProperties(schema, rootSchema) {
    return dereferenceSchema(schema, rootSchema)?.properties || {};
}

function findProperty(schema, aliases, rootSchema = schema) {
    const properties = schemaProperties(schema, rootSchema);
    const entries = Object.entries(properties);
    for (const alias of aliases) {
        const target = normalizedKey(alias);
        const found = entries.find(([key]) => normalizedKey(key) === target);
        if (found) return found;
    }
    return null;
}

function hasPropertyDeep(schema, aliases, rootSchema = schema, depth = 0) {
    if (!schema || depth > 6) return false;
    const resolved = dereferenceSchema(schema, rootSchema);
    if (findProperty(resolved, aliases, rootSchema)) return true;
    for (const key of ["oneOf", "anyOf", "allOf"]) {
        if (Array.isArray(resolved?.[key]) && resolved[key].some(item => hasPropertyDeep(item, aliases, rootSchema, depth + 1))) {
            return true;
        }
    }
    for (const value of Object.values(schemaProperties(resolved, rootSchema))) {
        if (value && typeof value === "object" && hasPropertyDeep(value, aliases, rootSchema, depth + 1)) return true;
    }
    return false;
}

function schemaHasType(schema, rootSchema, expectedType, depth = 0) {
    if (!schema || depth > 6) return false;
    const resolved = dereferenceSchema(schema, rootSchema);
    const types = Array.isArray(resolved?.type) ? resolved.type : [resolved?.type];
    if (types.includes(expectedType)) return true;
    for (const keyword of ["anyOf", "oneOf", "allOf"]) {
        if ((resolved?.[keyword] || []).some(branch => schemaHasType(branch, rootSchema, expectedType, depth + 1))) {
            return true;
        }
    }
    return false;
}

function coerceValueForSchema(value, propertySchema, rootSchema) {
    if (typeof value !== "string" || !value.trim()) return value;
    const isInteger = schemaHasType(propertySchema, rootSchema, "integer");
    const isNumber = isInteger || schemaHasType(propertySchema, rootSchema, "number");
    if (!isNumber) return value;
    const number = Number(value);
    if (!Number.isFinite(number) || (isInteger && !Number.isSafeInteger(number))) return value;
    return number;
}

function setKnownProperty(target, schema, aliases, value, rootSchema) {
    if (value === undefined || value === null || value === "") return false;
    const found = findProperty(schema, aliases, rootSchema);
    if (!found) return false;
    target[found[0]] = coerceValueForSchema(value, found[1], rootSchema);
    return true;
}

const WORKSPACE_FIELDS = ["workspaceId", "workspace_id", "workspace"];
const BODY_FIELDS = ["body", "request", "payload", "data", "requestBody", "request_body", "input"];
const MODEL_FIELDS = ["model", "modelId", "model_id", "modelSlug", "model_slug"];

export function buildOpenClipsGenerationArgs(toolOrSchema, { workspaceId, body }) {
    const rootSchema = toolOrSchema?.inputSchema || toolOrSchema || {};
    const schema = resolveOpenClipsModelSchema(rootSchema, body?.model, rootSchema);
    const args = {};
    setKnownProperty(args, schema, WORKSPACE_FIELDS, workspaceId, rootSchema);

    if (findProperty(schema, MODEL_FIELDS, rootSchema)) {
        Object.assign(args, body || {});
        setKnownProperty(args, schema, WORKSPACE_FIELDS, workspaceId, rootSchema);
        return args;
    }

    for (const alias of BODY_FIELDS) {
        const found = findProperty(schema, [alias], rootSchema);
        if (!found) continue;
        const [propertyName, propertySchema] = found;
        if (hasPropertyDeep(propertySchema, MODEL_FIELDS, rootSchema)) {
            args[propertyName] = { ...(body || {}) };
            return args;
        }
    }

    /* Some MCP servers expose one free-form JSON argument named `arguments`. */
    const argumentsProperty = findProperty(schema, ["arguments", "args"], rootSchema);
    if (argumentsProperty) {
        args[argumentsProperty[0]] = { workspaceId, ...(body || {}) };
        return args;
    }

    /* Fallback for an empty/free-form schema; live schemas take the branches above. */
    return { workspaceId, ...(body || {}) };
}

export function buildOpenClipsCallApiArgs(toolOrSchema, { method, path, body, workspaceId }) {
    const rootSchema = toolOrSchema?.inputSchema || toolOrSchema || {};
    const schema = resolveOpenClipsModelSchema(rootSchema, body?.model, rootSchema);
    const args = {};
    const upperMethod = cleanString(method).toUpperCase();

    setKnownProperty(args, schema, ["method", "httpMethod", "http_method"], upperMethod, rootSchema);
    setKnownProperty(args, schema, ["path", "endpoint", "route", "url", "operation", "operationId"], path, rootSchema);
    setKnownProperty(args, schema, WORKSPACE_FIELDS, workspaceId, rootSchema);

    let bodyAssigned = false;
    if (body !== undefined && !(upperMethod === "GET" || upperMethod === "HEAD")) {
        for (const alias of BODY_FIELDS) {
            bodyAssigned = setKnownProperty(args, schema, [alias], body, rootSchema) || bodyAssigned;
            if (bodyAssigned) break;
        }
        if (!bodyAssigned && findProperty(schema, ["json", "params", "parameters"], rootSchema)) {
            bodyAssigned = setKnownProperty(args, schema, ["json", "params", "parameters"], body, rootSchema);
        }
    }

    if (upperMethod === "GET" || upperMethod === "HEAD") {
        setKnownProperty(args, schema, ["query", "queryParams", "query_params"], body || {}, rootSchema);
    }

    const keys = Object.keys(schemaProperties(schema, rootSchema));
    if (!keys.length) {
        return upperMethod === "GET" || upperMethod === "HEAD"
            ? { method: upperMethod, path }
            : { method: upperMethod, path, body };
    }
    return args;
}

export function buildOpenClipsCreativeArgs(toolOrSchema, { workspaceId, creativeId, waitS }) {
    const rootSchema = toolOrSchema?.inputSchema || toolOrSchema || {};
    const schema = resolveOpenClipsModelSchema(rootSchema, "", rootSchema);
    const args = {};
    setKnownProperty(args, schema, WORKSPACE_FIELDS, workspaceId, rootSchema);
    setKnownProperty(
        args,
        schema,
        ["creativeId", "creative_id", "generatedCreativeId", "generated_creative_id", "id"],
        creativeId,
        rootSchema
    );
    setKnownProperty(args, schema, ["waitS", "wait_s", "waitSeconds", "wait_seconds"], waitS, rootSchema);
    if (!Object.keys(schemaProperties(schema, rootSchema)).length) {
        return { workspaceId, creativeId };
    }
    return args;
}

export function buildOpenClipsMarketplaceModelsArgs(toolOrSchema, { workspaceId, model, mediaType } = {}) {
    const rootSchema = toolOrSchema?.inputSchema || toolOrSchema || {};
    const schema = resolveOpenClipsModelSchema(rootSchema, model || "", rootSchema);
    const args = {};
    setKnownProperty(args, schema, WORKSPACE_FIELDS, workspaceId, rootSchema);
    setKnownProperty(args, schema, MODEL_FIELDS, model, rootSchema);
    setKnownProperty(args, schema, ["mediaType", "media_type", "kind", "type", "modality"], mediaType, rootSchema);
    return args;
}

function collectModelConstraints(schema, rootSchema, output, depth = 0) {
    if (!schema || depth > 10) return;
    const resolved = dereferenceSchema(schema, rootSchema);
    const properties = schemaProperties(resolved, rootSchema);
    for (const [key, value] of Object.entries(properties)) {
        if (MODEL_FIELDS.some(alias => normalizedKey(alias) === normalizedKey(key))) {
            const modelSchema = dereferenceSchema(value, rootSchema);
            if (modelSchema?.const) output.add(cleanString(modelSchema.const));
            if (Array.isArray(modelSchema?.enum)) {
                for (const item of modelSchema.enum) output.add(cleanString(item));
            }
        } else if (value && typeof value === "object") {
            collectModelConstraints(value, rootSchema, output, depth + 1);
        }
    }
    for (const keyword of ["oneOf", "anyOf", "allOf"]) {
        for (const branch of resolved?.[keyword] || []) {
            collectModelConstraints(branch, rootSchema, output, depth + 1);
        }
    }
}

export function openClipsSchemaAcceptsModel(toolOrSchema, model) {
    const rootSchema = toolOrSchema?.inputSchema || toolOrSchema || {};
    if (!rootSchema || !Object.keys(rootSchema).length) return true;
    const constraints = new Set();
    collectModelConstraints(rootSchema, rootSchema, constraints);
    constraints.delete("");
    /* A free-form model string has no enum/const restriction. */
    if (!constraints.size) return true;
    return constraints.has(cleanString(model));
}
