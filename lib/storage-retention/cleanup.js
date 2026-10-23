/*
 * =========================================================
 * GEN-Z.AI
 * STORAGE RETENTION
 * ---------------------------------------------------------
 * File: lib/storage-retention/cleanup.js
 * ---------------------------------------------------------
 *
 * Aturan penyimpanan media:
 *
 *   1. File yang diunggah user di halaman Generate
 *      (foto / video / audio) hanya dipakai 1 JAM.
 *      Setelah itu file dihapus dari Supabase Storage.
 *
 *   2. Media riwayat (input & output Upscale) disimpan
 *      maksimal 24 JAM. Setelah itu file dihapus dan baris
 *      riwayatnya ditandai "kedaluwarsa" di halaman History.
 *
 * Modul ini sengaja tidak menyimpan kredensial. Pemanggil
 * (cron Cloudflare Worker) membuat API client lewat
 * createStorageApi() dengan service-role key dari env.
 *
 * =========================================================
 */

export const HOUR_MS = 60 * 60 * 1000;

/** Upload di halaman Generate: 1 jam. */
export const UPLOAD_TTL_MS = 1 * HOUR_MS;

/** Media riwayat (upscale input + output): 24 jam. */
export const HISTORY_MEDIA_TTL_MS = 24 * HOUR_MS;

export const MEDIA_BUCKET = "dashboard-videos";
export const UPSCALE_OUTPUT_BUCKET = "dashboard-upscales";

/** Bucket privat untuk semua upload user (input). */
export const USER_UPLOAD_BUCKET = "user-uploads";

/**
 * Prefix yang boleh dibersihkan cron.
 *
 * PENTING: prefix lain di bucket `dashboard-videos`
 * (`videos/`, `thumbnails/`) adalah konten situs yang diunggah
 * admin, BUKAN upload user, jadi tidak pernah disentuh.
 */
export const RETENTION_RULES = Object.freeze([
    /* --- Bucket privat user-uploads (upload baru) --- */
    Object.freeze({
        id: "user-upload-generate-input",
        bucket: USER_UPLOAD_BUCKET,
        prefix: "generate-input",
        ttlMs: UPLOAD_TTL_MS,
        label: "Upload foto/video/audio (Generate, bucket privat)"
    }),
    Object.freeze({
        id: "user-upload-upscale-photo-input",
        bucket: USER_UPLOAD_BUCKET,
        prefix: "upscale-photos",
        ttlMs: HISTORY_MEDIA_TTL_MS,
        label: "Input upscale foto (bucket privat)"
    }),
    Object.freeze({
        id: "user-upload-upscale-video-input",
        bucket: USER_UPLOAD_BUCKET,
        prefix: "upscale-videos",
        ttlMs: HISTORY_MEDIA_TTL_MS,
        label: "Input upscale video (bucket privat)"
    }),

    /* --- Bucket publik lama (path legacy / sisa file) --- */
    Object.freeze({
        id: "generate-input",
        bucket: MEDIA_BUCKET,
        prefix: "generate-input",
        ttlMs: UPLOAD_TTL_MS,
        label: "Upload foto/video/audio (Generate)"
    }),
    Object.freeze({
        id: "generate-inputs-legacy",
        bucket: MEDIA_BUCKET,
        prefix: "generate-inputs",
        ttlMs: UPLOAD_TTL_MS,
        label: "Upload foto/video/audio (prefix lama)"
    }),
    Object.freeze({
        id: "upscale-photo",
        bucket: MEDIA_BUCKET,
        prefix: "upscale-photos",
        ttlMs: HISTORY_MEDIA_TTL_MS,
        label: "Media riwayat upscale foto"
    }),
    Object.freeze({
        id: "upscale-video",
        bucket: MEDIA_BUCKET,
        prefix: "upscale-videos",
        ttlMs: HISTORY_MEDIA_TTL_MS,
        label: "Media riwayat upscale video"
    }),
    Object.freeze({
        id: "upscale-output",
        bucket: UPSCALE_OUTPUT_BUCKET,
        prefix: "outputs",
        ttlMs: HISTORY_MEDIA_TTL_MS,
        label: "Output riwayat upscale video"
    })
]);

