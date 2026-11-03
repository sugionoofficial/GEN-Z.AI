/* =========================================================
   GEN-Z.AI
   LYRIA 3.5 PROMPT REFUSAL — REGRESSION TESTS
   ---------------------------------------------------------
   Kasus nyata:
   "Egress Gateway 400: Lyria interaction error (http 400):
    400 The prompt could not be processed. Please try rephrasing
    the prompt or using different input. The gateway refused the
    request before it reached a provider, so nothing was charged.
    (500 credit telah dikembalikan ke saldo akun Anda.)"

   Bukan bug saldo/refund, melainkan penolakan filter konten
   Google Lyria 3.5. Guard di bawah memastikan:
   1. error dikenali dan dipetakan ke pesan actionable
   2. sanitasi retry tidak merusak lirik/struktur lagu
   3. retry hanya berlaku untuk model music, satu kali
   ========================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    LYRIA_PROMPT_REFUSED_CODE,
    LYRIA_PROMPT_REFUSED_MESSAGE,
    LYRIA_SAFE_FALLBACK_PROMPT,
    isLyriaPromptRefusedError,
    sanitizeLyriaMusicText
} from "../provider/opus/lyria-prompt-safety.js";
import { buildLyriaMusicPrompt } from "../provider/opus/audio-tools.js";

const REAL_GATEWAY_ERROR =
    "Egress Gateway 400: Lyria interaction error (http 400): 400 The prompt could not be processed. " +
    "Please try rephrasing the prompt or using different input. The gateway refused the request " +
    "before it reached a provider, so nothing was charged.";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/* ---------------------------------------------------------
   DETEKSI
   --------------------------------------------------------- */

test("mengenali pesan penolakan Lyria yang benar-benar muncul di produksi", () => {
    assert.equal(isLyriaPromptRefusedError(REAL_GATEWAY_ERROR), true);
    assert.equal(isLyriaPromptRefusedError(new Error(REAL_GATEWAY_ERROR)), true);
    assert.equal(isLyriaPromptRefusedError({ message: REAL_GATEWAY_ERROR }), true);
});

test("mengenali variasi prohibited_content / sensitive words / safety system", () => {
    assert.equal(isLyriaPromptRefusedError("google_media.interaction_failed: Bad Request (prohibited_content)"), true);
    assert.equal(
        isLyriaPromptRefusedError("Input blocked: The prompt could not be submitted. The prompt contains sensitive words."),
        true
    );
    assert.equal(isLyriaPromptRefusedError("Your request was rejected by the safety system."), true);
    assert.equal(isLyriaPromptRefusedError("Lyria interaction error (http 400)"), true);
});

test("mengenali error yang sudah ditandai code LYRIA_PROMPT_REFUSED", () => {
    assert.equal(isLyriaPromptRefusedError({ code: LYRIA_PROMPT_REFUSED_CODE, message: "retry gagal" }), true);
});

test("TIDAK salah mengklasifikasi error non-Lyria (kredit, jaringan, kuota)", () => {
    assert.equal(isLyriaPromptRefusedError("Kredit tidak cukup untuk generate lagu"), false);
    assert.equal(isLyriaPromptRefusedError("Opus API key tidak tersedia"), false);
    assert.equal(isLyriaPromptRefusedError(new Error("fetch failed: ECONNRESET")), false);
    assert.equal(isLyriaPromptRefusedError({ code: "OPUS_UPSTREAM_QUEUE_BUSY", message: "Antrian penuh" }), false);
    assert.equal(isLyriaPromptRefusedError(null), false);
    assert.equal(isLyriaPromptRefusedError(""), false);
});

test("pesan pengganti memuat panduan yang bisa langsung ditindaklanjuti", () => {
    assert.match(LYRIA_PROMPT_REFUSED_MESSAGE, /filter konten Google Lyria/i);
    assert.match(LYRIA_PROMPT_REFUSED_MESSAGE, /nama artis/i);
    assert.match(LYRIA_PROMPT_REFUSED_MESSAGE, /genre, instrumen, tempo\/BPM/i);
    assert.match(LYRIA_PROMPT_REFUSED_MESSAGE, /sudah mencoba satu kali/i);
    assert.match(LYRIA_PROMPT_REFUSED_MESSAGE, /tidak ada biaya provider/i);
    assert.ok(LYRIA_SAFE_FALLBACK_PROMPT.length > 20);
});

/* ---------------------------------------------------------
   SANITASI
   --------------------------------------------------------- */

