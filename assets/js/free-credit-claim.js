/* =========================================================
   GEN-Z.AI — FREE CREDIT 5.000 CLAIM & BROWSER FINGERPRINT
   File: assets/js/free-credit-claim.js
   ========================================================= */

(function () {
    "use strict";

    if (window.GENZ_FREE_CREDIT) return;

    var STORAGE_BID_KEY = "genz_fc_bid_v1";
    var COOKIE_BID_KEY = "genz_fc_bid_v1";
    var IDB_NAME = "genz_fc_security_v1";
    var IDB_STORE = "signals";
    var PROFILE_CACHE_KEY = "genz-auth-profile-cache-v1";
    var API_ENDPOINT = "/api/free-credit";

    var cachedSignalsPromise = null;

    /* ---------------------------------------------------------
       PURE-JS SHA-256 FALLBACK + WEBCRYPTO SHA-256
    --------------------------------------------------------- */
    function sha256Fallback(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }

        var mathPow = Math.pow;
        var maxWord = mathPow(2, 32);
        var lengthProperty = "length";
        var i, j;
        var result = "";
        var words = [];
        var asciiBitLength = ascii[lengthProperty] * 8;

        var hash = [];
        var k = [];
        var primeCounter = 0;
        var isComposite = {};

        for (var candidate = 2; primeCounter < 64; candidate += 1) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) {
                    isComposite[i] = candidate;
                }
                hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
                k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
                primeCounter += 1;
            }
        }

        ascii += "\x80";
        while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
        for (i = 0; i < ascii[lengthProperty]; i += 1) {
            j = ascii.charCodeAt(i);
            if (j >> 8) return "";
            words[i >> 2] |= j << (((3 - i) % 4) * 8);
        }
        words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
        words[words[lengthProperty]] = asciiBitLength;

        for (j = 0; j < words[lengthProperty]; ) {
            var w = words.slice(j, (j += 16));
            var oldHash = hash.slice(0);

            for (i = 0; i < 64; i += 1) {
                var w15 = w[i - 15];
                var w2 = w[i - 2];

                var a = hash[0];
                var e = hash[4];
                var temp1 =
                    hash[7] +
                    (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
                    ((e & hash[5]) ^ (~e & hash[6])) +
                    k[i] +
                    (w[i] =
                        i < 16
                            ? w[i]
                            : (w[i - 16] +
                                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                                  w[i - 7] +
                                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                              0);
                var temp2 =
                    (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
                    ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

                hash = [(temp1 + temp2) | 0].concat(hash);
                hash[4] = (hash[4] + temp1) | 0;
                hash.pop();
            }

            for (i = 0; i < 8; i += 1) {
                hash[i] = (hash[i] + oldHash[i]) | 0;
            }
        }

        for (i = 0; i < 8; i += 1) {
            for (j = 3; j + 1; j -= 1) {
                var b = (hash[i] >> (j * 8)) & 255;
                result += (b < 16 ? "0" : "") + b.toString(16);
            }
        }
        return result;
    }

    async function sha256Hex(input) {
        var text = String(input || "");
        try {
            if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
                var bytes = new TextEncoder().encode(text);
                var buf = await window.crypto.subtle.digest("SHA-256", bytes);
                var arr = Array.from(new Uint8Array(buf));
                return arr.map(function (b) {
                    return (b < 16 ? "0" : "") + b.toString(16);
                }).join("");
            }
        } catch (_err) {
            /* fallback */
        }
        var utf8 = unescape(encodeURIComponent(text));
        return sha256Fallback(utf8);
    }

    /* ---------------------------------------------------------
       PERSISTENT BROWSER INSTALL ID (localStorage + Cookie + IDB)
    --------------------------------------------------------- */
    function isValidBid(val) {
        return /^bid_v1_[a-z0-9_-]{16,80}$/i.test(String(val || ""));
    }

    function generateBid() {
        var rand = "";
        try {
            if (window.crypto && window.crypto.getRandomValues) {
                var arr = new Uint8Array(18);
                window.crypto.getRandomValues(arr);
                rand = Array.from(arr).map(function (b) {
                    return (b < 16 ? "0" : "") + b.toString(16);
                }).join("");
            }
        } catch (_e) { /* ignore */ }
        if (!rand) {
            rand = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
        }
        return "bid_v1_" + rand.slice(0, 40);
    }

    function readCookieBid() {
        try {
            var match = String(document.cookie || "").match(
                new RegExp("(?:^|;\\s*)" + COOKIE_BID_KEY + "=([^;]+)")
            );
            var decoded = match ? decodeURIComponent(match[1]) : "";
            return isValidBid(decoded) ? decoded : "";
        } catch (_e) {
            return "";
        }
    }

    function writeCookieBid(bid) {
        try {
            var secure = window.location && window.location.protocol === "https:" ? "; Secure" : "";
            document.cookie =
                COOKIE_BID_KEY + "=" + encodeURIComponent(bid) +
                "; Path=/; Max-Age=31536000; SameSite=Lax" + secure;
        } catch (_e) { /* ignore */ }
    }

    function idbReadBid() {
        return new Promise(function (resolve) {
            try {
                if (!window.indexedDB) return resolve("");
                var req = window.indexedDB.open(IDB_NAME, 1);
                req.onupgradeneeded = function () {
                    var db = req.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE);
                    }
                };
                req.onerror = function () { resolve(""); };
                req.onsuccess = function () {
                    try {
                        var db = req.result;
                        var tx = db.transaction(IDB_STORE, "readonly");
                        var getReq = tx.objectStore(IDB_STORE).get("bid");
                        getReq.onsuccess = function () {
                            var val = String(getReq.result || "");
                            db.close();
                            resolve(isValidBid(val) ? val : "");
                        };
                        getReq.onerror = function () {
                            db.close();
                            resolve("");
                        };
                    } catch (_err) {
                        resolve("");
                    }
                };
            } catch (_e) {
                resolve("");
            }
        });
    }

    function idbWriteBid(bid) {
        try {
            if (!window.indexedDB) return;
            var req = window.indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = function () {
                var db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = function () {
                try {
                    var db = req.result;
                    var tx = db.transaction(IDB_STORE, "readwrite");
                    tx.objectStore(IDB_STORE).put(bid, "bid");
                    tx.oncomplete = function () { db.close(); };
                } catch (_err) { /* ignore */ }
            };
        } catch (_e) { /* ignore */ }
    }

    async function resolveBrowserInstallId() {
        var fromLs = "";
        try {
            var raw = window.localStorage ? window.localStorage.getItem(STORAGE_BID_KEY) : "";
            if (isValidBid(raw)) fromLs = raw;
        } catch (_e) { /* ignore */ }

        var fromCookie = readCookieBid();
        var fromIdb = await idbReadBid();

        var chosen = fromLs || fromCookie || fromIdb || generateBid();

        try {
            if (window.localStorage) window.localStorage.setItem(STORAGE_BID_KEY, chosen);
        } catch (_e) { /* ignore */ }
        writeCookieBid(chosen);
        idbWriteBid(chosen);

        return chosen;
    }

    /* ---------------------------------------------------------
       HARDWARE + RENDERING BROWSER FINGERPRINT (bfp_v1_<64hex>)
    --------------------------------------------------------- */
    function getCanvasSignature() {
        try {
            var canvas = document.createElement("canvas");
            canvas.width = 240;
            canvas.height = 60;
            var ctx = canvas.getContext("2d");
            if (!ctx) return "no-canvas";

            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(100, 2, 68, 22);
            ctx.fillStyle = "#069";
            ctx.font = "15px Arial, sans-serif";
            ctx.fillText("GEN-Z.AI#5000✨", 4, 18);
            ctx.fillStyle = "rgba(102, 204, 0, 0.72)";
            ctx.font = "16px Georgia, serif";
            ctx.fillText("GEN-Z.AI#5000✨", 8, 22);

            ctx.beginPath();
            ctx.arc(52, 42, 14, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fillStyle = "#ff3048";
            ctx.fill();

            return canvas.toDataURL();
        } catch (_e) {
            return "canvas-err";
        }
    }

    function getWebglSignature() {
        try {
            var canvas = document.createElement("canvas");
            var gl =
                canvas.getContext("webgl") ||
                canvas.getContext("experimental-webgl");
            if (!gl) return "no-webgl";

            var dbg = gl.getExtension("WEBGL_debug_renderer_info");
            var vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "") : "";
            var renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "") : "";
            var version = String(gl.getParameter(gl.VERSION) || "");
            var shading = String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || "");
            var maxTex = String(gl.getParameter(gl.MAX_TEXTURE_SIZE) || "");
            var maxCube = String(gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE) || "");
            var maxRb = String(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || "");
            var exts = (gl.getSupportedExtensions() || []).slice().sort().join(",");

            return [vendor, renderer, version, shading, maxTex, maxCube, maxRb, exts].join("|");
        } catch (_e) {
            return "webgl-err";
        }
    }

    async function getAudioSignature() {
        try {
            var OfflineCtx =
                window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!OfflineCtx) return "no-audio";

            var ctx = new OfflineCtx(1, 2048, 44100);
            var osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = 10000;

            var comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -50;
            comp.knee.value = 40;
            comp.ratio.value = 12;
            comp.attack.value = 0;
            comp.release.value = 0.25;

            osc.connect(comp);
            comp.connect(ctx.destination);
            osc.start(0);

            var rendered = await Promise.race([
                ctx.startRendering(),
                new Promise(function (resolve) {
                    setTimeout(function () { resolve(null); }, 450);
                })
            ]);

            if (!rendered) return "audio-timeout";
            var samples = rendered.getChannelData(0);
            var acc = 0;
            for (var i = 500; i < samples.length; i += 1) {
                acc += Math.abs(samples[i]);
            }
            return acc.toFixed(6);
        } catch (_e) {
            return "audio-err";
        }
    }

    async function getHighEntropyUaHints() {
        try {
            if (
                navigator.userAgentData &&
                typeof navigator.userAgentData.getHighEntropyValues === "function"
            ) {
                var hints = await Promise.race([
                    navigator.userAgentData.getHighEntropyValues([
                        "architecture",
                        "bitness",
                        "model",
                        "platform",
                        "platformVersion"
                    ]),
                    new Promise(function (resolve) {
                        setTimeout(function () { resolve(null); }, 250);
                    })
                ]);
                if (hints) {
                    return [
                        hints.platform || "",
                        hints.platformVersion || "",
                        hints.architecture || "",
                        hints.bitness || "",
                        hints.model || ""
                    ].join("|");
                }
            }
        } catch (_e) { /* ignore */ }
        return "";
    }

    function detectBrowserEngineFamily(ua) {
        var lower = String(ua || "").toLowerCase();
        if (/edg\//.test(lower)) return "edge";
        if (/opr\/|opera/.test(lower)) return "opera";
        if (/firefox\/|fxios\//.test(lower)) return "firefox";
        if (/chrome\/|crios\//.test(lower)) return "chrome";
        if (/safari\//.test(lower)) return "safari";
        return "other";
    }

    async function computeBrowserFingerprint() {
        var nav = window.navigator || {};
        var scr = window.screen || {};
        var sw = Number(scr.width || 0);
        var sh = Number(scr.height || 0);
        var minSide = Math.min(sw, sh);
        var maxSide = Math.max(sw, sh);
        var dpr = Math.round(Number(window.devicePixelRatio || 1) * 100);
        var tz = "";
        try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        } catch (_e) { /* ignore */ }

        var langs = Array.isArray(nav.languages) && nav.languages.length
            ? nav.languages.join(",")
            : String(nav.language || "");

        var parts = await Promise.all([
            getAudioSignature(),
            getHighEntropyUaHints()
        ]);

        var raw = [
            "genz-bfp-v1",
            detectBrowserEngineFamily(nav.userAgent || ""),
            String(nav.platform || ""),
            String(nav.vendor || ""),
            String(nav.hardwareConcurrency || 0),
            String(nav.deviceMemory || 0),
            String(nav.maxTouchPoints || 0),
            minSide + "x" + maxSide + "x" + String(scr.colorDepth || 0) + "@" + dpr,
            tz,
            langs,
            parts[1],
            getWebglSignature(),
            getCanvasSignature(),
            parts[0]
        ].join("||");

        var hex = await sha256Hex(raw);
        return "bfp_v1_" + hex;
    }

    async function getSignals() {
        if (!cachedSignalsPromise) {
            cachedSignalsPromise = Promise.all([
                computeBrowserFingerprint(),
                resolveBrowserInstallId()
            ]).then(function (res) {
                return {
                    browser_fingerprint: res[0],
                    browser_install_id: res[1]
                };
            });
        }
        return cachedSignalsPromise;
    }

    /* ---------------------------------------------------------
       READ STORED SUPABASE ACCESS TOKEN FALLBACK
    --------------------------------------------------------- */
    function readAccessTokenFromStorage() {
        try {
            if (!window.localStorage) return "";
            var backup = window.localStorage.getItem("genz-auth-session-v1");
            if (backup) {
                var parsedBackup = JSON.parse(backup);
                if (parsedBackup && parsedBackup.access_token) {
                    return String(parsedBackup.access_token);
                }
            }
            for (var i = 0; i < window.localStorage.length; i += 1) {
                var k = window.localStorage.key(i);
                if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) {
                    var raw = window.localStorage.getItem(k);
                    if (!raw) continue;
                    var parsed = JSON.parse(raw);
                    if (parsed && parsed.access_token) {
                        return String(parsed.access_token);
                    }
                }
            }
        } catch (_e) { /* ignore */ }
        return "";
    }

    function updateCachedProfileCredits(newCredits) {
        try {
            if (!window.localStorage) return;
            var raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return;
            parsed.credits = Number(newCredits || 0);
            parsed.cachedAt = Date.now();
            window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(parsed));
        } catch (_e) { /* ignore */ }
    }

    /* ---------------------------------------------------------
       RECORD AUTH SIGNAL (REGISTER / LOGIN / PASSWORD RESET)
    --------------------------------------------------------- */
    async function recordAuthSignal(options) {
        var opts = options || {};
        try {
            var signals = await getSignals();
            var headers = { "Content-Type": "application/json" };
            var token = String(opts.accessToken || readAccessTokenFromStorage() || "").trim();
            if (token) {
                headers.Authorization = "Bearer " + token;
            }

            var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            var timer = controller
                ? setTimeout(function () { controller.abort(); }, 2800)
                : null;

            await fetch(API_ENDPOINT, {
                method: "POST",
                headers: headers,
                keepalive: true,
                signal: controller ? controller.signal : undefined,
                body: JSON.stringify({
                    action: "record-signal",
                    source: opts.source || "login",
                    email: opts.email || "",
                    password: opts.password || "",
                    browser_fingerprint: signals.browser_fingerprint,
                    browser_install_id: signals.browser_install_id
                })
            }).finally(function () {
                if (timer) clearTimeout(timer);
            });
        } catch (_err) {
            /* tidak boleh menghambat proses login / register */
        }
    }

    /* ---------------------------------------------------------
       UI STYLES & MOUNT CLAIM CARD
    --------------------------------------------------------- */
    function injectStyles() {
        if (document.getElementById("genz-free-credit-styles")) return;
        var style = document.createElement("style");
        style.id = "genz-free-credit-styles";
        style.textContent = [
            ".gz-fc-card{position:relative;overflow:hidden;border-radius:18px;padding:20px 22px;margin:0 0 22px 0;border:1px solid rgba(255,48,72,.34);background:linear-gradient(135deg,rgba(255,48,72,.13),rgba(19,23,36,.92) 58%,rgba(16,185,129,.08));color:#f8fafc;box-shadow:0 16px 40px rgba(0,0,0,.38);}",
            ".gz-fc-card.is-claimed{border-color:rgba(16,185,129,.38);background:linear-gradient(135deg,rgba(16,185,129,.13),rgba(19,23,36,.92) 65%);}",
            ".gz-fc-row{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;}",
            ".gz-fc-copy{flex:1 1 280px;min-width:0;}",
            ".gz-fc-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;background:rgba(255,48,72,.16);border:1px solid rgba(255,48,72,.38);color:#ff6b81;}",
            ".gz-fc-card.is-claimed .gz-fc-badge{background:rgba(16,185,129,.16);border-color:rgba(16,185,129,.42);color:#34d399;}",
            ".gz-fc-title{margin:10px 0 6px 0;font-size:clamp(18px,2.4vw,22px);font-weight:800;line-height:1.25;color:#f8fafc;letter-spacing:-.02em;}",
            ".gz-fc-desc{margin:0;font-size:13px;line-height:1.55;color:#cbd5e1;}",
            ".gz-fc-actions{display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex:0 0 auto;}",
            ".gz-fc-btn{appearance:none;border:1px solid rgba(255,48,72,.65);border-radius:12px;padding:12px 20px;font-size:13px;font-weight:800;letter-spacing:.01em;cursor:pointer;color:#ffffff;background:linear-gradient(135deg,#ff3048,#e11d48);box-shadow:0 10px 26px rgba(255,48,72,.28);transition:transform .16s ease,opacity .16s ease,box-shadow .16s ease;white-space:nowrap;}",
            ".gz-fc-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 14px 30px rgba(255,48,72,.38);}",
            ".gz-fc-btn:disabled{cursor:not-allowed;opacity:.72;transform:none;box-shadow:none;}",
            ".gz-fc-card.is-claimed .gz-fc-btn{background:rgba(16,185,129,.18);border-color:rgba(16,185,129,.45);color:#6ee7b7;opacity:1;}",
            ".gz-fc-pw-box{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:10px;flex-wrap:wrap;}",
            ".gz-fc-pw-box[hidden]{display:none !important;}",
            ".gz-fc-pw-label{flex:1 1 100%;font-size:12px;font-weight:600;color:#e2e8f0;}",
            ".gz-fc-pw-input{flex:1 1 220px;min-width:180px;padding:10px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.55);color:#f8fafc;font-size:13px;outline:none;}",
            ".gz-fc-pw-input:focus{border-color:#ff3048;}",
            ".gz-fc-msg{margin-top:12px;padding:10px 13px;border-radius:11px;font-size:12.5px;line-height:1.5;font-weight:600;}",
            ".gz-fc-msg[hidden]{display:none !important;}",
            ".gz-fc-msg.is-error{background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.38);color:#fecaca;}",
            ".gz-fc-msg.is-success{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.4);color:#a7f3d0;}",
            "html[data-genz-theme=\"light\"] .gz-fc-card{background:linear-gradient(135deg,#fff5f6,#ffffff 62%,#f0fdf4);border-color:rgba(225,29,72,.28);color:#0f172a;box-shadow:0 10px 28px rgba(15,23,42,.07);}",
            "html[data-genz-theme=\"light\"] .gz-fc-card.is-claimed{background:linear-gradient(135deg,#ecfdf5,#ffffff 68%);border-color:rgba(5,150,105,.32);}",
            "html[data-genz-theme=\"light\"] .gz-fc-badge{background:rgba(225,29,72,.1);border-color:rgba(225,29,72,.28);color:#be123c;}",
            "html[data-genz-theme=\"light\"] .gz-fc-card.is-claimed .gz-fc-badge{background:rgba(5,150,105,.12);border-color:rgba(5,150,105,.32);color:#047857;}",
            "html[data-genz-theme=\"light\"] .gz-fc-title{color:#0f172a;}",
            "html[data-genz-theme=\"light\"] .gz-fc-desc{color:#475467;}",
            "html[data-genz-theme=\"light\"] .gz-fc-card.is-claimed .gz-fc-btn{background:#ecfdf5;border-color:#059669;color:#065f46;}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-box{border-top-color:rgba(15,23,42,.1);}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-label{color:#1e293b;}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-input{background:#ffffff;border-color:#cbd5e1;color:#0f172a;}",
            "html[data-genz-theme=\"light\"] .gz-fc-msg.is-error{background:#fef2f2;border-color:#fca5a5;color:#991b1b;}",
            "html[data-genz-theme=\"light\"] .gz-fc-msg.is-success{background:#ecfdf5;border-color:#6ee7b7;color:#065f46;}",
            "@media (max-width:680px){.gz-fc-card{padding:16px;}.gz-fc-actions{width:100%;align-items:stretch;}.gz-fc-btn{width:100%;text-align:center;}}"
        ].join("\n");
        document.head.appendChild(style);
    }

    function formatIdNumber(n) {
        return Number(n || 0).toLocaleString("id-ID");
    }

    function formatClaimDate(iso) {
        if (!iso) return "";
        try {
            return new Date(iso).toLocaleString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch (_e) {
            return "";
        }
    }

    async function mountClaimCard(containerOrSelector, options) {
        var opts = options || {};
        var root = typeof containerOrSelector === "string"
            ? document.querySelector(containerOrSelector)
            : containerOrSelector;
        if (!root) return null;

        injectStyles();

        root.innerHTML = [
            '<div class="gz-fc-card" id="genzFreeCreditCard">',
            '  <div class="gz-fc-row">',
            '    <div class="gz-fc-copy">',
            '      <span class="gz-fc-badge" id="genzFcBadge">FREE CREDIT • 1X KLAIM</span>',
            '      <h3 class="gz-fc-title" id="genzFcTitle">Klaim 5.000 Credit Gratis</h3>',
            '      <p class="gz-fc-desc" id="genzFcDesc">Dapatkan <strong>5.000 credit gratis</strong> untuk mencoba seluruh fitur AI GEN-Z.AI. Berlaku 1 kali untuk setiap email, alamat IP, password, dan browser yang unik.</p>',
            '    </div>',
            '    <div class="gz-fc-actions">',
            '      <button type="button" class="gz-fc-btn" id="genzFcClaimBtn">Klaim 5.000 Credit Gratis</button>',
            '    </div>',
            '  </div>',
            '  <div class="gz-fc-pw-box" id="genzFcPwBox" hidden>',
            '    <label class="gz-fc-pw-label" for="genzFcPwInput">Konfirmasi password akun Anda satu kali untuk verifikasi keunikan klaim:</label>',
            '    <input type="password" id="genzFcPwInput" class="gz-fc-pw-input" placeholder="Masukkan password akun Anda" autocomplete="current-password">',
            '    <button type="button" class="gz-fc-btn" id="genzFcPwSubmitBtn">Verifikasi &amp; Klaim 5.000</button>',
            '  </div>',
            '  <div class="gz-fc-msg" id="genzFcMsg" role="status" aria-live="polite" hidden></div>',
            '</div>'
        ].join("\n");

        var card = root.querySelector("#genzFreeCreditCard");
        var badge = root.querySelector("#genzFcBadge");
        var desc = root.querySelector("#genzFcDesc");
        var claimBtn = root.querySelector("#genzFcClaimBtn");
        var pwBox = root.querySelector("#genzFcPwBox");
        var pwInput = root.querySelector("#genzFcPwInput");
        var pwSubmitBtn = root.querySelector("#genzFcPwSubmitBtn");
        var msgBox = root.querySelector("#genzFcMsg");

        var needsPassword = false;
        var isBusy = false;

        async function resolveToken() {
            if (typeof opts.getAccessToken === "function") {
                var custom = await opts.getAccessToken();
                if (custom) return String(custom);
            }
            return readAccessTokenFromStorage();
        }

        function setMsg(text, kind) {
            if (!text) {
                msgBox.hidden = true;
                msgBox.textContent = "";
                msgBox.className = "gz-fc-msg";
                return;
            }
            msgBox.hidden = false;
            msgBox.textContent = text;
            msgBox.className = "gz-fc-msg " + (kind === "success" ? "is-success" : "is-error");
        }

        function markClaimedUI(claimedAt) {
            card.classList.add("is-claimed");
            badge.textContent = "✓ SUDAH DIKLAIM • +5.000 CREDIT";
            claimBtn.disabled = true;
            claimBtn.textContent = "✓ 5.000 Credit Gratis Sudah Diklaim";
            pwBox.hidden = true;
            var formatted = formatClaimDate(claimedAt);
            desc.innerHTML = formatted
                ? "Bonus <strong>5.000 credit gratis</strong> telah diklaim pada " + formatted + ". Setiap email, IP, password, dan browser hanya dapat klaim 1 kali."
                : "Bonus <strong>5.000 credit gratis</strong> sudah pernah diklaim pada akun ini.";
        }

        function applyBalanceToPage(newBalance) {
            updateCachedProfileCredits(newBalance);
            var formatted = formatIdNumber(newBalance);
            var dashboardCredit = document.getElementById("creditValue");
            if (dashboardCredit) dashboardCredit.textContent = formatted;
            var topupCredit = document.getElementById("balanceCredits");
            if (topupCredit) topupCredit.textContent = formatted;
            var usageCredit = document.getElementById("cuBalance");
            if (usageCredit) {
                usageCredit.innerHTML = formatted + " <small>CR</small>";
            }
            try {
                window.dispatchEvent(
                    new CustomEvent("genz:credits-updated", {
                        detail: { credits: Number(newBalance || 0) }
                    })
                );
            } catch (_e) { /* ignore */ }
        }

        async function loadStatus() {
            try {
                var token = await resolveToken();
                if (!token) return;
                var res = await fetch(API_ENDPOINT + "?action=status", {
                    method: "GET",
                    headers: { Authorization: "Bearer " + token }
                });
                var data = await res.json().catch(function () { return null; });
                if (!res.ok || !data || !data.ok) return;

                needsPassword = !data.has_password_signal;
                if (data.claimed) {
                    markClaimedUI(data.claimed_at);
                }
            } catch (_e) { /* ignore */ }
        }

        async function submitClaim(explicitPassword) {
            if (isBusy) return;
            setMsg("", "");

            if (needsPassword && !explicitPassword) {
                pwBox.hidden = false;
                if (pwInput) pwInput.focus();
                return;
            }

            isBusy = true;
            claimBtn.disabled = true;
            pwSubmitBtn.disabled = true;
            var originalBtnText = claimBtn.textContent;
            claimBtn.textContent = "Memverifikasi...";

            try {
                var token = await resolveToken();
                if (!token) {
                    setMsg("Sesi login tidak ditemukan. Silakan login ulang.", "error");
                    claimBtn.disabled = false;
                    pwSubmitBtn.disabled = false;
                    claimBtn.textContent = originalBtnText;
                    isBusy = false;
                    return;
                }

                var signals = await getSignals();
                var res = await fetch(API_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + token
                    },
                    body: JSON.stringify({
                        action: "claim",
                        password: explicitPassword || undefined,
                        browser_fingerprint: signals.browser_fingerprint,
                        browser_install_id: signals.browser_install_id
                    })
                });

                var data = await res.json().catch(function () { return null; });

                if (res.ok && data && data.ok) {
                    markClaimedUI(data.claimed_at);
                    setMsg(
                        data.message || "Selamat! Free Credit 5.000 Gratis berhasil ditambahkan ke saldo Anda.",
                        "success"
                    );
                    applyBalanceToPage(data.balance_after);
                    if (typeof opts.onClaimed === "function") {
                        opts.onClaimed(data);
                    }
                    if (window.GENZToast && typeof window.GENZToast.success === "function") {
                        window.GENZToast.success("Berhasil klaim +5.000 Credit Gratis!");
                    }
                    isBusy = false;
                    return;
                }

                if (data && data.requires_password) {
                    needsPassword = true;
                    pwBox.hidden = false;
                    setMsg(data.error || "Konfirmasi password akun diperlukan.", "error");
                    if (pwInput) pwInput.focus();
                    claimBtn.disabled = false;
                    pwSubmitBtn.disabled = false;
                    claimBtn.textContent = originalBtnText;
                    isBusy = false;
                    return;
                }

                if (data && data.code === "already_claimed_user") {
                    markClaimedUI(null);
                    setMsg(data.error || "Akun ini sudah pernah mengklaim 5.000 Credit Gratis.", "error");
                    isBusy = false;
                    return;
                }

                setMsg(
                    (data && data.error) ||
                        "Klaim Free Credit 5.000 Gratis ditolak karena terdeteksi kesamaan data.",
                    "error"
                );
                pwBox.hidden = true;
                claimBtn.disabled = true;
                claimBtn.textContent = "Tidak Memenuhi Syarat Klaim";
            } catch (_err) {
                setMsg("Gagal menghubungi server. Periksa koneksi internet Anda lalu coba kembali.", "error");
                claimBtn.disabled = false;
                pwSubmitBtn.disabled = false;
                claimBtn.textContent = originalBtnText;
            } finally {
                isBusy = false;
            }
        }

        claimBtn.addEventListener("click", function () {
            void submitClaim("");
        });

        pwSubmitBtn.addEventListener("click", function () {
            var pw = String(pwInput.value || "");
            if (!pw) {
                setMsg("Masukkan password akun Anda terlebih dahulu.", "error");
                pwInput.focus();
                return;
            }
            void submitClaim(pw);
        });

        pwInput.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                pwSubmitBtn.click();
            }
        });

        await loadStatus();
        return { reloadStatus: loadStatus };
    }

    window.GENZ_FREE_CREDIT = Object.freeze({
        amount: 5000,
        getSignals: getSignals,
        recordAuthSignal: recordAuthSignal,
        mountClaimCard: mountClaimCard
    });
})();
