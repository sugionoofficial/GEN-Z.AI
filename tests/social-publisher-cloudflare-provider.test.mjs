import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import {
    generateSocialContextCaption,
    generateSocialImage,
    generateSocialQuoteImage,
    resetCloudflareIdentityFallbackCooldown,
    resetCloudflareTryOnCooldown,
    testCloudflareImageProvider
} from "../lib/social-publisher/providers.js";
import {
    prepareReferenceImage,
    readImageDimensions,
    detectImageKind,
    inspectImageContent,
    isBlankImage
} from "../lib/social-publisher/reference-image.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const JPEG_BASE64 = Buffer.from(JPEG_BYTES).toString("base64");
const REMOTE_URL = "https://cdn.example/generated.jpg";

const IDENTITY_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const IDENTITY_FALLBACK_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
const SDXL_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
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
    /*
     * Kata "realistis" saja tidak cukup: klein 4B menghasilkan kulit plastik
     * bila prompt tidak memuat istilah fotografi.
     */
    assert.match(text, /lensa 50mm/);
    assert.match(text, /detail kulit natural/);
    assert.match(text, /render 3D, CGI/);
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

test("FLUX.2 klein 4B gagal -> try-on Pruna, identitas tetap dijaga", async () => {
    resetCloudflareTryOnCooldown();
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [TRYON_MODEL]: () => ({ state: "Completed", result: { image: REMOTE_URL } })
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
        /* 4B gagal -> 9B juga gagal (fake) -> try-on Pruna berhasil. */
        assert.deepEqual(calls.map(call => call.model), [IDENTITY_MODEL, IDENTITY_FALLBACK_MODEL, TRYON_MODEL]);
        assert.match(result.warnings[0], /FLUX\.2 klein 4B gagal/);
    } finally {
        fetchMock.restore();
    }
});

test("SDXL tidak pernah dipakai sebagai cadangan identitas karena menolak input gambar", async () => {
    resetCloudflareTryOnCooldown();
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [IDENTITY_FALLBACK_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [SDXL_MODEL]: () => {
            throw new Error("3030: Model input is not valid: input tensor `image` is not present in the model");
        }
    });
    await assert.rejects(
        () => generateSocialImage({
            env: { AI },
            prompt: "Karakter di pasar",
            imageProvider: "cloudflare",
            referenceBytes: makeReference(),
            referenceMimeType: "image/jpeg"
        }),
        error => {
            assert.match(error.message, /Karakter konsisten tidak dapat dibuat/);
            return true;
        }
    );
    assert.deepEqual(calls.map(call => call.model), [IDENTITY_MODEL, IDENTITY_FALLBACK_MODEL]);
});

test("FLUX.2 klein 4B gagal kapasitas (setelah 1 retry) -> 9B dipakai dengan multipart yang sama", async () => {
    resetCloudflareIdentityFallbackCooldown();
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("3040: Out of capacity");
        },
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter di stasiun",
        imageProvider: "cloudflare",
        aspectRatio: "16:9",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg",
        garmentBytes: makeReference({ width: 400, height: 400 }),
        garmentMimeType: "image/jpeg"
    });
    assert.equal(result.model, IDENTITY_FALLBACK_MODEL);
    /* 4B dicoba dua kali (retry untuk 3040), lalu 9B. */
    assert.deepEqual(calls.map(call => call.model), [IDENTITY_MODEL, IDENTITY_MODEL, IDENTITY_FALLBACK_MODEL]);
    const { text } = await readMultipartBody(calls[2].payload);
    assert.match(text, /name="input_image_0"/);
    assert.match(text, /name="input_image_1"/);
    assert.match(text, /name="width"\r\n\r\n1024/);
    assert.match(text, /name="height"\r\n\r\n576/);
    assert.match(result.warnings[0], /4B gagal/);
});

test("semua model ber-referensi gagal -> error jelas, tanpa gambar teks-ke-gambar", async () => {
    resetCloudflareTryOnCooldown();
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [TRYON_MODEL]: () => {
            throw new Error("Third-party model requires AI Gateway unified billing credits");
        },
        [IDENTITY_FALLBACK_MODEL]: () => {
            throw new Error("3040: Out of capacity");
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
            assert.ok(error.warnings.length >= 3);
            assert.ok(error.warnings.some(item => /Try-on Pruna dinonaktifkan 6 jam/.test(item)));
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
        [SDXL_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const second = await generateSocialQuoteImage({
        env: { AI: fallback.AI },
        prompt: "latar abstrak gelap",
        aspectRatio: "16:9",
        imageProvider: "cloudflare"
    });
    assert.equal(second.model, SDXL_MODEL);
    assert.equal(fallback.calls[1].payload.width, 1024);
    assert.equal(fallback.calls[1].payload.height, 576);
});

test("tes provider melaporkan jalur identitas, cadangan, dan try-on per model", async () => {
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [SDXL_MODEL]: () => ({ image: JPEG_BASE64 }),
        [TRYON_MODEL]: () => {
            throw new Error("Third-party models require AI Gateway unified billing credits");
        }
    });
    const result = await testCloudflareImageProvider({ env: { AI }, includeTryOn: true });
    assert.equal(result.binding_ready, true);
    assert.equal(result.identity_ready, true);
    assert.equal(result.identity_fallback_ready, true);
    assert.equal(result.identity_chain_ready, true);
    assert.equal(result.free_tier_ready, true);
    assert.equal(result.try_on_ready, false);
    assert.equal(result.checks.length, 5);
    assert.deepEqual(result.checks.map(check => check.id), ["identity", "identity9b", "t2i", "sdxl", "tryon"]);
    assert.match(result.checks[4].error, /Unified Billing/);
});

