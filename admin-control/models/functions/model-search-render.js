/* =========================================================
   GEN-Z.AI
   MODEL SEARCH RENDER
   ---------------------------------------------------------
   Tanggung jawab:
   - Membuat HTML hasil pencarian
   - Menampilkan hasil
   ---------------------------------------------------------
   Tidak mengurus:
   - Query
   - Provider
   - Selection
   - Event
   ========================================================= */

(function () {
    "use strict";

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getBox() {
        return (
            document.getElementById("modelSearchResults") ||
            document.getElementById("modelResults") ||
            document.getElementById("modelDropdown")
        );
    }

    function render(results) {
        const box = getBox();

        if (!box) {
            return;
        }

        if (
            !Array.isArray(results) ||
            results.length === 0
        ) {
            box.innerHTML =
                '<div class="model-search-empty">' +
                "Model tidak ditemukan." +
                "</div>";

            window.GENZModelSearchDropdown.show();

            return;
        }

        box.innerHTML = results
            .map(function (model) {

                const modelId =
                    String(
                        model.model_id ?? ""
                    ).trim();

                const modelName =
                    String(
                        model.model_name ?? ""
                    ).trim();

                const family =
                    String(
                        model.model_family ?? ""
                    ).trim();

                const provider =
                    String(
                        model.provider_name ??
                        model.provider_id ??
                        model.provider ??
                        ""
                    ).trim();

                const manual =
                    model.__manual === true;

                return (
                    '<div class="model-search-item' +
                    (manual ? " manual" : "") +
                    '" role="option" tabindex="-1"' +
                    ' data-model-id="' +
                    escapeHtml(modelId) +
                    '">' +

                    '<div class="model-search-item-main">' +

                    "<strong>" +
                    escapeHtml(modelId) +
                    "</strong>" +

                    (
                        modelName
                            ? "<span>" +
                              escapeHtml(modelName) +
                              "</span>"
                            : ""
                    ) +

                    "</div>" +

                    '<div class="model-search-item-meta">' +

                    (
                        family
                            ? escapeHtml(family)
                            : ""
                    ) +

                    (
                        provider
                            ? (
                                family
                                    ? " · "
                                    : ""
                              ) +
                              escapeHtml(provider)
                            : ""
                    ) +

                    (
                        manual
                            ? " · Gunakan Model ID ini"
                            : ""
                    ) +

                    "</div>" +

                    "</div>"
                );
            })
            .join("");

        window.GENZModelSearchDropdown.show();
    }

    window.GENZModelSearchRender =
        Object.freeze({
            render,
            escapeHtml
        });

})();
