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
       TRUE 16:9 LUXURY VIP PRIVILEGE CARD + HOROLOGY RUNTIME
    --------------------------------------------------------- */
    function injectStyles() {
        if (document.getElementById("genz-free-credit-styles")) return;
        var style = document.createElement("style");
        style.id = "genz-free-credit-styles";
        style.textContent = [
            "@keyframes gzFcShimmer{0%{transform:translateX(-140%) skewX(-20deg);}100%{transform:translateX(260%) skewX(-20deg);}}",
            "@keyframes gzFcSheen{0%{transform:translate3d(-115%,0,0) rotate(18deg);}100%{transform:translate3d(215%,0,0) rotate(18deg);}}",
            "@keyframes gzFcPulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.6);}65%{box-shadow:0 0 0 6px rgba(52,211,153,0);}}",
            "@keyframes gzFcOrbit{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}",

            /* Outer 16:9 showcase wrapper: 100% width on HP, sleek 780px gallery showcase on PC */
            ".gz-fc-shell{width:min(100%,780px);margin:0 auto 28px auto;container-type:inline-size;}",

            /* THE TRUE 16:9 LUXURY CARD ITSELF */
            ".gz-fc-card{position:relative;width:100%;aspect-ratio:16 / 9;overflow:hidden;border-radius:clamp(16px,3cqw,26px);border:1px solid rgba(251,226,157,.52);background:radial-gradient(125% 130% at 8% 8%,rgba(245,196,105,.22) 0%,transparent 48%),radial-gradient(110% 125% at 92% 88%,rgba(255,48,72,.2) 0%,transparent 52%),linear-gradient(138deg,#06080f 0%,#0f1422 48%,#05070c 100%);color:#f8fafc;box-shadow:0 28px 68px rgba(0,0,0,.72),0 0 44px rgba(245,203,108,.09),0 1px 0 rgba(255,243,204,.35) inset;isolation:isolate;user-select:none;}",

            /* 24K Metallic Double-Bezel Rim */
            ".gz-fc-card::before{content:\"\";position:absolute;inset:0;border-radius:inherit;padding:1.25px;background:linear-gradient(135deg,rgba(255,244,209,.82) 0%,rgba(231,181,76,.48) 26%,rgba(255,255,255,.08) 50%,rgba(255,58,86,.42) 76%,rgba(251,226,157,.78) 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:4;}",

            /* Subtle Holographic Satin Foil Sweep */
            ".gz-fc-card::after{content:\"\";position:absolute;top:-45%;bottom:-45%;width:34%;background:linear-gradient(90deg,transparent 0%,rgba(255,244,212,.09) 48%,transparent 100%);animation:gzFcSheen 8.5s ease-in-out infinite;pointer-events:none;z-index:2;}",

            ".gz-fc-card.is-claimed{border-color:rgba(110,231,183,.54);box-shadow:0 26px 64px rgba(0,0,0,.68),0 0 40px rgba(16,185,129,.1);}",
            ".gz-fc-card.is-claimed::before{background:linear-gradient(135deg,rgba(167,243,208,.8) 0%,rgba(52,211,153,.45) 36%,rgba(255,255,255,.08) 62%,rgba(251,226,157,.6) 100%);}",

            /* Full-bleed 16:9 Stage (Uploaded Banner OR Bespoke Obsidian-Gold Guilloche Art) */
            ".gz-fc-stage{position:absolute;inset:0;z-index:0;overflow:hidden;}",
            ".gz-fc-banner-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .8s cubic-bezier(.22,1,.36,1);}",
            ".gz-fc-card:hover .gz-fc-banner-img{transform:scale(1.035);}",
            ".gz-fc-banner-img[hidden]{display:none !important;}",

            /* Bespoke Default 16:9 Royal Obsidian & 24K Gold Artwork */
            ".gz-fc-art{position:absolute;inset:0;background:radial-gradient(62% 78% at 76% 36%,rgba(245,196,105,.24) 0%,rgba(245,196,105,.06) 42%,transparent 74%),radial-gradient(50% 60% at 88% 72%,rgba(255,48,72,.2) 0%,transparent 70%),radial-gradient(55% 65% at 14% 18%,rgba(251,226,157,.12) 0%,transparent 65%),linear-gradient(135deg,#070910 0%,#0e1320 46%,#05070c 100%);}",
            ".gz-fc-art[hidden]{display:none !important;}",
            ".gz-fc-art::before{content:\"\";position:absolute;inset:0;background-image:linear-gradient(rgba(251,226,157,.042) 1px,transparent 1px),linear-gradient(90deg,rgba(251,226,157,.042) 1px,transparent 1px);background-size:clamp(18px,4cqw,32px) clamp(18px,4cqw,32px);mask-image:radial-gradient(circle at 72% 40%,#000 18%,transparent 82%);-webkit-mask-image:radial-gradient(circle at 72% 40%,#000 18%,transparent 82%);}",
            ".gz-fc-art-svg{position:absolute;right:-4%;top:-10%;width:58%;height:96%;opacity:.82;pointer-events:none;}",
            ".gz-fc-art-orbit{transform-origin:200px 200px;animation:gzFcOrbit 48s linear infinite;}",
            ".gz-fc-art-emblem{position:absolute;right:clamp(14px,4.5cqw,38px);top:24%;display:flex;flex-direction:column;align-items:flex-end;text-align:right;pointer-events:none;}",
            ".gz-fc-art-kicker{font-size:clamp(7.5px,1.5cqw,10.5px);font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:rgba(251,226,157,.78);}",
            ".gz-fc-art-amount{margin-top:2px;font-size:clamp(22px,6.4cqw,52px);font-weight:900;letter-spacing:-.035em;line-height:.96;background:linear-gradient(135deg,#fff9e6 0%,#f5cb6c 48%,#dca032 78%,#ff6b81 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 26px rgba(245,196,105,.28));opacity:.94;}",
            ".gz-fc-art-sub{margin-top:3px;font-size:clamp(7px,1.4cqw,10px);font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:rgba(226,232,240,.66);}",

            /* Multi-stop Luxury Scrim so Custom Photos & Default Art Both Shine + Text Stays 100% Crisp */
            ".gz-fc-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(4,6,12,.64) 0%,rgba(4,6,12,.12) 32%,rgba(4,6,12,.28) 54%,rgba(4,6,12,.92) 100%),linear-gradient(90deg,rgba(4,6,12,.78) 0%,rgba(4,6,12,.38) 52%,rgba(4,6,12,.14) 100%);}",

            /* Corner Filigree Accents */
            ".gz-fc-corner{position:absolute;width:clamp(14px,2.8cqw,24px);height:clamp(14px,2.8cqw,24px);border-color:rgba(251,226,157,.58);pointer-events:none;z-index:3;}",
            ".gz-fc-corner--tl{top:clamp(7px,1.5cqw,12px);left:clamp(7px,1.5cqw,12px);border-top:1.5px solid rgba(251,226,157,.58);border-left:1.5px solid rgba(251,226,157,.58);border-top-left-radius:clamp(8px,1.8cqw,14px);}",
            ".gz-fc-corner--br{bottom:clamp(7px,1.5cqw,12px);right:clamp(7px,1.5cqw,12px);border-bottom:1.5px solid rgba(251,226,157,.58);border-right:1.5px solid rgba(251,226,157,.58);border-bottom-right-radius:clamp(8px,1.8cqw,14px);}",

            /* 3-Zone Interior inside the 16:9 Card */
            ".gz-fc-face{position:absolute;inset:0;z-index:3;padding:clamp(11px,3.1cqw,26px);display:flex;flex-direction:column;justify-content:space-between;gap:clamp(6px,1.5cqw,14px);}",

            /* Zone 1: Top VIP Header */
            ".gz-fc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}",
            ".gz-fc-badge{display:inline-flex;align-items:center;gap:clamp(4px,1cqw,7px);padding:clamp(3.5px,0.9cqw,6px) clamp(8px,1.9cqw,13px);border-radius:999px;font-size:clamp(8px,1.65cqw,11px);font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fde68a;background:rgba(6,8,15,.76);border:1px solid rgba(251,226,157,.44);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 18px rgba(0,0,0,.36);white-space:nowrap;}",
            ".gz-fc-card.is-claimed .gz-fc-badge{background:rgba(6,24,19,.82);border-color:rgba(110,231,183,.52);color:#6ee7b7;}",
            ".gz-fc-value-chip{display:inline-flex;align-items:center;gap:4px;padding:clamp(3.5px,0.9cqw,6px) clamp(9px,2cqw,14px);border-radius:999px;font-size:clamp(9px,1.85cqw,12.5px);font-weight:900;letter-spacing:.08em;color:#171002;background:linear-gradient(135deg,#fff6d6 0%,#f3c664 52%,#d6992a 100%);border:1px solid rgba(255,248,220,.85);box-shadow:0 8px 22px rgba(242,196,100,.34),0 1px 0 rgba(255,255,255,.75) inset;white-space:nowrap;}",
            ".gz-fc-card.is-claimed .gz-fc-value-chip{background:linear-gradient(135deg,#d1fae5 0%,#34d399 100%);color:#042f2e;border-color:rgba(209,250,229,.85);box-shadow:0 8px 22px rgba(16,185,129,.3);}",

            /* Zone 2 + Zone 3 Lower Showcase Stack */
            ".gz-fc-lower{display:flex;flex-direction:column;gap:clamp(6px,1.8cqw,13px);min-width:0;}",
            ".gz-fc-copy{display:flex;flex-direction:column;gap:clamp(2px,0.6cqw,5px);max-width:78%;min-width:0;}",
            ".gz-fc-title{margin:0;font-size:clamp(14.5px,4.1cqw,30px);font-weight:900;line-height:1.12;letter-spacing:-.025em;background:linear-gradient(135deg,#ffffff 0%,#fffbeb 48%,#f5cb6c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 14px rgba(0,0,0,.65));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
            ".gz-fc-card.is-claimed .gz-fc-title{background:linear-gradient(135deg,#ffffff 0%,#d1fae5 62%,#6ee7b7 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}",
            ".gz-fc-desc{margin:0;font-size:clamp(9px,1.95cqw,13px);line-height:1.38;color:rgba(241,245,249,.9);text-shadow:0 2px 8px rgba(0,0,0,.85);display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}",
            ".gz-fc-desc strong{color:#fde68a;font-weight:800;}",
            ".gz-fc-card.is-claimed .gz-fc-desc strong{color:#6ee7b7;}",

            /* Zone 3: Luxury Frosted Obsidian-Gold Horology & CTA Dock */
            ".gz-fc-dock{display:flex;align-items:center;justify-content:space-between;gap:clamp(7px,2cqw,16px);padding:clamp(6px,1.65cqw,12px) clamp(8px,2.1cqw,15px);border-radius:clamp(11px,2.1cqw,16px);border:1px solid rgba(251,226,157,.34);background:linear-gradient(135deg,rgba(12,16,27,.84) 0%,rgba(5,7,13,.92) 72%,rgba(34,24,10,.82) 100%);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 28px rgba(0,0,0,.46),0 1px 0 rgba(255,255,255,.08) inset;}",

            /* Horology Runtime Left Side */
            ".gz-fc-runtime{display:flex;align-items:center;gap:clamp(6px,1.8cqw,14px);min-width:0;flex:1 1 auto;}",
            ".gz-fc-rt-meta{display:flex;flex-direction:column;gap:1px;min-width:0;}",
            ".gz-fc-rt-kicker{display:inline-flex;align-items:center;gap:clamp(4px,0.9cqw,6px);font-size:clamp(7.5px,1.5cqw,10px);font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#fbe29d;white-space:nowrap;}",
            ".gz-fc-rt-dot{width:clamp(5px,1cqw,7px);height:clamp(5px,1cqw,7px);border-radius:999px;background:#34d399;animation:gzFcPulse 2s infinite;flex:0 0 auto;}",
            ".gz-fc-runtime.is-scheduled .gz-fc-rt-dot{background:#fbbf24;}",
            ".gz-fc-runtime.is-expired .gz-fc-rt-dot{background:#f87171;animation:none;}",
            ".gz-fc-rt-period{font-size:clamp(7.5px,1.45cqw,10.5px);font-weight:600;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(92px,26cqw,240px);}",
            ".gz-fc-rt-clock{display:inline-flex;align-items:center;gap:clamp(2px,0.65cqw,5px);flex:0 0 auto;}",
            ".gz-fc-rt-seg{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:clamp(24px,5.6cqw,42px);padding:clamp(2.5px,0.7cqw,5px) clamp(3px,0.9cqw,6px);border-radius:clamp(6px,1.2cqw,9px);background:rgba(3,5,10,.88);border:1px solid rgba(251,226,157,.34);box-shadow:0 3px 10px rgba(0,0,0,.38);}",
            ".gz-fc-rt-num{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:clamp(9.5px,2.05cqw,14px);font-weight:900;line-height:1;color:#fffbeb;font-variant-numeric:tabular-nums;}",
            ".gz-fc-rt-unit{margin-top:1.5px;font-size:clamp(5.5px,1.05cqw,7.5px);font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#e7b54c;line-height:1;}",
            ".gz-fc-rt-sep{font-weight:900;font-size:clamp(8px,1.6cqw,12px);color:rgba(251,226,157,.65);}",
            ".gz-fc-rt-pill{display:inline-flex;align-items:center;gap:4px;padding:clamp(3px,0.8cqw,5px) clamp(7px,1.6cqw,11px);border-radius:999px;font-size:clamp(7.5px,1.5cqw,10px);font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fde68a;background:rgba(3,5,10,.82);border:1px solid rgba(251,226,157,.32);white-space:nowrap;}",

            /* 24K Gold Bullion Claim Button Right Side */
            ".gz-fc-btn{position:relative;overflow:hidden;appearance:none;flex:0 0 auto;border:1px solid rgba(255,244,204,.82);border-radius:clamp(8px,1.8cqw,13px);padding:clamp(7px,1.85cqw,12px) clamp(10px,2.8cqw,22px);font-size:clamp(9.5px,2.05cqw,13.5px);font-weight:900;letter-spacing:.02em;cursor:pointer;color:#171003;background:linear-gradient(135deg,#fff5d1 0%,#f3c664 48%,#d69828 100%);box-shadow:0 10px 26px rgba(242,196,100,.34),0 1px 0 rgba(255,255,255,.72) inset;transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease;white-space:nowrap;}",
            ".gz-fc-btn::after{content:\"\";position:absolute;top:0;bottom:0;width:44%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);transform:translateX(-140%) skewX(-18deg);animation:gzFcShimmer 3.8s infinite;pointer-events:none;}",
            ".gz-fc-btn:hover:not(:disabled){transform:translateY(-1.5px);box-shadow:0 14px 32px rgba(242,196,100,.48),0 1px 0 rgba(255,255,255,.85) inset;}",
            ".gz-fc-btn:disabled{cursor:not-allowed;opacity:.82;transform:none;box-shadow:none;}",
            ".gz-fc-btn:disabled::after{display:none;}",
            ".gz-fc-card.is-claimed .gz-fc-btn{background:rgba(16,185,129,.22);border-color:rgba(110,231,183,.55);color:#a7f3d0;box-shadow:none;opacity:1;}",

            /* Compact HP optimization inside the dock so 4 chrono tiles + Gold CTA breathe comfortably */
            "@container (max-width: 480px){.gz-fc-rt-meta{display:none;}.gz-fc-copy{max-width:86%;}}",
            "@media (max-width: 520px){.gz-fc-rt-meta{display:none;}.gz-fc-copy{max-width:86%;}}",

            /* Auxiliary Drawer Below the 16:9 Card (keeps the card itself pure 16:9 forever) */
            ".gz-fc-pw-box{margin-top:10px;padding:12px 14px;border-radius:14px;border:1px solid rgba(251,226,157,.3);background:linear-gradient(135deg,#0b0f1a,#070a11);display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 14px 32px rgba(0,0,0,.45);}",
            ".gz-fc-pw-box[hidden]{display:none !important;}",
            ".gz-fc-pw-label{flex:1 1 100%;font-size:12px;font-weight:650;color:#f1f5f9;}",
            ".gz-fc-pw-input{flex:1 1 200px;min-width:160px;padding:10px 13px;border-radius:11px;border:1px solid rgba(251,226,157,.32);background:rgba(4,6,11,.88);color:#f8fafc;font-size:13px;outline:none;}",
            ".gz-fc-pw-input:focus{border-color:#f5cb6c;box-shadow:0 0 0 3px rgba(245,203,108,.18);}",
            ".gz-fc-msg{margin-top:10px;padding:11px 14px;border-radius:13px;font-size:12.5px;line-height:1.5;font-weight:650;}",
            ".gz-fc-msg[hidden]{display:none !important;}",
            ".gz-fc-msg.is-error{background:rgba(239,68,68,.16);border:1px solid rgba(248,113,113,.42);color:#fecaca;}",
            ".gz-fc-msg.is-success{background:rgba(16,185,129,.16);border:1px solid rgba(52,211,153,.44);color:#a7f3d0;}",

            /* Light mode keeps the card itself as an Iconic Obsidian-Velvet & 24K Gold Collectors Card with crisp gallery shadow */
            "html[data-genz-theme=\"light\"] .gz-fc-card{border-color:rgba(196,143,43,.58);box-shadow:0 24px 52px rgba(15,23,42,.24),0 0 0 1px rgba(251,226,157,.35) inset;}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-box{background:#ffffff;border-color:rgba(180,126,28,.34);box-shadow:0 10px 26px rgba(15,23,42,.08);}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-label{color:#0f172a;}",
            "html[data-genz-theme=\"light\"] .gz-fc-pw-input{background:#f8fafc;border-color:#cbd5e1;color:#0f172a;}",
            "html[data-genz-theme=\"light\"] .gz-fc-msg.is-error{background:#fef2f2;border-color:#fca5a5;color:#991b1b;}",
            "html[data-genz-theme=\"light\"] .gz-fc-msg.is-success{background:#ecfdf5;border-color:#6ee7b7;color:#065f46;}"
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
                '<div class="gz-fc-shell">',
                '  <div class="gz-fc-card" id="genzFreeCreditCard">',
                '    <div class="gz-fc-stage" id="genzFcMedia">',
                '      <img class="gz-fc-banner-img" id="genzFcBannerImg" alt="Banner Event Free Credit GEN-Z.AI" loading="eager" decoding="async" hidden>',
                '      <div class="gz-fc-art" id="genzFcDefaultArt">',
                '        <svg class="gz-fc-art-svg" viewBox="0 0 400 400" fill="none" aria-hidden="true">',
                '          <defs>',
                '            <linearGradient id="gzFcGoldGrad" x1="40" y1="40" x2="360" y2="360" gradientUnits="userSpaceOnUse">',
                '              <stop offset="0%" stop-color="#FFF6D6" stop-opacity="0.78"/>',
                '              <stop offset="48%" stop-color="#F5CB6C" stop-opacity="0.46"/>',
                '              <stop offset="100%" stop-color="#FF4D6D" stop-opacity="0.32"/>',
                '            </linearGradient>',
                '          </defs>',
                '          <g class="gz-fc-art-orbit">',
                '            <circle cx="200" cy="200" r="168" stroke="url(#gzFcGoldGrad)" stroke-width="0.9" stroke-dasharray="5 9"/>',
                '            <circle cx="200" cy="200" r="134" stroke="url(#gzFcGoldGrad)" stroke-width="0.8"/>',
                '            <circle cx="200" cy="200" r="98" stroke="url(#gzFcGoldGrad)" stroke-width="0.9" stroke-dasharray="2 6"/>',
                '            <rect x="112" y="112" width="176" height="176" rx="18" transform="rotate(45 200 200)" stroke="url(#gzFcGoldGrad)" stroke-width="0.75"/>',
                '          </g>',
                '          <circle cx="200" cy="200" r="56" stroke="url(#gzFcGoldGrad)" stroke-width="1.1"/>',
                '          <path d="M200 162 L209 191 L238 200 L209 209 L200 238 L191 209 L162 200 L191 191 Z" fill="url(#gzFcGoldGrad)" fill-opacity="0.35"/>',
                '        </svg>',
                '        <div class="gz-fc-art-emblem">',
                '          <span class="gz-fc-art-kicker">GEN-Z.AI ROYAL PASS</span>',
                '          <span class="gz-fc-art-amount" id="genzFcArtAmount">+' + lbl + ' CR</span>',
                '          <span class="gz-fc-art-sub">16:9 STUDIO PRIVILEGE</span>',
                '        </div>',
                '      </div>',
                '    </div>',
                '    <div class="gz-fc-scrim" aria-hidden="true"></div>',
                '    <span class="gz-fc-corner gz-fc-corner--tl" aria-hidden="true"></span>',
                '    <span class="gz-fc-corner gz-fc-corner--br" aria-hidden="true"></span>',
                '    <div class="gz-fc-face">',
                '      <div class="gz-fc-top">',
                '        <span class="gz-fc-badge" id="genzFcBadge">✦ VIP EVENT REWARD • 1X KLAIM</span>',
                '        <span class="gz-fc-value-chip" id="genzFcValueChip">+' + lbl + ' CR</span>',
                '      </div>',
                '      <div class="gz-fc-lower">',
                '        <div class="gz-fc-copy">',
                '          <h3 class="gz-fc-title" id="genzFcTitle">Klaim ' + lbl + ' Credit Gratis</h3>',
                '          <p class="gz-fc-desc" id="genzFcDesc">Bonus eksklusif <strong>' + lbl + ' credit gratis</strong> untuk seluruh fitur AI Studio • 1x email, IP, password &amp; browser unik.</p>',
                '        </div>',
                '        <div class="gz-fc-dock">',
                '          <div class="gz-fc-runtime" id="genzFcRuntimeBar">',
                '            <div class="gz-fc-rt-meta">',
                '              <span class="gz-fc-rt-kicker"><span class="gz-fc-rt-dot"></span><span id="genzFcRtLabel">LIVE EVENT RUNTIME</span></span>',
                '              <span class="gz-fc-rt-period" id="genzFcRtPeriod">Memuat jadwal event…</span>',
                '            </div>',
                '            <div class="gz-fc-rt-clock" id="genzFcRtClock"></div>',
                '          </div>',
                '          <button type="button" class="gz-fc-btn" id="genzFcClaimBtn">✦ Klaim ' + lbl + ' CR</button>',
                '        </div>',
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
                    "Bonus eksklusif <strong>" + lbl + " credit gratis</strong> untuk seluruh fitur AI Studio • 1x email, IP, password &amp; browser unik.";
            }
            if (!isClaimed && !isBusy && claimBtn) {
                claimBtn.textContent = "✦ Klaim " + lbl + " CR";
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
                rtLabel.textContent = "MULAI DALAM";
                renderClockSegments(rtClock, startMs - nowMs);
                if (!isClaimed && !isBusy && claimBtn) {
                    claimBtn.disabled = true;
                    claimBtn.textContent = "⏳ Menunggu Jadwal";
                }
                return;
            }

            if (Number.isFinite(endMs) && nowMs >= endMs) {
                rtBar.className = "gz-fc-runtime is-expired";
                rtLabel.textContent = "EVENT BERAKHIR";
                renderClockSegments(rtClock, 0);
                if (!isClaimed && !isBusy && claimBtn) {
                    claimBtn.disabled = true;
                    claimBtn.textContent = "Waktu Habis";
                }
                return;
            }

            rtBar.className = "gz-fc-runtime";
            if (Number.isFinite(endMs)) {
                rtLabel.textContent = "SISA RUNTIME";
                renderClockSegments(rtClock, endMs - nowMs);
            } else {
                rtLabel.textContent = "LIVE EVENT RUNTIME";
                rtClock.innerHTML = '<span class="gz-fc-rt-pill">✦ LIVE · AKTIF</span>';
            }

            if (!isClaimed && !isBusy && claimBtn && claimBtn.textContent !== "Tidak Memenuhi Syarat") {
                claimBtn.disabled = false;
                claimBtn.textContent = "✦ Klaim " + lblNominal + " CR";
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
            badge.textContent = "✓ SUDAH DIKLAIM • +" + lbl + " CR";
            claimBtn.disabled = true;
            claimBtn.textContent = "✓ Diklaim +" + lbl + " CR";
            if (subNote) subNote.textContent = "Bonus eksklusif telah aktif di akun ini";
            pwBox.hidden = true;
            var formatted = formatWibDateTime(claimedAt);
            desc.innerHTML = formatted
                ? "Bonus eksklusif <strong>" + lbl + " credit gratis</strong> telah diklaim pada " + formatted + "."
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
                claimBtn.textContent = "Tidak Memenuhi Syarat";
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
