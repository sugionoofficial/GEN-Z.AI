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
   - Lookup Model berdasarkan database ID / model_id

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
   URUTAN KOLOM:

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

            return [
                ...new Set(
                    value
                        .map(
                            item =>
                                String(
                                    item ?? ""
                                ).trim()
                        )
                        .filter(Boolean)
                )
            ];

        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return [];

        }


        if (
            typeof value === "string"
        ) {

            const text =
                value.trim();


            if (!text) {
                return [];
            }


            /*
             * Supabase/Postgres array
             * dapat datang sebagai:
             *
             * ["9:16","16:9"]
             *
             * atau:
             *
             * {"9:16","16:9"}
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
                        JSON.parse(
                            text
                        );


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
                     * PostgreSQL array
                     * dapat menggunakan format
                     * {"9:16","16:9"} yang bukan
                     * JSON valid.
                     */
                }


                if (
                    text.startsWith("{") &&
                    text.endsWith("}")
                ) {

                    const inner =
                        text.slice(
                            1,
                            -1
                        );


                    return [
                        ...new Set(
                            inner
                                .split(",")
                                .map(
                                    item =>
                                        String(
                                            item
                                        )
                                            .trim()
                                            .replace(
                                                /^"(.*)"$/,
                                                "$1"
                                            )
                                )
                                .filter(Boolean)
                        )
                    ];

                }

            }


            return [
                ...new Set(
                    text
                        .split(",")
                        .map(
                            item =>
                                String(
                                    item
                                ).trim()
                        )
                        .filter(Boolean)
                )
            ];

        }


        if (
            typeof value === "object"
        ) {

            try {

                return [
                    ...new Set(
                        Object.values(
                            value
                        )
                            .map(
                                item =>
                                    String(
                                        item ??
                                            ""
                                    ).trim()
                            )
                            .filter(Boolean)
                    )
                ];

            } catch {

                return [];

            }

        }


        return [];

    }


    /* =====================================================
       NUMBER
       ===================================================== */

    function normalizeNumber(
        value,
        fallback = 0
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return fallback;

        }


        const number =
            Number(
                value
            );


        return Number.isFinite(
            number
        )
            ? number
            : fallback;

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
            typeof model.provider ===
                "object"

                ? model.provider

                : null;


        /*
         * models.provider_id
         * adalah FK ke providers.id.
         */

        const providerId =
            String(
                model.provider_id ??
                provider?.id ??
                ""
            ).trim();


        /*
         * providers.provider_id
         * adalah kode provider.
         */

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
                (
                    typeof model.provider ===
                    "string"
                        ? model.provider
                        : ""
                ) ??
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

            /*
             * Database primary key
             */

            id:
                String(
                    model.id ??
                    ""
                ).trim(),


            /*
             * Provider
             */

            provider_id:
                providerId,

            provider_code:
                providerCode,

            provider_name:
                providerName,


            /*
             * Model
             */

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


            /*
             * Description
             */

            description:
                String(
                    model.description ??
                    ""
                ).trim(),


            /*
             * Credit
             */

            credit_cost:
                normalizeNumber(
                    model.credit_cost ??
                    model.credit ??
                    0,
                    0
                ),

            discount_percent:
                normalizeNumber(
                    model.discount_percent ??
                    model.discountPercent ??
                    0,
                    0
                ),

            credit_final:
                normalizeNumber(
                    model.credit_final ??
                    model.creditFinal ??
                    0,
                    0
                ),


            /*
             * Duration
             */

            min_duration:
                model.min_duration ??
                model.minDuration ??
                "",

            max_duration:
                model.max_duration ??
                model.maxDuration ??
                "",


            /*
             * Supported parameters
             */

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions,


            /*
             * Status
             */

            status:
                String(
                    model.status ??
                    "inactive"
                )
                    .trim()
                    .toLowerCase(),


            /*
             * Original database record
             */

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

        if (!model) {
            return "-";
        }


        const min =
            model.min_duration;


        const max =
            model.max_duration;


        const hasMin =
            min !== null &&
            min !== undefined &&
            String(
                min
            ).trim() !== "";


        const hasMax =
            max !== null &&
            max !== undefined &&
            String(
                max
            ).trim() !== "";


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
                ) +
                "s"
            );

        }


        if (hasMin) {

            return (
                escapeHtml(
                    min
                ) +
                "s"
            );

        }


        if (hasMax) {

            return (
                escapeHtml(
                    max
                ) +
                "s"
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


        if (
            !items.length
        ) {

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
            model?.supported_ratios
        );

    }


    /* =====================================================
       FORMAT RESOLUTION
       ===================================================== */

    function formatResolution(model) {

        return formatArray(
            model?.supported_resolutions
        );

    }


    /* =====================================================
       FORMAT STATUS
       ===================================================== */

    function formatStatus(status) {

        const value =
            String(
                status ??
                "inactive"
            )
                .trim()
                .toLowerCase();


        let label =
            "Inactive";


        let className =
            "status-inactive";


        switch (value) {

            case "active":

                label =
                    "Active";

                className =
                    "status-active";

                break;


            case "maintenance":

                label =
                    "Maintenance";

                className =
                    "status-maintenance";

                break;


            case "inactive":

            default:

                label =
                    "Inactive";

                className =
                    "status-inactive";

                break;

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

            "</div>"

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


        const providerCode =
            model.provider_code;


        return (

            '<div class="provider">' +

                escapeHtml(
                    providerName
                ) +

            "</div>" +

            (
                providerCode
                    ? (
                        '<div class="model-id">' +
                            escapeHtml(
                                providerCode
                            ) +
                        "</div>"
                    )
                    : ""
            )

        );

    }


    /* =====================================================
       RENDER ROW
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


        /*
         * Untuk Edit/Hapus,
         * identifier utama adalah
         * models.id.
         */

        const databaseId =
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
                        databaseId
                    ) +
                '"' +

                ' data-model-db-id="' +
                    escapeHtml(
                        databaseId
                    ) +
                '"' +

                ' data-model-code="' +
                    escapeHtml(
                        normalized.model_id
                    ) +
                '"' +

            ">" +


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
                                databaseId
                            ) +
                        '"' +

                        ' data-model-db-id="' +
                            escapeHtml(
                                databaseId
                            ) +
                        '"' +

                    ">" +

                        "Edit" +

                    "</button>" +


                    '<button' +

                        ' type="button"' +

                        ' class="btn btn-danger btn-small btn-delete-model"' +

                        ' data-action="delete"' +

                        ' data-model-id="' +
                            escapeHtml(
                                databaseId
                            ) +
                        '"' +

                        ' data-model-db-id="' +
                            escapeHtml(
                                databaseId
                            ) +
                        '"' +

                    ">" +

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


        if (!body) {

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


        if (!body) {

            console.warn(
                "[GEN-Z.AI] Model table body tidak ditemukan."
            );

            return false;

        }


        if (
            Array.isArray(list)
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


        const rows =
            models
                .map(
                    renderRow
                )
                .filter(Boolean)
                .join("");


        if (!rows) {

            return renderEmpty();

        }


        body.innerHTML =
            rows;


        return true;

    }


    /* =====================================================
       FIND BY DATABASE ID
       ===================================================== */

    function findById(id) {

        const value =
            String(
                id ?? ""
            ).trim();


        if (!value) {

            return null;

        }


        return (
            models.find(
                model =>
                    String(
                        model.id ??
                            ""
                    ).trim() ===
                    value
            ) ||
            null
        );

    }


    /* =====================================================
       FIND BY MODEL ID
       ===================================================== */

    function findByModelId(
        modelId
    ) {

        const value =
            String(
                modelId ?? ""
            ).trim();


        if (!value) {

            return null;

        }


        return (
            models.find(
                model =>
                    String(
                        model.model_id ??
                            ""
                    ).trim() ===
                    value
            ) ||
            null
        );

    }


    /* =====================================================
       FIND BY PROVIDER + MODEL ID
       ===================================================== */

    function findByProviderAndModelId(
        providerId,
        modelId
    ) {

        const provider =
            String(
                providerId ?? ""
            ).trim();


        const model =
            String(
                modelId ?? ""
            ).trim();


        if (
            !provider ||
            !model
        ) {

            return null;

        }


        return (
            models.find(
                item =>

                    String(
                        item.provider_id ??
                            ""
                    ).trim() ===
                        provider &&

                    String(
                        item.model_id ??
                            ""
                    ).trim() ===
                        model
            ) ||
            null
        );

    }


    /* =====================================================
       REMOVE LOCAL MODEL
       -----------------------------------------------------
       BUKAN DELETE DATABASE.
       ===================================================== */

    function removeById(id) {

        const value =
            String(
                id ?? ""
            ).trim();


        if (!value) {

            return false;

        }


        const previousLength =
            models.length;


        models =
            models.filter(
                model =>
                    String(
                        model.id ??
                            ""
                    ).trim() !==
                    value
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
       BUKAN UPDATE DATABASE.
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
                item =>
                    String(
                        item.id ??
                            ""
                    ).trim() ===
                    String(
                        normalized.id
                    ).trim()
            );


        if (
            index === -1
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

        /*
         * Ambil cache dari Models Data jika
         * tersedia.
         *
         * Tidak melakukan query Supabase.
         */

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

            findByProviderAndModelId,

            removeById,

            updateModel,

            clear,

            escapeHtml,

            normalizeArray,

            normalizeNumber,

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
        "[GEN-Z.AI] GENZModelTable loaded."
    );


})();