const DEFAULT_PAGE_SIZE = 100;
const MAX_DELETE_CHUNK = 100;
const DEFAULT_MAX_DEPTH = 4;

function createError(message, status = 0) {
    const error = new Error(message);
    if (status) error.status = status;
    return error;
}

function trimBaseUrl(url) {
    return String(url || "").trim().replace(/\/+$/, "");
}

function encodeSegment(segment) {
    return encodeURIComponent(segment);
}

export function toTimeMs(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

export function isExpired(createdAt, now, ttlMs) {
    const createdMs = toTimeMs(createdAt);
    const nowMs = now instanceof Date ? now.getTime() : toTimeMs(now);
    const ttl = Number(ttlMs);
    if (!createdMs || !nowMs || !Number.isFinite(ttl) || ttl <= 0) return false;
    return createdMs + ttl <= nowMs;
}

export function isFileEntry(entry) {
    if (!entry) return false;
    return Boolean(entry.id) || Boolean(entry.metadata);
}

export function joinStoragePath(prefix, name) {
    const cleanPrefix = String(prefix || "").replace(/^\/+|\/+$/g, "");
    const cleanName = String(name || "").replace(/^\/+|\/+$/g, "");
    if (!cleanName) return cleanPrefix;
    return cleanPrefix ? `${cleanPrefix}/${cleanName}` : cleanName;
}

export function isPathInsidePrefix(path, prefix) {
    const clean = String(path || "").trim();
    const cleanPrefix = String(prefix || "").replace(/^\/+|\/+$/g, "");
    if (!clean || !cleanPrefix) return false;
    if (clean.includes("..") || clean.includes("\0")) return false;
    return clean === cleanPrefix || clean.startsWith(`${cleanPrefix}/`);
}

export function chunk(items, size) {
    const chunkSize = Math.max(1, Number(size) || 1);
    const result = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        result.push(items.slice(index, index + chunkSize));
    }
    return result;
}

/**
 * API client Supabase Storage memakai service-role key.
 * `fetchImpl` bisa diganti saat test.
 */
export function createStorageApi({ url, serviceRoleKey, fetchImpl } = {}) {
    const baseUrl = trimBaseUrl(url);
    const key = String(serviceRoleKey || "").trim();
    const request = fetchImpl || (typeof fetch === "function" ? fetch : null);

    if (!baseUrl || !key) {
        throw createError("Konfigurasi Supabase Storage server belum lengkap.");
    }

    if (typeof request !== "function") {
        throw createError("Fetch tidak tersedia di runtime ini.");
    }

    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
    };

    async function readError(response) {
        let message = `Supabase Storage HTTP ${response.status}`;
        try {
            const text = await response.text();
            if (text) {
                try {
                    const data = JSON.parse(text);
                    message = String(data?.message || data?.error || message);
                } catch {
                    message = text.slice(0, 300);
                }
            }
        } catch {
            /* ignore */
        }
        return createError(message.slice(0, 500), response.status);
    }

    return {
        async list(bucket, prefix, { limit = DEFAULT_PAGE_SIZE, offset = 0 } = {}) {
            const response = await request(
                `${baseUrl}/storage/v1/object/list/${encodeSegment(bucket)}`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        prefix: String(prefix || ""),
                        limit,
                        offset,
                        sortBy: { column: "created_at", order: "asc" }
                    })
                }
            );
            if (!response.ok) throw await readError(response);
            const data = await response.json().catch(() => []);
            return Array.isArray(data) ? data : [];
        },

        async remove(bucket, prefixes) {
            const list = Array.isArray(prefixes) ? prefixes.filter(Boolean) : [];
            if (!list.length) return { deleted: 0 };

            const response = await request(
                `${baseUrl}/storage/v1/object/${encodeSegment(bucket)}`,
                {
                    method: "DELETE",
                    headers,
                    body: JSON.stringify({ prefixes: list })
                }
            );
            if (!response.ok) throw await readError(response);
            return { deleted: list.length };
        }
    };
}

/**
 * Telusuri prefix secara rekursif (Supabase mengembalikan folder
 * sebagai entri tanpa id) dan kumpulkan file yang sudah kedaluwarsa.
 */
