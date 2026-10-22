import test from "node:test";
import assert from "node:assert/strict";

import {
    qwenCloudVideoModels,
    getQwenCloudVideoModel
} from "../models/qwencloud-video/index.js";

import {
    QWENCLOUD_VIDEO_SPECS,
    resolveSize
} from "../models/qwencloud-video/specs.js";

import {
    IMAGE2VIDEO_ENDPOINT,
    PROVIDER_ERROR_MESSAGES,
    VIDEO_GENERATION_ENDPOINT,
    getBaseUrl,
    getProviderErrorMessage,
    mapProviderCode,
    normalizeOutputUrls,
    normalizeStatus,
    normalizeTaskError,
    redactSecrets
} from "../provider/qwencloud/client.js";

const model = id => getQwenCloudVideoModel(id);

const findParam = (adapter, name) =>
    adapter.parameters.find(parameter => parameter.name === name);


test("registers every QwenCloud video model with a unique id", () => {
    assert.equal(qwenCloudVideoModels.length, QWENCLOUD_VIDEO_SPECS.length);
    assert.equal(qwenCloudVideoModels.length, 13);

    const ids = qwenCloudVideoModels.map(adapter => adapter.config.id);
    assert.equal(new Set(ids).size, ids.length);

    for (const adapter of qwenCloudVideoModels) {
        assert.equal(adapter.config.providerId, "qwencloud");
        assert.equal(adapter.config.providerName, "QwenCloud");
        assert.ok(adapter.config.dashscopeModel);
        assert.equal(typeof adapter.createTask, "function");
        assert.equal(typeof adapter.queryTask, "function");
        assert.equal(typeof adapter.validate, "function");
        assert.ok(Array.isArray(adapter.parameters));
    }
});

test("uses the correct DashScope endpoint per model kind", () => {
    assert.equal(
        model("qwen-wan2.6-t2v").config.api.createTask,
        VIDEO_GENERATION_ENDPOINT
    );
    assert.equal(
        model("qwen-wan2.6-i2v").config.api.createTask,
        VIDEO_GENERATION_ENDPOINT
    );
    assert.equal(
        model("qwen-wan2.6-r2v").config.api.createTask,
        VIDEO_GENERATION_ENDPOINT
    );
    assert.equal(
        model("qwen-wan2.2-kf2v-flash").config.api.createTask,
        IMAGE2VIDEO_ENDPOINT
    );
    assert.equal(
        model("qwen-wan2.2-animate-move").config.api.createTask,
        IMAGE2VIDEO_ENDPOINT
    );
});

test("builds a text-to-video payload with size, duration and prompt extend", () => {
    const adapter = model("qwen-wan2.6-t2v");

    assert.deepEqual(
        adapter.buildPayload({
            prompt: "  Gadis menari di bawah hujan neon  ",
            negative_prompt: "blur",
            aspect_ratio: "9:16",
            resolution: "1080P",
            duration: "10",
            prompt_extend: "false"
        }),
        {
            model: "wan2.6-t2v",
            input: {
                prompt: "Gadis menari di bawah hujan neon",
                negative_prompt: "blur"
            },
            parameters: {
                size: "1080*1920",
                duration: 10,
                prompt_extend: false,
                shot_type: "single"
            }
        }
    );
});

test("maps resolution and aspect ratio to a Wan size string", () => {
    assert.equal(resolveSize("720P", "16:9"), "1280*720");
    assert.equal(resolveSize("720P", "9:16"), "720*1280");
    assert.equal(resolveSize("1080P", "1:1"), "1440*1440");
    assert.equal(resolveSize("480P", "16:9"), "832*480");
    assert.equal(resolveSize("tidak-ada", "16:9"), null);
});

test("builds an image-to-video payload using img_url", () => {
    const payload = model("qwen-wan2.6-i2v-flash").buildPayload({
        image_url: "https://example.com/frame.png",
        prompt: "Zoom perlahan",
        resolution: "720P",
        duration: "5"
    });

    assert.equal(payload.model, "wan2.6-i2v-flash");
    assert.equal(payload.input.img_url, "https://example.com/frame.png");
    assert.equal(payload.parameters.resolution, "720P");
    assert.equal(payload.parameters.duration, 5);
});

