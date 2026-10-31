import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import {
    OPUS_IMAGE_MODEL_IDS,
    OPUS_IMAGE_SPECS,
    opusImageModels,
    opusImageModelMap,
    isOpusImageModelId,
    buildCharacterSheetPrompt
} from "../models/opus-image/index.js";

import {
    createImageTask,
    getImageTask,
    extractImageUrls,
    MAX_IMAGE_REFERENCE_IMAGES
} from "../provider/opus/client.js";

import {
    persistGeneratedImage
} from "../lib/generate/persist-generated-image.js";

import {
    MAIN_MODE_VIDEO,
    MAIN_MODE_IMAGE,
    IMAGE_SUBMODE_STANDARD,
    IMAGE_SUBMODE_CHARACTER_SHEET,
    isImageModel,
    filterModelsByMainMode,
    adaptDefinitionsForImageSubMode,
    inferSubModeFromRegenerateParameters
} from "../generate/assets/js/generate-mode-state.js";

const ROOT = process.cwd();

test("All 5 Opus image models are registered with flat 500-credit Admin Edit Model config", () => {
    assert.deepEqual(OPUS_IMAGE_MODEL_IDS, [
        "opus-gpt-image-2.5-flare",
        "opus-gpt-image-2.5-sunburst",
        "opus-seedream-5.0-pro",
        "opus-nano-banana-2",
        "opus-nano-banana-pro"
    ]);
    assert.equal(OPUS_IMAGE_SPECS.length, 5);
    assert.equal(opusImageModels.length, 5);
    assert.equal(MAX_IMAGE_REFERENCE_IMAGES, 8);

    const adminModelsSrc = fs.readFileSync(
        path.join(ROOT, "admin-control/models/models-data.js"),
        "utf8"
    );
    assert.match(adminModelsSrc, /opusImageModels/);

    for (const id of OPUS_IMAGE_MODEL_IDS) {
        assert.equal(isOpusImageModelId(id), true);
        const adapter = opusImageModelMap[id];
        assert.ok(adapter, `Missing adapter for ${id}`);
        assert.equal(adapter.config.media_type, "image");
        assert.equal(adapter.config.adminEditor?.resolutionIndependent, true);
        assert.deepEqual(adapter.config.adminEditor?.hiddenCreditFields, [
            "credit_720p",
            "credit_1080p"
        ]);
        assert.equal(typeof adapter.createTask, "function");
        assert.equal(typeof adapter.queryTask, "function");
    }

    for (const apiPath of ["api/model-config.js", "api/generate.js", "api/generate-status.js"]) {
        const src = fs.readFileSync(path.join(ROOT, apiPath), "utf8");
        assert.match(src, /opusImageModels/, `${apiPath} must register opusImageModels`);
    }

    const sqlSeed = fs.readFileSync(path.join(ROOT, "supabase/opus-provider-models.sql"), "utf8");
    for (const id of OPUS_IMAGE_MODEL_IDS) {
        assert.ok(sqlSeed.includes(`'${id}'`), `SQL seed missing ${id}`);
    }
    assert.match(sqlSeed, /500,\s*0,\s*0/);
});

test("Standard image mode supports 0 to 8 reference images and validates prompt & max limit", () => {
    const adapter = opusImageModelMap["opus-gpt-image-2.5-flare"];

    // Pure text-to-image (0 reference images)
    const t2iCheck = adapter.validate({
        image_mode: "standard",
        prompt: "Futuristic Jakarta skyline at golden hour, ultra detailed",
        aspect_ratio: "16:9"
    });
    assert.equal(t2iCheck.valid, true);

    // 8 reference images (max allowed)
    const eightRefs = Array.from(
        { length: 8 },
        (_, idx) => `https://cdn.example.com/ref-${idx + 1}.png`
    );
    const maxRefCheck = adapter.validate({
        image_mode: "standard",
        prompt: "Combine lighting and color palette from references",
        image_urls: eightRefs,
        aspect_ratio: "1:1"
    });
    assert.equal(maxRefCheck.valid, true);

    // 9 reference images -> rejected
    const nineRefs = [...eightRefs, "https://cdn.example.com/ref-9.png"];
    const overLimitCheck = adapter.validate({
        image_mode: "standard",
        prompt: "Too many references",
        image_urls: nineRefs
    });
    assert.equal(overLimitCheck.valid, false);
    assert.match(overLimitCheck.errors.join(" "), /Maksimal 8/i);

    // Empty prompt in standard mode -> rejected
    const emptyPromptCheck = adapter.validate({
        image_mode: "standard",
        prompt: "   "
    });
    assert.equal(emptyPromptCheck.valid, false);
});

