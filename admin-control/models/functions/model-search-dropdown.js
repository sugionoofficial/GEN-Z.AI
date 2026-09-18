/* =========================================================
   GEN-Z.AI
   MODEL SEARCH DROPDOWN
   ---------------------------------------------------------
   Tanggung jawab:
   - Show
   - Hide
   - Position
   - Reposition
   ---------------------------------------------------------
   Tidak mengurus:
   - Search
   - Provider
   - Selection
   - Rendering
   ========================================================= */

(function () {
    "use strict";

    function getBox() {
        return (
            document.getElementById("modelSearchResults") ||
            document.getElementById("modelResults") ||
            document.getElementById("modelDropdown")
        );
    }

    function getInput() {
        return (
            document.getElementById("modelCodeSearch") ||
            document.getElementById("modelSearch") ||
            document.getElementById("modelIdSearch")
        );
    }

    function position() {
        const box = getBox();
        const input = getInput();

        if (!box || !input) {
            return false;
        }

        const rect = input.getBoundingClientRect();

        box.style.position = "fixed";
        box.style.left = rect.left + "px";
        box.style.top = (rect.bottom + 6) + "px";
        box.style.width = rect.width + "px";
        box.style.maxWidth = rect.width + "px";
        box.style.zIndex = "99999";

        return true;
    }

    function show() {
        const box = getBox();

        if (!box) {
            return;
        }

        position();

        box.style.display = "block";
        box.classList.add("show");
    }

    function hide() {
        const box = getBox();

        if (!box) {
            return;
        }

        box.style.display = "none";
        box.classList.remove("show");
    }

    function isVisible() {
        const box = getBox();

        return !!(
            box &&
            box.style.display !== "none" &&
            box.classList.contains("show")
        );
    }

    function bindPositionEvents() {
        if (window.__GENZModelSearchPositionBound) {
            return;
        }

        window.__GENZModelSearchPositionBound = true;

        window.addEventListener(
            "resize",
            function () {
                if (isVisible()) {
                    position();
                }
            }
        );

        window.addEventListener(
            "scroll",
            function () {
                if (isVisible()) {
                    position();
                }
            },
            true
        );
    }

    window.GENZModelSearchDropdown =
        Object.freeze({
            show,
            hide,
            position,
            isVisible,
            bindPositionEvents
        });

})();
