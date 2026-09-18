/* =========================================================
   GEN-Z.AI
   MODEL SEARCH EVENTS
   ---------------------------------------------------------
   Tanggung jawab:
   - Bind input
   - Focus
   - Keyboard
   - Click hasil
   - Provider changed
   - Click outside
   ---------------------------------------------------------
   Event handler tidak melakukan business logic sendiri.
   Semua dipanggil dari models-search.js
   ========================================================= */

(function () {
    "use strict";

    let bound = false;
    let handlers = null;

    function getInput() {
        return (
            document.getElementById("modelCodeSearch") ||
            document.getElementById("modelSearch") ||
            document.getElementById("modelIdSearch")
        );
    }

    function getResultsBox() {
        return (
            document.getElementById("modelSearchResults") ||
            document.getElementById("modelResults") ||
            document.getElementById("modelDropdown")
        );
    }

    function bind(api) {

        if (bound) {
            return true;
        }

        const input =
            getInput();

        const resultsBox =
            getResultsBox();

        if (!input) {
            return false;
        }

        handlers = api;

        input.addEventListener(
            "input",
            api.onInput
        );

        input.addEventListener(
            "focus",
            api.onFocus
        );

        input.addEventListener(
            "keydown",
            api.onKeydown
        );

        if (resultsBox) {
            resultsBox.addEventListener(
                "click",
                api.onResultsClick
            );
        }

        document.addEventListener(
            "genz-models-provider-changed",
            api.onProviderChanged
        );

        document.addEventListener(
            "click",
            api.onDocumentClick
        );

        window.GENZModelSearchDropdown
            .bindPositionEvents();

        bound = true;

        return true;
    }

    function unbind() {

        if (
            !bound ||
            !handlers
        ) {
            return;
        }

        const input =
            getInput();

        const resultsBox =
            getResultsBox();

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

        if (resultsBox) {

            resultsBox.removeEventListener(
                "click",
                handlers.onResultsClick
            );
        }

        document.removeEventListener(
            "genz-models-provider-changed",
            handlers.onProviderChanged
        );

        document.removeEventListener(
            "click",
            handlers.onDocumentClick
        );

        handlers = null;
        bound = false;
    }

    window.GENZModelSearchEvents =
        Object.freeze({
            bind,
            unbind
        });

})();