test("Character Sheet sub-mode locks studio turnaround master prompt, requires character image, and supports optional outfit + notes", () => {
    const adapter = opusImageModelMap["opus-nano-banana-pro"];

    // Missing character_image_url -> rejected
    const missingChar = adapter.validate({
        image_mode: "character_sheet",
        outfit_image_url: "https://cdn.example.com/outfit.png"
    });
    assert.equal(missingChar.valid, false);
    assert.match(missingChar.errors.join(" "), /Foto Karakter Utama wajib/i);

    // Character only (no outfit, no notes) -> valid, defaults to 16:9, preserves original outfit
    const charOnlyParams = {
        image_mode: "character_sheet",
        character_image_url: "https://cdn.example.com/hero.png"
    };
    assert.equal(adapter.validate(charOnlyParams).valid, true);
    const charOnlyPayload = adapter.buildPayload(charOnlyParams);
    assert.equal(charOnlyPayload.image_mode, "character_sheet");
    assert.equal(charOnlyPayload.aspect_ratio, "16:9");
    assert.deepEqual(charOnlyPayload.reference_image_urls, [
        "https://cdn.example.com/hero.png"
    ]);
    assert.deepEqual(charOnlyPayload.reference_image_items, [
        { url: "https://cdn.example.com/hero.png", role: "character", label: "image1" }
    ]);
    assert.match(charOnlyPayload.prompt, /Front view/i);
    assert.match(charOnlyPayload.prompt, /3\/4 front-angle view/i);
    assert.match(charOnlyPayload.prompt, /Side profile view/i);
    assert.match(charOnlyPayload.prompt, /Back view/i);
    assert.match(charOnlyPayload.prompt, /OUTFIT CONTINUITY/i);

    // Character + Outfit + Extra Notes -> applies outfit replacement across all views
    const withOutfitParams = {
        image_mode: "character_sheet",
        character_image_url: "https://cdn.example.com/hero.png",
        outfit_image_url: "https://cdn.example.com/cyber-jacket.png",
        character_notes: "Tambahkan kacamata visor biru tipis",
        aspect_ratio: "16:9"
    };
    assert.equal(adapter.validate(withOutfitParams).valid, true);
    const withOutfitPayload = adapter.buildPayload(withOutfitParams);
    assert.deepEqual(withOutfitPayload.reference_image_urls, [
        "https://cdn.example.com/hero.png",
        "https://cdn.example.com/cyber-jacket.png"
    ]);
    assert.deepEqual(withOutfitPayload.reference_image_items, [
        { url: "https://cdn.example.com/hero.png", role: "character", label: "image1" },
        { url: "https://cdn.example.com/cyber-jacket.png", role: "outfit", label: "image2" }
    ]);
    assert.match(withOutfitPayload.prompt, /OUTFIT REPLACEMENT & CONTINUITY/i);
    assert.match(withOutfitPayload.prompt, /Tambahkan kacamata visor biru tipis/);

    const sanitizedForHistory = adapter.sanitizeParameters(withOutfitParams);
    assert.equal(
        sanitizedForHistory.prompt,
        "[Karakter Sheet + Custom Outfit] Tambahkan kacamata visor biru tipis"
    );
    assert.equal(sanitizedForHistory.aspect_ratio, "16:9");
    assert.deepEqual(sanitizedForHistory.image_urls, [
        "https://cdn.example.com/hero.png",
        "https://cdn.example.com/cyber-jacket.png"
    ]);
});

