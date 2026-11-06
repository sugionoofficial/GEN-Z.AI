/* OpenClips marketplace model adapter factory (image + video). */

import {
    OPENCLIPS_PROVIDER_ID,
    OPENCLIPS_PROVIDER_NAME,
    createOpenClipsMarketplaceTask,
    getOpenClipsMarketplaceTask
} from "../../provider/openclips/client.js";

function cleanString(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

function sourceOf(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    if (input.parameters && typeof input.parameters === "object" && !Array.isArray(input.parameters)) {
        return { ...input, ...input.parameters };
    }
    return input;
}

function normalizeBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === 1) return true;
    if (value === 0) return false;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return fallback;
}

function normalizeUrls(value) {
    const raw = Array.isArray(value) ? value : cleanString(value) ? [value] : [];
    return raw.map(item => cleanString(item?.url || item)).filter(Boolean);
}

function validHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

function choice(value, choices, fallback) {
    const normalized = cleanString(value);
    return choices.includes(normalized) ? normalized : fallback;
}

function buildParameters(spec) {
    const parameters = {
        prompt: {
            type: "textarea",
            required: true,
            maxLength: 100000,
            label: spec.mediaType === "image" ? "Prompt Gambar" : "Prompt Video",
            description: spec.mediaType === "image"
                ? "Deskripsikan gambar hasil atau perubahan pada gambar referensi."
                : "Deskripsikan adegan, subjek, gerakan, pencahayaan, dan kamera."
        },
        aspect_ratio: {
            type: "enum",
            required: false,
            enum: spec.ratios,
            default: spec.defaultRatio,
            label: "Rasio Aspek",
            description: "Rasio aspek output yang didukung kontrak model OpenClips."
        }
    };

    if (spec.mediaType === "video") {
        parameters.duration = {
            type: "enum",
            required: false,
            enum: spec.durations,
            default: spec.defaultDuration,
            label: "Durasi (detik)",
            description: `Durasi ${spec.minDuration}–${spec.maxDuration} detik sesuai pilihan yang tersedia.`
        };
        parameters.resolution = {
            type: "enum",
            required: false,
            enum: spec.resolutions,
            default: spec.defaultResolution,
            label: "Resolusi",
            description: "Resolusi video yang dikirim ke OpenClips."
        };
        parameters.generate_audio = {
            type: "boolean",
            required: false,
            default: spec.defaultGenerateAudio,
            label: "Generate Audio",
            description: "Gunakan audio native dari model (dialog/efek/musik sesuai prompt)."
        };
        parameters.image_role = {
            type: "enum",
            required: false,
            enum: spec.imageRoles,
            default: spec.defaultImageRole,
            label: "Peran Gambar Referensi",
            description: "Tentukan apakah gambar menjadi first-frame, first-last, atau reference. Jangan memilih peran yang tidak sesuai maksud media."
        };
    } else {
        parameters.size = {
            type: "enum",
            required: false,
            enum: spec.sizes,
            default: spec.defaultSize,
            label: "Ukuran Gambar",
            description: "Preset ukuran dari kontrak Seedream OpenClips."
        };
    }

    if (spec.outputFormats.length) {
        parameters.output_format = {
            type: "enum",
            required: false,
            enum: spec.outputFormats,
            default: spec.defaultOutputFormat,
            label: "Format Output",
            description: "Format file hasil generation."
        };
    }

    parameters.image_urls = {
        type: "image_urls",
        required: false,
        maxItems: spec.maxReferences,
        accept: "image/jpeg,image/png,image/webp",
        label: `Gambar Referensi (Opsional, maks ${spec.maxReferences})`,
        description: spec.mediaType === "image"
            ? "URL gambar referensi, urutan tetap dipertahankan. Kosongkan untuk text-to-image."
            : "URL gambar referensi/frame. Pilih image_role yang sesuai; urutan media dipertahankan."
    };
    return parameters;
}

