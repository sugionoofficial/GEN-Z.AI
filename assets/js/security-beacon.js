/*
 * =========================================================
 * GEN-Z.AI
 * BLACK BOX // SECURITY BEACON
 * ---------------------------------------------------------
 * File: assets/js/security-beacon.js
 * ---------------------------------------------------------
 * Penangkap aktivitas ringan untuk halaman MONITORING.
 *
 * Yang dikirim ke server (POST /api/monitoring?action=ingest):
 *   - page_view  : halaman dibuka (maksimal 1x per halaman per sesi)
 *   - error      : error JavaScript / promise yang gagal
 *   - devtools   : DevTools dibuka atau ditutup
 *
 * IP, negara, kota, ASN, dan colo TIDAK dikirim dari sini —
 * server mengisinya dari header & data Cloudflare supaya tidak
 * bisa dipalsukan.
 *
 * Catatan penting soal deteksi DevTools:
 *   Browser sengaja tidak memberi API resmi. Yang dipakai di sini
 *   adalah dua heuristik (selisih ukuran viewport dan getter pada
 *   objek console). Hasilnya *indikasi*, bukan bukti mutlak:
 *   bisa positif palsu pada zoom/panel samping, dan bisa negatif
 *   palsu bila DevTools dibuka dalam mode terpisah/docked tertentu.
 * =========================================================
 */

