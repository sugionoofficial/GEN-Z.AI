import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

/*
 * REGRESSION: thumbnail video di halaman History.
 *
 * 1. Video hasil generate harus menampilkan frame pertama sebagai
 *    thumbnail (bukan kotak hitam kosong seperti preload="none"
 *    tanpa frame), supaya user tahu video mana yang berhasil.
 * 2. Frame hanya dimuat saat thumbnail masuk viewport
 *    (IntersectionObserver) supaya tidak memicu ratusan request.
 * 3. Di HP thumbnail menempel di kolom kiri dan detail (provider/
 *    model/tanggal) sejajar di kanannya, tidak turun ke bawah.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const renderSource = readFileSync(
    path.join(root, "history/assets/js/history-render.js"),
    "utf8"
);

const eventsSource = readFileSync(
    path.join(root, "history/assets/js/history-events.js"),
    "utf8"
);

const historyHtml = readFileSync(path.join(root, "history/index.html"), "utf8");

function loadRenderModule() {
    const sandbox = {
        window: { GENZHistory: {} },
        document: {
            querySelectorAll: () => [],
            querySelector: () => null
        },
        console,
        setTimeout,
        clearTimeout,
        requestAnimationFrame: callback => callback(),
        Number,
        String,
        Math,
        JSON,
        Array,
        Object
    };

    vm.createContext(sandbox);
    vm.runInContext(renderSource, sandbox);

    return sandbox.window.GENZHistory;
}

function makeVideoElement(src) {
    const video = {
        dataset: { thumbSrc: src, thumbFrame: "0.2" },
        src: "",
        preload: "none",
        readyState: 0,
        duration: 8,
        currentTime: 0,
        listeners: {},
        getAttribute(name) {
            if (name === "src") return this.src || null;
            return null;
        },
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        }
    };
    return video;
}

test("thumbnail video sukses memakai frame pertama, bukan kotak kosong", () => {
    const App = loadRenderModule();

    const html = App.getRowHtml(
        {
            id: "abc",
            task_id: "task-1",
            status: "success",
            result_url: "https://cdn.example/video.mp4",
            created_at: "2026-10-23T10:00:00.000Z",
            model_id: "wan2.7",
            provider: "qwencloud"
        },
        0,
        false
    );

    assert.match(html, /data-thumb-src="https:\/\/cdn\.example\/video\.mp4"/);
    assert.match(html, /data-thumb-frame="0\.2"/);

    // Video harus muted + playsinline agar bisa diputar inline di HP.
    assert.match(html, /<video[\s\S]*?muted[\s\S]*?playsinline/);

    // src sengaja belum dipasang: dimuat lazy saat masuk viewport.
    const videoTag = html.match(/<video[\s\S]*?<\/video>/)[0];
    assert.doesNotMatch(videoTag, /\ssrc="/);
});

test("hydrateThumbnailVideo memasang poster frame #t=0.2 dan seek ke frame itu", () => {
    const App = loadRenderModule();
    const video = makeVideoElement("https://cdn.example/video.mp4");

    const hydrated = App.hydrateThumbnailVideo(video);

    assert.equal(hydrated, true);
    assert.equal(video.src, "https://cdn.example/video.mp4#t=0.2");
    assert.equal(video.preload, "metadata");
    assert.equal(video.dataset.thumbSrc, undefined);

    // Setelah metadata siap, browser diarahkan ke frame 0.2 detik.
    assert.equal(typeof video.listeners.loadedmetadata, "function");
    video.listeners.loadedmetadata();
    assert.equal(video.currentTime, 0.2);
});

test("videos dimuat lazy lewat IntersectionObserver", () => {
    assert.match(renderSource, /new IntersectionObserver\(/);
    assert.match(renderSource, /rootMargin:\s*\n?\s*"200px 0px"/);
    assert.match(renderSource, /querySelectorAll\(\s*\n?\s*"\.history-thumbnail video\[data-thumb-src\]"/);
});

test("renderTable memicu hydrate thumbnail", () => {
    assert.match(renderSource, /requestAnimationFrame\(\s*\n?\s*hydrateThumbnailVideos/);
    assert.match(eventsSource, /App\.hydrateThumbnailVideo\(/);
});

test("thumbnail video tetap bisa diklik dan modal jadi fallback", () => {
    assert.match(eventsSource, /openVideo\(\s*\n?\s*fallbackUrl\s*\n?\s*\)/);
});

test("layout HP: thumbnail di kolom kiri, detail sejajar di kanan", () => {
    const styleMatch = historyHtml.match(
        /<style id="history-mobile-thumbnail-row">([\s\S]*?)<\/style>/
    );

    assert.ok(styleMatch, "blok style history-mobile-thumbnail-row harus ada");

    const css = styleMatch[1];

    // Grid dua kolom: thumbnail 64px + detail fleksibel.
    assert.match(css, /grid-template-columns:\s*64px minmax\(0, 1fr\)/);

    // Thumbnail menempel di kiri dan span 3 baris (sejajar detail).
    assert.match(
        css,
        /td\.history-thumbnail-cell\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ span 3;/s
    );

    // Provider & model di kolom kanan, tidak turun ke bawah thumbnail.
    assert.match(
        css,
        /td\.history-provider-cell\s*\{[^}]*grid-column:\s*2;[^}]*order:\s*2;/s
    );
    assert.match(
        css,
        /td\.history-model-cell\s*\{[^}]*grid-column:\s*2;[^}]*order:\s*3;/s
    );
});

test("asset history memakai cache-bust versi terbaru", () => {
    assert.match(
        historyHtml,
        /history-render\.js\?v=20261023-[a-z-]+/
    );
    assert.match(
        historyHtml,
        /history-events\.js\?v=20261023-[a-z-]+/
    );
});
