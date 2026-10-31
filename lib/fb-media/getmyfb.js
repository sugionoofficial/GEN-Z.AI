/* =========================================================
   GEN-Z.AI
   FACEBOOK MEDIA RESOLVER VIA GETMYFB.COM
   ---------------------------------------------------------
   File:
   lib/fb-media/getmyfb.js

   Tanggung jawab:
   - Memvalidasi & menormalisasi URL Facebook (facebook.com,
     m.facebook.com, web.facebook.com, fb.watch, fb.com, share/*)
   - Memproses link lewat https://getmyfb.com/process (HTMX POST)
     untuk mengekstrak tautan unduhan video HD/SD, audio MP3,
     maupun foto/thumbnail beresolusi tinggi
   - Menyediakan fallback ekstraksi metadata publik Facebook bila
     getmyfb.com sedang terkena rate-limit sementara atau untuk
     postingan foto tunggal
   - Mengunduh & meneruskan stream media secara aman (anti-SSRF
     & batas ukuran file) untuk disimpan di sisi klien
========================================================= */

const GETMYFB_ORIGIN = "https://getmyfb.com";
const GETMYFB_PROCESS_URL = "https://getmyfb.com/process";

const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const DESKTOP_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FACEBOOK_HOST_SUFFIXES = [
    "facebook.com",
    "fb.watch",
    "fb.com"
];

const ALLOWED_MEDIA_CDN_SUFFIXES = [
    "ssscdn.io",
    "getmyfb.com",
    "fbcdn.net",
    "facebook.com",
    "fbsbx.com",
    "akamaihd.net"
];

export const FB_MEDIA_MAX_BYTES = Object.freeze({
    image: 10 * 1024 * 1024,
    audio: 50 * 1024 * 1024,
    audioVideoContainer: 120 * 1024 * 1024,
    video: 200 * 1024 * 1024
});

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

export function decodeHtmlEntities(input) {
    return String(input || "")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
            const code = Number.parseInt(hex, 16);
            return Number.isFinite(code) ? String.fromCodePoint(code) : _;
        })
        .replace(/&#(\d+);/g, (_, dec) => {
            const code = Number.parseInt(dec, 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : _;
        });
}