test("menetralkan referensi artis eksplisit dan judul lagu berkutip", () => {
    const clean = sanitizeLyriaMusicText(
        "Pop dangdut koplo mirip Via Vallen, ketuk kendang cepat, tempo 128 BPM."
    );
    assert.doesNotMatch(clean, /Via Vallen/);
    assert.match(clean, /warna musik orisinal/i);
    assert.match(clean, /128 BPM/);

    const cleanEn = sanitizeLyriaMusicText(
        "Upbeat synth pop in the style of Daft Punk, 120 BPM, warm bass."
    );
    assert.doesNotMatch(cleanEn, /Daft Punk/);
    assert.match(cleanEn, /120 BPM/);

    const titled = sanitizeLyriaMusicText('Buat lagu "Bohemian Rhapsody" versi akustik');
    assert.doesNotMatch(titled, /Bohemian Rhapsody/);
    assert.match(titled, /lagu orisinal/i);
});

test("tidak memotong perumpamaan biasa yang bukan nama proper", () => {
    const clean = sanitizeLyriaMusicText(
        "Akustik hangat seperti pagi hari, petikan gitar lembut, suara hujan."
    );
    assert.match(clean, /seperti pagi hari/);
    assert.match(clean, /petikan gitar lembut/);
});

test("menghapus URL, email, dan handle dari deskripsi", () => {
    const clean = sanitizeLyriaMusicText(
        "Lo-fi chill 80 BPM https://example.com/track hubungi aku@email.com atau @artist_handle"
    );
    assert.doesNotMatch(clean, /example\.com/);
    assert.doesNotMatch(clean, /aku@email\.com/);
    assert.doesNotMatch(clean, /@artist_handle/);
    assert.match(clean, /Lo-fi chill 80 BPM/);
});

test("membersihkan karakter kontrol dan spasi berlebih tanpa merusak baris", () => {
    const clean = sanitizeLyriaMusicText("Pop  ceria\u0000   dengan\u00A0gitar\r\n dan   drum");
    assert.doesNotMatch(clean, /\u0000/);
    assert.doesNotMatch(clean, /\u00A0/);
    assert.match(clean, /Pop ceria/);
    assert.match(clean, /\n dan drum/);
});

test("mode lirik menjaga struktur [Verse]/[Chorus] dan baris Indonesia utuh", () => {
    const lyrics =
        "[Verse 1]\nMelangkah di bawah cahaya pagi\nMenjemput harapan yang baru\n\n" +
        "[Chorus]\nKita terbang menembus batas mimpi\nBersinar terang di langit biru";
    const clean = sanitizeLyriaMusicText(lyrics, { stripArtistReferences: false });
    assert.equal(clean, lyrics);
});

test("mode lirik tidak memotong baris puitis yang kebetulan memakai kata 'seperti'", () => {
    const lyrics = "[Verse]\nSeperti Via Vallen aku bernyanyi\nLewat jendela kaca";
    const clean = sanitizeLyriaMusicText(lyrics, { stripArtistReferences: false });
    assert.match(clean, /Seperti Via Vallen aku bernyanyi/);
    assert.match(clean, /\[Verse\]/);
});

test("teks kosong menghasilkan string kosong (fallback diputus di adapter)", () => {
    assert.equal(sanitizeLyriaMusicText(""), "");
    assert.equal(sanitizeLyriaMusicText(null), "");
    assert.equal(sanitizeLyriaMusicText("   \n  "), "");
});

/* ---------------------------------------------------------
   PROMPT BUILDER TETAP KONSISTEN
   --------------------------------------------------------- */

test("buildLyriaMusicPrompt tetap menyertakan lirik terstruktur setelah normalisasi", () => {
    const vocal = buildLyriaMusicPrompt({
        prompt: "Pop akustik hangat, gitar dan piano, 95 BPM",
        lyrics: "[Verse]\nPagi ini aku melangkah\n\n[Chorus]\nKita bersinar lagi",
        vocalMode: "vocal",
        durationSeconds: 30
    });
    assert.equal(vocal.isInstrumental, false);
    assert.match(vocal.musicPrompt, /\[Verse\]/);
    assert.match(vocal.musicPrompt, /\[Chorus\]/);
    assert.match(vocal.structuredLyrics, /\[Verse\]/);
    assert.match(vocal.musicPrompt, /95 BPM/);
    assert.match(vocal.musicPrompt, /Target length: about 30 seconds/);

    const instrumental = buildLyriaMusicPrompt({
        prompt: "Ambient cinematic, pad lembut, 70 BPM",
        lyrics: "",
        vocalMode: "instrumental",
        durationSeconds: 60
    });
    assert.equal(instrumental.isInstrumental, true);
    assert.match(instrumental.musicPrompt, /Instrumental only/);
    assert.match(instrumental.musicPrompt, /Target length: about 60 seconds/);
});

