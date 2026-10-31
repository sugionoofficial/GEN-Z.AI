import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
    createFreeCreditHandler,
    resetFreeCreditRateLimitsForTests
} from "../api/free-credit.js";
import {
    extractClientNetwork,
    FREE_CREDIT_AMOUNT,
    mapClaimErrorResponse,
    normalizeIpAndSubnet,
    validateBannerImageUrl,
    validateBrowserSignals
} from "../lib/free-credit/service.js";

const ROOT = process.cwd();

function readRepoFile(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function createMockRes() {
    const headers = new Map();
    return {
        statusCode: 200,
        body: null,
        setHeader(k, v) {
            headers.set(String(k).toLowerCase(), String(v));
            return this;
        },
        getHeader(k) {
            return headers.get(String(k).toLowerCase()) || null;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

const VALID_BFP = `bfp_v1_${"a1".repeat(32)}`;
const VALID_BID = "bid_v1_9876543210abcdef1234";
const VALID_UA =
    "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const TEST_ENV = {
    SUPABASE_URL: "https://ycovbqmezhrvzobxqnyp.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_secret_test_key",
    SUPABASE_ANON_KEY: "anon_public_test_key"
};

test("SQL free-credit-claims.sql mengunci nominal 5.000, indeks unik email/IP/password/browser, RLS, dan ACL service_role", () => {
    const sql = readRepoFile("supabase/free-credit-claims.sql");
    const hardeningSql = readRepoFile("supabase/credit-rpc-hardening.sql");

    assert.equal(FREE_CREDIT_AMOUNT, 5000);
    assert.match(sql, /credit_amount integer not null default 5000 check \(credit_amount = 5000\)/i);

    for (const uniqueIdx of [
        "uq_free_credit_claims_claimed_user",
        "uq_free_credit_claims_email_exact",
        "uq_free_credit_claims_email_canonical",
        "uq_free_credit_claims_ip_address",
        "uq_free_credit_claims_ip_subnet",
        "uq_free_credit_claims_password_hash",
        "uq_free_credit_claims_browser_fp",
        "uq_free_credit_claims_browser_install"
    ]) {
        assert.ok(sql.includes(uniqueIdx), `Wajib memiliki unique index ${uniqueIdx}`);
    }

    for (const tableName of [
        "free_credit_secret_config",
        "free_credit_user_signals",
        "free_credit_claims",
        "free_credit_claim_attempts"
    ]) {
        assert.match(
            sql,
            new RegExp(`alter table public\\.${tableName} enable row level security`, "i"),
            `Tabel ${tableName} wajib mengaktifkan RLS`
        );
    }

    assert.match(sql, /'free_claim'::text/);
    assert.match(sql, /extensions\.crypt\(p_password,\s*v_user\.encrypted_password\)/);
    assert.match(sql, /extensions\.hmac\(/);
    assert.match(sql, /revoke all on function public\.claim_free_credit_5000[\s\S]*?from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.claim_free_credit_5000[\s\S]*?to service_role/i);
    assert.ok(hardeningSql.includes("claim_free_credit_5000(uuid,text,text,text,text,text,text,text,text,text)"));
});

test("normalizeIpAndSubnet & validateBrowserSignals menormalisasi IPv4/IPv6 dan menolak bot/sinyal palsu", () => {
    assert.deepEqual(normalizeIpAndSubnet("203.0.113.45:8443"), {
        ip: "203.0.113.45",
        subnet: null
    });
    assert.deepEqual(normalizeIpAndSubnet("::ffff:103.20.30.40"), {
        ip: "103.20.30.40",
        subnet: null
    });
    assert.deepEqual(normalizeIpAndSubnet("2001:db8:abcd:12::99"), {
        ip: "2001:0db8:abcd:0012:0000:0000:0000:0099",
        subnet: "2001:0db8:abcd:0012::/64"
    });
    assert.deepEqual(normalizeIpAndSubnet("999.1.1.1"), {
        ip: null,
        subnet: null
    });

    const okBrowser = validateBrowserSignals({
        browserFingerprint: VALID_BFP,
        browserInstallId: VALID_BID,
        userAgent: VALID_UA
    });
    assert.equal(okBrowser.ok, true);

    const botCheck = validateBrowserSignals({
        browserFingerprint: VALID_BFP,
        browserInstallId: VALID_BID,
        userAgent: "curl/8.5.0"
    });
    assert.equal(botCheck.ok, false);
    assert.equal(botCheck.code, "invalid_browser");

    const badFpCheck = validateBrowserSignals({
        browserFingerprint: "short_fp",
        browserInstallId: VALID_BID,
        userAgent: VALID_UA
    });
    assert.equal(badFpCheck.ok, false);
    assert.equal(badFpCheck.code, "missing_security_signals");

    const net = extractClientNetwork({
        headers: {
            "cf-connecting-ip": "103.10.20.30",
            "user-agent": VALID_UA
        },
        cf: { country: "ID", city: "Depok" }
    });
    assert.equal(net.ip, "103.10.20.30");
    assert.equal(net.country, "ID");
    assert.equal(net.city, "Depok");
    assert.match(net.browserSummary, /Chrome/);
});

test("mapClaimErrorResponse menyusun alasan penolakan kesamaan email, IP, password, dan browser secara jelas", () => {
    const dupAll = mapClaimErrorResponse("duplicate_ip", [
        "duplicate_ip",
        "duplicate_password",
        "duplicate_browser"
    ]);
    assert.equal(dupAll.status, 409);
    assert.match(dupAll.message, /alamat IP, password, dan browser/);
    assert.match(dupAll.message, /5\.000 Gratis/);

    const pwReq = mapClaimErrorResponse("password_required", []);
    assert.equal(pwReq.status, 428);
    assert.equal(pwReq.requiresPassword, true);
});

test("API /api/free-credit mengizinkan klaim unik 5.000 kredit memakai service_role dan menolak kesamaan IP/password/browser", async () => {
    resetFreeCreditRateLimitsForTests();
    const rpcCalls = [];

    const handler = createFreeCreditHandler({
        env: TEST_ENV,
        fetchImpl: async (url, options = {}) => {
            if (url.endsWith("/auth/v1/user")) {
                return new Response(
                    JSON.stringify({
                        id: "11111111-2222-3333-4444-555555555555",
                        email: "kreator@gmail.com"
                    }),
                    { status: 200 }
                );
            }
            if (url.includes("/rest/v1/free_credit_settings")) {
                return new Response(
                    JSON.stringify([
                        {
                            id: 1,
                            claim_enabled: true,
                            banner_image_url: null
                        }
                    ]),
                    { status: 200 }
                );
            }
            if (url.endsWith("/rest/v1/rpc/claim_free_credit_5000")) {
                const parsedBody = JSON.parse(options.body);
                rpcCalls.push({ headers: options.headers, body: parsedBody });

                if (parsedBody.p_ip_address === "103.10.20.30") {
                    return new Response(
                        JSON.stringify({
                            ok: true,
                            claim_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                            credit_amount: 5000,
                            balance_before: 0,
                            balance_after: 5000,
                            claimed_at: "2026-10-31T12:00:00Z"
                        }),
                        { status: 200 }
                    );
                }

                return new Response(
                    JSON.stringify({
                        ok: false,
                        code: "duplicate_password",
                        matched_reasons: ["duplicate_ip", "duplicate_password", "duplicate_browser"]
                    }),
                    { status: 200 }
                );
            }
            throw new Error(`Unexpected URL: ${url}`);
        }
    });

    // 1. Klaim pertama berhasil (+5.000 credit), user_id palsu di body diabaikan
    const res1 = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer valid_user_jwt",
                "cf-connecting-ip": "103.10.20.30",
                "user-agent": VALID_UA
            },
            cf: { country: "ID", city: "Depok" },
            body: {
                action: "claim",
                user_id: "99999999-9999-9999-9999-999999999999",
                browser_fingerprint: VALID_BFP,
                browser_install_id: VALID_BID
            }
        },
        res1
    );

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.ok, true);
    assert.equal(res1.body.credit_amount, 5000);
    assert.equal(res1.body.balance_after, 5000);
    assert.equal(rpcCalls[0].body.p_user_id, "11111111-2222-3333-4444-555555555555");
    assert.equal(
        rpcCalls[0].headers.Authorization,
        `Bearer ${TEST_ENV.SUPABASE_SERVICE_ROLE_KEY}`
    );

    // 2. Klaim dengan kesamaan IP/password/browser ditolak 409
    const res2 = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer valid_user_jwt",
                "cf-connecting-ip": "103.10.20.99",
                "user-agent": VALID_UA
            },
            body: {
                action: "claim",
                browser_fingerprint: VALID_BFP,
                browser_install_id: VALID_BID
            }
        },
        res2
    );

    assert.equal(res2.statusCode, 409);
    assert.equal(res2.body.ok, false);
    assert.deepEqual(res2.body.matched_reasons, [
        "duplicate_ip",
        "duplicate_password",
        "duplicate_browser"
    ]);
    assert.match(res2.body.error, /alamat IP, password, dan browser/);
});

