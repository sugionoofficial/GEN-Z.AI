import { parseUserAgent, readNetworkContext } from "../monitoring/health.js";

export const FREE_CREDIT_AMOUNT = 5000;
export const FREE_CREDIT_BANNER_BUCKET = "site-announcements";
export const FREE_CREDIT_BANNER_PREFIX = "free-credit-banner/";

const BANNER_OBJECT_RE = /^free-credit-banner\/[a-z0-9_-]{8,80}\.(?:jpg|jpeg|png|webp|avif)$/i;

export function validateBannerImageUrl(rawUrl, supabaseUrl) {
    const raw = typeof rawUrl === "string" ? rawUrl.trim() : "";
    if (!raw) {
        return { ok: true, url: null, objectPath: null };
    }

    let parsed;
    let base;
    try {
        parsed = new URL(raw);
        base = new URL(String(supabaseUrl || "").trim());
    } catch {
        return {
            ok: false,
            error: "URL gambar banner 16:9 tidak valid."
        };
    }

    const expectedPrefix = `/storage/v1/object/public/${FREE_CREDIT_BANNER_BUCKET}/`;
    if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.origin !== base.origin ||
        !parsed.pathname.startsWith(expectedPrefix)
    ) {
        return {
            ok: false,
            error: "Gambar banner 16:9 harus diunggah melalui fitur upload di halaman Monitoring."
        };
    }

    const objectPath = decodeURIComponent(parsed.pathname.slice(expectedPrefix.length));
    if (!BANNER_OBJECT_RE.test(objectPath) || objectPath.includes("..")) {
        return {
            ok: false,
            error: "Lokasi file gambar banner 16:9 tidak valid."
        };
    }

    return {
        ok: true,
        url: `${parsed.origin}${expectedPrefix}${objectPath}`,
        objectPath
    };
}

const BFP_RE = /^bfp_v1_[0-9a-f]{64}$/i;
const BID_RE = /^bid_v1_[a-z0-9_-]{16,80}$/i;
const BOT_UA_RE = /\b(curl|wget|python-requests|python-urllib|aiohttp|axios|got|undici|node-fetch|postmanruntime|insomnia|go-http-client|okhttp|java\/|libwww-perl|scrapy|headlesschrome|phantomjs|playwright|puppeteer|selenium)\b/i;

function expandIpv6(raw) {
    const clean = String(raw || "").trim().toLowerCase().split("%")[0];
    if (!clean.includes(":")) return null;

    if (clean.startsWith("::ffff:")) {
        const tail = clean.slice(7);
        if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(tail)) {
            return { mappedIpv4: tail };
        }
    }

    const doubleColonParts = clean.split("::");
    if (doubleColonParts.length > 2) return null;

    const parseSide = side =>
        side
            ? side.split(":").filter(Boolean)
            : [];

    const left = parseSide(doubleColonParts[0]);
    const right = doubleColonParts.length === 2 ? parseSide(doubleColonParts[1]) : [];

    // Handle embedded IPv4 in last group if any
    if (right.length > 0 && right[right.length - 1].includes(".")) {
        return null;
    }
    if (left.length > 0 && left[left.length - 1].includes(".")) {
        return null;
    }

    let groups;
    if (doubleColonParts.length === 2) {
        const missing = 8 - (left.length + right.length);
        if (missing < 1) return null;
        groups = [...left, ...Array(missing).fill("0"), ...right];
    } else {
        if (left.length !== 8) return null;
        groups = left;
    }

    if (groups.length !== 8) return null;

    const normalized = [];
    for (const group of groups) {
        if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
        normalized.push(group.padStart(4, "0"));
    }

    return {
        full: normalized.join(":"),
        subnet64: `${normalized.slice(0, 4).join(":")}::/64`
    };
}

export function normalizeIpAndSubnet(rawIp) {
    let text = String(rawIp || "").trim();
    if (!text) return { ip: null, subnet: null };

    // Strip brackets on [::1]:port
    if (text.startsWith("[")) {
        const end = text.indexOf("]");
        if (end > 1) {
            text = text.slice(1, end);
        }
    } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(text)) {
        text = text.split(":")[0];
    }

    if (text.includes(":")) {
        const v6 = expandIpv6(text);
        if (!v6) return { ip: null, subnet: null };
        if (v6.mappedIpv4) {
            text = v6.mappedIpv4;
        } else {
            return { ip: v6.full, subnet: v6.subnet64 };
        }
    }

    const parts = text.split(".");
    if (parts.length !== 4) return { ip: null, subnet: null };

    const octets = [];
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return { ip: null, subnet: null };
        const n = Number(part);
        if (!Number.isInteger(n) || n < 0 || n > 255) {
            return { ip: null, subnet: null };
        }
        octets.push(String(n));
    }

    return { ip: octets.join("."), subnet: null };
}

