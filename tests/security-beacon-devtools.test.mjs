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
