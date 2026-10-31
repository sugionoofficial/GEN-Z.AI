/* =========================================================
   GEN-Z.AI — FREE CREDIT EVENT CLAIM & BROWSER FINGERPRINT
   File: assets/js/free-credit-claim.js
   ========================================================= */

(function () {
    "use strict";

    if (window.GENZ_FREE_CREDIT) return;

    var DEFAULT_CREDIT_AMOUNT = 5000;
    var STORAGE_BID_KEY = "genz_fc_bid_v1";
    var COOKIE_BID_KEY = "genz_fc_bid_v1";
    var IDB_NAME = "genz_fc_security_v1";
    var IDB_STORE = "signals";
    var PROFILE_CACHE_KEY = "genz-auth-profile-cache-v1";
    var API_ENDPOINT = "/api/free-credit";

    var cachedSignalsPromise = null;
    var activeTickTimers = new WeakMap();

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
       LUXURY VIP 16:9 CARD + LIVE CHRONO RUNTIME STYLES
    --------------------------------------------------------- */
    function injectStyles() {
        if (document.getElementById("genz-free-credit-styles")) return;
        var style = document.createElement("style");
        style.id = "genz-free-credit-styles";
        style.textContent = [
            "@keyframes gzFcShimmer{0%{transform:translateX(-120%) skewX(-18deg);}100%{transform:translateX(240%) skewX(-18deg);}}",
            "@keyframes gzFcPulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.55);}65%{box-shadow:0 0 0 7px rgba(52,211,153,0);}}",
            ".gz-fc-card{position:relative;overflow:hidden;border-radius:24px;padding:22px;margin:0 0 26px 0;border:1px solid rgba(236,193,108,.42);background:radial-gradient(120% 140% at 0% 0%,rgba(245,196,105,.16) 0%,transparent 48%),radial-gradient(110% 130% at 100% 100%,rgba(255,48,72,.14) 0%,transparent 52%),linear-gradient(140deg,#090c14 0%,#101524 52%,#07090f 100%);color:#f8fafc;box-shadow:0 26px 64px rgba(0,0,0,.62),0 1px 0 rgba(255,235,190,.24) inset,0 0 0 1px rgba(255,255,255,.03) inset;isolation:isolate;}",
            ".gz-fc-card::before{content:\"\";position:absolute;inset:0;border-radius:24px;padding:1px;background:linear-gradient(135deg,rgba(251,226,157,.58),rgba(255,255,255,.05) 38%,rgba(255,48,72,.35) 78%,rgba(251,226,157,.44));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:2;}",
            ".gz-fc-card.is-claimed{border-color:rgba(52,211,153,.42);background:radial-gradient(120% 140% at 0% 0%,rgba(16,185,129,.17) 0%,transparent 52%),radial-gradient(100% 120% at 100% 100%,rgba(236,193,108,.12) 0%,transparent 50%),linear-gradient(140deg,#081110 0%,#0d171c 56%,#070a0f 100%);}",
            ".gz-fc-card.is-claimed::before{background:linear-gradient(135deg,rgba(110,231,183,.55),rgba(255,255,255,.06) 45%,rgba(236,193,108,.35));}",
            ".gz-fc-layout{position:relative;z-index:3;display:grid;grid-template-columns:minmax(275px,42%) minmax(0,1fr);gap:24px;align-items:center;}",
            ".gz-fc-media{position:relative;width:100%;aspect-ratio:16 / 9;border-radius:17px;overflow:hidden;border:1px solid rgba(251,226,157,.28);background:radial-gradient(circle at 22% 22%,rgba(251,226,157,.24),transparent 52%),radial-gradient(circle at 82% 80%,rgba(255,48,72,.26),transparent 56%),linear-gradient(145deg,#0f1422 0%,#06080e 100%);box-shadow:0 18px 38px rgba(0,0,0,.52),0 1px 0 rgba(255,255,255,.12) inset;}",
            ".gz-fc-media::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,12,.18) 0%,rgba(5,7,12,.04) 48%,rgba(5,7,12,.62) 100%);pointer-events:none;z-index:2;}",
            ".gz-fc-banner-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s cubic-bezier(.22,1,.36,1);}",
            ".gz-fc-card:hover .gz-fc-banner-img{transform:scale(1.03);}",
            ".gz-fc-banner-img[hidden]{display:none !important;}",
            ".gz-fc-art{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;text-align:center;background-image:linear-gradient(rgba(251,226,157,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(251,226,157,.05) 1px,transparent 1px);background-size:24px 24px;}",
            ".gz-fc-art[hidden]{display:none !important;}",
            ".gz-fc-art-kicker{font-size:9.5px;font-weight:800;letter-spacing:.26em;text-transform:uppercase;color:#f5d487;opacity:.92;margin-bottom:6px;}",
            ".gz-fc-art-amount{font-size:clamp(26px,3.6vw,38px);font-weight:900;letter-spacing:-.03em;line-height:1;background:linear-gradient(135deg,#fff6d6 0%,#f5cb6c 48%,#ff6b81 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 20px rgba(245,196,105,.25));}",
            ".gz-fc-art-sub{margin-top:7px;font-size:10.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#cbd5e1;}",
            ".gz-fc-media-top{position:absolute;top:11px;left:11px;right:11px;display:flex;align-items:center;justify-content:space-between;gap:8px;z-index:3;pointer-events:none;}",
            ".gz-fc-vip-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fbe29d;background:rgba(8,10,16,.76);border:1px solid rgba(251,226,157,.38);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}",
            ".gz-fc-value-chip{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.08em;color:#140e02;background:linear-gradient(135deg,#fff0c2,#e7b54c);box-shadow:0 6px 16px rgba(0,0,0,.38);}",
            ".gz-fc-body{display:flex;flex-direction:column;gap:12px;min-width:0;}",
            ".gz-fc-head-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}",
            ".gz-fc-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;background:linear-gradient(135deg,rgba(245,196,105,.18),rgba(255,48,72,.14));border:1px solid rgba(251,226,157,.42);color:#fbe29d;}",
            ".gz-fc-card.is-claimed .gz-fc-badge{background:rgba(16,185,129,.18);border-color:rgba(52,211,153,.46);color:#6ee7b7;}",
            ".gz-fc-title{margin:0;font-size:clamp(20px,2.5vw,26px);font-weight:900;line-height:1.2;letter-spacing:-.025em;background:linear-gradient(135deg,#ffffff 0%,#fef3c7 58%,#f5cb6c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}",
            ".gz-fc-card.is-claimed .gz-fc-title{background:linear-gradient(135deg,#ffffff 0%,#d1fae5 70%,#6ee7b7 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}",
            ".gz-fc-desc{margin:0;font-size:13.5px;line-height:1.6;color:#cbd5e1;}",
            ".gz-fc-desc strong{color:#fde68a;font-weight:800;}",
            ".gz-fc-card.is-claimed .gz-fc-desc strong{color:#6ee7b7;}",
            /* Luxury Horology Runtime Bar */
            ".gz-fc-runtime{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:11px 14px;border-radius:15px;border:1px solid rgba(251,226,157,.28);background:linear-gradient(135deg,rgba(251,226,157,.09) 0%,rgba(8,11,19,.86) 65%,rgba(255,48,72,.06) 100%);box-shadow:0 8px 24px rgba(0,0,0,.32),0 1px 0 rgba(255,255,255,.06) inset;}",
            ".gz-fc-rt-meta{display:flex;flex-direction:column;gap:3px;min-width:0;}",
            ".gz-fc-rt-kicker{display:inline-flex;align-items:center;gap:7px;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:#fbe29d;}",
            ".gz-fc-rt-dot{width:7px;height:7px;border-radius:999px;background:#34d399;animation:gzFcPulse 2s infinite;flex:0 0 auto;}",
            ".gz-fc-runtime.is-scheduled .gz-fc-rt-dot{background:#fbbf24;}",
            ".gz-fc-runtime.is-expired .gz-fc-rt-dot{background:#f87171;animation:none;}",
            ".gz-fc-rt-period{font-size:11.5px;font-weight:600;color:#cbd5e1;line-height:1.35;}",
            ".gz-fc-rt-clock{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;}",
            ".gz-fc-rt-seg{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:44px;padding:5px 7px;border-radius:10px;background:rgba(3,5,10,.82);border:1px solid rgba(251,226,157,.32);box-shadow:0 4px 12px rgba(0,0,0,.35);}",
            ".gz-fc-rt-num{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;font-weight:900;line-height:1.05;color:#fffbeb;font-variant-numeric:tabular-nums;}",
            ".gz-fc-rt-unit{margin-top:2px;font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#e7b54c;}",
            ".gz-fc-rt-sep{font-weight:900;font-size:13px;color:rgba(251,226,157,.65);}",
            ".gz-fc-rt-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fde68a;background:rgba(3,5,10,.72);border:1px solid rgba(251,226,157,.32);}",
            ".gz-fc-perks{display:flex;flex-wrap:wrap;gap:8px;}",
            ".gz-fc-perk{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:10px;font-size:11.5px;font-weight:650;color:#e2e8f0;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);}",
            ".gz-fc-perk-dot{width:6px;height:6px;border-radius:999px;background:#f5cb6c;box-shadow:0 0 8px rgba(245,203,108,.75);}",
            ".gz-fc-card.is-claimed .gz-fc-perk-dot{background:#34d399;box-shadow:0 0 8px rgba(52,211,153,.75);}",
            ".gz-fc-cta-row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:2px;}",
            ".gz-fc-btn{position:relative;overflow:hidden;appearance:none;border:1px solid rgba(255,238,186,.68);border-radius:14px;padding:13px 24px;font-size:13.5px;font-weight:900;letter-spacing:.02em;cursor:pointer;color:#171003;background:linear-gradient(135deg,#fff2c6 0%,#f2c464 48%,#dca032 100%);box-shadow:0 14px 32px rgba(242,196,100,.28),0 1px 0 rgba(255,255,255,.65) inset;transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease;white-space:nowrap;}",
            ".gz-fc-btn::after{content:\"\";position:absolute;top:0;bottom:0;width:44%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-140%) skewX(-18deg);animation:gzFcShimmer 4.2s infinite;pointer-events:none;}",
            ".gz-fc-btn:hover:not(:disabled){transform:translateY(-1.5px);box-shadow:0 18px 38px rgba(242,196,100,.4),0 1px 0 rgba(255,255,255,.8) inset;}",
            ".gz-fc-btn:disabled{cursor:not-allowed;opacity:.75;transform:none;box-shadow:none;}",
            ".gz-fc-btn:disabled::after{display:none;}",
            ".gz-fc-card.is-claimed .gz-fc-btn{background:rgba(16,185,129,.18);border-color:rgba(52,211,153,.48);color:#6ee7b7;box-shadow:none;opacity:1;}",
            ".gz-fc-security-note{font-size:11.5px;color:#94a3b8;font-weight:500;}",
            ".gz-fc-pw-box{position:relative;z-index:3;margin-top:16px;padding-top:16px;border-top:1px solid rgba(251,226,157,.16);display:flex;align-items:center;gap:10px;flex-wrap:wrap;}",
            ".gz-fc-pw-box[hidden]{display:none !important;}",
            ".gz-fc-pw-label{flex:1 1 100%;font-size:12px;font-weight:650;color:#f1f5f9;}",
            ".gz-fc-pw-input{flex:1 1 220px;min-width:180px;padding:11px 14px;border-radius:12px;border:1px solid rgba(251,226,157,.28);background:rgba(5,7,12,.72);color:#f8fafc;font-size:13px;outline:none;}",
            ".gz-fc-pw-input:focus{border-color:#f5cb6c;box-shadow:0 0 0 3px rgba(245,203,108,.16);}",
            ".gz-fc-msg{position:relative;z-index:3;margin-top:14px;padding:11px 14px;border-radius:13px;font-size:12.5px;line-height:1.55;font-weight:650;}",
            ".gz-fc-msg[hidden]{display:none !important;}",
            ".gz-fc-msg.is-error{background:rgba(239,68,68,.15);border:1px solid rgba(248,113,113,.4);color:#fecaca;}",
            ".gz-fc-msg.is-success{background:rgba(16,185,129,.16);border:1px solid rgba(52,211,153,.42);color:#a7f3d0;}",
            /* Light mode overrides */
            "html[data-genz-theme=\"light\"] .gz-fc-card{background:radial-gradient(120% 140% at 0% 0%,rgba(245,196,105,.2) 0%,transparent 52%),radial-gradient(110% 120% at 100% 100%,rgba(225,29,72,.08) 0%,transparent 52%),linear-gradient(135deg,#fffdf7 0%,#ffffff 55%,#fff7ed 100%);border-color:rgba(196,143,43,.36);color:#0f172a;box-shadow:0 18px 44px rgba(15,23,42,.09),0 1px 0 rgba(255,255,255,.9) inset;}",
            "html[data-genz-theme=\"light\"] .gz-fc-card.is-claimed{background:linear-gradient(135deg,#ecfdf5 0%,#ffffff 65%);border-color:rgba(5,150,105,.34);}",
            "html[data-genz-theme=\"light\"] .gz-fc-badge{background:rgba(217,154,38,.13);border-color:rgba(180,126,28,.35);color:#92400e;}",
            "html[data-genz-theme=\"light\"] .gz-fc-card.is-claimed .gz-fc-badge{background:rgba(5,150,105,.12);border-color:rgba(5,150,105,.32);color:#047857;}",
            "html[data-genz-theme=\"light\"] .gz-fc-title{background:linear-gradient(135deg,#0f172a 0%,#78350f 75%,#b45309 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}",
            "html[data-genz-theme=\"light\"] .gz-fc-card.is-claimed .gz-fc-title{background:linear-gradient(135deg,#064e3b 0%,#059669 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}",
            "html[data-genz-theme=\"light\"] .gz-fc-desc{color:#334155;}",
            "html[data-genz-theme=\"light\"] .gz-fc-desc strong{color:#b45309;}",
            "html[data-genz-theme=\"light\"] .gz-fc-runtime{background:linear-gradient(135deg,#fffbeb,#ffffff 70%);border-color:rgba(180,126,28,.3);box-shadow:0 6px 18px rgba(15,23,42,.06);}",
            "html[data-genz-theme=\"light\"] .gz-fc-rt-kicker{color:#92400e;}",
            "html[data-genz-theme=\"light\"] .gz-fc-rt-period{color:#475569;}",
            "html[data-genz-theme=\"light\"] .gz-fc-rt-seg{background:#0f172a;border-color:rgba(217,154,38,.45);}",
            "html[data-genz-theme=\"light\"] .gz-fc-rt-sep{color:#b45309;}",
            "html[data-genz-theme=\"light\"] .gz-fc-rt-pill{background:#0f172a;color:#fde68a;}",
            "html[data-genz-theme=\"light\"] .gz-fc-perk{background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.1);color:#1e293b;}",
            "html[data-genz-theme=\"light\"] .gz-fc-security-note{color:#64748b;}",
            "html[data-genz-theme=\"light\"] .gz-fc-card.is-claimed .gz-fc-btn{background:#ecfdf5;border-color:#059669;color:#065f46;}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-box{border-top-color:rgba(15,23,42,.1);}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-label{color:#1e293b;}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-input{background:#ffffff;border-color:#cbd5e1;color:#0f172a;}",
            "html[data-genz-theme=\"light\"] .gz-fc-msg.is-error{background:#fef2f2;border-color:#fca5a5;color:#991b1b;}",
            "html[data-genz-theme=\"light\"] .gz-fc-msg.is-success{background:#ecfdf5;border-color:#6ee7b7;color:#065f46;}",
            "@media (max-width:780px){.gz-fc-card{padding:16px;border-radius:20px;}.gz-fc-layout{grid-template-columns:1fr;gap:16px;}.gz-fc-runtime{flex-direction:column;align-items:flex-start;}.gz-fc-rt-clock{width:100%;justify-content:space-between;}.gz-fc-rt-seg{flex:1 1 0;min-width:0;}.gz-fc-cta-row{flex-direction:column;align-items:stretch;}.gz-fc-btn{width:100%;text-align:center;justify-content:center;}}"
        ].join("\n");
        document.head.appendChild(style);
    }

    function formatIdNumber(n) {
        var val = Math.round(Math.max(0, Number(n) || 0));
        return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    function pad2(n) {
        var v = Math.max(0, Math.floor(Number(n) || 0));
        return v < 10 ? "0" + v : String(v);
    }

    function formatWibDateTime(iso) {
        if (!iso) return "";
        try {
            var d = new Date(iso);
            if (!Number.isFinite(d.getTime())) return "";
            return new Intl.DateTimeFormat("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(d) + " WIB";
        } catch (_e) {
            return "";
        }
    }

    function buildRuntimePeriodText(startsAt, endsAt) {
        var s = formatWibDateTime(startsAt);
        var e = formatWibDateTime(endsAt);
        if (s && e) return s + " — " + e;
        if (e) return "Berakhir: " + e;
        if (s) return "Dimulai: " + s;
        return "Event Eksklusif Sedang Berlangsung · 1x Klaim Unik";
    }

    function splitDuration(ms) {
        var totalSec = Math.max(0, Math.floor(ms / 1000));
        var days = Math.floor(totalSec / 86400);
        var hours = Math.floor((totalSec % 86400) / 3600);
        var minutes = Math.floor((totalSec % 3600) / 60);
        var seconds = totalSec % 60;
        return { days: days, hours: hours, minutes: minutes, seconds: seconds };
    }

    function stopRootTimer(root) {
        var prev = activeTickTimers.get(root);
        if (prev) {
            clearInterval(prev);
            activeTickTimers.delete(root);
        }
    }

    async function mountClaimCard(containerOrSelector, options) {
        var opts = options || {};
        var root = typeof containerOrSelector === "string"
            ? document.querySelector(containerOrSelector)
            : containerOrSelector;
        if (!root) return null;

        injectStyles();
        stopRootTimer(root);

        /* Sembunyikan sementara sampai status server terbaca agar bebas kedipan */
        root.hidden = true;

        var needsPassword = false;
        var isBusy = false;
        var isRendered = false;
        var isClaimed = false;
        var currentNominal = DEFAULT_CREDIT_AMOUNT;
        var startsAtIso = null;
        var endsAtIso = null;
        var clockOffsetMs = 0;

        async function resolveToken() {
            if (typeof opts.getAccessToken === "function") {
                var custom = await opts.getAccessToken();
                if (custom) return String(custom);
            }
            return readAccessTokenFromStorage();
        }

        function nowSyncedMs() {
            return Date.now() + clockOffsetMs;
        }

        function ensureRendered() {
            if (isRendered && root.querySelector("#genzFreeCreditCard")) return;
            isRendered = true;
            var lbl = formatIdNumber(currentNominal);

            root.innerHTML = [
                '<div class="gz-fc-card" id="genzFreeCreditCard">',
                '  <div class="gz-fc-layout">',
                '    <div class="gz-fc-media" id="genzFcMedia">',
                '      <div class="gz-fc-media-top">',
                '        <span class="gz-fc-vip-chip">✦ EXCLUSIVE REWARD</span>',
                '        <span class="gz-fc-value-chip" id="genzFcValueChip">+' + lbl + ' CR</span>',
                '      </div>',
                '      <img class="gz-fc-banner-img" id="genzFcBannerImg" alt="Banner Event Free Credit GEN-Z.AI" loading="eager" decoding="async" hidden>',
                '      <div class="gz-fc-art" id="genzFcDefaultArt">',
                '        <span class="gz-fc-art-kicker">GEN-Z.AI PRIVILEGE PASS</span>',
                '        <span class="gz-fc-art-amount" id="genzFcArtAmount">+' + lbl + ' CR</span>',
                '        <span class="gz-fc-art-sub">FREE STUDIO CREDIT</span>',
                '      </div>',
                '    </div>',
                '    <div class="gz-fc-body">',
                '      <div class="gz-fc-head-row">',
                '        <span class="gz-fc-badge" id="genzFcBadge">✦ VIP EVENT REWARD • 1X KLAIM</span>',
                '      </div>',
                '      <h3 class="gz-fc-title" id="genzFcTitle">Klaim ' + lbl + ' Credit Gratis</h3>',
                '      <p class="gz-fc-desc" id="genzFcDesc">Nikmati <strong>' + lbl + ' credit gratis</strong> eksklusif untuk menjelajahi seluruh fitur AI Studio GEN-Z.AI. Berlaku 1 kali untuk setiap email, alamat IP, password, dan browser yang unik.</p>',
                '      <div class="gz-fc-runtime" id="genzFcRuntimeBar">',
                '        <div class="gz-fc-rt-meta">',
                '          <span class="gz-fc-rt-kicker"><span class="gz-fc-rt-dot"></span><span id="genzFcRtLabel">LIVE EVENT RUNTIME</span></span>',
                '          <span class="gz-fc-rt-period" id="genzFcRtPeriod">Memuat jadwal event…</span>',
                '        </div>',
                '        <div class="gz-fc-rt-clock" id="genzFcRtClock"></div>',
                '      </div>',
                '      <div class="gz-fc-perks">',
                '        <span class="gz-fc-perk"><span class="gz-fc-perk-dot"></span>Saldo Masuk Instan</span>',
                '        <span class="gz-fc-perk"><span class="gz-fc-perk-dot"></span>Semua Fitur AI Studio</span>',
                '        <span class="gz-fc-perk"><span class="gz-fc-perk-dot"></span>1x Akun &amp; Perangkat Unik</span>',
                '      </div>',
                '      <div class="gz-fc-cta-row">',
                '        <button type="button" class="gz-fc-btn" id="genzFcClaimBtn">✦ Klaim ' + lbl + ' Credit Gratis</button>',
                '        <span class="gz-fc-security-note" id="genzFcSubNote">Langsung aktif ke saldo akun Anda</span>',
                '      </div>',
                '    </div>',
                '  </div>',
                '  <div class="gz-fc-pw-box" id="genzFcPwBox" hidden>',
                '    <label class="gz-fc-pw-label" for="genzFcPwInput" id="genzFcPwLabel">Konfirmasi password akun Anda satu kali untuk verifikasi keunikan klaim:</label>',
                '    <input type="password" id="genzFcPwInput" class="gz-fc-pw-input" placeholder="Masukkan password akun Anda" autocomplete="current-password">',
                '    <button type="button" class="gz-fc-btn" id="genzFcPwSubmitBtn">Verifikasi &amp; Klaim ' + lbl + '</button>',
                '  </div>',
                '  <div class="gz-fc-msg" id="genzFcMsg" role="status" aria-live="polite" hidden></div>',
                '</div>'
            ].join("\n");

            var bannerImg = root.querySelector("#genzFcBannerImg");
            var defaultArt = root.querySelector("#genzFcDefaultArt");
            if (bannerImg && defaultArt) {
                bannerImg.addEventListener("error", function () {
                    bannerImg.hidden = true;
                    bannerImg.removeAttribute("src");
                    defaultArt.hidden = false;
                });
            }

            var claimBtn = root.querySelector("#genzFcClaimBtn");
            var pwInput = root.querySelector("#genzFcPwInput");
            var pwSubmitBtn = root.querySelector("#genzFcPwSubmitBtn");

            if (claimBtn) {
                claimBtn.addEventListener("click", function () {
                    void submitClaim("");
                });
            }

            if (pwSubmitBtn && pwInput) {
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
            }
        }

        function applyNominalToUnclaimedUI(amount) {
            currentNominal = Math.max(100, Math.round(Number(amount) || DEFAULT_CREDIT_AMOUNT));
            var lbl = formatIdNumber(currentNominal);

            var valChip = root.querySelector("#genzFcValueChip");
            var artAmt = root.querySelector("#genzFcArtAmount");
            var title = root.querySelector("#genzFcTitle");
            var desc = root.querySelector("#genzFcDesc");
            var claimBtn = root.querySelector("#genzFcClaimBtn");
            var pwSubmitBtn = root.querySelector("#genzFcPwSubmitBtn");

            if (valChip) valChip.textContent = "+" + lbl + " CR";
            if (artAmt) artAmt.textContent = "+" + lbl + " CR";
            if (title) title.textContent = "Klaim " + lbl + " Credit Gratis";
            if (!isClaimed && desc) {
                desc.innerHTML =
                    "Nikmati <strong>" + lbl + " credit gratis</strong> eksklusif untuk menjelajahi seluruh fitur AI Studio GEN-Z.AI. Berlaku 1 kali untuk setiap email, alamat IP, password, dan browser yang unik.";
            }
            if (!isClaimed && !isBusy && claimBtn) {
                claimBtn.textContent = "✦ Klaim " + lbl + " Credit Gratis";
            }
            if (pwSubmitBtn) {
                pwSubmitBtn.textContent = "Verifikasi & Klaim " + lbl;
            }
        }

        function renderClockSegments(clockEl, msRemaining) {
            var d = splitDuration(msRemaining);
            clockEl.innerHTML = [
                '<div class="gz-fc-rt-seg"><span class="gz-fc-rt-num">' + pad2(d.days) + '</span><span class="gz-fc-rt-unit">HARI</span></div>',
                '<span class="gz-fc-rt-sep">:</span>',
                '<div class="gz-fc-rt-seg"><span class="gz-fc-rt-num">' + pad2(d.hours) + '</span><span class="gz-fc-rt-unit">JAM</span></div>',
                '<span class="gz-fc-rt-sep">:</span>',
                '<div class="gz-fc-rt-seg"><span class="gz-fc-rt-num">' + pad2(d.minutes) + '</span><span class="gz-fc-rt-unit">MNT</span></div>',
                '<span class="gz-fc-rt-sep">:</span>',
                '<div class="gz-fc-rt-seg"><span class="gz-fc-rt-num">' + pad2(d.seconds) + '</span><span class="gz-fc-rt-unit">DTK</span></div>'
            ].join("");
        }

        function updateRuntimeTick() {
            var rtBar = root.querySelector("#genzFcRuntimeBar");
            var rtLabel = root.querySelector("#genzFcRtLabel");
            var rtPeriod = root.querySelector("#genzFcRtPeriod");
            var rtClock = root.querySelector("#genzFcRtClock");
            var claimBtn = root.querySelector("#genzFcClaimBtn");
            if (!rtBar || !rtLabel || !rtPeriod || !rtClock) return;

            var nowMs = nowSyncedMs();
            var startMs = startsAtIso ? Date.parse(startsAtIso) : NaN;
            var endMs = endsAtIso ? Date.parse(endsAtIso) : NaN;
            var lblNominal = formatIdNumber(currentNominal);

            rtPeriod.textContent = buildRuntimePeriodText(startsAtIso, endsAtIso);

            if (Number.isFinite(startMs) && nowMs < startMs) {
                rtBar.className = "gz-fc-runtime is-scheduled";
                rtLabel.textContent = "EVENT DIMULAI DALAM";
                renderClockSegments(rtClock, startMs - nowMs);
                if (!isClaimed && !isBusy && claimBtn) {
                    claimBtn.disabled = true;
                    claimBtn.textContent = "⏳ Menunggu Event Dimulai";
                }
                return;
            }

            if (Number.isFinite(endMs) && nowMs >= endMs) {
                rtBar.className = "gz-fc-runtime is-expired";
                rtLabel.textContent = "WAKTU EVENT BERAKHIR";
                renderClockSegments(rtClock, 0);
                if (!isClaimed && !isBusy && claimBtn) {
                    claimBtn.disabled = true;
                    claimBtn.textContent = "Waktu Event Telah Berakhir";
                }
                return;
            }

            rtBar.className = "gz-fc-runtime";
            if (Number.isFinite(endMs)) {
                rtLabel.textContent = "SISA WAKTU EVENT";
                renderClockSegments(rtClock, endMs - nowMs);
            } else {
                rtLabel.textContent = "LIVE EVENT RUNTIME";
                rtClock.innerHTML = '<span class="gz-fc-rt-pill">✦ LIVE · AKTIF SEKARANG</span>';
            }

            if (!isClaimed && !isBusy && claimBtn && claimBtn.textContent !== "Tidak Memenuhi Syarat Klaim") {
                claimBtn.disabled = false;
                claimBtn.textContent = "✦ Klaim " + lblNominal + " Credit Gratis";
            }
        }

        function startRuntimeTicker() {
            stopRootTimer(root);
            updateRuntimeTick();
            if (startsAtIso || endsAtIso) {
                var timer = setInterval(function () {
                    if (!document.body.contains(root)) {
                        stopRootTimer(root);
                        return;
                    }
                    updateRuntimeTick();
                }, 1000);
                activeTickTimers.set(root, timer);
            }
        }

        function applyBannerImage(url) {
            var bannerImg = root.querySelector("#genzFcBannerImg");
            var defaultArt = root.querySelector("#genzFcDefaultArt");
            if (!bannerImg || !defaultArt) return;

            var clean = typeof url === "string" ? url.trim() : "";
            if (clean && /^https:\/\//i.test(clean)) {
                defaultArt.hidden = true;
                bannerImg.hidden = false;
                if (bannerImg.getAttribute("src") !== clean) {
                    bannerImg.src = clean;
                }
            } else {
                bannerImg.hidden = true;
                bannerImg.removeAttribute("src");
                defaultArt.hidden = false;
            }
        }

        function hideDisabledCard() {
            stopRootTimer(root);
            isRendered = false;
            root.innerHTML = "";
            root.hidden = true;
        }

        function setMsg(text, kind) {
            var msgBox = root.querySelector("#genzFcMsg");
            if (!msgBox) return;
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

        function markClaimedUI(claimedAt, grantedNominal) {
            isClaimed = true;
            var amt = Math.max(100, Math.round(Number(grantedNominal || currentNominal || DEFAULT_CREDIT_AMOUNT)));
            var lbl = formatIdNumber(amt);

            var card = root.querySelector("#genzFreeCreditCard");
            var badge = root.querySelector("#genzFcBadge");
            var valChip = root.querySelector("#genzFcValueChip");
            var artAmt = root.querySelector("#genzFcArtAmount");
            var title = root.querySelector("#genzFcTitle");
            var desc = root.querySelector("#genzFcDesc");
            var claimBtn = root.querySelector("#genzFcClaimBtn");
            var subNote = root.querySelector("#genzFcSubNote");
            var pwBox = root.querySelector("#genzFcPwBox");
            if (!card || !badge || !desc || !claimBtn || !pwBox) return;

            card.classList.add("is-claimed");
            if (valChip) valChip.textContent = "+" + lbl + " CR";
            if (artAmt) artAmt.textContent = "+" + lbl + " CR";
            if (title) title.textContent = "Bonus " + lbl + " Credit Gratis Aktif";
            badge.textContent = "✓ SUDAH DIKLAIM • +" + lbl + " CREDIT";
            claimBtn.disabled = true;
            claimBtn.textContent = "✓ " + lbl + " Credit Gratis Sudah Diklaim";
            if (subNote) subNote.textContent = "Bonus eksklusif telah aktif di akun ini";
            pwBox.hidden = true;
            var formatted = formatWibDateTime(claimedAt);
            desc.innerHTML = formatted
                ? "Bonus eksklusif <strong>" + lbl + " credit gratis</strong> telah diklaim pada " + formatted + ". Setiap email, IP, password, dan browser hanya dapat klaim 1 kali."
                : "Bonus eksklusif <strong>" + lbl + " credit gratis</strong> sudah pernah diklaim pada akun ini.";
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

                if (data.claim_enabled === false || data.runtime_status === "disabled") {
                    hideDisabledCard();
                    return;
                }

                /* Bila event sudah habis masa runtime dan user belum pernah klaim,
                   sembunyikan kartu agar halaman dashboard tetap bersih. */
                if (data.runtime_status === "expired" && !data.claimed) {
                    hideDisabledCard();
                    return;
                }

                if (data.server_time) {
                    var parsedServer = Date.parse(data.server_time);
                    if (Number.isFinite(parsedServer)) {
                        clockOffsetMs = parsedServer - Date.now();
                    }
                }

                currentNominal = Math.max(
                    100,
                    Math.round(Number(data.credit_amount || data.configured_credit_amount || DEFAULT_CREDIT_AMOUNT))
                );
                startsAtIso = data.runtime_starts_at || null;
                endsAtIso = data.runtime_ends_at || null;
                isClaimed = Boolean(data.claimed);

                ensureRendered();
                root.hidden = false;
                applyNominalToUnclaimedUI(currentNominal);
                applyBannerImage(data.banner_image_url);

                needsPassword = !data.has_password_signal;
                if (data.claimed) {
                    markClaimedUI(data.claimed_at, currentNominal);
                }

                startRuntimeTicker();
            } catch (_e) { /* ignore */ }
        }

        async function submitClaim(explicitPassword) {
            if (isBusy) return;
            setMsg("", "");

            var claimBtn = root.querySelector("#genzFcClaimBtn");
            var pwBox = root.querySelector("#genzFcPwBox");
            var pwInput = root.querySelector("#genzFcPwInput");
            var pwSubmitBtn = root.querySelector("#genzFcPwSubmitBtn");
            if (!claimBtn || !pwBox || !pwSubmitBtn) return;

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
                    var grantedAmt = Number(data.credit_amount || currentNominal || DEFAULT_CREDIT_AMOUNT);
                    var grantedLabel = formatIdNumber(grantedAmt);
                    markClaimedUI(data.claimed_at, grantedAmt);
                    setMsg(
                        data.message || ("Selamat! Free Credit " + grantedLabel + " Gratis berhasil ditambahkan ke saldo Anda."),
                        "success"
                    );
                    applyBalanceToPage(data.balance_after);
                    if (typeof opts.onClaimed === "function") {
                        opts.onClaimed(data);
                    }
                    if (window.GENZToast && typeof window.GENZToast.success === "function") {
                        window.GENZToast.success("Berhasil klaim +" + grantedLabel + " Credit Gratis!");
                    }
                    isBusy = false;
                    return;
                }

                if (data && data.code === "feature_disabled") {
                    hideDisabledCard();
                    if (window.GENZToast && typeof window.GENZToast.error === "function") {
                        window.GENZToast.error(
                            data.error || "Program Klaim Free Credit sedang dinonaktifkan."
                        );
                    }
                    isBusy = false;
                    return;
                }

                if (data && (data.code === "event_not_started" || data.code === "event_expired")) {
                    setMsg(
                        data.error || "Event belum dimulai atau masa runtime telah berakhir.",
                        "error"
                    );
                    pwSubmitBtn.disabled = false;
                    isBusy = false;
                    updateRuntimeTick();
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
                    markClaimedUI(null, currentNominal);
                    setMsg(
                        data.error || ("Akun ini sudah pernah mengklaim " + formatIdNumber(currentNominal) + " Credit Gratis."),
                        "error"
                    );
                    isBusy = false;
                    return;
                }

                setMsg(
                    (data && data.error) ||
                        "Klaim Free Credit Gratis ditolak karena terdeteksi kesamaan data.",
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

        await loadStatus();
        return { reloadStatus: loadStatus };
    }

    window.GENZ_FREE_CREDIT = Object.freeze({
        amount: DEFAULT_CREDIT_AMOUNT,
        getSignals: getSignals,
        recordAuthSignal: recordAuthSignal,
        mountClaimCard: mountClaimCard
    });
})();
