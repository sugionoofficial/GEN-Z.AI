import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import {
    generateSocialContextCaption,
    generateSocialImage,
    generateSocialQuoteImage,
    testCloudflareImageProvider
} from "../lib/social-publisher/providers.js";
import {
    prepareReferenceImage,
    readImageDimensions,
    detectImageKind
} from "../lib/social-publisher/reference-image.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const JPEG_BASE64 = Buffer.from(JPEG_BYTES).toString("base64");
const REMOTE_URL = "https://cdn.example/generated.jpg";

const IDENTITY_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const IMG2IMG_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const TRYON_MODEL = "pruna/p-image-try-on";
const FLUX_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function makeReference({ width = 900, height = 1200 } = {}) {
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        data[index * 4] = index % 255;
        data[index * 4 + 1] = (index * 3) % 255;
        data[index * 4 + 2] = (index * 7) % 255;
        data[index * 4 + 3] = 255;
    }
    return new Uint8Array(jpeg.encode({ data, width, height }, 80).data);
}

async function readMultipartBody(payload) {
    assert.ok(payload?.multipart?.body, "payload multipart wajib ada");
    assert.match(String(payload.multipart.contentType), /multipart\/form-data; boundary=/);
    const text = await new Response(payload.multipart.body).text();
    return { text, contentType: payload.multipart.contentType };
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

function captureFetch(bytes = JPEG_BYTES) {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        calls.push(String(input));
        return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });
    };
    return {
        calls,
        restore() {
            globalThis.fetch = originalFetch;
        }
    };
}

test("foto referensi besar diperkecil ke maksimal 512 px sebagai JPEG", () => {
    const bytes = makeReference({ width: 900, height: 1200 });
    assert.equal(detectImageKind(bytes), "jpeg");
    assert.deepEqual(readImageDimensions(bytes), { width: 900, height: 1200 });

    const prepared = prepareReferenceImage(bytes, "image/jpeg");
    assert.equal(prepared.resized, true);
    assert.equal(prepared.mimeType, "image/jpeg");
    assert.equal(Math.max(prepared.width, prepared.height), 512);
    assert.deepEqual(readImageDimensions(prepared.bytes), { width: prepared.width, height: prepared.height });
    assert.ok(prepared.bytes.length < bytes.length);
});

test("foto referensi yang sudah kecil dipakai apa adanya", () => {
    const bytes = makeReference({ width: 320, height: 400 });
    const prepared = prepareReferenceImage(bytes, "image/jpeg");
    assert.equal(prepared.resized, false);
    assert.equal(prepared.bytes, bytes);
    assert.equal(prepared.width, 320);
});

test("PNG besar dikonversi ke JPEG <=512 px, WebP hanya dilaporkan", () => {
    const png = new PNG({ width: 800, height: 600 });
    png.data.fill(180);
    const pngBytes = new Uint8Array(PNG.sync.write(png));
    assert.equal(detectImageKind(pngBytes), "png");
    const prepared = prepareReferenceImage(pngBytes, "image/png");
    assert.equal(prepared.resized, true);
    assert.equal(prepared.mimeType, "image/jpeg");
    assert.equal(Math.max(prepared.width, prepared.height), 512);

    const webp = new Uint8Array(40);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    webp.set([0x56, 0x50, 0x38, 0x58], 12);
    /* VP8X menyimpan lebar/tinggi minus satu (1000x800) di byte 24..29. */
    webp.set([0xe7, 0x03, 0x00, 0x1f, 0x03, 0x00], 24);
    const webpPrepared = prepareReferenceImage(webp, "image/webp");
    assert.equal(webpPrepared.resized, false);
    assert.match(webpPrepared.note, /WEBP/i);
});

test("FLUX.2 klein dipakai lebih dulu dengan input_image_0 dari foto referensi", async () => {
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter berjalan di pasar pagi",
        imageProvider: "cloudflare",
        aspectRatio: "9:16",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg",
        personImageUrl: "https://storage.example/person.jpg",
        garmentImageUrls: ["https://storage.example/outfit.jpg"],
        garmentBytes: makeReference({ width: 600, height: 600 }),
        garmentMimeType: "image/jpeg"
    });

    assert.equal(result.model, IDENTITY_MODEL);
    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(calls.length, 1, "model ber-referensi pertama dipakai tanpa mencoba yang lain");
    const { text } = await readMultipartBody(calls[0].payload);
    assert.match(text, /name="input_image_0"/);
    assert.match(text, /name="input_image_1"/);
    assert.match(text, /SAMA PERSIS/);
    assert.match(text, /pasar pagi/);
    assert.match(text, /name="width"\r\n\r\n576/);
    assert.match(text, /name="height"\r\n\r\n1024/);
    assert.deepEqual(result.warnings, []);
});

