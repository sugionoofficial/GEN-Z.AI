/* ---------------------------------------------------------
   GEN-Z.AI
   SOCIAL PUBLISHER API FAILURE SHAPE
   ---------------------------------------------------------
   File: lib/social-publisher/api-error.js

   Handler API Social Publisher selalu membalas JSON, tetapi satu jalur pernah
   menghasilkan `{"success":false}` tanpa `error` karena `error.message`
   kosong/undefined (mis. objek error dari binding AI yang dilempar tanpa
   pesan). Klien lalu hanya bisa menampilkan "Permintaan gagal (HTTP 503)".

   Modul ini memastikan setiap kegagalan punya pesan yang bisa ditindaklanjuti
   dan detail yang layak dicatat di log.
   --------------------------------------------------------- */

const STATUS_FALLBACK_MESSAGE = {
    400: "Permintaan tidak valid. Periksa kembali pilihan pada formulir.",
    401: "Sesi login tidak valid. Silakan login ulang.",
    403: "Akun ini tidak memiliki akses ke tindakan tersebut.",
    404: "Data yang diminta tidak ditemukan.",
    409: "Permintaan bertentangan dengan kondisi data saat ini. Muat ulang halaman lalu coba lagi.",
    429: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",
    502: "Provider gambar/caption gagal merespons. Coba lagi sebentar lagi.",
    503: "Server sedang tidak tersedia — biasanya karena deploy baru atau lonjakan beban. Tunggu sekitar 1 menit lalu coba lagi.",
    504: "Server tidak menyelesaikan permintaan tepat waktu. Coba lagi sebentar lagi."
};

export function fallbackMessageForStatus(status) {
    const code = Number(status) || 500;
    return STATUS_FALLBACK_MESSAGE[code] || `Terjadi kesalahan internal (HTTP ${code}). Coba lagi; bila berulang, kirim kode ini ke admin.`;
}

/**
 * Bentuk payload error yang selalu berisi pesan tidak kosong.
 * @returns {{ status: number, message: string, missingMessage: boolean }}
 */
export function describeApiFailure(error, fallbackStatus = 500) {
    const status = Number(error?.status) || fallbackStatus;
    const message = (typeof error === "string" ? error : String(error?.message ?? "")).trim();
    if (message) return { status, message, missingMessage: false };
    return { status, message: fallbackMessageForStatus(status), missingMessage: true };
}

/**
 * Detail error untuk `console.error`. Error tanpa pesan tetap meninggalkan
 * jejak (kode, tipe, dan isi objeknya).
 */
export function loggableErrorDetails(error) {
    if (error instanceof Error) {
        return { name: error.name, message: error.message, status: error.status || 0, code: error.code || "" };
    }
    if (error && typeof error === "object") {
        try {
            return { name: error.name || "object", raw: JSON.stringify(error).slice(0, 500) };
        } catch {
            return { name: error.name || "object", raw: String(error).slice(0, 500) };
        }
    }
    return { name: typeof error, raw: String(error ?? "").slice(0, 500) };
}
