/* =========================================================
   GEN-Z.AI
   PREMIUM GENERATION LOADING CONTROLLER v4
   ---------------------------------------------------------
   File:
   generate/assets/js/generation-loading.js

   PERUBAHAN v4:
   - Semua style di-set INLINE via JS (bukan via CSS)
   - Bypass cache CSS + specificity konflik
   - Posisi: TOP-CENTER (di atas layar)
   - Ukuran: COMPACT (perkecil)
   - Subtitle DIHAPUS

   API:
   - GENZLoading.show(options)
   - GENZLoading.update({ percent, step, message, eta })
   - GENZLoading.success(message)
   - GENZLoading.error(message)
   - GENZLoading.hide()
   - GENZLoading.isVisible()
========================================================= */

(function (window) {

    "use strict";

    const DEFAULT_STEPS = [
        { id: "queued",     label: "Menghubungi server..." },
        { id: "processing", label: "Memproses prompt" },
        { id: "rendering",  label: "Merender video" },
        { id: "finalizing", label: "Menyelesaikan" }
    ];

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

    function applyStyle(el, styles) {
        if (!el) return;
        Object.keys(styles).forEach(function (key) {
            el.style.setProperty(
                key.replace(/[A-Z]/g, function (m) {
                    return "-" + m.toLowerCase();
                }),
                styles[key],
                "important"
            );
        });
    }

    /* =====================================================
       BUILD DOM (sekali saja)
    ===================================================== */

    function buildDom() {

        if (overlay) return;

        overlay = document.createElement("div");
        overlay.className = "gen-loading";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "genLoadingTitle");

        /* ---------- OVERLAY: FIXED, TOP-CENTER ---------- */
        applyStyle(overlay, {
            position: "fixed",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            display: "none",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "70px",
            paddingLeft: "14px",
            paddingRight: "14px",
            paddingBottom: "14px",
            boxSizing: "border-box",
            background: "rgba(2, 4, 8, 0.78)",
            backdropFilter: "blur(14px)",
            webkitBackdropFilter: "blur(14px)",
            zIndex: "99999",
            overflowY: "auto"
        });

        overlay.innerHTML = `
            <div class="gen-card" id="genLoadingCard"
                 style="
                    position: relative;
                    width: 100%;
                    max-width: 320px;
                    padding: 16px 16px 14px;
                    margin: 0;
                    border: 1px solid rgba(255, 255, 255, 0.10);
                    border-radius: 15px;
                    background: #0a0d13;
                    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.70);
                    box-sizing: border-box;
                    max-height: 68vh;
                    overflow-y: auto;
                 ">

                <div class="gen-kicker"
                     style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 3px 9px;
                        margin: 0 0 10px;
                        border: 1px solid rgba(255, 51, 85, 0.28);
                        border-radius: 999px;
                        background: rgba(255, 51, 85, 0.10);
                        color: #ff8fa3;
                        font-size: 8px;
                        font-weight: 800;
                        letter-spacing: 1.4px;
                        text-transform: uppercase;
                     ">
                    <span class="gen-kicker-dot"
                          style="
                            width: 5px;
                            height: 5px;
                            border-radius: 50%;
                            background: #ff3355;
                            box-shadow: 0 0 8px rgba(255, 51, 85, 0.85);
                            animation: genDotPulse 1.4s ease-in-out infinite;
                          "></span>
                    <span id="genLoadingKicker">GENERATING</span>
                </div>

                <h2 class="gen-title" id="genLoadingTitle"
                    style="
                        margin: 0 0 4px;
                        color: #f0f2f7;
                        font-size: 14px;
                        font-weight: 900;
                        line-height: 1.2;
                        letter-spacing: -0.2px;
                    ">
                    Sedang <em style="
                        font-style: normal;
                        color: #ff6a7a;
                    ">membuat video</em> kamu
                </h2>

                <div class="gen-progress" id="genLoadingProgress"
                     role="progressbar"
                     aria-valuemin="0"
                     aria-valuemax="100"
                     aria-valuenow="0"
                     style="
                        position: relative;
                        height: 3px;
                        margin: 12px 0 5px;
                        border-radius: 999px;
                        background: rgba(255, 255, 255, 0.06);
                        overflow: hidden;
                     ">
                    <div class="gen-progress-fill" id="genLoadingFill"
                         style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            height: 100%;
                            width: 0%;
                            border-radius: 999px;
                            background: linear-gradient(90deg, #ff3355, #ff6a7a, #ff3355);
                            box-shadow: 0 0 14px rgba(255, 51, 85, 0.55);
                            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                         "></div>
                </div>

                <div class="gen-meta"
                     style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin: 0 0 10px;
                        color: #5c6570;
                        font-size: 9px;
                        font-weight: 700;
                     ">
                    <span class="gen-percent" id="genLoadingPercent"
                          style="
                            color: #f0f2f7;
                            font-size: 11px;
                            font-weight: 800;
                          ">0%</span>
                    <span class="gen-eta" id="genLoadingEta"></span>
                </div>

                <div class="gen-steps" id="genLoadingSteps"
                     style="
                        display: flex;
                        flex-direction: column;
                        gap: 1px;
                        margin: 0 0 10px;
                     "></div>

                <div class="gen-message" id="genLoadingMessage"
                     hidden
                     style="
                        display: none;
                        margin: 6px 0 0;
                        padding: 6px 10px;
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 7px;
                        background: rgba(0, 0, 0, 0.25);
                        color: rgba(240, 242, 247, 0.72);
                        font-size: 10px;
                        line-height: 1.4;
                        text-align: center;
                     "></div>

                <button type="button" class="gen-cancel" id="genLoadingCancel"
                        style="
                            width: 100%;
                            padding: 7px 12px;
                            margin-top: 4px;
                            border: 1px solid rgba(255, 255, 255, 0.10);
                            border-radius: 9px;
                            background: transparent;
                            color: #9ba3b0;
                            font-family: inherit;
                            font-size: 10px;
                            font-weight: 700;
                            letter-spacing: 0.4px;
                            cursor: pointer;
                        ">
                    Batalkan Generate
                </button>

            </div>
        `;

        /* ---------- ANIMASI KICKER DOT ---------- */
        if (!document.getElementById("genDotPulseStyles")) {
            const styleEl = document.createElement("style");
            styleEl.id = "genDotPulseStyles";
            styleEl.textContent = `
                @keyframes genDotPulse {
                    0%, 100% { transform: scale(0.85); opacity: 0.85; }
                    50%      { transform: scale(1.2);  opacity: 1; }
                }
                @keyframes genSpinnerRotate {
                    to { transform: rotate(360deg); }
                }
                @keyframes genShimmerMove {
                    0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
                    15%  { opacity: 1; }
                    55%, 100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
                }
            `;
            document.head.appendChild(styleEl);
        }

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
            if (typeof cancelHandler === "function") {
                cancelHandler();
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
                     style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 5px 8px;
                        border-radius: 6px;
                        color: #5c6570;
                        font-size: 10.5px;
                        font-weight: 600;
                     ">
                    <span class="gen-step-icon" aria-hidden="true"
                          style="
                            flex: 0 0 auto;
                            width: 13px;
                            height: 13px;
                            border: 1.5px solid rgba(255, 255, 255, 0.14);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 7px;
                            font-weight: 900;
                            color: transparent;
                          "></span>
                    <span class="gen-step-label"
                          style="
                            flex: 1 1 auto;
                            min-width: 0;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                          ">${step.label}</span>
                </div>
            `;
        }).join("");
    }

    function setActiveStep(index) {
        if (!stepsEl) return;
        const items = stepsEl.querySelectorAll(".gen-step");

        items.forEach(function (el, i) {
            const icon = el.querySelector(".gen-step-icon");

            /* Reset */
            el.style.background = "transparent";
            el.style.border = "1px solid transparent";
            el.style.color = "#5c6570";

            if (icon) {
                icon.style.background = "transparent";
                icon.style.borderColor = "rgba(255, 255, 255, 0.14)";
                icon.style.color = "transparent";
                icon.style.boxShadow = "none";
                icon.style.animation = "none";
                icon.textContent = "";
            }

            if (i < index) {
                /* DONE */
                el.style.color = "#66ffa6";
                if (icon) {
                    icon.style.borderColor = "#2ed573";
                    icon.style.background = "#2ed573";
                    icon.style.color = "#041008";
                    icon.textContent = "✓";
                }
            } else if (i === index) {
                /* ACTIVE */
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

        /* Reset card style */
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

        /* Show overlay */
        if (overlay) {
            overlay.style.display = "flex";
            overlay.style.opacity = "1";
        }

        visible = true;

        if (steps.length) {
            setActiveStep(0);
        }

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

        if (typeof state.message === "string") {
            setMessage(state.message);
        }

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
            cancelBtn.disabled = true;
            cancelBtn.textContent = "Membuka hasil...";
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
        cancelHandler = null;
    }

    /* =====================================================
       HIDE
    ===================================================== */

    function hide() {
        if (!overlay || !visible) return;
        overlay.style.display = "none";
        visible = false;
        document.body.style.overflow = "";
    }

    function isVisible() {
        return visible;
    }

    /* =====================================================
       EXPORT
    ===================================================== */

    window.GENZLoading = {
        show: show,
        update: update,
        success: success,
        error: error,
        hide: hide,
        isVisible: isVisible
    };

})(window);
