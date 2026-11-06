import test from "node:test";
import assert from "node:assert/strict";

import {
    buildOpenClipsCallApiArgs,
    buildOpenClipsCreativeArgs,
    buildOpenClipsGenerationArgs,
    buildOpenClipsMarketplaceModelsArgs,
    openClipsSchemaAcceptsModel,
    resolveOpenClipsModelSchema
} from "../provider/openclips/tool-schema.js";

const generationTool = {
    inputSchema: {
        type: "object",
        properties: {
            workspaceId: { type: "integer" },
            request: {
                oneOf: [
                    {
                        type: "object",
                        properties: {
                            model: { const: "seedance-2.5" },
                            prompt: { type: "string" },
                            params: { type: "object" }
                        }
                    },
                    {
                        type: "object",
                        properties: {
                            model: { const: "seedream-5.0-pro" },
                            prompt: { type: "string" },
                            images: { type: "array" },
                            params: { type: "object" }
                        }
                    }
                ]
            }
        },
        required: ["workspaceId", "request"]
    }
};

test("generation args memilih cabang model dan membungkus request + workspace", () => {
    const body = { model: "seedream-5.0-pro", prompt: "A product", images: ["https://cdn.example/a.png"], params: { size: "2K" } };
    const args = buildOpenClipsGenerationArgs(generationTool, { workspaceId: "42", body });
    assert.deepEqual(args, { workspaceId: 42, request: body });
    assert.equal(openClipsSchemaAcceptsModel(generationTool, "seedream-5.0-pro"), true);
    assert.equal(openClipsSchemaAcceptsModel(generationTool, "model-tidak-ada"), false);
    const resolved = resolveOpenClipsModelSchema(generationTool.inputSchema, "seedance-2.5");
    assert.equal(resolved.properties.workspaceId.type, "integer");
});

test("generation args mendukung body yang diratakan di top-level", () => {
    const tool = {
        inputSchema: {
            type: "object",
            properties: {
                workspace_id: { type: "integer" },
                model: { type: "string" },
                prompt: { type: "string" },
                params: { type: "object" }
            }
        }
    };
    const body = { model: "seedance-2.0", prompt: "hello", params: { duration: 5 } };
    assert.deepEqual(
        buildOpenClipsGenerationArgs(tool, { workspaceId: "7", body }),
        { workspace_id: 7, ...body }
    );
});

test("call_api args mengikuti nama field live, bukan tebakan camelCase", () => {
    const tool = {
        inputSchema: {
            type: "object",
            properties: {
                http_method: { type: "string" },
                endpoint: { type: "string" },
                payload: { type: "object" }
            }
        }
    };
    const body = { model: "seedance-2.5", prompt: "test" };
    assert.deepEqual(
        buildOpenClipsCallApiArgs(tool, { method: "post", path: "/api/workspaces/1/preview/", body }),
        { http_method: "POST", endpoint: "/api/workspaces/1/preview/", payload: body }
    );
});

test("creative dan marketplace args mengenali alias ID serta media kind", () => {
    const creativeTool = {
        inputSchema: {
            type: "object",
            properties: {
                workspace_id: { type: "integer" },
                generated_creative_id: { type: "integer" },
                wait_s: { type: "number" }
            }
        }
    };
    assert.deepEqual(
        buildOpenClipsCreativeArgs(creativeTool, { workspaceId: "3", creativeId: "99", waitS: "20" }),
        { workspace_id: 3, generated_creative_id: 99, wait_s: 20 }
    );

    const modelsTool = {
        inputSchema: {
            type: "object",
            properties: {
                model_id: { type: "string" },
                kind: { type: "string" }
            }
        }
    };
    assert.deepEqual(
        buildOpenClipsMarketplaceModelsArgs(modelsTool, { model: "seedance-2.5", mediaType: "video" }),
        { model_id: "seedance-2.5", kind: "video" }
    );
});

test("schema kosong memakai fallback call_api yang terdokumentasi", () => {
    assert.deepEqual(
        buildOpenClipsCallApiArgs({}, { method: "POST", path: "/api/x", body: { a: 1 } }),
        { method: "POST", path: "/api/x", body: { a: 1 } }
    );
});
