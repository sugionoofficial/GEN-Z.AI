import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const dashboardHtml = readFileSync(path.join(ROOT, "user/dashboard.html"), "utf8");
const bucketSql = readFileSync(path.join(ROOT, "supabase/dashboard-videos-bucket.sql"), "utf8");
const dashboardConfigJs = readFileSync(path.join(ROOT, "user/dashboard/dashboard-config.js"), "utf8");

function extractMainDashboardScript(html) {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
    const inline = scripts.find(match => match[1].includes("STORAGE_BUCKET") && match[1].includes("validateVideoFile"));
    assert.ok(inline, "Inline script utama user/dashboard.html harus ditemukan");
    return inline[1];
}

test("supabase/dashboard-videos-bucket.sql mengizinkan video hingga 500 MB termasuk MOV, M4V, dan 3GPP", () => {
    assert.match(bucketSql, /'dashboard-videos'/);
    assert.match(bucketSql, /file_size_limit\s*=\s*524288000/);
    assert.match(bucketSql, /'video\/mp4'/);
    assert.match(bucketSql, /'video\/webm'/);
    assert.match(bucketSql, /'video\/quicktime'/);
    assert.match(bucketSql, /'video\/x-m4v'/);
    assert.match(bucketSql, /'video\/3gpp'/);
});

test("inline script user/dashboard.html bebas syntax error dan tidak membatasi durasi 30 detik", () => {
    const scriptBody = extractMainDashboardScript(dashboardHtml);
    assert.doesNotThrow(() => {
        new vm.Script(scriptBody, { filename: "user/dashboard.html" });
    });

    assert.match(dashboardHtml, /mendukung durasi 30 detik atau lebih, maksimum 500 MB/i);
    assert.doesNotMatch(scriptBody, /duration\s*>\s*30\b/);
    assert.doesNotMatch(scriptBody, /maxVideoDuration/i);
});

test("resolveVideoMimeType & validateVideoFile menerima video 30 detik+ dari HP (MIME kosong, codecs, MOV, M4V)", () => {
    const scriptBody = extractMainDashboardScript(dashboardHtml);

    const startIdx = scriptBody.indexOf("/* =========================================================\n   FILE VALIDATION");
    const endIdx = scriptBody.indexOf("/* =========================================================\n   PROGRESS");
    assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx, "Blok helper validasi video harus ditemukan");

    const snippet = scriptBody.slice(startIdx, endIdx);
    const ctx = vm.createContext({
        window: { crypto: { randomUUID: () => "uuid-test-30s" } },
        currentUser: { id: "owner-123" }
    });

    vm.runInContext(
        `${snippet}\nthis.__exports = { resolveVideoMimeType, validateVideoFile, createStoragePath };`,
        ctx
    );

    const { resolveVideoMimeType, validateVideoFile, createStoragePath } = ctx.__exports;

    // 1. Video 30 detik 75 MB dari Android dengan file.type kosong ("")
    const mobileMp4 = { name: "showcase-30detik.MP4", type: "", size: 75 * 1024 * 1024 };
    assert.equal(resolveVideoMimeType(mobileMp4), "video/mp4");
    assert.doesNotThrow(() => validateVideoFile(mobileMp4));
    assert.equal(createStoragePath("videos", mobileMp4), "videos/owner-123/uuid-test-30s.mp4");

    // 2. Video 30 detik iPhone MOV (video/quicktime dan type kosong)
    const iphoneMov = { name: "IMG_4821.MOV", type: "", size: 92 * 1024 * 1024 };
    assert.equal(resolveVideoMimeType(iphoneMov), "video/quicktime");
    assert.doesNotThrow(() => validateVideoFile(iphoneMov));

    // 3. Video dengan parameter codec di MIME (video/mp4; codecs="avc1.42E01E, mp4a.40.2")
    const codecMp4 = {
        name: "clip-30s.mp4",
        type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        size: 38 * 1024 * 1024
    };
    assert.equal(resolveVideoMimeType(codecMp4), "video/mp4");
    assert.doesNotThrow(() => validateVideoFile(codecMp4));

    // 4. Video M4V dinormalisasi ke video/mp4 dan ekstensi .mp4
    const m4vVideo = { name: "reel-30s.m4v", type: "video/x-m4v", size: 42 * 1024 * 1024 };
    assert.equal(resolveVideoMimeType(m4vVideo), "video/mp4");
    assert.doesNotThrow(() => validateVideoFile(m4vVideo));
    assert.equal(createStoragePath("videos", m4vVideo), "videos/owner-123/uuid-test-30s.mp4");

    // 5. File bukan video harus tetap ditolak
    assert.throws(
        () => validateVideoFile({ name: "dokumen.pdf", type: "application/pdf", size: 1024 }),
        /Format video tidak didukung/
    );

    // 6. File > 500 MB tetap ditolak sesuai batas
    assert.throws(
        () => validateVideoFile({ name: "huge.mp4", type: "video/mp4", size: 501 * 1024 * 1024 }),
        /Ukuran video maksimal 500 MB/
    );
});

