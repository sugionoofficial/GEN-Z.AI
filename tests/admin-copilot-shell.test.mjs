import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../admin-control/copilot/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../admin-control/copilot/assets/css/copilot.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../admin-control/copilot/assets/js/copilot.js", import.meta.url), "utf8");

function collectIds(source) {
    return [...source.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
}

test("Admin Copilot: setiap id yang dicari JavaScript benar-benar ada di halaman", () => {
    /*
     * Kesalahan paling umum saat rombak tampilan: elemen dihapus dari HTML
     * tetapi masih dirujuk skrip, sehingga halaman macet tanpa pesan.
     */
    const referenced = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map(match => match[1]);
    assert.ok(referenced.length > 10, "skrip harus merujuk elemen halamannya");

    const ids = new Set(collectIds(html));
    const missing = referenced.filter(id => !ids.has(id));
    assert.deepEqual(missing, [], `id hilang di index.html: ${missing.join(", ")}`);
});

test("Admin Copilot: tidak ada id ganda di halaman", () => {
    const ids = collectIds(html);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual([...new Set(duplicates)], [], "id ganda membuat getElementById tidak deterministik");
});

test("Admin Copilot: desktop dikunci setinggi layar tanpa gulir halaman", () => {
    /*
     * Permintaan pemilik produk: pada desktop blok tidak boleh turun ke
     * bawah. Jadi halaman tidak boleh menggulir; tiap panel yang menggulir
     * sendiri di dalam ruangnya.
     */
    assert.match(css, /\.copilot-shell\s*\{[^}]*height:\s*100dvh/, "shell harus 100dvh");
    assert.match(css, /\.copilot-shell\s*\{[^}]*overflow:\s*hidden/, "shell tidak boleh menggulir");

    const bodyBlock = css.match(/(^|\n)body\s*\{([^}]*)\}/);
    assert.ok(bodyBlock, "aturan body harus ada");
    assert.match(bodyBlock[2], /overflow:\s*hidden/, "body tidak boleh menggulir di desktop");

    assert.match(css, /\.workspace\s*\{[^}]*min-height:\s*0/, "workspace harus boleh menyusut");
    assert.match(css, /\.workspace\s*\{[^}]*flex:\s*1 1 auto/, "workspace mengisi sisa tinggi");
    assert.match(css, /\.panel\s*\{[^}]*min-height:\s*0/, "panel harus boleh menyusut");
    assert.match(css, /\.panel\s*\{[^}]*overflow:\s*hidden/, "panel memotong isinya, bukan memanjangkan halaman");

    /* Panel yang isinya panjang wajib menggulir sendiri. */
    for (const selector of [".file-list", ".chat-messages"]) {
        const block = css.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`));
        assert.ok(block, `${selector} harus punya aturan`);
        assert.match(block[0], /overflow-y:\s*auto/, `${selector} harus menggulir sendiri`);
    }
});

test("Admin Copilot: kontrol git berada di baris sendiri, bukan di dalam panel", () => {
    const start = html.indexOf('<div class="gitbar"');
    const end = html.indexOf("<!-- ============ WORKSPACE");
    assert.ok(start > -1 && end > start, "baris kontrol git harus ada sebelum workspace");
    const gitbar = html.slice(start, end);

    for (const id of ["commitMessage", "saveFileButton", "createPrButton", "mergePrButton", "pullRequestSelect"]) {
        assert.ok(gitbar.includes(`id="${id}"`), `kontrol ${id} harus di baris git`);
        assert.ok(!html.includes(`<div class="actions"`), "blok aksi di dalam panel sudah tidak dipakai");
    }

    assert.match(css, /\.gitbar\s*\{[^}]*flex:\s*0 0 auto/, "baris git tidak boleh ikut melar");
});

test("Admin Copilot: merge tetap butuh frasa konfirmasi dan hanya untuk PR terpilih", () => {
    assert.match(js, /Ketik MERGE #\$\{number\}/, "dialog merge harus meminta frasa konfirmasi");
    assert.match(js, /phrase !== `MERGE #\$\{number\}`/, "frasa harus cocok persis");
    assert.match(js, /if \(!number\) return;/, "merge tanpa PR terpilih harus diabaikan");
});

test("Admin Copilot: perubahan hanya menulis ke branch, tidak pernah langsung ke main", () => {
    assert.match(js, /action: "commit_file"/, "commit harus lewat aksi backend");
    assert.ok(!/action:\s*"commit_file"[\s\S]{0,200}branch:\s*"main"/.test(js), "branch main tidak boleh dipakai untuk menulis");
    assert.match(js, /state\.branch \|\| undefined/, "branch kosong diserahkan ke server untuk dibuatkan");
});

test("Admin Copilot: token GitHub tidak pernah dibaca dari sisi browser", () => {
    assert.ok(!/GITHUB_PAT|github_pat_|ghp_/.test(js), "skrip halaman tidak boleh menyentuh token GitHub");
    assert.ok(!/GITHUB_PAT/.test(html), "halaman tidak boleh memuat token GitHub");
});
