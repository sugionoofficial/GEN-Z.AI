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
   - Format duration
   - Format ratio
   - Format resolution
   - Menyediakan lookup Model berdasarkan ID

   TIDAK bertanggung jawab:
   - Search
   - Provider loading
   - Form Create/Edit
   - CRUD API
   - Price calculation
   - Event listener
   - Delete confirmation
   - Edit action
   - KIE pricing
   - kie_* table

   =========================================================
   URUTAN KOLOM WAJIB SAMA DENGAN models.html:

   1. Model
   2. Provider
   3. Credit
   4. Diskon
   5. Credit Final
   6. Duration
   7. Ratio
   8. Resolution
   9. Status
   10. Aksi
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
                "modelTableBody"
            ) ||

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

    function escapeHtml(value) {

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
       NORMALIZE ARRAY
    ===================================================== */

    function normalizeArray(value) {

        if (Array.isArray(value)) {

            return value
                .map(function (item) {

                    return String(
                        item ?? ""
                    ).trim();

                })
                .filter(Boolean);

        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return [];

        }


        if (typeof value === "string") {

            const text =
                value.trim();

            if (!text) {
                return [];
            }


            /*
             * Supabase dapat mengembalikan:
             *
             * ["9:16","16:9"]
             *
             * sebagai JSON string.
             */

            if (
                (
                    text.startsWith("[") &&
                    text.endsWith("]")
                ) ||
                (
                    text.startsWith("{") &&
                    text.endsWith("}")
                )
            ) {

                try {

                    const parsed =
                        JSON.parse(text);

                    if (
                        Array.isArray(
                            parsed
                        )
                    ) {

                        return normalizeArray(
                            parsed
                        );

                    }

                } catch {

                    /*
                     * Lanjutkan sebagai
                     * comma-separated value.
                     */

                }

            }


            return text
                .split(",")
                .map(function (item) {

                    return String(
                        item
                    ).trim();

                })
                .filter(Boolean);

        }


        if (
            typeof value === "object"
        ) {

            try {

                return Object.values(
                    value
                )
                    .map(function (item) {

                        return String(
                            item ?? ""
                        ).trim();

                    })
                    .filter(Boolean);

            } catch {

                return [];

            }

        }


        return [];

    }


    /* =====================================================
       NORMALIZE MODEL
       ===================================================== */

    function normalizeModel(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return null;

        }


        const provider =
            model.provider &&
            typeof model.provider === "object"

                ? model.provider

                : null;


        const providerId =
            String(
                model.provider_id ??
                provider?.id ??
                ""
            ).trim();


        const providerCode =
            String(
                provider?.provider_id ??
                model.provider_code ??
                model.providerId ??
                ""
            ).trim();


        const providerName =
            String(
                provider?.provider_name ??
                model.provider_name ??
                model.providerName ??
                model.provider ??
                providerCode ??
                providerId ??
                ""
            ).trim();


        const supportedRatios =
            normalizeArray(
                model.supported_ratios ??
                model.supportedRatios ??
                model.ratios
            );


        const supportedResolutions =
            normalizeArray(
                model.supported_resolutions ??
                model.supportedResolutions ??
                model.resolutions
            );


        return {

            /* Database row ID */

            id:
                String(
                    model.id ??
                    ""
                ).trim(),


            /* Provider */

            provider_id:
                providerId,

            provider_code:
                providerCode,

            provider_name:
                providerName,


            /* Model */

            model_id:
                String(
                    model.model_id ??
                    model.modelId ??
                    ""
                ).trim(),

            model_name:
                String(
                    model.model_name ??
                    model.modelName ??
                    model.name ??
                    ""
                ).trim(),

            model_family:
                String(
                    model.model_family ??
                    model.modelFamily ??
                    model.family ??
                    ""
                ).trim(),


            /* Description */

            description:
                String(
                    model.description ??
                    ""
                ).trim(),


            /* Credit */

            credit_cost:
                model.credit_cost ??
                model.credit ??
                0,

            discount_percent:
                model.discount_percent ??
                model.discountPercent ??
                0,

            credit_final:
                model.credit_final ??
                model.creditFinal ??
                0,


            /* Duration */

            min_duration:
                model.min_duration ??
                model.minDuration ??
                "",

            max_duration:
                model.max_duration ??
                model.maxDuration ??
                "",

            duration:
                model.duration ??
                "",


            /* Supported parameters */

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions,


            /* Status */

            status:
                String(
                    model.status ??
                    "active"
                ).trim(),


            /* Original data */

            original:
                model

        };

    }


    /* =====================================================
       SET MODELS
       ===================================================== */

    function setModels(list) {

        models =
            Array.isArray(list)

                ? list
                    .map(
                        normalizeModel
                    )
                    .filter(Boolean)

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

    function formatNumber(value) {

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
       FORMAT DECIMAL
       ===================================================== */

    function formatDecimal(
        value,
        maximumFractionDigits = 6
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

            return "-";

        }


        return new Intl.NumberFormat(
            "id-ID",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits
            }
        ).format(
            number
        );

    }


    /* =====================================================
       FORMAT DISCOUNT
       ===================================================== */

    function formatDiscount(value) {

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
            formatDecimal(
                discount,
                2
            ) +
            "%"
        );

    }


    /* =====================================================
       FORMAT DURATION
       ===================================================== */

    function formatDuration(model) {

        const min =
            model.min_duration;

        const max =
            model.max_duration;


        const hasMin =
            min !== "" &&
            min !== null &&
            min !== undefined;


        const hasMax =
            max !== "" &&
            max !== null &&
            max !== undefined;


        if (
            hasMin &&
            hasMax
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


        if (hasMin) {

            return escapeHtml(
                min
            );

        }


        if (hasMax) {

            return escapeHtml(
                max
            );

        }


        if (
            model.duration !== "" &&
            model.duration !== null &&
            model.duration !== undefined
        ) {

            return escapeHtml(
                model.duration
            );

        }


        return "-";

    }


    /* =====================================================
       FORMAT ARRAY
       ===================================================== */

    function formatArray(value) {

        const items =
            normalizeArray(
                value
            );


        if (!items.length) {

            return "-";

        }


        return escapeHtml(
            items.join(
                ", "
            )
        );

    }


    /* =====================================================
       FORMAT RATIO
       ===================================================== */

    function formatRatio(model) {

        return formatArray(
            model.supported_ratios
        );

    }


    /* =====================================================
       FORMAT RESOLUTION
       ===================================================== */

    function formatResolution(model) {

        return formatArray(
            model.supported_resolutions
        );

    }


    /* =====================================================
       FORMAT STATUS
       ===================================================== */

    function formatStatus(status) {

        const value =
            String(
                status ??
                "active"
            )
                .trim()
                .toLowerCase();


        let label =
            status ||
            "-";


        let className =
            "status-inactive";


        if (
            value === "active"
        ) {

            label = "Active";
            className = "status-active";

        } else if (
            value === "inactive"
        ) {

            label = "Inactive";
            className = "status-inactive";

        } else if (
            value === "maintenance"
        ) {

            label = "Maintenance";
            className = "status-maintenance";

        }


        return (

            '<span class="status ' +
            className +
            '">' +

                escapeHtml(
                    label
                ) +

            "</span>"

        );

    }


    /* =====================================================
       RENDER MODEL CELL
       ===================================================== */

    function renderModelCell(model) {

        const modelId =
            model.model_id ||
            "-";


        const modelName =
            model.model_name ||
            "-";


        const family =
            model.model_family ||
            "";


        return (

            '<div class="model-name">' +

                escapeHtml(
                    modelName
                ) +

            "</div>" +

            '<div class="model-id">' +

                escapeHtml(
                    modelId
                ) +

            "</div>" +

            (
                family

                    ? (

                        '<div class="model-id">' +

                            escapeHtml(
                                family
                            ) +

                        "</div>"

                    )

                    : ""
            )

        );

    }


    /* =====================================================
       RENDER PROVIDER CELL
       ===================================================== */

    function renderProviderCell(model) {

        const providerName =
            model.provider_name ||
            model.provider_code ||
            model.provider_id ||
            "-";


        return (

            '<span class="provider">' +

                escapeHtml(
                    providerName
                ) +

            "</span>"

        );

    }


    /* =====================================================
       RENDER ROW
       -----------------------------------------------------
       10 kolom:
       1 Model
       2 Provider
       3 Credit
       4 Diskon
       5 Credit Final
       6 Duration
       7 Ratio
       8 Resolution
       9 Status
       10 Aksi
       ===================================================== */

    function renderRow(model) {

        const normalized =
            normalizeModel(
                model
            );


        if (
            !normalized
        ) {

            return "";

        }


        const id =
            normalized.id;


        const credit =
            formatNumber(
                normalized.credit_cost
            );


        const discount =
            formatDiscount(
                normalized.discount_percent
            );


        const finalCredit =
            formatNumber(
                normalized.credit_final
            );


        const duration =
            formatDuration(
                normalized
            );


        const ratio =
            formatRatio(
                normalized
            );


        const resolution =
            formatResolution(
                normalized
            );


        return (

            "<tr" +

            ' data-model-id="' +

                escapeHtml(
                    id
                ) +

            '">' +


            /* =============================================
               1. MODEL
               ============================================= */

            "<td>" +

                renderModelCell(
                    normalized
                ) +

            "</td>" +


            /* =============================================
               2. PROVIDER
               ============================================= */

            "<td>" +

                renderProviderCell(
                    normalized
                ) +

            "</td>" +


            /* =============================================
               3. CREDIT
               ============================================= */

            '<td class="credit-normal">' +

                escapeHtml(
                    credit
                ) +

            "</td>" +


            /* =============================================
               4. DISKON
               ============================================= */

            '<td class="discount">' +

                escapeHtml(
                    discount
                ) +

            "</td>" +


            /* =============================================
               5. CREDIT FINAL
               ============================================= */

            '<td class="credit-final">' +

                escapeHtml(
                    finalCredit
                ) +

            "</td>" +


            /* =============================================
               6. DURATION
               ============================================= */

            "<td>" +

                duration +

            "</td>" +


            /* =============================================
               7. RATIO
               ============================================= */

            "<td>" +

                ratio +

            "</td>" +


            /* =============================================
               8. RESOLUTION
               ============================================= */

            "<td>" +

                resolution +

            "</td>" +


            /* =============================================
               9. STATUS
               ============================================= */

            "<td>" +

                formatStatus(
                    normalized.status
                ) +

            "</td>" +


            /* =============================================
               10. AKSI
               ============================================= */

            "<td>" +

                '<div class="actions">' +

                    '<button' +

                        ' type="button"' +

                        ' class="btn btn-secondary btn-small btn-edit-model"' +

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

                        ' class="btn btn-danger btn-small btn-delete-model"' +

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

                '<td colspan="10" class="empty">' +

                    "Belum ada Model." +

                "</td>" +

            "</tr>";


        return true;

    }


    /* =====================================================
       RENDER TABLE
       ===================================================== */

    function render(list) {

        const body =
            getTableBody();


        if (
            !body
        ) {

            console.warn(
                "[model-table] #modelTableBody tidak ditemukan."
            );

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
                .join(
                    ""
                );


        return true;

    }


    /* =====================================================
       FIND MODEL BY DATABASE ID
       ===================================================== */

    function findById(id) {

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
                function (model) {

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
       FIND MODEL BY MODEL ID
       ===================================================== */

    function findByModelId(modelId) {

        const value =
            String(
                modelId ?? ""
            ).trim();


        if (
            !value
        ) {

            return null;

        }


        return (

            models.find(
                function (model) {

                    return (
                        model.model_id ===
                        value
                    );

                }
            ) ||

            null

        );

    }


    /* =====================================================
       REMOVE LOCAL MODEL
       -----------------------------------------------------
       BUKAN DELETE API.
       ===================================================== */

    function removeById(id) {

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
                function (model) {

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
       UPDATE LOCAL MODEL
       -----------------------------------------------------
       BUKAN UPDATE API.
       ===================================================== */

    function updateModel(model) {

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
                function (item) {

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

            findByModelId,

            removeById,

            updateModel,

            clear,

            escapeHtml,

            normalizeArray,

            normalizeModel,

            formatNumber,

            formatDecimal,

            formatDiscount,

            formatDuration,

            formatRatio,

            formatResolution,

            formatStatus,

            renderModelCell,

            renderProviderCell

        });


    console.info(
        "[GEN-Z.AI] GENZModelTable loaded. 10-column models renderer active."
    );


})();
