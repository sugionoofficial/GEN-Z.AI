const OPENKEY_ENDPOINT =
    "/api/openkey-chat";

const OPENKEY_TIMEOUT =
    120000;

const MAX_VIDEO_FRAMES =
    3;

const DOCUMENTED_VISION_MODELS =
    new Set([
        "grok-4.5",
        "grok-4.6",
        "qwen3-vl-max"
    ]);


function getModelId(model) {

    return String(
        model?.model_id ||
        model?.id ||
        ""
    ).trim();
}


function collectCapabilityValues(value, values = []) {

    if (
        value === null ||
        value === undefined
    ) {

        return values;
    }


    if (Array.isArray(value)) {

        value.forEach(
            item => collectCapabilityValues(
                item,
                values
            )
        );

        return values;
    }


    if (typeof value === "object") {

        Object.entries(value).forEach(
            ([key, item]) => {

                values.push(
                    String(key).toLowerCase()
                );

                collectCapabilityValues(
                    item,
                    values
                );
            }
        );

        return values;
    }


    values.push(
        String(value).toLowerCase()
    );

    return values;
}


function supportsImageInput(model) {

    const capabilityFields = [
        model?.input_modalities,
        model?.inputModalities,
        model?.modalities,
        model?.modality,
        model?.capabilities,
        model?.architecture,
        model?.raw?.input_modalities,
        model?.raw?.inputModalities,
        model?.raw?.modalities,
        model?.raw?.modality,
        model?.raw?.capabilities,
        model?.raw?.architecture
    ];

    const capabilities =
        capabilityFields.flatMap(
            value => collectCapabilityValues(value)
        );

    return (
        capabilities.some(
            value => /(^|[^a-z])(image|images|vision|visual|multimodal)([^a-z]|$)/i.test(value)
        ) ||
        DOCUMENTED_VISION_MODELS.has(
            getModelId(model).toLowerCase()
        )
    );
}


export function selectVisionModel(models) {

    if (!Array.isArray(models)) {
        return null;
    }


    return models.find(
        model =>
            getModelId(model) &&
            supportsImageInput(model)
    ) || null;
}


export function parseOpenKeyAnalysis(content) {

    const text =
        Array.isArray(content)
            ? content
                .map(part => (
                    typeof part?.text === "string"
                        ? part.text
                        : ""
                ))
                .filter(Boolean)
                .join("\n")
            : String(content || "");

    const trimmed =
        text.trim();

    const jsonText =
        trimmed
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

    let parsed;

    try {

        parsed = JSON.parse(jsonText);

    } catch {

        return {
            verdict: "uncertain",
            confidence: null,
            summary: trimmed.slice(0, 1600),
            evidence: []
        };
    }


    const verdictAliases = {
        likely_ai: "likely_ai",
        ai: "likely_ai",
        likely_not_ai: "likely_not_ai",
        not_ai: "likely_not_ai",
        uncertain: "uncertain",
        inconclusive: "uncertain"
    };

    const verdict =
        verdictAliases[
            String(parsed?.verdict || "")
                .trim()
                .toLowerCase()
        ] || "uncertain";

    let confidence =
        Number(parsed?.confidence);

    if (Number.isFinite(confidence)) {

        if (confidence > 0 && confidence <= 1) {
            confidence *= 100;
        }

        confidence = Math.round(
            Math.min(100, Math.max(0, confidence))
        );

    } else {

        confidence = null;
    }


    const summary =
        typeof parsed?.summary === "string"
            ? parsed.summary.trim().slice(0, 1600)
            : "";

    const evidence =
        Array.isArray(parsed?.evidence)
            ? parsed.evidence
                .filter(item => typeof item === "string")
                .map(item => item.trim().slice(0, 300))
                .filter(Boolean)
                .slice(0, 8)
            : [];

    return {
        verdict,
        confidence,
        summary,
        evidence
    };
}


