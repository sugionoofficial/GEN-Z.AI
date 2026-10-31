import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

/* =========================================================
   SECURITY BEACON // DETEKSI DEVTOOLS
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. Di HP, address bar / keyboard TIDAK boleh dianggap
      DevTools (dulu memicu alarm palsu: layar 795 vs
      viewport 603 = selisih 192 > ambang 160).
   2. DevTools yang benar-benar terbuka di desktop tetap
      terdeteksi lewat selisih ukuran jendela.
   3. Probe console benar-benar dipasang dan hanya sekali.
   ========================================================= */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
    return readFileSync(path.join(root, relative), "utf8");
}

function loadBeacon(options = {}) {
    const {
        innerWidth = 1440,
        innerHeight = 780,
        outerWidth = 1440,
        outerHeight = 900,
        touchPoints = 0,
        coarse = false
    } = options;

    const source = read("assets/js/security-beacon.js");
    const logged = [];
    const sent = [];

    let now = 1_700_000_000_000;
    class FakeDate extends Date {
        static now() {
            return now;
        }
    }

    const store = new Map();
    const storage = {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: key => store.delete(key)
    };

    const listeners = new Map();

    const window = {
        innerWidth,
        innerHeight,
        outerWidth,
        outerHeight,
        location: { pathname: "/uji", href: "https://contoh.test/uji", search: "" },
        screen: { width: 1440, height: 900 },
        sessionStorage: storage,
        localStorage: storage,
        addEventListener: (type, handler) => {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        removeEventListener: () => {},
        matchMedia: query => ({ matches: query.includes("coarse") ? coarse : false })
    };

    const document = {
        referrer: "",
        visibilityState: "visible",
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    const navigator = {
        doNotTrack: null,
        maxTouchPoints: touchPoints,
        userAgent: "uji",
        language: "id-ID"
    };

    const context = vm.createContext({
        window,
        document,
        navigator,
        console: { log: (...args) => logged.push(args), warn: () => {}, error: () => {}, clear: () => {} },
        Date: FakeDate,
        fetch: async (url, options = {}) => {
            sent.push(JSON.parse(options.body || "{}"));
            return { ok: true, status: 200, text: async () => "{}" };
        },
        setInterval: () => ({ unref: () => {} }),
        clearInterval: () => {},
        setTimeout,
        clearTimeout
    });

    vm.runInContext(source, context);

    return {
        state: () => window.GENZMonitor.devtoolsState(),
        logged,
        sent,
        dispatch: (type, event) => {
            for (const handler of listeners.get(type) || []) handler(event);
        },
        advance: ms => {
            now += ms;
        }
    };
}

test("HP: address bar lebar tidak dianggap DevTools", () => {
    /* Angka nyata dari log produksi: layar 358x795, viewport 357x603. */
    const beacon = loadBeacon({
        innerWidth: 358,
        innerHeight: 603,
        outerWidth: 358,
        outerHeight: 795,
        touchPoints: 5,
        coarse: true
    });

    assert.equal(beacon.state(), false);
});

test("HP: address bar menyusut tidak membuat status bolak-balik", () => {
    const expanded = loadBeacon({
        innerWidth: 358,
        innerHeight: 603,
        outerWidth: 358,
        outerHeight: 795,
        touchPoints: 5,
        coarse: true
    });

    const collapsed = loadBeacon({
        innerWidth: 358,
        innerHeight: 707,
        outerWidth: 358,
        outerHeight: 795,
        touchPoints: 5,
        coarse: true
    });

    assert.equal(expanded.state(), false, "viewport 603");
    assert.equal(collapsed.state(), false, "viewport 707");
});

test("desktop dengan DevTools dock kanan tetap terdeteksi", () => {
    const beacon = loadBeacon({
        innerWidth: 900,
        innerHeight: 780,
        outerWidth: 1440,
        outerHeight: 900
    });

    assert.equal(beacon.state(), true);
});

test("desktop normal tidak dianggap DevTools", () => {
    const beacon = loadBeacon({
        innerWidth: 1440,
        innerHeight: 780,
        outerWidth: 1440,
        outerHeight: 900
    });

    assert.equal(beacon.state(), false);
});

test("probe console dipasang sekali dan dipakai sebagai bukti", () => {
    const beacon = loadBeacon({
        innerWidth: 358,
        innerHeight: 603,
        outerWidth: 358,
        outerHeight: 795,
        touchPoints: 5,
        coarse: true
    });

    assert.equal(beacon.logged.length, 1, "probe harus dicatat sekali saat halaman dimuat");

    const [label, probe] = beacon.logged[0];
    assert.equal(label, "[GEN-Z.AI] probe DevTools", "probe diberi label, bukan 'Object' polos");
    assert.equal(typeof probe, "object");
    assert.equal(beacon.state(), false);

    /* Console memformat objek probe = DevTools benar-benar terbuka. */
    void probe.id;
    assert.equal(beacon.state(), true, "HP tetap bisa mendeteksi DevTools lewat console");

    /* Bukti console kedaluwarsa supaya status tidak tersangkut selamanya. */
    beacon.advance(20000);
    assert.equal(beacon.state(), false);
});

/* ---------------------------------------------------------
   ERROR DARI EKSTENSI BROWSER BUKAN ERROR SITUS
   Contoh nyata: "Promise gagal: Cannot read properties of
   undefined (reading 'M_ID')" berasal dari content script
   ekstensi dompet, bukan dari kode GEN-Z.AI.
   --------------------------------------------------------- */

function beaconForErrors() {
    const beacon = loadBeacon({
        innerWidth: 1440,
        innerHeight: 780,
        outerWidth: 1440,
        outerHeight: 900
    });

    /* page_view dikirim saat beacon dimuat; yang diuji hanya laporan error.
       Debounce beacon 4 detik, jadi waktu dimajukan sebelum memicu error. */
    beacon.advance(5000);
    beacon.errors = () => beacon.sent.filter(item => item.kind === "error");
    return beacon;
}

test("promise gagal dari ekstensi diabaikan", () => {
    const beacon = beaconForErrors();

    const reason = new Error("Cannot read properties of undefined (reading 'M_ID')");
    reason.stack = "TypeError: x\n    at Y (chrome-extension://abcdefghijklmnop/200.js:1:761)";

    beacon.dispatch("unhandledrejection", { reason });

    assert.equal(beacon.errors().length, 0, "error ekstensi tidak boleh dikirim");
});

test("promise gagal dari kode situs tetap dilaporkan", () => {
    const beacon = beaconForErrors();

    const reason = new Error("gagal memuat data");
    reason.stack = "Error: gagal memuat data\n    at muat (https://situs.example/app.js:10:5)";

    beacon.dispatch("unhandledrejection", { reason });

    assert.equal(beacon.errors().length, 1);
    assert.match(beacon.errors()[0].message, /gagal memuat data/);
});

test("error resource milik ekstensi tidak dilaporkan", () => {
    const beacon = beaconForErrors();

    beacon.dispatch("error", {
        target: { tagName: "SCRIPT", src: "chrome-extension://abcdefghijklmnop/inject.js" }
    });

    assert.equal(beacon.errors().length, 0);
});

test("error aset situs yang gagal dimuat tetap dilaporkan", () => {
    const beacon = beaconForErrors();

    beacon.dispatch("error", {
        target: { tagName: "SCRIPT", src: "https://situs.example/app.js" }
    });

    assert.equal(beacon.errors().length, 1);
    assert.match(beacon.errors()[0].message, /Gagal memuat aset/);
});

test("selisih tinggi toolbar saja tidak dianggap DevTools", () => {
    /* Kasus nyata: layar 1080, viewport 911 (selisih 169 px karena toolbar). */
    const beacon = loadBeacon({
        innerWidth: 1365,
        innerHeight: 911,
        outerWidth: 1365,
        outerHeight: 1080
    });

    assert.equal(beacon.state(), false);
});

test("DevTools dock yang menyusutkan lebar tetap terdeteksi", () => {
    const beacon = loadBeacon({
        innerWidth: 1050,
        innerHeight: 911,
        outerWidth: 1920,
        outerHeight: 1040
    });

    assert.equal(beacon.state(), true);
});

test("error sinkron dengan stack ekstensi juga diabaikan", () => {
    const beacon = beaconForErrors();

    const err = new TypeError("Cannot read properties of undefined (reading 'M_ID')");
    err.stack = "TypeError: x\n    at inject (moz-extension://12345678-1234/contentscript.js:4:12)";

    beacon.dispatch("error", {
        target: {},
        message: err.message,
        filename: "",
        lineno: 0,
        error: err
    });

    assert.equal(beacon.errors().length, 0);
});

test("media pratinjau eksternal yang kedaluwarsa (mis. CDN Opus) tidak dianggap modul situs rusak", () => {
    const beacon = beaconForErrors();

    beacon.dispatch("error", {
        target: {
            tagName: "VIDEO",
            src: "https://signed-opus-lab-ext.cdn.opus.pro/opus-video-tools/clips/clip-1.mp4?v=1&hdnts=Expires=1793215842~FullPath~Signature=secret"
        }
    });

    assert.equal(beacon.errors().length, 0);
});

test("media milik domain situs sendiri tetap dilaporkan tanpa membocorkan query token", () => {
    const beacon = beaconForErrors();

    beacon.dispatch("error", {
        target: {
            tagName: "IMG",
            src: "https://contoh.test/assets/banner.png?token=rahasia123#frag"
        }
    });

    assert.equal(beacon.errors().length, 1);
    assert.equal(beacon.errors()[0].message, "Gagal memuat aset: https://contoh.test/assets/banner.png");
});

/* =========================================================
   ANTI-DEVTOOLS LOCKDOWN (NON-OWNER CONNECTION KILL +
   BLANK WHITE HACKER & INTRUDER IP/WEB DETAIL SCREEN)
   ========================================================= */

function loadLockdownBeacon(options = {}) {
    const {
        role = "",
        navRole = "",
        serverIsOwner = false,
        serverRole = "guest",
        serverEmail = null,
        devtoolsLockdown = true,
        localSpoofRole = "",
        hasAccessToken = false
    } = options;

    const source = read("assets/js/security-beacon.js");
    const sent = [];
    const winListeners = new Map();
    const docListeners = new Map();
    const store = new Map();

    if (localSpoofRole) {
        store.set("genz-auth-profile-cache-v1", JSON.stringify({ role: localSpoofRole }));
    }
    if (hasAccessToken) {
        store.set(
            "sb-ycovbqmezhrvzobxqnyp-auth-token",
            JSON.stringify({
                access_token: "jwt-token-uji",
                user: {
                    id: "c237fcef-6456-451e-ae98-691f2dabb60d",
                    email: serverEmail || "uji@genz.ai"
                }
            })
        );
    }

    const storage = {
        get length() {
            return store.size;
        },
        key: index => [...store.keys()][index] ?? null,
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: key => store.delete(key)
    };

    const elementIds = new Map();
    const body = {
        className: "dark-app",
        style: { cssText: "" },
        _html: "<main>Konten Rahasia Aplikasi</main>",
        get innerHTML() {
            return this._html;
        },
        set innerHTML(val) {
            this._html = String(val);
            elementIds.clear();
            const regex = /<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
            let match;
            while ((match = regex.exec(this._html)) !== null) {
                const id = match[2];
                const text = match[3].replace(/<[^>]+>/g, "");
                elementIds.set(id, {
                    id,
                    style: {},
                    _text: text,
                    get textContent() {
                        return this._text;
                    },
                    set textContent(next) {
                        this._text = String(next);
                    }
                });
            }
        }
    };

    let stopped = false;
    class FakeXHR {
        open() {}
        send() {}
    }
    class FakeWebSocket {
        constructor() {}
    }

    const initialFetch = async (_url, reqOpts = {}) => {
        sent.push({
            headers: reqOpts.headers || {},
            body: JSON.parse(reqOpts.body || "{}")
        });
        const responseJson = {
            success: true,
            devtools_lockdown: devtoolsLockdown,
            viewer: {
                is_owner: serverIsOwner,
                role: serverRole || role || "guest",
                email: serverEmail,
                ip: "114.122.88.19",
                city: "Depok",
                region: "West Java",
                country: "ID",
                asn: "AS7713",
                colo: "CGK",
                browser: "Chrome",
                os: "Windows",
                device: "Desktop"
            }
        };
        return {
            ok: true,
            status: 202,
            text: async () => JSON.stringify(responseJson)
        };
    };

    const window = {
        innerWidth: 1440,
        innerHeight: 780,
        outerWidth: 1440,
        outerHeight: 900,
        GENZ_NAVIGATION_ROLE: navRole || role || "",
        GENZ_NAVIGATION_USER: hasAccessToken
            ? { id: "c237fcef-6456-451e-ae98-691f2dabb60d", email: serverEmail || "uji@genz.ai" }
            : null,
        location: {
            pathname: "/generate/index.html",
            href: "https://genzai.example/generate/index.html?secret=abc",
            hostname: "genzai.example",
            reload: () => {}
        },
        screen: { width: 1920, height: 1080 },
        sessionStorage: storage,
        localStorage: storage,
        fetch: initialFetch,
        XMLHttpRequest: FakeXHR,
        WebSocket: FakeWebSocket,
        stop: () => {
            stopped = true;
        },
        addEventListener: (type, handler) => {
            if (!winListeners.has(type)) winListeners.set(type, []);
            winListeners.get(type).push(handler);
        },
        removeEventListener: () => {},
        matchMedia: () => ({ matches: false })
    };

    const document = {
        title: "GEN-Z.AI Studio",
        referrer: "",
        visibilityState: "visible",
        documentElement: { style: { cssText: "" }, dataset: {} },
        body,
        querySelectorAll: () => [],
        getElementById: id => elementIds.get(id) || null,
        addEventListener: (type, handler) => {
            if (!docListeners.has(type)) docListeners.set(type, []);
            docListeners.get(type).push(handler);
        },
        removeEventListener: () => {}
    };

    const navigator = {
        doNotTrack: null,
        maxTouchPoints: 0,
        onLine: true,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
        language: "id-ID"
    };

    const context = vm.createContext({
        window,
        document,
        navigator,
        Intl,
        console: { log: () => {}, warn: () => {}, error: () => {}, clear: () => {} },
        fetch: initialFetch,
        setInterval: () => ({ unref: () => {} }),
        clearInterval: () => {},
        setTimeout,
        clearTimeout
    });

    vm.runInContext(source, context);

    return {
        window,
        document,
        sent,
        wasStopped: () => stopped,
        getElement: id => elementIds.get(id) || null,
        dispatchWindow: (type, event) => {
            for (const handler of winListeners.get(type) || []) handler(event);
        },
        dispatchDocument: (type, event) => {
            for (const handler of docListeners.get(type) || []) handler(event);
        }
    };
}

test("aset ilustrasi hacker tersedia untuk layar penguncian putih", () => {
    const imgBuf = readFileSync(path.join(root, "assets/images/devtools-hacker-guard.jpg"));
    assert.ok(imgBuf.byteLength > 5000, "gambar hacker harus tersedia dan valid");
});

test("pengunjung non-OWNER yang menekan F12 langsung putus koneksi dan melihat layar putih hacker + detail IP/web", async () => {
    const env = loadLockdownBeacon({ serverIsOwner: false, serverRole: "guest" });
    await new Promise(resolve => setTimeout(resolve, 10));

    let prevented = false;
    env.dispatchWindow("keydown", {
        key: "F12",
        keyCode: 123,
        preventDefault: () => { prevented = true; },
        stopPropagation: () => {},
        stopImmediatePropagation: () => {}
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(prevented, true, "pintasan F12 wajib diblokir");
    assert.equal(env.window.GENZMonitor.isLockedDown(), true, "lockdown harus aktif");
    assert.equal(env.wasStopped(), true, "window.stop() harus dipanggil");

    /* Koneksi fetch halaman harus error tidak ada koneksi */
    await assert.rejects(
        () => env.window.fetch("/api/generate"),
        /ERR_INTERNET_DISCONNECTED|Tidak ada koneksi/
    );

    /* WebSocket halaman juga harus terputus */
    assert.throws(
        () => new env.window.WebSocket("wss://genzai.example/realtime"),
        /ERR_INTERNET_DISCONNECTED/
    );

    /* XHR halaman harus memicu onerror */
    const xhrFailed = await new Promise(resolve => {
        const xhr = new env.window.XMLHttpRequest();
        xhr.onerror = () => resolve(true);
        xhr.open("GET", "/api/models");
        xhr.send();
    });
    assert.equal(xhrFailed, true, "XMLHttpRequest harus gagal tanpa koneksi");

    /* Tampilan harus layar putih bersih dengan gambar hacker & detail IP/web tanpa bocor query rahasia */
    assert.match(env.document.documentElement.style.cssText, /background:#ffffff !important/);
    assert.match(env.document.body.style.cssText, /background:#ffffff !important/);
    assert.doesNotMatch(env.document.body.innerHTML, /Konten Rahasia Aplikasi/);
    assert.match(env.document.body.innerHTML, /devtools-hacker-guard\.jpg/);
    assert.match(env.document.body.innerHTML, /TIDAK ADA KONEKSI/);
    assert.doesNotMatch(env.document.body.innerHTML, /secret=abc/, "query token tidak boleh bocor di layar");

    assert.equal(env.getElement("genz-lockdown-ip")?.textContent, "114.122.88.19");
    assert.match(env.getElement("genz-lockdown-location")?.textContent || "", /Depok, West Java, ID/);
    assert.match(env.getElement("genz-lockdown-network")?.textContent || "", /AS7713/);
    assert.match(env.getElement("genz-lockdown-url")?.textContent || "", /https:\/\/genzai\.example\/generate\/index\.html/);
    assert.match(env.getElement("genz-lockdown-system")?.textContent || "", /Chrome • Windows • Desktop/);
});

test("role ADMIN dan USER tetap kena penguncian DevTools — hanya role OWNER yang bebas", async () => {
    const adminEnv = loadLockdownBeacon({
        navRole: "admin",
        serverIsOwner: false,
        serverRole: "admin",
        serverEmail: "admin@genz.ai",
        hasAccessToken: true
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    adminEnv.dispatchWindow("keydown", {
        key: "I",
        keyCode: 73,
        ctrlKey: true,
        shiftKey: true,
        preventDefault: () => {}
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(adminEnv.window.GENZMonitor.isLockedDown(), true, "ADMIN tetap harus dikunci saat membuka DevTools");
    assert.match(adminEnv.getElement("genz-lockdown-account")?.textContent || "", /admin@genz\.ai \(Role: ADMIN\)/);

    const ownerEnv = loadLockdownBeacon({
        navRole: "owner",
        serverIsOwner: true,
        serverRole: "owner",
        serverEmail: "owner@genz.ai",
        hasAccessToken: true
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    let ownerBlocked = false;
    ownerEnv.dispatchWindow("keydown", {
        key: "F12",
        keyCode: 123,
        preventDefault: () => { ownerBlocked = true; }
    });
    ownerEnv.dispatchDocument("contextmenu", {
        target: { tagName: "DIV" },
        preventDefault: () => { ownerBlocked = true; }
    });

    assert.equal(ownerBlocked, false, "OWNER bebas memakai F12 & klik kanan Inspect");
    assert.equal(ownerEnv.window.GENZMonitor.isLockedDown(), false, "OWNER tidak boleh kena lockdown");
    assert.match(ownerEnv.document.body.innerHTML, /Konten Rahasia Aplikasi/);
});

test("manipulasi localStorage role=owner tidak bisa menembus verifikasi server", async () => {
    const spoofEnv = loadLockdownBeacon({
        localSpoofRole: "owner",
        serverIsOwner: false,
        serverRole: "user",
        serverEmail: "intruder@genz.ai",
        hasAccessToken: true
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(spoofEnv.window.GENZMonitor.isOwnerViewer(), false, "server harus menggugurkan klaim palsu localStorage");

    spoofEnv.dispatchWindow("keydown", {
        key: "U",
        keyCode: 85,
        ctrlKey: true,
        preventDefault: () => {}
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(spoofEnv.window.GENZMonitor.isLockedDown(), true);
});

test("klik kanan diblokir pada area halaman tetapi tetap diizinkan di kolom input/textarea", async () => {
    const env = loadLockdownBeacon({ serverIsOwner: false, serverRole: "user" });
    await new Promise(resolve => setTimeout(resolve, 10));

    let divPrevented = false;
    env.dispatchDocument("contextmenu", {
        target: { tagName: "DIV" },
        preventDefault: () => { divPrevented = true; }
    });
    assert.equal(divPrevented, true, "klik kanan Inspect pada elemen biasa diblokir");

    let inputPrevented = false;
    env.dispatchDocument("contextmenu", {
        target: { tagName: "TEXTAREA" },
        preventDefault: () => { inputPrevented = true; }
    });
    assert.equal(inputPrevented, false, "klik kanan paste pada TEXTAREA tetap diizinkan");
});

test("saklar devtools_lockdown=false dari BLACK BOX menonaktifkan penguncian tanpa mematikan log", async () => {
    const env = loadLockdownBeacon({
        serverIsOwner: false,
        serverRole: "guest",
        devtoolsLockdown: false
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    let prevented = false;
    env.dispatchWindow("keydown", {
        key: "F12",
        keyCode: 123,
        preventDefault: () => { prevented = true; }
    });

    assert.equal(prevented, false);
    assert.equal(env.window.GENZMonitor.isLockedDown(), false);
});