function buildConfig(spec, parameters) {
    const isImage = spec.mediaType === "image";
    return {
        id: spec.id,
        name: spec.name,
        logo: spec.logo,
        provider: OPENCLIPS_PROVIDER_ID,
        providerId: OPENCLIPS_PROVIDER_ID,
        providerName: OPENCLIPS_PROVIDER_NAME,
        media_type: spec.mediaType,
        mediaType: spec.mediaType,
        generationType: spec.mediaType,
        category: isImage ? "image-generation" : "video-generation",
        type: isImage ? "image-generation" : "text-to-video",
        version: "1.0",
        upstreamModel: spec.upstreamModel,
        openclipsModel: spec.upstreamModel,
        description: spec.description,
        supportedRatios: [...spec.ratios],
        supportedResolutions: isImage ? [] : [...spec.resolutions],
        supportedDurations: isImage ? [] : [...spec.durations],
        minDuration: isImage ? null : spec.minDuration,
        maxDuration: isImage ? null : spec.maxDuration,
        capabilities: {
            textToImage: isImage,
            imageToImage: isImage,
            textToVideo: !isImage,
            imageToVideo: !isImage,
            maxReferenceImages: spec.maxReferences,
            aspectRatios: [...spec.ratios],
            resolutions: isImage ? [] : [...spec.resolutions],
            durations: isImage ? [] : [...spec.durations],
            minDuration: isImage ? null : spec.minDuration,
            maxDuration: isImage ? null : spec.maxDuration
        },
        adminDefaults: {
            ...spec.defaultCredits,
            discount_percent: 0,
            status: "active"
        },
        adminEditor: {
            resolutionIndependent: isImage,
            hideParameterSummary: false,
            hiddenCreditFields: isImage ? ["credit_720p", "credit_1080p"] : [],
            ...(isImage ? {} : {
                selectableDurations: true,
                durationOptions: spec.durations.map(value => ({ value, label: `${value} detik` })),
                resolutionOptions: spec.resolutions.map(value => ({ value, label: value }))
            }),
            creditFields: {
                credit_480p: { label: isImage ? "Credit per Gambar" : "Credit 480p" },
                credit_720p: { label: "Credit 720p" },
                credit_1080p: { label: "Credit 1080p" }
            }
        },
        defaults: Object.fromEntries(
            Object.entries(parameters)
                .filter(([, definition]) => definition.default !== undefined)
                .map(([key, definition]) => [key, definition.default])
        )
    };
}

