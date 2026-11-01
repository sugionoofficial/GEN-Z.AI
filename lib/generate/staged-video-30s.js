// =========================================================
// GEN-Z.AI
// STAGED 30-SECOND VIDEO PIPELINE HELPERS (3 x 10 DETIK)
// ---------------------------------------------------------
// File:
//   lib/generate/staged-video-30s.js
//
// Mendukung model clone Seedance 2.5 Reference to Video 30s:
//   1. Klip 1 (0-10 dtk) via Seedance 2.5 Reference to Video
//   2. Simpan Klip 1 di server + ekstrak frame paling akhir
//   3. Klip 2 (11-20 dtk):
//      - Jika ada @video1..3 / @audio1..3: potong segmen 10-20s
//        (auto-loop bila referensi < 30s) & kirim ke R2V bersama frame akhir Klip 1
//      - Jika hanya gambar: lanjut dari frame akhir Klip 1 (first_last_frame)
//   4. Simpan Klip 2 di server + ekstrak frame paling akhir
//   5. Klip 3 (21-30 dtk):
//      - Jika ada @video1..3 / @audio1..3: potong segmen 20-30s
//        (auto-loop bila referensi < 30s) & kirim ke R2V bersama frame akhir Klip 2
//      - Jika hanya gambar: lanjut dari frame akhir Klip 2 (first_last_frame)
//   6. Simpan Klip 3 di server + gabungkan mulus 3 klip (memakai audio asli
//      utuh dari @audio1/@video1 bila tersedia) -> History
// =========================================================

export const STAGED_30S_MODEL_ID = "opus-seedance-2.5-r2v-30s";
export const STAGED_30S_BASE_R2V_MODEL_ID = "opus-seedance-2.5-r2v";
export const STAGED_30S_CONTINUATION_I2V_MODEL_ID = "opus-seedance-2.5-i2v";
export const STAGED_30S_TASK_PREFIX = "staged30_";
export const STAGED_30S_WORKFLOW_FILE = "staged-video-30s.yml";

export const STAGED_30S_CLIP_COUNT = 3;
export const STAGED_20S_CLIP_COUNT = 2;
export const STAGED_30S_CLIP_DURATION = 10;
export const STAGED_20S_TOTAL_DURATION = 20;
export const STAGED_30S_TOTAL_DURATION = 30;
export const STAGED_SUPPORTED_TOTAL_DURATIONS = Object.freeze([20, 30]);
export const STAGED_30S_MAX_PROMPT = 8000;
export const DEFAULT_WORKER_PUBLIC_BASE_URL = "https://genzai.genzai-f37.workers.dev";

const NON_TIME_UNIT_AFTER_RANGE_RE = /^\s*(?:tahun|thn|th|cm|mm|km|meter|m2|kg|gram|gr|orang|buah|pcs|persen|%|ribu|rb|juta|jt|rupiah|rp|kali|x\b|fps\b)/i;

export function resolveStagedTargetConfig(rawDuration = STAGED_30S_TOTAL_DURATION) {
    const num = Math.round(Number(String(rawDuration ?? "").trim().replace(/s$/i, "")));
    if (num === STAGED_20S_TOTAL_DURATION) {
        return {
            targetDuration: STAGED_20S_TOTAL_DURATION,
            totalClips: STAGED_20S_CLIP_COUNT,
            clipDuration: STAGED_30S_CLIP_DURATION
        };
    }

    return {
        targetDuration: STAGED_30S_TOTAL_DURATION,
        totalClips: STAGED_30S_CLIP_COUNT,
        clipDuration: STAGED_30S_CLIP_DURATION
    };
}

export function isStaged30sModelId(modelId) {
    return String(modelId || "").trim().toLowerCase() === STAGED_30S_MODEL_ID;
}

export function isStaged30sTaskId(taskId) {
    return String(taskId || "").trim().toLowerCase().startsWith(STAGED_30S_TASK_PREFIX);
}

export function generateStaged30sTaskId(now = Date.now, randomHex = "") {
    const ts = Number(typeof now === "function" ? now() : now) || Date.now();
    const suffix = String(randomHex || "").trim() ||
        Math.random().toString(36).slice(2, 10);
    return `${STAGED_30S_TASK_PREFIX}${ts}_${suffix}`;
}

function clampPromptLength(text, maxLength = STAGED_30S_MAX_PROMPT) {
    const clean = String(text || "").trim();
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, maxLength).trim();
}

