import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
    buildQuoteImagePrompt,
    createQuotePlan,
    quoteOverridesFromSchedule,
    quoteVisualDirection
} from "../lib/social-publisher/quotes.js";
import {
    generateSocialQuote,
    generateSocialQuoteImage,
    resolveQuoteTextToImageModel,
    encryptSecret
} from "../lib/social-publisher/providers.js";
import { encodeRgbaToPng } from "../lib/social-publisher/story-video.js";
import socialPublisherHandler from "../api/social-publisher.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const jsSource = fileURLToPath(new URL("../admin-control/social-publisher.js", import.meta.url));
const htmlSource = fileURLToPath(new URL("../admin-control/social-publisher.html", import.meta.url));
const cronSource = fileURLToPath(new URL("../functions/_shared/social-publisher-cron.js", import.meta.url));
const apiSource = fileURLToPath(new URL("../api/social-publisher.js", import.meta.url));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
const OPUS_MODEL = "nano-banana-2";
const QUOTE_TEXT = "Pelan tidak apa-apa, asal langkahmu tetap menuju pulang di senja.";
const OUTFIT = {
    id: "outfit-1",
    character_id: "character-1",
    name: "Kemeja linen senja",
    object_key: "owner-1/character-1/outfit-1.png",
    mime_type: "image/png",
    order_url: "",
    notes: "",
    is_active: true
};
const CHARACTER = {
    id: "character-1",
    owner_id: "owner-1",
    display_name: "Karakter Senja",
    reference_object_key: "owner-1/character-1/photo.png",
    reference_mime_type: "image/png",
    prompt_notes: ""
};
const OPUS_VAULT_SECRET = "social-publisher-opus-vault-test";

function encryptedOpusCredentialRow(token = "opus-token-from-supabase") {
    const key = createHash("sha256").update(OPUS_VAULT_SECRET).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify({ access_token: token }), "utf8"),
        cipher.final()
    ]);
    return {
        id: "opus-vault-slot-1",
        slot: 1,
        label: "OPUS_AUTH_TOKEN_1",
        ciphertext: ciphertext.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        updated_at: new Date().toISOString()
    };
}

function solidPng(side = 16, shade = 120) {
    const rgba = new Uint8Array(side * side * 4);
    for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = shade;
        rgba[i + 1] = shade;
        rgba[i + 2] = shade;
        rgba[i + 3] = 255;
    }
    return encodeRgbaToPng(rgba, side, side);
}

function makeRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        end(payload) { this.rawBytes = payload; return this; }
    };
}

test("latar AI mengikuti makna kalimat tanpa menyisipkan teks kutipan ke prompt gambar", () => {
    const plan = createQuotePlan([], () => 0, quoteOverridesFromSchedule({
        quote_theme: "senja",
        scene_details: "cahaya hangat di tepi danau"
    }));
    const prompt = buildQuoteImagePrompt({ quotePlan: plan, quoteText: QUOTE_TEXT, aspectRatio: "9:16" });

    assert.match(prompt, /Quote meaning to visualize/i);
    assert.match(prompt, /a quiet path leading home/i, "kata 'pulang' harus jadi arahan visual");
    assert.match(prompt, /a lone winding path/i, "kata 'langkah' harus jadi arahan visual");
    assert.match(prompt, /cahaya hangat di tepi danau/);
    assert.match(prompt, /NO TEXT AT ALL/i);
    assert.doesNotMatch(prompt, /Pelan tidak apa-apa/, "kalimat asli tidak boleh dirender ke dalam gambar");
    assert.match(prompt, /NO people, NO characters/i);

    const direction = quoteVisualDirection(QUOTE_TEXT, plan);
    assert.match(direction, /golden-hour horizon/i);
    assert.doesNotMatch(direction, /Pelan|pulang/i);

    const characterPrompt = buildQuoteImagePrompt({
        quotePlan: plan,
        quoteText: QUOTE_TEXT,
        withCharacter: true,
        hasOutfitReference: true,
        outfitName: OUTFIT.name
    });
    assert.match(characterPrompt, /exactly ONE person/i);
    assert.match(characterPrompt, /Kemeja linen senja/);
    assert.match(characterPrompt, /off-center/i);
    assert.doesNotMatch(characterPrompt, /Strictly NO people/i);
    assert.match(characterPrompt, /NO TEXT AT ALL/i);
});

