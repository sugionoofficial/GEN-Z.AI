import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import socialPublisherHandler from "../api/social-publisher.js";
import {
    clampIntervalHours,
    getScheduleIntervalPolicy,
    normalizeSocialRole,
    SOCIAL_SCHEDULE_INTERVAL_POLICY
} from "../lib/social-publisher/utils.js";

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    SUPABASE_ANON_KEY: "anon-test-key"
};

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

/**
 * Mock Supabase for save-schedule. `role` decides the interval policy that the
 * API must enforce; `captured` keeps the interval that would be persisted.
 */
function mockScheduleApi({ role, userId = "user-1" }) {
    const captured = { intervalHours: null, method: null };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: userId });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: userId, role, status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow(userId);
        if (url.includes("/rest/v1/social_characters?select=id&")) {
            return Response.json([{ id: "character-1" }]);
        }
        if (url.includes("/rest/v1/social_page_connections?select=id,can_publish&")) {
            return Response.json([{ id: "connection-1", can_publish: true }]);
        }
        /* Cek kuota jumlah jadwal (role USER maksimal 2). */
        if (url.includes("/rest/v1/social_post_schedules?select=id&owner_id=eq.") && !options.method) {
            return Response.json([]);
        }
        if (url.includes("/rest/v1/social_post_schedules") && options.method === "POST") {
            const body = JSON.parse(options.body);
            captured.intervalHours = body.interval_hours;
            captured.method = "POST";
            return Response.json([{
                id: "schedule-1",
                character_id: body.character_id,
                page_connection_id: body.page_connection_id,
                enabled: body.enabled,
                interval_hours: body.interval_hours,
                next_run_at: body.next_run_at,
                timezone: body.timezone,
                aspect_ratio: body.aspect_ratio,
                caption_template: body.caption_template
            }], { status: 201 });
        }
        if (url.includes("/rest/v1/social_post_schedules") && options.method === "PATCH") {
            const body = JSON.parse(options.body);
            captured.intervalHours = body.interval_hours;
            captured.method = "PATCH";
            return Response.json([{
                id: "schedule-1",
                character_id: body.character_id,
                page_connection_id: body.page_connection_id,
                enabled: body.enabled,
                interval_hours: body.interval_hours,
                next_run_at: body.next_run_at,
                timezone: body.timezone,
                aspect_ratio: body.aspect_ratio,
                caption_template: body.caption_template
            }]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
    return {
        captured,
        restore() { globalThis.fetch = originalFetch; }
    };
}

function scheduleBody(overrides = {}) {
    return {
        character_id: "character-1",
        page_connection_id: "connection-1",
        interval_hours: 1,
        next_run_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        timezone: "Asia/Jakarta",
        aspect_ratio: "9:16",
        caption_template: "Cerita hari ini ✨",
        enabled: true,
        ...overrides
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

test("OWNER, ADMIN, and USER all have a one-hour minimum autopost interval", () => {
    for (const role of ["OWNER", "ADMIN", "USER"]) {
        const policy = getScheduleIntervalPolicy(role);
        assert.ok(policy, `${role} harus diizinkan`);
        assert.equal(policy.role, role);
        assert.equal(policy.minIntervalHours, 1);
        assert.equal(policy.maxIntervalHours, 168);
    }
    assert.equal(normalizeSocialRole("owner"), "OWNER");
    assert.equal(normalizeSocialRole(" Admin "), "ADMIN");
    assert.equal(normalizeSocialRole("user"), "USER");
    assert.equal(normalizeSocialRole("GUEST"), "");
    assert.equal(getScheduleIntervalPolicy("GUEST"), null);
    assert.equal(getScheduleIntervalPolicy(null), null);
    assert.deepEqual(Object.keys(SOCIAL_SCHEDULE_INTERVAL_POLICY).sort(), ["ADMIN", "OWNER", "USER"]);
});

test("interval clamping respects the per-role floor and keeps the legacy default", () => {
    assert.equal(clampIntervalHours(1), 1);
    assert.equal(clampIntervalHours(0), null);
    assert.equal(clampIntervalHours(1.5), null);
    assert.equal(clampIntervalHours(168), 168);
    assert.equal(clampIntervalHours(169), null);
    // 1 hour is the floor for every allowed role, so 30 minutes worth is rejected.
    assert.equal(clampIntervalHours(0.5, 1, 168), null);
    assert.equal(clampIntervalHours(1, 1, 168), 1);
});

for (const role of ["OWNER", "ADMIN", "USER"]) {
    test(`save-schedule accepts a one-hour interval for ${role}`, async () => {
        const mock = mockScheduleApi({ role });
        try {
            const response = await postSchedule(scheduleBody({ interval_hours: 1 }));
            assert.equal(response.statusCode, 200, JSON.stringify(response.body));
            assert.equal(response.body.schedule.interval_hours, 1);
            assert.equal(mock.captured.intervalHours, 1);
            assert.equal(mock.captured.method, "POST");
        } finally {
            mock.restore();
        }
    });

    test(`save-schedule rejects an interval below one hour for ${role}`, async () => {
        const mock = mockScheduleApi({ role });
        try {
            const response = await postSchedule(scheduleBody({ interval_hours: 0 }));
            assert.equal(response.statusCode, 400);
            assert.match(response.body.error, /1–168 jam/);
            assert.match(response.body.error, new RegExp(`role ${role}`));
            assert.equal(mock.captured.intervalHours, null, "Jadwal tidak boleh tersimpan saat interval di bawah batas");
        } finally {
            mock.restore();
        }
    });
}

test("save-schedule rejects roles outside OWNER, ADMIN, and USER", async () => {
    const mock = mockScheduleApi({ role: "GUEST" });
    try {
        const response = await postSchedule(scheduleBody({ interval_hours: 1 }));
        assert.equal(response.statusCode, 403);
        assert.match(response.body.error, /Role akun Anda tidak diizinkan/);
        assert.equal(mock.captured.method, null);
    } finally {
        mock.restore();
    }
});

test("save-schedule still enforces the seven-day upper bound", async () => {
    const mock = mockScheduleApi({ role: "OWNER" });
    try {
        const response = await postSchedule(scheduleBody({ interval_hours: 169 }));
        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /1–168 jam/);
    } finally {
        mock.restore();
    }
});

test("studio UI reads the role policy and blocks values below the minimum", () => {
    assert.match(uiSource, /state\.data\?\.schedulePolicy/, "UI harus membaca schedulePolicy dari dashboard");
    assert.match(uiSource, /minIntervalHours/, "UI harus memakai batas minimum dari server");
    assert.match(uiSource, /maxIntervalHours/, "UI harus memakai batas maksimum dari server");
    assert.match(uiSource, /input\.min = String\(min\)/, "Input interval harus di-set ke minimum role");
    assert.match(uiSource, /Minimal \$\{min\} jam/, "Pesan validasi harus menyebut batas minimum");
    assert.match(uiHtml, /id="interval-help"/, "Help text interval harus punya id agar bisa diperbarui");
});
