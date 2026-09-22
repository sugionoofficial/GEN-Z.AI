/* =========================================================
   GEN-Z.AI
   HISTORY CONFIG MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-config.js

   Tanggung jawab:
   - Konfigurasi History
   - Endpoint
   - Interval polling
   - Namespace global

   Tidak bertanggung jawab:
   - Query Supabase
   - Render UI
   - Event
   - Authentication
========================================================= */

(function (window) {

    "use strict";


    /* =====================================================
       ROOT NAMESPACE
    ===================================================== */

    const GENZHistory =
        window.GENZHistory =
            window.GENZHistory || {};


    /* =====================================================
       CONFIG
    ===================================================== */

    GENZHistory.config = {

        /*
         * Interval auto refresh History.
         *
         * 5000 ms = 5 detik.
         */

        autoRefreshInterval: 5000,


        /*
         * Endpoint untuk sinkronisasi status
         * generation ke provider/backend.
         */

        statusEndpoint:
            "/api/generate-status",


        /*
         * Nama tabel utama History.
         */

        historyTable:
            "generation_history",


        /*
         * Status yang dianggap masih aktif.
         */

        activeStatuses: [
            "processing",
            "pending"
        ]


    };


    /* =====================================================
       STATUS NORMALIZER
    ===================================================== */

    GENZHistory.normalizeStatus =
        function (status) {

            const value =
                String(
                    status || "pending"
                )
                    .trim()
                    .toLowerCase();


            /*
             * Legacy status.
             */

            if (
                value === "completed"
            ) {

                return "success";

            }


            /*
             * queued dianggap pending
             * agar polling tetap berjalan.
             */

            if (
                value === "queued"
            ) {

                return "pending";

            }


            return value;

        };


    /* =====================================================
       ACTIVE STATUS CHECK
    ===================================================== */

    GENZHistory.isActiveStatus =
        function (status) {

            const normalized =
                GENZHistory.normalizeStatus(
                    status
                );


            return (
                normalized === "processing" ||
                normalized === "pending"
            );

        };


})(window);