test("generateSocialQuoteImage memakai model SET Studio Medsos (OPUS) dan meneruskan foto karakter + outfit", async () => {
    const png = await solidPng();
    const calls = [];
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async (input, init = {}) => {
            calls.push({ url: String(input), body: init.body ? JSON.parse(init.body) : null });
            return new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
        };
        const env = { OPUS_AUTH_TOKEN: "opus-test-token", OPUS_API_URL: "https://opus.example/image" };

        const scenic = await generateSocialQuoteImage({
            env,
            prompt: "latar senja tanpa teks",
            imageProvider: "opus",
            imageModel: OPUS_MODEL
        });
        assert.equal(scenic.model, OPUS_MODEL);
        assert.ok(scenic.bytes.length > 0);
        assert.equal(calls.at(-1).body.model, OPUS_MODEL);
        assert.equal(calls.at(-1).body.input_images, undefined, "T2I polos tidak mengirim referensi");

        const withCharacter = await generateSocialQuoteImage({
            env,
            prompt: "latar senja bersama karakter",
            imageProvider: "opus",
            imageModel: OPUS_MODEL,
            referenceBytes: png,
            referenceMimeType: "image/png",
            garmentBytes: png,
            garmentMimeType: "image/png"
        });
        assert.equal(withCharacter.model, OPUS_MODEL);
        assert.equal(calls.at(-1).body.model, OPUS_MODEL);
        assert.equal(calls.at(-1).body.input_images.length, 2, "foto karakter + outfit acak terkirim");

        /* Model i2i QwenCloud tidak dipakai paksa untuk latar T2I. */
        assert.equal(resolveQuoteTextToImageModel("qwen-image-3.0"), "wan2.6-t2i");
        assert.equal(resolveQuoteTextToImageModel("z-image-turbo"), "z-image-turbo");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

/**
 * Mock Supabase + QwenCloud LLM + OPUS HTTP API untuk action manual-generate.
 * QWENCLOUD_API_KEY sengaja ADA: harus tetap tidak mengalihkan model gambar.
 */
async function createManualHarness({ useCharacter = false } = {}) {
    const png = await solidPng();
    const calls = [];
    const runs = [];
    const config = {
        id: true,
        global_enabled: true,
        image_provider: "opus",
        image_model: OPUS_MODEL,
        text_provider: "qwencloud",
        quote_llm_model: "qwen-plus"
    };
    const encryptedToken = await encryptSecret("page-token", TEST_ENCRYPTION_KEY);
    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SOCIAL_TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY: OPUS_VAULT_SECRET,
        QWENCLOUD_API_KEY: "qwencloud-llm-key",
        OPUS_AUTH_TOKEN: "opus-test-token",
        OPUS_API_URL: "https://opus.example/image"
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        const method = (init.method || "GET").toUpperCase();
        calls.push({ url, method, body: init.body && typeof init.body === "string" ? JSON.parse(init.body) : null });

        if (url.includes("/rest/v1/opus_credentials?")) return Response.json([encryptedOpusCredentialRow()]);
        if (url === "https://opus.example/image") {
            return new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
        }
        if (url.includes("/services/aigc/text-generation/generation") || url.includes("/compatible-mode/v1/chat/completions")) {
            return Response.json({
                output: {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                quoteText: QUOTE_TEXT,
                                contextualCaption: "Refleksi tentang perjalanan pulang.",
                                visualScene: "a quiet empty road at dusk with one warm window light"
                            })
                        }
                    }]
                }
            });
        }
        if (url.includes("/services/aigc/image-generation") || url.includes("multimodal-generation") || url.includes("text2image")) {
            throw new Error(`Model gambar QwenCloud TIDAK boleh dipakai: ${url}`);
        }
        if (url === "https://supabase.example.co/auth/v1/user") {
            return Response.json({ id: "owner-1", email: "owner@genz.ai" });
        }
        if (url.includes("/rest/v1/profiles")) {
            return Response.json([{ id: "owner-1", role: "ADMIN", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access")) {
            return Response.json([{
                user_id: "owner-1",
                is_active: true,
                started_at: new Date(Date.now() - 86400_000).toISOString(),
                expires_at: new Date(Date.now() + 29 * 86400_000).toISOString()
            }]);
        }
        if (url.includes("/rest/v1/social_publisher_config")) {
            return Response.json([config]);
        }
        if (url.includes("/rest/v1/social_characters")) {
            return useCharacter ? Response.json([CHARACTER]) : Response.json([]);
        }
        if (url.includes("/rest/v1/social_page_connections")) {
            return Response.json([{
                id: "page-1",
                owner_id: "owner-1",
                page_id: "9988",
                page_name: "Halaman Senja",
                page_token_ciphertext: encryptedToken.ciphertext,
                page_token_iv: encryptedToken.iv,
                can_publish: true
            }]);
        }
        if (url.includes("/rest/v1/social_outfits")) {
            return useCharacter ? Response.json([OUTFIT]) : Response.json([]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings")) {
            return Response.json([{ owner_id: "owner-1", autopublish_enabled: true }]);
        }
        if (url.includes("/rest/v1/social_facebook_songs")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_model_quotas")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs")) {
            if (method === "POST") {
                const row = { id: `run-${runs.length + 1}`, created_at: new Date().toISOString(), ...JSON.parse(init.body) };
                runs.push(row);
                return Response.json([row], { status: 201 });
            }
            if (method === "PATCH") {
                const payload = JSON.parse(init.body);
                Object.assign(runs[0] || {}, payload);
                return Response.json(runs);
            }
            return Response.json(runs);
        }
        if (url.includes("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/storage/v1/object/authenticated/")) {
            return new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
        }
        if (url.includes("/storage/v1/object/sign/")) {
            return Response.json({ signedURL: "/object/sign/social-character-references/owner-1/character-1/photo.png" });
        }
        /* Endpoint pendukung lain (mis. pencatatan kuota) tidak memengaruhi hasil. */
        return Response.json([]);
    };
    return {
        env,
        calls,
        runs,
        restore: () => { globalThis.fetch = originalFetch; }
    };
}

test("manual-generate Quote: QWENCLOUD_API_KEY tidak boleh menimpa model gambar OPUS dari SET Studio Medsos", async () => {
    const harness = await createManualHarness();
    try {
        const res = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-generate",
            headers: { authorization: "Bearer admin-jwt" },
            body: {
                post_mode: "quote",
                quote_publish_target: "feed",
                page_connection_id: "page-1",
                song_mode: "off"
            },
            env: harness.env
        }, res);

        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        const opusCalls = harness.calls.filter(call => call.url === "https://opus.example/image");
        assert.equal(opusCalls.length, 1, "latar AI dibuat tepat satu kali lewat OPUS");
        assert.equal(opusCalls[0].body.model, OPUS_MODEL, "model gambar harus model OPUS pilihan SET Studio Medsos");
        assert.match(opusCalls[0].body.prompt, /Quote meaning to visualize/i);
        assert.match(opusCalls[0].body.prompt, /a quiet path leading home/i);
        assert.match(opusCalls[0].body.prompt, /Sentence-derived scene from the quote writer/i);
        assert.match(opusCalls[0].body.prompt, /quiet empty road at dusk/i);
        assert.equal(opusCalls[0].body.input_images, undefined);
        assert.equal(harness.calls.some(call => call.url.includes("image-generation/generation")), false);

        assert.equal(res.body.preview.scene.background_mode, "ai_scenic");
        assert.equal(res.body.preview.scene.background_model, OPUS_MODEL);
        assert.equal(res.body.preview.quote_text, QUOTE_TEXT);
        assert.equal(res.body.preview.image_model, OPUS_MODEL, "image_model preview bukan model LLM");
        assert.equal(res.body.preview.quote_llm_model, "qwen-plus", "LLM QwenCloud tetap dipakai untuk kalimat");
        assert.match(harness.runs[0].generated_prompt, /Quote meaning to visualize/i);
    } finally {
        harness.restore();
    }
});