test("tes provider tetap melaporkan hasil walau model identitas tidak tersedia", async () => {
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("No such model");
        },
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [SDXL_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await testCloudflareImageProvider({ env: { AI } });
    assert.equal(result.identity_ready, false);
    assert.equal(result.identity_fallback_ready, true);
    assert.equal(result.identity_chain_ready, true);
    assert.equal(result.free_tier_ready, true);
    assert.match(result.checks[0].error, /tidak tersedia/);
});

test("try-on yang kehabisan kredit AI Gateway tidak dicoba lagi pada pembuatan berikutnya", async () => {
    resetCloudflareTryOnCooldown();
    const first = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [IDENTITY_FALLBACK_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [TRYON_MODEL]: () => {
            throw new Error("2021: Insufficient AI Gateway credits");
        }
    });
    const firstError = await generateSocialImage({
        env: { AI: first.AI },
        prompt: "Karakter di pasar",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg",
        personImageUrl: "https://storage.example/person.jpg",
        garmentImageUrls: ["https://storage.example/outfit.jpg"]
    }).then(() => null, error => error);

    assert.ok(firstError, "semua model gagal, jadi run harus gagal");
    assert.ok(firstError.warnings.some(item => /Try-on Pruna dinonaktifkan 6 jam/.test(item)));
    assert.deepEqual(first.calls.map(call => call.model), [IDENTITY_MODEL, IDENTITY_FALLBACK_MODEL, TRYON_MODEL]);

    /* Percobaan kedua: Pruna harus dilewati total walaupun identitas 4B masih gagal. */
    const second = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("Account limited: out of neurons");
        },
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
        [TRYON_MODEL]: () => {
            throw new Error("tidak boleh dipanggil");
        }
    });
    const secondRun = await generateSocialImage({
        env: { AI: second.AI },
        prompt: "Karakter di pantai",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg",
        personImageUrl: "https://storage.example/person.jpg",
        garmentImageUrls: ["https://storage.example/outfit.jpg"]
    });
    assert.equal(secondRun.model, IDENTITY_FALLBACK_MODEL);
    assert.equal(second.calls.some(call => call.model === TRYON_MODEL), false);
    assert.ok(secondRun.warnings.some(item => /dilewati sementara \(\d+ menit lagi\)/.test(item)));

    resetCloudflareTryOnCooldown();
});

test("try-on yang berhasil memulihkan status dan dipakai lagi", async () => {
    resetCloudflareTryOnCooldown();
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("No such model");
        },
        [TRYON_MODEL]: () => ({ state: "Completed", result: { image: JPEG_BASE64 } })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter di kafe",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg",
        personImageUrl: "https://storage.example/person.jpg",
        garmentImageUrls: ["https://storage.example/outfit.jpg"]
    });
    assert.equal(result.model, TRYON_MODEL);
    assert.equal(calls.some(call => call.model === TRYON_MODEL), true);
});

test("tes provider menguji SDXL hanya sebagai latar teks-ke-gambar, tanpa input gambar", async () => {
    let sdxlPayload = null;
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [SDXL_MODEL]: (payload) => {
            sdxlPayload = payload;
            throw new Error("3030: Model input is not valid: input tensor `image` is not present in the model");
        }
    });
    const result = await testCloudflareImageProvider({ env: { AI } });
    assert.equal(result.identity_ready, true);
    assert.equal(result.sdxl_ready, false);
    assert.equal(sdxlPayload.image_b64, undefined, "SDXL tidak boleh dikirimi gambar");
    assert.equal(sdxlPayload.num_steps, 2);
    assert.equal(result.checks.find(check => check.id === "sdxl").ok, false);
    assert.match(result.checks.find(check => check.id === "sdxl").error, /tidak menerima input gambar/);
});

