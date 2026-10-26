import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

import {
    generateTencentCaption,
    generateTencentQuoteText,
    runTencentChat,
    tencentTextKey,
    tencentTextModelFor,
    TENCENT_CAPTION_MODEL,
    TENCENT_QUOTE_MODEL,
    TENCENT_TEXT_ENDPOINT
} from "../lib/social-publisher/tencent-text.js";
import {
    generateSocialContextCaption,
    generateSocialQuote
} from "../lib/social-publisher/providers.js";

function photo({ width = 320, height = 480 } = {}) {
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        data[index * 4] = index % 255;
        data[index * 4 + 1] = (index * 5) % 255;
        data[index * 4 + 2] = (index * 11) % 255;
        data[index * 4 + 3] = 255;
    }
    return new Uint8Array(jpeg.encode({ data, width, height }, 80).data);
}

function mockFetch(handler) {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input, options = {}) => {
        calls.push({ url: String(input), options });
        return handler(String(input), options);
    };
    return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

function chatReply(content) {
    return Response.json({
        id: "chat-1",
        choices: [{ index: 0, message: { role: "assistant", content } }],
        usage: { total_tokens: 120 },
        request_id: "req-text"
    });
}

function createFakeAI(resolvers) {
    const calls = [];
    return {
        calls,
        AI: {
            async run(model, payload) {
                calls.push({ model, payload });
                const resolver = resolvers[model];
                if (!resolver) throw new Error(`Model ${model} tidak diharapkan dipanggil.`);
                return resolver(payload);
            }
        }
    };
}

test("key TokenHub yang sama dipakai untuk gambar dan teks", () => {
    assert.equal(tencentTextKey({ TENCENT_TOKENHUB_KEY: "k" }), "k");
    assert.equal(tencentTextKey({ TENCENT_API_KEY: "k2" }), "k2");
    assert.equal(tencentTextKey({}), "");
});

test("model default: vision untuk caption, Hy3 untuk kata-kata mutiara", () => {
    assert.equal(tencentTextModelFor("caption", {}), TENCENT_CAPTION_MODEL);
    assert.equal(tencentTextModelFor("quote", {}), TENCENT_QUOTE_MODEL);
    assert.equal(TENCENT_CAPTION_MODEL, "deepseek-v4.1-flash");
    assert.equal(TENCENT_QUOTE_MODEL, "hy3");
    assert.equal(
        tencentTextModelFor("caption", { TENCENT_CAPTION_MODEL: "deepseek-v4-flash-vision-exp" }),
        "deepseek-v4-flash-vision-exp"
    );
    assert.equal(tencentTextModelFor("quote", { TENCENT_QUOTE_MODEL: "hy4-preview" }), "hy4-preview");
});

test("caption mengirim gambar sebagai data URL ke model vision", async () => {
    const { calls, restore } = mockFetch(async () => chatReply("Hai guys, sore ini jalan santai di taman kota."));
    try {
        const result = await generateTencentCaption({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            imageBytes: photo(),
            imageMimeType: "image/jpeg",
            characterName: "Nadia",
            scene: { place: "taman kota" }
        });
        assert.equal(calls[0].url, TENCENT_TEXT_ENDPOINT);
        assert.equal(calls[0].options.headers.Authorization, "Bearer k");
        const body = JSON.parse(calls[0].options.body);
        assert.equal(body.model, "deepseek-v4.1-flash");
        assert.equal(body.stream, false);
        const parts = body.messages[0].content;
        assert.equal(parts[0].type, "text");
        assert.match(parts[0].text, /Hai guys/);
        assert.equal(parts[1].type, "image_url");
        assert.match(parts[1].image_url.url, /^data:image\/jpeg;base64,/);
        assert.match(result.text, /Hai guys/);
        assert.equal(result.model, "deepseek-v4.1-flash");
    } finally {
        restore();
    }
});

test("kata-kata mutiara memakai model teks dan mematuhi format QUOTE:", async () => {
    const { calls, restore } = mockFetch(async () => chatReply("QUOTE: Pelan-pelan saja, yang penting tidak berhenti melangkah."));
    try {
        const result = await generateTencentQuoteText({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            prompt: "Buat satu kata-kata mutiara."
        });
        const body = JSON.parse(calls[0].options.body);
        assert.equal(body.model, "hy3");
        assert.equal(body.messages[0].role, "system");
        assert.match(body.messages[0].content, /kata-kata mutiara/);
        assert.match(result.text, /^QUOTE:/);
    } finally {
        restore();
    }
});

test("tanpa API key pesannya menyebut TENCENT_TOKENHUB_KEY", async () => {
    await assert.rejects(
        runTencentChat({ env: {}, model: "hy3", messages: [{ role: "user", content: "hai" }] }),
        error => {
            assert.equal(error.status, 503);
            assert.match(error.message, /TENCENT_TOKENHUB_KEY/);
            return true;
        }
    );
});

test("401/403/404 dijelaskan sesuai penyebabnya, bukan pesan generik", async () => {
    const cases = [
        { status: 401, expect: /API key TokenHub/ },
        { status: 403, expect: /New User Free Trial/ },
        { status: 404, expect: /TENCENT_CAPTION_MODEL \/ TENCENT_QUOTE_MODEL/ }
    ];
    for (const item of cases) {
        const { restore } = mockFetch(async () => Response.json(
            { error: { message: "provider says no" }, request_id: "req-x" },
            { status: item.status }
        ));
        try {
            await assert.rejects(
                runTencentChat({ env: { TENCENT_TOKENHUB_KEY: "k" }, model: "hy3", messages: [] }),
                error => {
                    assert.equal(error.status, item.status);
                    assert.match(error.message, item.expect);
                    assert.match(error.message, /req-x/);
                    return true;
                }
            );
        } finally {
            restore();
        }
    }
});

