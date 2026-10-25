/* ---------------------------------------------------------
   GEN-Z.AI
   HTTP FAILURE DESCRIPTION
   ---------------------------------------------------------
   File: admin-control/assets/js/http-failure.js

   Halaman admin sebelumnya hanya menampilkan "Permintaan gagal (HTTP 503)"
   ketika server membalas tanpa JSON. Pesan itu tidak memberi tahu apa pun:
   tidak jelas apakah deploy sedang berjalan, server kelebihan beban, atau ada
   bug. Modul ini membaca isi respons sekali lalu menyusun pesan yang bisa
   ditindaklanjuti, dan menandai kegagalan tingkat platform (502/503/504 tanpa
   JSON) supaya pemanggil boleh mencoba ulang.

   Dipakai sebagai modul ESM oleh social-publisher.js dan lewat
   `window.GENZHttpFailure` oleh halaman yang masih memakai script klasik.
   --------------------------------------------------------- */

const PLATFORM_STATUSES = [502, 503, 504];

function looksLikeJson(text) {
    return /^\s*[[{]/.test(text);
}

/**
 * Ambil pesan `error` dari body JSON, bila ada.
 */
export function readJsonError(bodyText) {
    const text = String(bodyText ?? "").trim();
    if (!text || !looksLikeJson(text)) return "";
    try {
        const parsed = JSON.parse(text);
        return String(parsed?.error ?? "").trim();
    } catch {
        return "";
    }
}

/**
 * Ringkas body non-JSON (biasanya halaman error Cloudflare) jadi satu baris.
 */
export function summarizeBody(bodyText, limit = 160) {
    return String(bodyText ?? "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
}

/**
 * True bila kegagalan berasal dari lapisan platform (bukan aplikasi kita),
 * artinya permintaan belum pernah diproses aplikasi dan aman diulang.
 */
export function isPlatformFailure(status, bodyText) {
    if (!PLATFORM_STATUSES.includes(Number(status))) return false;
    const text = String(bodyText ?? "").trim();
    if (looksLikeJson(text) && readJsonError(text)) return false;
    return true;
}

/**
 * Pesan gagal yang menyebutkan status, penyebab yang paling mungkin, dan
 * potongan isi respons supaya pengguna tidak menebak-nebak.
 */
export function describeHttpFailure(status, bodyText) {
    const code = Number(status) || 0;
    const jsonError = readJsonError(bodyText);
    if (jsonError) return jsonError;

    const hint = code === 503
        ? "Server sedang tidak tersedia — biasanya karena deploy baru atau lonjakan beban. Tunggu sekitar 1 menit lalu coba lagi."
        : code === 502 || code === 504
            ? "Server tidak menyelesaikan permintaan tepat waktu. Coba lagi sebentar lagi."
            : code === 0
                ? "Koneksi ke server terputus. Periksa jaringan lalu coba lagi."
                : "";
    const detail = summarizeBody(bodyText);
    const usefulDetail = detail && !/^internal server error$/i.test(detail) ? ` Detail: ${detail}` : "";

    return [`Permintaan gagal (HTTP ${code || "?"}).`, hint, usefulDetail].filter(Boolean).join(" ");
}

if (typeof window !== "undefined") {
    window.GENZHttpFailure = { describeHttpFailure, isPlatformFailure, readJsonError, summarizeBody };
}
