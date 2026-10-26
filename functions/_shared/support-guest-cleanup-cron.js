import {
    GUEST_CLEANUP_INTERVAL_MINUTES,
    createGuestCleanupApi,
    runGuestCleanup,
    shouldRunGuestCleanup
} from "../../lib/support-chat/guest-cleanup.js";

function value(env, key) {
    const processValue = typeof process !== "undefined" ? process.env?.[key] : "";
    return String(env?.[key] || processValue || "").trim();
}

/**
 * Cron pembersihan akun tamu live chat.
 *
 * Live chat memakai Supabase anonymous sign-in, yang membuat baris
 * nyata di auth.users tanpa profil. Cron ini menghapus akun tamu yang
 * tidak punya percakapan atau sudah 7 hari tidak aktif, tanpa pernah
 * menyentuh akun pendaftar asli.
 *
 * Dijalankan dari scheduled() Cloudflare Worker (tiap 5 menit), tetapi
 * benar-benar bekerja sekali per jam.
 */
export async function runSupportGuestCleanupCron(env, now = new Date(), options = {}) {
    const url = value(env, "SUPABASE_URL");
    const serviceRoleKey = value(env, "SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceRoleKey) {
        console.warn("[Support Guest Cleanup] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset; cron dilewati.");
        return { ok: false, skipped: true, reason: "missing_credentials" };
    }

    const intervalMinutes = options.intervalMinutes || GUEST_CLEANUP_INTERVAL_MINUTES;

    if (options.force !== true && shouldRunGuestCleanup(now, intervalMinutes) === false) {
        return { ok: true, skipped: true, reason: "interval" };
    }

    const api = createGuestCleanupApi({
        url,
        serviceRoleKey,
        fetchImpl: options.fetchImpl
    });

    const summary = await runGuestCleanup(api, {
        now,
        dryRun: options.dryRun === true,
        maxDeletions: options.maxDeletions,
        graceMs: options.graceMs,
        idleMs: options.idleMs
    });

    if (summary.deleted > 0 || summary.failed.length > 0) {
        console.log(
            `[Support Guest Cleanup] ${summary.deleted} akun tamu dihapus, ` +
                `${summary.failed.length} gagal, ${summary.scanned} akun tamu dipindai.`
        );
    }

    return summary;
}
