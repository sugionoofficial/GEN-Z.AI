import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import socialPublisherHandler from "../api/social-publisher.js";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";
import { encryptSecret } from "../lib/social-publisher/providers.js";
import {
    applyOutfitToScene,
    buildImagePrompt,
    composeSocialCaption,
    pickRandomOutfit
} from "../lib/social-publisher/utils.js";

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    SUPABASE_ANON_KEY: "anon-test-key"
};

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIGRATION = readFileSync(
    fileURLToPath(new URL("../supabase/social-auto-publisher.sql", import.meta.url)),
    "utf8"
);

function makeResponse() {
    return {
        statusCode: 0,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        end(value) { this.body = value; return this; }
    };
}

function activeAccessRow() {
    return Response.json([{
        user_id: "owner-1",
        is_active: true,
        duration_days: 30,
        started_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    }]);
}

function mockAuthAndFetch(fetchHandler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "owner-1" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "owner-1", role: "OWNER", status: "active" }]);
        }
        return fetchHandler(url, options);
    };
    return () => {
        globalThis.fetch = originalFetch;
    };
}

function withRandom(value, callback) {
    const original = Math.random;
    Math.random = () => value;
    try {
        return callback();
    } finally {
        Math.random = original;
    }
}

test("random outfit picker only uses active outfits and rotates away from recent picks", () => {
    const outfits = [
        { id: "outfit-a", name: "Aurora Linen", is_active: true },
        { id: "outfit-b", name: "Senja Knit", is_active: true },
        { id: "outfit-c", name: "Arsip Lama", is_active: false }
    ];

    assert.equal(pickRandomOutfit(outfits, [], () => 0).id, "outfit-a");
    assert.equal(pickRandomOutfit(outfits, [], () => 0.99).id, "outfit-b");
    assert.equal(pickRandomOutfit(outfits, ["outfit-a"], () => 0).id, "outfit-b");
    assert.equal(pickRandomOutfit([outfits[2]], [], () => 0), null);
    assert.equal(pickRandomOutfit([], [], () => 0), null);
    // All fresh options are exhausted: fall back to the full active pool.
    assert.equal(pickRandomOutfit(outfits, ["outfit-a", "outfit-b"], () => 0.6).id, "outfit-b");
});

test("the selected outfit is written into the scene so {outfit} templates agree", () => {
    const scene = {
        location: "a café",
        angle: "portrait",
        outfit: "a generic random outfit",
        situation: "reading",
        lighting: "soft light",
        key: "old-key"
    };
    const next = applyOutfitToScene(scene, { name: "Aurora Linen" });
    assert.equal(next.outfit, "Aurora Linen");
    assert.notEqual(next.key, "old-key");
    assert.match(next.key, /Aurora Linen/);
    // No outfit selected keeps the generated scene untouched.
    assert.deepEqual(applyOutfitToScene(scene, null), scene);
});

test("caption includes the outfit name and order link before hashtags", () => {
    const caption = composeSocialCaption({
        baseCaption: "Cerita hari ini #GENZAI",
        contextualCaption: "Hai guys, lagi menikmati sore.",
        externalLink: "https://example.com/promo",
        outfit: { name: "Aurora Linen", order_url: "https://shop.example.com/aurora" }
    });

    assert.equal(
        caption,
        "Cerita hari ini\n\nHai guys, lagi menikmati sore.\n\n✨ Outfit: Aurora Linen\n🛍️ Order di sini: https://shop.example.com/aurora\n\nhttps://example.com/promo\n\n#GENZAI"
    );
});