test("manual-generate Quote opsi karakter: latar memakai foto karakter + outfit acak, tetap lewat OPUS", async () => {
    const harness = await createManualHarness({ useCharacter: true });
    try {
        const res = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-generate",
            headers: { authorization: "Bearer admin-jwt" },
            body: {
                post_mode: "quote",
                quote_publish_target: "feed",
                page_connection_id: "page-1",
                song_mode: "off",
                quote_use_character: true,
                character_id: "character-1"
            },
            env: harness.env
        }, res);

        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        const opusCalls = harness.calls.filter(call => call.url === "https://opus.example/image");
        assert.equal(opusCalls.length, 1);
        assert.equal(opusCalls[0].body.model, OPUS_MODEL);
        assert.equal(opusCalls[0].body.input_images.length, 2, "foto karakter + outfit acak terkirim sebagai referensi");
        assert.match(opusCalls[0].body.prompt, /exactly ONE person/i);
        assert.match(opusCalls[0].body.prompt, /Kemeja linen senja/);

        assert.equal(res.body.preview.scene.background_mode, "ai_character");
        assert.equal(res.body.preview.scene.background_character_id, "character-1");
        assert.equal(res.body.preview.scene.background_outfit_name, OUTFIT.name);
        assert.equal(res.body.preview.outfit.name, OUTFIT.name);
        assert.equal(harness.runs[0].outfit_id, OUTFIT.id);
    } finally {
        harness.restore();
    }
});

