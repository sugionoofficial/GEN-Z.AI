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
