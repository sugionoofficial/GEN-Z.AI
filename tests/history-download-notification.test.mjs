import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

/* =========================================================
   GUARD: NOTIFIKASI UNDUHAN DI HALAMAN HISTORY
   ---------------------------------------------------------
   Keluhan pengguna: menekan tombol Download di History tidak
   memunculkan notifikasi apa pun, jadi tidak jelas unduhan
   berhasil atau gagal.

   Tes ini menjaga:
   1. Modul toast tersedia & dipakai halaman History.
   2. Setiap jalur unduhan memanggil notifikasi:
      mulai -> berhasil -> fallback -> gagal (dengan "Coba lagi").
   3. Toast benar-benar bekerja (DOM minimal) & mendukung
      mode cerah/gelap tanpa dependensi eksternal.
   ========================================================= */

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

function read(relative) {
    return readFileSync(path.join(root, relative), "utf8");
}

const toastSource = read("assets/js/genz-toast.js");
const modalSource = read("history/assets/js/history-modal.js");
const historyHtml = read("history/index.html");

/* =========================================================
   1. HALAMAN MEMUAT MODUL TOAST
   ========================================================= */

test("halaman History memuat genz-toast.js sebelum history-modal.js", () => {
    assert.match(
        historyHtml,
        /<script src="\/assets\/js\/genz-toast\.js\?v=20261029-global-download-toast"><\/script>/
    );

    const toastIndex = historyHtml.indexOf("genz-toast.js");
    const modalIndex = historyHtml.indexOf("history-modal.js");

    assert.ok(toastIndex > -1, "genz-toast.js wajib dimuat halaman History");
    assert.ok(
        toastIndex < modalIndex,
        "genz-toast.js wajib dimuat SEBELUM history-modal.js"
    );

    // history-modal ikut di-bump agar browser tidak memakai cache lama.
    assert.match(historyHtml, /history-modal\.js\?v=20261029-close-fix/);
});

/* =========================================================
   2. SEMUA JALUR UNDUHAN MEMBERI NOTIFIKASI
   ========================================================= */

