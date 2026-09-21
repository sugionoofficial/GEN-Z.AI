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
   - Menyediakan metadata hasil untuk module selection

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


    const RESULT_ITEM_SELECTOR =
        ".model-search-item[data-model-id]";


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

        return String(
            value ?? ""
        ).trim();
    }


    function normalizeString(value) {

        return cleanString(
            value
        ).toLowerCase();
    }


    /* =====================================================
       GET RESULT BOX
    ===================================================== */

    function getBox() {

        for (
            const id of RESULT_BOX_IDS
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
         * Fallback untuk markup yang menggunakan
         * attribute khusus.
         */
        return document.querySelector(
            "[data-model-search-results]"
        );
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
            typeof dropdown.show ===
                "function"
        ) {

            try {

                return (
                    dropdown.show() !==
                    false
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal menampilkan Model dropdown:",
                    error
                );
            }
        }


        /*
         * Fallback jika dropdown module belum
         * mempunyai method show().
         */
        const box =
            getBox();


        if (
            box
        ) {

            box.hidden =
                false;

            box.style.display =
                "";
        }


        return Boolean(
            box
        );
    }


    function hideDropdown() {

        const dropdown =
            getDropdown();


        if (
            dropdown &&
            typeof dropdown.hide ===
                "function"
        ) {

            try {

                return (
                    dropdown.hide() !==
                    false
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal menyembunyikan Model dropdown:",
                    error
                );
            }
        }


        const box =
            getBox();


        if (
            box
        ) {

            box.hidden =
                true;
        }


        return Boolean(
            box
        );
    }


    /* =====================================================
       MODEL DATA
    ===================================================== */

    function getModelId(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return "";
        }


        return cleanString(
            model.model_id ??
            model.modelId ??
            model.code ??
            model.model_code
        );
    }


    function getModelName(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return "";
        }


        return cleanString(
            model.model_name ??
            model.modelName ??
            model.name
        );
    }


    function getModelFamily(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return "";
        }


        return cleanString(
            model.model_family ??
            model.modelFamily ??
            model.family
        );
    }


    function getProviderName(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return "";
        }


        const nestedProvider =
            model.provider &&
            typeof model.provider ===
                "object"
                ? model.provider
                : null;


        return cleanString(
            model.provider_name ??
            model.providerName ??
            nestedProvider?.provider_name ??
            nestedProvider?.providerName ??
            nestedProvider?.name ??
            model.provider ??
            model.provider_id
        );
    }


    function getModelType(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return "";
        }


        return cleanString(
            model.model_type ??
            model.modelType ??
            model.type ??
            model.category
        );
    }


    function getStatus(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
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

    function isValidModel(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return false;
        }


        return Boolean(
            getModelId(
                model
            )
        );
    }


    /* =====================================================
       MODEL SELECTABLE
    ===================================================== */

    function isModelSelectable(
        model
    ) {

        const status =
            normalizeString(
                getStatus(
                    model
                )
            );


        /*
         * Jika catalog tidak memberikan status,
         * jangan menolak model secara otomatis.
         */
        if (
            !status
        ) {

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

    function buildMeta(
        model
    ) {

        const parts = [];


        const family =
            getModelFamily(
                model
            );


        const provider =
            getProviderName(
                model
            );


        const type =
            getModelType(
                model
            );


        if (
            family
        ) {

            parts.push(
                family
            );
        }


        if (
            provider
        ) {

            parts.push(
                provider
            );
        }


        if (
            type
        ) {

            parts.push(
                type
            );
        }


        return parts
            .map(
                escapeHtml
            )
            .join(
                " · "
            );
    }


    /* =====================================================
       DEDUPLICATE
    ===================================================== */

    function uniqueModels(
        models
    ) {

        if (
            !Array.isArray(
                models
            )
        ) {

            return [];
        }


        const seen =
            new Set();


        const result =
            [];


        models.forEach(
            function (
                model
            ) {

                if (
                    !isValidModel(
                        model
                    )
                ) {

                    return;
                }


                const modelId =
                    normalizeString(
                        getModelId(
                            model
                        )
                    );


                if (
                    !modelId
                ) {

                    return;
                }


                if (
                    seen.has(
                        modelId
                    )
                ) {

                    return;
                }


                seen.add(
                    modelId
                );


                result.push(
                    model
                );
            }
        );


        return result;
    }


    /* =====================================================
       BUILD MODEL ITEM
    ===================================================== */

    function buildItem(
        model,
        index
    ) {

        if (
            !isValidModel(
                model
            )
        ) {

            return "";
        }


        if (
            !isModelSelectable(
                model
            )
        ) {

            return "";
        }


        const modelId =
            getModelId(
                model
            );


        const modelName =
            getModelName(
                model
            );


        const meta =
            buildMeta(
                model
            );


        /*
         * data-model-id:
         * dipakai selection module.

         * data-model-index:
         * membantu debugging dan memungkinkan renderer
         * tetap tidak menyimpan object JSON di DOM.
         */
        return (
            '<div' +
                ' class="model-search-item"' +
                ' role="option"' +
                ' tabindex="-1"' +
                ' aria-selected="false"' +
                ' data-model-id="' +
                    escapeHtml(
                        modelId
                    ) +
                '"' +
                ' data-model-index="' +
                    String(
                        index
                    ) +
                '"' +
            '>' +

                '<div class="model-search-item-main">' +

                    '<strong class="model-search-item-id">' +
                        escapeHtml(
                            modelId
                        ) +
                    '</strong>' +

                    (
                        modelName
                            ? (
                                '<span class="model-search-item-name">' +
                                    escapeHtml(
                                        modelName
                                    ) +
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


        if (
            !box
        ) {

            console.warn(
                "[GEN-Z.AI] Model search result box tidak ditemukan."
            );

            return false;
        }


        box.innerHTML =
            '<div' +
                ' class="model-search-empty"' +
                ' role="status"' +
            '>' +
                escapeHtml(
                    message
                ) +
            '</div>';


        box.setAttribute(
            "role",
            "listbox"
        );


        showDropdown();


        return true;
    }


    /* =====================================================
       RENDER
    ===================================================== */

    function render(
        results = []
    ) {

        const box =
            getBox();


        if (
            !box
        ) {

            console.warn(
                "[GEN-Z.AI] #modelSearchResults tidak ditemukan."
            );

            return false;
        }


        if (
            !Array.isArray(
                results
            )
        ) {

            return renderEmpty();
        }


        const validResults =
            uniqueModels(
                results
            ).filter(
                isModelSelectable
            );


        if (
            validResults.length ===
            0
        ) {

            return renderEmpty(
                "Model tidak ditemukan."
            );
        }


        const html =
            validResults
                .map(
                    function (
                        model,
                        index
                    ) {

                        return buildItem(
                            model,
                            index
                        );
                    }
                )
                .filter(Boolean)
                .join("");


        if (
            !html
        ) {

            return renderEmpty(
                "Model tidak ditemukan."
            );
        }


        box.innerHTML =
            html;


        box.setAttribute(
            "role",
            "listbox"
        );


        box.setAttribute(
            "aria-label",
            "Hasil pencarian Model"
        );


        showDropdown();


        /*
         * Refresh posisi hanya jika method memang
         * tersedia. Renderer tidak bergantung pada
         * dropdown module.
         */
        const dropdown =
            getDropdown();


        if (
            dropdown &&
            typeof dropdown.refresh ===
                "function"
        ) {

            try {

                dropdown.refresh();

            } catch (
                error
            ) {

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


        if (
            box
        ) {

            box.innerHTML =
                "";
        }


        hideDropdown();


        return true;
    }


    /* =====================================================
       GET RENDERED ITEMS
    ===================================================== */

    function getRenderedItems() {

        const box =
            getBox();


        if (
            !box
        ) {

            return [];
        }


        return Array.from(
            box.querySelectorAll(
                RESULT_ITEM_SELECTOR
            )
        );
    }


    /* =====================================================
       GET RENDERED MODEL IDS
    ===================================================== */

    function getRenderedModelIds() {

        return getRenderedItems()
            .map(
                function (
                    element
                ) {

                    return cleanString(
                        element.dataset.modelId
                    );
                }
            )
            .filter(Boolean);
    }


    /* =====================================================
       FIND RENDERED ITEM
    ===================================================== */

    function findRenderedItem(
        modelId
    ) {

        const normalizedId =
            normalizeString(
                modelId
            );


        if (
            !normalizedId
        ) {

            return null;
        }


        return (
            getRenderedItems()
                .find(
                    function (
                        item
                    ) {

                        return (
                            normalizeString(
                                item.dataset.modelId
                            ) ===
                            normalizedId
                        );
                    }
                ) ||
            null
        );
    }


    /* =====================================================
       SET ACTIVE
    ===================================================== */

    function setActive(
        modelId
    ) {

        const items =
            getRenderedItems();


        items.forEach(
            function (
                item
            ) {

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


        if (
            !item
        ) {

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
             * Tidak fatal.
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
            function (
                item
            ) {

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


        if (
            !box
        ) {

            return null;
        }


        return (
            box.querySelector(
                RESULT_ITEM_SELECTOR +
                ".active"
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


        if (
            !item
        ) {

            return "";
        }


        return cleanString(
            item.dataset.modelId
        );
    }


    /* =====================================================
       GET ACTIVE INDEX
    ===================================================== */

    function getActiveIndex() {

        const item =
            getActiveItem();


        if (
            !item
        ) {

            return -1;
        }


        const index =
            Number(
                item.dataset.modelIndex
            );


        return Number.isInteger(
            index
        )
            ? index
            : -1;
    }


    /* =====================================================
       GET ITEM MODEL ID
    ===================================================== */

    function getItemModelId(
        item
    ) {

        if (
            !item
        ) {

            return "";
        }


        return cleanString(
            item.dataset.modelId
        );
    }


    /* =====================================================
       GET ITEM INDEX
    ===================================================== */

    function getItemIndex(
        item
    ) {

        if (
            !item
        ) {

            return -1;
        }


        const index =
            Number(
                item.dataset.modelIndex
            );


        return Number.isInteger(
            index
        )
            ? index
            : -1;
    }


    /* =====================================================
       GET NEXT ITEM
    ===================================================== */

    function getNextItem() {

        const items =
            getRenderedItems();


        if (
            items.length ===
            0
        ) {

            return null;
        }


        const active =
            getActiveItem();


        if (
            !active
        ) {

            return items[0] ||
                null;
        }


        const currentIndex =
            items.indexOf(
                active
            );


        if (
            currentIndex <
            0
        ) {

            return items[0] ||
                null;
        }


        return (
            items[
                Math.min(
                    currentIndex + 1,
                    items.length - 1
                )
            ] ||
            null
        );
    }


    /* =====================================================
       GET PREVIOUS ITEM
    ===================================================== */

    function getPreviousItem() {

        const items =
            getRenderedItems();


        if (
            items.length ===
            0
        ) {

            return null;
        }


        const active =
            getActiveItem();


        if (
            !active
        ) {

            return (
                items[
                    items.length - 1
                ] ||
                null
            );
        }


        const currentIndex =
            items.indexOf(
                active
            );


        if (
            currentIndex <
            0
        ) {

            return (
                items[
                    items.length - 1
                ] ||
                null
            );
        }


        return (
            items[
                Math.max(
                    currentIndex - 1,
                    0
                )
            ] ||
            null
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

            getRenderedItems,

            getRenderedModelIds,

            findRenderedItem,

            setActive,

            clearActive,

            getActiveItem,

            getActiveModelId,

            getActiveIndex,

            getItemModelId,

            getItemIndex,

            getNextItem,

            getPreviousItem

        });


    console.info(
        "[GEN-Z.AI] GENZModelSearchRender loaded."
    );

})();
