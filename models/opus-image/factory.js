/* =========================================================
   GEN-Z.AI
   OPUS LABS IMAGE — MODEL ADAPTER FACTORY
   ---------------------------------------------------------
   File:
     models/opus-image/factory.js

   Membangun adapter lengkap (config, parameters, validate,
   getParameters, sanitizeParameters, buildPayload, createTask,
   queryTask) untuk setiap model generate gambar Opus Labs MCP:
   - Sub-mode Generate Biasa (`image_mode = "standard"`):
     0–8 gambar referensi (`image_urls`) + `prompt` (wajib)
   - Sub-mode Generate Karakter Sheet (`image_mode = "character_sheet"`):
     `character_image_url` (wajib) + `outfit_image_url` (opsional)
     + `character_notes` (opsional) + Master Prompt otomatis terkunci
   - Flat credit default 500 kredit (editable via `credit_480p`
     di `admin-control/model-edit.html`)
========================================================= */

import {
    DEFAULT_MCP_URL,
    MAX_IMAGE_REFERENCE_IMAGES,
    createImageTask,
    getImageTask,
    normalizeStatus
} from "../../provider/opus/client.js";
import { inspectReferenceMediaUrl } from "../../assets/js/media-url-guard.js";
import {
    CHARACTER_SHEET_DEFAULT_RATIO,
    IMAGE_MODE_CHARACTER_SHEET,
    IMAGE_MODE_STANDARD,
    MAX_CHARACTER_NOTES_LENGTH,
    buildCharacterSheetHistorySummary,
    buildCharacterSheetPrompt,
    normalizeImageSubMode
} from "./character-sheet-prompt.js";
import { DEFAULT_OPUS_IMAGE_CREDIT } from "./specs.js";

