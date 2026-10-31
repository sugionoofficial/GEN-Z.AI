/*
 * =========================================================
 * GEN-Z.AI
 * BLACK BOX // SECURITY BEACON & ANTI-DEVTOOLS LOCKDOWN
 * ---------------------------------------------------------
 * File: assets/js/security-beacon.js
 * ---------------------------------------------------------
 * Penangkap aktivitas ringan untuk halaman MONITORING sekaligus
 * pelindung anti-inspeksi DevTools bagi pengunjung selain OWNER.
 *
 * Yang dikirim ke server (POST /api/monitoring?action=ingest):
 *   - page_view  : halaman dibuka (maksimal 1x per halaman per sesi)
 *   - error      : error JavaScript / promise yang gagal
 *   - devtools   : DevTools dibuka / pintasan inspeksi ditekan
 *
 * IP, negara, kota, ASN, dan colo TIDAK dikirim sebagai klaim dari
 * browser — server mengisinya dari header & data Cloudflare supaya
 * tidak bisa dipalsukan, lalu mengembalikan metadata milik pemanggil
 * sendiri untuk ditampilkan pada layar penguncian putih bila akses
 * non-OWNER mencoba menangkap proses web dengan DevTools.
 * =========================================================
 */

(function () {
    "use strict";

    var CONFIG = window.GENZ_MONITOR_CONFIG || {};
    var ENDPOINT = CONFIG.endpoint || "/api/monitoring?action=ingest";
    var SAMPLE_PAGE_VIEW = CONFIG.pageView !== false;
    var DEBOUNCE_MS = 4000;
    var MAX_REPORTS = 20;
    var HACKER_IMAGE_SRC = "/assets/images/devtools-hacker-guard.jpg";
    var VIEWER_CACHE_KEY = "genz-monitor-viewer-v1";
    var PROFILE_CACHE_KEY = "genz-auth-profile-cache-v1";

    if (CONFIG.enabled === false) return;

    /* Bisa dimuat dua kali (tag halaman + injeksi navigation.js / genz-toast.js). */
    if (window.__GENZ_BEACON_ACTIVE) return;
    window.__GENZ_BEACON_ACTIVE = true;

    var doNotTrackEnabled = navigator.doNotTrack === "1";

    /* Simpan referensi asli sebelum jendela jaringan diputus saat lockdown. */
    var nativeFetch = typeof fetch === "function" ? fetch : null;

    /* Preload ilustrasi hacker lebih awal ke memori browser (aman di VM tanpa Image). */
    var preloadedHackerImage = null;
    try {
        if (typeof Image === "function") {
            preloadedHackerImage = new Image();
            preloadedHackerImage.decoding = "async";
            preloadedHackerImage.src = HACKER_IMAGE_SRC;
        }
    } catch (error) {
        preloadedHackerImage = null;
    }

    var sent = 0;
    var lastDevtools = null;
    var lastReportAt = 0;
    var sessionId = readSessionId();

    /* Status verifikasi role & pengaturan lockdown dari server. */
    var lockdownSettingEnabled = CONFIG.devtoolsLockdown !== false;
    var serverRoleResolved = false;
    var serverVerifiedOwner = false;
    var lockdownActive = false;
    var lockdownPending = false;
    var lastLockdownSnapshot = null;
    var devtoolsWatchTimer = null;

    var serverViewer = {
        is_owner: false,
        role: "",
        email: "",
        ip: "",
        city: "",
        region: "",
        country: "",
        asn: "",
        colo: "",
        browser: "",
        os: "",
        device: ""
    };

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

    function readStoredAuthSession() {
        var result = { userId: "", email: "", accessToken: "" };

        try {
            var navUser = window.GENZ_NAVIGATION_USER;
            if (navUser && navUser.id) {
                result.userId = String(navUser.id);
                if (navUser.email) result.email = String(navUser.email);
            }

            var storage = window.localStorage;
            if (!storage) return result;

            if (typeof storage.length === "number" && typeof storage.key === "function") {
                for (var index = 0; index < storage.length; index += 1) {
                    var key = storage.key(index);
                    if (!key || key.indexOf("sb-") !== 0 || key.indexOf("-auth-token") === -1) continue;

                    var raw = storage.getItem(key);
                    if (!raw) continue;

                    var parsed = JSON.parse(raw);
                    var sessionObj = parsed && (parsed.currentSession || parsed);
                    var user = parsed && (parsed.user || (sessionObj && sessionObj.user));

                    if (!result.userId && user && user.id) {
                        result.userId = String(user.id);
                    }
                    if (!result.email && user && user.email) {
                        result.email = String(user.email);
                    }
                    if (!result.accessToken && sessionObj && typeof sessionObj.access_token === "string") {
                        result.accessToken = sessionObj.access_token;
                    }
                    if (result.userId && result.accessToken) break;
                }
            }

            if (!result.accessToken && typeof storage.getItem === "function") {
                var backupRaw = storage.getItem("genz-auth-session-v1");
                if (backupRaw) {
                    var backup = JSON.parse(backupRaw);
                    if (!result.accessToken && backup && typeof backup.access_token === "string") {
                        result.accessToken = backup.access_token;
                    }
                    if (!result.userId && backup && backup.user && backup.user.id) {
                        result.userId = String(backup.user.id);
                    }
                    if (!result.email && backup && backup.user && backup.user.email) {
                        result.email = String(backup.user.email);
                    }
                }
            }
        } catch (error) {
            /* abaikan kegagalan baca storage */
        }

        return result;
    }

    /*
     * UUID akun yang sedang login, dibaca dari sesi Supabase di localStorage
     * (atau dari navigasi bila tersedia). Server memverifikasi Bearer token
     * bila dikirim agar role OWNER asli tervalidasi secara kriptografis.
     */
    var cachedUserId = null;

    function currentUserId() {
        if (cachedUserId !== null) return cachedUserId;

        var info = readStoredAuthSession();
        cachedUserId = info.userId || "";
        return cachedUserId;
    }

    function readLocalRoleHint() {
        try {
            var navRole = String(window.GENZ_NAVIGATION_ROLE || "").trim().toLowerCase();
            if (navRole) return navRole;

            var navProfile = window.GENZ_NAVIGATION_PROFILE || window.GENZ_CURRENT_PROFILE;
            if (navProfile && navProfile.role) {
                return String(navProfile.role).trim().toLowerCase();
            }

            if (window.localStorage && typeof window.localStorage.getItem === "function") {
                var rawProfile = window.localStorage.getItem(PROFILE_CACHE_KEY);
                if (rawProfile) {
                    var parsedProfile = JSON.parse(rawProfile);
                    var cachedProfile = parsedProfile && (parsedProfile.profile || parsedProfile);
                    var expectedUid = currentUserId();
                    if (
                        cachedProfile &&
                        cachedProfile.role &&
                        (!expectedUid || !cachedProfile.id || String(cachedProfile.id) === expectedUid)
                    ) {
                        return String(cachedProfile.role).trim().toLowerCase();
                    }
                }
            }
        } catch (error) {
            /* abaikan cache profil korup */
        }
        return "";
    }

    function restoreViewerCache() {
        try {
            if (!window.sessionStorage || typeof window.sessionStorage.getItem !== "function") return;
            var raw = window.sessionStorage.getItem(VIEWER_CACHE_KEY);
            if (!raw) return;
            var cached = JSON.parse(raw);
            if (!cached || typeof cached !== "object") return;

            var uid = currentUserId();
            if (String(cached.uid || "") !== String(uid || "")) return;

            if (typeof cached.devtools_lockdown === "boolean") {
                lockdownSettingEnabled = cached.devtools_lockdown;
            }
            if (cached.viewer && typeof cached.viewer === "object") {
                applyServerViewer(cached.viewer, cached.devtools_lockdown);
            }
        } catch (error) {
            /* abaikan cache sesi */
        }
    }

    function persistViewerCache() {
        try {
            if (!window.sessionStorage || typeof window.sessionStorage.setItem !== "function") return;
            window.sessionStorage.setItem(
                VIEWER_CACHE_KEY,
                JSON.stringify({
                    uid: currentUserId(),
                    devtools_lockdown: lockdownSettingEnabled,
                    viewer: serverViewer
                })
            );
        } catch (error) {
            /* abaikan bila sessionStorage penuh */
        }
    }

    function applyServerViewer(viewer, lockdownFlag) {
        if (typeof lockdownFlag === "boolean") {
            lockdownSettingEnabled = lockdownFlag;
        }
        if (!viewer || typeof viewer !== "object") return;

        serverViewer = {
            is_owner: Boolean(viewer.is_owner),
            role: String(viewer.role || serverViewer.role || ""),
            email: String(viewer.email || serverViewer.email || ""),
            ip: String(viewer.ip || serverViewer.ip || ""),
            city: String(viewer.city || serverViewer.city || ""),
            region: String(viewer.region || serverViewer.region || ""),
            country: String(viewer.country || serverViewer.country || ""),
            asn: String(viewer.asn || serverViewer.asn || ""),
            colo: String(viewer.colo || serverViewer.colo || ""),
            browser: String(viewer.browser || serverViewer.browser || ""),
            os: String(viewer.os || serverViewer.os || ""),
            device: String(viewer.device || serverViewer.device || "")
        };

        serverRoleResolved = true;
        serverVerifiedOwner = Boolean(viewer.is_owner);
        persistViewerCache();

        if (lockdownActive) {
            refreshLockdownDomDetails();
        }
    }

    /*
     * Hanya role OWNER yang tetap diizinkan membuka / memakai DevTools.
     * Begitu server selesai memverifikasi sesi, hasil server menjadi
     * satu-satunya acuan sehingga manipulasi localStorage tidak mempan.
     */
    function isOwnerViewer() {
        if (CONFIG.forceNonOwner === true) return false;
        if (serverRoleResolved) return Boolean(serverVerifiedOwner);
        return readLocalRoleHint() === "owner";
    }

    function isLockdownApplicable() {
        if (!lockdownSettingEnabled) return false;
        if (isOwnerViewer()) return false;
        return true;
    }

    restoreViewerCache();

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

    function send(payload, options) {
        options = options || {};
        if (!options.force && sent >= MAX_REPORTS) return Promise.resolve(null);
        sent += 1;

        var body = JSON.stringify(payload);
        var authInfo = readStoredAuthSession();
        var headers = { "Content-Type": "application/json" };
        if (authInfo.accessToken) {
            headers.Authorization = "Bearer " + authInfo.accessToken;
        }

        if (nativeFetch) {
            try {
                var reqPromise = nativeFetch(ENDPOINT, {
                    method: "POST",
                    headers: headers,
                    body: body,
                    keepalive: true,
                    credentials: "same-origin"
                });

                if (reqPromise && typeof reqPromise.then === "function") {
                    return reqPromise
                        .then(function (response) {
                            if (!response || typeof response.text !== "function") return null;
                            return response.text().then(function (rawText) {
                                if (!rawText) return null;
                                try {
                                    var parsed = JSON.parse(rawText);
                                    if (parsed && typeof parsed === "object") {
                                        applyServerViewer(parsed.viewer, parsed.devtools_lockdown);
                                    }
                                    return parsed;
                                } catch (parseErr) {
                                    return null;
                                }
                            });
                        })
                        .catch(function () {
                            trySendBeaconFallback(body);
                            return null;
                        });
                }
            } catch (error) {
                /* jatuh ke sendBeacon */
            }
        }

        trySendBeaconFallback(body);
        return Promise.resolve(null);
    }

    function trySendBeaconFallback(body) {
        try {
            if (navigator.sendBeacon) {
                var blob = typeof Blob === "function"
                    ? new Blob([body], { type: "application/json" })
                    : body;
                navigator.sendBeacon(ENDPOINT, blob);
            }
        } catch (error) {
            /* monitoring tidak boleh melempar error ke halaman */
        }
    }

    function report(kind, options) {
        options = options || {};
        var now = Date.now();
        if (options.throttle !== false && now - lastReportAt < DEBOUNCE_MS) {
            return Promise.resolve(null);
        }
        lastReportAt = now;

        return send(
            {
                kind: kind,
                severity: options.severity || (kind === "error" ? "error" : kind === "devtools" ? "warn" : "info"),
                path: window.location.pathname,
                message: String(options.message || "").slice(0, 500),
                detail: {
                    href: String((window.location && window.location.href) || "").slice(0, 300),
                    referrer: String(document.referrer || "").slice(0, 300),
                    viewport: window.innerWidth + "x" + window.innerHeight,
                    screen: window.screen ? window.screen.width + "x" + window.screen.height : "",
                    devtools: devtoolsState(),
                    lockdown: Boolean(options.lockdown || lockdownActive),
                    trigger: options.trigger ? String(options.trigger).slice(0, 80) : undefined,
                    online: navigator.onLine
                },
                session_id: sessionId,
                user_id: currentUserId(),
                devtools_open: options.devtoolsOpen !== undefined ? Boolean(options.devtoolsOpen) : devtoolsState()
            },
            { force: Boolean(options.force) }
        );
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
                    if (!lockdownActive) {
                        scheduleLockdownCheck("Console Inspector Probe");
                    }
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

            /*
             * Ambang 160 px terlalu rapat: pada layar 1920x1080 dengan jendela
             * maksimal, selisih tinggi toolbar saja sudah ~150-190 px sehingga
             * status bisa berkedip buka/tutup tanpa DevTools. DevTools yang
             * benar-benar dock menyusutkan lebar konten minimal ~280 px.
             */
            var sizeSaysOpen = widthGap > 280 || heightGap > 240;

            return Boolean(sizeSaysOpen || consoleSaysOpen());
        } catch (error) {
            return false;
        }
    }

    /* -----------------------------------------------------
       PEMUTUS KONEKSI & LAYAR PUTIH PERINGATAN HACKER
       ----------------------------------------------------- */

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function parseClientAgentFallback(ua) {
        var text = String(ua || "");
        var browser = /Edg\//i.test(text)
            ? "Edge"
            : /OPR\/|Opera/i.test(text)
            ? "Opera"
            : /Firefox\//i.test(text)
            ? "Firefox"
            : /Chrome\/|CriOS\//i.test(text)
            ? "Chrome"
            : /Safari\//i.test(text)
            ? "Safari"
            : "Unknown";
        var os = /Windows/i.test(text)
            ? "Windows"
            : /Android/i.test(text)
            ? "Android"
            : /iPhone|iPad|iPod/i.test(text)
            ? "iOS"
            : /Mac OS X|Macintosh/i.test(text)
            ? "macOS"
            : /Linux/i.test(text)
            ? "Linux"
            : "Unknown";
        var device = /Mobile|Android|iPhone|iPad|iPod/i.test(text) ? "Mobile" : "Desktop";
        return { browser: browser, os: os, device: device };
    }

    function buildIntruderDetails(triggerReason) {
        var ua = String((navigator && navigator.userAgent) || "Tidak terdeteksi");
        var fallbackAgent = parseClientAgentFallback(ua);
        var authInfo = readStoredAuthSession();
        var locationParts = [];
        if (serverViewer.city) locationParts.push(serverViewer.city);
        if (serverViewer.region && serverViewer.region !== serverViewer.city) {
            locationParts.push(serverViewer.region);
        }
        if (serverViewer.country) locationParts.push(serverViewer.country);

        var networkParts = [];
        if (serverViewer.asn) networkParts.push(serverViewer.asn);
        if (serverViewer.colo) networkParts.push("Edge " + serverViewer.colo);

        var roleLabel = String(
            serverViewer.role ||
            readLocalRoleHint() ||
            (authInfo.userId ? "user" : "guest")
        ).toUpperCase();

        var identityLabel = serverViewer.email || authInfo.email || authInfo.userId || "Guest (Tanpa Login)";
        var timezone = "";
        try {
            timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        } catch (error) {
            timezone = "";
        }

        var rawHref = String((window.location && window.location.href) || "");
        var safeUrl = cleanAssetUrl(rawHref) || String((window.location && window.location.pathname) || "/");
        var host = extractHost(rawHref) || String((window.location && window.location.hostname) || "-");

        var timestampText = "";
        try {
            timestampText = new Date(Date.now()).toISOString().replace("T", " ").slice(0, 19) + " UTC";
        } catch (error) {
            timestampText = "-";
        }

        return {
            ip: serverViewer.ip || "Mendeteksi IP publik...",
            location: locationParts.length ? locationParts.join(", ") : "Mendeteksi lokasi jaringan...",
            network: networkParts.length ? networkParts.join(" • ") : "Cloudflare Edge Protection",
            connectionStatus: "TERPUTUS — ERR_INTERNET_DISCONNECTED",
            targetUrl: safeUrl,
            hostAndPath: host + String((window.location && window.location.pathname) || "/"),
            account: identityLabel + " (Role: " + roleLabel + ")",
            sessionId: sessionId,
            system:
                (serverViewer.browser || fallbackAgent.browser) +
                " • " +
                (serverViewer.os || fallbackAgent.os) +
                " • " +
                (serverViewer.device || fallbackAgent.device),
            userAgent: ua,
            displayInfo:
                "Layar " +
                (window.screen ? window.screen.width + "x" + window.screen.height : "-") +
                " • Viewport " +
                (window.innerWidth || 0) +
                "x" +
                (window.innerHeight || 0) +
                (navigator.language ? " • " + navigator.language : "") +
                (timezone ? " • " + timezone : ""),
            trigger: String(triggerReason || "DevTools Inspection") + " • " + timestampText
        };
    }

    function createNoConnectionError() {
        return new TypeError("Failed to fetch: ERR_INTERNET_DISCONNECTED — Tidak ada koneksi ke layanan.");
    }

    function severPageConnections() {
        window.__GENZ_DEVTOOLS_LOCKDOWN_ACTIVE = true;

        try {
            if (devtoolsWatchTimer) {
                clearInterval(devtoolsWatchTimer);
                devtoolsWatchTimer = null;
            }
        } catch (error) {
            /* abaikan */
        }

        try {
            if (typeof window.stop === "function") {
                window.stop();
            }
        } catch (error) {
            /* abaikan */
        }

        /* Putus semua pemanggilan fetch halaman setelah laporan terkirim. */
        try {
            var blockedFetch = function () {
                return Promise.reject(createNoConnectionError());
            };
            window.fetch = blockedFetch;
        } catch (error) {
            /* abaikan */
        }

        /* Putus XMLHttpRequest supaya halaman tidak dapat menarik API apa pun. */
        try {
            if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
                window.XMLHttpRequest.prototype.open = function () {
                    this.__genzBlocked = true;
                };
                window.XMLHttpRequest.prototype.send = function () {
                    var self = this;
                    setTimeout(function () {
                        try {
                            if (typeof self.onerror === "function") {
                                self.onerror(new Error("ERR_INTERNET_DISCONNECTED"));
                            }
                            if (typeof self.onloadend === "function") {
                                self.onloadend();
                            }
                            if (typeof self.dispatchEvent === "function" && typeof Event === "function") {
                                self.dispatchEvent(new Event("error"));
                            }
                        } catch (err) {
                            /* abaikan */
                        }
                    }, 0);
                };
            }
        } catch (error) {
            /* abaikan */
        }

        /* Putus WebSocket & EventSource agar stream waktu-nyata juga berhenti. */
        try {
            if (window.WebSocket) {
                window.WebSocket = function () {
                    throw createNoConnectionError();
                };
            }
            if (window.EventSource) {
                window.EventSource = function () {
                    throw createNoConnectionError();
                };
            }
        } catch (error) {
            /* abaikan */
        }
    }

    function inlineHackerSvgMarkup() {
        return (
            '<svg viewBox="0 0 360 230" width="320" height="204" role="img" aria-label="Ilustrasi Hacker Terdeteksi" style="display:block;margin:0 auto;max-width:100%;height:auto;">' +
            '<rect width="360" height="230" fill="#ffffff"/>' +
            '<ellipse cx="185" cy="204" rx="118" ry="10" fill="#f1f5f9"/>' +
            '<path d="M132 184 L268 184 L254 122 C248 99 230 88 205 88 L175 88 C150 88 136 102 132 126 Z" fill="#111827"/>' +
            '<path d="M150 96 C150 52 174 30 198 30 C224 30 244 54 244 96 C244 122 228 142 198 142 C168 142 150 122 150 96 Z" fill="#0f172a"/>' +
            '<path d="M163 95 C163 67 178 49 197 49 C216 49 231 67 231 95 C231 116 218 131 197 131 C176 131 163 116 163 95 Z" fill="#020617" stroke="#ea580c" stroke-width="2"/>' +
            '<rect x="178" y="84" width="12" height="4" rx="2" fill="#f97316"/>' +
            '<rect x="203" y="84" width="12" height="4" rx="2" fill="#f97316"/>' +
            '<path d="M84 122 L156 122 L171 182 L99 182 Z" fill="#0f172a" stroke="#334155" stroke-width="2"/>' +
            '<circle cx="127" cy="152" r="7" fill="#ef4444"/>' +
            '<path d="M97 182 L212 182 L222 190 L92 190 Z" fill="#1e293b"/>' +
            '<path d="M72 192 L292 192" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/>' +
            '</svg>'
        );
    }

    function buildLockdownHtml(details) {
        var rows = [
            ["Status Jaringan", details.connectionStatus, "genz-lockdown-status", true],
            ["Alamat IP Publik", details.ip, "genz-lockdown-ip", false],
            ["Lokasi Geografis", details.location, "genz-lockdown-location", false],
            ["Jaringan / ASN", details.network, "genz-lockdown-network", false],
            ["Halaman Web Target", details.targetUrl, "genz-lockdown-url", false],
            ["Host & Path", details.hostAndPath, "genz-lockdown-host", false],
            ["Identitas Sesi", details.account, "genz-lockdown-account", false],
            ["ID Sesi", details.sessionId, "genz-lockdown-session", false],
            ["Browser & Sistem", details.system, "genz-lockdown-system", false],
            ["Resolusi & Viewport", details.displayInfo, "genz-lockdown-display", false],
            ["User-Agent", details.userAgent, "genz-lockdown-ua", false],
            ["Pemicu & Waktu", details.trigger, "genz-lockdown-trigger", false]
        ];

        var tableHtml = "";
        for (var i = 0; i < rows.length; i += 1) {
            var item = rows[i];
            var valueColor = item[3] ? "#dc2626" : "#0f172a";
            var valueWeight = item[3] ? "700" : "500";
            tableHtml +=
                '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;padding:10px 14px;border-bottom:1px solid #e2e8f0;background:' +
                (i % 2 === 0 ? "#ffffff" : "#f8fafc") +
                ';">' +
                '<span style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;min-width:155px;">' +
                escapeHtml(item[0]) +
                "</span>" +
                '<span id="' +
                escapeHtml(item[2]) +
                '" style="font-size:12.5px;font-weight:' +
                valueWeight +
                ";color:" +
                valueColor +
                ';font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;word-break:break-all;flex:1;text-align:right;">' +
                escapeHtml(item[1]) +
                "</span>" +
                "</div>";
        }

        return (
            '<div id="genz-devtools-lockdown-screen" role="alert" aria-live="assertive" style="min-height:100vh;width:100%;box-sizing:border-box;background:#ffffff;color:#0f172a;padding:28px 18px 44px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">' +
            '<div style="width:100%;max-width:680px;text-align:center;background:#ffffff;">' +
            '<div style="margin:0 auto 10px;max-width:340px;background:#ffffff;">' +
            '<img id="genz-lockdown-hacker-img" src="' +
            escapeHtml(HACKER_IMAGE_SRC) +
            '" alt="Ilustrasi Keamanan Hacker" style="display:block;width:100%;max-width:340px;height:auto;margin:0 auto;background:#ffffff;user-select:none;-webkit-user-drag:none;" />' +
            '<div id="genz-lockdown-hacker-svg" style="display:none;background:#ffffff;">' +
            inlineHackerSvgMarkup() +
            "</div>" +
            "</div>" +
            '<div style="display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:999px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:11.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">' +
            "<span>●</span><span>TIDAK ADA KONEKSI • AKSES DIHENTIKAN</span>" +
            "</div>" +
            '<h1 style="margin:0 0 8px;font-size:21px;line-height:1.3;font-weight:800;color:#0f172a;">' +
            "Halaman Tidak Dapat Bekerja — Inspeksi DevTools Terdeteksi" +
            "</h1>" +
            '<p style="margin:0 auto 20px;max-width:560px;font-size:13.5px;line-height:1.6;color:#475569;">' +
            "Koneksi halaman ke server telah diputus secara otomatis karena terdeteksi percobaan menangkap proses web menggunakan Developer Tools. Detail jaringan dan perangkat Anda tercatat di bawah ini." +
            "</p>" +
            '<div style="text-align:left;border:1px solid #cbd5e1;border-radius:14px;overflow:hidden;background:#ffffff;box-shadow:0 8px 24px rgba(15,23,42,0.05);">' +
            '<div style="padding:11px 14px;background:#f1f5f9;border-bottom:1px solid #cbd5e1;display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
            '<span style="font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#0f172a;">DETAIL IP &amp; WEB DETAIL PERCOBAAN DEVTOOLS</span>' +
            '<span style="font-size:11px;font-weight:700;color:#dc2626;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">CONNECTION_LOST</span>' +
            "</div>" +
            tableHtml +
            "</div>" +
            '<div style="margin-top:18px;">' +
            '<button id="genz-lockdown-reload-btn" type="button" style="cursor:pointer;padding:10px 20px;border-radius:10px;border:1px solid #0f172a;background:#0f172a;color:#ffffff;font-size:13px;font-weight:700;">' +
            "Tutup DevTools &amp; Muat Ulang Halaman" +
            "</button>" +
            "</div>" +
            "</div>" +
            "</div>"
        );
    }

    function refreshLockdownDomDetails() {
        if (!lockdownActive || !lastLockdownSnapshot) return;
        var updated = buildIntruderDetails(lastLockdownSnapshot.reason);
        lastLockdownSnapshot.details = updated;

        try {
            if (!document || typeof document.getElementById !== "function") return;
            var map = {
                "genz-lockdown-ip": updated.ip,
                "genz-lockdown-location": updated.location,
                "genz-lockdown-network": updated.network,
                "genz-lockdown-account": updated.account,
                "genz-lockdown-system": updated.system
            };
            var ids = Object.keys(map);
            for (var i = 0; i < ids.length; i += 1) {
                var el = document.getElementById(ids[i]);
                if (el) el.textContent = map[ids[i]];
            }
        } catch (error) {
            /* abaikan di lingkungan non-DOM */
        }
    }

    function renderWhiteLockdownScreen(triggerReason) {
        var details = buildIntruderDetails(triggerReason);
        lastLockdownSnapshot = {
            reason: String(triggerReason || "DevTools Inspection"),
            at: Date.now(),
            details: details
        };

        try {
            if (!document || !document.body) return;

            /* Matikan semua elemen media aktif sebelum DOM dibersihkan. */
            if (typeof document.querySelectorAll === "function") {
                var mediaList = document.querySelectorAll("video, audio");
                for (var m = 0; m < mediaList.length; m += 1) {
                    try {
                        if (typeof mediaList[m].pause === "function") mediaList[m].pause();
                        mediaList[m].src = "";
                    } catch (mediaErr) {
                        /* abaikan */
                    }
                }
            }

            document.title = "Tidak Ada Koneksi — Akses Dihentikan";

            if (document.documentElement && document.documentElement.style) {
                document.documentElement.style.cssText =
                    "background:#ffffff !important;background-image:none !important;color:#0f172a !important;color-scheme:light !important;min-height:100% !important;overflow-y:auto !important;";
            }

            document.body.className = "";
            if (document.body.style) {
                document.body.style.cssText =
                    "margin:0 !important;padding:0 !important;min-height:100vh !important;background:#ffffff !important;background-image:none !important;color:#0f172a !important;display:block !important;visibility:visible !important;opacity:1 !important;";
            }

            document.body.innerHTML = buildLockdownHtml(details);

            if (typeof document.getElementById === "function") {
                var imgEl = document.getElementById("genz-lockdown-hacker-img");
                var svgFallbackEl = document.getElementById("genz-lockdown-hacker-svg");
                if (imgEl && svgFallbackEl) {
                    imgEl.onerror = function () {
                        imgEl.style.display = "none";
                        svgFallbackEl.style.display = "block";
                    };
                }

                var reloadBtn = document.getElementById("genz-lockdown-reload-btn");
                if (reloadBtn) {
                    reloadBtn.onclick = function () {
                        if (window.location && typeof window.location.reload === "function") {
                            window.location.reload();
                        }
                    };
                }
            }
        } catch (error) {
            /* aman bila document di-mock terbatas */
        }
    }

    function executeLockdownNow(triggerReason) {
        if (lockdownActive) return;
        if (!isLockdownApplicable()) return;

        lockdownActive = true;
        lockdownPending = false;

        /* Kirim bukti ke BLACK BOX lebih dulu lewat nativeFetch sebelum koneksi halaman diputus. */
        report("devtools", {
            throttle: false,
            force: true,
            lockdown: true,
            devtoolsOpen: true,
            trigger: triggerReason,
            message: "DevTools / inspeksi terdeteksi (" + triggerReason + ") — koneksi halaman non-OWNER diputus."
        });

        renderWhiteLockdownScreen(triggerReason);
        severPageConnections();
    }

    function scheduleLockdownCheck(triggerReason) {
        if (lockdownActive || lockdownPending) return;
        if (!isLockdownApplicable()) return;

        var authInfo = readStoredAuthSession();

        /*
         * Jika pengunjung memiliki token login tetapi role server belum selesai
         * diverifikasi pada tab baru, verifikasi dulu ke server (~100ms) agar
         * akun OWNER asli tidak pernah terkunci secara keliru di milidetik awal.
         */
        if (authInfo.accessToken && !serverRoleResolved) {
            lockdownPending = true;
            report("devtools", {
                throttle: false,
                force: true,
                devtoolsOpen: true,
                trigger: triggerReason,
                message: "Memverifikasi izin DevTools (" + triggerReason + ")."
            }).then(function () {
                lockdownPending = false;
                if (isLockdownApplicable()) {
                    executeLockdownNow(triggerReason);
                }
            });
            return;
        }

        executeLockdownNow(triggerReason);
    }

    /* -----------------------------------------------------
       BLOKIR PINTASAN KEYBOARD DEVTOOLS & KLIK KANAN INSPECT
       ----------------------------------------------------- */

    function isEditableElement(target) {
        if (!target || typeof target !== "object") return false;
        var tag = String(target.tagName || "").toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
        if (target.isContentEditable) return true;
        return false;
    }

    function detectForbiddenShortcut(event) {
        if (!event) return "";
        var key = String(event.key || "").toUpperCase();
        var code = Number(event.keyCode || event.which || 0);
        var ctrlOrMeta = Boolean(event.ctrlKey || event.metaKey);
        var shiftOrAlt = Boolean(event.shiftKey || event.altKey);

        if (key === "F12" || code === 123) {
            return "Shortcut F12";
        }

        if (ctrlOrMeta && shiftOrAlt && (key === "I" || code === 73)) {
            return "Shortcut Inspect (Ctrl/Cmd+Shift+I)";
        }
        if (ctrlOrMeta && shiftOrAlt && (key === "J" || code === 74)) {
            return "Shortcut Console (Ctrl/Cmd+Shift+J)";
        }
        if (ctrlOrMeta && shiftOrAlt && (key === "C" || code === 67)) {
            return "Shortcut Element Picker (Ctrl/Cmd+Shift+C)";
        }
        if (ctrlOrMeta && !event.shiftKey && !event.altKey && (key === "U" || code === 85)) {
            return "Shortcut View Source (Ctrl/Cmd+U)";
        }

        return "";
    }

    function stopDomEvent(event) {
        if (!event) return;
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    function bindAntiInspectGuards() {
        window.addEventListener(
            "keydown",
            function (event) {
                if (!isLockdownApplicable()) return;
                var shortcutReason = detectForbiddenShortcut(event);
                if (!shortcutReason) return;

                stopDomEvent(event);
                scheduleLockdownCheck(shortcutReason);
            },
            true
        );

        document.addEventListener(
            "contextmenu",
            function (event) {
                if (!isLockdownApplicable()) return;
                if (!lockdownActive && isEditableElement(event && event.target)) return;
                stopDomEvent(event);
            },
            true
        );
    }

    function watchDevtools() {
        probeConsoleGetter();

        var pendingDevtools = null;
        var pendingTicks = 0;

        devtoolsWatchTimer = setInterval(function () {
            if (lockdownActive) return;

            var open = devtoolsState();

            if (lastDevtools === null) {
                lastDevtools = open;
                if (open) {
                    if (isLockdownApplicable()) {
                        scheduleLockdownCheck("DevTools Terbuka Saat Halaman Dimuat");
                    } else {
                        report("devtools", { message: "DevTools terdeteksi terbuka saat halaman dimuat." });
                    }
                }
                return;
            }

            if (open === lastDevtools) {
                pendingDevtools = null;
                pendingTicks = 0;
                return;
            }

            /*
             * Perubahan harus bertahan dua pemeriksaan sebelum ditindak.
             * Address bar HP, toolbar, atau keyboard yang menyusutkan
             * viewport sesaat tidak akan memicu penguncian palsu.
             */
            if (pendingDevtools !== open) {
                pendingDevtools = open;
                pendingTicks = 1;
                return;
            }

            pendingTicks += 1;
            if (pendingTicks < 2) return;

            pendingDevtools = null;
            pendingTicks = 0;
            lastDevtools = open;

            if (open && isLockdownApplicable()) {
                scheduleLockdownCheck("Docked DevTools Terdeteksi");
                return;
            }

            report("devtools", {
                throttle: false,
                message: open
                    ? "DevTools dibuka pada halaman ini."
                    : "DevTools ditutup pada halaman ini."
            });
        }, 1200);

        /* Timer tidak perlu menahan halaman tetap hidup. */
        if (devtoolsWatchTimer && typeof devtoolsWatchTimer.unref === "function") {
            devtoolsWatchTimer.unref();
        }
    }

    /* -----------------------------------------------------
       PENANGKAP ERROR
       ----------------------------------------------------- */

    var EXTENSION_ORIGIN = /(?:chrome|moz|safari|safari-web|ms-browser|edge|opera)-extension:\/\/|^chrome:\/\/|^moz-extension:\/\//i;

    function looksLikeExtension() {
        for (var i = 0; i < arguments.length; i += 1) {
            var text = String(arguments[i] || "");
            if (text && EXTENSION_ORIGIN.test(text)) return true;
        }
        return false;
    }

    function rejectionStack(reason) {
        if (!reason) return "";
        if (typeof reason === "object") return String(reason.stack || "") + " " + String(reason.message || "");
        return "";
    }

    var MEDIA_TAGS = { VIDEO: 1, IMG: 1, AUDIO: 1, SOURCE: 1 };

    function cleanAssetUrl(raw) {
        var text = String(raw || "");
        if (!text) return "";
        /* Buang query string & hash supaya signed token/Signature tidak tercatat di log. */
        return text.split("#")[0].split("?")[0];
    }

    function extractHost(raw) {
        var match = /^https?:\/\/([^\/?#]+)/i.exec(String(raw || "").trim());
        return match ? match[1].toLowerCase() : "";
    }

    function isExternalMediaResource(target, source) {
        var tag = String((target && target.tagName) || "").toUpperCase();
        if (!MEDIA_TAGS[tag] || !source) return false;

        var assetHost = extractHost(source);
        if (!assetHost) return false; /* URL relatif = aset milik situs sendiri */

        var siteHost = extractHost(window.location && window.location.href);
        return Boolean(siteHost && assetHost !== siteHost);
    }

    window.addEventListener("error", function (event) {
        if (lockdownActive) return;

        var target = event.target;
        var isResource = target && target !== window && target.tagName;
        var source = isResource
            ? String(target.src || target.href || "")
            : String(event.filename || "");

        /* Aset atau skrip milik ekstensi: bukan tanggung jawab situs. */
        if (looksLikeExtension(source, event.error && event.error.stack, event.message)) return;

        /* Media pratinjau dari CDN provider eksternal (Opus, OSS, dll.) akan
           kedaluwarsa sesuai retensi provider — bukan modul situs yang rusak. */
        if (isResource && isExternalMediaResource(target, source)) return;

        report("error", {
            message: isResource
                ? "Gagal memuat aset: " + (cleanAssetUrl(source) || target.tagName)
                : (event.message || "Error JavaScript tanpa pesan") +
                  (event.filename ? " @ " + cleanAssetUrl(event.filename) + ":" + (event.lineno || 0) : ""),
            severity: "error"
        });
    }, true);

    window.addEventListener("unhandledrejection", function (event) {
        if (lockdownActive) return;

        var reason = event.reason;

        if (looksLikeExtension(rejectionStack(reason))) return;

        report("error", {
            message: "Promise gagal: " + (reason && reason.message ? reason.message : String(reason || "unknown")),
            severity: "error"
        });
    });

    /* -----------------------------------------------------
       KIRIM PAGE VIEW & AKTIFKAN PELINDUNG
       ----------------------------------------------------- */

    bindAntiInspectGuards();

    if (!doNotTrackEnabled && SAMPLE_PAGE_VIEW && !alreadySeen()) {
        report("page_view", { throttle: false, severity: "info", message: "Halaman dibuka." });
    }

    watchDevtools();

    window.GENZMonitor = {
        report: report,
        devtoolsState: devtoolsState,
        isOwnerViewer: isOwnerViewer,
        isLockedDown: function () { return lockdownActive; },
        lockdownSnapshot: function () { return lastLockdownSnapshot; },
        triggerLockdownCheck: scheduleLockdownCheck,
        sessionId: sessionId,
        userId: currentUserId,
        sentCount: function () { return sent; }
    };
})();
