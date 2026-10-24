import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    SOCIAL_POST_MODES,
    QUOTE_PRESETS,
    DEFAULT_FACEBOOK_SONGS,
    normalizeSocialPostMode,
    sanitizeFacebookSongUrl,
    pickRandomFacebookSong,
    formatFacebookSongCaption,
    createQuotePlan,
    quoteOverridesFromSchedule,
    cleanQuoteText,
    pickFallbackQuote,
    buildQuoteImagePrompt,
    renderQuoteCaption
} from "../lib/social-publisher/quotes.js";
import { composeSocialCaption } from "../lib/social-publisher/utils.js";
import {
    encryptSecret,
    generateSocialQuote,
    generateSocialQuoteImage
} from "../lib/social-publisher/providers.js";
import socialPublisherHandler from "../api/social-publisher.js";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=";
const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

function makeRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

test("quotes module normalizes post modes, validates Facebook song URLs, and rotates songs without immediate repeats", () => {
    assert.deepEqual(SOCIAL_POST_MODES, ["character", "quote"]);
    assert.equal(normalizeSocialPostMode("quote"), "quote");
    assert.equal(normalizeSocialPostMode("QUOTE"), "quote");
    assert.equal(normalizeSocialPostMode("character"), "character");
    assert.equal(normalizeSocialPostMode(""), "character");
    assert.equal(normalizeSocialPostMode("anything-else"), null);

    assert.equal(sanitizeFacebookSongUrl(""), "");
    assert.equal(
        sanitizeFacebookSongUrl("https://www.facebook.com/reel/1234567890"),
        "https://www.facebook.com/reel/1234567890"
    );
    assert.equal(
        sanitizeFacebookSongUrl("https://fb.watch/abcXYZ123/"),
        "https://fb.watch/abcXYZ123/"
    );
    assert.equal(sanitizeFacebookSongUrl("http://www.facebook.com/reel/123"), "");
    assert.equal(sanitizeFacebookSongUrl("https://open.spotify.com/track/123"), "");

    const customSongs = [
        { id: "song-1", title: "Monokrom", artist: "Tulus", facebook_url: "https://www.facebook.com/reel/111", is_active: true },
        { id: "song-2", title: "Rehat", artist: "Kunto Aji", facebook_url: "https://www.facebook.com/reel/222", is_active: true },
        { id: "song-3", title: "Inactive", artist: "Test", facebook_url: "", is_active: false }
    ];

    const picked = pickRandomFacebookSong(customSongs, ["song-1"], () => 0);
    assert.equal(picked.id, "song-2");
    assert.equal(picked.title, "Rehat");

    // Empty custom list falls back automatically to curated built-in songs.
    const fallbackPicked = pickRandomFacebookSong(
        [],
        [{ song_title: DEFAULT_FACEBOOK_SONGS[0].title, song_artist: DEFAULT_FACEBOOK_SONGS[0].artist }],
        () => 0
    );
    assert.ok(fallbackPicked?.title);
    assert.notEqual(fallbackPicked.title, DEFAULT_FACEBOOK_SONGS[0].title);
});

