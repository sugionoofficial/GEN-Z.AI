import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
    describeHttpFailure,
    isPlatformFailure,
    readJsonError,
    summarizeBody
} from "../admin-control/assets/js/http-failure.js";

const CLOUDFLARE_503_PAGE = `<!DOCTYPE html><html><head><title>genzai.genzai-f37.workers.dev | 503 Service Temporarily Unavailable</title></head>
<body><h1>Service Temporarily Unavailable</h1><p>The server is temporarily unable to service your request.</p></body></html>`;

test("503 tanpa JSON menjelaskan penyebab dan menyertakan detail", () => {
    const message = describeHttpFailure(503, CLOUDFLARE_503_PAGE);
    assert.match(message, /HTTP 503/);
    assert.match(message, /deploy baru atau lonjakan beban/);
    assert.match(message, /Service Temporarily Unavailable/);
    assert.doesNotMatch(message, /<h1>/, "tag HTML harus dibuang");
});

test("pesan error JSON dari aplikasi dipakai apa adanya", () => {
    const body = JSON.stringify({ success: false, error: "Cloudflare Workers AI binding belum dikonfigurasi." });
    assert.equal(describeHttpFailure(503, body), "Cloudflare Workers AI binding belum dikonfigurasi.");
    assert.equal(readJsonError(body), "Cloudflare Workers AI binding belum dikonfigurasi.");
});

test("status lain tetap dapat hint yang sesuai", () => {
    assert.match(describeHttpFailure(504, ""), /tidak menyelesaikan permintaan/);
    assert.match(describeHttpFailure(500, "Internal Server Error"), /HTTP 500/);
    assert.doesNotMatch(describeHttpFailure(500, "Internal Server Error"), /Detail:/);
    assert.match(describeHttpFailure(0, ""), /Koneksi ke server terputus/);
});

test("hanya kegagalan tingkat platform yang dianggap aman diulang", () => {
    assert.equal(isPlatformFailure(503, CLOUDFLARE_503_PAGE), true);
    assert.equal(isPlatformFailure(502, ""), true);
    assert.equal(isPlatformFailure(504, "upstream timeout"), true);
    assert.equal(
        isPlatformFailure(503, JSON.stringify({ success: false, error: "Bucket privat belum tersedia." })),
        false,
        "503 ber-JSON berasal dari aplikasi, bukan platform"
    );
    assert.equal(isPlatformFailure(500, CLOUDFLARE_503_PAGE), false);
    assert.equal(isPlatformFailure(429, ""), false);
});

test("summarizeBody memotong script, style, dan panjang teks", () => {
    assert.equal(summarizeBody("<style>a{}</style><b>Halo</b>  dunia"), "Halo dunia");
    assert.equal(summarizeBody("x".repeat(500)).length, 160);
    assert.equal(summarizeBody(""), "");
});

test("halaman admin memakai helper ini dan tidak lagi menelan body error", () => {
    const publisher = fs.readFileSync(new URL("../admin-control/social-publisher.js", import.meta.url), "utf8");
    const setPage = fs.readFileSync(new URL("../admin-control/studio-medsos-set.js", import.meta.url), "utf8");
    const setHtml = fs.readFileSync(new URL("../admin-control/studio-medsos-set.html", import.meta.url), "utf8");

    assert.match(publisher, /import \{ describeHttpFailure, isPlatformFailure \} from "\.\/assets\/js\/http-failure\.js"/);
    assert.match(publisher, /if \(method === "GET" && attempt === 0 && isPlatformFailure/);
    assert.match(setPage, /window\.GENZHttpFailure\?\.describeHttpFailure/);
    assert.match(setHtml, /type="module" src="\.\/assets\/js\/http-failure\.js/);
});