async function getAccessToken() {

    const client =
        window.GENZ_SUPABASE ||
        window.supabaseClient;

    if (
        !client?.auth ||
        typeof client.auth.getSession !== "function"
    ) {

        throw new Error(
            "Supabase client belum siap. Muat ulang halaman lalu coba lagi."
        );
    }


    const result =
        await client.auth.getSession();

    if (result?.error) {
        throw result.error;
    }


    const token =
        result?.data?.session?.access_token;

    if (!token) {
        throw new Error(
            "Silakan masuk untuk menggunakan pemeriksaan OpenKey."
        );
    }


    return token;
}


async function requestOpenKey(body, token) {

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            () => controller.abort(),
            OPENKEY_TIMEOUT
        );

    try {

        const response =
            await fetch(
                OPENKEY_ENDPOINT,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal
                }
            );

        let data;

        try {

            data = await response.json();

        } catch (error) {

            throw new Error(
                `Response OpenKey tidak valid (${response.status}).`
            );
        }


        if (!response.ok || data?.success === false) {
            throw new Error(
                data?.error ||
                `Request OpenKey gagal (${response.status}).`
            );
        }


        return data;

    } catch (error) {

        if (error?.name === "AbortError") {
            throw new Error(
                "Pemeriksaan OpenKey melewati batas waktu."
            );
        }

        throw error;

    } finally {

        clearTimeout(timeoutId);
    }
}


function blobToDataUrl(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload = () => {

                if (typeof reader.result !== "string") {
                    reject(
                        new Error("Browser gagal menyiapkan gambar untuk OpenKey.")
                    );
                    return;
                }

                resolve(reader.result);
            };

            reader.onerror = () => reject(
                reader.error ||
                new Error("Gambar tidak dapat dibaca.")
            );

            reader.readAsDataURL(blob);
        }
    );
}


async function encodeCanvas(canvas, quality) {

    const blob =
        await new Promise(
            (resolve, reject) => {

                canvas.toBlob(
                    result => {

                        if (!result) {
                            reject(
                                new Error("Browser gagal mengubah media menjadi frame gambar.")
                            );
                            return;
                        }

                        resolve(result);
                    },
                    "image/jpeg",
                    quality
                );
            }
        );

    return blobToDataUrl(blob);
}


async function createImageDataUrl(file) {

    if (typeof createImageBitmap !== "function") {
        throw new Error(
            "Browser ini tidak mendukung pemrosesan gambar OpenKey."
        );
    }


    const bitmap =
        await createImageBitmap(file);

    try {

        const scale =
            Math.min(
                1,
                1024 / Math.max(bitmap.width, bitmap.height)
            );

        const canvas =
            document.createElement("canvas");

        canvas.width =
            Math.max(1, Math.round(bitmap.width * scale));

        canvas.height =
            Math.max(1, Math.round(bitmap.height * scale));

        const context =
            canvas.getContext("2d");

        if (!context) {
            throw new Error("Canvas browser tidak tersedia.");
        }

        context.drawImage(
            bitmap,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return await encodeCanvas(canvas, 0.72);

    } finally {

        bitmap.close?.();
    }
}


function waitForVideoEvent(video, eventName, timeoutMessage) {

    return new Promise(
        (resolve, reject) => {

            const timeoutId =
                setTimeout(
                    () => {

                        cleanup();
                        reject(new Error(timeoutMessage));
                    },
                    10000
                );

            const cleanup = () => {

                clearTimeout(timeoutId);
                video.removeEventListener(eventName, onSuccess);
                video.removeEventListener("error", onError);
            };

            const onSuccess = () => {

                cleanup();
                resolve();
            };

            const onError = () => {

                cleanup();
                reject(new Error("Video tidak dapat dibaca browser."));
            };

            video.addEventListener(eventName, onSuccess, { once: true });
            video.addEventListener("error", onError, { once: true });
        }
    );
}


async function createVideoFrameDataUrls(file) {

    const video =
        document.createElement("video");

    const objectUrl =
        URL.createObjectURL(file);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    try {

        const metadataLoaded =
            waitForVideoEvent(
                video,
                "loadedmetadata",
                "Browser gagal membaca durasi video."
            );

        video.src = objectUrl;
        await metadataLoaded;

        const duration =
            Number(video.duration);

        if (!Number.isFinite(duration) || duration <= 0) {
            throw new Error(
                "Durasi video tidak tersedia untuk pengambilan frame."
            );
        }


        const timestamps =
            duration < 0.5
                ? [duration / 2]
                : [0.2, 0.5, 0.8].map(
                    fraction => Math.min(
                        Math.max(0.05, duration * fraction),
                        Math.max(0.05, duration - 0.05)
                    )
                );

        const frames = [];

        for (
            const [index, timestamp]
            of timestamps.slice(0, MAX_VIDEO_FRAMES).entries()
        ) {

            const seeked =
                waitForVideoEvent(
                    video,
                    "seeked",
                    `Browser gagal mengambil frame video ${index + 1}.`
                );

            video.currentTime = timestamp;
            await seeked;

            const sourceWidth =
                Number(video.videoWidth);

            const sourceHeight =
                Number(video.videoHeight);

            if (!sourceWidth || !sourceHeight) {
                throw new Error(
                    "Ukuran frame video tidak tersedia."
                );
            }

            const scale =
                Math.min(
                    1,
                    640 / Math.max(sourceWidth, sourceHeight)
                );

            const canvas =
                document.createElement("canvas");

            canvas.width =
                Math.max(1, Math.round(sourceWidth * scale));

            canvas.height =
                Math.max(1, Math.round(sourceHeight * scale));

            const context =
                canvas.getContext("2d");

            if (!context) {
                throw new Error("Canvas browser tidak tersedia.");
            }

            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );

            frames.push({
                timestamp,
                dataUrl: await encodeCanvas(canvas, 0.58)
            });
        }


        return frames;

    } finally {

        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(objectUrl);
    }
}


