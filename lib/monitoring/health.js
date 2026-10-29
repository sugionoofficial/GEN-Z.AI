/*
 * =========================================================
 * GEN-Z.AI
 * BLACK BOX // MONITORING — LOGIKA INTI
 * ---------------------------------------------------------
 * File: lib/monitoring/health.js
 * ---------------------------------------------------------
 * Dipakai oleh dua tempat sekaligus supaya hasilnya konsisten:
 *   - api/monitoring.js            (tombol "Periksa sekarang")
 *   - functions/_shared/monitoring-cron.js (pemeriksaan terjadwal)
 *
 * Isi:
 *   1. Konfigurasi & helper request Supabase
 *   2. Pemeriksaan kesehatan (web, api, database, auth, storage,
 *      cron, social publisher)
 *   3. Aturan temuan bug + "cara mengatasinya"
 *   4. Normalisasi event dari beacon browser
 * =========================================================
 */

export const HEALTH_TARGET_LABEL = Object.freeze({
    web: "Situs web",
    api: "API Worker",
    database: "Database",
    auth: "Autentikasi",
    storage: "Storage media",
    cron: "Cron pemeriksaan",
    "social-publisher": "Studio Medsos"
});

export const DEFAULT_SITE_URL = "https://genzai.genzai-f37.workers.dev";

const CHECK_TIMEOUT_MS = 6000;

/* ---------------------------------------------------------
   KONFIGURASI
   --------------------------------------------------------- */

