import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
    composeSocialCaption,
    formatTagBlockForCaption,
    sanitizeFacebookProfileUrl
} from "../lib/social-publisher/utils.js";

const ROOT = process.cwd();
const sql = fs.readFileSync(path.join(ROOT, "supabase", "social-post-tagging.sql"), "utf8");
const api = fs.readFileSync(path.join(ROOT, "api", "social-publisher.js"), "utf8");
const cron = fs.readFileSync(path.join(ROOT, "functions", "_shared", "social-publisher-cron.js"), "utf8");
const panelHtml = fs.readFileSync(path.join(ROOT, "admin-control", "social-publisher.html"), "utf8");
const panelJs = fs.readFileSync(path.join(ROOT, "admin-control", "social-publisher.js"), "utf8");

/* Meta tidak menyediakan cara men-tag akun lewat Graph API (`message_tags`
   read-only, `@[id:0:nama]` mati, `tags` foto butuh publish_actions yang sudah
   dihapus). Yang didukung: tautan profil di caption. */

test("URL profil hanya diterima dari domain Facebook dan https", () => {
    assert.equal(
        sanitizeFacebookProfileUrl("https://www.facebook.com/budi.santoso"),
        "https://www.facebook.com/budi.santoso"
    );
    /* Parameter pelacak dibuang. */
    assert.equal(
        sanitizeFacebookProfileUrl("https://www.facebook.com/budi.santoso?fref=hovercard"),
        "https://www.facebook.com/budi.santoso"
    );
    assert.equal(
        sanitizeFacebookProfileUrl("https://web.facebook.com/budi.santoso/"),
        "https://www.facebook.com/budi.santoso"
    );
    assert.equal(
        sanitizeFacebookProfileUrl("https://www.facebook.com/profile.php?id=100012345"),
        "https://www.facebook.com/profile.php?id=100012345"
    );

    /* Ditolak. */
    assert.equal(sanitizeFacebookProfileUrl("https://evil.example.com/budi"), "");
    assert.equal(sanitizeFacebookProfileUrl("http://www.facebook.com/budi"), "");
    assert.equal(sanitizeFacebookProfileUrl("javascript:alert(1)"), "");
    assert.equal(sanitizeFacebookProfileUrl(""), "");
});

test("blok tautan profil di caption memakai format yang jelas", () => {
    assert.equal(
        formatTagBlockForCaption({ tag_name: "Budi", tag_url: "https://www.facebook.com/budi" }),
        "👤 Budi — https://www.facebook.com/budi"
    );
    assert.equal(
        formatTagBlockForCaption({ tag_url: "https://www.facebook.com/budi" }),
        "👤 https://www.facebook.com/budi"
    );
    assert.equal(formatTagBlockForCaption({ tag_name: "Budi" }), "👤 Budi");
    assert.equal(formatTagBlockForCaption({}), "");
    assert.equal(formatTagBlockForCaption(null), "");
});

test("caption utuh: tautan profil masuk tanpa merusak bagian lain", () => {
    const caption = composeSocialCaption({
        baseCaption: "Cerita hari ini dari Jakarta ✨",
        song: { title: "Musik Latar 1" },
        tag: { tag_name: "Budi", tag_url: "https://www.facebook.com/budi" }
    });
    assert.match(caption, /Cerita hari ini dari Jakarta/);
    assert.match(caption, /🎵 Lagu Facebook: Musik Latar 1/);
    assert.match(caption, /👤 Budi — https:\/\/www\.facebook\.com\/budi/);

    /* Tanpa tag tetap bersih. */
    const clean = composeSocialCaption({ baseCaption: "Halo" });
    assert.doesNotMatch(clean, /👤/);
});

test("tautan profil jahat dibuang dari caption", () => {
    const caption = composeSocialCaption({
        baseCaption: "Halo",
        tag: { tag_name: "Bukan FB", tag_url: "https://evil.example.com/x" }
    });
    assert.doesNotMatch(caption, /evil\.example\.com/);
    /* Nama tetap boleh tampil sebagai teks biasa. */
    assert.match(caption, /Bukan FB/);
});

test("database & kode menyimpan tautan profil untuk manual dan autopost", () => {
    assert.match(sql, /add column if not exists tag_name text not null default ''/i);
    assert.match(sql, /add column if not exists tag_url text not null default ''/i);
    assert.match(sql, /char_length\(tag_url\) <= 300/i);

    assert.match(api, /sanitizeFacebookProfileUrl/);
    assert.match(api, /tag_name: tagName/);
    assert.match(api, /tag_url: tagUrl/);
    assert.match(cron, /tag: \{ tag_name: schedule\.tag_name/);
    /* Caption Kata-kata Mutiara juga memuat tautan profil. */
    assert.match(api, /formatTagBlockForCaption\(manualTag\)/);
    assert.match(cron, /formatTagBlockForCaption\(\{/);

    assert.match(panelHtml, /id="schedule-tag-url"/);
    assert.match(panelHtml, /id="manual-tag-url"/);
    assert.match(panelHtml, /tidak mengizinkan men-tag akun lewat API/);
    assert.match(panelJs, /tag_url: \$?\("schedule-tag-url"\)/);
});
