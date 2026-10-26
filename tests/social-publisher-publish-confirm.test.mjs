import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

/*
 * Konfirmasi terbit manual memakai tombol yang sama (dua langkah),
 * bukan dialog mengambang. Tes ini menjaga sifat itu: kalau suatu saat
 * `window.confirm` dipakai lagi di jalur terbit manual, tes akan gagal.
 */

const source = await fs.readFile(
    new URL("../admin-control/social-publisher.js", import.meta.url),
    "utf8"
);
const htmlSource = await fs.readFile(
    new URL("../admin-control/social-publisher.html", import.meta.url),
    "utf8"
);
const lightCss = await fs.readFile(
    new URL("../admin-control/assets/css/social-publisher-light.css", import.meta.url),
    "utf8"
);

function publishFunctionBody() {
    const start = source.indexOf("async function publishManualPreview");
    assert.ok(start > 0, "publishManualPreview harus ada");
    const end = source.indexOf("function showManualOutfit", start);
    return source.slice(start, end);
}

test("jalur terbit manual tidak memakai dialog mengambang", () => {
    const body = publishFunctionBody();
    assert.doesNotMatch(
        body,
        /window\.confirm/,
        "konfirmasi harus terjadi di dalam tombol, bukan window.confirm"
    );
});

test("klik pertama hanya mengubah tombol menjadi konfirmasi", () => {
    const body = publishFunctionBody();
    assert.match(body, /if \(!state\.publishArmed\) \{/);
    assert.match(body, /armManualPublish\(state\.manualPreview\)/);
    assert.match(body, /return;/);

    assert.match(source, /function armManualPublish\(/);
    assert.match(source, /function disarmManualPublish\(/);
    assert.match(source, /Konfirmasi: Terbitkan sekarang/);
    assert.match(source, /classList\.add\("is-confirming"\)/);
    assert.match(source, /setAttribute\("aria-pressed", "true"\)/);
});

test("klik kedua barulah mengirim ke Facebook", () => {
    const body = publishFunctionBody();
    const armIndex = body.indexOf("armManualPublish(state.manualPreview)");
    const disarmIndex = body.indexOf("disarmManualPublish();", armIndex);
    const apiIndex = body.indexOf('api("manual-publish"');

    assert.ok(armIndex > 0 && disarmIndex > armIndex, "harus lepas status konfirmasi");
    assert.ok(apiIndex > disarmIndex, "kirim ke Facebook setelah konfirmasi");
});

test("konfirmasi batal sendiri kalau dibiarkan terlalu lama", () => {
    assert.match(source, /PUBLISH_ARM_TIMEOUT_MS\s*=\s*\d+/);
    assert.match(source, /state\.publishArmTimer = setTimeout\(/);
    assert.match(source, /Konfirmasi terbit kedaluwarsa/);
    /* Timer harus dibersihkan saat status dilepas, bukan menumpuk. */
    const disarmBody = source.slice(
        source.indexOf("function disarmManualPublish"),
        source.indexOf("function resetDiscardButtonLabel")
    );
    assert.match(disarmBody, /clearTimeout\(state\.publishArmTimer\)/);
    assert.match(disarmBody, /state\.publishArmTimer = null/);
});

test("tombol buang berperan sebagai Batal selama menunggu konfirmasi", () => {
    assert.match(source, /discard\.textContent = "Batal"/);
    assert.match(source, /function resetDiscardButtonLabel\(\)/);
    assert.match(source, /discard\.textContent = "Buang pratinjau"/);

    const handlerStart = source.indexOf('$("manual-discard-button").addEventListener("click"');
    const handler = source.slice(handlerStart, handlerStart + 700);
    assert.match(
        handler,
        /if \(state\.publishArmed\) \{[\s\S]{0,200}disarmManualPublish[\s\S]{0,120}return;/,
        "klik Batal harus membatalkan konfirmasi, bukan menghapus pratinjau"
    );
    assert.ok(
        handler.indexOf("state.publishArmed") < handler.indexOf("discardManualPreview"),
        "pemeriksaan status konfirmasi harus lebih dulu dari penghapusan pratinjau"
    );
});

test("konfirmasi dilepas saat tujuan terbit berubah", () => {
    assert.match(
        source,
        /\$\("manual-page"\)\?\.addEventListener\("change", \(\) => disarmManualPublish\(\)\)/,
        "mengganti Page harus membatalkan konfirmasi"
    );

    const quoteStart = source.indexOf('$("manual-quote-target")?.addEventListener("change"');
    const quoteHandler = source.slice(quoteStart, quoteStart + 700);
    assert.match(
        quoteHandler,
        /disarmManualPublish\(\)/,
        "mengganti target Kata-kata Mutiara harus membatalkan konfirmasi"
    );

    const submitStart = source.indexOf("async function submitManualPost");
    const submitBody = source.slice(submitStart, submitStart + 300);
    assert.match(
        submitBody,
        /disarmManualPublish\(\)/,
        "pratinjau baru harus membatalkan konfirmasi lama"
    );

    const clearStart = source.indexOf("function clearManualPreview");
    const clearBody = source.slice(clearStart, clearStart + 2500);
    assert.match(clearBody, /disarmManualPublish\(\)/);
});

test("label tombol dipulihkan setelah terbit selesai", () => {
    const body = publishFunctionBody();
    assert.match(body, /button\.dataset\.originalText = manualPublishLabel\(\)/);
    assert.match(body, /classList\.remove\("is-confirming"\)/);
    assert.match(source, /function manualPublishLabel\(/);
    assert.match(source, /quotePublishButtonText\(normalizeClientQuoteTarget\(preview\.quoteTarget\)\)/);
});

test("tampilan tombol konfirmasi tersedia di tema gelap dan terang", () => {
    assert.match(htmlSource, /\.btn\.is-confirming/);
    assert.match(htmlSource, /btn-confirm-pulse/);
    assert.match(lightCss, /\.btn\.is-confirming/);
    assert.match(lightCss, /btn-confirm-pulse-light/);
    /* Aset baru tidak boleh tertahan cache lama. */
    assert.match(htmlSource, /social-publisher\.js\?v=publish-confirm-inline-/);
    assert.match(htmlSource, /social-publisher-light\.css\?v=light-theme-20261026/);
});

test("copy tombol tetap sama untuk mode foto", () => {
    assert.match(htmlSource, /id="manual-publish-button"[^>]*>Terbitkan ke Facebook Page</);
    assert.match(source, /"Terbitkan ke Facebook Page"/);
});