test("generate-mode-state filters video vs image models and adapts definitions per image sub-mode", () => {
    const sampleModels = [
        { model_id: "opus-seedance-2.0-fast", model_name: "Seedance 2.0 Fast", media_type: "video" },
        { model_id: "wan-2-6", model_name: "Wan 2.6" },
        { model_id: "opus-gpt-image-2.5-flare", model_name: "GPT Image 2.5 Flare", media_type: "image" },
        { model_id: "opus-seedream-5.0-pro", model_name: "Seedream 5.0 Pro", media_type: "image" }
    ];

    const videoList = filterModelsByMainMode(sampleModels, MAIN_MODE_VIDEO);
    const imageList = filterModelsByMainMode(sampleModels, MAIN_MODE_IMAGE);
    assert.deepEqual(videoList.map(m => m.model_id), ["opus-seedance-2.0-fast", "wan-2-6"]);
    assert.deepEqual(imageList.map(m => m.model_id), [
        "opus-gpt-image-2.5-flare",
        "opus-seedream-5.0-pro"
    ]);
    assert.equal(isImageModel(sampleModels[2]), true);
    assert.equal(isImageModel(sampleModels[0]), false);

    const rawObjectDefs = opusImageModelMap["opus-seedream-5.0-pro"].parameters;
    const rawArrayDefs = Object.entries(rawObjectDefs).map(([name, def]) => ({
        name,
        ...def
    }));
    const standardArrayDefs = adaptDefinitionsForImageSubMode(
        rawArrayDefs,
        sampleModels[3],
        IMAGE_SUBMODE_STANDARD
    );
    assert.ok(Array.isArray(standardArrayDefs));
    assert.ok(standardArrayDefs.find(d => d.name === "image_urls"));
    assert.ok(standardArrayDefs.find(d => d.name === "prompt" && d.required === true));
    assert.equal(standardArrayDefs.find(d => d.name === "character_image_url"), undefined);

    const standardDefs = adaptDefinitionsForImageSubMode(
        rawObjectDefs,
        sampleModels[3],
        IMAGE_SUBMODE_STANDARD
    );
    assert.ok(standardDefs.image_urls);
    assert.ok(standardDefs.prompt);
    assert.equal(standardDefs.character_image_url, undefined);
    assert.equal(standardDefs.outfit_image_url, undefined);
    assert.equal(standardDefs.character_notes, undefined);
    assert.equal(standardDefs.aspect_ratio.default, "1:1");

    const sheetDefs = adaptDefinitionsForImageSubMode(
        rawObjectDefs,
        sampleModels[3],
        IMAGE_SUBMODE_CHARACTER_SHEET
    );
    assert.ok(sheetDefs.character_image_url);
    assert.equal(sheetDefs.character_image_url.required, true);
    assert.ok(sheetDefs.outfit_image_url);
    assert.equal(sheetDefs.outfit_image_url.required, false);
    assert.ok(sheetDefs.character_notes);
    assert.equal(sheetDefs.image_urls, undefined);
    assert.equal(sheetDefs.prompt, undefined);
    assert.equal(sheetDefs.aspect_ratio.default, "16:9");

    assert.equal(
        inferSubModeFromRegenerateParameters({ prompt: "[Karakter Sheet] Catatan" }),
        IMAGE_SUBMODE_CHARACTER_SHEET
    );
    assert.equal(
        inferSubModeFromRegenerateParameters({ prompt: "Cyberpunk street scene" }),
        IMAGE_SUBMODE_STANDARD
    );
});