export function getMonitoringConfig(env = {}) {
    const read = name =>
        String(
            env?.[name] ||
            (typeof process !== "undefined" ? process.env?.[name] : "") ||
            ""
        ).trim();

    return {
        supabaseUrl: read("SUPABASE_URL").replace(/\/+$/, ""),
        serviceKey: read("SUPABASE_SERVICE_ROLE_KEY"),
        siteUrl: (read("MONITORING_SITE_URL") || read("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "")
    };
}

export function isConfigured(config) {
    return Boolean(config?.supabaseUrl && config?.serviceKey);
}

export async function dbRequest(config, path, options = {}, fetchImpl = fetch) {
    if (!isConfigured(config)) {
        throw new Error("Konfigurasi Supabase server belum lengkap.");
    }

    const response = await fetchImpl(`${config.supabaseUrl}/rest/v1${path}`, {
        ...options,
        headers: {
            apikey: config.serviceKey,
            Authorization: `Bearer ${config.serviceKey}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const message = String(
            (data && (data.message || data.error || data.hint)) ||
            `HTTP ${response.status}`
        );
        const error = new Error(message);
        error.status = response.status;
        error.code = data?.code || "";
        throw error;
    }

    return data;
}

/* ---------------------------------------------------------
   USER AGENT → device / browser / os
   Ditampilkan di tabel akses supaya admin tahu perangkatnya.
   --------------------------------------------------------- */

export function parseUserAgent(value) {
    const ua = String(value || "");
    const lower = ua.toLowerCase();

    let device = "desktop";
    if (/ipad|tablet|playbook|silk/.test(lower) || (/android/.test(lower) && !/mobile/.test(lower))) {
        device = "tablet";
    } else if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(lower)) {
        device = "mobile";
    }

    let browser = "lainnya";
    if (/edg\//.test(lower)) browser = "Edge";
    else if (/opr\/|opera/.test(lower)) browser = "Opera";
    else if (/chrome\/|crios\//.test(lower)) browser = "Chrome";
    else if (/firefox\/|fxios\//.test(lower)) browser = "Firefox";
    else if (/safari\//.test(lower)) browser = "Safari";
    else if (/curl|wget|python|node|axios|okhttp/.test(lower)) browser = "bot/script";

    let os = "lainnya";
    if (/windows nt/.test(lower)) os = "Windows";
    else if (/android/.test(lower)) os = "Android";
    else if (/iphone|ipad|ipod|ios/.test(lower)) os = "iOS";
    else if (/mac os x|macintosh/.test(lower)) os = "macOS";
    else if (/linux/.test(lower)) os = "Linux";

    return { device, browser, os };
}

/* ---------------------------------------------------------
   NORMALISASI PAYLOAD BEACON
   Browser tidak boleh menentukan IP/lokasi — itu diisi server
   dari header Cloudflare. Di sini kita hanya memvalidasi dan
   memotong panjang teks agar tabel tidak bisa dibanjiri.
   --------------------------------------------------------- */

const ALLOWED_KINDS = new Set([
    "activity",
    "page_view",
    "error",
    "devtools",
    "security",
    "api_failure",
    "worker"
]);

const ALLOWED_SEVERITY = new Set(["info", "warn", "error", "critical"]);

/* Dipakai untuk memastikan user_id dari beacon memang UUID. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeUserId(value) {
    const text = String(value || "").trim();
    return UUID_RE.test(text) ? text.toLowerCase() : null;
}

function clip(value, max) {
    const text = String(value ?? "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function normalizePath(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    /* Buang query string: bisa berisi token/email yang tidak perlu disimpan. */
    const withoutQuery = raw.split("#")[0].split("?")[0];
    if (!withoutQuery.startsWith("/")) return null;
    return clip(withoutQuery, 200);
}

export function normalizeEventInput(raw = {}) {
    const kind = ALLOWED_KINDS.has(String(raw.kind)) ? String(raw.kind) : "activity";
    const severity = ALLOWED_SEVERITY.has(String(raw.severity))
        ? String(raw.severity)
        : kind === "error" || kind === "api_failure"
            ? "error"
            : kind === "devtools"
                ? "warn"
                : "info";

    const detail = raw.detail;

    return {
        kind,
        severity,
        source: raw.source === "worker" ? "worker" : "web",
        path: normalizePath(raw.path),
        message: clip(raw.message, 500) || null,
        detail: detail && typeof detail === "object" && !Array.isArray(detail)
            ? JSON.parse(clip(JSON.stringify(detail), 2000))
            : {},
        session_id: clip(raw.session_id, 80) || null,
        /* UUID akun yang sedang login menurut browser. Dipakai untuk
           menampilkan email di detail log; tidak memberi hak apa pun. */
        user_id: normalizeUserId(raw.user_id),
        /* Event bertipe devtools otomatis dianggap DevTools terbuka. */
        devtools_open: raw.devtools_open === true || kind === "devtools",
        user_agent: clip(raw.user_agent, 400) || null
    };
}

/* ---------------------------------------------------------
   KONTEKS JARINGAN DARI CLOUDFLARE
   Cloudflare menaruh `request.cf` (kota, negara, ASN, colo) dan
   header cf-connecting-ip. Semua ini TIDAK bisa dipalsukan dari
   browser, jadi aman dipakai sebagai sumber kebenaran.
   --------------------------------------------------------- */

export function readNetworkContext(req = {}) {
    const headers = req.headers || {};
    const cf = req.cf || {};

    const header = name =>
        String(
            headers[name] ||
            headers[name.toLowerCase()] ||
            ""
        ).trim();

    const ip =
        header("cf-connecting-ip") ||
        header("x-real-ip") ||
        (header("x-forwarded-for").split(",")[0] || "").trim() ||
        "";

    const city = String(cf.city || "").trim();
    const region = String(cf.region || "").trim();
    const country = String(cf.country || header("cf-ipcountry") || "").trim();

    return {
        ip: ip || null,
        country: country || null,
        region: region || null,
        city: city || null,
        asn: cf.asn ? `AS${cf.asn}` : null,
        colo: String(cf.colo || "").trim() || null,
        user_agent: header("user-agent") || null
    };
}

/* ---------------------------------------------------------
   PEMERIKSAAN KESEHATAN
   --------------------------------------------------------- */

function statusFromHttp(status) {
    if (!status) return "fail";
    if (status >= 500) return "fail";
    if (status >= 400) return "warn";
    return "ok";
}

async function timed(fetchImpl, url, options) {
    const started = Date.now();
    try {
        const response = await fetchImpl(url, {
            ...options,
            signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout
                ? AbortSignal.timeout(CHECK_TIMEOUT_MS)
                : undefined
        });
        return { response, latency: Date.now() - started };
    } catch (error) {
        return { error, latency: Date.now() - started };
    }
}

function networkDetail(error) {
    return {
        message: `Tidak bisa dihubungi: ${clip(error?.message || "unknown error", 160)}`,
        hint: "Cek DNS/domain, status deploy Worker, dan kuota Cloudflare."
    };
}

async function checkWeb(config, fetchImpl) {
    const { response, latency, error } = await timed(fetchImpl, `${config.siteUrl}/index.html`, {
        method: "GET",
        headers: { "cache-control": "no-cache" }
    });

    if (error) return { target: "web", status: "fail", latency_ms: latency, detail: networkDetail(error) };

    const status = statusFromHttp(response.status);
    return {
        target: "web",
        status,
        latency_ms: latency,
        detail: {
            status_code: response.status,
            message: status === "ok"
                ? `Halaman utama merespons ${response.status}.`
                : `Halaman utama mengembalikan ${response.status}.`,
            hint: status === "ok" ? "" : "Periksa hasil deploy terakhir dan file dist/."
        }
    };
}

async function checkApi(config, fetchImpl) {
    const { response, latency, error } = await timed(fetchImpl, `${config.siteUrl}/api/announcements?action=list`, {
        method: "GET"
    });

    if (error) return { target: "api", status: "fail", latency_ms: latency, detail: networkDetail(error) };

    /* 401 tetap berarti Worker hidup — yang penting bukan 5xx. */
    const status = statusFromHttp(response.status);
    return {
        target: "api",
        status,
        latency_ms: latency,
        detail: {
            status_code: response.status,
            message: status === "ok"
                ? `Endpoint API merespons ${response.status}.`
                : `Endpoint API mengembalikan ${response.status}.`,
            hint: status === "ok" ? "" : "Periksa log Worker (wrangler tail) dan variabel environment."
        }
    };
}

async function checkSupabaseService(config, fetchImpl, target, url, options = {}) {
    const { response, latency, error } = await timed(fetchImpl, url, options);

    if (error) return { target, status: "fail", latency_ms: latency, detail: networkDetail(error) };

    const status = statusFromHttp(response.status);
    return {
        target,
        status,
        latency_ms: latency,
        detail: {
            status_code: response.status,
            message: status === "ok"
                ? `Layanan merespons ${response.status}.`
                : `Layanan mengembalikan ${response.status}.`,
            hint: status === "ok" ? "" : "Cek dashboard Supabase: status project, kuota, dan kunci service role."
        }
    };
}

function checkCron(settings, now) {
    const last = settings?.last_scan_at ? new Date(settings.last_scan_at).getTime() : 0;
    const intervalMs = Math.max(1, Number(settings?.scan_interval_minutes) || 15) * 60 * 1000;

    if (!last) {
        return {
            target: "cron",
            status: "warn",
            latency_ms: 0,
            detail: {
                message: "Pemeriksaan terjadwal belum pernah berjalan.",
                hint: "Buka halaman MONITORING lalu tekan \"Periksa sekarang\", atau tunggu cron menit berikutnya."
            }
        };
    }

    const age = now - last;
    const status = age > intervalMs * 3 ? "fail" : age > intervalMs * 2 ? "warn" : "ok";

    return {
        target: "cron",
        status,
        latency_ms: Math.max(0, age),
        detail: {
            last_scan_at: new Date(last).toISOString(),
            age_minutes: Math.round(age / 60000),
            interval_minutes: Math.round(intervalMs / 60000),
            message: status === "ok"
                ? `Pemeriksaan terakhir ${Math.round(age / 60000)} menit lalu.`
                : "Pemeriksaan terjadwal terlambat dari interval yang diatur.",
            hint: status === "ok" ? "" : "Pastikan trigger cron Worker aktif (wrangler.toml → [triggers])."
        }
    };
}

async function checkSocialPublisher(config, fetchImpl) {
    let rows;
    try {
        rows = await dbRequest(
            config,
            "/social_post_runs?select=status,created_at,scheduled_for&order=created_at.desc&limit=30",
            { method: "GET" },
            fetchImpl
        );
    } catch (error) {
        return {
            target: "social-publisher",
            status: "warn",
            latency_ms: 0,
            detail: {
                message: `Riwayat autopost tidak terbaca: ${clip(error?.message, 140)}`,
                hint: "Pastikan tabel social_post_runs ada (jalankan supabase/social-auto-publisher.sql)."
            }
        };
    }

    const list = Array.isArray(rows) ? rows : [];
    const hanging = list.filter(row => row.status === "queued" || row.status === "generating").length;
    const lastPosted = list.find(row => row.status === "posted");

    const status = hanging > 0 ? "warn" : "ok";

    return {
        target: "social-publisher",
        status,
        latency_ms: 0,
        detail: {
            runs_checked: list.length,
            hanging_runs: hanging,
            last_posted_at: lastPosted?.scheduled_for || lastPosted?.created_at || null,
            message: hanging > 0
                ? `${hanging} run autopost masih menggantung.`
                : "Tidak ada run autopost yang menggantung.",
            hint: hanging > 0
                ? "Buka Studio Medsos → Cek kesehatan autopost, lalu batalkan run yang macet."
                : ""
        }
    };
}

export async function runHealthChecks(config, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const now = options.now ? new Date(options.now).getTime() : Date.now();
    const settings = options.settings || null;

    const results = await Promise.all([
        checkWeb(config, fetchImpl),
        checkApi(config, fetchImpl),
        checkSupabaseService(
            config,
            fetchImpl,
            "database",
            `${config.supabaseUrl}/rest/v1/monitoring_settings?select=id&limit=1`,
            {
                method: "GET",
                headers: {
                    apikey: config.serviceKey,
                    Authorization: `Bearer ${config.serviceKey}`
                }
            }
        ),
        checkSupabaseService(
            config,
            fetchImpl,
            "auth",
            `${config.supabaseUrl}/auth/v1/health`,
            { method: "GET", headers: { apikey: config.serviceKey } }
        ),
        checkSupabaseService(
            config,
            fetchImpl,
            "storage",
            `${config.supabaseUrl}/storage/v1/bucket`,
            {
                method: "GET",
                headers: {
                    apikey: config.serviceKey,
                    Authorization: `Bearer ${config.serviceKey}`
                }
            }
        ),
        checkSocialPublisher(config, fetchImpl)
    ]);

    results.push(checkCron(settings, now));

    return results.map(result => ({
        ...result,
        label: HEALTH_TARGET_LABEL[result.target] || result.target,
        checked_at: new Date(now).toISOString()
    }));
}

/* ---------------------------------------------------------
   CARA MENGATASI (ditampilkan apa adanya di kartu temuan)
   --------------------------------------------------------- */

export const REMEDIATION = Object.freeze({
    "health:web":
        "Jalankan `npm run build` lalu `npx wrangler deploy`. Kalau tetap gagal, cek Assets binding `ASSETS` di wrangler.toml dan pastikan folder dist/ terisi.",
    "health:api":
        "Buka Cloudflare → Workers → genzai → Logs (atau `npx wrangler tail`). Cari error terakhir, lalu pastikan variabel SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY masih terpasang.",
    "health:database":
        "Buka dashboard Supabase → Project status. Kalau project pause karena kuota, restore dulu. Setelah hidup, jalankan ulang migrasi `supabase/monitoring-blackbox.sql`.",
    "health:auth":
        "Cek Supabase → Authentication → Providers/URL Configuration. Pastikan Site URL produksi terdaftar dan kunci anon masih sama dengan assets/js/config.js.",
    "health:storage":
        "Cek Supabase → Storage: bucket `user-media` / `social-character-references` harus ada dan policy-nya tidak dikunci total. Kalau penuh, jalankan retensi (STORAGE-RETENTION.md).",
    "health:cron":
        "Pastikan `[triggers] crons = [\"* * * * *\"]` ada di wrangler.toml dan Worker sudah di-deploy ulang. Cron berhenti otomatis bila deploy terakhir gagal.",
    "health:social-publisher":
        "Buka Studio Medsos → \"Cek kesehatan autopost\". Batalkan run yang menggantung, lalu cek token halaman Facebook (koneksi ulang bila kedaluwarsa).",
    devtools:
        "Kalau yang membuka DevTools adalah kamu sendiri, tandai temuan ini \"Diketahui\". Kalau bukan: ganti kata sandi akun tersebut, keluarkan sesi lain di Supabase → Authentication → Sessions, lalu putar ulang kunci yang pernah terekspos.",
    "client-error":
        "Buka detail temuan untuk melihat pesan error dan halaman asalnya. Perbaiki modul yang error, lalu deploy ulang dan tekan \"Periksa sekarang\" untuk memastikan temuan tertutup.",
    "api-failure":
        "Cek log Worker pada jam kejadian. Kegagalan 5xx berulang biasanya berasal dari provider AI (kuota/kunci) atau Supabase yang menolak request.",
    "security":
        "Periksa daftar IP di tabel akses. Bila ada pola mencurigakan, blokir IP tersebut di Cloudflare → Security → WAF, lalu putar ulang kunci API yang terlibat."
});

/* ---------------------------------------------------------
   TEMUAN BUG
   Fingerprint dipakai supaya temuan yang sama tidak menumpuk
   jadi ratusan baris setiap kali pemeriksaan berjalan.
   --------------------------------------------------------- */

const SEVERITY_ORDER = { info: 0, warn: 1, error: 2, critical: 3 };

export function highestSeverity(list) {
    return list.reduce(
        (worst, item) => (SEVERITY_ORDER[item] > SEVERITY_ORDER[worst] ? item : worst),
        "info"
    );
}

export function buildFindings({ checks = [], events = [], settings = null } = {}) {
    const findings = [];

    for (const check of checks) {
        if (check.status === "ok") continue;
        findings.push({
            fingerprint: `health:${check.target}`,
            title: `${check.label || check.target} bermasalah`,
            category: "health",
            severity: check.status === "fail" ? "critical" : "warn",
            description: check.detail?.message || "Pemeriksaan melaporkan status tidak normal.",
            remediation: REMEDIATION[`health:${check.target}`] || "Periksa komponen terkait lalu jalankan pemeriksaan ulang.",
            evidence: { status: check.status, status_code: check.detail?.status_code ?? null, hint: check.detail?.hint || "" }
        });
    }

    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const recent = events.filter(event => {
        const time = new Date(event.occurred_at || event.created_at || Date.now()).getTime();
        return Number.isFinite(time) ? time >= dayAgo : true;
    });

    /* DevTools: satu temuan agregat, bukan satu per kejadian. */
    const devtools = recent.filter(event => event.devtools_open || event.kind === "devtools");
    if (devtools.length > 0 && settings?.devtools_alerts !== false) {
        const uniqueIps = [...new Set(devtools.map(event => event.ip).filter(Boolean))];
        findings.push({
            fingerprint: "devtools:open",
            title: "Ada akses dengan DevTools terbuka",
            category: "security",
            severity: "warn",
            description: `${devtools.length} kejadian dalam 24 jam terakhir dari ${uniqueIps.length || "beberapa"} IP.`,
            remediation: REMEDIATION.devtools,
            evidence: { events: devtools.length, ips: uniqueIps.slice(0, 10) }
        });
    }

    /* Error klien berulang per halaman. */
    const errorBuckets = new Map();
    for (const event of recent) {
        if (event.kind !== "error" && event.severity !== "error" && event.severity !== "critical") continue;
        const key = event.path || "(tanpa halaman)";
        const bucket = errorBuckets.get(key) || { count: 0, sample: "" };
        bucket.count += 1;
        if (!bucket.sample) bucket.sample = event.message || "";
        errorBuckets.set(key, bucket);
    }

    for (const [path, bucket] of errorBuckets) {
        if (bucket.count < 3) continue;
        findings.push({
            fingerprint: `client-error:${path}`,
            title: `Error berulang di ${path}`,
            category: "bug",
            severity: bucket.count >= 10 ? "critical" : "error",
            description: `${bucket.count} error dalam 24 jam. Contoh: ${bucket.sample || "tanpa pesan"}`,
            remediation: REMEDIATION["client-error"],
            evidence: { path, count: bucket.count }
        });
    }

    /* Kegagalan API 5xx. */
    const apiFailures = recent.filter(event => event.kind === "api_failure");
    if (apiFailures.length >= 3) {
        findings.push({
            fingerprint: "api-failure:burst",
            title: "Kegagalan API berulang",
            category: "bug",
            severity: apiFailures.length >= 10 ? "critical" : "error",
            description: `${apiFailures.length} kegagalan API dalam 24 jam terakhir.`,
            remediation: REMEDIATION["api-failure"],
            evidence: { count: apiFailures.length }
        });
    }

    /* Akses mencurigakan: banyak IP berbeda membuka DevTools pada jam sama. */
    const securityEvents = recent.filter(event => event.kind === "security");
    if (securityEvents.length >= 5) {
        findings.push({
            fingerprint: "security:burst",
            title: "Aktivitas keamanan mencurigakan",
            category: "security",
            severity: "error",
            description: `${securityEvents.length} kejadian keamanan dalam 24 jam terakhir.`,
            remediation: REMEDIATION.security,
            evidence: { count: securityEvents.length }
        });
    }

    return findings;
}

/* ---------------------------------------------------------
   PENYIMPANAN
   --------------------------------------------------------- */

export async function fetchSettings(config, fetchImpl = fetch) {
    const rows = await dbRequest(
        config,
        "/monitoring_settings?id=eq.true&select=*",
        { method: "GET" },
        fetchImpl
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function saveHealthChecks(config, checks, fetchImpl = fetch) {
    if (!checks.length) return 0;
    const body = checks.map(check => ({
        target: check.target,
        status: check.status,
        latency_ms: Number.isFinite(check.latency_ms) ? Math.round(check.latency_ms) : null,
        detail: check.detail || {}
    }));

    await dbRequest(
        config,
        "/monitoring_health_checks",
        { method: "POST", body: JSON.stringify(body) },
        fetchImpl
    );
    return body.length;
}

export async function upsertFindings(config, findings, fetchImpl = fetch) {
    const existing = await dbRequest(
        config,
        "/monitoring_findings?select=id,fingerprint,status,occurrence_count,category",
        { method: "GET" },
        fetchImpl
    );

    const byFingerprint = new Map(
        (Array.isArray(existing) ? existing : []).map(row => [row.fingerprint, row])
    );
    const seen = new Set();
    const nowIso = new Date().toISOString();

    for (const finding of findings) {
        seen.add(finding.fingerprint);
        const current = byFingerprint.get(finding.fingerprint);

        if (current) {
            await dbRequest(
                config,
                `/monitoring_findings?id=eq.${encodeURIComponent(current.id)}`,
                {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify({
                        title: finding.title,
                        category: finding.category,
                        severity: finding.severity,
                        description: finding.description,
                        remediation: finding.remediation,
                        evidence: finding.evidence || {},
                        /* Muncul lagi setelah ditutup → buka kembali. */
                        status: current.status === "resolved" ? "open" : current.status,
                        occurrence_count: (Number(current.occurrence_count) || 0) + 1,
                        last_seen_at: nowIso,
                        updated_at: nowIso
                    })
                },
                fetchImpl
            );
            continue;
        }

        await dbRequest(
            config,
            "/monitoring_findings",
            {
                method: "POST",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    fingerprint: finding.fingerprint,
                    title: finding.title,
                    category: finding.category,
                    severity: finding.severity,
                    description: finding.description,
                    remediation: finding.remediation,
                    evidence: finding.evidence || {},
                    status: "open",
                    last_seen_at: nowIso,
                    updated_at: nowIso
                })
            },
            fetchImpl
        );
    }

    /* Temuan kesehatan yang sudah normal ditutup otomatis. */
    for (const row of byFingerprint.values()) {
        if (row.category !== "health" || row.status === "resolved" || seen.has(row.fingerprint)) continue;
        await dbRequest(
            config,
            `/monitoring_findings?id=eq.${encodeURIComponent(row.id)}`,
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ status: "resolved", updated_at: nowIso })
            },
            fetchImpl
        );
    }

    return findings.length;
}

export async function pruneOldEvents(config, retentionDays, fetchImpl = fetch) {
    const days = Math.min(365, Math.max(1, Number(retentionDays) || 30));
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    await dbRequest(
        config,
        `/monitoring_events?occurred_at=lt.${encodeURIComponent(cutoff)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
        fetchImpl
    );

    await dbRequest(
        config,
        `/monitoring_health_checks?checked_at=lt.${encodeURIComponent(cutoff)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
        fetchImpl
    );

    return cutoff;
}

/*
 * Batas jumlah log.
 *
 * Event disimpan di Supabase, jadi tanpa batas tabelnya akan terus tumbuh.
 * Fungsi RPC `prune_monitoring_events` hanya menyisakan N baris terbaru.
 * Dipanggil cron tiap menit dan setiap selesai pemeriksaan manual.
 */
export async function pruneEventOverflow(config, keep = 500, fetchImpl = fetch) {
    const target = Math.max(50, Math.min(10000, Number(keep) || 500));

    try {
        const result = await dbRequest(
            config,
            "/rpc/prune_monitoring_events",
            { method: "POST", body: JSON.stringify({ p_keep: target }) },
            fetchImpl
        );

        return typeof result === "number" ? result : 0;
    } catch (error) {
        console.warn("[Monitoring] Pemangkasan log dilewati:", error?.message || "unknown error");
        return 0;
    }
}

export async function markScan(config, status, fetchImpl = fetch) {
    await dbRequest(
        config,
        "/monitoring_settings?id=eq.true",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                last_scan_at: new Date().toISOString(),
                last_scan_status: status,
                updated_at: new Date().toISOString()
            })
        },
        fetchImpl
    );
}

/**
 * Satu siklus pemeriksaan lengkap.
 * Dipakai cron dan tombol "Periksa sekarang" supaya hasilnya identik.
 */
export async function runMonitoringScan(config, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const settings = options.settings || (await fetchSettings(config, fetchImpl).catch(() => null));
    const checks = await runHealthChecks(config, { ...options, fetchImpl, settings });

    const events = options.events || await dbRequest(
        config,
        "/monitoring_events?select=kind,severity,path,message,ip,occurred_at,devtools_open&order=occurred_at.desc&limit=200",
        { method: "GET" },
        fetchImpl
    ).catch(() => []);

    const findings = buildFindings({ checks, events: Array.isArray(events) ? events : [], settings });

    await saveHealthChecks(config, checks, fetchImpl);
    await upsertFindings(config, findings, fetchImpl);
    /* Jaga agar tabel log tetap maksimal N baris terbaru. */
    await pruneEventOverflow(config, settings?.max_events || 500, fetchImpl);
    await markScan(config, highestSeverity(checks.map(check => check.status === "ok" ? "info" : check.status === "warn" ? "warn" : "critical")), fetchImpl);

    return { checks, findings, settings };
}
