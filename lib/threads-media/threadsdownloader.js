/* =========================================================
   GEN-Z.AI
   THREADS MEDIA RESOLVER VIA THREADSDOWNLOADER.COM + FALLBACK
   ---------------------------------------------------------
   File:
   lib/threads-media/threadsdownloader.js

   Tanggung jawab:
   - Memvalidasi & menormalisasi URL postingan publik Threads
     (threads.com, www.threads.com, threads.net, www.threads.net:
      /@user/post/<code>, /t/<code>, /share/<code>)
   - Memproses tautan melalui https://www.threadsdownloader.com/
     (endpoint https://api-tp.threadsdownloader.com/threads/post/media)
     sekaligus mendeteksi placeholder Turnstile (for_access /
     nolongerworks) agar tidak pernah menyimpan gambar palsu
   - Menyediakan ekstraksi langsung halaman publik Threads
     (<script type="application/json"> Relay/data.media: video_versions,
      image_versions2 resolusi asli, carousel_media, quoted/reposted)
     serta fallback HTMX savethr.com/process & threadsdl.app bila
     API utama meminta token Turnstile interaktif
   - Mengunduh & meneruskan stream media secara aman (anti-SSRF
     & batas ukuran file) untuk disimpan ke user-uploads
========================================================= */

import { decodeHtmlEntities, FB_MEDIA_MAX_BYTES } from "../fb-media/getmyfb.js";

const THREADSDOWNLOADER_SITE = "https://www.threadsdownloader.com";
const THREADSDOWNLOADER_API = "https://api-tp.threadsdownloader.com/threads/post/media";
const SAVETHR_ORIGIN = "https://savethr.com";
const SAVETHR_PROCESS_URL = "https://savethr.com/process";
const THREADSDL_API_URL = "https://www.threadsdl.app/api/threads";
const ACCEPT_ALL = "*\x2f*";

const DESKTOP_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const MOBILE_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const THREADS_HOST_SUFFIXES = [
    "threads.com",
    "threads.net"
];

const WRAPPER_HOST_SUFFIXES = [
    "savethr.com",
    "ssscdn.io",
    "threadsdownloader.com",
    "threadsdl.app"
];

const ALLOWED_THREADS_MEDIA_CDN_SUFFIXES = [
    "cdninstagram.com",
    "fbcdn.net",
    "threads.com",
    "threads.net",
    "threadsdownloader.com",
    "savethr.com",
    "ssscdn.io",
    "threadsdl.app",
    "akamaihd.net",
    "akamaized.net"
];

export const THREADS_MEDIA_MAX_BYTES = FB_MEDIA_MAX_BYTES;

const BASE64_SEGMENT_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
const MIN_BASE64_URL_LEN = 20;
const GIF_PLACEHOLDER_MARKER = "static.cdninstagram.com/rsrc.php";

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

/* =========================================================
   PARSING & NORMALISASI URL THREADS
========================================================= */

export function parseThreadsPostLink(rawUrl) {
    let candidate = String(rawUrl || "").trim();
    if (!candidate) return null;

    if (
        !/^https?:\/\//i.test(candidate) &&
        /^(?:www\.)?threads\.(?:com|net)\//i.test(candidate)
    ) {
        candidate = `https://${candidate}`;
    }

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return null;
    }
    if (parsed.username || parsed.password) {
        return null;
    }
    if (parsed.port && parsed.port !== "443" && parsed.port !== "80") {
        return null;
    }
    if (isIpLiteral(parsed.hostname) || !matchesHostSuffix(parsed.hostname, THREADS_HOST_SUFFIXES)) {
        return null;
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");

    /* Pola 1: /@username/post/<code> (opsional /media atau /embed di ujung) */
    const postMatch = pathname.match(/^\/@?([A-Za-z0-9._]+)\/post\/([A-Za-z0-9_-]{5,})(?:\/(?:media|embed))?$/i);
    if (postMatch) {
        const username = postMatch[1];
        const code = postMatch[2];
        return {
            username,
            code,
            shareMode: false,
            canonicalUrl: `https://www.threads.com/@${username}/post/${code}`,
            threadsNetUrl: `https://www.threads.net/@${username}/post/${code}`
        };
    }

    /* Pola 2: /t/<code> */
    const shortMatch = pathname.match(/^\/t\/([A-Za-z0-9_-]{5,})(?:\/(?:media|embed))?$/i);
    if (shortMatch) {
        const code = shortMatch[1];
        return {
            username: "",
            code,
            shareMode: false,
            canonicalUrl: `https://www.threads.com/t/${code}`,
            threadsNetUrl: `https://www.threads.net/t/${code}`
        };
    }

    /* Pola 3: /share/<code> */
    const shareMatch = pathname.match(/^\/share\/([A-Za-z0-9_-]{5,})$/i);
    if (shareMatch) {
        const shareId = shareMatch[1];
        return {
            username: "",
            code: shareId,
            shareMode: true,
            canonicalUrl: `https://www.threads.com/share/${shareId}`,
            threadsNetUrl: `https://www.threads.net/share/${shareId}`
        };
    }

    return null;
}