test("Opus client createImageTask and getImageTask resolve vendor-prefixed model aliases and ignore imported reference assets", async t => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    const calls = [];
    let importSeq = 0;
    const mockFetch = async (url, init = {}) => {
        if (String(url).endsWith("/ref-char.png") || String(url).endsWith("/ref-outfit.png")) {
            return new Response(
                new Uint8Array(
                    Buffer.from(
                        "89504e470d0a1a0a0000000d49484452000001900000019008060000001f15c489" +
                        "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
                        "hex"
                    )
                ),
                {
                    status: 200,
                    headers: { "content-type": "image/png" }
                }
            );
        }

        if (String(url).includes("upload.opus.test/put")) {
            return new Response("", { status: 200 });
        }

        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        calls.push({ url: String(url), method: init.method || "GET", body });

        if (body?.method === "initialize") {
            return new Response(
                JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "opus" } } }),
                { status: 200, headers: { "content-type": "application/json", "mcp-session-id": "sess-img-1" } }
            );
        }

        if (body?.method === "notifications/initialized") {
            return new Response("", { status: 202 });
        }

        if (body?.method === "tools/list") {
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                        tools: [
                            {
                                name: "opus_video_tools_whoami",
                                inputSchema: { type: "object", properties: {} }
                            },
                            {
                                name: "create_project",
                                inputSchema: {
                                    type: "object",
                                    properties: { name: { type: "string" } }
                                }
                            },
                            {
                                name: "import_assets",
                                inputSchema: {
                                    type: "object",
                                    properties: {
                                        projectId: { type: "string" },
                                        items: { type: "array" },
                                        finalizeAssetIds: { type: "array" }
                                    }
                                }
                            },
                            {
                                name: "get_status",
                                inputSchema: {
                                    type: "object",
                                    properties: {
                                        projectId: { type: "string" },
                                        jobId: { type: "string" }
                                    }
                                }
                            },
                            {
                                name: "generate_keyframes",
                                inputSchema: {
                                    properties: {
                                        projectId: { type: "string" },
                                        prompt: { type: "string" },
                                        model: {
                                            type: "string",
                                            enum: [
                                                "openai/gpt-image-2.5-flare",
                                                "openai/gpt-image-2.5-sunburst",
                                                "bytedance/seedream-5.0-pro",
                                                "google/nano-banana-2",
                                                "google/nano-banana-pro"
                                            ]
                                        },
                                        aspectRatio: { type: "string" },
                                        referenceAssets: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    assetId: { type: "string" },
                                                    role: { type: "string" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }),
                { status: 200, headers: { "content-type": "application/json" } }
            );
        }

        const toolName = body?.params?.name;
        const toolArgs = body?.params?.arguments || {};

        if (toolName === "opus_video_tools_whoami") {
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: { structuredContent: { userId: "u1" } }
                }),
                { status: 200, headers: { "content-type": "application/json" } }
            );
        }

        if (toolName === "create_project") {
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: { structuredContent: { projectId: "proj-img-99" } }
                }),
                { status: 200, headers: { "content-type": "application/json" } }
            );
        }

        if (toolName === "import_assets") {
            if (!Array.isArray(toolArgs.items)) {
                return new Response(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { status: "READY" } }
                    }),
                    { status: 200, headers: { "content-type": "application/json" } }
                );
            }
            const items = toolArgs.items.map(() => {
                importSeq += 1;
                return {
                    assetId: `asset-ref-${importSeq}`,
                    uploadUrl: `https://upload.opus.test/put/${importSeq}`
                };
            });
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: { structuredContent: { items } }
                }),
                { status: 200, headers: { "content-type": "application/json" } }
            );
        }

        if (toolName === "generate_keyframes") {
            assert.equal(toolArgs.model, "openai/gpt-image-2.5-flare");
            assert.equal(toolArgs.aspectRatio, "16:9");
            assert.equal(toolArgs.referenceAssets.length, 2);
            assert.equal(toolArgs.referenceAssets[0].role, "character");
            assert.equal(toolArgs.referenceAssets[1].role, "outfit");
            assert.ok(toolArgs.referenceAssets[0].assetId);
            assert.notEqual(
                toolArgs.referenceAssets[0].assetId,
                toolArgs.referenceAssets[1].assetId
            );
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: { structuredContent: { jobId: "job-img-42", status: "RUNNING" } }
                }),
                { status: 200, headers: { "content-type": "application/json" } }
            );
        }

        if (toolName === "get_status") {
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                        structuredContent: {
                            jobId: "job-img-42",
                            status: "COMPLETED",
                            assets: [
                                {
                                    assetId: "asset-ref-1",
                                    role: "character",
                                    url: "https://cdn.example.com/ref-char.png"
                                },
                                {
                                    assetId: "asset-out-99",
                                    role: "output",
                                    url: "https://cdn.opus.test/generated/final-character-sheet.png"
                                }
                            ]
                        }
                    }
                }),
                { status: 200, headers: { "content-type": "application/json" } }
            );
        }

        throw new Error(`Unexpected fetch call: ${url} / ${JSON.stringify(body)}`);
    };

    globalThis.fetch = mockFetch;

    const adapter = opusImageModelMap["opus-gpt-image-2.5-flare"];
    const payload = adapter.buildPayload({
        image_mode: "character_sheet",
        character_image_url: "https://cdn.example.com/ref-char.png",
        outfit_image_url: "https://cdn.example.com/ref-outfit.png",
        aspect_ratio: "16:9"
    });

    const created = await createImageTask(payload, "test-opus-bearer-token");

    assert.ok(created.taskId.startsWith("opus:"));
    assert.ok(["QUEUED", "PROCESSING"].includes(created.status));

    const polled = await getImageTask(created.taskId, "test-opus-bearer-token");

    assert.equal(polled.status, "COMPLETED");
    assert.deepEqual(polled.outputUrls, [
        "https://cdn.opus.test/generated/final-character-sheet.png"
    ]);
});

test("persistGeneratedImage uploads data:image and https image results into private user-uploads bucket", async () => {
    const uploadedRequests = [];
    const mockStorageFetch = async (url, init = {}) => {
        uploadedRequests.push({
            url: String(url),
            method: init.method,
            headers: init.headers,
            byteLength: init.body?.byteLength || 0
        });
        return new Response(JSON.stringify({ Key: "ok" }), { status: 200 });
    };

    // Valid 68-byte minimal PNG
    const validPngBytes = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
        "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
        "hex"
    );
    const pngBase64 = `data:image/png;base64,${validPngBytes.toString("base64")}`;

    const storageRef = await persistGeneratedImage({
        sourceUrl: pngBase64,
        userId: "11111111-2222-3333-4444-555555555555",
        supabaseUrl: "https://ycovbqmezhrvzobxqnyp.supabase.co",
        serviceKey: "srv-key-test",
        fetchImpl: mockStorageFetch
    });

    assert.match(
        storageRef,
        /^supabase-private:\/\/user-uploads\/upscale-photos\/outputs\/11111111-2222-3333-4444-555555555555\/genimg-.*\.png$/
    );
    assert.equal(uploadedRequests.length, 1);
    assert.equal(uploadedRequests[0].headers["Content-Type"], "image/png");
});

