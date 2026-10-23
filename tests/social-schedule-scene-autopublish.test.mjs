import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import socialPublisherHandler from "../api/social-publisher.js";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";
import { encryptSecret } from "../lib/social-publisher/providers.js";
import {
    buildImagePrompt,
    createScenePlan,
    getScheduleIntervalPolicy,
    renderCaption,
    SCENE_PRESETS,
    SOCIAL_AUTO_NEGATIVE_PROMPT,
    SOCIAL_DEFAULT_CAMERA_ANGLE,
    sceneOverridesFromSchedule
} from "../lib/social-publisher/utils.js";

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    SUPABASE_ANON_KEY: "anon-test-key"
};

const migration = readFileSync(
    fileURLToPath(new URL("../supabase/social-schedule-autopublish-scene.sql", import.meta.url)),
    "utf8"
);
const canonicalSql = readFileSync(
    fileURLToPath(new URL("../supabase/social-auto-publisher.sql", import.meta.url)),
    "utf8"
);
const uiSource = readFileSync(
    fileURLToPath(new URL("../admin-control/social-publisher.js", import.meta.url)),
    "utf8"
);
const uiHtml = readFileSync(
    fileURLToPath(new URL("../admin-control/social-publisher.html", import.meta.url)),
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

function activeAccessRow(userId = "user-1") {
    return Response.json([{
        user_id: userId,
        is_active: true,
        duration_days: 30,
        started_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    }]);
}

function scheduleBody(overrides = {}) {
    return {
        character_id: "character-1",
        page_connection_id: "connection-1",
        interval_hours: 24,
        next_run_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        timezone: "Asia/Jakarta",
        aspect_ratio: "9:16",
        caption_template: "Cerita hari ini ✨",
        enabled: true,
        ...overrides
    };
}

/**
 * Mock Supabase untuk save-schedule. `existingSchedules` mengisi jumlah blok
 * jadwal yang sudah ada, `captured` menyimpan body yang dikirim ke database.
 */
function mockScheduleApi({ role, existingSchedules = 0, userId = "user-1" }) {
    const captured = { method: null, body: null, countQueried: false };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: userId });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: userId, role, status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow(userId);
        if (url.includes("/rest/v1/social_characters?select=id&")) return Response.json([{ id: "character-1" }]);
        if (url.includes("/rest/v1/social_page_connections?select=id,can_publish&")) {
            return Response.json([{ id: "connection-1", can_publish: true }]);
        }
        if (url.includes("/rest/v1/social_post_schedules?select=id&owner_id=eq.") && !options.method) {
            captured.countQueried = true;
            return Response.json(Array.from({ length: existingSchedules }, (_, index) => ({ id: `schedule-${index + 1}` })));
        }
        if (url.includes("/rest/v1/social_post_schedules") && (options.method === "POST" || options.method === "PATCH")) {
            const body = JSON.parse(options.body);
            captured.method = options.method;
            captured.body = body;
            return Response.json([{
                id: "schedule-1",
                character_id: body.character_id,
                page_connection_id: body.page_connection_id,
                enabled: body.enabled,
                interval_hours: body.interval_hours,
                next_run_at: body.next_run_at,
                timezone: body.timezone,
                aspect_ratio: body.aspect_ratio,
                caption_template: body.caption_template,
                ...Object.fromEntries(
                    Object.entries(body).filter(([key]) => key.startsWith("scene_") || key === "camera_angle" || key === "negative_prompt" || key === "autopublish_enabled")
                )
            }], { status: options.method === "POST" ? 201 : 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
    return {
        captured,
        restore() { globalThis.fetch = originalFetch; }
    };
}

async function postSchedule(body) {
    const response = makeResponse();
    await socialPublisherHandler({
        method: "POST",
        url: "/api/social-publisher?action=save-schedule",
        query: { action: "save-schedule" },
        headers: { authorization: "Bearer test-token" },
        body,
        env
    }, response);
    return response;
}

test("role USER dibatasi 2 blok jadwal, ADMIN/OWNER tanpa batas", () => {
    assert.equal(getScheduleIntervalPolicy("USER").maxSchedules, 2);
    assert.equal(getScheduleIntervalPolicy("ADMIN").maxSchedules, null);
    assert.equal(getScheduleIntervalPolicy("OWNER").maxSchedules, null);
});

test("save-schedule menolak jadwal ketiga untuk role USER", async () => {
    const mock = mockScheduleApi({ role: "USER", existingSchedules: 2 });
    try {
        const response = await postSchedule(scheduleBody());
        assert.equal(response.statusCode, 409);
        assert.match(response.body.error, /maksimal 2 jadwal/);
        assert.equal(mock.captured.method, null);
    } finally {
        mock.restore();
    }
});

test("save-schedule masih mengizinkan jadwal kedua untuk role USER", async () => {
    const mock = mockScheduleApi({ role: "USER", existingSchedules: 1 });
    try {
        const response = await postSchedule(scheduleBody());
        assert.equal(response.statusCode, 200);
        assert.equal(mock.captured.method, "POST");
    } finally {
        mock.restore();
    }
});

test("save-schedule tidak membatasi jumlah jadwal ADMIN meski sudah banyak", async () => {
    const mock = mockScheduleApi({ role: "ADMIN", existingSchedules: 7 });
    try {
        const response = await postSchedule(scheduleBody());
        assert.equal(response.statusCode, 200);
        assert.equal(mock.captured.method, "POST");
        assert.equal(mock.captured.countQueried, false, "role tanpa batas tidak perlu menghitung jadwal");
    } finally {
        mock.restore();
    }
});

test("save-schedule menyimpan parameter gambar dan switch autopublish per jadwal", async () => {
    const mock = mockScheduleApi({ role: "ADMIN" });
    try {
        const response = await postSchedule(scheduleBody({
            scene_location: "a warm, design-forward coffee shop in Jakarta",
            camera_angle: "low-angle shot looking slightly up at the subject",
            scene_situation: "reading a book at a quiet table, captured between moments",
            scene_lighting: "warm late-afternoon golden-hour light with natural skin tones",
            scene_atmosphere: "a calm, intimate atmosphere with a quiet everyday mood",
            scene_condition: "light drizzle just after rain with damp surfaces",
            scene_details: "holding a paperback novel",
            negative_prompt: "crowded background",
            autopublish_enabled: false
        }));
        assert.equal(response.statusCode, 200);
        assert.equal(mock.captured.body.autopublish_enabled, false);
        assert.equal(mock.captured.body.scene_location, "a warm, design-forward coffee shop in Jakarta");
        assert.equal(mock.captured.body.camera_angle, "low-angle shot looking slightly up at the subject");
        assert.equal(mock.captured.body.scene_situation, "reading a book at a quiet table, captured between moments");
        assert.equal(mock.captured.body.scene_lighting, "warm late-afternoon golden-hour light with natural skin tones");
        assert.equal(mock.captured.body.scene_atmosphere, "a calm, intimate atmosphere with a quiet everyday mood");
        assert.equal(mock.captured.body.scene_condition, "light drizzle just after rain with damp surfaces");
        assert.equal(mock.captured.body.scene_details, "holding a paperback novel");
        assert.equal(mock.captured.body.negative_prompt, "crowded background");
        assert.equal(response.body.schedule.autopublish_enabled, false);
    } finally {
        mock.restore();
    }
});

test("jadwal baru otomatis mengaktifkan autopublish jadwal tersebut", async () => {
    const mock = mockScheduleApi({ role: "ADMIN" });
    try {
        const response = await postSchedule(scheduleBody());
        assert.equal(response.statusCode, 200);
        assert.equal(mock.captured.body.autopublish_enabled, true);
        assert.equal(mock.captured.body.scene_location, "");
        assert.equal(mock.captured.body.camera_angle, "");
    } finally {
        mock.restore();
    }
});

test("edit jadwal tidak menyalakan ulang autopublish yang sedang dimatikan", async () => {
    const mock = mockScheduleApi({ role: "ADMIN" });
    try {
        const response = await postSchedule(scheduleBody({ id: "schedule-1", interval_hours: 12 }));
        assert.equal(response.statusCode, 200);
        assert.equal(mock.captured.method, "PATCH");
        assert.equal(Object.hasOwn(mock.captured.body, "autopublish_enabled"), false);
    } finally {
        mock.restore();
    }
});

test("edit jadwal menghormati switch autopublish yang dikirim eksplisit", async () => {
    const mock = mockScheduleApi({ role: "ADMIN" });
    try {
        await postSchedule(scheduleBody({ id: "schedule-1", autopublish_enabled: false }));
        assert.equal(mock.captured.body.autopublish_enabled, false);
    } finally {
        mock.restore();
    }
});

test("action set-schedule-autopublish hanya mengubah jadwal milik pemanggil", async () => {
    const originalFetch = globalThis.fetch;
    let patched = null;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "user-1", role: "USER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow("user-1");
        if (url.includes("/rest/v1/social_post_schedules")) {
            assert.equal(options.method, "PATCH");
            assert.match(url, /id=eq\.schedule-9/);
            assert.match(url, /owner_id=eq\.user-1/);
            patched = JSON.parse(options.body);
            return Response.json([{ id: "schedule-9", autopublish_enabled: false }]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=set-schedule-autopublish",
            query: { action: "set-schedule-autopublish" },
            headers: { authorization: "Bearer test-token" },
            body: { id: "schedule-9", enabled: false },
            env
        }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(patched.autopublish_enabled, false);
        assert.equal(response.body.schedule.autopublish_enabled, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("scene planner memakai medium shot saat angle kosong dan mengacak sisanya", () => {
    const scene = createScenePlan([], () => 0.42, {});
    assert.equal(scene.angle, SOCIAL_DEFAULT_CAMERA_ANGLE);
    assert.ok(scene.location);
    assert.ok(scene.situation);
    assert.ok(scene.lighting);
    assert.ok(scene.atmosphere);
    assert.ok(scene.condition);
    assert.equal(scene.details, "");
});

test("scene planner memakai parameter jadwal apa adanya bila diisi", () => {
    const overrides = {
        location: "a quiet seaside promenade at golden hour",
        angle: "wide environmental shot with generous negative space around the subject",
        situation: "standing comfortably and taking in the surrounding view",
        lighting: "soft blue-hour ambient light balanced with warm practical lights",
        atmosphere: "an elegant, understated atmosphere with a mature editorial mood",
        condition: "evening conditions with city lights in the background",
        details: "wearing a light scarf"
    };
    const scene = createScenePlan([], () => 0.42, overrides);
    assert.equal(scene.location, overrides.location);
    assert.equal(scene.angle, overrides.angle);
    assert.equal(scene.situation, overrides.situation);
    assert.equal(scene.lighting, overrides.lighting);
    assert.equal(scene.atmosphere, overrides.atmosphere);
    assert.equal(scene.condition, overrides.condition);
    assert.equal(scene.details, "wearing a light scarf");
});

test("sceneOverridesFromSchedule membaca kolom parameter jadwal", () => {
    assert.deepEqual(
        sceneOverridesFromSchedule({
            scene_location: "a café",
            camera_angle: "close-up portrait",
            scene_situation: "reading",
            scene_lighting: "soft light",
            scene_atmosphere: "calm",
            scene_condition: "rainy",
            scene_details: "holding a cup"
        }),
        {
            location: "a café",
            angle: "close-up portrait",
            situation: "reading",
            lighting: "soft light",
            atmosphere: "calm",
            condition: "rainy",
            details: "holding a cup"
        }
    );
});

test("prompt gambar memuat suasana, kondisi, angle default, dan negative prompt otomatis", () => {
    const prompt = buildImagePrompt({
        characterName: "Alya",
        scene: {
            location: "a café",
            outfit: "linen",
            situation: "reading",
            lighting: "soft light",
            atmosphere: "a calm, intimate atmosphere",
            condition: "clear sunny weather",
            details: "holding a paperback novel"
        },
        negativePrompt: "crowded background"
    });

    assert.match(prompt, /Camera: medium shot/);
    assert.match(prompt, /Atmosphere: a calm, intimate atmosphere/);
    assert.match(prompt, /Conditions: clear sunny weather/);
    assert.match(prompt, /Additional direction: holding a paperback novel/);
    assert.match(prompt, /Negative prompt: /);
    assert.ok(prompt.includes(SOCIAL_AUTO_NEGATIVE_PROMPT), "negative prompt otomatis harus selalu ikut");
    assert.match(prompt, /crowded background/);
});

test("caption mendukung token atmosfer dan kondisi", () => {
    const caption = renderCaption(
        "{name} di {location} · suasana {atmosphere} · {condition}",
        { location: "a café", atmosphere: "hangat", condition: "cerah" },
        "Alya"
    );
    assert.equal(caption, "Alya di a café · suasana hangat · cerah");
});

test("preset parameter gambar tersedia untuk dropdown form jadwal", () => {
    for (const key of ["locations", "angles", "situations", "lighting", "atmospheres", "conditions"]) {
        assert.ok(Array.isArray(SCENE_PRESETS[key]) && SCENE_PRESETS[key].length > 0, `preset ${key} kosong`);
        const first = SCENE_PRESETS[key][0];
        assert.ok(first.value && first.label, `preset ${key} tidak lengkap`);
    }
    assert.ok(SCENE_PRESETS.angles.some(option => option.value.startsWith(SOCIAL_DEFAULT_CAMERA_ANGLE)));
});

test("migration menambah switch autopublish jadwal, kolom scene, dan gate klaim", () => {
    assert.match(migration, /add column if not exists autopublish_enabled boolean not null default true/);
    for (const column of ["scene_location", "camera_angle", "scene_situation", "scene_lighting", "scene_atmosphere", "scene_condition", "scene_details", "negative_prompt"]) {
        assert.match(migration, new RegExp(`add column if not exists ${column}`), `kolom ${column} tidak ada di migration`);
    }
    assert.match(migration, /create or replace function public\.claim_due_social_post_schedules/);
    assert.match(migration, /and s\.autopublish_enabled = true/);
    assert.match(canonicalSql, /autopublish_enabled boolean not null default true/);
    assert.match(canonicalSql, /and s\.autopublish_enabled = true/);
    assert.match(canonicalSql, /add column if not exists scene_atmosphere/);
});

test("form jadwal menyediakan parameter gambar dan switch autopublish per blok", () => {
    for (const id of ["schedule-location", "schedule-angle", "schedule-situation", "schedule-atmosphere", "schedule-condition", "schedule-lighting", "schedule-details", "schedule-negative", "schedule-autopublish", "schedule-quota"]) {
        assert.match(uiHtml, new RegExp(`id="${id}"`), `elemen #${id} tidak ada`);
    }
    assert.match(uiHtml, /Otomatis — medium shot/);
    assert.match(uiSource, /set-schedule-autopublish/);
    assert.match(uiSource, /maxSchedules/);
    assert.match(uiSource, /scene_location: \$\("schedule-location"\)\.value/);
});

function pngChunk(type, data = new Uint8Array()) {
    const chunk = new Uint8Array(data.length + 12);
    new DataView(chunk.buffer).setUint32(0, data.length);
    chunk.set([...type].map(character => character.charCodeAt(0)), 4);
    chunk.set(data, 8);
    return chunk;
}

function pngBytes() {
    const parts = [
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", new Uint8Array(13)),
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

test("cron memakai parameter scene jadwal untuk prompt dan menyimpan buktinya", async () => {
    const originalFetch = globalThis.fetch;
    const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(6)));
    const encryptedToken = await encryptSecret("page-token-secret", encryptionKey);
    const image = pngBytes();
    const runPatches = [];
    let imagePrompt = "";
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/rest/v1/rpc/claim_due_social_post_schedules")) {
            return Response.json([{ run_id: "run-7", schedule_id: "schedule-7" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "owner-7",
                is_active: true,
                started_at: new Date(Date.now() - 86400000).toISOString(),
                expires_at: new Date(Date.now() + 30 * 86400000).toISOString()
            }]);
        }
        if (url.includes("/rest/v1/social_post_schedules?")) {
            return Response.json([{
                id: "schedule-7",
                owner_id: "owner-7",
                character_id: "character-7",
                page_connection_id: "connection-7",
                enabled: true,
                autopublish_enabled: true,
                interval_hours: 24,
                aspect_ratio: "9:16",
                caption_template: "Cerita hari ini ✨",
                timezone: "Asia/Jakarta",
                scene_location: "a rain-washed old-town street with colonial-era architecture",
                camera_angle: "",
                scene_situation: "walking naturally through the location while carrying a small bag",
                scene_lighting: "warm late-afternoon golden-hour light with natural skin tones",
                scene_atmosphere: "a gently melancholic atmosphere with reflective, quiet tones",
                scene_condition: "a light breeze moving hair and fabric naturally",
                scene_details: "holding a folded umbrella",
                negative_prompt: "yellow umbrella"
            }]);
        }
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-7",
                display_name: "Alya",
                reference_object_key: "social-reference/owner-7/reference.jpg",
                reference_mime_type: "image/jpeg",
                garment_object_key: "",
                prompt_notes: ""
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) {
            return Response.json([{
                id: "connection-7",
                page_id: "page-7",
                page_name: "Page 7",
                can_publish: true,
                page_token_ciphertext: encryptedToken.ciphertext,
                page_token_iv: encryptedToken.iv
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?select=scene_plan")) return Response.json([]);
        if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_user_settings?")) {
            return Response.json([{ caption_template: "Cerita hari ini ✨", external_link: "", autopublish_enabled: true }]);
        }
        if (url.includes("/rest/v1/social_publisher_config?")) {
            return Response.json([{ image_provider: "gemini", image_model: "" }]);
        }
        if (url.endsWith("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/storage/v1/object/authenticated/social-character-references/")) {
            return new Response(new Uint8Array([255, 216, 255, 0]), { status: 200 });
        }
        if (url.includes("generativelanguage.googleapis.com/v1beta/interactions")) {
            const body = JSON.parse(options.body);
            if (body.response_format) {
                imagePrompt = (body.input || []).filter(part => part.type === "text").map(part => part.text).join("\n");
                return Response.json({
                    output_image: { data: Buffer.from(image).toString("base64"), mime_type: "image/png" }
                });
            }
            return Response.json({ output_text: "Hai guys, lagi menikmati suasana sore." });
        }
        if (url.includes("graph.facebook.com/v26.0/page-7?fields=id%2Cname%2Ctasks")) {
            return Response.json({ id: "page-7", name: "Page 7", tasks: ["CREATE_CONTENT"] });
        }
        if (url.includes("graph.facebook.com/v26.0/page-7/photos")) {
            return Response.json({ id: "photo-7", post_id: "page-7_post-7" });
        }
        if (url.includes("/page-7_post-7?fields=permalink_url")) {
            return Response.json({ permalink_url: "https://www.facebook.com/page-7/posts/post-7" });
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.run-7")) {
            runPatches.push(JSON.parse(options.body));
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
        const result = await runSocialPublisherCron({ ...env, GEMINI_API_KEY: "gemini-test-key", SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKey });
        assert.equal(result.claimed, 1);
        assert.match(imagePrompt, /rain-washed old-town street/);
        assert.match(imagePrompt, /Camera: medium shot/);
        assert.match(imagePrompt, /Atmosphere: a gently melancholic atmosphere/);
        assert.match(imagePrompt, /Conditions: a light breeze/);
        assert.match(imagePrompt, /Additional direction: holding a folded umbrella/);
        assert.match(imagePrompt, /yellow umbrella/);
        assert.ok(imagePrompt.includes(SOCIAL_AUTO_NEGATIVE_PROMPT));
        assert.equal(runPatches.at(-1).status, "posted", String(runPatches.at(-1).error_message || ""));
        assert.match(runPatches.at(-1).generated_prompt, /rain-washed old-town street/);
        assert.equal(runPatches.at(-1).scene_plan.angle, SOCIAL_DEFAULT_CAMERA_ANGLE);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("cron melewati run yang jadwalnya mematikan autopublish", async () => {
    const originalFetch = globalThis.fetch;
    const runPatches = [];
    let generated = false;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/rest/v1/rpc/claim_due_social_post_schedules")) {
            return Response.json([{ run_id: "run-8", schedule_id: "schedule-8" }]);
        }
        if (url.includes("/rest/v1/social_post_schedules?")) {
            return Response.json([{
                id: "schedule-8",
                owner_id: "owner-8",
                character_id: "character-8",
                page_connection_id: "connection-8",
                enabled: true,
                autopublish_enabled: false,
                interval_hours: 24,
                aspect_ratio: "9:16",
                caption_template: "Cerita",
                timezone: "Asia/Jakarta"
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.run-8")) {
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
        const result = await runSocialPublisherCron({ ...env, SOCIAL_TOKEN_ENCRYPTION_KEY: "key" });
        assert.equal(result.claimed, 1);
        assert.equal(generated, false);
        assert.equal(runPatches.at(-1).status, "failed");
        assert.match(runPatches.at(-1).error_message, /Autopublish untuk jadwal ini sedang dimatikan/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("dashboard mengirim preset parameter gambar dan batas jadwal per role", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "user-1", role: "USER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow("user-1");
        if (url.includes("/rest/v1/social_characters?")) return Response.json([]);
        if (url.includes("/rest/v1/social_page_connections?")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_schedules?")) {
            assert.match(url, /scene_location/);
            assert.match(url, /autopublish_enabled/);
            return Response.json([{
                id: "schedule-1",
                character_id: "character-1",
                page_connection_id: "connection-1",
                enabled: true,
                autopublish_enabled: false,
                interval_hours: 24,
                next_run_at: new Date().toISOString(),
                aspect_ratio: "9:16",
                scene_location: "a café",
                camera_angle: "",
                scene_atmosphere: "calm"
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?")) return Response.json([]);
        if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_config?")) {
            return Response.json([{ id: true, global_enabled: true, image_provider: "gemini", image_model: "", updated_at: null }]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings?")) return Response.json([]);
        if (url.includes("/storage/v1/bucket")) return Response.json([{ id: "social-character-references", public: false }]);
        throw new Error(`Unexpected fetch: ${url}`);
    };
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=dashboard",
            query: { action: "dashboard" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.schedulePolicy.maxSchedules, 2);
        assert.equal(response.body.scheduleCount, 1);
        assert.equal(response.body.sceneSchemaReady, true);
        assert.equal(response.body.schedules[0].autopublish_enabled, false);
        assert.ok(Array.isArray(response.body.scenePresets.locations));
        assert.ok(response.body.scenePresets.atmospheres.length > 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("dashboard tetap tampil saat migration kolom scene belum dijalankan", async () => {
    const originalFetch = globalThis.fetch;
    const scheduleQueries = [];
    globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "user-1", role: "USER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow("user-1");
        if (url.includes("/rest/v1/social_characters?")) return Response.json([]);
        if (url.includes("/rest/v1/social_page_connections?")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_schedules?")) {
            scheduleQueries.push(url);
            if (url.includes("scene_location")) {
                return Response.json(
                    { message: "column social_post_schedules.autopublish_enabled does not exist", code: "42703" },
                    { status: 400 }
                );
            }
            return Response.json([{ id: "schedule-legacy", enabled: true, interval_hours: 24 }]);
        }
        if (url.includes("/rest/v1/social_post_runs?")) return Response.json([]);
        if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_config?")) {
            return Response.json([{ id: true, global_enabled: false, image_provider: "gemini", image_model: "", updated_at: null }]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings?")) return Response.json([]);
        if (url.includes("/storage/v1/bucket")) return Response.json([{ id: "social-character-references", public: false }]);
        throw new Error(`Unexpected fetch: ${url}`);
    };
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=dashboard",
            query: { action: "dashboard" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.sceneSchemaReady, false);
        assert.equal(response.body.schedules.length, 1);
        assert.equal(scheduleQueries.length, 2, "harus ada satu percobaan fallback");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("dashboard tetap tampil saat kolom autopublish akun belum ada", async () => {
    const originalFetch = globalThis.fetch;
    const settingsQueries = [];
    globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "user-1", role: "USER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow("user-1");
        if (url.includes("/rest/v1/social_characters?")) return Response.json([]);
        if (url.includes("/rest/v1/social_page_connections?")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_schedules?")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs?")) return Response.json([]);
        if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_config?")) {
            return Response.json([{ id: true, global_enabled: true, image_provider: "gemini", image_model: "", updated_at: null }]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings?")) {
            settingsQueries.push(url);
            if (url.includes("autopublish_enabled")) {
                return Response.json(
                    { message: 'column social_publisher_user_settings.autopublish_enabled does not exist', code: "42703" },
                    { status: 400 }
                );
            }
            return Response.json([{ caption_template: "Halo", external_link: "", updated_at: null }]);
        }
        if (url.includes("/storage/v1/bucket")) return Response.json([{ id: "social-character-references", public: false }]);
        throw new Error(`Unexpected fetch: ${url}`);
    };
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=dashboard",
            query: { action: "dashboard" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.autopublishSchemaReady, false);
        assert.equal(response.body.autopublishEnabled, true);
        assert.equal(response.body.postingSettings.caption_template, "Halo");
        assert.equal(settingsQueries.length, 2);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("cron tetap memakai jadwal lama saat kolom scene belum ada", async () => {
    const originalFetch = globalThis.fetch;
    const runPatches = [];
    let usedLegacySelect = false;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/rest/v1/rpc/claim_due_social_post_schedules")) {
            return Response.json([{ run_id: "run-11", schedule_id: "schedule-11" }]);
        }
        if (url.includes("/rest/v1/social_post_schedules?")) {
            if (url.includes("scene_location")) {
                return Response.json(
                    { message: "column social_post_schedules.autopublish_enabled does not exist", code: "42703" },
                    { status: 400 }
                );
            }
            usedLegacySelect = true;
            return Response.json([{
                id: "schedule-11",
                owner_id: "owner-11",
                character_id: "character-11",
                page_connection_id: "connection-11",
                enabled: true,
                interval_hours: 24,
                aspect_ratio: "9:16",
                caption_template: "Cerita",
                timezone: "Asia/Jakarta"
            }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([]);
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.run-11")) {
            runPatches.push(JSON.parse(options.body));
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
        const result = await runSocialPublisherCron({ ...env });
        assert.equal(result.claimed, 1);
        assert.equal(usedLegacySelect, true);
        assert.equal(runPatches.at(-1).status, "failed");
        assert.match(runPatches.at(-1).error_message, /belum memiliki langganan|Langganan/i);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
