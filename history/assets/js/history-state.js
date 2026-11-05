/* =========================================================
   GEN-Z.AI
   HISTORY STATE MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-state.js

   Tanggung jawab:
   - Global state History
   - Referensi DOM
   - Timer
   - Status loading
   - Filter

   Tidak bertanggung jawab:
   - Query database
   - Render data
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
       STATE
    ===================================================== */

    GENZHistory.state = {

        /*
         * Supabase client.
         */

        supabaseClient:
            null,


        /*
         * User login.
         */

        currentUser:
            null,


        /*
         * Profile user.
         */

        currentProfile:
            null,


        /*
         * Data History.
         */

        historyData:
            [],

        /*
         * Counts cover the full selected history scope, not the
         * 200-row table preview.
         */

        statusCounts:
            null,


        /*
         * Filter aktif.
         */

        currentFilter:
            "all",


        /*
         * Cakupan riwayat: "own" atau "global".
         * Global hanya efektif untuk admin/owner.
         */

        historyScope:
            "own",


        /*
         * Pencarian Task ID aktif (server-side).
         */

        taskIdSearch:
            "",


        /*
         * Urutan request supaya hasil query lama tidak menimpa
         * hasil scope/pencarian terbaru.
         */

        historyLoadSequence:
            0,


        /*
         * True bila hasil pencarian mencapai batas halaman data.
         */

        historySearchTruncated:
            false,


        /*
         * Timer auto refresh.
         */

        autoRefreshTimer:
            null,


        /*
         * Mencegah loadHistory
         * bertumpuk.
         */

        historyLoadInProgress:
            false,


        /*
         * Mencegah status sync
         * berjalan bersamaan.
         */

        historyStatusSyncInProgress:
            false

    };


    /* =====================================================
       DOM REFERENCES
    ===================================================== */

    GENZHistory.elements = {};


    /*
     * Resolve semua element setelah DOM tersedia.
     */

    GENZHistory.resolveElements =
        function () {

            const elements =
                GENZHistory.elements;


            elements.menuButton =
                document.getElementById(
                    "menuButton"
                );


            elements.sidebar =
                document.getElementById(
                    "sidebar"
                );


            elements.overlay =
                document.getElementById(
                    "overlay"
                );


            elements.navigation =
                document.getElementById(
                    "navigation"
                );


            elements.logoutButton =
                document.getElementById(
                    "logoutButton"
                );


            elements.refreshButton =
                document.getElementById(
                    "refreshButton"
                );


            elements.loadingState =
                document.getElementById(
                    "loadingState"
                );


            elements.tableWrap =
                document.getElementById(
                    "tableWrap"
                );


            elements.historyBody =
                document.getElementById(
                    "historyBody"
                );


            elements.emptyState =
                document.getElementById(
                    "emptyState"
                );


            elements.historyCount =
                document.getElementById(
                    "historyCount"
                );

            elements.statTotal =
                document.getElementById(
                    "statTotal"
                );


            elements.statSuccess =
                document.getElementById(
                    "statSuccess"
                );


            elements.statProcessing =
                document.getElementById(
                    "statProcessing"
                );


            elements.statFailed =
                document.getElementById(
                    "statFailed"
                );


            elements.historySubtitle =
                document.getElementById(
                    "historySubtitle"
                );


            elements.message =
                document.getElementById(
                    "message"
                );


            elements.detailModal =
                document.getElementById(
                    "detailModal"
                );


            elements.modalBody =
                document.getElementById(
                    "modalBody"
                );


            elements.closeModal =
                document.getElementById(
                    "closeModal"
                );


            elements.creditBalance =
                document.getElementById(
                    "creditBalance"
                );


            elements.sidebarEmail =
                document.getElementById(
                    "sidebarEmail"
                );


            elements.sidebarRole =
                document.getElementById(
                    "sidebarRole"
                );


            elements.userColumnHeader =
                document.getElementById(
                    "userColumnHeader"
                );


            elements.historyScopeControl =
                document.getElementById(
                    "historyScopeControl"
                );


            elements.taskIdSearchForm =
                document.getElementById(
                    "taskIdSearchForm"
                );


            elements.taskIdSearchInput =
                document.getElementById(
                    "taskIdSearchInput"
                );


            elements.taskIdSearchClear =
                document.getElementById(
                    "taskIdSearchClear"
                );


            elements.historySearchMeta =
                document.getElementById(
                    "historySearchMeta"
                );


            elements.emptyStateTitle =
                document.getElementById(
                    "emptyStateTitle"
                );


            elements.emptyStateDescription =
                document.getElementById(
                    "emptyStateDescription"
                );


            elements.emptyStateGenerateButton =
                document.getElementById(
                    "emptyStateGenerateButton"
                );


            return elements;

        };


})(window);
