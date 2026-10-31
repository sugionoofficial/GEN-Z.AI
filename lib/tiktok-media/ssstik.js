/* =========================================================
   GEN-Z.AI
   TIKTOK MEDIA RESOLVER VIA SSSTIK.IO
   ---------------------------------------------------------
   File:
   lib/tiktok-media/ssstik.js

   Tanggung jawab:
   - Memvalidasi & menormalisasi URL TikTok (tiktok.com,
     www.tiktok.com, m.tiktok.com, vt.tiktok.com, vm.tiktok.com,
     t.tiktok.com, lite.tiktok.com, photo/video/shortlink)
   - Memproses link lewat https://ssstik.io/abc?url=dl (HTMX POST
     dengan token halaman s_tt / tt) untuk mengekstrak video MP4
     tanpa watermark, audio MP3, maupun foto/slide karusel
   - Membuka pembungkus base64 multi-segmen pada ssscdn.io /
     tikcdn.io menuju CDN TikTok secara aman
   - Menyediakan fallback otomatis bila ssstik.io terkena
     tantangan WAF / rate-limit dari IP server
   - Mengunduh & meneruskan stream media secara aman (anti-SSRF
     & batas ukuran file) untuk disimpan di sisi klien
========================================================= */

import { decodeHtmlEntities, FB_MEDIA_MAX_BYTES } from "../fb-media/getmyfb.js";

const SSSTIK_ORIGIN = "https://ssstik.io";
const SSSTIK_HOME_ID = "https://ssstik.io/id";
const SSSTIK_HOME_EN = "https://ssstik.io/";
const SSSTIK_PROCESS_URL = "https://ssstik.io/abc?url=dl";
const TIKWM_API_URL = "https://www.tikwm.com/api/";

const DESKTOP_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MOBILE_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const TIKTOK_HOST_SUFFIXES = [
    "tiktok.com",
    "xzcs3zlph.com"
];

const SSSTIK_WRAPPER_HOST_SUFFIXES = [
    "ssscdn.io",
    "tikcdn.io",
    "ssstik.io"
];

const ALLOWED_TIKTOK_MEDIA_CDN_SUFFIXES = [
    "ssstik.io",
    "ssscdn.io",
    "tikcdn.io",
    "tikwm.com",
    "tiktok.com",
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "tiktokcdn-in.com",
    "tiktokcdnv.com",
    "tiktokv.com",
    "tiktokv.us",
    "tiktokv.eu",
    "bytecdn.com",
    "byteicdn.com",
    "bytefcdn.net",
    "byteoversea.com",
    "ibytedtos.com",
    "ibyteimg.com",
    "muscdn.com",
    "musical.ly",
    "akamaized.net",
    "akamaihd.net"
];

export const TIKTOK_MEDIA_MAX_BYTES = FB_MEDIA_MAX_BYTES;

const BASE64_SEGMENT_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
const MIN_BASE64_URL_LEN = 20;

const ALL_SSSTIK_SIGNALS = new Set([
    "ssssuccess",
    "ssssuccess_video",
    "ssssuccess_videoandmp3",
    "ssssuccess_slides",
    "ssssuccess_music",
    "ssssuccess_wmonly",
    "ssssuccess_scraptik",
    "sssinvalidlink",
    "ssstterror",
    "ssscurlerror",
    "sssblockedclient",
    "ssstokenfail",
    "sssfailure",
    "ssslimitexceed",
    "sssrapidapisuccess",
    "sssrapidapifail",
    "sssrapidapifakehd",
    "sssrapidapittfail"
]);

function matchesHostSuffix(hostname, suffixes) {
    const host = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
    if (!host) return false;
    return suffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
}

function isIpLiteral(hostname) {
    const host = String(hostname || "").trim();
    if (!host) return true;
    if (host.includes(":")) return true;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
    return false;
}