test("tanpa foto pakaian FLUX.2 klein tetap memakai foto referensi karakter saja", async () => {
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter di kafe",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    assert.equal(result.model, IDENTITY_MODEL);
    const { text } = await readMultipartBody(calls[0].payload);
    assert.match(text, /name="input_image_0"/);
    assert.doesNotMatch(text, /name="input_image_1"/);
    assert.match(text, /Pakaian tetap seperti pada gambar 1/);
});

test("FLUX.2 klein gagal -> try-on Pruna -> SDXL img2img, identitas tetap dijaga", async () => {
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [TRYON_MODEL]: () => ({ state: "Completed", result: { image: REMOTE_URL } }),
        [IMG2IMG_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const fetchMock = captureFetch();
    try {
        const result = await generateSocialImage({
            env: { AI },
            prompt: "Karakter di pantai",
            imageProvider: "cloudflare",
            referenceBytes: makeReference(),
            referenceMimeType: "image/jpeg",
            personImageUrl: "https://storage.example/person.jpg",
            garmentImageUrls: ["https://storage.example/outfit.jpg"]
        });
        assert.equal(result.model, TRYON_MODEL);
        assert.equal(result.bytes.length, JPEG_BYTES.length);
        assert.deepEqual(calls.map(call => call.model), [IDENTITY_MODEL, TRYON_MODEL]);
        assert.match(result.warnings[0], /FLUX.2 klein .* gagal/);
    } finally {
        fetchMock.restore();
    }

    const fallback = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Input image must be smaller than 512x512");
        },
        [TRYON_MODEL]: () => {
            throw new Error("Third-party model requires AI Gateway unified billing credits");
        },
        [IMG2IMG_MODEL]: () => new Uint8Array([0xff, 0xd8, 0xff, 0x01])
    });
    const second = await generateSocialImage({
        env: { AI: fallback.AI },
        prompt: "Karakter di pantai",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg",
        personImageUrl: "https://storage.example/person.jpg",
        garmentImageUrls: ["https://storage.example/outfit.jpg"]
    });
    assert.equal(second.model, IMG2IMG_MODEL);
    const img2imgPayload = fallback.calls.find(call => call.model === IMG2IMG_MODEL).payload;
    assert.equal(img2imgPayload.strength, 0.45);
    assert.equal(img2imgPayload.width, 576);
    assert.equal(img2imgPayload.height, 1024);
    assert.equal(second.warnings.length, 2);
});

test("semua model ber-referensi gagal -> error jelas, tanpa gambar teks-ke-gambar", async () => {
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [TRYON_MODEL]: () => {
            throw new Error("Third-party model requires AI Gateway unified billing credits");
        },
        [IMG2IMG_MODEL]: () => {
            throw new Error("input tensor image is not present in the model");
        }
    });
    await assert.rejects(
        () => generateSocialImage({
            env: { AI },
            prompt: "Karakter di taman",
            imageProvider: "cloudflare",
            referenceBytes: makeReference(),
            referenceMimeType: "image/jpeg",
            personImageUrl: "https://storage.example/person.jpg",
            garmentImageUrls: ["https://storage.example/outfit.jpg"]
        }),
        error => {
            assert.equal(error.status, 429);
            assert.match(error.message, /Karakter konsisten tidak dapat dibuat/);
            assert.equal(error.warnings.length, 3);
            return true;
        }
    );
    assert.equal(calls.some(call => call.model === FLUX_MODEL), false, "tidak boleh jatuh ke text-to-image");
});

