/* =========================================================
   GEN-Z.AI — TRANSCRIPT & SUBTITLE (SRT / TXT) FORMATTER
   ---------------------------------------------------------
   File:
     assets/js/transcript-format.js

   100% browser-safe & Cloudflare Workers compatible (tanpa node:*).
   Digunakan bersama oleh:
   - provider/opus/client.js (normalisasi output transcribe_audio)
   - lib/generate/persist-generated-audio.js (persist JSON ke storage)
   - generate/assets/js/generate-app.js (preview inline, Copy, .TXT, .SRT)
   - history/assets/js/history-modal.js (preview History, Copy, .TXT, .SRT)
========================================================= */

"use strict";

function toFiniteSeconds(raw) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
        return raw;
    }
    if (typeof raw === "string") {
        const clean = raw.trim();
        if (!clean) return null;
        if (/^\d+(?:\.\d+)?$/.test(clean)) {
            const num = Number(clean);
            return Number.isFinite(num) && num >= 0 ? num : null;
        }
        /* Format HH:MM:SS,mmm atau MM:SS.mmm */
        const timeMatch = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?$/.exec(clean);
        if (timeMatch) {
            const hours = Number(timeMatch[1] || 0);
            const mins = Number(timeMatch[2] || 0);
            const secs = Number(timeMatch[3] || 0);
            const ms = timeMatch[4] ? Number(timeMatch[4].padEnd(3, "0").slice(0, 3)) : 0;
            return hours * 3600 + mins * 60 + secs + ms / 1000;
        }
    }
    return null;
}

function resolveSegmentSeconds(seg, startKeys, msKeys) {
    for (const k of startKeys) {
        if (seg && seg[k] !== undefined && seg[k] !== null) {
            const sec = toFiniteSeconds(seg[k]);
            if (sec !== null) return sec;
        }
    }
    for (const k of msKeys) {
        if (seg && seg[k] !== undefined && seg[k] !== null) {
            const num = Number(seg[k]);
            if (Number.isFinite(num) && num >= 0) {
                return num / 1000;
            }
        }
    }
    return null;
}

export function formatSrtTimestamp(secondsInput) {
    const safe = Math.max(0, Number(secondsInput) || 0);
    const totalMs = Math.round(safe * 1000);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "," +
        String(millis).padStart(3, "0")
    );
}

export function formatReadableTimestamp(secondsInput) {
    const safe = Math.max(0, Number(secondsInput) || 0);
    const totalTenths = Math.round(safe * 10);
    const wholeSecs = Math.floor(totalTenths / 10);
    const tenths = totalTenths % 10;
    const hours = Math.floor(wholeSecs / 3600);
    const minutes = Math.floor((wholeSecs % 3600) / 60);
    const seconds = wholeSecs % 60;

    if (hours > 0) {
        return (
            String(hours).padStart(2, "0") +
            ":" +
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0")
        );
    }

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(tenths)
    );
}

export function parseSrtOrVttSegments(rawSubtitleText) {
    const text = String(rawSubtitleText || "")
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    if (!text || !text.includes("-->")) {
        return [];
    }

    const blocks = text.split(/\n{2,}/);
    const segments = [];

    for (const block of blocks) {
        const lines = block
            .split("\n")
            .map(l => l.trim())
            .filter(Boolean);
        if (lines.length === 0) continue;
        if (/^WEBVTT\b/i.test(lines[0])) continue;

        let timingLineIdx = lines.findIndex(line => line.includes("-->"));
        if (timingLineIdx === -1) continue;

        const timingParts = lines[timingLineIdx].split("-->");
        if (timingParts.length < 2) continue;

        const startSec = toFiniteSeconds(timingParts[0].trim().split(/\s+/)[0]);
        const endSec = toFiniteSeconds(timingParts[1].trim().split(/\s+/)[0]);
        const captionText = lines
            .slice(timingLineIdx + 1)
            .join(" ")
            .replace(/<[^>]+>/g, "")
            .trim();

        if (!captionText) continue;

        segments.push({
            index: segments.length + 1,
            start: startSec ?? 0,
            end: endSec !== null && endSec > (startSec ?? 0) ? endSec : (startSec ?? 0) + 3,
            text: captionText
        });
    }

    return segments;
}

function formatSpeakerLabel(rawSpeaker) {
    const clean = String(rawSpeaker || "").trim();
    if (!clean) return "";
    const speakerIdxMatch = /^speaker[_-\s]*(\d+)$/i.exec(clean);
    if (speakerIdxMatch) {
        return `Speaker ${Number(speakerIdxMatch[1]) + 1}`;
    }
    return clean;
}

