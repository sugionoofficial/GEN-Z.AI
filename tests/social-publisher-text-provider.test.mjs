import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

import {
    generateSocialContextCaption,
    generateSocialQuote,
    normalizeTextProvider,
    resolveTextProvider,
    TEXT_PROVIDERS
} from "../lib/social-publisher/providers.js";

const API_SOURCE = readFileSync(fileURLToPath(new URL("../api/social-publisher.js", import.meta.url)), "utf8");
const CRON_SOURCE = readFileSync(
    fileURLToPath(new URL("../functions/_shared/social-publisher-cron.js", import.meta.url)),
    "utf8"
);
const MIGRATION = readFileSync(
    fileURLToPath(new URL("../supabase/social-auto-publisher.sql", import.meta.url)),
    "utf8"
);
const ADMIN_HTML = readFileSync(
    fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
    "utf8"
);
const ADMIN_JS = readFileSync(
    fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
    "utf8"
);

function photo({ width = 320, height = 480 } = {}) {
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        data[index * 4] = index % 255;
        data[index * 4 + 1] = (index * 7) % 255;
        data[index * 4 + 2] = (index * 13) % 255;
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

test("normalizeTextProvider hanya menerima pilihan yang dikenal", () => {
    assert.deepEqual(TEXT_PROVIDERS, ["auto", "tencent", "cloudflare", "gemini", "qwencloud"]);
    assert.equal(normalizeTextProvider("tencent"), "tencent");
    assert.equal(normalizeTextProvider(" CLOUDFLARE "), "cloudflare");
    assert.equal(normalizeTextProvider(""), "auto");
    assert.equal(normalizeTextProvider("qwen"), "auto");
    assert.equal(normalizeTextProvider(undefined), "auto");
});

test("auto memilih Tencent bila API key ada, apa pun provider gambarnya", () => {
    assert.equal(
        resolveTextProvider({ env: { TENCENT_TOKENHUB_KEY: "k" }, textProvider: "auto", imageProvider: "cloudflare" }),
        "tencent"
    );
    assert.equal(
        resolveTextProvider({ env: {}, textProvider: "auto", imageProvider: "cloudflare" }),
        "cloudflare"
    );
    /* Gemini/QwenCloud tanpa key Tencent tetap memakai provider gambarnya. */
    assert.equal(resolveTextProvider({ env: {}, textProvider: "auto", imageProvider: "gemini" }), "gemini");
    assert.equal(resolveTextProvider({ env: {}, textProvider: "auto", imageProvider: "qwencloud" }), "qwencloud");
});

test("auto dengan provider gambar Tencent tanpa key tidak menurunkan caption ke Gemini", () => {
    assert.equal(resolveTextProvider({ env: {}, textProvider: "auto", imageProvider: "tencent" }), "tencent");
});

test("pilihan eksplisit menang atas provider gambar", () => {
    assert.equal(
        resolveTextProvider({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            textProvider: "cloudflare",
            imageProvider: "tencent"
        }),
        "cloudflare"
    );
});

test("gambar Cloudflare (gratis) + tulisan Tencent (gratis) bisa dipakai bersamaan", async () => {
    const { calls, restore } = mockFetch(async () => Response.json({
        choices: [{ message: { content: "Hai guys, jaket denim ini pas buat sore ini." } }],
        request_id: "req-1"
    }));
    try {
        const caption = await generateSocialContextCaption({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            imageBytes: photo(),
            imageMimeType: "image/jpeg",
            characterName: "Nadia",
            scene: { place: "kafe" },
            imageProvider: "cloudflare",
            textProvider: "auto"
        });
        assert.match(caption, /jaket denim/);
        assert.equal(calls.length, 1, "hanya panggilan Tencent yang terjadi");
        assert.equal(calls[0].url, "https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions");
        assert.equal(JSON.parse(calls[0].options.body).model, "deepseek-v4.1-flash");
    } finally {
        restore();
    }
});

test("provider teks cloudflare dipakai walau gambar dari Tencent", async () => {
    const { calls, restore } = mockFetch(async () => {
        throw new Error("Tencent tidak boleh dipanggil");
    });
    const { AI } = createFakeAI({
        "@cf/meta/llama-3.2-11b-vision-instruct": () => ({ response: "Hai guys, caption Cloudflare." })
    });
    try {
        const caption = await generateSocialContextCaption({
            env: { TENCENT_TOKENHUB_KEY: "k", AI },
            imageBytes: photo(),
            imageMimeType: "image/jpeg",
            characterName: "Nadia",
            scene: {},
            imageProvider: "tencent",
            textProvider: "cloudflare"
        });
        assert.equal(caption, "Hai guys, caption Cloudflare.");
        assert.equal(calls.length, 0, "request HTTP ke Tencent tidak terjadi");
    } finally {
        restore();
    }
});

test("kata-kata mutiara: gambar Cloudflare, teks Tencent hy3", async () => {
    const { calls, restore } = mockFetch(async () => Response.json({
        choices: [{ message: { content: "QUOTE: Yang kecil yang konsisten mengalahkan yang besar yang menunda." } }]
    }));
    try {
        const result = await generateSocialQuote({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            quotePlan: { themeLabel: "Konsistensi" },
            recentQuotes: [],
            imageProvider: "cloudflare",
            textProvider: "auto"
        });
        assert.match(result.quoteText, /konsisten/i);
        assert.equal(result.model, "hy3");
        assert.equal(JSON.parse(calls[0].options.body).model, "hy3");
    } finally {
        restore();
    }
});

test("pilihan teks tencent tanpa key memberi error 503 yang menyebut secretnya", async () => {
    await assert.rejects(
        generateSocialQuote({
            env: {},
            quotePlan: {},
            recentQuotes: [],
            imageProvider: "cloudflare",
            textProvider: "tencent"
        }),
        error => {
            assert.equal(error.status, 503);
            assert.match(error.message, /TENCENT_TOKENHUB_KEY/);
            return true;
        }
    );
});

test("migrasi menyediakan kolom text_provider dan mengizinkan provider tencent", () => {
    assert.match(MIGRATION, /add column if not exists text_provider text not null default 'auto'/);
    assert.match(MIGRATION, /social_publisher_config_text_provider_check/);
    assert.match(MIGRATION, /check \(image_provider in \('gemini', 'cloudflare', 'qwencloud', 'tencent', 'puter'\)\)/);
    assert.match(MIGRATION, /check \(text_provider in \('auto', 'tencent', 'cloudflare', 'gemini', 'qwencloud'\)\)/);
});

test("API membaca, menyimpan, dan melaporkan text_provider", () => {
    assert.match(API_SOURCE, /select=image_provider,image_model,text_provider,quote_llm_model/);
    assert.match(API_SOURCE, /textProvider: normalizeTextProvider\(rows\?\.\[0\]\?\.text_provider\)/);
    assert.match(API_SOURCE, /text_provider: requestedTextProvider/);
    assert.match(API_SOURCE, /text_provider_saved: rows\[0\]\.text_provider_saved !== false/);
    assert.match(API_SOURCE, /textProvider/);
    assert.match(API_SOURCE, /normalizeTextProvider\(body\.text_provider\)/);
});

test("API tetap menyimpan provider gambar walau kolom text_provider belum ada", () => {
    assert.match(API_SOURCE, /if \(\/text_provider\/i\.test\(String\(err\?\.message/);
    assert.match(API_SOURCE, /const \{ text_provider: _ignored, \.\.\.withoutTextProvider \} = basePayload;/);
});

test("cron autopost memakai provider teks dari konfigurasi", () => {
    assert.match(CRON_SOURCE, /select=image_provider,image_model,text_provider,quote_llm_model/);
    assert.match(CRON_SOURCE, /const textProvider = normalizeTextProvider\(publisherConfigs\?\.\[0\]\?\.text_provider\)/);
    assert.match(CRON_SOURCE, /textProvider/);
});

test("admin punya pilihan provider teks terpisah dan mengirimnya saat menyimpan", () => {
    assert.match(ADMIN_HTML, /name="text-provider" value="auto"/);
    assert.match(ADMIN_HTML, /name="text-provider" value="tencent"/);
    assert.match(ADMIN_HTML, /name="text-provider" value="cloudflare"/);
    assert.match(ADMIN_JS, /text_provider: textChoice/);
    assert.match(ADMIN_JS, /function selectedTextProvider\(\)/);
    assert.match(ADMIN_JS, /text_provider_saved === false/);
    assert.match(ADMIN_JS, /function textProviderLabel\(value\)/);
});
