/* =========================================================
   GEN-Z.AI
   MODEL TABLE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-table.js

   Tanggung jawab:
   - Menyimpan data Models untuk tampilan tabel
   - Normalisasi data tabel
   - Render tabel
   - Render row
   - Render empty state
   - Format angka
   - Format status
   - Menyediakan lookup Model berdasarkan ID

   Tidak bertanggung jawab:
   - Search
   - Provider
   - Form Create/Edit
   - CRUD API
   - Price calculation
   - Event Listener
   - Delete confirmation
   - Edit action
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let models = [];


    /* =====================================================
       TABLE BODY
    ===================================================== */

    function getTableBody() {

        return (
            document.getElementById(
                "modelsTableBody"
            ) ||

            document.querySelector(
                "#modelsTable tbody"
            ) ||

            document.querySelector(
                "table tbody"
            )
        );

    }


    /* =====================================================
       HTML ESCAPE
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
       NORMALIZE MODEL
    ===================================================== */

    function normalizeModel(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return null;

        }


        return {

            id:
                String(
                    model.id ??
                    ""
                ).trim(),


            provider_id:
                String(
                    model.provider_id ??
                    model.provider ??
                    model.provider_code ??
                    ""
                ).trim(),


            provider_name:
                String(
                    model.provider_name ??
                    ""
                ).trim(),


            model_id:
                String(
                    model.model_id ??
                    ""
                ).trim(),


            model_name:
                String(
                    model.model_name ??
                    ""
                ).trim(),


            model_family:
                String(
                    model.model_family ??
                    ""
                ).trim(),


            status:
                String(
                    model.status ??
                    "active"
                ).trim(),


            credit_cost:
                model.credit_cost ??
                model.credit ??
                0,


            discount_percent:
                model.discount_percent ??
                0,


            credit_final:
                model.credit_final ??
                0,


            min_duration:
                model.min_duration ??
                "",


            max_duration:
                model.max_duration ??
                "",


            duration:
                model.duration ??
                "",


            supported_ratios:
                model.supported_ratios ??
                model.ratios ??
                "",


            supported_resolutions:
                model.supported_resolutions ??
                model.resolutions ??
                "",


            ratios:
                model.ratios ??
                model.supported_ratios ??
                "",


            resolutions:
                model.resolutions ??
                model.supported_resolutions ??
                ""

        };

    }


    /* =====================================================
       SET MODELS
    ===================================================== */

    function setModels(
        list
    ) {

        models =
            Array.isArray(list)

                ? list
                    .map(
                        normalizeModel
                    )
                    .filter(
                        Boolean
                    )

                : [];


        return getModels();

    }


    /* =====================================================
       GET MODELS
    ===================================================== */

    function getModels() {

        return models.slice();

    }


    /* =====================================================
       FORMAT NUMBER
    ===================================================== */

    function formatNumber(
        value
    ) {

        const number =
            Number(
                value
            );


        if (
            !Number.isFinite(
                number
            )
        ) {

            return "0";

        }


        return new Intl.NumberFormat(
            "id-ID"
        ).format(
            number
        );

    }


    /* =====================================================
       FORMAT STATUS
    ===================================================== */

    function formatStatus(
        status
    ) {

        const value =
            String(
                status ??
                "active"
            )
                .trim()
                .toLowerCase();


        let label;


        if (
            value ===
            "active"
        ) {

            label =
                "Aktif";

        } else if (
            value ===
            "inactive"
        ) {

            label =
                "Nonaktif";

        } else {

            label =
                status ||
                "-";

        }


        return (

            '<span class="status-badge status-' +

            escapeHtml(
                value
            ) +

            '">' +

            escapeHtml(
                label
            ) +

            "</span>"

        );

    }


    /* =====================================================
       FORMAT DISCOUNT
    ===================================================== */

    function formatDiscount(
        value
    ) {

        const discount =
            Number(
                value
            );


        if (
            !Number.isFinite(
                discount
            ) ||
            discount <= 0
        ) {

            return "-";

        }


        return (
            formatNumber(
                discount
            ) +
            "%"
        );

    }


    /* =====================================================
       FORMAT DURATION
    ===================================================== */

    function formatDuration(
        model
    ) {

        const min =
            model.min_duration;

        const max =
            model.max_duration;


        if (
            min !== "" &&
            max !== ""
        ) {

            return (
                escapeHtml(
                    min
                ) +
                " - " +
                escapeHtml(
                    max
                )

            );

        }


        if (
            min !== ""
        ) {

            return escapeHtml(
                min
            );

        }


        if (
            max !== ""
        ) {

            return escapeHtml(
                max
            );

        }


        if (
            model.duration !==
            ""
        ) {

            return escapeHtml(
                model.duration
            );

        }


        return "-";

    }


    /* =====================================================
       RENDER ROW
    ===================================================== */

    function renderRow(
        model
    ) {

        const normalized =
            normalizeModel(
                model
            );


        if (
            !normalized
        ) {

            return "";

        }


        const provider =
            normalized.provider_name ||
            normalized.provider_id ||
            "-";


        const modelId =
            normalized.model_id ||
            "-";


        const modelName =
            normalized.model_name ||
            "-";


        const family =
            normalized.model_family ||
            "-";


        const finalCredit =
            formatNumber(
                normalized.credit_final
            );


        const discount =
            formatDiscount(
                normalized.discount_percent
            );


        const duration =
            formatDuration(
                normalized
            );


        const id =
            normalized.id;


        return (

            "<tr" +

            ' data-model-id="' +

            escapeHtml(
                id
            ) +

            '">' +


            /* Model ID */
            "<td>" +

            "<strong>" +

            escapeHtml(
                modelId
            ) +

            "</strong>" +

            "</td>" +


            /* Model Name */
            "<td>" +

            escapeHtml(
                modelName
            ) +

            "</td>" +


            /* Family */
            "<td>" +

            escapeHtml(
                family
            ) +

            "</td>" +


            /* Provider */
            "<td>" +

            escapeHtml(
                provider
            ) +

            "</td>" +


            /* Credit */
            "<td>" +

            escapeHtml(
                finalCredit
            ) +

            "</td>" +


            /* Discount */
            "<td>" +

            escapeHtml(
                discount
            ) +

            "</td>" +


            /* Duration */
            "<td>" +

            duration +

            "</td>" +


            /* Status */
            "<td>" +

            formatStatus(
                normalized.status
            ) +

            "</td>" +


            /* Actions */
            "<td>" +

            '<div class="table-actions">' +

            '<button' +

            ' type="button"' +

            ' class="btn btn-sm btn-edit-model"' +

            ' data-action="edit"' +

            ' data-model-id="' +

            escapeHtml(
                id
            ) +

            '">' +

            "Edit" +

            "</button>" +


            '<button' +

            ' type="button"' +

            ' class="btn btn-sm btn-danger btn-delete-model"' +

            ' data-action="delete"' +

            ' data-model-id="' +

            escapeHtml(
                id
            ) +

            '">' +

            "Hapus" +

            "</button>" +


            "</div>" +

            "</td>" +


            "</tr>"

        );

    }


    /* =====================================================
       EMPTY STATE
    ===================================================== */

    function renderEmpty() {

        const body =
            getTableBody();


        if (
            !body
        ) {

            return false;

        }


        body.innerHTML =

            '<tr class="models-empty-row">' +

            '<td colspan="9">' +

            "Belum ada Model." +

            "</td>" +

            "</tr>";


        return true;

    }


    /* =====================================================
       RENDER TABLE
    ===================================================== */

    function render(
        list
    ) {

        const body =
            getTableBody();


        if (
            !body
        ) {

            return false;

        }


        if (
            Array.isArray(
                list
            )
        ) {

            setModels(
                list
            );

        }


        if (
            !models.length
        ) {

            return renderEmpty();

        }


        body.innerHTML =
            models
                .map(
                    renderRow
                )
                .join("");


        return true;

    }


    /* =====================================================
       FIND MODEL
    ===================================================== */

    function findById(
        id
    ) {

        const value =
            String(
                id ?? ""
            ).trim();


        if (
            !value
        ) {

            return null;

        }


        return (

            models.find(
                function (
                    model
                ) {

                    return (
                        model.id ===
                        value
                    );

                }
            ) ||

            null

        );

    }


    /* =====================================================
       REMOVE FROM LOCAL TABLE STATE
       -----------------------------------------------------
       Ini bukan DELETE API.
       Hanya menghapus data dari state tabel.
       ===================================================== */

    function removeById(
        id
    ) {

        const value =
            String(
                id ?? ""
            ).trim();


        if (
            !value
        ) {

            return false;

        }


        const previousLength =
            models.length;


        models =
            models.filter(
                function (
                    model
                ) {

                    return (
                        model.id !==
                        value
                    );

                }
            );


        if (
            models.length !==
            previousLength
        ) {

            render();

            return true;

        }


        return false;

    }


    /* =====================================================
       UPDATE LOCAL TABLE STATE
       -----------------------------------------------------
       Ini bukan UPDATE API.
       Hanya memperbarui state/render tabel.
       ===================================================== */

    function updateModel(
        model
    ) {

        const normalized =
            normalizeModel(
                model
            );


        if (
            !normalized ||
            !normalized.id
        ) {

            return false;

        }


        const index =
            models.findIndex(
                function (
                    item
                ) {

                    return (
                        item.id ===
                        normalized.id
                    );

                }
            );


        if (
            index < 0
        ) {

            models.push(
                normalized
            );

        } else {

            models[index] =
                normalized;

        }


        render();

        return true;

    }


    /* =====================================================
       CLEAR
    ===================================================== */

    function clear() {

        models = [];

        return renderEmpty();

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        const data =
            window.GENZModelsData;


        if (
            data &&
            typeof data.getCachedModels ===
                "function"
        ) {

            const cached =
                data.getCachedModels();


            if (
                Array.isArray(
                    cached
                )
            ) {

                setModels(
                    cached
                );

                render();

            }

        }


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelTable =
        Object.freeze({

            initialize,

            setModels,

            getModels,

            render,

            renderRow,

            findById,

            removeById,

            updateModel,

            clear,

            escapeHtml,

            formatNumber,

            formatStatus,

            formatDiscount,

            formatDuration

        });


})();