test("builds a first/last frame payload", () => {
    const adapter = model("qwen-wan2.2-kf2v-flash");
    const payload = adapter.buildPayload({
        first_frame_url: "https://example.com/a.png",
        last_frame_url: "https://example.com/b.png",
        prompt: "Transformasi"
    });

    assert.equal(payload.input.first_frame_url, "https://example.com/a.png");
    assert.equal(payload.input.last_frame_url, "https://example.com/b.png");
    assert.equal(payload.parameters.resolution, "720P");
    assert.equal(payload.parameters.duration, 5);
});

test("merges image and video references for reference-to-video", () => {
    const payload = model("qwen-wan2.6-r2v-flash").buildPayload({
        image_urls: ["https://example.com/character.png"],
        video_urls: ["https://example.com/motion.mp4"],
        prompt: "Karakter melambaikan tangan",
        aspect_ratio: "16:9",
        resolution: "720P",
        duration: "5"
    });

    assert.deepEqual(payload.input.reference_urls, [
        "https://example.com/character.png",
        "https://example.com/motion.mp4"
    ]);
    assert.equal(payload.parameters.size, "1280*720");
    assert.equal(payload.parameters.audio, false);
});

test("builds an animate payload with service mode", () => {
    const adapter = model("qwen-wan2.2-animate-move");
    const payload = adapter.buildPayload({
        image_url: "https://example.com/karakter.jpg",
        video_url: "https://example.com/gerak.mp4",
        mode: "wan-pro"
    });

    assert.deepEqual(payload, {
        model: "wan2.2-animate-move",
        input: {
            image_url: "https://example.com/karakter.jpg",
            video_url: "https://example.com/gerak.mp4"
        },
        parameters: {
            mode: "wan-pro"
        }
    });
});

test("validates required media, URLs, enums and prompt length", () => {
    const t2v = model("qwen-wan2.6-t2v");

    assert.equal(t2v.validate({}).valid, false);
    assert.equal(
        t2v.validate({ prompt: "a", resolution: "8K" }).valid,
        false
    );
    assert.equal(
        t2v.validate({ prompt: "a", duration: "99" }).valid,
        false
    );
    assert.equal(
        t2v.validate({ prompt: "a", aspect_ratio: "21:9" }).valid,
        false
    );
    assert.equal(
        t2v.validate({ prompt: "x".repeat(2001) }).valid,
        false
    );
    assert.equal(
        t2v.validate({
            prompt: "a",
            aspect_ratio: "16:9",
            resolution: "720P",
            duration: "5"
        }).valid,
        true
    );

    const i2v = model("qwen-wan2.6-i2v");
    assert.equal(i2v.validate({ prompt: "a" }).valid, false);
    assert.equal(
        i2v.validate({ image_url: "bukan-url" }).valid,
        false
    );
    assert.equal(
        i2v.validate({ image_url: "https://example.com/a.png" }).valid,
        true
    );

    const r2v = model("qwen-wan2.6-r2v");
    assert.equal(r2v.validate({ prompt: "a" }).valid, false);
    assert.equal(
        r2v.validate({
            prompt: "a",
            image_urls: ["https://example.com/a.png"]
        }).valid,
        true
    );

    const animate = model("qwen-wan2.2-animate-move");
    assert.equal(
        animate.validate({
            image_url: "https://example.com/a.png",
            video_url: "https://example.com/a.mp4",
            mode: "wan-ultra"
        }).valid,
        false
    );
});

test("checkboxes default to enabled prompt extend", () => {
    const adapter = model("qwen-wan2.6-t2v");

    assert.equal(
        adapter.getParameters({ prompt: "a" }).prompt_extend,
        true
    );
    assert.equal(
        adapter.getParameters({ prompt: "a", prompt_extend: "0" }).prompt_extend,
        false
    );
    assert.equal(
        adapter.getParameters({ prompt: "a" }).resolution,
        "720P"
    );
});