/* ---------------------------------------------------------
   GUARD SUMBER: wiring retry & pesan error
   --------------------------------------------------------- */

test("adapter music melakukan satu retry aman setelah penolakan Lyria", () => {
    const src = read("models/opus-audio/factory.js");
    assert.match(src, /isLyriaPromptRefusedError/);
    assert.match(src, /sanitizeLyriaMusicText/);
    assert.match(src, /lyriaSafetyRetryUsed/);
    assert.match(src, /audioKind === "music"/);
    assert.match(src, /LYRIA_SAFE_FALLBACK_PROMPT/);
    assert.match(src, /stripArtistReferences: false/);
    assert.match(src, /retryPayload/);
    /* Retry tidak boleh mengubah model non-music. */
    assert.match(src, /if \(!canRetry\)\s*\{\s*throw error;/);
});

test("adapter audio-tools menerapkan normalisasi dasar pada prompt & lirik", () => {
    const src = read("provider/opus/audio-tools.js");
    assert.match(src, /from "\.\/lyria-prompt-safety\.js"/);
    assert.match(src, /sanitizeLyriaMusicText\(lyrics, \{ stripArtistReferences: false \}\)/);
    assert.match(src, /sanitizeLyriaMusicText\(prompt \|\| text, \{ stripArtistReferences: false \}\)/);
});

test("api/generate memetakan error ke pesan & code LYRIA_PROMPT_REFUSED khusus music", () => {
    const src = read("api/generate.js");
    assert.match(src, /from "\.\.\/provider\/opus\/lyria-prompt-safety\.js"/);
    assert.match(src, /const lyriaPromptRefused =/);
    assert.match(src, /String\(modelConfig\?\.audioKind \|\| ""\)/);
    assert.match(src, /lyriaPromptRefused\s*\?\s*LYRIA_PROMPT_REFUSED_MESSAGE/);
    assert.match(src, /lyriaPromptRefused\s*\?\s*LYRIA_PROMPT_REFUSED_CODE/);
    assert.match(src, /lyria_prompt_refused: true/);
    assert.match(src, /retried_with_cleaned_prompt: true/);
});

test("UI generate dan deskripsi field memperingatkan batasan filter konten Lyria", () => {
    const html = read("generate/index.html");
    assert.match(html, /hindari nama artis atau judul lagu berhak cipta/i);

    const factory = read("models/opus-audio/factory.js");
    assert.match(factory, /Filter konten Google Lyria 3\.5 menolak prompt/);
    assert.match(factory, /tulis lirik ORISINAL/i);
});

/* ---------------------------------------------------------
   END-TO-END: retry otomatis lewat mock MCP Opus
   --------------------------------------------------------- */

async function startLyriaMockServer({ failAllApprovedCalls = false } = {}) {
    const http = (await import("node:http")).default;
    const approvedCalls = [];
    const server = http.createServer(async (req, res) => {
        let rawBody = "";
        for await (const chunk of req) rawBody += chunk;
        const rpc = JSON.parse(rawBody || "{}");
        const sendRpc = result => {
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Mcp-Session-Id": "sess-lyria-refusal-1"
            });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };

        if (rpc.method === "initialize") {
            sendRpc({ protocolVersion: "2025-03-26", serverInfo: { name: "mock-opus-lyria" }, capabilities: {} });
            return;
        }
        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            res.end();
            return;
        }
        if (rpc.method === "tools/list") {
            sendRpc({
                tools: [
                    {
                        name: "create_project",
                        inputSchema: { type: "object", properties: { name: { type: "string" } } }
                    },
                    {
                        name: "generate_audio",
                        inputSchema: {
                            type: "object",
                            required: ["projectId", "requestKey", "audioType", "prompt"],
                            properties: {
                                projectId: { type: "string" },
                                requestKey: { type: "string" },
                                maxCredits: { type: "number" },
                                audioType: { type: "string", enum: ["speech", "bgm", "song"] },
                                model: { type: "string", enum: ["lyria-2", "lyria-3-pro-preview"] },
                                prompt: { type: "string" },
                                lyrics: { type: "string" },
                                instrumental: { type: "boolean" },
                                hasVocals: { type: "boolean" },
                                durationSeconds: { type: "number" }
                            }
                        }
                    }
                ]
            });
            return;
        }
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "create_project") {
                const ok = { projectId: "proj-lyria-1" };
                sendRpc({ structuredContent: ok, content: [{ type: "text", text: JSON.stringify(ok) }] });
                return;
            }
            if (name === "generate_audio") {
                if (!args.maxCredits || args.maxCredits <= 0) {
                    const quote = { status: "needs_approval", estimatedCredits: 4 };
                    sendRpc({ structuredContent: quote, content: [{ type: "text", text: JSON.stringify(quote) }] });
                    return;
                }
                approvedCalls.push(args);
                if (failAllApprovedCalls || approvedCalls.length === 1) {
                    /* Gateway menolak SEBELUM provider → tidak ada tagihan. */
                    sendRpc({
                        isError: true,
                        content: [{ type: "text", text: REAL_GATEWAY_ERROR }]
                    });
                    return;
                }
                const ok = { jobId: "job-lyria-ok", status: "queued" };
                sendRpc({ structuredContent: ok, content: [{ type: "text", text: JSON.stringify(ok) }] });
                return;
            }
        }
        res.writeHead(400);
        res.end();
    });

    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    return {
        approvedCalls,
        mcpEndpoint: `http://127.0.0.1:${server.address().port}/mcp`,
        close: () => new Promise(resolve => server.close(resolve))
    };
}

