/* =========================================================
   GEN-Z.AI
   HISTORY RUNTIME COUNTER
   ---------------------------------------------------------
   File:
   history/assets/js/history-runtime.js

   Tanggung jawab:
   - Menampilkan live runtime counter untuk setiap row
     dengan status processing / pending
   - Update setiap 1 detik
   - Hitung dari data-created-at (ISO string dari Supabase)
   - Auto-stop kalau tidak ada task aktif

   Tidak bertanggung jawab:
   - Render history
   - Query Supabase
   - Modal
   - Authentication
========================================================= */

(function () {

    "use strict";


    window.GENZHistory =
        window.GENZHistory || {};

    const App =
        window.GENZHistory;


    /* =====================================================
       CONSTANTS
    ===================================================== */

    const TICK_MS = 1000;
    const SELECTOR = "[data-runtime-created-at]";


    /* =====================================================
       STATE
    ===================================================== */

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

        const totalSec =
            Math.floor(ms / 1000);

        const h =
            Math.floor(totalSec / 3600);

        const m =
            Math.floor((totalSec % 3600) / 60);

        const s =
            totalSec % 60;

        if (h > 0) {
            return h + ":" + pad2(m) + ":" + pad2(s);
        }

        return pad2(m) + ":" + pad2(s);
    }


    /* =====================================================
       UPDATE ALL COUNTERS
    ===================================================== */

    function updateAllCounters() {

        const counters =
            document.querySelectorAll(SELECTOR);

        if (!counters.length) {

            /* Tidak ada task aktif — stop interval supaya hemat CPU */
            stop();

            return;
        }

        const now = Date.now();

        counters.forEach(function (el) {

            const createdAt =
                el.getAttribute("data-runtime-created-at");

            if (!createdAt) return;

            const start =
                new Date(createdAt).getTime();

            if (!Number.isFinite(start)) {
                el.textContent = "--:--";
                return;
            }

            const elapsed = now - start;

            el.textContent = formatRuntime(elapsed);

        });

    }


    /* =====================================================
       START / STOP
    ===================================================== */

    function start() {

        /* Update langsung supaya tidak ada delay 1 detik pertama */
        updateAllCounters();

        /* Kalau tidak ada counter, tidak perlu interval */
        if (!document.querySelector(SELECTOR)) {
            return;
        }

        if (intervalId) return;

        intervalId =
            setInterval(updateAllCounters, TICK_MS);

    }


    function stop() {

        if (intervalId) {

            clearInterval(intervalId);

            intervalId = null;

        }

    }


    /* =====================================================
       MUTATION OBSERVER
       ---------------------------------------------------------
       Kalau DOM berubah (render ulang setelah polling),
       restart interval supaya counter baru langsung
       di-hitung.
    ===================================================== */

    function watchMutations() {

        const body =
            document.getElementById("historyBody");

        if (!body) return;

        const observer =
            new MutationObserver(function () {

                start();

            });

        observer.observe(body, {

            childList: true,

            subtree: true

        });

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    App.startRuntimeCounter =
        start;

    App.stopRuntimeCounter =
        stop;

    App.updateRuntimeCounters =
        updateAllCounters;


    /* =====================================================
       AUTO START
    ===================================================== */

    function boot() {

        start();

        watchMutations();

    }


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            { once: true }
        );

    } else {

        boot();

    }

})();
