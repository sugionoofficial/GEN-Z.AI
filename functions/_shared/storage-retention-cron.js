import {
    RETENTION_RULES,
    createStorageApi,
    runStorageCleanup,
    shouldRunStorageCleanup
} from "../../lib/storage-retention/cleanup.js";

function value(env, key) {
    const processValue = typeof process !== "undefined" ? process.env?.[key] : "";
    return String(env?.[key] || processValue || "").trim();
}

/**
 * Cron pembersihan media GEN-Z.AI.
 *
 * - Upload foto/video/audio di halaman Generate: dihapus setelah 1 jam.
 * - Media riwayat (input & output Upscale): dihapus setelah 24 jam.
 *
 * Dijalankan dari scheduled() Cloudflare Worker setiap 5 menit.
 */
export async function runStorageRetentionCron(env, now = new Date(), options = {}) {
    const url = value(env, "SUPABASE_URL");
    const serviceRoleKey = value(env, "SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceRoleKey) {
        console.warn("[Storage Retention] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset; cron dilewati.");
        return { ok: false, skipped: true, reason: "missing_credentials" };
    }

    if (options.force !== true && shouldRunStorageCleanup(now, options.intervalMinutes || 5) === false) {
        return { ok: true, skipped: true, reason: "interval" };
    }

    const api = createStorageApi({
        url,
        serviceRoleKey,
        fetchImpl: options.fetchImpl
    });

    const summary = await runStorageCleanup(api, {
        now,
        rules: options.rules || RETENTION_RULES,
        dryRun: options.dryRun === true
    });

    if (summary.totals.deleted > 0 || summary.totals.failed > 0) {
        console.log(
            `[Storage Retention] ${summary.totals.deleted} file dihapus, ${summary.totals.failed} gagal, ` +
            `${summary.totals.scanned} file dipindai (${summary.durationMs} ms).`
        );
    }

    return summary;
}