test("Worker, halaman auth, dashboard, topup, dan credit usage memuat integrasi Free Credit 5.000", () => {
    const worker = readRepoFile("functions/worker.mjs");
    const authJs = readRepoFile("assets/js/auth.js");
    const loginHtml = readRepoFile("login.html");
    const registerHtml = readRepoFile("register.html");
    const resetHtml = readRepoFile("reset-password.html");
    const dashboardHtml = readRepoFile("user/dashboard.html");
    const topupHtml = readRepoFile("user/topup.html");
    const creditHtml = readRepoFile("credit/index.html");
    const adminPanelHtml = readRepoFile("admin-control/admin-panel.html");
    const adminClaimsHtml = readRepoFile("admin-control/free-credit-claims.html");

    assert.match(worker, /\["\/api\/free-credit",\s*freeCredit\]/);
    assert.match(authJs, /GENZ_FREE_CREDIT\.recordAuthSignal/);
    assert.match(loginHtml, /free-credit-claim\.js/);
    assert.match(registerHtml, /free-credit-claim\.js/);
    assert.match(registerHtml, /source:\s*"register"/);
    assert.match(resetHtml, /free-credit-claim\.js/);
    assert.match(resetHtml, /source:\s*"password_reset"/);
    assert.match(dashboardHtml, /id="freeCreditClaimMount"/);
    assert.match(dashboardHtml, /mountClaimCard/);
    assert.match(topupHtml, /id="freeCreditClaimMount"/);
    assert.match(topupHtml, /mountClaimCard/);
    assert.match(creditHtml, /id="freeCreditClaimMount"/);
    assert.match(adminPanelHtml, /href="\.\/free-credit-claims\.html"/);
    assert.match(adminClaimsHtml, /\/api\/free-credit\?action=admin-summary/);
});

