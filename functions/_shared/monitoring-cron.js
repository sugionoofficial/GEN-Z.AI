/*
 * =========================================================
 * GEN-Z.AI
 * BLACK BOX // MONITORING CRON
 * ---------------------------------------------------------
 * File: functions/_shared/monitoring-cron.js
 * ---------------------------------------------------------
 * Berjalan dari trigger cron Worker (setiap menit). Pemeriksaan
 * hanya benar-benar dijalankan bila sudah lewat interval yang
 * diatur di `monitoring_settings.scan_interval_minutes`, jadi
 * tidak membebani situs pada tiap menit.
 * =========================================================
 */

import {
    fetchSettings,
    getMonitoringConfig,
    isConfigured,
    pruneEventOverflow,
    pruneOldEvents,
    runMonitoringScan
} from "../../lib/monitoring/health.js";

export async function runMonitoringCron(env, scheduledTime = new Date()) {
    const config = getMonitoringConfig(env);

    if (!isConfigured(config)) {
        return { skipped: true, reason: "supabase_not_configured" };
    }

    const settings = await fetchSettings(config).catch(() => null);
    if (!settings) {
        return { skipped: true, reason: "monitoring_settings_missing" };
    }

    const now = new Date(scheduledTime).getTime();
    const intervalMs = Math.max(1, Number(settings.scan_interval_minutes) || 15) * 60 * 1000;
    const lastScan = settings.last_scan_at ? Date.parse(settings.last_scan_at) : 0;

    /*
     * Batas jumlah log ditegakkan SETIAP menit, bukan hanya saat pemeriksaan
     * penuh jatuh tempo — supaya tabel monitoring_events tidak pernah
     * menyimpan jauh lebih dari `max_events` baris.
     */
    const pruned = await pruneEventOverflow(config, settings.max_events || 500);

    if (lastScan && Number.isFinite(lastScan) && now - lastScan < intervalMs) {
        return { skipped: true, reason: "not_due", next_in_ms: intervalMs - (now - lastScan), pruned };
    }

    /* Retensi dijalankan bersamaan dengan pemeriksaan (paling sering
       sekali per interval), jadi tabel tidak tumbuh tanpa batas. */
    await pruneOldEvents(config, settings.retention_days || 30).catch(error => {
        console.warn("[Monitoring] Prune log dilewati:", error?.message || "unknown error");
    });

    const assetsFetch = env?.ASSETS && typeof env.ASSETS.fetch === "function"
        ? env.ASSETS.fetch.bind(env.ASSETS)
        : null;

    const { checks, findings } = await runMonitoringScan(config, { settings, now, assetsFetch });

    const failed = checks.filter(check => check.status === "fail").length;
    const warned = checks.filter(check => check.status === "warn").length;

    console.log(
        `[Monitoring] Pemeriksaan selesai: ${checks.length} target, ${failed} gagal, ${warned} peringatan, ${findings.length} temuan.`
    );

    return { skipped: false, checks: checks.length, failed, warned, findings: findings.length, pruned };
}