function stripTags(html) {
    return decodeHtmlEntities(String(html || "").replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeTikTokUrl(rawUrl) {
    let candidate = String(rawUrl || "").trim();
    if (!candidate) return "";

    if (
        !/^https?:\/\//i.test(candidate) &&
        /^(?:(?:www|m|vt|vm|t|lite)\.)?(?:tiktok\.com|xzcs3zlph\.com)\//i.test(candidate)
    ) {
        candidate = `https://${candidate}`;
    }

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch {
        return "";
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return "";
    }
    if (parsed.username || parsed.password) {
        return "";
    }
    if (parsed.port && parsed.port !== "443" && parsed.port !== "80") {
        return "";
    }
    if (isIpLiteral(parsed.hostname) || !matchesHostSuffix(parsed.hostname, TIKTOK_HOST_SUFFIXES)) {
        return "";
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");
    const hasQueryId = parsed.searchParams.has("item_id") || parsed.searchParams.has("shareId");

    if (!pathname && !hasQueryId) {
        return "";
    }

    /* Tolak tautan profil murni seperti https://www.tiktok.com/@username */
    if (/^\/@[^/]+$/i.test(pathname) && !hasQueryId) {
        return "";
    }

    parsed.protocol = "https:";
    parsed.hash = "";

    /* Bersihkan query pelacak untuk URL post standar /@user/video|photo/<id> */
    if (/^\/@[^/]+\/(?:video|photo)\/\d+/i.test(pathname) || /^\/(?:v|t|embed)\/[\w-]+/i.test(pathname)) {
        parsed.search = "";
    }

    return parsed.toString();
}

export function isTikTokMediaUrl(rawUrl) {
    return Boolean(normalizeTikTokUrl(rawUrl));
}

export function isSafeResolvedTikTokMediaUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || "").trim());
    } catch {
        return false;
    }

    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== "443") return false;
    if (isIpLiteral(parsed.hostname)) return false;

    return matchesHostSuffix(parsed.hostname, ALLOWED_TIKTOK_MEDIA_CDN_SUFFIXES);
}

function decodeBase64HttpsUrl(segment) {
    const candidate = String(segment || "").trim();
    if (candidate.length < MIN_BASE64_URL_LEN || !BASE64_SEGMENT_REGEX.test(candidate)) {
        return "";
    }

    const padLen = (4 - (candidate.length % 4)) % 4;
    const padded = candidate + "=".repeat(padLen);

    let bytes;
    try {
        const binary = atob(padded);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
    } catch {
        return "";
    }

    if (!bytes.length) return "";

    let decodedText = "";
    try {
        decodedText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        return "";
    }

    if (/[\u0000-\u0020\u007f]/.test(decodedText)) {
        return "";
    }

    try {
        const parsed = new URL(decodedText);
        if (parsed.protocol !== "https:" || !parsed.hostname) {
            return "";
        }
        return parsed.toString();
    } catch {
        return "";
    }
}

/* =========================================================
   UNWRAPPER BASE64 MULTI-SEGMEN SSSTIK (ssscdn.io / tikcdn.io)
========================================================= */

