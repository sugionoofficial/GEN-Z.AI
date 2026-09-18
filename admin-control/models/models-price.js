/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   KIE PRICE MODULE

   File:
   admin-control/models/models-price.js

   Tanggung jawab:
   - Load pricing KIE
   - Cache pricing
   - Cari pricing berdasarkan model
   - Harga terendah / tertinggi
   - Konversi USD -> IDR
   - Preview harga KIE
   - Kalkulasi biaya

   TIDAK menangani:
   - Provider
   - Model form
   - Model Search
   - Save model
   - Update model
   - Delete model

   Arsitektur:
   models-price.js
          ↓
     kie_pricing
          ↓
   models-ui.js
========================================================= */

(function () {
    "use strict";

    let pricingCache = [];
    let initialized = false;
    let loadingPromise = null;

    /* =====================================================
       CONFIG
    ===================================================== */

    const DEFAULT_USD_IDR_RATE = 17700;

    const PRICING_TABLE =
        "kie_pricing";

    /* =====================================================
       SUPABASE
    ===================================================== */

    function getSupabase() {
        return (
            window.GENZ_SUPABASE ||
            window.supabaseClient ||
            null
        );
    }

    /* =====================================================
       UTILITY
    ===================================================== */

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function toNumber(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }

    function normalizeString(value) {
        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();
    }

    /* =====================================================
       FORMAT USD
    ===================================================== */

    function formatUsd(value) {
        const number =
            toNumber(value);

        if (number === null) {
            return "-";
        }

        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
            }
        ).format(number);
    }

    /* =====================================================
       FORMAT IDR
    ===================================================== */

    function formatIdr(value) {
        const number =
            toNumber(value);

        if (number === null) {
            return "-";
        }

        return new Intl.NumberFormat(
            "id-ID",
            {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        ).format(
            Math.round(number)
        );
    }

    /* =====================================================
       USD -> IDR RATE
    ===================================================== */

    function getUsdToIdrRate() {
        const candidates = [
            window.GENZ_USD_IDR_RATE,

            window.GENZ_CONFIG &&
            window.GENZ_CONFIG.USD_IDR_RATE,

            window.GENZ_CONFIG &&
            window.GENZ_CONFIG.usd_idr_rate,

            localStorage.getItem(
                "GENZ_USD_IDR_RATE"
            )
        ];

        for (
            const candidate
            of candidates
        ) {
            const rate =
                Number(candidate);

            if (
                Number.isFinite(rate) &&
                rate > 0
            ) {
                return rate;
            }
        }

        return DEFAULT_USD_IDR_RATE;
    }

    function setUsdToIdrRate(rate) {
        const number =
            Number(rate);

        if (
            !Number.isFinite(number) ||
            number <= 0
        ) {
            return false;
        }

        window.GENZ_USD_IDR_RATE =
            number;

        try {
            localStorage.setItem(
                "GENZ_USD_IDR_RATE",
                String(number)
            );
        } catch (error) {
            console.warn(
                "[models-price] Tidak dapat menyimpan kurs:",
                error
            );
        }

        return true;
    }

    /* =====================================================
       PRICE CONVERSION
    ===================================================== */

    function priceToIdr(
        usdPrice,
        rate = null
    ) {
        const price =
            toNumber(
                usdPrice
            );

        if (price === null) {
            return null;
        }

        const exchangeRate =
            rate === null
                ? getUsdToIdrRate()
                : toNumber(rate);

        if (
            exchangeRate === null ||
            exchangeRate <= 0
        ) {
            return null;
        }

        return (
            price *
            exchangeRate
        );
    }

    function idrToUsd(
        idrPrice,
        rate = null
    ) {
        const price =
            toNumber(
                idrPrice
            );

        if (price === null) {
            return null;
        }

        const exchangeRate =
            rate === null
                ? getUsdToIdrRate()
                : toNumber(rate);

        if (
            exchangeRate === null ||
            exchangeRate <= 0
        ) {
            return null;
        }

        return (
            price /
            exchangeRate
        );
    }

    /* =====================================================
       LOAD PRICING
    ===================================================== */

    async function loadPricing(
        options = {}
    ) {
        const {
            force = false,
            workflowId = null,
            variantId = null,
            status = null
        } = options;

        /*
         * Gunakan cache jika tersedia.
         */
        if (
            !force &&
            pricingCache.length > 0
        ) {
            return filterPricing(
                pricingCache,
                {
                    workflowId,
                    variantId,
                    status
                }
            );
        }

        /*
         * Jika sedang loading,
         * gunakan request yang sama.
         */
        if (
            loadingPromise &&
            !force
        ) {
            const result =
                await loadingPromise;

            return filterPricing(
                result,
                {
                    workflowId,
                    variantId,
                    status
                }
            );
        }

        const supabase =
            getSupabase();

        if (!supabase) {
            throw new Error(
                "Supabase client belum tersedia."
            );
        }

        loadingPromise =
            (async function () {
                let query =
                    supabase
                        .from(
                            PRICING_TABLE
                        )
                        .select(`
                            id,
                            workflow_id,
                            variant_id,
                            operation,
                            sku_key,
                            billing_unit,
                            unit_price,
                            currency,
                            conditions,
                            pricing_context,
                            source_type,
                            source_url,
                            source_reference,
                            pricing_status,
                            effective_at,
                            expires_at,
                            status,
                            created_at,
                            updated_at
                        `)
                        .order(
                            "created_at",
                            {
                                ascending: false
                            }
                        );

                /*
                 * Status hanya diterapkan
                 * jika memang diberikan.
                 */
                if (status) {
                    query =
                        query.eq(
                            "status",
                            status
                        );
                }

                if (workflowId) {
                    query =
                        query.eq(
                            "workflow_id",
                            workflowId
                        );
                }

                if (variantId) {
                    query =
                        query.eq(
                            "variant_id",
                            variantId
                        );
                }

                const {
                    data,
                    error
                } = await query;

                if (error) {
                    console.error(
                        "[models-price] Gagal memuat pricing KIE:",
                        error
                    );

                    throw error;
                }

                pricingCache =
                    Array.isArray(data)
                        ? data
                        : [];

                return [
                    ...pricingCache
                ];
            })();

        try {
            return await loadingPromise;

        } finally {
            loadingPromise =
                null;
        }
    }

    /* =====================================================
       FILTER
    ===================================================== */

    function filterPricing(
        pricing,
        options = {}
    ) {
        const {
            workflowId = null,
            variantId = null,
            status = null
        } = options;

        if (
            !Array.isArray(pricing)
        ) {
            return [];
        }

        return pricing.filter(
            item => {

                if (
                    workflowId &&
                    String(
                        item.workflow_id ??
                        ""
                    ) !==
                    String(
                        workflowId
                    )
                ) {
                    return false;
                }

                if (
                    variantId &&
                    String(
                        item.variant_id ??
                        ""
                    ) !==
                    String(
                        variantId
                    )
                ) {
                    return false;
                }

                if (
                    status &&
                    normalizeString(
                        item.status
                    ) !==
                    normalizeString(
                        status
                    )
                ) {
                    return false;
                }

                return true;
            }
        );
    }

    /* =====================================================
       FIND PRICING FOR MODEL
    ===================================================== */

    function findPricingForModel(
        model,
        pricing = pricingCache
    ) {
        if (!model) {
            return [];
        }

        if (
            !Array.isArray(
                pricing
            )
        ) {
            return [];
        }

        const modelId =
            normalizeString(
                model.model_id
            );

        const modelName =
            normalizeString(
                model.model_name
            );

        const metadata =
            model.metadata &&
            typeof model.metadata ===
                "object"
                ? model.metadata
                : {};

        const workflowIds = [];

        if (
            metadata.workflow_id
        ) {
            workflowIds.push(
                String(
                    metadata.workflow_id
                )
            );
        }

        if (
            Array.isArray(
                metadata.workflow_ids
            )
        ) {
            metadata.workflow_ids
                .forEach(
                    id => {
                        if (id) {
                            workflowIds.push(
                                String(id)
                            );
                        }
                    }
                );
        }

        const uniqueWorkflowIds =
            [
                ...new Set(
                    workflowIds
                )
            ];

        return pricing.filter(
            item => {

                /*
                 * Match workflow ID.
                 */
                if (
                    uniqueWorkflowIds.includes(
                        String(
                            item.workflow_id ??
                            ""
                        )
                    )
                ) {
                    return true;
                }

                const sku =
                    normalizeString(
                        item.sku_key
                    );

                const operation =
                    normalizeString(
                        item.operation
                    );

                const context =
                    JSON.stringify(
                        item.pricing_context ||
                        {}
                    )
                        .toLowerCase();

                const conditions =
                    JSON.stringify(
                        item.conditions ||
                        {}
                    )
                        .toLowerCase();

                /*
                 * Model ID.
                 */
                if (
                    modelId &&
                    (
                        sku.includes(
                            modelId
                        ) ||
                        operation.includes(
                            modelId
                        ) ||
                        context.includes(
                            modelId
                        ) ||
                        conditions.includes(
                            modelId
                        )
                    )
                ) {
                    return true;
                }

                /*
                 * Model Name.
                 */
                if (
                    modelName &&
                    (
                        sku.includes(
                            modelName
                        ) ||
                        operation.includes(
                            modelName
                        ) ||
                        context.includes(
                            modelName
                        ) ||
                        conditions.includes(
                            modelName
                        )
                    )
                ) {
                    return true;
                }

                return false;
            }
        );
    }

    /* =====================================================
       LOWEST PRICE
    ===================================================== */

    function getLowestPrice(
        pricing
    ) {
        if (
            !Array.isArray(pricing) ||
            pricing.length === 0
        ) {
            return null;
        }

        let lowest = null;

        pricing.forEach(
            item => {

                const price =
                    toNumber(
                        item.unit_price
                    );

                if (
                    price === null ||
                    price < 0
                ) {
                    return;
                }

                if (
                    lowest === null ||
                    price <
                    Number(
                        lowest.unit_price
                    )
                ) {
                    lowest =
                        item;
                }
            }
        );

        return lowest;
    }

    /* =====================================================
       HIGHEST PRICE
    ===================================================== */

    function getHighestPrice(
        pricing
    ) {
        if (
            !Array.isArray(pricing) ||
            pricing.length === 0
        ) {
            return null;
        }

        let highest = null;

        pricing.forEach(
            item => {

                const price =
                    toNumber(
                        item.unit_price
                    );

                if (
                    price === null ||
                    price < 0
                ) {
                    return;
                }

                if (
                    highest === null ||
                    price >
                    Number(
                        highest.unit_price
                    )
                ) {
                    highest =
                        item;
                }
            }
        );

        return highest;
    }

    /* =====================================================
       AVERAGE PRICE
    ===================================================== */

    function getAveragePrice(
        pricing
    ) {
        if (
            !Array.isArray(pricing) ||
            pricing.length === 0
        ) {
            return null;
        }

        const values =
            pricing
                .map(
                    item =>
                        toNumber(
                            item.unit_price
                        )
                )
                .filter(
                    value =>
                        value !== null &&
                        value >= 0
                );

        if (
            values.length === 0
        ) {
            return null;
        }

        const total =
            values.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            );

        return (
            total /
            values.length
        );
    }

    /* =====================================================
       CALCULATE COST
    ===================================================== */

    function calculateCost(
        unitPrice,
        quantity = 1
    ) {
        const price =
            toNumber(
                unitPrice
            );

        const qty =
            Number(
                quantity
            );

        if (
            price === null ||
            !Number.isFinite(
                qty
            ) ||
            qty < 0
        ) {
            return null;
        }

        return (
            price *
            qty
        );
    }

    /* =====================================================
       CALCULATE DISCOUNT
       ===================================================== */

    function calculateDiscount(
        normalPrice,
        discountPercent
    ) {
        const price =
            toNumber(
                normalPrice
            );

        const discount =
            toNumber(
                discountPercent
            );

        if (
            price === null ||
            discount === null
        ) {
            return null;
        }

        if (
            discount < 0 ||
            discount > 100
        ) {
            return null;
        }

        return (
            price *
            (
                1 -
                (
                    discount /
                    100
                )
            )
        );
    }

    /* =====================================================
       CALCULATE FINAL CREDIT
    ===================================================== */

    function calculateCreditFinal(
        creditCost,
        discountPercent
    ) {
        const cost =
            toNumber(
                creditCost
            );

        const discount =
            toNumber(
                discountPercent
            );

        if (
            cost === null ||
            discount === null
        ) {
            return null;
        }

        if (
            discount < 0 ||
            discount > 100
        ) {
            return null;
        }

        return (
            cost *
            (
                1 -
                (
                    discount /
                    100
                )
            )
        );
    }

    /* =====================================================
       PRICE SUMMARY
    ===================================================== */

    function getPriceSummary(
        pricing
    ) {
        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {
            return {
                count: 0,
                lowest: null,
                highest: null,
                average: null,
                lowestIdr: null,
                highestIdr: null
            };
        }

        const lowest =
            getLowestPrice(
                pricing
            );

        const highest =
            getHighestPrice(
                pricing
            );

        const average =
            getAveragePrice(
                pricing
            );

        return {
            count:
                pricing.length,

            lowest,

            highest,

            average,

            lowestIdr:
                lowest
                    ? priceToIdr(
                        lowest.unit_price
                    )
                    : null,

            highestIdr:
                highest
                    ? priceToIdr(
                        highest.unit_price
                    )
                    : null,

            averageIdr:
                average !== null
                    ? priceToIdr(
                        average
                    )
                    : null
        };
    }

    /* =====================================================
       RENDER PRICE
    ===================================================== */

    function renderPrice(
        pricing
    ) {
        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {
            return `
                <div class="kie-price">
                    <div class="kie-price-empty">
                        Harga KIE belum tersedia
                    </div>
                </div>
            `;
        }

        const lowest =
            getLowestPrice(
                pricing
            );

        if (!lowest) {
            return `
                <div class="kie-price">
                    <div class="kie-price-empty">
                        Harga KIE tidak valid
                    </div>
                </div>
            `;
        }

        const usd =
            toNumber(
                lowest.unit_price
            );

        const idr =
            priceToIdr(
                usd
            );

        const unit =
            lowest.billing_unit ||
            "unit";

        const count =
            pricing.length;

        return `
            <div class="kie-price">

                <div class="kie-price-usd">
                    ${formatUsd(usd)}
                </div>

                <div class="kie-price-idr">
                    ${formatIdr(idr)}
                </div>

                <div class="kie-price-unit">
                    per ${escapeHtml(unit)}
                </div>

                ${
                    count > 1
                        ? `
                            <div class="kie-price-count">
                                ${count} pricing ditemukan
                            </div>
                        `
                        : ""
                }

            </div>
        `;
    }

    /* =====================================================
       RENDER PRICE PREVIEW
    ===================================================== */

    function renderPricePreview(
        pricing
    ) {
        if (
            !Array.isArray(
                pricing
            ) ||
            pricing.length === 0
        ) {
            return `
                <div class="kie-price-preview">
                    <div class="kie-price-empty">
                        Belum ada data harga KIE.
                    </div>
                </div>
            `;
        }

        const rows =
            pricing
                .slice(
                    0,
                    20
                )
                .map(
                    item => {

                        const usd =
                            toNumber(
                                item.unit_price
                            );

                        const idr =
                            priceToIdr(
                                usd
                            );

                        return `
                            <div class="kie-price-preview-row">

                                <div>
                                    <strong>
                                        ${escapeHtml(
                                            item.operation ||
                                            item.sku_key ||
                                            "KIE"
                                        )}
                                    </strong>

                                    <div class="kie-price-unit">
                                        ${escapeHtml(
                                            item.billing_unit ||
                                            "unit"
                                        )}
                                    </div>
                                </div>

                                <div>

                                    <div class="kie-price-usd">
                                        ${formatUsd(usd)}
                                    </div>

                                    <div class="kie-price-idr">
                                        ${formatIdr(idr)}
                                    </div>

                                </div>

                            </div>
                        `;
                    }
                )
                .join("");

        return `
            <div class="kie-price-preview">
                ${rows}
            </div>
        `;
    }

    /* =====================================================
       RENDER PRICE SUMMARY
    ===================================================== */

    function renderPriceSummary(
        pricing
    ) {
        const summary =
            getPriceSummary(
                pricing
            );

        if (
            summary.count === 0
        ) {
            return `
                <div class="kie-price-summary">
                    Harga KIE belum tersedia.
                </div>
            `;
        }

        return `
            <div class="kie-price-summary">

                <div class="kie-price-summary-row">
                    <span>Jumlah Pricing</span>
                    <strong>
                        ${summary.count}
                    </strong>
                </div>

                <div class="kie-price-summary-row">
                    <span>Harga Terendah</span>
                    <strong>
                        ${formatUsd(
                            summary.lowest?.unit_price
                        )}
                    </strong>
                </div>

                <div class="kie-price-summary-row">
                    <span>Harga Terendah IDR</span>
                    <strong>
                        ${formatIdr(
                            summary.lowestIdr
                        )}
                    </strong>
                </div>

                <div class="kie-price-summary-row">
                    <span>Harga Tertinggi</span>
                    <strong>
                        ${formatUsd(
                            summary.highest?.unit_price
                        )}
                    </strong>
                </div>

            </div>
        `;
    }

    /* =====================================================
       FIND MODEL PRICE
    ===================================================== */

    function getModelPrice(
        model,
        pricing = pricingCache
    ) {
        const matches =
            findPricingForModel(
                model,
                pricing
            );

        const lowest =
            getLowestPrice(
                matches
            );

        if (!lowest) {
            return null;
        }

        const usd =
            toNumber(
                lowest.unit_price
            );

        return {
            pricing: matches,

            item: lowest,

            usd,

            idr:
                priceToIdr(
                    usd
                ),

            currency:
                lowest.currency ||
                "USD",

            billing_unit:
                lowest.billing_unit ||
                "unit"
        };
    }

    /* =====================================================
       CACHE
    ===================================================== */

    function clearCache() {
        pricingCache = [];

        loadingPromise =
            null;
    }

    function getCachedPricing() {
        return [
            ...pricingCache
        ];
    }

    function hasCachedPricing() {
        return (
            pricingCache.length > 0
        );
    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize() {
        if (initialized) {
            return [
                ...pricingCache
            ];
        }

        try {
            const result =
                await loadPricing({
                    force: false
                });

            initialized =
                true;

            console.info(
                "[models-price] Pricing module initialized:",
                result.length
            );

            return result;

        } catch (error) {
            /*
             * Pricing bukan alasan halaman Models
             * harus gagal total.
             *
             * Model CRUD tetap dapat digunakan
             * walaupun tabel pricing sedang
             * kosong / tidak tersedia.
             */
            console.warn(
                "[models-price] Pricing initialization dilewati:",
                error
            );

            initialized =
                true;

            pricingCache =
                [];

            return [];
        }
    }

    /* =====================================================
       RESET
    ===================================================== */

    function reset() {
        initialized =
            false;

        clearCache();
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsPrice =
        Object.freeze({

            initialize,

            reset,

            loadPricing,

            filterPricing,

            findPricingForModel,

            getModelPrice,

            getLowestPrice,

            getHighestPrice,

            getAveragePrice,

            getPriceSummary,

            calculateCost,

            calculateDiscount,

            calculateCreditFinal,

            priceToIdr,

            idrToUsd,

            formatUsd,

            formatIdr,

            getUsdToIdrRate,

            setUsdToIdrRate,

            renderPrice,

            renderPricePreview,

            renderPriceSummary,

            clearCache,

            getCachedPricing,

            hasCachedPricing

        });

    console.log(
        "[GEN-Z.AI] GENZModelsPrice loaded."
    );

})();
