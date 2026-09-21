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
   - #modelId
   - #model_id
   - [name="model_id"]

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
        "modelIdSearch",
        "modelId",
        "model_id"
    ];


    const RESULT_IDS = [
        "modelSearchResults",
        "modelResults",
        "modelDropdown"
    ];


    const POSITION_GAP = 6;

    const VIEWPORT_GAP = 8;

    const Z_INDEX = "99999";


    /* =====================================================
       STATE
    ===================================================== */

    let positionEventsBound =
        false;


    let mutationObserver =
        null;


    let lastInputElement =
        null;


    let lastBoxElement =
        null;


    let repositionFrame =
        null;


    let initialized =
        false;


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


            if (
                element
            ) {

                return element;
            }
        }


        /*
         * Fallback untuk markup yang tidak
         * menggunakan ID standar.
         */
        return (
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

    function getBox() {

        for (
            const id of RESULT_IDS
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (
                element
            ) {

                return element;
            }
        }


        /*
         * Fallback attribute.
         */
        return document.querySelector(
            "[data-model-search-results]"
        );
    }


    /* =====================================================
       ELEMENT CHECK
    ===================================================== */

    function isElement(
        element
    ) {

        return Boolean(
            element &&
            typeof element.getBoundingClientRect ===
                "function"
        );
    }


    /* =====================================================
       GET TARGETS
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
       CHECK INPUT VISIBILITY
    ===================================================== */

    function isInputVisible(
        input
    ) {

        if (
            !isElement(
                input
            )
        ) {

            return false;
        }


        const rect =
            input.getBoundingClientRect();


        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {

            return false;
        }


        const style =
            window.getComputedStyle(
                input
            );


        if (
            style.display ===
                "none" ||
            style.visibility ===
                "hidden"
        ) {

            return false;
        }


        return true;
    }


    /* =====================================================
       CALCULATE POSITION
    ===================================================== */

    function calculatePosition(
        input,
        box
    ) {

        if (
            !isElement(
                input
            ) ||
            !isElement(
                box
            )
        ) {

            return null;
        }


        const rect =
            input.getBoundingClientRect();


        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {

            return null;
        }


        const viewportWidth =
            window.innerWidth ||
            document.documentElement.clientWidth ||
            0;


        const viewportHeight =
            window.innerHeight ||
            document.documentElement.clientHeight ||
            0;


        if (
            viewportWidth <= 0 ||
            viewportHeight <= 0
        ) {

            return null;
        }


        /*
         * Lebar dropdown mengikuti input.
         */
        const width =
            Math.max(
                1,
                Math.round(
                    rect.width
                )
            );


        /*
         * Posisi default di bawah input.
         */
        let left =
            Math.round(
                rect.left
            );


        let top =
            Math.round(
                rect.bottom +
                POSITION_GAP
            );


        /*
         * Jangan keluar dari sisi kanan viewport.
         */
        if (
            left + width >
            viewportWidth -
            VIEWPORT_GAP
        ) {

            left =
                viewportWidth -
                width -
                VIEWPORT_GAP;
        }


        if (
            left <
            VIEWPORT_GAP
        ) {

            left =
                VIEWPORT_GAP;
        }


        /*
         * Hitung ruang di bawah dan di atas input.
         */
        const spaceBelow =
            Math.max(
                0,
                viewportHeight -
                rect.bottom -
                POSITION_GAP -
                VIEWPORT_GAP
            );


        const spaceAbove =
            Math.max(
                0,
                rect.top -
                POSITION_GAP -
                VIEWPORT_GAP
            );


        /*
         * Ukuran natural dropdown.
         *
         * offsetHeight dapat 0 ketika display:none,
         * sehingga gunakan scrollHeight sebagai fallback.
         */
        const naturalHeight =
            Math.max(
                box.scrollHeight || 0,
                box.offsetHeight || 0,
                180
            );


        let maxHeight =
            Math.min(
                320,
                Math.max(
                    120,
                    spaceBelow
                )
            );


        /*
         * Jika ruang bawah terlalu kecil,
         * pindahkan dropdown ke atas input.
         */
        if (
            spaceBelow < 120 &&
            spaceAbove > spaceBelow
        ) {

            const estimatedHeight =
                Math.min(
                    320,
                    Math.max(
                        120,
                        spaceAbove
                    )
                );


            top =
                Math.round(
                    rect.top -
                    POSITION_GAP -
                    Math.min(
                        naturalHeight,
                        estimatedHeight
                    )
                );


            maxHeight =
                estimatedHeight;


        } else {

            maxHeight =
                Math.min(
                    320,
                    Math.max(
                        120,
                        spaceBelow
                    )
                );
        }


        /*
         * Jangan sampai top negatif.
         */
        if (
            top <
            VIEWPORT_GAP
        ) {

            top =
                VIEWPORT_GAP;
        }


        return {

            left,

            top,

            width,

            maxHeight
        };
    }


    /* =====================================================
       APPLY POSITION
    ===================================================== */

    function position() {

        const {
            input,
            box
        } =
            getTargets();


        if (
            !isInputVisible(
                input
            )
        ) {

            return false;
        }


        if (
            !isElement(
                box
            )
        ) {

            return false;
        }


        const calculated =
            calculatePosition(
                input,
                box
            );


        if (
            !calculated
        ) {

            return false;
        }


        /*
         * Fixed positioning membuat dropdown
         * tidak terpotong overflow parent/modal.
         */
        box.style.position =
            "fixed";


        box.style.left =
            calculated.left +
            "px";


        box.style.top =
            calculated.top +
            "px";


        box.style.width =
            calculated.width +
            "px";


        box.style.minWidth =
            calculated.width +
            "px";


        box.style.maxWidth =
            calculated.width +
            "px";


        box.style.maxHeight =
            calculated.maxHeight +
            "px";


        box.style.overflowY =
            "auto";


        box.style.boxSizing =
            "border-box";


        box.style.zIndex =
            Z_INDEX;


        box.style.pointerEvents =
            "auto";


        box.style.visibility =
            "visible";


        return true;
    }


    /* =====================================================
       REQUEST POSITION
    ===================================================== */

    function requestPosition() {

        if (
            repositionFrame !==
            null
        ) {

            return;
        }


        const raf =
            window.requestAnimationFrame;


        if (
            typeof raf !==
            "function"
        ) {

            if (
                isVisible()
            ) {

                position();
            }


            return;
        }


        repositionFrame =
            raf.call(
                window,
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
       CANCEL POSITION
    ===================================================== */

    function cancelPositionFrame() {

        if (
            repositionFrame ===
            null
        ) {

            return;
        }


        if (
            typeof window.cancelAnimationFrame ===
            "function"
        ) {

            window.cancelAnimationFrame(
                repositionFrame
            );
        }


        repositionFrame =
            null;
    }


    /* =====================================================
       UPDATE ARIA
    ===================================================== */

    function updateAria(
        expanded
    ) {

        const input =
            getInput();


        if (
            !input
        ) {

            return;
        }


        input.setAttribute(
            "aria-expanded",
            expanded
                ? "true"
                : "false"
        );


        const box =
            getBox();


        if (
            box
        ) {

            if (
                !box.id
            ) {

                box.id =
                    "modelSearchResults";
            }


            input.setAttribute(
                "aria-controls",
                box.id
            );
        }
    }


    /* =====================================================
       SHOW
    ===================================================== */

    function show() {

        const {
            input,
            box
        } =
            getTargets();


        if (
            !box
        ) {

            return false;
        }


        /*
         * Input wajib tersedia untuk positioning.
         */
        if (
            !input
        ) {

            return false;
        }


        if (
            !isInputVisible(
                input
            )
        ) {

            return false;
        }


        /*
         * Siapkan visual state.
         */
        box.style.position =
            "fixed";


        box.style.pointerEvents =
            "auto";


        box.style.visibility =
            "hidden";


        box.style.display =
            "block";


        box.style.zIndex =
            Z_INDEX;


        box.classList.add(
            "show"
        );


        /*
         * Position setelah display:block.
         */
        const positioned =
            position();


        if (
            !positioned
        ) {

            hide();

            return false;
        }


        box.style.visibility =
            "visible";


        updateAria(
            true
        );


        /*
         * Recalculate satu frame kemudian.
         * Berguna jika modal baru selesai layout.
         */
        requestPosition();


        return true;
    }


    /* =====================================================
       HIDE
    ===================================================== */

    function hide() {

        cancelPositionFrame();


        const box =
            getBox();


        if (
            box
        ) {

            box.style.display =
                "none";


            box.style.visibility =
                "hidden";


            box.style.pointerEvents =
                "none";


            box.classList.remove(
                "show"
            );
        }


        updateAria(
            false
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
         * Resize.
         */
        window.addEventListener(
            "resize",
            handleViewportChange,
            {
                passive:
                    true
            }
        );


        /*
         * Scroll.
         */
        window.addEventListener(
            "scroll",
            handleViewportChange,
            {
                passive:
                    true,
                capture:
                    true
            }
        );


        /*
         * Mobile visual viewport.
         */
        if (
            window.visualViewport
        ) {

            window.visualViewport.addEventListener(
                "resize",
                handleViewportChange,
                {
                    passive:
                        true
                }
            );


            window.visualViewport.addEventListener(
                "scroll",
                handleViewportChange,
                {
                    passive:
                        true
                }
            );
        }


        /*
         * Modal / DOM replacement observer.
         */
        if (
            window.MutationObserver &&
            document.body
        ) {

            mutationObserver =
                new MutationObserver(
                    handleDomMutation
                );


            mutationObserver.observe(
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
       VIEWPORT HANDLER
    ===================================================== */

    function handleViewportChange() {

        if (
            isVisible()
        ) {

            requestPosition();
        }
    }


    /* =====================================================
       DOM MUTATION HANDLER
    ===================================================== */

    function handleDomMutation() {

        const input =
            getInput();


        const box =
            getBox();


        const inputChanged =
            input !==
            lastInputElement;


        const boxChanged =
            box !==
            lastBoxElement;


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


        /*
         * Modal sering mengganti element form.
         * Kalau target berubah, langsung refresh posisi.
         */
        if (
            inputChanged ||
            boxChanged
        ) {

            if (
                isVisible()
            ) {

                requestPosition();
            }
        }
    }


    /* =====================================================
       UNBIND POSITION EVENTS
    ===================================================== */

    function unbindPositionEvents() {

        if (
            !positionEventsBound
        ) {

            return true;
        }


        window.removeEventListener(
            "resize",
            handleViewportChange,
            {
                passive:
                    true
            }
        );


        window.removeEventListener(
            "scroll",
            handleViewportChange,
            {
                passive:
                    true,
                capture:
                    true
            }
        );


        if (
            window.visualViewport
        ) {

            window.visualViewport.removeEventListener(
                "resize",
                handleViewportChange,
                {
                    passive:
                        true
                }
            );


            window.visualViewport.removeEventListener(
                "scroll",
                handleViewportChange,
                {
                    passive:
                        true
                }
            );
        }


        if (
            mutationObserver
        ) {

            mutationObserver.disconnect();

            mutationObserver =
                null;
        }


        cancelPositionFrame();


        positionEventsBound =
            false;


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
                positionEventsBound,

            initialized:
                initialized
        };
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        if (
            initialized
        ) {

            /*
             * Pastikan listener tetap tersedia
             * jika module pernah dihancurkan.
             */
            if (
                !positionEventsBound
            ) {

                bindPositionEvents();
            }


            getTargets();

            return true;
        }


        bindPositionEvents();

        getTargets();

        initialized =
            true;


        return true;
    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        hide();

        unbindPositionEvents();


        lastInputElement =
            null;


        lastBoxElement =
            null;


        initialized =
            false;


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


    /* =====================================================
       AUTO INITIALIZE
    ===================================================== */

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