function getRelevantMetadata(indicators, provenance) {

    const relevant =
        (Array.isArray(indicators) ? indicators : [])
            .map(item => ({
                field: String(item?.field || "AI indicator").slice(0, 120),
                value: String(item?.value || item?.keyword || "").slice(0, 240)
            }))
            .slice(0, 20);

    const provenanceSummary =
        provenance?.detected
            ? {
                detected: true,
                format: String(provenance.format || "unknown"),
                status: String(provenance.status || "DETECTED"),
                aiDisclosure: String(provenance.aiDisclosure || "").slice(0, 240)
            }
            : null;

    return {
        aiMetadataIndicators: relevant,
        provenance: provenanceSummary
    };
}


export function getMessageContent(response) {

    if (typeof response?.content === "string") {
        return response.content;
    }

    if (Array.isArray(response?.content)) {
        return response.content;
    }

    if (
        typeof response?.message?.content === "string" ||
        Array.isArray(response?.message?.content)
    ) {
        return response.message.content;
    }

    const message =
        response?.choices?.[0]?.message;

    if (message?.content !== undefined) {
        return message.content;
    }

    if (typeof response?.output_text === "string") {
        return response.output_text;
    }

    throw new Error(
        "OpenKey tidak mengembalikan hasil analisis yang dapat dibaca."
    );
}