test("History modal & render recognize all 5 Opus image models as image media (thumbnail <img>, no video upscale)", () => {
    const generateHtml = fs.readFileSync(path.join(ROOT, "generate/index.html"), "utf8");
    assert.match(generateHtml, /id="generateMainModeTabs"/);
    assert.match(generateHtml, /id="generateImageSubModeWrap"/);
    assert.match(generateHtml, /id="characterSheetLockedBanner"/);
    assert.match(generateHtml, /id="generateImageResultCard"/);

    const modalSrc = fs.readFileSync(
        path.join(ROOT, "history/assets/js/history-modal.js"),
        "utf8"
    );
    const context = vm.createContext({
        window: { GENZHistory: { state: {}, elements: {} }, addEventListener: () => {} },
        document: {
            documentElement: { dataset: {} },
            body: { dataset: {} },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {}
        },
        console
    });
    context.globalThis = context.window;
    vm.runInContext(modalSrc, context);

    const getMediaType = context.window.GENZHistory.getMediaType;
    if (typeof getMediaType === "function") {
        for (const modelId of OPUS_IMAGE_MODEL_IDS) {
            assert.equal(
                getMediaType({
                    model_id: modelId,
                    result_url: "https://signed.supabase.co/storage/v1/object/sign/user-uploads/blob"
                }),
                "image"
            );
        }
    } else {
        for (const modelId of OPUS_IMAGE_MODEL_IDS) {
            assert.ok(modalSrc.includes(modelId), `history-modal.js missing ${modelId}`);
        }
    }
});

