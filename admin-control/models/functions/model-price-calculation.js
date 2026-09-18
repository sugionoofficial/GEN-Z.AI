/* =========================================================
   GEN-Z.AI
   MODEL PRICE CALCULATION
   ---------------------------------------------------------
   Tanggung jawab:
   - Hitung discount
   - Hitung credit final
   - Hitung harga setelah diskon
   - Sinkronisasi field harga
   ---------------------------------------------------------
   Tidak mengurus:
   - Create
   - Edit
   - Delete
   - Search
   - Provider
   ========================================================= */

(function () {
    "use strict";

    function number(value, fallback) {
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

    function clampDiscount(value) {
        return Math.min(
            100,
            Math.max(
                0,
                number(value, 0)
            )
        );
    }

    function calculateFinalCredit(
        baseCredit,
        discountPercent
    ) {
        const base =
            Math.max(
                0,
                number(baseCredit, 0)
            );

        const discount =
            clampDiscount(
                discountPercent
            );

        return (
            base *
            (1 - discount / 100)
        );
    }

    function calculateDiscountAmount(
        baseCredit,
        discountPercent
    ) {
        const base =
            Math.max(
                0,
                number(baseCredit, 0)
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

    function calculateDiscount(
        baseCredit,
        finalCredit
    ) {
        const base =
            Math.max(
                0,
                number(baseCredit, 0)
            );

        const final =
            Math.max(
                0,
                number(finalCredit, 0)
            );

        if (base <= 0) {
            return 0;
        }

        return Math.min(
            100,
            Math.max(
                0,
                (
                    (base - final) /
                    base
                ) *
                100
            )
        );
    }

    function roundCredit(value) {
        return Math.round(
            number(value, 0)
        );
    }

    function calculate(data) {

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

    function getField(id) {
        return document.getElementById(id);
    }

    function getFieldValue(id) {
        const field =
            getField(id);

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
            getField(id);

        if (!field) {
            return false;
        }

        field.value =
            value;

        return true;
    }

    function calculateFromForm() {

        const baseCredit =
            getFieldValue(
                "creditCost"
            ) ||
            getFieldValue(
                "credit_cost"
            );

        const discount =
            getFieldValue(
                "discountPercent"
            ) ||
            getFieldValue(
                "discount_percent"
            );

        const result =
            calculate({
                credit_cost:
                    baseCredit,

                discount_percent:
                    discount
            });

        return result;
    }

    function syncForm() {

        const result =
            calculateFromForm();

        const finalField =
            getField(
                "creditFinal"
            ) ||
            getField(
                "credit_final"
            );

        if (finalField) {
            finalField.value =
                result.credit_final;
        }

        const discountAmountField =
            getField(
                "discountAmount"
            ) ||
            getField(
                "discount_amount"
            );

        if (discountAmountField) {
            discountAmountField.value =
                result.discount_amount;
        }

        document.dispatchEvent(
            new CustomEvent(
                "genz-model-price-calculated",
                {
                    detail: result
                }
            )
        );

        return result;
    }

    function bind() {

        if (
            window.__GENZModelPriceBound
        ) {
            return true;
        }

        window.__GENZModelPriceBound =
            true;

        const fields = [
            "creditCost",
            "credit_cost",
            "discountPercent",
            "discount_percent"
        ];

        fields.forEach(
            function (id) {

                const field =
                    getField(id);

                if (!field) {
                    return;
                }

                field.addEventListener(
                    "input",
                    syncForm
                );

                field.addEventListener(
                    "change",
                    syncForm
                );
            }
        );

        return true;
    }

    function unbind() {
        /*
         * Event listener sengaja dikelola
         * oleh lifecycle utama.
         *
         * Fungsi ini hanya mereset marker.
         */
        window.__GENZModelPriceBound =
            false;
    }

    window.GENZModelPriceCalculation =
        Object.freeze({
            number,
            clampDiscount,
            calculateFinalCredit,
            calculateDiscountAmount,
            calculateDiscount,
            roundCredit,
            calculate,
            calculateFromForm,
            syncForm,
            bind,
            unbind
        });

})();
