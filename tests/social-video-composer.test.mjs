import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

/* =========================================================
   BLACK BOX // STUDIO MEDSOS — COMPOSER POST & AUTOPOST
   YOUTUBE/TIKTOK
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. Halaman Studio Medsos wajib punya pilihan YouTube/TikTok
      untuk POST MANUAL ("Post sekarang") dan AUTO POST
      ("Jadwalkan autopost").
   2. Post manual mengirim create_posts publishNow:true;
      autopost mengirim scheduledFor tanpa publishNow.
   3. Tanpa akun terhubung, tombol mati dan ada petunjuk.
   4. Composer TIDAK merender riwayat — ia memicu event
      "genz:social-video-posts-changed" dan statusnya menyatu
      di daftar Riwayat pembuatan & posting (lihat
      tests/social-video-merge.test.mjs).
   ========================================================= */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composerSource = readFileSync(path.join(ROOT, "admin-control/social-video-composer.js"), "utf8");
const studioHtml = readFileSync(path.join(ROOT, "admin-control/social-publisher.html"), "utf8");

const ACCOUNT_YT = {
    id: "11111111-1111-4111-8111-111111111111",
    platform: "youtube",
    account_name: "Kanal GenZ",
    account_handle: "@kanalgenz",
    external_account_id: "uc-yt-1",
    status: "active"
};
const ACCOUNT_TT = {
    id: "22222222-2222-4222-8222-222222222222",
    platform: "tiktok",
    account_name: "GenZ TikTok",
    account_handle: "@genztiktok",
    external_account_id: "tt-1",
    status: "active"
};
const HISTORY_VIDEO = {
    id: "hist_1",
    source: "history",
    label: "Seedance — kucing astronot",
    title: "kucing astronot",
    video_ref: "https://video.example/hasil.mp4",
    created_at: new Date().toISOString()
};

/* ---------------------------------------------------------
   Mini-DOM harness (pola node:vm seperti test monitoring)
   --------------------------------------------------------- */

class FakeClassList {
    constructor() { this.set = new Set(); }
    add(cls) { this.set.add(cls); }
    remove(cls) { this.set.delete(cls); }
    contains(cls) { return this.set.has(cls); }
    toggle(cls, force) {
        const want = force === undefined ? !this.set.has(cls) : Boolean(force);
        if (want) this.set.add(cls); else this.set.delete(cls);
        return want;
    }
}

class FakeEl {
    constructor(tag) {
        this.tagName = String(tag).toUpperCase();
        this.children = [];
        this.dataset = {};
        this.listeners = {};
        this.classList = new FakeClassList();
        this.style = {};
        this.hidden = false;
        this.value = "";
        this._text = "";
        this.disabled = false;
        this.checked = false;
        this.selected = false;
        this.src = "";
    }
    get textContent() {
        if (this.children.length === 0) return this._text;
        return this._text + this.children
            .map(child => (typeof child.textContent === "string" ? child.textContent : child.text || ""))
            .join("");
    }
    set textContent(value) {
        this._text = String(value);
        this.children = [];
    }
    appendChild(child) {
        this.children.push(child);
        if (this.tagName === "SELECT" && child.tagName === "OPTION") {
            child.selected = this.children.filter(item => item.tagName === "OPTION").length === 1;
        }
        return child;
    }
    replaceChildren(...kids) {
        this.children = kids;
        const options = this.children.filter(item => item.tagName === "OPTION");
        options.forEach((option, index) => { option.selected = index === 0; });
    }
    addEventListener(type, fn) {
        (this.listeners[type] ||= []).push(fn);
    }
    async dispatch(type) {
        for (const fn of this.listeners[type] || []) await fn({ preventDefault() {} });
    }
    removeAttribute() {}
    setAttribute() {}
    get selectedOptions() {
        return this.children.filter(item => item.tagName === "OPTION" && item.selected);
    }
    querySelectorAll(selector) {
        if (selector === "input[data-svp-account]" || selector === "input[data-svp-account]:checked") {
            const requireChecked = selector.endsWith(":checked");
            const found = [];
            const walk = node => {
                for (const child of node.children || []) {
                    if (child.tagName === "INPUT" && child.dataset.svpAccount && (!requireChecked || child.checked)) {
                        found.push(child);
                    }
                    walk(child);
                }
            };
            walk(this);
            return found;
        }
        return [];
    }
}