export function normalizeThreadsUrl(rawUrl) {
    const parsed = parseThreadsPostLink(rawUrl);
    return parsed ? parsed.canonicalUrl : "";
}

export function isThreadsMediaUrl(rawUrl) {
    return Boolean(parseThreadsPostLink(rawUrl));
}

export function isSafeResolvedThreadsMediaUrl(rawUrl) {
    const cleaned = String(rawUrl || "").trim();
    if (!cleaned || cleaned.includes(GIF_PLACEHOLDER_MARKER)) {
        return false;
    }

    let parsed;
    try {
        parsed = new URL(cleaned);
    } catch {
        return false;
    }

    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== "443") return false;
    if (isIpLiteral(parsed.hostname)) return false;

    return matchesHostSuffix(parsed.hostname, ALLOWED_THREADS_MEDIA_CDN_SUFFIXES);
}

/* =========================================================
   UNWRAPPER BASE64 UNTUK WRAPPER DOWNLOADER (savethr / ssscdn)
========================================================= */

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

export function unwrapThreadsWrapperUrl(rawHref, baseOrigin = SAVETHR_ORIGIN) {
    const cleaned = decodeHtmlEntities(String(rawHref || "").trim()).replace(/\\\//g, "/");
    let parsed;
    try {
        parsed = new URL(cleaned, baseOrigin);
    } catch {
        return { url: "", wrapperUrl: "", decoded: false };
    }

    const fullHref = parsed.toString();
    if (!matchesHostSuffix(parsed.hostname, WRAPPER_HOST_SUFFIXES)) {
        return { url: fullHref, wrapperUrl: fullHref, decoded: false };
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
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

/* =========================================================
   TAHAP 1: RESOLUSI LEWAT THREADSDOWNLOADER.COM API
   (https://api-tp.threadsdownloader.com/threads/post/media)
========================================================= */

export function parseThreadsDownloaderApiJson(payload) {
    if (!payload || typeof payload !== "object") {
        return { placeholder: false, title: "", downloads: [] };
    }

    const serialized = JSON.stringify(payload);
    const metaUser = String(payload?.meta?.username || "");
    if (
        /for_access|nolongerworks/i.test(metaUser) ||
        /threadsdownloader-nolongerworks|contact@threadsdownloader\.com_for_access/i.test(serialized)
    ) {
        return {
            placeholder: true,
            title: "",
            downloads: []
        };
    }

    const downloads = [];
    const seen = new Set();

    const addVariant = (rawUrl, type, width, height, indexLabel = "") => {
        const cleaned = decodeHtmlEntities(String(rawUrl || "").trim()).replace(/\\\//g, "/");
        if (!isSafeResolvedThreadsMediaUrl(cleaned)) return;
        const key = `${type}:${cleaned}`;
        if (seen.has(key)) return;
        seen.add(key);

        const w = Number(width) || 0;
        const h = Number(height) || 0;
        const areaScore = w > 0 && h > 0 ? Math.min(4000, Math.round(Math.max(w, h))) : 720;
        const quality = w > 0 && h > 0
            ? `${w}x${h}${indexLabel ? ` (${indexLabel})` : ""}`
            : indexLabel || "HD";

        downloads.push({
            url: cleaned,
            type,
            quality,
            score: areaScore,
            source: "threadsdownloader.com"
        });
    };

    const videosRaw = Array.isArray(payload?.media?.videos) ? payload.media.videos : [];
    videosRaw.forEach((videoItem, idx) => {
        const variants = Array.isArray(videoItem?.variants) ? videoItem.variants : [];
        const sorted = [...variants].sort(
            (a, b) => (Number(b?.width) || 0) * (Number(b?.height) || 0) -
                (Number(a?.width) || 0) * (Number(a?.height) || 0)
        );
        for (const variant of sorted) {
            const ctype = String(variant?.content_type || "").toLowerCase();
            if (!ctype || ctype.startsWith("video")) {
                addVariant(
                    variant?.url,
                    "video",
                    variant?.width,
                    variant?.height,
                    videosRaw.length > 1 ? `Video ${idx + 1}` : ""
                );
            }
        }
        if (videoItem?.thumbnail) {
            addVariant(videoItem.thumbnail, "image", 720, 720, "Thumbnail");
        }
    });

    const imagesRaw = Array.isArray(payload?.media?.images) ? payload.media.images : [];
    imagesRaw.forEach((imageItem, idx) => {
        const variants = Array.isArray(imageItem?.variants) ? imageItem.variants : [];
        const sorted = [...variants].sort(
            (a, b) => (Number(b?.width) || 0) * (Number(b?.height) || 0) -
                (Number(a?.width) || 0) * (Number(a?.height) || 0)
        );
        for (const variant of sorted) {
            addVariant(
                variant?.url,
                "image",
                variant?.width,
                variant?.height,
                imagesRaw.length > 1 ? `Foto ${idx + 1}` : ""
            );
        }
    });

    return {
        placeholder: false,
        title: metaUser ? `@${metaUser}` : "",
        downloads
    };
}

async function queryThreadsDownloaderCom(parsedLink, { turnstileToken = "", fetchImpl = fetch } = {}) {
    const params = new URLSearchParams({
        id: parsedLink.code,
        share_mode: parsedLink.shareMode ? "true" : "false"
    });

    if (turnstileToken) {
        const formattedCap =
            turnstileToken.startsWith("tcaptcha-") || turnstileToken.startsWith("gcaptcha-")
                ? turnstileToken
                : `tcaptcha-${turnstileToken}`;
        params.set("cap", formattedCap);
    }

    const requestUrl = `${THREADSDOWNLOADER_API}?${params.toString()}`;
    const response = await fetchImpl(requestUrl, {
        method: "GET",
        headers: {
            "User-Agent": DESKTOP_USER_AGENT,
            "Accept": `application/json, text/plain, ${ACCEPT_ALL}`,
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "Origin": THREADSDOWNLOADER_SITE,
            "Referer": `${THREADSDOWNLOADER_SITE}/id`
        }
    });

    if (!response.ok) {
        throw new Error(`ThreadsDownloader API mengembalikan HTTP ${response.status}.`);
    }

    const payload = await response.json().catch(() => null);
    return parseThreadsDownloaderApiJson(payload);
}

/* =========================================================
   TAHAP 2: EKSTRAKSI JSON HALAMAN PUBLIK THREADS LANGSUNG
   (<script type="application/json"> data.media / Relay)
========================================================= */

function findTargetThreadsPostInJson(root, targetCode) {
    /* Prioritas 1: objek yang memiliki data.media dengan code === targetCode & user */
    const stack = [root];
    let fallbackCandidate = null;

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || typeof current !== "object") continue;

        if (Array.isArray(current)) {
            for (let i = current.length - 1; i >= 0; i -= 1) {
                stack.push(current[i]);
            }
            continue;
        }

        const directMedia = current.data?.media;
        if (
            directMedia &&
            typeof directMedia === "object" &&
            (!targetCode || directMedia.code === targetCode) &&
            directMedia.user &&
            typeof directMedia.user === "object"
        ) {
            return directMedia;
        }

        /* Prioritas 2: post di dalam thread_items Relay preloader */
        if (Array.isArray(current.thread_items)) {
            for (const ti of current.thread_items) {
                const post = ti?.post;
                if (
                    post &&
                    typeof post === "object" &&
                    (!targetCode || post.code === targetCode) &&
                    post.user &&
                    typeof post.user === "object"
                ) {
                    return post;
                }
            }
        }

        /* Prioritas 3: objek post langsung yang membawa media & code cocok */
        if (
            !fallbackCandidate &&
            targetCode &&
            (current.code === targetCode || current.shortcode === targetCode) &&
            current.user &&
            typeof current.user === "object" &&
            (current.video_versions || current.image_versions2 || current.carousel_media || current.text_post_app_info)
        ) {
            fallbackCandidate = current;
        }

        for (const value of Object.values(current)) {
            if (value && typeof value === "object") {
                stack.push(value);
            }
        }
    }

    return fallbackCandidate;
}

function extractMediaItemsFromPostNode(node, pushDownload) {
    if (!node || typeof node !== "object") return 0;
    let count = 0;

    if (Array.isArray(node.carousel_media) && node.carousel_media.length > 0) {
        node.carousel_media.forEach((child, idx) => {
            count += extractMediaItemsFromPostNode(child, (item) => {
                pushDownload({
                    ...item,
                    quality: item.quality ? `${item.quality} #${idx + 1}` : `Slide ${idx + 1}`
                });
            });
        });
        return count;
    }

    if (Array.isArray(node.video_versions) && node.video_versions.length > 0) {
        const sortedVideos = [...node.video_versions].sort((a, b) => {
            const areaDiff =
                (Number(b?.width) || 0) * (Number(b?.height) || 0) -
                (Number(a?.width) || 0) * (Number(a?.height) || 0);
            if (areaDiff !== 0) return areaDiff;
            return (a?.type === 101 ? -1 : 0) - (b?.type === 101 ? -1 : 0);
        });

        for (const ver of sortedVideos) {
            if (ver?.url && pushDownload({
                url: ver.url,
                type: "video",
                width: Number(ver.width) || Number(node.original_width) || 720,
                height: Number(ver.height) || Number(node.original_height) || 1280,
                quality: ver.width && ver.height ? `${ver.width}x${ver.height}` : "HD"
            })) {
                count += 1;
            }
        }
    }

    const imgCandidates = Array.isArray(node.image_versions2?.candidates)
        ? node.image_versions2.candidates
        : [];
    if (imgCandidates.length > 0) {
        const origW = Number(node.original_width) || 0;
        const origH = Number(node.original_height) || 0;
        const sortedImgs = [...imgCandidates].sort((a, b) => {
            const aExact = origW > 0 && a?.width === origW && a?.height === origH ? 1 : 0;
            const bExact = origW > 0 && b?.width === origW && b?.height === origH ? 1 : 0;
            if (bExact !== aExact) return bExact - aExact;
            return (Number(b?.width) || 0) * (Number(b?.height) || 0) -
                (Number(a?.width) || 0) * (Number(a?.height) || 0);
        });

        /* Bila node ini sendiri adalah video, kandidat gambar berfungsi sebagai cover/foto cadangan */
        const maxImagesToTake = Array.isArray(node.video_versions) && node.video_versions.length > 0 ? 1 : 2;
        let taken = 0;
        for (const cand of sortedImgs) {
            if (taken >= maxImagesToTake) break;
            if (cand?.url && pushDownload({
                url: cand.url,
                type: "image",
                width: Number(cand.width) || origW || 1080,
                height: Number(cand.height) || origH || 1080,
                quality: cand.width && cand.height ? `${cand.width}x${cand.height}` : "Original"
            })) {
                taken += 1;
                if (!Array.isArray(node.video_versions) || node.video_versions.length === 0) {
                    count += 1;
                }
            }
        }
    }

    return count;
}

export function parseThreadsPublicHtml(html, targetCode = "") {
    const source = String(html || "");
    const downloads = [];
    const seen = new Set();
    let title = "";

    const pushDownload = ({ url, type, width = 0, height = 0, quality = "HD" }) => {
        const cleaned = decodeHtmlEntities(String(url || "").trim()).replace(/\\\//g, "/");
        if (!isSafeResolvedThreadsMediaUrl(cleaned)) return false;
        const key = `${type}:${cleaned}`;
        if (seen.has(key)) return false;
        seen.add(key);

        const score = width > 0 && height > 0 ? Math.min(4000, Math.max(width, height)) : 720;
        downloads.push({
            url: cleaned,
            type,
            quality,
            score,
            source: "threadsdownloader.com"
        });
        return true;
    };

    const scriptRegex = /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    let matchedPost = null;

    while ((scriptMatch = scriptRegex.exec(source)) !== null) {
        const rawJson = scriptMatch[1];
        if (!rawJson || (!rawJson.includes("video_versions") && !rawJson.includes("image_versions2") && !rawJson.includes("carousel_media"))) {
            continue;
        }
        if (targetCode && !rawJson.includes(targetCode)) {
            continue;
        }
        try {
            const parsed = JSON.parse(rawJson);
            const found = findTargetThreadsPostInJson(parsed, targetCode);
            if (found) {
                matchedPost = found;
                break;
            }
        } catch {
            /* lanjut ke blok JSON berikutnya */
        }
    }

    if (matchedPost) {
        title = String(matchedPost?.caption?.text || matchedPost?.user?.username || "").trim();
        const shareInfo = matchedPost?.text_post_app_info?.share_info || {};
        const chain = [
            matchedPost,
            shareInfo.quoted_post,
            shareInfo.reposted_post,
            matchedPost?.text_post_app_info?.linked_inline_media
        ];

        for (const node of chain) {
            if (!node || typeof node !== "object") continue;
            const beforeLen = downloads.length;
            extractMediaItemsFromPostNode(node, pushDownload);
            if (downloads.length > beforeLen) {
                break;
            }
        }
    }

    /* Fallback meta OpenGraph bila post berupa single media sederhana */
    if (downloads.length === 0) {
        const metaRegex = /<meta\b[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
        let m;
        while ((m = metaRegex.exec(source)) !== null) {
            const prop = String(m[1] || "").toLowerCase();
            const content = m[2] || "";
            if (prop === "og:video" || prop === "og:video:secure_url" || prop === "twitter:player:stream") {
                pushDownload({ url: content, type: "video", width: 720, height: 1280, quality: "HD" });
            } else if (prop === "og:image" || prop === "og:image:secure_url") {
                pushDownload({ url: content, type: "image", width: 1080, height: 1080, quality: "HD" });
            } else if (prop === "og:description" && !title) {
                title = decodeHtmlEntities(content).trim();
            }
        }
    }

    return {
        title,
        downloads
    };
}

async function fetchThreadsPublicPageMedia(parsedLink, fetchImpl = fetch) {
    let currentUrl = parsedLink.canonicalUrl;
    let effectiveCode = parsedLink.shareMode ? "" : parsedLink.code;

    for (let hop = 0; hop < 5; hop += 1) {
        const parsedCurrent = new URL(currentUrl);
        if (isIpLiteral(parsedCurrent.hostname) || !matchesHostSuffix(parsedCurrent.hostname, THREADS_HOST_SUFFIXES)) {
            throw new Error("Pengalihan halaman Threads menuju domain di luar Threads.");
        }

        const response = await fetchImpl(currentUrl, {
            method: "GET",
            headers: {
                "User-Agent": DESKTOP_USER_AGENT,
                "Accept": `text/html,application/xhtml+xml,application/xml;q=0.9,${ACCEPT_ALL};q=0.8`,
                "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
                "Sec-Fetch-Mode": "navigate"
            },
            redirect: "manual"
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location") || "";
            if (!location) break;
            currentUrl = new URL(location, currentUrl).toString();
            const redirectedPost = parseThreadsPostLink(currentUrl);
            if (redirectedPost && !redirectedPost.shareMode) {
                effectiveCode = redirectedPost.code;
            }
            continue;
        }

        if (!response.ok) {
            throw new Error(`Halaman Threads mengembalikan HTTP ${response.status}.`);
        }

        const html = await response.text();
        if (!effectiveCode) {
            const ogUrlMatch = html.match(/<meta\b[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
            if (ogUrlMatch) {
                const ogParsed = parseThreadsPostLink(decodeHtmlEntities(ogUrlMatch[1]));
                if (ogParsed && !ogParsed.shareMode) {
                    effectiveCode = ogParsed.code;
                }
            }
        }

        return parseThreadsPublicHtml(html, effectiveCode);
    }

    throw new Error("Terlalu banyak pengalihan saat membaca postingan Threads.");
}

/* =========================================================
   TAHAP 3: FALLBACK HTMX SAVETHR.COM & THREADSDL.APP
========================================================= */

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

export function parseSaveThrHtml(html) {
    const source = String(html || "");
    const downloads = [];
    const seen = new Set();

    const anchorRegex = /<a\b([^>]{1,4096})>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = anchorRegex.exec(source)) !== null) {
        const attrsRaw = match[1];
        const hrefMatch = attrsRaw.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const href = hrefMatch ? decodeHtmlEntities(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
        if (!href || href.startsWith("#") || /^javascript:/i.test(href)) continue;

        const label = stripTags(match[2]).toLowerCase();
        const classMatch = attrsRaw.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const classStr = String(classMatch?.[1] || classMatch?.[2] || "").toLowerCase();
        if (!classStr.includes("download") && !/\bdownload\b/i.test(attrsRaw) && !/\b(mp4|mp3|hd|download|unduh)\b/.test(label)) {
            continue;
        }

        const unwrapped = unwrapThreadsWrapperUrl(href, SAVETHR_ORIGIN);
        const target = unwrapped.url || unwrapped.wrapperUrl;
        let type = "video";
        if (/\b(mp3|audio)\b/.test(label) || /\.mp3(?:$|\?)/i.test(target)) {
            type = "audio";
        } else if (/\b(jpg|jpeg|png|webp|photo|image|gif)\b/.test(label) || /\.(?:jpe?g|png|webp)(?:$|\?)/i.test(target)) {
            type = "image";
        }

        const candidatesToPush = unwrapped.decoded
            ? [unwrapped.url, unwrapped.wrapperUrl]
            : [unwrapped.url];

        for (const candidateUrl of candidatesToPush) {
            if (!isSafeResolvedThreadsMediaUrl(candidateUrl)) continue;
            const key = `${type}:${candidateUrl}`;
            if (seen.has(key)) continue;
            seen.add(key);
            downloads.push({
                url: candidateUrl,
                type,
                quality: /\b4k\b/.test(label) ? "4K" : /\b1080\b/.test(label) ? "1080p" : "HD",
                score: /\b4k\b/.test(label) ? 2160 : /\b1080\b/.test(label) ? 1080 : 720,
                source: "threadsdownloader-fallback"
            });
        }
    }

    return {
        title: "",
        downloads
    };
}

async function fetchSaveThrFallback(parsedLink, fetchImpl = fetch) {
    const homeRes = await fetchImpl(`${SAVETHR_ORIGIN}/`, {
        method: "GET",
        headers: {
            "User-Agent": MOBILE_USER_AGENT,
            "Accept": `text/html,application/xhtml+xml,application/xml;q=0.9,${ACCEPT_ALL};q=0.8`
        }
    });
    const cookies = extractSetCookieHeader(homeRes.headers);

    const body = new URLSearchParams({
        id: parsedLink.threadsNetUrl,
        locale: "en"
    });

    const headers = {
        "User-Agent": MOBILE_USER_AGENT,
        "Accept": ACCEPT_ALL,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": SAVETHR_ORIGIN,
        "Referer": `${SAVETHR_ORIGIN}/`,
        "HX-Request": "true",
        "HX-Target": "result-container",
        "HX-Trigger": "search-form",
        "HX-Current-URL": `${SAVETHR_ORIGIN}/`
    };
    if (cookies) {
        headers.Cookie = cookies;
    }

    const postRes = await fetchImpl(SAVETHR_PROCESS_URL, {
        method: "POST",
        headers,
        body: body.toString()
    });

    if (!postRes.ok) {
        throw new Error(`SaveThr mengembalikan HTTP ${postRes.status}.`);
    }

    return parseSaveThrHtml(await postRes.text());
}

async function fetchThreadsDlAppFallback(parsedLink, fetchImpl = fetch) {
    const response = await fetchImpl(THREADSDL_API_URL, {
        method: "POST",
        headers: {
            "User-Agent": MOBILE_USER_AGENT,
            "Accept": `application/json, text/plain, ${ACCEPT_ALL}`,
            "Content-Type": "application/json",
            "Origin": "https://www.threadsdl.app",
            "Referer": "https://www.threadsdl.app/id/"
        },
        body: JSON.stringify({ url: parsedLink.canonicalUrl })
    });

    if (!response.ok) {
        throw new Error(`ThreadsDL mengembalikan HTTP ${response.status}.`);
    }

    const data = await response.json().catch(() => null);
    const medias = Array.isArray(data?.medias) ? data.medias : [];
    const downloads = [];
    const seen = new Set();

    const push = (rawUrl, type, score, quality) => {
        const cleaned = decodeHtmlEntities(String(rawUrl || "").trim()).replace(/\\\//g, "/");
        if (!isSafeResolvedThreadsMediaUrl(cleaned)) return;
        const key = `${type}:${cleaned}`;
        if (seen.has(key)) return;
        seen.add(key);
        downloads.push({
            url: cleaned,
            type,
            quality,
            score,
            source: "threadsdownloader-fallback"
        });
    };

    for (const item of medias) {
        if (Array.isArray(item?.videos)) {
            const vids = [...item.videos].sort(
                (a, b) => (a?.type === 101 ? -1 : 0) - (b?.type === 101 ? -1 : 0)
            );
            vids.forEach(v => push(v?.url, "video", v?.type === 101 ? 1080 : 720, "HD"));
        }
        if (Array.isArray(item?.images)) {
            const imgs = [...item.images].sort(
                (a, b) => (Number(b?.width) || 0) * (Number(b?.height) || 0) -
                    (Number(a?.width) || 0) * (Number(a?.height) || 0)
            );
            imgs.forEach(img => push(img?.url, "image", 1080, "Original"));
        }
    }

    return {
        title: String(data?.text || "").trim(),
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
        return images.map(item => ({
            ...item,
            needsClientAudioExtract: false
        }));
    }

    if (kind === "audio") {
        const directAudio = audios.map(item => ({
            ...item,
            needsClientAudioExtract: false
        }));
        const videoAudioFallback = [...videos]
            .sort((a, b) => a.score - b.score)
            .map(item => ({
                ...item,
                needsClientAudioExtract: true
            }));
        return [...directAudio, ...videoAudioFallback];
    }

    return videos.map(item => ({
        ...item,
        needsClientAudioExtract: false
    }));
}

export async function resolveThreadsMediaViaDownloader(rawUrl, { kind = "video", turnstileToken = "", fetchImpl = fetch } = {}) {
    const normalizedKind = ["video", "image", "audio"].includes(kind) ? kind : "video";
    const parsedLink = parseThreadsPostLink(rawUrl);

    if (!parsedLink) {
        const err = new Error(
            "URL Threads tidak valid. Gunakan link postingan publik dari threads.com atau threads.net (mis. /@akun/post/... atau /t/...)."
        );
        err.status = 400;
        throw err;
    }

    let imagesOnlyDetected = false;

    /* 1. Coba ThreadsDownloader.com (api-tp.threadsdownloader.com) */
    try {
        const tdResult = await queryThreadsDownloaderCom(parsedLink, {
            turnstileToken,
            fetchImpl
        });
        if (!tdResult.placeholder) {
            if (
                normalizedKind === "video" &&
                tdResult.downloads.some(d => d.type === "image") &&
                !tdResult.downloads.some(d => d.type === "video")
            ) {
                imagesOnlyDetected = true;
            }
            const tdCandidates = buildCandidatesForKind(tdResult, normalizedKind);
            if (tdCandidates.length > 0) {
                return {
                    threadsUrl: parsedLink.canonicalUrl,
                    kind: normalizedKind,
                    title: tdResult.title || "",
                    candidates: tdCandidates
                };
            }
        }
    } catch (error) {
        console.warn("[Threads Media] Permintaan ke threadsdownloader.com gagal, lanjut ke ekstraksi publik:", error?.message || error);
    }

    /* 2. Ekstraksi JSON halaman publik Threads langsung (threads.com/@.../post/...) */
    try {
        const directResult = await fetchThreadsPublicPageMedia(parsedLink, fetchImpl);
        if (
            normalizedKind === "video" &&
            directResult.downloads.some(d => d.type === "image") &&
            !directResult.downloads.some(d => d.type === "video")
        ) {
            imagesOnlyDetected = true;
        }
        const directCandidates = buildCandidatesForKind(directResult, normalizedKind);
        if (directCandidates.length > 0) {
            return {
                threadsUrl: parsedLink.canonicalUrl,
                kind: normalizedKind,
                title: directResult.title || "",
                candidates: directCandidates
            };
        }
    } catch (error) {
        console.warn("[Threads Media] Ekstraksi halaman publik Threads gagal, mencoba fallback HTMX:", error?.message || error);
    }

    /* 3. Fallback independen lewat savethr.com/process & threadsdl.app */
    if (!(imagesOnlyDetected && normalizedKind === "video")) {
        for (const fallbackFn of [fetchSaveThrFallback, fetchThreadsDlAppFallback]) {
            try {
                const fbRes = await fallbackFn(parsedLink, fetchImpl);
                const fbCandidates = buildCandidatesForKind(fbRes, normalizedKind);
                if (fbCandidates.length > 0) {
                    return {
                        threadsUrl: parsedLink.canonicalUrl,
                        kind: normalizedKind,
                        title: fbRes.title || "",
                        candidates: fbCandidates
                    };
                }
            } catch {
                /* lanjut ke fallback berikutnya */
            }
        }
    }

    if (imagesOnlyDetected && normalizedKind === "video") {
        const err = new Error(
            "Link Threads ini berupa postingan foto/gambar (bukan video). Gunakan pada kolom Foto/Gambar Referensi atau tempelkan link video Threads."
        );
        err.status = 422;
        throw err;
    }

    const kindLabel = normalizedKind === "image"
        ? "foto/gambar"
        : normalizedKind === "audio"
            ? "audio/video"
            : "video";

    const err = new Error(
        `Tidak dapat menemukan ${kindLabel} publik dari link Threads tersebut lewat ThreadsDownloader. Pastikan postingan bersifat publik dan tautannya benar.`
    );
    err.status = 422;
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

function buildSafeThreadsFilename(kind, contentType) {
    const stamp = Date.now();
    if (kind === "image") {
        const ext = contentType === "image/png"
            ? "png"
            : contentType === "image/webp"
                ? "webp"
                : "jpg";
        return `threads-photo-${stamp}.${ext}`;
    }
    if (kind === "audio" && contentType.startsWith("audio/")) {
        const ext = contentType.includes("wav")
            ? "wav"
            : contentType.includes("mp4") || contentType.includes("m4a")
                ? "m4a"
                : "mp3";
        return `threads-audio-${stamp}.${ext}`;
    }
    const ext = contentType === "video/webm" ? "webm" : "mp4";
    return `threads-video-${stamp}.${ext}`;
}

function getMaxBytesForCandidate(kind, candidate) {
    if (kind === "image") return THREADS_MEDIA_MAX_BYTES.image;
    if (kind === "audio") {
        return candidate?.needsClientAudioExtract
            ? THREADS_MEDIA_MAX_BYTES.audioVideoContainer
            : THREADS_MEDIA_MAX_BYTES.audio;
    }
    return THREADS_MEDIA_MAX_BYTES.video;
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

async function fetchSingleThreadsCandidateMedia(candidate, kind, fetchImpl = fetch) {
    let currentUrl = candidate.url;
    const maxBytes = getMaxBytesForCandidate(kind, candidate);
    const referer = matchesHostSuffix(new URL(currentUrl).hostname, WRAPPER_HOST_SUFFIXES)
        ? `${SAVETHR_ORIGIN}/`
        : "https://www.threads.com/";

    for (let hop = 0; hop < 6; hop += 1) {
        if (!isSafeResolvedThreadsMediaUrl(currentUrl)) {
            throw new Error("Host unduhan media Threads tidak diizinkan.");
        }

        const response = await fetchImpl(currentUrl, {
            method: "GET",
            headers: {
                "User-Agent": DESKTOP_USER_AGENT,
                "Referer": referer,
                "Accept": ACCEPT_ALL
            },
            redirect: "manual"
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location") || "";
            if (!location) {
                throw new Error("Redirect media Threads kosong.");
            }
            currentUrl = new URL(location, currentUrl).toString();
            continue;
        }

        if (!response.ok) {
            throw new Error(`Server media Threads mengembalikan HTTP ${response.status}.`);
        }

        const rawContentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (rawContentType.includes("text/html") || rawContentType.includes("application/json")) {
            throw new Error("Tautan unduhan Threads mengembalikan halaman HTML, bukan file media.");
        }

        const contentLength = Number(response.headers.get("content-length") || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
            const sizeErr = new Error(
                `Ukuran media (${(contentLength / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`
            );
            sizeErr.status = 413;
            throw sizeErr;
        }

        const needsAudioExtract =
            Boolean(candidate.needsClientAudioExtract) ||
            (kind === "audio" && rawContentType.startsWith("video/"));

        const contentType = normalizeDownloadedContentType(
            rawContentType,
            kind,
            { ...candidate, needsClientAudioExtract: needsAudioExtract }
        );
        const filename = buildSafeThreadsFilename(kind, contentType);

        return {
            body: createSizeLimitedStream(response.body, maxBytes),
            contentType,
            contentLength: contentLength > 0 ? contentLength : null,
            filename,
            source: candidate.source || "threadsdownloader.com",
            quality: candidate.quality || "",
            needsClientAudioExtract: needsAudioExtract
        };
    }

    throw new Error("Terlalu banyak pengalihan (redirect) saat mengunduh media Threads.");
}

export async function downloadResolvedThreadsMedia(candidates, { kind = "video", fetchImpl = fetch } = {}) {
    const list = Array.isArray(candidates) ? candidates : [];
    let lastError = null;

    for (const candidate of list) {
        try {
            return await fetchSingleThreadsCandidateMedia(candidate, kind, fetchImpl);
        } catch (error) {
            lastError = error;
        }
    }

    const err = new Error(
        lastError?.message ||
        "Gagal mengunduh file media Threads dari hasil ThreadsDownloader."
    );
    err.status = lastError?.status || 502;
    throw err;
}
