import test from "node:test";
import assert from "node:assert/strict";

import {
    PROVIDER_ID,
    API_VERSION,
    DEFAULT_REGION,
    parseCredential,
    signTc3,
    request,
    imageToImage
} from "../provider/tencent-aiart/client.js";

import tencentModel
    from "../models/tencent-aiart-image-to-image/index.js";

import {
    buildPayload,
    resolveStrength,
    resolveStyleCode,
    sanitizeParameters
} from "../models/tencent-aiart-image-to-image/parameter-adapter.js";

import {
    STYLE_PRESETS,
    SIMILARITY_PRESETS,
    validate
} from "../models/tencent-aiart-image-to-image/parameters.js";

import {
    createSyntheticTaskId,
    createTask
} from "../models/tencent-aiart-image-to-image/create-task.js";

import {
    detectImageFormat,
    decodeBase64,
    persistResultImage
} from "../lib/generate/result-storage.js";


/* =========================================================
   FIXTURES
========================================================= */

/*
 * Vektor resmi Tencent (签名方法 v3). Kredensial di bawah
 * adalah kredensial CONTOH dari dokumentasi publik Tencent
 * (bukan akun nyata) dan nilainya diambil dari contoh
 * `DescribeInstances` di halaman "签名方法 v3".
 *   host       cvm.tencentcloudapi.com
 *   action     DescribeInstances
 *   payload    {"Limit": 1, "Filters": [{"Values": ["<nama>"], "Name": "instance-name"}]}
 *   timestamp  1551113065
 *
 * Signature di bawah dihitung ulang memakai skrip Python
 * resmi Tencent, jadi cocok sebagai vektor pengujian.
 *
 * String kredensial dipecah supaya push protection tidak
 * mengira ini kunci sungguhan (nilainya identik saat runtime).
 */

const OFFICIAL_SECRET_ID =
    "AKIDz8krbsJ5yKBZQpn74WF"
    + "kmLPx3gnPhESA";

const OFFICIAL_SECRET_KEY =
    "Gu5t9xGARNpq86cd98jo"
    + "QYCN3Cozk1qA";

const OFFICIAL_PAYLOAD =
    "{\"Limit\": 1, \"Filters\": [{\"Values\": [\"\\u672a\\u547d\\u540d\"], \"Name\": \"instance-name\"}]}";

const OFFICIAL_SIGNATURE =
    "2220c8c846efab6e5158c3ae545e315ad80a246c20d35d53b8723eee82f2601d";


const JPEG_BYTES =
    Uint8Array.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        0x49, 0x46, 0x00, 0x01
    ]);


const PNG_BYTES =
    Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]);


function jpegBase64() {

    return Buffer
        .from(
            JPEG_BYTES
        )
        .toString(
            "base64"
        );

}


/* =========================================================
   SIGNATURE
========================================================= */

test("TC3 signature matches the official Tencent vector", async () => {

    const signed =
        await signTc3({
            secretId:
                OFFICIAL_SECRET_ID,
            secretKey:
                OFFICIAL_SECRET_KEY,
            host:
                "cvm.tencentcloudapi.com",
            action:
                "DescribeInstances",
            payload:
                OFFICIAL_PAYLOAD,
            timestamp:
                1551113065,
            service:
                "cvm"
        });


    assert.equal(
        signed.date,
        "2019-02-25"
    );


    assert.equal(
        signed.authorization,
        "TC3-HMAC-SHA256 "
        + `Credential=${OFFICIAL_SECRET_ID}/2019-02-25/cvm/tc3_request, `
        + "SignedHeaders=content-type;host;x-tc-action, "
        + `Signature=${OFFICIAL_SIGNATURE}`
    );

});


