/* =========================================================
   GEN-Z.AI
   MODEL SEARCH RENDER
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-search-render.js

   Tanggung jawab:
   - Render hasil pencarian Model
   - Menampilkan Model ID dari catalog
   - Menampilkan nama, family, provider jika tersedia
   - Menjaga data tetap berasal dari source of truth

   Tidak bertanggung jawab:
   - Query database
   - Provider selection
   - Model selection
   - Event handling
   - CRUD
   - Membuat Model ID baru
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONSTANTS
    ===================================================== */

    const RESULT_BOX_IDS = [
        "modelSearchResults",
        "modelResults",
        "modelDropdown"
    ];


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       STRING
    ===================================================== */

    function cleanString(value) {

        return String(value ?? "").trim();
    }


    function normalizeString(value) {

        return cleanString(value).toLowerCase();
    }


    /* =====================================================
       GET RESULT BOX
    ===================================================== */

    function getBox() {

        for (const id of RESULT_BOX_IDS) {

            const element =
                document.getElementById(id);

            if (element) {

                return element;
            }
        }

        return null;
    }


    /* =====================================================
       DROPDOWN MODULE
    ===================================================== */

    function getDropdown() {

        return (
            window.GENZModelSearchDropdown ||
            null
        );
    }


    function showDropdown() {

        const dropdown =
            getDropdown();

        if (
            dropdown &&
            typeof dropdown.show === "function"
        ) {

            try {

                return dropdown.show() !== false;

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal menampilkan Model dropdown:",
                    error
                );
            }
        }

        return false;
    }


    function hideDropdown() {

        const dropdown =
            getDropdown();

        if (
            dropdown &&
            typeof dropdown.hide === "function"
        ) {

            try {

                return dropdown.hide() !== false;

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal menyembunyikan Model dropdown:",
                    error
                );
            }
        }

        return false;
    }


    /* =====================================================
       MODEL DATA
    ===================================================== */

    function getModelId(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";
        }

        return cleanString(
            model.model_id ??
            model.modelId
        );
    }


    function getModelName(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";
        }

        return cleanString(
            model.model_name ??
            model.modelName ??
            model.name
        );
    }


    function getModelFamily(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";
        }

        return cleanString(
            model.model_family ??
            model.modelFamily ??
            model.family
        );
    }


    function getProviderName(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";
        }

        return cleanString(
            model.provider_name ??
            model.providerName ??
            model.provider_id ??
            model.provider
        );
    }


    function getStatus(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";
        }

        return cleanString(
            model.status
        );
    }


    /* =====================================================
       VALID MODEL
    ===================================================== */

    function isValidModel(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return false;
        }

        return Boolean(
            getModelId(model)
        );
    }


    /* =====================================================
       STATUS
    ===================================================== */

    function isModelSelectable(model) {

        const status =
            normalizeString(
                getStatus(model)
            );

        /*
         * Catalog dari models-search biasanya
         * sudah difilter active.
         *
         * Jika status tidak tersedia, record
         * tetap dianggap selectable.
         */
        if (!status) {

            return true;
        }

        return (
            status === "active" ||
            status === "enabled" ||
            status === "published"
        );
    }


    /* =====================================================
       BUILD META
    ===================================================== */

    function buildMeta(model) {

        const parts = [];

        const family =
            getModelFamily(model);

        const provider =
            getProviderName(model);

        if (family) {

            parts.push(
                family
            );
        }

        if (provider) {

            parts.push(
                provider
            );
        }

        return parts
            .map(escapeHtml)
            .join(" · ");
    }


    /* =====================================================
       BUILD MODEL ITEM
    ===================================================== */

    function buildItem(model) {

        if (
            !isValidModel(model)
        ) {

            return "";
        }

        if (
            !isModelSelectable(model)
        ) {

            return "";
        }

        const modelId =
            getModelId(model);

        const modelName =
            getModelName(model);

        const meta =
            buildMeta(model);


        return (
            '<div' +
                ' class="model-search-item"' +
                ' role="option"' +
                ' tabindex="-1"' +
                ' data-model-id="' +
                    escapeHtml(modelId) +
                '"' +
            '>' +

                '<div class="model-search-item-main">' +

                    '<strong class="model-search-item-id">' +
                        escapeHtml(modelId) +
                    '</strong>' +

                    (
                        modelName
                            ? (
                                '<span class="model-search-item-name">' +
                                    escapeHtml(modelName) +
                                '</span>'
                            )
                            : ""
                    ) +

                '</div>' +

                (
                    meta
                        ? (
                            '<div class="model-search-item-meta">' +
                                meta +
                            '</div>'
                        )
                        : ""
                ) +

            '</div>'
        );
    }


    /* =====================================================
       RENDER EMPTY
    ===================================================== */

    function renderEmpty(
        message = "Model tidak ditemukan."
    ) {

        const box =
            getBox();

        if (!box) {

            console.warn(
                "[GEN-Z.AI] Model search result box tidak ditemukan."
            );

            return false;
        }


        box.innerHTML =
            '<div class="model-search-empty" role="status">' +
                escapeHtml(message) +
            '</div>';


        showDropdown();


        return true;
    }


    /* =====================================================
       DEDUPLICATE
    ===================================================== */

    function uniqueModels(
        models
    ) {

        const seen =
            new Set();

        const result = [];

        models.forEach(
            function (model) {

                if (
                    !isValidModel(model)
                ) {

                    return;
                }

                const modelId =
                    normalizeString(
                        getModelId(model)
                    );

                if (!modelId) {

                    return;
                }

                if (
                    seen.has(modelId)
                ) {

                    return;
                }

                seen.add(modelId);

                result.push(model);
            }
        );

        return result;
    }


    /* =====================================================
       RENDER
    ===================================================== */

    function render(
        results = []
    ) {

        const box =
            getBox();

        if (!box) {

            console.warn(
                "[GEN-Z.AI] #modelSearchResults tidak ditemukan."
            );

            return false;
        }


        if (
            !Array.isArray(results)
        ) {

            return renderEmpty();
        }


        /*
         * Renderer tidak pernah membuat
         * Model ID sendiri.
         */
        const validResults =
            uniqueModels(results)
                .filter(
                    isModelSelectable
                );


        if (
            validResults.length === 0
        ) {

            return renderEmpty(
                "Model tidak ditemukan."
            );
        }


        const html =
            validResults
                .map(buildItem)
                .filter(Boolean)
                .join("");


        if (!html) {

            return renderEmpty(
                "Model tidak ditemukan."
            );
        }


        box.innerHTML =
            html;


        /*
         * Accessibility.
         */
        box.setAttribute(
            "role",
            "listbox"
        );


        /*
         * Pastikan dropdown benar-benar dibuka
         * setelah HTML hasil pencarian tersedia.
         */
        showDropdown();


        /*
         * Reposition setelah render.
         *
         * Penting karena isi dropdown dapat mengubah
         * ukuran element.
         */
        const dropdown =
            getDropdown();

        if (
            dropdown &&
            typeof dropdown.refresh === "function"
        ) {

            try {

                dropdown.refresh();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Refresh posisi dropdown gagal:",
                    error
                );
            }
        }


        return true;
    }


    /* =====================================================
       CLEAR
    ===================================================== */

    function clear() {

        const box =
            getBox();

        if (box) {

            box.innerHTML = "";
        }

        hideDropdown();

        return true;
    }


    /* =====================================================
       GET RENDERED MODEL IDS
    ===================================================== */

    function getRenderedModelIds() {

        const box =
            getBox();

        if (!box) {

            return [];
        }


        return Array.from(
            box.querySelectorAll(
                ".model-search-item[data-model-id]"
            )
        )
            .map(
                function (element) {

                    return cleanString(
                        element.dataset.modelId
                    );
                }
            )
            .filter(Boolean);
    }


    /* =====================================================
       GET RENDERED ITEMS
    ===================================================== */

    function getRenderedItems() {

        const box =
            getBox();

        if (!box) {

            return [];
        }


        return Array.from(
            box.querySelectorAll(
                ".model-search-item[data-model-id]"
            )
        );
    }


    /* =====================================================
       FIND RENDERED ITEM
    ===================================================== */

    function findRenderedItem(
        modelId
    ) {

        const id =
            normalizeString(
                modelId
            );

        if (!id) {

            return null;
        }


        const items =
            getRenderedItems();


        return (
            items.find(
                function (item) {

                    return (
                        normalizeString(
                            item.dataset.modelId
                        ) === id
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       SET ACTIVE ITEM
    ===================================================== */

    function setActive(
        modelId
    ) {

        const items =
            getRenderedItems();


        items.forEach(
            function (item) {

                item.classList.remove(
                    "active"
                );

                item.setAttribute(
                    "aria-selected",
                    "false"
                );
            }
        );


        const item =
            findRenderedItem(
                modelId
            );


        if (!item) {

            return false;
        }


        item.classList.add(
            "active"
        );

        item.setAttribute(
            "aria-selected",
            "true"
        );


        try {

            item.scrollIntoView({
                block:
                    "nearest"
            });

        } catch (
            error
        ) {

            /*
             * Browser lama tidak menjadi alasan
             * seluruh UI ikut mogok.
             */
        }


        return true;
    }


    /* =====================================================
       CLEAR ACTIVE
    ===================================================== */

    function clearActive() {

        const items =
            getRenderedItems();


        items.forEach(
            function (item) {

                item.classList.remove(
                    "active"
                );

                item.setAttribute(
                    "aria-selected",
                    "false"
                );
            }
        );


        return true;
    }


    /* =====================================================
       GET ACTIVE ITEM
    ===================================================== */

    function getActiveItem() {

        const box =
            getBox();

        if (!box) {

            return null;
        }


        return (
            box.querySelector(
                ".model-search-item.active"
            ) ||
            null
        );
    }


    /* =====================================================
       GET ACTIVE MODEL ID
    ===================================================== */

    function getActiveModelId() {

        const item =
            getActiveItem();


        if (!item) {

            return "";
        }


        return cleanString(
            item.dataset.modelId
        );
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelSearchRender =
        Object.freeze({

            render,

            clear,

            escapeHtml,

            isValidModel,

            isModelSelectable,

            getRenderedModelIds,

            getRenderedItems,

            findRenderedItem,

            setActive,

            clearActive,

            getActiveItem,

            getActiveModelId

        });


    console.info(
        "[GEN-Z.AI] GENZModelSearchRender loaded."
    );

})();