function decodeJsonEscapedUrl(raw) {
    return decodeHtmlEntities(
        String(raw || "")
            .replace(/\\u0025/gi, "%")
            .replace(/\\u0026/gi, "&")
            .replace(/\\u002F/gi, "/")
            .replace(/\\u003A/gi, ":")
            .replace(/\\u003D/gi, "=")
            .replace(/\\u003F/gi, "?")
            .replace(/\\\//g, "/")
    ).trim();
}

export function normalizeFacebookUrl(rawUrl) {
    let candidate = String(rawUrl || "").trim();
    if (!candidate) return "";

    if (!/^https?:\/\//i.test(candidate) && /^(?:www\.|m\.|web\.|mbasic\.)?(?:facebook\.com|fb\.watch|fb\.com)\//i.test(candidate)) {
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
    if (isIpLiteral(parsed.hostname) || !matchesHostSuffix(parsed.hostname, FACEBOOK_HOST_SUFFIXES)) {
        return "";
    }

    /* Unwrap l.facebook.com/l.php?u=... bila link disalin dari redirect internal FB */
    if (parsed.hostname.toLowerCase() === "l.facebook.com" && parsed.searchParams.has("u")) {
        const unwrapped = parsed.searchParams.get("u") || "";
        if (unwrapped && unwrapped !== rawUrl) {
            return normalizeFacebookUrl(unwrapped);
        }
    }

    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
}

export function isFacebookMediaUrl(rawUrl) {
    return Boolean(normalizeFacebookUrl(rawUrl));
}

export function isSafeResolvedMediaUrl(rawUrl) {
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

    return matchesHostSuffix(parsed.hostname, ALLOWED_MEDIA_CDN_SUFFIXES);
}

function classifyDownloadItem(url, qualityText = "", filename = "") {
    const combined = `${qualityText} ${filename}`.toLowerCase();
    const urlPath = (() => {
        try {
            return new URL(url).pathname.toLowerCase();
        } catch {
            return String(url || "").toLowerCase();
        }
    })();

    if (
        /\b(mp3|m4a|wav|aac|ogg|audio|musik|music)\b/i.test(combined) ||
        /\.(mp3|m4a|wav|aac|ogg)(?:$|\?)/i.test(urlPath)
    ) {
        return "audio";
    }

    if (
        /\b(jpg|jpeg|png|webp|photo|image|picture|foto|gambar)\b/i.test(combined) ||
        /\.(jpe?g|png|webp)(?:$|\?)/i.test(urlPath)
    ) {
        return "image";
    }

    return "video";
}

function scoreQuality(qualityText = "") {
    const label = String(qualityText || "").toLowerCase();
    if (/\b(4k|2160)\b/.test(label)) return 2160;
    if (/\b(2k|1440)\b/.test(label)) return 1440;
    if (/\b(1080|fhd|full\s*hd)\b/.test(label)) return 1080;
    const numMatch = label.match(/(\d{3,4})\s*p/);
    if (numMatch) {
        const res = Number.parseInt(numMatch[1], 10);
        if (Number.isFinite(res) && res > 0) return res;
    }
    if (/\bhd\b/.test(label)) return 720;
    if (/\bsd\b/.test(label)) return 360;
    return 480;
}

function stripTags(html) {
    return decodeHtmlEntities(String(html || "").replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

export function parseGetMyFbHtml(html) {
    const source = String(html || "");
    const rateLimited = /making requests too fast|please wait\s*~?\s*\d+\s*seconds/i.test(source);

    const titleMatch = source.match(/class=["'][^"']*results-item-text[^"']*["'][^>]*>([\s\S]*?)<\//i);
    const title = titleMatch ? stripTags(titleMatch[1]) : "";

    let imageUrl = "";
    const imgPatterns = [
        /<img[^>]+class=["'][^"']*results-item-image[^"']*["'][^>]+src=["']([^"']+)["']/i,
        /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*results-item-image[^"']*["']/i,
        /class=["'][^"']*results-item-image-wrapper[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i
    ];
    for (const pattern of imgPatterns) {
        const match = source.match(pattern);
        if (match && match[1]) {
            const candidate = decodeHtmlEntities(match[1].trim());
            if (/^https:\/\//i.test(candidate) && !/default-image/i.test(candidate) && isSafeResolvedMediaUrl(candidate)) {
                imageUrl = candidate;
                break;
            }
        }
    }

    const downloads = [];
    const seenUrls = new Set();

    const liRegex = /<li[^>]*class=["'][^"']*results-list-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(source)) !== null) {
        const block = liMatch[1];
        const anchorMatch = block.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
        if (!anchorMatch) continue;
        const attrs = anchorMatch[1] || "";
        const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
        if (!hrefMatch || !hrefMatch[1]) continue;

        const link = decodeHtmlEntities(hrefMatch[1].trim());
        if (!isSafeResolvedMediaUrl(link) || seenUrls.has(link)) continue;

        const downloadAttrMatch = attrs.match(/\bdownload=["']([^"']+)["']/i);
        const filename = downloadAttrMatch ? decodeHtmlEntities(downloadAttrMatch[1].trim()) : "";
        const blockWithoutAnchor = block.replace(/<a\b[\s\S]*?<\/a>/gi, " ");
        const quality = stripTags(blockWithoutAnchor) || stripTags(anchorMatch[2]) || "HD";
        const type = classifyDownloadItem(link, quality, filename);

        seenUrls.add(link);
        downloads.push({
            url: link,
            quality,
            score: scoreQuality(quality),
            filename,
            type,
            source: "getmyfb.com"
        });
    }

    /* Fallback bila markup memakai .results-list li tanpa class results-list-item */
    if (downloads.length === 0) {
        const listBlockMatch = source.match(/<ul[^>]*class=["'][^"']*results-list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
        const searchArea = listBlockMatch ? listBlockMatch[1] : source;
        const genericHrefRegex = /<a\b[^>]*\bhref=["'](https:\/\/(?:[\w-]+\.)?(?:ssscdn\.io|fbcdn\.net)\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let hrefMatch;
        while ((hrefMatch = genericHrefRegex.exec(searchArea)) !== null) {
            const link = decodeHtmlEntities(hrefMatch[1].trim());
            if (!isSafeResolvedMediaUrl(link) || seenUrls.has(link)) continue;
            const quality = stripTags(hrefMatch[2]) || "HD";
            const type = classifyDownloadItem(link, quality, "");
            seenUrls.add(link);
            downloads.push({
                url: link,
                quality,
                score: scoreQuality(quality),
                filename: "",
                type,
                source: "getmyfb.com"
            });
        }
    }

    return {
        title,
        imageUrl,
        downloads,
        rateLimited: rateLimited && downloads.length === 0 && !imageUrl
    };
}

function getRefererPageForKind(kind) {
    if (kind === "audio") return `${GETMYFB_ORIGIN}/facebook-to-mp3`;
    if (kind === "image") return `${GETMYFB_ORIGIN}/download-facebook-photo`;
    return `${GETMYFB_ORIGIN}/id`;
}

function extractCookieHeader(response) {
    if (!response?.headers) return "";
    if (typeof response.headers.getSetCookie === "function") {
        const list = response.headers.getSetCookie();
        if (Array.isArray(list) && list.length > 0) {
            return list
                .map(item => String(item || "").split(";")[0].trim())
                .filter(Boolean)
                .join("; ");
        }
    }
    const raw = response.headers.get("set-cookie") || "";
    if (!raw) return "";
    return raw
        .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
        .map(part => part.split(";")[0].trim())
        .filter(Boolean)
        .join("; ");
}

async function postToGetMyFb(fbUrl, { kind = "video", cookies = "", extraToken = "", fetchImpl = fetch } = {}) {
    const referer = getRefererPageForKind(kind);
    const params = new URLSearchParams({
        id: fbUrl,
        locale: "id"
    });
    if (extraToken) {
        params.set("tt", extraToken);
    }

    const headers = {
        "HX-Request": "true",
        "HX-Trigger": "form",
        "HX-Target": "target",
        "HX-Current-URL": referer,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": GETMYFB_ORIGIN,
        "Referer": referer,
        "Accept": "*/*",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent": DEFAULT_USER_AGENT
    };
    if (cookies) {
        headers.Cookie = cookies;
    }

    const response = await fetchImpl(GETMYFB_PROCESS_URL, {
        method: "POST",
        headers,
        body: params.toString(),
        redirect: "follow"
    });

    const html = await response.text();
    return {
        ok: response.ok,
        status: response.status,
        ...parseGetMyFbHtml(html)
    };
}

async function fetchGetMyFbSession(kind, fetchImpl = fetch) {
    const pageUrl = getRefererPageForKind(kind);
    try {
        const res = await fetchImpl(pageUrl, {
            method: "GET",
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "User-Agent": DEFAULT_USER_AGENT
            },
            redirect: "follow"
        });
        const cookies = extractCookieHeader(res);
        const body = await res.text();
        const ttMatch = body.match(/\btt\s*:\s*['"]([A-Za-z0-9_-]+)['"]/);
        return {
            cookies,
            extraToken: ttMatch ? ttMatch[1] : ""
        };
    } catch {
        return { cookies: "", extraToken: "" };
    }
}

function parseFacebookHtmlDirect(html) {
    const source = String(html || "");
    const downloads = [];
    const seen = new Set();

    const addCandidate = (rawUrl, quality, type = "video") => {
        const cleaned = decodeJsonEscapedUrl(rawUrl);
        if (!cleaned || !isSafeResolvedMediaUrl(cleaned) || seen.has(cleaned)) return;
        seen.add(cleaned);
        downloads.push({
            url: cleaned,
            quality,
            score: scoreQuality(quality),
            filename: "",
            type,
            source: "facebook-direct"
        });
    };

    const videoPatterns = [
        [/"browser_native_hd_url"\s*:\s*"([^"]+)"/i, "HD"],
        [/"playable_url_quality_hd"\s*:\s*"([^"]+)"/i, "HD"],
        [/"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/i, "HD"],
        [/"hd_src"\s*:\s*"([^"]+)"/i, "HD"],
        [/<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i, "HD"],
        [/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url|:url)?["']/i, "HD"],
        [/"browser_native_sd_url"\s*:\s*"([^"]+)"/i, "SD"],
        [/"playable_url"\s*:\s*"([^"]+)"/i, "SD"],
        [/"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/i, "SD"],
        [/"sd_src"\s*:\s*"([^"]+)"/i, "SD"]
    ];

    for (const [pattern, quality] of videoPatterns) {
        const match = source.match(pattern);
        if (match && match[1]) {
            addCandidate(match[1], quality, "video");
        }
    }

    const redirectMatch = source.match(/href=["'](\/video_redirect\/\?src=[^"']+)["']/i);
    if (redirectMatch && redirectMatch[1]) {
        try {
            const redirectUrl = new URL(decodeHtmlEntities(redirectMatch[1]), "https://m.facebook.com");
            const srcParam = redirectUrl.searchParams.get("src");
            if (srcParam) {
                addCandidate(srcParam, "SD", "video");
            }
        } catch {
            /* ignore malformed redirect */
        }
    }

    let imageUrl = "";
    const imagePatterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
    ];
    for (const pattern of imagePatterns) {
        const match = source.match(pattern);
        if (match && match[1]) {
            const cleaned = decodeJsonEscapedUrl(match[1]);
            if (isSafeResolvedMediaUrl(cleaned) && !/rsrc\.php|static\.xx\.fbcdn/i.test(cleaned)) {
                imageUrl = cleaned;
                break;
            }
        }
    }

    let canonicalUrl = "";
    const canonicalPatterns = [
        /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
        /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
    ];
    for (const pattern of canonicalPatterns) {
        const match = source.match(pattern);
        if (match && match[1]) {
            const normalized = normalizeFacebookUrl(decodeHtmlEntities(match[1]));
            if (normalized) {
                canonicalUrl = normalized;
                break;
            }
        }
    }

    return { downloads, imageUrl, canonicalUrl };
}

async function fetchFacebookPageSafely(fbUrl, fetchImpl = fetch, userAgent = DESKTOP_USER_AGENT) {
    let currentUrl = fbUrl;
    for (let hop = 0; hop < 5; hop += 1) {
        const normalized = normalizeFacebookUrl(currentUrl);
        if (!normalized) return { html: "", finalUrl: currentUrl };

        const response = await fetchImpl(normalized, {
            method: "GET",
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "User-Agent": userAgent,
                "Sec-Fetch-Mode": "navigate"
            },
            redirect: "manual"
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location") || "";
            if (!location) return { html: "", finalUrl: normalized };
            const resolved = new URL(location, normalized).toString();
            const safeNext = normalizeFacebookUrl(resolved);
            if (!safeNext) return { html: "", finalUrl: normalized };
            currentUrl = safeNext;
            continue;
        }

        const html = await response.text();
        return { html, finalUrl: normalized };
    }
    return { html: "", finalUrl: currentUrl };
}

function buildCandidatesForKind(parsed, kind) {
    const downloads = Array.isArray(parsed?.downloads) ? parsed.downloads : [];
    const imageUrl = String(parsed?.imageUrl || "").trim();

    if (kind === "video") {
        return downloads
            .filter(item => item.type === "video")
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                ...item,
                needsClientAudioExtract: false
            }));
    }

    if (kind === "audio") {
        const directAudio = downloads
            .filter(item => item.type === "audio")
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                ...item,
                needsClientAudioExtract: false
            }));

        /* Bila getmyfb mengembalikan MP4 (video + audio), pilih ukuran lebih ringan (SD dulu)
           agar unduhan cepat lalu diekstrak menjadi audio di browser. */
        const videoWithAudio = downloads
            .filter(item => item.type === "video")
            .sort((a, b) => a.score - b.score)
            .map(item => ({
                ...item,
                needsClientAudioExtract: true
            }));

        return [...directAudio, ...videoWithAudio];
    }

    if (kind === "image") {
        const imageDownloads = downloads
            .filter(item => item.type === "image")
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                ...item,
                needsClientAudioExtract: false
            }));

        if (imageUrl && !imageDownloads.some(item => item.url === imageUrl)) {
            imageDownloads.push({
                url: imageUrl,
                quality: "HD Photo",
                score: 720,
                filename: "",
                type: "image",
                source: parsed?.downloads?.[0]?.source || "getmyfb.com",
                needsClientAudioExtract: false
            });
        }

        return imageDownloads;
    }

    return [];
}

