/*
 * =========================================================
 * GEN-Z.AI
 * BLACK BOX // MONITORING — UI
 * ---------------------------------------------------------
 * File: admin-control/monitoring.js
 * ---------------------------------------------------------
 * Hanya urusan tampilan & permintaan ke /api/monitoring.
 * Semua data sensitif (IP, lokasi) datang dari server; berkas ini
 * tidak pernah membaca/menyimpan kunci apa pun.
 * =========================================================
 */

const ENDPOINT = "/api/monitoring";
const FREE_CREDIT_ENDPOINT = "/api/free-credit";
const REFRESH_MS = 10000;

const LOG_LIMIT_OPTIONS = [50, 100, 500];
const LOG_LIMIT_STORAGE_KEY = "genz-monitoring-log-limit";

function readLogLimit() {
    try {
        const saved = Number(window.localStorage?.getItem(LOG_LIMIT_STORAGE_KEY));
        if (LOG_LIMIT_OPTIONS.includes(saved)) return saved;
    } catch {
        /* localStorage bisa dibatasi browser */
    }
    return 50;
}

const state = {
    busy: false,
    filter: "all",
    logLimit: readLogLimit(),
    events: [],
    accessRows: [],
    settings: null,
    freeCredit: {
        claim_enabled: true,
        credit_amount: 5000,
        runtime_starts_at: null,
        runtime_ends_at: null,
        runtime_status: "active",
        banner_image_url: null,
        updated_at: null,
        claims_count: 0,
        rejected_count: 0
    },
    fcDirty: false,
    fcSaving: false,
    fcPendingImage: null,
    fcPendingObjectUrl: "",
    serverTime: null,
    lastLogSignature: "",
    lastLogError: "",
    pollTimer: null
};

const $ = id => document.getElementById(id);

/* ---------------------------------------------------------
   SESI
   --------------------------------------------------------- */

function supabaseClient() {
    if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
    if (window.supabaseClient) return window.supabaseClient;

    const config = window.GENZ_CONFIG || {};
    const key = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY;

    if (!window.supabase?.createClient || !config.SUPABASE_URL || !key) {
        throw new Error("Konfigurasi Supabase tidak tersedia.");
    }

    window.GENZ_SUPABASE = window.supabase.createClient(config.SUPABASE_URL, key);
    return window.GENZ_SUPABASE;
}

async function accessToken(force = false) {
    if (window.GENZSession?.ensureFreshSession) {
        const refreshed = await window.GENZSession.ensureFreshSession({ force });
        if (refreshed?.access_token) return refreshed.access_token;
    }

    const { data, error } = await supabaseClient().auth.getSession();
    if (error) throw error;
    if (!data?.session?.access_token) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang sebagai admin.");
    }
    return data.session.access_token;
}

