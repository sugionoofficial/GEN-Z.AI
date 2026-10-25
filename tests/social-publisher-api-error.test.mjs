import test from "node:test";
import assert from "node:assert/strict";

import {
    describeApiFailure,
    fallbackMessageForStatus,
    loggableErrorDetails
} from "../lib/social-publisher/api-error.js";

test("error tanpa pesan tetap dikirim dengan pesan yang bisa ditindaklanjuti", () => {
    const bare = new Error("");
    bare.status = 503;
    const described = describeApiFailure(bare);
    assert.equal(described.status, 503);
    assert.equal(described.missingMessage, true);
    assert.match(described.message, /Server sedang tidak tersedia/);
    assert.ok(described.message.length > 20);
});

test("objek error dari binding AI tanpa message tidak menghasilkan payload kosong", () => {
    /* Bentuk yang pernah lolos: { status: 503 } tanpa properti message. */
    const described = describeApiFailure({ status: 503 });
    assert.equal(described.missingMessage, true);
    assert.match(described.message, /HTTP|Server sedang tidak tersedia/);
});

test("error dengan pesan dipakai apa adanya", () => {
    const error = new Error("Bucket privat Supabase Storage belum tersedia.");
    error.status = 503;
    const described = describeApiFailure(error);
    assert.equal(described.message, "Bucket privat Supabase Storage belum tersedia.");
    assert.equal(described.missingMessage, false);
});

test("status tanpa pemetaan tetap menghasilkan pesan bermakna", () => {
    assert.match(fallbackMessageForStatus(500), /kesalahan internal \(HTTP 500\)/);
    assert.match(fallbackMessageForStatus(418), /HTTP 418/);
    assert.match(fallbackMessageForStatus(429), /Terlalu banyak permintaan/);
});

test("status default 500 bila error tidak membawa status", () => {
    assert.equal(describeApiFailure(new Error("")).status, 500);
    assert.equal(describeApiFailure(null).status, 500);
});

test("detail log tidak pernah kosong, termasuk untuk objek aneh", () => {
    assert.deepEqual(loggableErrorDetails(Object.assign(new Error("boom"), { status: 502 })), {
        name: "Error",
        message: "boom",
        status: 502,
        code: ""
    });
    assert.match(loggableErrorDetails({ status: 503 }).raw, /503/);
    assert.equal(loggableErrorDetails("teks bebas").raw, "teks bebas");
    assert.equal(loggableErrorDetails(undefined).name, "undefined");
    const circular = {};
    circular.self = circular;
    assert.ok(loggableErrorDetails(circular).raw.length > 0, "objek sirkular tetap tercatat");
});

test("handler API memakai helper ini sehingga error tidak pernah kosong", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(new URL("../api/social-publisher.js", import.meta.url), "utf8");
    assert.match(source, /import \{ describeApiFailure, loggableErrorDetails \} from "\.\.\/lib\/social-publisher\/api-error\.js"/);
    assert.match(source, /const \{ status, message, missingMessage \} = describeApiFailure\(error, 500\)/);
    assert.match(source, /const payload = \{ success: false, error: message \}/);
    assert.doesNotMatch(source, /error: status === 500 \? error\.message \|\| "Terjadi kesalahan internal\." : error\.message/);
});
