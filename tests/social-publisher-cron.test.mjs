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
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "owner-1",
                is_active: true,
                started_at: new Date(Date.now() - 86400000).toISOString(),
                expires_at: new Date(Date.now() + 30 * 86400000).toISOString()
            }]);
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
            return Response.json({ signedURL: "/object/sign/social-character-references/social-reference/owner-1/reference.jpg?token=short-lived" });
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
                        /* Tanpa outfit, pakaian default mengikuti foto referensi karakter. */
                        assert.deepEqual(input.garment_images, [
                            "https://project.example/storage/v1/object/sign/social-character-references/social-reference/owner-1/reference.jpg?token=short-lived"
                        ]);
                        return { image: btoa(String.fromCharCode(...generatedPng)) };
                    }
                    assert.equal(model, "@cf/meta/llama-3.2-11b-vision-instruct");
                    assert.match(input.prompt, /konteks/);
                    return { response: "Hai guys, lagi menikmati suasana sore." };
                }
            }
        });

        assert.deepEqual(result, { claimed: 1, resumed: 0, swept: { auto: 0, manual: 0 }, skipped: false });
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

test("Social Publisher cron stops autopublish and pauses the schedule when the subscription has expired", async () => {
    const originalFetch = globalThis.fetch;
    const runPatches = [];
    const schedulePatches = [];
    let generated = false;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/rest/v1/rpc/claim_due_social_post_schedules")) {
            return Response.json([{ run_id: "run-1", schedule_id: "schedule-1" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "owner-1",
                is_active: true,
                started_at: "2026-08-01T00:00:00.000Z",
                expires_at: "2026-08-31T00:00:00.000Z"
            }]);
        }
        if (url.includes("/rest/v1/social_post_schedules?")) {
            if (options.method === "PATCH") {
                schedulePatches.push({ url, body: JSON.parse(options.body) });
                return new Response(null, { status: 204 });
            }
            return Response.json([{
                id: "schedule-1",
                owner_id: "owner-1",
                character_id: "character-1",
                page_connection_id: "connection-1",
                enabled: true,
                interval_hours: 24,
                aspect_ratio: "9:16",
                caption_template: "Schedule fallback",
                timezone: "Asia/Jakarta"
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.run-1")) {
            runPatches.push(JSON.parse(options.body));
            return new Response(null, { status: 204 });
        }
        if (url.includes("/rest/v1/social_characters?")) {
            generated = true;
            throw new Error(`Unexpected fetch: ${url}`);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
        const result = await runSocialPublisherCron({
            SUPABASE_URL: "https://project.example",
            SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key"
        });

        assert.deepEqual(result, { claimed: 1, resumed: 0, swept: { auto: 0, manual: 0 }, skipped: false });
        assert.equal(generated, false);
        assert.equal(schedulePatches.length, 1);
        assert.equal(schedulePatches[0].body.enabled, false);
        assert.equal(schedulePatches[0].body.paused_reason, "subscription_inactive");
        assert.equal(runPatches.at(-1).status, "failed");
        assert.match(runPatches.at(-1).error_message, /Langganan Studio Medsos berakhir/);
        assert.match(runPatches.at(-1).error_message, /Auto publish dijeda otomatis/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