export function unwrapSsstikMediaUrl(rawHref) {
    const cleaned = decodeHtmlEntities(String(rawHref || "").trim());
    let parsed;
    try {
        parsed = new URL(cleaned, SSSTIK_ORIGIN);
    } catch {
        return { url: "", wrapperUrl: "", decoded: false };
    }

    const fullHref = parsed.toString();
    if (!matchesHostSuffix(parsed.hostname, SSSTIK_WRAPPER_HOST_SUFFIXES)) {
        return { url: fullHref, wrapperUrl: fullHref, decoded: false };
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    /* Karena karakter '/' valid di dalam alfabet Base64 standar, payload URL panjang
       yang ditandatangani sering terpecah menjadi beberapa segmen path. Gabungkan
       dari prefix terlebar ke tersempit agar payload utuh berhasil didekode. */
    for (let span = Math.max(0, segments.length - 1); span >= 0; span -= 1) {
        let joined = "";
        try {
            joined = segments
                .slice(span)
                .map(seg => decodeURIComponent(seg))
                .join("/");
        } catch {
            continue;
        }
        const decodedUrl = decodeBase64HttpsUrl(joined);
        if (decodedUrl) {
            return {
                url: decodedUrl,
                wrapperUrl: fullHref,
                decoded: true
            };
        }
    }

    return {
        url: fullHref,
        wrapperUrl: fullHref,
        decoded: false
    };
}

export function extractSsstikPageToken(html) {
    const source = String(html || "");
    const match = source.match(/(?:\bs_tt\s*=\s*|\btt\s*:\s*)['"]([\w-]{3,128})['"]/);
    return match ? match[1] : "";
}

export function parseSsstikSignal(headers) {
    if (!headers || typeof headers.get !== "function") return "";
    const raw = headers.get("hx-trigger") || headers.get("HX-Trigger") || "";
    const trimmed = String(raw).trim();
    if (!trimmed) return "";

    const names = [];
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object") {
                names.push(...Object.keys(parsed));
            }
        } catch {
            return "";
        }
    } else {
        names.push(...trimmed.split(/[\s,;]+/).filter(Boolean));
    }

    for (const name of names) {
        if (ALL_SSSTIK_SIGNALS.has(name)) {
            return name;
        }
    }
    return "";
}

function parseAnchorAttributes(tagHtml) {
    const attrs = {};
    const regex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let match;
    while ((match = regex.exec(tagHtml)) !== null) {
        const key = String(match[1] || "").toLowerCase();
        const val = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
        attrs[key] = val;
    }
    return attrs;
}

/* =========================================================
   PARSER HTML HASIL SSSTIK.IO (/abc?url=dl)
========================================================= */