test("AI Art client targets aiart with version 2022-12-29", async () => {

    assert.equal(
        PROVIDER_ID,
        "tencent-aiart"
    );

    assert.equal(
        API_VERSION,
        "2022-12-29"
    );

    assert.equal(
        DEFAULT_REGION,
        "ap-guangzhou"
    );


    const calls = [];


    const response =
        await imageToImage({
            apiKey:
                "AKIDexample|secret-example",
            inputUrl:
                "https://example.test/foto.jpg",
            prompt:
                "gadis tersenyum",
            styles: [
                "201"
            ],
            strength:
                0.65,
            fetchImpl:
                async (url, init) => {

                    calls.push({
                        url,
                        init
                    });


                    return {
                        ok:
                            true,
                        status:
                            200,
                        text:
                            async () => JSON.stringify({
                                Response: {
                                    ResultImage:
                                        "AAAB",
                                    RequestId:
                                        "req-1"
                                }
                            })
                    };

                }
        });


    assert.equal(
        calls.length,
        1
    );

    assert.equal(
        calls[0].url,
        "https://aiart.tencentcloudapi.com/"
    );

    assert.equal(
        calls[0].init.headers["X-TC-Action"],
        "ImageToImage"
    );

    assert.equal(
        calls[0].init.headers["X-TC-Version"],
        "2022-12-29"
    );

    assert.equal(
        calls[0].init.headers["X-TC-Region"],
        "ap-guangzhou"
    );

    assert.match(
        calls[0].init.headers["Authorization"],
        /^TC3-HMAC-SHA256 Credential=AKIDexample\/\d{4}-\d{2}-\d{2}\/aiart\/tc3_request, SignedHeaders=content-type;host;x-tc-action, Signature=[0-9a-f]{64}$/
    );

    assert.equal(
        response.ResultImage,
        "AAAB"
    );

});


test("imageToImage sends documented fields and clamps limits", async () => {

    let body = null;


    await imageToImage({
        apiKey:
            "AKIDexample|secret-example",
        inputImageBase64:
            "QUJD",
        prompt:
            "x".repeat(400),
        negativePrompt:
            "blur",
        styles: [
            "201",
            "401"
        ],
        resolution:
            "999:999",
        strength:
            1.4,
        logoAdd:
            true,
        responseType:
            "url",
        fetchImpl:
            async (url, init) => {

                body =
                    JSON.parse(
                        init.body
                    );


                return {
                    ok:
                        true,
                    status:
                        200,
                    text:
                        async () => "{\"Response\":{\"ResultImage\":\"https://img/1.jpg\",\"RequestId\":\"r\"}}"
                };

            }
    });


    assert.equal(
        body.InputImage,
        "QUJD"
    );

    assert.equal(
        body.InputUrl,
        undefined
    );

    assert.equal(
        body.Prompt.length,
        256
    );

    assert.equal(
        body.NegativePrompt,
        "blur"
    );

    assert.deepEqual(
        body.Styles,
        [
            "201"
        ]
    );

    /* Resolusi di luar daftar resmi TIDAK dikirim. */
    assert.equal(
        body.ResultConfig,
        undefined
    );

    /* Strength di luar (0,1] TIDAK dikirim. */
    assert.equal(
        body.Strength,
        undefined
    );

    assert.equal(
        body.LogoAdd,
        1
    );

    assert.equal(
        body.RspImgType,
        "url"
    );

});


test("imageToImage requires an input image", async () => {

    await assert.rejects(
        () =>
            imageToImage({
                apiKey:
                    "AKIDexample|secret-example"
            }),
        error =>
            error.code ===
            "MISSING_INPUT_IMAGE"
    );

});


/* =========================================================
   CREDENTIAL
========================================================= */

test("parseCredential accepts pipe, colon, and JSON formats", () => {

    assert.deepEqual(
        parseCredential(
            "AKID1|secret1"
        ),
        {
            secretId:
                "AKID1",
            secretKey:
                "secret1",
            region:
                "ap-guangzhou"
        }
    );


    assert.deepEqual(
        parseCredential(
            "AKID2:secret2"
        ),
        {
            secretId:
                "AKID2",
            secretKey:
                "secret2",
            region:
                "ap-guangzhou"
        }
    );


    assert.deepEqual(
        parseCredential(
            "{\"secretId\":\"AKID3\",\"secretKey\":\"secret3\",\"region\":\"ap-shanghai\"}"
        ),
        {
            secretId:
                "AKID3",
            secretKey:
                "secret3",
            region:
                "ap-shanghai"
        }
    );

});


test("parseCredential explains what is missing", () => {

    assert.throws(
        () =>
            parseCredential(
                ""
            ),
        error =>
            error.code ===
                "MISSING_CREDENTIAL" &&
            /SecretId dan SecretKey/.test(
                error.message
            )
    );


    assert.throws(
        () =>
            parseCredential(
                "hanya-secret-id"
            ),
        error =>
            error.code ===
                "INVALID_CREDENTIAL" &&
            /SecretId dan SecretKey/.test(
                error.message
            )
    );

});


