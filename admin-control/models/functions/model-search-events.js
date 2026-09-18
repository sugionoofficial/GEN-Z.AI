/* =========================================================
   GEN-Z.AI
   MODEL SEARCH EVENTS

   File:
   admin-control/models/functions/model-search-events.js

   Tanggung jawab:
   - Bind input Model ID
   - Focus
   - Keyboard
   - Click hasil
   - Provider changed
   - Click outside

   FIX:
   - Binding lebih tahan terhadap lifecycle/re-initialize
   - Tidak gagal permanen jika DOM belum siap
   - Tidak membuat duplicate listener
   - Mendukung rebind setelah unbind
   - Search tetap menggunakan GENZModelsSearch
========================================================= */

(function () {
    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let bound = false;
    let handlers = null;


    /* =====================================================
       GET INPUT
    ===================================================== */

    function getInput() {

        return (
            document.getElementById(
                "modelCodeSearch"
            ) ||
            document.getElementById(
                "modelSearch"
            ) ||
            document.getElementById(
                "modelIdSearch"
            )
        );
    }


    /* =====================================================
       GET RESULTS BOX
    ===================================================== */

    function getResultsBox() {

        return (
            document.getElementById(
                "modelSearchResults"
            ) ||
            document.getElementById(
                "modelResults"
            ) ||
            document.getElementById(
                "modelDropdown"
            )
        );
    }


    /* =====================================================
       CHECK DEPENDENCIES
    ===================================================== */

    function dependenciesReady() {

        return !!(
            window.GENZModelSearchDropdown &&
            window.GENZModelSearchRender &&
            window.GENZModelSearchSelect &&
            window.GENZModelsSearch
        );
    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind(api) {

        /*
         * Sudah ter-bind.
         */
        if (bound) {
            return true;
        }


        /*
         * DOM harus tersedia.
         */
        if (!document.body) {
            return false;
        }


        const input =
            getInput();


        if (!input) {

            console.warn(
                "[GEN-Z.AI] Model search input belum tersedia."
            );

            return false;
        }


        /*
         * Module search wajib tersedia.
         */
        if (
            !api ||
            typeof api.onInput !==
                "function" ||
            typeof api.onFocus !==
                "function" ||
            typeof api.onKeydown !==
                "function" ||
            typeof api.onResultsClick !==
                "function" ||
            typeof api.onProviderChanged !==
                "function" ||
            typeof api.onDocumentClick !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] Handler Model Search tidak lengkap."
            );

            return false;
        }


        const resultsBox =
            getResultsBox();


        /*
         * Simpan reference handler.
         */
        handlers = {
            onInput:
                api.onInput,

            onFocus:
                api.onFocus,

            onKeydown:
                api.onKeydown,

            onResultsClick:
                api.onResultsClick,

            onProviderChanged:
                api.onProviderChanged,

            onDocumentClick:
                api.onDocumentClick
        };


        /* -------------------------------------------------
           INPUT
        ------------------------------------------------- */

        input.addEventListener(
            "input",
            handlers.onInput
        );


        input.addEventListener(
            "focus",
            handlers.onFocus
        );


        input.addEventListener(
            "keydown",
            handlers.onKeydown
        );


        /* -------------------------------------------------
           RESULT CLICK
        ------------------------------------------------- */

        if (resultsBox) {

            resultsBox.addEventListener(
                "click",
                handlers.onResultsClick
            );
        }


        /* -------------------------------------------------
           PROVIDER CHANGED
        ------------------------------------------------- */

        document.addEventListener(
            "genz-models-provider-changed",
            handlers.onProviderChanged
        );


        /* -------------------------------------------------
           OUTSIDE CLICK
        ------------------------------------------------- */

        document.addEventListener(
            "click",
            handlers.onDocumentClick
        );


        /* -------------------------------------------------
           DROPDOWN POSITION
        ------------------------------------------------- */

        if (
            window.GENZModelSearchDropdown &&
            typeof
                window.GENZModelSearchDropdown
                    .bindPositionEvents ===
                "function"
        ) {

            window.GENZModelSearchDropdown
                .bindPositionEvents();
        }


        bound = true;


        console.info(
            "[GEN-Z.AI] Model Search Events bound."
        );


        return true;
    }


    /* =====================================================
       UNBIND
    ===================================================== */

    function unbind() {

        if (
            !bound ||
            !handlers
        ) {
            return true;
        }


        const input =
            getInput();


        const resultsBox =
            getResultsBox();


        /* -------------------------------------------------
           INPUT
        ------------------------------------------------- */

        if (input) {

            input.removeEventListener(
                "input",
                handlers.onInput
            );

            input.removeEventListener(
                "focus",
                handlers.onFocus
            );

            input.removeEventListener(
                "keydown",
                handlers.onKeydown
            );
        }


        /* -------------------------------------------------
           RESULT CLICK
        ------------------------------------------------- */

        if (resultsBox) {

            resultsBox.removeEventListener(
                "click",
                handlers.onResultsClick
            );
        }


        /* -------------------------------------------------
           PROVIDER
        ------------------------------------------------- */

        document.removeEventListener(
            "genz-models-provider-changed",
            handlers.onProviderChanged
        );


        /* -------------------------------------------------
           DOCUMENT CLICK
        ------------------------------------------------- */

        document.removeEventListener(
            "click",
            handlers.onDocumentClick
        );


        handlers = null;

        bound = false;


        /*
         * Tutup dropdown ketika event di-reset.
         */
        if (
            window.GENZModelSearchDropdown &&
            typeof
                window.GENZModelSearchDropdown.hide ===
                "function"
        ) {

            window.GENZModelSearchDropdown.hide();
        }


        console.info(
            "[GEN-Z.AI] Model Search Events unbound."
        );


        return true;
    }


    /* =====================================================
       IS BOUND
    ===================================================== */

    function isBound() {

        return bound;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelSearchEvents =
        Object.freeze({

            bind,
            unbind,
            isBound
        });


    console.info(
        "[GEN-Z.AI] Model Search Events loaded."
    );

})();