test("normalizes DashScope task statuses", () => {
    assert.equal(normalizeStatus("PENDING"), "QUEUED");
    assert.equal(normalizeStatus("RUNNING"), "PROCESSING");
    assert.equal(normalizeStatus("SUCCEEDED"), "COMPLETED");
    assert.equal(normalizeStatus("FAILED"), "FAILED");
    assert.equal(normalizeStatus("CANCELED"), "CANCELED");
    assert.equal(normalizeStatus("apa-saja"), "UNKNOWN");
});

test("extracts the output video URL from task responses", () => {
    assert.deepEqual(
        normalizeOutputUrls({
            output: {
                video_url: "https://dashscope-result.oss/out.mp4?Expires=1"
            }
        }),
        ["https://dashscope-result.oss/out.mp4?Expires=1"]
    );

    assert.deepEqual(
        normalizeOutputUrls({
            output: {
                video_urls: ["https://a/1.mp4", "https://a/1.mp4"]
            }
        }),
        ["https://a/1.mp4"]
    );

    assert.deepEqual(normalizeOutputUrls({}), []);
});

test("redacts API keys from debug logs", () => {
    const redacted = redactSecrets({
        api_key: "sk-secret",
        authorization: "Bearer abc.def",
        nested: "Bearer sk-123456789",
        prompt: "aman"
    });

    assert.equal(redacted.api_key, "[REDACTED]");
    assert.equal(redacted.authorization, "[REDACTED]");
    assert.equal(redacted.nested, "Bearer [REDACTED]");
    assert.equal(redacted.prompt, "aman");
});

test("allows overriding the DashScope base URL through env", () => {
    const original = process.env.DASHSCOPE_BASE_URL;

    delete process.env.DASHSCOPE_BASE_URL;
    assert.equal(getBaseUrl(), "https://dashscope-intl.aliyuncs.com/api/v1");

    process.env.DASHSCOPE_BASE_URL =
        "https://ws-123.ap-southeast-1.maas.aliyuncs.com/api/v1/";
    assert.equal(
        getBaseUrl(),
        "https://ws-123.ap-southeast-1.maas.aliyuncs.com/api/v1"
    );

    if (original === undefined) {
        delete process.env.DASHSCOPE_BASE_URL;
    } else {
        process.env.DASHSCOPE_BASE_URL = original;
    }
});