const PROVIDER_ID = "opus";
const PROVIDER_NAME = "GEN-Z.AI";
const MAX_PROMPT_LENGTH = 2500;

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isValidImageInputUrl(value) {
    const trimmed = normalizeString(value);
    if (!trimmed) return false;
    if (trimmed.startsWith("supabase-private://")) {
        return true;
    }
    if (/^data:image\/(?:png|jpe?g|webp|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
        return true;
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

function isValidImageOutputUrl(value) {
    const trimmed = normalizeString(value);
    if (!trimmed) return false;
    if (/^data:image\/(?:png|jpe?g|webp|avif|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
        return true;
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

function collectUrlList(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue.map(v => String(v || "").trim()).filter(Boolean);
    }
    if (typeof rawValue === "string" && rawValue.trim()) {
        const text = rawValue.trim();
        if (text.startsWith("[")) {
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                    return parsed.map(v => String(v || "").trim()).filter(Boolean);
                }
            } catch {
                /* lanjut pakai string tunggal */
            }
        }
        return [text];
    }
    return [];
}

function extractSingleImageUrl(rawValue) {
    const list = collectUrlList(rawValue);
    return list[0] || "";
}

function validateReferenceUrl(url, fieldLabel) {
    if (!isValidImageInputUrl(url)) {
        return `${fieldLabel} harus berupa URL gambar yang valid (JPEG, PNG, atau WEBP).`;
    }
    const check = inspectReferenceMediaUrl(url);
    if (!check.valid) {
        return check.reason;
    }
    return null;
}

function extractSourceBody(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return {};
    }
    if (input.parameters && typeof input.parameters === "object" && !Array.isArray(input.parameters)) {
        return {
            ...input,
            ...input.parameters
        };
    }
    return input;
}

export function createOpusImageModel(spec) {
    const supportedRatios = [...(spec.supportedRatios || ["1:1", "16:9", "9:16", "4:3", "3:4"])];
    const defaultStandardRatio = supportedRatios.includes("1:1") ? "1:1" : supportedRatios[0];
    const defaultCharacterRatio = supportedRatios.includes(CHARACTER_SHEET_DEFAULT_RATIO)
        ? CHARACTER_SHEET_DEFAULT_RATIO
        : supportedRatios[0];
    const defaultCredit = Number.isFinite(Number(spec.defaultCredit))
        ? Number(spec.defaultCredit)
        : DEFAULT_OPUS_IMAGE_CREDIT;

    const parameters = {
        image_mode: {
            type: "string",
            required: false,
            default: IMAGE_MODE_STANDARD,
            enum: [IMAGE_MODE_STANDARD, IMAGE_MODE_CHARACTER_SHEET],
            internal: true,
            description: "Sub-mode generate gambar (standard atau character_sheet)."
        },
        image_urls: {
            type: "image_urls",
            required: false,
            maxItems: MAX_IMAGE_REFERENCE_IMAGES,
            subMode: IMAGE_MODE_STANDARD,
            label: "Gambar Referensi (Opsional, Maks 8)",
            description:
                "Opsional: unggah atau pilih hingga 8 gambar referensi untuk menggabungkan karakter, produk, gaya visual, atau komposisi (@image1 s/d @image8). Kosongkan untuk Text-to-Image murni."
        },
        prompt: {
            type: "textarea",
            required: false,
            maxLength: MAX_PROMPT_LENGTH,
            subMode: IMAGE_MODE_STANDARD,
            label: "Prompt Gambar",
            placeholder:
                "Deskripsikan gambar yang ingin dibuat secara detail (subjek, pose, pakaian, pencahayaan, latar, gaya kamera)...",
            description:
                "Tulis deskripsi gambar. Jika mengunggah beberapa gambar referensi, Anda juga dapat menyebut @image1, @image2, dst."
        },
        character_image_url: {
            type: "image_url",
            required: false,
            maxItems: 1,
            subMode: IMAGE_MODE_CHARACTER_SHEET,
            label: "Foto Karakter Utama (Wajib)",
            description:
                "Unggah foto wajah/tubuh karakter utama sebagai acuan identitas wajah, proporsi, gaya rambut, dan warna kulit."
        },
        outfit_image_url: {
            type: "image_url",
            required: false,
            maxItems: 1,
            subMode: IMAGE_MODE_CHARACTER_SHEET,
            label: "Foto Outfit / Pakaian (Opsional)",
            description:
                "Opsional: unggah foto pakaian/outfit jika ingin mengganti pakaian karakter di seluruh tampak depan, 3/4, samping, dan belakang."
        },
        character_notes: {
            type: "textarea",
            required: false,
            maxLength: MAX_CHARACTER_NOTES_LENGTH,
            subMode: IMAGE_MODE_CHARACTER_SHEET,
            label: "Catatan Tambahan (Opsional)",
            placeholder:
                "Opsional: tambahkan detail khusus (misal: gaya 3D Pixar / anime / photorealistic, kacamata hitam, sepatu sneakers putih)...",
            description:
                "Master prompt turnaround 4 sudut & close-up wajah sudah dikunci otomatis oleh sistem. Kolom ini opsional untuk instruksi tambahan."
        },
        aspect_ratio: {
            type: "enum",
            required: false,
            default: defaultStandardRatio,
            enum: supportedRatios,
            description: "Rasio aspek gambar output."
        }
    };

    const config = {
        id: spec.id,
        name: spec.name,
        logo: spec.logo,
        provider: PROVIDER_ID,
        providerId: PROVIDER_ID,
        providerName: PROVIDER_NAME,
        media_type: "image",
        mediaType: "image",
        generationType: "image",
        category: "image-generation",
        type: "image-generation",
        version: "1.0",
        upstreamModel: spec.upstreamModel,
        description: spec.description,
        supportedRatios,
        supportedResolutions: [],
        supportedDurations: [],
        minDuration: null,
        maxDuration: null,
        subModes: [
            {
                id: IMAGE_MODE_STANDARD,
                label: "Generate Biasa",
                defaultRatio: defaultStandardRatio
            },
            {
                id: IMAGE_MODE_CHARACTER_SHEET,
                label: "Generate Karakter Sheet",
                defaultRatio: defaultCharacterRatio
            }
        ],
        capabilities: {
            textToImage: true,
            imageToImage: true,
            characterSheet: true,
            maxReferenceImages: MAX_IMAGE_REFERENCE_IMAGES,
            aspectRatios: supportedRatios,
            resolutions: [],
            durations: [],
            minDuration: null,
            maxDuration: null
        },
        adminDefaults: {
            credit_480p: defaultCredit,
            credit_720p: 0,
            credit_1080p: 0,
            discount_percent: 0,
            status: "active"
        },
        adminEditor: {
            resolutionIndependent: true,
            hideParameterSummary: false,
            hiddenCreditFields: ["credit_720p", "credit_1080p"],
            creditFields: {
                credit_480p: {
                    label: "Credit Generate Gambar",
                    placeholder: `Contoh: ${defaultCredit}`,
                    help: "Biaya credit flat per 1x generate gambar (berlaku untuk Generate Biasa maupun Generate Karakter Sheet)."
                }
            }
        },
        api: {
            mcpEndpoint: DEFAULT_MCP_URL,
            createTask: "tools/call:generate_keyframes",
            queryTask: "tools/call:get_status"
        },
        defaults: {
            image_mode: IMAGE_MODE_STANDARD,
            aspect_ratio: defaultStandardRatio
        },
        parameters
    };

    function getParameters(input = {}) {
        const source = extractSourceBody(input);
        const subMode = normalizeImageSubMode(source.image_mode);
        const rawRatio = normalizeString(source.aspect_ratio || source.ratio);

        if (subMode === IMAGE_MODE_CHARACTER_SHEET) {
            const characterUrl = extractSingleImageUrl(source.character_image_url);
            const outfitUrl = extractSingleImageUrl(source.outfit_image_url);
            const extraNotes = normalizeString(source.character_notes);
            const aspectRatio = rawRatio || defaultCharacterRatio;
            const combinedRefs = [
                ...(characterUrl ? [characterUrl] : []),
                ...(outfitUrl ? [outfitUrl] : [])
            ];

            return {
                image_mode: IMAGE_MODE_CHARACTER_SHEET,
                character_image_url: characterUrl,
                ...(outfitUrl ? { outfit_image_url: outfitUrl } : {}),
                ...(extraNotes ? { character_notes: extraNotes } : {}),
                image_urls: combinedRefs,
                prompt: buildCharacterSheetHistorySummary({
                    hasOutfitImage: Boolean(outfitUrl),
                    extraNotes
                }),
                aspect_ratio: aspectRatio
            };
        }

        const refUrls = collectUrlList(
            source.image_urls ?? source.reference_image_urls ?? source.image_url
        );

        return {
            image_mode: IMAGE_MODE_STANDARD,
            prompt: normalizeString(source.prompt),
            image_urls: refUrls,
            aspect_ratio: rawRatio || defaultStandardRatio
        };
    }

    function sanitizeParameters(input = {}) {
        return getParameters(input);
    }

    function validate(input = {}) {
        const errors = [];
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, errors: ["Request body tidak valid."] };
        }

        const source = extractSourceBody(input);
        const subMode = normalizeImageSubMode(source.image_mode);

        if (subMode === IMAGE_MODE_CHARACTER_SHEET) {
            const charUrl = extractSingleImageUrl(source.character_image_url);
            if (!charUrl) {
                errors.push("Foto Karakter Utama wajib diunggah untuk mode Generate Karakter Sheet.");
            } else {
                const charErr = validateReferenceUrl(charUrl, "Foto Karakter Utama");
                if (charErr) errors.push(charErr);
            }

            const outfitUrl = extractSingleImageUrl(source.outfit_image_url);
            if (outfitUrl) {
                const outfitErr = validateReferenceUrl(outfitUrl, "Foto Outfit");
                if (outfitErr) errors.push(outfitErr);
            }

            if (source.character_notes !== undefined && source.character_notes !== null) {
                const notes = String(source.character_notes).trim();
                if (notes.length > MAX_CHARACTER_NOTES_LENGTH) {
                    errors.push(`Catatan tambahan maksimal ${MAX_CHARACTER_NOTES_LENGTH} karakter.`);
                }
            }
        } else {
            const prompt = normalizeString(source.prompt);
            if (!prompt) {
                errors.push("Prompt gambar wajib diisi.");
            } else if (prompt.length > MAX_PROMPT_LENGTH) {
                errors.push(`Prompt terlalu panjang (maksimal ${MAX_PROMPT_LENGTH} karakter).`);
            }

            const refUrls = collectUrlList(
                source.image_urls ?? source.reference_image_urls ?? source.image_url
            );
            if (refUrls.length > MAX_IMAGE_REFERENCE_IMAGES) {
                errors.push(`Maksimal ${MAX_IMAGE_REFERENCE_IMAGES} gambar referensi yang diperbolehkan.`);
            }
            for (const url of refUrls) {
                const refErr = validateReferenceUrl(url, "Gambar referensi");
                if (refErr) {
                    errors.push(refErr);
                    break;
                }
            }
        }

        const rawRatio = normalizeString(source.aspect_ratio || source.ratio);
        if (rawRatio && !supportedRatios.includes(rawRatio)) {
            errors.push(
                `Rasio aspek "${rawRatio}" tidak didukung oleh ${spec.name}. Pilihan valid: ${supportedRatios.join(", ")}.`
            );
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function buildPayload(input = {}) {
        const source = extractSourceBody(input);
        const subMode = normalizeImageSubMode(source.image_mode);
        const requestedRatio = normalizeString(source.aspect_ratio || source.ratio);

        if (subMode === IMAGE_MODE_CHARACTER_SHEET) {
            const characterUrl = extractSingleImageUrl(source.character_image_url);
            const outfitUrl = extractSingleImageUrl(source.outfit_image_url);
            const extraNotes = normalizeString(source.character_notes);
            const aspectRatio = supportedRatios.includes(requestedRatio)
                ? requestedRatio
                : defaultCharacterRatio;

            const referenceImageItems = [];
            const referenceImageUrls = [];
            if (characterUrl) {
                referenceImageItems.push({
                    url: characterUrl,
                    role: "character",
                    label: "image1"
                });
                referenceImageUrls.push(characterUrl);
            }
            if (outfitUrl) {
                referenceImageItems.push({
                    url: outfitUrl,
                    role: "outfit",
                    label: "image2"
                });
                referenceImageUrls.push(outfitUrl);
            }

            const masterPrompt = buildCharacterSheetPrompt({
                hasOutfitImage: Boolean(outfitUrl),
                extraNotes
            });

            return {
                opus_model: spec.upstreamModel,
                model_aliases: [...(spec.modelAliases || [])],
                media_type: "image",
                image_mode: IMAGE_MODE_CHARACTER_SHEET,
                prompt: masterPrompt,
                history_prompt: buildCharacterSheetHistorySummary({
                    hasOutfitImage: Boolean(outfitUrl),
                    extraNotes
                }),
                aspect_ratio: aspectRatio,
                reference_image_items: referenceImageItems,
                reference_image_urls: referenceImageUrls
            };
        }

        const aspectRatio = supportedRatios.includes(requestedRatio)
            ? requestedRatio
            : defaultStandardRatio;
        const rawRefs = collectUrlList(
            source.image_urls ?? source.reference_image_urls ?? source.image_url
        ).slice(0, MAX_IMAGE_REFERENCE_IMAGES);
        const referenceImageItems = rawRefs.map((url, idx) => ({
            url,
            role: "reference",
            label: `image${idx + 1}`
        }));

        return {
            opus_model: spec.upstreamModel,
            model_aliases: [...(spec.modelAliases || [])],
            media_type: "image",
            image_mode: IMAGE_MODE_STANDARD,
            prompt: normalizeString(source.prompt),
            aspect_ratio: aspectRatio,
            reference_image_items: referenceImageItems,
            reference_image_urls: rawRefs
        };
    }

    async function createTask(body = {}, apiKey, options = {}) {
        const validation = validate(body);
        if (!validation.valid) {
            const error = new Error(validation.errors.join(" "));
            error.code = "INVALID_MODEL_INPUT";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            error.status = 400;
            error.validationErrors = validation.errors;
            throw error;
        }

        const payload = buildPayload(body);
        const response = await createImageTask(payload, apiKey, options);

        if (!response?.taskId) {
            const error = new Error("Opus Labs tidak mengembalikan taskId gambar.");
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
            mediaType: "image",
            model: spec.id,
            opus_model: spec.upstreamModel,
            taskId: response.taskId,
            task_id: response.taskId,
            jobId: response.jobId || response.taskId,
            job_id: response.jobId || response.taskId,
            payload
        };
    }

    function normalizeOutputUrls(data) {
        if (!data || typeof data !== "object") return [];
        const raw = Array.isArray(data.imageUrls)
            ? data.imageUrls
            : Array.isArray(data.outputUrls)
                ? data.outputUrls
                : Array.isArray(data.videoUrls)
                    ? data.videoUrls
                    : [];
        return raw.map(normalizeString).filter(isValidImageOutputUrl);
    }

    async function queryTask(taskId, apiKey, options = {}) {
        const normalizedId = normalizeString(taskId);
        if (!normalizedId) {
            const error = new Error("Opus image task ID wajib diisi.");
            error.code = "TASK_ID_MISSING";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            throw error;
        }

        const result = await getImageTask(normalizedId, apiKey, options);
        const status = normalizeStatus(result.status);
        const outputUrls = status === "COMPLETED" ? normalizeOutputUrls(result) : [];

        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            mediaType: "image",
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
            imageUrls: outputUrls,
            keySlot: Number.isInteger(result.keySlot) ? result.keySlot : 0,
            keyPoolSize: Number.isInteger(result.keyPoolSize) ? result.keyPoolSize : 1,
            errorCode: result.errorCode || null,
            error_code: result.errorCode || null,
            errorMessage: result.errorMessage || null,
            error_message: result.errorMessage || null,
            nonTerminalDeadline: Boolean(result.nonTerminalDeadline),
            raw: {
                status,
                media_type: "image",
                provider_state: result.providerState || status.toLowerCase(),
                project_id: result.projectId || null,
                job_id: result.jobId || null,
                ...(outputUrls.length ? { image_urls: outputUrls, result_urls: outputUrls } : {}),
                ...(result.errorCode ? { error_code: result.errorCode } : {}),
                ...(result.errorMessage ? { error_message: result.errorMessage } : {})
            }
        };
    }

    const getTask = queryTask;
    const isCompleted = res => normalizeStatus(res?.status) === "COMPLETED";
    const isFailed = res => normalizeStatus(res?.status) === "FAILED";
    const isProcessing = res => ["QUEUED", "PROCESSING"].includes(normalizeStatus(res?.status));

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
        subModes: config.subModes,
        capabilities: config.capabilities,
        adminDefaults: config.adminDefaults,
        adminEditor: config.adminEditor,
        defaults: config.defaults,
        config,
        parameters,
        validate,
        validateParameters: validate,
        getParameters,
        sanitizeParameters,
        buildPayload,
        createTask,
        queryTask,
        getTask,
        isCompleted,
        isFailed,
        isProcessing,
        normalizeOutputUrls,
        normalizeStatus
    };
}

export default createOpusImageModel;