export async function resolveFacebookMediaViaGetMyFb(rawUrl, { kind = "video", fetchImpl = fetch } = {}) {
    const normalizedKind = ["video", "image", "audio"].includes(kind) ? kind : "video";
    const fbUrl = normalizeFacebookUrl(rawUrl);
    if (!fbUrl) {
        const err = new Error("URL Facebook tidak valid. Gunakan link dari facebook.com atau fb.watch.");
        err.status = 400;
        throw err;
    }

    let rateLimited = false;

    /* 1. Proses utama lewat https://getmyfb.com/process */
    try {
        const firstAttempt = await postToGetMyFb(fbUrl, {
            kind: normalizedKind,
            fetchImpl
        });
        rateLimited = rateLimited || Boolean(firstAttempt.rateLimited);
        const firstCandidates = buildCandidatesForKind(firstAttempt, normalizedKind);
        if (firstCandidates.length > 0) {
            return {
                fbUrl,
                kind: normalizedKind,
                title: firstAttempt.title || "",
                candidates: firstCandidates
            };
        }

        /* 2. Retry dengan sesi cookie getmyfb.com bila respons pertama belum memuat daftar hasil */
        const session = await fetchGetMyFbSession(normalizedKind, fetchImpl);
        if (session.cookies || session.extraToken) {
            const cookieAttempt = await postToGetMyFb(fbUrl, {
                kind: normalizedKind,
                cookies: session.cookies,
                extraToken: session.extraToken,
                fetchImpl
            });
            rateLimited = rateLimited || Boolean(cookieAttempt.rateLimited);
            const cookieCandidates = buildCandidatesForKind(cookieAttempt, normalizedKind);
            if (cookieCandidates.length > 0) {
                return {
                    fbUrl,
                    kind: normalizedKind,
                    title: cookieAttempt.title || "",
                    candidates: cookieCandidates
                };
            }
        }
    } catch (error) {
        console.warn("[FB Media] Permintaan ke getmyfb.com gagal, mencoba fallback:", error?.message || error);
    }

    /* 3. Resolusi URL kanonik (untuk link singkat share/v/, share/r/, share/p/, fb.watch)
          sekaligus fallback metadata publik bila getmyfb.com sedang rate-limit atau post berupa foto. */
    try {
        const desktopPage = await fetchFacebookPageSafely(fbUrl, fetchImpl, DESKTOP_USER_AGENT);
        const directParsed = parseFacebookHtmlDirect(desktopPage.html);
        const canonical = directParsed.canonicalUrl || desktopPage.finalUrl;

        if (canonical && canonical !== fbUrl) {
            try {
                const canonicalAttempt = await postToGetMyFb(canonical, {
                    kind: normalizedKind,
                    fetchImpl
                });
                const canonicalCandidates = buildCandidatesForKind(canonicalAttempt, normalizedKind);
                if (canonicalCandidates.length > 0) {
                    return {
                        fbUrl: canonical,
                        kind: normalizedKind,
                        title: canonicalAttempt.title || "",
                        candidates: canonicalCandidates
                    };
                }
            } catch {
                /* Lanjut ke hasil ekstraksi langsung */
            }
        }

        const directCandidates = buildCandidatesForKind(directParsed, normalizedKind);
        if (directCandidates.length > 0) {
            return {
                fbUrl: canonical || fbUrl,
                kind: normalizedKind,
                title: "",
                candidates: directCandidates
            };
        }

        if (normalizedKind !== "image") {
            const mobileUrl = (canonical || fbUrl).replace(
                /^https:\/\/(?:www\.|web\.)?facebook\.com\//i,
                "https://m.facebook.com/"
            );
            if (mobileUrl !== (canonical || fbUrl)) {
                const mobilePage = await fetchFacebookPageSafely(mobileUrl, fetchImpl, DEFAULT_USER_AGENT);
                const mobileParsed = parseFacebookHtmlDirect(mobilePage.html);
                const mobileCandidates = buildCandidatesForKind(mobileParsed, normalizedKind);
                if (mobileCandidates.length > 0) {
                    return {
                        fbUrl: canonical || fbUrl,
                        kind: normalizedKind,
                        title: "",
                        candidates: mobileCandidates
                    };
                }
            }
        }
    } catch (error) {
        console.warn("[FB Media] Fallback langsung Facebook gagal:", error?.message || error);
    }

    const kindLabel = normalizedKind === "image"
        ? "foto/gambar"
        : normalizedKind === "audio"
            ? "audio/video"
            : "video";

    const message = rateLimited
        ? "Layanan GetMyFB sedang membatasi permintaan terlalu cepat (~10 detik). Tunggu sebentar lalu klik Proses lagi."
        : `Tidak dapat menemukan ${kindLabel} publik dari link Facebook tersebut lewat GetMyFB. Pastikan postingan bersifat publik dan tautannya benar.`;

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

function buildSafeFilename(kind, contentType) {
    const stamp = Date.now();
    if (kind === "image") {
        const ext = contentType === "image/png"
            ? "png"
            : contentType === "image/webp"
                ? "webp"
                : "jpg";
        return `fb-photo-${stamp}.${ext}`;
    }
    if (kind === "audio" && contentType.startsWith("audio/")) {
        const ext = contentType.includes("wav")
            ? "wav"
            : contentType.includes("mp4") || contentType.includes("m4a")
                ? "m4a"
                : "mp3";
        return `fb-audio-${stamp}.${ext}`;
    }
    const ext = contentType === "video/webm" ? "webm" : "mp4";
    return `fb-video-${stamp}.${ext}`;
}

function getMaxBytesForCandidate(kind, candidate) {
    if (kind === "image") return FB_MEDIA_MAX_BYTES.image;
    if (kind === "audio") {
        return candidate?.needsClientAudioExtract
            ? FB_MEDIA_MAX_BYTES.audioVideoContainer
            : FB_MEDIA_MAX_BYTES.audio;
    }
    return FB_MEDIA_MAX_BYTES.video;
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

async function fetchSingleCandidateMedia(candidate, kind, fetchImpl = fetch) {
    let currentUrl = candidate.url;
    const maxBytes = getMaxBytesForCandidate(kind, candidate);
    const referer = candidate.source === "getmyfb.com"
        ? `${GETMYFB_ORIGIN}/`
        : "https://www.facebook.com/";

    for (let hop = 0; hop < 6; hop += 1) {
        if (!isSafeResolvedMediaUrl(currentUrl)) {
            throw new Error("Host unduhan media tidak diizinkan.");
        }

        const response = await fetchImpl(currentUrl, {
            method: "GET",
            headers: {
                "User-Agent": DEFAULT_USER_AGENT,
                "Referer": referer,
                "Accept": "*/*"
            },
            redirect: "manual"
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location") || "";
            if (!location) {
                throw new Error("Redirect media Facebook kosong.");
            }
            currentUrl = new URL(location, currentUrl).toString();
            continue;
        }

        if (!response.ok) {
            throw new Error(`Server media mengembalikan HTTP ${response.status}.`);
        }

        const rawContentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (rawContentType.includes("text/html") || rawContentType.includes("application/json")) {
            throw new Error("Tautan unduhan mengembalikan halaman HTML, bukan file media.");
        }

        const contentLength = Number(response.headers.get("content-length") || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
            const sizeErr = new Error(
                `Ukuran media (${(contentLength / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`
            );
            sizeErr.status = 413;
            throw sizeErr;
        }

        const contentType = normalizeDownloadedContentType(rawContentType, kind, candidate);
        const filename = buildSafeFilename(kind, contentType);

        return {
            body: createSizeLimitedStream(response.body, maxBytes),
            contentType,
            contentLength: contentLength > 0 ? contentLength : null,
            filename,
            source: candidate.source || "getmyfb.com",
            quality: candidate.quality || "",
            needsClientAudioExtract: Boolean(candidate.needsClientAudioExtract)
        };
    }

    throw new Error("Terlalu banyak pengalihan (redirect) saat mengunduh media.");
}

export async function downloadResolvedFacebookMedia(candidates, { kind = "video", fetchImpl = fetch } = {}) {
    const list = Array.isArray(candidates) ? candidates : [];
    let lastError = null;

    for (const candidate of list) {
        try {
            return await fetchSingleCandidateMedia(candidate, kind, fetchImpl);
        } catch (error) {
            lastError = error;
        }
    }

    const err = new Error(
        lastError?.message ||
        "Gagal mengunduh file media dari hasil GetMyFB."
    );
    err.status = lastError?.status || 502;
    throw err;
}
