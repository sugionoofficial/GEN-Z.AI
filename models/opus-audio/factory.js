/* =========================================================
   GEN-Z.AI
   OPUS LABS AUDIO — MODEL ADAPTER FACTORY
   ---------------------------------------------------------
   File:
     models/opus-audio/factory.js

   Membangun adapter lengkap (config, parameters, validate,
   getParameters, sanitizeParameters, buildPayload, createTask,
   queryTask) untuk 3 model generate audio Opus Labs MCP:
   1. `opus-audio-speech` (Voiceover & TTS — 30 karakter suara + style)
   2. `opus-audio-music`  (Music / Lagu AI Lyria 3.5 — instrumental / vokal)
   3. `opus-audio-sfx`    (Sound Effects / SFX — efek suara + durasi)
========================================================= */

import {
    DEFAULT_MCP_URL,
    createAudioTask,
    getAudioTask,
    normalizeStatus
} from "../../provider/opus/client.js";
import {
    DEFAULT_OPUS_AUDIO_CREDIT,
    MAX_MUSIC_LYRICS_LENGTH,
    MAX_MUSIC_PROMPT_LENGTH,
    MAX_SFX_PROMPT_LENGTH,
    MAX_SPEECH_STYLE_LENGTH,
    MAX_SPEECH_WEIGHTED_LENGTH,
    OPUS_MUSIC_DURATIONS,
    OPUS_MUSIC_VOCAL_MODES,
    OPUS_SFX_DURATIONS,
    OPUS_SPEECH_VOICES,
    OPUS_SPEECH_VOICE_IDS,
    computeSpeechWeightedLength
} from "./specs.js";

const PROVIDER_ID = "opus";
const PROVIDER_NAME = "GEN-Z.AI";

