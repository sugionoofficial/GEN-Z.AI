import test from "node:test";
import assert from "node:assert/strict";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";
import { encryptSecret } from "../lib/social-publisher/providers.js";

function pngChunk(type, data = new Uint8Array()) {
    const chunk = new Uint8Array(data.length + 12);
    new DataView(chunk.buffer).setUint32(0, data.length);
    chunk.set([...type].map(character => character.charCodeAt(0)), 4);
    chunk.set(data, 8);
    return chunk;
}

function pngWithMetadata() {
    const parts = [
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", new Uint8Array(13)),
        pngChunk("tEXt", new TextEncoder().encode("Comment\0GPS=private")),
        pngChunk("IDAT"),
        pngChunk("IEND")
    ];
    const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

test("Social Publisher cron cleans metadata and composes user caption before autopublishing", async () => {
    const originalFetch = globalThis.fetch;
    const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(8)));
    const encryptedToken = await encryptSecret("page-token-secret", encryptionKey);
    const generatedPng = pngWithMetadata();
    const patches = [];
    let postedCaption = "";
    let postedImageText = "";
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/rest/v1/rpc/claim_due_social_post_schedules")) {
            return Response.json([{ run_id: "run-1", schedule_id: "schedule-1" }]);
        }
        if (url.includes("/rest/v1/social_post_schedules?")) {
            return Response.json([{
                id: "schedule-1",
                owner_id: "owner-1",
                character_id: "character-1",
                page_connection_id: "connection-1",
                enabled: true,
                interval_hours: 24,
                aspect_ratio: "16:9",
                caption_template: "Schedule fallback",
                timezone: "Asia/Jakarta"
            }]);
        }
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-1",
                display_name: "Alya",
                reference_object_key: "social-reference/owner-1/reference.jpg",
                reference_mime_type: "image/jpeg",
                garment_object_key: "social-garment/owner-1/garment.png",
                prompt_notes: "Rambut bob"
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) {
            return Response.json([{
                id: "connection-1",
                page_id: "page-123",
                page_name: "GEN-Z Page",
                can_publish: true,
                page_token_ciphertext: encryptedToken.ciphertext,
                page_token_iv: encryptedToken.iv
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?select=scene_plan")) return Response.json([]);
        if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_user_settings?")) {
            return Response.json([{
                caption_template: "Base {location} #GENZAI",
                external_link: "https://example.com/promo"
            }]);
        }
        if (url.includes("/rest/v1/social_publisher_config?select=image_provider")) {
            return Response.json([{ image_provider: "cloudflare" }]);
        }
        if (url.endsWith("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/storage/v1/object/authenticated/social-character-references/")) {
            return new Response(new Uint8Array([255, 216, 255, 0]), { status: 200 });
        }
        if (url.includes("/storage/v1/object/sign/social-character-references/")) {
            const objectKey = url.includes("social-garment")
                ? "social-garment/owner-1/garment.png"
                : "social-reference/owner-1/reference.jpg";
            return Response.json({ signedURL: `/object/sign/social-character-references/${objectKey}?token=short-lived` });
        }
        if (url.includes("graph.facebook.com/v26.0/page-123?fields=id%2Cname%2Ctasks")) {
            return Response.json({ id: "page-123", name: "GEN-Z Page", tasks: ["CREATE_CONTENT"] });
        }
        if (url.includes("graph.facebook.com/v26.0/page-123/photos")) {
            postedCaption = options.body.get("caption");
            postedImageText = await options.body.get("source").text();
            return Response.json({ id: "photo-1", post_id: "page-123_post-1" });
        }
        if (url.includes("/page-123_post-1?fields=permalink_url")) {
            return Response.json({ permalink_url: "https://www.facebook.com/page-123/posts/post-1" });
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.run-1")) {
            patches.push(JSON.parse(options.body));
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
        const result = await runSocialPublisherCron({
            SUPABASE_URL: "https://project.example",
            SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
            SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKey,
            AI: {
                async run(model, input) {
                    if (model === "pruna/p-image-try-on") {
                        assert.match(input.person_image, /\/social-reference\/owner-1\/reference\.jpg\?token=short-lived$/);
                        assert.deepEqual(input.garment_images, [
                            "https://project.example/storage/v1/object/sign/social-character-references/social-garment/owner-1/garment.png?token=short-lived"
                        ]);
                        return { image: btoa(String.fromCharCode(...generatedPng)) };
                    }
                    assert.equal(model, "@cf/meta/llama-3.2-11b-vision-instruct");
                    assert.match(input.prompt, /konteks/);
                    return { response: "Hai guys, lagi menikmati suasana sore." };
                }
            }
        });

        assert.deepEqual(result, { claimed: 1, skipped: false });
        assert.match(postedCaption, /Base/);
        assert.match(postedCaption, /Hai guys/);
        assert.match(postedCaption, /https:\/\/example\.com\/promo/);
        assert.match(postedCaption, /#GENZAI/);
        assert.doesNotMatch(postedImageText, /GPS=private/);
        assert.equal(patches.at(-1).status, "posted");
        assert.equal(patches.at(-1).caption, postedCaption);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