test("caption rejects insecure order links and never duplicates the same URL", () => {
    const insecure = composeSocialCaption({
        baseCaption: "Halo",
        contextualCaption: "Kata AI.",
        externalLink: "",
        outfit: { name: "Aurora Linen", order_url: "http://shop.example.com/aurora" }
    });
    assert.equal(insecure, "Halo\n\nKata AI.\n\n✨ Outfit: Aurora Linen");
    assert.doesNotMatch(insecure, /http:\/\/shop/);

    const shared = composeSocialCaption({
        baseCaption: "Halo",
        contextualCaption: "Kata AI.",
        externalLink: "https://shop.example.com/aurora",
        outfit: { name: "Aurora Linen", order_url: "https://shop.example.com/aurora" }
    });
    assert.equal(
        shared.match(/https:\/\/shop\.example\.com\/aurora/g)?.length,
        1,
        "order link must appear once even when it is also the external link"
    );

    // Existing caption behaviour without an outfit stays identical.
    assert.equal(
        composeSocialCaption({
            baseCaption: "Lagi santai #outfit #GENZAI",
            contextualCaption: "Hai guys, lagi menikmati kopi.",
            externalLink: "https://example.com/promo"
        }),
        "Lagi santai\n\nHai guys, lagi menikmati kopi.\n\nhttps://example.com/promo\n\n#outfit #GENZAI"
    );
});

test("image prompt describes the chosen outfit and honours the garment reference", () => {
    const scene = {
        location: "a café",
        angle: "portrait",
        outfit: "generic wardrobe",
        situation: "reading",
        lighting: "soft light"
    };
    const referenced = buildImagePrompt({
        characterName: "Alya",
        scene,
        outfitName: "Aurora Linen",
        outfitNotes: "linen krem, potongan longgar",
        hasOutfitReference: true
    });
    assert.match(referenced, /outfit reference image \("Aurora Linen"\)/);
    assert.match(referenced, /linen krem, potongan longgar/);
    assert.match(referenced, /do not redesign it/);

    const described = buildImagePrompt({
        characterName: "Alya",
        scene,
        outfitName: "Aurora Linen",
        outfitNotes: "linen krem",
        hasOutfitReference: false
    });
    assert.match(described, /Wardrobe: Aurora Linen — linen krem/);
    assert.doesNotMatch(described, /generic wardrobe/);

    const fallback = buildImagePrompt({ characterName: "Alya", scene });
    assert.match(fallback, /generic wardrobe/);
});

test("migration adds the outfit library and the run snapshot columns", () => {
    assert.match(MIGRATION, /create table if not exists public\.social_outfits/);
    assert.match(MIGRATION, /order_url text not null default ''/);
    assert.match(MIGRATION, /is_active boolean not null default true/);
    assert.match(MIGRATION, /add column if not exists outfit_id uuid/);
    assert.match(MIGRATION, /add column if not exists outfit_name text/);
    assert.match(MIGRATION, /add column if not exists outfit_order_url text/);
    assert.match(MIGRATION, /grant select, insert, update, delete on table public\.social_outfits to service_role/);
});

test("upload-outfit requires rights, a name and an HTTPS order link", async () => {
    const restoreFetch = mockAuthAndFetch(async (url) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        if (url.includes("/rest/v1/social_characters?select=id&")) return Response.json([{ id: "character-1" }]);
        if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
        if (url.includes("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const missingRights = makeResponse();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=upload-outfit&character_id=character-1",
            query: { action: "upload-outfit", character_id: "character-1" },
            headers: { authorization: "Bearer test-token", "content-type": "image/png" },
            body: PNG_BYTES,
            env
        }, missingRights);
        assert.equal(missingRights.statusCode, 400);
        assert.match(missingRights.body.error, /hak penggunaan foto outfit/i);

        const insecureLink = makeResponse();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=upload-outfit&character_id=character-1",
            query: { action: "upload-outfit", character_id: "character-1" },
            headers: {
                authorization: "Bearer test-token",
                "content-type": "image/png",
                "x-outfit-rights": "1",
                "x-outfit-name": encodeURIComponent("Aurora Linen"),
                "x-outfit-order-url": encodeURIComponent("http://shop.example.com/aurora")
            },
            body: PNG_BYTES,
            env
        }, insecureLink);
        assert.equal(insecureLink.statusCode, 400);
        assert.match(insecureLink.body.error, /HTTPS/);
    } finally {
        restoreFetch();
    }
});