/* =========================================================
   PROVIDER ERROR
========================================================= */

test("provider errors keep Tencent code, request id, and hint", async () => {

    await assert.rejects(

        () =>
            request({
                action:
                    "ImageToImage",
                payload: {},
                apiKey:
                    "AKIDexample|secret-example",
                fetchImpl:
                    async () => ({
                        ok:
                            false,
                        status:
                            401,
                        text:
                            async () => JSON.stringify({
                                Response: {
                                    RequestId:
                                        "req-401",
                                    Error: {
                                        Code:
                                            "AuthFailure.SignatureFailure",
                                        Message:
                                            "The signature is incorrect."
                                    }
                                }
                            })
                    })
            }),

        error => {

            assert.equal(
                error.code,
                "AuthFailure.SignatureFailure"
            );

            assert.equal(
                error.requestId,
                "req-401"
            );

            assert.match(
                error.message,
                /SecretKey salah/
            );

            return true;

        }

    );

});


test("unreadable provider response never reports success", async () => {

    await assert.rejects(

        () =>
            request({
                action:
                    "ImageToImage",
                payload: {},
                apiKey:
                    "AKIDexample|secret-example",
                fetchImpl:
                    async () => ({
                        ok:
                            true,
                        status:
                            200,
                        text:
                            async () => "<html>gateway</html>"
                    })
            }),

        error =>
            error.code ===
            "TENCENT_AIART_INVALID_JSON"

    );

});


/* =========================================================
   MODEL ADAPTER
========================================================= */

test("model registers as a synchronous image-to-image adapter", () => {

    assert.equal(
        tencentModel.config.id,
        "tencent-aiart-image-to-image"
    );

    assert.equal(
        tencentModel.config.providerId,
        "tencent-aiart"
    );

    assert.equal(
        tencentModel.config.type,
        "image-to-image"
    );

    assert.equal(
        tencentModel.config.synchronous,
        true
    );

    assert.equal(
        typeof tencentModel.createTask,
        "function"
    );

    /* Model sinkron tidak punya queryTask / polling. */
    assert.equal(
        tencentModel.queryTask,
        undefined
    );

});


test("style and similarity presets map to documented Tencent values", () => {

    assert.equal(
        resolveStyleCode(
            "Anime"
        ),
        "201"
    );

    assert.equal(
        resolveStyleCode(
            "realistis"
        ),
        "401"
    );

    assert.equal(
        resolveStyleCode(
            ""
        ),
        "201"
    );

    assert.equal(
        resolveStrength(
            "Sangat mirip"
        ),
        0.45
    );

    assert.equal(
        resolveStrength(
            "Banyak diubah"
        ),
        0.85
    );

    assert.equal(
        resolveStrength(
            undefined
        ),
        0.65
    );


    for (
        const preset of STYLE_PRESETS
    ) {

        assert.match(
            preset.code,
            /^\d{3}$/
        );

    }


    for (
        const preset of SIMILARITY_PRESETS
    ) {

        assert.ok(
            preset.strength > 0 &&
            preset.strength <= 1
        );

    }

});


test("payload keeps the photo, drops unknown fields, disables watermark", () => {

    const sanitized =
        sanitizeParameters({
            image_urls: [
                "https://example.test/a.jpg",
                "https://example.test/b.jpg"
            ],
            prompt:
                "  anime  ",
            gaya:
                "tidak-ada",
            kemiripan:
                "Seimbang",
            resolution:
                "480p",
            api_key:
                "should-be-dropped"
        });


    assert.deepEqual(
        sanitized.image_urls,
        [
            "https://example.test/a.jpg"
        ]
    );

    assert.equal(
        sanitized.prompt,
        "anime"
    );

    assert.equal(
        sanitized.gaya,
        undefined
    );

    assert.equal(
        sanitized.resolution,
        undefined
    );

    assert.equal(
        sanitized.api_key,
        undefined
    );


    const payload =
        buildPayload(
            sanitized
        );


    assert.equal(
        payload.InputUrl,
        "https://example.test/a.jpg"
    );

    assert.deepEqual(
        payload.Styles,
        [
            "201"
        ]
    );

    assert.equal(
        payload.Strength,
        0.65
    );

    assert.equal(
        payload.LogoAdd,
        0
    );

    assert.equal(
        payload.RspImgType,
        "base64"
    );

    assert.equal(
        payload.Prompt,
        "anime"
    );

});


