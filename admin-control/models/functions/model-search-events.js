/* =========================================================
   GEN-Z.AI
   MODEL SEARCH EVENTS
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-search-events.js

   Tanggung jawab:
   - Bind input Model ID
   - Focus
   - Keyboard
   - Click hasil
   - Provider changed
   - Click outside

   FIX UTAMA:
   - Menggunakan EVENT DELEGATION
   - Tidak bergantung pada kapan modal/input dibuat
   - Tetap bekerja jika #modelCodeSearch dibuat ulang
   - Tidak membuat duplicate listener
   - Aman terhadap initialize / reset / re-open modal
   - Tidak mengubah search logic
   - Tidak mengubah renderer
   - Tidak mengubah dropdown
   - Tidak mengubah CRUD
========================================================= */

(function () {
    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let bound = false;
    let handlers = null;


    /* =====================================================
       SELECTOR
    ===================================================== */

    const INPUT_SELECTOR =
        "#modelCodeSearch, #modelSearch, #modelIdSearch";

    const RESULTS_SELECTOR =
        "#modelSearchResults, #modelResults, #modelDropdown";


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
       NORMALIZE EVENT TARGET
    ===================================================== */

    function getInputTarget(event) {

        const target =
            event?.target;

        if (!target) {
            return null;
        }


        if (
            typeof target.closest !==
            "function"
        ) {
            return null;
        }


        const input =
            target.closest(
                INPUT_SELECTOR
            );


        if (!input) {
            return null;
        }


        return input;
    }


    /* =====================================================
       GET RESULT TARGET
    ===================================================== */

    function getResultsTarget(event) {

        const target =
            event?.target;

        if (!target) {
            return null;
        }


        if (
            typeof target.closest !==
            "function"
        ) {
            return null;
        }


        const results =
            target.closest(
                RESULTS_SELECTOR
            );


        return results || null;
    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind(api) {

        /*
         * Jangan bind dua kali.
         */
        if (bound) {

            console.info(
                "[GEN-Z.AI] Model Search Events sudah bound."
            );

            return true;
        }


        /*
         * Body wajib tersedia.
         */
        if (!document.body) {

            console.warn(
                "[GEN-Z.AI] document.body belum tersedia."
            );

            return false;
        }


        /*
         * Handler dari GENZModelsSearch.
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
                "[GEN-Z.AI] Handler Model Search tidak lengkap.",
                api
            );

            return false;
        }


        /*
         * Simpan callback.
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


        /* =================================================
           INPUT DELEGATION
           =================================================

           Jangan lagi:

               input.addEventListener(...)

           Karena input dapat dibuat ulang oleh modal.

           Sekarang listener berada di document.
        */

        function delegatedInput(event) {

            const input =
                getInputTarget(event);


            if (!input) {
                return;
            }


            /*
             * Pastikan event berasal dari
             * Model ID search.
             */

            handlers.onInput(
                event
            );
        }


        /* =================================================
           FOCUS DELEGATION
           =================================================

           focus tidak bubble secara normal.
           Gunakan focusin.
        */

        function delegatedFocus(event) {

            const input =
                getInputTarget(event);


            if (!input) {
                return;
            }


            handlers.onFocus(
                event
            );
        }


        /* =================================================
           KEYBOARD DELEGATION
           ================================================= */

        function delegatedKeydown(event) {

            const input =
                getInputTarget(event);


            if (!input) {
                return;
            }


            handlers.onKeydown(
                event
            );
        }


        /* =================================================
           RESULT CLICK DELEGATION
           ================================================= */

        function delegatedResultsClick(event) {

            const results =
                getResultsTarget(event);


            if (!results) {
                return;
            }


            handlers.onResultsClick(
                event
            );
        }


        /* =================================================
           DOCUMENT CLICK
           ================================================= */

        function delegatedDocumentClick(event) {

            /*
             * onDocumentClick memang menerima
             * seluruh document click.
             */

            handlers.onDocumentClick(
                event
            );
        }


        /* =================================================
           PROVIDER CHANGE
           ================================================= */

        function delegatedProviderChanged(event) {

            handlers.onProviderChanged(
                event
            );
        }


        /*
         * Simpan wrapper handler.
         * Ini penting agar unbind() bisa melepas
         * listener yang sama.
         */

        handlers.delegatedInput =
            delegatedInput;

        handlers.delegatedFocus =
            delegatedFocus;

        handlers.delegatedKeydown =
            delegatedKeydown;

        handlers.delegatedResultsClick =
            delegatedResultsClick;

        handlers.delegatedDocumentClick =
            delegatedDocumentClick;

        handlers.delegatedProviderChanged =
            delegatedProviderChanged;


        /* =================================================
           REGISTER EVENTS
           ================================================= */

        /*
         * input:
         * event input memang bubble.
         */
        document.addEventListener(
            "input",
            delegatedInput,
            false
        );


        /*
         * focus:
         * gunakan focusin karena focus tidak bubble.
         */
        document.addEventListener(
            "focusin",
            delegatedFocus,
            false
        );


        /*
         * keyboard.
         */
        document.addEventListener(
            "keydown",
            delegatedKeydown,
            false
        );


        /*
         * Click hasil dropdown.
         */
        document.addEventListener(
            "click",
            delegatedResultsClick,
            false
        );


        /*
         * Provider changed.
         */
        document.addEventListener(
            "genz-models-provider-changed",
            delegatedProviderChanged,
            false
        );


        /*
         * Click outside.
         *
         * Listener ini juga berada di document.
         * delegatedResultsClick tidak menghentikan
         * propagation sehingga handler lama tetap
         * dapat bekerja.
         */
        document.addEventListener(
            "click",
            delegatedDocumentClick,
            false
        );


        /* =================================================
           DROPDOWN POSITION
           ================================================= */

        if (
            window.GENZModelSearchDropdown &&
            typeof
                window.GENZModelSearchDropdown
                    .bindPositionEvents ===
                "function"
        ) {

            try {

                window.GENZModelSearchDropdown
                    .bindPositionEvents();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Dropdown position binding gagal:",
                    error
                );
            }
        }


        bound =
            true;


        console.info(
            "[GEN-Z.AI] Model Search Events bound menggunakan event delegation."
        );


        /*
         * Debug ringan.
         *
         * Pastikan input memang ditemukan.
         * Ini tidak mengubah behavior.
         */
        const input =
            getInput();


        if (input) {

            console.info(
                "[GEN-Z.AI] Model ID search input terdeteksi:",
                input.id
            );

        } else {

            console.warn(
                "[GEN-Z.AI] Model ID search input belum ada saat bind. Event delegation tetap aktif."
            );
        }


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


        /* =================================================
           REMOVE EVENTS
           ================================================= */

        if (
            handlers.delegatedInput
        ) {

            document.removeEventListener(
                "input",
                handlers.delegatedInput,
                false
            );
        }


        if (
            handlers.delegatedFocus
        ) {

            document.removeEventListener(
                "focusin",
                handlers.delegatedFocus,
                false
            );
        }


        if (
            handlers.delegatedKeydown
        ) {

            document.removeEventListener(
                "keydown",
                handlers.delegatedKeydown,
                false
            );
        }


        if (
            handlers.delegatedResultsClick
        ) {

            document.removeEventListener(
                "click",
                handlers.delegatedResultsClick,
                false
            );
        }


        if (
            handlers.delegatedProviderChanged
        ) {

            document.removeEventListener(
                "genz-models-provider-changed",
                handlers.delegatedProviderChanged,
                false
            );
        }


        if (
            handlers.delegatedDocumentClick
        ) {

            document.removeEventListener(
                "click",
                handlers.delegatedDocumentClick,
                false
            );
        }


        handlers =
            null;

        bound =
            false;


        /* =================================================
           HIDE DROPDOWN
           ================================================= */

        if (
            window.GENZModelSearchDropdown &&
            typeof
                window.GENZModelSearchDropdown.hide ===
                "function"
        ) {

            try {

                window.GENZModelSearchDropdown
                    .hide();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal menutup Model Search Dropdown:",
                    error
                );
            }
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
       FORCE REBIND
       ===================================================== */

    function rebind(api) {

        /*
         * Lepas listener lama.
         */
        unbind();


        /*
         * Pasang listener baru.
         */
        return bind(
            api
        );
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelSearchEvents =
        Object.freeze({

            bind,

            unbind,

            rebind,

            isBound
        });


    console.info(
        "[GEN-Z.AI] GENZModelSearchEvents loaded."
    );

})();