test("UI & SQL: opsi latar + karakter tersedia di post manual, autopost, dan migrasi", () => {
    const html = fs.readFileSync(htmlSource, "utf8");
    const js = fs.readFileSync(jsSource, "utf8");
    const api = fs.readFileSync(apiSource, "utf8");
    const cron = fs.readFileSync(cronSource, "utf8");
    const sql = fs.readFileSync(fileURLToPath(new URL("../supabase/social-schedule-quote-character.sql", import.meta.url)), "utf8");

    assert.match(html, /id="manual-quote-use-character"/);
    assert.match(html, /id="manual-quote-character"/);
    assert.match(html, /id="schedule-quote-use-character"/);
    assert.match(html, /id="schedule-quote-character"/);
    assert.match(html, /Generate latar belakang ini dengan foto karakter yang dipilih \+ outfit acak yang tersedia/);
    assert.match(js, /quote_use_character: quoteUseCharacter/);
    assert.match(js, /syncQuoteCharacterFields\("manual", isQuote\)/);
    assert.match(js, /syncQuoteCharacterFields\("schedule", isQuote\)/);
    assert.match(api, /const activeProvider = imageProvider;/);
    assert.match(cron, /const quoteUseCharacter = postMode === "quote" && schedule\.quote_use_character === true;/);
    assert.match(sql, /add column if not exists quote_use_character boolean not null default false/);
    assert.doesNotMatch(api, /const quoteAiProvider = hasQwenCloudKey \? "qwencloud"/);
});