test("tes provider memberi tahu berapa menit try-on masih dinonaktifkan", async () => {
    resetCloudflareTryOnCooldown();
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [SDXL_MODEL]: () => ({ image: JPEG_BASE64 }),
        [TRYON_MODEL]: () => {
            throw new Error("2021: Insufficient AI Gateway credits");
        }
    });
    const result = await testCloudflareImageProvider({ env: { AI }, includeTryOn: true });
    assert.equal(result.try_on_ready, false);
    assert.ok(result.try_on_cooldown_minutes > 0);
    resetCloudflareTryOnCooldown();
});

test("FLUX.2 klein 4B dicoba ulang sekali saat error sementara (3043/3040)", async () => {
    resetCloudflareIdentityFallbackCooldown();
    let attempts = 0;
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            attempts += 1;
            if (attempts === 1) throw new Error("3043: Internal server error");
            return { image: JPEG_BASE64 };
        }
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter di halte bus",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    assert.equal(result.model, IDENTITY_MODEL);
    assert.equal(attempts, 2, "percobaan kedua harus terjadi");
    assert.equal(calls.length, 2);
    assert.ok(result.warnings.some(item => /gagal sementara/.test(item)));
});

test("error konfigurasi 4B tidak dicoba ulang (tidak membuang waktu)", async () => {
    resetCloudflareIdentityFallbackCooldown();
    let attempts = 0;
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => {
            attempts += 1;
            throw new Error("3030: Model input is not valid: input tensor `image` is not present in the model");
        },
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter di halte bus",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    assert.equal(result.model, IDENTITY_FALLBACK_MODEL);
    assert.equal(attempts, 1, "error non-transien tidak boleh diulang");
});

test("cadangan 9B yang error 3043 dilewati 30 menit setelah itu", async () => {
    resetCloudflareIdentityFallbackCooldown();
    const first = createFakeAI({
        [IDENTITY_MODEL]: () => {
            throw new Error("3040: Out of capacity");
        },
        [IDENTITY_FALLBACK_MODEL]: () => {
            throw new Error("3043: Internal server error");
        }
    });
    const firstError = await generateSocialImage({
        env: { AI: first.AI },
        prompt: "Karakter di pasar",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    }).then(() => null, error => error);
    assert.ok(firstError);
    assert.ok(firstError.warnings.some(item => /dilewati 30 menit/.test(item)));

    const second = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IDENTITY_FALLBACK_MODEL]: () => {
            throw new Error("tidak boleh dipanggil");
        }
    });
    const secondRun = await generateSocialImage({
        env: { AI: second.AI },
        prompt: "Karakter di pantai",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    assert.equal(secondRun.model, IDENTITY_MODEL);
    assert.equal(second.calls.some(call => call.model === IDENTITY_FALLBACK_MODEL), false);
    assert.ok(secondRun.warnings.some(item => /9B dilewati sementara \(\d+ menit lagi\)/.test(item)));
    resetCloudflareIdentityFallbackCooldown();
});

test("tes provider menandai single point of failure saat 4B siap tetapi 9B gagal", async () => {
    resetCloudflareIdentityFallbackCooldown();
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IDENTITY_FALLBACK_MODEL]: () => {
            throw new Error("3043: Internal server error");
        },
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [SDXL_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await testCloudflareImageProvider({ env: { AI } });
    assert.equal(result.identity_ready, true);
    assert.equal(result.identity_fallback_ready, false);
    assert.equal(result.identity_chain_ready, true);
    assert.equal(result.identity_single_point, true);
    assert.ok(result.identity_fallback_cooldown_minutes > 0);
    assert.match(result.checks.find(check => check.id === "identity9b").error, /gangguan sementara/);
    resetCloudflareIdentityFallbackCooldown();
});

