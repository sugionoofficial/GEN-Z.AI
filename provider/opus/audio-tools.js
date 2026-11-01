/* =========================================================
   GEN-Z.AI
   OPUS LABS MCP — AUDIO GENERATION & TRANSCRIPTION TOOLS
   ---------------------------------------------------------
   File:
     provider/opus/audio-tools.js

   100% browser-safe ES module (tanpa node:*).
   Menyediakan:
   - `generate_audio` (Speech / Voiceover TTS, Music / Lagu AI, Sound Effects / SFX)
   - `transcribe_audio` (Audio & Video Speech-to-Text + Timestamp & SRT)
   Dengan live JSON Schema introspection, key-pool rotation,
   self-healing argumen MCP, serta rekonsiliasi get_status / resolve_job / list_jobs.
========================================================= */

import { inspectReferenceMediaUrl } from "../../assets/js/media-url-guard.js";
import { normalizeTranscriptPayload } from "../../assets/js/transcript-format.js";

export function isLikelyAudioOutputUrl(url, keyHint = "", mimeHint = "") {
    const clean = String(url || "").trim();
    if (!clean) return false;
    const lowerKey = String(keyHint || "").toLowerCase();
    if (
        /(?:upload|presign_put|callback|webhook|firstframe|first_frame|lastframe|last_frame|reference|inputaudio|input_audio|sourceaudio|source_audio|inputasset|input_asset|characterimage|outfitimage|thumbnail|poster|cover|avatar)/i.test(
            lowerKey
        )
    ) {
        return false;
    }
    if (/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(clean)) {
        return true;
    }
    if (!/^https?:\/\//i.test(clean)) return false;

    const lowerMime = String(mimeHint || "").toLowerCase();
    if (lowerMime.startsWith("image/") || lowerMime.startsWith("video/")) {
        return false;
    }
    if (lowerMime.startsWith("audio/")) {
        return true;
    }

    const pathPart = clean.split("?")[0].split("#")[0].toLowerCase();
    if (/\.(?:png|jpe?g|webp|avif|gif|svg|mp4|mov|m4v|mkv|avi|json|xml|txt|srt|vtt|html)$/i.test(pathPart)) {
        return false;
    }
    if (/\.(?:mp3|wav|m4a|aac|ogg|opus|flac|weba)$/i.test(pathPart)) {
        return true;
    }
    return /(?:audio|speech|voice|voiceover|music|song|sfx|sound|track|output|download|render|result|media|signed|asset|cdn|public|file|url|uri)/i.test(
        lowerKey
    );
}

export function extractAudioUrls(rootData, seen = new WeakSet()) {
    const urls = [];
    const addUrl = url => {
        const clean = String(url || "").trim();
        if (clean && !urls.includes(clean)) {
            urls.push(clean);
        }
    };

    const visit = (node, keyHint = "", mimeHint = "", depth = 0) => {
        if (!node || depth > 8) return;
        if (typeof node === "string") {
            if (isLikelyAudioOutputUrl(node, keyHint, mimeHint)) {
                addUrl(node);
            }
            return;
        }
        if (Array.isArray(node)) {
            for (const el of node) {
                visit(el, keyHint, mimeHint, depth + 1);
            }
            return;
        }
        if (typeof node === "object") {
            if (seen.has(node)) return;
            seen.add(node);

            const localMime = String(
                node.mimeType ||
                node.mime_type ||
                node.contentType ||
                node.content_type ||
                mimeHint ||
                ""
            ).trim();

            for (const b64Key of ["audioBase64", "audio_base64", "b64_json", "base64", "dataBase64"]) {
                if (typeof node[b64Key] === "string" && node[b64Key].trim().length > 64) {
                    const rawB64 = node[b64Key].trim();
                    if (/^data:audio\//i.test(rawB64)) {
                        addUrl(rawB64);
                    } else if (localMime.startsWith("audio/") && /^[A-Za-z0-9+/=\s]+$/.test(rawB64)) {
                        addUrl(`data:${localMime};base64,${rawB64.replace(/\s+/g, "")}`);
                    }
                }
            }

            const priorityKeys = [
                "audioUrl",
                "audio_url",
                "speechUrl",
                "speech_url",
                "musicUrl",
                "music_url",
                "trackUrl",
                "track_url",
                "downloadUrl",
                "download_url",
                "outputUrl",
                "output_url",
                "resultUrl",
                "result_url",
                "signedUrl",
                "signed_url",
                "presignedUrl",
                "presigned_url",
                "mediaUrl",
                "media_url",
                "fileUrl",
                "file_url",
                "cdnUrl",
                "cdn_url",
                "publicUrl",
                "public_url",
                "dataUrl",
                "data_url",
                "url",
                "uri"
            ];

            for (const pk of priorityKeys) {
                if (typeof node[pk] === "string" && isLikelyAudioOutputUrl(node[pk], pk, localMime)) {
                    addUrl(node[pk]);
                }
            }

            const outputContainers = [
                "outputs",
                "audio",
                "audios",
                "tracks",
                "clips",
                "results",
                "deliverables",
                "artifacts",
                "downloads",
                "files",
                "items",
                "jobs",
                "assets",
                "data",
                "result"
            ];

            for (const ck of outputContainers) {
                if (node[ck] !== undefined && node[ck] !== null) {
                    visit(node[ck], ck, localMime, depth + 1);
                }
            }

            for (const [k, v] of Object.entries(node)) {
                if (priorityKeys.includes(k) || outputContainers.includes(k)) continue;
                if (/(?:reference|input|upload|request|source_audio|source_video)/i.test(k)) {
                    continue;
                }
                visit(v, k, localMime, depth + 1);
            }
        }
    };

    visit(rootData, "", "", 0);
    return urls;
}

function extractAudioContentDataUrls(content) {
    if (!Array.isArray(content) || content.length === 0) return [];
    const urls = [];
    for (const block of content) {
        if (!block || typeof block !== "object") continue;
        if (block.type === "audio" && typeof block.data === "string" && block.data.trim()) {
            const mime = String(block.mimeType || block.mediaType || "audio/mpeg").trim() || "audio/mpeg";
            const cleanData = block.data.trim();
            urls.push(cleanData.startsWith("data:audio/") ? cleanData : `data:${mime};base64,${cleanData}`);
        }
    }
    return urls;
}

export function extractTranscriptUrls(rootData, excludedUrls = null, seen = new WeakSet()) {
    const urls = [];
    const addUrl = url => {
        const clean = String(url || "").trim();
        if (!clean || urls.includes(clean)) return;
        if (excludedUrls instanceof Set && excludedUrls.has(clean)) return;
        urls.push(clean);
    };

    const visit = (node, keyHint = "", mimeHint = "", depth = 0) => {
        if (!node || depth > 8) return;
        if (typeof node === "string") {
            const clean = node.trim();
            if (!/^https?:\/\//i.test(clean)) return;
            const lowerKey = String(keyHint || "").toLowerCase();
            if (/(?:upload|presign_put|callback|webhook|reference|input|source_audio|source_video)/i.test(lowerKey)) {
                return;
            }
            const lowerMime = String(mimeHint || "").toLowerCase();
            const pathPart = clean.split("?")[0].split("#")[0].toLowerCase();
            if (
                lowerMime.includes("json") ||
                lowerMime.startsWith("text/") ||
                lowerMime.includes("srt") ||
                lowerMime.includes("subrip") ||
                lowerMime.includes("vtt") ||
                /\.(?:json|srt|vtt|txt)$/i.test(pathPart) ||
                /(?:transcript|subtitle|caption|srt|vtt)/i.test(lowerKey)
            ) {
                addUrl(clean);
            }
            return;
        }
        if (Array.isArray(node)) {
            for (const el of node) visit(el, keyHint, mimeHint, depth + 1);
            return;
        }
        if (typeof node === "object") {
            if (seen.has(node)) return;
            seen.add(node);
            const localMime = String(
                node.mimeType || node.mime_type || node.contentType || node.content_type || mimeHint || ""
            ).trim();
            for (const [k, v] of Object.entries(node)) {
                visit(v, k, localMime, depth + 1);
            }
        }
    };

    visit(rootData, "", "", 0);
    return urls;
}

export function createOpusAudioTools(deps) {
    const {
        PROVIDER_ID,
        PROVIDER_NAME,
        CREATE_TIMEOUT_MS,
        QUERY_TIMEOUT_MS,
        COMPLETED_INLINE_CACHE_TTL_MS,
        PROJECT_PENDING_JOB_ID,
        TERMINAL_FAILED_TOKENS,
        inlineCompletedResults,
        getActiveKeyIndex,
        setActiveKeyIndex,
        sleep,
        makeUuid,
        getMcpEndpoint,
        createProviderError,
        translateOpusError,
        openMcpSession,
        findMcpTool,
        ensureProjectId,
        stageSingleReferenceImage,
        inferAudioMimeFromUrl,
        inferVideoMimeFromUrl,
        extFromMime,
        resolveObjectSchema,
        expandObjectBranches,
        resolveArrayItemSchema,
        pickSupportedKey,
        extractAllowedValues,
        matchEnumCaseInsensitive,
        schemaTypeIncludes,
        applyDurationControls,
        buildFrameFieldValue,
        buildReferenceAssetsValue,
        unwrapEnvelope,
        tryParseJsonFromText,
        normalizeStatus,
        findJobIdFromResponse,
        isOpusNonTerminalWorkerDeadline,
        extractOpusEgressJobId,
        isTransientNotFoundError,
        buildListJobsArgs,
        buildResolveJobArgs,
        extractAllowedEnumValuesFromError,
        extractUnrecognizedKeysFromError,
        stripKeysDeep,
        stripRequestKeysForComparison,
        isRetryableKeyframeValidationFailure,
        summarizeMcpToolSchema,
        encodeOpusTaskId,
        parseOpusTaskId,
        extractOpusApiKeyPool,
        parseApiKeyInput,
        isOpusCreditExhaustedError,
        normalizeExcludedSlotSet,
        fetchWithTimeout
    } = deps;

    function isEntryFailed(entry) {
        if (!entry || typeof entry !== "object") return false;
        if (entry.ok === false || entry.success === false || entry.rejected === true || entry.isError === true) {
            return true;
        }
        const st = String(entry.status || entry.state || "").trim().toLowerCase();
        if (st && TERMINAL_FAILED_TOKENS.has(st)) return true;
        return Boolean(entry.error || entry.errorCode || entry.error_code || entry.issues || entry.errors);
    }

    function selectFocusNode(rawData, rawText = "", targetJobId = "", containerKeys = []) {
        const parsedSource =
            rawData && typeof rawData === "object"
                ? rawData
                : tryParseJsonFromText(rawText);
        const unwrapped = unwrapEnvelope(parsedSource);
        let focus = unwrapped;

        if (unwrapped && typeof unwrapped === "object") {
            for (const listKey of containerKeys) {
                const container = unwrapped[listKey];
                if (Array.isArray(container) && container.length > 0) {
                    const matched = targetJobId
                        ? container.find(
                              el =>
                                  el &&
                                  typeof el === "object" &&
                                  [
                                      el.jobId,
                                      el.job_id,
                                      el.taskId,
                                      el.submissionId,
                                      el.operationId,
                                      el.executionId,
                                      el.id
                                  ].includes(targetJobId)
                          )
                        : null;
                    const failedObj = !matched ? container.find(isEntryFailed) : null;
                    const firstObj = matched || failedObj || container.find(el => el && typeof el === "object");
                    if (firstObj) {
                        focus = { ...unwrapped, ...firstObj };
                        break;
                    }
                } else if (container && typeof container === "object") {
                    const entries = Object.entries(container);
                    if (entries.length > 0) {
                        const matchedEntry = targetJobId
                            ? entries.find(([k, v]) => {
                                  if (k === targetJobId || v === targetJobId) return true;
                                  if (v && typeof v === "object") {
                                      return [v.jobId, v.job_id, v.taskId, v.id].includes(targetJobId);
                                  }
                                  return false;
                              })
                            : null;
                        const failedEntry = !matchedEntry ? entries.find(([, v]) => isEntryFailed(v)) : null;
                        const chosen = matchedEntry || failedEntry || entries[0];
                        if (chosen && chosen[1] && typeof chosen[1] === "object") {
                            focus = { ...unwrapped, ...chosen[1] };
                            break;
                        }
                    }
                }
            }
        }

        return { parsedSource, unwrapped, focus };
    }

    function extractCommonJobStatusFields(focus, unwrapped, rawText = "") {
        const rawState = String(
            focus?.status ||
            focus?.state ||
            focus?.jobStatus ||
            focus?.job_status ||
            ""
        ).trim();

        const errorObj =
            focus?.error && typeof focus.error === "object" && !Array.isArray(focus.error)
                ? focus.error
                : unwrapped?.error && typeof unwrapped.error === "object" && !Array.isArray(unwrapped.error)
                  ? unwrapped.error
                  : null;

        const rawErrorString =
            typeof focus?.error === "string"
                ? focus.error.trim()
                : typeof unwrapped?.error === "string"
                  ? unwrapped.error.trim()
                  : "";

        const errorCode = String(
            focus?.errorCode ||
            focus?.error_code ||
            errorObj?.errorCode ||
            errorObj?.code ||
            unwrapped?.errorCode ||
            unwrapped?.error_code ||
            (/^[a-z0-9_.-]+$/i.test(rawErrorString) ? rawErrorString : "") ||
            (TERMINAL_FAILED_TOKENS.has(rawState.toLowerCase()) ? focus?.code || rawState : "") ||
            (focus?.code && /timeout|error|failed|rejected|invalid|unavailable|unsupported|not_found/i.test(String(focus.code))
                ? focus.code
                : "") ||
            ((focus?.ok === false || unwrapped?.ok === false) && focus?.field ? "invalid_arguments" : "") ||
            ""
        ).trim();

        const humanMessage = String(
            focus?.errorMessage ||
            focus?.error_message ||
            errorObj?.message ||
            unwrapped?.errorMessage ||
            unwrapped?.error_message ||
            ((TERMINAL_FAILED_TOKENS.has(rawState.toLowerCase()) || errorCode || focus?.ok === false || unwrapped?.ok === false)
                ? focus?.message || focus?.reason || unwrapped?.message || unwrapped?.reason || ""
                : "") ||
            (!/^[a-z0-9_.-]+$/i.test(rawErrorString) ? rawErrorString : "") ||
            ""
        ).trim();

        const rawErrorMessage =
            humanMessage ||
            rawErrorString ||
            (TERMINAL_FAILED_TOKENS.has(rawState.toLowerCase()) || errorCode ? String(rawText || "").trim() : "");

        const nonTerminalDeadline = isOpusNonTerminalWorkerDeadline(
            errorCode,
            rawErrorMessage,
            rawText
        );
        const egressJobId = nonTerminalDeadline
            ? extractOpusEgressJobId(rawErrorMessage, rawText)
            : "";

        let status = normalizeStatus(rawState);
        if (nonTerminalDeadline && status !== "COMPLETED") {
            status = "PROCESSING";
        } else if (
            (focus?.ok === false ||
                focus?.success === false ||
                focus?.rejected === true ||
                unwrapped?.ok === false ||
                unwrapped?.success === false ||
                errorCode) &&
            status !== "COMPLETED"
        ) {
            status = "FAILED";
        }

        return {
            rawState,
            errorCode,
            rawErrorMessage,
            nonTerminalDeadline,
            egressJobId,
            status
        };
    }

    /* =====================================================
       AUDIO OUTCOME & SCHEMA INTROSPECTION (`generate_audio`)
    ===================================================== */

    function extractAudioMetadata(focus, unwrapped) {
        const outputs = Array.isArray(focus?.outputs)
            ? focus.outputs
            : Array.isArray(unwrapped?.outputs)
              ? unwrapped.outputs
              : [];
        const firstOutput = outputs.find(o => o && typeof o === "object") || null;

        const rawDur =
            firstOutput?.durationSeconds ??
            firstOutput?.duration_seconds ??
            focus?.durationSeconds ??
            focus?.duration_seconds ??
            unwrapped?.durationSeconds ??
            null;
        const durationSeconds =
            typeof rawDur === "number" && Number.isFinite(rawDur) && rawDur > 0
                ? Number(rawDur.toFixed(2))
                : null;

        const lyrics = String(
            firstOutput?.lyrics ||
            focus?.lyrics ||
            unwrapped?.lyrics ||
            ""
        ).trim();

        return { durationSeconds, lyrics };
    }

    function inspectAudioJobOutcome(
        rawData,
        rawText = "",
        targetJobId = "",
        { content = null, excludedAssetIds = null, excludedUrls = null } = {}
    ) {
        const { parsedSource, unwrapped, focus } = selectFocusNode(rawData, rawText, targetJobId, [
            "jobs",
            "audio",
            "audios",
            "tracks",
            "clips",
            "items",
            "results",
            "tasks",
            "submissions",
            "outputs",
            "operations"
        ]);

        const common = extractCommonJobStatusFields(focus, unwrapped, rawText);
        let status = common.status;
        let audioUrls = [];

        if (status !== "FAILED") {
            const inlineContentUrls = extractAudioContentDataUrls(content);
            if (inlineContentUrls.length > 0) {
                audioUrls = inlineContentUrls;
            }

            const targetOutputAssetId = String(
                focus?.outputAssetId ||
                focus?.output_asset_id ||
                focus?.resultAssetId ||
                focus?.result_asset_id ||
                focus?.audioAssetId ||
                focus?.audio_asset_id ||
                ""
            ).trim();

            if (audioUrls.length === 0 && targetOutputAssetId && Array.isArray(unwrapped?.assets)) {
                const matchedAsset = unwrapped.assets.find(
                    a => a && typeof a === "object" && (a.assetId === targetOutputAssetId || a.id === targetOutputAssetId)
                );
                if (matchedAsset) {
                    audioUrls = extractAudioUrls(matchedAsset);
                }
            }

            if (audioUrls.length === 0) {
                let sanitizedSource = focus || parsedSource;
                if (sanitizedSource && typeof sanitizedSource === "object" && Array.isArray(sanitizedSource.assets)) {
                    const filteredAssets = sanitizedSource.assets.filter(a => {
                        if (!a || typeof a !== "object") return true;
                        const assetId = String(a.assetId || a.asset_id || a.id || "").trim();
                        if (assetId && excludedAssetIds instanceof Set && excludedAssetIds.has(assetId)) {
                            return false;
                        }
                        const role = String(a.role || a.source || a.origin || "").toLowerCase();
                        const kind = String(a.kind || a.mediaType || "").toLowerCase();
                        if (/^(?:reference|input|import|imported|upload|uploaded)$/.test(role)) {
                            return false;
                        }
                        if (/^(?:image|video)$/.test(kind)) {
                            return false;
                        }
                        return true;
                    });
                    sanitizedSource = { ...sanitizedSource, assets: filteredAssets };
                }
                audioUrls = extractAudioUrls(sanitizedSource);
            }

            if (excludedUrls instanceof Set && excludedUrls.size > 0 && audioUrls.length > 0) {
                audioUrls = audioUrls.filter(url => !excludedUrls.has(url));
            }
        }

        if (audioUrls.length > 0 && status !== "FAILED") {
            status = "COMPLETED";
        }

        const meta = extractAudioMetadata(focus, unwrapped);
        const activeNonTerminalDeadline = common.nonTerminalDeadline && status !== "COMPLETED";

        return {
            status,
            rawState: activeNonTerminalDeadline ? "processing" : (common.rawState || status.toLowerCase()),
            audioUrls,
            outputUrls: audioUrls,
            videoUrls: audioUrls,
            durationSeconds: meta.durationSeconds,
            lyrics: meta.lyrics || null,
            needsApproval: String(common.rawState || "").toLowerCase() === "needs_approval",
            estimatedCredits:
                typeof focus?.estimatedCredits === "number"
                    ? focus.estimatedCredits
                    : typeof unwrapped?.estimatedCredits === "number"
                      ? unwrapped.estimatedCredits
                      : null,
            errorCode: status === "FAILED" ? (common.errorCode || "OPUS_TASK_FAILED") : null,
            errorMessage: status === "FAILED" ? translateOpusError(common.errorCode, common.rawErrorMessage) : null,
            rawErrorMessage: common.rawErrorMessage,
            nonTerminalDeadline: activeNonTerminalDeadline,
            egressJobId: common.egressJobId || null
        };
    }

    function detectAudioBatchArrayKey(topObj, rootSchema) {
        const props = topObj?.properties;
        if (!props) return "";
        const candidates = ["items", "tracks", "audios", "audio", "clips", "requests", "generations"];
        for (const key of candidates) {
            if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
            const itemSchema = resolveArrayItemSchema(props[key], rootSchema);
            if (itemSchema) return key;
        }
        return "";
    }

    function getAudioKindCandidates(audioKind) {
        const normalized = String(audioKind || "speech").trim().toLowerCase();
        if (normalized === "music") {
            return ["music", "bgm", "song", "soundtrack", "musical", "background_music"];
        }
        if (normalized === "sfx" || normalized === "sound_effect" || normalized === "sound_effects") {
            return ["sfx", "sound_effect", "sound_effects", "soundEffect", "soundEffects", "effect", "fx", "sound"];
        }
        return ["speech", "voiceover", "tts", "voice", "narration", "spoken", "dialogue"];
    }

    function scoreAudioSchemaBranch(branchObj, rootSchema, params = {}) {
        const props = branchObj?.properties || {};
        const audioKind = String(params.audioKind || "speech").toLowerCase();
        let score = 0;

        const kindKey = pickSupportedKey(
            props,
            ["audioType", "audio_type", "type", "kind", "category", "mode", "workflow"],
            ""
        );
        if (kindKey) {
            const allowedKinds = extractAllowedValues(props[kindKey], rootSchema);
            if (allowedKinds.length > 0) {
                const matched = matchEnumCaseInsensitive(getAudioKindCandidates(audioKind), allowedKinds);
                score += matched !== null ? 45 : -45;
            }
        }

        if (audioKind === "speech") {
            if (pickSupportedKey(props, ["voice", "voiceId", "voice_id", "voiceName", "speaker"], "")) score += 30;
            if (pickSupportedKey(props, ["text", "script", "narration", "transcript"], "")) score += 20;
            if (pickSupportedKey(props, ["style", "delivery", "direction", "persona"], "")) score += 10;
        } else if (audioKind === "music") {
            if (pickSupportedKey(props, ["lyrics", "instrumental", "bpm", "genre"], "")) score += 25;
            if (pickSupportedKey(props, ["prompt", "description", "brief"], "")) score += 20;
            if (pickSupportedKey(props, ["durationSeconds", "duration_seconds", "duration"], "")) score += 10;
        } else {
            if (pickSupportedKey(props, ["durationSeconds", "duration_seconds", "duration"], "")) score += 20;
            if (pickSupportedKey(props, ["prompt", "description", "brief", "effect"], "")) score += 20;
            if (pickSupportedKey(props, ["voice", "voiceId", "lyrics"], "")) score -= 15;
        }

        return score;
    }

    function matchAudioVoiceValue(desiredVoice, allowedVoices = []) {
        const cleanDesired = String(desiredVoice || "").trim();
        if (!allowedVoices || allowedVoices.length === 0) {
            return cleanDesired || "Sulafat";
        }
        if (cleanDesired) {
            const exact = matchEnumCaseInsensitive([cleanDesired], allowedVoices);
            if (exact !== null) return exact;
            const lowerDesired = cleanDesired.toLowerCase();
            const partial = allowedVoices.find(v => String(v).toLowerCase().includes(lowerDesired));
            if (partial !== undefined) return partial;
        }
        return allowedVoices[0];
    }

    function fillMissingAudioRequiredFields(target, objectSchema, rootSchema, fallbackContext = {}) {
        const props = objectSchema?.properties;
        const required = Array.isArray(objectSchema?.required) ? objectSchema.required : [];
        if (!props || required.length === 0) return;

        for (const reqKey of required) {
            if (target[reqKey] !== undefined) continue;
            const propSchema = props[reqKey];
            const allowed = extractAllowedValues(propSchema, rootSchema);
            if (allowed.length > 0) {
                target[reqKey] = allowed[0];
                continue;
            }
            if (/project/i.test(reqKey) && fallbackContext.projectId) {
                target[reqKey] = fallbackContext.projectId;
            } else if (/requestkey|idempotency/i.test(reqKey)) {
                target[reqKey] = fallbackContext.requestKey || makeUuid();
            } else if (/maxcredits|max_credits/i.test(reqKey)) {
                target[reqKey] = typeof fallbackContext.maxCredits === "number" ? fallbackContext.maxCredits : 0;
            } else if (/voice/i.test(reqKey)) {
                target[reqKey] = fallbackContext.voice || "Sulafat";
            } else if (/text|script|prompt|description|brief/i.test(reqKey)) {
                target[reqKey] = fallbackContext.text || fallbackContext.prompt || "Audio";
            } else if (/label|name|title|id$/i.test(reqKey)) {
                target[reqKey] = propSchema?.format === "uuid" ? makeUuid() : (fallbackContext.defaultLabel || "audio-1");
            } else if (schemaTypeIncludes(propSchema, rootSchema, "boolean")) {
                target[reqKey] = false;
            } else if (schemaTypeIncludes(propSchema, rootSchema, "number") || schemaTypeIncludes(propSchema, rootSchema, "integer")) {
                const min = typeof propSchema?.minimum === "number" ? propSchema.minimum : 5;
                target[reqKey] = Math.max(1, min);
            }
        }
    }

    function populateAudioFields(target, objectSchema, rootSchema, {
        audioKind = "speech",
        text = "",
        prompt = "",
        voice = "Sulafat",
        style = "",
        vocalMode = "instrumental",
        lyrics = "",
        durationSeconds = null,
        opusModel = "",
        modelAliases = [],
        projectId = "",
        requestKey = "",
        maxCredits = null,
        isBatchItem = false,
        minimal = false,
        omitModel = false,
        discoveredAllowedVoices = null,
        discoveredAllowedModels = null,
        discoveredAllowedKinds = null
    }) {
        const props = objectSchema?.properties;
        const required = Array.isArray(objectSchema?.required) ? objectSchema.required : [];
        const defaultLabel = audioKind === "music" ? "music-1" : audioKind === "sfx" ? "sfx-1" : "speech-1";

        if (isBatchItem) {
            const idKey = pickSupportedKey(
                props,
                ["audioId", "audio_id", "trackId", "track_id", "clipId", "clip_id", "itemId", "item_id", "id"],
                !props ? "id" : ""
            );
            if (idKey) {
                target[idKey] = props?.[idKey]?.format === "uuid" ? makeUuid() : defaultLabel;
            }
        } else {
            const reqId = [
                "audioId",
                "audio_id",
                "trackId",
                "track_id",
                "clipId",
                "clip_id",
                "itemId",
                "item_id",
                "id"
            ].find(k => props && Object.prototype.hasOwnProperty.call(props, k) && required.includes(k));
            if (reqId) {
                target[reqId] = props[reqId]?.format === "uuid" ? makeUuid() : defaultLabel;
            }
        }

        const labelKey = pickSupportedKey(props, ["outputLabel", "output_label", "label", "title", "name"], "");
        if (
            labelKey &&
            target[labelKey] === undefined &&
            (required.includes(labelKey) || /outputlabel|output_label/i.test(labelKey) || (isBatchItem && !minimal))
        ) {
            target[labelKey] = defaultLabel;
        }

        const projKey = pickSupportedKey(
            props,
            ["projectId", "project_id"],
            !props && !isBatchItem && projectId ? "projectId" : ""
        );
        if (projKey && projectId && target[projKey] === undefined && (!isBatchItem || required.includes(projKey))) {
            target[projKey] = projectId;
        }

        const reqKeyName = pickSupportedKey(
            props,
            ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
            !props && !isBatchItem ? "requestKey" : ""
        );
        if (reqKeyName && requestKey && target[reqKeyName] === undefined && (!isBatchItem || required.includes(reqKeyName))) {
            target[reqKeyName] = requestKey;
        }

        const maxCreditsKey = pickSupportedKey(props, ["maxCredits", "max_credits"], "");
        if (maxCreditsKey && (typeof maxCredits === "number" || required.includes(maxCreditsKey))) {
            target[maxCreditsKey] = typeof maxCredits === "number" ? maxCredits : 0;
        }

        const kindKey = pickSupportedKey(
            props,
            ["audioType", "audio_type", "type", "kind", "category", "mode", "workflow"],
            !props ? "audioType" : ""
        );
        if (kindKey) {
            const schemaKinds = extractAllowedValues(props?.[kindKey], rootSchema);
            const allowedKinds =
                Array.isArray(discoveredAllowedKinds) && discoveredAllowedKinds.length > 0
                    ? discoveredAllowedKinds
                    : schemaKinds;
            const kindCandidates = getAudioKindCandidates(audioKind);
            if (allowedKinds.length > 0) {
                const matchedKind = matchEnumCaseInsensitive(kindCandidates, allowedKinds);
                if (matchedKind !== null) {
                    target[kindKey] = matchedKind;
                } else if (required.includes(kindKey)) {
                    target[kindKey] = allowedKinds[0];
                }
            } else if (!props || required.includes(kindKey) || !minimal) {
                target[kindKey] = kindCandidates[0];
            }
        }

        const modelKey = pickSupportedKey(
            props,
            ["model", "audioModel", "audio_model", "modelId", "model_id", "providerModel", "engine"],
            ""
        );
        if (modelKey && opusModel && (!omitModel || required.includes(modelKey))) {
            const schemaModels = extractAllowedValues(props?.[modelKey], rootSchema);
            const allowedModels =
                Array.isArray(discoveredAllowedModels) && discoveredAllowedModels.length > 0
                    ? discoveredAllowedModels
                    : schemaModels;
            const candidates = [opusModel, ...(Array.isArray(modelAliases) ? modelAliases : [])].filter(Boolean);
            if (allowedModels.length > 0) {
                const matchedModel = matchEnumCaseInsensitive(candidates, allowedModels);
                if (matchedModel !== null) {
                    target[modelKey] = matchedModel;
                } else if (required.includes(modelKey)) {
                    target[modelKey] = allowedModels[0];
                }
            } else if (required.includes(modelKey)) {
                target[modelKey] = opusModel;
            }
        }

        if (audioKind === "speech") {
            const textKey = pickSupportedKey(
                props,
                ["text", "script", "narration", "input", "transcript", "prompt"],
                !props ? "text" : ""
            );
            const resolvedSpeechText = String(text || prompt || "").trim();
            if (textKey && resolvedSpeechText) {
                target[textKey] = resolvedSpeechText;
            }

            const voiceKey = pickSupportedKey(
                props,
                ["voice", "voiceId", "voice_id", "voiceName", "voice_name", "speaker", "speakerId"],
                !props ? "voice" : ""
            );
            if (voiceKey && (voice || required.includes(voiceKey))) {
                const schemaVoices = extractAllowedValues(props?.[voiceKey], rootSchema);
                const allowedVoices =
                    Array.isArray(discoveredAllowedVoices) && discoveredAllowedVoices.length > 0
                        ? discoveredAllowedVoices
                        : schemaVoices;
                target[voiceKey] = matchAudioVoiceValue(voice, allowedVoices);
            }

            const cleanStyle = String(style || "").trim();
            if (cleanStyle) {
                const styleKey = pickSupportedKey(
                    props,
                    ["style", "stylePrompt", "style_prompt", "delivery", "direction", "persona", "instructions", "voicePrompt"],
                    !props ? "style" : ""
                );
                if (styleKey && styleKey !== textKey) {
                    target[styleKey] = cleanStyle;
                } else if (!styleKey && props?.prompt && textKey && textKey !== "prompt" && (!minimal || required.includes("prompt"))) {
                    target.prompt = cleanStyle;
                }
            }
        } else if (audioKind === "music") {
            const lyricsKey = pickSupportedKey(props, ["lyrics", "lyric", "vocalLyrics", "songLyrics"], "");
            const instrumentalKey = pickSupportedKey(props, ["instrumental", "isInstrumental", "instrumentalOnly"], "");
            const isInstrumental = String(vocalMode || "instrumental").toLowerCase() !== "vocal";
            const cleanLyrics = String(lyrics || "").trim();

            if (instrumentalKey && schemaTypeIncludes(props?.[instrumentalKey], rootSchema, "boolean")) {
                target[instrumentalKey] = isInstrumental;
            }
            if (lyricsKey && !isInstrumental && cleanLyrics) {
                target[lyricsKey] = cleanLyrics;
            }

            const promptParts = [String(prompt || text || "").trim()].filter(Boolean);
            if (
                Number.isFinite(Number(durationSeconds)) &&
                Number(durationSeconds) > 0 &&
                !pickSupportedKey(props, ["durationSeconds", "duration_seconds", "duration", "lengthSeconds"], "")
            ) {
                promptParts.push(`Target length: about ${Math.round(Number(durationSeconds))} seconds.`);
            }
            if (isInstrumental) {
                if (!/instrumental/i.test(promptParts.join(" "))) {
                    promptParts.push("Instrumental only, no vocals.");
                }
            } else if (cleanLyrics && !lyricsKey) {
                promptParts.push(`Lyrics:\n${cleanLyrics}`);
            }

            const musicPrompt = promptParts.join("\n\n").trim();
            const promptKey = pickSupportedKey(
                props,
                ["prompt", "description", "brief", "instruction", "text"],
                !props ? "prompt" : ""
            );
            if (promptKey && musicPrompt) {
                target[promptKey] = musicPrompt;
            }

            if (Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0 && (!minimal || required.some(k => /duration|length/i.test(k)))) {
                applyDurationControls(target, props, required, rootSchema, Number(durationSeconds), "");
            }
        } else {
            /* SFX / Sound Effect */
            const sfxPrompt = String(prompt || text || "").trim();
            const promptKey = pickSupportedKey(
                props,
                ["prompt", "description", "brief", "effect", "instruction", "text"],
                !props ? "prompt" : ""
            );
            if (promptKey && sfxPrompt) {
                target[promptKey] = sfxPrompt;
            }

            const effectiveDur =
                Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
                    ? Number(durationSeconds)
                    : 5;
            applyDurationControls(
                target,
                props,
                required,
                rootSchema,
                effectiveDur,
                !props ? "durationSeconds" : ""
            );
        }

        /* Dukungan sub-objek bersarang (mis. `speech`, `music`, `sfx`, `spec`, `config`, `options`) bila diekspos skema */
        if (props) {
            const subCandidates = [
                "spec",
                "config",
                "options",
                "parameters",
                ...(audioKind === "speech"
                    ? ["speech", "tts", "voiceover"]
                    : audioKind === "music"
                      ? ["music", "bgm", "song"]
                      : ["sfx", "soundEffect", "sound_effect", "soundEffects"])
            ];
            for (const subKey of subCandidates) {
                if (!Object.prototype.hasOwnProperty.call(props, subKey)) continue;
                if (target[subKey] !== undefined) continue;
                if (resolveArrayItemSchema(props[subKey], rootSchema)) continue;
                if (minimal && !required.includes(subKey)) continue;
                const subObj = resolveObjectSchema(props[subKey], rootSchema, (_raw, resolved) =>
                    scoreAudioSchemaBranch(resolved, rootSchema, { audioKind })
                );
                if (!subObj.properties) continue;
                const nested = {};
                populateAudioFields(nested, subObj, rootSchema, {
                    audioKind,
                    text,
                    prompt,
                    voice,
                    style,
                    vocalMode,
                    lyrics,
                    durationSeconds,
                    opusModel,
                    modelAliases,
                    projectId: "",
                    requestKey: "",
                    maxCredits: null,
                    isBatchItem: false,
                    minimal,
                    omitModel,
                    discoveredAllowedVoices,
                    discoveredAllowedModels,
                    discoveredAllowedKinds
                });
                if (Object.keys(nested).length > 0 || required.includes(subKey)) {
                    target[subKey] = nested;
                }
            }
        }

        fillMissingAudioRequiredFields(target, objectSchema, rootSchema, {
            projectId,
            requestKey,
            maxCredits,
            voice,
            text,
            prompt,
            defaultLabel
        });
    }

    function buildSingleAudioArgs(audioTool, params, profile = {}) {
        const rootSchema = audioTool?.inputSchema;
        const topObj = resolveObjectSchema(rootSchema, rootSchema, (_raw, resolved) => {
            const p = resolved?.properties || {};
            if (p.items || p.tracks || p.audios || p.audio || p.clips || p.requests) {
                return 50 + scoreAudioSchemaBranch(resolved, rootSchema, params);
            }
            return 20 + scoreAudioSchemaBranch(resolved, rootSchema, params);
        });

        const topProps = topObj.properties;
        const topRequired = Array.isArray(topObj.required) ? topObj.required : [];
        const batchArrayKey = detectAudioBatchArrayKey(topObj, rootSchema);

        const minimal = Boolean(profile.minimal);
        const omitModel = Boolean(profile.omitModel);

        if (batchArrayKey) {
            const itemSchema = topProps?.[batchArrayKey]
                ? resolveArrayItemSchema(topProps[batchArrayKey], rootSchema)
                : null;
            const expandedBranches = itemSchema ? expandObjectBranches(itemSchema, rootSchema) : [];
            const rankedBranches = expandedBranches.length > 1
                ? expandedBranches
                      .map((branch, idx) => ({
                          branch,
                          score: scoreAudioSchemaBranch(branch, rootSchema, params),
                          idx
                      }))
                      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
                      .map(entry => entry.branch)
                : [
                      itemSchema
                          ? resolveObjectSchema(itemSchema, rootSchema, (_raw, resolved) =>
                                scoreAudioSchemaBranch(resolved, rootSchema, params)
                            )
                          : { properties: null, required: [], raw: null }
                  ];

            const chosenItemObj =
                profile.branchIndex && rankedBranches[profile.branchIndex]
                    ? rankedBranches[profile.branchIndex]
                    : rankedBranches[0];

            const args = {};
            const projKey = pickSupportedKey(
                topProps,
                ["projectId", "project_id"],
                !topProps && params.projectId ? "projectId" : ""
            );
            if (projKey && params.projectId) args[projKey] = params.projectId;

            const reqKey = pickSupportedKey(
                topProps,
                ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
                !topProps ? "requestKey" : ""
            );
            if (reqKey) args[reqKey] = makeUuid();

            if (topProps) {
                const topKindKey = pickSupportedKey(
                    topProps,
                    ["type", "kind", "audioType", "audio_type", "category", "mode"],
                    ""
                );
                if (topKindKey && (!minimal || topRequired.includes(topKindKey))) {
                    const allowedTopKinds = extractAllowedValues(topProps[topKindKey], rootSchema);
                    const matchedKind = matchEnumCaseInsensitive(
                        getAudioKindCandidates(params.audioKind),
                        allowedTopKinds
                    );
                    if (matchedKind !== null) {
                        args[topKindKey] = matchedKind;
                    } else if (topRequired.includes(topKindKey) && allowedTopKinds.length > 0) {
                        args[topKindKey] = allowedTopKinds[0];
                    }
                }
            }

            const item = {};
            populateAudioFields(item, chosenItemObj, rootSchema, {
                ...params,
                requestKey: makeUuid(),
                isBatchItem: true,
                minimal,
                omitModel,
                discoveredAllowedVoices: profile.discoveredAllowedVoices || null,
                discoveredAllowedModels: profile.discoveredAllowedModels || null,
                discoveredAllowedKinds: profile.discoveredAllowedKinds || null
            });
            args[batchArrayKey] = [item];
            return args;
        }

        const expandedTopBranches = rootSchema ? expandObjectBranches(rootSchema, rootSchema) : [];
        const rankedTopBranches = expandedTopBranches.length > 1
            ? expandedTopBranches
                  .map((branch, idx) => ({
                      branch,
                      score: scoreAudioSchemaBranch(branch, rootSchema, params),
                      idx
                  }))
                  .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
                  .map(entry => entry.branch)
            : [topObj];

        const chosenTopObj =
            profile.branchIndex && rankedTopBranches[profile.branchIndex]
                ? rankedTopBranches[profile.branchIndex]
                : rankedTopBranches[0];

        const flatArgs = {};
        populateAudioFields(flatArgs, chosenTopObj, rootSchema, {
            ...params,
            requestKey: makeUuid(),
            isBatchItem: false,
            minimal,
            omitModel,
            discoveredAllowedVoices: profile.discoveredAllowedVoices || null,
            discoveredAllowedModels: profile.discoveredAllowedModels || null,
            discoveredAllowedKinds: profile.discoveredAllowedKinds || null
        });
        return flatArgs;
    }

    function buildGenerateAudioVariants(audioTool, params) {
        const variants = [];
        const seen = new Set();
        const pushUnique = obj => {
            if (!obj || typeof obj !== "object") return;
            const fp = JSON.stringify(stripRequestKeysForComparison(obj));
            if (seen.has(fp)) return;
            seen.add(fp);
            variants.push(obj);
        };

        const profiles = [
            { minimal: false, omitModel: false, branchIndex: 0 },
            { minimal: true, omitModel: false, branchIndex: 0 },
            { minimal: true, omitModel: true, branchIndex: 0 },
            { minimal: false, omitModel: true, branchIndex: 1 },
            { minimal: true, omitModel: true, branchIndex: 1 },
            { minimal: true, omitModel: true, branchIndex: 2 }
        ];

        for (const profile of profiles) {
            try {
                pushUnique(buildSingleAudioArgs(audioTool, params, profile));
            } catch {
                /* coba profil berikutnya */
            }
        }

        const rootSchema = audioTool?.inputSchema;
        const topObj = resolveObjectSchema(rootSchema, rootSchema);
        const batchArrayKey = detectAudioBatchArrayKey(topObj, rootSchema);
        if (batchArrayKey && (!topObj.properties || topObj.properties.prompt || topObj.properties.text)) {
            for (const minimal of [false, true]) {
                try {
                    const flatArgs = {};
                    populateAudioFields(flatArgs, topObj, rootSchema, {
                        ...params,
                        requestKey: makeUuid(),
                        isBatchItem: false,
                        minimal,
                        omitModel: minimal
                    });
                    pushUnique(flatArgs);
                } catch {
                    /* abaikan */
                }
            }
        }

        return variants;
    }

    async function discoverProjectAudioJob(session, projectId, { targetJobId = "", retries = 1, retryDelayMs = 350 } = {}) {
        if (!projectId) return { jobId: "", outcome: null };
        const listJobsTool =
            findMcpTool(session.tools, "list_jobs") ||
            findMcpTool(session.tools, "opusclip_list_jobs") ||
            findMcpTool(session.tools, "get_project_jobs");

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            if (attempt > 0) await sleep(retryDelayMs);
            if (listJobsTool) {
                const listRes = await session
                    .callTool(listJobsTool.name, buildListJobsArgs(listJobsTool, projectId))
                    .catch(() => null);
                if (listRes && !listRes.isError) {
                    const foundId = targetJobId || findJobIdFromResponse(listRes.data, listRes.text, projectId);
                    const outcome = inspectAudioJobOutcome(listRes.data, listRes.text, foundId);
                    if (foundId || outcome.audioUrls.length > 0) {
                        return { jobId: foundId || targetJobId || "", outcome };
                    }
                }
            }
        }
        return { jobId: "", outcome: null };
    }

    async function createAudioTaskForSingleKey(payload = {}, apiKey, options = {}) {
        const endpoint = getMcpEndpoint(options);
        const keySlot = Number.isInteger(options?.keySlot) && options.keySlot > 0 ? options.keySlot : 0;
        const isolateFromDefaultRefresh = Boolean(options?.isolateFromDefaultRefresh);
        const session = await openMcpSession({
            endpoint,
            apiKey,
            timeoutMs: CREATE_TIMEOUT_MS,
            includeTools: true,
            isolateFromDefaultRefresh,
            env: options?.env || null
        });

        const audioKind = String(payload.audio_type || payload.audioKind || "speech").trim().toLowerCase();
        const audioTool =
            findMcpTool(session.tools, "generate_audio") ||
            (audioKind === "speech" ? findMcpTool(session.tools, "opusclip_create_speech_job") : null) ||
            (audioKind === "music" ? findMcpTool(session.tools, "opusclip_create_music_job") : null) ||
            findMcpTool(session.tools, "create_audio_job");

        if (!audioTool) {
            throw createProviderError({
                message: "Tool generate_audio tidak tersedia pada endpoint MCP Opus Labs ini.",
                code: "TOOL_UNAVAILABLE",
                providerCode: "generation_unavailable",
                status: 502
            });
        }

        const usesCreateProject = Boolean(findMcpTool(session.tools, "create_project"));
        const projectId = usesCreateProject ? await ensureProjectId(session) : "";

        const baseBuildParams = {
            audioKind,
            text: String(payload.text || "").trim(),
            prompt: String(payload.prompt || "").trim(),
            voice: String(payload.voice || "Sulafat").trim(),
            style: String(payload.style || "").trim(),
            vocalMode: String(payload.vocal_mode || "instrumental").trim(),
            lyrics: String(payload.lyrics || "").trim(),
            durationSeconds:
                payload.duration !== undefined && payload.duration !== null && payload.duration !== ""
                    ? Number(payload.duration)
                    : null,
            opusModel: String(payload.opus_model || payload.model || "").trim(),
            modelAliases: Array.isArray(payload.model_aliases) ? payload.model_aliases : [],
            projectId
        };

        const candidateVariants = buildGenerateAudioVariants(audioTool, baseBuildParams);
        const triedFingerprints = new Set();
        const enqueueVariant = (insertAt, obj) => {
            if (!obj || typeof obj !== "object") return false;
            const fp = JSON.stringify(stripRequestKeysForComparison(obj));
            if (triedFingerprints.has(fp)) return false;
            candidateVariants.splice(insertAt, 0, obj);
            return true;
        };

        let lastCallResult = null;
        let lastError = null;
        let discoveredDuringTimeout = null;

        for (let vIdx = 0; vIdx < candidateVariants.length && vIdx < 12; vIdx += 1) {
            let variantArgs = candidateVariants[vIdx];
            triedFingerprints.add(JSON.stringify(stripRequestKeysForComparison(variantArgs)));

            try {
                let res = await session.callTool(audioTool.name, variantArgs);
                lastCallResult = res;
                let callOutcome = inspectAudioJobOutcome(res.data, res.text, "", { content: res.content });

                /* Jika tool menggunakan alur quote maxCredits:0 -> needs_approval, otomatis setujui dengan estimatedCredits */
                if (callOutcome.needsApproval && typeof callOutcome.estimatedCredits === "number") {
                    const maxCreditsKey = Object.keys(variantArgs).find(k => /^max_?credits$/i.test(k)) || "maxCredits";
                    variantArgs = {
                        ...variantArgs,
                        [maxCreditsKey]: Math.max(1, Math.ceil(callOutcome.estimatedCredits))
                    };
                    res = await session.callTool(audioTool.name, variantArgs);
                    lastCallResult = res;
                    callOutcome = inspectAudioJobOutcome(res.data, res.text, "", { content: res.content });
                }

                const callJobId = findJobIdFromResponse(res.data, res.text, projectId);

                if (
                    /^(?:submission_unknown|credit_reservation_pending|admission_incomplete)$/i.test(
                        `${callOutcome.errorCode || ""}`
                    )
                ) {
                    throw createProviderError({
                        message: callOutcome.errorMessage || translateOpusError("submission_unknown", res.text),
                        code: "submission_unknown",
                        providerCode: "submission_unknown",
                        status: 502,
                        raw: res.data
                    });
                }

                if (!res.isError && callOutcome.status !== "FAILED") {
                    break;
                }
                if (callJobId || callOutcome.audioUrls.length > 0) {
                    break;
                }

                const retryableValidation = isRetryableKeyframeValidationFailure(
                    callOutcome.errorCode,
                    callOutcome.rawErrorMessage,
                    res.text
                );
                if (retryableValidation) {
                    let insertOffset = vIdx + 1;
                    const discoveredVoices = extractAllowedEnumValuesFromError(
                        res.data,
                        `${callOutcome.rawErrorMessage || ""} ${res.text || ""}`,
                        /voice|speaker/i
                    );
                    const discoveredKinds = extractAllowedEnumValuesFromError(
                        res.data,
                        `${callOutcome.rawErrorMessage || ""} ${res.text || ""}`,
                        /type|kind|mode|category/i
                    );
                    const discoveredModels = extractAllowedEnumValuesFromError(
                        res.data,
                        `${callOutcome.rawErrorMessage || ""} ${res.text || ""}`,
                        /model/i
                    );
                    if (discoveredVoices.length > 0 || discoveredKinds.length > 0 || discoveredModels.length > 0) {
                        for (const minFlag of [false, true]) {
                            try {
                                const adapted = buildSingleAudioArgs(audioTool, baseBuildParams, {
                                    minimal: minFlag,
                                    omitModel: discoveredModels.length === 0,
                                    discoveredAllowedVoices: discoveredVoices.length > 0 ? discoveredVoices : null,
                                    discoveredAllowedKinds: discoveredKinds.length > 0 ? discoveredKinds : null,
                                    discoveredAllowedModels: discoveredModels.length > 0 ? discoveredModels : null
                                });
                                if (enqueueVariant(insertOffset, adapted)) insertOffset += 1;
                            } catch {
                                /* abaikan */
                            }
                        }
                    }

                    const badKeys = extractUnrecognizedKeysFromError(
                        res.data,
                        `${callOutcome.rawErrorMessage || ""} ${res.text || ""}`
                    );
                    if (badKeys.length > 0) {
                        enqueueVariant(insertOffset, stripKeysDeep(variantArgs, new Set(badKeys)));
                    }

                    if (vIdx + 1 < candidateVariants.length) {
                        continue;
                    }
                }
                break;
            } catch (err) {
                lastError = err;
                if (err?.code === "submission_unknown") throw err;
                const isTimeout =
                    err?.code === "UPSTREAM_TIMEOUT" ||
                    err?.code === "TIMEOUT" ||
                    /timeout/i.test(String(err?.message || ""));
                if (isTimeout && projectId) {
                    const probed = await discoverProjectAudioJob(session, projectId, { retries: 1, retryDelayMs: 400 });
                    if (probed.jobId || probed.outcome?.audioUrls?.length > 0) {
                        discoveredDuringTimeout = probed;
                        break;
                    }
                }
                if (
                    !err?.jobId &&
                    (err?.status === 400 || err?.status === 422 || isRetryableKeyframeValidationFailure(err?.code, err?.message)) &&
                    vIdx + 1 < candidateVariants.length
                ) {
                    continue;
                }
                throw err;
            }
        }

        if (discoveredDuringTimeout) {
            const urls = discoveredDuringTimeout.outcome?.audioUrls || [];
            if (discoveredDuringTimeout.jobId) {
                const compositeTaskId = encodeOpusTaskId(projectId, discoveredDuringTimeout.jobId, keySlot);
                return {
                    success: true,
                    provider: PROVIDER_ID,
                    providerName: PROVIDER_NAME,
                    mediaType: "audio",
                    taskId: compositeTaskId,
                    task_id: compositeTaskId,
                    jobId: discoveredDuringTimeout.jobId,
                    projectId,
                    keySlot,
                    status: urls.length > 0 ? "COMPLETED" : "QUEUED",
                    outputUrls: urls,
                    audioUrls: urls
                };
            }
            if (urls.length > 0) {
                const inlineTaskId = `opus-inline:${makeUuid()}`;
                inlineCompletedResults.set(inlineTaskId, {
                    mediaType: "audio",
                    audioUrls: urls,
                    videoUrls: urls,
                    durationSeconds: discoveredDuringTimeout.outcome?.durationSeconds || null,
                    lyrics: discoveredDuringTimeout.outcome?.lyrics || null,
                    createdAtMs: Date.now()
                });
                return {
                    success: true,
                    provider: PROVIDER_ID,
                    providerName: PROVIDER_NAME,
                    mediaType: "audio",
                    taskId: inlineTaskId,
                    task_id: inlineTaskId,
                    jobId: inlineTaskId,
                    projectId,
                    keySlot,
                    status: "COMPLETED",
                    outputUrls: urls,
                    audioUrls: urls,
                    durationSeconds: discoveredDuringTimeout.outcome?.durationSeconds || null,
                    lyrics: discoveredDuringTimeout.outcome?.lyrics || null
                };
            }
        }

        if (!lastCallResult) {
            if (lastError) {
                const schemaHint = summarizeMcpToolSchema(audioTool);
                if (
                    schemaHint &&
                    isRetryableKeyframeValidationFailure(lastError.code, lastError.message) &&
                    !String(lastError.message || "").includes("[schema:")
                ) {
                    lastError.message = `${lastError.message} [schema: ${schemaHint}]`;
                }
                throw lastError;
            }
            throw createProviderError({
                message: "Gagal mengirim permintaan generate_audio ke Opus Labs.",
                code: "CREATE_TASK_FAILED",
                status: 502
            });
        }

        let outcome = inspectAudioJobOutcome(lastCallResult.data, lastCallResult.text, "", {
            content: lastCallResult.content
        });
        if (lastCallResult.isError || outcome.status === "FAILED") {
            const schemaHint = isRetryableKeyframeValidationFailure(
                outcome.errorCode,
                outcome.rawErrorMessage,
                lastCallResult.text
            )
                ? summarizeMcpToolSchema(audioTool)
                : "";
            const baseMsg = outcome.errorMessage || translateOpusError(outcome.errorCode, lastCallResult.text);
            const fullMsg = schemaHint && !baseMsg.includes("[schema:") ? `${baseMsg} [schema: ${schemaHint}]` : baseMsg;
            throw createProviderError({
                message: fullMsg,
                code: outcome.errorCode || "OPUS_CREATE_REJECTED",
                providerCode: outcome.errorCode || "create_rejected",
                status: outcome.errorCode === "credit_admission_rejected" ? 402 : 422,
                raw: lastCallResult.data
            });
        }

        let jobId = findJobIdFromResponse(lastCallResult.data, lastCallResult.text, projectId);
        if (!jobId && outcome.audioUrls.length === 0 && projectId) {
            const discovered = await discoverProjectAudioJob(session, projectId, { retries: 2, retryDelayMs: 350 });
            if (discovered.outcome?.status === "FAILED") {
                throw createProviderError({
                    message: discovered.outcome.errorMessage || "Job audio Opus Labs gagal.",
                    code: discovered.outcome.errorCode || "OPUS_CREATE_REJECTED",
                    status: 422,
                    raw: lastCallResult.data
                });
            }
            if (discovered.jobId) jobId = discovered.jobId;
            if (discovered.outcome?.audioUrls?.length > 0) outcome = discovered.outcome;
        }

        if (jobId) {
            const compositeTaskId = encodeOpusTaskId(projectId, jobId, keySlot);
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "audio",
                taskId: compositeTaskId,
                task_id: compositeTaskId,
                jobId,
                projectId,
                keySlot,
                status: outcome.status === "COMPLETED" && outcome.audioUrls.length > 0 ? "COMPLETED" : "QUEUED",
                outputUrls: outcome.audioUrls,
                audioUrls: outcome.audioUrls,
                durationSeconds: outcome.durationSeconds,
                lyrics: outcome.lyrics
            };
        }

        if (outcome.audioUrls.length > 0) {
            const inlineTaskId = `opus-inline:${makeUuid()}`;
            inlineCompletedResults.set(inlineTaskId, {
                mediaType: "audio",
                audioUrls: outcome.audioUrls,
                videoUrls: outcome.audioUrls,
                durationSeconds: outcome.durationSeconds,
                lyrics: outcome.lyrics,
                createdAtMs: Date.now()
            });
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "audio",
                taskId: inlineTaskId,
                task_id: inlineTaskId,
                jobId: inlineTaskId,
                projectId,
                keySlot,
                status: "COMPLETED",
                outputUrls: outcome.audioUrls,
                audioUrls: outcome.audioUrls,
                durationSeconds: outcome.durationSeconds,
                lyrics: outcome.lyrics
            };
        }

        if (projectId) {
            const pendingTaskId = encodeOpusTaskId(projectId, PROJECT_PENDING_JOB_ID, keySlot);
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "audio",
                taskId: pendingTaskId,
                task_id: pendingTaskId,
                jobId: PROJECT_PENDING_JOB_ID,
                projectId,
                keySlot,
                status: "QUEUED",
                outputUrls: [],
                audioUrls: []
            };
        }

        throw createProviderError({
            message: "Opus Labs tidak mengembalikan jobId audio yang valid.",
            code: "MISSING_TASK_ID",
            status: 502,
            raw: lastCallResult.data
        });
    }

    async function getAudioTaskForSingleKey(parsedId, apiKey, options = {}) {
        const endpoint = getMcpEndpoint(options);
        const session = await openMcpSession({
            endpoint,
            apiKey,
            timeoutMs: QUERY_TIMEOUT_MS,
            includeTools: true,
            isolateFromDefaultRefresh: Boolean(options?.isolateFromDefaultRefresh),
            env: options?.env || null
        });

        let activeJobId = parsedId.jobId;

        if (parsedId.isProjectPending) {
            const discovered = await discoverProjectAudioJob(session, parsedId.projectId, { retries: 0 });
            if (discovered.outcome?.status === "FAILED") {
                return {
                    status: "FAILED",
                    providerState: discovered.outcome.rawState || "failed",
                    mediaType: "audio",
                    audioUrls: [],
                    outputUrls: [],
                    videoUrls: [],
                    errorCode: discovered.outcome.errorCode || "OPUS_STATUS_FAILED",
                    errorMessage: discovered.outcome.errorMessage || "Job audio Opus Labs gagal.",
                    projectId: parsedId.projectId,
                    jobId: discovered.jobId || parsedId.projectId
                };
            }
            if (discovered.outcome?.audioUrls?.length > 0) {
                return {
                    status: "COMPLETED",
                    providerState: "completed",
                    mediaType: "audio",
                    audioUrls: discovered.outcome.audioUrls,
                    outputUrls: discovered.outcome.audioUrls,
                    videoUrls: discovered.outcome.audioUrls,
                    durationSeconds: discovered.outcome.durationSeconds || null,
                    lyrics: discovered.outcome.lyrics || null,
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: discovered.jobId || parsedId.projectId
                };
            }
            if (!discovered.jobId) {
                return {
                    status: "QUEUED",
                    providerState: "queued",
                    mediaType: "audio",
                    audioUrls: [],
                    outputUrls: [],
                    videoUrls: [],
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: parsedId.projectId
                };
            }
            activeJobId = discovered.jobId;
        }

        const statusTool =
            findMcpTool(session.tools, "get_status") ||
            findMcpTool(session.tools, "opusclip_get_media_generation_job") ||
            findMcpTool(session.tools, "opusclip_get_job") ||
            findMcpTool(session.tools, "get_job");

        if (!statusTool) {
            throw createProviderError({
                message: "Tool get_status tidak tersedia pada endpoint MCP Opus Labs.",
                code: "STATUS_TOOL_UNAVAILABLE",
                status: 502
            });
        }

        const rootSchema = statusTool.inputSchema;
        const objSchema = resolveObjectSchema(rootSchema, rootSchema);
        const props = objSchema.properties;
        const statusReq = Array.isArray(objSchema.required) ? objSchema.required : [];
        const args = {};

        const jobSingleKey = pickSupportedKey(
            props,
            ["jobId", "job_id", "taskId", "task_id", "submissionId", "id"],
            ""
        );
        const jobArrayKey = pickSupportedKey(props, ["jobIds", "job_ids", "taskIds", "ids"], "");

        if (jobArrayKey && statusReq.includes(jobArrayKey)) {
            args[jobArrayKey] = [activeJobId];
        } else if (jobSingleKey) {
            args[jobSingleKey] = activeJobId;
        } else if (jobArrayKey) {
            args[jobArrayKey] = [activeJobId];
        } else if (!props) {
            args.jobId = activeJobId;
        }

        const projKey = pickSupportedKey(
            props,
            ["projectId", "project_id"],
            parsedId.projectId && !props ? "projectId" : ""
        );
        if (projKey && parsedId.projectId) args[projKey] = parsedId.projectId;

        const watchKey = pickSupportedKey(props, ["watch", "wait", "block"], "");
        if (watchKey && schemaTypeIncludes(props?.[watchKey], rootSchema, "boolean")) {
            args[watchKey] = false;
        }
        const waitSecKey = pickSupportedKey(props, ["waitSeconds", "wait_seconds"], "");
        if (waitSecKey && schemaTypeIncludes(props?.[waitSecKey], rootSchema, "number")) {
            args[waitSecKey] = 0;
        }

        const statusRes = await session.callTool(statusTool.name, args);
        let outcome = inspectAudioJobOutcome(statusRes.data, statusRes.text, activeJobId, {
            content: statusRes.content
        });

        if (
            (statusRes.isError || outcome.status === "FAILED") &&
            isTransientNotFoundError(outcome.errorCode, outcome.errorMessage, statusRes.text)
        ) {
            if (parsedId.projectId) {
                const listed = await discoverProjectAudioJob(session, parsedId.projectId, {
                    targetJobId: activeJobId,
                    retries: 0
                });
                if (listed.outcome) {
                    outcome = listed.outcome;
                    if (listed.jobId) activeJobId = listed.jobId;
                } else {
                    return {
                        status: "QUEUED",
                        providerState: "queued",
                        mediaType: "audio",
                        audioUrls: [],
                        outputUrls: [],
                        videoUrls: [],
                        errorCode: null,
                        errorMessage: null,
                        projectId: parsedId.projectId,
                        jobId: activeJobId
                    };
                }
            }
        } else if (statusRes.isError && outcome.status !== "COMPLETED" && !outcome.nonTerminalDeadline) {
            return {
                status: "FAILED",
                providerState: outcome.rawState || "failed",
                mediaType: "audio",
                audioUrls: [],
                outputUrls: [],
                videoUrls: [],
                errorCode: outcome.errorCode || "OPUS_STATUS_FAILED",
                errorMessage: outcome.errorMessage || translateOpusError(outcome.errorCode, statusRes.text),
                projectId: parsedId.projectId,
                jobId: activeJobId
            };
        }

        if ((outcome.nonTerminalDeadline || outcome.status === "COMPLETED") && outcome.audioUrls.length === 0) {
            const resolveTool = findMcpTool(session.tools, "resolve_job");
            if (resolveTool) {
                const candidateJobIds = [activeJobId];
                if (outcome.egressJobId && outcome.egressJobId !== activeJobId) {
                    candidateJobIds.push(outcome.egressJobId);
                }
                for (const candidateJobId of candidateJobIds) {
                    const resolvedRes = await session
                        .callTool(
                            resolveTool.name,
                            buildResolveJobArgs(resolveTool, parsedId.projectId, candidateJobId)
                        )
                        .catch(() => null);
                    if (!resolvedRes || resolvedRes.isError) continue;
                    const resolvedOutcome = inspectAudioJobOutcome(
                        resolvedRes.data,
                        resolvedRes.text,
                        candidateJobId
                    );
                    if (resolvedOutcome.audioUrls.length > 0) {
                        outcome = {
                            ...resolvedOutcome,
                            status: "COMPLETED",
                            nonTerminalDeadline: false
                        };
                        break;
                    }
                }
            }

            if (outcome.audioUrls.length === 0 && parsedId.projectId) {
                const listed = await discoverProjectAudioJob(session, parsedId.projectId, {
                    targetJobId: activeJobId,
                    retries: 0
                });
                if (listed.outcome?.audioUrls?.length > 0) {
                    outcome = {
                        ...listed.outcome,
                        status: "COMPLETED",
                        nonTerminalDeadline: false
                    };
                }
            }

            if (outcome.status === "COMPLETED" && outcome.audioUrls.length === 0) {
                return {
                    status: "PROCESSING",
                    providerState: "processing",
                    mediaType: "audio",
                    audioUrls: [],
                    outputUrls: [],
                    videoUrls: [],
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: activeJobId
                };
            }
        }

        const safeProviderState =
            outcome.status === "COMPLETED"
                ? "completed"
                : outcome.status === "FAILED"
                  ? "failed"
                  : outcome.status === "QUEUED"
                    ? "queued"
                    : "processing";

        return {
            status: outcome.status,
            providerState: safeProviderState,
            mediaType: "audio",
            audioUrls: outcome.audioUrls,
            outputUrls: outcome.audioUrls,
            videoUrls: outcome.audioUrls,
            durationSeconds: outcome.durationSeconds || null,
            lyrics: outcome.lyrics || null,
            errorCode: outcome.errorCode,
            errorMessage: outcome.errorMessage,
            nonTerminalDeadline: Boolean(outcome.nonTerminalDeadline),
            projectId: parsedId.projectId,
            jobId: activeJobId
        };
    }

    /* =====================================================
       TRANSCRIBE OUTCOME & SCHEMA INTROSPECTION (`transcribe_audio`)
    ===================================================== */

    function extractInlineTranscriptCandidate(focus, unwrapped, content = null) {
        if (focus && typeof focus === "object") {
            const candidate = normalizeTranscriptPayload(focus);
            if (candidate && candidate.text) return candidate;
        }
        if (unwrapped && typeof unwrapped === "object" && unwrapped !== focus) {
            const candidate = normalizeTranscriptPayload(unwrapped);
            if (candidate && candidate.text) return candidate;
        }
        if (Array.isArray(content)) {
            for (const block of content) {
                if (block && block.type === "text" && typeof block.text === "string" && block.text.trim()) {
                    const rawBlock = block.text.trim();
                    if (rawBlock.startsWith("{") || rawBlock.startsWith("[")) {
                        try {
                            const parsed = JSON.parse(rawBlock);
                            if (
                                parsed &&
                                typeof parsed === "object" &&
                                (parsed.segments || parsed.words || parsed.transcript || parsed.transcription || parsed.srt || parsed.vtt)
                            ) {
                                const norm = normalizeTranscriptPayload(parsed);
                                if (norm) return norm;
                            }
                        } catch {
                            /* lanjut cek SRT */
                        }
                    } else if (rawBlock.includes("-->")) {
                        const norm = normalizeTranscriptPayload(rawBlock);
                        if (norm) return norm;
                    }
                }
            }
        }
        return null;
    }

    async function fetchRemoteTranscriptIfNeeded(transcriptUrls = []) {
        for (const url of transcriptUrls) {
            if (!/^https?:\/\//i.test(String(url || "").trim())) continue;
            try {
                const resp = await fetchWithTimeout(url, { method: "GET" }, 15_000);
                if (!resp.ok) continue;
                const textBody = await resp.text();
                const parsed = normalizeTranscriptPayload(textBody);
                if (parsed && parsed.text) {
                    return parsed;
                }
            } catch {
                /* coba URL berikutnya */
            }
        }
        return null;
    }

    async function inspectTranscribeJobOutcome(
        rawData,
        rawText = "",
        targetJobId = "",
        { content = null, excludedUrls = null } = {}
    ) {
        const { parsedSource, unwrapped, focus } = selectFocusNode(rawData, rawText, targetJobId, [
            "jobs",
            "transcriptions",
            "transcripts",
            "items",
            "results",
            "tasks",
            "submissions",
            "outputs",
            "operations"
        ]);

        const common = extractCommonJobStatusFields(focus, unwrapped, rawText);
        let status = common.status;
        let transcript = null;
        let transcriptUrls = [];

        if (status !== "FAILED") {
            const firstOutput =
                Array.isArray(focus?.outputs) && focus.outputs.length > 0 && typeof focus.outputs[0] === "object"
                    ? focus.outputs[0]
                    : focus?.output && typeof focus.output === "object"
                      ? focus.output
                      : null;

            /* Hindari salah menganggap pesan status "queued"/"processing" sebagai isi transkrip */
            const hasTranscriptIndicators =
                Boolean(
                    focus?.transcript ||
                    focus?.transcription ||
                    focus?.segments ||
                    focus?.utterances ||
                    focus?.words ||
                    focus?.cues ||
                    focus?.captions ||
                    focus?.srt ||
                    focus?.vtt ||
                    focus?.fullText ||
                    focus?.full_text ||
                    firstOutput?.text ||
                    firstOutput?.words ||
                    firstOutput?.segments ||
                    firstOutput?.srt ||
                    firstOutput?.vtt ||
                    (status === "COMPLETED" && typeof focus?.text === "string" && focus.text.trim())
                ) ||
                Boolean(
                    unwrapped?.transcript ||
                    unwrapped?.transcription ||
                    unwrapped?.segments ||
                    unwrapped?.words ||
                    unwrapped?.srt ||
                    unwrapped?.vtt ||
                    unwrapped?.output?.text ||
                    unwrapped?.output?.words
                );

            if (hasTranscriptIndicators) {
                transcript = extractInlineTranscriptCandidate(focus, unwrapped, content);
            }

            transcriptUrls = extractTranscriptUrls(focus || parsedSource, excludedUrls);

            /* Fallback bila status COMPLETED mengembalikan signed URL tanpa ekstensi pada outputs[] */
            if (!transcript && transcriptUrls.length === 0 && status === "COMPLETED") {
                const rawOutputs = Array.isArray(focus?.outputs)
                    ? focus.outputs
                    : focus?.output && typeof focus.output === "object"
                      ? [focus.output]
                      : [];
                for (const outItem of rawOutputs) {
                    if (!outItem || typeof outItem !== "object") continue;
                    const outUrl = String(
                        outItem.url || outItem.downloadUrl || outItem.signedUrl || outItem.transcriptUrl || ""
                    ).trim();
                    if (!/^https?:\/\//i.test(outUrl)) continue;
                    if (excludedUrls instanceof Set && excludedUrls.has(outUrl)) continue;
                    const cleanPath = outUrl.split("?")[0].split("#")[0].toLowerCase();
                    if (/\.(?:mp3|wav|m4a|aac|ogg|flac|mp4|mov|webm|png|jpe?g|webp)$/i.test(cleanPath)) continue;
                    if (!transcriptUrls.includes(outUrl)) transcriptUrls.push(outUrl);
                }
            }

            if (!transcript && transcriptUrls.length > 0) {
                transcript = await fetchRemoteTranscriptIfNeeded(transcriptUrls);
            }
        }

        if (transcript && transcript.text && status !== "FAILED") {
            status = "COMPLETED";
        }

        const activeNonTerminalDeadline = common.nonTerminalDeadline && status !== "COMPLETED";

        return {
            status,
            rawState: activeNonTerminalDeadline ? "processing" : (common.rawState || status.toLowerCase()),
            transcript,
            transcriptUrls,
            needsApproval: String(common.rawState || "").toLowerCase() === "needs_approval",
            estimatedCredits:
                typeof focus?.estimatedCredits === "number"
                    ? focus.estimatedCredits
                    : typeof unwrapped?.estimatedCredits === "number"
                      ? unwrapped.estimatedCredits
                      : null,
            errorCode: status === "FAILED" ? (common.errorCode || "OPUS_TASK_FAILED") : null,
            errorMessage: status === "FAILED" ? translateOpusError(common.errorCode, common.rawErrorMessage) : null,
            rawErrorMessage: common.rawErrorMessage,
            nonTerminalDeadline: activeNonTerminalDeadline,
            egressJobId: common.egressJobId || null
        };
    }

    const TRANSCRIBE_LANGUAGE_EQUIVALENTS = Object.freeze({
        id: ["id", "ind", "id-ID", "indonesian"],
        en: ["en", "eng", "en-US", "english"],
        ja: ["ja", "jpn", "ja-JP", "japanese"],
        ko: ["ko", "kor", "ko-KR", "korean"],
        zh: ["zh", "cmn", "zho", "zh-CN", "chinese", "mandarin"],
        ar: ["ar", "ara", "ar-SA", "arabic"],
        es: ["es", "spa", "es-ES", "spanish"],
        fr: ["fr", "fra", "fr-FR", "french"],
        de: ["de", "deu", "de-DE", "german"],
        pt: ["pt", "por", "pt-BR", "portuguese"],
        ru: ["ru", "rus", "ru-RU", "russian"],
        hi: ["hi", "hin", "hi-IN", "hindi"],
        th: ["th", "tha", "th-TH", "thai"],
        vi: ["vi", "vie", "vi-VN", "vietnamese"],
        ms: ["ms", "msa", "ms-MY", "malay"]
    });

    function resolveLanguageCandidates(rawLang) {
        const clean = String(rawLang || "").trim();
        if (!clean || clean.toLowerCase() === "auto") return [];
        const lower = clean.toLowerCase();
        if (TRANSCRIBE_LANGUAGE_EQUIVALENTS[lower]) {
            return TRANSCRIBE_LANGUAGE_EQUIVALENTS[lower];
        }
        return [clean];
    }

    /**
     * Menghasilkan daftar kandidat nilai berurutan untuk properti input media tunggal
     * pada `transcribe_audio` (mis. `audio` pada skema live Opus Labs MCP:
     * `keys=[audio,purpose,languageCode,diarize,requestKey,projectId]`).
     * Mendukung bentuk objek (`{ assetId }`, `{ type: "asset", assetId }`, `{ url }`),
     * union `oneOf`/`anyOf`, maupun string langsung (`assetId` / `altRef` / `url`).
     */
    function buildSingleMediaInputCandidates(propSchema, rootSchema, stagedMedia) {
        if (!stagedMedia) return [];
        const primaryAssetId = String(stagedMedia.assetId || "").trim();
        const altAssetRef = String(stagedMedia.altRef || "").trim();
        const remoteUrl = String(stagedMedia.url || "").trim();
        const mimeType = String(stagedMedia.mimeType || "").trim();

        const candidates = [];
        const seen = new Set();
        const pushCandidate = val => {
            if (val === undefined || val === null || val === "") return;
            if (typeof val === "object" && Object.keys(val).length === 0) return;
            const fp = JSON.stringify(val);
            if (seen.has(fp)) return;
            seen.add(fp);
            candidates.push(val);
        };

        const expectsString = propSchema ? schemaTypeIncludes(propSchema, rootSchema, "string") : false;
        const expectsObject = propSchema ? schemaTypeIncludes(propSchema, rootSchema, "object") : false;
        const objBranches = propSchema ? expandObjectBranches(propSchema, rootSchema) : [];

        const buildObjectForBranch = (branch, { useAlt = false, includeOptionalMeta = false } = {}) => {
            const bProps = branch?.properties;
            const bReq = Array.isArray(branch?.required) ? branch.required : [];
            if (!bProps) return null;

            const chosenId = useAlt && altAssetRef ? altAssetRef : (primaryAssetId || altAssetRef);
            const idKey = pickSupportedKey(
                bProps,
                ["assetId", "asset_id", "assetRef", "asset_ref", "ref", "id"],
                ""
            );
            const urlKey = pickSupportedKey(
                bProps,
                ["url", "uri", "audioUrl", "audio_url", "videoUrl", "video_url", "mediaUrl", "media_url", "sourceUrl", "source_url"],
                ""
            );
            const pathKey = pickSupportedKey(bProps, ["localPath", "local_path", "filePath", "file_path", "path"], "");

            /* Cabang localPath tidak relevan untuk server remote MCP bila diwajibkan */
            if (pathKey && bReq.includes(pathKey) && !idKey && !urlKey) {
                return null;
            }

            const out = {};
            let boundAsset = false;
            let boundUrl = false;

            if (idKey && chosenId) {
                out[idKey] = chosenId;
                boundAsset = true;
            }
            if (urlKey && remoteUrl && (!boundAsset || bReq.includes(urlKey))) {
                out[urlKey] = remoteUrl;
                boundUrl = true;
            }
            if (!boundAsset && !boundUrl) {
                return null;
            }

            /* Tangani discriminator union seperti `type: "asset"` / `source: "asset"` / `kind: "url"` */
            for (const discKey of ["type", "kind", "source", "sourceType", "source_type", "mode"]) {
                if (!Object.prototype.hasOwnProperty.call(bProps, discKey)) continue;
                if (out[discKey] !== undefined) continue;
                const allowedDisc = extractAllowedValues(bProps[discKey], rootSchema);
                if (allowedDisc.length > 0) {
                    const preferredTokens = boundAsset
                        ? ["asset", "project_asset", "managed_asset", "imported", "id", "reference", "audio", "video", "media"]
                        : ["url", "remote", "uri", "http", "external", "audio", "video", "media"];
                    const matchedDisc = matchEnumCaseInsensitive(preferredTokens, allowedDisc);
                    if (matchedDisc !== null) {
                        out[discKey] = matchedDisc;
                    } else if (bReq.includes(discKey)) {
                        out[discKey] = allowedDisc[0];
                    }
                }
            }

            const mimeKey = pickSupportedKey(bProps, ["mimeType", "mime_type", "contentType", "content_type"], "");
            if (mimeKey && mimeType && (bReq.includes(mimeKey) || includeOptionalMeta)) {
                out[mimeKey] = mimeType;
            }

            const mediaKindKey = pickSupportedKey(bProps, ["mediaType", "media_type", "assetType", "asset_type"], "");
            if (mediaKindKey && (bReq.includes(mediaKindKey) || includeOptionalMeta)) {
                const allowedMediaKinds = extractAllowedValues(bProps[mediaKindKey], rootSchema);
                const mediaKindTokens =
                    stagedMedia.mediaType === "video"
                        ? ["video", "audio", "media"]
                        : ["audio", "media", "sound"];
                const matchedMediaKind =
                    allowedMediaKinds.length > 0
                        ? matchEnumCaseInsensitive(mediaKindTokens, allowedMediaKinds)
                        : stagedMedia.mediaType || "audio";
                if (matchedMediaKind !== null) {
                    out[mediaKindKey] = matchedMediaKind;
                }
            }

            const labelKey = pickSupportedKey(bProps, ["label", "name", "title"], "");
            if (labelKey && bReq.includes(labelKey)) {
                out[labelKey] = stagedMedia.label || "audio1";
            }

            return out;
        };

        const rankedObjectBranches = objBranches
            .map((branch, idx) => {
                const bProps = branch?.properties || {};
                const bReq = Array.isArray(branch?.required) ? branch.required : [];
                let score = 0;
                if (pickSupportedKey(bProps, ["assetId", "asset_id", "assetRef", "asset_ref", "ref", "id"], "")) {
                    score += primaryAssetId || altAssetRef ? 100 : -20;
                }
                if (pickSupportedKey(bProps, ["url", "uri", "audioUrl", "audio_url", "sourceUrl", "mediaUrl"], "")) {
                    score += remoteUrl ? 50 : -20;
                }
                if (bReq.some(k => /^(?:localPath|local_path|filePath|file_path|path)$/i.test(k))) {
                    score -= 100;
                }
                return { branch, score, idx };
            })
            .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
            .map(entry => entry.branch);

        const pushStringCandidates = () => {
            const isExplicitUri =
                propSchema?.format === "uri" ||
                propSchema?.format === "url" ||
                /^https?/i.test(String(propSchema?.pattern || ""));
            if (isExplicitUri) {
                if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) pushCandidate(remoteUrl);
                if (primaryAssetId) pushCandidate(primaryAssetId);
                if (altAssetRef) pushCandidate(altAssetRef);
            } else {
                if (primaryAssetId) pushCandidate(primaryAssetId);
                if (altAssetRef) pushCandidate(altAssetRef);
                if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) pushCandidate(remoteUrl);
            }
        };

        const pushObjectCandidates = () => {
            if (rankedObjectBranches.length > 0) {
                for (const branch of rankedObjectBranches) {
                    pushCandidate(buildObjectForBranch(branch, { useAlt: false, includeOptionalMeta: false }));
                    if (altAssetRef && altAssetRef !== primaryAssetId) {
                        pushCandidate(buildObjectForBranch(branch, { useAlt: true, includeOptionalMeta: false }));
                    }
                    pushCandidate(buildObjectForBranch(branch, { useAlt: false, includeOptionalMeta: true }));
                }
            } else {
                if (primaryAssetId) pushCandidate({ assetId: primaryAssetId });
                if (altAssetRef && altAssetRef !== primaryAssetId) pushCandidate({ assetId: altAssetRef });
                if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) pushCandidate({ url: remoteUrl });
            }
        };

        if (expectsString && !expectsObject && rankedObjectBranches.length === 0) {
            pushStringCandidates();
        } else if (expectsObject || rankedObjectBranches.length > 0) {
            pushObjectCandidates();
            if (expectsString) {
                pushStringCandidates();
            }
        } else {
            /* Skema tanpa deklarasi tipe eksplisit: sediakan objek { assetId } lalu string assetId lalu { url } */
            pushObjectCandidates();
            pushStringCandidates();
        }

        return candidates;
    }

    function detectTranscribeBatchArrayKey(topObj, rootSchema) {
        const props = topObj?.properties;
        if (!props) return "";
        const candidates = ["items", "assets", "inputs", "files", "requests", "transcriptions", "audioAssets"];
        for (const key of candidates) {
            if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
            const itemSchema = resolveArrayItemSchema(props[key], rootSchema);
            if (itemSchema) return key;
        }
        return "";
    }

    function populateTranscribeFields(target, objectSchema, rootSchema, {
        stagedMedia,
        language = "",
        projectId = "",
        requestKey = "",
        isBatchItem = false,
        minimal = false,
        useAltRef = false,
        audioCandidateIndex = 0,
        langCandidateIndex = 0,
        omitLanguage = false,
        discoveredAllowedPurposes = null,
        discoveredAllowedLanguages = null
    }) {
        const props = objectSchema?.properties;
        const required = Array.isArray(objectSchema?.required) ? objectSchema.required : [];

        if (isBatchItem) {
            const idKey = pickSupportedKey(
                props,
                ["transcriptionId", "transcription_id", "itemId", "item_id", "clientId", "client_id", "id"],
                ""
            );
            if (idKey && idKey !== "assetId" && idKey !== "asset_id") {
                target[idKey] = props?.[idKey]?.format === "uuid" ? makeUuid() : "transcribe-1";
            }
        }

        const labelKey = pickSupportedKey(props, ["outputLabel", "output_label", "label", "title", "name"], "");
        if (
            labelKey &&
            target[labelKey] === undefined &&
            (required.includes(labelKey) || /outputlabel|output_label/i.test(labelKey) || (isBatchItem && !minimal))
        ) {
            target[labelKey] = "transcript-1";
        }

        const projKey = pickSupportedKey(
            props,
            ["projectId", "project_id"],
            !props && !isBatchItem && projectId ? "projectId" : ""
        );
        if (projKey && projectId && target[projKey] === undefined && (!isBatchItem || required.includes(projKey))) {
            target[projKey] = projectId;
        }

        const reqKeyName = pickSupportedKey(
            props,
            ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
            !props && !isBatchItem ? "requestKey" : ""
        );
        if (reqKeyName && requestKey && target[reqKeyName] === undefined && (!isBatchItem || required.includes(reqKeyName))) {
            target[reqKeyName] = requestKey;
        }

        /* Asset / Audio / Video Reference Binding (termasuk `audio` pada skema live Opus Labs MCP!) */
        if (stagedMedia) {
            const effectiveAssetId = useAltRef && stagedMedia.altRef
                ? stagedMedia.altRef
                : (stagedMedia.assetId || stagedMedia.altRef || "");

            const singleObjOrIdKey = pickSupportedKey(
                props,
                [
                    "audio",
                    "media",
                    "asset",
                    "audioAsset",
                    "audio_asset",
                    "mediaAsset",
                    "media_asset",
                    "sourceAsset",
                    "source_asset",
                    "inputAsset",
                    "input_asset",
                    "video",
                    "file",
                    "clip",
                    "source",
                    "input",
                    "assetId",
                    "asset_id",
                    "audioAssetId",
                    "audio_asset_id",
                    "mediaAssetId",
                    "media_asset_id",
                    "sourceAssetId",
                    "source_asset_id",
                    "inputAssetId",
                    "input_asset_id"
                ],
                !props && effectiveAssetId ? "audio" : ""
            );

            const arrayRefKey = pickSupportedKey(
                props,
                ["assets", "inputAssets", "input_assets", "audioAssets", "audio_assets", "references", "referenceAssets"],
                ""
            );
            const arrayIdsKey = pickSupportedKey(
                props,
                ["assetIds", "asset_ids", "audioAssetIds", "audio_asset_ids", "inputAssetIds"],
                ""
            );
            const urlKey = pickSupportedKey(
                props,
                ["audioUrl", "audio_url", "mediaUrl", "media_url", "sourceUrl", "source_url", "videoUrl", "video_url", "url", "uri"],
                !props && !effectiveAssetId ? "audioUrl" : ""
            );

            if (singleObjOrIdKey && props?.[singleObjOrIdKey]) {
                if (/Id$|_id$/.test(singleObjOrIdKey) && schemaTypeIncludes(props[singleObjOrIdKey], rootSchema, "string")) {
                    target[singleObjOrIdKey] = effectiveAssetId || stagedMedia.url;
                } else {
                    const mediaCandidates = buildSingleMediaInputCandidates(
                        props[singleObjOrIdKey],
                        rootSchema,
                        stagedMedia
                    );
                    if (mediaCandidates.length > 0) {
                        const chosenIdx = Math.min(Math.max(0, audioCandidateIndex), mediaCandidates.length - 1);
                        target[singleObjOrIdKey] = mediaCandidates[chosenIdx];
                    } else {
                        target[singleObjOrIdKey] = buildFrameFieldValue(
                            props[singleObjOrIdKey],
                            rootSchema,
                            stagedMedia
                        );
                    }
                }
            } else if (singleObjOrIdKey && !props && effectiveAssetId) {
                target[singleObjOrIdKey] = audioCandidateIndex === 1
                    ? effectiveAssetId
                    : { assetId: effectiveAssetId };
            } else if (arrayRefKey && props?.[arrayRefKey]) {
                target[arrayRefKey] = buildReferenceAssetsValue(props[arrayRefKey], rootSchema, [stagedMedia], {
                    minimal,
                    useAltRef
                });
            } else if (arrayIdsKey && effectiveAssetId) {
                target[arrayIdsKey] = [effectiveAssetId];
            } else if (urlKey && stagedMedia.url) {
                target[urlKey] = stagedMedia.url;
            }
        }

        /* Purpose (hanya diisi bila diwajibkan atau cocok dengan enum resmi skema agar tidak ditolak Zod) */
        if (props) {
            const purposeKey = pickSupportedKey(props, ["purpose", "mode", "task", "intent"], "");
            if (purposeKey && (required.includes(purposeKey) || (!minimal && Array.isArray(discoveredAllowedPurposes)))) {
                const schemaPurposes = extractAllowedValues(props[purposeKey], rootSchema);
                const allowedPurposes =
                    Array.isArray(discoveredAllowedPurposes) && discoveredAllowedPurposes.length > 0
                        ? discoveredAllowedPurposes
                        : schemaPurposes;
                if (allowedPurposes.length > 0) {
                    const matchedPurpose = matchEnumCaseInsensitive(
                        ["transcript", "transcription", "captions", "subtitles", "dialogue", "timing", "general", "speech_to_text", "asr"],
                        allowedPurposes
                    );
                    target[purposeKey] = matchedPurpose !== null ? matchedPurpose : allowedPurposes[0];
                } else if (required.includes(purposeKey)) {
                    target[purposeKey] = "transcript";
                }
            } else if (purposeKey && !minimal) {
                const schemaPurposes = extractAllowedValues(props[purposeKey], rootSchema);
                if (schemaPurposes.length > 0) {
                    const matchedPurpose = matchEnumCaseInsensitive(
                        ["transcript", "transcription", "captions", "subtitles", "dialogue", "timing", "general", "speech_to_text", "asr"],
                        schemaPurposes
                    );
                    if (matchedPurpose !== null) {
                        target[purposeKey] = matchedPurpose;
                    }
                }
            }
        }

        /* Language / languageCode (mendukung ISO 639-1 `id`, ISO 639-3 `ind`, BCP-47 `id-ID`, serta auto-detect) */
        const cleanLang = String(language || "").trim();
        if (!omitLanguage && cleanLang && cleanLang.toLowerCase() !== "auto") {
            const langKey = pickSupportedKey(
                props,
                ["languageCode", "language_code", "language", "locale", "sourceLanguage", "source_language"],
                ""
            );
            if (langKey) {
                const langSchema = props?.[langKey];
                const schemaAllowedLangs = extractAllowedValues(langSchema, rootSchema);
                const allowedLangs =
                    Array.isArray(discoveredAllowedLanguages) && discoveredAllowedLanguages.length > 0
                        ? discoveredAllowedLanguages
                        : schemaAllowedLangs;
                const langEquiv = resolveLanguageCandidates(cleanLang);

                if (allowedLangs.length > 0) {
                    const matchedLang = matchEnumCaseInsensitive(langEquiv, allowedLangs);
                    if (matchedLang !== null) {
                        target[langKey] = matchedLang;
                    } else if (required.includes(langKey)) {
                        target[langKey] = allowedLangs[0];
                    }
                } else {
                    const minLen = typeof langSchema?.minLength === "number" ? langSchema.minLength : 0;
                    const maxLen = typeof langSchema?.maxLength === "number" ? langSchema.maxLength : 0;
                    const patternStr = String(langSchema?.pattern || "");
                    if ((minLen === 3 && maxLen === 3) || /^\^?\[a-z.*\]\{3\}\$?$/i.test(patternStr)) {
                        target[langKey] = langEquiv.find(c => c.length === 3) || cleanLang;
                    } else if (patternStr.includes("-") && langEquiv.some(c => c.includes("-"))) {
                        target[langKey] = langEquiv.find(c => c.includes("-")) || cleanLang;
                    } else if (langCandidateIndex > 0 && langEquiv[langCandidateIndex]) {
                        target[langKey] = langEquiv[langCandidateIndex];
                    } else {
                        target[langKey] = langEquiv[0] || cleanLang;
                    }
                }
            }
        }

        /* Aktifkan diarize & timestamp segmen/kata bila skema menyediakan opsi boolean */
        if (props && !minimal) {
            for (const boolKey of [
                "diarize",
                "timestamps",
                "includeTimestamps",
                "include_timestamps",
                "wordTimestamps",
                "word_timestamps"
            ]) {
                if (
                    Object.prototype.hasOwnProperty.call(props, boolKey) &&
                    target[boolKey] === undefined &&
                    schemaTypeIncludes(props[boolKey], rootSchema, "boolean")
                ) {
                    target[boolKey] = true;
                }
            }
        }

        fillMissingAudioRequiredFields(target, objectSchema, rootSchema, {
            projectId,
            requestKey,
            defaultLabel: "transcript-1"
        });
    }

    function buildSingleTranscribeArgs(transcribeTool, params, profile = {}) {
        const rootSchema = transcribeTool?.inputSchema;
        const topObj = resolveObjectSchema(rootSchema, rootSchema);
        const topProps = topObj.properties;
        const batchArrayKey = detectTranscribeBatchArrayKey(topObj, rootSchema);
        const minimal = Boolean(profile.minimal);
        const useAltRef = Boolean(profile.useAltRef);

        if (batchArrayKey && !profile.forceFlat) {
            const itemSchema = topProps?.[batchArrayKey]
                ? resolveArrayItemSchema(topProps[batchArrayKey], rootSchema)
                : null;
            const expanded = itemSchema ? expandObjectBranches(itemSchema, rootSchema) : [];
            const chosenItemObj =
                expanded.length > 0
                    ? expanded[Math.min(profile.branchIndex || 0, expanded.length - 1)]
                    : itemSchema
                      ? resolveObjectSchema(itemSchema, rootSchema)
                      : { properties: null, required: [], raw: null };

            const args = {};
            const projKey = pickSupportedKey(
                topProps,
                ["projectId", "project_id"],
                !topProps && params.projectId ? "projectId" : ""
            );
            if (projKey && params.projectId) args[projKey] = params.projectId;

            const reqKey = pickSupportedKey(
                topProps,
                ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
                !topProps ? "requestKey" : ""
            );
            if (reqKey) args[reqKey] = makeUuid();

            const item = {};
            populateTranscribeFields(item, chosenItemObj, rootSchema, {
                ...params,
                requestKey: makeUuid(),
                isBatchItem: true,
                minimal,
                useAltRef,
                audioCandidateIndex: profile.audioCandidateIndex || 0,
                langCandidateIndex: profile.langCandidateIndex || 0,
                omitLanguage: Boolean(profile.omitLanguage),
                discoveredAllowedPurposes: profile.discoveredAllowedPurposes || null,
                discoveredAllowedLanguages: profile.discoveredAllowedLanguages || null
            });
            args[batchArrayKey] = [item];
            return args;
        }

        const expandedTop = rootSchema ? expandObjectBranches(rootSchema, rootSchema) : [];
        const chosenTop =
            expandedTop.length > 0
                ? expandedTop[Math.min(profile.branchIndex || 0, expandedTop.length - 1)]
                : topObj;

        const flatArgs = {};
        populateTranscribeFields(flatArgs, chosenTop, rootSchema, {
            ...params,
            requestKey: makeUuid(),
            isBatchItem: false,
            minimal,
            useAltRef,
            audioCandidateIndex: profile.audioCandidateIndex || 0,
            langCandidateIndex: profile.langCandidateIndex || 0,
            omitLanguage: Boolean(profile.omitLanguage),
            discoveredAllowedPurposes: profile.discoveredAllowedPurposes || null,
            discoveredAllowedLanguages: profile.discoveredAllowedLanguages || null
        });
        return flatArgs;
    }

    function buildTranscribeAudioVariants(transcribeTool, params) {
        const variants = [];
        const seen = new Set();
        const pushUnique = obj => {
            if (!obj || typeof obj !== "object") return;
            const fp = JSON.stringify(stripRequestKeysForComparison(obj));
            if (seen.has(fp)) return;
            seen.add(fp);
            variants.push(obj);
        };

        const hasExplicitLang =
            Boolean(params?.language) && String(params.language).trim().toLowerCase() !== "auto";

        const profiles = [
            /* 1. Varian lengkap sesuai skema utama (audio kandidat terbaik + diarize + languageCode ISO-639-1) */
            { minimal: false, useAltRef: false, branchIndex: 0, audioCandidateIndex: 0, langCandidateIndex: 0 },
            /* 2. Varian minimal ketat hanya field wajib + kandidat audio utama */
            { minimal: true, useAltRef: false, branchIndex: 0, audioCandidateIndex: 0, langCandidateIndex: 0 },
            /* 3. Bila user memilih bahasa eksplisit, sediakan juga varian kode ISO-639-3 (mis. `ind`, `eng`) */
            ...(hasExplicitLang
                ? [{ minimal: true, useAltRef: false, branchIndex: 0, audioCandidateIndex: 0, langCandidateIndex: 1 }]
                : []),
            /* 4. Kandidat bentuk `audio` alternatif (mis. string `assetId`, `{ assetId }` penuh, `{ url }`, `url`) */
            { minimal: true, useAltRef: false, branchIndex: 0, audioCandidateIndex: 1, langCandidateIndex: 0 },
            { minimal: true, useAltRef: false, branchIndex: 0, audioCandidateIndex: 2, langCandidateIndex: 0 },
            { minimal: true, useAltRef: false, branchIndex: 0, audioCandidateIndex: 3, langCandidateIndex: 0 },
            { minimal: true, useAltRef: true, branchIndex: 0, audioCandidateIndex: 0, langCandidateIndex: 0 },
            /* 5. Cabang skema alternatif bila top-level memakai oneOf/anyOf */
            { minimal: false, useAltRef: false, branchIndex: 1, audioCandidateIndex: 0, langCandidateIndex: 0 },
            { minimal: true, useAltRef: false, branchIndex: 1, audioCandidateIndex: 0, langCandidateIndex: 0 },
            /* 6. Fallback auto-detect tanpa languageCode bila format languageCode ditolak */
            ...(hasExplicitLang
                ? [{ minimal: true, useAltRef: false, branchIndex: 0, audioCandidateIndex: 0, omitLanguage: true }]
                : []),
            { minimal: true, useAltRef: false, branchIndex: 0, audioCandidateIndex: 0, forceFlat: true }
        ];

        for (const profile of profiles) {
            try {
                pushUnique(buildSingleTranscribeArgs(transcribeTool, params, profile));
            } catch {
                /* lanjut */
            }
        }

        return variants;
    }

    async function discoverProjectTranscribeJob(session, projectId, { targetJobId = "", retries = 1, retryDelayMs = 350, excludedUrls = null } = {}) {
        if (!projectId) return { jobId: "", outcome: null };
        const listJobsTool =
            findMcpTool(session.tools, "list_jobs") ||
            findMcpTool(session.tools, "opusclip_list_jobs") ||
            findMcpTool(session.tools, "get_project_jobs");

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            if (attempt > 0) await sleep(retryDelayMs);
            if (listJobsTool) {
                const listRes = await session
                    .callTool(listJobsTool.name, buildListJobsArgs(listJobsTool, projectId))
                    .catch(() => null);
                if (listRes && !listRes.isError) {
                    const foundId = targetJobId || findJobIdFromResponse(listRes.data, listRes.text, projectId);
                    const outcome = await inspectTranscribeJobOutcome(listRes.data, listRes.text, foundId, {
                        excludedUrls
                    });
                    if (foundId || outcome.transcript) {
                        return { jobId: foundId || targetJobId || "", outcome };
                    }
                }
            }
        }
        return { jobId: "", outcome: null };
    }

    async function createTranscribeTaskForSingleKey(payload = {}, apiKey, options = {}) {
        const endpoint = getMcpEndpoint(options);
        const keySlot = Number.isInteger(options?.keySlot) && options.keySlot > 0 ? options.keySlot : 0;
        const mediaCache = options?.mediaCache instanceof Map ? options.mediaCache : null;
        const isolateFromDefaultRefresh = Boolean(options?.isolateFromDefaultRefresh);
        const session = await openMcpSession({
            endpoint,
            apiKey,
            timeoutMs: CREATE_TIMEOUT_MS,
            includeTools: true,
            isolateFromDefaultRefresh,
            env: options?.env || null
        });

        const transcribeTool =
            findMcpTool(session.tools, "transcribe_audio") ||
            findMcpTool(session.tools, "opusclip_transcribe_audio") ||
            findMcpTool(session.tools, "create_transcription_job");

        if (!transcribeTool) {
            throw createProviderError({
                message: "Tool transcribe_audio tidak tersedia pada endpoint MCP Opus Labs ini.",
                code: "TOOL_UNAVAILABLE",
                providerCode: "generation_unavailable",
                status: 502
            });
        }

        const audioInputUrl = String(payload.audio_url || "").trim();
        const videoInputUrl = String(
            payload.video_url ||
            (Array.isArray(payload.video_urls) ? payload.video_urls[0] : "") ||
            ""
        ).trim();
        const sourceUrl = audioInputUrl || videoInputUrl;
        const sourceMediaType = audioInputUrl ? "audio" : "video";

        if (!sourceUrl) {
            throw createProviderError({
                message: "Unggah minimal satu file audio atau video untuk ditranskrip.",
                code: "INVALID_MODEL_INPUT",
                status: 400
            });
        }

        if (!/^data:(?:audio|video)\//i.test(sourceUrl)) {
            const urlCheck = inspectReferenceMediaUrl(sourceUrl);
            if (!urlCheck.valid) {
                throw createProviderError({
                    message: urlCheck.message,
                    code: urlCheck.code || "NON_DIRECT_MEDIA_URL",
                    status: 422
                });
            }
        }

        const projectId = await ensureProjectId(session);
        const importTool = findMcpTool(session.tools, "import_assets");

        const mime = sourceMediaType === "video"
            ? inferVideoMimeFromUrl(sourceUrl)
            : inferAudioMimeFromUrl(sourceUrl);

        const stagedMedia = await stageSingleReferenceImage(
            session,
            importTool,
            projectId,
            {
                url: sourceUrl,
                role: "reference",
                label: sourceMediaType === "video" ? "video1" : "audio1",
                mimeType: mime,
                mediaType: sourceMediaType,
                fileName: `transcribe-source.${extFromMime(mime)}`,
                mediaCache
            },
            0
        );

        const excludedUrls = new Set([sourceUrl, stagedMedia?.url].filter(Boolean));
        const baseParams = {
            stagedMedia,
            language: String(payload.language || "auto").trim(),
            projectId
        };

        const candidateVariants = buildTranscribeAudioVariants(transcribeTool, baseParams);
        const triedFingerprints = new Set();
        const enqueueVariant = (insertAt, obj) => {
            if (!obj || typeof obj !== "object") return false;
            const fp = JSON.stringify(stripRequestKeysForComparison(obj));
            if (triedFingerprints.has(fp)) return false;
            candidateVariants.splice(insertAt, 0, obj);
            return true;
        };

        let lastCallResult = null;
        let lastError = null;
        let discoveredDuringTimeout = null;

        for (let vIdx = 0; vIdx < candidateVariants.length && vIdx < 12; vIdx += 1) {
            let variantArgs = candidateVariants[vIdx];
            triedFingerprints.add(JSON.stringify(stripRequestKeysForComparison(variantArgs)));
            try {
                let res = await session.callTool(transcribeTool.name, variantArgs);
                lastCallResult = res;
                let callOutcome = await inspectTranscribeJobOutcome(res.data, res.text, "", {
                    content: res.content,
                    excludedUrls
                });

                /* Otomatis setujui quote bila transcribe_audio meminta needs_approval */
                if (callOutcome.needsApproval && typeof callOutcome.estimatedCredits === "number") {
                    const maxCreditsKey = Object.keys(variantArgs).find(k => /^max_?credits$/i.test(k)) || "maxCredits";
                    variantArgs = {
                        ...variantArgs,
                        [maxCreditsKey]: Math.max(1, Math.ceil(callOutcome.estimatedCredits))
                    };
                    res = await session.callTool(transcribeTool.name, variantArgs);
                    lastCallResult = res;
                    callOutcome = await inspectTranscribeJobOutcome(res.data, res.text, "", {
                        content: res.content,
                        excludedUrls
                    });
                }

                const callJobId = findJobIdFromResponse(res.data, res.text, projectId);

                if (!res.isError && callOutcome.status !== "FAILED") {
                    break;
                }
                if (callJobId || callOutcome.transcript) {
                    break;
                }

                const retryable = isRetryableKeyframeValidationFailure(
                    callOutcome.errorCode,
                    callOutcome.rawErrorMessage,
                    res.text
                );
                if (retryable) {
                    let insertOffset = vIdx + 1;
                    const errTextCombined = `${callOutcome.rawErrorMessage || ""} ${res.text || ""}`;
                    const discoveredPurposes = extractAllowedEnumValuesFromError(
                        res.data,
                        errTextCombined,
                        /purpose|mode|task|intent/i
                    );
                    const discoveredLanguages = extractAllowedEnumValuesFromError(
                        res.data,
                        errTextCombined,
                        /language|locale/i
                    );
                    if (discoveredPurposes.length > 0 || discoveredLanguages.length > 0) {
                        for (const minFlag of [false, true]) {
                            try {
                                const adapted = buildSingleTranscribeArgs(transcribeTool, baseParams, {
                                    minimal: minFlag,
                                    discoveredAllowedPurposes: discoveredPurposes.length > 0 ? discoveredPurposes : null,
                                    discoveredAllowedLanguages: discoveredLanguages.length > 0 ? discoveredLanguages : null
                                });
                                if (enqueueVariant(insertOffset, adapted)) insertOffset += 1;
                            } catch {
                                /* lanjut */
                            }
                        }
                    }

                    const badKeys = extractUnrecognizedKeysFromError(res.data, errTextCombined);
                    if (badKeys.length > 0) {
                        enqueueVariant(insertOffset, stripKeysDeep(variantArgs, new Set(badKeys)));
                    }
                    if (vIdx + 1 < candidateVariants.length) {
                        continue;
                    }
                }
                break;
            } catch (err) {
                lastError = err;
                const isTimeout =
                    err?.code === "UPSTREAM_TIMEOUT" ||
                    err?.code === "TIMEOUT" ||
                    /timeout/i.test(String(err?.message || ""));
                if (isTimeout && projectId) {
                    const probed = await discoverProjectTranscribeJob(session, projectId, {
                        retries: 1,
                        retryDelayMs: 400,
                        excludedUrls
                    });
                    if (probed.jobId || probed.outcome?.transcript) {
                        discoveredDuringTimeout = probed;
                        break;
                    }
                }
                if (
                    !err?.jobId &&
                    (err?.status === 400 || err?.status === 422 || isRetryableKeyframeValidationFailure(err?.code, err?.message)) &&
                    vIdx + 1 < candidateVariants.length
                ) {
                    continue;
                }
                throw err;
            }
        }

        if (discoveredDuringTimeout) {
            if (discoveredDuringTimeout.jobId) {
                const compositeTaskId = encodeOpusTaskId(projectId, discoveredDuringTimeout.jobId, keySlot);
                return {
                    success: true,
                    provider: PROVIDER_ID,
                    providerName: PROVIDER_NAME,
                    mediaType: "transcribe",
                    taskId: compositeTaskId,
                    task_id: compositeTaskId,
                    jobId: discoveredDuringTimeout.jobId,
                    projectId,
                    keySlot,
                    status: discoveredDuringTimeout.outcome?.transcript ? "COMPLETED" : "QUEUED",
                    transcript: discoveredDuringTimeout.outcome?.transcript || null,
                    outputUrls: []
                };
            }
            if (discoveredDuringTimeout.outcome?.transcript) {
                const inlineTaskId = `opus-inline:${makeUuid()}`;
                inlineCompletedResults.set(inlineTaskId, {
                    mediaType: "transcribe",
                    transcript: discoveredDuringTimeout.outcome.transcript,
                    createdAtMs: Date.now()
                });
                return {
                    success: true,
                    provider: PROVIDER_ID,
                    providerName: PROVIDER_NAME,
                    mediaType: "transcribe",
                    taskId: inlineTaskId,
                    task_id: inlineTaskId,
                    jobId: inlineTaskId,
                    projectId,
                    keySlot,
                    status: "COMPLETED",
                    transcript: discoveredDuringTimeout.outcome.transcript,
                    outputUrls: []
                };
            }
        }

        if (!lastCallResult) {
            if (lastError) {
                const schemaHint = summarizeMcpToolSchema(transcribeTool);
                if (
                    schemaHint &&
                    isRetryableKeyframeValidationFailure(lastError.code, lastError.message) &&
                    !String(lastError.message || "").includes("[schema:")
                ) {
                    lastError.message = `${lastError.message} [schema: ${schemaHint}]`;
                }
                throw lastError;
            }
            throw createProviderError({
                message: "Gagal mengirim permintaan transcribe_audio ke Opus Labs.",
                code: "CREATE_TASK_FAILED",
                status: 502
            });
        }

        let outcome = await inspectTranscribeJobOutcome(lastCallResult.data, lastCallResult.text, "", {
            content: lastCallResult.content,
            excludedUrls
        });

        if (lastCallResult.isError || outcome.status === "FAILED") {
            const schemaHint = isRetryableKeyframeValidationFailure(
                outcome.errorCode,
                outcome.rawErrorMessage,
                lastCallResult.text
            )
                ? summarizeMcpToolSchema(transcribeTool)
                : "";
            const baseMsg = outcome.errorMessage || translateOpusError(outcome.errorCode, lastCallResult.text);
            const fullMsg = schemaHint && !baseMsg.includes("[schema:") ? `${baseMsg} [schema: ${schemaHint}]` : baseMsg;
            throw createProviderError({
                message: fullMsg,
                code: outcome.errorCode || "OPUS_CREATE_REJECTED",
                providerCode: outcome.errorCode || "create_rejected",
                status: outcome.errorCode === "credit_admission_rejected" ? 402 : 422,
                raw: lastCallResult.data
            });
        }

        let jobId = findJobIdFromResponse(lastCallResult.data, lastCallResult.text, projectId);
        if (!jobId && !outcome.transcript && projectId) {
            const discovered = await discoverProjectTranscribeJob(session, projectId, {
                retries: 2,
                retryDelayMs: 350,
                excludedUrls
            });
            if (discovered.outcome?.status === "FAILED") {
                throw createProviderError({
                    message: discovered.outcome.errorMessage || "Job transkripsi Opus Labs gagal.",
                    code: discovered.outcome.errorCode || "OPUS_CREATE_REJECTED",
                    status: 422,
                    raw: lastCallResult.data
                });
            }
            if (discovered.jobId) jobId = discovered.jobId;
            if (discovered.outcome?.transcript) outcome = discovered.outcome;
        }

        if (jobId) {
            const compositeTaskId = encodeOpusTaskId(projectId, jobId, keySlot);
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "transcribe",
                taskId: compositeTaskId,
                task_id: compositeTaskId,
                jobId,
                projectId,
                keySlot,
                status: outcome.status === "COMPLETED" && outcome.transcript ? "COMPLETED" : "QUEUED",
                transcript: outcome.transcript || null,
                outputUrls: outcome.transcriptUrls || []
            };
        }

        if (outcome.transcript) {
            const inlineTaskId = `opus-inline:${makeUuid()}`;
            inlineCompletedResults.set(inlineTaskId, {
                mediaType: "transcribe",
                transcript: outcome.transcript,
                createdAtMs: Date.now()
            });
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "transcribe",
                taskId: inlineTaskId,
                task_id: inlineTaskId,
                jobId: inlineTaskId,
                projectId,
                keySlot,
                status: "COMPLETED",
                transcript: outcome.transcript,
                outputUrls: outcome.transcriptUrls || []
            };
        }

        if (projectId) {
            const pendingTaskId = encodeOpusTaskId(projectId, PROJECT_PENDING_JOB_ID, keySlot);
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "transcribe",
                taskId: pendingTaskId,
                task_id: pendingTaskId,
                jobId: PROJECT_PENDING_JOB_ID,
                projectId,
                keySlot,
                status: "QUEUED",
                transcript: null,
                outputUrls: []
            };
        }

        throw createProviderError({
            message: "Opus Labs tidak mengembalikan jobId transkripsi yang valid.",
            code: "MISSING_TASK_ID",
            status: 502,
            raw: lastCallResult.data
        });
    }

    async function getTranscribeTaskForSingleKey(parsedId, apiKey, options = {}) {
        const endpoint = getMcpEndpoint(options);
        const session = await openMcpSession({
            endpoint,
            apiKey,
            timeoutMs: QUERY_TIMEOUT_MS,
            includeTools: true,
            isolateFromDefaultRefresh: Boolean(options?.isolateFromDefaultRefresh),
            env: options?.env || null
        });

        let activeJobId = parsedId.jobId;

        if (parsedId.isProjectPending) {
            const discovered = await discoverProjectTranscribeJob(session, parsedId.projectId, { retries: 0 });
            if (discovered.outcome?.status === "FAILED") {
                return {
                    status: "FAILED",
                    providerState: discovered.outcome.rawState || "failed",
                    mediaType: "transcribe",
                    transcript: null,
                    outputUrls: [],
                    errorCode: discovered.outcome.errorCode || "OPUS_STATUS_FAILED",
                    errorMessage: discovered.outcome.errorMessage || "Job transkripsi Opus Labs gagal.",
                    projectId: parsedId.projectId,
                    jobId: discovered.jobId || parsedId.projectId
                };
            }
            if (discovered.outcome?.transcript) {
                return {
                    status: "COMPLETED",
                    providerState: "completed",
                    mediaType: "transcribe",
                    transcript: discovered.outcome.transcript,
                    outputUrls: discovered.outcome.transcriptUrls || [],
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: discovered.jobId || parsedId.projectId
                };
            }
            if (!discovered.jobId) {
                return {
                    status: "QUEUED",
                    providerState: "queued",
                    mediaType: "transcribe",
                    transcript: null,
                    outputUrls: [],
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: parsedId.projectId
                };
            }
            activeJobId = discovered.jobId;
        }

        const statusTool =
            findMcpTool(session.tools, "get_status") ||
            findMcpTool(session.tools, "opusclip_get_job") ||
            findMcpTool(session.tools, "get_job");

        if (!statusTool) {
            throw createProviderError({
                message: "Tool get_status tidak tersedia pada endpoint MCP Opus Labs.",
                code: "STATUS_TOOL_UNAVAILABLE",
                status: 502
            });
        }

        const rootSchema = statusTool.inputSchema;
        const objSchema = resolveObjectSchema(rootSchema, rootSchema);
        const props = objSchema.properties;
        const statusReq = Array.isArray(objSchema.required) ? objSchema.required : [];
        const args = {};

        const jobSingleKey = pickSupportedKey(
            props,
            ["jobId", "job_id", "taskId", "task_id", "submissionId", "id"],
            ""
        );
        const jobArrayKey = pickSupportedKey(props, ["jobIds", "job_ids", "taskIds", "ids"], "");

        if (jobArrayKey && statusReq.includes(jobArrayKey)) {
            args[jobArrayKey] = [activeJobId];
        } else if (jobSingleKey) {
            args[jobSingleKey] = activeJobId;
        } else if (jobArrayKey) {
            args[jobArrayKey] = [activeJobId];
        } else if (!props) {
            args.jobId = activeJobId;
        }

        const projKey = pickSupportedKey(
            props,
            ["projectId", "project_id"],
            parsedId.projectId && !props ? "projectId" : ""
        );
        if (projKey && parsedId.projectId) args[projKey] = parsedId.projectId;

        const watchKey = pickSupportedKey(props, ["watch", "wait", "block"], "");
        if (watchKey && schemaTypeIncludes(props?.[watchKey], rootSchema, "boolean")) {
            args[watchKey] = false;
        }

        const statusRes = await session.callTool(statusTool.name, args);
        let outcome = await inspectTranscribeJobOutcome(statusRes.data, statusRes.text, activeJobId, {
            content: statusRes.content
        });

        if (
            (statusRes.isError || outcome.status === "FAILED") &&
            isTransientNotFoundError(outcome.errorCode, outcome.errorMessage, statusRes.text)
        ) {
            if (parsedId.projectId) {
                const listed = await discoverProjectTranscribeJob(session, parsedId.projectId, {
                    targetJobId: activeJobId,
                    retries: 0
                });
                if (listed.outcome) {
                    outcome = listed.outcome;
                    if (listed.jobId) activeJobId = listed.jobId;
                } else {
                    return {
                        status: "QUEUED",
                        providerState: "queued",
                        mediaType: "transcribe",
                        transcript: null,
                        outputUrls: [],
                        errorCode: null,
                        errorMessage: null,
                        projectId: parsedId.projectId,
                        jobId: activeJobId
                    };
                }
            }
        } else if (statusRes.isError && outcome.status !== "COMPLETED" && !outcome.nonTerminalDeadline) {
            return {
                status: "FAILED",
                providerState: outcome.rawState || "failed",
                mediaType: "transcribe",
                transcript: null,
                outputUrls: [],
                errorCode: outcome.errorCode || "OPUS_STATUS_FAILED",
                errorMessage: outcome.errorMessage || translateOpusError(outcome.errorCode, statusRes.text),
                projectId: parsedId.projectId,
                jobId: activeJobId
            };
        }

        if ((outcome.nonTerminalDeadline || outcome.status === "COMPLETED") && !outcome.transcript) {
            const resolveTool = findMcpTool(session.tools, "resolve_job");
            if (resolveTool) {
                const candidateJobIds = [activeJobId];
                if (outcome.egressJobId && outcome.egressJobId !== activeJobId) {
                    candidateJobIds.push(outcome.egressJobId);
                }
                for (const candidateJobId of candidateJobIds) {
                    const resolvedRes = await session
                        .callTool(
                            resolveTool.name,
                            buildResolveJobArgs(resolveTool, parsedId.projectId, candidateJobId)
                        )
                        .catch(() => null);
                    if (!resolvedRes || resolvedRes.isError) continue;
                    const resolvedOutcome = await inspectTranscribeJobOutcome(
                        resolvedRes.data,
                        resolvedRes.text,
                        candidateJobId,
                        { content: resolvedRes.content }
                    );
                    if (resolvedOutcome.transcript) {
                        outcome = {
                            ...resolvedOutcome,
                            status: "COMPLETED",
                            nonTerminalDeadline: false
                        };
                        break;
                    }
                }
            }

            if (!outcome.transcript && parsedId.projectId) {
                const listed = await discoverProjectTranscribeJob(session, parsedId.projectId, {
                    targetJobId: activeJobId,
                    retries: 0
                });
                if (listed.outcome?.transcript) {
                    outcome = {
                        ...listed.outcome,
                        status: "COMPLETED",
                        nonTerminalDeadline: false
                    };
                }
            }

            if (outcome.status === "COMPLETED" && !outcome.transcript) {
                return {
                    status: "PROCESSING",
                    providerState: "processing",
                    mediaType: "transcribe",
                    transcript: null,
                    outputUrls: [],
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: activeJobId
                };
            }
        }

        const safeProviderState =
            outcome.status === "COMPLETED"
                ? "completed"
                : outcome.status === "FAILED"
                  ? "failed"
                  : outcome.status === "QUEUED"
                    ? "queued"
                    : "processing";

        return {
            status: outcome.status,
            providerState: safeProviderState,
            mediaType: "transcribe",
            transcript: outcome.transcript || null,
            outputUrls: outcome.transcriptUrls || [],
            errorCode: outcome.errorCode,
            errorMessage: outcome.errorMessage,
            nonTerminalDeadline: Boolean(outcome.nonTerminalDeadline),
            projectId: parsedId.projectId,
            jobId: activeJobId
        };
    }

    /* =====================================================
       MULTI-KEY POOL WRAPPERS
    ===================================================== */

    async function runCreateWithKeyPool(singleKeyFn, payload = {}, apiKey, options = {}, failLabel = "audio") {
        const keyPool = extractOpusApiKeyPool(apiKey, options?.env);
        if (keyPool.length === 0) {
            parseApiKeyInput("", options?.env);
        }

        const totalKeys = keyPool.length;
        const mediaCache = new Map();

        if (totalKeys <= 1) {
            setActiveKeyIndex(0);
            try {
                const singleRes = await singleKeyFn(payload, keyPool[0] || apiKey, {
                    ...options,
                    keySlot: 0,
                    mediaCache,
                    isolateFromDefaultRefresh: false
                });
                return {
                    ...singleRes,
                    keySlot: 0,
                    keyPoolSize: 1
                };
            } catch (err) {
                if (isOpusCreditExhaustedError(err)) {
                    err.opusFailedKeySlot = 0;
                    err.opusKeyPoolSize = 1;
                    err.exhaustedKeyCount = 1;
                    err.rotatedFullCycle = true;
                }
                throw err;
            }
        }

        const excludedSet = normalizeExcludedSlotSet(
            options?.excludeKeySlots ?? payload?.opus_exclude_key_slots,
            totalKeys
        );
        const currentActive = getActiveKeyIndex();
        const startIndex = ((currentActive % totalKeys) + totalKeys) % totalKeys;
        const candidateSlots = [];
        for (let step = 0; step < totalKeys; step += 1) {
            const slotIndex = (startIndex + step) % totalKeys;
            if (!excludedSet.has(slotIndex)) {
                candidateSlots.push(slotIndex);
            }
        }
        if (candidateSlots.length === 0) {
            for (let step = 0; step < totalKeys; step += 1) {
                candidateSlots.push((startIndex + step) % totalKeys);
            }
        }

        let lastExhaustedError = null;
        let lastAuthError = null;

        for (let idx = 0; idx < candidateSlots.length; idx += 1) {
            const slotIndex = candidateSlots[idx];
            const candidateKey = keyPool[slotIndex];
            try {
                const result = await singleKeyFn(payload, candidateKey, {
                    ...options,
                    keySlot: slotIndex,
                    mediaCache,
                    isolateFromDefaultRefresh: slotIndex > 0 || totalKeys > 1
                });
                setActiveKeyIndex(slotIndex);
                return {
                    ...result,
                    keySlot: slotIndex,
                    keyPoolSize: totalKeys
                };
            } catch (err) {
                if (isOpusCreditExhaustedError(err)) {
                    lastExhaustedError = err;
                    if (idx + 1 < candidateSlots.length) continue;
                    setActiveKeyIndex(0);
                    err.opusFailedKeySlot = slotIndex;
                    err.opusKeyPoolSize = totalKeys;
                    err.exhaustedKeyCount = totalKeys;
                    err.rotatedFullCycle = true;
                    throw err;
                }
                const isAuthFailure =
                    err?.status === 401 ||
                    err?.status === 403 ||
                    err?.code === "OPUS_AUTH_EXPIRED" ||
                    err?.code === "OPUS_AUTH_REJECTED";
                if (isAuthFailure) {
                    lastAuthError = err;
                    if (idx + 1 < candidateSlots.length) continue;
                    throw lastExhaustedError || lastAuthError;
                }
                throw err;
            }
        }

        if (lastExhaustedError) throw lastExhaustedError;
        if (lastAuthError) throw lastAuthError;
        throw createProviderError({
            message: `Semua API key Opus gagal memproses permintaan ${failLabel}.`,
            code: "OPUS_CREATE_REJECTED",
            status: 503
        });
    }

    async function runGetWithKeyPool(singleKeyFn, taskId, apiKey, options = {}, mediaType = "audio") {
        const parsedId = parseOpusTaskId(taskId);
        if (!parsedId.jobId) {
            throw createProviderError({
                message: `Task ID ${mediaType} Opus tidak ditemukan.`,
                code: "TASK_ID_MISSING",
                status: 400
            });
        }

        for (const [key, entry] of inlineCompletedResults.entries()) {
            if (Date.now() - entry.createdAtMs > COMPLETED_INLINE_CACHE_TTL_MS) {
                inlineCompletedResults.delete(key);
            }
        }
        if (parsedId.isInlineDone && inlineCompletedResults.has(parsedId.jobId)) {
            const cached = inlineCompletedResults.get(parsedId.jobId);
            if (mediaType === "transcribe") {
                return {
                    status: "COMPLETED",
                    providerState: "completed",
                    mediaType: "transcribe",
                    transcript: cached.transcript || null,
                    outputUrls: [],
                    errorCode: null,
                    errorMessage: null,
                    projectId: "",
                    jobId: parsedId.jobId
                };
            }
            const urls = cached.audioUrls || cached.videoUrls || [];
            return {
                status: "COMPLETED",
                providerState: "completed",
                mediaType: "audio",
                audioUrls: urls,
                outputUrls: urls,
                videoUrls: urls,
                durationSeconds: cached.durationSeconds || null,
                lyrics: cached.lyrics || null,
                errorCode: null,
                errorMessage: null,
                projectId: "",
                jobId: parsedId.jobId
            };
        }

        const keyPool = extractOpusApiKeyPool(apiKey, options?.env);
        if (keyPool.length <= 1) {
            const singleStatus = await singleKeyFn(parsedId, keyPool[0] || apiKey, {
                ...options,
                isolateFromDefaultRefresh: false
            });
            return {
                ...singleStatus,
                keySlot: 0,
                keyPoolSize: Math.max(1, keyPool.length)
            };
        }

        const totalKeys = keyPool.length;
        const preferredSlot = parsedId.keySlot >= 0 && parsedId.keySlot < totalKeys ? parsedId.keySlot : 0;
        const candidateSlots = [preferredSlot];
        for (let idx = 0; idx < totalKeys; idx += 1) {
            if (idx !== preferredSlot) candidateSlots.push(idx);
        }

        let lastError = null;
        for (let c = 0; c < candidateSlots.length; c += 1) {
            const slotIndex = candidateSlots[c];
            try {
                const result = await singleKeyFn(parsedId, keyPool[slotIndex], {
                    ...options,
                    isolateFromDefaultRefresh: true
                });
                if (
                    result.status === "FAILED" &&
                    isOpusCreditExhaustedError({
                        code: result.errorCode,
                        message: result.errorMessage
                    })
                ) {
                    setActiveKeyIndex((slotIndex + 1) % totalKeys);
                }
                return {
                    ...result,
                    keySlot: slotIndex,
                    keyPoolSize: totalKeys
                };
            } catch (err) {
                lastError = err;
                const retryableOnOtherSlot =
                    err?.status === 401 ||
                    err?.status === 403 ||
                    err?.code === "OPUS_AUTH_EXPIRED" ||
                    err?.code === "OPUS_AUTH_REJECTED";
                if (retryableOnOtherSlot && c + 1 < candidateSlots.length) continue;
                throw err;
            }
        }

        throw lastError || createProviderError({
            message: `Gagal memeriksa status job ${mediaType} Opus Labs.`,
            code: "OPUS_STATUS_FAILED",
            status: 502
        });
    }

    return {
        createAudioTask: (payload, apiKey, options) =>
            runCreateWithKeyPool(createAudioTaskForSingleKey, payload, apiKey, options, "audio"),
        getAudioTask: (taskId, apiKey, options) =>
            runGetWithKeyPool(getAudioTaskForSingleKey, taskId, apiKey, options, "audio"),
        createTranscribeTask: (payload, apiKey, options) =>
            runCreateWithKeyPool(createTranscribeTaskForSingleKey, payload, apiKey, options, "transkripsi"),
        getTranscribeTask: (taskId, apiKey, options) =>
            runGetWithKeyPool(getTranscribeTaskForSingleKey, taskId, apiKey, options, "transcribe")
    };
}
