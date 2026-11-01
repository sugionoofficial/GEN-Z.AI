/* =========================================================
   GEN-Z.AI
   OPUS LABS TRANSCRIBE — MODEL ADAPTER FACTORY
   ---------------------------------------------------------
   File:
     models/opus-transcribe/factory.js

   Membangun adapter lengkap (config, parameters, validate,
   getParameters, sanitizeParameters, buildPayload, createTask,
   queryTask) untuk model `opus-transcribe-audio` (`transcribe_audio`):
   - Menerima `audio_url` ATAU `video_urls` (maks 1 file)
   - Pilihan `language` (default `auto`)
   - Output `transcript` terstruktur (`text`, `txt`, `segments`, `srt`)
========================================================= */

import {
    DEFAULT_MCP_URL,
    createTranscribeTask,
    getTranscribeTask,
    normalizeStatus
} from "../../provider/opus/client.js";
import { inspectReferenceMediaUrl } from "../../assets/js/media-url-guard.js";
import { normalizeTranscriptPayload } from "../../assets/js/transcript-format.js";
import {
    DEFAULT_OPUS_TRANSCRIBE_CREDIT,
    OPUS_TRANSCRIBE_LANGUAGES,
    OPUS_TRANSCRIBE_LANGUAGE_CODES
} from "./specs.js";

const PROVIDER_ID = "opus";
const PROVIDER_NAME = "GEN-Z.AI";

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
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
                /* gunakan sebagai string tunggal */
            }
        }
        return [text];
    }
    return [];
}

