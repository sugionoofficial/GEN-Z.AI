import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relative) {
    return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

test("OpusClip Studio dihapus dari halaman, API, provider, navigasi, build, dan workflow", () => {
    for (const removed of [
        "opusclip/index.html",
        "opusclip/assets/js/opusclip-app.js",
        "api/opusclip.js",
        "api/opusclip-blackbox.js",
        "provider/opusclip/client.js",
        "provider/opusclip/mcp-understanding.js",
        "provider/opusclip/motion-ui-templates.js",
        "lib/opus/opusclip-credentials.js",
        "scripts/render-motion-ui.mjs",
        ".github/workflows/motion-ui-render.yml",
        "supabase/motion-ui-jobs.sql"
    ]) {
        assert.equal(fs.existsSync(path.join(ROOT, removed)), false, `${removed} harus dihapus`);
    }

    const nav = read("navigation/navigation.js");
    assert.doesNotMatch(nav, /OpusClip Studio/);
    assert.doesNotMatch(nav, /\/opusclip\/index\.html/);

    const worker = read("functions/worker.mjs");
    assert.doesNotMatch(worker, /\/api\/opusclip/);
    assert.match(worker, /\/api\/social-video-admin/);

    const build = read("scripts/build-cloudflare-pages.mjs");
    assert.doesNotMatch(build, /"opusclip"/);

    const blackbox = read("black-box/index.html");
    assert.doesNotMatch(blackbox, /OpusClip Studio/i);
    assert.doesNotMatch(blackbox, /bbOpusClipVaultPanel/);
    assert.match(blackbox, /SOCIAL OAUTH APP VAULT/);
});

test("tarif fitur admin tidak lagi menampilkan OpusClip Studio dan memakai social_video_post", () => {
    const admin = read("admin-control/feature-credits.js");
    const client = read("assets/js/feature-credit.js");
    const api = read("api/feature-credits.js");

    assert.doesNotMatch(admin, /opusclip_/);
    assert.doesNotMatch(client, /opusclip_/);
    assert.doesNotMatch(api, /opusclip_/);
    assert.match(admin, /social_video_post/);
    assert.match(client, /social_video_post/);
    assert.match(api, /social_video_post/);
});

test("OAuth callback lama tetap dipetakan ke Studio Medsos tanpa open redirect", async () => {
    const { default: callback } = await import("../api/social-video-oauth-callback.js");
    const headers = {};
    const res = {
        statusCode: 200,
        setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
        end(body) { this.body = body; }
    };
    await callback(
        {
            method: "GET",
            url: "/api/social-video-oauth-callback",
            headers: { host: "genzai.example.com", "x-forwarded-proto": "https" },
            env: {},
            fetchImpl: async () => new Response("[]", { status: 200 })
        },
        res
    );
    assert.equal(res.statusCode, 302);
    assert.match(headers.location, /^https:\/\/genzai\.example\.com\/admin-control\/social-publisher\.html/);
    assert.match(headers.location, /social_oauth_error=/);
    assert.doesNotMatch(headers.location, /opusclip/);
});

test("migrasi penghapusan menonaktifkan provider lama tanpa menghapus vault", () => {
    const sql = read("supabase/remove-opusclip-studio.sql");
    assert.match(sql, /update public\.providers[\s\S]*status = 'inactive'[\s\S]*provider_id in \('opusclip', 'opusclip_mcp'\)/);
    assert.doesNotMatch(sql, /delete from public\.provider_credentials/i);
    assert.doesNotMatch(sql, /delete from public\.providers/i);
    assert.match(sql, /social_video_post/);
});