export function createOpenClipsModel(spec) {
    const parameters = buildParameters(spec);
    const config = buildConfig(spec, parameters);

    function sanitizeParameters(input = {}) {
        const source = sourceOf(input);
        const clean = {
            prompt: cleanString(source.prompt),
            aspect_ratio: choice(source.aspect_ratio ?? source.aspectRatio, spec.ratios, spec.defaultRatio),
            image_urls: normalizeUrls(source.image_urls ?? source.images ?? source.image_url).slice(0, spec.maxReferences)
        };
        if (spec.mediaType === "video") {
            clean.duration = choice(source.duration, spec.durations, spec.defaultDuration);
            clean.resolution = choice(source.resolution, spec.resolutions, spec.defaultResolution);
            clean.generate_audio = normalizeBoolean(source.generate_audio ?? source.generateAudio, spec.defaultGenerateAudio);
            clean.image_role = choice(source.image_role ?? source.imageRole, spec.imageRoles, spec.defaultImageRole);
        } else {
            clean.size = choice(source.size, spec.sizes, spec.defaultSize);
        }
        if (spec.outputFormats.length) {
            clean.output_format = choice(source.output_format ?? source.outputFormat, spec.outputFormats, spec.defaultOutputFormat);
        }
        return clean;
    }

    function getParameters(input = {}) {
        return sanitizeParameters(input);
    }

    function validate(input = {}) {
        const source = sourceOf(input);
        const params = sanitizeParameters(input);
        const errors = [];
        const rawUrls = normalizeUrls(source.image_urls ?? source.images ?? source.image_url);
        if (!params.prompt) errors.push("Prompt wajib diisi.");
        if (params.prompt.length > 100000) errors.push("Prompt maksimal 100.000 karakter.");
        if (rawUrls.length > spec.maxReferences) {
            errors.push(`Maksimal ${spec.maxReferences} gambar referensi.`);
        }
        for (const [index, url] of rawUrls.entries()) {
            if (!validHttpUrl(url)) errors.push(`Gambar referensi #${index + 1} harus berupa URL HTTP(S) publik.`);
        }

        const rawRatio = cleanString(source.aspect_ratio ?? source.aspectRatio);
        if (rawRatio && !spec.ratios.includes(rawRatio)) {
            errors.push(`Rasio aspek tidak didukung. Pilihan: ${spec.ratios.join(", ")}.`);
        }
        const rawOutputFormat = cleanString(source.output_format ?? source.outputFormat);
        if (rawOutputFormat && spec.outputFormats.length && !spec.outputFormats.includes(rawOutputFormat)) {
            errors.push(`Format output tidak didukung. Pilihan: ${spec.outputFormats.join(", ")}.`);
        }

        if (spec.mediaType === "video") {
            const rawGenerateAudio = source.generate_audio ?? source.generateAudio;
            if (
                rawGenerateAudio !== undefined &&
                rawGenerateAudio !== null &&
                cleanString(rawGenerateAudio) &&
                normalizeBoolean(rawGenerateAudio, null) === null
            ) {
                errors.push("Generate audio harus berupa boolean true/false.");
            }
            const rawDuration = cleanString(source.duration);
            const duration = Number(rawDuration || params.duration);
            if (!Number.isInteger(duration) || duration < spec.minDuration || duration > spec.maxDuration || (rawDuration && !spec.durations.includes(rawDuration))) {
                errors.push(`Durasi harus salah satu dari: ${spec.durations.join(", ")} detik.`);
            }
            const rawResolution = cleanString(source.resolution);
            if (rawResolution && !spec.resolutions.includes(rawResolution)) {
                errors.push(`Resolusi tidak didukung. Pilihan: ${spec.resolutions.join(", ")}.`);
            }
            const rawImageRole = cleanString(source.image_role ?? source.imageRole);
            if (rawImageRole && !spec.imageRoles.includes(rawImageRole)) {
                errors.push(`Peran gambar tidak didukung. Pilihan: ${spec.imageRoles.join(", ")}.`);
            }
        } else {
            const rawSize = cleanString(source.size);
            if (rawSize && !spec.sizes.includes(rawSize)) {
                errors.push(`Ukuran gambar tidak didukung. Pilihan: ${spec.sizes.join(", ")}.`);
            }
        }
        return { valid: errors.length === 0, errors };
    }

    function buildPayload(input = {}) {
        const params = sanitizeParameters(input);
        const payload = {
            model: spec.upstreamModel,
            prompt: params.prompt,
            params: {
                aspectRatio: params.aspect_ratio
            }
        };
        if (params.image_urls.length) payload.images = [...params.image_urls];
        if (spec.mediaType === "video") {
            payload.params.duration = Number(params.duration);
            payload.params.resolution = params.resolution;
            payload.params.generateAudio = params.generate_audio;
            if (params.image_urls.length) payload.params.imageRole = params.image_role;
        } else {
            payload.params.size = params.size;
        }
        if (spec.outputFormats.length) payload.params.outputFormat = params.output_format;
        return payload;
    }

    async function createTask(input = {}, credential, options = {}) {
        const validation = validate(input);
        if (!validation.valid) {
            const error = new Error(validation.errors.join(" "));
            error.code = "INVALID_MODEL_INPUT";
            error.status = 400;
            error.provider = OPENCLIPS_PROVIDER_ID;
            error.model = spec.id;
            error.validationErrors = validation.errors;
            throw error;
        }
        const payload = buildPayload(input);
        const response = await createOpenClipsMarketplaceTask(payload, credential, {
            ...options,
            mediaType: spec.mediaType
        });
        if (!response?.taskId) {
            const error = new Error("OpenClips tidak mengembalikan task ID.");
            error.code = "MISSING_TASK_ID";
            error.provider = OPENCLIPS_PROVIDER_ID;
            error.model = spec.id;
            throw error;
        }
        return {
            ...response,
            success: true,
            provider: OPENCLIPS_PROVIDER_ID,
            providerName: OPENCLIPS_PROVIDER_NAME,
            mediaType: spec.mediaType,
            model: spec.id,
            openclips_model: spec.upstreamModel,
            task_id: response.taskId,
            jobId: response.jobId || response.taskId,
            job_id: response.jobId || response.taskId,
            payload
        };
    }

    async function queryTask(taskId, credential, options = {}) {
        if (!cleanString(taskId)) {
            const error = new Error("Task ID OpenClips wajib diisi.");
            error.code = "TASK_ID_MISSING";
            throw error;
        }
        const result = await getOpenClipsMarketplaceTask(taskId, credential, {
            ...options,
            mediaType: spec.mediaType
        });
        return {
            ...result,
            model: spec.id,
            openclips_model: spec.upstreamModel,
            mediaType: spec.mediaType,
            ...(spec.mediaType === "image" ? { imageUrls: result.outputUrls } : {})
        };
    }

    return {
        id: config.id,
        name: config.name,
        logo: config.logo,
        provider: config.provider,
        providerId: config.providerId,
        providerName: config.providerName,
        mediaType: config.mediaType,
        generationType: config.generationType,
        category: config.category,
        capabilities: config.capabilities,
        adminDefaults: config.adminDefaults,
        adminEditor: config.adminEditor,
        defaults: config.defaults,
        config,
        parameters,
        validate,
        validateParameters: validate,
        sanitizeParameters,
        getParameters,
        buildPayload,
        createTask,
        queryTask,
        getTask: queryTask,
        isCompleted: result => result?.status === "COMPLETED",
        isFailed: result => result?.status === "FAILED",
        isProcessing: result => ["QUEUED", "PROCESSING"].includes(result?.status)
    };
}

export default createOpenClipsModel;
