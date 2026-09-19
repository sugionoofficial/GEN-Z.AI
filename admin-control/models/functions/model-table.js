/* =========================================================
   GEN-Z.AI
   MODEL CARD RENDERER
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-table.js

   Tanggung jawab:
   - Menyimpan catalog model
   - Normalisasi model
   - Render model card
   - Render status
   - Render duration
   - Render ratio
   - Render resolution
   - Render pricing berbasis CREDIT
   - Menyediakan lookup model
   - Menyediakan data-action="edit"

   SOURCE OF TRUTH:
   models/<model-folder>/

   MODEL ID:
   - Berasal dari config.js
   - Tidak dapat diedit dari UI
   - Tetap menjadi referensi Generate

   Tidak bertanggung jawab:
   - Search
   - Query Supabase
   - Create model
   - Delete model
   - Update database
   - Provider loading
   - Pricing database
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


            /* JSON array */

            if (
                text.startsWith("[") &&
                text.endsWith("]")
            ) {

                try {

                    const parsed = JSON.parse(text);

                    if (Array.isArray(parsed)) {

                        return normalizeArray(parsed);

                    }

                } catch (_) {

                    /* fallback */

                }

            }


            /* PostgreSQL array */

            if (
                text.startsWith("{") &&
                text.endsWith("}")
            ) {

                const inner = text.slice(1, -1);

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


            /* Comma separated */

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


        if (typeof value === "object") {

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

            } catch (_) {

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


        const number = Number(value);

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


        /*
         * Database UUID hanya metadata tambahan.
         *
         * Jangan gunakan sebagai model_id.
         */

        const databaseId =
            String(
                model.id ?? ""
            ).trim();


        /*
         * Model ID harus berasal dari
         * model registry / config.js.
         */

        const modelId =
            String(
                model.model_id ??
                model.modelId ??
                model.id_model ??
                ""
            ).trim();


        if (!modelId) {

            return null;

        }


        /*
         * Display name.
         *
         * Jika admin memiliki override name,
         * gunakan override tersebut.
         */

        const modelName =
            String(
                model.model_name ??
                model.modelName ??
                model.name ??
                modelId
            ).trim();


        /*
         * Provider ID database.
         */

        const providerId =
            String(
                model.provider_id ??
                provider?.id ??
                ""
            ).trim();


        /*
         * Provider code / registry provider.
         */

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
            typeof model.provider === "string"
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


        /* =====================================================
           PARAMETERS
        ===================================================== */

        const parameters =
            model.parameters &&
            typeof model.parameters === "object"
                ? model.parameters
                : null;


        /*
         * Aspect ratio.
         *
         * Prioritas:
         * 1. model data
         * 2. parameters.js
         */

        const supportedRatios =
            normalizeArray(
                model.supported_ratios ??
                model.supportedRatios ??
                model.ratios ??
                parameters?.aspect_ratio?.enum ??
                parameters?.aspect_ratio?.values
            );


        /*
         * Resolution.
         */

        const supportedResolutions =
            normalizeArray(
                model.supported_resolutions ??
                model.supportedResolutions ??
                model.resolutions ??
                parameters?.resolution?.enum ??
                parameters?.resolution?.values
            );


        /*
         * Duration.
         */

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


        const durationParameter =
            parameters?.duration;


        if (
            durationParameter &&
            typeof durationParameter === "object"
        ) {

            if (
                minDuration === "" &&
                durationParameter.min !== undefined
            ) {

                minDuration =
                    durationParameter.min;

            }


            if (
                maxDuration === "" &&
                durationParameter.max !== undefined
            ) {

                maxDuration =
                    durationParameter.max;

            }

        }


        /*
         * Jika duration menggunakan enum,
         * tampilkan nilai terendah dan tertinggi.
         */

        if (
            durationParameter &&
            Array.isArray(durationParameter.enum)
        ) {

            const durationValues =
                durationParameter.enum
                    .map(function (value) {
                        return Number(value);
                    })
                    .filter(function (value) {
                        return Number.isFinite(value);
                    });


            if (
                minDuration === "" &&
                durationValues.length
            ) {

                minDuration =
                    Math.min(
                        ...durationValues
                    );

            }


            if (
                maxDuration === "" &&
                durationValues.length
            ) {

                maxDuration =
                    Math.max(
                        ...durationValues
                    );

            }

        }


        /* =====================================================
           CREDIT PRICING
        ===================================================== */

        /*
         * PENTING:
         *
         * credit_cost adalah CREDIT.
         *
         * Jangan menganggap field ini sebagai:
         * - USD
         * - price_usd
         * - Rupiah
         *
         * Karena schema models saat ini tidak
         * memiliki field USD yang terverifikasi.
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
            model.credit_final !== undefined &&
            model.credit_final !== null &&
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
         * Jangan biarkan nilai negatif.
         */

        creditFinal =
            Math.max(
                0,
                creditFinal
            );


        /* =====================================================
           STATUS
        ===================================================== */

        const status =
            String(
                model.status ??
                "active"
            )
                .trim()
                .toLowerCase();


        /* =====================================================
           TYPE
        ===================================================== */

        const type =
            String(
                model.type ??
                model.model_type ??
                model.modelType ??
                model.original?.type ??
                "image-to-video"
            ).trim();


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

            type,

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

            parameters,

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


        if (!Number.isFinite(number)) {

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


        if (!Number.isFinite(number)) {

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
       FORMAT CREDIT
    ========================================================= */

    function formatCredit(value) {

        const number =
            Number(value);


        if (!Number.isFinite(number)) {

            return "0 Credit";

        }


        return (
            formatNumber(number) +
            " Credit"
        );

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
            formatDecimal(discount) +
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
                status || "active"
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
       RENDER PRICE
    ========================================================= */

    function renderPrice(model) {

        const original =
            Number(
                model?.credit_cost
            );


        const finalPrice =
            Number(
                model?.credit_final
            );


        const discount =
            Number(
                model?.discount_percent
            );


        const hasOriginal =
            Number.isFinite(original);


        const hasFinal =
            Number.isFinite(finalPrice);


        const hasDiscount =
            Number.isFinite(discount) &&
            discount > 0;


        return (

            '<div class="model-pricing">' +

                '<div class="pricing-header">' +
                    "Pricing" +
                "</div>" +


                '<div class="price-row">' +

                    "<span>Credit</span>" +

                    "<strong>" +
                        escapeHtml(
                            formatCredit(
                                hasOriginal
                                    ? original
                                    : 0
                            )
                        ) +
                    "</strong>" +

                "</div>" +


                '<div class="price-row">' +

                    "<span>Diskon</span>" +

                    '<strong class="discount-value">' +

                        escapeHtml(
                            hasDiscount
                                ? formatDiscount(discount)
                                : "Tidak ada"
                        ) +

                    "</strong>" +

                "</div>" +


                '<div class="price-row price-final">' +

                    "<span>Credit final</span>" +

                    "<strong>" +

                        escapeHtml(
                            formatCredit(
                                hasFinal
                                    ? finalPrice
                                    : 0
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


        /*
         * Model ID adalah satu-satunya identifier
         * yang digunakan untuk navigasi Edit.
         */

        const identifier =
            normalized.model_id;


        const status =
            normalized.status;


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
                            escapeHtml(
                                normalized.type
                            ) +
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


        /*
         * Hanya set state jika list benar-benar
         * diberikan oleh caller.
         *
         * Ini penting agar render() tidak
         * melakukan recursive state update.
         */

        if (Array.isArray(list)) {

            setModels(list);

        }


        if (!models.length) {

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
         * Event delegation ditangani oleh
         * model-table-events.js.
         *
         * Jangan membuat listener Edit di sini.
         * Jika dibuat dua kali, event dapat
         * dieksekusi lebih dari satu kali.
         */

        try {

            const events =
                window.GENZModelTableEvents;


            if (
                events &&
                typeof events.rebind === "function"
            ) {

                events.rebind(
                    container
                );

            } else if (
                events &&
                typeof events.bind === "function"
            ) {

                events.bind(
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
            String(
                id ?? ""
            ).trim();


        if (!value) {

            return null;

        }


        return (
            models.find(function (model) {

                return (
                    String(
                        model.id ?? ""
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
                        model.model_id ?? ""
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
            findByModelId(value) ||
            findById(value) ||
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
                        item.provider_id ?? ""
                    ).trim() === provider ||

                    String(
                        item.provider_code ?? ""
                    ).trim() === provider;


                return (
                    providerMatches &&
                    String(
                        item.model_id ?? ""
                    ).trim() === model
                );

            }) ||
            null
        );

    }


    /* =========================================================
       UPDATE LOCAL MODEL
       ---------------------------------------------------------
       Hanya memperbarui state lokal.
       Tidak melakukan database update.
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

            /*
             * Jangan menambahkan model baru
             * melalui UI.
             *
             * Model hanya boleh berasal dari
             * repository registry.
             */

            return false;

        }


        /*
         * Model ID tetap berasal dari
         * model registry yang sudah ada.
         *
         * Update hanya mengganti metadata
         * lokal dari model yang sama.
         */

        if (
            normalized.model_id !==
            models[index].model_id
        ) {

            return false;

        }


        models[index] =
            normalized;


        render();

        return true;

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

                    setModels(
                        cached
                    );

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

            formatCredit,

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