test("createQuotePlan, buildQuoteImagePrompt, renderQuoteCaption, and composeSocialCaption produce aesthetic non-character posters & song blocks", () => {
    const plan = createQuotePlan([], () => 0, quoteOverridesFromSchedule({
        quote_theme: "senja",
        quote_visual_style: QUOTE_PRESETS.visualStyles[0].value,
        scene_details: "cahaya hangat di tepi danau"
    }));
    assert.equal(plan.mode, "quote");
    assert.equal(plan.themeId, "senja");
    assert.equal(plan.visualPrompt, QUOTE_PRESETS.visualStyles[0].value);

    const cleanedQuote = cleanQuoteText('"Pelan tidak apa-apa, asal langkahmu tetap menuju pulang."');
    assert.equal(cleanedQuote, "Pelan tidak apa-apa, asal langkahmu tetap menuju pulang.");

    const fallback = pickFallbackQuote("senja", [cleanedQuote], () => 0);
    assert.ok(fallback.length > 10);

    const prompt = buildQuoteImagePrompt({
        quoteText: cleanedQuote,
        quotePlan: plan,
        aspectRatio: "9:16",
        negativePrompt: "mobil, gedung"
    });
    assert.match(prompt, /Pelan tidak apa-apa, asal langkahmu tetap menuju pulang\./);
    assert.match(prompt, /NO people, NO characters, NO human faces/i);
    assert.match(prompt, /cahaya hangat di tepi danau/);
    assert.match(prompt, /mobil, gedung/);

    const song = {
        id: "song-rehat",
        title: "Rehat",
        artist: "Kunto Aji",
        facebook_url: "https://www.facebook.com/reel/987654321"
    };
    const songBlock = formatFacebookSongCaption(song);
    assert.match(songBlock, /🎵 Lagu Facebook: Rehat — Kunto Aji/);
    assert.match(songBlock, /🎧 Musik di Facebook: https:\/\/www\.facebook\.com\/reel\/987654321/);

    const baseTemplate = "Renungan sore ({theme}) bersama {song} oleh {artist} #KataMutiara #Senja";
    const rendered = renderQuoteCaption(baseTemplate, plan, cleanedQuote, song);
    assert.match(rendered, /Tenang, Senja & Penyembuhan Diri/);
    assert.match(rendered, /Rehat/);
    assert.match(rendered, /Kunto Aji/);

    const fullCaption = composeSocialCaption({
        contextualCaption: "Semoga sore ini menenangkan langkahmu.",
        baseCaption: rendered,
        externalLink: "https://genzai.id/renungan",
        quoteText: cleanedQuote,
        song
    });
    assert.match(fullCaption, /“Pelan tidak apa-apa, asal langkahmu tetap menuju pulang\.”/);
    assert.match(fullCaption, /Semoga sore ini menenangkan langkahmu\./);
    assert.match(fullCaption, /🎵 Lagu Facebook: Rehat — Kunto Aji/);
    assert.match(fullCaption, /🎧 Musik di Facebook: https:\/\/www\.facebook\.com\/reel\/987654321/);
    assert.match(fullCaption, /https:\/\/genzai\.id\/renungan/);
    assert.match(fullCaption, /#KataMutiara #Senja$/);
});

test("generateSocialQuote and generateSocialQuoteImage support Gemini and Cloudflare without character references", async () => {
    const plan = createQuotePlan([], () => 0, { theme: "motivasi" });

    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            if (url.includes("/v1beta/interactions")) {
                const payload = JSON.parse(init.body || "{}");
                if (String(payload.model || "").includes("image")) {
                    return Response.json({
                        output_image: {
                            mime_type: "image/png",
                            data: TINY_PNG_BASE64
                        }
                    });
                }
                return Response.json({
                    outputs: [{
                        type: "text",
                        text: "QUOTE: Langkah kecil hari ini tetap lebih jauh daripada diam di tempat kemarin.\nCAPTION: Teruslah melangkah meski pelan, waktumu sedang tumbuh."
                    }]
                });
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
        };

        const geminiQuote = await generateSocialQuote({
            env: { GEMINI_API_KEY: "test-gemini-key" },
            quotePlan: plan,
            recentQuotes: [],
            imageProvider: "gemini"
        });
        assert.equal(
            geminiQuote.quoteText,
            "Langkah kecil hari ini tetap lebih jauh daripada diam di tempat kemarin."
        );
        assert.match(geminiQuote.contextualCaption, /Teruslah melangkah/);

        const geminiImage = await generateSocialQuoteImage({
            env: { GEMINI_API_KEY: "test-gemini-key" },
            prompt: buildQuoteImagePrompt({ quoteText: geminiQuote.quoteText, quotePlan: plan }),
            aspectRatio: "9:16",
            imageProvider: "gemini"
        });
        assert.equal(geminiImage.mimeType, "image/png");
        assert.ok(geminiImage.bytes.byteLength > 0);

        // Cloudflare Workers AI fallback without GEMINI_API_KEY
        const cfEnv = {
            AI: {
                async run(model) {
                    if (model.includes("llama")) {
                        return {
                            response: "QUOTE: Tenang bukan berarti menyerah, melainkan memberi ruang agar hati kembali utuh.\nCAPTION: Tarik napas sejenak dan percayakan sisanya pada doa."
                        };
                    }
                    if (model.includes("flux")) {
                        return { image: TINY_PNG_BASE64 };
                    }
                    throw new Error(`Unexpected CF model: ${model}`);
                }
            }
        };
        const cfQuote = await generateSocialQuote({
            env: cfEnv,
            quotePlan: plan,
            recentQuotes: [],
            imageProvider: "cloudflare"
        });
        assert.match(cfQuote.quoteText, /Tenang bukan berarti menyerah/);
        const cfImage = await generateSocialQuoteImage({
            env: cfEnv,
            prompt: "Poster estetik",
            aspectRatio: "9:16",
            imageProvider: "cloudflare"
        });
        assert.equal(cfImage.mimeType, "image/png");
        assert.ok(cfImage.bytes.byteLength > 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("API social-publisher supports Facebook song CRUD/seed, manual quote preview/publish, and quote schedule creation", async () => {
    const encryptedPageToken = await encryptSecret("fb-page-secret-token", TEST_ENCRYPTION_KEY);
    const songsStore = [];
    const runsStore = [];
    const schedulesStore = [];
    let publishedPhotoCalls = 0;

    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        GEMINI_API_KEY: "gemini-key",
        META_APP_ID: "meta-app",
        META_APP_SECRET: "meta-secret",
        META_LOGIN_CONFIG_ID: "login-cfg",
        SOCIAL_TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY
    };

    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const method = (init.method || "GET").toUpperCase();

            if (url.endsWith("/auth/v1/user")) {
                return Response.json({ id: "user-quote-1", email: "creator@example.com" });
            }
            if (url.includes("/rest/v1/profiles?")) {
                return Response.json([{ id: "user-quote-1", role: "ADMIN", status: "active" }]);
            }
            if (url.includes("/rest/v1/studio_medsos_access?")) {
                return Response.json([{
                    user_id: "user-quote-1",
                    is_active: true,
                    duration_days: 30,
                    started_at: new Date(Date.now() - 86400000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400000).toISOString()
                }]);
            }
            if (url.includes("/rest/v1/social_publisher_config?") || url.includes("/rest/v1/social_publisher_settings?")) {
                return Response.json([{
                    id: true,
                    global_enabled: true,
                    autopublish_enabled: true,
                    image_provider: "gemini",
                    image_model: "gemini-3.1-flash-lite-image"
                }]);
            }
            if (url.includes("/rest/v1/social_publisher_user_settings?")) {
                return Response.json([{
                    owner_id: "user-quote-1",
                    autopublish_enabled: true,
                    caption_template: "Renungan hari ini #KataMutiara #Inspirasi",
                    external_link: ""
                }]);
            }
            if (url.includes("/rest/v1/social_page_connections?")) {
                return Response.json([{
                    id: "page-conn-1",
                    owner_id: "user-quote-1",
                    page_id: "99887766",
                    page_name: "Ruang Teduh Page",
                    page_token_ciphertext: encryptedPageToken.ciphertext,
                    page_token_iv: encryptedPageToken.iv,
                    can_publish: true
                }]);
            }
            if (url.includes("/rest/v1/social_facebook_songs")) {
                if (method === "GET") {
                    if (url.includes("select=id") && !url.includes("title")) {
                        return Response.json(songsStore.map(s => ({ id: s.id })));
                    }
                    return Response.json([...songsStore]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    const items = Array.isArray(payload) ? payload : [payload];
                    const inserted = items.map((item, idx) => {
                        const row = {
                            id: `song-${songsStore.length + idx + 1}`,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            ...item
                        };
                        songsStore.push(row);
                        return row;
                    });
                    return Response.json(inserted, { status: 201 });
                }
                if (method === "PATCH") {
                    const payload = JSON.parse(init.body);
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    const idx = songsStore.findIndex(s => s.id === idFilter);
                    if (idx >= 0) songsStore[idx] = { ...songsStore[idx], ...payload };
                    return Response.json(idx >= 0 ? [songsStore[idx]] : []);
                }
                if (method === "DELETE") {
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    const idx = songsStore.findIndex(s => s.id === idFilter);
                    if (idx >= 0) songsStore.splice(idx, 1);
                    return new Response(null, { status: 204 });
                }
            }
            if (url.includes("/rest/v1/social_post_runs")) {
                if (method === "GET") {
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    if (idFilter) {
                        return Response.json(runsStore.filter(r => r.id === idFilter));
                    }
                    return Response.json([...runsStore]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    const row = {
                        id: `run-${runsStore.length + 1}`,
                        created_at: new Date().toISOString(),
                        ...payload
                    };
                    runsStore.unshift(row);
                    return Response.json([row], { status: 201 });
                }
                if (method === "PATCH") {
                    const payload = JSON.parse(init.body);
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    const idx = runsStore.findIndex(r => r.id === idFilter);
                    if (idx >= 0) runsStore[idx] = { ...runsStore[idx], ...payload };
                    return Response.json(idx >= 0 ? [runsStore[idx]] : []);
                }
            }
            if (url.includes("/rest/v1/social_post_schedules")) {
                if (method === "GET") {
                    if (init.headers?.Prefer?.includes("count=exact")) {
                        return new Response(JSON.stringify(schedulesStore), {
                            status: 200,
                            headers: {
                                "Content-Type": "application/json",
                                "Content-Range": `0-${Math.max(0, schedulesStore.length - 1)}/${schedulesStore.length}`
                            }
                        });
                    }
                    return Response.json([...schedulesStore]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    const row = {
                        id: `sched-${schedulesStore.length + 1}`,
                        created_at: new Date().toISOString(),
                        ...payload
                    };
                    schedulesStore.push(row);
                    return Response.json([row], { status: 201 });
                }
            }
            if (url.includes("/v1beta/interactions")) {
                const payload = JSON.parse(init.body || "{}");
                if (String(payload.model || "").includes("image")) {
                    return Response.json({
                        output_image: {
                            mime_type: "image/png",
                            data: TINY_PNG_BASE64
                        }
                    });
                }
                return Response.json({
                    outputs: [{
                        type: "text",
                        text: "QUOTE: Setiap senja mengajarkan bahwa yang indah pun tahu cara berpamitan dengan tenang.\nCAPTION: Semoga hatimu hangat malam ini."
                    }]
                });
            }
            if (url.includes("graph.facebook.com") && url.includes("/99887766?fields=")) {
                return Response.json({ id: "99887766", name: "Ruang Teduh Page", tasks: ["CREATE_CONTENT", "MANAGE"] });
            }
            if (url.includes("graph.facebook.com") && url.endsWith("/99887766/photos")) {
                publishedPhotoCalls += 1;
                return Response.json({ id: "photo-1", post_id: "99887766_555111" });
            }
            if (url.includes("graph.facebook.com") && url.includes("99887766_555111")) {
                return Response.json({ permalink_url: "https://www.facebook.com/99887766/posts/555111" });
            }
            if (url.includes("/storage/v1/bucket/")) {
                return Response.json({ id: "social-character-references", public: false });
            }
            return Response.json([]);
        };

        // 1. Reject non-Facebook URL on save-song
        const badSongRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-song",
            headers: { authorization: "Bearer valid-token" },
            body: {
                title: "Lagu Salah",
                artist: "Artis",
                facebook_url: "https://youtube.com/watch?v=123"
            },
            env
        }, badSongRes);
        assert.equal(badSongRes.statusCode, 400);
        assert.match(badSongRes.body.error, /Facebook/);

        // 2. Save valid Facebook song
        const saveSongRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-song",
            headers: { authorization: "Bearer valid-token" },
            body: {
                title: "Zona Nyaman",
                artist: "Fourtwnty",
                mood: "Santai & Kopi",
                facebook_url: "https://www.facebook.com/reel/420420"
            },
            env
        }, saveSongRes);
        assert.equal(saveSongRes.statusCode, 200);
        assert.equal(saveSongRes.body.song.title, "Zona Nyaman");

        // 3. List Facebook songs
        const listSongsRes = makeRes();
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=songs",
            headers: { authorization: "Bearer valid-token" },
            env
        }, listSongsRes);
        assert.equal(listSongsRes.statusCode, 200);
        assert.equal(listSongsRes.body.songs.length, 1);
        assert.equal(listSongsRes.body.songLibraryReady, true);

        // 4. Manual quote preview generation without character_id
        const previewRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-generate",
            headers: { authorization: "Bearer valid-token" },
            body: {
                post_mode: "quote",
                page_connection_id: "page-conn-1",
                aspect_ratio: "9:16",
                quote_theme: "senja",
                quote_visual_style: QUOTE_PRESETS.visualStyles[0].value,
                use_random_song: true
            },
            env
        }, previewRes);
        assert.equal(previewRes.statusCode, 200);
        assert.equal(previewRes.body.preview.post_mode, "quote");
        assert.match(previewRes.body.preview.quote_text, /Setiap senja mengajarkan/);
        assert.equal(previewRes.body.preview.song.title, "Zona Nyaman");
        assert.match(previewRes.body.preview.caption, /🎵 Lagu Facebook: Zona Nyaman — Fourtwnty/);
        assert.match(previewRes.body.preview.caption, /https:\/\/www\.facebook\.com\/reel\/420420/);

        // 5. Publish manual quote preview to Facebook Page
        const cleanedBytes = Buffer.from(TINY_PNG_BASE64, "base64");
        const publishRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-publish",
            headers: {
                authorization: "Bearer valid-token",
                "content-type": "image/png",
                "x-manual-run-id": previewRes.body.preview.run_id
            },
            body: cleanedBytes,
            env
        }, publishRes);
        assert.equal(publishRes.statusCode, 200);
        assert.equal(publishedPhotoCalls, 1);
        assert.equal(publishRes.body.post.permalink_url, "https://www.facebook.com/99887766/posts/555111");

        // 6. Save quote schedule without character_id
        const saveSchedRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-schedule",
            headers: { authorization: "Bearer valid-token" },
            body: {
                post_mode: "quote",
                character_id: null,
                page_connection_id: "page-conn-1",
                interval_minutes: 120,
                next_run_at: new Date(Date.now() + 3600_000).toISOString(),
                aspect_ratio: "9:16",
                quote_theme: "senja",
                quote_visual_style: QUOTE_PRESETS.visualStyles[1].value,
                use_random_song: true,
                autopublish_enabled: true,
                enabled: true
            },
            env
        }, saveSchedRes);
        assert.equal(saveSchedRes.statusCode, 200);
        assert.equal(saveSchedRes.body.schedule.post_mode, "quote");
        assert.equal(saveSchedRes.body.schedule.character_id, null);
        assert.equal(saveSchedRes.body.schedule.quote_theme, "senja");
        assert.equal(saveSchedRes.body.schedule.quote_visual_style, QUOTE_PRESETS.visualStyles[1].value);
        assert.equal(saveSchedRes.body.schedule.use_random_song, true);

        // 7. Seed curated songs & delete song
        const seedRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=seed-default-songs",
            headers: { authorization: "Bearer valid-token" },
            body: {},
            env
        }, seedRes);
        assert.equal(seedRes.statusCode, 200);
        assert.ok(seedRes.body.added >= 10);

        const delRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=delete-song",
            headers: { authorization: "Bearer valid-token" },
            body: { id: saveSongRes.body.song.id },
            env
        }, delRes);
        assert.equal(delRes.statusCode, 200);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("cron runSocialPublisherCron auto-generates and publishes quote schedule with non-repeating random Facebook song", async () => {
    const encryptedPageToken = await encryptSecret("fb-cron-token", TEST_ENCRYPTION_KEY);
    const updatedRuns = [];
    let publishedMessage = "";

    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        GEMINI_API_KEY: "gemini-key",
        SOCIAL_TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY
    };

    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const method = (init.method || "GET").toUpperCase();

            if (url.includes("/rest/v1/social_publisher_config?") || url.includes("/rest/v1/social_publisher_settings?")) {
                return Response.json([{
                    id: true,
                    global_enabled: true,
                    autopublish_enabled: true,
                    image_provider: "gemini",
                    image_model: "gemini-3.1-flash-lite-image"
                }]);
            }
            if (url.includes("/rest/v1/studio_medsos_access?")) {
                return Response.json([{
                    user_id: "user-cron-1",
                    is_active: true,
                    started_at: new Date(Date.now() - 86400_000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400_000).toISOString()
                }]);
            }
            if (url.includes("/rpc/claim_due_social_post_schedules")) {
                return Response.json([{
                    run_id: "run-cron-quote-1",
                    schedule_id: "sched-quote-cron-1",
                    owner_id: "user-cron-1"
                }]);
            }
            if (url.includes("/rpc/claim_stuck_social_post_runs")) {
                return Response.json([]);
            }
            if (url.includes("/rest/v1/social_post_schedules?")) {
                return Response.json([{
                    id: "sched-quote-cron-1",
                    owner_id: "user-cron-1",
                    character_id: null,
                    page_connection_id: "page-cron-1",
                    aspect_ratio: "9:16",
                    caption_template: "Kutipan malam #KataMutiara",
                    autopublish_enabled: true,
                    enabled: true,
                    post_mode: "quote",
                    quote_theme: "islami",
                    quote_visual_style: QUOTE_PRESETS.visualStyles[2].value,
                    use_random_song: true,
                    scene_details: "",
                    negative_prompt: ""
                }]);
            }
            if (url.includes("/rest/v1/social_page_connections?")) {
                return Response.json([{
                    id: "page-cron-1",
                    owner_id: "user-cron-1",
                    page_id: "11223344",
                    page_name: "Malam Tenang Page",
                    page_token_ciphertext: encryptedPageToken.ciphertext,
                    page_token_iv: encryptedPageToken.iv,
                    can_publish: true
                }]);
            }
            if (url.includes("/rest/v1/social_publisher_user_settings?")) {
                return Response.json([{
                    owner_id: "user-cron-1",
                    autopublish_enabled: true,
                    caption_template: "Kutipan malam #KataMutiara",
                    external_link: "https://genzai.id"
                }]);
            }
            if (url.includes("/rest/v1/social_facebook_songs?")) {
                return Response.json([
                    { id: "song-used", title: "Monokrom", artist: "Tulus", facebook_url: "https://www.facebook.com/reel/1", is_active: true },
                    { id: "song-fresh", title: "Bertaut", artist: "Nadin Amizah", facebook_url: "https://www.facebook.com/reel/777", is_active: true }
                ]);
            }
            if (url.includes("/rest/v1/social_publisher_model_quotas")) {
                return Response.json([]);
            }
            if (url.includes("/rest/v1/social_post_runs")) {
                if (method === "GET") {
                    return Response.json([{
                        song_id: "song-used",
                        song_title: "Monokrom",
                        quote_text: "Kutipan sebelumnya.",
                        scene_plan: { song_id: "song-used", song_title: "Monokrom" }
                    }]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    return Response.json([{ id: "run-cron-quote-1", ...payload }], { status: 201 });
                }
                if (method === "PATCH") {
                    const payload = JSON.parse(init.body);
                    updatedRuns.push(payload);
                    return Response.json([payload]);
                }
            }
            if (url.includes("/v1beta/interactions")) {
                const payload = JSON.parse(init.body || "{}");
                if (String(payload.model || "").includes("image")) {
                    return Response.json({
                        output_image: {
                            mime_type: "image/png",
                            data: TINY_PNG_BASE64
                        }
                    });
                }
                return Response.json({
                    outputs: [{
                        type: "text",
                        text: "QUOTE: Doa yang dipanjatkan diam-diam tetap terdengar paling jelas oleh langit.\nCAPTION: Selamat beristirahat, semoga esok lebih lapang."
                    }]
                });
            }
            if (url.includes("graph.facebook.com") && url.includes("/11223344?fields=")) {
                return Response.json({ id: "11223344", name: "Malam Tenang Page", tasks: ["CREATE_CONTENT", "MANAGE"] });
            }
            if (url.includes("graph.facebook.com") && url.endsWith("/11223344/photos")) {
                const form = init.body;
                publishedMessage = String(form.get("caption") || form.get("message") || "");
                return Response.json({ id: "photo-cron-1", post_id: "11223344_888999" });
            }
            if (url.includes("graph.facebook.com") && url.includes("11223344_888999")) {
                return Response.json({ permalink_url: "https://www.facebook.com/11223344/posts/888999" });
            }
            throw new Error(`Unexpected cron fetch URL: ${url}`);
        };

        const result = await runSocialPublisherCron(env);
        assert.equal(result.claimed, 1);
        assert.equal(result.skipped, false);

        const finalPatch = updatedRuns.at(-1);
        assert.equal(finalPatch.status, "posted");
        assert.equal(finalPatch.post_mode, "quote");
        assert.equal(finalPatch.song_id, "song-fresh");
        assert.equal(finalPatch.song_title, "Bertaut");
        assert.equal(finalPatch.song_artist, "Nadin Amizah");
        assert.equal(finalPatch.song_facebook_url, "https://www.facebook.com/reel/777");
        assert.match(finalPatch.quote_text, /Doa yang dipanjatkan diam-diam/);

        assert.match(publishedMessage, /“Doa yang dipanjatkan diam-diam tetap terdengar paling jelas oleh langit\.”/);
        assert.match(publishedMessage, /🎵 Lagu Facebook: Bertaut — Nadin Amizah/);
        assert.match(publishedMessage, /🎧 Musik di Facebook: https:\/\/www\.facebook\.com\/reel\/777/);
        assert.match(publishedMessage, /#KataMutiara$/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Studio Medsos HTML, JS, Light CSS, and SQL migration include Kata-kata Mutiara + Lagu Acak Facebook controls", () => {
    const html = fs.readFileSync(path.join(repoRoot, "admin-control/social-publisher.html"), "utf8");
    const js = fs.readFileSync(path.join(repoRoot, "admin-control/social-publisher.js"), "utf8");
    const lightCss = fs.readFileSync(path.join(repoRoot, "admin-control/assets/css/social-publisher-light.css"), "utf8");
    const sql = fs.readFileSync(path.join(repoRoot, "supabase/social-quote-music.sql"), "utf8");

    assert.equal(QUOTE_PRESETS.themes.length >= 8, true);
    assert.equal(QUOTE_PRESETS.visualStyles.length >= 8, true);

    assert.match(html, /id="songs-card"/);
    assert.match(html, /id="song-form"/);
    assert.match(html, /id="seed-default-songs"/);
    assert.match(html, /id="manual-post-mode"/);
    assert.match(html, /id="manual-quote-fields"/);
    assert.match(html, /id="manual-song-line"/);
    assert.match(html, /id="schedule-post-mode"/);
    assert.match(html, /id="schedule-quote-fields"/);
    assert.match(html, /id="schedule-random-song"/);

    assert.match(js, /function setManualPostMode\(/);
    assert.match(js, /function setSchedulePostMode\(/);
    assert.match(js, /async function loadFacebookSongs\(/);
    assert.match(js, /async function submitSong\(/);
    assert.match(js, /async function seedDefaultSongs\(/);
    assert.doesNotMatch(js, /from\s+["']\.\.\/lib\//, "Browser JS must not import ../lib/ outside dist/");

    assert.match(lightCss, /\.song-card/);
    assert.match(lightCss, /\.mode-tabs/);
    assert.match(lightCss, /\.badge\.quote-mode/);

    assert.match(sql, /create table if not exists public\.social_facebook_songs/i);
    assert.match(sql, /alter column character_id drop not null/i);
    assert.match(sql, /add column if not exists post_mode/i);
    assert.match(sql, /add column if not exists song_facebook_url/i);
});
