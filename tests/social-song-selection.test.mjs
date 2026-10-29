import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
    normalizeSongMode,
    pickRandomFacebookSong,
    resolveScheduleSongMode
} from "../lib/social-publisher/quotes.js";

const ROOT = process.cwd();
const sql = fs.readFileSync(path.join(ROOT, "supabase", "social-song-selection.sql"), "utf8");
const panelJs = fs.readFileSync(path.join(ROOT, "admin-control", "social-publisher.js"), "utf8");
const panelHtml = fs.readFileSync(path.join(ROOT, "admin-control", "social-publisher.html"), "utf8");
const api = fs.readFileSync(path.join(ROOT, "api", "social-publisher.js"), "utf8");
const cron = fs.readFileSync(path.join(ROOT, "functions", "_shared", "social-publisher-cron.js"), "utf8");

const SONGS = [
    { id: "song-a", title: "Lagu A", audio_object_key: "a.mp3" },
    { id: "song-b", title: "Lagu B", audio_object_key: "b.mp3" },
    { id: "song-c", title: "Lagu C", audio_object_key: "c.mp3" }
];

test("mode lagu: off / fixed / random + kompatibilitas use_random_song", () => {
    assert.equal(normalizeSongMode("fixed"), "fixed");
    assert.equal(normalizeSongMode("RANDOM"), "random");
    assert.equal(normalizeSongMode("aneh", "off"), "off");

    /* Data lama tanpa song_mode. */
    assert.equal(resolveScheduleSongMode({ use_random_song: true }, "character"), "random");
    assert.equal(resolveScheduleSongMode({ use_random_song: false }, "character"), "off");
    assert.equal(resolveScheduleSongMode({ use_random_song: false }, "quote"), "off");
    assert.equal(resolveScheduleSongMode({}, "quote"), "random");

    /* song_mode menang atas kolom lama. */
    assert.equal(resolveScheduleSongMode({ song_mode: "fixed", use_random_song: true }, "character"), "fixed");
    assert.equal(resolveScheduleSongMode({ song_mode: "off", use_random_song: true }, "quote"), "off");
});

test("lagu tetap selalu dipakai, walau baru saja dipakai", () => {
    const recent = [{ song_id: "song-b", song_title: "Lagu B" }];
    const fixed = pickRandomFacebookSong(SONGS, recent, () => 0, { preferredSongId: "song-b" });
    assert.equal(fixed.id, "song-b");
});

test("lagu tetap yang sudah tidak aktif/hilang jatuh ke acak", () => {
    const recent = [{ song_id: "song-b", song_title: "Lagu B" }];
    const fallback = pickRandomFacebookSong(SONGS, recent, () => 0.99, { preferredSongId: "song-hilang" });
    assert.notEqual(fallback, null);
    assert.notEqual(fallback.id, "song-b", "lagu terakhir tetap dihindari bila ada opsi lain");
});

test("mode acak tidak mengulang lagu terakhir", () => {
    const recent = [{ song_id: "song-a", song_title: "Lagu A" }];
    const picked = pickRandomFacebookSong(SONGS, recent, () => 0, {});
    assert.ok(["song-b", "song-c"].includes(picked.id));
});

test("database menyimpan pilihan lagu per jadwal", () => {
    assert.match(sql, /add column if not exists song_mode text not null default 'off'/i);
    assert.match(sql, /add column if not exists song_id uuid/i);
    assert.match(sql, /check \(song_mode in \('off', 'fixed', 'random'\)\)/i);
    assert.match(sql, /set song_mode = 'random'\s+where use_random_song = true/i);
});

test("API, cron, dan panel memakai song_mode", () => {
    for (const source of [api, cron, panelJs]) {
        assert.match(source, /song_mode/);
    }
    assert.match(api, /preferredSongId/);
    assert.match(cron, /resolveScheduleSongMode/);
    assert.match(cron, /preferredSongId: fixedSongId/);
    /* Panel: tiga mode + pemilih lagu dari koleksi akun. */
    assert.match(panelHtml, /id="schedule-song-mode"/);
    assert.match(panelHtml, /id="schedule-song-choice"/);
    assert.match(panelHtml, /id="manual-character-song-mode"/);
    assert.match(panelHtml, /id="manual-quote-song-mode"/);
    assert.match(panelJs, /function fillSongChoices/);
    /* Kompatibilitas: elemen lama tetap ada walau disembunyikan. */
    assert.match(panelHtml, /id="schedule-random-song"/);
});
