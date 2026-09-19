/* =========================================================
   GEN-Z.AI
   MODEL PRICE CALCULATION
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-price-calculation.js

   TANGGUNG JAWAB:
   - Menghitung credit final
   - Menghitung nilai diskon
   - Sinkronisasi preview harga
   - Sinkronisasi credit_final pada form
   - Menjaga perhitungan konsisten dengan models table

   TIDAK BERTANGGUNG JAWAB:
   - Supabase
   - Provider
   - Model ID
   - Create
   - Edit
   - Delete
   - Search
   - CRUD
   - API KIE

   SUMBER NILAI:
   ---------------------------------------------------------
   credit_cost
   discount_percent
        ↓
   credit_final

   credit_final TIDAK diambil dari input manual sebagai
   sumber utama perhitungan.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       NUMBER NORMALIZER
       ===================================================== */

    function number(
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


        const normalized =
            String(
                value
            )
                .replace(/,/g, "")
                .trim();


        if (!normalized) {

            return fallback;

        }


        const parsed =
            Number(
                normalized
            );


        return Number.isFinite(
            parsed
        )
            ? parsed
            : fallback;

    }


    /* =====================================================
       NON NEGATIVE
       ===================================================== */

    function nonNegative(
        value
    ) {

        return Math.max(
            0,
            number(
                value,
                0
            )
        );

    }


    /* =====================================================
       DISCOUNT NORMALIZER
       ===================================================== */

    function clampDiscount(
        value
    ) {

        return Math.min(
            100,
            Math.max(
                0,
                number(
                    value,
                    0
                )
            )
        );

    }


    /* =====================================================
       ROUNDING
       -----------------------------------------------------
       Digunakan hanya untuk menghilangkan floating point
       noise, bukan untuk memaksa credit menjadi integer.
       ===================================================== */

    function roundDecimal(
        value,
        decimals = 6
    ) {

        const numeric =
            number(
                value,
                0
            );


        const factor =
            Math.pow(
                10,
                decimals
            );


        return (
            Math.round(
                (
                    numeric +
                    Number.EPSILON
                ) *
                factor
            ) /
            factor
        );

    }


    /* =====================================================
       CALCULATE FINAL CREDIT
       ===================================================== */

    function calculateFinalCredit(
        baseCredit,
        discountPercent
    ) {

        const base =
            nonNegative(
                baseCredit
            );


        const discount =
            clampDiscount(
                discountPercent
            );


        return roundDecimal(
            base *
            (
                1 -
                discount /
                100
            )
        );

    }


    /* =====================================================
       CALCULATE DISCOUNT AMOUNT
       ===================================================== */

    function calculateDiscountAmount(
        baseCredit,
        discountPercent
    ) {

        const base =
            nonNegative(
                baseCredit
            );


        const discount =
            clampDiscount(
                discountPercent
            );


        return roundDecimal(
            base *
            discount /
            100
        );

    }


    /* =====================================================
       CALCULATE DISCOUNT PERCENT
       -----------------------------------------------------
       Base + Final -> Discount
       ===================================================== */

    function calculateDiscount(
        baseCredit,
        finalCredit
    ) {

        const base =
            nonNegative(
                baseCredit
            );


        const final =
            nonNegative(
                finalCredit
            );


        if (
            base <= 0
        ) {

            return 0;

        }


        return roundDecimal(
            Math.min(
                100,
                Math.max(
                    0,
                    (
                        (
                            base -
                            final
                        ) /
                        base
                    ) *
                    100
                )
            )
        );

    }


    /* =====================================================
       FORMAT CREDIT
       ===================================================== */

    function formatCredit(
        value
    ) {

        const numeric =
            nonNegative(
                value
            );


        return new Intl.NumberFormat(
            "id-ID",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 6
            }
        ).format(
            numeric
        );

    }


    /* =====================================================
       FORMAT PERCENT
       ===================================================== */

    function formatPercent(
        value
    ) {

        const numeric =
            clampDiscount(
                value
            );


        return (
            new Intl.NumberFormat(
                "id-ID",
                {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }
            ).format(
                numeric
            ) +
            "%"
        );

    }


    /* =====================================================
       CALCULATE DATA
       ===================================================== */

    function calculate(
        data = {}
    ) {

        const source =
            data || {};


        /*
         * Hanya credit_cost yang menjadi
         * sumber credit normal.
         */

        const creditCost =
            nonNegative(
                source.credit_cost ??
                source.creditCost ??
                source.credit ??
                source.base_credit ??
                0
            );


        /*
         * Discount hanya boleh 0 - 100.
         */

        const discountPercent =
            clampDiscount(
                source.discount_percent ??
                source.discountPercent ??
                source.discount ??
                0
            );


        const discountAmount =
            calculateDiscountAmount(
                creditCost,
                discountPercent
            );


        const creditFinal =
            calculateFinalCredit(
                creditCost,
                discountPercent
            );


        return {

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            discount_amount:
                discountAmount,

            credit_final:
                creditFinal

        };

    }


    /* =====================================================
       DOM
       ===================================================== */

    function getField(
        id
    ) {

        return document.getElementById(
            id
        );

    }


    function getFieldValue(
        id
    ) {

        const field =
            getField(
                id
            );


        if (!field) {

            return "";

        }


        return String(
            field.value ?? ""
        ).trim();

    }


    function setFieldValue(
        id,
        value
    ) {

        const field =
            getField(
                id
            );


        if (!field) {

            return false;

        }


        field.value =
            value;


        return true;

    }


    /* =====================================================
       CREDIT FIELD
       ===================================================== */

    function getCreditField() {

        return (
            getField(
                "creditCost"
            ) ||

            getField(
                "credit_cost"
            )
        );

    }


    function getDiscountField() {

        return (
            getField(
                "discountPercent"
            ) ||

            getField(
                "discount_percent"
            )
        );

    }


    function getFinalField() {

        return (
            getField(
                "creditFinal"
            ) ||

            getField(
                "credit_final"
            )
        );

    }


    /* =====================================================
       READ FORM
       ===================================================== */

    function getBaseCreditFromForm() {

        const field =
            getCreditField();


        if (!field) {

            return 0;

        }


        return nonNegative(
            field.value
        );

    }


    function getDiscountFromForm() {

        const field =
            getDiscountField();


        if (!field) {

            return 0;

        }


        return clampDiscount(
            field.value
        );

    }


    /* =====================================================
       CALCULATE FROM FORM
       ===================================================== */

    function calculateFromForm() {

        return calculate({

            credit_cost:
                getBaseCreditFromForm(),

            discount_percent:
                getDiscountFromForm()

        });

    }


    /* =====================================================
       UPDATE PREVIEW
       ===================================================== */

    function updatePreview(
        result
    ) {

        if (
            !result ||
            typeof result !== "object"
        ) {

            return false;

        }


        const previewNormal =
            getField(
                "previewNormal"
            );


        const previewDiscount =
            getField(
                "previewDiscount"
            );


        const previewFinal =
            getField(
                "previewFinal"
            );


        /*
         * Credit normal
         */

        if (
            previewNormal
        ) {

            previewNormal.textContent =
                formatCredit(
                    result.credit_cost
                );

        }


        /*
         * Discount
         */

        if (
            previewDiscount
        ) {

            previewDiscount.textContent =
                formatPercent(
                    result.discount_percent
                );

        }


        /*
         * Credit final
         */

        if (
            previewFinal
        ) {

            previewFinal.textContent =
                formatCredit(
                    result.credit_final
                );

        }


        return true;

    }


    /* =====================================================
       SYNC FORM
       ===================================================== */

    function syncForm(
        options = {}
    ) {

        const result =
            calculateFromForm();


        /*
         * credit_final adalah hasil kalkulasi.
         *
         * Tidak meminta user mengetik nilai final.
         */

        const finalField =
            getFinalField();


        if (
            finalField
        ) {

            finalField.value =
                result.credit_final;

        }


        /*
         * Optional field.
         * Jika halaman memilikinya, sinkronkan.
         */

        const discountAmountField =
            getField(
                "discountAmount"
            ) ||
            getField(
                "discount_amount"
            );


        if (
            discountAmountField
        ) {

            discountAmountField.value =
                result.discount_amount;

        }


        /*
         * Preview.
         */

        if (
            options.updatePreview !== false
        ) {

            updatePreview(
                result
            );

        }


        /*
         * Event untuk modul lain.
         *
         * Tidak mengubah data database.
         */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-price-calculated",
                    {
                        detail:
                            result
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Price calculation event gagal:",
                error
            );

        }


        return result;

    }


    /* =====================================================
       SYNC EXTERNAL DATA
       ===================================================== */

    function syncData(
        data
    ) {

        const result =
            calculate(
                data
            );


        updatePreview(
            result
        );


        return result;

    }


    /* =====================================================
       EVENT STATE
       ===================================================== */

    let bound =
        false;


    const boundFields =
        new Map();


    /* =====================================================
       BIND FIELD
       ===================================================== */

    function bindField(
        id
    ) {

        const field =
            getField(
                id
            );


        if (!field) {

            return false;

        }


        /*
         * Field sudah di-bind oleh module ini.
         */

        if (
            boundFields.has(
                field
            )
        ) {

            return true;

        }


        const handler =
            function () {

                syncForm();

            };


        field.addEventListener(
            "input",
            handler
        );


        field.addEventListener(
            "change",
            handler
        );


        boundFields.set(
            field,
            handler
        );


        return true;

    }


    /* =====================================================
       BIND
       ===================================================== */

    function bind() {

        /*
         * Form DOM dapat dibuat ulang oleh modal.
         *
         * Jangan menganggap bound=true berarti
         * element baru sudah memiliki listener.
         */

        bindField(
            "creditCost"
        );


        bindField(
            "credit_cost"
        );


        bindField(
            "discountPercent"
        );


        bindField(
            "discount_percent"
        );


        bound =
            true;


        syncForm();


        console.info(
            "[GEN-Z.AI] Model Price Calculation initialized."
        );


        return true;

    }


    /* =====================================================
       UNBIND
       ===================================================== */

    function unbind() {

        boundFields.forEach(
            function (
                handler,
                field
            ) {

                field.removeEventListener(
                    "input",
                    handler
                );


                field.removeEventListener(
                    "change",
                    handler
                );

            }
        );


        boundFields.clear();


        bound =
            false;


        return true;

    }


    /* =====================================================
       STATUS
       ===================================================== */

    function isBound() {

        return bound;

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelPriceCalculation =
        Object.freeze({

            number,

            nonNegative,

            clampDiscount,

            roundDecimal,

            calculateFinalCredit,

            calculateDiscountAmount,

            calculateDiscount,

            formatCredit,

            formatPercent,

            calculate,

            getBaseCreditFromForm,

            getDiscountFromForm,

            calculateFromForm,

            updatePreview,

            syncForm,

            syncData,

            bind,

            unbind,

            isBound

        });


    console.info(
        "[GEN-Z.AI] GENZModelPriceCalculation loaded."
    );

})();
