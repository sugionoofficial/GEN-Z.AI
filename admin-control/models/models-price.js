/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   KIE PRICE MODULE
   File: admin-control/models/models-price.js
========================================================= */

(function () {
    "use strict";

    let pricingCache = [];

    function getSupabase() {
        if (window.GENZ_SUPABASE) {
            return window.GENZ_SUPABASE;
        }

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        throw new Error(
            "Supabase client belum tersedia."
        );
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function toNumber(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }

    function formatUsd(value) {
        const number = toNumber(value);

        if (number === null) {
            return "-";
        }

        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            }
        ).format(number);
    }

    function formatIdr(value) {
        const number = toNumber(value);

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
        ).format(number);
    }

    function getUsdToIdrRate() {
        const candidates = [
            window.GENZ_USD_IDR_RATE,
            window.GENZ_CONFIG?.USD_IDR_RATE,
            localStorage.getItem(
                "GENZ_USD_IDR_RATE"
            )
        ];

        for (const candidate of candidates) {
            const rate = Number(candidate);

            if (
                Number.isFinite(rate) &&
                rate > 0
            ) {
                return rate;
            }
        }

        return 16000;
    }

    async function loadPricing(options = {}) {
        const {
            force = false,
            workflowId = null,
            variantId = null,
            status = null
        } = options;

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

        const supabase =
            getSupabase();

        let query = supabase
            .from("kie_pricing")
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

        if (status) {
            query = query.eq(
                "status",
                status
            );
        }

        if (workflowId) {
            query = query.eq(
                "workflow_id",
                workflowId
            );
        }

        if (variantId) {
            query = query.eq(
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
                "[models-price] Gagal memuat KIE pricing:",
                error
            );

            throw error;
        }

        pricingCache =
            Array.isArray(data)
                ? data
                : [];

        return [...pricingCache];
    }

    function filterPricing(
        pricing,
        options = {}
    ) {
        const {
            workflowId = null,
            variantId = null,
            status = null
        } = options;

        return pricing.filter(
            item => {
                if (
                    workflowId &&
                    String(
                        item.workflow_id
                    ) !== String(
                        workflowId
                    )
                ) {
                    return false;
                }

                if (
                    variantId &&
                    String(
                        item.variant_id
                    ) !== String(
                        variantId
                    )
                ) {
                    return false;
                }

                if (
                    status &&
                    String(
                        item.status || ""
                    ).toLowerCase() !==
                        String(
                            status
                        ).toLowerCase()
                ) {
                    return false;
                }

                return true;
            }
        );
    }

    function findPricingForModel(
        model,
        pricing = pricingCache
    ) {
        if (!model) {
            return [];
        }

        const modelId =
            String(
                model.model_id || ""
            )
            .trim()
            .toLowerCase();

        const modelName =
            String(
                model.model_name || ""
            )
            .trim()
            .toLowerCase();

        const metadata =
            model.metadata || {};

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
                .forEach(id => {
                    if (id) {
                        workflowIds.push(
                            String(id)
                        );
                    }
                });
        }

        const uniqueWorkflowIds =
            [
                ...new Set(
                    workflowIds
                )
            ];

        return pricing.filter(
            item => {
                if (
                    uniqueWorkflowIds
                        .includes(
                            String(
                                item.workflow_id
                            )
                        )
                ) {
                    return true;
                }

                const sku =
                    String(
                        item.sku_key || ""
                    )
                    .toLowerCase();

                const operation =
                    String(
                        item.operation || ""
                    )
                    .toLowerCase();

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

    function getLowestPrice(
        pricing
    ) {
        if (
            !Array.isArray(pricing) ||
            !pricing.length
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
                    price < lowest.unit_price
                ) {
                    lowest = item;
                }
            }
        );

        return lowest;
    }

    function getHighestPrice(
        pricing
    ) {
        if (
            !Array.isArray(pricing) ||
            !pricing.length
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
                    price > highest.unit_price
                ) {
                    highest = item;
                }
            }
        );

        return highest;
    }

    function priceToIdr(
        usdPrice
    ) {
        const price =
            toNumber(
                usdPrice
            );

        if (price === null) {
            return null;
        }

        return (
            price *
            getUsdToIdrRate()
        );
    }

    function renderPrice(
        pricing
    ) {
        if (
            !Array.isArray(pricing) ||
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
                        Harga tidak valid
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

    function renderPricePreview(
        pricing
    ) {
        if (
            !Array.isArray(pricing) ||
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
                .slice(0, 20)
                .map(item => {
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
                                    ${formatUsd(
                                        usd
                                    )}
                                </div>

                                <div class="kie-price-idr">
                                    ${formatIdr(
                                        idr
                                    )}
                                </div>
                            </div>
                        </div>
                    `;
                })
                .join("");

        return `
            <div class="kie-price-preview">
                ${rows}
            </div>
        `;
    }

    function calculateCost(
        unitPrice,
        quantity = 1
    ) {
        const price =
            toNumber(
                unitPrice
            );

        const qty =
            Number(quantity);

        if (
            price === null ||
            !Number.isFinite(qty)
        ) {
            return null;
        }

        return price * qty;
    }

    function clearCache() {
        pricingCache = [];
    }

    function getCachedPricing() {
        return [
            ...pricingCache
        ];
    }

    function initialize() {
        return loadPricing({
            force: false
        }).catch(
            error => {
                console.error(
                    "[models-price] Initialization error:",
                    error
                );

                return [];
            }
        );
    }

    window.GENZModelsPrice =
        Object.freeze({
            initialize,
            loadPricing,
            findPricingForModel,
            getLowestPrice,
            getHighestPrice,
            calculateCost,
            priceToIdr,
            renderPrice,
            renderPricePreview,
            clearCache,
            getCachedPricing,
            formatUsd,
            formatIdr,
            getUsdToIdrRate
        });
})();