test("Seedream 5.0 Pro self-heals runtime invalid_arguments (Zod issues enum discovery) & isolated import_assets oneOf branches", async t => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    const validPngBytes = new Uint8Array(
        Buffer.from(
            "89504e470d0a1a0a0000000d49484452000002000000020008060000001f15c489" +
            "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
            "hex"
        )
    );

    const seenImportItems = [];
    const seenKeyframeCalls = [];
    let putUploaded = false;

    globalThis.fetch = async (url, init = {}) => {
        const urlStr = String(url);
        if (urlStr.includes("supabase.co/storage/v1/object/sign/")) {
            return new Response(validPngBytes, {
                status: 200,
                headers: { "content-type": "image/png" }
            });
        }
        if (urlStr === "https://upload.opus.test/presigned-put-seedream") {
            putUploaded = true;
            return new Response("", { status: 200 });
        }

        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        if (body?.method === "initialize") {
            return Response.json(
                { jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "opus" } } },
                { headers: { "mcp-session-id": "sess-seedream-1" } }
            );
        }
        if (body?.method === "notifications/initialized") {
            return new Response("", { status: 204 });
        }
        if (body?.method === "tools/list") {
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    tools: [
                        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
                        {
                            name: "create_project",
                            inputSchema: {
                                type: "object",
                                required: ["name", "requestKey"],
                                properties: {
                                    name: { type: "string" },
                                    requestKey: { type: "string", format: "uuid" }
                                }
                            }
                        },
                        {
                            name: "import_assets",
                            inputSchema: {
                                type: "object",
                                required: ["projectId", "requestKey", "items"],
                                properties: {
                                    projectId: { type: "string" },
                                    requestKey: { type: "string", format: "uuid" },
                                    items: {
                                        type: "array",
                                        items: {
                                            oneOf: [
                                                {
                                                    type: "object",
                                                    required: ["id", "url"],
                                                    properties: {
                                                        id: { type: "string" },
                                                        url: { type: "string", format: "uri" }
                                                    }
                                                },
                                                {
                                                    type: "object",
                                                    required: ["id", "fileName", "mimeType", "sizeBytes"],
                                                    properties: {
                                                        id: { type: "string" },
                                                        fileName: { type: "string" },
                                                        mimeType: { type: "string" },
                                                        sizeBytes: { type: "integer" }
                                                    }
                                                },
                                                {
                                                    type: "object",
                                                    required: ["assetId"],
                                                    properties: {
                                                        assetId: { type: "string" }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            name: "generate_keyframes",
                            inputSchema: {
                                type: "object",
                                required: ["projectId", "items"],
                                properties: {
                                    projectId: { type: "string" },
                                    requestKey: { type: "string" },
                                    items: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["id", "prompt"],
                                            properties: {
                                                id: { type: "string" },
                                                prompt: { type: "string" },
                                                aspectRatio: { type: "string" },
                                                model: { type: "string" },
                                                quality: { type: "string" },
                                                referenceAssets: {
                                                    type: "array",
                                                    items: { type: "string" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        {
                            name: "get_status",
                            inputSchema: {
                                type: "object",
                                required: ["projectId", "jobIds"],
                                properties: {
                                    projectId: { type: "string" },
                                    jobIds: { type: "array", items: { type: "string" } },
                                    jobId: { type: "string" }
                                }
                            }
                        }
                    ]
                }
            });
        }

        const toolName = body?.params?.name;
        const toolArgs = body?.params?.arguments || {};

        if (toolName === "opus_video_tools_whoami") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
        }
        if (toolName === "create_project") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj-sd5" } } });
        }
        if (toolName === "import_assets") {
            const entry = toolArgs.items?.[0] || {};
            seenImportItems.push(entry);
            if (entry.url) {
                /* Pastikan cabang URL tidak pernah dicemari fileName/mimeType dari cabang oneOf lain */
                assert.equal(entry.fileName, undefined);
                assert.equal(entry.mimeType, undefined);
                /* Simulasikan server Opus menolak signed URL eksternal tanpa isError:true */
                return Response.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                        structuredContent: {
                            projectId: "proj-sd5",
                            items: [{ id: entry.id, ok: false, field: "items[0].url" }]
                        }
                    }
                });
            }
            if (entry.assetId) {
                assert.equal(putUploaded, true);
                assert.equal(entry.assetId, "ast_sd5_char_01");
                return Response.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                        structuredContent: {
                            projectId: "proj-sd5",
                            items: [{ ok: true, status: "ready", asset: { id: "ast_sd5_char_01" } }]
                        }
                    }
                });
            }
            assert.equal(typeof entry.fileName, "string");
            assert.equal(entry.mimeType, "image/png");
            assert.ok(entry.sizeBytes > 0);
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    structuredContent: {
                        projectId: "proj-sd5",
                        items: [{
                            id: entry.id,
                            ok: true,
                            status: "awaiting_upload",
                            asset: { id: "ast_sd5_char_01" },
                            upload: { putUrl: "https://upload.opus.test/presigned-put-seedream", method: "PUT" }
                        }]
                    }
                }
            });
        }
        if (toolName === "generate_keyframes") {
            seenKeyframeCalls.push(structuredClone(toolArgs));
            const kf = toolArgs.items?.[0] || {};
            assert.deepEqual(kf.referenceAssets, ["ast_sd5_char_01"]);
            if (kf.model !== "seedream-5-pro") {
                return Response.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                        isError: true,
                        structuredContent: {
                            ok: false,
                            error: "invalid_arguments",
                            issues: [
                                {
                                    path: ["items", 0, "model"],
                                    message:
                                        "Invalid enum value. Expected 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst' | 'seedream-5-pro' | 'nano-banana-2' | 'nano-banana-pro', received 'seedream-5.0-pro'"
                                }
                            ]
                        }
                    }
                });
            }
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    structuredContent: {
                        projectId: "proj-sd5",
                        items: [{ id: kf.id, ok: true, jobId: "job-sd5-ok", status: "queued" }]
                    }
                }
            });
        }
        if (toolName === "get_status") {
            assert.deepEqual(toolArgs.jobIds, ["job-sd5-ok"]);
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    structuredContent: {
                        projectId: "proj-sd5",
                        jobs: [
                            {
                                jobId: "job-sd5-ok",
                                status: "completed",
                                outputs: [{ url: "https://cdn.opus.test/generated/seedream-sheet.png" }]
                            }
                        ]
                    }
                }
            });
        }
        throw new Error(`Unexpected RPC call: ${toolName}`);
    };

    const adapter = opusImageModelMap["opus-seedream-5.0-pro"];
    const payload = adapter.buildPayload({
        image_mode: "character_sheet",
        character_image_url:
            "https://ycovbqmezhrvzobxqnyp.supabase.co/storage/v1/object/sign/user-uploads/generate-input/u1/char.png?token=abc",
        aspect_ratio: "16:9"
    });

    const created = await createImageTask(payload, "tok-seedream-test");
    assert.equal(seenKeyframeCalls.length, 2, "Harus otomatis self-heal ke seedream-5-pro dari issues Zod");
    assert.equal(seenKeyframeCalls[0].items[0].model, "seedream-5.0-pro");
    assert.equal(seenKeyframeCalls[1].items[0].model, "seedream-5-pro");
    assert.notEqual(seenKeyframeCalls[0].requestKey, seenKeyframeCalls[1].requestKey);
    assert.ok(created.taskId.startsWith("opus:"));

    const polled = await getImageTask(created.taskId, "tok-seedream-test");
    assert.equal(polled.status, "COMPLETED");
    assert.deepEqual(polled.outputUrls, ["https://cdn.opus.test/generated/seedream-sheet.png"]);
});

