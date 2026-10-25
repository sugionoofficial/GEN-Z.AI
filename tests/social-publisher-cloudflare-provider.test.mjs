import test from "node:test";
import assert from "node:assert/strict";
import {
    generateSocialContextCaption,
    generateSocialImage,
    generateSocialQuoteImage,
    testCloudflareImageProvider
} from "../lib/social-publisher/providers.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const JPEG_BASE64 = Buffer.from(JPEG_BYTES).toString("base64");
const REMOTE_URL = "https://cdn.example/generated.jpg";

function createFakeAI(resolvers) {
    const calls = [];
    return {
        calls,
        AI: {
            async run(model, payload) {
                calls.push({ model, payload });
                const resolver = resolvers[model];
                if (!resolver) throw new Error(`Model ${model} tidak diharapkan dipanggil.`);
                return resolver(payload, calls.filter(call => call.model === model).length);
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

test("try-on Pruna yang mengembalikan URL presigned diunduh menjadi byte gambar", async () => {
    const { AI, calls } = createFakeAI({
        "pruna/p-image-try-on": () => ({ state: "Completed", result: { image: REMOTE_URL } })
    });
    const fetchMock = captureFetch();
    try {
        const result = await generateSocialImage({
            env: { AI },
            prompt: "Karakter di kafe",
            imageProvider: "cloudflare",
            personImageUrl: "https://storage.example/person.jpg",
            garmentImageUrls: ["https://storage.example/outfit.jpg"]
        });
        assert.equal(result.model, "pruna/p-image-try-on");
        assert.equal(result.mimeType, "image/jpeg");
        assert.equal(result.bytes.length, JPEG_BYTES.length);
        assert.deepEqual(fetchMock.calls, [REMOTE_URL]);
        assert.equal(calls[0].payload.person_image, "https://storage.example/person.jpg");
        assert.deepEqual(calls[0].payload.garment_images, ["https://storage.example/outfit.jpg"]);
        assert.deepEqual(result.warnings, []);
    } finally {
        fetchMock.restore();
    }
});

test("try-on yang butuh kredit AI Gateway turun ke SDXL img2img memakai foto referensi", async () => {
    const { AI, calls } = createFakeAI({
        "pruna/p-image-try-on": () => {
            throw new Error("Third-party model requires AI Gateway unified billing credits");
        },
        "pruna/ai-fallback": () => {
            throw new Error("tidak dipakai");
        },
        "@cf/stabilityai/stable-diffusion-xl-base-1.0": () => ({ image: JPEG_BASE64 })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter berjalan di pasar pagi",
        imageProvider: "cloudflare",
        aspectRatio: "9:16",
        referenceBytes: JPEG_BYTES,
        referenceMimeType: "image/jpeg",
        personImageUrl: "https://storage.example/person.jpg",
        garmentImageUrls: ["https://storage.example/outfit.jpg"]
    });

    assert.equal(result.model, "@cf/stabilityai/stable-diffusion-xl-base-1.0");
    assert.equal(result.bytes.length, JPEG_BYTES.length);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /Try-on Pruna dilewati/);
    assert.match(result.warnings[0], /Unified Billing/);

    const img2imgPayload = calls.find(call => call.model === "@cf/stabilityai/stable-diffusion-xl-base-1.0").payload;
    assert.equal(img2imgPayload.width, 576);
    assert.equal(img2imgPayload.height, 1024);
    assert.match(img2imgPayload.prompt, /pasar pagi/);
    assert.equal(img2imgPayload.image_b64, JPEG_BASE64, "image_b64 dikirim sebagai base64 polos");
    assert.equal(img2imgPayload.strength, 0.62);
});

test("tanpa foto referensi Cloudflare memakai FLUX schnell dengan parameter yang benar", async () => {
    const { AI, calls } = createFakeAI({
        "@cf/black-forest-labs/flux-1-schnell": () => ({ image: JPEG_BASE64 })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter melambaikan tangan di pantai",
        imageProvider: "cloudflare",
        aspectRatio: "16:9"
    });

    assert.equal(result.model, "@cf/black-forest-labs/flux-1-schnell");
    const payload = calls[0].payload;
    assert.equal(payload.steps, 4);
    assert.equal(payload.num_steps, undefined, "FLUX tidak menerima num_steps");
    assert.equal(payload.width, undefined, "FLUX menentukan ukuran sendiri");
    assert.match(payload.prompt, /16:9/);
});

test("semua model Cloudflare gagal menghasilkan pesan error yang menjelaskan penyebab", async () => {
    const { AI } = createFakeAI({
        "pruna/p-image-try-on": () => {
            throw new Error("pruna/p-image-try-on requires the Workers Paid plan");
        },
        "@cf/black-forest-labs/flux-1-schnell": () => {
            throw new Error("Account limited: out of neurons");
        },
        "@cf/stabilityai/stable-diffusion-xl-base-1.0": () => {
            throw new Error("Account limited: out of neurons");
        }
    });
    await assert.rejects(
        () => generateSocialImage({
            env: { AI },
            prompt: "Karakter di taman",
            imageProvider: "cloudflare",
            personImageUrl: "https://storage.example/person.jpg",
            garmentImageUrls: ["https://storage.example/outfit.jpg"]
        }),
        error => {
            assert.equal(error.status, 429, "kuota Neuron habis dipetakan ke 429");
            assert.match(error.message, /Cloudflare Workers AI tidak dapat membuat gambar/);
            assert.match(error.message, /neurons/i);
            assert.equal(error.warnings.length, 2);
            return true;
        }
    );
});

test("binding AI yang belum terpasang ditolak jelas", async () => {
    await assert.rejects(
        () => generateSocialImage({ env: {}, prompt: "x", imageProvider: "cloudflare" }),
        error => {
            assert.equal(error.status, 503);
            assert.match(error.message, /binding belum dikonfigurasi/);
            return true;
        }
    );
});

test("caption Cloudflare turun ke model teks lalu dilewati tanpa menggagalkan unggahan", async () => {
    const { AI, calls } = createFakeAI({
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
    assert.equal(calls.length, 2);

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

test("Kata-kata Mutiara Cloudflare memakai FLUX + steps lalu SDXL dengan ukuran 9:16", async () => {
    const flux = createFakeAI({
        "@cf/black-forest-labs/flux-1-schnell": () => ({ image: JPEG_BASE64 })
    });
    const first = await generateSocialQuoteImage({
        env: { AI: flux.AI },
        prompt: "latar abstrak gelap",
        aspectRatio: "9:16",
        imageProvider: "cloudflare"
    });
    assert.equal(first.model, "@cf/black-forest-labs/flux-1-schnell");
    assert.equal(flux.calls[0].payload.steps, 4);
    assert.equal(flux.calls[0].payload.num_steps, undefined);
    assert.equal(flux.calls[0].payload.width, undefined);

    const fallback = createFakeAI({
        "@cf/black-forest-labs/flux-1-schnell": () => {
            throw new Error("No such model");
        },
        "@cf/stabilityai/stable-diffusion-xl-base-1.0": () => ({ image: JPEG_BASE64 })
    });
    const second = await generateSocialQuoteImage({
        env: { AI: fallback.AI },
        prompt: "latar abstrak gelap",
        aspectRatio: "16:9",
        imageProvider: "cloudflare"
    });
    assert.equal(second.model, "@cf/stabilityai/stable-diffusion-xl-base-1.0");
    const sdxlPayload = fallback.calls[1].payload;
    assert.equal(sdxlPayload.width, 1024);
    assert.equal(sdxlPayload.height, 576);
    assert.equal(sdxlPayload.num_steps, 8);
});

test("tes provider melaporkan status per model tanpa menggagalkan seluruh tes", async () => {
    const { AI } = createFakeAI({
        "@cf/black-forest-labs/flux-1-schnell": () => ({ image: JPEG_BASE64 }),
        "@cf/stabilityai/stable-diffusion-xl-base-1.0": () => {
            throw new Error("Account limited: out of neurons");
        },
        "pruna/p-image-try-on": () => {
            throw new Error("Third-party models require AI Gateway unified billing credits");
        }
    });
    const result = await testCloudflareImageProvider({ env: { AI }, includeTryOn: true });
    assert.equal(result.binding_ready, true);
    assert.equal(result.free_tier_ready, true);
    assert.equal(result.try_on_ready, false);
    assert.equal(result.checks.length, 3);
    assert.equal(result.checks[0].ok, true);
    assert.equal(result.checks[1].ok, false);
    assert.match(result.checks[1].error, /Neuron/i);
    assert.match(result.checks[2].error, /Unified Billing/);
});