function buildEnv({ bootstrap } = {}) {
    const ids = {};
    const idNames = [
        "social-video-post", "svp-message", "svp-refresh", "svp-accounts",
        "svp-accounts-hint", "svp-source-history", "svp-source-upload",
        "svp-source-url", "svp-history-select", "svp-file", "svp-url",
        "svp-preview", "svp-title", "svp-caption", "svp-hashtags",
        "svp-privacy", "svp-ai-caption", "svp-credit", "svp-schedule",
        "svp-publish", "svp-schedule-btn"
    ];
    for (const name of idNames) ids[name] = new FakeEl(name === "svp-history-select" ? "select" : "div");

    const tabs = ["history", "upload", "url"].map(source => {
        const tab = new FakeEl("button");
        tab.dataset.svpSource = source;
        return tab;
    });

    const calls = [];
    const confirms = [];
    const events = [];

    class CustomEventStub {
        constructor(type) { this.type = type; }
    }

    const payload = bootstrap ?? {
        success: true,
        viewer: { id: "user-1", credits: 50, role: "member", isAdminOrOwner: false },
        /* SISTEM LANGGANAN: biaya selalu 0. */
        creditCost: 0,
        redirectUri: "https://situs.example/callback",
        platformsConfigured: { youtube: true, tiktok: true, facebook: true },
        accounts: [ACCOUNT_YT, ACCOUNT_TT],
        posts: [],
        historyVideos: [HISTORY_VIDEO]
    };

    async function fetchStub(url, options = {}) {
        const target = String(url);
        const body = options.body ? JSON.parse(options.body) : {};
        calls.push({ url: target, method: options.method || "GET", body });

        if (target.includes("action=bootstrap")) {
            return { ok: true, status: 200, json: async () => payload };
        }
        if (target.includes("action=create_posts")) {
            const scheduled = Boolean(body.scheduledFor);
            const row = {
                id: "33333333-3333-4333-8333-333333333333",
                account_id: body.accountIds?.[0] || "",
                platform: "youtube",
                video_source_type: body.videoSourceType,
                video_ref: body.videoRef,
                title: body.title,
                caption: body.caption,
                hashtags: body.hashtags,
                privacy_level: body.privacyLevel,
                scheduled_for: body.scheduledFor || new Date().toISOString(),
                status: scheduled ? "scheduled" : "processing",
                credit_cost: 5,
                credit_refunded: false,
                remote_post_id: null,
                remote_post_url: null,
                error_message: null,
                published_at: null,
                created_at: new Date().toISOString()
            };
            return {
                ok: true,
                status: 200,
                json: async () => scheduled
                    ? { success: true, mode: "scheduled", scheduledCount: 1, scheduledFor: body.scheduledFor, unitCreditCost: 5, posts: [row] }
                    : { success: true, mode: "immediate", succeeded: 1, failed: 0, results: [{ ok: true }], creditsRemaining: 45, posts: [row] }
            };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    }

    const windowStub = {
        GENZSession: { ensureFreshSession: async () => ({ access_token: "token-uji" }) },
        confirm: message => { confirms.push(String(message)); return true; },
        dispatchEvent: event => { events.push(event.type); return true; },
        addEventListener: () => {}
    };

    const documentStub = {
        readyState: "complete",
        getElementById: id => ids[id] || null,
        createElement: tag => new FakeEl(tag),
        createTextNode: text => ({ text }),
        querySelectorAll: selector => (selector === "[data-svp-source]" ? tabs : []),
        addEventListener() {}
    };

    const context = {
        window: windowStub,
        document: documentStub,
        console,
        URL,
        URLSearchParams,
        CustomEvent: CustomEventStub,
        fetch: fetchStub,
        setTimeout,
        clearTimeout
    };
    vm.createContext(context);
    vm.runInContext(composerSource, context, { filename: "social-video-composer.js" });

    return { ids, tabs, calls, confirms, payload, events };
}

async function waitUntil(condition, tries = 100) {
    for (let index = 0; index < tries; index++) {
        if (condition()) return true;
        await new Promise(resolve => setImmediate(resolve));
    }
    return false;
}

/* ---------------------------------------------------------
   1. STRUKTUR HALAMAN
   --------------------------------------------------------- */

test("Studio Medsos punya blok post YouTube/TikTok dengan pilihan post manual dan autopost", () => {
    const sectionStart = studioHtml.indexOf('id="social-video-post"');
    assert.notEqual(sectionStart, -1, "section #social-video-post wajib ada");
    const sectionEnd = studioHtml.indexOf("</section>", sectionStart);
    const section = studioHtml.slice(sectionStart, sectionEnd);

    assert.match(section, /Post sekarang/, "tombol POST MANUAL wajib ada di dalam blok");
    assert.match(section, /Jadwalkan autopost/, "tombol AUTO POST wajib ada di dalam blok");
    assert.match(section, /id="svp-accounts"/, "pilihan akun YouTube/TikTok wajib ada");
    assert.match(studioHtml, /social-video-composer\.js\?v=svp-composer-20261103/, "script composer wajib terpasang dengan pin baru");
    assert.match(studioHtml, /social-publisher\.js\?v=facebook-oauth-status-20261110/, "pin publisher wajib dimutakhirkan");
});

test("riwayat TIDAK ada di kartu composer dan TANPA sub-blok terpisah — menyatu di Riwayat pembuatan & posting", () => {
    const sectionStart = studioHtml.indexOf('id="social-video-post"');
    const sectionEnd = studioHtml.indexOf("</section>", sectionStart);
    const composerSection = studioHtml.slice(sectionStart, sectionEnd);

    assert.doesNotMatch(
        composerSection,
        /svp-queue|Antrean/,
        "kartu composer tidak boleh memuat antrean/riwayat posting"
    );
    assert.doesNotMatch(
        studioHtml,
        /social-video-history|svh-list|svh-refresh/,
        "sub-blok status terpisah wajib dihapus dari HTML"
    );

    const runsStart = studioHtml.indexOf('id="runs-section"');
    assert.notEqual(runsStart, -1, "blok Riwayat pembuatan & posting wajib ada");
    const runsEnd = studioHtml.indexOf("</section>", runsStart);
    const runsSection = studioHtml.slice(runsStart, runsEnd);
    assert.match(runsSection, /id="runs-list"/, "daftar riwayat tunggal wajib ada");
    assert.match(studioHtml, /satu daftar urut waktu/, "legenda daftar terpadu wajib ada");
});

test("composer hanya form aksi: memicu event pembaruan riwayat, tidak merender riwayat", () => {
    assert.match(composerSource, /genz:social-video-posts-changed/, "composer wajib memicu event pembaruan riwayat");
    assert.doesNotMatch(composerSource, /renderQueue|cancel_post|svp-logo/, "composer tidak lagi merender riwayat/logo");
    assert.match(composerSource, /Riwayat pembuatan & posting/, "pesan sukses wajib mengarah ke blok riwayat");
});

test("composer memakai endpoint social-video-autopost dan aksi create_posts", () => {
    assert.match(composerSource, /\/api\/social-video-autopost/);
    assert.match(composerSource, /action=create_posts|"create_posts"/);
    assert.match(composerSource, /publishNow: true/);
    assert.match(composerSource, /scheduledFor: new Date\(parsed\)\.toISOString\(\)/);
});

/* ---------------------------------------------------------
   2. PERILAKU — BOOTSTRAP & AKUN
   --------------------------------------------------------- */

test("bootstrap menampilkan akun YouTube/TikTok sebagai pilihan yang bisa dicentang", async () => {
    const { ids, calls } = buildEnv();

    assert.ok(await waitUntil(() => ids["svp-accounts"].children.length === 2), "dua akun wajib dirender");
    assert.equal(calls[0]?.url.includes("action=bootstrap"), true);

    const youtube = ids["svp-accounts"].children[0];
    const checkbox = youtube.children.find(item => item.tagName === "INPUT");
    assert.ok(checkbox, "pilihan akun wajib berupa checkbox");
    assert.equal(checkbox.value, ACCOUNT_YT.id);
    assert.equal(checkbox.dataset.svpPlatform, "youtube");

    /* Sistem langganan: composer menampilkan info tanpa potong kredit. */
    assert.match(ids["svp-credit"].textContent, /langganan/i, "info langganan wajib tampil");
    assert.match(ids["svp-credit"].textContent, /tanpa potong kredit/);

    const options = ids["svp-history-select"].children;
    assert.equal(options.length, 1, "video riwayat wajib jadi pilihan sumber");
});

test("tanpa akun terhubung tombol mati dan muncul petunjuk hubungkan dulu", async () => {
    const { ids } = buildEnv({
        bootstrap: {
            success: true,
            viewer: { id: "user-1", credits: 10, role: "member", isAdminOrOwner: false },
            creditCost: 0,
            platformsConfigured: { youtube: true, tiktok: true, facebook: true },
            accounts: [],
            posts: [],
            historyVideos: []
        }
    });

    assert.ok(
        await waitUntil(() => ids["svp-accounts-hint"].textContent.includes("Hubungkan dulu")),
        "petunjuk hubungkan akun wajib muncul"
    );
    assert.equal(ids["svp-publish"].disabled, true, "post manual wajib mati tanpa akun");
    assert.equal(ids["svp-schedule-btn"].disabled, true, "autopost wajib mati tanpa akun");
});

/* ---------------------------------------------------------
   3. POST MANUAL
   --------------------------------------------------------- */

test("Post sekarang mengirim create_posts publishNow ke akun terpilih + picu refresh riwayat", async () => {
    const { ids, calls, confirms, events } = buildEnv();

    assert.ok(await waitUntil(() => ids["svp-accounts"].children.length === 2));
    ids["svp-accounts"].children[0].children
        .find(item => item.tagName === "INPUT").checked = true;

    ids["svp-title"].value = "Kucing astronot lucu";
    ids["svp-caption"].value = "Video kucing astronot hasil AI";
    ids["svp-hashtags"].value = "#shorts #fyp";

    await ids["svp-publish"].dispatch("click");
    assert.ok(await waitUntil(() => calls.some(call => call.url.includes("action=create_posts"))));

    const create = calls.find(call => call.url.includes("action=create_posts"));
    assert.equal(create.method, "POST");
    assert.deepEqual(create.body.accountIds, [ACCOUNT_YT.id]);
    assert.equal(create.body.publishNow, true);
    assert.equal(create.body.scheduledFor, undefined);
    assert.equal(create.body.videoRef, HISTORY_VIDEO.video_ref);
    assert.equal(create.body.videoSourceType, "history");
    assert.equal(create.body.title, "Kucing astronot lucu");
    assert.equal(create.body.privacyLevel, "public");

    /* Sistem langganan: tanpa potong kredit -> tanpa dialog konfirmasi biaya. */
    assert.equal(confirms.length, 0, "tidak boleh ada dialog konfirmasi biaya saat gratis");
    assert.match(ids["svp-message"].textContent, /Berhasil diterbitkan ke 1 akun/);
    assert.ok(events.includes("genz:social-video-posts-changed"), "riwayat wajib dimuat ulang setelah posting");
});

test("Post sekarang menolak ketika tidak ada akun yang dicentang", async () => {
    const { ids, calls } = buildEnv();

    assert.ok(await waitUntil(() => ids["svp-accounts"].children.length === 2));
    await ids["svp-publish"].dispatch("click");

    assert.equal(calls.some(call => call.url.includes("action=create_posts")), false);
    assert.match(ids["svp-message"].textContent, /Pilih minimal 1 akun/);
});

/* ---------------------------------------------------------
   4. AUTOPOST (JADWAL)
   --------------------------------------------------------- */

test("Jadwalkan autopost mengirim scheduledFor tanpa publishNow + picu refresh riwayat", async () => {
    const { ids, calls, confirms, events } = buildEnv();

    assert.ok(await waitUntil(() => ids["svp-accounts"].children.length === 2));
    ids["svp-accounts"].children[1].children
        .find(item => item.tagName === "INPUT").checked = true;

    const future = new Date(Date.now() + 60 * 60 * 1000);
    ids["svp-schedule"].value = future.toISOString().slice(0, 16);

    await ids["svp-schedule-btn"].dispatch("click");
    assert.ok(await waitUntil(() => calls.some(call => call.url.includes("action=create_posts"))));

    const create = calls.find(call => call.url.includes("action=create_posts"));
    assert.equal(create.body.publishNow, undefined);
    assert.ok(create.body.scheduledFor, "scheduledFor wajib terisi");
    assert.ok(Date.parse(create.body.scheduledFor) > Date.now());
    assert.deepEqual(create.body.accountIds, [ACCOUNT_TT.id]);

    assert.equal(confirms.length, 0, "jadwal gratis tidak wajib konfirmasi biaya");
    assert.match(ids["svp-message"].textContent, /dijadwalkan/);
    assert.ok(events.includes("genz:social-video-posts-changed"), "riwayat wajib dimuat ulang setelah menjadwalkan");
});

test("jadwal di masa lalu ditolak tanpa mengirim apa pun", async () => {
    const { ids, calls } = buildEnv();

    assert.ok(await waitUntil(() => ids["svp-accounts"].children.length === 2));
    ids["svp-accounts"].children[0].children
        .find(item => item.tagName === "INPUT").checked = true;

    const past = new Date(Date.now() - 60 * 60 * 1000);
    ids["svp-schedule"].value = past.toISOString().slice(0, 16);

    await ids["svp-schedule-btn"].dispatch("click");

    assert.equal(calls.some(call => call.url.includes("action=create_posts")), false);
    assert.match(ids["svp-message"].textContent, /masa depan/);
});

/* ---------------------------------------------------------
   5. REGRESI: CHECKBOX AKUN TIDAK BOLEH TERKUNCI (BUG HP)
   ---------------------------------------------------------
   Akar bug: renderAccounts() hanya dipanggil di tengah load()
   saat state.busy masih true, sehingga semua checkbox lahir
   dengan disabled=true; setBusy(false) di akhir load wajib
   melepaskannya kembali.
   --------------------------------------------------------- */

test("checkbox akun aktif kembali setelah load selesai — bisa dicentang di HP", async () => {
    const { ids } = buildEnv();

    assert.ok(await waitUntil(() => ids["svp-accounts"].children.length === 2));
    for (const tile of ids["svp-accounts"].children) {
        const checkbox = tile.children.find(item => item.tagName === "INPUT");
        assert.ok(checkbox, "tile wajib memuat checkbox");
        assert.equal(checkbox.disabled, false, "checkbox wajib terbuka setelah load selesai (setBusy(false) wajib membuka kunci)");
    }
    assert.equal(ids["svp-publish"].disabled, true, "belum ada akun dicentang: tombol post tetap mati");

    /* Simulasi ketukan user: centang -> event change. */
    const checkbox = ids["svp-accounts"].children[0].children.find(item => item.tagName === "INPUT");
    checkbox.checked = true;
    await checkbox.dispatch("change");
    assert.equal(ids["svp-publish"].disabled, false, "centangan wajib langsung menyalakan tombol post");
});

test("tile akun: checkbox child pertama label + id + htmlFor (ketukan di mana pun mencentang)", async () => {
    const { ids } = buildEnv();

    assert.ok(await waitUntil(() => ids["svp-accounts"].children.length === 2));
    const tile = ids["svp-accounts"].children[0];
    assert.equal(tile.tagName, "LABEL", "tile wajib berupa <label> supaya ketukan meneruskan ke checkbox");
    assert.equal(tile.children[0].tagName, "INPUT", "checkbox wajib child pertama (dirender lebih dulu)");
    const checkbox = tile.children[0];
    assert.match(checkbox.id, /^svp-account-/, "checkbox wajib punya id eksplisit");
    assert.equal(tile.htmlFor, checkbox.id, "label.htmlFor wajib menunjuk checkbox");
});