const MUSIC_BODY_WITH_ARTIST_REF = {
    prompt: "Pop koplo mirip Via Vallen, kendang cepat, 128 BPM",
    vocal_mode: "vocal",
    target_duration: "30",
    lyrics: "[Verse]\nAku melangkah di pagi cerah\n\n[Chorus]\nKita bernyanyi sampai sore"
};

test("createTask music retry sekali dengan prompt bersih setelah gateway menolak", async () => {
    const { opusAudioModelMap } = await import("../models/opus-audio/index.js");
    const musicAdapter = opusAudioModelMap["opus-audio-music"];
    const mock = await startLyriaMockServer();

    try {
        const created = await musicAdapter.createTask(
            MUSIC_BODY_WITH_ARTIST_REF,
            "test-bearer-token",
            { mcpUrl: mock.mcpEndpoint }
        );

        assert.match(created.taskId, /^opus:proj-lyria-1:job-lyria-ok$/);
        assert.equal(mock.approvedCalls.length, 2, "harus ada tepat satu retry");

        const [first, retry] = mock.approvedCalls;
        assert.match(first.prompt, /Via Vallen/, "percobaan pertama tetap memakai prompt asli pengguna");
        assert.doesNotMatch(retry.prompt, /Via Vallen/, "retry sudah menetralkan referensi artis");
        assert.match(retry.prompt, /warna musik orisinal/i);
        assert.match(retry.prompt, /128 BPM/, "arahan musik lain tetap dipertahankan");
        assert.match(retry.prompt, /\[Verse\]/, "struktur lirik tetap ikut pada retry");
        assert.match(retry.prompt, /\[Chorus\]/);
        assert.match(String(retry.lyrics || ""), /Aku melangkah di pagi cerah/, "lirik tidak rusak");
        /* Retry tidak boleh mengubah mode vokal/model. */
        assert.equal(retry.audioType, first.audioType);
        assert.equal(retry.model, first.model);
    } finally {
        await mock.close();
    }
});

test("bila retry juga ditolak, error ditandai LYRIA_PROMPT_REFUSED untuk dipetakan ke pesan ramah", async () => {
    const { opusAudioModelMap } = await import("../models/opus-audio/index.js");
    const musicAdapter = opusAudioModelMap["opus-audio-music"];
    const mock = await startLyriaMockServer({ failAllApprovedCalls: true });

    try {
        await assert.rejects(
            () => musicAdapter.createTask(
                MUSIC_BODY_WITH_ARTIST_REF,
                "test-bearer-token",
                { mcpUrl: mock.mcpEndpoint }
            ),
            error => {
                assert.equal(error.code, LYRIA_PROMPT_REFUSED_CODE);
                assert.equal(isLyriaPromptRefusedError(error), true);
                return true;
            }
        );
        assert.equal(mock.approvedCalls.length, 2, "retry tidak boleh berulang lebih dari sekali");
    } finally {
        await mock.close();
    }
});

test("model audio non-music TIDAK melakukan retry Lyria", () => {
    const src = read("models/opus-audio/factory.js");
    assert.match(src, /const canRetry = audioKind === "music"/);
});