test("save-schedule menyimpan opsi latar + karakter autopost beserta character_id", async () => {
    const writes = [];
    const originalFetch = globalThis.fetch;
    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    };
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const method = (init.method || "GET").toUpperCase();
            if (url === "https://supabase.example.co/auth/v1/user") {
                return Response.json({ id: "owner-1", email: "owner@genz.ai" });
            }
            if (url.includes("/rest/v1/profiles")) {
                return Response.json([{ id: "owner-1", role: "ADMIN", status: "active" }]);
            }
            if (url.includes("/rest/v1/studio_medsos_access")) {
                return Response.json([{
                    user_id: "owner-1",
                    is_active: true,
                    started_at: new Date(Date.now() - 86400_000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400_000).toISOString()
                }]);
            }
            if (url.includes("/rest/v1/social_characters")) return Response.json([CHARACTER]);
            if (url.includes("/rest/v1/social_page_connections")) {
                return Response.json([{ id: "page-1", owner_id: "owner-1", can_publish: true }]);
            }
            if (url.includes("/rest/v1/social_video_accounts")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_schedules")) {
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    writes.push({ url, payload });
                    return Response.json([{ id: "schedule-1", ...payload }], { status: 201 });
                }
                return Response.json([]);
            }
            return Response.json([]);
        };
        const res = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-schedule",
            headers: { authorization: "Bearer admin-jwt" },
            body: {
                post_mode: "quote",
                quote_use_character: true,
                character_id: "character-1",
                page_connection_id: "page-1",
                interval_minutes: 1440,
                next_run_at: new Date(Date.now() + 3600_000).toISOString(),
                aspect_ratio: "9:16",
                quote_publish_target: "feed",
                song_mode: "off",
                enabled: true,
                social_video_account_ids: []
            },
            env
        }, res);
        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        assert.equal(writes.length, 1);
        assert.equal(writes[0].payload.quote_use_character, true);
        assert.equal(writes[0].payload.character_id, "character-1", "karakter tersimpan untuk dipakai cron");
        assert.match(writes[0].url, /select=.*quote_use_character/);
        assert.equal(res.body.schedule.quote_use_character, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("save-schedule tetap berhasil bila kolom quote_use_character belum dimigrasikan", async () => {
    const writes = [];
    const originalFetch = globalThis.fetch;
    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    };
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const method = (init.method || "GET").toUpperCase();
            if (url === "https://supabase.example.co/auth/v1/user") {
                return Response.json({ id: "owner-1", email: "owner@genz.ai" });
            }
            if (url.includes("/rest/v1/profiles")) {
                return Response.json([{ id: "owner-1", role: "ADMIN", status: "active" }]);
            }
            if (url.includes("/rest/v1/studio_medsos_access")) {
                return Response.json([{
                    user_id: "owner-1", is_active: true,
                    started_at: new Date(Date.now() - 86400_000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400_000).toISOString()
                }]);
            }
            if (url.includes("/rest/v1/social_characters")) return Response.json([CHARACTER]);
            if (url.includes("/rest/v1/social_page_connections")) {
                return Response.json([{ id: "page-1", owner_id: "owner-1", can_publish: true }]);
            }
            if (url.includes("/rest/v1/social_video_accounts")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_schedules")) {
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    writes.push({ url, payload });
                    if (writes.length === 1 && Object.hasOwn(payload, "quote_use_character")) {
                        return Response.json({
                            code: "PGRST204",
                            message: "Could not find the 'quote_use_character' column of 'social_post_schedules' in the schema cache"
                        }, { status: 400 });
                    }
                    return Response.json([{ id: "schedule-legacy", ...payload }], { status: 201 });
                }
                return Response.json([]);
            }
            return Response.json([]);
        };
        const res = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-schedule",
            headers: { authorization: "Bearer admin-jwt" },
            body: {
                post_mode: "quote",
                quote_use_character: true,
                character_id: "character-1",
                page_connection_id: "page-1",
                interval_minutes: 1440,
                next_run_at: new Date(Date.now() + 3600_000).toISOString(),
                aspect_ratio: "9:16",
                quote_publish_target: "feed",
                song_mode: "off",
                enabled: true,
                social_video_account_ids: []
            },
            env
        }, res);
        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        assert.equal(writes.length, 2, "tulis ulang tanpa kolom baru");
        assert.equal(Object.hasOwn(writes[1].payload, "quote_use_character"), false);
        assert.equal(writes[1].payload.character_id, "character-1");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("cron autopost Quote memakai OPUS + foto karakter + outfit acak sesuai jadwal", async () => {
    const { runSocialPublisherCron } = await import("../functions/_shared/social-publisher-cron.js");
    const png = await solidPng();
    const encryptedToken = await encryptSecret("page-token-cron", TEST_ENCRYPTION_KEY);
    const patches = [];
    const opusCalls = [];
    const originalFetch = globalThis.fetch;
    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SOCIAL_TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY: OPUS_VAULT_SECRET,
        QWENCLOUD_API_KEY: "qwencloud-llm-key",
        OPUS_AUTH_TOKEN: "opus-test-token",
        OPUS_API_URL: "https://opus.example/image"
    };
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const method = (init.method || "GET").toUpperCase();
            if (url.includes("/rest/v1/opus_credentials?")) return Response.json([encryptedOpusCredentialRow()]);
            if (url === "https://opus.example/image") {
                opusCalls.push(JSON.parse(init.body));
                return new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
            }
            if (url.includes("/services/aigc/text-generation/generation") || url.includes("/compatible-mode/v1/chat/completions")) {
                return Response.json({
                    output: { choices: [{ message: { content: JSON.stringify({
                        quoteText: QUOTE_TEXT,
                        contextualCaption: "Refleksi perjalanan pulang.",
                        visualScene: "a quiet empty road at dusk with one warm window light"
                    }) } }] }
                });
            }
            if (url.includes("/rpc/claim_due_social_post_schedules")) {
                return Response.json([{ run_id: "run-autopost-1", schedule_id: "schedule-auto-1" }]);
            }
            if (url.includes("/rpc/claim_stuck_social_post_runs")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_schedules?")) {
                return Response.json([{
                    id: "schedule-auto-1",
                    owner_id: "owner-1",
                    character_id: "character-1",
                    page_connection_id: "page-1",
                    enabled: true,
                    autopublish_enabled: true,
                    interval_hours: 24,
                    aspect_ratio: "9:16",
                    caption_template: "Renungan hari ini",
                    post_mode: "quote",
                    quote_theme: "senja",
                    quote_visual_style: "",
                    quote_use_character: true,
                    quote_publish_target: "feed",
                    song_mode: "off",
                    use_random_song: false,
                    scene_details: "",
                    negative_prompt: "",
                    image_model: "",
                    social_video_account_ids: []
                }]);
            }
            if (url.includes("/rest/v1/social_publisher_config?")) {
                return Response.json([{
                    id: true,
                    global_enabled: true,
                    image_provider: "opus",
                    image_model: OPUS_MODEL,
                    text_provider: "qwencloud",
                    quote_llm_model: "qwen-plus"
                }]);
            }
            if (url.includes("/rest/v1/studio_medsos_access?")) {
                return Response.json([{
                    user_id: "owner-1", is_active: true,
                    started_at: new Date(Date.now() - 86400_000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400_000).toISOString()
                }]);
            }
            if (url.includes("/rest/v1/social_characters")) return Response.json([CHARACTER]);
            if (url.includes("/rest/v1/social_page_connections")) {
                return Response.json([{
                    id: "page-1", owner_id: "owner-1", page_id: "11223344",
                    page_name: "Halaman Senja",
                    page_token_ciphertext: encryptedToken.ciphertext,
                    page_token_iv: encryptedToken.iv,
                    can_publish: true
                }]);
            }
            if (url.includes("/rest/v1/social_outfits")) return Response.json([OUTFIT]);
            if (url.includes("/rest/v1/social_publisher_user_settings")) {
                return Response.json([{ owner_id: "owner-1", autopublish_enabled: true }]);
            }
            if (url.includes("/rest/v1/social_publisher_model_quotas")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_runs")) {
                if (method === "PATCH") {
                    const payload = JSON.parse(init.body);
                    patches.push(payload);
                    return Response.json([payload]);
                }
                return Response.json([]);
            }
            if (url.includes("/storage/v1/bucket/social-character-references")) {
                return Response.json({ id: "social-character-references", public: false });
            }
            if (url.includes("/storage/v1/object/authenticated/")) {
                return new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
            }
            if (url.includes("/storage/v1/object/sign/")) {
                return Response.json({ signedURL: "/object/sign/social-character-references/owner-1/character-1/photo.png" });
            }
            if (url.includes("graph.facebook.com") && url.includes("/11223344?fields=")) {
                return Response.json({ id: "11223344", name: "Halaman Senja", tasks: ["CREATE_CONTENT"] });
            }
            if (url.includes("graph-video.facebook.com") && url.endsWith("/11223344/videos")) {
                return Response.json({ id: "cron-feed-video-1", post_id: "11223344_999" });
            }
            if (url.includes("graph.facebook.com") && url.includes("cron-feed-video-1")) {
                return Response.json({ permalink_url: "/11223344/videos/999/" });
            }
            return Response.json([]);
        };

        const result = await runSocialPublisherCron(env);
        assert.equal(result.claimed, 1);
        assert.equal(opusCalls.length, 1, "autopost generate latar lewat OPUS");
        assert.equal(opusCalls[0].model, OPUS_MODEL, "model OPUS dari SET Studio Medsos, bukan QwenCloud");
        assert.equal(opusCalls[0].input_images.length, 2, "karakter + outfit acak terkirim");
        assert.match(opusCalls[0].prompt, /Quote meaning to visualize/i);
        assert.match(opusCalls[0].prompt, /Sentence-derived scene from the quote writer/i);
        assert.match(opusCalls[0].prompt, /exactly ONE person/i);

        const finalPatch = patches.at(-1);
        assert.equal(finalPatch.status, "posted");
        assert.equal(finalPatch.image_model, OPUS_MODEL);
        assert.equal(finalPatch.scene_plan.background_mode, "ai_character");
        assert.equal(finalPatch.scene_plan.background_model, OPUS_MODEL);
        assert.equal(finalPatch.scene_plan.background_outfit_name, OUTFIT.name);
        assert.equal(finalPatch.outfit_id, OUTFIT.id);
        assert.match(finalPatch.generated_prompt, /Quote meaning to visualize/i);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("penulis mutiara mengeluarkan arahan VISUAL adegan dan menolak arahan yang mengulang kalimat", async () => {
    const originalFetch = globalThis.fetch;
    const prompts = [];
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            assert.match(url, /\/v1beta\/interactions/);
            const payload = JSON.parse(init.body);
            prompts.push(String(payload.input?.at(-1)?.text || ""));
            return Response.json({
                outputs: [{
                    type: "text",
                    text: "QUOTE: Pelan tidak apa-apa, asal langkahmu tetap menuju pulang.\nVISUAL: an empty winding road at dusk leading to one warm window light"
                }]
            });
        };
        const result = await generateSocialQuote({
            env: { GEMINI_API_KEY: "gemini-key" },
            quotePlan: { themeLabel: "Motivasi", themeDirection: "proses kecil" },
            recentQuotes: [],
            imageProvider: "gemini"
        });
        assert.match(result.quoteText, /langkahmu/);
        assert.match(result.visualDirection, /empty winding road at dusk/i);
        assert.match(prompts[0], /VISUAL:/, "prompt LLM meminta baris arahan adegan");

        globalThis.fetch = async () => Response.json({
            outputs: [{
                type: "text",
                text: "QUOTE: Tenanglah, pelan tidak apa-apa.\nVISUAL: Pelan tidak apa-apa, asal langkahmu tetap menuju pulang."
            }]
        });
        const echoed = await generateSocialQuote({
            env: { GEMINI_API_KEY: "gemini-key" },
            quotePlan: {},
            recentQuotes: [],
            imageProvider: "gemini"
        });
        assert.equal(echoed.visualDirection, "", "kalimat kutipan tidak boleh lolos ke prompt gambar");
    } finally {
        globalThis.fetch = originalFetch;
    }
});
