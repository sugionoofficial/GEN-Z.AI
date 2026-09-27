/* =========================================================
   GEN-Z.AI
   MODEL SEARCH EVENTS
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-events.js

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
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    let bound = false;

    let handlers = null;


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
        "[data-model-id]",
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

        return document.querySelector(
            INPUT_SELECTOR
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
            )
        );

    }


    /* =====================================================
       GET TARGET
       ===================================================== */

    function getClosestTarget(
        event,
        selector
    ) {

        const target =
            event?.target;


        if (
            !target ||
            typeof target.closest !==
                "function"
        ) {

            return null;

        }


        return target.closest(
            selector
        );

    }


    /* =====================================================
       IS MODEL INPUT
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
       IS RESULT CONTAINER
       ===================================================== */

    function getResultTarget(
        event
    ) {

        return getClosestTarget(
            event,
            RESULT_SELECTOR
        );

    }


    /* =====================================================
       IS RESULT ITEM
       ===================================================== */

    function getResultItem(
        event
    ) {

        return getClosestTarget(
            event,
            RESULT_ITEM_SELECTOR
        );

    }


    /* =====================================================
       STOP EVENT SAFELY
       ===================================================== */

    function stopEvent(
        event
    ) {

        if (
            !event
        ) {

            return;

        }


        if (
            typeof event.preventDefault ===
            "function"
        ) {

            event.preventDefault();

        }

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
         * Semua callback utama wajib tersedia.
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
                "[GEN-Z.AI] Model Search Events menerima handler yang tidak lengkap.",
                api
            );

            return false;

        }


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
           INPUT
           ================================================= */

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


            try {

                handlers.onInput(
                    event
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Model Search input handler error:",
                    error
                );

            }

        }


        /* =================================================
           FOCUS
           ================================================= */

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


            try {

                handlers.onFocus(
                    event
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Model Search focus handler error:",
                    error
                );

            }

        }


        /* =================================================
           KEYDOWN
           ================================================= */

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


            try {

                handlers.onKeydown(
                    event
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Model Search keyboard handler error:",
                    error
                );

            }

        }


        /* =================================================
           RESULT CLICK
           ================================================= */

        function delegatedResultsClick(
            event
        ) {

            const resultContainer =
                getResultTarget(
                    event
                );


            if (
                !resultContainer
            ) {

                return;

            }


            /*
             * Pastikan klik benar-benar berada
             * pada item hasil, bukan area kosong
             * di dalam dropdown.
             */

            const item =
                getResultItem(
                    event
                );


            if (
                !item
            ) {

                return;

            }


            try {

                handlers.onResultsClick(
                    event
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Model Search result click error:",
                    error
                );

            }

        }


        /* =================================================
           PROVIDER CHANGED
           ================================================= */

        function delegatedProviderChanged(
            event
        ) {

            try {

                handlers.onProviderChanged(
                    event
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Model Search Provider change error:",
                    error
                );

            }

        }


        /* =================================================
           DOCUMENT CLICK
           ================================================= */

        function delegatedDocumentClick(
            event
        ) {

            /*
             * Jika klik berada di input atau hasil,
             * jangan dianggap sebagai outside click.
             *
             * Ini penting agar klik Model tidak
             * ditutup oleh listener document sebelum
             * selection selesai.
             */

            const input =
                getInputTarget(
                    event
                );


            if (
                input
            ) {

                return;

            }


            const resultContainer =
                getResultTarget(
                    event
                );


            if (
                resultContainer
            ) {

                return;

            }


            try {

                handlers.onDocumentClick(
                    event
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Model Search document click error:",
                    error
                );

            }

        }


        /* =================================================
           STORE WRAPPERS
           ================================================= */

        handlers.delegatedInput =
            delegatedInput;

        handlers.delegatedFocus =
            delegatedFocus;

        handlers.delegatedKeydown =
            delegatedKeydown;

        handlers.delegatedResultsClick =
            delegatedResultsClick;

        handlers.delegatedProviderChanged =
            delegatedProviderChanged;

        handlers.delegatedDocumentClick =
            delegatedDocumentClick;


        /* =================================================
           REGISTER INPUT
           ================================================= */

        document.addEventListener(
            "input",
            delegatedInput,
            false
        );


        /* =================================================
           REGISTER FOCUS
           ================================================= */

        document.addEventListener(
            "focusin",
            delegatedFocus,
            false
        );


        /* =================================================
           REGISTER KEYBOARD
           ================================================= */

        document.addEventListener(
            "keydown",
            delegatedKeydown,
            false
        );


        /* =================================================
           REGISTER RESULT CLICK
           ================================================= */

        document.addEventListener(
            "click",
            delegatedResultsClick,
            false
        );


        /* =================================================
           REGISTER PROVIDER EVENTS
           ================================================= */

        handlers.providerEventNames =
            PROVIDER_EVENTS.slice();


        PROVIDER_EVENTS.forEach(
            function (eventName) {

                document.addEventListener(
                    eventName,
                    delegatedProviderChanged,
                    false
                );

            }
        );


        /* =================================================
           REGISTER DOCUMENT CLICK
           ================================================= */

        document.addEventListener(
            "click",
            delegatedDocumentClick,
            false
        );


        /* =================================================
           DROPDOWN POSITION
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


        /* =================================================
           MARK BOUND
           ================================================= */

        bound =
            true;


        console.info(
            "[GEN-Z.AI] GENZModelSearchEvents bound."
        );


        /*
         * Input boleh belum ada karena form dapat
         * dibuat setelah page bootstrap.
         *
         * Delegation tetap akan menangkap input
         * ketika element dibuat kemudian.
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
                "unnamed"
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
            !bound ||
            !handlers
        ) {

            return true;

        }


        /* =================================================
           REMOVE INPUT
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


        /* =================================================
           REMOVE FOCUS
           ================================================= */

        if (
            handlers.delegatedFocus
        ) {

            document.removeEventListener(
                "focusin",
                handlers.delegatedFocus,
                false
            );

        }


        /* =================================================
           REMOVE KEYBOARD
           ================================================= */

        if (
            handlers.delegatedKeydown
        ) {

            document.removeEventListener(
                "keydown",
                handlers.delegatedKeydown,
                false
            );

        }


        /* =================================================
           REMOVE RESULT CLICK
           ================================================= */

        if (
            handlers.delegatedResultsClick
        ) {

            document.removeEventListener(
                "click",
                handlers.delegatedResultsClick,
                false
            );

        }


        /* =================================================
           REMOVE PROVIDER EVENTS
           ================================================= */

        const providerEventNames =
            Array.isArray(
                handlers.providerEventNames
            )
                ? handlers.providerEventNames
                : PROVIDER_EVENTS;


        providerEventNames.forEach(
            function (eventName) {

                if (
                    handlers.delegatedProviderChanged
                ) {

                    document.removeEventListener(
                        eventName,
                        handlers.delegatedProviderChanged,
                        false
                    );

                }

            }
        );


        /* =================================================
           REMOVE DOCUMENT CLICK
           ================================================= */

        if (
            handlers.delegatedDocumentClick
        ) {

            document.removeEventListener(
                "click",
                handlers.delegatedDocumentClick,
                false
            );

        }


        /* =================================================
           RESET
           ================================================= */

        handlers =
            null;

        bound =
            false;


        /* =================================================
           HIDE DROPDOWN
           ================================================= */

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
       PUBLIC API
       ===================================================== */

    const API =
        Object.freeze({

            bind,

            unbind,

            rebind,

            initialize,

            isBound

        });


    /*
     * PRIMARY NAME
     * -----------------------------------------------------
     * models-init.js mencari nama plural ini.
     */

    window.GENZModelsFormEvents =
        API;


    /*
     * COMPATIBILITY NAME
     * -----------------------------------------------------
     * Nama lama tetap dipertahankan agar module
     * lain yang sudah menggunakan nama ini tidak rusak.
     */

    window.GENZModelSearchEvents =
        API;


    console.info(
        "[GEN-Z.AI] GENZModelsFormEvents loaded."
    );

})();
