import assert from "node:assert/strict";
import test from "node:test";

import { cleanSongTitleForCaption, composeSocialCaption } from "../lib/social-publisher/utils.js";
import { formatFacebookSongCaption } from "../lib/social-publisher/quotes.js";

/* Regresi: caption lagu pernah memuat nama berkas hasil unduhan apa adanya
   ("FDownload.app 1125438713302255 (320kbps)"). Teks seperti itu terbaca
   sebagai spam oleh moderasi Facebook dan membuat autopost gagal (code 368). */

test("judul lagu dari nama berkas dibersihkan sebelum masuk caption", () => {
    assert.equal(cleanSongTitleForCaption("lagu_keren.mp3"), "lagu keren");
    assert.equal(cleanSongTitleForCaption("Senja di Jakarta"), "Senja di Jakarta");
    assert.equal(cleanSongTitleForCaption("Rindu (Official Audio)"), "Rindu (Official Audio)");
    assert.equal(cleanSongTitleForCaption("www.y2mate.com Something"), "Something");
});

test("judul yang hanya berisi nama situs unduhan / id acak dibuang", () => {
    assert.equal(cleanSongTitleForCaption("FDownload.app 1125438713302255 (320kbps)"), "");
    assert.equal(cleanSongTitleForCaption("1234567890123"), "");
    assert.equal(cleanSongTitleForCaption(""), "");
});

test("caption tanpa judul layak tidak memuat teks sampah", () => {
    const caption = composeSocialCaption({
        baseCaption: "Cerita hari ini dari Jakarta ✨",
        song: { title: "FDownload.app 1125438713302255 (320kbps)" }
    });
    assert.doesNotMatch(caption, /fdownload/i);
    assert.doesNotMatch(caption, /320\s*kbps/i);
    assert.doesNotMatch(caption, /\.mp3/i);
    assert.match(caption, /Cerita hari ini dari Jakarta/);
});

test("caption tetap menampilkan judul lagu yang wajar", () => {
    const caption = composeSocialCaption({
        baseCaption: "Cerita hari ini ✨",
        song: { title: "Senja di Jakarta", artist: "Musisi Lokal" }
    });
    assert.match(caption, /🎵 Lagu Facebook: Senja di Jakarta — Musisi Lokal/);
    assert.equal(
        formatFacebookSongCaption({ title: "Senja di Jakarta" }),
        "🎵 Lagu Facebook: Senja di Jakarta"
    );
});
