export function getCreditCost(item) {
    if (!item) {
        return 0;
    }

    const value = item.credit_cost ?? item.credits_used ?? item.cost ?? 0;
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}

export function getRefundAmount(item) {
    if (!item) {
        return 0;
    }

    const rawAmount =
        item.refunded_credit ??
        item.refunded_credits ??
        item.refund_amount ??
        item.credits_refunded;
    const explicitAmount = Number(rawAmount);

    if (
        rawAmount !== null &&
        rawAmount !== undefined &&
        rawAmount !== "" &&
        Number.isFinite(explicitAmount) &&
        explicitAmount > 0
    ) {
        return explicitAmount;
    }

    const refundFlag = String(item.credit_refunded ?? "")
        .trim()
        .toLowerCase();

    // Older generation_history rows store the refund flag but not its amount.
    // In that schema, the original credit_cost is the refunded amount.
    if (["true", "1", "yes"].includes(refundFlag)) {
        return Math.max(getCreditCost(item), 0);
    }

    return 0;
}

export function getNetCreditCost(item) {
    return Math.max(getCreditCost(item) - getRefundAmount(item), 0);
}
