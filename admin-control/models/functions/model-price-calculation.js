/* =========================================================
   GEN-Z.AI
   MODEL PRICE CALCULATION
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-price-calculation.js

   TUGAS:
   - Hitung credit normal
   - Hitung nilai diskon
   - Hitung credit final
   - Sinkronisasi field form
   - Sinkronisasi preview credit
   - Mendukung harga USD tanpa mengambil alih pricing module

   TIDAK MENGURUS:
   - Provider
   - Model ID
   - Search
   - Create
   - Edit
   - Delete
   - API Supabase
   - Lifecycle halaman
========================================================= */

(function () {
    "use strict";


    /* =====================================================
       NUMBER
    ===================================================== */

    function number(
        value,
        fallback
    ) {

        const parsed =
            Number(
                String(
                    value ?? ""
                )
                    .replace(/,/g, "")
                    .trim()
            );

        return Number.isFinite(parsed)
            ? parsed
            : (
                fallback === undefined
                    ? 0
                    : fallback
            );
    }


    /* =====================================================
       CLAMP DISCOUNT
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
       CALCULATE FINAL CREDIT
    ===================================================== */

    function calculateFinalCredit(
        baseCredit,
        discountPercent
    ) {

        const base =
            Math.max(
                0,
                number(
                    baseCredit,
                    0
                )
            );

        const discount =
            clampDiscount(
                discountPercent
            );

        return (
            base *
            (
                1 -
                discount / 100
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
            Math.max(
                0,
                number(
                    baseCredit,
                    0
                )
            );

        const discount =
            clampDiscount(
                discountPercent
            );

        return (
            base *
            discount /
            100
        );
    }


    /* =====================================================
       CALCULATE DISCOUNT PERCENT
       DARI BASE + FINAL
    ===================================================== */

    function calculateDiscount(
        baseCredit,
        finalCredit
    ) {

        const base =
            Math.max(
                0,
                number(
                    baseCredit,
                    0
                )
            );

        const final =
            Math.max(
                0,
                number(
                    finalCredit,
                    0
                )
            );

        if (
            base <= 0
        ) {

            return 0;
        }

        return Math.min(
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
        );
    }


    /* =====================================================
       ROUND CREDIT
    ===================================================== */

    function roundCredit(
        value
    ) {

        return Math.round(
            number(
                value,
                0
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
            number(
                value,
                0
            );

        return new Intl.NumberFormat(
            "id-ID",
            {
                maximumFractionDigits: 2
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
                    maximumFractionDigits: 2
                }
            ).format(
                numeric
            ) +
            "%"
        );
    }


    /* =====================================================
       CALCULATE
    ===================================================== */

    function calculate(
        data
    ) {

        const source =
            data || {};


        const baseCredit =
            number(
                source.credit_cost ??
                source.credit ??
                source.base_credit ??
                0
            );


        const discountPercent =
            clampDiscount(
                source.discount_percent ??
                source.discount ??
                0
            );


        const discountAmount =
            calculateDiscountAmount(
                baseCredit,
                discountPercent
            );


        const finalCredit =
            calculateFinalCredit(
                baseCredit,
                discountPercent
            );


        return {

            credit_cost:
                baseCredit,

            discount_percent:
                discountPercent,

            discount_amount:
                discountAmount,

            credit_final:
                finalCredit,

            credit_final_rounded:
                roundCredit(
                    finalCredit
                )
        };
    }


    /* =====================================================
       DOM HELPERS
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
       FORM VALUE
    ===================================================== */

    function getBaseCreditFromForm() {

        return (
            getFieldValue(
                "creditCost"
            ) ||
            getFieldValue(
                "credit_cost"
            )
        );
    }


    function getDiscountFromForm() {

        return (
            getFieldValue(
                "discountPercent"
            ) ||
            getFieldValue(
                "discount_percent"
            )
        );
    }


    /* =====================================================
       CALCULATE FROM FORM
    ===================================================== */

    function calculateFromForm() {

        const baseCredit =
            getBaseCreditFromForm();


        const discount =
            getDiscountFromForm();


        return calculate({

            credit_cost:
                baseCredit,

            discount_percent:
                discount
        });
    }


    /* =====================================================
       UPDATE CREDIT PREVIEW
    ===================================================== */

    function updatePreview(
        result
    ) {

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
         * Credit Normal
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
         * Diskon
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
         * Credit Final
         */

        if (
            previewFinal
        ) {

            previewFinal.textContent =
                formatCredit(
                    result.credit_final
                );
        }
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
         * Hidden / actual Credit Final.
         */

        const finalField =
            getField(
                "creditFinal"
            ) ||
            getField(
                "credit_final"
            );


        if (
            finalField
        ) {

            /*
             * Simpan nilai numerik asli.
             * Jangan masukkan format "1.000"
             * ke input number.
             */

            finalField.value =
                result.credit_final;
        }


        /*
         * Optional Discount Amount.
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
            options.updatePreview !==
            false
        ) {

            updatePreview(
                result
            );
        }


        /*
         * Event global.
         *
         * Module lain dapat mendengarkan
         * tanpa mengambil alih perhitungan.
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
                "[GEN-Z.AI] Dispatch price calculation event gagal:",
                error
            );
        }


        return result;
    }


    /* =====================================================
       SYNC MANUAL DATA
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
       EVENT BINDING
    ===================================================== */

    let bound =
        false;


    const boundFields = [];


    function bindField(
        id
    ) {

        const field =
            getField(
                id
            );

        if (
            !field
        ) {

            return false;
        }


        /*
         * Jangan bind field yang sama dua kali.
         */

        if (
            field.dataset
                .genzPriceCalculationBound ===
            "true"
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


        field.dataset
            .genzPriceCalculationBound =
            "true";


        field.__genzPriceCalculationHandler =
            handler;


        boundFields.push(
            field
        );


        return true;
    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind() {

        if (
            bound
        ) {

            /*
             * Tetap sinkronkan preview
             * jika module dipanggil kembali.
             */

            syncForm();

            return true;
        }


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


        /*
         * Initial calculation.
         */

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

        while (
            boundFields.length
        ) {

            const field =
                boundFields.pop();


            const handler =
                field.__genzPriceCalculationHandler;


            if (
                handler
            ) {

                field.removeEventListener(
                    "input",
                    handler
                );


                field.removeEventListener(
                    "change",
                    handler
                );


                delete field
                    .__genzPriceCalculationHandler;
            }


            delete field.dataset
                .genzPriceCalculationBound;
        }


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

            clampDiscount,

            calculateFinalCredit,

            calculateDiscountAmount,

            calculateDiscount,

            roundCredit,

            formatCredit,

            formatPercent,

            calculate,

            calculateFromForm,

            updatePreview,

            syncForm,

            syncData,

            bind,

            unbind,

            isBound

        });


    console.log(
        "[GEN-Z.AI] GENZModelPriceCalculation loaded."
    );

})();
