/* =========================================================
   GEN-Z.AI
   PREMIUM GENERATION LOADING CONTROLLER
   ---------------------------------------------------------
   File:
   generate/assets/js/generation-loading.js

   API:
   - GENZLoading.show(options)
   - GENZLoading.update({ percent, step, message, eta })
   - GENZLoading.success(message)
   - GENZLoading.error(message)
   - GENZLoading.hide()
   - GENZLoading.isVisible()

   Events:
   - gen-loading:cancel
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
    let subtitleEl = null;
    let progressFill = null;
    let percentEl = null;
    let etaEl = null;
    let stepsEl = null;
    let cancelBtn = null;

    let currentStepIndex = -1;
    let currentPercent = 0;
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

    function safeText(el, text) {
        if (el && typeof text === "string") {
            el.textContent = text;
        }
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
        overlay.setAttribute("aria-live", "polite");

        overlay.innerHTML = `
            <div class="gen-card" id="genLoadingCard">

                <div class="gen-kicker">
                    <span class="gen-kicker-dot" aria-hidden="true"></span>
                    <span id="genLoadingKicker">GENERATING</span>
                </div>

                <h2 class="gen-title" id="genLoadingTitle">
                    Sedang <em>membuat video</em> kamu
                </h2>

                <p class="gen-subtitle" id="genLoadingSubtitle">
                    Jangan tutup halaman ini. Proses biasanya selesai dalam 1&ndash;3 menit.
                </p>

                <div class="gen-progress" role="progressbar"
                     aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
                     id="genLoadingProgress">
                    <div class="gen-progress-fill" id="genLoadingFill"></div>
                </div>

                <div class="gen-meta">
                    <span class="gen-percent" id="genLoadingPercent">0%</span>
                    <span class="gen-eta" id="genLoadingEta"></span>
                </div>

                <div class="gen-steps" id="genLoadingSteps"></div>

                <button
                    type="button"
                    class="gen-cancel"
                    id="genLoadingCancel"
                >
                    Batalkan Generate
                </button>

            </div>
        `;

        document.body.appendChild(overlay);

        card         = overlay.querySelector("#genLoadingCard");
        kickerText   = overlay.querySelector("#genLoadingKicker");
        titleEl      = overlay.querySelector("#genLoadingTitle");
        subtitleEl   = overlay.querySelector("#genLoadingSubtitle");
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

    function renderSteps() {
        if (!stepsEl) return;
        stepsEl.innerHTML = steps.map(function (step, i) {
            return `
                <div class="gen-step" data-step-index="${i}">
                    <span class="gen-step-icon" aria-hidden="true"></span>
                    <span class="gen-step-label">${step.label}</span>
                </div>
            `;
        }).join("");
    }

    function setActiveStep(index) {
        if (!stepsEl) return;
        const items = stepsEl.querySelectorAll(".gen-step");
        items.forEach(function (el, i) {
            el.classList.remove("active", "done");
            if (i < index) {
                el.classList.add("done");
            } else if (i === index) {
                el.classList.add("active");
            }
        });
    }

    /* =====================================================
       SHOW
    ===================================================== */

    function show(options) {

        options = options || {};
        buildDom();

        currentStepIndex = -1;
        currentPercent = 0;
        steps = Array.isArray(options.steps) && options.steps.length
            ? options.steps
            : DEFAULT_STEPS.slice();

        cancelHandler = typeof options.onCancel === "function"
            ? options.onCancel
            : null;

        card.classList.remove("success", "error");
        card.classList.add("loading");

        safeText(kickerText, "GENERATING");
        safeText(
            titleEl,
            options.title || "Sedang membuat video kamu"
        );
        safeText(
            subtitleEl,
            options.subtitle ||
            "Jangan tutup halaman ini. Proses biasanya selesai dalam 1\u20133 menit."
        );

        progressFill.style.width = "0%";
        safeText(percentEl, "0%");
        safeText(etaEl, "");

        renderSteps();

        overlay.classList.remove("closing");
        overlay.classList.add("show");
        overlay.style.display = "flex";

        void overlay.offsetHeight;

        visible = true;

        if (steps.length) {
            setActiveStep(0);
            currentStepIndex = 0;
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
            currentPercent = clampPercent(state.percent);
            progressFill.style.width = currentPercent + "%";
            safeText(percentEl, Math.round(currentPercent) + "%");

            const progressWrap = overlay.querySelector("#genLoadingProgress");
            if (progressWrap) {
                progressWrap.setAttribute(
                    "aria-valuenow",
                    String(Math.round(currentPercent))
                );
            }
        }

        if (typeof state.step === "number") {
            const idx = Math.max(0, Math.min(steps.length - 1, state.step));
            setActiveStep(idx);
            currentStepIndex = idx;
        } else if (typeof state.step === "string") {
            const idx = steps.findIndex(function (s) { return s.id === state.step; });
            if (idx >= 0) {
                setActiveStep(idx);
                currentStepIndex = idx;
            }
        }

        if (typeof state.message === "string") {
            safeText(subtitleEl, state.message);
        }

        if (typeof state.eta === "string") {
            etaEl.textContent = state.eta ? "\u2022 " + state.eta : "";
        }
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    function success(message) {

        if (!overlay) return;

        card.classList.remove("loading", "error");
        card.classList.add("success");

        safeText(kickerText, "SELESAI");
        safeText(titleEl, "Video berhasil dibuat!");
        safeText(subtitleEl, message || "Mengarahkan ke hasil...");

        progressFill.style.width = "100%";
        safeText(percentEl, "100%");
        safeText(etaEl, "");

        setActiveStep(steps.length);

        cancelBtn.disabled = true;
        cancelBtn.textContent = "Membuka hasil...";
    }

    /* =====================================================
       ERROR
    ===================================================== */

    function error(message) {

        if (!overlay) return;

        card.classList.remove("loading", "success");
        card.classList.add("error");

        safeText(kickerText, "GAGAL");
        safeText(titleEl, "Generate gagal");
        safeText(subtitleEl, message || "Terjadi kesalahan. Silakan coba lagi.");

        cancelBtn.disabled = false;
        cancelBtn.textContent = "Tutup";
        cancelHandler = null;
    }

    /* =====================================================
       HIDE
    ===================================================== */

    function hide() {

        if (!overlay || !visible) return;

        overlay.classList.add("closing");

        setTimeout(function () {
            overlay.classList.remove("show", "closing");
            overlay.style.display = "none";
            visible = false;
            document.body.style.overflow = "";

            if (card) {
                card.classList.remove("success", "error", "loading");
            }
        }, 320);
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