async function api(action, options = {}) {
    const token = await accessToken();

    /* Setiap parameter di-encode sendiri-sendiri. Jangan pernah
       menyisipkan "&" ke dalam argumen action — dulu itu membuat
       "events&limit=50" terkirim sebagai satu nilai (%26) dan 404. */
    const params = new URLSearchParams({ action });

    for (const [key, value] of Object.entries(options.query || {})) {
        if (value === undefined || value === null || value === "") continue;
        params.set(key, String(value));
    }

    const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
        method: options.method || "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {})
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });

    const text = await response.text();
    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }

    if (!response.ok || data.success !== true) {
        throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`);
    }

    return data;
}

async function freeCreditApi(action, options = {}) {
    const token = await accessToken();
    const params = new URLSearchParams({ action });

    for (const [key, value] of Object.entries(options.query || {})) {
        if (value === undefined || value === null || value === "") continue;
        params.set(key, String(value));
    }

    const headers = {
        Authorization: `Bearer ${token}`
    };

    let requestBody;
    if (options.rawBody !== undefined) {
        if (options.contentType) {
            headers["Content-Type"] = options.contentType;
        }
        requestBody = options.rawBody;
    } else if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify(options.body);
    }

    const response = await fetch(`${FREE_CREDIT_ENDPOINT}?${params.toString()}`, {
        method: options.method || "GET",
        headers,
        ...(requestBody !== undefined ? { body: requestBody } : {})
    });

    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }

    if (!response.ok || data.ok !== true) {
        throw new Error(data.error || `Permintaan klaim kredit gagal (HTTP ${response.status}).`);
    }

    return data;
}

/* ---------------------------------------------------------
   UTIL
   --------------------------------------------------------- */

function formatTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";

    return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).format(date);
}

function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";

    return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date) + " WIB";
}

function relativeMinutes(value) {
    if (!value) return "belum pernah";
    const diff = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(diff)) return "belum pernah";
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    return `${Math.round(hours / 24)} hari lalu`;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/*
 * IPv6 penuh (39 karakter) memaksa kolom melar dan baris jadi sangat tinggi
 * di layar HP. Daftar memakai bentuk ringkas; alamat utuh tetap tersedia di
 * atribut title dan di panel detail.
 */
function shortIp(ip) {
    if (!ip) return "—";

    const value = String(ip);
    if (!value.includes(":")) return value;

    const groups = value.split(":");
    if (groups.length <= 4) return value;

    return `${groups[0]}:${groups[1]}:…:${groups[groups.length - 1]}`;
}

function ipCell(ip) {
    const cell = el("td", "mon-ip", shortIp(ip));
    cell.title = ip || "";
    cell.dataset.ip = ip || "";
    return cell;
}

let toastTimer = null;

function toast(message, tone = "ok") {
    const node = $("monToast") || (() => {
        const created = el("div", "mon-toast");
        created.id = "monToast";
        document.getElementById("monPage").append(created);
        return created;
    })();

    node.textContent = message;
    node.className = `mon-toast mon-toast--show${tone === "error" ? " mon-toast--error" : ""}`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        node.className = "mon-toast";
    }, 4200);
}

/* ---------------------------------------------------------
   RENDER: RINGKASAN
   --------------------------------------------------------- */

const OVERALL_LABEL = {
    info: "SEHAT",
    warn: "PERHATIAN",
    error: "BERMASALAH",
    critical: "KRITIS"
};

const OVERALL_CLASS = {
    info: "mon-stat-value--ok",
    warn: "mon-stat-value--warn",
    error: "mon-stat-value--fail",
    critical: "mon-stat-value--fail"
};

function renderSummary(data) {
    const overall = data.summary?.overall || "info";

    const overallNode = $("statOverall");
    overallNode.textContent = OVERALL_LABEL[overall] || overall.toUpperCase();
    overallNode.className = `mon-stat-value ${OVERALL_CLASS[overall] || ""}`;

    $("statOverallHint").textContent = data.settings?.last_scan_at
        ? `pemeriksaan ${relativeMinutes(data.settings.last_scan_at)}`
        : "belum ada pemeriksaan";

    $("statEvents").textContent = String(data.summary?.events_24h ?? 0);

    const errors = Number(data.summary?.errors_24h ?? 0);
    $("statErrors").textContent = String(errors);
    $("statErrors").className = `mon-stat-value${errors > 0 ? " mon-stat-value--fail" : ""}`;

    const devtools = Number(data.summary?.devtools_24h ?? 0);
    $("statDevtools").textContent = String(devtools);
    $("statDevtools").className = `mon-stat-value${devtools > 0 ? " mon-stat-value--warn" : ""}`;

    $("monChipOverall").textContent = OVERALL_LABEL[overall] || "—";
    $("monChipServer").textContent = `SERVER ${formatTime(data.server_time)} WIB`;
    $("monChipUpdated").textContent = `UPDATE ${formatTime(new Date().toISOString())} WIB`;
}

/* ---------------------------------------------------------
   RENDER: KESEHATAN
   --------------------------------------------------------- */

function renderHealth(checks) {
    const grid = $("monHealthGrid");
    grid.replaceChildren();

    if (!checks || checks.length === 0) {
        grid.append(el("div", "mon-empty", "Belum ada hasil pemeriksaan. Tekan \"Periksa sekarang\"."));
        $("monHealthMeta").textContent = "—";
        return;
    }

    const worst = checks.reduce((acc, check) => {
        const rank = { ok: 0, warn: 1, fail: 2 };
        return rank[check.status] > rank[acc] ? check.status : acc;
    }, "ok");

    $("monHealthMeta").textContent =
        `${checks.length} TARGET · ${worst.toUpperCase()} · ${formatTime(checks[0].checked_at)} WIB`;

    for (const check of checks) {
        const card = el("div", `mon-health mon-health--${check.status}`);

        const top = el("div", "mon-health-top");
        top.append(el("span", "mon-health-dot"));
        top.append(el("span", "", check.label || check.target));
        card.append(top);

        card.append(el("div", "mon-health-msg", check.detail?.message || "—"));

        const meta = el("div", "mon-health-meta");
        meta.append(el("span", "mon-health-status", check.status === "ok" ? "OK" : check.status.toUpperCase()));
        meta.append(el("span", "", Number.isFinite(check.latency_ms) && check.latency_ms > 0
            ? `${Math.round(check.latency_ms)} ms`
            : "—"));
        card.append(meta);

        if (check.detail?.hint) {
            card.append(el("div", "mon-health-msg", check.detail.hint));
        }

        grid.append(card);
    }
}

/* ---------------------------------------------------------
   RENDER: TEMUAN
   --------------------------------------------------------- */

function renderFindings(findings) {
    const rows = (findings || []).filter(item => item.status !== "resolved");
    const list = rows.filter(item => item.status === "open");
    const known = rows.filter(item => item.status === "acknowledged");

    const container = $("monFindings");
    container.replaceChildren();

    /* Temuan yang sudah ditandai "diketahui" tidak lagi dihitung aktif,
       tapi tetap terlihat di daftar supaya bisa dibuka kembali. */
    $("monFindingsMeta").textContent = list.length
        ? `${list.length} AKTIF${known.length ? ` · ${known.length} DIKETAHUI` : ""}`
        : known.length
            ? `0 AKTIF · ${known.length} DIKETAHUI`
            : "TIDAK ADA";

    if (rows.length === 0) {
        container.append(el(
            "div",
            "mon-empty",
            "Tidak ada temuan aktif. Semua pemeriksaan terakhir dalam batas normal."
        ));
        return;
    }

    for (const item of [...list, ...known]) {
        const isKnown = item.status === "acknowledged";
        const card = el(
            "div",
            `mon-finding mon-finding--${item.severity}${isKnown ? " mon-finding--known" : ""}`
        );

        const head = el("div", "mon-finding-head");
        head.append(el("span", "mon-finding-title", item.title));
        head.append(el("span", `mon-level mon-level--${item.severity}`, item.severity));
        card.append(head);

        if (item.description) {
            card.append(el("div", "mon-finding-desc", item.description));
        }

        if (item.remediation) {
            const fix = el("div", "mon-finding-fix");
            fix.append(el("strong", "", "CARA MENGATASI: "));
            fix.append(document.createTextNode(item.remediation));
            card.append(fix);
        }

        const foot = el("div", "mon-finding-foot");
        foot.append(el("span", "", `${item.occurrence_count}× terdeteksi`));
        foot.append(el("span", "", `terakhir ${relativeMinutes(item.last_seen_at)}`));

        if (item.status === "open") {
            const ack = el("button", "mon-mini-btn", "Tandai diketahui");
            ack.type = "button";
            ack.title = "Senyap 24 jam, lalu muncul lagi bila masih ada kejadian.";
            ack.addEventListener("click", () => updateFinding(item.id, "acknowledged", ack));
            foot.append(ack);
        } else {
            const tag = el("span", "mon-tag", "DIKETAHUI");
            tag.title = "Disenyapkan 24 jam sejak ditandai.";
            foot.append(tag);

            const reopen = el("button", "mon-mini-btn", "Buka lagi");
            reopen.type = "button";
            reopen.addEventListener("click", () => updateFinding(item.id, "open", reopen));
            foot.append(reopen);
        }

        const resolve = el("button", "mon-mini-btn", "Tandai selesai");
        resolve.type = "button";
        resolve.title = "Tetap senyap sampai ada kejadian baru.";
        resolve.addEventListener("click", () => updateFinding(item.id, "resolved", resolve));
        foot.append(resolve);

        card.append(foot);
        container.append(card);
    }
}

async function updateFinding(id, status, button) {
    button.disabled = true;
    try {
        await api("update-finding", { method: "POST", body: { id, status } });
        toast(status === "resolved" ? "Temuan ditandai selesai." : "Temuan ditandai diketahui.");
        await refresh({ silent: true });
    } catch (error) {
        toast(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

/* ---------------------------------------------------------
   RENDER: LOG
   --------------------------------------------------------- */

const KIND_LABEL = {
    page_view: "kunjungan",
    error: "error",
    devtools: "devtools",
    security: "keamanan",
    api_failure: "api gagal",
    worker: "worker",
    activity: "aktivitas"
};

function matchesFilter(event) {
    if (state.filter === "all") return true;
    if (state.filter === "devtools") return Boolean(event.devtools_open) || event.kind === "devtools";
    if (state.filter === "error") return event.kind === "error" || event.severity === "error" || event.severity === "critical";
    return event.kind === state.filter;
}

function renderLog(events) {
    const body = $("monLogBody");
    const filtered = (events || []).filter(matchesFilter);

    $("monLogMeta").textContent =
        `${filtered.length} BARIS · ${state.filter.toUpperCase()} · MAKS ${state.logLimit}`;

    const signature = filtered.map(event => event.id).join(",");
    const isNew = signature !== state.lastLogSignature;
    state.lastLogSignature = signature;

    body.replaceChildren();

    if (filtered.length === 0) {
        const row = el("tr");
        const cell = el("td", "mon-log-time", "Belum ada aktivitas pada filter ini.");
        cell.colSpan = 7;
        row.append(cell);
        body.append(row);
        return;
    }

    filtered.slice(0, state.logLimit).forEach((event, index) => {
        const row = el("tr");

        row.append(el("td", "mon-log-time", formatTime(event.occurred_at)));

        const levelCell = el("td");
        levelCell.append(el("span", `mon-level mon-level--${event.severity}`, event.severity));
        row.append(levelCell);

        row.append(el("td", "", KIND_LABEL[event.kind] || event.kind));
        row.append(el("td", "mon-log-time", event.path || "—"));
        row.append(ipCell(event.ip));

        const place = [event.city, event.country].filter(Boolean).join(", ") || "—";
        row.append(el("td", "", place));

        row.append(el("td", "mon-log-msg", event.message || "—"));

        row.className = "mon-log-row" + (isNew && index === 0 ? " mon-log-new" : "");
        row.dataset.eventId = String(event.id);
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", "Lihat detail log");
        body.append(row);
    });
}

/* ---------------------------------------------------------
   RENDER: AKSES
   --------------------------------------------------------- */

function buildAccessRows(events) {
    const map = new Map();

    for (const event of events) {
        if (!event.ip) continue;
        const key = event.ip;
        const current = map.get(key);

        if (!current) {
            map.set(key, {
                ip: key,
                at: event.occurred_at,
                city: event.city,
                country: event.country,
                asn: event.asn,
                device: [event.browser, event.os, event.device].filter(Boolean).join(" · "),
                devtools: Boolean(event.devtools_open),
                devtoolsEver: Boolean(event.devtools_open),
                path: event.path || "—",
                hits: 1
            });
            continue;
        }

        current.hits += 1;
        if (new Date(event.occurred_at) > new Date(current.at)) {
            current.at = event.occurred_at;
            current.path = event.path || current.path;
            current.devtools = Boolean(event.devtools_open);
        }
        if (event.devtools_open) current.devtoolsEver = true;
    }

    return [...map.values()].sort((a, b) => new Date(b.at) - new Date(a.at));
}

function renderAccess(events) {
    const rows = buildAccessRows(events || []);
    state.accessRows = rows;

    const body = $("monAccessBody");
    body.replaceChildren();

    $("monAccessMeta").textContent = rows.length
        ? `${rows.length} IP · ${rows.filter(row => row.devtools).length} DEVTOOLS`
        : "BELUM ADA";

    if (rows.length === 0) {
        const row = el("tr");
        const cell = el("td", "mon-log-time", "Belum ada data akses yang terekam.");
        cell.colSpan = 7;
        row.append(cell);
        body.append(row);
        return;
    }

    for (const item of rows.slice(0, 60)) {
        const row = el("tr");

        row.append(el("td", "mon-log-time", formatDateTime(item.at)));
        row.append(ipCell(item.ip));

        const place = [item.city, item.country].filter(Boolean).join(", ") || "—";
        row.append(el("td", "", place));
        row.append(el("td", "mon-ip", item.asn || "—"));
        row.append(el("td", "", item.device || "—"));

        const devtoolsCell = el("td");
        const badge = el(
            "span",
            `mon-tag ${item.devtools ? "mon-tag--on" : "mon-tag--off"}`,
            item.devtools ? "TERBUKA" : "tertutup"
        );
        if (!item.devtools && item.devtoolsEver) {
            badge.title = "Saat ini tertutup (sempat terbuka di log sebelumnya).";
        }
        devtoolsCell.append(badge);
        row.append(devtoolsCell);

        row.append(el("td", "mon-log-time", `${item.path} (${item.hits}×)`));

        body.append(row);
    }
}

/* ---------------------------------------------------------
   RENDER: PENGATURAN
   --------------------------------------------------------- */

function renderSettings(settings) {
    if (!settings) {
        $("monSettingsMeta").textContent = "BELUM ADA";
        return;
    }

    state.settings = settings;

    if (document.activeElement !== $("monInterval")) {
        $("monInterval").value = String(settings.scan_interval_minutes ?? 15);
    }
    if (document.activeElement !== $("monRetention")) {
        $("monRetention").value = String(settings.retention_days ?? 30);
    }

    if (document.activeElement !== $("monMaxEvents")) {
        $("monMaxEvents").value = String(settings.max_events ?? 500);
    }

    $("monDevtoolsAlerts").checked = settings.devtools_alerts !== false;
    $("monErrorAlerts").checked = settings.error_alerts !== false;

    const interval = Number(settings.scan_interval_minutes) || 15;
    const last = settings.last_scan_at ? new Date(settings.last_scan_at).getTime() : 0;

    $("monSettingsMeta").textContent = settings.last_scan_at
        ? `TERAKHIR ${relativeMinutes(settings.last_scan_at).toUpperCase()}`
        : "BELUM PERNAH";

    if (last) {
        const next = new Date(last + interval * 60000);
        $("monNextScan").textContent = `Pemeriksaan berikutnya: ${formatDateTime(next.toISOString())}`;
    } else {
        $("monNextScan").textContent = "Pemeriksaan berikutnya: menunggu cron berikutnya.";
    }
}

/* ---------------------------------------------------------
   KENDALI CLAIM 5.000 CREDIT GRATIS & BANNER 16:9
   --------------------------------------------------------- */

function compute16x9CropRect(srcWidth, srcHeight, offsetPercent = 50) {
    const w = Math.max(1, Number(srcWidth) || 1);
    const h = Math.max(1, Number(srcHeight) || 1);
    const pct = Math.min(100, Math.max(0, Number.isFinite(Number(offsetPercent)) ? Number(offsetPercent) : 50));
    const targetRatio = 16 / 9;
    const srcRatio = w / h;

    if (Math.abs(srcRatio - targetRatio) < 0.005) {
        return { sx: 0, sy: 0, sw: w, sh: h, axis: "exact" };
    }

    if (srcRatio > targetRatio) {
        const sh = h;
        const sw = Math.max(1, Math.round(h * targetRatio));
        const maxX = Math.max(0, w - sw);
        const sx = Math.round((maxX * pct) / 100);
        return { sx, sy: 0, sw, sh, axis: "horizontal" };
    }

    const sw = w;
    const sh = Math.max(1, Math.round(w / targetRatio));
    const maxY = Math.max(0, h - sh);
    const sy = Math.round((maxY * pct) / 100);
    return { sx: 0, sy, sw, sh, axis: "vertical" };
}

function renderFreeCreditBannerPreview(bannerUrl) {
    const img = $("monFcPreviewImg");
    const def = $("monFcPreviewDefault");
    const canvas = $("monFcCropCanvas");
    const meta = $("monFcBannerMeta");
    const removeBtn = $("monFcRemoveBannerBtn");

    if (!img || !def) return;
    if (canvas) canvas.hidden = true;

    const clean = typeof bannerUrl === "string" ? bannerUrl.trim() : "";
    if (clean && /^https:\/\//i.test(clean)) {
        def.hidden = true;
        img.hidden = false;
        if (img.getAttribute("src") !== clean) {
            img.src = clean;
        }
        if (meta) meta.textContent = "GAMBAR 16:9 AKTIF";
        if (removeBtn) removeBtn.hidden = false;
    } else {
        img.hidden = true;
        img.removeAttribute("src");
        def.hidden = false;
        if (meta) meta.textContent = "DEFAULT LUXURY ART";
        if (removeBtn) removeBtn.hidden = true;
    }
}

function formatFcNominal(amount) {
    const safe = Math.max(100, Math.round(Number(amount) || 5000));
    return String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function isoToDatetimeLocalValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const pad = n => (n < 10 ? `0${n}` : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(localVal) {
    const raw = String(localVal || "").trim();
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function syncFreeCreditLivePreview() {
    const amtInput = $("monFcAmountInput");
    const startsInput = $("monFcStartsAt");
    const endsInput = $("monFcEndsAt");
    const toggle = $("monFcEnabledToggle");

    const rawNominal = amtInput ? Number(amtInput.value) : state.freeCredit.credit_amount;
    const nominal = Number.isFinite(rawNominal) && rawNominal >= 100
        ? Math.round(rawNominal)
        : (state.freeCredit.credit_amount || 5000);
    const lbl = formatFcNominal(nominal);

    const chipVal = $("monFcChipVal");
    const defAmt = $("monFcDefAmount");
    const prevTitle = $("monFcPrevTitle");
    const prevBadge = $("monFcRtPrevBadge");
    const prevKicker = $("monFcRtPrevKicker");
    const prevSub = $("monFcRtPrevSub");

    if (chipVal) chipVal.textContent = `+${lbl} CR`;
    if (defAmt) defAmt.textContent = `+${lbl} CR`;
    if (prevTitle) prevTitle.textContent = `Klaim ${lbl} Credit Gratis`;
    if (prevBadge) prevBadge.textContent = `✦ Klaim ${lbl} CR`;

    const startsIso = startsInput ? datetimeLocalToIso(startsInput.value) : state.freeCredit.runtime_starts_at;
    const endsIso = endsInput ? datetimeLocalToIso(endsInput.value) : state.freeCredit.runtime_ends_at;
    const enabled = toggle ? Boolean(toggle.checked) : state.freeCredit.claim_enabled !== false;
    const nowMs = Date.now();

    if (prevKicker && prevSub) {
        if (!enabled) {
            prevKicker.textContent = "○ EVENT DINONAKTIFKAN";
            prevSub.textContent = "Kartu disembunyikan dari dashboard user.";
        } else if (startsIso && nowMs < Date.parse(startsIso)) {
            prevKicker.textContent = "⏳ TERJADWAL · MENUNGGU MULAI";
            prevSub.textContent = `Mulai: ${formatDateTime(startsIso)}` + (endsIso ? ` · Selesai: ${formatDateTime(endsIso)}` : "");
        } else if (endsIso && nowMs >= Date.parse(endsIso)) {
            prevKicker.textContent = "✕ WAKTU RUNTIME HABIS";
            prevSub.textContent = `Berakhir pada ${formatDateTime(endsIso)}`;
        } else if (endsIso) {
            prevKicker.textContent = "● LIVE COUNTDOWN RUNTIME";
            prevSub.textContent = (startsIso ? `${formatDateTime(startsIso)} — ` : "Berakhir: ") + formatDateTime(endsIso);
        } else {
            prevKicker.textContent = "● LIVE EVENT RUNTIME";
            prevSub.textContent = `Aktif tanpa batas waktu · Klaim +${lbl} CR`;
        }
    }
}

function renderFreeCredit(fcData) {
    if (!fcData || typeof fcData !== "object") return;

    const nominal = Number(fcData.credit_amount) >= 100
        ? Math.round(Number(fcData.credit_amount))
        : (state.freeCredit.credit_amount || 5000);

    state.freeCredit = {
        ...state.freeCredit,
        ...fcData,
        claim_enabled: fcData.claim_enabled !== false,
        credit_amount: nominal,
        runtime_starts_at: fcData.runtime_starts_at ?? state.freeCredit.runtime_starts_at ?? null,
        runtime_ends_at: fcData.runtime_ends_at ?? state.freeCredit.runtime_ends_at ?? null,
        banner_image_url: fcData.banner_image_url !== undefined ? fcData.banner_image_url : state.freeCredit.banner_image_url
    };

    const claimsEl = $("monFcClaimsCount");
    const rejectedEl = $("monFcRejectedCount");
    const updatedEl = $("monFcUpdatedAt");

    if (claimsEl && fcData.claims_count !== undefined) {
        claimsEl.textContent = String(Number(fcData.claims_count) || 0);
    }
    if (rejectedEl && fcData.rejected_count !== undefined) {
        rejectedEl.textContent = String(Number(fcData.rejected_count) || 0);
    }
    if (updatedEl) {
        updatedEl.textContent = state.freeCredit.updated_at
            ? formatDateTime(state.freeCredit.updated_at)
            : "Bawaan aktif";
    }

    if (!state.fcSaving) {
        const enabled = state.freeCredit.claim_enabled !== false;
        const startsAt = state.freeCredit.runtime_starts_at;
        const endsAt = state.freeCredit.runtime_ends_at;
        const nowMs = Date.now();
        const rtStatus = !enabled
            ? "disabled"
            : startsAt && nowMs < Date.parse(startsAt)
                ? "scheduled"
                : endsAt && nowMs >= Date.parse(endsAt)
                    ? "expired"
                    : "active";

        const toggle = $("monFcEnabledToggle");
        const switchLabel = $("monFcSwitchLabel");
        const badge = $("monFcStatusBadge");
        const desc = $("monFcStateDesc");
        const amtInput = $("monFcAmountInput");
        const startsInput = $("monFcStartsAt");
        const endsInput = $("monFcEndsAt");
        const lbl = formatFcNominal(state.freeCredit.credit_amount);

        if (toggle) toggle.checked = enabled;
        if (switchLabel) {
            switchLabel.textContent = enabled
                ? `EVENT CLAIM ${lbl} CR: ON`
                : `EVENT CLAIM ${lbl} CR: OFF`;
        }
        if (badge) {
            if (rtStatus === "active") {
                badge.className = "mon-tag mon-tag--on";
                badge.textContent = `AKTIF · +${lbl} CR LIVE`;
            } else if (rtStatus === "scheduled") {
                badge.className = "mon-tag mon-tag--on";
                badge.textContent = `TERJADWAL · +${lbl} CR`;
            } else if (rtStatus === "expired") {
                badge.className = "mon-tag mon-tag--off";
                badge.textContent = "RUNTIME HABIS · BERAKHIR";
            } else {
                badge.className = "mon-tag mon-tag--off";
                badge.textContent = "NONAKTIF · DISEMBUNYIKAN";
            }
        }
        if (desc) {
            desc.textContent = enabled
                ? `Event Claim ${lbl} Credit Gratis sedang ON dan tersinkronisasi dengan waktu runtime di dashboard user.`
                : "Event Claim Free Credit sedang OFF (kartu disembunyikan dari seluruh akun user & klaim baru ditolak server).";
        }

        if (!state.fcDirty) {
            if (amtInput && document.activeElement !== amtInput) {
                amtInput.value = String(state.freeCredit.credit_amount);
            }
            if (startsInput && document.activeElement !== startsInput) {
                startsInput.value = isoToDatetimeLocalValue(startsAt);
            }
            if (endsInput && document.activeElement !== endsInput) {
                endsInput.value = isoToDatetimeLocalValue(endsAt);
            }
        }

        syncFreeCreditLivePreview();
    }

    if (!state.fcSaving && !state.fcPendingImage) {
        renderFreeCreditBannerPreview(state.freeCredit.banner_image_url);
    }
}

function clearPendingBannerCrop() {
    if (state.fcPendingObjectUrl && typeof URL !== "undefined" && URL.revokeObjectURL) {
        try {
            URL.revokeObjectURL(state.fcPendingObjectUrl);
        } catch {
            /* abaikan */
        }
    }
    state.fcPendingImage = null;
    state.fcPendingObjectUrl = "";

    const cropBox = $("monFcCropBox");
    const input = $("monFcBannerInput");
    if (cropBox) cropBox.hidden = true;
    if (input) input.value = "";

    renderFreeCreditBannerPreview(state.freeCredit.banner_image_url);
}

function drawPendingCropToCanvas() {
    const img = state.fcPendingImage;
    const canvas = $("monFcCropCanvas");
    const previewImg = $("monFcPreviewImg");
    const previewDef = $("monFcPreviewDefault");
    const slider = $("monFcCropOffset");

    if (!img || !canvas) return null;

    const offset = slider ? Number(slider.value) : 50;
    const rect = compute16x9CropRect(img.naturalWidth || img.width, img.naturalHeight || img.height, offset);

    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);

    if (previewImg) previewImg.hidden = true;
    if (previewDef) previewDef.hidden = true;
    canvas.hidden = false;

    return canvas;
}

function canvasToBannerBlob(canvas) {
    return new Promise((resolve, reject) => {
        if (!canvas || typeof canvas.toBlob !== "function") {
            reject(new Error("Browser tidak mendukung konversi gambar 16:9."));
            return;
        }
        canvas.toBlob(
            webpBlob => {
                if (webpBlob && webpBlob.size > 0) {
                    resolve({ blob: webpBlob, mime: "image/webp" });
                    return;
                }
                canvas.toBlob(
                    jpegBlob => {
                        if (jpegBlob && jpegBlob.size > 0) {
                            resolve({ blob: jpegBlob, mime: "image/jpeg" });
                        } else {
                            reject(new Error("Gagal menyiapkan file gambar 16:9."));
                        }
                    },
                    "image/jpeg",
                    0.9
                );
            },
            "image/webp",
            0.9
        );
    });
}

async function setFreeCreditUiBusy(isBusy) {
    state.fcSaving = isBusy;
    for (const id of [
        "monFcEnabledToggle",
        "monFcAmountInput",
        "monFcStartsAt",
        "monFcEndsAt",
        "monFcSaveEventBtn",
        "monFcUploadBtn",
        "monFcRemoveBannerBtn",
        "monFcCropApply",
        "monFcCropCancel"
    ]) {
        const node = $(id);
        if (node) node.disabled = isBusy;
    }
}

async function handleToggleFreeCredit() {
    const toggle = $("monFcEnabledToggle");
    if (!toggle || state.fcSaving) return;

    const desired = Boolean(toggle.checked);
    await setFreeCreditUiBusy(true);

    try {
        const res = await freeCreditApi("update-settings", {
            method: "POST",
            body: { claim_enabled: desired }
        });
        await setFreeCreditUiBusy(false);
        renderFreeCredit(res.settings || { claim_enabled: desired });
        toast(
            desired
                ? `Event Claim ${formatFcNominal(state.freeCredit.credit_amount)} Credit Gratis DIAKTIFKAN.`
                : "Event Claim Free Credit DINONAKTIFKAN.",
            "ok"
        );
    } catch (error) {
        await setFreeCreditUiBusy(false);
        renderFreeCredit(state.freeCredit);
        toast(error.message, "error");
    }
}

async function handleSaveFreeCreditEventConfig() {
    if (state.fcSaving) return;

    const toggle = $("monFcEnabledToggle");
    const amtInput = $("monFcAmountInput");
    const startsInput = $("monFcStartsAt");
    const endsInput = $("monFcEndsAt");
    const saveBtn = $("monFcSaveEventBtn");

    const nominal = Math.round(Number(amtInput ? amtInput.value : state.freeCredit.credit_amount));
    if (!Number.isFinite(nominal) || nominal < 100 || nominal > 10000000) {
        toast("Nominal kredit harus antara 100 hingga 10.000.000 CR.", "error");
        return;
    }

    const startsIso = startsInput ? datetimeLocalToIso(startsInput.value) : null;
    const endsIso = endsInput ? datetimeLocalToIso(endsInput.value) : null;
    if (startsIso && endsIso && Date.parse(endsIso) <= Date.parse(startsIso)) {
        toast("Waktu berakhir runtime harus lebih besar dari waktu mulai.", "error");
        return;
    }

    await setFreeCreditUiBusy(true);
    if (saveBtn) saveBtn.textContent = "Menyimpan…";

    try {
        const res = await freeCreditApi("update-settings", {
            method: "POST",
            body: {
                claim_enabled: toggle ? Boolean(toggle.checked) : state.freeCredit.claim_enabled,
                credit_amount: nominal,
                runtime_starts_at: startsIso,
                runtime_ends_at: endsIso
            }
        });
        state.fcDirty = false;
        await setFreeCreditUiBusy(false);
        renderFreeCredit(res.settings);
        toast(
            `Konfigurasi Event (+${formatFcNominal(nominal)} CR & jadwal runtime) berhasil disimpan!`,
            "ok"
        );
    } catch (error) {
        await setFreeCreditUiBusy(false);
        toast(error.message, "error");
    } finally {
        if (saveBtn) saveBtn.textContent = "Simpan Nominal & Runtime Event";
    }
}

function applyFreeCreditDurationPreset(hours) {
    const startsInput = $("monFcStartsAt");
    const endsInput = $("monFcEndsAt");
    if (!startsInput || !endsInput) return;

    state.fcDirty = true;
    const hrs = Number(hours) || 0;
    if (hrs <= 0) {
        startsInput.value = "";
        endsInput.value = "";
        syncFreeCreditLivePreview();
        return;
    }

    const now = new Date();
    const baseMs = startsInput.value && Number.isFinite(Date.parse(startsInput.value)) && Date.parse(startsInput.value) > now.getTime()
        ? Date.parse(startsInput.value)
        : now.getTime();
    if (!startsInput.value || Date.parse(startsInput.value) <= now.getTime()) {
        startsInput.value = isoToDatetimeLocalValue(now.toISOString());
    }
    const endDate = new Date(baseMs + hrs * 3600 * 1000);
    endsInput.value = isoToDatetimeLocalValue(endDate.toISOString());
    syncFreeCreditLivePreview();
}

async function uploadFreeCreditCanvas16x9() {
    if (state.fcSaving) return;
    const canvas = drawPendingCropToCanvas();
    if (!canvas) return;

    await setFreeCreditUiBusy(true);
    const uploadBtn = $("monFcUploadBtn");
    const applyBtn = $("monFcCropApply");
    if (uploadBtn) uploadBtn.textContent = "Mengunggah 16:9…";
    if (applyBtn) applyBtn.textContent = "Mengunggah 16:9…";

    try {
        const { blob, mime } = await canvasToBannerBlob(canvas);
        const bytes = await blob.arrayBuffer();
        const res = await freeCreditApi("upload-banner", {
            method: "POST",
            rawBody: bytes,
            contentType: mime
        });

        clearPendingBannerCrop();
        await setFreeCreditUiBusy(false);
        renderFreeCredit(
            res.settings || {
                ...state.freeCredit,
                banner_image_url: res.banner_image_url
            }
        );
        toast("Gambar banner 16:9 berhasil disimpan dan tampil di kartu user.", "ok");
    } catch (error) {
        await setFreeCreditUiBusy(false);
        toast(error.message, "error");
    } finally {
        if (uploadBtn) uploadBtn.textContent = "Upload Gambar 16:9";
        if (applyBtn) applyBtn.textContent = "Simpan Gambar 16:9";
    }
}

function loadImageElementFromFile(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ img, objectUrl });
        img.onerror = () => {
            try { URL.revokeObjectURL(objectUrl); } catch { /* abaikan */ }
            reject(new Error("File gambar tidak dapat dibaca. Pilih foto JPG, PNG, WebP, atau AVIF lain."));
        };
        img.src = objectUrl;
    });
}

async function handleSelectBannerFile(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowed.includes(String(file.type || "").toLowerCase())) {
        toast("Format belum didukung. Pilih gambar JPG, PNG, WebP, atau AVIF.", "error");
        event.target.value = "";
        return;
    }

    if (file.size > 15 * 1024 * 1024) {
        toast("Ukuran foto terlalu besar (maksimal 15 MB sebelum kompresi 16:9).", "error");
        event.target.value = "";
        return;
    }

    try {
        clearPendingBannerCrop();
        const { img, objectUrl } = await loadImageElementFromFile(file);
        state.fcPendingImage = img;
        state.fcPendingObjectUrl = objectUrl;

        const slider = $("monFcCropOffset");
        if (slider) slider.value = "50";

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const ratioDiff = Math.abs(w / h - 16 / 9);

        drawPendingCropToCanvas();

        /* Jika gambar sudah ~16:9, langsung unggah otomatis 1 klik!
           Jika belum 16:9 (mis. foto galeri HP 4:3 atau 9:16), tampilkan
           penggeser posisi 16:9 agar admin bisa menyesuaikan fokus. */
        if (ratioDiff <= 0.035) {
            await uploadFreeCreditCanvas16x9();
            return;
        }

        const cropBox = $("monFcCropBox");
        const cropLabel = $("monFcCropLabel");
        const meta = $("monFcBannerMeta");
        if (meta) meta.textContent = "PRATINJAU CROP 16:9";
        if (cropLabel) {
            const axisLabel = w / h > 16 / 9 ? "kiri ↔ kanan" : "atas ↔ bawah";
            cropLabel.textContent =
                `Ukuran asli ${w}×${h} dipaskan ke 16:9 HD (1600×900). Geser fokus (${axisLabel}) lalu simpan:`;
        }
        if (cropBox) cropBox.hidden = false;
    } catch (error) {
        clearPendingBannerCrop();
        toast(error.message, "error");
    }
}

async function handleRemoveBanner() {
    if (state.fcSaving || !state.freeCredit.banner_image_url) return;

    await setFreeCreditUiBusy(true);
    try {
        const res = await freeCreditApi("update-settings", {
            method: "POST",
            body: { banner_image_url: null }
        });
        clearPendingBannerCrop();
        await setFreeCreditUiBusy(false);
        renderFreeCredit(res.settings || { ...state.freeCredit, banner_image_url: null });
        toast("Gambar kustom dihapus. Kartu user kembali ke desain mewah bawaan.", "ok");
    } catch (error) {
        await setFreeCreditUiBusy(false);
        toast(error.message, "error");
    }
}

/* ---------------------------------------------------------
   MUAT DATA
   --------------------------------------------------------- */

function setLive(active, text) {
    const node = $("monLive");
    node.className = `mon-live${active ? "" : " mon-live--paused"}`;
    $("monLiveText").textContent = text;
}

async function refresh(options = {}) {
    if (state.busy) return;
    state.busy = true;

    const refreshButton = $("monRefresh");
    if (!options.silent) refreshButton.disabled = true;

    try {
        const data = await api("overview");

        if (data.available === false) {
            $("monHealthGrid").replaceChildren(el(
                "div",
                "mon-empty",
                data.message || "Tabel monitoring belum tersedia."
            ));
            $("monFindings").replaceChildren(el("div", "mon-empty", "Menunggu tabel monitoring."));
            setLive(false, "OFFLINE");
            return;
        }

        state.serverTime = data.server_time;
        renderSummary(data);
        renderHealth(data.health);
        renderFindings(data.findings);
        renderSettings(data.settings);
        if (data.free_credit) {
            renderFreeCredit(data.free_credit);
        }

        /* Kegagalan di sini tidak boleh ditelan diam-diam: dulu
           `.catch(() => ({ rows: [] }))` membuat panel log kosong
           tanpa penjelasan saat endpoint menolak permintaan. */
        let eventData = { rows: [] };
        try {
            eventData = await api("events", { query: { limit: state.logLimit } });
        } catch (error) {
            eventData = { rows: [], error: error.message };
        }

        const limitSelect = $("monLogLimit");
        if (limitSelect) limitSelect.value = String(state.logLimit);
        state.events = (eventData.rows || []).length ? eventData.rows : data.events;

        if (eventData.error && state.lastLogError !== eventData.error) {
            state.lastLogError = eventData.error;
            toast(`Log lengkap gagal dimuat: ${eventData.error}`, "error");
        } else if (!eventData.error) {
            state.lastLogError = "";
        }

        renderLog(state.events);
        renderAccess(state.events);

        setLive(true, "LIVE");
    } catch (error) {
        setLive(false, "PAUSED");
        toast(error.message, "error");
    } finally {
        state.busy = false;
        refreshButton.disabled = false;
    }
}

/* ---------------------------------------------------------
   DETAIL LOG
   --------------------------------------------------------- */

function formatFullTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";

    return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "long",
        timeStyle: "medium"
    }).format(date) + " WIB";
}

function detailRow(label, value) {
    const row = el("div", "mon-detail-row");
    row.append(el("span", "mon-detail-label", label));
    row.append(el(
        "span",
        "mon-detail-value",
        value === undefined || value === null || value === "" ? "—" : String(value)
    ));
    return row;
}

function detailSection(title, rows) {
    const box = el("section", "mon-detail-section");
    box.append(el("h3", "mon-detail-section-title", title));

    const list = el("div", "mon-detail-rows");
    for (const [label, value] of rows) list.append(detailRow(label, value));

    box.append(list);
    return box;
}

function placeOf(event) {
    return [event.city, event.region, event.country].filter(Boolean).join(", ") || "";
}

function renderDetail(data) {
    const event = data.event || {};
    const profile = data.profile || null;
    const related = data.related || {};

    $("monDetailTitle").textContent =
        `${(KIND_LABEL[event.kind] || event.kind || "aktivitas").toUpperCase()} · ${formatTime(event.occurred_at)} WIB`;

    const body = $("monDetailBody");
    body.replaceChildren();

    body.append(detailSection("Identitas Akun", [
        ["Email", profile?.email || ""],
        ["Nama", profile?.name || ""],
        ["Role", profile?.role ? profile.role.toUpperCase() : ""],
        ["User ID", event.user_id || ""],
        [
            "Status akun",
            profile
                ? (event.detail?.identity_verified
                    ? "terverifikasi lewat token sesi"
                    : "diklaim browser (belum terverifikasi)")
                : "belum login / tidak diketahui"
        ]
    ]));

    body.append(detailSection("Jaringan", [
        ["Alamat IP", event.ip || ""],
        ["Kota", event.city || ""],
        ["Provinsi / region", event.region || ""],
        ["Negara", event.country || ""],
        ["ASN", event.asn || ""],
        ["Colo Cloudflare", event.colo || ""],
        ["Akses IP ini (24 jam)", related.ip_events_24h ?? ""],
        ["Pertama terlihat (24 jam)", related.ip_first_seen_24h ? formatFullTime(related.ip_first_seen_24h) : ""],
        ["Terakhir terlihat (24 jam)", related.ip_last_seen_24h ? formatFullTime(related.ip_last_seen_24h) : ""]
    ]));

    body.append(detailSection("Perangkat & Browser", [
        ["Browser", event.browser || ""],
        ["Sistem operasi", event.os || ""],
        ["Tipe perangkat", event.device || ""],
        ["Viewport", event.detail?.viewport || ""],
        ["Resolusi layar", event.detail?.screen || ""],
        ["User agent", event.user_agent || ""]
    ]));

    body.append(detailSection("Halaman", [
        ["Path", event.path || ""],
        ["URL lengkap", event.detail?.href || ""],
        ["Referrer", event.detail?.referrer || ""],
        ["Online", event.detail?.online === undefined ? "" : event.detail.online ? "ya" : "tidak"]
    ]));

    body.append(detailSection("Kejadian", [
        ["Jenis", KIND_LABEL[event.kind] || event.kind || ""],
        ["Level", String(event.severity || "").toUpperCase()],
        ["Waktu", formatFullTime(event.occurred_at)],
        ["Pesan", event.message || ""],
        ["DevTools", event.devtools_open ? "TERBUKA" : "tertutup"],
        ["Session ID", event.session_id || ""],
        ["Event dalam sesi ini", related.session_events ?? ""],
        ["Lokasi ringkas", placeOf(event)]
    ]));

    if (data.remediation) {
        const fix = el("div", "mon-detail-fix");
        fix.append(el("strong", "", "CARA MENGATASI: "));
        fix.append(document.createTextNode(data.remediation));
        body.append(fix);
    }

    const raw = el("details", "mon-detail-raw");
    raw.append(el("summary", "", "Data mentah (JSON)"));
    const pre = el("pre", "mon-detail-pre", JSON.stringify(event.detail || {}, null, 2));
    raw.append(pre);
    body.append(raw);
}

async function openDetail(id) {
    const drawer = $("monDetail");
    if (!drawer) return;

    drawer.hidden = false;
    document.body.classList.add("mon-detail-open");
    $("monDetailTitle").textContent = "MEMUAT…";
    $("monDetailBody").replaceChildren(el("p", "mon-note", "Memuat detail…"));

    try {
        const data = await api("event", { query: { id } });
        renderDetail(data);
    } catch (error) {
        $("monDetailBody").replaceChildren(el("p", "mon-note", `Gagal memuat detail: ${error.message}`));
    }
}

function closeDetail() {
    const drawer = $("monDetail");
    if (!drawer || drawer.hidden) return;

    drawer.hidden = true;
    document.body.classList.remove("mon-detail-open");
}

/* ---------------------------------------------------------
   AKSI
   --------------------------------------------------------- */

async function runScan() {
    const button = $("monScan");
    button.disabled = true;
    button.textContent = "MEMERIKSA…";

    try {
        const result = await api("scan", { method: "POST", body: {} });
        const failed = (result.health || []).filter(check => check.status === "fail").length;
        const warned = (result.health || []).filter(check => check.status === "warn").length;

        toast(
            failed || warned
                ? `Pemeriksaan selesai: ${failed} gagal, ${warned} peringatan, ${result.findings?.length || 0} temuan.`
                : "Pemeriksaan selesai: semua layanan sehat.",
            failed ? "error" : "ok"
        );

        await refresh({ silent: true });
    } catch (error) {
        toast(error.message, "error");
    } finally {
        button.disabled = false;
        button.textContent = "Periksa sekarang";
    }
}

async function saveSettings() {
    const button = $("monSaveSettings");
    button.disabled = true;

    try {
        await api("update-settings", {
            method: "POST",
            body: {
                scan_interval_minutes: Number($("monInterval").value),
                retention_days: Number($("monRetention").value),
                max_events: Number($("monMaxEvents").value),
                devtools_alerts: $("monDevtoolsAlerts").checked,
                error_alerts: $("monErrorAlerts").checked
            }
        });

        toast("Jadwal pemeriksaan disimpan.");
        await refresh({ silent: true });
    } catch (error) {
        toast(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

async function purgeOldLogs() {
    const button = $("monPurge");
    button.disabled = true;

    try {
        const result = await api("purge", { method: "POST", body: {} });
        toast(`Log sebelum ${formatDateTime(result.cutoff)} dihapus.`);
        await refresh({ silent: true });
    } catch (error) {
        toast(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

/* ---------------------------------------------------------
   POLLING
   --------------------------------------------------------- */

function startPolling() {
    stopPolling();
    if (!$("monAuto").checked) {
        setLive(false, "PAUSED");
        return;
    }

    setLive(true, "LIVE");
    state.pollTimer = setInterval(() => {
        if (document.visibilityState === "visible") refresh({ silent: true });
    }, REFRESH_MS);
}

function stopPolling() {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }
}

function bindEvents() {
    $("monRefresh").addEventListener("click", () => refresh());

    $("monScan").addEventListener("click", runScan);
    $("monSaveSettings").addEventListener("click", saveSettings);
    $("monPurge").addEventListener("click", purgeOldLogs);

    if ($("monFcEnabledToggle")) {
        $("monFcEnabledToggle").addEventListener("change", () => {
            void handleToggleFreeCredit();
        });
    }
    for (const inputId of ["monFcAmountInput", "monFcStartsAt", "monFcEndsAt"]) {
        const node = $(inputId);
        if (node) {
            node.addEventListener("input", () => {
                state.fcDirty = true;
                syncFreeCreditLivePreview();
            });
            node.addEventListener("change", () => {
                state.fcDirty = true;
                syncFreeCreditLivePreview();
            });
        }
    }
    if ($("monFcNominalPresets")) {
        $("monFcNominalPresets").addEventListener("click", event => {
            const btn = event.target.closest("[data-fc-nominal]");
            if (!btn || !$("monFcAmountInput")) return;
            state.fcDirty = true;
            $("monFcAmountInput").value = String(btn.dataset.fcNominal || "5000");
            syncFreeCreditLivePreview();
        });
    }
    if ($("monFcDurationPresets")) {
        $("monFcDurationPresets").addEventListener("click", event => {
            const btn = event.target.closest("[data-fc-hours]");
            if (!btn) return;
            applyFreeCreditDurationPreset(Number(btn.dataset.fcHours || 0));
        });
    }
    if ($("monFcSaveEventBtn")) {
        $("monFcSaveEventBtn").addEventListener("click", () => {
            void handleSaveFreeCreditEventConfig();
        });
    }
    if ($("monFcUploadBtn") && $("monFcBannerInput")) {
        $("monFcUploadBtn").addEventListener("click", () => {
            $("monFcBannerInput").click();
        });
        $("monFcBannerInput").addEventListener("change", event => {
            void handleSelectBannerFile(event);
        });
    }
    if ($("monFcCropOffset")) {
        $("monFcCropOffset").addEventListener("input", () => {
            drawPendingCropToCanvas();
        });
    }
    if ($("monFcCropApply")) {
        $("monFcCropApply").addEventListener("click", () => {
            void uploadFreeCreditCanvas16x9();
        });
    }
    if ($("monFcCropCancel")) {
        $("monFcCropCancel").addEventListener("click", clearPendingBannerCrop);
    }
    if ($("monFcRemoveBannerBtn")) {
        $("monFcRemoveBannerBtn").addEventListener("click", () => {
            void handleRemoveBanner();
        });
    }

    $("monAuto").addEventListener("change", startPolling);

    $("monLogLimit").addEventListener("change", event => {
        const value = Number(event.target.value);

        state.logLimit = LOG_LIMIT_OPTIONS.includes(value) ? value : 50;

        try {
            window.localStorage?.setItem(LOG_LIMIT_STORAGE_KEY, String(state.logLimit));
        } catch {
            /* abaikan */
        }

        refresh({ silent: true });
    });

    $("monLogBody").addEventListener("click", event => {
        const row = event.target.closest("[data-event-id]");
        if (row) openDetail(row.dataset.eventId);
    });

    $("monLogBody").addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;

        const row = event.target.closest("[data-event-id]");
        if (!row) return;

        event.preventDefault();
        openDetail(row.dataset.eventId);
    });

    $("monDetailClose").addEventListener("click", closeDetail);

    $("monDetail").addEventListener("click", event => {
        if (event.target.dataset.detailClose) closeDetail();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeDetail();
    });

    $("monFilterRow").addEventListener("click", event => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;

        state.filter = button.dataset.filter;

        for (const item of $("monFilterRow").querySelectorAll("[data-filter]")) {
            item.setAttribute("aria-pressed", String(item === button));
        }

        renderLog(state.events);
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && $("monAuto").checked) {
            refresh({ silent: true });
        }
    });
}

function boot() {
    bindEvents();

    $("monLiveText").textContent = "MENGHUBUNGKAN…";

    refresh().finally(startPolling);
}

let booted = false;

function bootOnce() {
    if (booted) return;
    booted = true;
    boot();
}

window.addEventListener("genz:monitoring-allow", bootOnce, { once: true });

/* Kalau guard sudah membuka akses sebelum modul ini selesai dimuat. */
if (!document.body.classList.contains("bb-guard-pending")) {
    bootOnce();
}