test("tes provider memakai foto uji nyata bila tersedia dan melaporkan sumbernya", async () => {
    const originalFetch = globalThis.fetch;
    let requested = "";
    globalThis.fetch = async (input) => {
        requested = String(input);
        const bytes = makeReference({ width: 640, height: 960 });
        return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });
    };
    try {
        const { AI } = createFakeAI({
            [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
            [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
            [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
            [SDXL_MODEL]: () => ({ image: JPEG_BASE64 })
        });
        const result = await testCloudflareImageProvider({ env: { AI } });
        assert.match(requested, /huggingface\.co/);
        assert.equal(result.test_reference_source, "sample-photo");
        assert.equal(result.checks[0].input, "sample-photo");
        assert.equal(result.identity_ready, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("tes provider tetap berjalan dengan gambar sintetis bila foto contoh gagal diunduh", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new Error("network blocked");
    };
    try {
        const { AI } = createFakeAI({
            [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
            [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
            [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
            [SDXL_MODEL]: () => ({ image: JPEG_BASE64 })
        });
        const result = await testCloudflareImageProvider({ env: { AI } });
        assert.equal(result.test_reference_source, "synthetic");
        assert.equal(result.checks[0].input, "synthetic");
        assert.equal(result.identity_ready, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

function makeBlankPng(width = 576, height = 1024) {
    const png = new PNG({ width, height });
    png.data.fill(0);
    return new Uint8Array(PNG.sync.write(png));
}

test("gambar nyaris kosong (2 KB PNG) ditolak, bukan dilaporkan OK", async () => {
    const blank = makeBlankPng();
    assert.ok(blank.length < 10_000, "fixture harus menyerupai PNG kosong yang kecil");
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: Buffer.from(blank).toString("base64") }),
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: Buffer.from(makeReference()).toString("base64") })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter di taman",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });

    assert.equal(result.model, IDENTITY_FALLBACK_MODEL);
    assert.equal(calls.length, 2);
    assert.ok(result.warnings.some(item => /nyaris kosong/.test(item)));
    assert.ok(result.warnings.some(item => /2 KB untuk 576x1024/.test(item)));
});

test("gambar normal tetap diterima tanpa decode tambahan", async () => {
    const normal = makeReference({ width: 576, height: 1024 });
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: Buffer.from(normal).toString("base64") })
    });
    const result = await generateSocialImage({
        env: { AI },
        prompt: "Karakter di taman",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    assert.equal(result.model, IDENTITY_MODEL);
    assert.deepEqual(result.warnings, []);
});

test("tes provider menandai model yang mengembalikan gambar kosong sebagai gagal", async () => {
    const blank = makeBlankPng();
    const { AI } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 }),
        [IDENTITY_FALLBACK_MODEL]: () => ({ image: JPEG_BASE64 }),
        [FLUX_MODEL]: () => ({ image: JPEG_BASE64 }),
        [SDXL_MODEL]: () => ({ image: Buffer.from(blank).toString("base64") })
    });
    const result = await testCloudflareImageProvider({ env: { AI } });
    const sdxl = result.checks.find(check => check.id === "sdxl");
    assert.equal(sdxl.ok, false);
    assert.match(sdxl.error, /nyaris kosong/);
    assert.equal(result.sdxl_ready, false);
});

test("inspectImageContent membedakan gambar kosong dan gambar berisi", async () => {
    const blank = inspectImageContent(makeBlankPng());
    assert.equal(blank.sampled, true);
    assert.equal(blank.stddev, 0);
    assert.equal(isBlankImage(blank), true);

    const normal = inspectImageContent(makeReference({ width: 576, height: 1024 }));
    assert.equal(normal.sampled, false, "gambar normal tidak perlu di-decode");
    assert.equal(isBlankImage(normal), false);
    assert.ok(normal.bytes_per_pixel > 0.3);
});

test("CLOUDFLARE_IDENTITY_SIZE menaikkan resolusi keluaran identitas", async () => {
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    await generateSocialImage({
        env: { AI, CLOUDFLARE_IDENTITY_SIZE: "768x1344" },
        prompt: "Karakter di taman",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    const { text } = await readMultipartBody(calls[0].payload);
    assert.match(text, /name="width"\r\n\r\n768/);
    assert.match(text, /name="height"\r\n\r\n1344/);
});

test("ukuran besar yang ditolak model diulang pada ukuran default", async () => {
    let attempt = 0;
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: async (payload) => {
            attempt += 1;
            const { text } = await readMultipartBody(payload);
            if (/name="width"\r\n\r\n768/.test(text)) {
                throw new Error("3030: Model input is not valid: width 768 is not supported");
            }
            return { image: JPEG_BASE64 };
        }
    });
    const result = await generateSocialImage({
        env: { AI, CLOUDFLARE_IDENTITY_SIZE: "768x1344" },
        prompt: "Karakter di taman",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    assert.equal(result.model, IDENTITY_MODEL);
    assert.equal(attempt, 2);
    assert.equal(calls.length, 2);
    assert.ok(result.warnings.some(item => /768x1344 ditolak/.test(item)));
    assert.ok(result.warnings.some(item => /kembali ke 576x1024/.test(item)));
});

test("CLOUDFLARE_IDENTITY_SIZE tidak masuk akal diabaikan tanpa mengganggu", async () => {
    const { AI, calls } = createFakeAI({
        [IDENTITY_MODEL]: () => ({ image: JPEG_BASE64 })
    });
    const result = await generateSocialImage({
        env: { AI, CLOUDFLARE_IDENTITY_SIZE: "99999x99999" },
        prompt: "Karakter di taman",
        imageProvider: "cloudflare",
        referenceBytes: makeReference(),
        referenceMimeType: "image/jpeg"
    });
    const { text } = await readMultipartBody(calls[0].payload);
    assert.match(text, /name="width"\r\n\r\n576/);
    assert.equal(result.warnings.length, 0);
});
