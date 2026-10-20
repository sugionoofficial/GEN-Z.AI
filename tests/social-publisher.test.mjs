import test from "node:test";
import assert from "node:assert/strict";
import {
    buildImagePrompt,
    clampIntervalHours,
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
    assert.equal(clampIntervalHours(1), 1);
    assert.equal(clampIntervalHours(168), 168);
    assert.equal(clampIntervalHours(0), null);
    assert.equal(clampIntervalHours(1.5), null);
    assert.equal(clampIntervalHours(169), null);
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

test("Gemini context caption provider requests one concise Indonesian sentence", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody;
    globalThis.fetch = async (url, options) => {
        assert.match(String(url), /gemini-2\.5-flash:generateContent/);
        requestBody = JSON.parse(options.body);
        return Response.json({
            candidates: [{ content: { parts: [{ text: '"Hai guys, lagi menikmati suasana sore."' }] } }]
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
        assert.match(requestBody.contents[0].parts[1].text, /konteks/);
        assert.equal(requestBody.generationConfig.maxOutputTokens, 80);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Facebook photo publish uploads image and returns a personal-share URL", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (calls.length === 1) return Response.json({ id: "photo-1", post_id: "page-1_post-1" });
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
        assert.match(calls[0].url, /123456\/photos$/);
        assert.equal(calls[0].options.body.get("caption"), "Test caption");
        assert.ok(calls[0].options.body.get("source") instanceof Blob);
        assert.match(makeProfileShareUrl(result.permalinkUrl), /sharer\/sharer\.php/);
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
        if (calls.length === 2 || calls.length === 4) return new Response(null, { status: 200 });
        return new Response(sourceBytes, { status: 200, headers: { "Content-Type": "image/jpeg" } });
    };
    const config = { url: "https://project.example", serviceRoleKey: "server-only-test-key" };
    const key = "social-reference/user-1/ref-1.jpg";
    try {
        assert.equal(await isPrivateReferenceBucket(config), true);
        await uploadReferenceObject(config, key, sourceBytes, "image/jpeg");
        const downloaded = await downloadReferenceObject(config, key);
        await deleteReferenceObject(config, key);

        assert.deepEqual([...downloaded], [...sourceBytes]);
        assert.match(calls[0].url, /\/storage\/v1\/bucket\/social-character-references$/);
        assert.match(calls[1].url, /\/storage\/v1\/object\/social-character-references\/social-reference\/user-1\/ref-1\.jpg$/);
        assert.match(calls[2].url, /\/storage\/v1\/object\/authenticated\/social-character-references\/social-reference\/user-1\/ref-1\.jpg$/);
        assert.equal(calls[1].options.method, "POST");
        assert.equal(calls[1].options.headers["Content-Type"], "image/jpeg");
        assert.equal(calls[1].options.headers["x-upsert"], "false");
        assert.equal(calls[1].options.headers.Authorization, "Bearer server-only-test-key");
        assert.deepEqual(JSON.parse(calls[3].options.body), { prefixes: [key] });
        assert.equal(calls[3].options.method, "DELETE");
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