test("uploadFile me-refresh sesi GENZSession, mengunggah video 30 detik per-chunk 6 MB (TUS), dan mendeteksi 413", async () => {
    const scriptBody = extractMainDashboardScript(dashboardHtml);

    const startIdx = scriptBody.indexOf("/* =========================================================\n   FILE VALIDATION");
    const altEndIdx = scriptBody.indexOf("/* =========================================================\n   STORAGE DELETE");
    assert.ok(startIdx !== -1 && altEndIdx !== -1 && altEndIdx > startIdx, "Blok upload video harus ditemukan");

    const progressUpdates = [];
    const patchCalls = [];
    let sessionRefreshCount = 0;

    class MockXHR {
        constructor() {
            this.headers = {};
            this.upload = {};
            this.status = 204;
        }
        open(method, url) {
            this.method = method;
            this.url = url;
        }
        setRequestHeader(k, v) {
            this.headers[k] = v;
        }
        getResponseHeader(name) {
            if (name === "Upload-Offset") {
                return String(Number(this.headers["Upload-Offset"] || 0) + this._sentSize);
            }
            return null;
        }
        send(body) {
            this._sentSize = body.size;
            patchCalls.push({
                method: this.method,
                url: this.url,
                offset: Number(this.headers["Upload-Offset"]),
                size: body.size,
                auth: this.headers.Authorization
            });
            if (typeof this.upload.onprogress === "function") {
                this.upload.onprogress({ lengthComputable: true, loaded: body.size, total: body.size });
            }
            setImmediate(() => this.onload && this.onload());
        }
    }

    const ctx = vm.createContext({
        SUPABASE_URL: "https://ycovbqmezhrvzobxqnyp.supabase.co",
        SUPABASE_KEY: "anon-key-test",
        STORAGE_BUCKET: "dashboard-videos",
        currentUser: { id: "owner-123" },
        supabaseClient: {
            auth: {
                setSession: async () => ({}),
                getSession: async () => ({ data: { session: null } })
            }
        },
        elements: {
            uploadProgress: { classList: { remove() {}, add() {} } },
            progressLabel: { textContent: "" },
            progressPercent: { textContent: "" },
            progressBar: { style: { width: "0%" } }
        },
        TextEncoder,
        URL,
        Blob,
        setTimeout,
        clearTimeout,
        console,
        XMLHttpRequest: MockXHR,
        fetch: async (url, init) => {
            assert.equal(url, "https://ycovbqmezhrvzobxqnyp.supabase.co/storage/v1/upload/resumable");
            assert.equal(init.method, "POST");
            assert.equal(init.headers["Tus-Resumable"], "1.0.0");
            return {
                ok: true,
                status: 201,
                headers: {
                    get(h) {
                        return h.toLowerCase() === "location"
                            ? "/storage/v1/upload/resumable/session-abc"
                            : null;
                    }
                }
            };
        },
        window: {
            crypto: { randomUUID: () => "vid-30s-id" },
            btoa: str => Buffer.from(str, "binary").toString("base64"),
            localStorage: { getItem: () => null },
            GENZSession: {
                ensureFreshSession: async () => {
                    sessionRefreshCount += 1;
                    return {
                        access_token: "fresh-owner-jwt",
                        refresh_token: "fresh-owner-refresh",
                        user: { id: "owner-123" }
                    };
                }
            }
        }
    });

    const snippet = scriptBody.slice(startIdx, altEndIdx);
    vm.runInContext(
        `${snippet}
        const origUpdate = updateProgress;
        updateProgress = function(lbl, pct) {
            __progressUpdates.push({ lbl, pct });
            return origUpdate(lbl, pct);
        };
        this.__uploadExports = { uploadFile, isStoragePayloadTooLargeError };`,
        Object.assign(ctx, { __progressUpdates: progressUpdates })
    );

    const { uploadFile, isStoragePayloadTooLargeError } = ctx.__uploadExports;

    // Simulasi video 30 detik berukuran 15 MB (terpecah menjadi 6 MB + 6 MB + 3 MB)
    const fake30sBuffer = Buffer.alloc(15 * 1024 * 1024, 7);
    const fake30sBlob = new Blob([fake30sBuffer]);
    fake30sBlob.name = "contoh-30-detik.mp4";

    const storedPath = await uploadFile(fake30sBlob, "videos", "Mengupload video...");

    assert.equal(storedPath, "videos/owner-123/vid-30s-id.mp4");
    assert.equal(sessionRefreshCount, 1, "ensureFreshSession harus dipanggil sebelum upload");
    assert.equal(patchCalls.length, 3, "Video 15 MB harus diunggah dalam 3 chunk TUS (6MB + 6MB + 3MB)");
    assert.deepEqual(
        patchCalls.map(c => ({ offset: c.offset, size: c.size })),
        [
            { offset: 0, size: 6 * 1024 * 1024 },
            { offset: 6 * 1024 * 1024, size: 6 * 1024 * 1024 },
            { offset: 12 * 1024 * 1024, size: 3 * 1024 * 1024 }
        ]
    );
    assert.equal(patchCalls[0].auth, "Bearer fresh-owner-jwt");
    assert.equal(progressUpdates.at(-1)?.pct, 100);

    // Deteksi error 413 dari gateway Supabase Storage
    assert.equal(isStoragePayloadTooLargeError({ status: 413, message: "Maximum size exceeded" }), true);
    assert.equal(
        isStoragePayloadTooLargeError({ statusCode: "413", message: "The object exceeded the maximum allowed size" }),
        true
    );
    assert.equal(isStoragePayloadTooLargeError({ status: 403, message: "Forbidden" }), false);
});

test("dashboard-config.js modular juga menormalisasi MIME video mobile dengan benar", () => {
    const ctx = vm.createContext({
        window: {
            location: { search: "?edit=1" },
            GENZDashboard: {}
        },
        document: { getElementById: () => null }
    });
    vm.runInContext(dashboardConfigJs, ctx);

    const api = ctx.window.GENZDashboard;
    assert.equal(api.isVideoFile({ name: "clip30s.mov", type: "" }), true);
    assert.equal(api.isVideoFile({ name: "clip30s.m4v", type: "video/x-m4v" }), true);
    assert.equal(api.resolveVideoMimeType({ name: "clip30s.mp4", type: "video/mp4; codecs=avc1" }), "video/mp4");
    assert.equal(api.isVideoFile({ name: "malware.exe", type: "" }), false);
});