test("All 5 Opus image models handle KeyframeSpec ($defs, aspect, person/product roles, images string[] trap, size & quality)", async t => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    const validPngBytes = new Uint8Array(
        Buffer.from(
            "89504e470d0a1a0a0000000d49484452000002000000020008060000001f15c489" +
            "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
            "hex"
        )
    );

    const capturedKeyframes = [];

    globalThis.fetch = async (url, init = {}) => {
        const urlStr = String(url);
        if (urlStr.startsWith("https://cdn.example.com/")) {
            return new Response(validPngBytes, { status: 200, headers: { "content-type": "image/png" } });
        }
        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        if (body?.method === "initialize") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: {} }, { headers: { "mcp-session-id": "sess-kfspec" } });
        }
        if (body?.method === "notifications/initialized") {
            return new Response("", { status: 204 });
        }
        if (body?.method === "tools/list") {
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    tools: [
                        { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
                        {
                            name: "import_assets",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    projectId: { type: "string" },
                                    assets: { type: "array", items: { type: "object", properties: { url: { type: "string" } } } }
                                }
                            }
                        },
                        {
                            name: "generate_keyframes",
                            inputSchema: {
                                type: "object",
                                required: ["projectId", "requestKey", "keyframes"],
                                $defs: {
                                    RefAsset: {
                                        type: "object",
                                        required: ["assetId", "role"],
                                        properties: {
                                            assetId: { type: "string" },
                                            role: { anyOf: [{ const: "person" }, { const: "product" }] },
                                            label: { type: "string" }
                                        }
                                    },
                                    KeyframeSpec: {
                                        type: "object",
                                        required: ["keyframeId", "outputLabel", "prompt", "aspect", "size", "quality"],
                                        properties: {
                                            keyframeId: { type: "string" },
                                            outputLabel: { type: "string" },
                                            prompt: { type: "string" },
                                            aspect: { anyOf: [{ enum: ["9:16", "16:9", "1:1", "4:3", "3:4"] }, { type: "null" }] },
                                            size: { enum: ["1536x1024", "1024x1536", "1024x1024"] },
                                            quality: { enum: ["low", "standard", "high"] },
                                            model: {
                                                enum: [
                                                    "gpt-image-2.5-flare",
                                                    "gpt-image-2.5-sunburst",
                                                    "seedream-5.0-pro",
                                                    "nano-banana-2",
                                                    "nano-banana-pro"
                                                ]
                                            },
                                            referenceAssets: {
                                                type: "array",
                                                items: { $ref: "#/$defs/RefAsset" }
                                            }
                                        }
                                    }
                                },
                                properties: {
                                    projectId: { type: "string" },
                                    requestKey: { type: "string", format: "uuid" },
                                    /* Jebakan: `images` bertipe array string referensi, BUKAN container batch */
                                    images: { type: "array", items: { type: "string" } },
                                    keyframes: { type: "array", items: { $ref: "#/$defs/KeyframeSpec" } }
                                }
                            }
                        }
                    ]
                }
            });
        }

        const toolName = body?.params?.name;
        const toolArgs = body?.params?.arguments || {};
        if (toolName === "create_project") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj-kfspec" } } });
        }
        if (toolName === "import_assets") {
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { structuredContent: { assets: [{ ok: true, assetId: `ast_${Math.random().toString(36).slice(2, 8)}` }] } }
            });
        }
        if (toolName === "generate_keyframes") {
            assert.equal(toolArgs.images, undefined, "Tidak boleh salah menganggap images: string[] sebagai array batch");
            assert.ok(Array.isArray(toolArgs.keyframes) && toolArgs.keyframes.length === 1);
            const kf = toolArgs.keyframes[0];
            assert.ok(kf.keyframeId);
            assert.ok(kf.outputLabel);
            assert.equal(kf.aspect, "16:9");
            assert.equal(kf.size, "1536x1024");
            assert.equal(kf.quality, "high");
            assert.equal(kf.referenceAssets[0].role, "person");
            assert.equal(kf.referenceAssets[1].role, "product");
            capturedKeyframes.push(kf);
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { structuredContent: { jobId: `job_${capturedKeyframes.length}`, status: "queued" } }
            });
        }
        throw new Error(`Unexpected RPC call: ${toolName}`);
    };

    for (const modelId of OPUS_IMAGE_MODEL_IDS) {
        const adapter = opusImageModelMap[modelId];
        const payload = adapter.buildPayload({
            image_mode: "character_sheet",
            character_image_url: "https://cdn.example.com/char.png",
            outfit_image_url: "https://cdn.example.com/outfit.png",
            aspect_ratio: "16:9"
        });
        const created = await createImageTask(payload, "tok-all5");
        assert.ok(created.taskId.startsWith("opus:"));
    }

    assert.equal(capturedKeyframes.length, 5);
});

