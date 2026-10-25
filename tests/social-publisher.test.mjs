import test from "node:test";
import assert from "node:assert/strict";
import {
    buildImagePrompt,
    clampIntervalMinutes,
    composeSocialCaption,
    createScenePlan,
    localDateTimeToUtc,
    normalizeMimeType,
    normalizeSocialAspectRatio,
    renderCaption
} from "../lib/social-publisher/utils.js";
import {
    decryptSecret,
    encryptSecret,
    generateSocialContextCaption,
    generateSocialImage,
    makeProfileShareUrl,
    publishFacebookPhoto
} from "../lib/social-publisher/providers.js";
import {
    createSignedReferenceUrl,
    deleteReferenceObject,
    downloadReferenceObject,
    isPrivateReferenceBucket,
    SOCIAL_REFERENCE_STORAGE_BUCKET,
    uploadReferenceObject
} from "../lib/social-publisher/storage.js";
import { stripImageMetadata } from "../metadata-cleaner/assets/js/metadata-cleaner-image.js";

const TEST_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

test("scene planner returns the dimensions needed for varied realistic posts", () => {
    const scene = createScenePlan([], () => 0.11);
    assert.ok(scene.location);
    assert.ok(scene.angle);
    assert.ok(scene.outfit);
    assert.ok(scene.situation);
    assert.ok(scene.lighting);
    assert.ok(scene.key);
});

test("scene planner can avoid an immediately repeated composition", () => {
    const first = createScenePlan([], () => 0.11);
    const next = createScenePlan([first.key], () => 0.37);
    assert.notEqual(next.key, first.key);
});

test("prompt keeps the referenced character and includes selected scene controls", () => {
    const scene = {
        location: "a quiet café",
        angle: "eye-level portrait",
        outfit: "a neutral linen outfit",
        situation: "reading a book",
        lighting: "soft daylight"
    };
    const prompt = buildImagePrompt({ characterName: "Alya", characterNotes: "bob haircut", scene });
    assert.match(prompt, /same adult character/i);
    assert.match(prompt, /Alya/);
    assert.match(prompt, /quiet café/);
    assert.match(prompt, /eye-level portrait/);
    assert.match(prompt, /neutral linen outfit/);
    assert.match(prompt, /soft daylight/);
    assert.match(prompt, /bob haircut/);
});

test("prompt supports the selected vertical or horizontal image ratio", () => {
    const scene = { location: "a café", angle: "portrait", outfit: "linen", situation: "reading", lighting: "soft light" };
    assert.match(buildImagePrompt({ scene, aspectRatio: "9:16" }), /vertical 9:16/);
    assert.match(buildImagePrompt({ scene, aspectRatio: "16:9" }), /horizontal 16:9/);
    assert.equal(normalizeSocialAspectRatio("16:9"), "16:9");
    assert.equal(normalizeSocialAspectRatio("1:1"), null);
});

test("caption composition puts the contextual sentence and link before trailing hashtags", () => {
    assert.equal(
        composeSocialCaption({
            baseCaption: "Lagi santai #outfit #GENZAI",
            contextualCaption: "Hai guys, lagi menikmati kopi.",
            externalLink: "https://example.com/promo"
        }),
        "Lagi santai\n\nHai guys, lagi menikmati kopi.\n\nhttps://example.com/promo\n\n#outfit #GENZAI"
    );
});

test("metadata cleaner strips PNG text chunks and rejects invalid image signatures", async () => {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    const chunk = (type, data) => {
        const bytes = new Uint8Array(12 + data.length);
        new DataView(bytes.buffer).setUint32(0, data.length);
        bytes.set([...type].map(character => character.charCodeAt(0)), 4);
        bytes.set(data, 8);
        return bytes;
    };
    const chunks = [
        chunk("IHDR", new Uint8Array(13)),
        chunk("tEXt", new TextEncoder().encode("Comment\0GPS=private")),
        chunk("IDAT", new Uint8Array()),
        chunk("IEND", new Uint8Array())
    ];
    const input = new Uint8Array(signature.length + chunks.reduce((size, part) => size + part.length, 0));
    input.set(signature);
    let offset = signature.length;
    for (const part of chunks) {
        input.set(part, offset);
        offset += part.length;
    }

    const cleaned = await stripImageMetadata(new Blob([input], { type: "image/png" }));
    const cleanedText = new TextDecoder().decode(await cleaned.arrayBuffer());
    assert.equal(cleaned.type, "image/png");
    assert.doesNotMatch(cleanedText, /GPS=private/);
    await assert.rejects(
        stripImageMetadata(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })),
        /Struktur PNG tidak valid/
    );
});

