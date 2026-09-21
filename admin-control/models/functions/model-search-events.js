/* =========================================================
   GEN-Z.AI
   MODEL SEARCH EVENTS
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-search-events.js

   Tanggung jawab:
   - Event input Model ID
   - Focus Model ID
   - Keyboard navigation
   - Click hasil dropdown
   - Provider changed
   - Click outside
   - Event delegation

   Tidak bertanggung jawab:
   - Query Supabase
   - Search logic
   - Render result
   - Selection logic
   - CRUD
   - Membuat Model ID

   CATATAN:
   - Input dapat dibuat ulang oleh modal.
   - Event menggunakan delegation.
   - Tidak ada listener langsung ke input.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let bound =
        false;

    let handlers =
        null;


    /* =====================================================
       SELECTORS
    ===================================================== */

    const INPUT_SELECTOR = [
        "#modelCodeSearch",
        "#modelSearch",
        "#modelIdSearch",
        "#modelId",
        "#model_id",
        "[name='model_id']",
        "[name='modelId']"
    ].join(", ");


    const RESULT_SELECTOR = [
        "#modelSearchResults",
        "#modelResults",
        "#modelDropdown",
        "[data-model-search-results]"
    ].join(", ");


    const RESULT_ITEM_SELECTOR = [
        ".model-search-item",
        "[data-model-search-item]"
    ].join(", ");


    const PROVIDER_EVENTS = [
        "genz-model-provider-changed",
        "genz-models-provider-changed",
        "genz-provider-changed"
    ];


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
            ) ||

            document.getElementById(
                "modelId"
            ) ||

            document.getElementById(
                "model_id"
            ) ||

            document.querySelector(
                "[name='model_id']"
            ) ||

            document.querySelector(
                "[name='modelId']"
            ) ||

            null
        );
    }


    /* =====================================================
       GET RESULT BOX
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
            ) ||

            document.querySelector(
                "[data-model-search-results]"
            ) ||

            null
        );
    }


    /* =====================================================
       GET CLOSEST TARGET
    ===================================================== */

    function getClosestTarget(
        event,
        selector
    ) {

        const target =
            event?.target;


        if (
            !target
        ) {

            return null;
        }


        /*
         * Element memiliki closest().
         */
        if (
            typeof target.closest ===
            "function"
        ) {

            return target.closest(
                selector
            );
        }


        /*
         * Fallback untuk target
         * yang bukan Element.
         */
        if (
            target.parentElement &&
            typeof target.parentElement.closest ===
            "function"
        ) {

            return target.parentElement.closest(
                selector
            );
        }


        return null;
    }


    /* =====================================================
       INPUT TARGET
    ===================================================== */

    function getInputTarget(
        event
    ) {

        return getClosestTarget(
            event,
            INPUT_SELECTOR
        );
    }


    /* =====================================================
       RESULT ITEM TARGET
    ===================================================== */

    function getResultItemTarget(
        event
    ) {

        return getClosestTarget(
            event,
            RESULT_ITEM_SELECTOR
        );
    }


    /* =====================================================
       RESULT BOX TARGET
    ===================================================== */

    function getResultBoxTarget(
        event
    ) {

        return getClosestTarget(
            event,
            RESULT_SELECTOR
        );
    }


    /* =====================================================
       SAFE CALLBACK
    ===================================================== */

    function callHandler(
        name,
        event
    ) {

        if (
            !handlers ||
            typeof handlers[name] !==
            "function"
        ) {

            return false;
        }


        try {

            return handlers[name](
                event
            );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Model Search handler error:",
                name,
                error
            );


            return false;
        }
    }


    /* =====================================================
       INPUT
    ===================================================== */

    function delegatedInput(
        event
    ) {

        const input =
            getInputTarget(
                event
            );


        if (
            !input
        ) {

            return;
        }


        callHandler(
            "onInput",
            event
        );
    }


    /* =====================================================
       FOCUS
    ===================================================== */

    function delegatedFocus(
        event
    ) {

        const input =
            getInputTarget(
                event
            );


        if (
            !input
        ) {

            return;
        }


        callHandler(
            "onFocus",
            event
        );
    }


    /* =====================================================
       KEYDOWN
    ===================================================== */

    function delegatedKeydown(
        event
    ) {

        const input =
            getInputTarget(
                event
            );


        if (
            !input
        ) {

            return;
        }


        callHandler(
            "onKeydown",
            event
        );
    }


    /* =====================================================
       RESULT CLICK
    ===================================================== */

    function delegatedResultsClick(
        event
    ) {

        const resultBox =
            getResultBoxTarget(
                event
            );


        if (
            !resultBox
        ) {

            return;
        }


        const item =
            getResultItemTarget(
                event
            );


        /*
         * Klik di area kosong dropdown
         * tidak diteruskan ke selection.
         */
        if (
            !item
        ) {

            return;
        }


        callHandler(
            "onResultsClick",
            event
        );
    }


    /* =====================================================
       PROVIDER CHANGED
       ===================================================== */

    function delegatedProviderChanged(
        event
    ) {

        callHandler(
            "onProviderChanged",
            event
        );
    }


    /* =====================================================
       DOCUMENT CLICK
       ===================================================== */

    function delegatedDocumentClick(
        event
    ) {

        /*
         * Klik pada Model input atau dropdown
         * bukan outside click.
         *
         * Handler utama tetap menerima event
         * supaya modul Search dapat memutuskan
         * sendiri apakah dropdown harus ditutup.
         */
        const input =
            getInputTarget(
                event
            );


        const resultBox =
            getResultBoxTarget(
                event
            );


        if (
            input ||
            resultBox
        ) {

            return;
        }


        callHandler(
            "onDocumentClick",
            event
        );
    }


    /* =====================================================
       REGISTER PROVIDER EVENTS
    ===================================================== */

    function bindProviderEvents() {

        PROVIDER_EVENTS.forEach(
            function (eventName) {

                document.addEventListener(
                    eventName,
                    delegatedProviderChanged,
                    false
                );
            }
        );
    }


    /* =====================================================
       UNREGISTER PROVIDER EVENTS
    ===================================================== */

    function unbindProviderEvents() {

        PROVIDER_EVENTS.forEach(
            function (eventName) {

                document.removeEventListener(
                    eventName,
                    delegatedProviderChanged,
                    false
                );
            }
        );
    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind(
        api
    ) {

        /*
         * Hindari duplicate listener.
         */
        if (
            bound
        ) {

            /*
             * Jika bind dipanggil lagi dengan API
             * yang sama, tidak perlu membuat listener baru.
             */
            if (
                api &&
                api !== handlers
            ) {

                handlers = {
                    ...handlers,
                    ...api
                };
            }


            return true;
        }


        if (
            !document.body
        ) {

            console.warn(
                "[GEN-Z.AI] document.body belum tersedia."
            );


            return false;
        }


        /*
         * API harus menyediakan handler inti.
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
                "[GEN-Z.AI] GENZModelSearchEvents menerima handler yang tidak lengkap.",
                api
            );


            return false;
        }


        handlers =
            api;


        /* =================================================
           INPUT
           ================================================= */

        document.addEventListener(
            "input",
            delegatedInput,
            false
        );


        /* =================================================
           FOCUS
           ================================================= */

        document.addEventListener(
            "focusin",
            delegatedFocus,
            false
        );


        /* =================================================
           KEYBOARD
           ================================================= */

        document.addEventListener(
            "keydown",
            delegatedKeydown,
            false
        );


        /* =================================================
           RESULT CLICK
           ================================================= */

        document.addEventListener(
            "click",
            delegatedResultsClick,
            false
        );


        /* =================================================
           PROVIDER EVENTS
           ================================================= */

        bindProviderEvents();


        /* =================================================
           OUTSIDE CLICK
           ================================================= */

        document.addEventListener(
            "click",
            delegatedDocumentClick,
            false
        );


        /* =================================================
           DROPDOWN POSITION EVENTS
           ================================================= */

        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.bindPositionEvents ===
                "function"
        ) {

            try {

                dropdown.bindPositionEvents();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Dropdown position event gagal dipasang:",
                    error
                );
            }
        }


        bound =
            true;


        console.info(
            "[GEN-Z.AI] GENZModelSearchEvents bound."
        );


        /*
         * Input boleh belum ada karena modal
         * belum dibuka. Event delegation tetap aktif.
         */
        const input =
            getInput();


        if (
            input
        ) {

            console.info(
                "[GEN-Z.AI] Model ID input terdeteksi:",
                input.id ||
                input.name ||
                "(unnamed)"
            );

        } else {

            console.info(
                "[GEN-Z.AI] Model ID input belum ada. Event delegation tetap aktif."
            );
        }


        return true;
    }


    /* =====================================================
       UNBIND
    ===================================================== */

    function unbind() {

        if (
            !bound
        ) {

            return true;
        }


        /* =================================================
           INPUT
           ================================================= */

        document.removeEventListener(
            "input",
            delegatedInput,
            false
        );


        /* =================================================
           FOCUS
           ================================================= */

        document.removeEventListener(
            "focusin",
            delegatedFocus,
            false
        );


        /* =================================================
           KEYBOARD
           ================================================= */

        document.removeEventListener(
            "keydown",
            delegatedKeydown,
            false
        );


        /* =================================================
           RESULT CLICK
           ================================================= */

        document.removeEventListener(
            "click",
            delegatedResultsClick,
            false
        );


        /* =================================================
           PROVIDER EVENTS
           ================================================= */

        unbindProviderEvents();


        /* =================================================
           OUTSIDE CLICK
           ================================================= */

        document.removeEventListener(
            "click",
            delegatedDocumentClick,
            false
        );


        handlers =
            null;


        bound =
            false;


        /*
         * Tutup dropdown ketika event module
         * benar-benar dilepas.
         */
        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.hide ===
                "function"
        ) {

            try {

                dropdown.hide();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal menutup dropdown saat unbind:",
                    error
                );
            }
        }


        console.info(
            "[GEN-Z.AI] GENZModelSearchEvents unbound."
        );


        return true;
    }


    /* =====================================================
       REBIND
    ===================================================== */

    function rebind(
        api
    ) {

        unbind();


        return bind(
            api
        );
    }


    /* =====================================================
       IS BOUND
    ===================================================== */

    function isBound() {

        return bound;
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize(
        api
    ) {

        return bind(
            api
        );
    }


    /* =====================================================
       GET INPUT ELEMENT
    ===================================================== */

    function getCurrentInput() {

        return getInput();
    }


    /* =====================================================
       GET RESULT BOX ELEMENT
    ===================================================== */

    function getCurrentResultsBox() {

        return getResultsBox();
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelSearchEvents =
        Object.freeze({

            bind,

            unbind,

            rebind,

            initialize,

            isBound,

            getInput:
                getCurrentInput,

            getResultsBox:
                getCurrentResultsBox

        });


    console.info(
        "[GEN-Z.AI] GENZModelSearchEvents loaded."
    );

})();
