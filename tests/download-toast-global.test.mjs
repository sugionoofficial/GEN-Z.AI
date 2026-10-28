import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

/* =========================================================
   GUARD: NOTIFIKASI UNDUHAN DI SEMUA HALAMAN
   ---------------------------------------------------------
   Keluhan pengguna:
   - "semua tombol download tidak ada notif success"
   - "halaman ai metadata cleaner juga tidak ada"
   - "tombol x tidak bisa diklik"

   Tes ini menjaga:
   1. genz-toast.js dimuat SEMUA halaman (bukan hanya History).
   2. Metadata Cleaner & VidDra memberi notifikasi toast.
   3. Setiap <a download> yang diklik pengguna otomatis
      memunculkan toast (jaring pengaman global).
   4. Tombol × toast bisa diklik (dismiss berdasarkan key
      maupun id) dan target sentuhnya >= 44px.
   5. Tombol × modal History cukup besar & tidak tertutup.
   ========================================================= */

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

function read(relative) {
    return readFileSync(path.join(root, relative), "utf8");
}

const toastSource = read("assets/js/genz-toast.js");
const metadataEvents = read("metadata-cleaner/assets/js/metadata-events.js");
const metadataHtml = read("metadata-cleaner/index.html");
const viddraHtml = read("viddra/generate/index.html");
const historyHtml = read("history/index.html");
const historyModal = read("history/assets/js/history-modal.js");
const supportChatCss = read("assets/css/support-chat.css");

function collectHtml(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".git" || entry === "dist") {
            continue;
        }

        const full = path.join(dir, entry);
        const stats = statSync(full);

        if (stats.isDirectory()) {
            collectHtml(full, out);
            continue;
        }

        if (entry.endsWith(".html")) out.push(full);
    }

    return out;
}

/* =========================================================
   1. MODUL TOAST DIMUAT SEMUA HALAMAN
   ========================================================= */

test("genz-toast.js dimuat semua halaman yang mengeksekusi script", () => {
    const pages = collectHtml(root).filter(file => {
        // email.html adalah templat email, bukan halaman aplikasi.
        if (path.basename(file) === "email.html") return false;

        const source = readFileSync(file, "utf8");
        return source.includes("<script") && source.includes("</body>");
    });

    assert.ok(pages.length > 20, "harus ada banyak halaman aplikasi");

    const missing = pages
        .filter(file => !readFileSync(file, "utf8").includes("genz-toast.js"))
        .map(file => path.relative(root, file));

    assert.deepEqual(
        missing,
        [],
        `halaman tanpa modul notifikasi: ${missing.join(", ")}`
    );
});

test("versi cache-buster modul toast seragam", () => {
    const pages = collectHtml(root).filter(file =>
        readFileSync(file, "utf8").includes("genz-toast.js")
    );

    for (const file of pages) {
        const source = readFileSync(file, "utf8");
        assert.match(
            source,
            /genz-toast\.js\?v=20261029-global-download-toast/,
            `versi toast tidak seragam di ${path.relative(root, file)}`
        );
    }
});

/* =========================================================
   2. HALAMAN LAIN MEMBERI NOTIFIKASI
   ========================================================= */

