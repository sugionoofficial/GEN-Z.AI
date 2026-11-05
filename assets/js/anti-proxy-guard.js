/*
 * =========================================================
 * GEN-Z.AI — ANTI PROXY GUARD (CLIENT)
 * File: assets/js/anti-proxy-guard.js
 * Ketika Reqable / Charles / Fiddler aktif, putuskan koneksi
 * seperti anti-devtools: overlay putih + blokir fetch/XHR/WS.
 * =========================================================
 */
(function () {
    "use strict";
    if (window.__GENZ_ANTI_PROXY_ACTIVE) return;
    window.__GENZ_ANTI_PROXY_ACTIVE = true;

    var CHECK_URL = "/api/anti-proxy-check";
    var CHECK_INTERVAL_MS = 15000;
    var HACKER_IMG = "/assets/images/devtools-hacker-guard.jpg";

    var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    var lockdown = false;
    var lastReason = "";

    function escapeHtml(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function buildOverlay(reason) {
        var details = reason || lastReason || "Proxy / MITM terdeteksi";
        var ipInfo = "";
        try {
            var cf = document.documentElement.getAttribute("data-cf-ip") || "";
            if (cf) ipInfo = cf;
        } catch (e) {}
        return (
            '<div id="genz-proxy-lockdown" style="position:fixed;inset:0;z-index:999999;background:#ffffff;color:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:28px 18px;overflow:auto;font-family:Inter,system-ui,sans-serif;">' +
            '<div style="width:100%;max-width:640px;text-align:center;">' +
            '<img src="' + escapeHtml(HACKER_IMG) + '" alt="Proxy Terdeteksi" style="width:100%;max-width:340px;margin:0 auto 12px;display:block;" onerror="this.style.display=\'none\'">' +
            '<div style="display:inline-flex;gap:8px;align-items:center;padding:5px 12px;border-radius:999px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:11.5px;font-weight:800;letter-spacing:.06em;margin-bottom:10px;text-transform:uppercase;"><span>●</span><span>KONEKSI DIPUTUS — PROXY TERDETEKSI</span></div>' +
            '<h1 style="margin:0 0 8px;font-size:20px;font-weight:800;line-height:1.3;">Koneksi Diputus — Reqable / Proxy Terdeteksi</h1>' +
            '<p style="margin:0 auto 14px;max-width:560px;font-size:13.5px;line-height:1.6;color:#475569;">Sistem mendeteksi traffic kamu melewati proxy debugging (Reqable, Charles, Fiddler, mitmproxy). Demi keamanan, semua koneksi API diputus otomatis. Matikan proxy/VPN debugging dan muat ulang halaman.</p>' +
            '<div style="text-align:left;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#f8fafc;margin:0 auto 16px;max-width:560px;">' +
            '<div style="padding:10px 14px;background:#f1f5f9;border-bottom:1px solid #cbd5e1;font-size:12px;font-weight:800;letter-spacing:.06em;display:flex;justify-content:space-between;"><span>DETAIL DETEKSI</span><span style="color:#dc2626;font-family:monospace;">PROXY_DETECTED</span></div>' +
            '<div style="padding:10px 14px;font-size:12.5px;line-height:1.6;word-break:break-all;"><b>Alasan:</b> ' + escapeHtml(details) + '</div>' +
            '<div style="padding:8px 14px;font-size:11.5px;color:#64748b;background:#ffffff;border-top:1px solid #e2e8f0;">IP: ' + escapeHtml(ipInfo || "-") + ' • Jika kamu tidak memakai Reqable, matikan ekstensi VPN/ad-block proxy dan coba lagi.</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;"><button id="genz-proxy-reload" style="cursor:pointer;padding:10px 20px;border-radius:10px;border:1px solid #0f172a;background:#0f172a;color:#fff;font-weight:700;">Muat Ulang Halaman</button><button id="genz-proxy-help" style="cursor:pointer;padding:10px 20px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-weight:700;">Cara Matikan Reqable →</button></div>' +
            '<p style="margin:14px auto 0;max-width:560px;font-size:11px;color:#94a3b8;line-height:1.5;">Halaman ini memblokir <code>fetch</code>, <code>XHR</code>, <code>WebSocket</code> dan <code>EventSource</code> sampai kamu memuat ulang tanpa proxy.</p>' +
            '</div></div>'
        );
    }

    function severConnections() {
        try { if (window.stop) window.stop(); } catch (e) {}
        try {
            window.fetch = function () { return Promise.reject(new TypeError("Failed to fetch: ERR_PROXY_DETECTED")); };
        } catch (e) {}
        try {
            if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
                window.XMLHttpRequest.prototype.open = function () { this.__blocked = true; };
                window.XMLHttpRequest.prototype.send = function () {
                    var self = this;
                    setTimeout(function () { try { self.onerror && self.onerror(new Error("ERR_PROXY_DETECTED")); } catch (e) {} }, 0);
                };
            }
        } catch (e) {}
        try {
            window.WebSocket = function () { throw new TypeError("WebSocket blocked: proxy detected"); };
            window.EventSource = function () { throw new TypeError("EventSource blocked: proxy detected"); };
        } catch (e) {}
    }

    function triggerLockdown(reason) {
        if (lockdown) return;
        lockdown = true;
        lastReason = String(reason || "Proxy terdeteksi");
        // kirim beacon ke monitoring agar admin lihat
        try {
            if (window.GENZMonitor && window.GENZMonitor.report) {
                window.GENZMonitor.report("security", { throttle: false, severity: "critical", message: "Proxy/MITM terdeteksi di browser: " + lastReason.slice(0, 200) });
            } else if (nativeFetch) {
                nativeFetch("/api/monitoring?action=ingest", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "security", severity: "critical", path: location.pathname, message: "Proxy terdeteksi client: " + lastReason.slice(0, 200) })
                }).catch(function () {});
            }
        } catch (e) {}

        severConnections();

        try {
            document.documentElement.style.overflow = "auto";
            document.body.style.margin = "0";
            document.body.style.background = "#ffffff";
            document.body.innerHTML = buildOverlay(lastReason);
            var reloadBtn = document.getElementById("genz-proxy-reload");
            if (reloadBtn) reloadBtn.onclick = function () { location.reload(); };
            var helpBtn = document.getElementById("genz-proxy-help");
            if (helpBtn) helpBtn.onclick = function () {
                alert("Cara matikan Reqable:\\n1. Tutup aplikasi Reqable di HP/komputer\\n2. Hapus proxy di Wi-Fi: Settings → Wi-Fi → Proxy → Off\\n3. Hapus sertifikat CA Reqable jika terpasang\\n4. Muat ulang halaman ini");
            };
        } catch (e) {}
        document.title = "Koneksi Diputus — Proxy Terdeteksi";
    }

    // Intercept fetch untuk tangkap 403 PROXY_DETECTED dari Worker
    (function patchFetch() {
        if (!window.fetch) return;
        var orig = window.fetch;
        window.fetch = function (input, init) {
            var url = typeof input === "string" ? input : (input && input.url ? input.url : "");
            var isApi = typeof url === "string" && url.includes("/api/");
            return orig.apply(this, arguments).then(function (res) {
                try {
                    if (isApi && res && res.status === 403) {
                        var proxyHeader = res.headers.get("X-Proxy-Detected");
                        if (proxyHeader === "1") {
                            return res.clone().text().then(function (txt) {
                                var reason = "Proxy terdeteksi (header)";
                                try { var j = JSON.parse(txt); if (j.reason) reason = j.reason; else if (j.error) reason = j.error; } catch (e) {}
                                triggerLockdown(reason);
                                return res;
                            }).catch(function () { return res; });
                        }
                    }
                } catch (e) {}
                return res;
            });
        };
        // simpan native untuk beacon
        window.__GENZ_NATIVE_FETCH = orig;
    })();

    // Cek proaktif: panggil /api/anti-proxy-check setiap 15 detik
    function probe() {
        if (lockdown) return;
        var f = window.__GENZ_NATIVE_FETCH || window.fetch || nativeFetch;
        if (!f) return;
        f(CHECK_URL, { method: "GET", cache: "no-store", credentials: "same-origin", headers: { "X-Genz-Probe": "1" } })
            .then(function (r) {
                if (r.status === 403 && r.headers.get("X-Proxy-Detected") === "1") {
                    return r.text().then(function (txt) {
                        var reason = "Probe gagal";
                        try { var j = JSON.parse(txt); reason = j.reason || j.error || reason; } catch (e) {}
                        triggerLockdown(reason);
                    });
                }
            })
            .catch(function () {});
    }

    // Deteksi header proxy via performance timing (nextHopProtocol downgrade)
    function checkPerfProxy() {
        try {
            var entries = performance.getEntriesByType && performance.getEntriesByType("resource") || [];
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                // jika nextHopProtocol http/1.1 padahal site h2/h3 = kemungkinan proxy yang downgrade
                if (e.nextHopProtocol === "http/1.1" && e.name && e.name.includes("/api/")) {
                    // jangan langsung blokir, hanya log — bisa false positive
                    if (window.GENZMonitor) window.GENZMonitor.report("security", { throttle: true, severity: "warn", message: "nextHopProtocol http/1.1 untuk " + e.name.slice(0, 80) });
                }
            }
        } catch (e) {}
    }

    // Jalankan probe awal + interval
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { setTimeout(probe, 1200); });
    } else {
        setTimeout(probe, 1200);
    }
    setInterval(probe, CHECK_INTERVAL_MS);
    setInterval(checkPerfProxy, 30000);

    // Expose untuk debug
    window.__GENZ_PROXY_GUARD = { probe: probe, trigger: triggerLockdown };
})();