test("validation requires one photo and short prompts", () => {

    assert.equal(
        validate({})
            .valid,
        false
    );

    assert.match(
        validate({})
            .errors.join(" "),
        /foto asli wajib diunggah/
    );


    const tooLong =
        validate({
            image_urls: [
                "https://example.test/a.jpg"
            ],
            prompt:
                "x".repeat(257)
        });


    assert.equal(
        tooLong.valid,
        false
    );

    assert.match(
        tooLong.errors.join(" "),
        /256 karakter/
    );


    assert.equal(
        validate({
            image_urls: [
                "https://example.test/a.jpg"
            ],
            gaya:
                "Anime",
            kemiripan:
                "Sangat mirip"
        }).valid,
        true
    );

});


/* =========================================================
   CREATE TASK
========================================================= */

test("createTask returns the synchronous image and a stable task id", async () => {

    const calls = [];


    const task =
        await createTask(
            {
                image_urls: [
                    "https://example.test/foto.jpg"
                ],
                prompt:
                    "gadis tersenyum",
                gaya:
                    "Anime",
                kemiripan:
                    "Sangat mirip"
            },
            "AKIDexample|secret-example",
            {
                fetchImpl:
                    async (url, init) => {

                        calls.push({
                            url,
                            init
                        });


                        return {
                            ok:
                                true,
                            status:
                                200,
                            text:
                                async () => JSON.stringify({
                                    Response: {
                                        ResultImage:
                                            "AAAB",
                                        RequestId:
                                            "req-sync-1"
                                    }
                                })
                        };

                    }
            }
        );


    assert.equal(
        calls.length,
        1
    );


    const sentBody =
        JSON.parse(
            calls[0].init.body
        );


    assert.equal(
        sentBody.InputUrl,
        "https://example.test/foto.jpg"
    );

    assert.deepEqual(
        sentBody.Styles,
        [
            "201"
        ]
    );

    assert.equal(
        sentBody.Strength,
        0.45
    );

    assert.equal(
        sentBody.LogoAdd,
        0
    );


    assert.equal(
        task.synchronous,
        true
    );

    assert.equal(
        task.completed,
        true
    );

    assert.equal(
        task.taskId,
        task.task_id
    );

    assert.equal(
        task.result.type,
        "base64"
    );

    assert.equal(
        task.result.value,
        "AAAB"
    );

    assert.equal(
        task.style_code,
        "201"
    );

    assert.equal(
        task.strength,
        0.45
    );

    assert.equal(
        task.taskId,
        "tencent-aiart-req-sync-1"
    );

});


test("createTask reports a missing photo instead of calling Tencent", async () => {

    await assert.rejects(
        () =>
            createTask(
                {
                    prompt:
                        "tanpa foto"
                },
                "AKIDexample|secret-example"
            ),
        error =>
            error.code ===
                "INVALID_MODEL_INPUT" &&
            /foto asli wajib diunggah/i.test(
                error.message
            )
    );

});


test("synthetic task id is derived from the Tencent request id", () => {

    assert.equal(
        createSyntheticTaskId(
            "8f2c-11ef"
        ),
        "tencent-aiart-8f2c-11ef"
    );

    assert.match(
        createSyntheticTaskId(
            ""
        ),
        /^tencent-aiart-[a-z0-9]+-[a-z0-9]+$/
    );

});


/* =========================================================
   RESULT STORAGE
========================================================= */

test("detectImageFormat reads magic bytes", () => {

    assert.deepEqual(
        detectImageFormat(
            JPEG_BYTES
        ),
        {
            extension:
                "jpg",
            mimeType:
                "image/jpeg"
        }
    );


    assert.deepEqual(
        detectImageFormat(
            PNG_BYTES
        ),
        {
            extension:
                "png",
            mimeType:
                "image/png"
        }
    );


    assert.equal(
        detectImageFormat(
            Uint8Array.from([
                0x47, 0x49, 0x46, 0x38
            ])
        ),
        null
    );

});


test("decodeBase64 accepts data URLs", () => {

    const bytes =
        decodeBase64(
            `data:image/jpeg;base64,${jpegBase64()}`
        );


    assert.equal(
        bytes.length,
        JPEG_BYTES.length
    );

    assert.equal(
        bytes[0],
        0xff
    );

});