(function () {
    "use strict";

    var CONFIG = window.GENZ_MONITOR_CONFIG || {};
    var ENDPOINT = CONFIG.endpoint || "/api/monitoring?action=ingest";
    var SAMPLE_PAGE_VIEW = CONFIG.pageView !== false;
    var DEBOUNCE_MS = 4000;
    var MAX_REPORTS = 20;

    if (CONFIG.enabled === false) return;
    if (navigator.doNotTrack === "1") return;

    /* Bisa dimuat dua kali (tag halaman + injeksi navigation.js). */
    if (window.__GENZ_BEACON_ACTIVE) return;
    window.__GENZ_BEACON_ACTIVE = true;

    var sent = 0;
    var lastDevtools = null;
    var lastReportAt = 0;
    var sessionId = readSessionId();

    function readSessionId() {
        try {
            var key = "genz-monitor-session";
            var existing = window.sessionStorage.getItem(key);
            if (existing) return existing;
            var value = "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            window.sessionStorage.setItem(key, value);
            return value;
        } catch (error) {
            return "s_anon";
        }
    }

    /*
     * UUID akun yang sedang login, dibaca dari sesi Supabase di localStorage
     * (atau dari navigasi bila tersedia). Server hanya memakainya untuk
     * menampilkan email di halaman detail log — bukan untuk otorisasi.
     */
    var cachedUserId = null;

    function currentUserId() {
        if (cachedUserId !== null) return cachedUserId;
        cachedUserId = "";

        try {
            var fromNavigation = window.GENZ_NAVIGATION_USER && window.GENZ_NAVIGATION_USER.id;
            if (fromNavigation) {
                cachedUserId = String(fromNavigation);
                return cachedUserId;
            }

            var storage = window.localStorage;
            if (!storage) return cachedUserId;

            for (var index = 0; index < storage.length; index += 1) {
                var key = storage.key(index);
                if (!key || key.indexOf("sb-") !== 0 || key.indexOf("-auth-token") === -1) continue;

                var raw = storage.getItem(key);
                if (!raw) continue;

                var parsed = JSON.parse(raw);
                var user = parsed && (parsed.user || (parsed.currentSession && parsed.currentSession.user));
                if (user && user.id) {
                    cachedUserId = String(user.id);
                    return cachedUserId;
                }
            }
        } catch (error) {
            cachedUserId = "";
        }

        return cachedUserId;
    }

    function pageViewKey() {
        return "genz-monitor-seen:" + window.location.pathname;
    }

    function alreadySeen() {
        try {
            if (window.sessionStorage.getItem(pageViewKey())) return true;
            window.sessionStorage.setItem(pageViewKey(), "1");
            return false;
        } catch (error) {
            return false;
        }
    }

    function send(payload) {
        if (sent >= MAX_REPORTS) return;
        sent += 1;

        var body = JSON.stringify(payload);

        try {
            if (navigator.sendBeacon) {
                var blob = new Blob([body], { type: "application/json" });
                if (navigator.sendBeacon(ENDPOINT, blob)) return;
            }
        } catch (error) {
            /* lanjut ke fetch */
        }

        try {
            fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: body,
                keepalive: true,
                credentials: "same-origin"
            }).catch(function () {});
        } catch (error) {
            /* monitoring tidak boleh mengganggu halaman */
        }
    }

    function report(kind, options) {
        options = options || {};
        var now = Date.now();
        if (options.throttle !== false && now - lastReportAt < DEBOUNCE_MS) return;
        lastReportAt = now;

        send({
            kind: kind,
            severity: options.severity || (kind === "error" ? "error" : kind === "devtools" ? "warn" : "info"),
            path: window.location.pathname,
            message: String(options.message || "").slice(0, 500),
            detail: {
                href: window.location.href.slice(0, 300),
                referrer: String(document.referrer || "").slice(0, 300),
                viewport: window.innerWidth + "x" + window.innerHeight,
                screen: window.screen ? window.screen.width + "x" + window.screen.height : "",
                devtools: devtoolsState(),
                online: navigator.onLine
            },
            session_id: sessionId,
            user_id: currentUserId(),
            devtools_open: devtoolsState()
        });
    }

    /* -----------------------------------------------------
       DETEKSI DEVTOOLS
       ----------------------------------------------------- */

    var consoleOpened = false;
    var consoleProbeAt = 0;
    var consoleProbeDone = false;

    /* Getter hanya dipanggil saat console benar-benar memformat objek,
       jadi jejaknya dipakai sebagai bukti yang berlaku sesaat. */
    var CONSOLE_FRESH_MS = 15000;

    function isMobileViewport() {
        try {
            var width = window.innerWidth || 0;
            if (width && width < 900) {
                var coarse = window.matchMedia
                    ? window.matchMedia("(pointer: coarse)").matches
                    : false;
                var touch = (navigator.maxTouchPoints || 0) > 0;
                if (coarse || touch) return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    function probeConsoleGetter() {
        if (consoleProbeDone) return;
        consoleProbeDone = true;

        var probe = {};

        try {
            Object.defineProperty(probe, "id", {
                get: function () {
                    consoleOpened = true;
                    consoleProbeAt = Date.now();
                    return "genz-probe";
                }
            });
            /* DevTools yang memformat objek akan memicu getter di atas.
               Diberi label supaya di console tidak tampil sebagai "Object"
               polos dan tidak disangka error. */
            console.log("[GEN-Z.AI] probe DevTools", probe);
        } catch (error) {
            /* beberapa browser memblokir defineProperty pada objek console */
        }
    }

    function consoleSaysOpen() {
        return Boolean(consoleOpened) && (Date.now() - consoleProbeAt) < CONSOLE_FRESH_MS;
    }

    function devtoolsState() {
        try {
            /*
             * Di HP, address bar dan keyboard mengubah innerHeight, sehingga
             * selisih outerHeight-innerHeight bukan bukti DevTools. Contoh
             * nyata: layar 795 vs viewport 603 (selisih 192) hanya karena
             * address bar Chrome — dulu itu memicu alarm palsu.
             */
            if (isMobileViewport()) return consoleSaysOpen();

            var widthGap = (window.outerWidth || 0) - (window.innerWidth || 0);
            var heightGap = (window.outerHeight || 0) - (window.innerHeight || 0);
            var sizeSaysOpen = widthGap > 160 || heightGap > 160;

            return Boolean(sizeSaysOpen || consoleSaysOpen());
        } catch (error) {
            return false;
        }
    }

    function watchDevtools() {
        probeConsoleGetter();

        var timer = setInterval(function () {
            var open = devtoolsState();

            if (lastDevtools === null) {
                lastDevtools = open;
                if (open) report("devtools", { message: "DevTools terdeteksi terbuka saat halaman dimuat." });
                return;
            }

            if (open === lastDevtools) return;
            lastDevtools = open;
            report("devtools", {
                throttle: false,
                message: open
                    ? "DevTools dibuka pada halaman ini."
                    : "DevTools ditutup pada halaman ini."
            });
        }, 3000);

        /* Timer tidak perlu menahan halaman tetap hidup. */
        if (timer && typeof timer.unref === "function") timer.unref();
    }

    /* -----------------------------------------------------
       PENANGKAP ERROR
       ----------------------------------------------------- */

    window.addEventListener("error", function (event) {
        var target = event.target;
        var isResource = target && target !== window && target.tagName;
        report("error", {
            message: isResource
                ? "Gagal memuat aset: " + (target.src || target.href || target.tagName)
                : (event.message || "Error JavaScript tanpa pesan") +
                  (event.filename ? " @ " + event.filename + ":" + (event.lineno || 0) : ""),
            severity: "error"
        });
    }, true);

    window.addEventListener("unhandledrejection", function (event) {
        var reason = event.reason;
        report("error", {
            message: "Promise gagal: " + (reason && reason.message ? reason.message : String(reason || "unknown")),
            severity: "error"
        });
    });

    /* -----------------------------------------------------
       KIRIM PAGE VIEW
       ----------------------------------------------------- */

    if (SAMPLE_PAGE_VIEW && !alreadySeen()) {
        report("page_view", { throttle: false, severity: "info", message: "Halaman dibuka." });
    }

    watchDevtools();

    window.GENZMonitor = {
        report: report,
        devtoolsState: devtoolsState,
        sessionId: sessionId,
        userId: currentUserId,
        sentCount: function () { return sent; }
    };
})();
