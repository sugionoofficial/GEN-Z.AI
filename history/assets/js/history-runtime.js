/* =========================================================
   GEN-Z.AI
   HISTORY RUNTIME COUNTER (LIGHTWEIGHT)
   ---------------------------------------------------------
   File:
   history/assets/js/history-runtime.js

   Versi ringan:
   - Tanpa MutationObserver
   - Tanpa CSS animation
   - Update textContent langsung (tidak re-render)
   - Skip saat document.hidden
   - Auto-stop kalau tidak ada row processing
========================================================= */

(function () {

    "use strict";


    window.GENZHistory =
        window.GENZHistory || {};

    const App =
        window.GENZHistory;


    const TICK_MS = 1000;
    const SELECTOR = "[data-runtime-created-at]";


    let intervalId = null;


    /* =====================================================
       HELPERS
    ===================================================== */

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }


    function formatRuntime(ms) {

        if (!Number.isFinite(ms) || ms < 0) {
            return "00:00";
        }

        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;

        if (h > 0) {
            return h + ":" + pad2(m) + ":" + pad2(s);
        }

        return pad2(m) + ":" + pad2(s);
    }


    /* =====================================================
       UPDATE COUNTERS
    ===================================================== */

    function updateCounters() {

        /* Skip kalau tab tidak aktif */
        if (document.hidden) return;

        const counters =
            document.querySelectorAll(SELECTOR);

        /* Kalau tidak ada counter, stop interval */
        if (!counters.length) {
            stop();
            return;
        }

        const now = Date.now();

        counters.forEach(function (el) {

            const iso =
                el.getAttribute("data-runtime-created-at");

            if (!iso) return;

            const start = new Date(iso).getTime();

            if (!Number.isFinite(start)) {
                el.textContent = "--:--";
                return;
            }

            el.textContent = formatRuntime(now - start);

        });

    }


    /* =====================================================
       START / STOP
    ===================================================== */

    function start() {

        updateCounters();

        /* Kalau tidak ada counter, tidak perlu interval */
        if (!document.querySelector(SELECTOR)) {
            return;
        }

        if (intervalId) return;

        intervalId = setInterval(updateCounters, TICK_MS);

    }


    function stop() {

        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    App.startRuntimeCounter = start;
    App.stopRuntimeCounter = stop;
    App.updateRuntimeCounters = updateCounters;


    /* =====================================================
       BOOT — DIPANGGIL MANUAL DARI RENDER
       -----------------------------------------------------
       Tidak ada auto-boot. Panggil App.startRuntimeCounter()
       setelah renderHistory selesai.
    ===================================================== */

    /* Tab visibility listener — resume saat tab aktif kembali */
    document.addEventListener(
        "visibilitychange",
        function () {
            if (!document.hidden) {
                start();
            }
        }
    );


    /* Boot awal — cek kalau sudah ada row */
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            { once: true }
        );
    } else {
        start();
    }

})();