function groupWordsIntoSegments(words, maxWordsPerCue = 10) {
    if (!Array.isArray(words) || words.length === 0) return [];
    const normalizedWords = [];
    const distinctSpeakers = new Set();

    for (const w of words) {
        if (!w || typeof w !== "object") continue;
        /* Lewati token whitespace murni dari ElevenLabs Scribe (`type: "spacing"`) */
        if (String(w.type || "").toLowerCase() === "spacing") continue;
        const wordText = String(w.word ?? w.text ?? w.token ?? w.value ?? "").trim();
        if (!wordText) continue;
        const rawSpeaker = String(w.speaker ?? w.speakerId ?? w.speaker_id ?? "").trim();
        if (rawSpeaker) distinctSpeakers.add(rawSpeaker);
        const start = resolveSegmentSeconds(
            w,
            ["start", "startSeconds", "start_seconds", "startTime", "start_time", "offset"],
            ["startMs", "start_ms", "offsetMs", "offset_ms"]
        );
        const end = resolveSegmentSeconds(
            w,
            ["end", "endSeconds", "end_seconds", "endTime", "end_time"],
            ["endMs", "end_ms"]
        );
        normalizedWords.push({
            text: wordText,
            speaker: rawSpeaker,
            start: start ?? (normalizedWords.length > 0 ? normalizedWords[normalizedWords.length - 1].end : 0),
            end:
                end !== null && end >= (start ?? 0)
                    ? end
                    : (start ?? (normalizedWords.length > 0 ? normalizedWords[normalizedWords.length - 1].end : 0)) + 0.35
        });
    }

    if (normalizedWords.length === 0) return [];

    const hasMultipleSpeakers = distinctSpeakers.size >= 2;
    const cues = [];
    let bucket = [];

    const flushBucket = () => {
        if (bucket.length === 0) return;
        const start = bucket[0].start;
        const lastEnd = bucket[bucket.length - 1].end;
        const speakerLabel = hasMultipleSpeakers ? formatSpeakerLabel(bucket[0].speaker) : "";
        cues.push({
            index: cues.length + 1,
            start,
            end: lastEnd > start ? lastEnd : start + 1.5,
            text: bucket.map(item => item.text).join(" ").replace(/\s+([,.;!?])/g, "$1"),
            ...(speakerLabel ? { speaker: speakerLabel } : {})
        });
        bucket = [];
    };

    for (const item of normalizedWords) {
        if (bucket.length > 0) {
            const prev = bucket[bucket.length - 1];
            const gap = item.start - prev.end;
            const speakerChanged =
                hasMultipleSpeakers &&
                item.speaker &&
                prev.speaker &&
                item.speaker !== prev.speaker;
            if (gap > 1.2 || speakerChanged) {
                flushBucket();
            }
        }
        bucket.push(item);
        const endsSentence = /[.!?]$/.test(item.text);
        if (bucket.length >= maxWordsPerCue || (endsSentence && bucket.length >= 4)) {
            flushBucket();
        }
    }
    flushBucket();

    return cues;
}

function synthesizeSegmentsFromPlainText(fullText, totalDurationSeconds = null) {
    const clean = String(fullText || "").trim();
    if (!clean) return [];

    const rawParts = clean
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(Boolean);

    const chunks = [];
    for (const part of rawParts) {
        const words = part.split(/\s+/).filter(Boolean);
        if (words.length <= 14) {
            chunks.push(part);
        } else {
            for (let i = 0; i < words.length; i += 12) {
                chunks.push(words.slice(i, i + 12).join(" "));
            }
        }
    }

    if (chunks.length === 0) return [];

    const totalWords = chunks.reduce((acc, c) => acc + c.split(/\s+/).length, 0) || 1;
    const estimatedTotalSec =
        Number.isFinite(Number(totalDurationSeconds)) && Number(totalDurationSeconds) > 0
            ? Number(totalDurationSeconds)
            : Math.max(chunks.length * 3, totalWords * 0.42);

    let cursor = 0;
    return chunks.map((chunkText, idx) => {
        const wordCount = chunkText.split(/\s+/).length || 1;
        const share = (wordCount / totalWords) * estimatedTotalSec;
        const dur = Math.max(1.2, Number(share.toFixed(2)));
        const start = Number(cursor.toFixed(2));
        const end =
            idx === chunks.length - 1 && Number.isFinite(Number(totalDurationSeconds)) && Number(totalDurationSeconds) > start
                ? Number(Number(totalDurationSeconds).toFixed(2))
                : Number((cursor + dur).toFixed(2));
        cursor = end;
        return {
            index: idx + 1,
            start,
            end: end > start ? end : Number((start + 1.5).toFixed(2)),
            text: chunkText
        };
    });
}

