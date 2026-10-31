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
    formatCreditNominalId,
    FREE_CREDIT_AMOUNT,
    mapClaimErrorResponse,
    normalizeIpAndSubnet,
    resolveRuntimeStatus,
    validateBannerImageUrl,
    validateBrowserSignals,
    validateCreditNominal,
    validateRuntimeWindow
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

test("SQL free-credit-claims.sql mendukung nominal dinamis, runtime event, indeks unik email/IP/password/browser, RLS, dan ACL service_role", () => {
    const sql = readRepoFile("supabase/free-credit-claims.sql");
    const hardeningSql = readRepoFile("supabase/credit-rpc-hardening.sql");

    assert.equal(FREE_CREDIT_AMOUNT, 5000);
    assert.match(sql, /credit_amount integer not null default 5000\s+check \(credit_amount >= 100 and credit_amount <= 10000000\)/i);
    assert.match(sql, /runtime_starts_at timestamptz/i);
    assert.match(sql, /runtime_ends_at timestamptz/i);
    assert.ok(sql.includes("event_not_started"));
    assert.ok(sql.includes("event_expired"));

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

    // Simulasi state server untuk uji upload-banner, update-settings, nominal dinamis, runtime, status, dan klaim
    let currentRole = "OWNER";
    let settingsState = {
        id: 1,
        claim_enabled: true,
        credit_amount: 5000,
        runtime_starts_at: null,
        runtime_ends_at: null,
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
                        credit_amount: parsed.credit_amount ?? settingsState.credit_amount ?? 5000,
                        runtime_starts_at: parsed.runtime_starts_at ?? null,
                        runtime_ends_at: parsed.runtime_ends_at ?? null,
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
                    credit_amount: settingsState.credit_amount,
                    runtime_starts_at: settingsState.runtime_starts_at,
                    runtime_ends_at: settingsState.runtime_ends_at,
                    runtime_status: resolveRuntimeStatus(settingsState),
                    server_time: new Date().toISOString(),
                    claimed: false,
                    claimed_at: null,
                    has_password_signal: true
                });
            }
            if (url.endsWith("/rest/v1/rpc/claim_free_credit_5000")) {
                return Response.json({
                    ok: true,
                    credit_amount: settingsState.credit_amount,
                    balance_before: 5000,
                    balance_after: 20000,
                    claim_id: "claim-dynamic-001",
                    claimed_at: new Date().toISOString()
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

    // 7. Validasi nominal & rentang waktu runtime di luar batas ditolak 400
    assert.equal(validateCreditNominal(50).ok, false);
    assert.equal(validateCreditNominal(25000).value, 25000);
    assert.equal(formatCreditNominalId(25000), "25.000");
    assert.equal(
        validateRuntimeWindow("2026-11-05T10:00:00Z", "2026-11-05T09:00:00Z").ok,
        false
    );

    const badWindowRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: { authorization: "Bearer owner_jwt" },
            body: {
                action: "update-settings",
                credit_amount: 15000,
                runtime_starts_at: "2026-11-05T10:00:00Z",
                runtime_ends_at: "2026-11-05T09:00:00Z"
            }
        },
        badWindowRes
    );
    assert.equal(badWindowRes.statusCode, 400);

    // 8. Jadwal masa depan (scheduled) menolak klaim 403 event_not_started
    const futureStart = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 26 * 3600 * 1000).toISOString();
    const scheduleRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: { authorization: "Bearer owner_jwt" },
            body: {
                action: "update-settings",
                claim_enabled: true,
                credit_amount: 15000,
                runtime_starts_at: futureStart,
                runtime_ends_at: futureEnd
            }
        },
        scheduleRes
    );
    assert.equal(scheduleRes.statusCode, 200);
    assert.equal(scheduleRes.body.settings.credit_amount, 15000);
    assert.equal(scheduleRes.body.settings.runtime_status, "scheduled");

    const claimScheduledRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer user_jwt",
                "cf-connecting-ip": "103.10.20.78",
                "user-agent": VALID_UA
            },
            body: {
                action: "claim",
                browser_fingerprint: VALID_BFP,
                browser_install_id: VALID_BID
            }
        },
        claimScheduledRes
    );
    assert.equal(claimScheduledRes.statusCode, 403);
    assert.equal(claimScheduledRes.body.code, "event_not_started");
    assert.match(claimScheduledRes.body.error, /15\.000/);

    // 9. Jadwal kadaluarsa (expired) menolak klaim 403 event_expired
    const pastStart = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
    await handler(
        {
            method: "POST",
            headers: { authorization: "Bearer owner_jwt" },
            body: {
                action: "update-settings",
                claim_enabled: true,
                credit_amount: 15000,
                runtime_starts_at: pastStart,
                runtime_ends_at: pastEnd
            }
        },
        createMockRes()
    );
    const claimExpiredRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer user_jwt",
                "cf-connecting-ip": "103.10.20.79",
                "user-agent": VALID_UA
            },
            body: {
                action: "claim",
                browser_fingerprint: VALID_BFP,
                browser_install_id: VALID_BID
            }
        },
        claimExpiredRes
    );
    assert.equal(claimExpiredRes.statusCode, 403);
    assert.equal(claimExpiredRes.body.code, "event_expired");

    // 10. Saat runtime aktif dengan nominal kustom 15.000, klaim berhasil memberikan 15.000 CR
    const activeStart = new Date(Date.now() - 1800 * 1000).toISOString();
    const activeEnd = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await handler(
        {
            method: "POST",
            headers: { authorization: "Bearer owner_jwt" },
            body: {
                action: "update-settings",
                claim_enabled: true,
                credit_amount: 15000,
                runtime_starts_at: activeStart,
                runtime_ends_at: activeEnd
            }
        },
        createMockRes()
    );
    const claimActiveRes = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer user_jwt",
                "cf-connecting-ip": "103.10.20.80",
                "user-agent": VALID_UA
            },
            body: {
                action: "claim",
                browser_fingerprint: VALID_BFP,
                browser_install_id: VALID_BID
            }
        },
        claimActiveRes
    );
    assert.equal(claimActiveRes.statusCode, 200);
    assert.equal(claimActiveRes.body.credit_amount, 15000);
    assert.match(claimActiveRes.body.message, /15\.000/);
});

