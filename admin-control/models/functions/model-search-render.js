/* =========================================================
   GEN-Z.AI
   MODEL SEARCH RENDER
   ---------------------------------------------------------
   Tanggung jawab:
   - Membuat HTML hasil pencarian Model
   - Menampilkan data Model yang berasal dari KIE/Supabase

   TIDAK mengurus:
   - Query
   - Provider
   - Selection
   - Event
   - CRUD

   ATURAN:
   - Tidak membuat Model ID manual
   - Tidak mengubah Model ID
   - Tidak membuat data Model baru
   - Tidak menambahkan fallback Model ID
   - Hanya merender hasil yang diberikan search module
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    /* =====================================================
       GET RESULT BOX
    ===================================================== */

    function getBox() {

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
       SHOW DROPDOWN
    ===================================================== */

    function showDropdown() {

        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.show ===
                "function"
        ) {

            try {

                dropdown.show();

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Model search dropdown show error:",
                    error
                );

            }

        }

    }


    /* =====================================================
       HIDE DROPDOWN
    ===================================================== */

    function hideDropdown() {

        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.hide ===
                "function"
        ) {

            try {

                dropdown.hide();

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Model search dropdown hide error:",
                    error
                );

            }

        }

    }


    /* =====================================================
       NORMALIZE MODEL ID
       
       Hanya membaca data.
       Tidak membuat fallback dari nama/provider.
    ===================================================== */

    function getModelId(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";

        }


        return String(
            model.model_id ??
            model.modelId ??
            ""
        ).trim();

    }


    /* =====================================================
       NORMALIZE MODEL NAME
    ===================================================== */

    function getModelName(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";

        }


        return String(
            model.model_name ??
            model.modelName ??
            ""
        ).trim();

    }


    /* =====================================================
       NORMALIZE MODEL FAMILY
    ===================================================== */

    function getModelFamily(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";

        }


        return String(
            model.model_family ??
            model.modelFamily ??
            ""
        ).trim();

    }


    /* =====================================================
       NORMALIZE PROVIDER
    ===================================================== */

    function getProvider(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";

        }


        return String(
            model.provider_name ??
            model.provider_id ??
            model.provider ??
            ""
        ).trim();

    }


    /* =====================================================
       VALID RESULT
       
       Hanya Model yang mempunyai Model ID valid
       boleh ditampilkan.
       
       Tidak ada "manual model".
    ===================================================== */

    function isValidModel(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return false;

        }


        const modelId =
            getModelId(
                model
            );


        return !!modelId;

    }


    /* =====================================================
       BUILD MODEL ITEM
    ===================================================== */

    function buildItem(
        model
    ) {

        if (
            !isValidModel(
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


        const family =
            getModelFamily(
                model
            );


        const provider =
            getProvider(
                model
            );


        /*
         * Hanya data dari model.
         * Tidak ada data buatan.
         */

        let meta = "";


        if (
            family
        ) {

            meta +=
                escapeHtml(
                    family
                );

        }


        if (
            provider
        ) {

            if (
                meta
            ) {

                meta +=
                    " · ";

            }


            meta +=
                escapeHtml(
                    provider
                );

        }


        return (
            '<div class="model-search-item"' +
            ' role="option"' +
            ' tabindex="-1"' +
            ' data-model-id="' +
            escapeHtml(
                modelId
            ) +
            '">' +

                '<div class="model-search-item-main">' +

                    "<strong>" +
                    escapeHtml(
                        modelId
                    ) +
                    "</strong>" +

                    (
                        modelName
                            ? (
                                "<span>" +
                                escapeHtml(
                                    modelName
                                ) +
                                "</span>"
                            )
                            : ""
                    ) +

                "</div>" +

                (
                    meta
                        ? (
                            '<div class="model-search-item-meta">' +
                            meta +
                            "</div>"
                        )
                        : ""
                ) +

            "</div>"
        );

    }


    /* =====================================================
       RENDER EMPTY
    ===================================================== */

    function renderEmpty(
        message
    ) {

        const box =
            getBox();


        if (
            !box
        ) {

            return false;

        }


        const text =
            String(
                message ||
                "Model tidak ditemukan."
            );


        box.innerHTML =
            '<div class="model-search-empty">' +
            escapeHtml(
                text
            ) +
            "</div>";


        showDropdown();


        return true;

    }


    /* =====================================================
       RENDER
    ===================================================== */

    function render(
        results
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


        /*
         * Pastikan input search tidak bisa
         * menghasilkan model manual.
         */

        if (
            !Array.isArray(
                results
            )
        ) {

            return renderEmpty(
                "Model tidak ditemukan."
            );

        }


        /*
         * Filter hanya record yang mempunyai
         * Model ID dari sumber data.
         *
         * Tidak ada pembuatan Model ID baru.
         */

        const validResults =
            results.filter(
                isValidModel
            );


        if (
            validResults.length === 0
        ) {

            return renderEmpty(
                "Model tidak ditemukan."
            );

        }


        /*
         * Hilangkan duplicate Model ID.
         *
         * Tidak mengubah record.
         */

        const seen =
            new Set();


        const uniqueResults =
            validResults.filter(
                function (
                    model
                ) {

                    const modelId =
                        getModelId(
                            model
                        )
                            .toLowerCase();


                    if (
                        seen.has(
                            modelId
                        )
                    ) {

                        return false;

                    }


                    seen.add(
                        modelId
                    );


                    return true;

                }
            );


        if (
            uniqueResults.length === 0
        ) {

            return renderEmpty(
                "Model tidak ditemukan."
            );

        }


        /*
         * Render.
         */

        box.innerHTML =
            uniqueResults
                .map(
                    buildItem
                )
                .filter(
                    Boolean
                )
                .join("");


        /*
         * Jika karena alasan tertentu
         * semua item gagal dibuat.
         */

        if (
            !box.innerHTML.trim()
        ) {

            return renderEmpty(
                "Model tidak ditemukan."
            );

        }


        showDropdown();


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
       GET RENDERED MODEL IDS
       
       Debug/helper saja.
       Tidak membuat data.
    ===================================================== */

    function getRenderedModelIds() {

        const box =
            getBox();


        if (
            !box
        ) {

            return [];

        }


        return Array.from(
            box.querySelectorAll(
                "[data-model-id]"
            )
        )
            .map(
                function (
                    element
                ) {

                    return String(
                        element.dataset.modelId ??
                        ""
                    ).trim();

                }
            )
            .filter(
                Boolean
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

            getRenderedModelIds

        });


    console.info(
        "[GEN-Z.AI] GENZModelSearchRender loaded."
    );

})();
