import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
    decryptAccountTokenPair,
    encryptAccountTokenPair,
    loadSocialVideoOAuthAppsConfig,
    resolveSocialVideoRedirectUri
} from "../lib/social-video/app-credentials.js";
import {
    assertSafePublicVideoUrl,
    buildPlatformAuthorizeUrl,
    composeFullSocialCaption,
    hashOAuthState,
    publishVideoToFacebookPage,
    publishVideoToTikTokAccount,
    publishVideoToYouTubeChannel,
    signPrivateVideoReference
} from "../lib/social-video/publisher.js";
import socialVideoAutopostHandler from "../api/social-video-autopost.js";
import socialVideoOAuthCallback from "../api/social-video-oauth-callback.js";
import opusclipBlackboxHandler from "../api/opusclip-blackbox.js";
import { runSocialVideoAutopostCron } from "../functions/_shared/social-video-autopost-cron.js";

const ROOT = process.cwd();

function createMockRes() {
    const headers = {};
    return {
        statusCode: 200,
        headers,
        body: null,
        setHeader(k, v) {
            headers[String(k).toLowerCase()] = v;
        },
        end(raw) {
            if (!raw) {
                this.body = "";
                return;
            }
            try {
                this.body = JSON.parse(raw);
            } catch {
                this.body = raw;
            }
        }
    };
}

test("Vault App OAuth & enkripsi token per-user (AES-256-GCM) + fallback otomatis Meta App", async () => {
    const env = {
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test",
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY: "0".repeat(64),
        META_APP_ID: "fbapp123",
        META_APP_SECRET: "fbsec"
    };

    const encPair = encryptAccountTokenPair("acc1", "ref1", env);
    const decPair = decryptAccountTokenPair(encPair, env);
    assert.equal(decPair.accessToken, "acc1");
    assert.equal(decPair.refreshToken, "ref1");

    const cfg = await loadSocialVideoOAuthAppsConfig(env, {
        fetchImpl: async () => new Response("[]", { status: 200 })
    });
    assert.equal(cfg.facebook.configured, true);
    assert.equal(cfg.facebook.source, "worker_env");
    assert.equal(cfg.youtube.configured, false);
    assert.equal(cfg.tiktok.configured, false);

    const redirect = resolveSocialVideoRedirectUri(
        { headers: { host: "genzai.example.com", "x-forwarded-proto": "https" } },
        env
    );
    assert.equal(redirect, "https://genzai.example.com/api/social-video-oauth-callback");

    /* Owner menyimpan YouTube OAuth lewat BLACK BOX MODUL 03 */
    let savedRow = null;
    const bbRes = createMockRes();
    await opusclipBlackboxHandler(
        {
            method: "POST",
            url: "/api/opusclip-blackbox",
            headers: { authorization: "Bearer test" },
            body: {
                action: "save_social_oauth_app",
                platform: "youtube",
                clientId: "ytcid1234",
                clientSecret: "ytsec"
            },
            env,
            fetchImpl: async (url, init) => {
                if (url.includes("/auth/v1/user")) {
                    return Response.json({ id: "u_owner", email: "o@genz.ai" });
                }
                if (url.includes("/rest/v1/profiles")) {
                    return Response.json([{ id: "u_owner", role: "owner" }]);
                }
                if (url.includes("/rest/v1/provider_credentials") && init?.method === "POST") {
                    savedRow = JSON.parse(init.body);
                    return new Response("", { status: 201 });
                }
                return new Response("[]", { status: 200 });
            }
        },
        bbRes
    );
    assert.equal(bbRes.statusCode, 200);
    assert.equal(savedRow.provider_id, "social_video_youtube");
});

