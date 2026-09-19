/* =========================================================
   GEN-Z.AI
   MODEL SEARCH DROPDOWN
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-search-dropdown.js

   Tanggung jawab:
   - Show
   - Hide
   - Position
   - Reposition
   - Menjaga dropdown tetap berada di atas modal
   - Aman jika input / dropdown dibuat ulang oleh modal

   Tidak bertanggung jawab:
   - Search
   - Provider
   - Selection
   - Rendering
   - CRUD

   COMPATIBILITY:
   - #modelCodeSearch
   - #modelSearch
   - #modelIdSearch

   RESULT BOX:
   - #modelSearchResults
   - #modelResults
   - #modelDropdown
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONSTANTS
    ===================================================== */

    const INPUT_IDS = [
        "modelCodeSearch",
        "modelSearch",
        "modelIdSearch"
    ];

    const RESULT_IDS = [
        "modelSearchResults",
        "modelResults",
        "modelDropdown"
    ];

    const POSITION_GAP = 6;

    const Z_INDEX = "99999";


    /* =====================================================
       STATE
    ===================================================== */

    let positionEventsBound = false;

    let lastInputElement = null;

    let lastBoxElement = null;


    /* =====================================================
       GET INPUT
    ===================================================== */

    function getInput() {

        for (
            const id of INPUT_IDS
        ) {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                return element;
            }
        }

        return null;
    }


    /* =====================================================
       GET RESULT BOX
    ===================================================== */

    function getBox() {

        for (
            const id of RESULT_IDS
        ) {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                return element;
            }
        }

        return null;
    }


    /* =====================================================
       CHECK DOM ELEMENT
    ===================================================== */

    function isElement(
        element
    ) {

        return (
            element &&
            typeof element.getBoundingClientRect ===
                "function"
        );
    }


    /* =====================================================
       GET CURRENT TARGETS
    ===================================================== */

    function getTargets() {

        const input =
            getInput();

        const box =
            getBox();

        if (
            input
        ) {

            lastInputElement =
                input;
        }

        if (
            box
        ) {

            lastBoxElement =
                box;
        }

        return {
            input,
            box
        };
    }


    /* =====================================================
       POSITION
    ===================================================== */

    function position() {

        const {
            input,
            box
        } = getTargets();


        if (
            !isElement(input) ||
            !isElement(box)
        ) {

            return false;
        }


        /*
         * Jika input tidak terlihat,
         * jangan memaksa posisi dropdown.
         */
        const inputRect =
            input.getBoundingClientRect();


        if (
            inputRect.width <= 0 ||
            inputRect.height <= 0
        ) {

            return false;
        }


        /*
         * Gunakan fixed positioning.
         *
         * Dengan demikian dropdown mengikuti
         * viewport dan tidak terpotong oleh
         * overflow parent/modal.
         */
        box.style.position =
            "fixed";

        box.style.left =
            Math.round(
                inputRect.left
            ) + "px";

        box.style.top =
            Math.round(
                inputRect.bottom +
                POSITION_GAP
            ) + "px";

        box.style.width =
            Math.round(
                inputRect.width
            ) + "px";

        box.style.minWidth =
            Math.round(
                inputRect.width
            ) + "px";

        box.style.maxWidth =
            Math.round(
                inputRect.width
            ) + "px";

        box.style.maxHeight =
            "min(320px, calc(100vh - " +
            Math.round(
                inputRect.bottom +
                POSITION_GAP +
                12
            ) +
            "px))";

        box.style.zIndex =
            Z_INDEX;

        /*
         * Pastikan transform parent tidak
         * mengacaukan stacking context sebisa mungkin.
         */
        box.style.visibility =
            "visible";


        return true;
    }


    /* =====================================================
       POSITION USING RAF
       ===================================================== */

    let repositionFrame =
        null;


    function requestPosition() {

        if (
            repositionFrame !== null
        ) {

            return;
        }


        repositionFrame =
            window.requestAnimationFrame(
                function () {

                    repositionFrame =
                        null;

                    if (
                        isVisible()
                    ) {

                        position();
                    }
                }
            );
    }


    /* =====================================================
       SHOW
    ===================================================== */

    function show() {

        const {
            input,
            box
        } = getTargets();


        if (
            !box
        ) {

            return false;
        }


        /*
         * Input tidak wajib ditemukan untuk
         * menampilkan dropdown, tetapi posisi
         * tidak dapat dihitung tanpa input.
         */
        if (
            !input
        ) {

            return false;
        }


        /*
         * Pastikan dropdown dapat menerima
         * pointer event.
         */
        box.style.pointerEvents =
            "auto";

        box.style.visibility =
            "visible";


        /*
         * Posisi dihitung sebelum display block
         * supaya tidak terjadi lompatan visual.
         */
        position();


        box.style.display =
            "block";

        box.classList.add(
            "show"
        );


        /*
         * Hitung ulang setelah display aktif.
         * getBoundingClientRect() lebih akurat
         * setelah element benar-benar terlihat.
         */
        requestPosition();


        return true;
    }


    /* =====================================================
       HIDE
    ===================================================== */

    function hide() {

        const box =
            getBox();


        if (
            !box
        ) {

            return true;
        }


        box.style.display =
            "none";

        box.style.visibility =
            "hidden";

        box.classList.remove(
            "show"
        );


        return true;
    }


    /* =====================================================
       IS VISIBLE
    ===================================================== */

    function isVisible() {

        const box =
            getBox();


        if (
            !box
        ) {

            return false;
        }


        const computed =
            window.getComputedStyle(
                box
            );


        return (
            computed.display !==
                "none" &&
            computed.visibility !==
                "hidden" &&
            box.classList.contains(
                "show"
            )
        );
    }


    /* =====================================================
       TOGGLE
    ===================================================== */

    function toggle(
        visible
    ) {

        if (
            visible
        ) {

            return show();
        }

        return hide();
    }


    /* =====================================================
       BIND POSITION EVENTS
    ===================================================== */

    function bindPositionEvents() {

        if (
            positionEventsBound
        ) {

            return true;
        }


        /*
         * Resize viewport.
         */
        window.addEventListener(
            "resize",
            function () {

                if (
                    isVisible()
                ) {

                    requestPosition();
                }
            },
            {
                passive:
                    true
            }
        );


        /*
         * Scroll capture.
         *
         * Dropdown menggunakan fixed positioning,
         * tetapi posisi input tetap dapat berubah
         * ketika modal/page di-scroll.
         */
        window.addEventListener(
            "scroll",
            function () {

                if (
                    isVisible()
                ) {

                    requestPosition();
                }
            },
            {
                passive:
                    true,
                capture:
                    true
            }
        );


        /*
         * Visual viewport berguna pada browser
         * mobile ketika keyboard muncul.
         */
        if (
            window.visualViewport
        ) {

            window.visualViewport.addEventListener(
                "resize",
                function () {

                    if (
                        isVisible()
                    ) {

                        requestPosition();
                    }
                },
                {
                    passive:
                        true
                }
            );


            window.visualViewport.addEventListener(
                "scroll",
                function () {

                    if (
                        isVisible()
                    ) {

                        requestPosition();
                    }
                },
                {
                    passive:
                        true
                }
            );
        }


        /*
         * MutationObserver diperlukan karena modal
         * dapat membuat ulang input/result box.
         *
         * Observer hanya memeriksa keberadaan element,
         * bukan melakukan render/search.
         */
        if (
            window.MutationObserver &&
            document.body
        ) {

            const observer =
                new MutationObserver(
                    function () {

                        const input =
                            getInput();

                        const box =
                            getBox();


                        if (
                            input !==
                            lastInputElement ||
                            box !==
                            lastBoxElement
                        ) {

                            lastInputElement =
                                input;

                            lastBoxElement =
                                box;


                            if (
                                isVisible()
                            ) {

                                requestPosition();
                            }
                        }
                    }
                );


            observer.observe(
                document.body,
                {
                    childList:
                        true,
                    subtree:
                        true
                }
            );
        }


        positionEventsBound =
            true;


        return true;
    }


    /* =====================================================
       UNBIND POSITION EVENTS
       
       Position listener sengaja dibuat singleton.
       Tidak perlu dilepas setiap modal ditutup karena
       module hidup selama halaman aktif.
    ===================================================== */

    function unbindPositionEvents() {

        /*
         * Listener viewport tidak disimpan sebagai
         * reference sehingga tidak dilepas.
         *
         * Ini sengaja:
         * module search bersifat singleton dan
         * listener hanya dibuat satu kali.
         */
        return true;
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    function refresh() {

        if (
            !isVisible()
        ) {

            return false;
        }


        return position();
    }


    /* =====================================================
       GET STATE
    ===================================================== */

    function getState() {

        const input =
            getInput();

        const box =
            getBox();


        return {

            visible:
                isVisible(),

            inputId:
                input?.id ||
                null,

            resultBoxId:
                box?.id ||
                null,

            positionBound:
                positionEventsBound
        };
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        bindPositionEvents();

        getTargets();

        return true;
    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        hide();

        lastInputElement =
            null;

        lastBoxElement =
            null;

        /*
         * positionEventsBound tetap true.
         *
         * Module ini dirancang singleton.
         * Destroy hanya membersihkan visual state.
         */
        return true;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelSearchDropdown =
        Object.freeze({

            show,

            hide,

            toggle,

            position,

            refresh,

            isVisible,

            bindPositionEvents,

            unbindPositionEvents,

            initialize,

            destroy,

            getState

        });


    /*
     * Bind segera jika DOM sudah tersedia.
     * Loader tetap dapat memanggil initialize()
     * kembali tanpa membuat duplicate listener.
     */
    if (
        document.body
    ) {

        initialize();

    } else {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:
                    true
            }
        );
    }


    console.info(
        "[GEN-Z.AI] GENZModelSearchDropdown loaded."
    );

})();