test("caption template interpolates scene placeholders", () => {
    const caption = renderCaption("{name} di {location} memakai {outfit}", {
        location: "Jakarta",
        outfit: "linen",
        situation: "walking",
        lighting: "sunset",
        angle: "portrait"
    }, "Alya");
    assert.equal(caption, "Alya di Jakarta memakai linen");
});

test("schedule interval and reference MIME validation are bounded", () => {
    assert.equal(clampIntervalMinutes(5, 5, 10080), 5);
    assert.equal(clampIntervalMinutes(10080, 5, 10080), 10080);
    assert.equal(clampIntervalMinutes(0, 5, 10080), null);
    assert.equal(clampIntervalMinutes(4, 5, 10080), null);
    assert.equal(clampIntervalMinutes(10081, 5, 10080), null);
    assert.equal(normalizeMimeType("image/jpeg; charset=binary"), "image/jpeg");
    assert.equal(normalizeMimeType("text/html"), null);
});

test("WIB datetime input is converted to UTC without relying on host timezone", () => {
    assert.equal(localDateTimeToUtc("2026-10-19T12:00", "Asia/Jakarta"), "2026-10-19T05:00:00.000Z");
});

test("Meta token encryption uses authenticated encryption and round-trips", async () => {
    const encrypted = await encryptSecret("page-token-secret", TEST_KEY);
    assert.notEqual(encrypted.ciphertext, "page-token-secret");
    assert.equal(await decryptSecret(encrypted.ciphertext, encrypted.iv, TEST_KEY), "page-token-secret");
    await assert.rejects(decryptSecret(encrypted.ciphertext, encrypted.iv, btoa("bad")), /32 byte/);
});

