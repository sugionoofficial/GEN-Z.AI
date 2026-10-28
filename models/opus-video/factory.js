/* =========================================================
   GEN-Z.AI
   OPUS LABS VIDEO — MODEL ADAPTER FACTORY
   ---------------------------------------------------------
   File:
     models/opus-video/factory.js

   Membangun adapter lengkap (config, parameters, validate,
   getParameters, sanitizeParameters, buildPayload,
   createTask, queryTask) dari satu spec Opus Labs MCP.
========================================================= */

import {
    DEFAULT_MCP_URL,
    MAX_REFERENCE_IMAGES,
    PROVIDER_ID,
    PROVIDER_NAME,
    createVideoTask,
    getVideoTask,
    normalizeStatus
} from "../../provider/opus/client.js";

function normalizeString(value) {
    return value === null || value === undefined
        ? ""
        : String(value).trim();
}

function normalizeBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (lower === "true" || lower === "1" || lower === "yes") return true;
        if (lower === "false" || lower === "0" || lower === "no") return false;
    }
    return fallback;
}

function normalizeUrlList(value) {
    const raw = Array.isArray(value)
        ? value
        : typeof value === "string" && value.trim()
            ? [value]
            : [];
    return raw.map(normalizeString).filter(Boolean);
}

function isPublicHttpUrl(value) {
    try {
        const parsed = new URL(String(value || "").trim());
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

function getSource(body = {}) {
    if (
        body &&
        body.parameters &&
        typeof body.parameters === "object" &&
        !Array.isArray(body.parameters)
    ) {
        return body.parameters;
    }
    return body && typeof body === "object" && !Array.isArray(body)
        ? body
        : {};
}

function normalizeHailuoResolution(value, fallback = "768p") {
    const lower = normalizeString(value).toLowerCase().replace(/\s+/g, "");
    if (!lower) return fallback;
    if (lower === "768p" || lower === "768" || lower === "720p" || lower === "720") {
        return "768p";
    }
    if (lower === "2k" || lower === "1080p" || lower === "1080" || lower === "1440p") {
        return "2k";
    }
    return lower;
}

function normalizeSeedanceResolution(value, fallback = "720p") {
    const lower = normalizeString(value).toLowerCase().replace(/\s+/g, "");
    if (!lower) return fallback;
    if (lower === "480" || lower === "480p") return "480p";
    if (lower === "720" || lower === "720p") return "720p";
    return lower;
}

function buildAdminEditorConfig(spec) {
    const isHailuo = spec.opusModel === "hailuo-3";
    if (isHailuo) {
        return {
            hideParameterSummary: true,
            resolutionOptions: [
                { value: "720p", label: "768p" },
                { value: "1080p", label: "2K" }
            ],
            resolutionAliases: {
                "768p": "720p",
                "2k": "1080p"
            },
            hiddenCreditFields: ["credit_480p"]
        };
    }

    return {
        hideParameterSummary: true,
        resolutionOptions: [
            { value: "480p", label: "480p" },
            { value: "720p", label: "720p" }
        ],
        hiddenCreditFields: ["credit_1080p"]
    };
}

function buildParametersForSpec(spec) {
    const parameters = [];
    const maxRefs = spec.maxReferences || MAX_REFERENCE_IMAGES;

    if (spec.kind === "i2v") {
        parameters.push({
            name: "image_url",
            type: "image_url",
            required: true,
            accept: "image/jpeg,image/png,image/webp",
            description: "Gambar frame awal (wajib)."
        });

        if (spec.allowLastFrame) {
            parameters.push({
                name: "last_frame_url",
                type: "image_url",
                required: false,
                accept: "image/jpeg,image/png,image/webp",
                description: "Gambar frame akhir (opsional)."
            });
        }
    } else if (spec.kind === "r2v") {
        parameters.push({
            name: "image_urls",
            type: "image_urls",
            required: Boolean(spec.referenceRequired),
            maxItems: maxRefs,
            accept: "image/jpeg,image/png,image/webp",
            description: spec.referenceRequired
                ? `Unggah 1–${maxRefs} gambar referensi (@image1 s/d @image${maxRefs}).`
                : `Opsional: hingga ${maxRefs} gambar referensi (@image1 s/d @image${maxRefs}).`
        });
    }

    parameters.push({
        name: "prompt",
        type: "string",
        required: true,
        maxLength: spec.maxPrompt || 7000,
        description: spec.kind === "r2v"
            ? "Deskripsi adegan dan gerakan video (gunakan @image1, @image2 untuk merujuk gambar referensi)."
            : "Deskripsi adegan, subjek, pencahayaan, dan pergerakan kamera."
    });

    if (Array.isArray(spec.ratios) && spec.ratios.length > 0) {
        parameters.push({
            name: "aspect_ratio",
            type: "string",
            required: false,
            enum: spec.ratios,
            default: spec.defaultRatio || spec.ratios[0],
            description: "Rasio aspek video."
        });
    }

    if (Array.isArray(spec.resolutions) && spec.resolutions.length > 0) {
        parameters.push({
            name: "resolution",
            type: "string",
            required: false,
            enum: spec.resolutions,
            default: spec.defaultResolution || spec.resolutions[0],
            description: "Resolusi output video."
        });
    }

    if (spec.durationRange) {
        parameters.push({
            name: "duration",
            type: "integer",
            required: false,
            min: spec.durationRange.min,
            max: spec.durationRange.max,
            default: String(spec.defaultDuration || spec.durationRange.min),
            description: `Durasi video ${spec.durationRange.min}–${spec.durationRange.max} detik.`
        });
    }

    if (spec.generateAudio) {
        parameters.push({
            name: "generate_audio",
            type: "boolean",
            required: false,
            default: false,
            description: "Hasilkan dialog, musik, atau efek suara bawaan (Seedance)."
        });
    }

    return parameters;
}

export function createOpusVideoModel(spec) {
    const parameters = buildParametersForSpec(spec);
    const definitions = new Map(parameters.map(param => [param.name, param]));
    const isHailuo = spec.opusModel === "hailuo-3";

    const config = {
        id: spec.id,
        opusModel: spec.opusModel,
        opusModelId: spec.opusModel,
        name: spec.name,
        providerId: PROVIDER_ID,
        providerName: PROVIDER_NAME,
        logo: spec.logo || "seedance.svg",
        type: spec.type,
        kind: spec.kind,
        workflow: spec.workflow || "reference2video",
        adminEditor: buildAdminEditorConfig(spec),
        api: {
            mcpEndpoint: DEFAULT_MCP_URL,
            createTask: "tools/call:generate_video_clips",
            queryTask: "tools/call:get_status"
        }
    };

    function resolveNormalizedResolution(rawValue) {
        const defaultRes = spec.defaultResolution || spec.resolutions?.[0] || "720p";
        return isHailuo
            ? normalizeHailuoResolution(rawValue, defaultRes)
            : normalizeSeedanceResolution(rawValue, defaultRes);
    }

    function getParameters(body = {}) {
        const source = getSource(body);
        const result = {
            prompt: normalizeString(source.prompt)
        };

        if (definitions.has("image_url")) {
            const firstCandidate =
                normalizeString(source.image_url || source.first_frame_url) ||
                normalizeUrlList(source.image_urls)[0] ||
                "";
            result.image_url = firstCandidate;
        }

        if (definitions.has("last_frame_url")) {
            const lastCandidate = normalizeString(source.last_frame_url);
            if (lastCandidate) {
                result.last_frame_url = lastCandidate;
            }
        }

        if (definitions.has("image_urls")) {
            result.image_urls = normalizeUrlList(
                source.image_urls ??
                source.reference_image_urls ??
                (source.image_url ? [source.image_url] : [])
            );
        }

        if (definitions.has("aspect_ratio")) {
            result.aspect_ratio =
                normalizeString(source.aspect_ratio || source.ratio) ||
                definitions.get("aspect_ratio").default;
        }

        if (definitions.has("resolution")) {
            result.resolution = resolveNormalizedResolution(source.resolution);
        }

        if (definitions.has("duration")) {
            const def = definitions.get("duration");
            const rawDur = normalizeString(source.duration);
            result.duration = rawDur || String(def.default);
        }

        if (definitions.has("generate_audio")) {
            result.generate_audio = normalizeBoolean(
                source.generate_audio ?? source.generateAudio,
                false
            );
        }

        return result;
    }

    function sanitizeParameters(body = {}) {
        return getParameters(body);
    }

    function validate(input = {}) {
        const errors = [];
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return {
                valid: false,
                errors: ["Parameter input harus berupa object."]
            };
        }

        const params = getParameters(input);

        if (!params.prompt) {
            errors.push("Prompt wajib diisi.");
        } else if (params.prompt.length > (spec.maxPrompt || 7000)) {
            errors.push(`Prompt maksimal ${spec.maxPrompt || 7000} karakter.`);
        }

        if (definitions.has("image_url")) {
            if (!params.image_url) {
                errors.push("Gambar frame awal wajib diunggah.");
            } else if (!isPublicHttpUrl(params.image_url)) {
                errors.push("image_url harus berupa URL HTTP/HTTPS publik yang valid.");
            }
        }

        if (definitions.has("last_frame_url") && params.last_frame_url) {
            if (!params.image_url) {
                errors.push("Frame akhir membutuhkan gambar frame awal.");
            } else if (!isPublicHttpUrl(params.last_frame_url)) {
                errors.push("last_frame_url harus berupa URL HTTP/HTTPS publik yang valid.");
            }
        }

        if (definitions.has("image_urls")) {
            const maxItems = definitions.get("image_urls").maxItems || MAX_REFERENCE_IMAGES;
            if (spec.referenceRequired && (!params.image_urls || params.image_urls.length === 0)) {
                errors.push("Minimal 1 gambar referensi wajib diunggah untuk model ini.");
            }
            if (params.image_urls.length > maxItems) {
                errors.push(`Maksimal ${maxItems} gambar referensi.`);
            }
            for (const url of params.image_urls) {
                if (!isPublicHttpUrl(url)) {
                    errors.push("Setiap gambar referensi harus berupa URL HTTP/HTTPS publik yang valid.");
                    break;
                }
            }
        }

        if (definitions.has("aspect_ratio") && params.aspect_ratio) {
            const allowedRatios = definitions.get("aspect_ratio").enum;
            if (!allowedRatios.includes(params.aspect_ratio)) {
                errors.push(`Aspect ratio tidak valid. Pilihan: ${allowedRatios.join(", ")}.`);
            }
        }

        if (definitions.has("resolution") && params.resolution) {
            const allowedRes = definitions.get("resolution").enum.map(v => v.toLowerCase());
            if (!allowedRes.includes(params.resolution.toLowerCase())) {
                errors.push(`Resolusi tidak valid. Pilihan: ${definitions.get("resolution").enum.join(", ")}.`);
            }
        }

        if (definitions.has("duration")) {
            const durDef = definitions.get("duration");
            const numDur = Number(params.duration);
            if (!Number.isFinite(numDur) || !Number.isInteger(numDur)) {
                errors.push("Durasi harus berupa angka bulat detik.");
            } else if (numDur < durDef.min || numDur > durDef.max) {
                errors.push(`Durasi harus antara ${durDef.min} dan ${durDef.max} detik.`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function buildPayload(body = {}) {
        const params = getParameters(body);
        const payload = {
            model: spec.opusModel,
            model_aliases: spec.modelAliases || [spec.opusModel],
            workflow: spec.workflow || "reference2video",
            prompt: params.prompt,
            duration: Number(params.duration),
            resolution: params.resolution
        };

        if (params.aspect_ratio) {
            payload.aspect_ratio = params.aspect_ratio;
        }
        if (params.image_url) {
            payload.first_frame_url = params.image_url;
        }
        if (params.last_frame_url) {
            payload.last_frame_url = params.last_frame_url;
        }
        if (Array.isArray(params.image_urls) && params.image_urls.length > 0) {
            payload.reference_image_urls = params.image_urls;
        }
        if (typeof params.generate_audio === "boolean" && spec.generateAudio) {
            payload.generate_audio = params.generate_audio;
        }

        return payload;
    }

    async function createTask(body = {}, apiKey) {
        const validation = validate(body);
        if (!validation.valid) {
            const error = new Error(validation.errors.join(" "));
            error.code = "INVALID_MODEL_INPUT";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            error.validationErrors = validation.errors;
            throw error;
        }

        const payload = buildPayload(body);
        const response = await createVideoTask(payload, apiKey);

        if (!response?.taskId) {
            const error = new Error("Opus Labs tidak mengembalikan taskId video.");
            error.code = "MISSING_TASK_ID";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            throw error;
        }

        return {
            ...response,
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            model: spec.id,
            opus_model: spec.opusModel,
            taskId: response.taskId,
            task_id: response.taskId,
            jobId: response.jobId || response.taskId,
            job_id: response.jobId || response.taskId,
            payload
        };
    }

    function normalizeOutputUrls(data) {
        if (!data || typeof data !== "object") return [];
        const raw = Array.isArray(data.videoUrls)
            ? data.videoUrls
            : Array.isArray(data.outputUrls)
                ? data.outputUrls
                : [];
        return raw.map(normalizeString).filter(isPublicHttpUrl);
    }

    async function queryTask(taskId, apiKey) {
        const normalizedId = normalizeString(taskId);
        if (!normalizedId) {
            const error = new Error("Opus task ID wajib diisi.");
            error.code = "TASK_ID_MISSING";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            throw error;
        }

        const result = await getVideoTask(normalizedId, apiKey);
        const status = normalizeStatus(result.status);
        const outputUrls = status === "COMPLETED" ? normalizeOutputUrls(result) : [];

        /*
         * PENTING untuk api/generate-status.js:
         * `collectUrls(raw)` di generate-status memindai seluruh URL HTTP(S)
         * dan langsung menandai task selesai jika ada URL saat bukan FAILED.
         * Karena itu objek return dan `raw` dijaga agar hanya memuat URL
         * ketika status benar-benar COMPLETED, dan hanya URL video output.
         */
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            model: spec.id,
            id: normalizedId,
            taskId: normalizedId,
            task_id: normalizedId,
            jobId: result.jobId || normalizedId,
            job_id: result.jobId || normalizedId,
            status,
            provider_state: result.providerState || status.toLowerCase(),
            completed: status === "COMPLETED",
            failed: status === "FAILED",
            processing: status === "QUEUED" || status === "PROCESSING",
            outputUrls,
            output_urls: outputUrls,
            outputUrl: outputUrls[0] || null,
            usage: result.usageSeconds ? { duration: result.usageSeconds } : null,
            errorCode: result.errorCode || null,
            error_code: result.errorCode || null,
            errorMessage: result.errorMessage || null,
            error_message: result.errorMessage || null,
            raw: {
                status,
                provider_state: result.providerState || status.toLowerCase(),
                project_id: result.projectId || null,
                job_id: result.jobId || null,
                ...(outputUrls.length ? { video_urls: outputUrls } : {}),
                ...(result.usageSeconds ? { usage: { duration: result.usageSeconds } } : {}),
                ...(result.errorCode ? { error_code: result.errorCode } : {}),
                ...(result.errorMessage ? { error_message: result.errorMessage } : {})
            }
        };
    }

    const isCompleted = res => normalizeStatus(res?.status) === "COMPLETED";
    const isFailed = res => normalizeStatus(res?.status) === "FAILED";
    const isProcessing = res => ["QUEUED", "PROCESSING"].includes(normalizeStatus(res?.status));

    return {
        config,
        parameters,
        validate,
        getParameters,
        sanitizeParameters,
        validateParameters: validate,
        buildPayload,
        createTask,
        queryTask,
        isCompleted,
        isFailed,
        isProcessing,
        normalizeOutputUrls,
        normalizeStatus
    };
}

export default createOpusVideoModel;