test("UI kartu mewah dashboard user merender nominal dinamis & bar runtime horology mewah", () => {
    const uiJs = readRepoFile("assets/js/free-credit-claim.js");
    const monHtml = readRepoFile("admin-control/monitoring.html");

    // Pastikan kartu utama sendiri (.gz-fc-card) berasio penuh 16:9 beserta horology countdown & nominal dinamis
    assert.match(uiJs, /\.gz-fc-card\{[^}]*aspect-ratio:16 \/ 9;/, "Kartu utama .gz-fc-card wajib berasio murni 16:9");
    assert.ok(uiJs.includes("gz-fc-stage"), "Wajib memiliki full-bleed 16:9 stage untuk banner/art");
    assert.ok(uiJs.includes("genzFcRuntimeBar"), "Wajib memiliki elemen bar runtime mewah");
    assert.ok(uiJs.includes("gz-fc-rt-seg"), "Wajib memiliki tile chrono HARI/JAM/MNT/DTK");
    assert.ok(uiJs.includes("runtime_starts_at"), "Wajib membaca waktu mulai runtime");
    assert.ok(uiJs.includes("runtime_ends_at"), "Wajib membaca waktu berakhir runtime");
    assert.ok(uiJs.includes("server_time"), "Wajib menyinkronkan selisih jam dengan server_time");

    // Pastikan Monitoring memiliki kendali nominal & runtime lengkap
    for (const controlId of [
        "monFcAmountInput",
        "monFcNominalPresets",
        "monFcStartsAt",
        "monFcEndsAt",
        "monFcDurationPresets",
        "monFcSaveEventBtn",
        "monFcRtPreviewBox"
    ]) {
        assert.ok(monHtml.includes(controlId), `Monitoring wajib memuat kontrol #${controlId}`);
    }
});

