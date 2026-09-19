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

   ARSITEKTUR:
   - Model identity berasal dari model folder / registry
   - Supabase hanya melengkapi data administratif
   - models.id BUKAN syarat agar model dapat ditampilkan

   Tidak bertanggung jawab:
   - Search
   - Provider loading
   - Form Create/Edit
   - CRUD API
   - Price calculation
   - Event listener
   - Delete confirmation
   - KIE pricing
   - kie_* table
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
                "#models-table tbody"
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
             * JSON array:
             *
             * ["9:16","16:9"]
             */

            if (
                text.startsWith("[") &&
                text.endsWith("]")
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
                    /* fallback below */
                }

            }


            /*
             * PostgreSQL array:
             *
             * {"9:16","16:9"}
             */

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


            /*
             * Comma separated.
             */

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
                                        item ?? ""
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
       MODEL IDENTIFIER
       ===================================================== */

    function getModelIdentifier(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";

        }


        /*
         * Prioritas:
         *
         * 1. Supabase UUID
         * 2. model_id dari model folder
         *
         * Dengan begitu model folder tetap dapat
         * ditampilkan walaupun belum mempunyai
         * row models di Supabase.
         */

        const databaseId =
            String(
                model.id ??
                ""
            ).trim();


        if (databaseId) {
            return databaseId;
        }


        return String(
            model.model_id ??
            model.modelId ??
            ""
        ).trim();

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
         *
         * FK ke providers.id.
         */

        const providerId =
            String(
                model.provider_id ??
                provider?.id ??
                ""
            ).trim();


        /*
         * providers.provider_id
         *
         * kode provider.
         */

        const providerCode =
            String(
                model.provider_code ??
                model.providerId ??
                provider?.provider_id ??
                ""
            ).trim();


        /*
         * Provider name.
         */

        let providerName =
            String(
                model.provider_name ??
                model.providerName ??
                provider?.provider_name ??
                ""
            ).trim();


        /*
         * Jika provider hanya tersedia sebagai
         * string, gunakan sebagai fallback.
         */

        if (
            !providerName &&
            typeof model.provider ===
                "string"
        ) {

            providerName =
                String(
                    model.provider
                ).trim();

        }


        if (!providerName) {

            providerName =
                providerCode ||
                providerId ||
                "-";

        }


        /*
         * Model identity.
         */

        const modelId =
            String(
                model.model_id ??
                model.modelId ??
                ""
            ).trim();


        const modelName =
            String(
                model.model_name ??
                model.modelName ??
                model.name ??
                modelId ??
                ""
            ).trim();


        /*
         * Supported ratios.
         */

        const supportedRatios =
            normalizeArray(
                model.supported_ratios ??
                model.supportedRatios ??
                model.ratios
            );


        /*
         * Supported resolutions.
         */

        const supportedResolutions =
            normalizeArray(
                model.supported_resolutions ??
                model.supportedResolutions ??
                model.resolutions
            );


        /*
         * Duration.
         */

        const minDuration =
            model.min_duration ??
            model.minDuration ??
            model.duration_min ??
            "";


        const maxDuration =
            model.max_duration ??
            model.maxDuration ??
            model.duration_max ??
            "";


        /*
         * Credit.
         */

        const creditCost =
            normalizeNumber(
                model.credit_cost ??
                model.credit ??
                model.creditCost ??
                0,
                0
            );


        const discountPercent =
            normalizeNumber(
                model.discount_percent ??
                model.discountPercent ??
                0,
                0
            );


        /*
         * credit_final.
         *
         * Jika sudah tersedia dari Supabase,
         * gunakan nilai tersebut.
         *
         * Jika belum tersedia, hitung dari
         * credit_cost dan discount_percent.
         */

        let creditFinal;

        if (
            model.credit_final !==
                undefined &&
            model.credit_final !==
                null &&
            model.credit_final !== ""
        ) {

            creditFinal =
                normalizeNumber(
                    model.credit_final,
                    creditCost
                );

        } else if (
            discountPercent > 0
        ) {

            creditFinal =
                creditCost -
                (
                    creditCost *
                    discountPercent /
                    100
                );

        } else {

            creditFinal =
                creditCost;

        }


        /*
         * Status.
         *
         * Untuk model folder yang belum
         * mempunyai konfigurasi DB,
         * gunakan active sebagai fallback
         * agar model dapat digunakan.
         */

        const status =
            String(
                model.status ??
                "active"
            )
                .trim()
                .toLowerCase();


        /*
         * Database ID boleh kosong.
         * Ini disengaja.
         */

        const databaseId =
            String(
                model.id ??
                ""
            ).trim();


        /*
         * Identifier untuk UI.
         */

        const identifier =
            databaseId ||
            modelId;


        return {

            /*
             * Supabase primary key.
             */

            id:
                databaseId,


            /*
             * Stable UI identifier.
             */

            identifier:


                identifier,


            /*
             * Provider.
             */

            provider_id:
                providerId,

            provider_code:
                providerCode,

            provider_name:
                providerName,


            /*
             * Model.
             */

            model_id:
                modelId,

            model_name:
                modelName,


            /*
             * Description.
             */

            description:
                String(
                    model.description ??
                    ""
                ).trim(),


            /*
             * Credit.
             */

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal,


            /*
             * Duration.
             */

            min_duration:
                minDuration,

            max_duration:
                maxDuration,


            /*
             * Supported parameters.
             */

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions,


            /*
             * Status.
             */

            status:


                status || "active",


            /*
             * Folder source metadata.
             */

            source:
                model.source ??
                "model-folder",


            folder:
                model.folder ??
                null,


            /*
             * Parameter definition.
             */

            parameters:
                model.parameters ??
                null,


            /*
             * Original record.
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
                minimumFractionDigits:
                    0,

                maximumFractionDigits:
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

            if (
                String(min) ===
                String(max)
            ) {

                return (
                    escapeHtml(
                        min
                    ) +
                    "s"
                );

            }


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
                "active"
            )
                .trim()
                .toLowerCase();


        let label =
            "Active";


        let className =
            "status-active";


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

                label =
                    "Inactive";

                className =
                    "status-inactive";

                break;


            default:

                label =
                    value
                        ? value
                            .charAt(0)
                            .toUpperCase() +
                          value.slice(1)
                        : "Active";

                className =
                    "status-" +
                    (
                        value ||
                        "active"
                    );

                break;

        }


        return (

            '<span class="status ' +
            escapeHtml(
                className
            ) +
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
            modelId ||
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
         * Identifier untuk action.
         *
         * Jika ada UUID Supabase:
         *     gunakan UUID.
         *
         * Jika belum ada:
         *     gunakan model_id.
         */

        const identifier =
            normalized.identifier;


        if (!identifier) {

            return "";

        }


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


        /*
         * data-model-id:
         *
         * UUID jika ada,
         * model_id jika belum ada.
         *
         * model-table-events.js akan mencoba
         * resolve berdasarkan UUID terlebih dahulu,
         * kemudian model_id.
         */

        return (

            "<tr" +

                ' data-model-id="' +
                    escapeHtml(
                        identifier
                    ) +
                '"' +

                ' data-model-db-id="' +
                    escapeHtml(
                        normalized.id
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

                    /*
                     * EDIT
                     */

                    "<button" +

                        ' type="button"' +

                        ' class="btn btn-secondary btn-small btn-edit-model"' +

                        ' data-action="edit"' +

                        ' data-model-id="' +
                            escapeHtml(
                                identifier
                            ) +
                        '"' +

                        ' data-model-db-id="' +
                            escapeHtml(
                                normalized.id
                            ) +
                        '"' +

                        ' data-model-code="' +
                            escapeHtml(
                                normalized.model_id
                            ) +
                        '"' +

                    ">" +

                        "Edit" +

                    "</button>" +


                    /*
                     * DELETE
                     */

                    "<button" +

                        ' type="button"' +

                        ' class="btn btn-danger btn-small btn-delete-model"' +

                        ' data-action="delete"' +

                        ' data-model-id="' +
                            escapeHtml(
                                identifier
                            ) +
                        '"' +

                        ' data-model-db-id="' +
                            escapeHtml(
                                normalized.id
                            ) +
                        '"' +

                        ' data-model-code="' +
                            escapeHtml(
                                normalized.model_id
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


        /*
         * Pastikan event delegation
         * tetap terpasang setelah innerHTML
         * diganti.
         */

        try {

            const events =
                window.GENZModelTableEvents;

            if (
                events &&
                typeof events.rebind ===
                    "function"
            ) {

                events.rebind(
                    body.closest("table") ||
                    body
                );

            } else if (
                events &&
                typeof events.bind ===
                    "function"
            ) {

                events.bind(
                    body.closest("table") ||
                    body
                );

            }

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Model table event rebind warning:",
                error
            );

        }


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
       FIND BY IDENTIFIER
       -----------------------------------------------------
       Mendukung:
       - Supabase UUID
       - model_id
       ===================================================== */

    function findByIdentifier(
        identifier
    ) {

        const value =
            String(
                identifier ?? ""
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
                        value ||

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
                item => {

                    const providerMatches =

                        String(
                            item.provider_id ??
                            ""
                        ).trim() ===
                            provider ||

                        String(
                            item.provider_code ??
                            ""
                        ).trim() ===
                            provider;


                    const modelMatches =

                        String(
                            item.model_id ??
                            ""
                        ).trim() ===
                            model;


                    return (
                        providerMatches &&
                        modelMatches
                    );

                }

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
                model => {

                    const dbId =
                        String(
                            model.id ??
                            ""
                        ).trim();


                    const modelId =
                        String(
                            model.model_id ??
                            ""
                        ).trim();


                    return (
                        dbId !== value &&
                        modelId !== value
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
       BUKAN UPDATE DATABASE.
       ===================================================== */

    function updateModel(model) {

        const normalized =
            normalizeModel(
                model
            );


        if (
            !normalized
        ) {

            return false;

        }


        const databaseId =
            String(
                normalized.id ??
                ""
            ).trim();


        const modelId =
            String(
                normalized.model_id ??
                ""
            ).trim();


        const index =
            models.findIndex(
                item => {

                    const itemDbId =
                        String(
                            item.id ??
                            ""
                        ).trim();


                    const itemModelId =
                        String(
                            item.model_id ??
                            ""
                        ).trim();


                    if (
                        databaseId &&
                        itemDbId ===
                            databaseId
                    ) {

                        return true;

                    }


                    if (
                        modelId &&
                        itemModelId ===
                            modelId
                    ) {

                        return true;

                    }


                    return false;

                }
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

            findByIdentifier,

            findByProviderAndModelId,

            removeById,

            updateModel,

            clear,

            getTableBody,

            getModelIdentifier,

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
