/* =========================================================
   GEN-Z.AI — GENERATE PROGRESS CARD
   ---------------------------------------------------------
   Card inline di bawah tombol Generate untuk menampilkan
   progress real-time: thumbnail input, timer, progress bar,
   status, dan model.

   Tidak menggunakan overlay fullscreen.
   Tidak menyentuh navigasi, auth, atau provider.
========================================================= */

"use strict";

(function (window) {

    var DEFAULT_TIMER = "00:00";

    var el, thumb, title, timerEl, barFill, modelEl, statusEl, closeBtn;
    var state = {
        startedAt: 0,
        timerId: null,
        progressTimer: null,
        currentProgress: 0,
        targetProgress: 0,
        hideTimer: null,
        status: "idle"
    };

    function pad(n) { return n < 10 ? "0" + n : String(n); }

    function formatTimer(ms) {
        var s = Math.floor(ms / 1000);
        var m = Math.floor(s / 60);
        s = s % 60;
        return pad(m) + ":" + pad(s);
    }

    function startTimer() {
        stopTimer();
        state.startedAt = Date.now();
        if (timerEl) timerEl.textContent = DEFAULT_TIMER;
        state.timerId = setInterval(function () {
            if (timerEl) {
                timerEl.textContent = formatTimer(Date.now() - state.startedAt);
            }
        }, 1000);
    }

    function stopTimer() {
        if (state.timerId) {
            clearInterval(state.timerId);
            state.timerId = null;
        }
    }

    function animateProgress() {
        if (state.progressTimer) return;
        state.progressTimer = setInterval(function () {
            var diff = state.targetProgress - state.currentProgress;
            if (Math.abs(diff) < 0.5) {
                state.currentProgress = state.targetProgress;
                if (barFill) barFill.style.width = state.currentProgress + "%";
                clearInterval(state.progressTimer);
                state.progressTimer = null;
                return;
            }
            state.currentProgress += diff * 0.08;
            if (barFill) barFill.style.width = state.currentProgress + "%";
        }, 40);
    }

    function setProgress(p) {
        var v = Math.max(0, Math.min(100, Number(p) || 0));
        state.targetProgress = v;
        animateProgress();
    }

    function setState(s) {
        state.status = s;
        if (el) el.setAttribute("data-state", s);
    }

    function setStatus(text) {
        if (statusEl) statusEl.textContent = String(text || "").toUpperCase();
    }

    function clearHide() {
        if (state.hideTimer) {
            clearTimeout(state.hideTimer);
            state.hideTimer = null;
        }
    }

    function buildDom() {
        if (el) return;

        el = document.createElement("div");
        el.className = "genz-progress-card";
        el.id = "genzProgressCard";
        el.hidden = true;
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");

        el.innerHTML = ''
            + '<div class="gpc-thumb">'
            +   '<img id="gpcThumb" alt="" loading="lazy" />'
            +   '<div class="gpc-thumb-overlay"></div>'
            +   '<div class="gpc-thumb-spinner"></div>'
            + '</div>'
            + '<div class="gpc-body">'
            +   '<div class="gpc-head">'
            +     '<span class="gpc-kicker">'
            +       '<span class="gpc-pulse"></span>'
            +       'LIVE GENERATION'
            +     '</span>'
            +     '<span class="gpc-timer" id="gpcTimer">00:00</span>'
            +   '</div>'
            +   '<div class="gpc-title" id="gpcTitle">Mengirim permintaan...</div>'
            +   '<div class="gpc-bar"><div class="gpc-bar-fill" id="gpcBarFill"></div></div>'
            +   '<div class="gpc-meta">'
            +     '<span class="gpc-model" id="gpcModel">—</span>'
            +     '<span class="gpc-status" id="gpcStatus">MENUNGGU</span>'
            +   '</div>'
            + '</div>'
            + '<button class="gpc-close" id="gpcClose" type="button" aria-label="Tutup progress">×</button>';

        /* Sisipkan setelah #generateCard */
        var anchor = document.getElementById("generateCard");
        var parent = anchor ? anchor.parentElement : document.querySelector(".content");
        if (anchor && anchor.nextSibling) {
            parent.insertBefore(el, anchor.nextSibling);
        } else if (parent) {
            parent.appendChild(el);
        } else {
            document.body.appendChild(el);
        }

        thumb    = el.querySelector("#gpcThumb");
        title    = el.querySelector("#gpcTitle");
        timerEl  = el.querySelector("#gpcTimer");
        barFill  = el.querySelector("#gpcBarFill");
        modelEl  = el.querySelector("#gpcModel");
        statusEl = el.querySelector("#gpcStatus");
        closeBtn = el.querySelector("#gpcClose");

        if (closeBtn) {
            closeBtn.addEventListener("click", function () { API.hide(); });
        }
    }

    var API = {

        show: function (opts) {
            opts = opts || {};
            buildDom();
            clearHide();

            if (opts.imageUrl) {
                thumb.src = opts.imageUrl;
                thumb.style.display = "";
            } else {
                thumb.removeAttribute("src");
                thumb.style.display = "none";
            }

            if (opts.model) modelEl.textContent = opts.model;
            title.textContent = opts.title || "Mengirim permintaan...";
            setStatus("MENUNGGU");
            setState("queued");

            state.currentProgress = 5;
            state.targetProgress = 5;
            if (barFill) barFill.style.width = "5%";

            el.hidden = false;
            el.classList.remove("is-exit");
            el.classList.add("is-enter");
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    el.classList.remove("is-enter");
                });
            });

            startTimer();
            setProgress(15);
        },

        update: function (opts) {
            opts = opts || {};
            if (!el || el.hidden) return;

            var s = String(opts.status || "").toUpperCase();
            if (opts.message) title.textContent = opts.message;

            if (s === "QUEUED" || s === "PENDING") {
                setState("queued");
                setStatus("DALAM ANTREAN");
                setProgress(typeof opts.progress === "number" ? opts.progress : Math.max(state.targetProgress, 30));
            } else if (s === "PROCESSING" || s === "RUNNING" || s === "IN_PROGRESS" || s === "GENERATING") {
                setState("processing");
                setStatus("DIPROSES");
                setProgress(typeof opts.progress === "number" ? opts.progress : Math.max(state.targetProgress, 70));
            }
        },

        success: function (opts) {
            opts = opts || {};
            if (!el) return;
            stopTimer();
            clearHide();

            setState("success");
            setStatus("SELESAI");
            title.textContent = opts.message || "Video berhasil dibuat!";
            setProgress(100);

            state.hideTimer = setTimeout(function () { API.hide(); }, 6000);
        },

        fail: function (opts) {
            opts = opts || {};
            if (!el) return;
            stopTimer();
            clearHide();

            setState("failed");
            setStatus("GAGAL");
            title.textContent = opts.message || "Generate gagal. Coba lagi.";

            state.hideTimer = setTimeout(function () { API.hide(); }, 12000);
        },

        hide: function () {
            if (!el) return;
            stopTimer();
            clearHide();
            if (state.progressTimer) {
                clearInterval(state.progressTimer);
                state.progressTimer = null;
            }
            el.classList.add("is-exit");
            setTimeout(function () {
                el.hidden = true;
                el.classList.remove("is-exit");
                setState("idle");
            }, 350);
        },

        setThumbnail: function (url) {
            if (!url || !thumb) return;
            thumb.src = url;
            thumb.style.display = "";
        },

        setModel: function (name) {
            if (!name || !modelEl) return;
            modelEl.textContent = name;
        },

        isVisible: function () {
            return el && !el.hidden;
        }
    };

    window.GenzProgress = API;

})(window);