test("On/Off Monitoring & upload gambar banner 16:9 bekerja penuh dari Admin hingga kartu mewah User", async () => {
    resetFreeCreditRateLimitsForTests();

    const sql = readRepoFile("supabase/free-credit-claims.sql");
    const claimClientJs = readRepoFile("assets/js/free-credit-claim.js");
    const monitoringHtml = readRepoFile("admin-control/monitoring.html");

    assert.match(sql, /create table if not exists public\.free_credit_settings/i);
    assert.match(sql, /alter table public\.free_credit_settings enable row level security/i);
    assert.match(sql, /'feature_disabled'/);
    assert.match(claimClientJs, /aspect-ratio:16 \/ 9/);
    assert.match(claimClientJs, /data\.claim_enabled === false/);
    assert.match(claimClientJs, /genzFcBannerImg/);
    assert.match(monitoringHtml, /id="monFreeCreditPanel"/);
    assert.match(monitoringHtml, /id="monFcEnabledToggle"/);
    assert.match(monitoringHtml, /id="monFcBannerInput"/);

    // Validasi URL banner 16:9
    const validBanner = validateBannerImageUrl(
        "https://ycovbqmezhrvzobxqnyp.supabase.co/storage/v1/object/public/site-announcements/free-credit-banner/banner_16x9_abcd1234.webp",
        TEST_ENV.SUPABASE_URL
    );
    assert.equal(validBanner.ok, true);
    assert.equal(validBanner.objectPath, "free-credit-banner/banner_16x9_abcd1234.webp");

    const invalidBanner = validateBannerImageUrl(
        "https://evil.example.com/banner.webp",
        TEST_ENV.SUPABASE_URL
    );
    assert.equal(invalidBanner.ok, false);

    const disabledMapped = mapClaimErrorResponse("feature_disabled", ["feature_disabled"]);
    assert.equal(disabledMapped.status, 403);

    // Simulasi state server untuk uji upload-banner, update-settings, status, dan penolakan saat OFF
    let currentRole = "OWNER";
    let settingsState = {
        id: 1,
        claim_enabled: true,
        banner_image_url: null,
        updated_at: "2026-10-31T14:00:00Z"
    };
    const deletedObjects = [];

    const handler = createFreeCreditHandler({
        env: TEST_ENV,
        fetchImpl: async (url, options = {}) => {
            const method = String(options.method || "GET").toUpperCase();

            if (url.endsWith("/auth/v1/user")) {
                return Response.json({
                    id: "owner-0001-0002-0003-000000000001",
                    email: "owner@genz.ai"
                });
            }
            if (url.includes("/rest/v1/profiles")) {
                return Response.json([{ id: "owner-0001-0002-0003-000000000001", role: currentRole }]);
            }
            if (url.endsWith("/storage/v1/bucket")) {
                return Response.json({ id: "site-announcements" });
            }
            if (url.includes("/storage/v1/object/site-announcements/free-credit-banner/")) {
                if (method === "DELETE") {
                    deletedObjects.push(url);
                    return Response.json({ message: "Deleted" });
                }
                return Response.json({ Key: "site-announcements/free-credit-banner/uploaded.webp" });
            }
            if (url.includes("/rest/v1/free_credit_settings")) {
                if (method === "POST") {
                    const parsed = JSON.parse(options.body);
                    settingsState = {
                        id: 1,
                        claim_enabled: parsed.claim_enabled,
                        banner_image_url: parsed.banner_image_url,
                        updated_at: parsed.updated_at
                    };
                    return Response.json([settingsState]);
                }
                return Response.json([settingsState]);
            }
            if (url.endsWith("/rest/v1/rpc/get_free_credit_claim_status")) {
                return Response.json({
                    ok: true,
                    claim_enabled: settingsState.claim_enabled,
                    banner_image_url: settingsState.banner_image_url,
                    credit_amount: 5000,
                    claimed: false,
                    claimed_at: null,
                    has_password_signal: true
                });
            }
            throw new Error(`Unexpected URL in test: ${url}`);
        }
    });

    // 1. Upload gambar 16:9 oleh OWNER berhasil & tersimpan
    const fakeWebp = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 69, 66, 80]);
    const uploadRes = createMockRes();
    await handler(
        {
            method: "POST",
            query: { action: "upload-banner" },
            headers: {
                authorization: "Bearer owner_jwt",
                "content-type": "image/webp",
                "content-length": String(fakeWebp.byteLength)
            },
            body: fakeWebp
        },
        uploadRes
    );
    assert.equal(uploadRes.statusCode, 200);
    assert.equal(uploadRes.body.ok, true);
    assert.match(
        uploadRes.body.banner_image_url,
        /^https:\/\/ycovbqmezhrvzobxqnyp\.supabase\.co\/storage\/v1\/object\/public\/site-announcements\/free-credit-banner\/.+\.webp$/
    );
    const firstBannerUrl = uploadRes.body.banner_image_url;

    // 2. Role USER biasa ditolak mengubah pengaturan On/Off
    currentRole = "USER";
    const forbiddenRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: { authorization: "Bearer user_jwt" },
            body: { action: "update-settings", claim_enabled: false }
        },
        forbiddenRes
    );
    assert.equal(forbiddenRes.statusCode, 403);

    // 3. OWNER mematikan fitur (OFF) dari Monitoring
    currentRole = "OWNER";
    const toggleOffRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: { authorization: "Bearer owner_jwt" },
            body: { action: "update-settings", claim_enabled: false }
        },
        toggleOffRes
    );
    assert.equal(toggleOffRes.statusCode, 200);
    assert.equal(toggleOffRes.body.settings.claim_enabled, false);
    assert.equal(toggleOffRes.body.settings.banner_image_url, firstBannerUrl);

    // 4. Endpoint status mengembalikan claim_enabled=false & banner_image_url
    const statusRes = createMockRes();
    await handler(
        {
            method: "GET",
            query: { action: "status" },
            headers: { authorization: "Bearer user_jwt" }
        },
        statusRes
    );
    assert.equal(statusRes.statusCode, 200);
    assert.equal(statusRes.body.claim_enabled, false);
    assert.equal(statusRes.body.banner_image_url, firstBannerUrl);

    // 5. Saat OFF, percobaan klaim langsung ditolak 403 feature_disabled
    const claimWhenOffRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer user_jwt",
                "cf-connecting-ip": "103.10.20.77",
                "user-agent": VALID_UA
            },
            body: {
                action: "claim",
                browser_fingerprint: VALID_BFP,
                browser_install_id: VALID_BID
            }
        },
        claimWhenOffRes
    );
    assert.equal(claimWhenOffRes.statusCode, 403);
    assert.equal(claimWhenOffRes.body.code, "feature_disabled");

    // 6. Hapus gambar kustom membersihkan objek lama di storage
    const clearBannerRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: { authorization: "Bearer owner_jwt" },
            body: { action: "update-settings", claim_enabled: true, banner_image_url: null }
        },
        clearBannerRes
    );
    assert.equal(clearBannerRes.statusCode, 200);
    assert.equal(clearBannerRes.body.settings.claim_enabled, true);
    assert.equal(clearBannerRes.body.settings.banner_image_url, null);
    assert.equal(deletedObjects.length, 1);
});

