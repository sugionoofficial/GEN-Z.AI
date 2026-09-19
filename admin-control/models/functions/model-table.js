/* =========================================================
   GEN-Z.AI
   MODEL CARD RENDERER
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-table.js

   Tanggung jawab:
   - Menyimpan catalog model
   - Normalisasi model
   - Render premium model card
   - Render status
   - Render duration
   - Render ratio
   - Render resolution
   - Render pricing
   - Menyediakan lookup model
   - Menyediakan data-action="edit"

   SOURCE OF TRUTH:
   models/<model-folder>/

   MODEL ID:
   - Tidak pernah diedit dari UI
   - Tetap menjadi referensi Generate

   Tidak bertanggung jawab:
   - Search
   - Query Supabase
   - Create model
   - Delete model
   - Update database
   - Pricing calculation database
   - Provider loading
   ========================================================= */

(function () {

    "use strict";


    /* =========================================================
       STATE
    ========================================================= */

    let models = [];


    /* =========================================================
       DOM
    ========================================================= */

    function getContainer() {

        return (
            document.getElementById("modelsTable") ||
            document.getElementById("models-table") ||
            document.getElementById("modelGrid") ||
            document.getElementById("modelsGrid") ||
            document.getElementById("modelTableBody")
        );

    }


    /* =========================================================
       ESCAPE HTML
    ========================================================= */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =========================================================
       NORMALIZE ARRAY
    ========================================================= */

    function normalizeArray(value) {

        if (Array.isArray(value)) {

            return [
                ...new Set(
                    value
                        .map(function (item) {
                            return String(item ?? "").trim();
                        })
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


        if (typeof value === "string") {

            const text = value.trim();

            if (!text) {
                return [];
            }


            /*
             * JSON array
             */

            if (
                text.startsWith("[") &&
                text.endsWith("]")
            ) {

                try {

                    const parsed =
                        JSON.parse(text);

                    if (
                        Array.isArray(parsed)
                    ) {

                        return normalizeArray(
                            parsed
                        );

                    }

                } catch {
                    /* fallback */
                }

            }


            /*
             * PostgreSQL array
             */

            if (
                text.startsWith("{") &&
                text.endsWith("}")
            ) {

                const inner =
                    text.slice(1, -1);

                return [
                    ...new Set(
                        inner
                            .split(",")
                            .map(function (item) {

                                return String(item)
                                    .trim()
                                    .replace(
                                        /^"(.*)"$/,
                                        "$1"
                                    );

                            })
                            .filter(Boolean)
                    )
                ];

            }


            /*
             * Comma separated
             */

            return [
                ...new Set(
                    text
                        .split(",")
                        .map(function (item) {
                            return String(item).trim();
                        })
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
                        Object.values(value)
                            .map(function (item) {
                                return String(
                                    item ?? ""
                                ).trim();
                            })
                            .filter(Boolean)
                    )
                ];

            } catch {

                return [];

            }

        }


        return [];

    }


    /* =========================================================
       NUMBER
    ========================================================= */

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
            Number(value);


        return Number.isFinite(number)
            ? number
            : fallback;

    }


    /* =========================================================
       MODEL NORMALIZATION
    ========================================================= */

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


        const databaseId =
            String(
                model.id ??
                ""
            ).trim();


        const modelId =
            String(
                model.model_id ??
                model.modelId ??
                model.id_model ??
                ""
            ).trim();


        /*
         * Model ID wajib berasal dari
         * model folder / registry.
         *
         * Jangan membuat ID baru.
         */

        if (!modelId) {

            return null;

        }


        const modelName =
            String(
                model.model_name ??
                model.modelName ??
                model.name ??
                modelId
            ).trim();


        const providerId =
            String(
                model.provider_id ??
                provider?.id ??
                ""
            ).trim();


        const providerCode =
            String(
                model.provider_code ??
                model.providerId ??
                provider?.provider_id ??
                ""
            ).trim();


        let providerName =
            String(
                model.provider_name ??
                model.providerName ??
                provider?.provider_name ??
                ""
            ).trim();


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


        const description =
            String(
                model.description ??
                ""
            ).trim();


        const supportedRatios =
            normalizeArray(
                model.supported_ratios ??
                model.supportedRatios ??
                model.ratios ??
                model.parameters?.aspect_ratio?.enum ??
                model.parameters?.aspect_ratio?.values
            );


        const supportedResolutions =
            normalizeArray(
                model.supported_resolutions ??
                model.supportedResolutions ??
                model.resolutions ??
                model.parameters?.resolution?.enum ??
                model.parameters?.resolution?.values
            );


        let minDuration =
            model.min_duration ??
            model.minDuration ??
            model.duration_min ??
            "";


        let maxDuration =
            model.max_duration ??
            model.maxDuration ??
            model.duration_max ??
            "";


        /*
         * Support parameters.js object.
         */

        const durationParameter =
            model.parameters?.duration;


        if (
            durationParameter &&
            typeof durationParameter ===
                "object"
        ) {

            if (
                minDuration === "" &&
                durationParameter.min !==
                    undefined
            ) {

                minDuration =
                    durationParameter.min;

            }


            if (
                maxDuration === "" &&
                durationParameter.max !==
                    undefined
            ) {

                maxDuration =
                    durationParameter.max;

            }

        }


        /*
         * Credit fields.
         *
         * Catatan:
         * Sistem pricing lama masih memakai
         * credit_cost / credit_final.
         *
         * Jangan mengubah maknanya menjadi
         * USD di renderer ini.
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

        } else {

            creditFinal =
                creditCost -
                (
                    creditCost *
                    discountPercent /
                    100
                );

        }


        /*
         * Status.
         */

        const status =
            String(
                model.status ??
                "active"
            )
                .trim()
                .toLowerCase();


        return {

            id:
                databaseId,

            identifier:
                databaseId ||
                modelId,

            model_id:
                modelId,

            model_name:
                modelName,

            description,

            provider_id:
                providerId,

            provider_code:
                providerCode,

            provider_name:
                providerName,

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal,

            min_duration:
                minDuration,

            max_duration:
                maxDuration,

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions,

            status:
                status || "active",

            source:
                model.source ||
                "model-folder",

            folder:
                model.folder ||
                null,

            parameters:
                model.parameters ||
                null,

            original:
                model

        };

    }


    /* =========================================================
       SET MODELS
    ========================================================= */

    function setModels(list) {

        models =
            Array.isArray(list)
                ? list
                    .map(normalizeModel)
                    .filter(Boolean)
                : [];


        return getModels();

    }


    /* =========================================================
       GET MODELS
    ========================================================= */

    function getModels() {

        return models.slice();

    }


    /* =========================================================
       FORMAT NUMBER
    ========================================================= */

    function formatNumber(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return "0";

        }


        return new Intl.NumberFormat(
            "id-ID"
        ).format(number);

    }


    /* =========================================================
       FORMAT DECIMAL
    ========================================================= */

    function formatDecimal(
        value,
        maximumFractionDigits = 2
    ) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return "-";

        }


        return new Intl.NumberFormat(
            "id-ID",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits
            }
        ).format(number);

    }


    /* =========================================================
       FORMAT DISCOUNT
    ========================================================= */

    function formatDiscount(value) {

        const discount =
            Number(value);


        if (
            !Number.isFinite(discount) ||
            discount <= 0
        ) {

            return "Tidak ada";

        }


        return (
            formatDecimal(
                discount
            ) +
            "%"
        );

    }


    /* =========================================================
       FORMAT DURATION
    ========================================================= */

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
            String(min).trim() !== "";


        const hasMax =
            max !== null &&
            max !== undefined &&
            String(max).trim() !== "";


        if (
            hasMin &&
            hasMax
        ) {

            if (
                String(min) ===
                String(max)
            ) {

                return (
                    escapeHtml(min) +
                    " detik"
                );

            }


            return (
                escapeHtml(min) +
                " - " +
                escapeHtml(max) +
                " detik"
            );

        }


        if (hasMin) {

            return (
                "Min. " +
                escapeHtml(min) +
                " detik"
            );

        }


        if (hasMax) {

            return (
                "Maks. " +
                escapeHtml(max) +
                " detik"
            );

        }


        return "-";

    }


    /* =========================================================
       FORMAT RATIO
    ========================================================= */

    function formatRatio(model) {

        const ratios =
            normalizeArray(
                model?.supported_ratios
            );


        if (!ratios.length) {

            return (
                '<span class="chip">-</span>'
            );

        }


        return ratios
            .map(function (ratio) {

                return (
                    '<span class="chip">' +
                    escapeHtml(ratio) +
                    "</span>"
                );

            })
            .join("");

    }


    /* =========================================================
       FORMAT RESOLUTION
    ========================================================= */

    function formatResolution(model) {

        const resolutions =
            normalizeArray(
                model?.supported_resolutions
            );


        if (!resolutions.length) {

            return (
                '<span class="chip">-</span>'
            );

        }


        return resolutions
            .map(function (resolution) {

                return (
                    '<span class="chip">' +
                    escapeHtml(resolution) +
                    "</span>"
                );

            })
            .join("");

    }


    /* =========================================================
       FORMAT STATUS
    ========================================================= */

    function formatStatus(status) {

        const value =
            String(
                status ||
                "active"
            )
                .trim()
                .toLowerCase();


        let label =
            "Aktif";

        let className =
            "status-active";


        if (
            value === "inactive" ||
            value === "disabled" ||
            value === "nonaktif"
        ) {

            label =
                "Nonaktif";

            className =
                "status-inactive";

        }


        if (
            value === "maintenance" ||
            value === "maintain"
        ) {

            label =
                "Maintenance";

            className =
                "status-maintenance";

        }


        return (
            '<span class="status-badge ' +
            className +
            '">' +
            escapeHtml(label) +
            "</span>"
        );

    }


    /* =========================================================
       PRICE
    ========================================================= */

    function renderPrice(model) {

        const original =
            Number(
                model.credit_cost
            );


        const finalPrice =
            Number(
                model.credit_final
            );


        const discount =
            Number(
                model.discount_percent
            );


        return (

            '<div class="price-box">' +

                '<div class="price-row">' +

                    "<span>Harga dasar</span>" +

                    "<strong>" +

                        escapeHtml(
                            formatNumber(
                                original
                            )
                        ) +

                    "</strong>" +

                "</div>" +


                '<div class="price-row">' +

                    "<span>Diskon</span>" +

                    "<strong class=\"discount-value\">" +

                        escapeHtml(
                            formatDiscount(
                                discount
                            )
                        ) +

                    "</strong>" +

                "</div>" +


                '<div class="price-row price-final">' +

                    "<span>Harga final</span>" +

                    "<strong>" +

                        escapeHtml(
                            formatNumber(
                                finalPrice
                            )
                        ) +

                    "</strong>" +

                "</div>" +

            "</div>"

        );

    }


    /* =========================================================
       MODEL CARD
    ========================================================= */

    function renderCard(model) {

        const normalized =
            normalizeModel(model);


        if (!normalized) {

            return "";

        }


        const identifier =
            normalized.model_id;


        const status =
            normalized.status;


        const type =
            normalized.original?.type ||
            normalized.original?.model_type ||
            "image-to-video";


        return (

            '<article' +

                ' class="model-card"' +

                ' data-model-id="' +
                    escapeHtml(identifier) +
                '"' +

                ' data-model-code="' +
                    escapeHtml(identifier) +
                '"' +

                ' data-model-db-id="' +
                    escapeHtml(
                        normalized.id
                    ) +
                '"' +

                ' data-status="' +
                    escapeHtml(status) +
                '"' +

            ">" +


                '<span class="premium-badge">' +
                    "Premium" +
                "</span>" +


                '<div class="model-top">' +

                    '<div class="model-icon">' +
                        "◆" +
                    "</div>" +


                    '<div class="model-title">' +

                        '<h2 class="model-name">' +
                            escapeHtml(
                                normalized.model_name
                            ) +
                        "</h2>" +


                        '<div class="model-id">' +
                            escapeHtml(
                                normalized.model_id
                            ) +
                        "</div>" +

                    "</div>" +

                "</div>" +


                '<div class="model-description">' +

                    escapeHtml(
                        normalized.description ||
                        "Model AI tersedia dari repository GEN-Z.AI."
                    ) +

                "</div>" +


                '<div class="model-meta">' +

                    '<div class="meta-item">' +

                        '<div class="meta-label">' +
                            "Provider" +
                        "</div>" +

                        '<div class="meta-value">' +
                            escapeHtml(
                                normalized.provider_name
                            ) +
                        "</div>" +

                    "</div>" +


                    '<div class="meta-item">' +

                        '<div class="meta-label">' +
                            "Tipe" +
                        "</div>" +

                        '<div class="meta-value">' +
                            escapeHtml(type) +
                        "</div>" +

                    "</div>" +


                    '<div class="meta-item">' +

                        '<div class="meta-label">' +
                            "Durasi" +
                        "</div>" +

                        '<div class="meta-value">' +
                            formatDuration(
                                normalized
                            ) +
                        "</div>" +

                    "</div>" +


                    '<div class="meta-item">' +

                        '<div class="meta-label">' +
                            "Source" +
                        "</div>" +

                        '<div class="meta-value">' +
                            escapeHtml(
                                normalized.source
                            ) +
                        "</div>" +

                    "</div>" +

                "</div>" +


                renderPrice(
                    normalized
                ) +


                '<div class="parameter-section">' +

                    '<div class="parameter-title">' +
                        "Aspect Ratio" +
                    "</div>" +

                    '<div class="chips">' +
                        formatRatio(
                            normalized
                        ) +
                    "</div>" +

                "</div>" +


                '<div class="parameter-section">' +

                    '<div class="parameter-title">' +
                        "Resolution" +
                    "</div>" +

                    '<div class="chips">' +
                        formatResolution(
                            normalized
                        ) +
                    "</div>" +

                "</div>" +


                '<div class="status-row">' +

                    formatStatus(
                        normalized.status
                    ) +

                    '<span class="chip">' +
                        "ID Referensi Tetap" +
                    "</span>" +

                "</div>" +


                '<div class="model-actions">' +

                    '<button' +

                        ' type="button"' +

                        ' class="btn btn-primary btn-small btn-edit-model"' +

                        ' data-action="edit"' +

                        ' data-model-id="' +
                            escapeHtml(identifier) +
                        '"' +

                        ' data-model-code="' +
                            escapeHtml(identifier) +
                        '"' +

                        ' data-model-db-id="' +
                            escapeHtml(
                                normalized.id
                            ) +
                        '"' +

                    ">" +

                        "✎ Edit Model" +

                    "</button>" +

                "</div>" +

            "</article>"

        );

    }


    /* =========================================================
       EMPTY STATE
    ========================================================= */

    function renderEmpty() {

        const container =
            getContainer();


        if (!container) {

            return false;

        }


        container.innerHTML =

            '<div class="state-panel">' +

                '<div class="state-icon">' +
                    "◇" +
                "</div>" +

                '<div class="state-title">' +
                    "Tidak ada model" +
                "</div>" +

                '<div class="state-description">' +
                    "Belum ada model yang tersedia " +
                    "dari folder models/ repository." +
                "</div>" +

            "</div>";


        return true;

    }


    /* =========================================================
       ERROR STATE
    ========================================================= */

    function renderError(
        message
    ) {

        const container =
            getContainer();


        if (!container) {

            return false;

        }


        container.innerHTML =

            '<div class="state-panel">' +

                '<div class="state-icon">' +
                    "!" +
                "</div>" +

                '<div class="state-title">' +
                    "Model gagal dimuat" +
                "</div>" +

                '<div class="state-description">' +

                    escapeHtml(
                        message ||
                        "Terjadi kesalahan saat membaca model."
                    ) +

                "</div>" +

            "</div>";


        return true;

    }


    /* =========================================================
       RENDER
    ========================================================= */

    function render(list) {

        const container =
            getContainer();


        if (!container) {

            console.warn(
                "[GEN-Z.AI] Container model tidak ditemukan."
            );

            return false;

        }


        if (
            Array.isArray(list)
        ) {

            setModels(list);

        }


        if (
            !models.length
        ) {

            return renderEmpty();

        }


        const html =
            models
                .map(renderCard)
                .filter(Boolean)
                .join("");


        if (!html) {

            return renderEmpty();

        }


        container.innerHTML =
            html;


        /*
         * Event delegation.
         *
         * model-table-events.js menangani
         * data-action="edit".
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
                    container
                );

            } else if (
                events &&
                typeof events.bind ===
                    "function"
            ) {

                events.bind(
                    container
                );

            } else if (
                events &&
                typeof events.initialize ===
                    "function"
            ) {

                events.initialize(
                    container
                );

            }

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Model event binding warning:",
                error
            );

        }


        return true;

    }


    /* =========================================================
       LOOKUP BY DATABASE ID
    ========================================================= */

    function findById(id) {

        const value =
            String(id ?? "").trim();


        if (!value) {

            return null;

        }


        return (
            models.find(function (model) {

                return (
                    String(
                        model.id ??
                        ""
                    ).trim() === value
                );

            }) ||
            null
        );

    }


    /* =========================================================
       LOOKUP BY MODEL ID
    ========================================================= */

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
            models.find(function (model) {

                return (
                    String(
                        model.model_id ??
                        ""
                    ).trim() === value
                );

            }) ||
            null
        );

    }


    /* =========================================================
       LOOKUP BY IDENTIFIER
    ========================================================= */

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
            findById(value) ||
            findByModelId(value) ||
            null
        );

    }


    /* =========================================================
       LOOKUP PROVIDER + MODEL
    ========================================================= */

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
            models.find(function (item) {

                const providerMatches =
                    String(
                        item.provider_id ??
                        ""
                    ).trim() === provider ||
                    String(
                        item.provider_code ??
                        ""
                    ).trim() === provider;


                return (
                    providerMatches &&
                    String(
                        item.model_id ??
                        ""
                    ).trim() === model
                );

            }) ||
            null
        );

    }


    /* =========================================================
       UPDATE LOCAL MODEL
       ========================================================= */

    function updateModel(
        model
    ) {

        const normalized =
            normalizeModel(model);


        if (!normalized) {

            return false;

        }


        const index =
            models.findIndex(
                function (item) {

                    return (
                        (
                            normalized.id &&
                            item.id ===
                                normalized.id
                        ) ||
                        (
                            normalized.model_id &&
                            item.model_id ===
                                normalized.model_id
                        )
                    );

                }
            );


        if (index === -1) {

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


    /* =========================================================
       REMOVE LOCAL MODEL
       ---------------------------------------------------------
       Tidak menghapus Supabase.
       Hanya kompatibilitas internal.
       ========================================================= */

    function removeById(
        identifier
    ) {

        const value =
            String(
                identifier ?? ""
            ).trim();


        if (!value) {

            return false;

        }


        const previous =
            models.length;


        models =
            models.filter(
                function (model) {

                    return (
                        String(
                            model.id ??
                            ""
                        ).trim() !== value &&
                        String(
                            model.model_id ??
                            ""
                        ).trim() !== value
                    );

                }
            );


        if (
            models.length !== previous
        ) {

            render();

            return true;

        }


        return false;

    }


    /* =========================================================
       CLEAR
    ========================================================= */

    function clear() {

        models = [];

        return renderEmpty();

    }


    /* =========================================================
       INITIALIZE
    ========================================================= */

    function initialize() {

        const data =
            window.GENZModelsData;


        if (
            data &&
            typeof data.getCachedModels ===
                "function"
        ) {

            try {

                const cached =
                    data.getCachedModels();


                if (
                    Array.isArray(cached) &&
                    cached.length
                ) {

                    setModels(cached);

                    render();

                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Model cache initialization warning:",
                    error
                );

            }

        }


        return true;

    }


    /* =========================================================
       PUBLIC API
    ========================================================= */

    window.GENZModelTable =
        Object.freeze({

            initialize,

            setModels,

            getModels,

            render,

            renderCard,

            renderRow:
                renderCard,

            renderEmpty,

            renderError,

            findById,

            findByModelId,

            findByIdentifier,

            findByProviderAndModelId,

            updateModel,

            removeById,

            clear,

            getTableBody:
                getContainer,

            getContainer,

            getModelIdentifier:
                function (model) {

                    return String(
                        model?.model_id ??
                        model?.modelId ??
                        ""
                    ).trim();

                },

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

            renderPrice

        });


    console.info(
        "[GEN-Z.AI] GENZModelTable loaded."
    );


})();