test("upload-outfit stores the photo privately and saves the order link", async () => {
    let uploadedKey = "";
    let insertedRow = null;
    const restoreFetch = mockAuthAndFetch(async (url, options) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        if (url.includes("/rest/v1/social_characters?select=id&")) return Response.json([{ id: "character-1" }]);
        if (url.includes("/rest/v1/social_outfits?") && options.method !== "POST") return Response.json([]);
        if (url.includes("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/storage/v1/object/social-character-references/social-outfit/owner-1/")) {
            uploadedKey = url;
            assert.equal(options.headers["Content-Type"], "image/png");
            return Response.json({});
        }
        if (url.endsWith("/rest/v1/social_outfits?select=id,character_id,name,filename,mime_type,order_url,notes,is_active,created_at") && options.method === "POST") {
            insertedRow = JSON.parse(options.body);
            return Response.json([{
                id: "outfit-a",
                character_id: insertedRow.character_id,
                name: insertedRow.name,
                filename: insertedRow.filename,
                mime_type: insertedRow.mime_type,
                order_url: insertedRow.order_url,
                notes: insertedRow.notes,
                is_active: insertedRow.is_active,
                created_at: "2026-10-21T00:00:00.000Z"
            }], { status: 201 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const response = makeResponse();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=upload-outfit&character_id=character-1",
            query: { action: "upload-outfit", character_id: "character-1" },
            headers: {
                authorization: "Bearer test-token",
                "content-type": "image/png",
                "x-file-name": encodeURIComponent("aurora.png"),
                "x-outfit-rights": "1",
                "x-outfit-name": encodeURIComponent("Aurora Linen"),
                "x-outfit-order-url": encodeURIComponent("https://shop.example.com/aurora"),
                "x-outfit-notes": encodeURIComponent("linen krem")
            },
            body: PNG_BYTES,
            env
        }, response);

        assert.equal(response.statusCode, 201, JSON.stringify(response.body));
        assert.match(uploadedKey, /social-outfit\/owner-1\/[0-9a-f-]+\.png$/);
        assert.equal(insertedRow.owner_id, "owner-1");
        assert.equal(insertedRow.character_id, "character-1");
        assert.equal(insertedRow.name, "Aurora Linen");
        assert.equal(insertedRow.order_url, "https://shop.example.com/aurora");
        assert.equal(insertedRow.notes, "linen krem");
        assert.equal(insertedRow.is_active, true);
        assert.equal(response.body.outfit.id, "outfit-a");
    } finally {
        restoreFetch();
    }
});

test("save-outfit validates the order link before patching", async () => {
    let patched = null;
    const restoreFetch = mockAuthAndFetch(async (url, options) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        if (url.includes("/rest/v1/social_outfits?id=eq.outfit-a") && options.method === "PATCH") {
            patched = JSON.parse(options.body);
            return Response.json([{
                id: "outfit-a",
                character_id: "character-1",
                name: patched.name,
                order_url: patched.order_url,
                notes: patched.notes,
                is_active: patched.is_active
            }]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const insecure = makeResponse();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-outfit",
            query: { action: "save-outfit" },
            headers: { authorization: "Bearer test-token" },
            body: { id: "outfit-a", name: "Aurora Linen", order_url: "ftp://shop.example.com" },
            env
        }, insecure);
        assert.equal(insecure.statusCode, 400);

        const response = makeResponse();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-outfit",
            query: { action: "save-outfit" },
            headers: { authorization: "Bearer test-token" },
            body: {
                id: "outfit-a",
                name: "Aurora Linen",
                order_url: "https://shop.example.com/aurora",
                notes: "linen krem",
                is_active: false
            },
            env
        }, response);
        assert.equal(response.statusCode, 200, JSON.stringify(response.body));
        assert.equal(patched.order_url, "https://shop.example.com/aurora");
        assert.equal(patched.is_active, false);
        assert.equal(response.body.outfit.is_active, false);
    } finally {
        restoreFetch();
    }
});