test("JSON-RPC -32602 & unrecognized_keys self-heal to inline MCP image content, and unrecoverable invalid_arguments exposes full diagnostics", async t => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    const validPngB64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    let attempts = 0;

    globalThis.fetch = async (_url, init = {}) => {
        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        if (body?.method === "initialize") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: {} }, { headers: { "mcp-session-id": "sess-rpc-heal" } });
        }
        if (body?.method === "notifications/initialized") {
            return new Response("", { status: 204 });
        }
        if (body?.method === "tools/list") {
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    tools: [
                        { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
                        {
                            name: "generate_keyframes",
                            inputSchema: {
                                type: "object",
                                required: ["projectId", "items"],
                                properties: {
                                    projectId: { type: "string" },
                                    requestKey: { type: "string" },
                                    items: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["id", "prompt"],
                                            properties: {
                                                id: { type: "string" },
                                                label: { type: "string" },
                                                prompt: { type: "string" },
                                                aspectRatio: { type: "string" },
                                                model: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            });
        }

        const toolName = body?.params?.name;
        const toolArgs = body?.params?.arguments || {};
        if (toolName === "create_project") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj-rpc" } } });
        }
        if (toolName === "generate_keyframes") {
            attempts += 1;
            const kf = toolArgs.items?.[0] || {};
            if (kf.label !== undefined) {
                /* Simulasikan JSON-RPC -32602 atas field opsional `label` */
                return Response.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    error: {
                        code: -32602,
                        message: "Invalid arguments",
                        data: {
                            code: "invalid_arguments",
                            issues: [{ path: ["items", 0, "label"], keys: ["label"], message: "Unrecognized key(s) in object: 'label'" }]
                        }
                    }
                });
            }
            if (kf.model) {
                /* Simulasikan item-level unsupported_model tanpa ok:false sehingga jatuh ke omitModel */
                return Response.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                        structuredContent: {
                            projectId: "proj-rpc",
                            items: [{ id: kf.id, error: "unsupported_model", message: "Model alias not enabled for org" }]
                        }
                    }
                });
            }
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    content: [{ type: "image", mimeType: "image/png", data: validPngB64 }],
                    structuredContent: { status: "completed" }
                }
            });
        }
        throw new Error(`Unexpected RPC call: ${toolName}`);
    };

    const adapter = opusImageModelMap["opus-seedream-5.0-pro"];
    const payload = adapter.buildPayload({
        image_mode: "standard",
        prompt: "Futuristic mecha portrait in neon rain",
        aspect_ratio: "1:1"
    });

    const created = await createImageTask(payload, "tok-rpc-heal");
    assert.ok(attempts >= 3, "Harus melewati JSON-RPC -32602 dan unsupported_model hingga sukses");
    assert.equal(created.status, "COMPLETED");
    assert.equal(created.outputUrls[0], `data:image/png;base64,${validPngB64}`);

    /* Verifikasi bila seluruh varian ditolak upstream, pesan error menampilkan detail issues + ringkasan schema */
    globalThis.fetch = async (_url, init = {}) => {
        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        if (body?.method === "initialize") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: {} }, { headers: { "mcp-session-id": "sess-fail-diag" } });
        }
        if (body?.method === "notifications/initialized") return new Response("", { status: 204 });
        if (body?.method === "tools/list") {
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    tools: [
                        { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
                        {
                            name: "generate_keyframes",
                            inputSchema: {
                                type: "object",
                                required: ["projectId", "items"],
                                properties: {
                                    projectId: { type: "string" },
                                    items: { type: "array", items: { type: "object", required: ["prompt"], properties: { prompt: { type: "string" } } } }
                                }
                            }
                        }
                    ]
                }
            });
        }
        if (body?.params?.name === "create_project") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj-diag" } } });
        }
        return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            result: {
                isError: true,
                structuredContent: {
                    ok: false,
                    error: "invalid_arguments",
                    issues: [{ path: ["items", 0, "prompt"], message: "Prompt rejected by custom validator" }]
                }
            }
        });
    };

    await assert.rejects(
        () => createImageTask(payload, "tok-diag"),
        err => {
            assert.notEqual(err.message, "invalid_arguments", "Tidak boleh menelan pesan menjadi string mentah invalid_arguments");
            assert.match(err.message, /Prompt rejected by custom validator/);
            assert.match(err.message, /\[schema:/);
            return true;
        }
    );
});