export async function detectOpenKeyMedia(
    file,
    fileType,
    indicators = [],
    provenance = null
) {

    if (!file) {
        throw new Error("File media tidak tersedia.");
    }


    const token =
        await getAccessToken();

    const catalog =
        await requestOpenKey(
            { operation: "openkey_models" },
            token
        );

    const model =
        selectVisionModel(catalog?.models);

    if (!model) {
        throw new Error(
            "OpenKey tidak menyediakan model dengan dukungan input gambar."
        );
    }


    const visualInputs =
        fileType === "image"
            ? [{
                label: "Gambar",
                dataUrl: await createImageDataUrl(file)
            }]
            : await createVideoFrameDataUrls(file);

    if (visualInputs.length === 0) {
        throw new Error("Tidak ada frame video yang dapat dianalisis.");
    }


    const content = [
        {
            type: "text",
            text: [
                "Nilai apakah gambar atau cuplikan frame berikut menunjukkan media yang kemungkinan dibuat atau dimodifikasi secara generatif oleh AI.",
                "Gunakan hanya bukti visual yang tampak. Jangan menyimpulkan kepastian hanya dari gaya visual.",
                "Untuk video, analisis semua frame berurutan dan catat bila kesimpulannya tidak pasti karena hanya sebagian frame yang dikirim.",
                "Metadata berikut adalah petunjuk tambahan, bukan bukti visual dan bukan verifikasi kriptografis:",
                JSON.stringify(
                    getRelevantMetadata(
                        indicators,
                        provenance
                    )
                ),
                'Balas hanya JSON valid dengan bentuk {"verdict":"likely_ai|likely_not_ai|uncertain","confidence":0-100,"summary":"ringkasan singkat Bahasa Indonesia","evidence":["bukti yang terlihat"]}.',
                "Jangan pernah mengklaim hasil sebagai kepastian atau sebagai hasil deteksi forensik."
            ].join("\n")
        },
        ...visualInputs.flatMap(
            (input, index) => [
                {
                    type: "text",
                    text: fileType === "video"
                        ? `Frame ${index + 1}, sekitar detik ${input.timestamp.toFixed(2)}.`
                        : input.label
                },
                {
                    type: "image_url",
                    image_url: {
                        url: input.dataUrl,
                        detail: "low"
                    }
                }
            ]
        )
    ];

    const response =
        await requestOpenKey(
            {
                model: getModelId(model),
                messages: [
                    {
                        role: "system",
                        content: "Anda adalah pemeriksa indikasi media generatif. Bersikap konservatif, sebutkan keterbatasan, dan jangan mengarang bukti."
                    },
                    {
                        role: "user",
                        content
                    }
                ],
                temperature: 0.1,
                max_tokens: 600,
                stream: false
            },
            token
        );

    return {
        ...parseOpenKeyAnalysis(
            getMessageContent(response)
        ),
        model: getModelId(model),
        frameCount: visualInputs.length,
        status: "complete"
    };
}


export function renderOpenKeyResult(result) {

    const container =
        document.getElementById(
            "metadata-openkey-result"
        );

    if (!container) {
        return;
    }


    container.replaceChildren();

    if (!result) {
        container.hidden = true;
        return;
    }


    container.hidden = false;

    const heading =
        document.createElement("h3");

    const summary =
        document.createElement("p");

    const details =
        document.createElement("p");

    heading.className =
        "metadata-openkey-result-title";

    summary.className =
        "metadata-openkey-result-summary";

    details.className =
        "metadata-openkey-result-details";

    if (result.status === "error") {

        heading.textContent =
            "OPENKEY AI CHECK TIDAK TERSEDIA";

        summary.textContent =
            result.message ||
            "Pemeriksaan visual OpenKey gagal.";

        details.textContent =
            "Hasil metadata lokal tetap ditampilkan terpisah.";

        container.append(
            heading,
            summary,
            details
        );

        return;
    }


    const verdictLabels = {
        likely_ai: "ADA INDIKASI VISUAL AI",
        likely_not_ai: "TIDAK ADA INDIKASI VISUAL AI",
        uncertain: "HASIL VISUAL BELUM KONKLUSIF"
    };

    heading.textContent =
        verdictLabels[result.verdict] ||
        verdictLabels.uncertain;

    summary.textContent =
        result.summary ||
        "OpenKey tidak memberikan ringkasan.";

    details.textContent = [
        result.confidence === null
            ? "Confidence tidak tersedia"
            : `Confidence model: ${result.confidence}%`,
        result.model
            ? `Model: ${result.model}`
            : "",
        result.frameCount
            ? `Frame diperiksa: ${result.frameCount}`
            : ""
    ]
        .filter(Boolean)
        .join(" · ");

    container.append(
        heading,
        summary,
        details
    );


    if (
        Array.isArray(result.evidence) &&
        result.evidence.length > 0
    ) {

        const list =
            document.createElement("ul");

        list.className =
            "metadata-openkey-result-evidence";

        result.evidence.forEach(
            item => {

                const listItem =
                    document.createElement("li");

                listItem.textContent = item;
                list.append(listItem);
            }
        );

        container.append(list);
    }
}
