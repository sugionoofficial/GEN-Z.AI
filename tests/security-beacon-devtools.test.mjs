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

    const window = {
        innerWidth,
        innerHeight,
        outerWidth,
        outerHeight,
        location: { pathname: "/uji", href: "https://contoh.test/uji", search: "" },
        screen: { width: 1440, height: 900 },
        sessionStorage: storage,
        localStorage: storage,
        addEventListener: () => {},
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
        console: { log: value => logged.push(value), warn: () => {}, error: () => {}, clear: () => {} },
        Date: FakeDate,
        fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
        setInterval: () => ({ unref: () => {} }),
        clearInterval: () => {},
        setTimeout,
        clearTimeout
    });

    vm.runInContext(source, context);

    return {
        state: () => window.GENZMonitor.devtoolsState(),
        logged,
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
    assert.equal(beacon.state(), false);

    /* Console memformat objek probe = DevTools benar-benar terbuka. */
    void beacon.logged[0].id;
    assert.equal(beacon.state(), true, "HP tetap bisa mendeteksi DevTools lewat console");

    /* Bukti console kedaluwarsa supaya status tidak tersangkut selamanya. */
    beacon.advance(20000);
    assert.equal(beacon.state(), false);
});