function isValidMediaInputUrl(value, mediaKind = "audio") {
    const trimmed = normalizeString(value);
    if (!trimmed) return false;
    if (trimmed.startsWith("supabase-private://")) {
        return true;
    }
    if (
        mediaKind === "audio" &&
        /^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)
    ) {
        return true;
    }
    if (
        mediaKind === "video" &&
        /^data:video\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)
    ) {
        return true;
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

function validateInputMediaUrl(url, mediaKind, fieldLabel) {
    if (!isValidMediaInputUrl(url, mediaKind)) {
        return `${fieldLabel} harus berupa URL file ${mediaKind} yang valid.`;
    }
    if (!url.startsWith("supabase-private://") && !url.startsWith("data:")) {
        const check = inspectReferenceMediaUrl(url);
        if (!check.valid) {
            return check.message || check.reason || `${fieldLabel} tidak valid.`;
        }
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

function buildLanguageLabel(code) {
    const found = OPUS_TRANSCRIBE_LANGUAGES.find(
        item => item.value.toLowerCase() === String(code || "auto").toLowerCase()
    );
    return found ? found.label : String(code || "Deteksi Otomatis");
}

export function createOpusTranscribeModel(spec) {
    const defaultCredit = Number.isFinite(Number(spec.defaultCredit))
        ? Number(spec.defaultCredit)
        : DEFAULT_OPUS_TRANSCRIBE_CREDIT;

    const parameters = {
        audio_url: {
            type: "audio_url",
            required: false,
            accept: ".mp3,.wav,.m4a,.aac,.ogg,.flac,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac",
            label: "Upload File Audio (MP3, WAV, M4A, AAC, OGG, FLAC)",
            description:
                "Unggah 1 file audio yang ingin ditranskripsi menjadi teks & subtitle (.SRT). Kosongkan jika Anda mengunggah file video di bawah."
        },
        video_urls: {
            type: "video_urls",
            required: false,
            maxItems: 1,
            accept: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",
            label: "Atau Upload File Video (MP4, MOV, WEBM)",
            description:
                "Alternatif: unggah 1 file video untuk mengekstrak transkrip percakapan beserta timestamp otomatis."
        },
        language: {
            type: "select",
            required: false,
            default: "auto",
            label: "Bahasa Audio / Video",
            options: OPUS_TRANSCRIBE_LANGUAGES,
            description:
                "Pilih 'Deteksi Otomatis' atau tentukan bahasa spesifik untuk akurasi ejaan istilah yang lebih presisi."
        }
    };

    const config = {
        id: spec.id,
        name: spec.name,
        logo: spec.logo || "gemini.svg",
        provider: PROVIDER_ID,
        providerId: PROVIDER_ID,
        providerName: PROVIDER_NAME,
        media_type: "transcribe",
        mediaType: "transcribe",
        generationType: "transcribe",
        category: "audio-transcription",
        type: "audio-transcription",
        version: "1.0",
        upstreamModel: spec.upstreamModel,
        description: spec.description,
        supportedRatios: [],
        supportedResolutions: [],
        supportedDurations: [],
        minDuration: null,
        maxDuration: null,
        capabilities: {
            audioToText: true,
            videoToText: true,
            srtExport: true,
            txtExport: true,
            aspectRatios: [],
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
                    label: "Credit Transcribe Audio",
                    placeholder: `Contoh: ${defaultCredit}`,
                    help: "Biaya credit flat per 1x transkripsi file audio atau video."
                }
            }
        },
        api: {
            mcpEndpoint: DEFAULT_MCP_URL,
            createTask: "tools/call:transcribe_audio",
            queryTask: "tools/call:get_status"
        },
        defaults: {
            language: "auto"
        },
        parameters
    };

    function getParameters(input = {}) {
        const source = extractSourceBody(input);
        const audioUrl = collectUrlList(source.audio_url ?? source.audio_urls)[0] || "";
        const videoList = collectUrlList(source.video_urls ?? source.video_url);
        const rawLang = normalizeString(source.language || "auto").toLowerCase() || "auto";
        const matchedLang =
            OPUS_TRANSCRIBE_LANGUAGE_CODES.find(code => code.toLowerCase() === rawLang) || "auto";

        const sourceKindLabel = audioUrl ? "Audio" : videoList.length > 0 ? "Video" : "Media";
        const summaryPrompt =
            normalizeString(source.prompt) ||
            `[Transkripsi ${sourceKindLabel}] Bahasa: ${buildLanguageLabel(matchedLang)}`;

        return {
            ...(audioUrl ? { audio_url: audioUrl } : {}),
            ...(videoList.length > 0 ? { video_urls: videoList.slice(0, 1), video_url: videoList[0] } : {}),
            language: matchedLang,
            prompt: summaryPrompt
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
        const audioList = collectUrlList(source.audio_url ?? source.audio_urls);
        const videoList = collectUrlList(source.video_urls ?? source.video_url);

        if (audioList.length === 0 && videoList.length === 0) {
            errors.push("Unggah minimal satu file Audio atau file Video untuk ditranskripsi.");
        }

        if (audioList.length > 1) {
            errors.push("Maksimal 1 file audio per proses transkripsi.");
        }
        if (videoList.length > 1) {
            errors.push("Maksimal 1 file video per proses transkripsi.");
        }

        if (audioList[0]) {
            const audioErr = validateInputMediaUrl(audioList[0], "audio", "File Audio");
            if (audioErr) errors.push(audioErr);
        }
        if (videoList[0]) {
            const videoErr = validateInputMediaUrl(videoList[0], "video", "File Video");
            if (videoErr) errors.push(videoErr);
        }

        const rawLang = normalizeString(source.language).toLowerCase();
        if (rawLang && !OPUS_TRANSCRIBE_LANGUAGE_CODES.includes(rawLang)) {
            errors.push(
                `Kode bahasa "${rawLang}" tidak didukung. Pilihan valid: ${OPUS_TRANSCRIBE_LANGUAGE_CODES.join(", ")}.`
            );
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function buildPayload(input = {}) {
        const sanitized = getParameters(input);
        return {
            opus_model: spec.upstreamModel,
            media_type: "transcribe",
            ...sanitized
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
        const response = await createTranscribeTask(payload, apiKey, options);

        if (!response?.taskId) {
            const error = new Error("Opus Labs tidak mengembalikan taskId transkripsi.");
            error.code = "MISSING_TASK_ID";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            throw error;
        }

        const normalizedTranscript = response.transcript
            ? normalizeTranscriptPayload(response.transcript)
            : null;

        return {
            ...response,
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            mediaType: "transcribe",
            model: spec.id,
            opus_model: spec.upstreamModel,
            taskId: response.taskId,
            task_id: response.taskId,
            jobId: response.jobId || response.taskId,
            job_id: response.jobId || response.taskId,
            transcript: normalizedTranscript,
            payload
        };
    }

    async function queryTask(taskId, apiKey, options = {}) {
        const normalizedId = normalizeString(taskId);
        if (!normalizedId) {
            const error = new Error("Opus transcribe task ID wajib diisi.");
            error.code = "TASK_ID_MISSING";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            throw error;
        }

        const result = await getTranscribeTask(normalizedId, apiKey, options);
        const status = normalizeStatus(result.status);
        const transcript =
            status === "COMPLETED" && result.transcript
                ? normalizeTranscriptPayload(result.transcript)
                : null;
        const outputUrls = Array.isArray(result.outputUrls)
            ? result.outputUrls.map(normalizeString).filter(Boolean)
            : [];

        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            mediaType: "transcribe",
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
            transcript,
            outputUrls,
            output_urls: outputUrls,
            outputUrl: outputUrls[0] || null,
            keySlot: Number.isInteger(result.keySlot) ? result.keySlot : 0,
            keyPoolSize: Number.isInteger(result.keyPoolSize) ? result.keyPoolSize : 1,
            errorCode: result.errorCode || null,
            error_code: result.errorCode || null,
            errorMessage: result.errorMessage || null,
            error_message: result.errorMessage || null,
            nonTerminalDeadline: Boolean(result.nonTerminalDeadline),
            raw: {
                status,
                media_type: "transcribe",
                provider_state: result.providerState || status.toLowerCase(),
                project_id: result.projectId || null,
                job_id: result.jobId || null,
                ...(transcript ? { transcript } : {}),
                ...(outputUrls.length ? { result_urls: outputUrls } : {}),
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
        normalizeStatus
    };
}

export default createOpusTranscribeModel;
