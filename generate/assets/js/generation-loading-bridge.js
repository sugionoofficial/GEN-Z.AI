/* =========================================================
   GEN-Z.AI
   PREMIUM LOADING BRIDGE v3
   ---------------------------------------------------------
   File:
   generate/assets/js/generation-loading-bridge.js

   Hook ke:
   1. Form submit event (capture: true, paling awal)
   2. Button click event (fallback)

   Deteksi selesai:
   1. Custom event "gen:success" / "gen:error"
   2. #loading.hidden transition (visible -> hidden)
   3. #status text change
   4. #generateButton enabled transition
   5. Timeout 3 menit
========================================================= */

(function () {

    "use strict";

    let isGenerating = false;
    let activeCleanup = null;

    function isSuccessText(text) {
        return /berhasil|success|selesai|sukses|completed/i.test(text);
    }

    function isErrorText(text) {
        return /gagal|error|failed|ditolak|tolak/i.test(text);
    }

    function startLoading() {

        if (isGenerating) return;

        if (!window.GENZLoading) {
            console.warn("[LoadingBridge] GENZLoading tidak tersedia.");
            return;
        }

        isGenerating = true;

        window.GENZLoading.show({
            title: "Sedang membuat video kamu",
            subtitle: "Jangan tutup halaman ini. Proses biasanya selesai dalam 1\u20133 menit.",
            steps: [
                { id: "queued",     label: "Menghubungi server..." },
                { id: "processing", label: "Memproses prompt" },
                { id: "rendering",  label: "Merender video" },
                { id: "finalizing", label: "Menyelesaikan" }
            ],
            onCancel: function () {
                if (activeCleanup) activeCleanup();
                isGenerating = false;
            }
        });

        /* ------ SIMULASI PROGRESS ------ */
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

        /* ------ ELEMEN YANG DIPANTAU ------ */
        const loadingEl = document.getElementById("loading");
        const statusEl = document.getElementById("status");
        const buttonEl = document.getElementById("generateButton");

        let wasLoadingVisible = false;
        let finished = false;

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
                }, 3000);
            } else {
                window.GENZLoading.success("Video berhasil dibuat! Cek di History.");
                setTimeout(function () {
                    window.GENZLoading.hide();
                    isGenerating = false;
                }, 1800);
            }
        }

        function onSuccess(e) { finish(false, e && e.detail ? e.detail.message : ""); }
        function onError(e)   { finish(true,  e && e.detail ? e.detail.message : ""); }

        document.addEventListener("gen:success", onSuccess);
        document.addEventListener("gen:error", onError);

        /* ------ DETEKSI VIA POLLING ------ */
        const detectTimer = setInterval(function () {

            /* 1. Loading lama visible -> hidden */
            if (loadingEl) {
                const isVisible =
                    !loadingEl.hidden &&
                    loadingEl.style.display !== "none";

                if (isVisible) wasLoadingVisible = true;

                if (wasLoadingVisible && !isVisible) {
                    setTimeout(function () {
                        const txt = statusEl ? statusEl.textContent.trim() : "";
                        const isErr = isErrorText(txt);
                        finish(isErr, txt);
                    }, 300);
                    return;
                }
            }

            /* 2. Status text berubah */
            if (statusEl && wasLoadingVisible) {
                const txt = statusEl.textContent.trim();
                if (txt && isErrorText(txt)) {
                    finish(true, txt);
                    return;
                }
                if (txt && isSuccessText(txt)) {
                    finish(false, txt);
                    return;
                }
            }

            /* 3. Button re-enabled */
            if (buttonEl && wasLoadingVisible && !buttonEl.disabled) {
                finish(false, "Generate selesai.");
            }

        }, 500);

        activeCleanup = function () {
            clearInterval(progressTimer);
            clearInterval(detectTimer);
            document.removeEventListener("gen:success", onSuccess);
            document.removeEventListener("gen:error", onError);
        };

        /* ------ SAFETY TIMEOUT 3 MENIT ------ */
        setTimeout(function () {
            if (!finished && isGenerating) {
                if (activeCleanup) activeCleanup();
                window.GENZLoading.error("Proses memakan waktu lebih lama. Cek History untuk status.");
                setTimeout(function () {
                    window.GENZLoading.hide();
                    isGenerating = false;
                }, 3000);
            }
        }, 3 * 60 * 1000);
    }

    function boot() {

        const form = document.getElementById("generateForm");
        const button = document.getElementById("generateButton");

        if (!form && !button) {
            console.warn("[LoadingBridge] #generateForm / #generateButton tidak ditemukan.");
            return;
        }

        /* Hook 1: form submit (capture = true supaya paling awal) */
        if (form) {
            form.addEventListener("submit", function () {
                setTimeout(startLoading, 10);
            }, true);
        }

        /* Hook 2: button click (fallback) */
        if (button) {
            button.addEventListener("click", function () {
                if (button.disabled) return;
                /* Kalau form ada, biarkan submit event yang handle */
                if (form) return;
                setTimeout(startLoading, 10);
            }, true);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

})();