export function extractClientNetwork(req = {}) {
    const net = readNetworkContext(req);
    const { ip, subnet } = normalizeIpAndSubnet(net.ip);
    const ua = String(net.user_agent || "").trim();
    const parsedUa = parseUserAgent(ua);
    const browserSummary = ua
        ? `${parsedUa.browser} • ${parsedUa.os} • ${parsedUa.device}`
        : null;

    return {
        ip,
        subnet,
        country: net.country || null,
        city: net.city || null,
        userAgent: ua || null,
        parsedUa,
        browserSummary
    };
}

export function validateBrowserSignals({
    browserFingerprint,
    browserInstallId,
    userAgent
} = {}) {
    const ua = String(userAgent || "").trim();
    if (!ua || ua.length < 12 || BOT_UA_RE.test(ua)) {
        return {
            ok: false,
            code: "invalid_browser",
            error: "Browser tidak valid untuk klaim kredit gratis. Gunakan browser resmi di HP atau PC."
        };
    }

    const bfp = String(browserFingerprint || "").trim().toLowerCase();
    const bid = String(browserInstallId || "").trim();

    if (!BFP_RE.test(bfp) || !BID_RE.test(bid)) {
        return {
            ok: false,
            code: "missing_security_signals",
            error: "Identitas keamanan browser belum lengkap. Muat ulang halaman lalu coba kembali."
        };
    }

    return {
        ok: true,
        browserFingerprint: bfp,
        browserInstallId: bid
    };
}

const REASON_LABELS_ID = Object.freeze({
    already_claimed_user: "akun ini",
    duplicate_email: "email",
    duplicate_ip: "alamat IP",
    duplicate_password: "password",
    duplicate_browser: "browser"
});

export function formatMatchedDimensionsId(reasons = []) {
    const labels = [];
    for (const key of Array.isArray(reasons) ? reasons : []) {
        const label = REASON_LABELS_ID[key];
        if (label && !labels.includes(label)) {
            labels.push(label);
        }
    }
    if (labels.length === 0) return "";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} dan ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")}, dan ${labels[labels.length - 1]}`;
}

export function mapClaimErrorResponse(code, matchedReasons = []) {
    const normalized = String(code || "").trim();

    if (normalized === "feature_disabled") {
        return {
            status: 403,
            message: "Program Klaim Free Credit 5.000 Gratis sedang dinonaktifkan sementara."
        };
    }

    if (normalized === "already_claimed_user") {
        return {
            status: 409,
            message: "Akun ini sudah pernah mengklaim Free Credit 5.000 Gratis (hanya berlaku 1 kali)."
        };
    }

    if (
        normalized === "duplicate_email" ||
        normalized === "duplicate_ip" ||
        normalized === "duplicate_password" ||
        normalized === "duplicate_browser"
    ) {
        const dims = formatMatchedDimensionsId(
            matchedReasons.length ? matchedReasons : [normalized]
        );
        return {
            status: 409,
            message:
                `Maaf, Anda tidak dapat mengklaim Free Credit 5.000 Gratis karena terdeteksi kesamaan ${dims} dengan klaim sebelumnya. Setiap email, IP, password, dan browser hanya bisa klaim 1 kali.`
        };
    }

    if (normalized === "password_required") {
        return {
            status: 428,
            requiresPassword: true,
            message: "Masukkan password akun Anda satu kali untuk memverifikasi keunikan klaim 5.000 Credit Gratis."
        };
    }

    if (normalized === "invalid_password") {
        return {
            status: 401,
            requiresPassword: true,
            message: "Password yang dimasukkan tidak sesuai dengan password akun Anda."
        };
    }

    if (normalized === "unverified_email") {
        return {
            status: 403,
            message: "Silakan verifikasi email akun Anda terlebih dahulu sebelum mengklaim Free Credit 5.000 Gratis."
        };
    }

    if (normalized === "account_inactive" || normalized === "account_ineligible") {
        return {
            status: 403,
            message: "Akun ini tidak memenuhi syarat untuk mengklaim Free Credit 5.000 Gratis."
        };
    }

    if (normalized === "missing_security_signals") {
        return {
            status: 400,
            message: "Data verifikasi IP atau browser tidak lengkap. Matikan proxy/ekstensi pemblokir lalu muat ulang halaman."
        };
    }

    return {
        status: 400,
        message: "Gagal memproses klaim Free Credit 5.000 Gratis. Silakan coba beberapa saat lagi."
    };
}