export function parseSsstikHtml(html, headers = null) {
    const source = String(html || "");
    const signal = parseSsstikSignal(headers);

    const rateLimited =
        signal === "ssslimitexceed" ||
        /requests?\s+too\s+fast|wait\s*~?\s*\d+\s*seconds|terlalu\s+cepat/i.test(source);

    const titleMatch =
        source.match(/<p[^>]*class=["'][^"']*\bmaintext\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) ||
        source.match(/<div[^>]*class=["'][^"']*\bmaintext\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const title = titleMatch ? stripTags(titleMatch[1]) : "";

    let coverUrl = "";
    const overlayMatch = source.match(
        /#mainpicture\s+\.result_overlay\s*\{[^}]*background-image\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i
    );
    if (overlayMatch) {
        const unwrappedOverlay = unwrapSsstikMediaUrl(overlayMatch[1]);
        const targetOverlay = unwrappedOverlay.url || unwrappedOverlay.wrapperUrl;
        if (isSafeResolvedTikTokMediaUrl(targetOverlay)) {
            coverUrl = targetOverlay;
        }
    }

    const downloads = [];
    const slideImages = [];
    const seenKeys = new Set();

    const pushCandidate = ({ href, type, quality, score }) => {
        if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return;
        const unwrapped = unwrapSsstikMediaUrl(href);

        /* Bila href adalah wrapper ssscdn/tikcdn berisi Base64 URL CDN TikTok,
           daftarkan URL CDN hasil unwrap lebih dulu lalu simpan URL wrapper sebagai cadangan. */
        const orderedTargets = unwrapped.decoded
            ? [
                { url: unwrapped.url, viaWrapper: false },
                { url: unwrapped.wrapperUrl, viaWrapper: true }
            ]
            : [{ url: unwrapped.url, viaWrapper: true }];

        for (const entry of orderedTargets) {
            if (!isSafeResolvedTikTokMediaUrl(entry.url)) continue;
            const dedupeKey = `${type}:${entry.url}`;
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);
            downloads.push({
                url: entry.url,
                type,
                quality,
                score: entry.viaWrapper && unwrapped.decoded ? Math.max(1, score - 5) : score,
                source: "ssstik.io"
            });
        }
    };

    /* 1. Ekstrak slide foto/karusel bila postingan TikTok berupa foto (<ul class="splide__list">) */
    const splideListMatch = source.match(/<ul[^>]*class=["'][^"']*\bsplide__list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
    if (splideListMatch) {
        const listHtml = splideListMatch[1];
        const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch;
        let slideIdx = 0;
        while ((liMatch = liRegex.exec(listHtml)) !== null) {
            slideIdx += 1;
            const liBody = liMatch[1];
            const anchorHrefMatch = liBody.match(/<a\b[^>]*\bhref=["']([^"']+)["']/i);
            const imgSrcMatch =
                liBody.match(/<img\b[^>]*\bdata-splide-lazy=["']([^"']+)["']/i) ||
                liBody.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);

            if (anchorHrefMatch) {
                const unwrapped = unwrapSsstikMediaUrl(anchorHrefMatch[1]);
                if (isSafeResolvedTikTokMediaUrl(unwrapped.url)) {
                    slideImages.push(unwrapped.url);
                }
                pushCandidate({
                    href: anchorHrefMatch[1],
                    type: "image",
                    quality: `Slide ${slideIdx}`,
                    score: Math.max(900, 1080 - slideIdx)
                });
            }
            if (imgSrcMatch) {
                pushCandidate({
                    href: imgSrcMatch[1],
                    type: "image",
                    quality: `Slide Preview ${slideIdx}`,
                    score: Math.max(700, 850 - slideIdx)
                });
            }
        }
    }

    /* 2. Ekstrak tautan unduhan video (tanpa watermark HD / MP4) & musik (MP3) */
    const anchorRegex = /<a\b([^>]{1,4096})>([\s\S]*?)<\/a>/gi;
    let aMatch;
    while ((aMatch = anchorRegex.exec(source)) !== null) {
        const attrs = parseAnchorAttributes(aMatch[1]);
        const href = attrs.href || "";
        if (!href || href.startsWith("#") || /^javascript:/i.test(href)) {
            continue;
        }

        const classes = String(attrs.class || "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const idAttr = String(attrs.id || "").toLowerCase();
        const label = stripTags(aMatch[2]).toLowerCase();

        if (
            classes.includes("without_watermark_hd") ||
            idAttr === "hd_download" ||
            (classes.includes("download_link") && /\bhd\b/.test(label))
        ) {
            pushCandidate({
                href,
                type: "video",
                quality: "HD No Watermark",
                score: 1080
            });
            continue;
        }

        if (
            classes.includes("without_watermark") ||
            classes.includes("without_watermark_direct")
        ) {
            pushCandidate({
                href,
                type: "video",
                quality: "No Watermark",
                score: 720
            });
            continue;
        }

        if (classes.includes("music") || classes.includes("music_direct")) {
            pushCandidate({
                href,
                type: "audio",
                quality: "MP3",
                score: 320
            });
            continue;
        }

        if (classes.includes("watermark")) {
            pushCandidate({
                href,
                type: "video",
                quality: "Watermark",
                score: 360
            });
        }
    }

    return {
        title,
        signal,
        rateLimited,
        coverUrl,
        slideImages,
        downloads
    };
}

function extractSetCookieHeader(headers) {
    if (!headers) return "";
    if (typeof headers.getSetCookie === "function") {
        const list = headers.getSetCookie();
        if (Array.isArray(list) && list.length > 0) {
            return list
                .map(entry => String(entry || "").split(";")[0].trim())
                .filter(Boolean)
                .join("; ");
        }
    }
    const raw = typeof headers.get === "function" ? headers.get("set-cookie") || "" : "";
    if (!raw) return "";
    return raw
        .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
        .map(part => part.split(";")[0].trim())
        .filter(Boolean)
        .join("; ");
}

async function fetchSsstikSession(fetchImpl = fetch) {
    const pages = [SSSTIK_HOME_ID, SSSTIK_HOME_EN];
    let lastError = null;

    for (const pageUrl of pages) {
        try {
            const response = await fetchImpl(pageUrl, {
                method: "GET",
                headers: {
                    "User-Agent": DESKTOP_USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
                }
            });

            if (!response.ok) {
                lastError = new Error(`SSSTik halaman utama mengembalikan HTTP ${response.status}.`);
                continue;
            }

            const html = await response.text();
            const token = extractSsstikPageToken(html);
            const cookies = extractSetCookieHeader(response.headers);

            if (token) {
                return {
                    token,
                    cookies,
                    pageUrl
                };
            }
            lastError = new Error("Token halaman SSSTik (s_tt) tidak ditemukan.");
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Gagal menginisialisasi sesi SSSTik.");
}

async function postToSsstik(tiktokUrl, session, fetchImpl = fetch) {
    const locale = session.pageUrl === SSSTIK_HOME_EN ? "en" : "id";
    const referer = session.pageUrl || SSSTIK_HOME_ID;

    const body = new URLSearchParams({
        id: tiktokUrl,
        locale,
        tt: session.token
    });

    const headers = {
        "User-Agent": DESKTOP_USER_AGENT,
        "Accept": "*/*",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": SSSTIK_ORIGIN,
        "Referer": referer,
        "HX-Request": "true",
        "HX-Trigger": "_gcaptcha_pt",
        "HX-Target": "target",
        "HX-Current-URL": referer
    };

    if (session.cookies) {
        headers.Cookie = session.cookies;
    }

    const response = await fetchImpl(SSSTIK_PROCESS_URL, {
        method: "POST",
        headers,
        body: body.toString()
    });

    const html = await response.text();
    if (!response.ok && !html) {
        throw new Error(`SSSTik mengembalikan status HTTP ${response.status}.`);
    }

    return parseSsstikHtml(html, response.headers);
}

/* =========================================================
   FALLBACK OTOMATIS VIA TIKWM BILA SSSTIK TERKENA WAF / LIMIT
========================================================= */

function resolveTikwmAssetUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    try {
        const resolved = new URL(trimmed, "https://www.tikwm.com").toString();
        return isSafeResolvedTikTokMediaUrl(resolved) ? resolved : "";
    } catch {
        return "";
    }
}

async function fetchTikwmFallback(tiktokUrl, fetchImpl = fetch) {
    const body = new URLSearchParams({
        url: tiktokUrl,
        hd: "1"
    });

    const response = await fetchImpl(TIKWM_API_URL, {
        method: "POST",
        headers: {
            "User-Agent": MOBILE_USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": "https://www.tikwm.com/"
        },
        body: body.toString()
    });

    if (!response.ok) {
        throw new Error(`Fallback TikWM mengembalikan HTTP ${response.status}.`);
    }

    const payload = await response.json().catch(() => null);
    const data = payload?.data;
    if (!data || typeof data !== "object") {
        throw new Error(payload?.msg || "Data media TikTok tidak tersedia dari fallback.");
    }

    const downloads = [];
    const seen = new Set();
    const addItem = (rawUrl, type, quality, score) => {
        const resolved = resolveTikwmAssetUrl(rawUrl);
        if (!resolved || seen.has(`${type}:${resolved}`)) return;
        seen.add(`${type}:${resolved}`);
        downloads.push({
            url: resolved,
            type,
            quality,
            score,
            source: "ssstik-fallback"
        });
    };

    if (Array.isArray(data.images)) {
        data.images.forEach((imgUrl, idx) => {
            addItem(imgUrl, "image", `Slide ${idx + 1}`, Math.max(900, 1080 - idx));
        });
    }

    addItem(data.hdplay, "video", "HD No Watermark", 1080);
    addItem(data.play, "video", "No Watermark", 720);
    addItem(data.wmplay, "video", "Watermark", 360);
    addItem(data.music, "audio", "MP3", 320);

    const coverUrl =
        resolveTikwmAssetUrl(data.origin_cover) ||
        resolveTikwmAssetUrl(data.cover);

    return {
        title: String(data.title || "").trim(),
        signal: Array.isArray(data.images) && data.images.length > 0 && !data.play
            ? "ssssuccess_slides"
            : "ssssuccess",
        rateLimited: false,
        coverUrl,
        slideImages: Array.isArray(data.images)
            ? data.images.map(resolveTikwmAssetUrl).filter(Boolean)
            : [],
        downloads
    };
}

function buildCandidatesForKind(parsed, kind) {
    const downloads = Array.isArray(parsed?.downloads) ? parsed.downloads : [];
    const videos = downloads
        .filter(item => item.type === "video")
        .sort((a, b) => b.score - a.score);
    const audios = downloads
        .filter(item => item.type === "audio")
        .sort((a, b) => b.score - a.score);
    const images = downloads
        .filter(item => item.type === "image")
        .sort((a, b) => b.score - a.score);

    if (kind === "image") {
        const list = [...images];
        if (parsed?.coverUrl && !list.some(item => item.url === parsed.coverUrl)) {
            list.push({
                url: parsed.coverUrl,
                quality: "Cover HD",
                score: 750,
                type: "image",
                source: list[0]?.source || "ssstik.io"
            });
        }
        return list.map(item => ({
            ...item,
            needsClientAudioExtract: false
        }));
    }

    if (kind === "audio") {
        const directAudio = audios.map(item => ({
            ...item,
            needsClientAudioExtract: false
        }));
        /* Cadangan: bila stream MP3 tidak tersedia, unduh MP4 ringan lalu ekstrak audio di browser */
        const videoAudioFallback = [...videos]
            .sort((a, b) => a.score - b.score)
            .map(item => ({
                ...item,
                needsClientAudioExtract: true
            }));
        return [...directAudio, ...videoAudioFallback];
    }

    /* Default: video referensi (tanpa watermark beresolusi tertinggi lebih dulu) */
    return videos.map(item => ({
        ...item,
        needsClientAudioExtract: false
    }));
}

export async function resolveTikTokMediaViaSsstik(rawUrl, { kind = "video", fetchImpl = fetch } = {}) {
    const normalizedKind = ["video", "image", "audio"].includes(kind) ? kind : "video";
    const tiktokUrl = normalizeTikTokUrl(rawUrl);

    if (!tiktokUrl) {
        const err = new Error(
            "URL TikTok tidak valid. Gunakan tautan postingan publik dari tiktok.com atau vt.tiktok.com."
        );
        err.status = 400;
        throw err;
    }

    let rateLimited = false;
    let slidesOnly = false;

    /* 1. Resolusi utama lewat https://ssstik.io/ (maks 2 percobaan bila token kadaluarsa) */
    try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const session = await fetchSsstikSession(fetchImpl);
            const ssstikResult = await postToSsstik(tiktokUrl, session, fetchImpl);
            rateLimited = rateLimited || Boolean(ssstikResult.rateLimited);

            if (ssstikResult.signal === "ssstokenfail" && attempt === 0) {
                continue;
            }

            if (
                ssstikResult.signal === "ssssuccess_slides" ||
                (ssstikResult.slideImages.length > 0 &&
                    !ssstikResult.downloads.some(item => item.type === "video"))
            ) {
                slidesOnly = true;
            }

            const candidates = buildCandidatesForKind(ssstikResult, normalizedKind);
            if (candidates.length > 0) {
                return {
                    tiktokUrl,
                    kind: normalizedKind,
                    title: ssstikResult.title || "",
                    candidates
                };
            }

            if (ssstikResult.signal === "sssinvalidlink") {
                break;
            }
            break;
        }
    } catch (error) {
        console.warn("[TikTok Media] Permintaan ke ssstik.io gagal, mencoba fallback:", error?.message || error);
    }

    /* 2. Fallback otomatis bila ssstik.io terkena tantangan WAF / rate-limit dari IP Worker */
    if (!(slidesOnly && normalizedKind === "video")) {
        try {
            const fallbackResult = await fetchTikwmFallback(tiktokUrl, fetchImpl);
            if (
                fallbackResult.signal === "ssssuccess_slides" &&
                normalizedKind === "video" &&
                !fallbackResult.downloads.some(item => item.type === "video")
            ) {
                slidesOnly = true;
            }
            const fallbackCandidates = buildCandidatesForKind(fallbackResult, normalizedKind);
            if (fallbackCandidates.length > 0) {
                return {
                    tiktokUrl,
                    kind: normalizedKind,
                    title: fallbackResult.title || "",
                    candidates: fallbackCandidates
                };
            }
        } catch (error) {
            console.warn("[TikTok Media] Fallback TikTok gagal:", error?.message || error);
        }
    }

    if (slidesOnly && normalizedKind === "video") {
        const err = new Error(
            "Link TikTok ini berupa postingan foto/slide (bukan video). Gunakan pada kolom Foto/Gambar Referensi atau tempelkan link video TikTok."
        );
        err.status = 422;
        throw err;
    }

    const kindLabel = normalizedKind === "image"
        ? "foto/gambar"
        : normalizedKind === "audio"
            ? "audio"
            : "video";

    const message = rateLimited
        ? "Layanan SSSTik sedang membatasi permintaan terlalu cepat (~10 detik). Tunggu sebentar lalu klik Proses lagi."
        : `Tidak dapat menemukan ${kindLabel} publik dari link TikTok tersebut lewat SSSTik. Pastikan postingan bersifat publik dan tautannya benar.`;

    const err = new Error(message);
    err.status = rateLimited ? 429 : 422;
    throw err;
}

function normalizeDownloadedContentType(rawContentType, kind, candidate) {
    const base = String(rawContentType || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    if (kind === "image") {
        if (["image/jpeg", "image/png", "image/webp"].includes(base)) return base;
        if (base === "image/jpg") return "image/jpeg";
        if (/\.png(?:$|\?)/i.test(candidate.url)) return "image/png";
        if (/\.webp(?:$|\?)/i.test(candidate.url)) return "image/webp";
        return "image/jpeg";
    }

    if (kind === "audio" && !candidate.needsClientAudioExtract) {
        if (base.startsWith("audio/")) {
            return base === "audio/mp3" ? "audio/mpeg" : base;
        }
        if (/\.m4a(?:$|\?)/i.test(candidate.url)) return "audio/mp4";
        if (/\.wav(?:$|\?)/i.test(candidate.url)) return "audio/wav";
        return "audio/mpeg";
    }

    if (base === "video/webm" || /\.webm(?:$|\?)/i.test(candidate.url)) {
        return "video/webm";
    }
    return "video/mp4";
}

function buildSafeTikTokFilename(kind, contentType) {
    const stamp = Date.now();
    if (kind === "image") {
        const ext = contentType === "image/png"
            ? "png"
            : contentType === "image/webp"
                ? "webp"
                : "jpg";
        return `tiktok-photo-${stamp}.${ext}`;
    }
    if (kind === "audio" && contentType.startsWith("audio/")) {
        const ext = contentType.includes("wav")
            ? "wav"
            : contentType.includes("mp4") || contentType.includes("m4a")
                ? "m4a"
                : "mp3";
        return `tiktok-audio-${stamp}.${ext}`;
    }
    const ext = contentType === "video/webm" ? "webm" : "mp4";
    return `tiktok-video-${stamp}.${ext}`;
}

function getMaxBytesForCandidate(kind, candidate) {
    if (kind === "image") return TIKTOK_MEDIA_MAX_BYTES.image;
    if (kind === "audio") {
        return candidate?.needsClientAudioExtract
            ? TIKTOK_MEDIA_MAX_BYTES.audioVideoContainer
            : TIKTOK_MEDIA_MAX_BYTES.audio;
    }
    return TIKTOK_MEDIA_MAX_BYTES.video;
}

function createSizeLimitedStream(readable, maxBytes) {
    if (!readable || typeof readable.pipeThrough !== "function") {
        return readable;
    }
    let total = 0;
    const limiter = new TransformStream({
        transform(chunk, controller) {
            total += chunk?.byteLength || chunk?.length || 0;
            if (total > maxBytes) {
                controller.error(
                    new Error(`Ukuran media melebihi batas maksimal ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`)
                );
                return;
            }
            controller.enqueue(chunk);
        }
    });
    return readable.pipeThrough(limiter);
}

async function fetchSingleTikTokCandidateMedia(candidate, kind, fetchImpl = fetch) {
    let currentUrl = candidate.url;
    const maxBytes = getMaxBytesForCandidate(kind, candidate);
    const referer = matchesHostSuffix(new URL(currentUrl).hostname, SSSTIK_WRAPPER_HOST_SUFFIXES)
        ? `${SSSTIK_ORIGIN}/`
        : "https://www.tiktok.com/";

    for (let hop = 0; hop < 6; hop += 1) {
        if (!isSafeResolvedTikTokMediaUrl(currentUrl)) {
            throw new Error("Host unduhan media TikTok tidak diizinkan.");
        }

        const response = await fetchImpl(currentUrl, {
            method: "GET",
            headers: {
                "User-Agent": DESKTOP_USER_AGENT,
                "Referer": referer,
                "Accept": "*/*"
            },
            redirect: "manual"
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location") || "";
            if (!location) {
                throw new Error("Redirect media TikTok kosong.");
            }
            currentUrl = new URL(location, currentUrl).toString();
            continue;
        }

        if (!response.ok) {
            throw new Error(`Server media TikTok mengembalikan HTTP ${response.status}.`);
        }

        const rawContentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (rawContentType.includes("text/html") || rawContentType.includes("application/json")) {
            throw new Error("Tautan unduhan TikTok mengembalikan halaman HTML, bukan file media.");
        }

        const contentLength = Number(response.headers.get("content-length") || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
            const sizeErr = new Error(
                `Ukuran media (${(contentLength / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`
            );
            sizeErr.status = 413;
            throw sizeErr;
        }

        /* Bila kandidat audio langsung ternyata mengembalikan kontainer video MP4, tandai agar diekstrak di browser */
        const needsAudioExtract =
            Boolean(candidate.needsClientAudioExtract) ||
            (kind === "audio" && rawContentType.startsWith("video/"));

        const contentType = normalizeDownloadedContentType(
            rawContentType,
            kind,
            { ...candidate, needsClientAudioExtract: needsAudioExtract }
        );
        const filename = buildSafeTikTokFilename(kind, contentType);

        return {
            body: createSizeLimitedStream(response.body, maxBytes),
            contentType,
            contentLength: contentLength > 0 ? contentLength : null,
            filename,
            source: candidate.source || "ssstik.io",
            quality: candidate.quality || "",
            needsClientAudioExtract: needsAudioExtract
        };
    }

    throw new Error("Terlalu banyak pengalihan (redirect) saat mengunduh media TikTok.");
}

export async function downloadResolvedTikTokMedia(candidates, { kind = "video", fetchImpl = fetch } = {}) {
    const list = Array.isArray(candidates) ? candidates : [];
    let lastError = null;

    for (const candidate of list) {
        try {
            return await fetchSingleTikTokCandidateMedia(candidate, kind, fetchImpl);
        } catch (error) {
            lastError = error;
        }
    }

    const err = new Error(
        lastError?.message ||
        "Gagal mengunduh file media TikTok dari hasil SSSTik."
    );
    err.status = lastError?.status || 502;
    throw err;
}