test("Gemini image generation sends the reference and extracts returned image bytes", async () => {
    const originalFetch = globalThis.fetch;
    const outputBytes = new Uint8Array([137, 80, 78, 71]);
    let requestBody;
    globalThis.fetch = async (url, options) => {
        assert.match(String(url), /generativelanguage\.googleapis\.com\/v1beta\/interactions/);
        requestBody = JSON.parse(options.body);
        return Response.json({
            steps: [{
                type: "model_output",
                content: [{ type: "image", mime_type: "image/png", data: btoa(String.fromCharCode(...outputBytes)) }]
            }]
        });
    };
    try {
        const result = await generateSocialImage({
            env: { GEMINI_API_KEY: "test-key" },
            prompt: "photorealistic test prompt",
            referenceBytes: new Uint8Array([1, 2, 3]),
            referenceMimeType: "image/jpeg",
            aspectRatio: "16:9"
        });
        assert.equal(requestBody.model, "gemini-3.1-flash-lite-image");
        assert.equal(requestBody.input[0].type, "image");
        assert.equal(requestBody.input[1].text, "photorealistic test prompt");
        assert.equal(requestBody.response_format.mime_type, "image/jpeg");
        assert.equal(requestBody.response_format.aspect_ratio, "16:9");
        assert.deepEqual([...result.bytes], [...outputBytes]);
        assert.equal(result.model, "gemini-3.1-flash-lite-image");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Gemini image generation preserves quota HTTP 429 and explains zero free-tier quota", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({
        error: {
            message: "Rate limit exceeded for model gemini-3.1-flash-lite-image (limit: 0 requests per day on Free Tier)."
        }
    }, { status: 429 });
    try {
        await assert.rejects(
            generateSocialImage({
                env: { GEMINI_API_KEY: "test-key" },
                prompt: "test image"
            }),
            error => {
                assert.equal(error.status, 429);
                assert.match(error.message, /limit: 0 requests per day on Free Tier/);
                assert.match(error.message, /upgrade tier atau gunakan API key dengan kuota aktif/i);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Cloudflare Workers AI sends private person and garment URLs to P-Image Try-On", async () => {
    const outputBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    let model;
    let input;
    const result = await generateSocialImage({
        env: {
            AI: {
                async run(modelId, parameters) {
                    model = modelId;
                    input = parameters;
                    return { image: outputBytes };
                }
            }
        },
        prompt: "Keep the same character in a city cafe.",
        personImageUrl: "https://storage.example/person?token=person-token",
        garmentImageUrls: ["https://storage.example/garment?token=garment-token"],
        aspectRatio: "16:9",
        imageProvider: "cloudflare"
    });

    assert.equal(model, "pruna/p-image-try-on");
    assert.equal(input.person_image, "https://storage.example/person?token=person-token");
    assert.deepEqual(input.garment_images, ["https://storage.example/garment?token=garment-token"]);
    assert.deepEqual([...result.bytes], [...outputBytes]);
    assert.equal(result.mimeType, "image/png");
    assert.equal(result.model, model);
});

test("Cloudflare tanpa foto pakaian memakai model teks-ke-gambar gratis, bukan try-on", async () => {
    const calls = [];
    const outputBytes = new Uint8Array([255, 216, 255, 0]);
    const result = await generateSocialImage({
        env: {
            AI: {
                async run(model, parameters) {
                    calls.push({ model, parameters });
                    return { image: Buffer.from(outputBytes).toString("base64") };
                }
            }
        },
        prompt: "Karakter di taman kota",
        imageProvider: "cloudflare",
        personImageUrl: "https://storage.example/person?token=person-token",
        garmentImageUrls: []
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, "@cf/black-forest-labs/flux-1-schnell");
    assert.equal(result.model, "@cf/black-forest-labs/flux-1-schnell");
    assert.deepEqual([...result.bytes], [...outputBytes]);
    assert.match(result.warnings.join(" "), /try-on Pruna dilewati/i);
});

test("Cloudflare Workers AI supports streamed image output", async () => {
    const outputBytes = new Uint8Array([255, 216, 255, 0]);
    const result = await generateSocialImage({
        env: {
            AI: {
                async run() {
                    return new ReadableStream({
                        start(controller) {
                            controller.enqueue(outputBytes.subarray(0, 2));
                            controller.enqueue(outputBytes.subarray(2));
                            controller.close();
                        }
                    });
                }
            }
        },
        prompt: "try-on test",
        referenceBytes: new Uint8Array([1]),
        personImageUrl: "https://storage.example/person?token=person-token",
        garmentImageUrls: ["https://storage.example/garment?token=garment-token"],
        imageProvider: "cloudflare"
    });
    assert.deepEqual([...result.bytes], [...outputBytes]);
    assert.equal(result.mimeType, "image/jpeg");
});

test("Cloudflare Workers AI decodes base64 image output", async () => {
    const jpegBytes = new Uint8Array([255, 216, 255, 1]);
    const result = await generateSocialImage({
        env: {
            AI: {
                async run() {
                    return { image: btoa(String.fromCharCode(...jpegBytes)) };
                }
            }
        },
        prompt: "try-on",
        referenceBytes: new Uint8Array([1]),
        personImageUrl: "https://storage.example/person?token=person-token",
        garmentImageUrls: ["https://storage.example/garment?token=garment-token"],
        imageProvider: "cloudflare"
    });
    assert.deepEqual([...result.bytes], [...jpegBytes]);
    assert.equal(result.mimeType, "image/jpeg");
});

test("Cloudflare Workers AI creates contextual captions without a Gemini API key", async () => {
    let model;
    let input;
    const caption = await generateSocialContextCaption({
        env: {
            AI: {
                async run(modelId, parameters) {
                    model = modelId;
                    input = parameters;
                    return { response: '"Hai guys, menikmati suasana sore di taman."' };
                }
            }
        },
        imageBytes: new Uint8Array([1, 2, 3]),
        imageMimeType: "image/jpeg",
        characterName: "Alya",
        scene: { location: "taman" },
        imageProvider: "cloudflare"
    });

    assert.equal(model, "@cf/meta/llama-3.2-11b-vision-instruct");
    assert.deepEqual(input.image, [1, 2, 3]);
    assert.match(input.prompt, /konteks/);
    assert.equal(input.max_tokens, 80);
    assert.equal(caption, "Hai guys, menikmati suasana sore di taman.");
});

test("Gemini context caption provider requests one concise Indonesian sentence", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody;
    globalThis.fetch = async (url, options) => {
        assert.match(String(url), /generativelanguage\.googleapis\.com\/v1beta\/interactions$/);
        requestBody = JSON.parse(options.body);
        return Response.json({
            steps: [{ type: "model_output", content: [{ type: "text", text: '"Hai guys, lagi menikmati suasana sore."' }] }]
        });
    };
    try {
        const caption = await generateSocialContextCaption({
            env: { GEMINI_API_KEY: "test-key" },
            imageBytes: new Uint8Array([1, 2, 3]),
            imageMimeType: "image/png",
            characterName: "Alya",
            scene: { location: "taman" }
        });
        assert.equal(caption, "Hai guys, lagi menikmati suasana sore.");
        assert.equal(requestBody.model, "gemini-3.8-flash");
        assert.equal(requestBody.input[0].type, "image");
        assert.equal(requestBody.input[0].mime_type, "image/png");
        assert.match(requestBody.input[1].text, /konteks/);
        assert.equal(requestBody.generation_config.max_output_tokens, 80);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Facebook photo publish checks Page permissions before uploading and returns a share URL", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
        const target = String(url);
        calls.push({ url: target, options });
        if (target.includes("/123456?") && target.includes("fields=id%2Cname%2Ctasks")) {
            return Response.json({ id: "123456", name: "GEN-Z Page", tasks: ["CREATE_CONTENT", "MODERATE"] });
        }
        if (target.endsWith("/123456/photos")) {
            return Response.json({ id: "photo-1", post_id: "page-1_post-1" });
        }
        return Response.json({ permalink_url: "https://www.facebook.com/page-1/posts/post-1" });
    };
    try {
        const result = await publishFacebookPhoto({
            env: { META_GRAPH_VERSION: "v26.0" },
            pageId: "123456",
            pageAccessToken: "secret-token",
            caption: "Test caption",
            imageBytes: new Uint8Array([1, 2, 3]),
            imageMimeType: "image/png"
        });
        assert.equal(result.photoId, "photo-1");
        assert.equal(result.postId, "page-1_post-1");
        assert.equal(result.permalinkUrl, "https://www.facebook.com/page-1/posts/post-1");
        assert.match(calls[0].url, /123456\?fields=id%2Cname%2Ctasks/);
        assert.match(calls[0].url, /access_token=secret-token/);
        const upload = calls.find(call => call.url.endsWith("/123456/photos"));
        assert.ok(upload, "photo upload must happen after the permission check");
        assert.equal(upload.options.body.get("caption"), "Test caption");
        assert.ok(upload.options.body.get("source") instanceof Blob);
        assert.match(makeProfileShareUrl(result.permalinkUrl), /sharer\/sharer\.php/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Facebook photo publish stops before uploading when the Page lacks CREATE_CONTENT", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(String(url));
        return Response.json({ id: "123456", name: "GEN-Z Page", tasks: ["MODERATE"] });
    };
    try {
        await assert.rejects(
            () => publishFacebookPhoto({
                env: { META_GRAPH_VERSION: "v26.0" },
                pageId: "123456",
                pageAccessToken: "secret-token",
                caption: "Test caption",
                imageBytes: new Uint8Array([1, 2, 3]),
                imageMimeType: "image/png"
            }),
            error => {
                assert.equal(error.code, "missing_page_role");
                assert.equal(error.needsReconnect, true);
                assert.match(error.message, /CREATE_CONTENT/);
                return true;
            }
        );
        assert.equal(calls.filter(url => url.endsWith("/photos")).length, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Facebook photo publish explains a #200 permission error instead of failing generically", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
        const target = String(url);
        if (target.includes("fields=id%2Cname%2Ctasks")) {
            return Response.json({ id: "123456", name: "GEN-Z Page", tasks: ["CREATE_CONTENT"] });
        }
        return Response.json(
            { error: { message: "(#200) Permissions error", type: "OAuthException", code: 200 } },
            { status: 403 }
        );
    };
    try {
        await assert.rejects(
            () => publishFacebookPhoto({
                env: { META_GRAPH_VERSION: "v26.0" },
                pageId: "123456",
                pageAccessToken: "secret-token",
                caption: "Test caption",
                imageBytes: new Uint8Array([1, 2, 3]),
                imageMimeType: "image/png"
            }),
            error => {
                assert.equal(error.code, "permission_denied");
                assert.equal(error.status, 403);
                assert.equal(error.graphCode, 200);
                assert.equal(error.needsReconnect, true);
                assert.equal(error.retrySafe, true);
                assert.match(error.message, /pages_manage_posts/);
                assert.match(error.message, /Permissions error/);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Facebook photo publish marks ambiguous failures as unsafe to retry", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
        const target = String(url);
        if (target.includes("fields=id%2Cname%2Ctasks")) {
            return Response.json({ id: "123456", name: "GEN-Z Page", tasks: ["CREATE_CONTENT"] });
        }
        return new Response("upstream error", { status: 503 });
    };
    try {
        await assert.rejects(
            () => publishFacebookPhoto({
                env: { META_GRAPH_VERSION: "v26.0" },
                pageId: "123456",
                pageAccessToken: "secret-token",
                caption: "Test caption",
                imageBytes: new Uint8Array([1, 2, 3]),
                imageMimeType: "image/png"
            }),
            error => {
                assert.equal(error.code, "facebook_unavailable");
                assert.equal(error.retrySafe, false);
                assert.match(error.message, /post ganda/);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("reference storage uses a private Supabase bucket and server-side service-role API", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    const sourceBytes = new Uint8Array([255, 216, 255, 0]);
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (calls.length === 1) return Response.json({ id: SOCIAL_REFERENCE_STORAGE_BUCKET, public: false });
        if (calls.length === 2 || calls.length === 5) return new Response(null, { status: 200 });
        if (calls.length === 3) return new Response(sourceBytes, { status: 200, headers: { "Content-Type": "image/jpeg" } });
        if (calls.length === 4) return Response.json({ signedURL: "/object/sign/social-character-references/social-reference/user-1/ref-1.jpg?token=short-lived" });
        return new Response(null, { status: 200 });
    };
    const config = { url: "https://project.example", serviceRoleKey: "server-only-test-key" };
    const key = "social-reference/user-1/ref-1.jpg";
    try {
        assert.equal(await isPrivateReferenceBucket(config), true);
        await uploadReferenceObject(config, key, sourceBytes, "image/jpeg");
        const downloaded = await downloadReferenceObject(config, key);
        const signedUrl = await createSignedReferenceUrl(config, key);
        await deleteReferenceObject(config, key);

        assert.deepEqual([...downloaded], [...sourceBytes]);
        assert.equal(signedUrl, "https://project.example/storage/v1/object/sign/social-character-references/social-reference/user-1/ref-1.jpg?token=short-lived");
        assert.match(calls[0].url, /\/storage\/v1\/bucket\/social-character-references$/);
        assert.match(calls[1].url, /\/storage\/v1\/object\/social-character-references\/social-reference\/user-1\/ref-1\.jpg$/);
        assert.match(calls[2].url, /\/storage\/v1\/object\/authenticated\/social-character-references\/social-reference\/user-1\/ref-1\.jpg$/);
        assert.equal(calls[1].options.method, "POST");
        assert.equal(calls[1].options.headers["Content-Type"], "image/jpeg");
        assert.equal(calls[1].options.headers["x-upsert"], "false");
        assert.equal(calls[1].options.headers.Authorization, "Bearer server-only-test-key");
        assert.deepEqual(JSON.parse(calls[4].options.body), { prefixes: [key] });
        assert.equal(calls[4].options.method, "DELETE");
        assert.match(calls[3].url, /\/storage\/v1\/object\/sign\/social-character-references\/social-reference\/user-1\/ref-1\.jpg$/);
        assert.deepEqual(JSON.parse(calls[3].options.body), { expiresIn: 600 });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("reference storage rejects public buckets and unsafe object paths", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ id: SOCIAL_REFERENCE_STORAGE_BUCKET, public: true });
    try {
        assert.equal(await isPrivateReferenceBucket({ url: "https://project.example", serviceRoleKey: "test" }), false);
        await assert.rejects(
            downloadReferenceObject({ url: "https://project.example", serviceRoleKey: "test" }, "../unsafe.jpg"),
            /Invalid reference object path/
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud sends reference and garment data URLs to the default qwen-image-3.0-pro", async () => {
    const outputBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const referenceBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
    const garmentBytes = new Uint8Array([137, 80, 78, 71, 5, 6, 7, 8]);
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        calls.push({ url, options });
        if (url.endsWith("/services/aigc/multimodal-generation/generation")) {
            return Response.json({
                output: {
                    choices: [{ message: { content: [{ image: "https://result.example/out.png" }] } }]
                }
            });
        }
        if (url === "https://result.example/out.png") return new Response(outputBytes);
        throw new Error(`Unexpected fetch: ${url}`);
    };
    try {
        const result = await generateSocialImage({
            env: { QWENCLOUD_API_KEY: "sk-qwencloud-test" },
            prompt: "Keep the same character in a city cafe.",
            referenceBytes,
            referenceMimeType: "image/png",
            garmentBytes,
            garmentMimeType: "image/png",
            aspectRatio: "9:16",
            imageProvider: "qwencloud"
        });
        const body = JSON.parse(calls[0].options.body);
        assert.equal(calls[0].url, "https://maas.qwencloudapi.com/api/v1/services/aigc/multimodal-generation/generation");
        assert.equal(calls[0].options.headers.Authorization, "Bearer sk-qwencloud-test");
        assert.equal(body.model, "qwen-image-3.0-pro");
        assert.equal(body.parameters.size, "1152*2048");
        assert.equal(body.parameters.watermark, false);
        const content = body.input.messages[0].content;
        assert.equal(content.length, 3);
        assert.match(content[0].image, /^data:image\/png;base64,/);
        assert.match(content[1].image, /^data:image\/png;base64,/);
        assert.equal(content[2].text, "Keep the same character in a city cafe.");
        assert.deepEqual([...result.bytes], [...outputBytes]);
        assert.equal(result.mimeType, "image/png");
        assert.equal(result.model, "qwen-image-3.0-pro");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud image generation maps provider failures to safe statuses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ message: "Invalid API key provided." }, { status: 401 });
    try {
        await assert.rejects(
            generateSocialImage({
                env: { QWENCLOUD_API_KEY: "sk-bad" },
                prompt: "p",
                referenceBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
                referenceMimeType: "image/png",
                imageProvider: "qwencloud"
            }),
            error => {
                assert.equal(error.status, 401);
                assert.match(error.message, /QwenCloud image generation gagal/);
                assert.match(error.message, /Invalid API key provided/);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud caption uses qwen3-vl-plus and strips hashtags and links", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        calls.push({ url, options });
        return Response.json({
            output: {
                choices: [{ message: { content: [{ text: "Hai guys, suasana kafe sore ini seru banget #cafe https://contoh.com" }] } }]
            }
        });
    };
    try {
        const caption = await generateSocialContextCaption({
            env: { QWENCLOUD_API_KEY: "sk-qwencloud-test" },
            imageBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
            imageMimeType: "image/png",
            characterName: "bela",
            scene: { location: "kafe" },
            imageProvider: "qwencloud"
        });
        const body = JSON.parse(calls[0].options.body);
        assert.equal(body.model, "qwen3-vl-plus");
        assert.equal(body.input.messages[0].content.length, 2);
        assert.match(body.input.messages[0].content[0].image, /^data:image\/png;base64,/);
        assert.equal(caption, "Hai guys, suasana kafe sore ini seru banget");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud honors the configured image model from the dropdown", async () => {
    const originalFetch = globalThis.fetch;
    let body;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/services/aigc/multimodal-generation/generation")) {
            body = JSON.parse(options.body);
            return Response.json({
                output: { choices: [{ message: { content: [{ image: "https://result.example/x.png" }] } }] }
            });
        }
        if (url === "https://result.example/x.png") return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
        throw new Error(`Unexpected fetch: ${url}`);
    };
    try {
        const result = await generateSocialImage({
            env: { QWENCLOUD_API_KEY: "sk-test" },
            prompt: "p",
            referenceBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
            referenceMimeType: "image/png",
            imageProvider: "qwencloud",
            imageModel: "qwen-image-2.1-pro"
        });
        assert.equal(body.model, "qwen-image-2.1-pro");
        assert.equal(result.model, "qwen-image-2.1-pro");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud quota exhaustion is surfaced as 429 with guidance", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ message: "AllocationQuota.FreeTierOnly" }, { status: 400 });
    try {
        await assert.rejects(
            generateSocialImage({
                env: { QWENCLOUD_API_KEY: "sk-test" },
                prompt: "p",
                referenceBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
                referenceMimeType: "image/png",
                imageProvider: "qwencloud"
            }),
            error => {
                assert.equal(error.status, 429);
                assert.equal(error.quotaExhausted, true);
                assert.match(error.message, /Kuota tier model ini habis/);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud falls back to the async image-generation protocol on url error", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        calls.push({ url, options });
        if (url.endsWith("/services/aigc/multimodal-generation/generation")) {
            return Response.json({ code: "InvalidParameter", message: "url error, please check url!" }, { status: 400 });
        }
        if (url.endsWith("/services/aigc/image-generation/generation")) {
            return Response.json({ output: { task_id: "task-123", task_status: "PENDING" } });
        }
        if (url.endsWith("/tasks/task-123")) {
            return Response.json({
                output: {
                    task_status: "SUCCEEDED",
                    choices: [{ message: { content: [{ image: "https://result.example/async.png" }] } }]
                }
            });
        }
        if (url === "https://result.example/async.png") return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
        throw new Error(`Unexpected fetch: ${url}`);
    };
    try {
        const result = await generateSocialImage({
            env: { QWENCLOUD_API_KEY: "sk-test" },
            prompt: "p",
            referenceBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
            referenceMimeType: "image/png",
            imageProvider: "qwencloud",
            imageModel: "qwen-image-3.0-pro"
        });
        assert.match(calls[0].url, /multimodal-generation\/generation$/);
        assert.match(calls[1].url, /image-generation\/generation$/);
        assert.equal(calls[1].options.headers["X-DashScope-Async"], "enable");
        assert.match(calls[2].url, /\/tasks\/task-123$/);
        assert.equal(result.model, "qwen-image-3.0-pro");
        assert.equal(result.mimeType, "image/png");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud wan and third-party image models start with the async protocol", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        calls.push({ url, options });
        if (url.endsWith("/services/aigc/image-generation/generation")) {
            return Response.json({ output: { task_id: "task-wan", task_status: "PENDING" } });
        }
        if (url.endsWith("/tasks/task-wan")) {
            return Response.json({ output: { task_status: "SUCCEEDED", results: [{ url: "https://result.example/wan.png" }] } });
        }
        if (url === "https://result.example/wan.png") return new Response(new Uint8Array([255, 216, 255, 0]));
        throw new Error(`Unexpected fetch: ${url}`);
    };
    try {
        const result = await generateSocialImage({
            env: { QWENCLOUD_API_KEY: "sk-test" },
            prompt: "p",
            referenceBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
            referenceMimeType: "image/png",
            imageProvider: "qwencloud",
            imageModel: "wan2.7-image-pro"
        });
        assert.match(calls[0].url, /image-generation\/generation$/);
        assert.equal(calls.some(call => /multimodal-generation/.test(call.url)), false);
        assert.equal(result.mimeType, "image/jpeg");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("QwenCloud async task failure surfaces the task message", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async input => {
        const url = String(input);
        if (url.endsWith("/services/aigc/image-generation/generation")) {
            return Response.json({ output: { task_id: "task-fail", task_status: "PENDING" } });
        }
        if (url.endsWith("/tasks/task-fail")) {
            return Response.json({ output: { task_status: "FAILED", message: "Model inference error" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
    try {
        await assert.rejects(
            generateSocialImage({
                env: { QWENCLOUD_API_KEY: "sk-test" },
                prompt: "p",
                referenceBytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
                referenceMimeType: "image/png",
                imageProvider: "qwencloud",
                imageModel: "wan2.7-image-pro"
            }),
            /Model inference error/
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});