test("Keamanan URL video & isolasi kepemilikan file privat antar-user", async () => {
    assert.equal(
        assertSafePublicVideoUrl("https://cdn.example.com/videos/demo.mp4"),
        "https://cdn.example.com/videos/demo.mp4"
    );
    assert.throws(() => assertSafePublicVideoUrl("http://cdn.example.com/a.mp4"), /HTTPS/);
    assert.throws(() => assertSafePublicVideoUrl("https://127.0.0.1/a.mp4"), /privat|lokal/i);
    assert.throws(() => assertSafePublicVideoUrl("https://169.254.169.254/latest"), /privat|lokal/i);

    /* Menolak akses ke folder milik user lain */
    await assert.rejects(
        () =>
            signPrivateVideoReference(
                "supabase-private://user-uploads/social-video/user-other/clip.mp4",
                {
                    userId: "user-me",
                    supabaseUrl: "https://mock.supabase.co",
                    serviceKey: "test",
                    fetchImpl: async () => new Response("[]", { status: 200 })
                }
            ),
        /tidak memiliki akses/i
    );

    /* Mengizinkan & menandatangani folder milik user sendiri */
    const signed = await signPrivateVideoReference(
        "supabase-private://user-uploads/social-video/user-me/clip.mp4",
        {
            userId: "user-me",
            supabaseUrl: "https://mock.supabase.co",
            serviceKey: "test",
            fetchImpl: async url => {
                assert.match(url, /\/storage\/v1\/object\/sign\/user-uploads\//);
                return Response.json({ signedURL: "/object/sign/user-uploads/social-video/user-me/clip.mp4?token=ok" });
            }
        }
    );
    assert.equal(
        signed,
        "https://mock.supabase.co/storage/v1/object/sign/user-uploads/social-video/user-me/clip.mp4?token=ok"
    );
});

test("Alur OAuth PKCE multi-user (Facebook, YouTube, TikTok) & callback universal", async () => {
    const appsConfig = {
        facebook: { configured: true, appId: "fb1", appSecret: "fbs", loginConfigId: "" },
        youtube: { configured: true, clientId: "yt1", clientSecret: "yts" },
        tiktok: { configured: true, clientKey: "tt1", clientSecret: "tts", postMode: "direct" }
    };
    const redirectUri = "https://genzai.example.com/api/social-video-oauth-callback";

    const fbUrl = new URL(
        buildPlatformAuthorizeUrl({ platform: "facebook", appsConfig, redirectUri, state: "s1" })
    );
    assert.equal(fbUrl.hostname, "www.facebook.com");
    assert.equal(fbUrl.searchParams.get("redirect_uri"), redirectUri);

    const ytUrl = new URL(
        buildPlatformAuthorizeUrl({
            platform: "youtube",
            appsConfig,
            redirectUri,
            state: "s2",
            codeChallenge: "cc2"
        })
    );
    assert.equal(ytUrl.hostname, "accounts.google.com");
    assert.equal(ytUrl.searchParams.get("code_challenge"), "cc2");

    const ttUrl = new URL(
        buildPlatformAuthorizeUrl({
            platform: "tiktok",
            appsConfig,
            redirectUri,
            state: "s3",
            codeChallenge: "cc3"
        })
    );
    assert.equal(ttUrl.hostname, "www.tiktok.com");
    assert.equal(ttUrl.searchParams.get("client_key"), "tt1");

    /* Callback YouTube menyimpan akun terenkripsi hanya untuk user_id pemilik state */
    const rawState = "state-yt-member";
    const expectedHash = hashOAuthState(rawState);
    let savedAccounts = null;

    const cbRes = createMockRes();
    await socialVideoOAuthCallback(
        {
            method: "GET",
            url: `/api/social-video-oauth-callback?code=c1&state=${rawState}`,
            headers: { host: "genzai.example.com", "x-forwarded-proto": "https" },
            env: {
                SUPABASE_URL: "https://mock.supabase.co",
                SUPABASE_SERVICE_ROLE_KEY: "test",
                PROVIDER_CREDENTIAL_ENCRYPTION_KEY: "0".repeat(64),
                GOOGLE_CLIENT_ID: "yt1",
                GOOGLE_CLIENT_SECRET: "yts"
            },
            fetchImpl: async (url, init) => {
                if (url.includes("social_video_oauth_states?select=")) {
                    assert.ok(url.includes(expectedHash));
                    return Response.json([
                        {
                            id: "11111111-1111-4111-8111-111111111111",
                            user_id: "22222222-2222-4222-8222-222222222222",
                            platform: "youtube",
                            code_verifier: "ver1",
                            return_path: "/opusclip/?tab=social",
                            expires_at: new Date(Date.now() + 600_000).toISOString()
                        }
                    ]);
                }
                if (url.includes("social_video_oauth_states?id=")) {
                    return new Response("", { status: 204 });
                }
                if (url.includes("provider_credentials")) {
                    return new Response("[]", { status: 200 });
                }
                if (url === "https://oauth2.googleapis.com/token") {
                    return Response.json({ access_token: "ok", refresh_token: "rf", expires_in: 3600 });
                }
                if (url.includes("googleapis.com/youtube/v3/channels")) {
                    return Response.json({
                        items: [{ id: "UC_TEST_1", snippet: { title: "Channel Member", customUrl: "@member" } }]
                    });
                }
                if (url.includes("social_video_accounts?on_conflict=") && init?.method === "POST") {
                    savedAccounts = JSON.parse(init.body);
                    return new Response("", { status: 201 });
                }
                return new Response("[]", { status: 200 });
            }
        },
        cbRes
    );

    assert.equal(cbRes.statusCode, 302);
    assert.match(cbRes.headers.location, /connected=youtube/);
    assert.equal(savedAccounts.length, 1);
    assert.equal(savedAccounts[0].user_id, "22222222-2222-4222-8222-222222222222");
    assert.equal(savedAccounts[0].external_account_id, "UC_TEST_1");
});

test("Publisher protokol: Facebook Video, YouTube Resumable, & TikTok Auto-Fallback Inbox", async () => {
    assert.equal(
        composeFullSocialCaption("Halo dunia", "shorts, #viral"),
        "Halo dunia\n\n#shorts #viral"
    );

    /* 1. Facebook */
    const fbOut = await publishVideoToFacebookPage({
        pageId: "998877",
        pageAccessToken: "tok",
        videoUrl: "https://cdn.example.com/v.mp4",
        title: "Judul FB",
        caption: "Isi FB",
        hashtags: "#reels",
        fetchImpl: async url => {
            assert.match(url, /graph-video\.facebook\.com\/v21\.0\/998877\/videos/);
            return Response.json({ id: "554433" });
        }
    });
    assert.equal(fbOut.remotePostId, "554433");

    /* 2. YouTube Resumable */
    const ytOut = await publishVideoToYouTubeChannel({
        accessToken: "tok",
        videoUrl: "https://cdn.example.com/v.mp4",
        title: "Shorts AI",
        caption: "Deskripsi",
        hashtags: "#shorts",
        fetchImpl: async (url, init) => {
            if (url === "https://cdn.example.com/v.mp4") {
                return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
            }
            if (url.includes("uploadType=resumable")) {
                return new Response("", {
                    status: 200,
                    headers: { Location: "https://www.googleapis.com/upload/session/1" }
                });
            }
            if (url === "https://www.googleapis.com/upload/session/1" && init.method === "PUT") {
                return Response.json({ id: "yt_vid_9" });
            }
            return new Response("", { status: 404 });
        }
    });
    assert.equal(ytOut.remotePostUrl, "https://www.youtube.com/watch?v=yt_vid_9");

    /* 3. TikTok otomatis fallback ke Inbox Draft bila app belum diaudit */
    const ttCalls = [];
    const ttOut = await publishVideoToTikTokAccount({
        accessToken: "tok",
        accountHandle: "@kreator",
        videoUrl: "https://cdn.example.com/v.mp4",
        title: "Konten TikTok",
        caption: "Caption",
        hashtags: "#fyp",
        fetchImpl: async (url, init) => {
            ttCalls.push(url);
            if (url === "https://cdn.example.com/v.mp4") {
                return new Response(new Uint8Array([9, 8, 7, 6]), { status: 200 });
            }
            if (url.endsWith("/post/publish/video/init/")) {
                return Response.json(
                    { error: { code: "unaudited_client_can_only_post_to_private_accounts", message: "unaudited" } },
                    { status: 403 }
                );
            }
            if (url.endsWith("/post/publish/inbox/video/init/")) {
                return Response.json({
                    data: { publish_id: "pub_tt_1", upload_url: "https://upload.tiktokapis.com/put/1" },
                    error: { code: "ok" }
                });
            }
            if (url === "https://upload.tiktokapis.com/put/1" && init.method === "PUT") {
                return new Response("", { status: 201 });
            }
            return new Response("", { status: 404 });
        }
    });
    assert.equal(ttOut.deliveredToInbox, true);
    assert.equal(ttOut.remotePostId, "pub_tt_1");
    assert.ok(ttCalls.some(u => u.endsWith("/inbox/video/init/")));
});

test("Member create_posts: potong kredit per post & auto-refund jika gagal + cron terjadwal", async () => {
    const env = {
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test",
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY: "0".repeat(64),
        META_APP_ID: "fb1",
        META_APP_SECRET: "fbs"
    };
    const encTok = encryptAccountTokenPair("tok", "", env);
    const acctId = "33333333-3333-4333-8333-333333333333";
    const rpcLog = [];

    /* Skenario gagal upstream -> wajib auto-refund kredit */
    const failRes = createMockRes();
    await socialVideoAutopostHandler(
        {
            method: "POST",
            url: "/api/social-video-autopost",
            headers: { authorization: "Bearer test" },
            body: {
                action: "create_posts",
                accountIds: [acctId],
                videoRef: "https://cdn.example.com/demo.mp4",
                title: "Post Member",
                publishNow: true
            },
            env,
            fetchImpl: async (url, init) => {
                if (url.includes("/auth/v1/user")) {
                    return Response.json({ id: "44444444-4444-4444-8444-444444444444", email: "m@genz.ai" });
                }
                if (url.includes("/rest/v1/profiles")) {
                    return Response.json([{ id: "44444444-4444-4444-8444-444444444444", role: "user", credits: 1000 }]);
                }
                if (url.includes("/rest/v1/feature_credit_settings")) {
                    return Response.json([{ credit_cost: 250 }]);
                }
                if (url.includes("/rest/v1/social_video_accounts")) {
                    return Response.json([
                        {
                            id: acctId,
                            user_id: "44444444-4444-4444-8444-444444444444",
                            platform: "facebook",
                            external_account_id: "12345",
                            account_name: "Page Member",
                            status: "active",
                            ...encTok
                        }
                    ]);
                }
                if (url.includes("/rest/v1/social_video_posts") && init?.method === "POST") {
                    return Response.json(JSON.parse(init.body));
                }
                if (url.includes("/rest/v1/social_video_posts")) {
                    return Response.json([]);
                }
                if (url.includes("/rest/v1/provider_credentials")) {
                    return Response.json([]);
                }
                if (url.includes("/rpc/charge_feature_credits")) {
                    rpcLog.push({ rpc: "charge", body: JSON.parse(init.body) });
                    return Response.json({ cost: 250, credits: 750 });
                }
                if (url.includes("/rpc/settle_feature_credits")) {
                    rpcLog.push({ rpc: "settle", body: JSON.parse(init.body) });
                    return Response.json({ status: "refunded" });
                }
                if (url.includes("graph-video.facebook.com")) {
                    return Response.json({ error: { message: "Upstream error" } }, { status: 500 });
                }
                return Response.json([]);
            }
        },
        failRes
    );

    assert.equal(failRes.statusCode, 400);
    assert.equal(rpcLog.length, 2);
    assert.equal(rpcLog[0].body.p_feature_id, "opusclip_social_post");
    assert.equal(rpcLog[1].body.p_outcome, "refund");

    /* Skenario Cron mengeksekusi jadwal jatuh tempo & sukses */
    const cronOut = await runSocialVideoAutopostCron(env, new Date(), {
        fetchImpl: async (url, init) => {
            if (url.includes("/rpc/claim_due_social_video_posts")) {
                return Response.json([
                    {
                        id: "55555555-5555-4555-8555-555555555555",
                        user_id: "44444444-4444-4444-8444-444444444444",
                        account_id: acctId,
                        platform: "facebook",
                        video_ref: "https://cdn.example.com/scheduled.mp4",
                        title: "Jadwal Pagi",
                        caption: "Selamat pagi",
                        hashtags: "#pagi",
                        credit_cost: 250
                    }
                ]);
            }
            if (url.includes("/rest/v1/social_video_accounts")) {
                return Response.json([
                    {
                        id: acctId,
                        user_id: "44444444-4444-4444-8444-444444444444",
                        platform: "facebook",
                        external_account_id: "12345",
                        account_name: "Page Member",
                        status: "active",
                        ...encTok
                    }
                ]);
            }
            if (url.includes("/rpc/charge_feature_credits")) {
                return Response.json({ cost: 250, credits: 750 });
            }
            if (url.includes("/rpc/settle_feature_credits")) {
                assert.equal(JSON.parse(init.body).p_outcome, "complete");
                return Response.json({ status: "completed" });
            }
            if (url.includes("graph-video.facebook.com")) {
                return Response.json({ id: "fb_post_ok" });
            }
            return Response.json([]);
        }
    });

    assert.equal(cronOut.ok, true);
    assert.equal(cronOut.claimed, 1);
    assert.equal(cronOut.published, 1);
});

test("UI /opusclip/ membuka tab Social & Auto Post untuk semua user sambil mengunci panel API Org ke Admin", () => {
    const opusHtml = fs.readFileSync(path.join(ROOT, "opusclip/index.html"), "utf8");
    const bbHtml = fs.readFileSync(path.join(ROOT, "black-box/index.html"), "utf8");

    assert.match(opusHtml, /id="ocSocialTabBtn"(?![^>]*hidden)/);
    assert.match(opusHtml, /id="ocConnectFbBtn"/);
    assert.match(opusHtml, /id="ocConnectYtBtn"/);
    assert.match(opusHtml, /id="ocConnectTtBtn"/);
    assert.match(opusHtml, /id="ocAdminOpusOrgSection"\s+hidden/);
    assert.match(bbHtml, /id="bbSocialOAuthStatus"/);
});