test("jawaban kosong tidak dianggap caption yang valid", async () => {
    const { restore } = mockFetch(async () => chatReply(""));
    try {
        await assert.rejects(
            runTencentChat({ env: { TENCENT_TOKENHUB_KEY: "k" }, model: "hy3", messages: [] }),
            error => {
                assert.equal(error.status, 502);
                assert.match(error.message, /tidak mengembalikan teks/);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("caption provider tencent memakai model Tencent lebih dulu", async () => {
    const { restore } = mockFetch(async () => chatReply("Hai guys, jaket denim ini cocok buat sore ini."));
    try {
        const caption = await generateSocialContextCaption({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            imageBytes: photo(),
            imageMimeType: "image/jpeg",
            characterName: "Nadia",
            scene: { place: "kafe" },
            imageProvider: "tencent"
        });
        assert.match(caption, /jaket denim/);
    } finally {
        restore();
    }
});

test("caption tencent gagal -> turun ke Cloudflare, posting tidak ikut gagal", async () => {
    const { restore } = mockFetch(async () => Response.json(
        { error: { message: "quota exhausted" } },
        { status: 403 }
    ));
    const { AI } = createFakeAI({
        "@cf/meta/llama-3.2-11b-vision-instruct": () => ({ response: "Hai guys, caption dari Cloudflare." })
    });
    try {
        const caption = await generateSocialContextCaption({
            env: { TENCENT_TOKENHUB_KEY: "k", AI },
            imageBytes: photo(),
            imageMimeType: "image/jpeg",
            characterName: "Nadia",
            scene: {},
            imageProvider: "tencent"
        });
        assert.equal(caption, "Hai guys, caption dari Cloudflare.");
    } finally {
        restore();
    }
});

test("tanpa key dan tanpa binding AI caption dikosongkan, bukan menggagalkan unggahan", async () => {
    const caption = await generateSocialContextCaption({
        env: {},
        imageBytes: photo(),
        imageMimeType: "image/jpeg",
        characterName: "Nadia",
        scene: {},
        imageProvider: "tencent"
    });
    assert.equal(caption, "");
});

test("kata-kata mutiara provider tencent memakai TokenHub dan melaporkan modelnya", async () => {
    const { restore } = mockFetch(async () => chatReply("QUOTE: Yang kecil yang konsisten mengalahkan yang besar yang menunda."));
    try {
        const result = await generateSocialQuote({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            quotePlan: { themeLabel: "Konsistensi", themeDirection: "langkah kecil" },
            recentQuotes: [],
            imageProvider: "tencent"
        });
        assert.match(result.quoteText, /konsisten/i);
        assert.equal(result.model, "hy3");
    } finally {
        restore();
    }
});

test("kata-kata mutiara tencent gagal -> turun ke model teks Cloudflare", async () => {
    const { restore } = mockFetch(async () => Response.json({ error: { message: "nope" } }, { status: 429 }));
    /* Jalur Cloudflare untuk kata-kata mutiara memakai model vision 11B. */
    const { AI } = createFakeAI({
        "@cf/meta/llama-3.2-11b-vision-instruct": () => ({
            response: "QUOTE: Tenang saja, rezeki tidak pernah salah alamat."
        })
    });
    try {
        const result = await generateSocialQuote({
            env: { TENCENT_TOKENHUB_KEY: "k", AI },
            quotePlan: { themeLabel: "Rezeki", themeDirection: "tenang" },
            recentQuotes: [],
            imageProvider: "tencent"
        });
        assert.match(result.quoteText, /rezeki/i);
        assert.equal(result.model, "@cf/meta/llama-3.2-11b-vision-instruct");
    } finally {
        restore();
    }
});

test("tanpa key dan tanpa Cloudflare, mode mutiara memberi error yang jelas", async () => {
    await assert.rejects(
        generateSocialQuote({
            env: {},
            quotePlan: {},
            recentQuotes: [],
            imageProvider: "tencent"
        }),
        error => {
            assert.equal(error.status, 503);
            assert.match(error.message, /TENCENT_TOKENHUB_KEY/);
            assert.match(error.message, /hanya membuat gambar/);
            return true;
        }
    );
});

test("timeout dilaporkan sebagai 504, bukan menggantung", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
    };
    try {
        await assert.rejects(
            runTencentChat({ env: { TENCENT_TOKENHUB_KEY: "k" }, model: "hy3", messages: [] }),
            error => {
                assert.equal(error.status, 504);
                assert.match(error.message, /tidak menjawab/);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("dokumentasi dan admin menyebut kuota teks gratis dipakai untuk caption/mutiara", () => {
    const read = path => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
    const docs = read("SOCIAL-PUBLISHER-SETUP.md");
    const html = read("admin-control/studio-medsos-set.html");
    assert.match(docs, /TENCENT_CAPTION_MODEL/);
    assert.match(docs, /deepseek-v4\.1-flash/);
    assert.match(docs, /1 million tokens|1 juta token/i);
    assert.match(html, /model teks TokenHub/i);
});
