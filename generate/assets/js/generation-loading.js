/* =========================================================
   GEN-Z.AI
   PREMIUM GENERATION LOADING CONTROLLER v7
   ---------------------------------------------------------
   File:
   generate/assets/js/generation-loading.js

   v7 — ROBUST DETECTION + EMERGENCY UNLOCK:
   - Deteksi selesai pakai getComputedStyle (bukan .hidden)
   - Emergency timeout: 60 detik stuck → force finish
   - Force unlock body di semua jalur
   - API forceUnlock() untuk panggil manual
   - Auto-attach ke form submit
   - Semua style inline via JS
========================================================= */

(function (window) {

    "use strict";

    const DEFAULT_STEPS = [
        { id: "queued",     label: "Menghubungi server..." },
        { id: "processing", label: "Memproses prompt" },
        { id: "rendering",  label: "Merender video" },
        { id: "finalizing", label: "Menyelesaikan" }
    ];

    const EMERGENCY_TIMEOUT_MS = 60 * 1000;      // 60 detik stuck → force finish
    const HARD_TIMEOUT_MS      = 5 * 60 * 1000;  // 5 menit total → force finish

    let overlay = null;
    let card = null;
    let kickerText = null;
    let titleEl = null;
    let messageEl = null;
    let progressFill = null;
    let percentEl = null;
    let etaEl = null;
    let stepsEl = null;
    let cancelBtn = null;

    let steps = DEFAULT_STEPS.slice();
    let visible = false;
    let cancelHandler = null;

    /* =====================================================
       UTIL
    ===================================================== */

    function clampPercent(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.max(0, Math.min(100, num));
    }

    function isElementReallyHidden(el) {
        if (!el) return true;
        if (el.hidden === true) return true;

        const style = window.getComputedStyle(el);

        if (style.display === "none") return true;
        if (style.visibility === "hidden") return true;
        if (style.opacity === "0") return true;

        /* Cek width/height 0 (dipakai #loading di generate-premium.css) */
        const w = parseFloat(style.width);
        const h = parseFloat(style.height);

        if (w === 0 && h === 0) return true;

        return false;
    }

    /* =====================================================
       FORCE UNLOCK — RESET BODY
    ===================================================== */

    function forceUnlockBody() {
        try {
            document.body.style.overflow = "";
            document.body.style.position = "";
            document.documentElement.style.overflow = "";
        } catch (e) {
            /* ignore */
        }
    }

    /* =====================================================
       BUILD DOM
    ===================================================== */

    function buildDom() {

        if (overlay) return;

        overlay = document.createElement("div");
        overlay.className = "gen-loading";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "genLoadingTitle");

        overlay.style.cssText = [
            "position:fixed",
            "top:0",
            "left:0",
            "right:0",
            "bottom:0",
            "align-items:flex-start",
            "justify-content:center",
            "padding:70px 14px 14px",
            "box-sizing:border-box",
            "background:rgba(2,4,8,0.78)",
            "-webkit-backdrop-filter:blur(14px)",
            "backdrop-filter:blur(14px)",
            "z-index:99999",
            "overflow-y:auto"
        ].join(";") + ";";

        overlay.style.setProperty("display", "none", "important");

        overlay.innerHTML = `
            <div class="gen-card" id="genLoadingCard"
                 style="position:relative;width:100%;max-width:320px;padding:16px 16px 14px;margin:0;border:1px solid rgba(255,255,255,0.10);border-radius:15px;background:#0a0d13;box-shadow:0 40px 100px rgba(0,0,0,0.70);box-sizing:border-box;max-height:68vh;overflow-y:auto;">

                <div class="gen-kicker"
                     style="display:inline-flex;align-items:center;gap:8px;padding:3px 9px;margin:0 0 10px;border:1px solid rgba(255,51,85,0.28);border-radius:999px;background:rgba(255,51,85,0.10);color:#ff8fa3;font-size:8px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">
                    <span style="width:5px;height:5px;border-radius:50%;background:#ff3355;box-shadow:0 0 8px rgba(255,51,85,0.85);"></span>
                    <span id="genLoadingKicker">GENERATING</span>
                </div>

                <h2 class="gen-title" id="genLoadingTitle"
                    style="margin:0 0 4px;color:#f0f2f7;font-size:14px;font-weight:900;line-height:1.2;letter-spacing:-0.2px;">
                    Sedang <em style="font-style:normal;color:#ff6a7a;">membuat video</em> kamu
                </h2>

                <div class="gen-progress" id="genLoadingProgress"
                     role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
                     style="position:relative;height:3px;margin:12px 0 5px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden;">
                    <div class="gen-progress-fill" id="genLoadingFill"
                         style="position:absolute;top:0;left:0;height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#ff3355,#ff6a7a,#ff3355);box-shadow:0 0 14px rgba(255,51,85,0.55);transition:width 0.6s cubic-bezier(0.4,0,0.2,1);"></div>
                </div>

                <div class="gen-meta"
                     style="display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;color:#5c6570;font-size:9px;font-weight:700;">
                    <span class="gen-percent" id="genLoadingPercent"
                          style="color:#f0f2f7;font-size:11px;font-weight:800;">0%</span>
                    <span class="gen-eta" id="genLoadingEta"></span>
                </div>

                <div class="gen-steps" id="genLoadingSteps"
                     style="display:flex;flex-direction:column;gap:1px;margin:0 0 10px;"></div>

                <div class="gen-message" id="genLoadingMessage"
                     style="display:none;margin:6px 0 0;padding:6px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:7px;background:rgba(0,0,0,0.25);color:rgba(240,242,247,0.72);font-size:10px;line-height:1.4;text-align:center;"></div>

                <button type="button" class="gen-cancel" id="genLoadingCancel"
                        style="width:100%;padding:7px 12px;margin-top:4px;border:1px solid rgba(255,255,255,0.10);border-radius:9px;background:transparent;color:#9ba3b0;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:0.4px;cursor:pointer;">
                    Tutup
                </button>

            </div>
        `;

        document.body.appendChild(overlay);

        card         = overlay.querySelector("#genLoadingCard");
        kickerText   = overlay.querySelector("#genLoadingKicker");
        titleEl      = overlay.querySelector("#genLoadingTitle");
        messageEl    = overlay.querySelector("#genLoadingMessage");
        progressFill = overlay.querySelector("#genLoadingFill");
        percentEl    = overlay.querySelector("#genLoadingPercent");
        etaEl        = overlay.querySelector("#genLoadingEta");
        stepsEl      = overlay.querySelector("#genLoadingSteps");
        cancelBtn    = overlay.querySelector("#genLoadingCancel");

        cancelBtn.addEventListener("click", function () {
            /* PRIORITAS: unlock dulu, baru panggil handler */
            hide();
            forceUnlockBody();
            if (typeof cancelHandler === "function") {
                try { cancelHandler(); } catch (e) { /* ignore */ }
            }
            document.dispatchEvent(new CustomEvent("gen-loading:cancel"));
        });
    }

    /* =====================================================
       RENDER STEPS
    ===================================================== */

    function renderSteps() {
        if (!stepsEl) return;
        stepsEl.innerHTML = steps.map(function (step, i) {
            return `
                <div class="gen-step" data-step-index="${i}"
                     style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;color:#5c6570;font-size:10.5px;font-weight:600;">
                    <span class="gen-step-icon" aria-hidden="true"
                          style="flex:0 0 auto;width:13px;height:13px;border:1.5px solid rgba(255,255,255,0.14);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:transparent;"></span>
                    <span class="gen-step-label"
                          style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${step.label}</span>
                </div>
            `;
        }).join("");
    }

    function setActiveStep(index) {
        if (!stepsEl) return;
        const items = stepsEl.querySelectorAll(".gen-step");

        items.forEach(function (el, i) {
            const icon = el.querySelector(".gen-step-icon");

            el.style.background = "transparent";
            el.style.border = "1px solid transparent";
            el.style.color = "#5c6570";

            if (icon) {
                icon.style.background = "transparent";
                icon.style.borderColor = "rgba(255, 255, 255, 0.14)";
                icon.style.color = "transparent";
                icon.style.boxShadow = "none";
                icon.textContent = "";
            }

            if (i < index) {
                el.style.color = "#66ffa6";
                if (icon) {
                    icon.style.borderColor = "#2ed573";
                    icon.style.background = "#2ed573";
                    icon.style.color = "#041008";
                    icon.textContent = "✓";
                }
            } else if (i === index) {
                el.style.background = "rgba(255, 51, 85, 0.08)";
                el.style.border = "1px solid rgba(255, 51, 85, 0.22)";
                el.style.color = "#f0f2f7";
                if (icon) {
                    icon.style.borderColor = "#ff3355";
                    icon.style.background = "rgba(255, 51, 85, 0.15)";
                    icon.style.boxShadow = "0 0 14px rgba(255, 51, 85, 0.55)";
                }
            }
        });
    }

    function setMessage(text) {
        if (!messageEl) return;
        if (typeof text === "string" && text.trim()) {
            messageEl.textContent = text;
            messageEl.hidden = false;
            messageEl.style.display = "block";
        } else {
            messageEl.textContent = "";
            messageEl.hidden = true;
            messageEl.style.display = "none";
        }
    }

    /* =====================================================
       SHOW
    ===================================================== */

    function show(options) {

        options = options || {};
        buildDom();

        steps = Array.isArray(options.steps) && options.steps.length
            ? options.steps
            : DEFAULT_STEPS.slice();

        cancelHandler = typeof options.onCancel === "function"
            ? options.onCancel
            : null;

        if (card) {
            card.style.borderColor = "rgba(255, 255, 255, 0.10)";
            card.style.boxShadow = "0 40px 100px rgba(0, 0, 0, 0.70)";
        }

        if (kickerText) kickerText.textContent = "GENERATING";
        if (titleEl) titleEl.textContent = options.title || "Sedang membuat video kamu";
        if (percentEl) percentEl.textContent = "0%";
        if (etaEl) etaEl.textContent = "";
        if (progressFill) progressFill.style.width = "0%";

        setMessage(options.message || "");
        renderSteps();

        overlay.style.setProperty("display", "flex", "important");

        visible = true;

        if (steps.length) setActiveStep(0);

        /* LOCK SCROLL */
        document.body.style.overflow = "hidden";

        setTimeout(function () {
            if (cancelBtn) cancelBtn.focus();
        }, 200);
    }

    /* =====================================================
       UPDATE
    ===================================================== */

    function update(state) {
        if (!visible || !overlay) return;
        state = state || {};

        if (typeof state.percent === "number") {
            const pct = clampPercent(state.percent);
            if (progressFill) progressFill.style.width = pct + "%";
            if (percentEl) percentEl.textContent = Math.round(pct) + "%";
            const wrap = overlay.querySelector("#genLoadingProgress");
            if (wrap) wrap.setAttribute("aria-valuenow", String(Math.round(pct)));
        }

        if (typeof state.step === "number") {
            const idx = Math.max(0, Math.min(steps.length - 1, state.step));
            setActiveStep(idx);
        } else if (typeof state.step === "string") {
            const idx = steps.findIndex(function (s) { return s.id === state.step; });
            if (idx >= 0) setActiveStep(idx);
        }

        if (typeof state.message === "string") setMessage(state.message);

        if (typeof state.eta === "string") {
            if (etaEl) etaEl.textContent = state.eta ? "\u2022 " + state.eta : "";
        }
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    function success(message) {
        if (!overlay || !card) return;

        card.style.borderColor = "rgba(46, 213, 115, 0.40)";
        card.style.boxShadow = "0 40px 100px rgba(0, 0, 0, 0.70), 0 0 26px rgba(46, 213, 115, 0.30)";

        if (kickerText) kickerText.textContent = "SELESAI";
        if (titleEl) titleEl.textContent = "Video berhasil dibuat!";
        if (progressFill) progressFill.style.width = "100%";
        if (percentEl) percentEl.textContent = "100%";
        if (etaEl) etaEl.textContent = "";

        setActiveStep(steps.length);
        setMessage(message || "");

        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = "Tutup";
        }
    }

    /* =====================================================
       ERROR
    ===================================================== */

    function error(message) {
        if (!overlay || !card) return;

        card.style.borderColor = "rgba(220, 38, 38, 0.50)";
        card.style.boxShadow = "0 40px 100px rgba(0, 0, 0, 0.70), 0 0 26px rgba(220, 38, 38, 0.30)";

        if (kickerText) kickerText.textContent = "GAGAL";
        if (titleEl) titleEl.textContent = "Generate gagal";

        setMessage(message || "Terjadi kesalahan. Silakan coba lagi.");

        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = "Tutup";
        }
    }

    /* =====================================================
       HIDE — FORCE UNLOCK BODY
    ===================================================== */

    function hide() {
        if (!overlay) return;

        overlay.style.setProperty("display", "none", "important");
        visible = false;

        /* WAJIB: unlock body, apapun yang terjadi */
        forceUnlockBody();
    }

    function isVisible() { return visible; }

    /* =====================================================
       EXPORT API
    ===================================================== */

    window.GENZLoading = {
        show: show,
        update: update,
        success: success,
        error: error,
        hide: hide,
        isVisible: isVisible,
        forceUnlock: forceUnlockBody
    };

    /* =====================================================
       AUTO-ATTACH KE FORM SUBMIT
    ===================================================== */

    let isGenerating = false;
    let activeCleanup = null;

    function isErrorText(text) {
        return /gagal|error|failed|ditolak|tolak/i.test(text);
    }

    function isSuccessText(text) {
        return /berhasil|success|selesai|sukses|completed/i.test(text);
    }

    function startLoading() {

        if (isGenerating) return;
        if (typeof window.GENZLoading.show !== "function") return;

        isGenerating = true;

        window.GENZLoading.show({
            title: "Sedang membuat video kamu",
            steps: [
                { id: "queued",     label: "Menghubungi server..." },
                { id: "processing", label: "Memproses prompt" },
                { id: "rendering",  label: "Merender video" },
                { id: "finalizing", label: "Menyelesaikan" }
            ],
            onCancel: function () {
                if (activeCleanup) activeCleanup();
                isGenerating = false;
                forceUnlockBody();
            }
        });

        /* Simulasi progress */
        let percent = 5;
        const progressTimer = setInterval(function () {
            percent += Math.random() * 3 + 0.5;
            if (percent > 92) percent = 92;
            window.GENZLoading.update({
                percent: percent,
                step: Math.min(3, Math.floor(percent / 25)),
                eta: "~" + Math.max(1, Math.round((100 - percent) / 8)) + " menit lagi"
            });
        }, 700);

        /* Elemen dipantau */
        const loadingEl = document.getElementById("loading");
        const statusEl = document.getElementById("status");
        const buttonEl = document.getElementById("generateButton");

        let finished = false;
        let lastStatusText = "";
        const startTime = Date.now();

        function finish(isError, message) {
            if (finished) return;
            finished = true;

            clearInterval(progressTimer);
            clearInterval(detectTimer);
            document.removeEventListener("gen:success", onSuccess);
            document.removeEventListener("gen:error", onError);

            if (isError) {
                window.GENZLoading.error(message || "Generate gagal.");
                setTimeout(function () {
                    window.GENZLoading.hide();
                    isGenerating = false;
                }, 2500);
            } else {
                window.GENZLoading.success(message || "Video berhasil dibuat! Cek di History.");
                setTimeout(function () {
                    window.GENZLoading.hide();
                    isGenerating = false;
                }, 1500);
            }
        }

        function onSuccess(e) { finish(false, e && e.detail ? e.detail.message : ""); }
        function onError(e)   { finish(true,  e && e.detail ? e.detail.message : ""); }

        document.addEventListener("gen:success", onSuccess);
        document.addEventListener("gen:error", onError);

        /* =================================================
           DETEKSI VIA POLLING — LEBIH AGRESIF
        ================================================= */

        const detectTimer = setInterval(function () {

            const elapsed = Date.now() - startTime;

            /* ---- 1. Deteksi status text berubah ---- */
            if (statusEl) {
                const txt = statusEl.textContent.trim();

                if (txt && txt !== lastStatusText) {
                    lastStatusText = txt;

                    /* Skip pesan loading umum */
                    const isNeutral =
                        /memproses|memuat|loading|menunggu|mengirim/i.test(txt);

                    if (!isNeutral) {
                        if (isErrorText(txt)) {
                            finish(true, txt);
                            return;
                        }
                        if (isSuccessText(txt)) {
                            finish(false, txt);
                            return;
                        }
                    }
                }
            }

            /* ---- 2. Deteksi #loading benar-benar hidden ---- */
            if (loadingEl && elapsed > 3000) {
                if (isElementReallyHidden(loadingEl)) {
                    /* Beri jeda kecil supaya status final ter-set */
                    setTimeout(function () {
                        const txt = statusEl ? statusEl.textContent.trim() : "";
                        finish(isErrorText(txt), txt || "Generate selesai.");
                    }, 500);
                    return;
                }
            }

            /* ---- 3. Deteksi tombol re-enabled ---- */
            if (buttonEl && elapsed > 5000) {
                if (!buttonEl.disabled) {
                    finish(false, "Generate selesai.");
                    return;
                }
            }

            /* ---- 4. EMERGENCY: stuck > 60 detik ---- */
            if (elapsed > EMERGENCY_TIMEOUT_MS) {
                finish(false, "Proses selesai. Cek History untuk hasil.");
                return;
            }

            /* ---- 5. HARD: stuck > 5 menit ---- */
            if (elapsed > HARD_TIMEOUT_MS) {
                finish(true, "Timeout. Cek History untuk status.");
                return;
            }

        }, 500);

        activeCleanup = function () {
            clearInterval(progressTimer);
            clearInterval(detectTimer);
            document.removeEventListener("gen:success", onSuccess);
            document.removeEventListener("gen:error", onError);
            forceUnlockBody();
        };
    }

    /* =====================================================
       AUTO-ATTACH LISTENER
    ===================================================== */

    function attachFormListener() {

        const form = document.getElementById("generateForm");
        const button = document.getElementById("generateButton");

        if (!form && !button) {
            setTimeout(attachFormListener, 500);
            return;
        }

        if (form && form.dataset.genzLoadingAttached !== "true") {
            form.addEventListener("submit", function () {
                setTimeout(startLoading, 10);
            }, true);
            form.dataset.genzLoadingAttached = "true";
        }

        if (button && button.dataset.genzLoadingAttached !== "true") {
            button.addEventListener("click", function () {
                if (button.disabled) return;
                if (form) return;
                setTimeout(startLoading, 10);
            }, true);
            button.dataset.genzLoadingAttached = "true";
        }
    }

    /* =====================================================
       BOOT
    ===================================================== */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            attachFormListener();
        });
    } else {
        attachFormListener();
    }

    /* =====================================================
       EMERGENCY: UNLOCK BODY SAAT PAGE UNLOAD
    ===================================================== */

    window.addEventListener("beforeunload", function () {
        forceUnlockBody();
    });

})(window);