test("klik Download: mulai -> berhasil -> fallback -> gagal semuanya memberi notifikasi", () => {
    assert.match(modalSource, /function notifyDownload\(/);
    assert.match(modalSource, /function notifyDownloadStart\(/);
    assert.match(modalSource, /function notifyDownloadSuccess\(/);
    assert.match(modalSource, /function notifyDownloadFallback\(/);
    assert.match(modalSource, /function notifyDownloadFailure\(/);

    // Notifikasi muncul tepat setelah tombol berubah ke "Menyiapkan...".
    assert.match(
        modalSource,
        /Menyiapkan\.\.\.';\s*\n\s*notifyDownloadStart\(filename\);/
    );

    // Jalur berhasil: simpan di Downloads, blob anchor, dan bridge Android.
    assert.match(
        modalSource,
        /notifyDownloadSuccess\("Tersimpan di Downloads", filename\)/
    );
    assert.match(
        modalSource,
        /notifyDownloadSuccess\("Berhasil diunduh", filename\)/
    );
    assert.match(
        modalSource,
        /notifyDownloadSuccess\("Unduhan dimulai", filename\)/
    );

    // Jalur fallback (tab baru / bridge tidak tersedia).
    assert.match(modalSource, /notifyDownloadFallback\(filename\)/);
    assert.equal(
        (modalSource.match(/notifyDownloadFallback\(filename\);/g) || []).length,
        2,
        "fallback native & fallback browser sama-sama harus memberi notifikasi"
    );

    // Jalur gagal: toast merah dengan tombol coba lagi.
    assert.match(
        modalSource,
        /notifyDownloadFailure\(\s*error\?\.message \|\| "Silakan coba kembali\.",\s*\(\) => handleDownload\(button\)/
    );
    assert.match(
        modalSource,
        /notifyDownloadFailure\(\s*err2\?\.message \|\| "Silakan coba kembali\.",\s*\(\) => handleDownload\(button\)/
    );
    assert.match(modalSource, /actionLabel:\s*typeof retry === "function" \? "Coba lagi" : ""/);

    // Pesan sukses tidak boleh hilang otomatis terlalu cepat.
    assert.match(modalSource, /duration: 5200/);

    // Error tidak auto-hilang supaya pengguna sempat membaca.
    assert.match(
        modalSource,
        /onAction: typeof retry === "function" \? retry : null,\s*\n\s*duration: 0/
    );
});

test("guard unduhan memakai toast, bukan alert() yang mudah terlewat", () => {
    assert.match(
        modalSource,
        /notifyDownloadFailure\("Data history tidak ditemukan\."\)/
    );
    assert.match(
        modalSource,
        /notifyDownloadFailure\("Hasil tidak tersedia atau sudah kedaluwarsa untuk diunduh\."\)/
    );
});

test("fungsi unduhan inti tidak dihapus (nama file, signed URL, fallback)", () => {
    assert.match(modalSource, /function buildDownloadFilename\(item\)/);
    assert.match(modalSource, /function getDirectDownloadUrl\(url, filename\)/);
    assert.match(modalSource, /\/storage\/v1\/object\/sign\//);
    assert.match(modalSource, /window\.GENZGeneratedFileName\.create\(/);
    assert.match(modalSource, /async function handleDownload\(button\)/);
});

/* =========================================================
   3. MODUL TOAST BENAR-BENAR BEKERJA
   ========================================================= */

function createToastSandbox() {
    const headChildren = [];
    const bodyChildren = [];

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
            addEventListener(type, handler) {
                listeners.set(type, handler);
            },
            dispatch(type) {
                listeners.get(type)?.({ target: element });
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

    const documentListeners = new Map();

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
            },
            closest() {
                return null;
            }
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
        getElementById(id) {
            return (
                headChildren.find(node => node.id === id) ||
                bodyChildren.find(node => node.id === id) ||
                null
            );
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
        dispatch: documentStub.dispatch
    };
}

test("GENZToast menampilkan toast sukses dengan nama file, aksesibel & bisa ditutup", () => {
    const sandbox = createToastSandbox();
    const toast = sandbox.window.GENZToast;

    assert.ok(toast, "window.GENZToast wajib tersedia");
    assert.equal(typeof toast.show, "function");
    assert.equal(typeof toast.success, "function");
    assert.equal(typeof toast.error, "function");
    assert.equal(typeof toast.info, "function");

    const id = toast.success("Berhasil diunduh", {
        description: "2026-10-29-video.mp4"
    });

    assert.ok(id, "toast mengembalikan id");

    const container = sandbox.document.getElementById("genz-toast-container");
    assert.ok(container, "container notifikasi dibuat");
    assert.equal(container.getAttribute("role"), "region");

    const element = container.children.find(node => node.id === id);
    assert.ok(element, "element toast ditambahkan");

    assert.equal(element.dataset.type, "success");
    assert.equal(element.getAttribute("role"), "status");
    assert.equal(element.getAttribute("aria-live"), "polite");

    const collectText = node => {
        const own = node.textContent ? [node.textContent] : [];
        return own.concat(
            (node.children || []).flatMap(child => collectText(child))
        );
    };

    const texts = collectText(element).join(" | ");

    const body = element.children.find(child => child.className === "genz-toast-body");
    assert.ok(body, "body toast wajib ada");
    assert.equal(body.children[0].className, "genz-toast-kicker");
    assert.equal(body.children[1].className, "genz-toast-title");

    assert.match(texts, /BERHASIL/);
    assert.match(texts, /Berhasil diunduh/);
    assert.match(texts, /2026-10-29-video\.mp4/);

    assert.equal(toast.dismiss(id), true);
});

test("GENZToast error memakai role alert dan mendukung tombol aksi", () => {
    const sandbox = createToastSandbox();
    const toast = sandbox.window.GENZToast;

    let retried = false;

    const id = toast.error("GAGAL MENGUNDUH", {
        description: "HTTP 403",
        actionLabel: "Coba lagi",
        onAction: () => {
            retried = true;
        },
        duration: 0
    });

    const container = sandbox.document.getElementById("genz-toast-container");
    const element = container.children.find(node => node.id === id);

    assert.equal(element.dataset.type, "error");
    assert.equal(element.getAttribute("role"), "alert");
    assert.equal(element.getAttribute("aria-live"), "assertive");

    const actionButton = element.children
        .flatMap(child => child.children || [])
        .find(child => child.className === "genz-toast-action");

    assert.ok(actionButton, "tombol aksi Coba lagi wajib ada");
    assert.equal(actionButton.textContent, "Coba lagi");

    actionButton.dispatch("click");
    assert.equal(retried, true, "aksi Coba lagi memanggil callback");
});

test("GENZToast dengan key yang sama mengganti toast lama (tidak menumpuk)", () => {
    const sandbox = createToastSandbox();
    const toast = sandbox.window.GENZToast;

    toast.info("Menyiapkan unduhan…", { key: "history-download", duration: 0 });
    const container = sandbox.document.getElementById("genz-toast-container");

    assert.equal(container.children.length, 1);

    toast.success("Berhasil diunduh", {
        key: "history-download",
        description: "video.mp4"
    });

    assert.equal(
        container.children.length,
        1,
        "status Menyiapkan berubah menjadi Berhasil, bukan dua toast"
    );
    assert.equal(container.children[0].dataset.type, "success");

    toast.dismissAll();
});

/* =========================================================
   4. GAYA VISUAL & BATASAN BUNDLE
   ========================================================= */

test("toast mendukung mode cerah/gelap, HP, dan tanpa dependensi eksternal", () => {
    assert.match(toastSource, /html\[data-genz-theme="light"\] \.genz-toast/);
    assert.match(toastSource, /@media \(max-width: 600px\)/);
    assert.match(toastSource, /env\(safe-area-inset-bottom/);
    assert.match(toastSource, /prefers-reduced-motion/);
    assert.match(toastSource, /aria-label/);

    const codeOnly = toastSource
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    assert.doesNotMatch(codeOnly, /from\s+["']node:/);
    assert.doesNotMatch(codeOnly, /^\s*import\s+/m);
    assert.doesNotMatch(codeOnly, /require\(/);
    assert.doesNotMatch(codeOnly, /https?:\/\//);
});