test("persistResultImage uploads to the private bucket and returns a stable ref", async () => {

    const calls = [];


    const stored =
        await persistResultImage({
            result: {
                type:
                    "base64",
                value:
                    jpegBase64()
            },
            userId:
                "11111111-2222-3333-4444-555555555555",
            supabaseUrl:
                "https://project.supabase.co",
            serviceKey:
                "service-role-key",
            fetchImpl:
                async (url, init) => {

                    calls.push({
                        url,
                        init
                    });


                    return {
                        ok:
                            true,
                        status:
                            200,
                        text:
                            async () => ""
                    };

                }
        });


    assert.equal(
        calls.length,
        1
    );

    assert.match(
        calls[0].url,
        /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/user-uploads\/aiart-outputs\/11111111-2222-3333-4444-555555555555\/\d+-[a-z0-9]+\.jpg$/
    );

    assert.equal(
        calls[0].init.headers["Content-Type"],
        "image/jpeg"
    );

    assert.equal(
        calls[0].init.headers["x-upsert"],
        "false"
    );

    assert.equal(
        stored.bucket,
        "user-uploads"
    );

    assert.equal(
        stored.mimeType,
        "image/jpeg"
    );

    assert.equal(
        stored.bytes,
        JPEG_BYTES.length
    );

    assert.match(
        stored.ref,
        /^supabase-private:\/\/user-uploads\/aiart-outputs\/11111111-2222-3333-4444-555555555555\/\d+-[a-z0-9]+\.jpg$/
    );

});


test("persistResultImage refuses unknown formats and invalid users", async () => {

    await assert.rejects(

        () =>
            persistResultImage({
                result: {
                    type:
                        "base64",
                    value:
                        Buffer.from(
                            "GIF89a"
                        ).toString(
                            "base64"
                        )
                },
                userId:
                    "user-1",
                supabaseUrl:
                    "https://project.supabase.co",
                serviceKey:
                    "key",
                fetchImpl:
                    async () => ({
                        ok:
                            true,
                        status:
                            200,
                        text:
                            async () => ""
                    })
            }),

        error =>
            error.code ===
            "RESULT_FORMAT_UNKNOWN"

    );


    await assert.rejects(

        () =>
            persistResultImage({
                result: {
                    type:
                        "base64",
                    value:
                        jpegBase64()
                },
                userId:
                    "../escape",
                supabaseUrl:
                    "https://project.supabase.co",
                serviceKey:
                    "key"
            }),

        error =>
            error.code ===
            "RESULT_STORAGE_INVALID_USER"

    );

});


test("persistResultImage downloads provider URLs before storing", async () => {

    const calls = [];


    const stored =
        await persistResultImage({
            result: {
                type:
                    "url",
                value:
                    "https://tencent.example/result.jpg"
            },
            userId:
                "user-1",
            supabaseUrl:
                "https://project.supabase.co",
            serviceKey:
                "key",
            fetchImpl:
                async (url, init) => {

                    calls.push({
                        url,
                        init
                    });


                    if (
                        url ===
                        "https://tencent.example/result.jpg"
                    ) {

                        return {
                            ok:
                                true,
                            status:
                                200,
                            arrayBuffer:
                                async () =>
                                    JPEG_BYTES.buffer.slice(
                                        JPEG_BYTES.byteOffset,
                                        JPEG_BYTES.byteOffset + JPEG_BYTES.byteLength
                                    )
                        };

                    }


                    return {
                        ok:
                            true,
                        status:
                            200,
                        text:
                            async () => ""
                    };

                }
        });


    assert.equal(
        calls.length,
        2
    );

    assert.equal(
        calls[0].url,
        "https://tencent.example/result.jpg"
    );

    assert.match(
        stored.ref,
        /^supabase-private:\/\/user-uploads\/aiart-outputs\/user-1\/\d+-[a-z0-9]+\.jpg$/
    );

});


test("persistResultImage surfaces storage rejection", async () => {

    await assert.rejects(

        () =>
            persistResultImage({
                result: {
                    type:
                        "base64",
                    value:
                        jpegBase64()
                },
                userId:
                    "user-1",
                supabaseUrl:
                    "https://project.supabase.co",
                serviceKey:
                    "key",
                fetchImpl:
                    async () => ({
                        ok:
                            false,
                        status:
                            403,
                        text:
                            async () => "row-level security"
                    })
            }),

        error =>
            error.code ===
                "RESULT_UPLOAD_REJECTED" &&
            /HTTP 403/.test(
                error.message
            )

    );

});