test("foto referensi wajib ada agar wajah karakter konsisten", async () => {
    const { AI, calls } = createFakeAI({});
    await assert.rejects(
        () => generateSocialImage({
            env: { AI },
            prompt: "Karakter di taman",
            imageProvider: "cloudflare",
            personImageUrl: "https://storage.example/person.jpg",
            garmentImageUrls: ["https://storage.example/outfit.jpg"]
        }),
        error => {
            assert.equal(error.status, 400);
            assert.match(error.message, /Foto referensi karakter wajib/);
            return true;
        }
    );
    assert.equal(calls.length, 0);
});

test("binding AI yang belum terpasang ditolak jelas", async () => {
    await assert.rejects(
        () => generateSocialImage({
            env: {},
            prompt: "x",
            imageProvider: "cloudflare",
            referenceBytes: makeReference()
        }),
        error => {
            assert.equal(error.status, 503);
            assert.match(error.message, /binding belum dikonfigurasi/);
            return true;
        }
    );
});

test("caption Cloudflare turun ke model teks lalu dilewati tanpa menggagalkan unggahan", async () => {
    const { AI } = createFakeAI({
        "@cf/meta/llama-3.2-11b-vision-instruct": () => {
            throw new Error("No such model");
        },
        "@cf/meta/llama-3.1-8b-instruct-fp8": () => ({ response: "Hai guys, pagi cerah di pasar!" })
    });
    const caption = await generateSocialContextCaption({
        env: { AI },
        imageBytes: JPEG_BYTES,
        imageMimeType: "image/jpeg",
        characterName: "Rani",
        scene: { location: "pasar" },
        imageProvider: "cloudflare"
    });
    assert.equal(caption, "Hai guys, pagi cerah di pasar!");

    const failing = createFakeAI({
        "@cf/meta/llama-3.2-11b-vision-instruct": () => {
            throw new Error("No such model");
        },
        "@cf/meta/llama-3.1-8b-instruct-fp8": () => {
            throw new Error("No such model");
        }
    });
    const empty = await generateSocialContextCaption({
        env: { AI: failing.AI },
        imageBytes: JPEG_BYTES,
        imageMimeType: "image/jpeg",
        characterName: "Rani",
        scene: {},
        imageProvider: "cloudflare"
    });
    assert.equal(empty, "");
});

test("latar Kata-kata Mutiara tetap memakai FLUX lalu SDXL sesuai rasio", async () => {
    const flux = createFakeAI({
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const first = await generateSocialQuoteImage({
        env: { AI: flux.AI },
        prompt: "latar abstrak gelap",
        aspectRatio: "9:16",
        imageProvider: "cloudflare"
    });
    assert.equal(first.model, FLUX_MODEL);
    assert.equal(flux.calls[0].payload.steps, 4);
    assert.equal(flux.calls[0].payload.num_steps, undefined);

    const fallback = createFakeAI({
        [FLUX_MODEL]: () => {
            throw new Error("No such model");
        },
        [IMG2IMG_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const second = await generateSocialQuoteImage({
        env: { AI: fallback.AI },
        prompt: "latar abstrak gelap",
        aspectRatio: "16:9",
        imageProvider: "cloudflare"
    });
    assert.equal(second.model, IMG2IMG_MODEL);
    assert.equal(fallback.calls[1].payload.width, 1024);
    assert.equal(fallback.calls[1].payload.height, 576);
});

test("tes provider melaporkan jalur identitas, gratis, dan try-on per model", async () => {
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IMG2IMG_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [TRYON_MODEL]: () => {
            throw new Error("Third-party models require AI Gateway unified billing credits");
        }
    });
    const result = await testCloudflareImageProvider({ env: { AI }, includeTryOn: true });
    assert.equal(result.binding_ready, true);
    assert.equal(result.identity_ready, true);
    assert.equal(result.free_tier_ready, true);
    assert.equal(result.try_on_ready, false);
    assert.equal(result.checks.length, 4);
    assert.equal(result.checks[0].model, IDENTITY_MODEL);
    assert.equal(result.checks[0].ok, true);
    assert.match(result.checks[3].error, /Unified Billing/);
});

test("tes provider tetap melaporkan hasil walau model identitas tidak tersedia", async () => {
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("No such model");
        },
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IMG2IMG_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await testCloudflareImageProvider({ env: { AI } });
    assert.equal(result.identity_ready, false);
    assert.equal(result.free_tier_ready, true);
    assert.match(result.checks[0].error, /tidak tersedia/);
});