test("Metadata Cleaner memberi toast mulai/sukses/gagal", () => {
    assert.match(metadataEvents, /window\.GENZToast/);
    assert.match(metadataEvents, /toast\?\.downloadStart\?\.\(/);
    assert.match(metadataEvents, /toast\?\.downloadSuccess\?\.\(/);
    assert.match(metadataEvents, /toast\?\.downloadFailure\?\.\(/);
});

test("Metadata Cleaner punya tombol DOWNLOAD yang benar-benar terlihat", () => {
    // Tombol tidak boleh lagi berada di dalam wrapper hidden.
    assert.doesNotMatch(
        metadataHtml,
        /<div[^>]*hidden[^>]*>\s*<button[\s\S]{0,400}?id="metadata-download-button"/
    );

    assert.match(metadataHtml, /class="metadata-download-row"/);
    assert.match(
        metadataHtml,
        /id="metadata-download-button"[\s\S]{0,260}?disabled/
    );
});

test("VidDra generate memberi toast saat mengunduh hasil", () => {
    assert.match(viddraHtml, /toast\?\.downloadStart\?\.\(filename\)/);
    assert.match(viddraHtml, /toast\?\.downloadSuccess\?\.\(/);
    assert.match(viddraHtml, /toast\?\.downloadFallback\?\.\(filename\)/);
});

/* =========================================================
   3. JARING PENGAMAN GLOBAL: <a download> YANG DIKLIK
   ========================================================= */

function createSandbox() {
    const headChildren = [];
    const bodyChildren = [];
    const documentListeners = new Map();

    function createElement(tag) {
        const listeners = new Map();

        const element = {
            tagName: String(tag).toUpperCase(),
            id: "",
            className: "",
            textContent: "",
            hidden: false,
            dataset: {},
            style: {},
            children: [],
            parentNode: null,
            attributes: {},
            classList: {
                _set: new Set(),
                add(name) {
                    this._set.add(name);
                },
                remove(name) {
                    this._set.delete(name);
                },
                contains(name) {
                    return this._set.has(name);
                }
            },
            appendChild(child) {
                child.parentNode = element;
                element.children.push(child);
                return child;
            },
            append(...nodes) {
                for (const node of nodes) element.appendChild(node);
            },
            setAttribute(name, value) {
                element.attributes[name] = String(value);
            },
            getAttribute(name) {
                return element.attributes[name] ?? null;
            },
            removeAttribute(name) {
                delete element.attributes[name];
            },
            addEventListener(type, handler) {
                listeners.set(type, handler);
            },
            dispatch(type, payload) {
                listeners.get(type)?.(payload || { target: element });
            },
            remove() {
                if (!element.parentNode) return;
                const list = element.parentNode.children;
                const index = list.indexOf(element);
                if (index > -1) list.splice(index, 1);
                element.parentNode = null;
            }
        };

        return element;
    }

    const documentStub = {
        readyState: "complete",
        documentElement: { dataset: {} },
        head: {
            appendChild(node) {
                if (!headChildren.includes(node)) headChildren.push(node);
                return node;
            }
        },
        body: {
            dataset: {},
            appendChild(node) {
                bodyChildren.push(node);
                return node;
            }
        },
        getElementById(id) {
            return (
                headChildren.find(node => node.id === id) ||
                bodyChildren.find(node => node.id === id) ||
                null
            );
        },
        addEventListener(type, handler) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(handler);
        },
        removeEventListener(type, handler) {
            const list = documentListeners.get(type) || [];
            const index = list.indexOf(handler);
            if (index > -1) list.splice(index, 1);
        },
        dispatch(type, event) {
            for (const handler of documentListeners.get(type) || []) {
                handler(event);
            }
        },
        createElement
    };

    const windowStub = {};

    const sandbox = {
        window: windowStub,
        document: documentStub,
        setTimeout,
        clearTimeout,
        requestAnimationFrame: callback => callback(0),
        console
    };

    windowStub.document = documentStub;

    vm.createContext(sandbox);
    vm.runInContext(toastSource, sandbox);

    return {
        window: windowStub,
        document: documentStub,
        bodyChildren,
        createElement,
        dispatch: documentStub.dispatch
    };
}

function downloadAnchor(sandbox, { href = "https://x.test/file.mp4", name = "file.mp4" } = {}) {
    const anchor = sandbox.createElement("a");

    anchor.href = href;
    anchor.getAttribute = attribute => {
        if (attribute === "download") return name;
        return null;
    };
    anchor.closest = selector => {
        if (selector.includes("[data-genz-download-silent]")) return null;
        if (selector.includes("a[download]")) return anchor;
        return null;
    };

    return anchor;
}

test("klik <a download> oleh pengguna otomatis memunculkan toast", () => {
    const sandbox = createSandbox();
    const anchor = downloadAnchor(sandbox);

    sandbox.dispatch("click", {
        target: anchor,
        isTrusted: true,
        defaultPrevented: false
    });

    const container = sandbox.document.getElementById("genz-toast-container");
    assert.ok(container, "container toast dibuat");

    const toast = container.children.at(-1);
    assert.ok(toast, "toast unduhan muncul");
    assert.equal(toast.dataset.type, "success");
    assert.match(
        toast.children
            .find(child => child.className === "genz-toast-body")
            .children.find(child => child.className === "genz-toast-title")
            .textContent,
        /Unduhan dimulai/
    );
});

test("klik programatik & preventDefault tidak memicu toast ganda", () => {
    const sandbox = createSandbox();
    const anchor = downloadAnchor(sandbox);

    sandbox.dispatch("click", {
        target: anchor,
        isTrusted: false,
        defaultPrevented: false
    });

    assert.equal(
        sandbox.document.getElementById("genz-toast-container"),
        null,
        "klik programatik tidak boleh memicu toast"
    );

    sandbox.dispatch("click", {
        target: anchor,
        isTrusted: true,
        defaultPrevented: true
    });

    assert.equal(
        sandbox.document.getElementById("genz-toast-container"),
        null,
        "halaman yang sudah menangani sendiri tidak boleh dobel"
    );
});

/* =========================================================
   4. TOMBOL × TOAST BISA DIKLIK
   ========================================================= */

test("tombol × menutup toast yang dibuat dengan key", () => {
    const sandbox = createSandbox();
    const toast = sandbox.window.GENZToast;

    assert.equal(typeof toast.downloadSuccess, "function");
    assert.equal(typeof toast.downloadFailure, "function");

    toast.downloadStart("video.mp4");
    const id = toast.downloadSuccess("video.mp4");

    const container = sandbox.document.getElementById("genz-toast-container");
    assert.equal(
        container.children.length,
        1,
        "toast key sama harus mengganti, bukan menumpuk"
    );

    const element = container.children[0];
    assert.equal(element.id, id);

    const closeButton = element.children.find(
        child => child.className === "genz-toast-close"
    );
    assert.ok(closeButton, "tombol × ada");

    closeButton.dispatch("click");

    assert.equal(container.children.length, 0, "toast tertutup setelah × diklik");

    // dismiss() lewat key juga harus bekerja (instan).
    toast.downloadSuccess("video.mp4");
    assert.equal(container.children.length, 1);
    assert.equal(toast.dismiss("genz-download-main", true), true);
    assert.equal(container.children.length, 0);
});

test("target sentuh tombol × minimal 44px dan tidak menutupi tombol chat", () => {
    assert.match(
        toastSource,
        /\.genz-toast-close\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    assert.match(toastSource, /touch-action:\s*manipulation/);

    // Toast dinaikkan di atas launcher live chat (bottom 22px, tinggi 58px).
    assert.match(toastSource, /bottom:\s*calc\(94px \+ env\(safe-area-inset-bottom/);
    assert.match(toastSource, /pointer-events:\s*none/);
    assert.match(toastSource, /pointer-events:\s*auto/);
});

/* =========================================================
   5. TOMBOL × MODAL HISTORY
   ========================================================= */

test("tombol × modal History besar, di atas konten, dan punya fallback klik", () => {
    assert.match(
        historyHtml,
        /\.close-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    assert.match(historyHtml, /\.close-button\s*\{[\s\S]*?touch-action:\s*manipulation/);
    assert.match(historyHtml, /\.close-button\s*\{[\s\S]*?z-index:\s*5/);

    // Penutupan tidak boleh gagal karena satu error kecil.
    assert.match(historyModal, /try \{\s*stopModalRuntime\(\);/);
    assert.match(historyModal, /#closeModal, \[data-close-modal\]/);
});

test("tombol × live chat juga cukup besar untuk disentuh", () => {
    assert.match(
        supportChatCss,
        /\.genz-chat-close\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    assert.match(
        supportChatCss,
        /\.genz-chat-close\s*\{[\s\S]*?touch-action:\s*manipulation/
    );
});
