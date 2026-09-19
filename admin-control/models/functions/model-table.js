/* =========================================================
   GEN-Z.AI
   MODEL TABLE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-table.js

   OWNER:
   - Menyimpan data Models untuk tampilan tabel
   - Normalisasi data tabel
   - Render tabel
   - Render row
   - Render empty state
   - Format angka
   - Format status
   - Format Harga KIE
   - Menyediakan lookup Model berdasarkan ID

   TIDAK BERTANGGUNG JAWAB:
   - Search
   - Provider loading
   - Form Create/Edit
   - CRUD API
   - Price calculation
   - Event Listener
   - Delete confirmation
   - Edit action

   =========================================================
   URUTAN KOLOM WAJIB SAMA DENGAN models.html:

   1. Model
   2. Provider
   3. Harga KIE
   4. Credit
   5. Diskon
   6. Credit Final
   7. Duration
   8. Ratio
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
            typeof model !== "object"
        ) {

            return null;

        }


        /*
         * -------------------------------------------------
         * PRICE KIE
         *
         * Jangan mengambil harga KIE dari credit_cost.
         *
         * Harga KIE dan Credit adalah dua data berbeda.
         *
         * Kita menerima beberapa nama field agar tetap
         * kompatibel dengan berbagai bentuk pricing API.
         * -------------------------------------------------
         */

        const kieUnitPrice =
            model.kie_unit_price ??
            model.kieUnitPrice ??
            model.unit_price ??
            model.unitPrice ??
            model.kie_price ??
            model.kiePrice ??
            model.price_usd ??
            model.priceUsd ??
            model.usd_price ??
            model.usdPrice ??
            null;


        const kieCurrency =
            model.kie_currency ??
            model.kieCurrency ??
            model.currency ??
            "USD";


        const kieUnit =
            model.kie_unit ??
            model.kieUnit ??
            model.unit ??
            "unit";


        const kiePriceIdr =
            model.kie_price_idr ??
            model.kiePriceIdr ??
            model.price_idr ??
            model.priceIdr ??
            null;


        /*
         * -------------------------------------------------
         * MODEL DATA
         * -------------------------------------------------
         */

        return {

            /*
             * Database row ID
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
                String(
                    model.provider_id ??
                    model.provider ??
                    model.provider_code ??
                    ""
                ).trim(),


            provider_name:
                String(
                    model.provider_name ??
                    model.providerName ??
                    ""
                ).trim(),


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


            model_family:
                String(
                    model.model_family ??
                    model.modelFamily ??
                    model.family ??
                    ""
                ).trim(),


            /*
             * Status
             */

            status:
                String(
                    model.status ??
                    "active"
                ).trim(),


            /*
             * Credit
             */

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


            duration:
                model.duration ??
                "",


            /*
             * Ratio
             */

            supported_ratios:
                model.supported_ratios ??
                model.supportedRatios ??
                model.ratios ??
                "",


            ratios:
                model.ratios ??
                model.supported_ratios ??
                model.supportedRatios ??
                "",


            /*
             * Resolution tetap dipertahankan
             * untuk kompatibilitas data.
             */

            supported_resolutions:
                model.supported_resolutions ??
                model.supportedResolutions ??
                model.resolutions ??
                "",


            resolutions:
                model.resolutions ??
                model.supported_resolutions ??
                model.supportedResolutions ??
                "",


            /*
             * Harga KIE
             */

            kie_unit_price:
                kieUnitPrice,

            kie_currency:
                kieCurrency,

            kie_unit:
                kieUnit,

            kie_price_idr:
                kiePriceIdr,


            /*
             * Simpan object asli jika modul lain
             * membutuhkan field tambahan.
             */

            original:
                model

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
       FORMAT USD
    ===================================================== */

    function formatUsd(
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

            return "-";

        }


        return (
            "$" +
            formatDecimal(
                number,
                6
            )
        );

    }


    /* =====================================================
       FORMAT IDR
    ===================================================== */

    function formatIdr(
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

            return "-";

        }


        return (
            "Rp" +
            formatNumber(
                Math.round(
                    number
                )
            )
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


        let label =
            status ||
            "-";


        if (
            value === "active"
        ) {

            label =
                "Active";

        } else if (
            value === "inactive"
        ) {

            label =
                "Inactive";

        } else if (
            value === "maintenance"
        ) {

            label =
                "Maintenance";

        }


        let className =
            "status-inactive";


        if (
            value === "active"
        ) {

            className =
                "status-active";

        } else if (
            value === "maintenance"
        ) {

            className =
                "status-maintenance";

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

    function formatDuration(
        model
    ) {

        const min =
            model.min_duration;

        const max =
            model.max_duration;


        if (
            min !== "" &&
            min !== null &&
            min !== undefined &&

            max !== "" &&
            max !== null &&
            max !== undefined
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
            min !== "" &&
            min !== null &&
            min !== undefined
        ) {

            return escapeHtml(
                min
            );

        }


        if (
            max !== "" &&
            max !== null &&
            max !== undefined
        ) {

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
       FORMAT RATIO
    ===================================================== */

    function formatRatio(
        model
    ) {

        const value =
            model.supported_ratios ||
            model.ratios ||
            "";


        if (
            Array.isArray(
                value
            )
        ) {

            if (
                !value.length
            ) {

                return "-";

            }


            return escapeHtml(
                value.join(
                    ", "
                )
            );

        }


        if (
            typeof value === "object" &&
            value !== null
        ) {

            try {

                return escapeHtml(
                    Object.keys(
                        value
                    ).join(
                        ", "
                    )
                );

            } catch {

                return "-";

            }

        }


        const text =
            String(
                value
            ).trim();


        if (
            !text
        ) {

            return "-";

        }


        return escapeHtml(
            text
        );

    }


    /* =====================================================
       FORMAT KIE PRICE
       -----------------------------------------------------
       Harga KIE adalah kolom tersendiri.
       TIDAK boleh masuk ke kolom Credit.
       ===================================================== */

    function renderKiePrice(
        model
    ) {

        const price =
            model.kie_unit_price;


        const priceIdr =
            model.kie_price_idr;


        /*
         * Jika tidak ada data pricing,
         * tampilkan "-" secara eksplisit.
         */

        if (
            price === null ||
            price === undefined ||
            price === ""
        ) {

            return (

                '<div class="kie-price">' +

                '<div class="kie-price-empty">' +
                "-" +
                "</div>" +

                "</div>"

            );

        }


        const usd =
            formatUsd(
                price
            );


        const idr =
            (
                priceIdr !== null &&
                priceIdr !== undefined &&
                priceIdr !== ""
            )

                ? formatIdr(
                    priceIdr
                )

                : "";


        const unit =
            String(
                model.kie_unit ||
                "unit"
            );


        return (

            '<div class="kie-price">' +

                '<div class="kie-price-usd">' +
                    escapeHtml(
                        usd
                    ) +
                "</div>" +

                (
                    idr

                        ? (
                            '<div class="kie-price-idr">' +
                                escapeHtml(
                                    idr
                                ) +
                            "</div>"
                        )

                        : ""
                ) +

                '<div class="kie-price-unit">' +
                    "per " +
                    escapeHtml(
                        unit
                    ) +
                "</div>" +

            "</div>"

        );

    }


    /* =====================================================
       RENDER MODEL CELL
       -----------------------------------------------------
       Header "Model" hanya satu kolom.
       Model ID + Name + Family ditempatkan di dalam
       kolom yang sama.
       ===================================================== */

    function renderModelCell(
        model
    ) {

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

    function renderProviderCell(
        model
    ) {

        /*
         * Provider display harus memakai
         * provider_name terlebih dahulu.
         *
         * Contoh:
         *
         * provider_id   = kie_ai
         * provider_name = KIE.AI
         *
         * Yang tampil:
         *
         * KIE.AI
         */

        const providerName =
            model.provider_name ||
            model.provider_id ||
            model.provider ||
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
       PENTING:
       Urutan TD HARUS 100% sama dengan TH di models.html.
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


        /*
         * =================================================
         * 10 KOLOM
         * =================================================
         */

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
               3. HARGA KIE
               ============================================= */

            "<td>" +

                renderKiePrice(
                    normalized
                ) +

            "</td>" +


            /* =============================================
               4. CREDIT
               ============================================= */

            '<td class="credit-normal">' +

                escapeHtml(
                    credit
                ) +

            "</td>" +


            /* =============================================
               5. DISKON
               ============================================= */

            '<td class="discount">' +

                escapeHtml(
                    discount
                ) +

            "</td>" +


            /* =============================================
               6. CREDIT FINAL
               ============================================= */

            '<td class="credit-final">' +

                escapeHtml(
                    finalCredit
                ) +

            "</td>" +


            /* =============================================
               7. DURATION
               ============================================= */

            "<td>" +

                duration +

            "</td>" +


            /* =============================================
               8. RATIO
               ============================================= */

            "<td>" +

                ratio +

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

    function render(
        list
    ) {

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


        /*
         * Jika diberikan list,
         * gunakan list tersebut sebagai state.
         */

        if (
            Array.isArray(
                list
            )
        ) {

            setModels(
                list
            );

        }


        /*
         * Empty state.
         */

        if (
            !models.length
        ) {

            return renderEmpty();

        }


        /*
         * Render tepat 10 TD untuk setiap row.
         */

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
       BUKAN DELETE API.
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
       BUKAN UPDATE API.
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

            formatDuration,

            formatRatio,

            renderKiePrice

        });


    console.info(
        "[GEN-Z.AI] GENZModelTable loaded. 10-column renderer active."
    );


})();