const ALLOWED_VOCAL_MODES = OPUS_MUSIC_VOCAL_MODES.map(item => item.value);
const ALLOWED_MUSIC_DURATIONS = OPUS_MUSIC_DURATIONS.map(item => item.value);
const ALLOWED_SFX_DURATIONS = OPUS_SFX_DURATIONS.map(item => item.value);

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isValidAudioOutputUrl(value) {
    const trimmed = normalizeString(value);
    if (!trimmed) return false;
    if (/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
        return true;
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
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

function buildParametersForAudioKind(audioKind) {
    if (audioKind === "speech") {
        return {
            prompt: {
                type: "textarea",
                required: true,
                maxLength: MAX_SPEECH_WEIGHTED_LENGTH,
                label: "Teks / Naskah Voiceover",
                placeholder:
                    "Ketik naskah yang ingin dibacakan... Bahasa terdeteksi otomatis. Anda dapat menyisipkan ekspresi seperti <short pause>, <laugh>, atau <sigh>.",
                description:
                    "Naskah narasi hingga 6.000 karakter berbobot. Mendukung Bahasa Indonesia, Inggris, dan multibahasa otomatis."
            },
            voice: {
                type: "select",
                required: false,
                default: "Sulafat",
                label: "Karakter Suara (30 Pilihan Resmi Opus)",
                options: OPUS_SPEECH_VOICES,
                description:
                    "Pilih karakter vokal narator sesuai nuansa konten Anda."
            },
            style: {
                type: "textarea",
                required: false,
                maxLength: MAX_SPEECH_STYLE_LENGTH,
                label: "Arahan Gaya Bicara / Persona (Opsional)",
                placeholder:
                    "Contoh: Narator dokumenter yang tenang, hangat, tempo sedikit pelan, artikulasi tegas...",
                description:
                    "Opsional (maks 500 karakter): atur emosi, aksen, tempo, atau karakter pembawaan suara."
            }
        };
    }

    if (audioKind === "music") {
        return {
            prompt: {
                type: "textarea",
                required: true,
                maxLength: MAX_MUSIC_PROMPT_LENGTH,
                label: "Deskripsi Musik / Lagu AI",
                placeholder:
                    "Contoh: Acoustic indie folk hangat dengan petikan gitar akustik, piano lembut, tempo 95 BPM, suasana pagi yang optimis...",
                description:
                    "Deskripsikan genre, suasana (mood), instrumen, tempo BPM, dan aransemen. Jangan menyebut nama artis atau judul lagu berhak cipta."
            },
            vocal_mode: {
                type: "select",
                required: false,
                default: "instrumental",
                label: "Mode Vokal",
                options: OPUS_MUSIC_VOCAL_MODES,
                description:
                    "Pilih 'Instrumental Saja' untuk BGM bersih tanpa vokal, atau 'Dengan Vokal / Lirik Lagu' untuk lagu utuh."
            },
            target_duration: {
                type: "select",
                required: false,
                default: "30",
                label: "Durasi Target Musik",
                options: OPUS_MUSIC_DURATIONS,
                description:
                    "Estimasi panjang trek musik yang ingin dihasilkan."
            },
            lyrics: {
                type: "textarea",
                required: false,
                maxLength: MAX_MUSIC_LYRICS_LENGTH,
                label: "Lirik Lagu (Opsional — Otomatis Aktifkan Mode Vokal)",
                placeholder:
                    "[Verse 1]\nMelangkah di bawah cahaya pagi\nMenjemput harapan yang baru\n\n[Chorus]\nKita terbang menembus batas mimpi\nBersinar terang di langit biru",
                description:
                    "Opsional: tulis lirik lagu (dengan tag [Verse] / [Chorus] atau baris biasa — sistem otomatis memformat struktur vokal Lyria 3.5 sesuai bahasa lirik Anda)."
            }
        };
    }

    return {
        prompt: {
            type: "textarea",
            required: true,
            maxLength: MAX_SFX_PROMPT_LENGTH,
            label: "Deskripsi Efek Suara (SFX)",
            placeholder:
                "Contoh: Suara hujan deras di atap kaca disertai gemuruh petir kejauhan pada malam hari, rekaman jernih stereo...",
            description:
                "Deskripsikan efek suara, objek, material, ruang akustik, atau transisi sinematik secara spesifik."
        },
        target_duration: {
            type: "select",
            required: false,
            default: "5",
            label: "Durasi Efek Suara",
            options: OPUS_SFX_DURATIONS,
            description:
                "Pilih panjang durasi efek suara dalam satuan detik."
        }
    };
}

function buildDefaultsForAudioKind(audioKind) {
    if (audioKind === "speech") {
        return {
            voice: "Sulafat"
        };
    }
    if (audioKind === "music") {
        return {
            vocal_mode: "instrumental",
            target_duration: "30"
        };
    }
    return {
        target_duration: "5"
    };
}

export function createOpusAudioModel(spec) {
    const audioKind = String(spec.audioKind || "speech").trim().toLowerCase();
    const defaultCredit = Number.isFinite(Number(spec.defaultCredit))
        ? Number(spec.defaultCredit)
        : DEFAULT_OPUS_AUDIO_CREDIT;

    const parameters = buildParametersForAudioKind(audioKind);
    const defaults = buildDefaultsForAudioKind(audioKind);

    const config = {
        id: spec.id,
        name: spec.name,
        logo: spec.logo || "gemini.svg",
        provider: PROVIDER_ID,
        providerId: PROVIDER_ID,
        providerName: PROVIDER_NAME,
        media_type: "audio",
        mediaType: "audio",
        generationType: "audio",
        audioKind,
        category: "audio-generation",
        type: "audio-generation",
        version: "1.0",
        upstreamModel: spec.upstreamModel,
        description: spec.description,
        supportedRatios: [],
        supportedResolutions: [],
        supportedDurations:
            audioKind === "music"
                ? [15, 30, 60, 120]
                : audioKind === "sfx"
                  ? [2, 5, 10, 15]
                  : [],
        minDuration: null,
        maxDuration: null,
        capabilities: {
            textToSpeech: audioKind === "speech",
            textToMusic: audioKind === "music",
            textToSfx: audioKind === "sfx",
            audioKind,
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
                    label: "Credit Generate Audio",
                    placeholder: `Contoh: ${defaultCredit}`,
                    help: `Biaya credit flat per 1x generate audio (${spec.name}).`
                }
            }
        },
        api: {
            mcpEndpoint: DEFAULT_MCP_URL,
            createTask: "tools/call:generate_audio",
            queryTask: "tools/call:get_status"
        },
        defaults,
        parameters
    };

    function getParameters(input = {}) {
        const source = extractSourceBody(input);

        if (audioKind === "speech") {
            const scriptText = normalizeString(source.prompt || source.text);
            const rawVoice = normalizeString(source.voice) || "Sulafat";
            const matchedVoice =
                OPUS_SPEECH_VOICE_IDS.find(v => v.toLowerCase() === rawVoice.toLowerCase()) ||
                rawVoice;
            const style = normalizeString(source.style);

            return {
                audio_type: "speech",
                prompt: scriptText,
                text: scriptText,
                voice: matchedVoice,
                ...(style ? { style } : {})
            };
        }

        if (audioKind === "music") {
            const musicPrompt = normalizeString(source.prompt);
            const rawVocalMode = normalizeString(source.vocal_mode).toLowerCase();
            const rawTargetDuration = normalizeString(source.target_duration ?? source.duration ?? "30");
            const durationNum = Number(rawTargetDuration);
            const lyrics = normalizeString(source.lyrics);
            const forceInstrumental = source.force_instrumental === true;
            const effectiveVocalMode =
                !forceInstrumental && (rawVocalMode === "vocal" || Boolean(lyrics))
                    ? "vocal"
                    : rawVocalMode || "instrumental";

            return {
                audio_type: "music",
                prompt: musicPrompt,
                vocal_mode: effectiveVocalMode,
                target_duration: rawTargetDuration || "30",
                ...(Number.isFinite(durationNum) && durationNum > 0 ? { duration: Math.round(durationNum) } : {}),
                ...(effectiveVocalMode === "vocal" && lyrics ? { lyrics } : {})
            };
        }

        const sfxPrompt = normalizeString(source.prompt);
        const rawSfxDuration = normalizeString(source.target_duration ?? source.duration ?? "5");
        const sfxDurationNum = Number(rawSfxDuration);

        return {
            audio_type: "sfx",
            prompt: sfxPrompt,
            target_duration: rawSfxDuration || "5",
            duration: Number.isFinite(sfxDurationNum) && sfxDurationNum > 0 ? Math.round(sfxDurationNum) : 5
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

        if (audioKind === "speech") {
            const scriptText = normalizeString(source.prompt || source.text);
            if (!scriptText) {
                errors.push("Teks / naskah voiceover wajib diisi.");
            } else {
                const weightedLen = computeSpeechWeightedLength(scriptText);
                if (weightedLen > MAX_SPEECH_WEIGHTED_LENGTH) {
                    errors.push(
                        `Naskah voiceover terlalu panjang (${weightedLen} karakter berbobot, maksimal ${MAX_SPEECH_WEIGHTED_LENGTH}).`
                    );
                }
            }

            const rawVoice = normalizeString(source.voice);
            if (
                rawVoice &&
                !OPUS_SPEECH_VOICE_IDS.some(v => v.toLowerCase() === rawVoice.toLowerCase())
            ) {
                errors.push(
                    `Karakter suara "${rawVoice}" tidak dikenali. Pilih salah satu dari 30 suara resmi Opus.`
                );
            }

            if (source.style !== undefined && source.style !== null) {
                const styleText = normalizeString(source.style);
                if (styleText.length > MAX_SPEECH_STYLE_LENGTH) {
                    errors.push(`Arahan gaya bicara maksimal ${MAX_SPEECH_STYLE_LENGTH} karakter.`);
                }
            }
        } else if (audioKind === "music") {
            const musicPrompt = normalizeString(source.prompt);
            if (!musicPrompt) {
                errors.push("Deskripsi musik / lagu wajib diisi.");
            } else if (musicPrompt.length > MAX_MUSIC_PROMPT_LENGTH) {
                errors.push(`Deskripsi musik maksimal ${MAX_MUSIC_PROMPT_LENGTH} karakter.`);
            }

            const vocalMode = normalizeString(source.vocal_mode).toLowerCase();
            if (vocalMode && !ALLOWED_VOCAL_MODES.includes(vocalMode)) {
                errors.push(`Mode vokal "${vocalMode}" tidak valid.`);
            }

            const targetDur = normalizeString(source.target_duration);
            if (targetDur && !ALLOWED_MUSIC_DURATIONS.includes(targetDur)) {
                errors.push(
                    `Durasi target musik "${targetDur}" tidak didukung. Pilihan valid: ${ALLOWED_MUSIC_DURATIONS.join(", ")} detik.`
                );
            }

            if (source.lyrics !== undefined && source.lyrics !== null) {
                const lyricsText = normalizeString(source.lyrics);
                if (lyricsText.length > MAX_MUSIC_LYRICS_LENGTH) {
                    errors.push(`Lirik lagu maksimal ${MAX_MUSIC_LYRICS_LENGTH} karakter.`);
                }
            }
        } else {
            const sfxPrompt = normalizeString(source.prompt);
            if (!sfxPrompt) {
                errors.push("Deskripsi efek suara (SFX) wajib diisi.");
            } else if (sfxPrompt.length > MAX_SFX_PROMPT_LENGTH) {
                errors.push(`Deskripsi efek suara maksimal ${MAX_SFX_PROMPT_LENGTH} karakter.`);
            }

            const targetDur = normalizeString(source.target_duration);
            if (targetDur && !ALLOWED_SFX_DURATIONS.includes(targetDur)) {
                errors.push(
                    `Durasi efek suara "${targetDur}" tidak didukung. Pilihan valid: ${ALLOWED_SFX_DURATIONS.join(", ")} detik.`
                );
            }
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
            model_aliases: [...(spec.modelAliases || [])],
            media_type: "audio",
            audio_type: audioKind,
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
        const response = await createAudioTask(payload, apiKey, options);

        if (!response?.taskId) {
            const error = new Error("Opus Labs tidak mengembalikan taskId audio.");
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
            mediaType: "audio",
            audioKind,
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
        const raw = Array.isArray(data.audioUrls)
            ? data.audioUrls
            : Array.isArray(data.outputUrls)
              ? data.outputUrls
              : Array.isArray(data.videoUrls)
                ? data.videoUrls
                : [];
        return raw.map(normalizeString).filter(isValidAudioOutputUrl);
    }

    async function queryTask(taskId, apiKey, options = {}) {
        const normalizedId = normalizeString(taskId);
        if (!normalizedId) {
            const error = new Error("Opus audio task ID wajib diisi.");
            error.code = "TASK_ID_MISSING";
            error.provider = PROVIDER_ID;
            error.model = spec.id;
            throw error;
        }

        const result = await getAudioTask(normalizedId, apiKey, options);
        const status = normalizeStatus(result.status);
        const outputUrls = status === "COMPLETED" ? normalizeOutputUrls(result) : [];

        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            mediaType: "audio",
            audioKind,
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
            audioUrls: outputUrls,
            durationSeconds: result.durationSeconds || null,
            lyrics: result.lyrics || null,
            keySlot: Number.isInteger(result.keySlot) ? result.keySlot : 0,
            keyPoolSize: Number.isInteger(result.keyPoolSize) ? result.keyPoolSize : 1,
            errorCode: result.errorCode || null,
            error_code: result.errorCode || null,
            errorMessage: result.errorMessage || null,
            error_message: result.errorMessage || null,
            nonTerminalDeadline: Boolean(result.nonTerminalDeadline),
            raw: {
                status,
                media_type: "audio",
                audio_type: audioKind,
                provider_state: result.providerState || status.toLowerCase(),
                project_id: result.projectId || null,
                job_id: result.jobId || null,
                ...(outputUrls.length ? { audio_urls: outputUrls, result_urls: outputUrls } : {}),
                ...(result.durationSeconds ? { duration_seconds: result.durationSeconds } : {}),
                ...(result.lyrics ? { lyrics: result.lyrics } : {}),
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
        audioKind: config.audioKind,
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
        normalizeOutputUrls,
        normalizeStatus
    };
}

export default createOpusAudioModel;