export function cleanContinuationPromptForFirstFrame(promptText) {
    let cleaned = String(promptText || "");

    // Ganti rujukan @video1..3 & @audio1..3 pada frasa umum agar kalimat tetap alami
    cleaned = cleaned.replace(
        /\b(?:mengikuti|meniru|sesuai(?:\s+dengan)?|berdasarkan)\s+(?:gerakan\s+|gaya\s+|irama\s+|musik\s+|suara\s+|audio\s+|referensi\s+)?@(?:video|audio)[1-3]\b/gi,
        "dengan gerakan dan ritme yang tetap konsisten"
    );
    cleaned = cleaned.replace(
        /\b(?:dengan|memakai|menggunakan)\s+(?:suara|audio|musik|lagu|gerakan|referensi)\s+@(?:video|audio)[1-3]\b/gi,
        "dengan ekspresi serta ritme yang konsisten"
    );

    // Ganti @image1/@image2/@image3 menjadi rujukan ke subjek/elemen di frame awal
    let imageMentionCount = 0;
    cleaned = cleaned.replace(/@image([1-3])\b/gi, (_match, idx) => {
        imageMentionCount += 1;
        if (String(idx) === "1") {
            return imageMentionCount === 1 ? "subjek utama pada frame awal" : "subjek utama";
        }
        return `elemen pendukung pada frame awal`;
    });

    // Bersihkan sisa token @videoN / @audioN yang berdiri sendiri
    cleaned = cleaned.replace(/@(?:video|audio)[1-3]\b/gi, "");

    // Rapikan spasi dan tanda baca ganda akibat penghapusan token
    cleaned = cleaned
        .replace(/\(\s*\)/g, "")
        .replace(/\[\s*\]/g, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([,;:]){2,}/g, "$1")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return cleaned;
}

function parseClockSeconds(mm, ss) {
    const minutes = Number(mm);
    const seconds = Number(ss);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (minutes !== 0 || seconds < 0 || seconds > 59) return null;
    return minutes * 60 + seconds;
}