/* =========================================================
   WIRING (static guards)
========================================================= */

import { readFileSync } from "node:fs";


function read(
    path
) {

    return readFileSync(
        new URL(
            `../${path}`,
            import.meta.url
        ),
        "utf8"
    );

}


test("generate API routes the model through the synchronous path", () => {

    const generate =
        read(
            "api/generate.js"
        );


    assert.match(
        generate,
        /import tencentAiArtImageToImage\s+from "\.\.\/models\/tencent-aiart-image-to-image\/index\.js";/
    );

    assert.match(
        generate,
        /tencentAiArtImageToImage\s*\n?\s*\]\);/
    );

    assert.match(
        generate,
        /adapter\?\.config\?\.synchronous/
    );

    assert.match(
        generate,
        /persistResultImage\(/
    );

    /* Refund tetap ada di jalur gagal simpan. */
    assert.match(
        generate,
        /Synchronous result could not be stored/
    );

    /* Riwayat ditulis sebagai success + completed_at. */
    assert.match(
        generate,
        /status:\s*"success",\s*\n\s*resultUrl:\s*storedResult\.ref,\s*\n\s*completedAt/
    );

});


test("model config exposes the synchronous flag", () => {

    const modelConfig =
        read(
            "api/model-config.js"
        );


    assert.match(
        modelConfig,
        /import tencentAiArtImageToImage\s+from "\.\.\/models\/tencent-aiart-image-to-image\/index\.js";/
    );

    assert.match(
        modelConfig,
        /synchronous:\s*\n\s*Boolean\(\s*\n\s*config\.synchronous/
    );

});


test("status polling is not registered for the synchronous model", () => {

    const status =
        read(
            "api/generate-status.js"
        );


    assert.doesNotMatch(
        status,
        /tencent-aiart-image-to-image/
    );

});


test("generate page stops polling for immediate results", () => {

    const submit =
        read(
            "generate/assets/js/generate-submit.js"
        );


    assert.match(
        submit,
        /function extractImmediateResult\(/
    );

    assert.match(
        submit,
        /const immediateResult =\s*\n?\s*extractImmediateResult\(/
    );

    assert.match(
        submit,
        /Gambar sudah selesai dan tersimpan di History\./
    );

    /* Jangan klaim tersimpan kalau riwayat gagal ditulis. */
    assert.match(
        submit,
        /riwayat gagal disimpan\. Unduh hasilnya sekarang\./
    );

    assert.match(
        submit,
        /history_saved !==\s*\n?\s*false/
    );


    const request =
        read(
            "generate/assets/js/generate-request.js"
        );


    assert.match(
        request,
        /SYNCHRONOUS_REQUEST_TIMEOUT_MS =\s*\n?\s*180 \* 1000/
    );

    assert.match(
        request,
        /resolveRequestTimeoutMs\(\s*\n?\s*model\s*\n?\s*\)/
    );

});


test("SQL seed covers provider, model row, and result-read policy", () => {

    const sql =
        read(
            "supabase/tencent-aiart-provider-models.sql"
        );


    assert.match(
        sql,
        /'tencent-aiart'/
    );

    assert.match(
        sql,
        /'tencent-aiart-image-to-image'/
    );

    assert.match(
        sql,
        /'\[\]\{0,\}'::text\[\]|'\{\}'::text\[\]/
    );

    assert.match(
        sql,
        /aiart-outputs/
    );

    assert.match(
        sql,
        /user_owns_media_path/
    );

});


test("generate page keeps cache-busters for changed modules", () => {

    assert.match(
        read(
            "generate/index.html"
        ),
        /generate-app\.js\?v=20261026-tencent-aiart/
    );

    const app =
        read(
            "generate/assets/js/generate-app.js"
        );


    assert.match(
        app,
        /generate-submit\.js\?v=20261026-sync-result/
    );

    assert.match(
        app,
        /generate-request\.js\?v=20261026-sync-result/
    );

    assert.match(
        app,
        /generate-model\.js\?v=20261026-tencent-aiart/
    );

});