test("outfit preview streams the private object only to its owner", async () => {
    const restoreFetch = mockAuthAndFetch(async (url) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        if (url.includes("/rest/v1/social_outfits?select=object_key,mime_type")) {
            return Response.json([{ object_key: "social-outfit/owner-1/aurora.png", mime_type: "image/png" }]);
        }
        if (url.includes("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/storage/v1/object/authenticated/social-character-references/social-outfit/owner-1/aurora.png")) {
            return new Response(PNG_BYTES);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const response = makeResponse();
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=outfit&outfit_id=outfit-a",
            query: { action: "outfit", outfit_id: "outfit-a" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["Content-Type"], "image/png");
        assert.deepEqual(new Uint8Array(response.body), PNG_BYTES);
    } finally {
        restoreFetch();
    }
});

test("manual generation wears the freshly picked outfit and publishes its order link", async () => {
    const outfits = [
        {
            id: "outfit-a",
            character_id: "character-1",
            name: "Aurora Linen",
            object_key: "social-outfit/owner-1/aurora.png",
            mime_type: "image/png",
            order_url: "https://shop.example.com/aurora",
            notes: "linen krem",
            is_active: true
        },
        {
            id: "outfit-b",
            character_id: "character-1",
            name: "Senja Knit",
            object_key: "social-outfit/owner-1/senja.png",
            mime_type: "image/png",
            order_url: "https://shop.example.com/senja",
            notes: "rajut hangat",
            is_active: true
        }
    ];
    const patches = [];
    let generatedCaptions = 0;
    let tryOnGarments = null;

    const restoreFetch = mockAuthAndFetch(async (url, options = {}) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        if (url.includes("/rest/v1/social_publisher_config?select=image_provider")) {
            return Response.json([{ image_provider: "cloudflare" }]);
        }
        if (url.endsWith("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-1",
                display_name: "Alya",
                reference_object_key: "social-reference/owner-1/reference.jpg",
                reference_mime_type: "image/jpeg",
                garment_object_key: null,
                prompt_notes: "Rambut bob"
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) {
            return Response.json([{ id: "connection-1", page_name: "GEN-Z Page", can_publish: true }]);
        }
        if (url.includes("/rest/v1/social_outfits?")) {
            assert.match(url, /character_id=eq\.character-1/);
            assert.match(url, /is_active=eq\.true/);
            return Response.json(outfits);
        }
        if (url.includes("/rest/v1/social_post_runs?select=outfit_id")) {
            // outfit-a was just used: the fresh pick must be outfit-b.
            return Response.json([{ outfit_id: "outfit-a" }]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings?")) {
            return Response.json([{ caption_template: "Cerita hari ini #GENZAI", external_link: "https://example.com" }]);
        }
        if (url.includes("/rest/v1/social_post_runs?select=id&status=eq.generating")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs?") && options.method === "POST") {
            const body = JSON.parse(options.body);
            assert.equal(body.outfit_id, "outfit-b");
            assert.equal(body.outfit_order_url, "https://shop.example.com/senja");
            return Response.json([{ id: "manual-run-1" }], { status: 201 });
        }
        if (url.includes("/storage/v1/object/authenticated/social-character-references/")) {
            return new Response(new Uint8Array([255, 216, 255, 0]), { status: 200 });
        }
        if (url.includes("/storage/v1/object/sign/social-character-references/")) {
            const objectKey = url.includes("social-outfit")
                ? url.match(/social-outfit\/owner-1\/[a-z]+\.png/)?.[0] || "social-outfit/owner-1/senja.png"
                : "social-reference/owner-1/reference.jpg";
            return Response.json({ signedURL: `/object/sign/social-character-references/${objectKey}?token=short-lived` });
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.manual-run-1")) {
            const update = JSON.parse(options.body);
            patches.push(update);
            if (update.caption) {
                assert.match(update.caption, /Senja Knit/);
                assert.match(update.caption, /https:\/\/shop\.example\.com\/senja/);
                assert.match(update.caption, /Hai guys/);
                assert.match(update.caption, /#GENZAI/);
            }
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const response = await withRandom(0, async () => {
            const res = makeResponse();
            await socialPublisherHandler({
                method: "POST",
                url: "/api/social-publisher?action=manual-generate",
                query: { action: "manual-generate" },
                headers: { authorization: "Bearer test-token" },
                body: {
                    character_id: "character-1",
                    page_connection_id: "connection-1",
                    aspect_ratio: "9:16"
                },
                env: {
                    ...env,
                    SOCIAL_TOKEN_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
                    AI: {
                        async run(model, input) {
                            if (model === "pruna/p-image-try-on") {
                                tryOnGarments = input.garment_images;
                                return { image: btoa(String.fromCharCode(...PNG_BYTES)) };
                            }
                            assert.equal(model, "@cf/meta/llama-3.2-11b-vision-instruct");
                            generatedCaptions += 1;
                            return { response: "Hai guys, lagi menikmati suasana sore." };
                        }
                    }
                }
            }, res);
            return res;
        });

        assert.equal(response.statusCode, 200, JSON.stringify(response.body));
        assert.equal(response.body.preview.outfit.id, "outfit-b");
        assert.equal(response.body.preview.outfit.name, "Senja Knit");
        assert.equal(response.body.preview.outfit.order_url, "https://shop.example.com/senja");
        assert.match(response.body.preview.caption, /Senja Knit/);
        assert.match(response.body.preview.caption, /https:\/\/shop\.example\.com\/senja/);
        assert.deepEqual(tryOnGarments, [
            "https://project.example/storage/v1/object/sign/social-character-references/social-outfit/owner-1/senja.png?token=short-lived"
        ]);
        assert.equal(generatedCaptions, 1);
        assert.equal(patches.at(-1).outfit_id, "outfit-b");
        assert.equal(patches.at(-1).outfit_name, "Senja Knit");
    } finally {
        restoreFetch();
    }
});

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

test("scheduled autopost picks an outfit at random and adds its order link to the post", async () => {
    const originalFetch = globalThis.fetch;
    const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(8)));
    const encryptedToken = await encryptSecret("page-token-secret", encryptionKey);
    let postedCaption = "";
    let tryOnGarments = null;
    const patches = [];

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
                aspect_ratio: "9:16",
                caption_template: "Fallback",
                timezone: "Asia/Jakarta"
            }]);
        }
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-1",
                display_name: "Alya",
                reference_object_key: "social-reference/owner-1/reference.jpg",
                reference_mime_type: "image/jpeg",
                garment_object_key: null,
                prompt_notes: ""
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
        if (url.includes("/rest/v1/social_post_runs?select=scene_plan,outfit_id")) return Response.json([]);
        if (url.includes("/rest/v1/social_outfits?")) {
            return Response.json([{
                id: "outfit-a",
                character_id: "character-1",
                name: "Aurora Linen",
                object_key: "social-outfit/owner-1/aurora.png",
                mime_type: "image/png",
                order_url: "https://shop.example.com/aurora",
                notes: "linen krem",
                is_active: true
            }]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings?")) {
            return Response.json([{ caption_template: "Cerita {outfit} #GENZAI", external_link: "" }]);
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
            const objectKey = url.includes("social-outfit")
                ? "social-outfit/owner-1/aurora.png"
                : "social-reference/owner-1/reference.jpg";
            return Response.json({ signedURL: `/object/sign/social-character-references/${objectKey}?token=short-lived` });
        }
        if (url.includes("graph.facebook.com/v26.0/page-123?fields=id%2Cname%2Ctasks")) {
            return Response.json({ id: "page-123", name: "GEN-Z Page", tasks: ["CREATE_CONTENT"] });
        }
        if (url.includes("graph.facebook.com/v26.0/page-123/photos")) {
            postedCaption = options.body.get("caption");
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
                        tryOnGarments = input.garment_images;
                        return { image: btoa(String.fromCharCode(...pngWithMetadata())) };
                    }
                    assert.equal(model, "@cf/meta/llama-3.2-11b-vision-instruct");
                    return { response: "Hai guys, lagi menikmati suasana sore." };
                }
            }
        });

        assert.deepEqual(result, { claimed: 1, skipped: false });
        assert.match(postedCaption, /Cerita Aurora Linen/);
        assert.match(postedCaption, /✨ Outfit: Aurora Linen/);
        assert.match(postedCaption, /https:\/\/shop\.example\.com\/aurora/);
        assert.match(postedCaption, /#GENZAI/);
        assert.deepEqual(tryOnGarments, [
            "https://project.example/storage/v1/object/sign/social-character-references/social-outfit/owner-1/aurora.png?token=short-lived"
        ]);
        assert.equal(patches.at(-1).status, "posted");
        assert.equal(patches.at(-1).outfit_id, "outfit-a");
        assert.equal(patches.at(-1).outfit_order_url, "https://shop.example.com/aurora");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

function dashboardFetchHandler({ outfitResponse }) {
    return async (url, options = {}) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-1",
                display_name: "Alya",
                reference_filename: "alya.jpg",
                reference_mime_type: "image/jpeg",
                garment_filename: null,
                prompt_notes: "",
                created_at: "2026-10-20T00:00:00.000Z"
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_schedules?")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs?select=")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_config?")) {
            return Response.json([{ id: true, global_enabled: false, image_provider: "gemini", image_model: "", updated_at: null }]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings?")) return Response.json([]);
        if (url.includes("/rest/v1/social_outfits?")) return outfitResponse();
        if (url.endsWith("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
}

test("dashboard exposes outfit metadata without leaking storage keys", async () => {
    const restoreFetch = mockAuthAndFetch(dashboardFetchHandler({
        outfitResponse: () => Response.json([{
            id: "outfit-a",
            character_id: "character-1",
            name: "Aurora Linen",
            filename: "aurora.png",
            mime_type: "image/png",
            order_url: "https://shop.example.com/aurora",
            notes: "linen krem",
            is_active: true,
            created_at: "2026-10-20T00:00:00.000Z"
        }])
    }));
    try {
        const response = makeResponse();
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=dashboard",
            query: { action: "dashboard" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200, JSON.stringify(response.body));
        assert.equal(response.body.config.outfitLibraryReady, true);
        assert.equal(response.body.schedulePolicy.role, "OWNER");
        assert.equal(response.body.schedulePolicy.minIntervalHours, 1);
        assert.equal(response.body.schedulePolicy.maxIntervalHours, 168);
        assert.equal(response.body.outfits.length, 1);
        assert.equal(response.body.outfits[0].name, "Aurora Linen");
        assert.equal(response.body.outfits[0].order_url, "https://shop.example.com/aurora");
        assert.equal(response.body.outfits[0].object_key, undefined);
    } finally {
        restoreFetch();
    }
});

test("dashboard stays usable before the outfit migration is applied", async () => {
    const restoreFetch = mockAuthAndFetch(dashboardFetchHandler({
        outfitResponse: () => Response.json({
            code: "PGRST205",
            message: "Could not find the table 'public.social_outfits' in the schema cache"
        }, { status: 404 })
    }));
    try {
        const response = makeResponse();
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=dashboard",
            query: { action: "dashboard" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200, JSON.stringify(response.body));
        assert.equal(response.body.config.outfitLibraryReady, false);
        assert.deepEqual(response.body.outfits, []);
    } finally {
        restoreFetch();
    }
});