test("creates a task with async header and returns the task id", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                request_id: "req-1",
                output: {
                    task_id: "task-abc",
                    task_status: "PENDING"
                }
            })
        };
    };

    try {
        const adapter = model("qwen-wan2.6-t2v");
        const result = await adapter.createTask(
            {
                prompt: "kucing astronot",
                aspect_ratio: "16:9",
                resolution: "720P",
                duration: "5"
            },
            "sk-test"
        );

        assert.equal(result.taskId, "task-abc");
        assert.equal(result.task_id, "task-abc");
        assert.equal(result.provider, "qwencloud");
        assert.equal(result.model, "qwen-wan2.6-t2v");
        assert.equal(calls.length, 1);
        assert.equal(
            calls[0].options.headers["X-DashScope-Async"],
            "enable"
        );
        assert.equal(
            calls[0].url,
            "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("polls a task and normalizes the video result", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";

    globalThis.fetch = async url => {
        requestedUrl = url;
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                request_id: "req-2",
                output: {
                    task_id: "task-abc",
                    task_status: "SUCCEEDED",
                    video_url: "https://dashscope-result.oss/result.mp4"
                },
                usage: { duration: 5, size: "1280*720" }
            })
        };
    };

    try {
        const result = await model("qwen-wan2.6-t2v").queryTask(
            "task-abc",
            "sk-test"
        );

        assert.equal(
            requestedUrl,
            "https://dashscope-intl.aliyuncs.com/api/v1/tasks/task-abc"
        );
        assert.equal(result.status, "COMPLETED");
        assert.equal(result.outputUrl, "https://dashscope-result.oss/result.mp4");
        assert.deepEqual(result.outputUrls, [
            "https://dashscope-result.oss/result.mp4"
        ]);
        assert.equal(result.usage.duration, 5);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("surfaces DashScope errors as provider errors", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => JSON.stringify({
            code: "InvalidApiKey",
            message: "Invalid API-key provided.",
            request_id: "req-3"
        })
    });

    try {
        await assert.rejects(
            () => model("qwen-wan2.6-t2v").createTask(
                { prompt: "a", aspect_ratio: "16:9", resolution: "720P", duration: "5" },
                "sk-salah"
            ),
            error => {
                assert.equal(error.code, "INVALID_API_KEY");
                assert.equal(error.provider, "qwencloud");
                assert.equal(error.status, 401);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("rejects createTask before hitting the network when input is invalid", async () => {
    await assert.rejects(
        () => model("qwen-wan2.6-t2v").createTask({}, "sk-test"),
        error => {
            assert.equal(error.code, "INVALID_MODEL_INPUT");
            assert.ok(error.validationErrors.length > 0);
            return true;
        }
    );
});

test("exposes durations and resolutions used by the generate form", () => {
    const t2v = model("qwen-wan2.6-t2v");

    assert.deepEqual(
        findParam(t2v, "duration").enum,
        ["5", "10", "15"]
    );
    assert.deepEqual(
        findParam(t2v, "resolution").enum,
        ["720P", "1080P"]
    );
    assert.equal(findParam(t2v, "prompt").required, true);
    assert.equal(findParam(t2v, "audio_url").type, "audio_url");

    const i2v = model("qwen-wan2.6-i2v");
    assert.equal(findParam(i2v, "image_url").required, true);
    assert.equal(findParam(i2v, "image_url").type, "image_url");

    const r2v = model("qwen-wan2.6-r2v");
    assert.equal(findParam(r2v, "image_urls").maxItems, 5);
    assert.equal(findParam(r2v, "video_urls").maxItems, 1);

    const kf2v = model("qwen-wan2.2-kf2v-flash");
    assert.equal(findParam(kf2v, "first_frame_url").required, true);
    assert.equal(findParam(kf2v, "last_frame_url").required, true);
});


/* =========================================================
   TASK-LEVEL ERROR + PESAN BAHASA INDONESIA
========================================================= */

test("maps DashScope codes to internal codes", () => {
    assert.equal(mapProviderCode("InvalidApiKey"), "INVALID_API_KEY");
    assert.equal(mapProviderCode("Throttling"), "RATE_LIMITED");
    assert.equal(
        mapProviderCode("AllocationQuota.FreeTierOnly"),
        "FREE_QUOTA_EXHAUSTED"
    );
    assert.equal(
        mapProviderCode("AllocationQuota.FreeTierExhausted"),
        "FREE_QUOTA_EXHAUSTED"
    );
    assert.equal(mapProviderCode("Arrearage"), "INSUFFICIENT_BALANCE");
    assert.equal(mapProviderCode("DataInspectionFailed"), "CONTENT_BLOCKED");

    // prefix/suffix tetap dikenali
    assert.equal(
        mapProviderCode("AllocationQuota.FreeTierOnly:free_tier"),
        "FREE_QUOTA_EXHAUSTED"
    );

    // fallback berdasarkan HTTP status
    assert.equal(mapProviderCode("", 401), "INVALID_API_KEY");
    assert.equal(mapProviderCode("", 429), "RATE_LIMITED");
    assert.equal(mapProviderCode("", 503), "PROVIDER_UNAVAILABLE");
    assert.equal(mapProviderCode("", 0), "QWENCLOUD_REQUEST_FAILED");
});

test("returns Indonesian messages for every internal code", () => {
    const freeQuota = getProviderErrorMessage("FREE_QUOTA_EXHAUSTED");
    assert.match(freeQuota, /Kuota gratis model ini sudah habis/);

    assert.match(
        getProviderErrorMessage("INSUFFICIENT_BALANCE"),
        /Saldo QwenCloud tidak mencukupi/
    );
    assert.match(
        getProviderErrorMessage("CONTENT_BLOCKED"),
        /filter konten/
    );
    assert.match(
        getProviderErrorMessage("RATE_LIMITED"),
        /Permintaan terlalu cepat/
    );

    // kode tidak dikenal tetap memberi pesan Indonesia
    assert.equal(
        getProviderErrorMessage("APA-SAJA"),
        PROVIDER_ERROR_MESSAGES.QWENCLOUD_REQUEST_FAILED
    );
    assert.equal(
        getProviderErrorMessage(null),
        PROVIDER_ERROR_MESSAGES.QWENCLOUD_REQUEST_FAILED
    );
});

test("normalizes a task that failed because the free quota ran out", () => {
    const result = normalizeTaskError(
        {
            task_status: "FAILED",
            code: "AllocationQuota.FreeTierOnly",
            message:
                "AllocationQuota.FreeTierOnly: You have no free quota left for this model."
        },
        {}
    );

    assert.equal(result.errorCode, "FREE_QUOTA_EXHAUSTED");
    assert.match(result.errorMessage, /Kuota gratis model ini sudah habis/);
    assert.equal(
        result.providerCode,
        "AllocationQuota.FreeTierOnly"
    );
    assert.match(result.providerMessage, /no free quota left/);
});

test("normalizes content-filter and overdue-billing task failures", () => {
    assert.equal(
        normalizeTaskError({ code: "DataInspectionFailed" }, {}).errorCode,
        "CONTENT_BLOCKED"
    );
    assert.equal(
        normalizeTaskError({ code: "Arrearage" }, {}).errorCode,
        "INSUFFICIENT_BALANCE"
    );
});

test("returns empty normalization for tasks without errors", () => {
    assert.deepEqual(normalizeTaskError({}, {}), {
        errorCode: null,
        errorMessage: null,
        providerCode: null,
        providerMessage: null
    });
});

test("falls back to the provider message when the code is unknown", () => {
    const result = normalizeTaskError(
        {
            code: "SomeNewProviderError",
            message: "Provider failure detail"
        },
        {}
    );

    assert.equal(result.errorCode, "QWENCLOUD_REQUEST_FAILED");
    assert.match(
        result.errorMessage,
        /^Permintaan ke QwenCloud gagal\. Detail: Provider failure detail$/
    );
});

test("queryTask exposes the normalized task error", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
            request_id: "req-quota",
            output: {
                task_id: "task-quota",
                task_status: "FAILED",
                code: "AllocationQuota.FreeTierOnly",
                message: "no free quota"
            }
        })
    });

    try {
        const result = await model("qwen-wan2.6-t2v").queryTask(
            "task-quota",
            "sk-test"
        );

        assert.equal(result.status, "FAILED");
        assert.equal(result.errorCode, "FREE_QUOTA_EXHAUSTED");
        assert.equal(result.error_code, "FREE_QUOTA_EXHAUSTED");
        assert.match(
            result.errorMessage,
            /Kuota gratis model ini sudah habis/
        );
        assert.match(
            result.error_message,
            /Kuota gratis model ini sudah habis/
        );
        assert.equal(
            result.providerErrorCode,
            "AllocationQuota.FreeTierOnly"
        );
        assert.equal(result.providerErrorMessage, "no free quota");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("queryTask leaves error fields empty for a running task", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
            output: {
                task_id: "task-run",
                task_status: "RUNNING"
            }
        })
    });

    try {
        const result = await model("qwen-wan2.6-t2v").queryTask(
            "task-run",
            "sk-test"
        );

        assert.equal(result.status, "PROCESSING");
        assert.equal(result.errorCode, null);
        assert.equal(result.errorMessage, null);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("HTTP errors are surfaced with Indonesian messages", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => JSON.stringify({
            code: "Throttling.RateQuota",
            message: "Requests rate limit exceeded"
        })
    });

    try {
        await assert.rejects(
            () => model("qwen-wan2.6-t2v").createTask(
                {
                    prompt: "a",
                    aspect_ratio: "16:9",
                    resolution: "720P",
                    duration: "5"
                },
                "sk-test"
            ),
            error => {
                assert.equal(error.code, "RATE_LIMITED");
                assert.match(error.message, /Permintaan terlalu cepat/);
                assert.equal(error.providerMessage, "Requests rate limit exceeded");
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});