// Memindai penanda durasi eksplisit seperti:
//   - "0-10 detik: ...", "11-20 detik: ...", "21-30 detik: ..."
//   - "0-10s ...", "10-20s ...", "20-30s ..."
//   - "[00:00-00:10] ...", "[00:11-00:20] ...", "[00:21-00:30] ..."
//   - "(0-10): ...", "Detik 0-10 - ...", "Durasi 11-20: ..."
export function parseExplicitDurationSegments(rawPrompt) {
    const source = String(rawPrompt || "").trim();
    if (!source) {
        return { preamble: "", segments: [] };
    }

    const markerRegex = /(?:^|[\n\r]|(?:^|[\s.;—–-])(?=[[(]?(?:detik|durasi|segmen|bagian|scene|shot|klip|clip|waktu|time|timestamp)\b)|(?<=\n)\s*(?:[-*•]|\d+[.)])\s*)([[(]?\s*(?:(?:detik|durasi|segmen|bagian|scene|shot|klip|clip|waktu|time|timestamp)\s*(?:ke-?)?\s*)?(?:(0?0):(\d{2})\s*(?:[-–—]|s\/d|sampai|to)\s*(0?0):(\d{2})|(\d{1,2})\s*(?:s|sec|secs|detik|dtk)?\s*(?:[-–—]|s\/d|sampai|to)\s*(\d{1,2}))\s*(?:s|sec|secs|second|seconds|detik|dtk)?\s*[\])]?\s*(?:[:=\-–—]\s*|\s+))/gi;

    const matches = [];
    let match;

    while ((match = markerRegex.exec(source)) !== null) {
        const fullMatch = match[0];
        const markerCore = match[1] || fullMatch;
        const markerOffsetInMatch = fullMatch.indexOf(markerCore);
        const markerStart = match.index + (markerOffsetInMatch >= 0 ? markerOffsetInMatch : 0);
        const contentStart = match.index + fullMatch.length;

        let startSec = null;
        let endSec = null;
        const isClock = match[2] !== undefined && match[4] !== undefined;

        if (isClock) {
            startSec = parseClockSeconds(match[2], match[3]);
            endSec = parseClockSeconds(match[4], match[5]);
        } else {
            startSec = Number(match[6]);
            endSec = Number(match[7]);
        }

        if (
            startSec === null ||
            endSec === null ||
            !Number.isFinite(startSec) ||
            !Number.isFinite(endSec) ||
            startSec < 0 ||
            endSec <= startSec ||
            endSec > 35
        ) {
            continue;
        }

        const tailPreview = source.slice(contentStart, contentStart + 24);
        if (!isClock && NON_TIME_UNIT_AFTER_RANGE_RE.test(tailPreview)) {
            continue;
        }

        // Untuk pola angka polos tanpa kata kunci/unit/kurung/titik-dua, pastikan ada indikasi waktu/delimiter jelas
        const hasStrongCue =
            isClock ||
            /(?:detik|dtk|durasi|segmen|bagian|scene|shot|klip|clip|waktu|time|timestamp|\bs\b|\bsec)/i.test(markerCore) ||
            /[[(:=\-–—\]]/.test(markerCore);

        if (!hasStrongCue) {
            continue;
        }

        matches.push({
            markerStart,
            contentStart,
            startSec,
            endSec,
            rawMarker: markerCore.trim()
        });
    }

    if (matches.length === 0) {
        return { preamble: source, segments: [] };
    }

    const preamble = source.slice(0, matches[0].markerStart).trim();
    const segments = [];

    for (let i = 0; i < matches.length; i += 1) {
        const current = matches[i];
        const nextStart = i + 1 < matches.length ? matches[i + 1].markerStart : source.length;
        const body = source
            .slice(current.contentStart, nextStart)
            .replace(/^[\s:.\-–—]+/, "")
            .trim();
        if (body) {
            segments.push({
                startSec: current.startSec,
                endSec: current.endSec,
                text: body
            });
        }
    }

    return { preamble, segments };
}

function assignSegmentsToBuckets(segments) {
    const buckets = {
        clip1: [],
        clip2: [],
        clip3: []
    };

    for (const seg of segments) {
        const { startSec, endSec } = seg;
        // Contoh umum: 0-10 -> clip1; 10-20 atau 11-20 -> clip2; 20-30 atau 21-30 -> clip3
        if (startSec < 10 && endSec <= 10) {
            buckets.clip1.push(seg);
            continue;
        }
        if (startSec >= 10 && startSec < 20 && endSec <= 20) {
            buckets.clip2.push(seg);
            continue;
        }
        if (startSec >= 20) {
            buckets.clip3.push(seg);
            continue;
        }

        // Jika segmen melintasi batas 10 atau 20 detik (mis. 5-15 atau 0-20), masukkan ke klip yang beririsan signifikan (>= 2 detik)
        if (Math.min(endSec, 10) - Math.max(startSec, 0) >= 2) {
            buckets.clip1.push(seg);
        }
        if (Math.min(endSec, 20) - Math.max(startSec, 10) >= 2) {
            buckets.clip2.push(seg);
        }
        if (Math.min(endSec, 35) - Math.max(startSec, 20) >= 2) {
            buckets.clip3.push(seg);
        }
    }

    return buckets;
}

function formatSegmentListForClip(bucketSegments, clipWindowStart, clipLabelRange, cleanMediaMentions) {
    if (!Array.isArray(bucketSegments) || bucketSegments.length === 0) {
        return "";
    }

    if (bucketSegments.length === 1) {
        const rawText = bucketSegments[0].text;
        return cleanMediaMentions ? cleanContinuationPromptForFirstFrame(rawText) : rawText;
    }

    return bucketSegments
        .map(item => {
            const relStart = Math.max(0, Math.min(10, item.startSec - clipWindowStart));
            const relEnd = Math.max(relStart + 1, Math.min(10, item.endSec - clipWindowStart));
            const text = cleanMediaMentions
                ? cleanContinuationPromptForFirstFrame(item.text)
                : item.text;
            return `[Detik ${relStart}-${relEnd} klip / bagian ${item.startSec}-${item.endSec} dari ${clipLabelRange}] ${text}`;
        })
        .join(" ");
}

function splitNarrativeBeats(rawPrompt) {
    const normalized = String(rawPrompt || "")
        .replace(/\r\n/g, "\n")
        .trim();
    if (!normalized) return [];

    // Pisahkan per baris atau kalimat bermakna terlebih dahulu
    const sentenceParts = normalized
        .split(/(?:\n+|(?<=[.!?])\s+|;\s+)/)
        .map(item => item.trim())
        .filter(Boolean);

    if (sentenceParts.length >= 3) {
        return sentenceParts;
    }

    // Jika hanya 1-2 kalimat panjang, coba pecah berdasarkan kata penghubung urutan adegan
    const expanded = [];
    for (const part of sentenceParts) {
        const subClauses = part
            .split(/\s+(?:lalu|kemudian|setelah itu|selanjutnya|berikutnya|diikuti dengan|sementara itu|hingga akhirnya|dan akhirnya)\s+/i)
            .map(item => item.trim())
            .filter(Boolean);
        if (subClauses.length > 1) {
            expanded.push(...subClauses);
        } else {
            expanded.push(part);
        }
    }

    return expanded.length > 0 ? expanded : [normalized];
}

export function buildStaged30sPrompts(rawPrompt, options = {}) {
    const original = String(rawPrompt || "").trim();
    const preserveMediaRefs = Boolean(
        options?.preserveMediaRefs ||
        options?.hasReferenceMedia ||
        options?.hasVideoRef ||
        options?.hasAudioRef
    );
    const targetConfig = resolveStagedTargetConfig(
        options?.targetDuration ?? (Number(options?.totalClips) === 2 ? 20 : 30)
    );
    const isTwoClips = targetConfig.totalClips === 2;
    const summaryRanges = {
        clip1Range: "0-10",
        clip2Range: "11-20",
        clip3Range: isTwoClips ? null : "21-30"
    };

    if (!original) {
        return {
            mode: "auto_generated",
            hasExplicitDuration: false,
            preserveMediaRefs,
            targetDuration: targetConfig.targetDuration,
            totalClips: targetConfig.totalClips,
            originalPrompt: "",
            clip1: "",
            clip2: "",
            clip3: "",
            segmentsSummary: summaryRanges
        };
    }

    const parsed = parseExplicitDurationSegments(original);

    if (parsed.segments.length > 0) {
        const buckets = assignSegmentsToBuckets(parsed.segments);
        const preambleRaw = parsed.preamble;
        const preambleForCont = preserveMediaRefs
            ? preambleRaw
            : cleanContinuationPromptForFirstFrame(preambleRaw);
        const fullContFallback = preserveMediaRefs
            ? original
            : cleanContinuationPromptForFirstFrame(original);

        const seg1Text = formatSegmentListForClip(buckets.clip1, 0, "0-10 detik", false);
        const seg2Text = formatSegmentListForClip(
            buckets.clip2,
            10,
            "11-20 detik",
            !preserveMediaRefs
        );
        const seg3Text = formatSegmentListForClip(
            buckets.clip3,
            20,
            "21-30 detik",
            !preserveMediaRefs
        );

        const clip1Core = seg1Text ||
            (preambleRaw ? preambleRaw : original);
        const clip1Prefix = preambleRaw && seg1Text
            ? `${preambleRaw}\n`
            : "";
        const clip1 = clampPromptLength(
            `${clip1Prefix}Durasi 0-10 detik: ${clip1Core}`
        );

        const clip2Context = preambleForCont ? `${preambleForCont}. ` : "";
        const seg1ForCont = preserveMediaRefs
            ? seg1Text
            : cleanContinuationPromptForFirstFrame(seg1Text);

        if (isTwoClips) {
            const combinedClip2Explicit = [seg2Text, seg3Text].filter(Boolean).join(" ");
            const clip2Core20s = combinedClip2Explicit ||
                (seg1ForCont
                    ? `${seg1ForCont} — adegan dan gerakan berlanjut secara alami hingga penutupan yang mulus.`
                    : `${fullContFallback} — adegan berlanjut mulus hingga akhir.`);
            const clip2Header20s = preserveMediaRefs
                ? "Durasi 11-20 detik (kelanjutan akhir mulus tanpa potongan dari posisi akhir @image1, mengikuti potongan referensi detik 11-20)"
                : "Durasi 11-20 detik (kelanjutan akhir mulus tanpa potongan dari posisi akhir frame pertama pada detik 0-10 klip ini)";
            const clip2 = clampPromptLength(
                `${clip2Context}${clip2Header20s}: ${clip2Core20s}`
            );

            return {
                mode: "explicit_duration",
                hasExplicitDuration: true,
                preserveMediaRefs,
                targetDuration: targetConfig.targetDuration,
                totalClips: targetConfig.totalClips,
                originalPrompt: original,
                clip1,
                clip2,
                clip3: "",
                segmentsSummary: summaryRanges
            };
        }

        const clip2Core = seg2Text ||
            (seg1ForCont
                ? `${seg1ForCont} — adegan dan gerakan berlanjut secara alami serta dinamis.`
                : `${fullContFallback} — adegan berlanjut secara alami.`);
        const clip2Header = preserveMediaRefs
            ? "Durasi 11-20 detik (kelanjutan mulus tanpa potongan dari posisi akhir @image1, mengikuti potongan referensi detik 11-20)"
            : "Durasi 11-20 detik (kelanjutan mulus tanpa potongan dari posisi akhir frame pertama pada detik 0-10 klip ini)";
        const clip2 = clampPromptLength(
            `${clip2Context}${clip2Header}: ${clip2Core}`
        );

        const clip3Core = seg3Text ||
            (seg2Text
                ? `${seg2Text} — gerakan berlanjut konsisten hingga penutupan adegan yang halus.`
                : `${clip2Core} — berlanjut mulus hingga akhir adegan yang natural.`);
        const clip3Header = preserveMediaRefs
            ? "Durasi 21-30 detik (kelanjutan akhir mulus tanpa potongan dari posisi akhir @image1, mengikuti potongan referensi detik 21-30)"
            : "Durasi 21-30 detik (kelanjutan akhir mulus tanpa potongan dari posisi akhir frame pertama pada detik 0-10 klip ini)";
        const clip3 = clampPromptLength(
            `${clip2Context}${clip3Header}: ${clip3Core}`
        );

        return {
            mode: "explicit_duration",
            hasExplicitDuration: true,
            preserveMediaRefs,
            targetDuration: targetConfig.targetDuration,
            totalClips: targetConfig.totalClips,
            originalPrompt: original,
            clip1,
            clip2,
            clip3,
            segmentsSummary: summaryRanges
        };
    }

    // Jika prompt TIDAK mencantumkan durasi -> sistem otomatis membuatkan struktur durasi (2 klip untuk 20s, 3 klip untuk 30s)
    const beats = splitNarrativeBeats(original);
    const contBasePrompt = preserveMediaRefs
        ? original
        : cleanContinuationPromptForFirstFrame(original);

    if (isTwoClips) {
        const anchorLabel = preserveMediaRefs ? "@image1" : "frame awal";
        let clip1Action20s;
        let clip2Action20s;

        if (beats.length >= 2) {
            const splitAt = Math.max(1, Math.ceil(beats.length / 2));
            const part1 = beats.slice(0, splitAt).join(". ");
            const rawPart2 = beats.slice(splitAt).join(". ");
            const part2 = preserveMediaRefs
                ? rawPart2
                : cleanContinuationPromptForFirstFrame(rawPart2);

            clip1Action20s = `${part1}. Konteks visual keseluruhan: ${original}`;
            clip2Action20s = `${part2 || contBasePrompt}. Menyelesaikan rangkaian adegan secara mulus dan natural dengan konsistensi penuh dari ${anchorLabel} (${contBasePrompt}).`;
        } else {
            clip1Action20s = `${original}. Adegan pembuka bergerak natural, halus, dan stabil sepanjang 0-10 detik pertama.`;
            clip2Action20s = preserveMediaRefs
                ? `${contBasePrompt} — melanjutkan gerakan, ekspresi, dan alur kamera secara berkesinambungan dari posisi akhir pada @image1 mengikuti potongan referensi detik 11-20 hingga penutupan adegan yang mulus.`
                : `${contBasePrompt} — melanjutkan bagian akhir gerakan dan ekspresi secara konsisten dari posisi tepat pada frame awal hingga penutupan adegan yang mulus.`;
        }

        const clip1 = clampPromptLength(
            `Durasi 0-10 detik (bagian pembuka adegan): ${clip1Action20s}`
        );
        const clip2AutoHeader20s = preserveMediaRefs
            ? "Durasi 11-20 detik (kelanjutan akhir mulus tanpa jeda dari posisi akhir @image1, mengikuti potongan referensi detik 11-20)"
            : "Durasi 11-20 detik (kelanjutan akhir mulus tanpa jeda dari posisi akhir frame pertama pada detik 0-10 klip ini)";
        const clip2 = clampPromptLength(`${clip2AutoHeader20s}: ${clip2Action20s}`);

        return {
            mode: "auto_generated",
            hasExplicitDuration: false,
            preserveMediaRefs,
            targetDuration: targetConfig.targetDuration,
            totalClips: targetConfig.totalClips,
            originalPrompt: original,
            clip1,
            clip2,
            clip3: "",
            segmentsSummary: summaryRanges
        };
    }

    let clip1Action;
    let clip2Action;
    let clip3Action;

    if (beats.length >= 3) {
        const firstEnd = Math.max(1, Math.floor(beats.length / 3));
        const secondEnd = Math.max(firstEnd + 1, Math.floor((beats.length * 2) / 3));
        const part1 = beats.slice(0, firstEnd).join(". ");
        const rawPart2 = beats.slice(firstEnd, secondEnd).join(". ");
        const rawPart3 = beats.slice(secondEnd).join(". ");
        const part2 = preserveMediaRefs
            ? rawPart2
            : cleanContinuationPromptForFirstFrame(rawPart2);
        const part3 = preserveMediaRefs
            ? rawPart3
            : cleanContinuationPromptForFirstFrame(rawPart3);
        const anchorLabel = preserveMediaRefs ? "@image1" : "frame awal";

        clip1Action = `${part1}. Konteks visual keseluruhan: ${original}`;
        clip2Action = `${part2 || contBasePrompt}. Tetap menjaga konsistensi subjek, pakaian, pencahayaan, dan suasana dari ${anchorLabel} (${contBasePrompt}).`;
        clip3Action = `${part3 || contBasePrompt}. Menyelesaikan rangkaian adegan secara mulus dan natural dengan konsistensi penuh dari ${anchorLabel} (${contBasePrompt}).`;
    } else if (beats.length === 2) {
        const beat1 = beats[0];
        const beat2ForCont = preserveMediaRefs
            ? beats[1]
            : cleanContinuationPromptForFirstFrame(beats[1]);
        const beat1ForCont = preserveMediaRefs
            ? beats[0]
            : cleanContinuationPromptForFirstFrame(beats[0]);

        clip1Action = `${beat1}. Adegan dimulai secara natural dan stabil menuju kelanjutan berikutnya.`;
        clip2Action = `Melanjutkan transisi gerakan dari "${beat1ForCont}" menuju "${beat2ForCont}" secara berkesinambungan dan konsisten.`;
        clip3Action = `${beat2ForCont} — aksi berkembang penuh secara natural hingga penutupan kamera dan gerakan yang halus.`;
    } else {
        clip1Action = `${original}. Adegan pembuka bergerak natural, halus, dan stabil sepanjang 0-10 detik pertama.`;
        if (preserveMediaRefs) {
            clip2Action = `${contBasePrompt} — melanjutkan gerakan, ekspresi, dan alur kamera secara berkesinambungan dari posisi akhir pada @image1 mengikuti potongan referensi detik 11-20.`;
            clip3Action = `${contBasePrompt} — melanjutkan bagian akhir gerakan dan ekspresi secara konsisten dari posisi akhir pada @image1 mengikuti potongan referensi detik 21-30 hingga penutupan adegan yang mulus.`;
        } else {
            clip2Action = `${contBasePrompt} — melanjutkan gerakan, ekspresi, dan alur kamera secara berkesinambungan dari posisi tepat pada frame awal.`;
            clip3Action = `${contBasePrompt} — melanjutkan bagian akhir gerakan dan ekspresi secara konsisten dari frame awal hingga penutupan adegan yang mulus.`;
        }
    }

    const clip1 = clampPromptLength(
        `Durasi 0-10 detik (bagian pembuka adegan): ${clip1Action}`
    );
    const clip2AutoHeader = preserveMediaRefs
        ? "Durasi 11-20 detik (kelanjutan mulus tanpa jeda dari posisi akhir @image1, mengikuti potongan referensi detik 11-20)"
        : "Durasi 11-20 detik (kelanjutan mulus tanpa jeda dari posisi akhir frame pertama pada detik 0-10 klip ini)";
    const clip3AutoHeader = preserveMediaRefs
        ? "Durasi 21-30 detik (kelanjutan akhir mulus tanpa jeda dari posisi akhir @image1, mengikuti potongan referensi detik 21-30)"
        : "Durasi 21-30 detik (kelanjutan akhir mulus tanpa jeda dari posisi akhir frame pertama pada detik 0-10 klip ini)";

    const clip2 = clampPromptLength(`${clip2AutoHeader}: ${clip2Action}`);
    const clip3 = clampPromptLength(`${clip3AutoHeader}: ${clip3Action}`);

    return {
        mode: "auto_generated",
        hasExplicitDuration: false,
        preserveMediaRefs,
        targetDuration: targetConfig.targetDuration,
        totalClips: targetConfig.totalClips,
        originalPrompt: original,
        clip1,
        clip2,
        clip3,
        segmentsSummary: summaryRanges
    };
}

export function computeStagedCreditSettlement(
    totalCredit,
    completedClips,
    targetTotalClips = STAGED_30S_CLIP_COUNT
) {
    const safeTotal = Math.max(0, Number(totalCredit) || 0);
    const safeTargetClips =
        Number(targetTotalClips) === STAGED_20S_CLIP_COUNT
            ? STAGED_20S_CLIP_COUNT
            : STAGED_30S_CLIP_COUNT;
    const safeTargetDuration = safeTargetClips * STAGED_30S_CLIP_DURATION;
    const safeClips = Math.max(
        0,
        Math.min(safeTargetClips, Math.floor(Number(completedClips) || 0))
    );

    if (safeClips >= safeTargetClips) {
        return {
            completedClips: safeTargetClips,
            totalClips: safeTargetClips,
            charged: safeTotal,
            refund: 0,
            finalDuration: safeTargetDuration,
            outcome: "completed"
        };
    }

    if (safeClips === 0) {
        return {
            completedClips: 0,
            totalClips: safeTargetClips,
            charged: 0,
            refund: safeTotal,
            finalDuration: 0,
            outcome: "failed"
        };
    }

    // Potong proporsional per klip selesai (mis. 1/2 pada 20s atau 1/3 / 2/3 pada 30s) dan refund sisanya bulat ke user
    const charged = Math.floor((safeTotal * safeClips) / safeTargetClips);
    const refund = Math.max(0, safeTotal - charged);

    return {
        completedClips: safeClips,
        totalClips: safeTargetClips,
        charged,
        refund,
        finalDuration: safeClips * STAGED_30S_CLIP_DURATION,
        outcome: "partial_completed"
    };
}

export function computeLoopedSegmentTiming({
    clipIndex = 2,
    clipDurationSeconds = STAGED_30S_CLIP_DURATION,
    sourceDurationSeconds = 0
} = {}) {
    const safeClipIndex = Math.max(1, Math.floor(Number(clipIndex) || 1));
    const safeClipDur = Math.max(1, Number(clipDurationSeconds) || STAGED_30S_CLIP_DURATION);
    const startSeconds = (safeClipIndex - 1) * safeClipDur;
    const srcDur = Number(sourceDurationSeconds) || 0;

    if (srcDur >= startSeconds + safeClipDur + 0.05) {
        return {
            clipIndex: safeClipIndex,
            startSeconds,
            effectiveStartSeconds: Number(startSeconds.toFixed(3)),
            clipDurationSeconds: safeClipDur,
            needsLoop: false
        };
    }

    const effectiveStartSeconds = srcDur > 0.2
        ? Number((startSeconds % srcDur).toFixed(3))
        : Number(startSeconds.toFixed(3));

    return {
        clipIndex: safeClipIndex,
        startSeconds,
        effectiveStartSeconds,
        clipDurationSeconds: safeClipDur,
        needsLoop: true
    };
}

export function buildReferenceVideoSliceFfmpegArgs({
    inputPath,
    outputPath,
    clipIndex = 2,
    clipDurationSeconds = STAGED_30S_CLIP_DURATION,
    sourceDurationSeconds = 0,
    includeAudio = true
}) {
    const timing = computeLoopedSegmentTiming({
        clipIndex,
        clipDurationSeconds,
        sourceDurationSeconds
    });

    const args = ["-y"];
    if (timing.needsLoop) {
        args.push("-stream_loop", "-1", "-i", String(inputPath));
        if (timing.effectiveStartSeconds > 0) {
            args.push("-ss", String(timing.effectiveStartSeconds));
        }
        args.push("-t", String(timing.clipDurationSeconds), "-fflags", "+genpts");
    } else {
        if (timing.effectiveStartSeconds > 0) {
            args.push("-ss", String(timing.effectiveStartSeconds));
        }
        args.push("-i", String(inputPath), "-t", String(timing.clipDurationSeconds));
    }

    args.push("-map", "0:v:0");
    if (includeAudio) {
        args.push("-map", "0:a:0?");
    } else {
        args.push("-an");
    }

    args.push(
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p"
    );

    if (includeAudio) {
        args.push("-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2");
    }

    args.push("-movflags", "+faststart", String(outputPath));
    return args;
}

export function buildReferenceAudioSliceFfmpegArgs({
    inputPath,
    outputPath,
    clipIndex = 2,
    clipDurationSeconds = STAGED_30S_CLIP_DURATION,
    sourceDurationSeconds = 0,
    format = ""
}) {
    const timing = computeLoopedSegmentTiming({
        clipIndex,
        clipDurationSeconds,
        sourceDurationSeconds
    });

    const args = ["-y"];
    if (timing.needsLoop) {
        args.push("-stream_loop", "-1", "-i", String(inputPath));
        if (timing.effectiveStartSeconds > 0) {
            args.push("-ss", String(timing.effectiveStartSeconds));
        }
        args.push("-t", String(timing.clipDurationSeconds), "-fflags", "+genpts");
    } else {
        if (timing.effectiveStartSeconds > 0) {
            args.push("-ss", String(timing.effectiveStartSeconds));
        }
        args.push("-i", String(inputPath), "-t", String(timing.clipDurationSeconds));
    }

    const cleanOutput = String(outputPath || "");
    const normalizedFormat = String(format || "").trim().toLowerCase();
    const useWav =
        normalizedFormat === "wav" ||
        (!normalizedFormat && cleanOutput.toLowerCase().endsWith(".wav"));

    if (useWav) {
        args.push(
            "-vn",
            "-map",
            "0:a:0",
            "-c:a",
            "pcm_s16le",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-f",
            "wav",
            cleanOutput
        );
        return args;
    }

    // Opus / Seedance CreateAsset hanya menerima format audio mp3 atau wav
    // (kontainer m4a/aac ditolak sebagai "Unsupported audio format: mov").
    args.push(
        "-vn",
        "-map",
        "0:a:0",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-f",
        "mp3",
        cleanOutput
    );
    return args;
}

export function buildLastFrameFfmpegArgs({ inputPath, outputPath, totalFrames = 0 }) {
    const safeFrames = Math.floor(Number(totalFrames) || 0);
    if (safeFrames > 0) {
        const lastIndex = Math.max(0, safeFrames - 1);
        return [
            "-y",
            "-i",
            String(inputPath),
            "-vf",
            `select=eq(n\\,${lastIndex})`,
            "-frames:v",
            "1",
            outputPath
        ];
    }

    return [
        "-y",
        "-sseof",
        "-0.08",
        "-i",
        String(inputPath),
        "-frames:v",
        "1",
        outputPath
    ];
}

export function buildSeamlessMergeFfmpegArgs({
    clipPaths,
    clipInfos = [],
    outputPath,
    crossfadeSeconds = 0.06,
    referenceAudioPath = "",
    referenceAudioDuration = 0,
    referenceAudioHasAudio = false
}) {
    if (!Array.isArray(clipPaths) || clipPaths.length === 0) {
        throw new Error("Minimal 1 path klip diperlukan untuk penggabungan.");
    }

    const cleanRefAudioPath = String(referenceAudioPath || "").trim();
    const useDirectRefAudio = Boolean(cleanRefAudioPath && referenceAudioHasAudio);

    if (clipPaths.length === 1) {
        if (useDirectRefAudio) {
            const firstClipInfo = clipInfos[0] || {};
            const singleDur = Math.max(
                1,
                Number(firstClipInfo.duration) || STAGED_30S_CLIP_DURATION
            );
            const refDur = Number(referenceAudioDuration) || 0;
            const loopRefAudio = refDur <= 0 || refDur < singleDur + 0.25;
            return [
                "-y",
                "-i",
                String(clipPaths[0]),
                ...(loopRefAudio ? ["-stream_loop", "-1"] : []),
                "-i",
                cleanRefAudioPath,
                "-filter_complex",
                `[1:a:0]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${Number(singleDur.toFixed(3))},asetpts=PTS-STARTPTS[aout]`,
                "-map",
                "0:v:0",
                "-map",
                "[aout]",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "160k",
                "-shortest",
                "-movflags",
                "+faststart",
                String(outputPath)
            ];
        }

        return [
            "-y",
            "-i",
            String(clipPaths[0]),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-movflags",
            "+faststart",
            String(outputPath)
        ];
    }

    const firstInfo = clipInfos[0] || {};
    const rawWidth = Math.max(2, Math.floor(Number(firstInfo.width) || 720));
    const rawHeight = Math.max(2, Math.floor(Number(firstInfo.height) || 1280));
    const targetWidth = rawWidth - (rawWidth % 2);
    const targetHeight = rawHeight - (rawHeight % 2);
    const rawFps = Number(firstInfo.fps) || 24;
    const targetFps = Math.max(16, Math.min(60, Math.round(rawFps)));
    const anyAudio = useDirectRefAudio || clipInfos.some(info => Boolean(info?.hasAudio));
    const oneFrameSec = Number((1 / targetFps).toFixed(4));
    const safeFade = Math.max(0.02, Math.min(0.15, Number(crossfadeSeconds) || 0.06));

    let totalVideoDuration = 0;
    for (let i = 0; i < clipPaths.length; i += 1) {
        const info = clipInfos[i] || {};
        const durationSec = Math.max(1, Number(info.duration) || STAGED_30S_CLIP_DURATION);
        totalVideoDuration += Math.max(0.5, durationSec - (i > 0 ? oneFrameSec : 0));
    }

    const args = ["-y"];
    for (const clipPath of clipPaths) {
        args.push("-i", String(clipPath));
    }

    const refAudioInputIndex = clipPaths.length;
    if (useDirectRefAudio) {
        const refDur = Number(referenceAudioDuration) || 0;
        const loopRefAudio = refDur <= 0 || refDur < totalVideoDuration + 0.25;
        if (loopRefAudio) {
            args.push("-stream_loop", "-1");
        }
        args.push("-i", cleanRefAudioPath);
    }

    const filterParts = [];
    const videoLabels = [];
    const audioLabels = [];

    for (let i = 0; i < clipPaths.length; i += 1) {
        const info = clipInfos[i] || {};
        const durationSec = Math.max(1, Number(info.duration) || STAGED_30S_CLIP_DURATION);
        // Klip 2 & Klip 3 diawali frame 0 yang identik dengan frame akhir klip sebelumnya:
        // buang 1 frame pertama (trim=start_frame=1) supaya sambungan mulus tanpa freeze 1 frame.
        const trimChain = i > 0 ? "trim=start_frame=1,setpts=PTS-STARTPTS," : "setpts=PTS-STARTPTS,";
        const vLabel = `v${i}`;
        filterParts.push(
            `[${i}:v:0]${trimChain}fps=${targetFps},scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[${vLabel}]`
        );
        videoLabels.push(`[${vLabel}]`);

        if (anyAudio && !useDirectRefAudio) {
            const aLabel = `a${i}`;
            const audioTrim = i > 0 ? `atrim=start=${oneFrameSec},asetpts=PTS-STARTPTS` : "asetpts=PTS-STARTPTS";
            if (info.hasAudio) {
                filterParts.push(
                    `[${i}:a:0]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,${audioTrim}[${aLabel}]`
                );
            } else {
                const synthDur = Math.max(0.5, Number((durationSec - (i > 0 ? oneFrameSec : 0)).toFixed(3)));
                filterParts.push(
                    `anullsrc=channel_layout=stereo:sample_rate=44100:d=${synthDur}[${aLabel}]`
                );
            }
            audioLabels.push(`[${aLabel}]`);
        }
    }

    filterParts.push(`${videoLabels.join("")}concat=n=${clipPaths.length}:v=1:a=0[vout]`);

    if (useDirectRefAudio) {
        filterParts.push(
            `[${refAudioInputIndex}:a:0]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${Number(totalVideoDuration.toFixed(3))},asetpts=PTS-STARTPTS[aout]`
        );
    } else if (anyAudio) {
        if (audioLabels.length === 2) {
            filterParts.push(
                `${audioLabels[0]}${audioLabels[1]}acrossfade=d=${safeFade}:c1=tri:c2=tri[aout]`
            );
        } else if (audioLabels.length === 3) {
            filterParts.push(
                `${audioLabels[0]}${audioLabels[1]}acrossfade=d=${safeFade}:c1=tri:c2=tri[amid]`
            );
            filterParts.push(
                `[amid]${audioLabels[2]}acrossfade=d=${safeFade}:c1=tri:c2=tri[aout]`
            );
        } else {
            filterParts.push(`${audioLabels.join("")}concat=n=${audioLabels.length}:v=0:a=1[aout]`);
        }
    }

    args.push("-filter_complex", filterParts.join(";"));
    args.push("-map", "[vout]");
    if (anyAudio) {
        args.push("-map", "[aout]");
    } else {
        args.push("-an");
    }

    args.push(
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-maxrate",
        "8M",
        "-bufsize",
        "16M",
        "-pix_fmt",
        "yuv420p"
    );

    if (anyAudio) {
        args.push("-c:a", "aac", "-b:a", "160k");
    }
    if (useDirectRefAudio) {
        args.push("-shortest");
    }

    args.push("-movflags", "+faststart", String(outputPath));
    return args;
}

function isDisallowedCallbackHost(hostname) {
    const lower = String(hostname || "").trim().toLowerCase();
    if (!lower) return true;
    if (
        lower === "localhost" ||
        lower.endsWith(".localhost") ||
        lower.endsWith(".local") ||
        lower === "127.0.0.1" ||
        lower === "0.0.0.0" ||
        lower === "::1" ||
        lower === "[::1]"
    ) {
        return true;
    }
    if (/^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(lower)) {
        return true;
    }
    return false;
}

export function resolveStagedApiBaseUrl(req, fallbackUrl = DEFAULT_WORKER_PUBLIC_BASE_URL) {
    const envConfigured = String(
        req?.env?.PUBLIC_API_BASE_URL ||
        process.env.PUBLIC_API_BASE_URL ||
        ""
    ).trim();

    if (envConfigured) {
        try {
            const parsed = new URL(envConfigured);
            if (parsed.protocol === "https:" && !isDisallowedCallbackHost(parsed.hostname)) {
                return parsed.origin;
            }
        } catch {
            // fallback ke host request
        }
    }

    const rawHost = String(
        req?.headers?.["x-forwarded-host"] ||
        req?.headers?.host ||
        ""
    )
        .split(",")[0]
        .trim();

    if (rawHost) {
        try {
            const candidate = new URL(`https://${rawHost}`);
            if (!isDisallowedCallbackHost(candidate.hostname)) {
                return candidate.origin;
            }
        } catch {
            // fallback ke URL worker default
        }
    }

    return String(fallbackUrl || DEFAULT_WORKER_PUBLIC_BASE_URL).replace(/\/+$/, "");
}