export function buildSrtFromSegments(segments = [], fallbackText = "", durationSeconds = null) {
    let resolvedSegments = Array.isArray(segments) ? segments.filter(s => s && String(s.text || "").trim()) : [];
    if (resolvedSegments.length === 0 && fallbackText) {
        resolvedSegments = synthesizeSegmentsFromPlainText(fallbackText, durationSeconds);
    }
    if (resolvedSegments.length === 0) {
        return "";
    }

    return (
        resolvedSegments
            .map((seg, idx) => {
                const start = Math.max(0, Number(seg.start) || 0);
                const rawEnd = Number(seg.end);
                const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + 2.5;
                const cleanText = String(seg.text || "").trim();
                const cleanSpeaker = String(seg.speaker || "").trim();
                const lineText =
                    cleanSpeaker && !cleanText.startsWith(`[${cleanSpeaker}]`)
                        ? `[${cleanSpeaker}] ${cleanText}`
                        : cleanText;
                return `${idx + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${lineText}`;
            })
            .join("\n\n") + "\n"
    );
}

export function normalizeTranscriptPayload(rawInput) {
    if (!rawInput) return null;

    if (typeof rawInput === "string") {
        const trimmed = rawInput.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                const parsed = JSON.parse(trimmed);
                return normalizeTranscriptPayload(parsed);
            } catch {
                /* lanjut sebagai teks / SRT */
            }
        }

        const srtSegments = parseSrtOrVttSegments(trimmed);
        if (srtSegments.length > 0) {
            const joinedText = srtSegments.map(s => s.text).join(" ").trim();
            const durationSeconds = srtSegments[srtSegments.length - 1]?.end || null;
            return {
                kind: "transcript",
                version: 1,
                text: joinedText,
                txt: joinedText,
                language: "",
                durationSeconds,
                segments: srtSegments,
                srt: buildSrtFromSegments(srtSegments, joinedText, durationSeconds)
            };
        }

        const fallbackSegments = synthesizeSegmentsFromPlainText(trimmed, null);
        return {
            kind: "transcript",
            version: 1,
            text: trimmed,
            txt: trimmed,
            language: "",
            durationSeconds: null,
            segments: fallbackSegments,
            srt: buildSrtFromSegments(fallbackSegments, trimmed, null)
        };
    }

    if (Array.isArray(rawInput)) {
        return normalizeTranscriptPayload({ segments: rawInput });
    }

    if (typeof rawInput !== "object") {
        return null;
    }

    const firstOutputItem =
        Array.isArray(rawInput.outputs) &&
        rawInput.outputs.length > 0 &&
        rawInput.outputs[0] &&
        typeof rawInput.outputs[0] === "object"
            ? rawInput.outputs[0]
            : null;

    const nested =
        (rawInput.transcript && typeof rawInput.transcript === "object" && !Array.isArray(rawInput.transcript)
            ? rawInput.transcript
            : null) ||
        (rawInput.transcription && typeof rawInput.transcription === "object" && !Array.isArray(rawInput.transcription)
            ? rawInput.transcription
            : null) ||
        (rawInput.output && typeof rawInput.output === "object" && !Array.isArray(rawInput.output)
            ? rawInput.output
            : null) ||
        firstOutputItem ||
        (rawInput.result && typeof rawInput.result === "object" && !Array.isArray(rawInput.result)
            ? rawInput.result
            : null) ||
        (rawInput.data && typeof rawInput.data === "object" && !Array.isArray(rawInput.data)
            ? rawInput.data
            : null);

    const source = nested
        ? { ...rawInput, ...nested }
        : rawInput;

    const rawSegmentArray =
        (Array.isArray(source.segments) && source.segments.length > 0 && source.segments) ||
        (Array.isArray(source.utterances) && source.utterances.length > 0 && source.utterances) ||
        (Array.isArray(source.cues) && source.cues.length > 0 && source.cues) ||
        (Array.isArray(source.captions) && source.captions.length > 0 && source.captions) ||
        (Array.isArray(source.phrases) && source.phrases.length > 0 && source.phrases) ||
        (Array.isArray(source.lines) && source.lines.length > 0 && source.lines) ||
        (Array.isArray(source.sentences) && source.sentences.length > 0 && source.sentences) ||
        (Array.isArray(source.transcript) && source.transcript.length > 0 && source.transcript) ||
        null;

    let segments = [];
    if (rawSegmentArray) {
        for (const item of rawSegmentArray) {
            if (!item || typeof item !== "object") continue;
            const segText = String(
                item.text ?? item.transcript ?? item.caption ?? item.content ?? item.utterance ?? item.value ?? ""
            ).trim();
            if (!segText) continue;

            const start = resolveSegmentSeconds(
                item,
                ["start", "startSeconds", "start_seconds", "startTime", "start_time", "from", "offset"],
                ["startMs", "start_ms", "fromMs", "offsetMs", "offset_ms"]
            );
            const end = resolveSegmentSeconds(
                item,
                ["end", "endSeconds", "end_seconds", "endTime", "end_time", "to"],
                ["endMs", "end_ms", "toMs"]
            );
            const prevEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
            const resolvedStart = start !== null ? start : prevEnd;
            const durSec = toFiniteSeconds(item.duration ?? item.durationSeconds ?? item.duration_seconds);
            const resolvedEnd =
                end !== null && end > resolvedStart
                    ? end
                    : durSec !== null && durSec > 0
                        ? resolvedStart + durSec
                        : resolvedStart + 2.5;

            segments.push({
                index: segments.length + 1,
                start: Number(resolvedStart.toFixed(3)),
                end: Number(resolvedEnd.toFixed(3)),
                text: segText,
                ...(item.speaker ? { speaker: String(item.speaker).trim() } : {})
            });
        }
    }

    if (segments.length === 0 && Array.isArray(source.words) && source.words.length > 0) {
        segments = groupWordsIntoSegments(source.words);
    }

    if (segments.length === 0 && typeof source.srt === "string" && source.srt.includes("-->")) {
        segments = parseSrtOrVttSegments(source.srt);
    } else if (segments.length === 0 && typeof source.vtt === "string" && source.vtt.includes("-->")) {
        segments = parseSrtOrVttSegments(source.vtt);
    }

    const directTextCandidates = [
        typeof source.text === "string" ? source.text : "",
        typeof source.fullText === "string" ? source.fullText : "",
        typeof source.full_text === "string" ? source.full_text : "",
        typeof source.transcript === "string" ? source.transcript : "",
        typeof source.transcription === "string" ? source.transcription : "",
        typeof source.txt === "string" ? source.txt : ""
    ];

    let fullText = "";
    for (const candidate of directTextCandidates) {
        const clean = String(candidate || "").trim();
        if (clean) {
            if (clean.includes("-->")) {
                const parsedFromSrt = parseSrtOrVttSegments(clean);
                if (parsedFromSrt.length > 0) {
                    if (segments.length === 0) segments = parsedFromSrt;
                    fullText = parsedFromSrt.map(s => s.text).join(" ").trim();
                    break;
                }
            }
            fullText = clean;
            break;
        }
    }

    if (!fullText && segments.length > 0) {
        fullText = segments.map(s => s.text).join(" ").trim();
    }

    if (!fullText && segments.length === 0) {
        return null;
    }

    const rawDur = toFiniteSeconds(
        source.durationSeconds ??
        source.duration_seconds ??
        source.audioDurationSeconds ??
        source.audio_duration_seconds ??
        source.duration
    );
    const durationSeconds =
        rawDur !== null && rawDur > 0
            ? Number(rawDur.toFixed(2))
            : segments.length > 0
                ? Number((segments[segments.length - 1].end || 0).toFixed(2)) || null
                : null;

    if (segments.length === 0 && fullText) {
        segments = synthesizeSegmentsFromPlainText(fullText, durationSeconds);
    }

    const language = String(
        source.language ||
        source.languageCode ||
        source.language_code ||
        source.detectedLanguage ||
        source.detected_language ||
        source.locale ||
        ""
    ).trim();

    const srt =
        typeof source.srt === "string" && source.srt.includes("-->")
            ? source.srt.trim() + "\n"
            : buildSrtFromSegments(segments, fullText, durationSeconds);

    return {
        kind: "transcript",
        version: 1,
        text: fullText,
        txt: fullText,
        language,
        durationSeconds,
        segments,
        srt
    };
}
