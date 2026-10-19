import test from "node:test";
import assert from "node:assert/strict";

import {
    getCreditCost,
    getNetCreditCost,
    getRefundAmount
} from "../credit/assets/js/credit-utils.js";

test("uses the persisted refund amount when it is available", () => {
    const row = {
        credit_cost: 20,
        credit_refunded: true,
        refunded_credit: 12
    };

    assert.equal(getCreditCost(row), 20);
    assert.equal(getRefundAmount(row), 12);
    assert.equal(getNetCreditCost(row), 8);
});

test("uses the charged cost for older rows with a confirmed refund flag", () => {
    const row = {
        status: "failed",
        credit_cost: "15",
        credit_refunded: true
    };

    assert.equal(getRefundAmount(row), 15);
    assert.equal(getNetCreditCost(row), 0);
});

test("does not treat a failed row as refunded unless refund is confirmed", () => {
    const row = {
        status: "failed",
        credit_cost: 15,
        credit_refunded: false
    };

    assert.equal(getRefundAmount(row), 0);
    assert.equal(getNetCreditCost(row), 15);
});

test("does not produce a negative net usage when refund exceeds the charge", () => {
    const row = {
        credit_cost: 5,
        refunded_credit: 9
    };

    assert.equal(getRefundAmount(row), 9);
    assert.equal(getNetCreditCost(row), 0);
});
