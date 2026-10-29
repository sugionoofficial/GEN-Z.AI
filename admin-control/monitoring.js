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
const REFRESH_MS = 10000;

const state = {
    busy: false,
    filter: "all",
    events: [],
    accessRows: [],
    settings: null,
    serverTime: null,
    lastLogSignature: "",
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
    const response = await fetch(`${ENDPOINT}?action=${encodeURIComponent(action)}`, {
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
    const list = (findings || []).filter(item => item.status !== "resolved");
    const container = $("monFindings");
    container.replaceChildren();

    $("monFindingsMeta").textContent = list.length
        ? `${list.length} AKTIF`
        : "TIDAK ADA";

    if (list.length === 0) {
        container.append(el(
            "div",
            "mon-empty",
            "Tidak ada temuan aktif. Semua pemeriksaan terakhir dalam batas normal."
        ));
        return;
    }

    for (const item of list) {
        const card = el("div", `mon-finding mon-finding--${item.severity}`);

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
            ack.addEventListener("click", () => updateFinding(item.id, "acknowledged", ack));
            foot.append(ack);
        } else {
            foot.append(el("span", "mon-tag", "DIKETAHUI"));
        }

        const resolve = el("button", "mon-mini-btn", "Tandai selesai");
        resolve.type = "button";
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
        `${filtered.length} BARIS · ${state.filter.toUpperCase()}`;

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

    filtered.slice(0, 120).forEach((event, index) => {
        const row = el("tr");

        row.append(el("td", "mon-log-time", formatTime(event.occurred_at)));

        const levelCell = el("td");
        levelCell.append(el("span", `mon-level mon-level--${event.severity}`, event.severity));
        row.append(levelCell);

        row.append(el("td", "", KIND_LABEL[event.kind] || event.kind));
        row.append(el("td", "mon-log-time", event.path || "—"));
        row.append(el("td", "mon-ip", event.ip || "—"));

        const place = [event.city, event.country].filter(Boolean).join(", ") || "—";
        row.append(el("td", "", place));

        row.append(el("td", "mon-log-msg", event.message || "—"));

        if (isNew && index === 0) row.className = "mon-log-new";
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
                path: event.path || "—",
                hits: 1
            });
            continue;
        }

        current.hits += 1;
        if (new Date(event.occurred_at) > new Date(current.at)) {
            current.at = event.occurred_at;
            current.path = event.path || current.path;
        }
        if (event.devtools_open) current.devtools = true;
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
        row.append(el("td", "mon-ip", item.ip));

        const place = [item.city, item.country].filter(Boolean).join(", ") || "—";
        row.append(el("td", "", place));
        row.append(el("td", "mon-ip", item.asn || "—"));
        row.append(el("td", "", item.device || "—"));

        const devtoolsCell = el("td");
        devtoolsCell.append(el(
            "span",
            `mon-tag ${item.devtools ? "mon-tag--on" : "mon-tag--off"}`,
            item.devtools ? "TERBUKA" : "tertutup"
        ));
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

        const eventData = await api("events&limit=120").catch(() => ({ rows: [] }));
        state.events = (eventData.rows || []).length ? eventData.rows : data.events;

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

    $("monAuto").addEventListener("change", startPolling);

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