export async function collectExpiredPaths(api, rule, { now = new Date(), pageSize = DEFAULT_PAGE_SIZE, maxDepth = DEFAULT_MAX_DEPTH } = {}) {
    const expired = [];
    const scanned = [];

    async function walk(prefix, depth) {
        let offset = 0;

        while (true) {
            const entries = await api.list(rule.bucket, prefix, { limit: pageSize, offset });
            if (!entries.length) break;

            for (const entry of entries) {
                const name = String(entry?.name || "").trim();
                if (!name) continue;

                if (isFileEntry(entry)) {
                    const path = joinStoragePath(prefix, name);
                    scanned.push(path);
                    if (isExpired(entry.created_at || entry.updated_at, now, rule.ttlMs)) {
                        expired.push(path);
                    }
                    continue;
                }

                if (depth >= maxDepth) continue;
                await walk(joinStoragePath(prefix, name), depth + 1);
            }

            if (entries.length < pageSize) break;
            offset += entries.length;
        }
    }

    await walk(rule.prefix, 1);
    return { expired, scanned };
}

/**
 * Hapus file kedaluwarsa untuk satu rule.
 */
export async function cleanupRule(api, rule, { now = new Date(), dryRun = false, pageSize, maxDepth } = {}) {
    const { expired, scanned } = await collectExpiredPaths(api, rule, { now, pageSize, maxDepth });

    const safePaths = expired.filter(path => isPathInsidePrefix(path, rule.prefix));
    const skipped = expired.length - safePaths.length;

    if (dryRun || !safePaths.length) {
        return {
            id: rule.id,
            bucket: rule.bucket,
            prefix: rule.prefix,
            scanned: scanned.length,
            expired: expired.length,
            deleted: 0,
            skipped,
            failed: 0,
            dryRun: Boolean(dryRun)
        };
    }

    let deleted = 0;
    let failed = 0;

    for (const paths of chunk(safePaths, MAX_DELETE_CHUNK)) {
        try {
            await api.remove(rule.bucket, paths);
            deleted += paths.length;
        } catch (error) {
            failed += paths.length;
            console.error(
                `[Storage Retention] Gagal menghapus ${paths.length} file di ${rule.bucket}/${rule.prefix}:`,
                error?.message || error
            );
        }
    }

    return {
        id: rule.id,
        bucket: rule.bucket,
        prefix: rule.prefix,
        scanned: scanned.length,
        expired: expired.length,
        deleted,
        skipped,
        failed,
        dryRun: false
    };
}

/**
 * Jalankan semua rule retensi.
 */
export async function runStorageCleanup(api, { now = new Date(), rules = RETENTION_RULES, dryRun = false, pageSize, maxDepth } = {}) {
    const startedAt = Date.now();
    const results = [];

    for (const rule of rules) {
        try {
            results.push(await cleanupRule(api, rule, { now, dryRun, pageSize, maxDepth }));
        } catch (error) {
            console.error(
                `[Storage Retention] Rule ${rule.id} gagal:`,
                error?.message || error
            );
            results.push({
                id: rule.id,
                bucket: rule.bucket,
                prefix: rule.prefix,
                scanned: 0,
                expired: 0,
                deleted: 0,
                skipped: 0,
                failed: 0,
                error: String(error?.message || error).slice(0, 300)
            });
        }
    }

    const totals = results.reduce(
        (acc, item) => ({
            scanned: acc.scanned + Number(item.scanned || 0),
            expired: acc.expired + Number(item.expired || 0),
            deleted: acc.deleted + Number(item.deleted || 0),
            failed: acc.failed + Number(item.failed || 0)
        }),
        { scanned: 0, expired: 0, deleted: 0, failed: 0 }
    );

    return {
        ok: true,
        dryRun: Boolean(dryRun),
        durationMs: Date.now() - startedAt,
        totals,
        rules: results
    };
}

/**
 * Cron berjalan tiap menit; pembersihan storage cukup tiap 5 menit
 * supaya tidak membanjiri Supabase Storage API.
 */
export function shouldRunStorageCleanup(date = new Date(), intervalMinutes = 5) {
    const minutes = date instanceof Date ? date.getUTCMinutes() : new Date(date).getUTCMinutes();
    const step = Math.max(1, Number(intervalMinutes) || 1);
    return Number.isFinite(minutes) && minutes % step === 0;
}
